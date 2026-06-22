import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { NodeType, ConnectType } from '../../store/editorStore';
import { useEditorStore } from '../../store/editorStore';
import { saveMap, listMaps, loadMap, deleteMap, type SavedMap } from '../../core/storage/mapStorage';

export const NODE_META: Record<NodeType, { label: string; color: string; icon: string }> = {
  Normal:     { label: '일반 노드',  color: '#58a6ff', icon: '⬡' },
  Deposition: { label: '증착 노드',  color: '#bc8cff', icon: '⬢' },
  Exposure:   { label: '노광 노드',  color: '#ffa657', icon: '☀' },
  Etching:    { label: '식각 노드',  color: '#f85149', icon: '⚙' },
  Cleaning:   { label: '세정 노드',  color: '#3fb950', icon: '✦' },
  Depot:      { label: '차고지',     color: '#8b949e', icon: '⬛' },
};

const TYPES: NodeType[] = ['Normal', 'Deposition', 'Exposure', 'Etching', 'Cleaning', 'Depot'];

const btnBase: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: 6,
  border: '1px solid #30363d',
  background: '#21262d',
  color: '#e6edf3',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 500,
  textAlign: 'left',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#8b949e',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 4,
  flexShrink: 0,
};

const divider: React.CSSProperties = {
  height: 1,
  background: '#30363d',
  margin: '8px 0',
  flexShrink: 0,
};

type MapData = { nodes: import('../../store/editorStore').EditorNode[]; edges: import('../../store/editorStore').EditorEdge[] };
type NT = import('../../store/editorStore').NodeType;

function makeMapBuilder() {
  let nSeq = 1; let eSeq = 1;
  const n = (type: NT, x: number, y: number) => ({ id: `node-${nSeq++}`, type, x, y });
  const bi = (aId: string, bId: string) =>
    [{ id: `edge-${eSeq++}`, fromId: aId, toId: bId }, { id: `edge-${eSeq++}`, fromId: bId, toId: aId }];
  return { n, bi };
}

// ───────────────────────────────────────────────────────────────────
// 단방향 그리드 공용 빌더 — 4가지 설계 원칙을 모든 프리셋에 일관 적용
// ───────────────────────────────────────────────────────────────────
//   ① 단방향 강결합 (가로: 짝수행→오른쪽 / 세로: 짝수열→아래, 홀수는 반대)
//   ② 특수 노드 비인접 ((짝수행, 짝수열) 부분격자에만 배치)
//   ③ 균등 분산 (D·E·Et·C 순환 배치)
//   ④ 외곽 분산 차고지 (모서리 + 변 중앙에서 depotCount 만큼 선택)
//
// ⚠ cols·rows는 짝수여야 패리티 + 비인접 보장. 홀수면 가장자리 한 칸이 비대칭이 된다.
// ⚠ loadFromData()로 에디터 상태를 전체 교체할 때만 안전 — nSeq/eSeq가 1부터 재시작.
function buildOneWayGrid(
  cols: number, rows: number,
  opts: { x0?: number; dx?: number; y0?: number; dy?: number; depotCount?: number } = {},
): MapData {
  const x0 = opts.x0 ?? 60;
  const dx = opts.dx ?? 70;
  const y0 = opts.y0 ?? 60;
  const dy = opts.dy ?? 70;
  const depotCount = opts.depotCount ?? 2;

  let nSeq = 1, eSeq = 1;
  type GN = { id: string; type: NT; x: number; y: number };
  const PROC: NT[] = ['Deposition', 'Exposure', 'Etching', 'Cleaning'];

  // ④ 외곽 분산 차고지 후보 (짝수,짝수 부분격자 + 외곽 우선)
  // 모서리 4개 → 변 중앙 4개 순으로 채워 depotCount 만큼 선택
  const lastEvenR = rows - 1 - ((rows - 1) % 2);
  const lastEvenC = cols - 1 - ((cols - 1) % 2);
  const midR      = Math.floor(rows / 2) - (Math.floor(rows / 2) % 2);
  const midC      = Math.floor(cols / 2) - (Math.floor(cols / 2) % 2);
  const depotCandidates = [
    `0,0`, `0,${lastEvenC}`, `${lastEvenR},0`, `${lastEvenR},${lastEvenC}`,           // 모서리 4
    `0,${midC}`, `${lastEvenR},${midC}`, `${midR},0`, `${midR},${lastEvenC}`,         // 변 중앙 4
  ];
  const depotCells = new Set(depotCandidates.slice(0, Math.min(depotCount, depotCandidates.length)));

  // ②③ (짝수,짝수) 셀에만 특수 노드 배치 — 차고지 또는 D·E·Et·C 순환
  let stIdx = 0;
  const grid: GN[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: GN[] = [];
    for (let c = 0; c < cols; c++) {
      let type: NT = 'Normal';
      if (r % 2 === 0 && c % 2 === 0) {
        type = depotCells.has(`${r},${c}`) ? 'Depot' : PROC[stIdx++ % 4];
      }
      row.push({ id: `node-${nSeq++}`, type, x: x0 + c * dx, y: y0 + r * dy });
    }
    grid.push(row);
  }

  // ① 단방향 엣지 — 행/열 패리티로 교차
  const edges: { id: string; fromId: string; toId: string }[] = [];
  const dir = (a: GN, b: GN) => edges.push({ id: `edge-${eSeq++}`, fromId: a.id, toId: b.id });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) {
        if (r % 2 === 0) dir(grid[r][c], grid[r][c + 1]);
        else             dir(grid[r][c + 1], grid[r][c]);
      }
      if (r + 1 < rows) {
        if (c % 2 === 0) dir(grid[r][c], grid[r + 1][c]);
        else             dir(grid[r + 1][c], grid[r][c]);
      }
    }
  }

  return { nodes: grid.flat(), edges };
}

// 프리셋 1: 소형 — 6×4 단방향 그리드 (24노드, 공정 종류별 1개, Depot 2)
//   짝수,짝수 부분격자 = 3×2 = 6셀 → 차고지 2 + 공정 4 (D·E·Et·C 각 1)
function buildSmallMap(): MapData {
  return buildOneWayGrid(6, 4, { depotCount: 2 });
}

// 프리셋 2: 중형 — 8×6 단방향 그리드 (48노드, 공정 종류별 2개, Depot 4)
//   짝수,짝수 부분격자 = 4×3 = 12셀 → 차고지 4 + 공정 8 (종류별 2)
function buildMediumMap(): MapData {
  return buildOneWayGrid(8, 6, { depotCount: 4 });
}

// 프리셋 3: 대형 — 12×8 단방향 그리드 (96노드, 공정 종류별 4~5개, Depot 6)
//   짝수,짝수 부분격자 = 6×4 = 24셀 → 차고지 6 + 공정 18 (종류별 4~5)
function buildLargeMap(): MapData {
  return buildOneWayGrid(12, 8, { depotCount: 6 });
}

// 프리셋 4: 초대형 팹 (∞ 무한 운전) — 20×16 단방향 그리드 (320노드, Depot 8)
//   실제 반도체 FAB의 OHT 트랙과 동일한 토폴로지. 100대 무한 운전 검증 완료.
function buildFabMap(): MapData {
  return buildOneWayGrid(20, 16, { depotCount: 8 });
}

export function NodePalette() {
  const { nodes, edges, connectType, setConnectType, saveToFile, loadFromData, clearMap } = useEditorStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mapName, setMapName] = useState('');
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);
  const [showMaps, setShowMaps] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveErr, setSaveErr] = useState('');

  const clearMsg = () => { setSaveMsg(''); setSaveErr(''); };

  const refreshMaps = useCallback(async () => {
    try {
      setSavedMaps(await listMaps());
    } catch {
      setSaveErr('목록 불러오기 실패');
    }
  }, []);

  useEffect(() => {
    refreshMaps();
  }, [refreshMaps]);

  const onDragStart = (e: React.DragEvent, type: NodeType) => {
    e.dataTransfer.setData('nodeType', type);
  };

  const onLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.nodes && data.edges) loadFromData(data);
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveToDb = async () => {
    clearMsg();
    const name = mapName.trim() || `맵 ${new Date().toLocaleTimeString('ko-KR')}`;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await saveMap(name, { nodes, edges } as any);
      setSaveMsg(`"${name}" 저장됨`);
      setTimeout(() => setSaveMsg(''), 2000);
      setMapName('');
      await refreshMaps();
    } catch (err) {
      setSaveErr('저장 실패: ' + (err instanceof Error ? err.message : '오류'));
    }
  };

  const handleLoadFromDb = async (name: string) => {
    clearMsg();
    try {
      const entry = await loadMap(name);
      if (entry?.data?.nodes && entry.data.edges) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loadFromData(entry.data as any);
        setShowMaps(false);
      }
    } catch (err) {
      setSaveErr('불러오기 실패: ' + (err instanceof Error ? err.message : '오류'));
    }
  };

  const handleDeleteFromDb = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    clearMsg();
    try {
      await deleteMap(name);
      await refreshMaps();
    } catch (err) {
      setSaveErr('삭제 실패: ' + (err instanceof Error ? err.message : '오류'));
    }
  };

  const connectBtn = (type: ConnectType, label: string, icon: string) => {
    const active = connectType === type;
    return (
      <button
        onClick={() => setConnectType(type)}
        style={{
          flex: 1,
          padding: '7px 4px',
          borderRadius: 6,
          border: `1px solid ${active ? '#58a6ff' : '#30363d'}`,
          background: active ? '#1f6feb22' : '#21262d',
          color: active ? '#58a6ff' : '#8b949e',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: active ? 700 : 400,
          textAlign: 'center',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 14 }}>{icon}</div>
        <div style={{ marginTop: 2 }}>{label}</div>
      </button>
    );
  };

  return (
    <div style={{
      width: 168,
      background: '#161b22',
      borderRight: '1px solid #30363d',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* 스크롤 가능한 상단: 노드 팔레트 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={sectionLabel}>노드 팔레트</div>

        {TYPES.map(type => {
          const meta = NODE_META[type];
          return (
            <div
              key={type}
              draggable
              onDragStart={e => onDragStart(e, type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '7px 9px',
                background: '#21262d',
                border: '1px solid #30363d',
                borderLeft: `3px solid ${meta.color}`,
                borderRadius: 7,
                cursor: 'grab',
                fontSize: 11,
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2d333b')}
              onMouseLeave={e => (e.currentTarget.style.background = '#21262d')}
            >
              <span style={{ fontSize: 14, color: meta.color, lineHeight: 1, flexShrink: 0 }}>{meta.icon}</span>
              <span style={{ color: '#e6edf3', fontWeight: 500 }}>{meta.label}</span>
            </div>
          );
        })}

        <div style={divider} />

        {/* 새로 만들기 / 프리셋 */}
        <div style={sectionLabel}>맵 작업</div>

        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            style={{ ...btnBase, color: '#f85149', borderColor: '#f8514944' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f8514922')}
            onMouseLeave={e => (e.currentTarget.style.background = '#21262d')}
          >
            <span>🗑</span> 새로 만들기
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => { clearMap(); setConfirmClear(false); }}
              style={{ ...btnBase, flex: 1, background: '#f8514933', borderColor: '#f85149', color: '#f85149', justifyContent: 'center' }}
            >확인</button>
            <button
              onClick={() => setConfirmClear(false)}
              style={{ ...btnBase, flex: 1, justifyContent: 'center' }}
            >취소</button>
          </div>
        )}

        <button
          onClick={() => setPresetOpen(v => !v)}
          style={{ ...btnBase, color: '#3fb950', borderColor: '#3fb95044', background: '#3fb95011' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3fb95033')}
          onMouseLeave={e => (e.currentTarget.style.background = '#3fb95011')}
        >
          <span>⚡</span> 프리셋 {presetOpen ? '▲' : '▼'}
        </button>

        {presetOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
            {([
              { label: '소형',         sub: '단방향 · 24노드 · 공정 4',     fn: buildSmallMap,  color: '#58a6ff' },
              { label: '중형',         sub: '단방향 · 48노드 · 공정 8',     fn: buildMediumMap, color: '#ffa657' },
              { label: '대형',         sub: '단방향 · 96노드 · 공정 18',    fn: buildLargeMap,  color: '#bc8cff' },
              { label: '초대형 팹 ∞',  sub: '단방향 · 320노드 · 100대 무한운전', fn: buildFabMap, color: '#39d353' },
            ] as const).map(({ label, sub, fn, color }) => (
              <button
                key={label}
                onClick={() => { loadFromData(fn()); setPresetOpen(false); }}
                style={{
                  ...btnBase, flexDirection: 'column', alignItems: 'flex-start', gap: 1,
                  borderColor: color + '44', background: color + '0d', color,
                  padding: '6px 10px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = color + '22')}
                onMouseLeave={e => (e.currentTarget.style.background = color + '0d')}
              >
                <span style={{ fontWeight: 700 }}>{label} 맵</span>
                <span style={{ fontSize: 9, color: '#8b949e', fontWeight: 400 }}>{sub}</span>
              </button>
            ))}
          </div>
        )}

        <div style={divider} />

        {/* 사용 힌트 */}
        <div style={{ fontSize: 10, color: '#444c56', lineHeight: 1.6, flexShrink: 0 }}>
          드래그 → 캔버스 배치<br />
          레일 위 드롭 → 삽입<br />
          스크롤 → 줌 · 빈 공간 드래그 → 패닝
        </div>
      </div>

      {/* 고정 하단: 연결 방향 + 저장 */}
      <div style={{ borderTop: '1px solid #30363d', padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {/* 연결 방향 */}
        <div style={sectionLabel}>연결 방향</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {connectBtn('unidirectional', '단방향', '→')}
          {connectBtn('bidirectional', '양방향', '⇄')}
        </div>
        <div style={{ fontSize: 10, color: '#444c56', marginBottom: 2 }}>
          {connectType === 'bidirectional' ? '양쪽 모두 연결' : '클릭 방향으로만 연결'}
        </div>

        <div style={divider} />

        {/* 맵 저장 (IndexedDB) */}
        <div style={sectionLabel}>맵 저장</div>
        <input
          value={mapName}
          onChange={e => setMapName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSaveToDb()}
          placeholder="맵 이름 (선택)"
          style={{
            padding: '6px 8px',
            borderRadius: 5,
            border: '1px solid #30363d',
            background: '#0d1117',
            color: '#e6edf3',
            fontSize: 11,
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handleSaveToDb}
          style={{ ...btnBase, background: '#1f6feb33', borderColor: '#1f6feb55', color: '#58a6ff' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1f6feb55')}
          onMouseLeave={e => (e.currentTarget.style.background = '#1f6feb33')}
        >
          <span>💾</span> 저장
        </button>
        {saveMsg && <div style={{ fontSize: 10, color: '#3fb950' }}>{saveMsg}</div>}
        {saveErr && <div style={{ fontSize: 10, color: '#f85149' }}>{saveErr}</div>}

        <button
          onClick={() => { setShowMaps(v => !v); refreshMaps(); }}
          style={btnBase}
          onMouseEnter={e => (e.currentTarget.style.background = '#2d333b')}
          onMouseLeave={e => (e.currentTarget.style.background = '#21262d')}
        >
          <span>📂</span> 맵 목록 {showMaps ? '▲' : '▼'}
        </button>

        {showMaps && (
          <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {savedMaps.length === 0 && (
              <div style={{ fontSize: 10, color: '#444c56' }}>저장된 맵 없음</div>
            )}
            {savedMaps.map(m => (
              <div
                key={m.name}
                onClick={() => handleLoadFromDb(m.name)}
                style={{
                  padding: '6px 8px',
                  background: '#21262d',
                  border: '1px solid #30363d',
                  borderRadius: 5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2d333b')}
                onMouseLeave={e => (e.currentTarget.style.background = '#21262d')}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#e6edf3' }}>{m.name}</div>
                  <div style={{ fontSize: 9, color: '#444c56' }}>
                    {new Date(m.savedAt).toLocaleDateString('ko-KR')}
                  </div>
                </div>
                <button
                  onClick={e => handleDeleteFromDb(m.name, e)}
                  style={{
                    background: 'none', border: 'none', color: '#f85149',
                    cursor: 'pointer', fontSize: 12, padding: '0 2px',
                  }}
                >✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={divider} />

        {/* JSON 파일 */}
        <div style={sectionLabel}>파일 내보내기</div>
        <button
          onClick={saveToFile}
          style={btnBase}
          onMouseEnter={e => (e.currentTarget.style.background = '#2d333b')}
          onMouseLeave={e => (e.currentTarget.style.background = '#21262d')}
        >
          <span>↓</span> JSON 다운로드
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          style={btnBase}
          onMouseEnter={e => (e.currentTarget.style.background = '#2d333b')}
          onMouseLeave={e => (e.currentTarget.style.background = '#21262d')}
        >
          <span>↑</span> JSON 불러오기
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={onLoadFile} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
