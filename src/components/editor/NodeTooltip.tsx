import { useEditorStore } from '../../store/editorStore';

export function NodeTooltip() {
  const { selectedNodeId, tooltipPos, removeNode, startConnect, clearSelection, nodes } = useEditorStore();

  if (!selectedNodeId || !tooltipPos) return null;
  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return null;

  const btnStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '7px 12px',
    background: 'transparent',
    border: 'none',
    color: '#e6edf3',
    fontSize: 13,
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: 4,
    transition: 'background 0.1s',
  };

  return (
    <>
      {/* 배경 클릭 시 닫기 */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
        onClick={clearSelection}
      />
      <div style={{
        position: 'fixed',
        left: tooltipPos.x + 12,
        top: tooltipPos.y - 10,
        zIndex: 100,
        background: '#1c2128',
        border: '1px solid #30363d',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        padding: '6px 0',
        minWidth: 140,
        pointerEvents: 'auto',
      }}>
        <div style={{ padding: '6px 12px 8px', borderBottom: '1px solid #30363d', fontSize: 11, color: '#8b949e' }}>
          {node.id}
        </div>

        <button
          style={btnStyle}
          onMouseEnter={e => (e.currentTarget.style.background = '#21262d')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => {
            // 이동 모드: 툴팁 닫고 노드를 드래그 가능 상태로 (Konva가 처리)
            clearSelection();
          }}
        >
          ✥ 노드 이동
        </button>

        <button
          style={{ ...btnStyle, color: '#3fb950' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#21262d')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => startConnect(selectedNodeId)}
        >
          ⟶ 노드 연결
        </button>

        <div style={{ height: 1, background: '#30363d', margin: '4px 0' }} />

        <button
          style={{ ...btnStyle, color: '#f85149' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#21262d')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => removeNode(selectedNodeId)}
        >
          ✕ 노드 제거
        </button>
      </div>
    </>
  );
}

import React from 'react';
