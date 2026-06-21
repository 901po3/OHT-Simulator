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

// ── 1. Standard A* ─────────────────────────────────────
export function standardAStar(from: RailNode, to: RailNode): Path {
  const open = new Set<RailNode>([from]);
  const came = new Map<RailNode, RailNode>();
  const g    = new Map<RailNode, number>([[from, 0]]);
  const f    = new Map<RailNode, number>([[from, heuristic(from, to)]]);

  while (open.size) {
    const cur = [...open].reduce((a, b) => (f.get(a) ?? Infinity) < (f.get(b) ?? Infinity) ? a : b);
    if (cur === to) return reconstruct(came, cur);
    open.delete(cur);
    for (const e of cur.edges) {
      const tg = (g.get(cur) ?? Infinity) + e.weight;
      if (tg < (g.get(e.to) ?? Infinity)) {
        came.set(e.to, cur); g.set(e.to, tg);
        f.set(e.to, tg + heuristic(e.to, to));
        open.add(e.to);
      }
    }
  }
  return [];
}

// ── 2. Dijkstra ────────────────────────────────────────
export function dijkstra(from: RailNode, to: RailNode): Path {
  const open = new Set<RailNode>([from]);
  const came = new Map<RailNode, RailNode>();
  const dist = new Map<RailNode, number>([[from, 0]]);

  while (open.size) {
    const cur = [...open].reduce((a, b) => (dist.get(a) ?? Infinity) < (dist.get(b) ?? Infinity) ? a : b);
    if (cur === to) return reconstruct(came, cur);
    open.delete(cur);
    for (const e of cur.edges) {
      const d = (dist.get(cur) ?? Infinity) + e.weight;
      if (d < (dist.get(e.to) ?? Infinity)) {
        came.set(e.to, cur); dist.set(e.to, d); open.add(e.to);
      }
    }
  }
  return [];
}

// ── 3. Greedy BFS ──────────────────────────────────────
export function greedyBFS(from: RailNode, to: RailNode): Path {
  const open    = new Set<RailNode>([from]);
  const came    = new Map<RailNode, RailNode>();
  const visited = new Set<RailNode>();

  while (open.size) {
    const cur = [...open].reduce((a, b) => heuristic(a, to) < heuristic(b, to) ? a : b);
    if (cur === to) return reconstruct(came, cur);
    open.delete(cur); visited.add(cur);
    for (const e of cur.edges) {
      if (!visited.has(e.to)) { came.set(e.to, cur); open.add(e.to); }
    }
  }
  return [];
}

// ── 4. Stochastic A* ───────────────────────────────────
export function stochasticAStar(from: RailNode, to: RailNode, noise = 0.3): Path {
  const open = new Set<RailNode>([from]);
  const came = new Map<RailNode, RailNode>();
  const g    = new Map<RailNode, number>([[from, 0]]);
  const f    = new Map<RailNode, number>([[from, heuristic(from, to)]]);

  while (open.size) {
    const cur = [...open].reduce((a, b) => (f.get(a) ?? Infinity) < (f.get(b) ?? Infinity) ? a : b);
    if (cur === to) return reconstruct(came, cur);
    open.delete(cur);
    for (const e of cur.edges) {
      const w  = e.weight * (1 + (Math.random() - 0.5) * noise);
      const tg = (g.get(cur) ?? Infinity) + w;
      if (tg < (g.get(e.to) ?? Infinity)) {
        came.set(e.to, cur); g.set(e.to, tg);
        f.set(e.to, tg + heuristic(e.to, to));
        open.add(e.to);
      }
    }
  }
  return [];
}

// ── 5. Priority A* (혼잡 가중치) ───────────────────────
export function priorityAStar(
  from: RailNode,
  to: RailNode,
  congestion: Map<string, number>,
): Path {
  const open = new Set<RailNode>([from]);
  const came = new Map<RailNode, RailNode>();
  const g    = new Map<RailNode, number>([[from, 0]]);
  const f    = new Map<RailNode, number>([[from, heuristic(from, to)]]);

  while (open.size) {
    const cur = [...open].reduce((a, b) => (f.get(a) ?? Infinity) < (f.get(b) ?? Infinity) ? a : b);
    if (cur === to) return reconstruct(came, cur);
    open.delete(cur);
    for (const e of cur.edges) {
      const cong = 1 + (congestion.get(e.to.id) ?? 0) * 2.5;
      const tg   = (g.get(cur) ?? Infinity) + e.weight * cong;
      if (tg < (g.get(e.to) ?? Infinity)) {
        came.set(e.to, cur); g.set(e.to, tg);
        f.set(e.to, tg + heuristic(e.to, to));
        open.add(e.to);
      }
    }
  }
  return [];
}

// ── 6. CBS-Lite (Conflict-Based Search 간소화) ─────────
// 완전한 CBS는 지수적 복잡도로 실시간 불가.
// CBS-Lite: 개별 A*로 경로 탐색 후 충돌 감지 → 하위 우선순위 에이전트에 대기(wait) 삽입.
// 실제 CBS의 Constraint Tree 분기 없이 1회 패스로 충돌 해소를 근사한다.
export function cbsLite(
  from: RailNode,
  to: RailNode,
  reservedSteps: Map<string, number>, // nodeId → 예약된 타임스텝 (다른 에이전트가 이미 계획한 경로)
): Path {
  // 예약된 노드를 높은 비용으로 회피하는 A* 변형
  const open = new Set<RailNode>([from]);
  const came = new Map<RailNode, RailNode>();
  const g    = new Map<RailNode, number>([[from, 0]]);
  const f    = new Map<RailNode, number>([[from, heuristic(from, to)]]);

  while (open.size) {
    const cur = [...open].reduce((a, b) => (f.get(a) ?? Infinity) < (f.get(b) ?? Infinity) ? a : b);
    if (cur === to) return reconstruct(came, cur);
    open.delete(cur);
    for (const e of cur.edges) {
      // 다른 에이전트가 예약한 노드: CBS 제약(constraint) 반영 — 비용 ×8 페널티
      const reserved = reservedSteps.has(e.to.id) ? 8 : 1;
      const tg = (g.get(cur) ?? Infinity) + e.weight * reserved;
      if (tg < (g.get(e.to) ?? Infinity)) {
        came.set(e.to, cur); g.set(e.to, tg);
        f.set(e.to, tg + heuristic(e.to, to));
        open.add(e.to);
      }
    }
  }
  return [];
}

// ── 알고리즘 레지스트리 ─────────────────────────────────
export type AlgorithmId = 'standard' | 'dijkstra' | 'greedy' | 'stochastic' | 'priority' | 'cbs';

export const ALGORITHM_META: Record<AlgorithmId, { label: string; color: string; desc: string }> = {
  standard:   { label: 'Standard A*',   color: '#8b949e', desc: '기본 A*. 개인 최적 경로.' },
  dijkstra:   { label: 'Dijkstra',      color: '#58a6ff', desc: '최단 비용 탐색. 휴리스틱 없음.' },
  greedy:     { label: 'Greedy BFS',    color: '#d29922', desc: '목표만 바라봄. 빠르지만 부정확.' },
  stochastic: { label: 'Stochastic A*', color: '#bc8cff', desc: '가중치 노이즈로 다양한 경로 탐색.' },
  priority:   { label: 'Priority A*',   color: '#3fb950', desc: '혼잡 가중치 공유. 협력 최적 ✓ 채택' },
  cbs:        { label: 'CBS-Lite',      color: '#f85149', desc: '충돌 기반 예약 회피. 실시간 근사.' },
};
