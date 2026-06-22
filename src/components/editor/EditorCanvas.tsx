import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Circle, Line, Arrow, Text, Group } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore } from '../../store/editorStore';
import { NODE_META } from './NodePalette';
import type { NodeType } from '../../store/editorStore';
import { SimOverlay } from './SimOverlay';

const NODE_R = 24;
const EDGE_INSERT_THRESHOLD = 18;

interface Props { width: number; height: number; }

function pointToSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax; const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export function EditorCanvas({ width, height }: Props) {
  const {
    nodes, edges,
    addNode, insertNodeOnEdge,
    moveNode, selectNode,
    connectingFromId, finishConnect, cancelConnect,
    toolMode, clearSelection,
  } = useEditorStore();

  const stageRef = useRef<Konva.Stage>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stageRotation, setStageRotation] = useState(0);
  const [dragOverEdge, setDragOverEdge] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  // 키보드: Q/E 회전, R 리셋
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return;
      if (e.key === 'q' || e.key === 'Q') setStageRotation(r => r - 15);
      else if (e.key === 'e' || e.key === 'E') setStageRotation(r => r + 15);
      else if (e.key === 'r' || e.key === 'R') {
        setStageRotation(0);
        setStagePos({ x: 0, y: 0 });
        setStageScale(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 수동 패닝 상태 (Konva Stage draggable 대신 사용)
  const panRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  // 패닝 중 실제 이동이 발생했는지 — mouseup 이후 click 이벤트 억제 용도
  const panMovedRef = useRef(false);
  // 노드 드래그 시작 위치 추적 (마이크로 드래그를 클릭으로 처리)
  const nodeDragStartRef = useRef<{ x: number; y: number } | null>(null);

  const toWorld = useCallback((vx: number, vy: number) => ({
    x: (vx - stagePos.x) / stageScale,
    y: (vy - stagePos.y) / stageScale,
  }), [stagePos, stageScale]);

  // ── 드래그&드롭: 팔레트 → 캔버스 ────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const wx = (e.clientX - rect.left - stagePos.x) / stageScale;
    const wy = (e.clientY - rect.top  - stagePos.y) / stageScale;

    let closest: string | null = null;
    let minDist = EDGE_INSERT_THRESHOLD;
    for (const edge of edges) {
      const from = nodes.find(n => n.id === edge.fromId);
      const to   = nodes.find(n => n.id === edge.toId);
      if (!from || !to) continue;
      const d = pointToSegDist(wx, wy, from.x, from.y, to.x, to.y);
      if (d < minDist) { minDist = d; closest = edge.id; }
    }
    setDragOverEdge(closest);
  }, [edges, nodes, stagePos, stageScale]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType') as NodeType;
    if (!type) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const wx = (e.clientX - rect.left - stagePos.x) / stageScale;
    const wy = (e.clientY - rect.top  - stagePos.y) / stageScale;

    if (dragOverEdge) {
      insertNodeOnEdge(type, wx, wy, dragOverEdge);
    } else {
      addNode(type, wx, wy);
    }
    setDragOverEdge(null);
  }, [addNode, insertNodeOnEdge, stagePos, stageScale, dragOverEdge]);

  const onDragLeave = useCallback(() => setDragOverEdge(null), []);

  // ── 휠 → 줌 ──────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleBy = 1.08;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const newScale = e.deltaY < 0
      ? Math.min(oldScale * scaleBy, 4)
      : Math.max(oldScale / scaleBy, 0.2);

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [stagePos, stageScale]);

  // ── Konva 이벤트 ──────────────────────────────────────
  const onStageMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    // 연결 미리보기용 월드 좌표 업데이트
    setMousePos(toWorld(pos.x, pos.y));

    // 수동 패닝 (4px 이상 이동 시 클릭 이벤트 억제)
    if (panRef.current.active) {
      const dx = pos.x - panRef.current.startX;
      const dy = pos.y - panRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) panMovedRef.current = true;
      setStagePos({ x: panRef.current.originX + dx, y: panRef.current.originY + dy });
    }
  }, [toWorld]);

  const onStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // 빈 Stage 클릭 시 패닝 시작 (select 모드에서만)
    if (e.target === e.target.getStage() && toolMode === 'select') {
      const pos = e.target.getStage()?.getPointerPosition();
      if (!pos) return;
      panRef.current = { active: true, startX: pos.x, startY: pos.y, originX: stagePos.x, originY: stagePos.y };
      panMovedRef.current = false;
      setIsPanning(true);
    }
  }, [toolMode, stagePos]);

  const onStageMouseUp = useCallback(() => {
    panRef.current.active = false;
    setIsPanning(false);
    // panMovedRef는 click 이벤트에서 소비되므로 여기서 초기화하지 않음
  }, []);

  const onStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // 패닝 완료 직후 발생하는 클릭 이벤트 억제
    if (panMovedRef.current) { panMovedRef.current = false; return; }
    if (e.target !== e.target.getStage()) return;
    if (toolMode === 'connect') cancelConnect();
    else clearSelection();
  }, [toolMode, cancelConnect, clearSelection]);

  // ── 노드 이벤트 ──────────────────────────────────────
  const onNodeClick = useCallback((nodeId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (toolMode === 'connect') {
      finishConnect(nodeId);
    } else {
      const stage = stageRef.current;
      if (!stage) return;
      const container = stage.container().getBoundingClientRect();
      const pos = stage.getPointerPosition()!;
      selectNode(nodeId, container.left + pos.x, container.top + pos.y);
    }
  }, [toolMode, finishConnect, selectNode]);

  const onNodeDragStart = useCallback((_nodeId: string, e: Konva.KonvaEventObject<Event>) => {
    nodeDragStartRef.current = { x: e.target.x(), y: e.target.y() };
  }, []);

  const onNodeDragEnd = useCallback((nodeId: string, e: Konva.KonvaEventObject<Event>) => {
    const start = nodeDragStartRef.current;
    nodeDragStartRef.current = null;
    const nx = e.target.x();
    const ny = e.target.y();
    if (start) {
      const moved = Math.hypot(nx - start.x, ny - start.y);
      if (moved < 4) {
        // 마이크로 드래그 → 클릭으로 처리
        // setPosition 불필요: React가 다음 렌더에서 node.x/y로 덮어씀
        const stage = stageRef.current;
        if (stage) {
          const container = stage.container().getBoundingClientRect();
          const pos = stage.getPointerPosition()!;
          selectNode(nodeId, container.left + pos.x, container.top + pos.y);
        }
        return;
      }
    }
    moveNode(nodeId, nx, ny);
  }, [moveNode, selectNode]);

  const connectingSrc = connectingFromId ? nodes.find(n => n.id === connectingFromId) : null;

  // 커서 결정
  const cursor = toolMode === 'connect'
    ? 'crosshair'
    : isPanning
      ? 'grabbing'
      : 'grab';

  return (
    <div
      style={{
        flex: 1,
        background: '#0d1117',
        backgroundImage: 'radial-gradient(circle, #30363d 1px, transparent 1px)',
        backgroundSize: `${32 * stageScale}px ${32 * stageScale}px`,
        backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
        cursor,
        position: 'relative',
        overflow: 'hidden',
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onWheel={onWheel}
    >
      {/* 연결 모드 배너 */}
      {toolMode === 'connect' && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: '#ffa65722', border: '1px solid #ffa657',
          color: '#ffa657', fontSize: 12, fontWeight: 600,
          padding: '6px 16px', borderRadius: 20, zIndex: 10, pointerEvents: 'none',
        }}>
          연결할 노드를 클릭하세요 — ESC로 취소
        </div>
      )}

      {/* 엣지 삽입 힌트 */}
      {dragOverEdge && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: '#3fb95022', border: '1px solid #3fb950',
          color: '#3fb950', fontSize: 12, fontWeight: 600,
          padding: '6px 16px', borderRadius: 20, zIndex: 10, pointerEvents: 'none',
        }}>
          ✦ 레일 중간에 삽입됩니다
        </div>
      )}

      {/* 줌 표시 */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: '#161b22cc', border: '1px solid #30363d',
        borderRadius: 6, padding: '4px 10px',
        fontSize: 11, color: '#8b949e',
        pointerEvents: 'none', zIndex: 10,
        backdropFilter: 'blur(4px)',
      }}>
        {Math.round(stageScale * 100)}%
      </div>

      {/* 줌 컨트롤 */}
      <div style={{
        position: 'absolute', bottom: 46, left: 16,
        display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
      }}>
        {[
          { label: '+', action: () => {
            const newScale = Math.min(stageScale * 1.2, 4);
            const cx = width / 2; const cy = height / 2;
            const mp = { x: (cx - stagePos.x) / stageScale, y: (cy - stagePos.y) / stageScale };
            setStageScale(newScale);
            setStagePos({ x: cx - mp.x * newScale, y: cy - mp.y * newScale });
          }},
          { label: '−', action: () => {
            const newScale = Math.max(stageScale / 1.2, 0.2);
            const cx = width / 2; const cy = height / 2;
            const mp = { x: (cx - stagePos.x) / stageScale, y: (cy - stagePos.y) / stageScale };
            setStageScale(newScale);
            setStagePos({ x: cx - mp.x * newScale, y: cy - mp.y * newScale });
          }},
          { label: '⊡', action: () => { setStageScale(1); setStagePos({ x: 0, y: 0 }); }},
        ].map(({ label, action }) => (
          <button
            key={label}
            onClick={action}
            style={{
              width: 28, height: 28,
              background: '#21262d', border: '1px solid #30363d',
              borderRadius: 6, color: '#8b949e', cursor: 'pointer',
              fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 컨트롤 안내 */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 10,
        background: '#161b22cc', border: '1px solid #30363d',
        borderRadius: 6, padding: '8px 12px',
        fontSize: 11, color: '#8b949e', pointerEvents: 'none',
        backdropFilter: 'blur(4px)', lineHeight: 1.6,
      }}>
        <div>Pan: drag empty space</div>
        <div>Zoom: mouse wheel</div>
        <div>Rotate: Q / E</div>
        <div>Reset: R</div>
      </div>

      <Stage
        ref={stageRef}
        width={width}
        height={height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        rotation={stageRotation}
        onMouseMove={onStageMouseMove}
        onMouseDown={onStageMouseDown}
        onMouseUp={onStageMouseUp}
        onClick={onStageClick}
      >
        <Layer>
          {/* 엣지 */}
          {edges.map(edge => {
            const from = nodes.find(n => n.id === edge.fromId);
            const to   = nodes.find(n => n.id === edge.toId);
            if (!from || !to) return null;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / len;
            const ny = dy / len;
            const isHighlighted = edge.id === dragOverEdge;

            return (
              <Arrow
                key={edge.id}
                points={[
                  from.x + nx * NODE_R, from.y + ny * NODE_R,
                  to.x - nx * (NODE_R + 4), to.y - ny * (NODE_R + 4),
                ]}
                stroke={isHighlighted ? '#3fb950' : '#58a6ff'}
                strokeWidth={isHighlighted ? 4 : 2}
                fill={isHighlighted ? '#3fb950' : '#58a6ff'}
                pointerLength={8}
                pointerWidth={6}
                opacity={isHighlighted ? 1 : 0.7}
                listening={false}
              />
            );
          })}

          {/* 연결 미리보기 */}
          {connectingSrc && (
            <Line
              points={[connectingSrc.x, connectingSrc.y, mousePos.x, mousePos.y]}
              stroke="#ffa657"
              strokeWidth={2}
              dash={[6, 4]}
              listening={false}
            />
          )}

          {/* 노드 */}
          {nodes.map(node => {
            const meta = NODE_META[node.type];
            const isConnecting = connectingFromId === node.id;
            const isTarget = toolMode === 'connect' && connectingFromId !== node.id;

            return (
              <Group
                key={node.id}
                x={node.x}
                y={node.y}
                draggable={toolMode === 'select'}
                onDragStart={e => onNodeDragStart(node.id, e)}
                onDragEnd={e => onNodeDragEnd(node.id, e)}
                onClick={e => onNodeClick(node.id, e)}
              >
                {isTarget && (
                  <Circle radius={NODE_R + 6} fill="transparent" stroke="#ffa65788" strokeWidth={2} />
                )}
                {isConnecting && (
                  <Circle radius={NODE_R + 6} fill="transparent" stroke="#ffa657" strokeWidth={2} />
                )}
                <Circle
                  radius={NODE_R}
                  fill={meta.color + '22'}
                  stroke={meta.color}
                  strokeWidth={2}
                />
                <Text
                  text={meta.icon}
                  fontSize={18}
                  fill={meta.color}
                  offsetX={9}
                  offsetY={10}
                  listening={false}
                />
                <Text
                  text={meta.label}
                  fontSize={10}
                  fill="#8b949e"
                  width={80}
                  offsetX={40}
                  offsetY={-NODE_R - 14}
                  align="center"
                  listening={false}
                />
                <Text
                  text={node.id}
                  fontSize={9}
                  fill="#444c56"
                  width={60}
                  offsetX={30}
                  offsetY={NODE_R + 2}
                  align="center"
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>

        <SimOverlay />
      </Stage>
    </div>
  );
}
