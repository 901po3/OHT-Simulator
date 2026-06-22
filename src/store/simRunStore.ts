import { create } from 'zustand';
import type { RailNode, RailEdge } from '../core/graph/types';
import type { EditorNode, EditorEdge } from './editorStore';
import {
  standardAStar, dijkstra, greedyBFS, stochasticAStar, priorityAStar, cbsLite,
  type AlgorithmId,
} from '../core/pathfinding/algorithms';

// ── 런타임 그래프 변환 ─────────────────────────────────
export function buildRuntimeGraph(
  eNodes: EditorNode[],
  eEdges: EditorEdge[],
): Map<string, RailNode> {
  const map = new Map<string, RailNode>();
  for (const n of eNodes) {
    map.set(n.id, { id: n.id, x: n.x, y: n.y, type: n.type as RailNode['type'], edges: [] });
  }
  for (const e of eEdges) {
    const from = map.get(e.fromId);
    const to   = map.get(e.toId);
    if (!from || !to) continue;
    const edge: RailEdge = { from, to, weight: 1 };
    from.edges.push(edge);
  }
  return map;
}

// ── 공정 사이클 ────────────────────────────────────────
const PROCESS_CYCLE = ['Deposition', 'Exposure', 'Etching', 'Cleaning'] as const;
const PROCESS_TIME   = 1.5;
const SPAWN_INTERVAL = 0.5; // 100대 빠른 램프업 — 차고지당 2대/초

// 스톨 감지: 이 초 동안 완료 공정 없으면 리포트 생성
const STALL_THRESHOLD_SEC = 10;
// 이동 중 블록 지속 시 재경로 탐색 임계 (초)
const REPATH_THRESHOLD_SEC = 0.5;

// ── 경로 분산 상수 ─────────────────────────────────────
// plannedCong 누적 가중치: 이번 tick에 경로를 잡는 에이전트끼리 동일 경로를 회피하도록 유도
// cong=1.0 도달 시 Priority A*의 costMul은 1 + 1.0×2.5 = 3.5 (통행 불가가 아닌 고비용)
// → 경로는 항상 존재하므로 포화 시 데드락이 아닌 비효율 우회로 그치며 안전
const PLANNED_CONG_BUMP        = 0.35 as const; // 일반 경로 누적치 — 약 3회 중복 시 포화
const PLANNED_CONG_RECALL_BUMP = 0.30 as const; // 귀환 경로 누적치 (일반보다 약하게)
const CBS_LOOKAHEAD            = 8    as const; // CBS 예약 테이블 lookahead 노드 수 (기존 5 → 넓은 그리드 맵 대응)

// ── 에이전트 ───────────────────────────────────────────
export type AgentState = 'Idle' | 'Moving' | 'Waiting' | 'Processing';

export interface SimAgent {
  id: string;
  color: string;
  currentNode: RailNode;
  nextNode: RailNode | null;
  path: RailNode[];
  pathIndex: number;
  progress: number;
  state: AgentState;
  stateTimer: number;
  processStage: number;
  totalDistance: number;
  totalJobs: number;
  blockedSec: number;   // Moving 중 차단된 누적 시간 → 재경로 탐색 트리거
  idleCooldown: number; // 블록 후 Idle 복귀 시 재계획 대기 시간 (랜덤 분산)
  recalling: boolean; // 차고지 귀환 중 — 도착 시 제거
  spawnElapsed: number; // 스폰 시점의 경과 시간 → 로봇별 평균 처리량 계산용
}

// ── 처리량 메트릭 ──────────────────────────────────────
export interface ThroughputSample { t: number; perRobot: number; total: number }
export interface AgentRateSample { t: number; rate: number }
export interface EfficiencySnapshot {
  procUtil: number;           // 공정 노드 가동률 (0~1, %)
  avgWaitSec: number;         // 평균 대기 시간 (초)
  idleRatio: number;          // 로봇 유휴 비율 (0~1, %)
  avgMoveDist: number;        // 평균 이동 거리 (칸)
  congestionLevel: number;    // 전체 혼잡도 (0~1, %)
  bottleneckNodeId: string | null; // 병목 노드 ID
  bottleneckCongestion: number;    // 병목 혼잡도
  optimalRobotCount: number;  // 처리량 꺾이는 지점의 로봇 수 (-1 = 미판별)
  optimalHint: string;        // 최적 투입 판정 문구
}
const SAMPLE_SEC        = 1.5; // 처리량 샘플링 주기 (초)
const MAX_SAMPLES       = 80;  // 전체 시계열 길이
const MAX_AGENT_SAMPLES = 40;  // 로봇별 시계열 길이

// ── 스톨 리포트 ────────────────────────────────────────
export type StallCause =
  | 'deadlock'          // 에이전트들이 서로를 막고 있음
  | 'no-path'           // 알고리즘이 경로를 못 찾음 (그래프 단절)
  | 'no-process-nodes'  // 공정 노드가 없거나 도달 불가
  | 'all-idle';         // 모든 에이전트 Idle (목적지 없음)

export interface AgentSnapshot {
  id: string;
  state: AgentState;
  blockedSec: number;
  currentNodeId: string;
  nextProcessStage: string;
  totalJobs: number;
}

export interface StallReport {
  detectedAt: number;        // elapsed 초
  cause: StallCause;
  causeDetail: string;       // 사람이 읽을 수 있는 설명
  affectedAgents: AgentSnapshot[];
  congestionHotspots: Array<{ nodeId: string; nodeType: string; value: number }>;
  suggestions: string[];
  mapAdvice?: string;        // 맵 에디터 수정 권장 메시지
}

// ── 색상 ───────────────────────────────────────────────
const COLORS = ['#58a6ff','#3fb950','#ffa657','#bc8cff','#f85149','#39d353','#d29922','#e8912d'];

function euclidean(a: RailNode, b: RailNode) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getNextTarget(
  agent: SimAgent,
  allNodes: RailNode[],
  autoDispatch: boolean,
  targetedNodes?: Set<string>,
  targetCount?: Map<string, number>, // 이미 해당 노드로 향하거나 처리 중인 에이전트 수
): RailNode | null {
  // 노드 포화 한계: 공정 1개당 최대 2대 (처리 중 1 + 대기 이동 중 1)
  // 초과 시 같은 타입의 다른 노드로 우회 → 로봇 쏠림 방지
  const MAX_PER_NODE = 2;

  for (let i = 0; i < 4; i++) {
    const targetType = PROCESS_CYCLE[(agent.processStage + i) % 4];
    const candidates = allNodes.filter(n => n.type === targetType && n.id !== agent.currentNode.id);
    if (candidates.length === 0) continue;

    if (!autoDispatch) return candidates[0];

    // 포화되지 않은 노드 우선 (이미 MAX_PER_NODE 이상이면 제외)
    const available = targetCount
      ? candidates.filter(n => (targetCount.get(n.id) ?? 0) < MAX_PER_NODE)
      : candidates;
    // 이번 tick에 이미 다른 에이전트가 배정받지 않은 노드 선호
    const free = (available.length > 0 ? available : candidates)
      .filter(n => !targetedNodes?.has(n.id));
    const pool = free.length > 0 ? free
      : available.length > 0 ? available
      : candidates;

    return pool.reduce((best, n) =>
      euclidean(agent.currentNode, n) < euclidean(agent.currentNode, best) ? n : best
    );
  }
  const normals = allNodes.filter(n => n.type === 'Normal' && n.id !== agent.currentNode.id);
  if (normals.length > 0) return normals[0];
  return allNodes.find(n => n.id !== agent.currentNode.id) ?? null;
}

function findPath(
  from: RailNode,
  to: RailNode,
  algoId: AlgorithmId,
  congestion: Map<string, number>,
  reservations: Map<string, number>,
): RailNode[] {
  switch (algoId) {
    case 'standard':   return standardAStar(from, to);
    case 'dijkstra':   return dijkstra(from, to);
    case 'greedy':     return greedyBFS(from, to);
    case 'stochastic': return stochasticAStar(from, to);
    case 'priority':   return priorityAStar(from, to, congestion);
    case 'cbs':        return cbsLite(from, to, reservations);
  }
}

// ── 스톨 원인 분석 ─────────────────────────────────────
function analyzeStall(
  agents: SimAgent[],
  allNodes: RailNode[],
  congestion: Map<string, number>,
  algorithmId: AlgorithmId,
): StallReport {
  const processNodeTypes = PROCESS_CYCLE.map(s => s as string);
  const hasProcessNodes  = allNodes.some(n => processNodeTypes.includes(n.type));
  const blockedAgents    = agents.filter(a => (a.state === 'Moving' || a.state === 'Waiting') && a.blockedSec > 0.5);
  const idleAgents       = agents.filter(a => a.state === 'Idle');

  const hotspots = [...congestion.entries()]
    .map(([nodeId, v]) => {
      const nd = allNodes.find(n => n.id === nodeId);
      return { nodeId, nodeType: nd?.type ?? 'Unknown', value: v };
    })
    .filter(h => h.value > 0.3)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const snapshot: AgentSnapshot[] = agents.map(a => ({
    id: a.id,
    state: a.state,
    blockedSec: parseFloat(a.blockedSec.toFixed(1)),
    currentNodeId: a.currentNode.id,
    nextProcessStage: PROCESS_CYCLE[a.processStage % 4],
    totalJobs: a.totalJobs,
  }));

  // 공정 노드 없음
  if (!hasProcessNodes) {
    return {
      detectedAt: 0,
      cause: 'no-process-nodes',
      causeDetail: '맵에 공정 노드(증착/노광/식각/세정)가 없어서 에이전트들이 목적지를 찾지 못합니다.',
      affectedAgents: snapshot,
      congestionHotspots: hotspots,
      suggestions: [
        '맵 에디터에서 Deposition / Exposure / Etching / Cleaning 노드를 최소 1개씩 추가하세요.',
        '공정 노드에 레일(엣지)을 연결해 에이전트가 도달할 수 있도록 하세요.',
      ],
      mapAdvice: '맵 에디터로 돌아가 공정 노드를 추가하고 레일로 연결하세요.',
    };
  }

  // 데드락 (이동 중 블록 다수)
  if (blockedAgents.length >= agents.length * 0.5) {
    const algoAdvice =
      algorithmId === 'standard' || algorithmId === 'dijkstra'
        ? 'CBS-Lite 또는 Priority A* 알고리즘은 충돌 회피를 내장합니다. 전환을 권장합니다.'
        : '현재 알고리즘은 충돌 회피를 지원하지만 데드락이 발생했습니다. 에이전트 수를 줄이거나 맵에 우회 경로를 추가하세요.';
    return {
      detectedAt: 0,
      cause: 'deadlock',
      causeDetail: `${blockedAgents.length}/${agents.length}대 에이전트가 서로를 막아 이동하지 못하고 있습니다.`,
      affectedAgents: snapshot,
      congestionHotspots: hotspots,
      suggestions: [
        algoAdvice,
        '에이전트 수를 현재보다 줄여보세요.',
        '맵 에디터에서 교차로나 우회 경로를 추가해 여러 경로를 만드세요.',
        '단방향 레일이 병목 지점을 만들고 있을 수 있습니다. 양방향 연결 확인.',
      ],
      mapAdvice: hotspots.length > 0
        ? `혼잡 노드 (${hotspots.map(h => h.nodeId).join(', ')}) 근처에 우회 경로를 추가하세요.`
        : '레일 구조에 막다른 길이 없는지 확인하세요.',
    };
  }

  // 경로 없음 (알고리즘이 빈 경로 반환)
  const canFindAnyPath = agents.some(a => {
    const target = getNextTarget(a, allNodes, true);
    if (!target) return false;
    const path = standardAStar(a.currentNode, target);
    return path.length > 0;
  });
  if (!canFindAnyPath) {
    return {
      detectedAt: 0,
      cause: 'no-path',
      causeDetail: '에이전트들이 공정 노드까지 가는 경로를 찾지 못하고 있습니다. 그래프가 단절되어 있을 수 있습니다.',
      affectedAgents: snapshot,
      congestionHotspots: hotspots,
      suggestions: [
        '맵 에디터에서 레일이 끊겨 있는지 확인하세요.',
        '단방향 레일만 있을 경우 순환 경로가 없으면 일부 노드가 도달 불가입니다.',
        '모든 공정 노드에 연결된 레일이 있는지 확인하세요.',
      ],
      mapAdvice: '맵 에디터로 돌아가 단절된 레일을 연결하거나 양방향 연결로 변경하세요.',
    };
  }

  // 진전 없음 — 실제 상태별 카운트 표시
  const movingCount    = agents.filter(a => a.state === 'Moving').length;
  const processingCount = agents.filter(a => a.state === 'Processing').length;
  const waitingCount   = agents.filter(a => a.state === 'Waiting').length;
  const causeDetail = idleAgents.length > agents.length * 0.5
    ? `${idleAgents.length}/${agents.length}대가 Idle — 공정 노드에 도달하지 못하거나 사이클이 끝났습니다.`
    : `10초간 공정 완료 없음 (Moving ${movingCount}대 · Waiting ${waitingCount}대 · Processing ${processingCount}대 · Idle ${idleAgents.length}대). 로봇들이 공정 노드 주변을 반복 순환 중일 수 있습니다.`;

  return {
    detectedAt: 0,
    cause: 'all-idle',
    causeDetail,
    affectedAgents: snapshot,
    congestionHotspots: hotspots,
    suggestions: [
      '공정 노드 종류(증착·노광·식각·세정)가 각 루트에 골고루 배치되었는지 확인하세요.',
      '맵에 Depot 노드를 추가하면 에이전트를 지속적으로 스폰합니다.',
      '로봇 수를 줄이거나 Priority A* / CBS-Lite 알고리즘을 사용하면 개선될 수 있습니다.',
    ],
  };
}

// ── 스토어 ─────────────────────────────────────────────
interface SimRunState {
  running: boolean;
  graph: Map<string, RailNode>;
  allNodes: RailNode[]; // tick마다 재생성 방지 (N-1)
  agents: SimAgent[];
  agentSeq: number;
  algorithmId: AlgorithmId;
  agentCount: number;
  speed: number;
  autoDispatch: boolean;
  spawnTimers: Map<string, number>;
  stats: {
    completedJobs: number;
    totalDistance: number;
    elapsedSec: number;
    distPerSec: number;
  };
  congestion: Map<string, number>;
  stallReport: StallReport | null;
  stallSinceSec: number; // 마지막 completedJobs 이후 초
  overcrowdWarning: string | null; // 로봇 과잉 투입 경고

  // 처리량 메트릭
  selectedAgentId: string | null;            // 클릭 선택된 로봇 (null = 전체 평균)
  throughputHistory: ThroughputSample[];      // 전체 처리량 시계열
  agentRateHistory: Map<string, AgentRateSample[]>; // 로봇별 처리량 시계열
  efficiency: EfficiencySnapshot | null;
  _sampleAccum: number;
  _lastSampleElapsed: number;
  _lastTotalJobs: number;
  _lastAgentJobs: Map<string, number>;

  startSim: (eNodes: EditorNode[], eEdges: EditorEdge[]) => void;
  stopSim: () => void;
  setAlgorithm: (id: AlgorithmId) => void;
  setAgentCount: (n: number) => void;
  setSpeed: (s: number) => void;
  setAutoDispatch: (v: boolean) => void;
  setSelectedAgent: (id: string | null) => void;
  dismissStallReport: () => void;
  tick: (dt: number) => void;
}

export const useSimRunStore = create<SimRunState>((set, get) => ({
  running: false,
  graph: new Map(),
  allNodes: [],
  agents: [],
  agentSeq: 1,
  algorithmId: 'priority',
  agentCount: 4,
  speed: 1,        // 기본값 낮춤 (이전: 2)
  autoDispatch: true,
  spawnTimers: new Map(),
  stats: { completedJobs: 0, totalDistance: 0, elapsedSec: 0, distPerSec: 0 },
  congestion: new Map(),
  stallReport: null,
  stallSinceSec: 0,
  overcrowdWarning: null,

  selectedAgentId: null,
  throughputHistory: [],
  agentRateHistory: new Map(),
  efficiency: null,
  _sampleAccum: 0,
  _lastSampleElapsed: 0,
  _lastTotalJobs: 0,
  _lastAgentJobs: new Map(),

  startSim(eNodes, eEdges) {
    const graph = buildRuntimeGraph(eNodes, eEdges);
    const allNodes = [...graph.values()];
    if (allNodes.length < 2) return;

    const depots = allNodes.filter(n => n.type === 'Depot');
    const spawnTimers = new Map<string, number>();
    depots.forEach(d => spawnTimers.set(d.id, 0));

    let agents: SimAgent[] = [];
    const { agentCount } = get();

    const mkAgent = (node: RailNode, seq: number): SimAgent => ({
      id: `OHT-${seq}`, color: COLORS[(seq - 1) % COLORS.length],
      currentNode: node, nextNode: null, path: [], pathIndex: 0, progress: 0,
      state: 'Idle', stateTimer: 0, processStage: (seq - 1) % 4, // 스테이지 순환 배정으로 초기 분산
      totalDistance: 0, totalJobs: 0, blockedSec: 0, idleCooldown: 0, recalling: false,
      spawnElapsed: 0,
    });

    if (depots.length === 0) {
      agents = Array.from({ length: Math.min(agentCount, allNodes.length) }, (_, i) =>
        mkAgent(allNodes[i % allNodes.length], i + 1)
      );
    }

    set({
      running: true, graph, allNodes, agents,
      agentSeq: agents.length + 1, spawnTimers,
      congestion: new Map(), stallReport: null, stallSinceSec: 0,
      overcrowdWarning: null,
      stats: { completedJobs: 0, totalDistance: 0, elapsedSec: 0, distPerSec: 0 },
      selectedAgentId: null, throughputHistory: [], agentRateHistory: new Map(), efficiency: null,
      _sampleAccum: 0, _lastSampleElapsed: 0, _lastTotalJobs: 0, _lastAgentJobs: new Map(),
    });
  },

  stopSim() {
    set({
      running: false, agents: [], spawnTimers: new Map(),
      agentSeq: 1, stallReport: null, stallSinceSec: 0, overcrowdWarning: null,
      selectedAgentId: null, throughputHistory: [], agentRateHistory: new Map(), efficiency: null,
      _sampleAccum: 0, _lastSampleElapsed: 0, _lastTotalJobs: 0, _lastAgentJobs: new Map(),
    });
  },

  setAlgorithm: (id) => set({ algorithmId: id }),

  setAgentCount(n) {
    const { agents, allNodes } = get();
    const depots = allNodes.filter(nd => nd.type === 'Depot');
    const active = agents.filter(a => !a.recalling);
    const excess = active.length - n;

    if (excess > 0) {
      // 가장 가까운 차고지 순으로 초과분 귀환 지정
      const scored = active.map(a => {
        const dist = depots.length > 0
          ? Math.min(...depots.map(d => Math.abs(a.currentNode.x - d.x) + Math.abs(a.currentNode.y - d.y)))
          : 0;
        return { id: a.id, dist };
      }).sort((x, y) => x.dist - y.dist);
      const recallSet = new Set(scored.slice(0, excess).map(s => s.id));
      set({ agentCount: n, agents: agents.map(a => recallSet.has(a.id) ? { ...a, recalling: true } : a) });
    } else {
      set({ agentCount: n });
    }
  },
  setSpeed: (s) => set({ speed: s }),
  setAutoDispatch: (v) => set({ autoDispatch: v }),
  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  dismissStallReport: () => set({ stallReport: null, stallSinceSec: 0 }),

  tick(dt) {
    const {
      agents, allNodes, algorithmId, speed, stats,
      agentCount, agentSeq, spawnTimers, autoDispatch,
      stallSinceSec, stallReport,
      throughputHistory, agentRateHistory,
      _sampleAccum, _lastSampleElapsed, _lastTotalJobs, _lastAgentJobs,
    } = get();
    if (allNodes.length < 2) return;

    // 에이전트 배열을 얕은 복사(객체는 새로 생성) → Zustand 상태 오염 방지
    const newAgents: SimAgent[] = agents.map(a => ({ ...a }));
    let nextSeq = agentSeq;

    // 혼잡도 갱신
    const newCong = new Map<string, number>();
    for (const a of newAgents) {
      newCong.set(a.currentNode.id, (newCong.get(a.currentNode.id) ?? 0) + 1);
    }
    newCong.forEach((v, k) => newCong.set(k, Math.min(v / Math.max(newAgents.length, 1), 1)));

    // CBS 예약 테이블 — 매 tick 새로 생성 (누적 시 경로 탐색 품질 저하 방지)
    const newReservations = new Map<string, number>();
    for (const a of newAgents) {
      if (a.state === 'Moving' || a.state === 'Waiting') {
        a.path.slice(a.pathIndex, a.pathIndex + CBS_LOOKAHEAD).forEach((n, i) => {
          if (!newReservations.has(n.id)) newReservations.set(n.id, i);
        });
      }
    }

    // 계획 혼잡도 — 이번 tick에 새로 경로를 잡는 에이전트끼리 같은 경로 회피
    // Idle → Moving 전환 시마다 경로 노드를 누적해 다음 에이전트가 다른 경로를 선택하도록 유도
    const plannedCong = new Map<string, number>(newCong);

    // 차고지 스폰
    const depots = allNodes.filter(n => n.type === 'Depot');
    const newSpawnTimers = new Map(spawnTimers);

    for (const depot of depots) {
      const elapsed = (newSpawnTimers.get(depot.id) ?? 0) + dt;
      const activeCount = newAgents.filter(a => !a.recalling).length;
      if (elapsed >= SPAWN_INTERVAL && activeCount < agentCount) {
        const occupiedDepot = newAgents.some(
          a => a.currentNode.id === depot.id || a.nextNode?.id === depot.id
        );
        if (!occupiedDepot) {
          const colorIdx = (nextSeq - 1) % COLORS.length;
          newAgents.push({
            id: `OHT-${nextSeq++}`,
            color: COLORS[colorIdx],
            currentNode: depot,
            nextNode: null,
            path: [],
            pathIndex: 0,
            progress: 0,
            state: 'Idle',
            stateTimer: 0,
            processStage: 0,
            totalDistance: 0,
            totalJobs: 0,
            blockedSec: 0,
            idleCooldown: 0,
            recalling: false,
            spawnElapsed: stats.elapsedSec + dt,
          });
          newSpawnTimers.set(depot.id, elapsed - SPAWN_INTERVAL);
        } else {
          newSpawnTimers.set(depot.id, elapsed);
        }
      } else {
        newSpawnTimers.set(depot.id, elapsed);
      }
    }

    // 현재 점유 노드를 계획 혼잡도에 강하게 반영 → 재계획 시 점유 노드 회피
    for (const a of newAgents) {
      plannedCong.set(a.currentNode.id, 1.0);
      if (a.nextNode) plannedCong.set(a.nextNode.id, 1.0);
    }

    // 목적지별 에이전트 수 집계 — 포화 노드를 Idle 에이전트가 피하도록
    const targetCount = new Map<string, number>();
    for (const a of newAgents) {
      if ((a.state === 'Moving' || a.state === 'Waiting') && a.path.length > 0) {
        const dest = a.path[a.path.length - 1];
        targetCount.set(dest.id, (targetCount.get(dest.id) ?? 0) + 1);
      }
      if (a.state === 'Processing') {
        targetCount.set(a.currentNode.id, (targetCount.get(a.currentNode.id) ?? 0) + 1);
      }
    }

    // Moving 에이전트들의 현재 목적지 집합 — Idle 에이전트가 같은 목적지를 피하도록
    const targetedNodes = new Set<string>(
      newAgents
        .filter(a => (a.state === 'Moving' || a.state === 'Waiting') && a.path.length > 0)
        .map(a => a.path[a.path.length - 1].id)
    );

    let completedDelta = 0;
    let distDelta = 0;

    // ═══ 예약 기반 이동 + 사이클 회전 교착 해소 ════════════════════════
    // 단방향 그리드에서 2-cycle(정면충돌)은 구조적 불가 → 남는 교착은 3대+ 루프뿐.
    // 이를 '동시 회전(rotation)'으로 무조건 해소 → 영구 교착이 수학적으로 불가능.
    // 일반 흐름은 '기차(train)' 규칙으로 처리: 앞 로봇이 칸을 비우면 같은 tick에 뒤 로봇이 진입.

    // ── PASS 0: 상태 타이머 누적 ──
    for (const a of newAgents) a.stateTimer += dt;

    // ── PASS A: 이동 중(in-transit) 에이전트 전진 ──
    for (const a of newAgents) {
      if (!a.nextNode) continue;
      a.progress += dt * speed;
      if (a.progress >= 1) {
        a.currentNode = a.nextNode;
        a.nextNode    = null;
        a.pathIndex++;
        a.progress    = 0;
        a.totalDistance++; distDelta++;
        a.blockedSec  = 0;
        if (a.pathIndex >= a.path.length - 1) {
          // 경로 끝 도달
          a.path = []; a.pathIndex = 0;
          if (a.recalling) a.state = 'Idle';                       // 차고지 도착 → 제거 대상
          else { a.state = 'Processing'; a.stateTimer = 0; }       // 공정 노드 도착
        } else {
          a.state = 'Moving';
        }
      }
    }

    // ── PASS B: 공정 처리 완료 ──
    for (const a of newAgents) {
      if (a.state !== 'Processing') continue;
      a.blockedSec = 0;
      if (a.stateTimer >= PROCESS_TIME) {
        completedDelta++; a.totalJobs++;
        const idx = PROCESS_CYCLE.indexOf(a.currentNode.type as typeof PROCESS_CYCLE[number]);
        a.processStage = idx >= 0 ? (idx + 1) % 4 : (a.processStage + 1) % 4;
        a.state = 'Idle'; a.stateTimer = 0;
        a.idleCooldown = Math.random() * 0.4; // 동시 완료 로봇 분산
      }
    }

    // ── PASS C: Idle 에이전트 경로 계획 ──
    for (const a of newAgents) {
      if (a.state !== 'Idle') continue;
      a.blockedSec = 0;
      if (a.idleCooldown > 0) { a.idleCooldown -= dt; continue; }

      // 귀환 모드: 가장 가까운 차고지로
      if (a.recalling) {
        if (depots.length === 0 || depots.some(d => d.id === a.currentNode.id)) continue; // 제거 대상
        const dep = depots.reduce((best, d) =>
          (Math.abs(a.currentNode.x - d.x) + Math.abs(a.currentNode.y - d.y)) <
          (Math.abs(a.currentNode.x - best.x) + Math.abs(a.currentNode.y - best.y)) ? d : best);
        const path = findPath(a.currentNode, dep, algorithmId, plannedCong, newReservations);
        if (path.length > 1) {
          a.path = path; a.pathIndex = 0; a.state = 'Moving'; a.stateTimer = 0; a.blockedSec = 0;
          path.slice(1).forEach(n => plannedCong.set(n.id, Math.min((plannedCong.get(n.id) ?? 0) + PLANNED_CONG_RECALL_BUMP, 1)));
        }
        continue;
      }

      const target = getNextTarget(a, allNodes, autoDispatch, targetedNodes, targetCount);
      if (!target) continue;
      if (target.id === a.currentNode.id) { a.state = 'Processing'; a.stateTimer = 0; continue; }
      const path = findPath(a.currentNode, target, algorithmId, plannedCong, newReservations);
      if (path.length > 1) {
        path.slice(1).forEach(n => plannedCong.set(n.id, Math.min((plannedCong.get(n.id) ?? 0) + PLANNED_CONG_BUMP, 1)));
        a.path = path; a.pathIndex = 0; a.state = 'Moving'; a.stateTimer = 0; a.blockedSec = 0;
        targetedNodes.add(target.id);
        targetCount.set(target.id, (targetCount.get(target.id) ?? 0) + 1);
      }
    }

    // ── PASS D: 예약 기반 한 칸 전진 결정 ──
    // atNode: 각 노드에 현재 머무는 에이전트 (currentNode 기준, 노드당 1대 불변).
    // incoming: 이번 tick 해당 노드로 진입 예약된 에이전트.
    const atNode   = new Map<string, SimAgent>();
    const incoming = new Map<string, string>();
    for (const a of newAgents) {
      atNode.set(a.currentNode.id, a);
      if (a.nextNode) incoming.set(a.nextNode.id, a.id);
    }

    interface Mover { a: SimAgent; next: RailNode; claimed: boolean; vs: number; }
    const movers: Mover[] = [];
    const moverByAgentId = new Map<string, Mover>();
    for (const a of newAgents) {
      if (a.nextNode) continue;                                   // 이미 이동 중
      if (a.state !== 'Moving' && a.state !== 'Waiting') continue;
      if (a.path.length === 0) { a.state = 'Idle'; a.blockedSec = 0; continue; }
      const nextIdx = a.pathIndex + 1;
      if (nextIdx >= a.path.length) {                             // 경로 끝 = 도착
        a.path = []; a.pathIndex = 0; a.blockedSec = 0;
        if (a.recalling) a.state = 'Idle';
        else { a.state = 'Processing'; a.stateTimer = 0; }
        continue;
      }
      const m: Mover = { a, next: a.path[nextIdx], claimed: false, vs: 0 };
      movers.push(m);
      moverByAgentId.set(a.id, m);
    }

    const claim = (m: Mover) => {
      m.a.nextNode = m.next; m.a.progress = 0; m.a.state = 'Moving'; m.a.blockedSec = 0;
      incoming.set(m.next.id, m.a.id);
      m.claimed = true;
    };

    // 1) 기차 규칙: 목표 칸이 비어있거나(occ 없음) 점유자가 이미 떠나는 중(nextNode!=null)이면 진입.
    //    반복 패스로 앞→뒤 순서 무관하게 전체 행렬이 같은 tick에 전진.
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of movers) {
        if (m.claimed) continue;
        if (incoming.has(m.next.id)) continue;                   // 이미 다른 로봇이 진입 예약
        const occ = atNode.get(m.next.id);
        if (occ == null || occ.nextNode != null) { claim(m); changed = true; }
      }
    }

    // 2) 사이클 회전: 남은 mover들의 상호 차단 루프를 동시 전진으로 해소.
    //    functional graph (각 mover의 목표칸 점유자로 향하는 간선, out-degree ≤ 1).
    for (const start of movers) {
      if (start.claimed || start.vs !== 0) continue;
      const walk: Mover[] = [];
      let cur: Mover | undefined = start;
      while (cur && !cur.claimed && cur.vs === 0) {
        cur.vs = 1; walk.push(cur);
        const occ = atNode.get(cur.next.id);
        const nextMover = occ ? moverByAgentId.get(occ.id) : undefined;
        cur = nextMover && !nextMover.claimed ? nextMover : undefined;
      }
      if (cur && cur.vs === 1) {
        // 사이클 발견 → cur부터 walk 끝까지가 루프.
        const idx = walk.indexOf(cur);
        const cycleLen = walk.length - idx;
        // 길이 2 루프(A↔B)는 같은 레일을 맞바꾸는 정면 교차이므로 회전 금지.
        // (단방향 그리드는 역방향 엣지가 없어 2-cycle 자체가 불가 → 비용 0.
        //  양방향 맵에서는 둘 다 Waiting→재경로로 자연 해소.)
        if (cycleLen >= 3) {
          for (let i = idx; i < walk.length; i++) claim(walk[i]);
        }
      }
      for (const w of walk) w.vs = 2;
    }

    // 3) 끝내 막힌 mover → Waiting, 임계 초과 시 우회 재경로
    for (const m of movers) {
      if (m.claimed) continue;
      m.a.state = 'Waiting';
      m.a.blockedSec += dt;
      if (m.a.blockedSec >= REPATH_THRESHOLD_SEC) {
        m.a.state = 'Idle'; m.a.path = []; m.a.pathIndex = 0;
        m.a.blockedSec = 0; m.a.stateTimer = 0;
        m.a.idleCooldown = 0.2 + Math.random() * 0.8;
      }
    }

    // 귀환 완료 에이전트 제거 (차고지 도착 후 Idle 상태인 recalling 에이전트)
    const finalAgents = newAgents.filter(a =>
      !(a.recalling && a.state === 'Idle' &&
        (depots.length === 0 || depots.some(d => d.id === a.currentNode.id)))
    );

    // 과잉 투입 경고 — 공정 노드 수 대비 로봇이 너무 많고 대기 비율이 높을 때
    const processNodeCount = allNodes.filter(n => PROCESS_CYCLE.includes(n.type as typeof PROCESS_CYCLE[number])).length;
    const activeAgents = finalAgents.filter(a => !a.recalling);
    const blockedCount = activeAgents.filter(a => a.blockedSec > 0.5 || a.state === 'Idle').length;
    const blockedRatio = activeAgents.length > 0 ? blockedCount / activeAgents.length : 0;
    const newOvercrowd = (processNodeCount > 0 && activeAgents.length > processNodeCount * 1.5 && blockedRatio > 0.5)
      ? `로봇 ${activeAgents.length}대 중 ${Math.round(blockedRatio * 100)}%가 대기 중 — 공정 노드 ${processNodeCount}개 대비 로봇이 과다 투입되어 비용 낭비 중입니다. 최대 로봇 수를 ${processNodeCount * 2} 이하로 줄이세요.`
      : null;

    // 스톨 감지 — 완료 없이 STALL_THRESHOLD_SEC 초 경과
    const elapsed     = stats.elapsedSec + dt;
    const totalDist   = stats.totalDistance + distDelta;
    const newStallSec = completedDelta > 0 ? 0 : stallSinceSec + dt;
    let   newStallRpt = stallReport;

    if (!newStallRpt && newStallSec >= STALL_THRESHOLD_SEC && newAgents.length > 0) {
      const nodeMap = new Map(allNodes.map(n => [n.id, n]));
      const hotspots = [...newCong.entries()]
        .map(([id, v]) => ({ nodeId: id, nodeType: nodeMap.get(id)?.type ?? 'Unknown', value: v }))
        .filter(h => h.value > 0.3)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      newStallRpt = {
        ...analyzeStall(newAgents, allNodes, newCong, algorithmId),
        detectedAt: parseFloat(elapsed.toFixed(1)),
        congestionHotspots: hotspots,
      };
    }

    // ── 처리량 샘플링 (SAMPLE_SEC 주기) ───────────────────────────────
    const newTotalJobs   = stats.completedJobs + completedDelta;
    let sAccum           = _sampleAccum + dt;
    let newThroughput    = throughputHistory;
    let newAgentRate     = agentRateHistory;
    let lastSampleElapsed = _lastSampleElapsed;
    let lastTotalJobs    = _lastTotalJobs;
    let lastAgentJobs    = _lastAgentJobs;

    if (sAccum >= SAMPLE_SEC) {
      const windowDt = elapsed - lastSampleElapsed;
      if (windowDt > 0) {
        const activeCount = activeAgents.length;
        const totalRate = ((newTotalJobs - lastTotalJobs) / windowDt) * 60; // 작업/분
        const perRobot  = activeCount > 0 ? totalRate / activeCount : 0;
        newThroughput = [...throughputHistory, {
          t: parseFloat(elapsed.toFixed(1)),
          perRobot: parseFloat(perRobot.toFixed(2)),
          total: parseFloat(totalRate.toFixed(2)),
        }].slice(-MAX_SAMPLES);

        // 로봇별 처리량
        newAgentRate = new Map(agentRateHistory);
        const presentIds = new Set(finalAgents.map(a => a.id));
        for (const id of [...newAgentRate.keys()]) if (!presentIds.has(id)) newAgentRate.delete(id);
        const nextAgentJobs = new Map<string, number>();
        for (const a of finalAgents) {
          const prev = lastAgentJobs.get(a.id) ?? a.totalJobs; // 신규 로봇은 첫 샘플 0
          const rate = ((a.totalJobs - prev) / windowDt) * 60;
          const hist = [...(newAgentRate.get(a.id) ?? []), {
            t: parseFloat(elapsed.toFixed(1)),
            rate: parseFloat(Math.max(rate, 0).toFixed(2)),
          }].slice(-MAX_AGENT_SAMPLES);
          newAgentRate.set(a.id, hist);
          nextAgentJobs.set(a.id, a.totalJobs);
        }
        lastAgentJobs     = nextAgentJobs;
        lastTotalJobs     = newTotalJobs;
        lastSampleElapsed = elapsed;
      }
      sAccum = 0;
    }

    // ── 효율 스냅샷 (매 tick 갱신) ──────────────────────────────────────
    let newEfficiency: EfficiencySnapshot | null = null;
    if (activeAgents.length > 0) {
      const proC = activeAgents.filter(a => a.state === 'Processing').length;
      const idlC = activeAgents.filter(a => a.state === 'Idle').length;
      const tot  = activeAgents.length;
      const procUtil = processNodeCount > 0 ? proC / processNodeCount : 0;
      const idleRatio = idlC / tot;
      const avgWaitSec = tot > 0
        ? activeAgents.reduce((s, a) => s + a.blockedSec, 0) / tot
        : 0;
      const avgMoveDist = tot > 0
        ? parseFloat((activeAgents.reduce((s, a) => s + a.totalDistance, 0) / tot).toFixed(1))
        : 0;

      // 혼잡도 = 평균 노드 점유율
      const congestionLevel = newCong.size > 0
        ? parseFloat((Array.from(newCong.values()).reduce((s, v) => s + v, 0) / newCong.size).toFixed(3))
        : 0;

      // 병목 노드 (가장 높은 혼잡도)
      let bottleneckNodeId: string | null = null;
      let bottleneckCongestion = 0;
      for (const [id, cong] of newCong.entries()) {
        if (cong > bottleneckCongestion) {
          bottleneckCongestion = cong;
          bottleneckNodeId = id;
        }
      }

      // 최적 로봇 수 감지: throughputHistory에서 기울기 변화가 커지는 지점
      let optimalRobotCount = -1;
      if (newThroughput.length >= 4) {
        const rates = newThroughput.map(s => s.perRobot);
        let maxAccel = 0, accelIdx = -1;
        for (let i = 2; i < rates.length; i++) {
          const accel = Math.abs((rates[i] - rates[i - 1]) - (rates[i - 1] - rates[i - 2]));
          if (accel > maxAccel && accel > 0.2) { maxAccel = accel; accelIdx = i; }
        }
        if (accelIdx > 0) optimalRobotCount = tot;
      }

      const ratio = processNodeCount > 0 ? tot / processNodeCount : 0;
      let optimalHint: string;
      if (processNodeCount === 0) {
        optimalHint = '공정 노드 없음 — 맵에 공정 스테이션을 추가하세요';
      } else if (ratio < 1) {
        optimalHint = `과소 투입 — 공정 노드(${processNodeCount}개)보다 로봇이 적어 가동률이 낮습니다. ${Math.ceil(processNodeCount * 1.2)}~${Math.ceil(processNodeCount * 1.5)}대 권장`;
      } else if (ratio <= 1.5) {
        optimalHint = `최적 범위 — 로봇 ${tot}대 / 공정 ${processNodeCount}개 = ${ratio.toFixed(1)}× (권장 1~1.5×)`;
      } else if (ratio <= 2) {
        optimalHint = `허용 범위 — ${ratio.toFixed(1)}× (권장 초과). 대기 비율 ${Math.round(idleRatio * 100)}%가 높다면 줄이세요`;
      } else {
        optimalHint = `과잉 투입 — ${ratio.toFixed(1)}× (상한 2× 초과). 로봇을 ${Math.ceil(processNodeCount * 1.5)}대 이하로 줄이세요`;
      }

      newEfficiency = {
        procUtil: parseFloat((procUtil * 100).toFixed(1)),
        avgWaitSec: parseFloat(avgWaitSec.toFixed(2)),
        idleRatio: parseFloat((idleRatio * 100).toFixed(1)),
        avgMoveDist,
        congestionLevel: parseFloat((congestionLevel * 100).toFixed(1)),
        bottleneckNodeId,
        bottleneckCongestion: parseFloat((bottleneckCongestion * 100).toFixed(1)),
        optimalRobotCount,
        optimalHint,
      };
    }

    set({
      agents: finalAgents,
      agentSeq: nextSeq,
      spawnTimers: newSpawnTimers,
      congestion: newCong,
      stallReport: newStallRpt,
      stallSinceSec: newStallSec,
      overcrowdWarning: newOvercrowd,
      throughputHistory: newThroughput,
      agentRateHistory: newAgentRate,
      efficiency: newEfficiency,
      _sampleAccum: sAccum,
      _lastSampleElapsed: lastSampleElapsed,
      _lastTotalJobs: lastTotalJobs,
      _lastAgentJobs: lastAgentJobs,
      stats: {
        completedJobs: newTotalJobs,
        totalDistance: totalDist,
        elapsedSec: elapsed,
        distPerSec: elapsed > 0 ? parseFloat((totalDist / elapsed).toFixed(2)) : 0,
      },
    });
  },
}));
