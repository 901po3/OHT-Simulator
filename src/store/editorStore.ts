import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NodeType = 'Normal' | 'Deposition' | 'Exposure' | 'Etching' | 'Cleaning' | 'Depot';
export type ConnectType = 'bidirectional' | 'unidirectional';

export interface EditorNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
}

export interface EditorEdge {
  id: string;
  fromId: string;
  toId: string;
}

type ToolMode = 'select' | 'connect';

interface Snapshot { nodes: EditorNode[]; edges: EditorEdge[]; }

interface EditorState {
  nodes: EditorNode[];
  edges: EditorEdge[];
  selectedNodeId: string | null;
  connectingFromId: string | null;
  connectType: ConnectType;
  toolMode: ToolMode;
  tooltipPos: { x: number; y: number } | null;

  _past:   Snapshot[];
  _future: Snapshot[];
  canUndo: boolean;
  canRedo: boolean;

  addNode: (type: NodeType, x: number, y: number) => void;
  insertNodeOnEdge: (type: NodeType, x: number, y: number, edgeId: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string, screenX: number, screenY: number) => void;
  clearSelection: () => void;
  startConnect: (fromId: string) => void;
  finishConnect: (toId: string) => void;
  cancelConnect: () => void;
  setConnectType: (t: ConnectType) => void;
  removeEdge: (id: string) => void;
  undo: () => void;
  redo: () => void;
  saveToFile: () => void;
  loadFromData: (data: { nodes: EditorNode[]; edges: EditorEdge[] }) => void;
}

let nodeSeq = 1;
let edgeSeq = 1;

const MAX_HISTORY = 50;

function withHistory(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
  changes: Partial<EditorState>
) {
  const { nodes, edges, _past } = get();
  const snapshot: Snapshot = {
    nodes: nodes.map(n => ({ ...n })),
    edges: edges.map(e => ({ ...e })),
  };
  const past = [..._past, snapshot].slice(-MAX_HISTORY);
  set({ ...changes, _past: past, _future: [], canUndo: true, canRedo: false });
}

export const useEditorStore = create<EditorState>()(persist((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  connectingFromId: null,
  connectType: 'unidirectional',
  toolMode: 'select',
  tooltipPos: null,
  _past: [],
  _future: [],
  canUndo: false,
  canRedo: false,

  addNode(type, x, y) {
    const node: EditorNode = { id: `node-${nodeSeq++}`, type, x, y };
    withHistory(get, set, { nodes: [...get().nodes, node] });
  },

  // 기존 엣지 위에 노드를 삽입 — 엣지를 두 개로 분리
  insertNodeOnEdge(type, x, y, edgeId) {
    const { nodes, edges, connectType } = get();
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) {
      const node: EditorNode = { id: `node-${nodeSeq++}`, type, x, y };
      withHistory(get, set, { nodes: [...nodes, node] });
      return;
    }

    const newNode: EditorNode = { id: `node-${nodeSeq++}`, type, x, y };
    const newEdges = edges.filter(e => e.id !== edgeId);

    // 원래 방향: from → new → to
    const e1: EditorEdge = { id: `edge-${edgeSeq++}`, fromId: edge.fromId, toId: newNode.id };
    const e2: EditorEdge = { id: `edge-${edgeSeq++}`, fromId: newNode.id, toId: edge.toId };

    const added = [e1, e2];

    // 양방향이면 역방향도 추가 (기존 엣지가 양방향이었는지 확인)
    const reverseExists = edges.some(e => e.fromId === edge.toId && e.toId === edge.fromId);
    if (connectType === 'bidirectional' || reverseExists) {
      added.push({ id: `edge-${edgeSeq++}`, fromId: newNode.id, toId: edge.fromId });
      added.push({ id: `edge-${edgeSeq++}`, fromId: edge.toId, toId: newNode.id });
      // 기존 역방향 엣지도 제거
      const filteredEdges = newEdges.filter(e => !(e.fromId === edge.toId && e.toId === edge.fromId));
      withHistory(get, set, { nodes: [...nodes, newNode], edges: [...filteredEdges, ...added] });
    } else {
      withHistory(get, set, { nodes: [...nodes, newNode], edges: [...newEdges, ...added] });
    }
  },

  moveNode(id, x, y) {
    withHistory(get, set, {
      nodes: get().nodes.map(n => n.id === id ? { ...n, x, y } : n),
    });
  },

  removeNode(id) {
    withHistory(get, set, {
      nodes: get().nodes.filter(n => n.id !== id),
      edges: get().edges.filter(e => e.fromId !== id && e.toId !== id),
      selectedNodeId: null,
      tooltipPos: null,
    });
  },

  selectNode(id, screenX, screenY) {
    set({ selectedNodeId: id, tooltipPos: { x: screenX, y: screenY }, toolMode: 'select' });
  },

  clearSelection() {
    set({ selectedNodeId: null, tooltipPos: null, connectingFromId: null, toolMode: 'select' });
  },

  startConnect(fromId) {
    set({ connectingFromId: fromId, toolMode: 'connect', selectedNodeId: null, tooltipPos: null });
  },

  finishConnect(toId) {
    const { connectingFromId, edges, connectType } = get();
    if (!connectingFromId || connectingFromId === toId) {
      set({ connectingFromId: null, toolMode: 'select' });
      return;
    }

    const newEdges: EditorEdge[] = [];

    const fwdExists = edges.some(e => e.fromId === connectingFromId && e.toId === toId);
    if (!fwdExists) {
      newEdges.push({ id: `edge-${edgeSeq++}`, fromId: connectingFromId, toId });
    }

    if (connectType === 'bidirectional') {
      const bwdExists = edges.some(e => e.fromId === toId && e.toId === connectingFromId);
      if (!bwdExists) {
        newEdges.push({ id: `edge-${edgeSeq++}`, fromId: toId, toId: connectingFromId });
      }
    }

    if (newEdges.length > 0) {
      withHistory(get, set, {
        edges: [...edges, ...newEdges],
        connectingFromId: null,
        toolMode: 'select',
      });
    } else {
      set({ connectingFromId: null, toolMode: 'select' });
    }
  },

  cancelConnect() {
    set({ connectingFromId: null, toolMode: 'select' });
  },

  setConnectType(t) {
    set({ connectType: t });
  },

  removeEdge(id) {
    withHistory(get, set, {
      edges: get().edges.filter(e => e.id !== id),
    });
  },

  undo() {
    const { _past, _future, nodes, edges } = get();
    if (_past.length === 0) return;
    const prev = _past[_past.length - 1];
    const future = [{ nodes: nodes.map(n => ({ ...n })), edges: edges.map(e => ({ ...e })) }, ..._future];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      _past: _past.slice(0, -1),
      _future: future,
      canUndo: _past.length > 1,
      canRedo: true,
      selectedNodeId: null,
      tooltipPos: null,
    });
  },

  redo() {
    const { _past, _future, nodes, edges } = get();
    if (_future.length === 0) return;
    const next = _future[0];
    const past = [..._past, { nodes: nodes.map(n => ({ ...n })), edges: edges.map(e => ({ ...e })) }];
    set({
      nodes: next.nodes,
      edges: next.edges,
      _past: past,
      _future: _future.slice(1),
      canUndo: true,
      canRedo: _future.length > 1,
      selectedNodeId: null,
      tooltipPos: null,
    });
  },

  saveToFile() {
    const { nodes, edges } = get();
    const data = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oht_map.json';
    a.click();
    // B-5 fix: 일부 브라우저에서 click() 직후 revoke 시 다운로드 실패
    setTimeout(() => URL.revokeObjectURL(url), 100);
  },

  loadFromData(data) {
    // B-3 fix: id 형식이 비표준일 때 parseInt가 NaN → nodeSeq가 NaN이 되는 버그 방어
    const safeInt = (id: string, prefix: string) => {
      const n = parseInt(id.replace(prefix, ''));
      return Number.isFinite(n) ? n : 0;
    };
    nodeSeq = Math.max(...data.nodes.map(n => safeInt(n.id, 'node-')), 0) + 1;
    edgeSeq = Math.max(...data.edges.map(e => safeInt(e.id, 'edge-')), 0) + 1;
    withHistory(get, set, {
      nodes: data.nodes,
      edges: data.edges,
      selectedNodeId: null,
      tooltipPos: null,
    });
  },
}), {
  name: 'oht-editor-map',
  partialize: (s) => ({ nodes: s.nodes, edges: s.edges }),
}));
