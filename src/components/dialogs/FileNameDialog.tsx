import React, { useState, useRef, useEffect } from 'react';

interface FileNameDialogProps {
  isOpen: boolean;
  onConfirm: (fileName: string) => void;
  onCancel: () => void;
}

const dialogOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  background: 'rgba(1,4,9,0.80)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(4px)',
};

const dialogBox: React.CSSProperties = {
  width: 420,
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 0 40px rgba(88,166,255,0.15)',
};

const headerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #30363d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#e6edf3',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#8b949e',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: 0,
};

const contentStyle: React.CSSProperties = {
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: '#0d1117',
  border: '1px solid #30363d',
  borderRadius: 6,
  color: '#e6edf3',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#8b949e',
  lineHeight: 1.5,
};

const footerStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderTop: '1px solid #30363d',
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  flexShrink: 0,
};

const buttonStyle: React.CSSProperties = {
  padding: '7px 16px',
  borderRadius: 6,
  border: '1px solid #30363d',
  background: '#21262d',
  color: '#e6edf3',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  transition: 'all 0.15s',
};

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  border: 'none',
  background: '#1f6feb',
  color: '#fff',
  fontWeight: 600,
};

export function FileNameDialog({ isOpen, onConfirm, onCancel }: FileNameDialogProps) {
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFileName('');
      // 약간의 지연으로 포커스 설정 (렌더링 완료 후)
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    const finalName = fileName.trim() || 'map';
    // 파일명에서 특수 문자 제거 및 공백을 하이픈으로 변환
    const sanitized = finalName
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    onConfirm(sanitized);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={dialogOverlay}>
      <div style={dialogBox}>
        {/* 헤더 */}
        <div style={headerStyle}>
          <div style={titleStyle}>XML 파일명 지정</div>
          <button
            onClick={onCancel}
            style={closeButtonStyle}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div style={contentStyle}>
          <div>
            <input
              ref={inputRef}
              type="text"
              placeholder="예: my-custom-map"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onKeyPress={handleKeyPress}
              style={{
                ...inputStyle,
                borderColor: fileName ? '#30363d' : '#30363d',
              }}
            />
          </div>

          <div style={hintStyle}>
            <div style={{ marginBottom: 4 }}>💡 기본값: map.xml</div>
            <div style={{ fontSize: 11, color: '#444c56' }}>
              특수 문자는 자동으로 제거되고, 공백은 하이픈으로 변환됩니다.
            </div>
          </div>

          <div style={{
            background: '#1f6feb11',
            border: '1px solid #1f6feb33',
            borderRadius: 6,
            padding: '10px 12px',
            fontSize: 11,
            color: '#58a6ff',
            lineHeight: 1.5,
          }}>
            <strong>📁 저장 경로:</strong>
            <div style={{ fontFamily: 'monospace', fontSize: 10, marginTop: 4, color: '#c9d1d9' }}>
              Assets/StreamingAssets/Maps/
              <span style={{ color: '#58a6ff' }}>{fileName.trim() || 'map'}</span>.xml
            </div>
          </div>
        </div>

        {/* 하단 액션 */}
        <div style={footerStyle}>
          <button
            onClick={onCancel}
            style={buttonStyle}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            style={primaryButtonStyle}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
