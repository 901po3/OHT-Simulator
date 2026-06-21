import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NodePalette } from './NodePalette';
import { EditorCanvas } from './EditorCanvas';
import { NodeTooltip } from './NodeTooltip';
import { useEditorStore } from '../../store/editorStore';
import { useSimRunStore } from '../../store/simRunStore';

export function MapEditor({ width, height }: { width: number; height: number }) {
  const { cancelConnect, nodes, edges, undo, redo } = useEditorStore();
  const { stopSim } = useSimRunStore();
  const navigate = useNavigate();

  // 키보드 단축키
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    // S-2 fix: input/textarea에서는 단축키 비활성화
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape') cancelConnect();
    else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
  }, [cancelConnect, undo, redo]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const handleSimulationClick = () => {
    stopSim();
    navigate('/simulation');
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
      <NodePalette />

      <EditorCanvas width={width} height={height} />

      {/* 우하단 툴바 */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        {/* 노드/레일 통계 */}
        <div style={{
          background: '#161b22cc',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 12,
          color: '#8b949e',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'none',
        }}>
          노드 {nodes.length}개 · 레일 {edges.length}개
        </div>

        {/* 시뮬레이션 페이지로 이동 */}
        <button
          onClick={handleSimulationClick}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #30363d',
            background: '#21262d',
            color: '#e6edf3',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ▶ 시뮬레이션
        </button>
      </div>

      <NodeTooltip />
    </div>
  );
}
