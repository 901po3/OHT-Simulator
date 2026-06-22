import React, { useRef, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Circle, Arrow, Text, Group, Rect } from 'react-konva';
import type Konva from 'konva';
import { useEditorStore } from '../../store/editorStore';
import { useSimRunStore } from '../../store/simRunStore';
import { NODE_META } from '../editor/NodePalette';

const NODE_R = 24;

const STATE_COLOR: Record<string, string> = {
  Idle:       '#8b949e',
  Moving:     '#58a6ff',
  Waiting:    '#d29922',
  Processing: '#3fb950',
};

interface Props { width: number; height: number; }

export function SimMapCanvas({ width, height }: Props) {
  const { nodes, edges } = useEditorStore();
  const { agents, running, congestion } = useSimRunStore();

  const stageRef = useRef<Konva.Stage>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  // O(1) 노드 조회 — 대규모 맵(수백 노드)에서 find() 선형탐색 제거
  const nodeById = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // 정적 레이어(레일+노드)는 맵 변경 시에만 재생성 → 매 tick 에이전트 갱신과 분리
  const staticEls = useMemo(() => (
    <>
      {edges.map(edge => {
        const from = nodeById.get(edge.fromId);
        const to   = nodeById.get(edge.toId);
        if (!from || !to) return null;
        const dx = to.x - from.x; const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / len; const ny = dy / len;
        return (
          <Arrow
            key={edge.id}
            points={[from.x + nx * NODE_R, from.y + ny * NODE_R, to.x - nx * (NODE_R + 4), to.y - ny * (NODE_R + 4)]}
            stroke="#58a6ff" strokeWidth={2} fill="#58a6ff"
            pointerLength={8} pointerWidth={6} opacity={0.5} listening={false}
          />
        );
      })}
      {nodes.map(node => {
        const meta = NODE_META[node.type];
        return (
          <Group key={node.id} x={node.x} y={node.y} listening={false}>
            <Circle radius={NODE_R} fill={meta.color + '22'} stroke={meta.color} strokeWidth={2} />
            <Text text={meta.icon} fontSize={18} fill={meta.color} offsetX={9} offsetY={10} listening={false} />
            <Text text={meta.label} fontSize={10} fill="#8b949e" width={80} offsetX={40} offsetY={-NODE_R - 14} align="center" listening={false} />
          </Group>
        );
      })}
    </>
  ), [edges, nodes, nodeById]);

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

  const onStageDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target !== stageRef.current) return;
    setStagePos({ x: e.target.x(), y: e.target.y() });
  }, []);

  return (
    <div
      style={{
        flex: 1,
        background: '#0d1117',
        backgroundImage: 'radial-gradient(circle, #30363d 1px, transparent 1px)',
        backgroundSize: `${32 * stageScale}px ${32 * stageScale}px`,
        backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
        position: 'relative',
        overflow: 'hidden',
      }}
      onWheel={onWheel}
    >
      {/* 줌 표시 */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16, zIndex: 10,
        background: '#161b22cc', border: '1px solid #30363d',
        borderRadius: 6, padding: '4px 10px',
        fontSize: 11, color: '#8b949e', pointerEvents: 'none',
        backdropFilter: 'blur(4px)',
      }}>
        {Math.round(stageScale * 100)}%
      </div>

      {/* 줌 버튼 */}
      <div style={{ position: 'absolute', bottom: 46, left: 16, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
        {[
          { label: '+', action: () => {
            const ns = Math.min(stageScale * 1.2, 4);
            const cx = width / 2; const cy = height / 2;
            const pt = { x: (cx - stagePos.x) / stageScale, y: (cy - stagePos.y) / stageScale };
            setStageScale(ns); setStagePos({ x: cx - pt.x * ns, y: cy - pt.y * ns });
          }},
          { label: '−', action: () => {
            const ns = Math.max(stageScale / 1.2, 0.2);
            const cx = width / 2; const cy = height / 2;
            const pt = { x: (cx - stagePos.x) / stageScale, y: (cy - stagePos.y) / stageScale };
            setStageScale(ns); setStagePos({ x: cx - pt.x * ns, y: cy - pt.y * ns });
          }},
          { label: '⊡', action: () => { setStageScale(1); setStagePos({ x: 0, y: 0 }); } },
        ].map(({ label, action }) => (
          <button key={label} onClick={action} style={{
            width: 28, height: 28, background: '#21262d', border: '1px solid #30363d',
            borderRadius: 6, color: '#8b949e', cursor: 'pointer', fontSize: 14, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{label}</button>
        ))}
      </div>

      <Stage
        ref={stageRef}
        width={width}
        height={height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        draggable
        onDragMove={onStageDragMove}
        onDragEnd={onStageDragMove}
      >
        <Layer>
          {staticEls}
        </Layer>

        {/* 시뮬레이션 오버레이 */}
        {running && (
          <Layer>
            {/* 혼잡도 히트맵 */}
            {[...congestion.entries()].map(([nodeId, cong]) => {
              if (cong < 0.1) return null;
              const nd = nodeById.get(nodeId);
              if (!nd) return null;
              return (
                <Circle key={`cong-${nodeId}`} x={nd.x} y={nd.y}
                  radius={28 + cong * 20} fill={`rgba(248,81,73,${cong * 0.18})`} listening={false} />
              );
            })}

            {/* 경로 미리보기 — 로봇이 많으면 화면이 복잡하고 느려지므로 24대 이하에서만 */}
            {agents.length <= 24 && agents.map(agent => {
              if ((agent.state !== 'Moving' && agent.state !== 'Waiting') || agent.path.length < 2) return null;
              const remaining = agent.path.slice(agent.pathIndex);
              if (remaining.length < 2) return null;
              const points: number[] = [];
              remaining.forEach(n => { points.push(n.x, n.y); });
              return (
                <Arrow key={`path-${agent.id}`} points={points}
                  stroke={agent.color} strokeWidth={1.5} opacity={0.2}
                  dash={[4, 4]} fill={agent.color} pointerLength={6} pointerWidth={5} listening={false} />
              );
            })}

            {/* 에이전트 */}
            {agents.map(agent => {
              let ax = agent.currentNode.x;
              let ay = agent.currentNode.y;
              if (agent.nextNode) {
                ax = agent.currentNode.x + (agent.nextNode.x - agent.currentNode.x) * agent.progress;
                ay = agent.currentNode.y + (agent.nextNode.y - agent.currentNode.y) * agent.progress;
              }
              return (
                <Group key={agent.id} x={ax} y={ay} listening={false}>
                  <Rect x={-12} y={-12} width={24} height={24} fill={agent.color} stroke="#0d1117" strokeWidth={2} cornerRadius={5} />
                  <Text text={agent.id.replace('OHT-', '')} fontSize={10} fontStyle="bold" fill="#0d1117" width={24} x={-12} y={-6} align="center" listening={false} />
                  <Circle x={12} y={-12} radius={5} fill={STATE_COLOR[agent.state]} stroke="#0d1117" strokeWidth={1.5} />
                  {agent.state === 'Processing' && (
                    <Circle x={0} y={0} radius={18} fill="transparent"
                      stroke={STATE_COLOR['Processing']} strokeWidth={2}
                      opacity={0.6} />
                  )}
                </Group>
              );
            })}
          </Layer>
        )}
      </Stage>
    </div>
  );
}
