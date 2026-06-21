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

export function NodePalette() {
  const { nodes, edges, connectType, setConnectType, saveToFile, loadFromData } = useEditorStore();
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
