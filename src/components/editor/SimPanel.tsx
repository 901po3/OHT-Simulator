import React from 'react';
import { useSimRunStore } from '../../store/simRunStore';
import { useEditorStore } from '../../store/editorStore';
import { ALGORITHM_META, ALGORITHM_ORDER, type AlgorithmId } from '../../core/pathfinding/algorithms';

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  recommended: { label: '권장', color: '#3fb950' },
  good:        { label: '우수', color: '#58a6ff' },
  fair:        { label: '보통', color: '#8b949e' },
  caution:     { label: '주의', color: '#f85149' },
};

const sliderLabel: React.CSSProperties = {
  fontSize: 12,
  color: '#8b949e',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 4,
};

const statCard = (color: string): React.CSSProperties => ({
  background: '#21262d',
  border: `1px solid ${color}33`,
  borderLeft: `3px solid ${color}`,
  borderRadius: 8,
  padding: '10px 14px',
});

export function SimPanel({ onClose }: { onClose: () => void }) {
  const { nodes, edges } = useEditorStore();
  const {
    running, algorithmId, agentCount, speed, stats, autoDispatch,
    startSim, stopSim, setAlgorithm, setAgentCount, setSpeed, setAutoDispatch,
  } = useSimRunStore();

  const handleToggle = () => {
    if (running) stopSim();
    else startSim(nodes, edges);
  };

  return (
    <div style={{
      width: 260,
      background: '#161b22',
      borderLeft: '1px solid #30363d',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #30363d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#e6edf3' }}>시뮬레이션</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      <div style={{ padding: 16, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 실행 버튼 */}
        <button
          onClick={handleToggle}
          disabled={nodes.length < 2}
          style={{
            padding: '10px',
            borderRadius: 8,
            border: 'none',
            background: running ? '#b91c1c' : '#238636',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            cursor: nodes.length < 2 ? 'not-allowed' : 'pointer',
            opacity: nodes.length < 2 ? 0.5 : 1,
          }}
        >
          {running ? '⏹ 중지' : '▶ 시뮬레이션 시작'}
        </button>

        {nodes.length < 2 && (
          <p style={{ fontSize: 11, color: '#f85149', textAlign: 'center', margin: '-12px 0 0' }}>
            노드를 2개 이상 배치하세요
          </p>
        )}

        {/* 자동 최적화 디스패치 토글 */}
        <div style={{
          background: autoDispatch ? '#23863611' : '#21262d',
          border: `1px solid ${autoDispatch ? '#3fb95066' : '#30363d'}`,
          borderRadius: 8,
          padding: '10px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }} onClick={() => setAutoDispatch(!autoDispatch)}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: autoDispatch ? '#3fb950' : '#e6edf3' }}>
              ⚡ 자동 최적화 출하
            </div>
            <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
              {autoDispatch ? '최근접 로봇 배정 활성' : '랜덤 작업 배정 (기본)'}
            </div>
          </div>
          <div style={{
            width: 36, height: 20, borderRadius: 10,
            background: autoDispatch ? '#3fb950' : '#30363d',
            position: 'relative', transition: 'background 0.2s',
            flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 2, left: autoDispatch ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
            }} />
          </div>
        </div>

        {/* 알고리즘 선택 */}
        <div>
          <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
            길찾기 알고리즘
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ALGORITHM_ORDER.map((id, idx) => {
              const meta = ALGORITHM_META[id];
              const isSelected = algorithmId === id;
              const badge = STATUS_BADGE[meta.status];
              return (
                <button
                  key={id}
                  onClick={() => setAlgorithm(id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: `1px solid ${isSelected ? meta.color : '#30363d'}`,
                    background: isSelected ? meta.color + '18' : '#21262d',
                    color: isSelected ? meta.color : '#8b949e',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 400,
                    transition: 'all 0.15s',
                    opacity: meta.status === 'caution' ? 0.75 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#444c56', fontFamily: 'monospace' }}>#{idx + 1}</span>
                    <span>{meta.label}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 9, padding: '1px 5px',
                      borderRadius: 3, background: badge.color + '22', color: badge.color,
                      border: `1px solid ${badge.color}44`, fontWeight: 700,
                    }}>{badge.label}</span>
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.65, marginTop: 3 }}>{meta.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 슬라이더: 로봇 수 */}
        <div>
          <div style={sliderLabel}>
            <span>로봇 수</span>
            <span style={{ color: '#58a6ff', fontWeight: 700 }}>{agentCount}대</span>
          </div>
          <input type="range" min={1} max={100} step={1} value={agentCount}
            onChange={e => setAgentCount(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: '#58a6ff' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444c56', marginTop: 2 }}>
            <span>1대</span><span>100대</span>
          </div>
        </div>

        {/* 슬라이더: 이동 속도 */}
        <div>
          <div style={sliderLabel}>
            <span>이동 속도</span>
            <span style={{ color: '#ffa657', fontWeight: 700 }}>{speed.toFixed(1)} n/s</span>
          </div>
          <input type="range" min={0.5} max={6} step={0.5} value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#ffa657' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444c56', marginTop: 2 }}>
            <span>느림</span><span>빠름</span>
          </div>
        </div>

        {/* 성능 통계 */}
        {running && (
          <div>
            <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
              실시간 성능
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={statCard('#58a6ff')}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#58a6ff', fontFamily: 'monospace' }}>
                  {stats.distPerSec}
                </div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>이동거리 / 초 (nodes/s)</div>
              </div>
              <div style={statCard('#3fb950')}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#3fb950', fontFamily: 'monospace' }}>
                  {stats.completedJobs}
                </div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>총 완료 작업 (물동량)</div>
              </div>
              <div style={statCard('#8b949e')}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#8b949e', fontFamily: 'monospace' }}>
                  {stats.elapsedSec.toFixed(1)}s
                </div>
                <div style={{ fontSize: 11, color: '#8b949e' }}>경과 시간</div>
              </div>
            </div>
          </div>
        )}

        {/* 에이전트 상태 목록 */}
        {running && <AgentList />}
      </div>
    </div>
  );
}

function AgentList() {
  const { agents } = useSimRunStore();
  const STATE_COLOR: Record<string, string> = {
    Idle: '#8b949e', Moving: '#58a6ff', Waiting: '#d29922', Processing: '#3fb950', Loading: '#d29922', Unloading: '#3fb950',
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
        OHT 상태
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {agents.map(a => (
          <div key={a.id} style={{
            background: '#21262d',
            border: '1px solid #30363d',
            borderLeft: `3px solid ${a.color}`,
            borderRadius: 6,
            padding: '7px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: '#e6edf3', fontWeight: 600 }}>{a.id}</span>
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
              background: STATE_COLOR[a.state] + '22',
              color: STATE_COLOR[a.state],
            }}>
              {a.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
