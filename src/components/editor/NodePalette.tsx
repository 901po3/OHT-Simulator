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

// 프리셋 1: 소형 (1x 공정, 13노드)
function buildSmallMap(): MapData {
  const { n, bi } = makeMapBuilder();
  const dep   = n('Deposition', 160, 160);
  const nTop  = n('Normal',     400,  90);
  const exp   = n('Exposure',   640, 160);
  const nRight= n('Normal',     720, 310);
  const etch  = n('Etching',    640, 460);
  const nBot  = n('Normal',     400, 530);
  const clean = n('Cleaning',   160, 460);
  const nLeft = n('Normal',      80, 310);
  const depot = n('Depot',      400, 310);
  const cTop  = n('Normal',     400, 200);
  const cRight= n('Normal',     520, 310);
  const cBot  = n('Normal',     400, 420);
  const cLeft = n('Normal',     280, 310);

  return {
    nodes: [dep, nTop, exp, nRight, etch, nBot, clean, nLeft, depot, cTop, cRight, cBot, cLeft],
    edges: [
      ...bi(dep.id, nTop.id), ...bi(nTop.id, exp.id), ...bi(exp.id, nRight.id), ...bi(nRight.id, etch.id),
      ...bi(etch.id, nBot.id), ...bi(nBot.id, clean.id), ...bi(clean.id, nLeft.id), ...bi(nLeft.id, dep.id),
      ...bi(depot.id, cTop.id), ...bi(depot.id, cRight.id), ...bi(depot.id, cBot.id), ...bi(depot.id, cLeft.id),
      ...bi(dep.id, cLeft.id), ...bi(exp.id, cTop.id), ...bi(etch.id, cRight.id), ...bi(clean.id, cBot.id),
    ],
  };
}

// 그리드 맵 빌더 — 각 노드가 상하좌우 이웃과 모두 연결된 메시 구조
// 로봇이 점유된 경로를 피해 자연스럽게 분산되는 것을 지원
//
// ⚠ 사용 전제: loadFromData()로 에디터 상태를 전체 교체(replace)할 때만 안전
// nSeq/eSeq가 호출마다 1부터 재시작하므로 기존 그래프와 병합하면 id 충돌이 발생함
function buildGrid(
  cols: number, rows: number,
  x0: number, dx: number,
  y0: number, dy: number,
  typeMap: Partial<Record<string, NT>>,
): MapData {
  let nSeq = 1; let eSeq = 1;
  type GN = { id: string; type: NT; x: number; y: number };
  const grid: GN[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      id: `node-${nSeq++}`,
      type: (typeMap[`${r},${c}`] ?? 'Normal') as NT,
      x: x0 + c * dx,
      y: y0 + r * dy,
    }))
  );
  const edges: { id: string; fromId: string; toId: string }[] = [];
  const bi = (a: string, b: string) => [
    { id: `edge-${eSeq++}`, fromId: a, toId: b },
    { id: `edge-${eSeq++}`, fromId: b, toId: a },
  ];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) edges.push(...bi(grid[r][c].id, grid[r][c + 1].id));
      if (r + 1 < rows) edges.push(...bi(grid[r][c].id, grid[r + 1][c].id));
    }
  }
  return { nodes: grid.flat(), edges };
}

// 프리셋 2: 중형 — 4×5 그리드 (20노드, 공정 종류별 2개, Depot 2)
// 설계 원칙: 특수 노드 비인접 (체커보드 배치 — (row+col)%2===0 셀만 사용)
// 2개 루트: 좌측(col 0-1) / 우측(col 2-3) 각각 D·E·Et·C 1개씩
function buildMediumMap(): MapData {
  return buildGrid(4, 5, 100, 185, 75, 125, {
    '0,0': 'Deposition', '0,2': 'Exposure',
    '1,1': 'Etching',    '1,3': 'Cleaning',
    '2,0': 'Exposure',   '2,2': 'Depot',
    '3,1': 'Etching',    '3,3': 'Deposition',
    '4,0': 'Depot',      '4,2': 'Cleaning',
  });
}

// 프리셋 3: 대형 — 5×6 그리드 (30노드, 공정 종류별 3개, Depot 2)
// 설계 원칙: 특수 노드 비인접 (체커보드 배치 — (row+col)%2===0 셀만 사용)
// 3개 루트: 좌(col 0) / 중(col 2) / 우(col 4) 각 루트에 D·E·Et·C 분산 배치
// D×3: (0,0)(0,4)(3,3) / E×3: (0,2)(1,3)(5,1) / Et×3: (1,1)(3,1)(5,3) / C×3: (2,0)(2,4)(4,0)
function buildLargeMap(): MapData {
  return buildGrid(5, 6, 80, 145, 65, 110, {
    '0,0': 'Deposition', '0,2': 'Exposure',   '0,4': 'Deposition',
    '1,1': 'Etching',    '1,3': 'Exposure',
    '2,0': 'Cleaning',   '2,2': 'Depot',      '2,4': 'Cleaning',
    '3,1': 'Etching',    '3,3': 'Deposition',
    '4,0': 'Cleaning',   '4,4': 'Depot',
    '5,1': 'Exposure',   '5,3': 'Etching',
  });
}

// 프리셋 4: 초대형 팹 (∞ 무한 운전) — 단방향(one-way) 방향성 그리드
// ───────────────────────────────────────────────────────────────────
// 실제 반도체 FAB의 OHT 트랙처럼 모든 레일이 단방향이다.
//   · 가로 레일: 짝수 행 → 오른쪽, 홀수 행 → 왼쪽
//   · 세로 레일: 짝수 열 → 아래, 홀수 열 → 위
// 이 교차 단방향 구조는 (1) 그래프가 강결합(모든 노드 상호 도달)이면서
// (2) 같은 엣지의 역방향이 존재하지 않아 정면충돌·교착(2-cycle)이 구조적으로 불가능하다.
// 3대 이상이 루프를 이루는 교착은 시뮬레이터의 '동시 회전(rotation)' 해소로 처리된다.
//
// 공정 스테이션은 (짝수행,짝수열) 부분격자에 D·E·Et·C 순환 배치 → 항상 비인접,
// 균등 분산되어 다음 공정이 늘 가까이 있어 동선이 짧다. 차고지는 외곽에 분산.
function buildFabMap(): MapData {
  const cols = 20, rows = 16;
  const x0 = 60, dx = 70, y0 = 60, dy = 70;
  let nSeq = 1, eSeq = 1;
  type GN = { id: string; type: NT; x: number; y: number };

  const PROC: NT[] = ['Deposition', 'Exposure', 'Etching', 'Cleaning'];
  // 외곽에 분산 배치할 차고지 좌표 (짝수,짝수 부분격자 셀)
  const depotCells = new Set([
    '0,0', `0,${cols - 2}`, `${rows - 2},0`, `${rows - 2},${cols - 2}`,
    `0,${Math.floor(cols / 2)}`, `${rows - 2},${Math.floor(cols / 2)}`,
    `${Math.floor(rows / 2)},0`, `${Math.floor(rows / 2)},${cols - 2}`,
  ]);

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

  const edges: { id: string; fromId: string; toId: string }[] = [];
  const dir = (a: GN, b: GN) => edges.push({ id: `edge-${eSeq++}`, fromId: a.id, toId: b.id });
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // 가로: 짝수 행 → 오른쪽, 홀수 행 → 왼쪽 (단방향)
      if (c + 1 < cols) {
        if (r % 2 === 0) dir(grid[r][c], grid[r][c + 1]);
        else             dir(grid[r][c + 1], grid[r][c]);
      }
      // 세로: 짝수 열 → 아래, 홀수 열 → 위 (단방향)
      if (r + 1 < rows) {
        if (c % 2 === 0) dir(grid[r][c], grid[r + 1][c]);
        else             dir(grid[r + 1][c], grid[r][c]);
      }
    }
  }

  return { nodes: grid.flat(), edges };
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

        {/* 새로 만들기 / 자동 생성 */}
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
          <span>⚡</span> 자동 생성 {presetOpen ? '▲' : '▼'}
        </button>

        {presetOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
            {([
              { label: '소형', sub: '공정 1×4 · 13노드', fn: buildSmallMap,  color: '#58a6ff' },
              { label: '중형', sub: '공정 2×4 · 20노드', fn: buildMediumMap, color: '#ffa657' },
              { label: '대형', sub: '공정 3×4 · 30노드', fn: buildLargeMap,  color: '#bc8cff' },
              { label: '초대형 팹 ∞', sub: '단방향 · 320노드 · 100대 무한운전', fn: buildFabMap, color: '#39d353' },
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
          {connectType === 'bidirectional' ? '양쪽 방향 자동 생성' : '클릭 방향으로만 연결'}
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
