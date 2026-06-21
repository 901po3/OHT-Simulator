import type { RailNode } from '../graph/types';

export function aStar(from: RailNode, to: RailNode): RailNode[] {
  const h = (n: RailNode) => Math.abs(n.x - to.x) + Math.abs(n.y - to.y);

  const open  = new Set<RailNode>([from]);
  const cameFrom = new Map<RailNode, RailNode>();
  const g = new Map<RailNode, number>([[from, 0]]);
  const f = new Map<RailNode, number>([[from, h(from)]]);

  while (open.size > 0) {
    let current = [...open].reduce((a, b) => (f.get(a) ?? Infinity) < (f.get(b) ?? Infinity) ? a : b);

    if (current === to) return reconstruct(cameFrom, current);

    open.delete(current);
    for (const edge of current.edges) {
      const tentG = (g.get(current) ?? Infinity) + edge.weight;
      if (tentG < (g.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, current);
        g.set(edge.to, tentG);
        f.set(edge.to, tentG + h(edge.to));
        open.add(edge.to);
      }
    }
  }
  return [];
}

function reconstruct(cameFrom: Map<RailNode, RailNode>, current: RailNode): RailNode[] {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }
  return path;
}
