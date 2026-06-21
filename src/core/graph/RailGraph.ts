import type { RailNode, RailEdge, NodeType } from './types';

interface NodeDef { id: string; x: number; y: number; type: NodeType; }
interface EdgeDef { from: string; to: string; weight?: number; }

export function buildGraph(nodeDefs: NodeDef[], edgeDefs: EdgeDef[]): Map<string, RailNode> {
  const map = new Map<string, RailNode>();

  for (const def of nodeDefs) {
    map.set(def.id, { id: def.id, x: def.x, y: def.y, type: def.type, edges: [] });
  }

  for (const def of edgeDefs) {
    const from = map.get(def.from);
    const to   = map.get(def.to);
    if (!from || !to) continue;
    const edge: RailEdge = { from, to, weight: def.weight ?? 1 };
    from.edges.push(edge);
  }

  return map;
}
