import { useState } from 'react';

/* ══════════════════════════════════════════════════════
   Unity C# 코드 구조 — 파이프라인 뷰
   XML 파싱 → 데이터 모델 → Unity 3D 씬 구성 흐름
══════════════════════════════════════════════════════ */

interface ClassInfo {
  id:             string;
  name:           string;
  kind:           'MonoBehaviour' | 'static' | 'data' | 'enum';
  file:           string;
  responsibility: string;
  deps:           string[];
}

const CLASSES: ClassInfo[] = [
  {
    id: 'MapLoaderService', name: 'MapLoaderService', kind: 'MonoBehaviour',
    file: 'Core/MapLoaderService.cs',
    responsibility: 'StreamingAssets/Maps/ 내 XML 파일을 읽어 MapXmlParser에 넘기고, 파싱된 OHTMapData를 MapBuilder에 전달해 씬을 구성하는 오케스트레이터.',
    deps: ['MapXmlParser', 'MapBuilder'],
  },
  {
    id: 'MapXmlParser', name: 'MapXmlParser', kind: 'static',
    file: 'Core/MapXmlParser.cs',
    responsibility: 'XML 텍스트를 XmlDocument로 파싱해 OHTMapData 반환. <Node> · <Edge> 요소를 순회하며 MapNode · MapEdge 객체 생성 후 BuildAdjacency() 호출.',
    deps: ['OHTMapData'],
  },
  {
    id: 'OHTMapData', name: 'OHTMapData', kind: 'data',
    file: 'Core/OHTMapData.cs',
    responsibility: '파싱 결과 최상위 컨테이너. List<MapNode> Nodes, List<MapEdge> Edges 보유. BuildAdjacency()로 각 MapNode.Edges 연결 리스트를 채움.',
    deps: ['MapNode', 'MapEdge'],
  },
  {
    id: 'MapNode', name: 'MapNode', kind: 'data',
    file: 'Core/OHTMapData.cs',
    responsibility: '단일 노드 데이터. Id (string), X/Y (웹 픽셀 좌표), NodeType, List<MapEdge> Edges (BuildAdjacency 후 채워짐).',
    deps: ['NodeType'],
  },
  {
    id: 'MapEdge', name: 'MapEdge', kind: 'data',
    file: 'Core/OHTMapData.cs',
    responsibility: '단일 레일 데이터. Id, From(MapNode 참조), To(MapNode 참조), Weight (float, 기본 1).',
    deps: [],
  },
  {
    id: 'NodeType', name: 'NodeType', kind: 'enum',
    file: 'Core/OHTMapData.cs',
    responsibility: 'Normal | Deposition | Exposure | Etching | Cleaning | Depot. 노드 종류 열거형. 색상 매핑 및 에이전트 공정 판단에 사용.',
    deps: [],
  },
  {
    id: 'MapBuilder', name: 'MapBuilder', kind: 'MonoBehaviour',
    file: 'Core/MapBuilder.cs',
    responsibility: 'Build(OHTMapData) → 노드별 Sphere GO 생성 + NodeType 색상 적용 + NodeInfo 컴포넌트 부착, 엣지별 LineRenderer 레일 생성. mapScale(기본 0.01)로 웹 px → Unity 단위 변환.',
    deps: ['OHTMapData', 'NodeInfo'],
  },
  {
    id: 'NodeInfo', name: 'NodeInfo', kind: 'MonoBehaviour',
    file: 'Core/MapBuilder.cs',
    responsibility: '각 노드 GO에 AddComponent. Id · NodeType을 런타임에 조회할 수 있도록 보관. 에이전트가 공정 판단 시 참조.',
    deps: ['NodeType'],
  },
];

// 5단계 파이프라인
interface Stage {
  id:         string;
  title:      string;
  subtitle:   string;
  color:      string;
  classIds:   string[];
  artifact?:  string;  // 클래스 없는 입력/출력 단계 설명
}

const STAGES: Stage[] = [
  {
    id: 'input', title: '입력', subtitle: '웹 에디터 → XML',
    color: '#8b949e', classIds: [],
    artifact: 'StreamingAssets/\nMaps/*.xml',
  },
  {
    id: 'parse', title: '로드 · 파싱', subtitle: 'XML → C# 객체',
    color: '#58a6ff', classIds: ['MapLoaderService', 'MapXmlParser'],
  },
  {
    id: 'model', title: '데이터 모델', subtitle: 'C# 구조체',
    color: '#bc8cff', classIds: ['OHTMapData', 'MapNode', 'MapEdge', 'NodeType'],
  },
  {
    id: 'build', title: '씬 구성', subtitle: '3D GameObject 생성',
    color: '#3fb950', classIds: ['MapBuilder', 'NodeInfo'],
  },
  {
    id: 'output', title: '결과', subtitle: 'Unity 3D 맵',
    color: '#ffa657', classIds: [],
    artifact: '노드 Sphere × N\n레일 LineRenderer × N\nNodeInfo 컴포넌트',
  },
];

// 단계 간 레이블
const FLOW_LABELS = [
  'File.ReadAllText()',
  'OHTMapData',
  'Build(data)',
  'AddComponent\n<NodeInfo>',
];

const KIND_COLOR: Record<ClassInfo['kind'], string> = {
  MonoBehaviour: '#58a6ff',
  static:        '#3fb950',
  data:          '#bc8cff',
  enum:          '#ffa657',
};

const KIND_BADGE: Record<ClassInfo['kind'], string> = {
  MonoBehaviour: 'MB',
  static:        'static',
  data:          'data',
  enum:          'enum',
};

export function ArchitecturePage() {
  const [selected, setSelected] = useState<ClassInfo | null>(null);
  const classMap = Object.fromEntries(CLASSES.map(c => [c.id, c]));

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0d1117', overflow: 'hidden' }}>

      {/* ── 메인: 파이프라인 ─────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 20px 32px' }}>

        <div style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3', marginBottom: 3 }}>
          Unity C# 코드 구조
        </div>
        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 18 }}>
          XML 파일 → C# 파싱 → Unity 3D 씬 구성 파이프라인. 클릭하면 우측에 상세 정보를 표시합니다.
        </div>

        {/* 범례 */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          {(Object.entries(KIND_COLOR) as [ClassInfo['kind'], string][]).map(([kind, color]) => (
            <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontWeight: 700,
                background: color + '22', border: `1px solid ${color}55`, color,
              }}>
                {KIND_BADGE[kind]}
              </span>
              <span style={{ fontSize: 11, color: '#8b949e' }}>{kind}</span>
            </div>
          ))}
        </div>

        {/* 파이프라인 행 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>

          {STAGES.map((stage, si) => (
            <div key={stage.id} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>

              {/* 단계 카드 */}
              <div style={{ width: 168, flexShrink: 0 }}>

                {/* 단계 헤더 */}
                <div style={{
                  background: '#161b22',
                  border: `1px solid ${stage.color}44`,
                  borderTop: `3px solid ${stage.color}`,
                  borderRadius: '8px 8px 0 0',
                  padding: '8px 10px',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: stage.color }}>{stage.title}</div>
                  <div style={{ fontSize: 10, color: '#8b949e', marginTop: 1 }}>{stage.subtitle}</div>
                </div>

                {/* 단계 본문 */}
                <div style={{
                  background: '#0d1117',
                  border: `1px solid ${stage.color}22`,
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  padding: stage.artifact ? '14px 10px' : '6px',
                  minHeight: 72,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  {/* 입력/출력 아티팩트 */}
                  {stage.artifact && (
                    <pre style={{
                      fontSize: 11, color: '#8b949e', margin: 0,
                      fontFamily: 'monospace', lineHeight: 1.75,
                      whiteSpace: 'pre',
                    }}>
                      {stage.artifact}
                    </pre>
                  )}

                  {/* 클래스 카드 */}
                  {stage.classIds.map(id => {
                    const cls = classMap[id];
                    if (!cls) return null;
                    const col = KIND_COLOR[cls.kind];
                    const isSel = selected?.id === id;
                    return (
                      <div
                        key={id}
                        onClick={() => setSelected(isSel ? null : cls)}
                        style={{
                          background: isSel ? col + '1a' : '#161b22',
                          border: `1px solid ${isSel ? col : '#30363d'}`,
                          borderLeft: `3px solid ${col}`,
                          borderRadius: 6,
                          padding: '7px 8px',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => {
                          if (!isSel) (e.currentTarget as HTMLElement).style.background = col + '0e';
                        }}
                        onMouseLeave={e => {
                          if (!isSel) (e.currentTarget as HTMLElement).style.background = '#161b22';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#e6edf3', fontFamily: 'monospace' }}>
                            {cls.name}
                          </span>
                          <span style={{
                            fontSize: 8, padding: '1px 4px', borderRadius: 2, flexShrink: 0,
                            background: col + '22', color: col, fontFamily: 'monospace', fontWeight: 700,
                          }}>
                            {KIND_BADGE[cls.kind]}
                          </span>
                        </div>
                        <div style={{ fontSize: 9, color: '#444c56', marginTop: 3, fontFamily: 'monospace' }}>
                          {cls.file}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 단계 사이 화살표 */}
              {si < STAGES.length - 1 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '0 2px', paddingTop: 26,
                  flexShrink: 0, width: 52,
                }}>
                  <div style={{ fontSize: 9, color: '#444c56', fontFamily: 'monospace', textAlign: 'center', whiteSpace: 'pre', marginBottom: 2, lineHeight: 1.4 }}>
                    {FLOW_LABELS[si]}
                  </div>
                  <svg width="36" height="14" viewBox="0 0 36 14">
                    <line x1="1" y1="7" x2="28" y2="7" stroke={STAGES[si + 1].color} strokeWidth="1.5" />
                    <path d="M24,3 L33,7 L24,11" fill="none" stroke={STAGES[si + 1].color} strokeWidth="1.5" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 스케일 메모 */}
        <div style={{ marginTop: 20, padding: '10px 14px', background: '#161b22', borderRadius: 8, border: '1px solid #30363d', fontSize: 11, color: '#8b949e' }}>
          <span style={{ color: '#58a6ff', fontWeight: 600 }}>좌표 변환:</span>{' '}
          웹 에디터 픽셀 × 0.01 = Unity 단위 (MapBuilder.mapScale). 웹 y축 → Unity -Z축.
        </div>
      </div>

      {/* ── 우측: 상세 패널 ──────────────────────────────── */}
      <div style={{
        width: 260, flexShrink: 0,
        borderLeft: '1px solid #21262d',
        padding: 20, overflowY: 'auto',
      }}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 클래스명 + 배지 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', fontFamily: 'monospace' }}>
                  {selected.name}
                </span>
                <span style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 3,
                  background: KIND_COLOR[selected.kind] + '22',
                  color: KIND_COLOR[selected.kind],
                  fontFamily: 'monospace', fontWeight: 700,
                }}>
                  {KIND_BADGE[selected.kind]}
                </span>
              </div>
              <code style={{ fontSize: 10, color: '#8b949e', background: '#21262d', padding: '2px 7px', borderRadius: 4 }}>
                {selected.file}
              </code>
            </div>

            {/* 책임 */}
            <div>
              <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                책임
              </div>
              <p style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.75, margin: 0 }}>
                {selected.responsibility}
              </p>
            </div>

            {/* 의존 */}
            {selected.deps.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  사용하는 타입
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {selected.deps.map(depId => {
                    const dep = classMap[depId];
                    return dep ? (
                      <div
                        key={depId}
                        onClick={() => setSelected(dep)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 8px', borderRadius: 6,
                          background: '#161b22', border: '1px solid #30363d',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#21262d'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#161b22'}
                      >
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: KIND_COLOR[dep.kind], flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#e6edf3', fontFamily: 'monospace' }}>{dep.name}</span>
                        <span style={{ fontSize: 9, color: '#444c56', marginLeft: 'auto' }}>{KIND_BADGE[dep.kind]}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* 참조하는 곳 */}
            {(() => {
              const refs = CLASSES.filter(c => c.deps.includes(selected.id));
              return refs.length > 0 ? (
                <div>
                  <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    참조하는 클래스
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {refs.map(ref => (
                      <div
                        key={ref.id}
                        onClick={() => setSelected(ref)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 8px', borderRadius: 6,
                          background: '#161b22', border: '1px solid #30363d',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#21262d'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#161b22'}
                      >
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: KIND_COLOR[ref.kind], flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#e6edf3', fontFamily: 'monospace' }}>{ref.name}</span>
                        <span style={{ fontSize: 9, color: '#444c56', marginLeft: 'auto' }}>{KIND_BADGE[ref.kind]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            <button
              onClick={() => setSelected(null)}
              style={{
                marginTop: 4, padding: '6px 0', borderRadius: 6, cursor: 'pointer',
                background: 'transparent', border: '1px solid #30363d',
                color: '#8b949e', fontSize: 11,
              }}
            >
              ← 목록으로
            </button>
          </div>
        ) : (
          /* 선택 없을 때: 전체 클래스 목록 */
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', marginBottom: 14 }}>
              전체 클래스 ({CLASSES.length}개)
            </div>
            {STAGES.filter(s => s.classIds.length > 0).map(stage => (
              <div key={stage.id} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: stage.color, fontWeight: 600, marginBottom: 6 }}>
                  {stage.title}
                </div>
                {stage.classIds.map(id => {
                  const cls = classMap[id];
                  if (!cls) return null;
                  const col = KIND_COLOR[cls.kind];
                  return (
                    <div
                      key={id}
                      onClick={() => setSelected(cls)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 8px', borderRadius: 6, marginBottom: 3,
                        background: '#161b22', border: '1px solid #21262d',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#21262d'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#161b22'}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#e6edf3', fontFamily: 'monospace' }}>{cls.name}</span>
                      <span style={{ fontSize: 9, color: '#444c56', marginLeft: 'auto' }}>{KIND_BADGE[cls.kind]}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
