import type { RailNode } from '../graph/types';

type Path = RailNode[];

// ── 공통 헬퍼 ──────────────────────────────────────────
function heuristic(a: RailNode, b: RailNode) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstruct(cameFrom: Map<RailNode, RailNode>, end: RailNode): Path {
  const path = [end];
  let cur = end;
  while (cameFrom.has(cur)) { cur = cameFrom.get(cur)!; path.unshift(cur); }
  return path;
}

// ── 바이너리 최소 힙 ───────────────────────────────────
// 기존 [...open].reduce 선형 탐색(O(V²))을 O(E log V)로 개선.
// 100대 로봇 × 대규모 그리드(수백 노드)에서 실시간 경로 탐색을 가능케 한다.
class MinHeap {
  private nodes: RailNode[] = [];
  private prio: number[] = [];

  get size() { return this.nodes.length; }

  push(node: RailNode, priority: number) {
    this.nodes.push(node);
    this.prio.push(priority);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent] <= this.prio[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): RailNode | undefined {
    const n = this.nodes.length;
    if (n === 0) return undefined;
    const top = this.nodes[0];
    const lastNode = this.nodes.pop()!;
    const lastPrio = this.prio.pop()!;
    if (n > 1) {
      this.nodes[0] = lastNode;
      this.prio[0] = lastPrio;
      let i = 0;
      const len = this.nodes.length;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let smallest = i;
        if (l < len && this.prio[l] < this.prio[smallest]) smallest = l;
        if (r < len && this.prio[r] < this.prio[smallest]) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number) {
    const tn = this.nodes[a]; this.nodes[a] = this.nodes[b]; this.nodes[b] = tn;
    const tp = this.prio[a];  this.prio[a]  = this.prio[b];  this.prio[b]  = tp;
  }
}

// ── 공용 A* 코어 (힙 기반) ─────────────────────────────
// edgeCost(edge) → 실제 통행 비용. useHeuristic=false → Dijkstra.
// 방향성 엣지(cur.edges)만 따라가므로 단방향(one-way) 그리드에서도 올바르게 동작.
function aStarCore(
  from: RailNode,
  to: RailNode,
  edgeCost: (e: RailNode['edges'][number]) => number,
  useHeuristic: boolean,
): Path {
  const open = new MinHeap();
  const came = new Map<RailNode, RailNode>();
  const g    = new Map<RailNode, number>([[from, 0]]);
  const closed = new Set<RailNode>();
  open.push(from, useHeuristic ? heuristic(from, to) : 0);

  while (open.size) {
    const cur = open.pop()!;
    if (cur === to) return reconstruct(came, cur);
    if (closed.has(cur)) continue;
    closed.add(cur);
    const gc = g.get(cur) ?? Infinity;
    for (const e of cur.edges) {
      if (closed.has(e.to)) continue;
      const tg = gc + edgeCost(e);
      if (tg < (g.get(e.to) ?? Infinity)) {
        came.set(e.to, cur);
        g.set(e.to, tg);
        open.push(e.to, useHeuristic ? tg + heuristic(e.to, to) : tg);
      }
    }
  }
  return [];
}

// ── 1. Standard A* ─────────────────────────────────────
export function standardAStar(from: RailNode, to: RailNode): Path {
  return aStarCore(from, to, e => e.weight, true);
}

// ── 2. Dijkstra ────────────────────────────────────────
export function dijkstra(from: RailNode, to: RailNode): Path {
  return aStarCore(from, to, e => e.weight, false);
}

// ── 3. Greedy BFS ──────────────────────────────────────
export function greedyBFS(from: RailNode, to: RailNode): Path {
  const open    = new MinHeap();
  const came    = new Map<RailNode, RailNode>();
  const visited = new Set<RailNode>([from]);
  open.push(from, heuristic(from, to));

  while (open.size) {
    const cur = open.pop()!;
    if (cur === to) return reconstruct(came, cur);
    for (const e of cur.edges) {
      if (!visited.has(e.to)) {
        visited.add(e.to);
        came.set(e.to, cur);
        open.push(e.to, heuristic(e.to, to));
      }
    }
  }
  return [];
}

// ── 4. Stochastic A* ───────────────────────────────────
export function stochasticAStar(from: RailNode, to: RailNode, noise = 0.3): Path {
  return aStarCore(from, to, e => e.weight * (1 + (Math.random() - 0.5) * noise), true);
}

// ── 5. Priority A* (혼잡 가중치) ───────────────────────
export function priorityAStar(
  from: RailNode,
  to: RailNode,
  congestion: Map<string, number>,
): Path {
  return aStarCore(from, to, e => e.weight * (1 + (congestion.get(e.to.id) ?? 0) * 2.5), true);
}

// ── 6. CBS-Lite (Conflict-Based Search 간소화) ─────────
// 완전한 CBS는 지수적 복잡도로 실시간 불가.
// CBS-Lite: 예약된 노드를 높은 비용(×8)으로 회피하는 A* 변형으로 충돌을 근사 해소한다.
export function cbsLite(
  from: RailNode,
  to: RailNode,
  reservedSteps: Map<string, number>, // nodeId → 예약된 타임스텝 (다른 에이전트가 이미 계획한 경로)
): Path {
  return aStarCore(from, to, e => e.weight * (reservedSteps.has(e.to.id) ? 8 : 1), true);
}

// ── 알고리즘 레지스트리 ─────────────────────────────────
export type AlgorithmId = 'standard' | 'dijkstra' | 'greedy' | 'stochastic' | 'priority' | 'cbs';

// status: 'recommended' | 'good' | 'fair' | 'caution'
// rank: 성능 순위 (낮을수록 좋음)
export interface AlgorithmMeta {
  label: string;
  color: string;
  desc: string;
  status: 'recommended' | 'good' | 'fair' | 'caution';
  rank: number;
}

export const ALGORITHM_META: Record<AlgorithmId, AlgorithmMeta> = {
  priority:   { label: 'Priority A*',   color: '#3fb950', rank: 1, status: 'recommended',
                desc: '혼잡 가중치 공유 — 다중 로봇 협력 분산. 권장' },
  cbs:        { label: 'CBS-Lite',      color: '#58a6ff', rank: 2, status: 'good',
                desc: '예약 테이블 기반 충돌 회피 — 대규모 협력에 강함' },
  stochastic: { label: 'Stochastic A*', color: '#bc8cff', rank: 3, status: 'good',
                desc: '경로 노이즈로 자연 분산 — 루트 다양성 확보' },
  standard:   { label: 'Standard A*',   color: '#8b949e', rank: 4, status: 'fair',
                desc: '개인 최적 경로 — 협력 없음, 밀집 시 병목' },
  dijkstra:   { label: 'Dijkstra',      color: '#d29922', rank: 5, status: 'fair',
                desc: '휴리스틱 없는 최단 탐색 — A*보다 느리고 협력 없음' },
  greedy:     { label: 'Greedy BFS',    color: '#f85149', rank: 6, status: 'caution',
                desc: '목표 방향만 추구 — 최단 경로 미보장, 혼잡 시 루프 위험' },
};

// 성능 순서 (UI 정렬용)
export const ALGORITHM_ORDER: AlgorithmId[] = ['priority', 'cbs', 'stochastic', 'standard', 'dijkstra', 'greedy'];
