import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/editor',         label: '맵 에디터' },
  { to: '/simulation',     label: '시뮬레이션' },
  { to: '/algorithm',      label: '길찾기 알고리즘' },
  { to: '/map-design',     label: '맵 설계 고려사항' },
  { to: '/considerations', label: '실제 변수들' },
  { to: '/architecture',   label: '코드 구조' },
  { to: '/process',        label: '반도체 공정 요약' },
];

const BG = '#0d1117';
const BAR = '#161b22';
const BORDER = '#30363d';
const TEXT = '#e6edf3';

export function MobileLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const current = NAV_ITEMS.find(n => location.pathname.startsWith(n.to));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: BG,
      color: TEXT,
      fontFamily: "'Segoe UI', sans-serif",
      fontSize: 15,
    }}>
      {/* Top bar */}
      <header style={{
        height: 52,
        background: BAR,
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 10,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button
          aria-label="메뉴 열기"
          onClick={() => setOpen(true)}
          style={{
            width: 44, height: 44,
            background: 'transparent',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            color: TEXT,
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ☰
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#58a6ff', letterSpacing: -0.5 }}>
          OHT System
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#8b949e', textAlign: 'right' }}>
          {current?.label ?? ''}
        </span>
      </header>

      {/* Drawer */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 20,
            }}
          />
          <nav style={{
            position: 'fixed',
            top: 0, left: 0, bottom: 0,
            width: 'min(78vw, 300px)',
            background: BAR,
            borderRight: `1px solid ${BORDER}`,
            zIndex: 21,
            padding: 14,
            display: 'flex', flexDirection: 'column', gap: 6,
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: '#58a6ff',
              padding: '8px 8px 14px', borderBottom: `1px solid ${BORDER}`, marginBottom: 6,
            }}>
              OHT System
            </div>
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                style={({ isActive }) => ({
                  padding: '14px 12px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: 15,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? TEXT : '#8b949e',
                  background: isActive ? '#21262d' : 'transparent',
                  minHeight: 44,
                  display: 'flex', alignItems: 'center',
                })}
              >
                {label}
              </NavLink>
            ))}
            <a
              href="https://youtu.be/0Y_7qUAT7oc"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{
                marginTop: 'auto',
                padding: '14px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 15,
                color: '#f0707b',
                background: '#21262d',
                minHeight: 44,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              ▶ 데모 영상
            </a>
            <div style={{
              fontSize: 11, color: '#6e7681', padding: 8, lineHeight: 1.5,
            }}>
              상세 화면(길찾기 알고리즘 과정 등)은 PC에서 가장 온전하게 보입니다.
            </div>
          </nav>
        </>
      )}

      {/* Page body */}
      <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  );
}
