// EditorNode 타입과 통일 — 웹 에디터가 source of truth
export type NodeType = 'Normal' | 'Deposition' | 'Exposure' | 'Etching' | 'Cleaning' | 'Depot'
  // 레거시 시뮬레이터 호환 타입 (SimStore 전용)
  | 'Warehouse' | 'Delivery' | 'Intersection';

export interface RailNode {
  id: string;
  x: number;
  y: number;
  type: NodeType;
  edges: RailEdge[];
}

export interface RailEdge {
  from: RailNode;
  to: RailNode;
  weight: number;
}

export interface RailGraph {
  nodes: Map<string, RailNode>;
  getNode(id: string): RailNode | undefined;
  getAllNodes(): RailNode[];
}
