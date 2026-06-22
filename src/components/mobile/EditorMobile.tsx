import { useEffect, useState } from 'react';
import { Stage, Layer, Circle, Arrow, Text } from 'react-konva';
import { useEditorStore } from '../../store/editorStore';

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

export function EditorMobile() {
  const { nodes, edges } = useEditorStore();
  const [w, setW] = useState(window.innerWidth);

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  const stageW = Math.max(280, w - 24);
  const stageH = Math.round(stageW * 0.85);

  // Fit-to-screen bounds
  let scale = 1, ox = 0, oy = 0;
  if (nodes.length > 0) {
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 40;
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    scale = Math.min((stageW - pad * 2) / bw, (stageH - pad * 2) / bh, 1.2);
    ox = (stageW - bw * scale) / 2 - minX * scale;
    oy = (stageH - bh * scale) / 2 - minY * scale;
  }

  return (
    <div style={{ padding: 14, color: '#e6edf3' }}>
      <h2 style={{ margin: '4px 0 6px', fontSize: 18, color: '#58a6ff' }}>맵 에디터 (읽기 전용)</h2>
      <p style={{ fontSize: 13, color: '#8b949e', margin: '0 0 12px', lineHeight: 1.5 }}>
        현재 저장된 맵을 모바일에서 미리 볼 수 있습니다. 편집은 PC 환경에서만 가능합니다.
      </p>

      <div style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: 10,
        padding: 6, marginBottom: 12, overflow: 'hidden',
      }}>
        {nodes.length === 0 ? (
          <div style={{
            height: stageH, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6e7681', fontSize: 13, textAlign: 'center', padding: 20,
          }}>
            저장된 맵이 없습니다.<br/>PC에서 맵을 만들면 여기에 표시됩니다.
          </div>
        ) : (
          <Stage width={stageW} height={stageH}>
            <Layer x={ox} y={oy} scaleX={scale} scaleY={scale}>
              {edges.map(e => {
                const a = nodes.find(n => n.id === e.fromId);
                const b = nodes.find(n => n.id === e.toId);
                if (!a || !b) return null;
                return (
                  <Arrow
                    key={e.id}
                    points={[a.x, a.y, b.x, b.y]}
                    stroke="#30363d"
                    fill="#30363d"
                    strokeWidth={2 / scale}
                    pointerLength={8 / scale}
                    pointerWidth={8 / scale}
                  />
                );
              })}
              {nodes.map(n => (
                <Circle
                  key={n.id}
                  x={n.x} y={n.y}
                  radius={10 / scale}
                  fill={NODE_COLOR[n.type] ?? '#58a6ff'}
                  stroke="#0d1117"
                  strokeWidth={2 / scale}
                />
              ))}
              {nodes.map(n => (
                <Text
                  key={`t-${n.id}`}
                  x={n.x - 30} y={n.y + 14 / scale}
                  width={60} align="center"
                  text={NODE_LABEL[n.type] ?? n.type}
                  fontSize={10 / scale}
                  fill="#8b949e"
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>

      <div style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: 10,
        padding: 12, marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>노드 범례</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {Object.entries(NODE_LABEL).map(([k, label]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                background: NODE_COLOR[k], border: '1px solid #0d1117',
              }} />
              <span style={{ color: '#e6edf3' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background: '#1f2a37', border: '1px solid #2f4660', borderRadius: 10,
        padding: 12, fontSize: 13, color: '#9bb4d4', lineHeight: 1.5,
      }}>
        💡 노드 추가·삭제·연결 같은 편집 기능은 PC 화면(768px 초과)에서만 사용할 수 있습니다.
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#6e7681' }}>
        노드: {nodes.length} · 엣지: {edges.length}
      </div>
    </div>
  );
}
