import React from 'react';
import type { StallReport, StallCause } from '../../store/simRunStore';

interface Props {
  report: StallReport;
  onDismiss: () => void;
  onGoToEditor: () => void;
}

const CAUSE_ICON: Record<StallCause, string> = {
  deadlock:          '🔒',
  'no-path':         '🔗',
  'no-process-nodes':'🏭',
  'all-idle':        '💤',
};

const CAUSE_LABEL: Record<StallCause, string> = {
  deadlock:          '데드락 감지',
  'no-path':         '경로 없음',
  'no-process-nodes':'공정 노드 없음',
  'all-idle':        '모든 에이전트 Idle',
};

const SEVERITY_COLOR: Record<StallCause, string> = {
  deadlock:          '#f85149',
  'no-path':         '#ffa657',
  'no-process-nodes':'#bc8cff',
  'all-idle':        '#8b949e',
};

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 8px',
  background: '#0d1117',
  borderRadius: 4,
  marginBottom: 3,
  fontSize: 11,
};

export function StallReportModal({ report, onDismiss, onGoToEditor }: Props) {
  const color = SEVERITY_COLOR[report.cause];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(1,4,9,0.80)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: 580, maxHeight: '85vh',
        background: '#161b22',
        border: `1px solid ${color}55`,
        borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: `0 0 40px ${color}22`,
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #30363d',
          background: color + '11',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 22 }}>{CAUSE_ICON[report.cause]}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color }}>
              시뮬레이션 정지 감지 — {CAUSE_LABEL[report.cause]}
            </div>
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
              {report.detectedAt}초 경과 시점 · 5초간 공정 진전 없음
            </div>
          </div>
          <button
            onClick={onDismiss}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: '#8b949e', cursor: 'pointer', fontSize: 18, lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* 스크롤 본문 */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 원인 설명 */}
          <section>
            <SectionTitle>원인 분석</SectionTitle>
            <p style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.7, margin: 0 }}>
              {report.causeDetail}
            </p>
          </section>

          {/* 에이전트 상태 */}
          {report.affectedAgents.length > 0 && (
            <section>
              <SectionTitle>에이전트 상태 ({report.affectedAgents.length}대)</SectionTitle>
              <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {report.affectedAgents.map(a => (
                  <div key={a.id} style={row}>
                    <span style={{ color: '#e6edf3', fontWeight: 600, minWidth: 60 }}>{a.id}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 5px', borderRadius: 3,
                      background: stateColor(a.state) + '22', color: stateColor(a.state),
                    }}>{a.state}</span>
                    {a.blockedSec > 0 && (
                      <span style={{ color: '#f85149', fontSize: 10 }}>차단 {a.blockedSec}s</span>
                    )}
                    <span style={{ color: '#8b949e', fontSize: 10 }}>→ {a.nextProcessStage}</span>
                    <span style={{ color: '#444c56', fontSize: 10 }}>완료 {a.totalJobs}건</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 혼잡도 핫스팟 */}
          {report.congestionHotspots.length > 0 && (
            <section>
              <SectionTitle>혼잡도 핫스팟</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {report.congestionHotspots.map(h => (
                  <div key={h.nodeId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      height: 6, flex: h.value, maxWidth: 160,
                      background: `rgba(248,81,73,${0.4 + h.value * 0.6})`,
                      borderRadius: 3,
                    }} />
                    <span style={{ fontSize: 10, color: '#8b949e', minWidth: 80 }}>
                      {h.nodeType} ({(h.value * 100).toFixed(0)}%)
                    </span>
                    <span style={{ fontSize: 9, color: '#444c56', fontFamily: 'monospace' }}>{h.nodeId}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 개선 방향 */}
          <section>
            <SectionTitle>개선 방향</SectionTitle>
            <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {report.suggestions.map((s, i) => (
                <li key={i} style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.6 }}>{s}</li>
              ))}
            </ul>
          </section>

          {/* 맵 에디터 권장 */}
          {report.mapAdvice && (
            <section style={{
              background: '#1f6feb11',
              border: '1px solid #1f6feb33',
              borderRadius: 7, padding: '10px 14px',
            }}>
              <div style={{ fontSize: 11, color: '#58a6ff', fontWeight: 600, marginBottom: 4 }}>
                📍 맵 에디터 수정 권장
              </div>
              <div style={{ fontSize: 12, color: '#c9d1d9' }}>{report.mapAdvice}</div>
            </section>
          )}
        </div>

        {/* 하단 액션 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #30363d',
          display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0,
        }}>
          <button
            onClick={onDismiss}
            style={{
              padding: '7px 16px', borderRadius: 6,
              border: '1px solid #30363d', background: '#21262d',
              color: '#e6edf3', cursor: 'pointer', fontSize: 12,
            }}
          >
            계속 시뮬레이션
          </button>
          {report.mapAdvice && (
            <button
              onClick={onGoToEditor}
              style={{
                padding: '7px 16px', borderRadius: 6,
                border: 'none', background: '#1f6feb',
                color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              맵 에디터로 이동
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, color: '#8b949e', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

function stateColor(state: string) {
  if (state === 'Moving')     return '#58a6ff';
  if (state === 'Processing') return '#3fb950';
  return '#8b949e';
}
