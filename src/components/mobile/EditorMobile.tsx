import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Circle, Arrow, Text } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEditorStore, type NodeType } from '../../store/editorStore';

const NODE_COLOR: Record<string, string> = {
  Normal:     '#58a6ff',
  Deposition: '#3fb950',
  Exposure:   '#d29922',
  Etching:    '#f85149',
  Cleaning:   '#a371f7',
  Depot:      '#8b949e',
};

const NODE_LABEL: Record<string, string> = {
  Normal: '일반', Deposition: '증착', Exposure: '노광',
  Etching: '식각', Cleaning: '세정', Depot: '데포',
};

const NODE_TYPES = Object.keys(NODE_LABEL) as NodeType[];

type Mode = 'add' | 'move' | 'connect' | 'delete';

const MODE_LABEL: Record<Mode, string> = {
  add: '➕ 배치', move: '✋ 이동', connect: '🔗 연결', delete: '🗑 삭제',
};

export function EditorMobile() {
  const nodes = useEditorStore(s => s.nodes);
  const edges = useEditorStore(s => s.edges);
  const addNode = useEditorStore(s => s.addNode);
  const moveNode = useEditorStore(s => s.moveNode);
  const removeNode = useEditorStore(s => s.removeNode);
  const startConnect = useEditorStore(s => s.startConnect);
  const finishConnect = useEditorStore(s => s.finishConnect);
  const cancelConnect = useEditorStore(s => s.cancelConnect);
  const connectingFromId = useEditorStore(s => s.connectingFromId);
  const undo = useEditorStore(s => s.undo);
  const redo = useEditorStore(s => s.redo);
  const canUndo = useEditorStore(s => s.canUndo);
  const canRedo = useEditorStore(s => s.canRedo);

  const [w, setW] = useState(window.innerWidth);
  const [mode, setMode] = useState<Mode>('add');
  const [selectedType, setSelectedType] = useState<NodeType>('Normal');
  const [toast, setToast] = useState<string | null>(null);

  // 뷰포트(팬/줌) 상태 — Stage 변환과 별개로 관리
  const [view, setView] = useState({ scale: 1, x: 24, y: 24 });
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const stageW = Math.max(280, w - 28);
  const stageH = Math.round(stageW * 1.05);

  function showToast(msg: string) { setToast(msg); }

  // 스크린 좌표 → 월드(노드) 좌표
  function toWorld(): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const p = stage.getPointerPosition();
    if (!p) return null;
    return { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale };
  }

  // 빈 캔버스 탭 → 배치 모드면 노드 추가
  function onStageTap(e: KonvaEventObject<Event>) {
    // 노드(자식)를 탭한 경우는 노드 핸들러가 처리
    if (e.target !== e.target.getStage()) return;
    if (mode === 'add') {
      const p = toWorld();
      if (!p) return;
      addNode(selectedType, Math.round(p.x), Math.round(p.y));
      showToast(`${NODE_LABEL[selectedType]} 노드 추가`);
    } else if (mode === 'connect' && connectingFromId) {
      cancelConnect();
      showToast('연결 취소');
    }
  }

  function onNodeTap(id: string) {
    if (mode === 'delete') {
      removeNode(id);
      showToast('노드 삭제됨');
    } else if (mode === 'connect') {
      if (!connectingFromId) {
        startConnect(id);
        showToast('연결 시작 — 대상 노드를 탭하세요');
      } else {
        finishConnect(id);
        showToast('연결 완료');
      }
    }
  }

  function onNodeDragEnd(id: string, e: KonvaEventObject<DragEvent>) {
    moveNode(id, Math.round(e.target.x()), Math.round(e.target.y()));
  }

  function zoom(factor: number) {
    setView(v => {
      const ns = Math.min(3, Math.max(0.3, v.scale * factor));
      // 캔버스 중심 기준 줌
      const cx = stageW / 2, cy = stageH / 2;
      const wx = (cx - v.x) / v.scale, wy = (cy - v.y) / v.scale;
      return { scale: ns, x: cx - wx * ns, y: cy - wy * ns };
    });
  }

  function fitToScreen() {
    if (nodes.length === 0) { setView({ scale: 1, x: 24, y: 24 }); return; }
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 50;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const scale = Math.min((stageW - pad * 2) / bw, (stageH - pad * 2) / bh, 1.4);
    setView({
      scale,
      x: (stageW - bw * scale) / 2 - minX * scale,
      y: (stageH - bh * scale) / 2 - minY * scale,
    });
  }

  const btn = (active: boolean): React.CSSProperties => ({
    minWidth: 44, minHeight: 44, padding: '0 12px', borderRadius: 8,
    border: `1px solid ${active ? '#58a6ff' : '#30363d'}`,
    background: active ? '#1f6feb' : '#21262d',
    color: active ? '#fff' : '#c9d1d9', fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ padding: 14, color: '#e6edf3' }}>
      <h2 style={{ margin: '4px 0 8px', fontSize: 18, color: '#58a6ff' }}>맵 에디터</h2>

      {/* 모드 툴바 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
          <button key={m} style={{ ...btn(mode === m), flex: 1 }}
            onClick={() => { setMode(m); if (m !== 'connect') cancelConnect(); }}>
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {/* 노드 타입 칩 (배치 모드일 때) */}
      {mode === 'add' && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 4 }}>
          {NODE_TYPES.map(t => (
            <button key={t} style={{
              ...btn(selectedType === t),
              borderColor: selectedType === t ? NODE_COLOR[t] : '#30363d',
              background: selectedType === t ? NODE_COLOR[t] : '#21262d',
              color: selectedType === t ? '#0d1117' : '#c9d1d9',
            }} onClick={() => setSelectedType(t)}>
              {NODE_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {/* undo/redo + 줌 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button style={{ ...btn(false), opacity: canUndo ? 1 : 0.4 }} disabled={!canUndo} onClick={undo}>↶ 실행취소</button>
        <button style={{ ...btn(false), opacity: canRedo ? 1 : 0.4 }} disabled={!canRedo} onClick={redo}>↷ 다시실행</button>
        <button style={btn(false)} onClick={() => zoom(1.25)}>＋</button>
        <button style={btn(false)} onClick={() => zoom(0.8)}>－</button>
        <button style={btn(false)} onClick={fitToScreen}>맞춤</button>
      </div>

      <div style={{
        position: 'relative',
        background: '#161b22', border: '1px solid #30363d', borderRadius: 10,
        padding: 4, marginBottom: 12, overflow: 'hidden',
      }}>
        <Stage
          ref={stageRef}
          width={stageW}
          height={stageH}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          draggable={mode === 'move'}
          onDragEnd={e => {
            // Stage 자체 팬일 때만 뷰 갱신 (노드 드래그는 target !== stage)
            if (e.target === e.target.getStage()) {
              setView(v => ({ ...v, x: e.target.x(), y: e.target.y() }));
            }
          }}
          onTap={onStageTap}
          onClick={onStageTap}
        >
          <Layer>
            {edges.map(e => {
              const a = nodes.find(n => n.id === e.fromId);
              const b = nodes.find(n => n.id === e.toId);
              if (!a || !b) return null;
              return (
                <Arrow
                  key={e.id}
                  points={[a.x, a.y, b.x, b.y]}
                  stroke="#30363d" fill="#30363d"
                  strokeWidth={2 / view.scale}
                  pointerLength={8 / view.scale}
                  pointerWidth={8 / view.scale}
                />
              );
            })}
            {nodes.map(n => {
              const isConnSrc = connectingFromId === n.id;
              return (
                <Circle
                  key={n.id}
                  x={n.x} y={n.y}
                  radius={13 / view.scale}
                  fill={NODE_COLOR[n.type] ?? '#58a6ff'}
                  stroke={isConnSrc ? '#fff' : '#0d1117'}
                  strokeWidth={(isConnSrc ? 3 : 2) / view.scale}
                  draggable={mode === 'move'}
                  onDragEnd={e => onNodeDragEnd(n.id, e)}
                  onTap={() => onNodeTap(n.id)}
                  onClick={() => onNodeTap(n.id)}
                />
              );
            })}
            {nodes.map(n => (
              <Text
                key={`t-${n.id}`}
                x={n.x - 30} y={n.y + 16 / view.scale}
                width={60} align="center"
                text={NODE_LABEL[n.type] ?? n.type}
                fontSize={10 / view.scale}
                fill="#8b949e"
                listening={false}
              />
            ))}
          </Layer>
        </Stage>

        {toast && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(31,111,235,0.95)', color: '#fff', padding: '8px 14px',
            borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>{toast}</div>
        )}
      </div>

      <div style={{
        background: '#1f2a37', border: '1px solid #2f4660', borderRadius: 10,
        padding: 12, fontSize: 13, color: '#9bb4d4', lineHeight: 1.5, marginBottom: 12,
      }}>
        💡 <b>{MODE_LABEL[mode]}</b> 모드 ·
        {mode === 'add' && ' 캔버스를 탭해 선택한 타입의 노드를 추가하세요.'}
        {mode === 'move' && ' 노드를 드래그해 옮기거나 빈 곳을 드래그해 화면을 이동하세요.'}
        {mode === 'connect' && ' 노드 두 개를 차례로 탭하면 레일이 연결됩니다.'}
        {mode === 'delete' && ' 삭제할 노드를 탭하세요.'}
      </div>

      <div style={{ fontSize: 12, color: '#6e7681' }}>
        노드: {nodes.length} · 엣지: {edges.length}
      </div>
    </div>
  );
}
