import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useEditorStore } from '../../store/editorStore';
import { exportToXml, downloadXml } from '../../core/export/xmlSerializer';

// 공정 페이지는 마지막 순서 — 개인 참고용 부록 성격
const NAV_ITEMS = [
  { to: '/editor',     label: '맵 에디터' },
  { to: '/algorithm', label: '길찾기 알고리즘 선택 과정' },
  { to: '/process',   label: '나를 위한 반도체 공정 요약' },
];

const iconBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '5px 10px',
  background: '#21262d',
  border: '1px solid #30363d',
  borderRadius: 6,
  color: disabled ? '#444c56' : '#e6edf3',
  fontSize: 14,
  cursor: disabled ? 'default' : 'pointer',
  lineHeight: 1,
  transition: 'color 0.15s',
});

export function TopBar() {
  const { nodes, edges, undo, redo, canUndo, canRedo } = useEditorStore();
  const location = useLocation();
  const isEditor = location.pathname === '/editor';

  const handleExport = () => {
    const xml = exportToXml(nodes, edges);
    downloadXml(xml);
  };

  return (
    <header style={{
      height: 48,
      background: '#161b22',
      borderBottom: '1px solid #30363d',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 4,
      flexShrink: 0,
    }}>
      {/* 로고 */}
      <span style={{ fontSize: 15, fontWeight: 700, color: '#58a6ff', marginRight: 16, letterSpacing: -0.5 }}>
        OHT System
      </span>

      {/* 탭 네비게이션 */}
      {NAV_ITEMS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            padding: '6px 14px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? '#e6edf3' : '#8b949e',
            background: isActive ? '#21262d' : 'transparent',
            transition: 'all 0.15s',
          })}
        >
          {label}
        </NavLink>
      ))}

      {/* 우측 액션 */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>

        {/* Undo / Redo — 에디터 페이지에서만 표시 */}
        {isEditor && (
          <>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="실행 취소 (Ctrl+Z)"
              style={iconBtn(!canUndo)}
            >
              ↩
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="다시 실행 (Ctrl+Y)"
              style={iconBtn(!canRedo)}
            >
              ↪
            </button>
            <div style={{ width: 1, height: 20, background: '#30363d', margin: '0 4px' }} />
          </>
        )}

        {isEditor && (
          <button
            onClick={handleExport}
            title="맵을 XML로 내보내기 (Unity 호환)"
            style={{
              padding: '5px 14px',
              background: '#21262d',
              border: '1px solid #30363d',
              borderRadius: 6,
              color: '#8b949e',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ↓ XML 내보내기
          </button>
        )}
      </div>
    </header>
  );
}
