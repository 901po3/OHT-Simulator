import { useState } from 'react';

/* ════════════════════════════════════════════
   Unity C# 코드 구조 시각화
   — 네임스페이스 · 클래스 · 의존 관계를 SVG 플로우로 표시
════════════════════════════════════════════ */

interface ClassNode {
  id: string;
  name: string;
  namespace: string;
  file: string;
  kind: 'MonoBehaviour' | 'static' | 'data' | 'enum' | 'UI';
  responsibility: string;
  x: number;
  y: number;
}

interface Dependency {
  from: string;
  to: string;
  label: string;
  style?: 'solid' | 'dashed';
}

const CLASSES: ClassNode[] = [
  // Core — 데이터 모델
  { id: 'OHTMapData',      name: 'OHTMapData',      namespace: 'OHTSim.Core',       file: 'Core/OHTMapData.cs',       kind: 'data',         responsibility: '맵 전체 모델 (nodes, edges)',   x: 400, y: 60  },
  { id: 'MapNode',         name: 'MapNode',          namespace: 'OHTSim.Core',       file: 'Core/OHTMapData.cs',       kind: 'data',         responsibility: '노드 (id, type, x, y)',        x: 200, y: 60  },
  { id: 'MapEdge',         name: 'MapEdge',          namespace: 'OHTSim.Core',       file: 'Core/OHTMapData.cs',       kind: 'data',         responsibility: '엣지 (fromId, toId, weight)', x: 600, y: 60  },
  { id: 'NodeType',        name: 'NodeType',         namespace: 'OHTSim.Core',       file: 'Core/OHTMapData.cs',       kind: 'enum',         responsibility: 'Normal/Deposition/.../Depot',  x: 400, y: 160 },
  // Core — 파싱 · 빌딩
  { id: 'MapXmlParser',    name: 'MapXmlParser',     namespace: 'OHTSim.Core',       file: 'Core/MapXmlParser.cs',     kind: 'static',       responsibility: 'XML → OHTMapData 파서',        x: 120, y: 280 },
  { id: 'MapBuilder',      name: 'MapBuilder',       namespace: 'OHTSim.Core',       file: 'Core/MapBuilder.cs',       kind: 'MonoBehaviour', responsibility: 'OHTMapData → 3D GameObject',  x: 400, y: 280 },
  { id: 'NodeInfo',        name: 'NodeInfo',         namespace: 'OHTSim.Core',       file: 'Core/MapBuilder.cs',       kind: 'MonoBehaviour', responsibility: '노드 GO에 부착 — id·type 조회', x: 600, y: 280 },
  { id: 'MapLoaderService', name: 'MapLoaderService', namespace: 'OHTSim.Core',      file: 'Core/MapLoaderService.cs', kind: 'MonoBehaviour', responsibility: 'StreamingAssets 로드 오케스트레이터', x: 250, y: 400 },
  // Simulation
  { id: 'SimulationController', name: 'SimulationController', namespace: 'OHTSim.Simulation', file: 'Simulation/SimulationController.cs', kind: 'MonoBehaviour', responsibility: '상태 기계 WaitingForMap→Ready→Running', x: 400, y: 500 },
  { id: 'AgentController', name: 'AgentController',  namespace: 'OHTSim.Simulation', file: 'Simulation/AgentController.cs',     kind: 'MonoBehaviour', responsibility: '에이전트 스폰 · BFS 경로 · 코루틴 이동', x: 650, y: 400 },
  // UI
  { id: 'MapSelectorUI',  name: 'MapSelectorUI',     namespace: 'OHTSim.UI',         file: 'UI/MapSelectorUI.cs',      kind: 'UI',           responsibility: '플레이 진입 시 맵 선택 패널',  x: 100, y: 530 },
  { id: 'StartSimButtonUI', name: 'StartSimButtonUI', namespace: 'OHTSim.UI',        file: 'UI/StartSimButtonUI.cs',   kind: 'UI',           responsibility: '상단 중앙 시작/중지 버튼',     x: 650, y: 560 },
];

const DEPS: Dependency[] = [
  { from: 'MapNode',         to: 'OHTMapData',          label: 'List<MapNode>',     style: 'solid' },
  { from: 'MapEdge',         to: 'OHTMapData',          label: 'List<MapEdge>',     style: 'solid' },
  { from: 'NodeType',        to: 'MapNode',             label: 'enum field',        style: 'dashed' },
  { from: 'MapXmlParser',    to: 'OHTMapData',          label: 'returns',           style: 'solid' },
  { from: 'MapBuilder',      to: 'OHTMapData',          label: 'Build(data)',        style: 'solid' },
  { from: 'MapBuilder',      to: 'NodeInfo',            label: 'AddComponent',      style: 'solid' },
  { from: 'MapLoaderService', to: 'MapXmlParser',       label: 'Parse(xml)',        style: 'solid' },
  { from: 'MapLoaderService', to: 'MapBuilder',         label: 'Build(data)',       style: 'solid' },
  { from: 'SimulationController', to: 'MapLoaderService', label: 'IsLoaded / CurrentMap', style: 'solid' },
  { from: 'AgentController', to: 'SimulationController', label: 'OnStarted event',  style: 'dashed' },
  { from: 'AgentController', to: 'MapLoaderService',   label: 'CurrentMap',        style: 'solid' },
  { from: 'AgentController', to: 'MapBuilder',         label: 'mapScale / GO ref', style: 'dashed' },
  { from: 'MapSelectorUI',   to: 'MapLoaderService',   label: 'LoadMap()',         style: 'solid' },
  { from: 'MapSelectorUI',   to: 'SimulationController', label: 'OnMapLoaded()',   style: 'solid' },
  { from: 'StartSimButtonUI', to: 'SimulationController', label: 'Start/Stop()',   style: 'solid' },
];

const KIND_COLOR: Record<ClassNode['kind'], { bg: string; border: string; badge: string }> = {
  MonoBehaviour: { bg: '#1f6feb22', border: '#1f6feb', badge: '#58a6ff' },
  static:        { bg: '#3fb95022', border: '#3fb950', badge: '#3fb950' },
  data:          { bg: '#bc8cff22', border: '#bc8cff', badge: '#bc8cff' },
  enum:          { bg: '#ffa65722', border: '#ffa657', badge: '#ffa657' },
  UI:            { bg: '#f8514922', border: '#f85149', badge: '#f85149' },
};

const NS_COLORS: Record<string, string> = {
  'OHTSim.Core':       '#58a6ff33',
  'OHTSim.Simulation': '#3fb95033',
  'OHTSim.UI':         '#f8514933',
};

// 두 노드 사이 화살표 좌표 계산 (노드 경계에서 출발·도착)
function edgePoints(from: ClassNode, to: ClassNode, nodeW = 140, nodeH = 56) {
  const fx = from.x + nodeW / 2;
  const fy = from.y + nodeH / 2;
  const tx = to.x + nodeW / 2;
  const ty = to.y + nodeH / 2;
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const hw = nodeW / 2 + 4;
  const hh = nodeH / 2 + 4;
  const tFrom = Math.min(Math.abs(hw / (ux || 0.0001)), Math.abs(hh / (uy || 0.0001)));
  const tTo   = tFrom;
  return {
    x1: fx + ux * tFrom, y1: fy + uy * tFrom,
    x2: tx - ux * tTo,   y2: ty - uy * tTo,
    mx: (fx + tx) / 2,   my: (fy + ty) / 2,
  };
}

const NODE_W = 150;
const NODE_H = 60;

export function ArchitecturePage() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClassNode | null>(null);

  const classMap = Object.fromEntries(CLASSES.map(c => [c.id, c]));

  // SVG 전체 크기
  const SVG_W = 820;
  const SVG_H = 660;

  const isHighlighted = (id: string) => {
    if (!hovered) return true;
    if (id === hovered) return true;
    return DEPS.some(d => (d.from === hovered && d.to === id) || (d.to === hovered && d.from === id));
  };

  const isEdgeHighlighted = (d: Dependency) => {
    if (!hovered) return true;
    return d.from === hovered || d.to === hovered;
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#0d1117' }}>
      {/* 좌측: SVG 다이어그램 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>
          Unity C# 코드 구조
        </div>
        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>
          노드 위에 마우스를 올리면 의존 관계가 강조됩니다. 클릭하면 상세 정보를 확인할 수 있습니다.
        </div>

        {/* 범례 */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {(Object.entries(KIND_COLOR) as [ClassNode['kind'], typeof KIND_COLOR[keyof typeof KIND_COLOR]][]).map(([kind, c]) => (
            <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.badge }} />
              <span style={{ fontSize: 11, color: '#8b949e' }}>{kind}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="24" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#58a6ff" strokeWidth="1.5" strokeDasharray="4 2" /></svg>
            <span style={{ fontSize: 11, color: '#8b949e' }}>event / weak ref</span>
          </div>
        </div>

        <svg
          width={SVG_W}
          height={SVG_H}
          style={{ display: 'block', border: '1px solid #21262d', borderRadius: 12 }}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#444c56" />
            </marker>
            <marker id="arrow-hi" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#58a6ff" />
            </marker>
          </defs>

          {/* 네임스페이스 배경 영역 */}
          {[
            { ns: 'OHTSim.Core',       x: 60,  y: 30,  w: 620, h: 350 },
            { ns: 'OHTSim.Simulation', x: 320, y: 420, w: 390, h: 160 },
            { ns: 'OHTSim.UI',         x: 50,  y: 490, w: 290, h: 120 },
          ].map(({ ns, x, y, w, h }) => (
            <g key={ns}>
              <rect x={x} y={y} width={w} height={h} rx={12}
                fill={NS_COLORS[ns]} stroke={NS_COLORS[ns].replace('33', '66')} strokeWidth={1.5} strokeDasharray="6 3" />
              <text x={x + 10} y={y + 16} fill="#8b949e" fontSize={10} fontFamily="monospace">{ns}</text>
            </g>
          ))}

          {/* 엣지 */}
          {DEPS.map((dep, i) => {
            const f = classMap[dep.from];
            const t = classMap[dep.to];
            if (!f || !t) return null;
            const { x1, y1, x2, y2, mx, my } = edgePoints(f, t, NODE_W, NODE_H);
            const hi = isEdgeHighlighted(dep);
            return (
              <g key={i} opacity={hovered && !hi ? 0.08 : 1}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={hi ? '#58a6ff' : '#30363d'}
                  strokeWidth={hi ? 1.5 : 1}
                  strokeDasharray={dep.style === 'dashed' ? '5 3' : undefined}
                  markerEnd={hi ? 'url(#arrow-hi)' : 'url(#arrow)'}
                />
                {hi && dep.label && (
                  <text x={mx} y={my - 4} fill="#58a6ff88" fontSize={9} textAnchor="middle" fontFamily="monospace">
                    {dep.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* 노드 */}
          {CLASSES.map(cls => {
            const c = KIND_COLOR[cls.kind];
            const hi = isHighlighted(cls.id);
            const sel = selected?.id === cls.id;
            return (
              <g
                key={cls.id}
                transform={`translate(${cls.x},${cls.y})`}
                style={{ cursor: 'pointer' }}
                opacity={hovered && !hi ? 0.15 : 1}
                onMouseEnter={() => setHovered(cls.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(sel ? null : cls)}
              >
                <rect
                  width={NODE_W} height={NODE_H} rx={8}
                  fill={sel ? c.border + '44' : c.bg}
                  stroke={sel ? c.border : (hi ? c.border + 'aa' : '#30363d')}
                  strokeWidth={sel ? 2 : 1}
                />
                {/* 종류 배지 */}
                <rect x={NODE_W - 56} y={6} width={50} height={14} rx={3} fill={c.badge + '33'} />
                <text x={NODE_W - 31} y={16} fill={c.badge} fontSize={9} textAnchor="middle" fontFamily="monospace">
                  {cls.kind}
                </text>
                {/* 클래스명 */}
                <text x={8} y={30} fill="#e6edf3" fontSize={12} fontWeight={600} fontFamily="monospace">
                  {cls.name}
                </text>
                {/* 파일 경로 */}
                <text x={8} y={48} fill="#8b949e" fontSize={9} fontFamily="monospace">
                  {cls.file}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* 우측: 상세 패널 */}
      <div style={{
        width: 280,
        borderLeft: '1px solid #21262d',
        padding: 20,
        overflowY: 'auto',
        flexShrink: 0,
      }}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', marginBottom: 4 }}>
                {selected.name}
              </div>
              <code style={{ fontSize: 10, color: '#58a6ff', background: '#21262d', padding: '2px 6px', borderRadius: 4 }}>
                {selected.namespace}
              </code>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>책임</div>
              <div style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.7 }}>{selected.responsibility}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>파일</div>
              <code style={{ fontSize: 11, color: '#8b949e' }}>{selected.file}</code>
            </div>

            {/* 의존 관계 */}
            <div>
              <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>의존 관계</div>
              {DEPS.filter(d => d.from === selected.id).map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: '#58a6ff' }}>→</span>
                  <div>
                    <div style={{ fontSize: 11, color: '#e6edf3' }}>{d.to}</div>
                    <div style={{ fontSize: 10, color: '#444c56' }}>{d.label}</div>
                  </div>
                </div>
              ))}
              {DEPS.filter(d => d.to === selected.id).map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: '#3fb950' }}>←</span>
                  <div>
                    <div style={{ fontSize: 11, color: '#e6edf3' }}>{d.from}</div>
                    <div style={{ fontSize: 10, color: '#444c56' }}>{d.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', marginBottom: 12 }}>클래스 목록</div>
            {(['OHTSim.Core', 'OHTSim.Simulation', 'OHTSim.UI'] as const).map(ns => (
              <div key={ns} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: '#58a6ff', fontFamily: 'monospace', marginBottom: 6 }}>{ns}</div>
                {CLASSES.filter(c => c.namespace === ns).map(cls => (
                  <div
                    key={cls.id}
                    onClick={() => setSelected(cls)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      marginBottom: 3,
                      background: '#161b22',
                      border: '1px solid #21262d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#21262d')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#161b22')}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: KIND_COLOR[cls.kind].badge, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#e6edf3', fontFamily: 'monospace' }}>{cls.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
