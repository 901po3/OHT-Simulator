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
const SPAWN_INTERVAL = 1.0;

// 스톨 감지: 이 초 동안 완료 공정 없으면 리포트 생성
const STALL_THRESHOLD_SEC = 5;
// 이동 중 블록 지속 시 재경로 탐색 임계 (초)
const REPATH_THRESHOLD_SEC = 2.0;

// ── 경로 분산 상수 ─────────────────────────────────────
// plannedCong 누적 가중치: 이번 tick에 경로를 잡는 에이전트끼리 동일 경로를 회피하도록 유도
// cong=1.0 도달 시 Priority A*의 costMul은 1 + 1.0×2.5 = 3.5 (통행 불가가 아닌 고비용)
// → 경로는 항상 존재하므로 포화 시 데드락이 아닌 비효율 우회로 그치며 안전
const PLANNED_CONG_BUMP        = 0.35 as const; // 일반 경로 누적치 — 약 3회 중복 시 포화
const PLANNED_CONG_RECALL_BUMP = 0.30 as const; // 귀환 경로 누적치 (일반보다 약하게)
const CBS_LOOKAHEAD            = 8    as const; // CBS 예약 테이블 lookahead 노드 수 (기존 5 → 넓은 그리드 맵 대응)

// ── 에이전트 ───────────────────────────────────────────
export type AgentState = 'Idle' | 'Moving' | 'Processing';

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
  blockedSec: number; // Moving 중 차단된 누적 시간 → 재경로 탐색 트리거
  recalling: boolean; // 차고지 귀환 중 — 도착 시 제거
}

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
): RailNode | null {
  for (let i = 0; i < 4; i++) {
    const targetType = PROCESS_CYCLE[(agent.processStage + i) % 4];
    const candidates = allNodes.filter(n => n.type === targetType && n.id !== agent.currentNode.id);
    if (candidates.length > 0) {
      return autoDispatch
        ? candidates.reduce((best, n) => euclidean(agent.currentNode, n) < euclidean(agent.currentNode, best) ? n : best)
        : candidates[0];
    }
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
  const blockedAgents    = agents.filter(a => a.state === 'Moving' && a.blockedSec > 0.5);
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
  if (blockedAgents.length > agents.length * 0.5) {
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

  // 모두 Idle
  return {
    detectedAt: 0,
    cause: 'all-idle',
    causeDetail: `${idleAgents.length}/${agents.length}대 에이전트가 Idle 상태입니다. 목적지를 찾지 못하거나 이미 공정을 완료했습니다.`,
    affectedAgents: snapshot,
    congestionHotspots: hotspots,
    suggestions: [
      '맵에 Depot 노드를 추가하면 에이전트를 지속적으로 스폰합니다.',
      '공정 노드 종류를 다양하게 추가해 에이전트들이 순환 작업을 이어갈 수 있도록 하세요.',
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

  startSim: (eNodes: EditorNode[], eEdges: EditorEdge[]) => void;
  stopSim: () => void;
  setAlgorithm: (id: AlgorithmId) => void;
  setAgentCount: (n: number) => void;
  setSpeed: (s: number) => void;
  setAutoDispatch: (v: boolean) => void;
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
      state: 'Idle', stateTimer: 0, processStage: 0,
      totalDistance: 0, totalJobs: 0, blockedSec: 0, recalling: false,
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
    });
  },

  stopSim() {
    set({
      running: false, agents: [], spawnTimers: new Map(),
      agentSeq: 1, stallReport: null, stallSinceSec: 0, overcrowdWarning: null,
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
  dismissStallReport: () => set({ stallReport: null, stallSinceSec: 0 }),

  tick(dt) {
    const {
      agents, allNodes, algorithmId, speed, stats,
      agentCount, agentSeq, spawnTimers, autoDispatch,
      stallSinceSec, stallReport,
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
      if (a.state === 'Moving') {
        a.path.slice(a.pathIndex, a.pathIndex + CBS_LOOKAHEAD).forEach((n, i) => {
          if (!newReservations.has(n.id)) newReservations.set(n.id, i);
        });
      }
    }

    // 계획 혼잡도 — 이번 tick에 새로 경로를 잡는 에이전트끼리 같은 경로 회피
    // Idle → Moving 전환 시마다 경로 노드를 누적해 다음 에이전트가 다른 경로를 선택하도록 유도
    const plannedCong = new Map(newCong);

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
            recalling: false,
          });
          newSpawnTimers.set(depot.id, elapsed - SPAWN_INTERVAL);
        } else {
          newSpawnTimers.set(depot.id, elapsed);
        }
      } else {
        newSpawnTimers.set(depot.id, elapsed);
      }
    }

    // 충돌 방지 점유 맵 — currentNode + nextNode 모두 포함
    const occupied = new Map<string, string>();
    for (const a of newAgents) {
      occupied.set(a.currentNode.id, a.id);
      if (a.nextNode) occupied.set(a.nextNode.id, a.id);
    }

    let completedDelta = 0;
    let distDelta = 0;

    for (const agent of newAgents) {
      agent.stateTimer += dt;

      // ── Idle ──────────────────────────────────────────
      if (agent.state === 'Idle') {
        agent.blockedSec = 0;

        // 귀환 모드: 가장 가까운 차고지로 이동 후 제거
        if (agent.recalling) {
          if (depots.length === 0 || depots.some(d => d.id === agent.currentNode.id)) {
            // 차고지 도착 (또는 차고지 없음) → 제거 플래그 (루프 후 필터링)
            agent.stateTimer = 0;
            continue;
          }
          const nearestDepot = depots.reduce((best, d) =>
            (Math.abs(agent.currentNode.x - d.x) + Math.abs(agent.currentNode.y - d.y)) <
            (Math.abs(agent.currentNode.x - best.x) + Math.abs(agent.currentNode.y - best.y)) ? d : best
          );
          const path = findPath(agent.currentNode, nearestDepot, algorithmId, plannedCong, newReservations);
          if (path.length > 1) {
            agent.path = path; agent.pathIndex = 0;
            agent.state = 'Moving'; agent.stateTimer = 0; agent.blockedSec = 0;
            // 귀환 경로도 계획 혼잡도에 반영
            path.slice(1).forEach(n => plannedCong.set(n.id, Math.min((plannedCong.get(n.id) ?? 0) + PLANNED_CONG_RECALL_BUMP, 1)));
          }
          continue;
        }

        const target = getNextTarget(agent, allNodes, autoDispatch);
        if (!target) {
          agent.stateTimer = 0;
          continue;
        }
        if (target.id === agent.currentNode.id) {
          agent.state = 'Processing';
          agent.stateTimer = 0;
          continue;
        }
        const path = findPath(agent.currentNode, target, algorithmId, plannedCong, newReservations);
        if (path.length > 0) {
          // 계획 혼잡도 누적: 이 에이전트의 경로 노드를 비싸게 만들어 다음 에이전트가 분산되도록 유도
          path.slice(1).forEach(n => plannedCong.set(n.id, Math.min((plannedCong.get(n.id) ?? 0) + PLANNED_CONG_BUMP, 1)));
          agent.path      = path;
          agent.pathIndex = 0;
          agent.state     = 'Moving';
          agent.stateTimer = 0;
          agent.blockedSec = 0;
        }
        continue;
      }

      // ── Processing ────────────────────────────────────
      if (agent.state === 'Processing') {
        agent.blockedSec = 0;
        if (agent.stateTimer >= PROCESS_TIME) {
          completedDelta++;
          agent.totalJobs++;
          // [M-1] processStage를 실제 방문한 노드 타입으로 동기화
          // getNextTarget이 fallback으로 다른 타입 노드를 선택했을 경우에도 일관성 유지
          const arrivedTypeIdx = PROCESS_CYCLE.indexOf(agent.currentNode.type as typeof PROCESS_CYCLE[number]);
          agent.processStage = arrivedTypeIdx >= 0
            ? (arrivedTypeIdx + 1) % 4        // 실제 방문 공정 기준 다음 단계
            : (agent.processStage + 1) % 4;   // 공정 외 노드 (Normal/Depot)는 기존 로직
          agent.state      = 'Idle';
          agent.stateTimer = 0;
        }
        continue;
      }

      // ── Moving ────────────────────────────────────────
      // [C-1] path가 비어있는 Moving 상태 → 재경로 없이 영구 고착 방지
      if (agent.state === 'Moving' && agent.path.length === 0) {
        agent.state      = 'Idle';
        agent.stateTimer = 0;
        agent.blockedSec = 0;
        continue;
      }
      if (agent.state === 'Moving' && agent.path.length > 0) {
        if (!agent.nextNode) {
          const nextIdx = agent.pathIndex + 1;

          // 경로 끝 → 목적지 도착
          if (nextIdx >= agent.path.length) {
            agent.state      = 'Processing';
            agent.stateTimer = 0;
            agent.blockedSec = 0;
            occupied.set(agent.currentNode.id, agent.id);
            continue;
          }

          const candidate = agent.path[nextIdx];
          const blocker   = occupied.get(candidate.id);

          if (blocker && blocker !== agent.id) {
            // 차단됨 → blockedSec 누적
            agent.blockedSec += dt;

            // 임계 초과 시 재경로 탐색 (Idle로 복귀)
            if (agent.blockedSec >= REPATH_THRESHOLD_SEC) {
              agent.state      = 'Idle';
              agent.path       = [];
              agent.pathIndex  = 0;
              agent.blockedSec = 0;
              agent.stateTimer = 0;
            }
            continue;
          }

          // 점유 맵 갱신: 이전 노드 해제, 다음 노드 예약
          if (occupied.get(agent.currentNode.id) === agent.id) {
            occupied.delete(agent.currentNode.id);
          }
          occupied.set(candidate.id, agent.id);
          agent.nextNode   = candidate;
          agent.progress   = 0;
          agent.blockedSec = 0;
        }

        agent.progress += dt * speed;
        if (agent.progress >= 1) {
          distDelta++;
          agent.totalDistance++;
          agent.currentNode = agent.nextNode!;
          agent.nextNode    = null;
          agent.pathIndex++;
          agent.progress    = 0;
          // 도착 후 occupied 갱신
          occupied.set(agent.currentNode.id, agent.id);
        }
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

    set({
      agents: finalAgents,
      agentSeq: nextSeq,
      spawnTimers: newSpawnTimers,
      congestion: newCong,
      stallReport: newStallRpt,
      stallSinceSec: newStallSec,
      overcrowdWarning: newOvercrowd,
      stats: {
        completedJobs: stats.completedJobs + completedDelta,
        totalDistance: totalDist,
        elapsedSec: elapsed,
        distPerSec: elapsed > 0 ? parseFloat((totalDist / elapsed).toFixed(2)) : 0,
      },
    });
  },
}));
