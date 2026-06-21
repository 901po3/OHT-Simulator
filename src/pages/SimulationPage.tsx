import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimRunStore } from '../store/simRunStore';
import { useEditorStore } from '../store/editorStore';
import { ALGORITHM_META, type AlgorithmId } from '../core/pathfinding/algorithms';
import { SimMapCanvas } from '../components/simulation/SimMapCanvas';
import { StallReportModal } from '../components/simulation/StallReportModal';

const ALGO_IDS: AlgorithmId[] = ['standard', 'dijkstra', 'greedy', 'stochastic', 'priority', 'cbs'];
const PROCESS_CYCLE = ['증착', '노광', '식각', '세정'];

const STATE_COLOR: Record<string, string> = {
  Idle:       '#8b949e',
  Moving:     '#58a6ff',
  Processing: '#3fb950',
};

export function SimulationPage() {
  const navigate = useNavigate();
  const { nodes, edges } = useEditorStore();
  const {
    running, algorithmId, agentCount, speed, stats, autoDispatch, agents,
    stallReport, overcrowdWarning,
    startSim, stopSim, setAlgorithm, setAgentCount, setSpeed, setAutoDispatch, tick,
    dismissStallReport,
  } = useSimRunStore();

  const rafRef   = useRef<number>(0);
  const lastTRef = useRef<number | null>(null);

  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ w: width, h: height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!running) { lastTRef.current = null; return; }
    const loop = (time: number) => {
      const dt = lastTRef.current != null
        ? Math.min((time - lastTRef.current) / 1000, 0.05)
        : 0;
      lastTRef.current = time;
      tick(dt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, tick]);

  useEffect(() => {
    if (!running && nodes.length >= 2) {
      startSim(nodes, edges);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = () => {
    stopSim();
    navigate('/editor');
  };

  const depotCount = nodes.filter(n => n.type === 'Depot').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {stallReport && (
        <StallReportModal
          report={stallReport}
          onDismiss={dismissStallReport}
          onGoToEditor={() => { stopSim(); navigate('/editor'); }}
        />
      )}

      {/* ── 과잉 투입 경고 배너 ── */}
      {overcrowdWarning && (
        <div style={{
          background: '#d297001a', borderBottom: '1px solid #d2970066',
          padding: '6px 14px', fontSize: 11, color: '#d29700',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span>{overcrowdWarning}</span>
        </div>
      )}

      {/* ── 상단 컨트롤 바 ── */}
      <div style={{
        background: '#161b22',
        borderBottom: '1px solid #30363d',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <button
          onClick={handleBack}
          style={{
            padding: '6px 12px', borderRadius: 6,
            border: '1px solid #30363d', background: '#21262d',
            color: '#e6edf3', cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          }}
        >
          ← 에디터
        </button>

        <div style={{ width: 1, height: 22, background: '#30363d', flexShrink: 0 }} />

        {/* 알고리즘 선택 */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ALGO_IDS.map(id => {
            const meta = ALGORITHM_META[id];
            const active = algorithmId === id;
            return (
              <button
                key={id}
                onClick={() => setAlgorithm(id)}
                style={{
                  padding: '4px 9px', borderRadius: 6, fontSize: 11,
                  border: `1px solid ${active ? meta.color : '#30363d'}`,
                  background: active ? meta.color + '18' : '#21262d',
                  color: active ? meta.color : '#8b949e',
                  cursor: 'pointer', fontWeight: active ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 22, background: '#30363d', flexShrink: 0 }} />

        {/* 최대 로봇 수 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#8b949e' }}>최대 로봇</span>
          <input type="range" min={1} max={12} step={1} value={agentCount}
            onChange={e => setAgentCount(parseInt(e.target.value))}
            style={{ width: 70, accentColor: '#58a6ff' }} />
          <span style={{ fontSize: 12, color: '#58a6ff', fontWeight: 700, minWidth: 32 }}>{agentCount}대</span>
        </div>

        {/* 속도 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#8b949e' }}>속도</span>
          <input type="range" min={0.5} max={8} step={0.5} value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            style={{ width: 70, accentColor: '#ffa657' }} />
          <span style={{ fontSize: 12, color: '#ffa657', fontWeight: 700, minWidth: 44 }}>{speed.toFixed(1)} n/s</span>
        </div>

        {/* 자동 최적화 */}
        <div
          onClick={() => setAutoDispatch(!autoDispatch)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${autoDispatch ? '#3fb95066' : '#30363d'}`,
            background: autoDispatch ? '#23863611' : '#21262d',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: autoDispatch ? '#3fb950' : '#8b949e', fontWeight: 600 }}>⚡ 자동 최적화</span>
          <div style={{ width: 26, height: 14, borderRadius: 7, background: autoDispatch ? '#3fb950' : '#30363d', position: 'relative', transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: 2, left: autoDispatch ? 12 : 2, width: 10, height: 10, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => running ? stopSim() : startSim(nodes, edges)}
            disabled={nodes.length < 2}
            style={{
              padding: '6px 18px', borderRadius: 6, border: 'none',
              background: running ? '#b91c1c' : '#238636',
              color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: nodes.length < 2 ? 'not-allowed' : 'pointer',
              opacity: nodes.length < 2 ? 0.5 : 1,
            }}
          >
            {running ? '⏹ 중지' : '▶ 시작'}
          </button>
        </div>
      </div>

      {/* ── 메인 ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* 캔버스 */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {canvasSize.w > 0 && (
            <SimMapCanvas width={canvasSize.w} height={canvasSize.h} />
          )}
          {nodes.length < 2 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#8b949e', fontSize: 14, pointerEvents: 'none',
            }}>
              맵 에디터에서 노드를 2개 이상 배치하세요
            </div>
          )}
        </div>

        {/* 우측 패널 */}
        <div style={{
          width: 240,
          background: '#161b22',
          borderLeft: '1px solid #30363d',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {/* 통계 */}
          <div style={{ padding: 12, borderBottom: '1px solid #30363d' }}>
            <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              실시간 성능
            </div>
            {[
              { label: '이동거리 / 초', value: running ? `${stats.distPerSec}` : '—', unit: 'n/s', color: '#58a6ff' },
              { label: '총 완료 공정',  value: `${stats.completedJobs}`,           unit: '건',  color: '#3fb950' },
              { label: '경과 시간',     value: `${stats.elapsedSec.toFixed(1)}`,   unit: 's',   color: '#8b949e' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} style={{
                background: '#21262d', borderLeft: `3px solid ${color}`,
                borderRadius: 6, padding: '7px 10px', marginBottom: 6,
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'monospace' }}>
                  {value} <span style={{ fontSize: 10, color: '#8b949e' }}>{unit}</span>
                </div>
                <div style={{ fontSize: 10, color: '#8b949e' }}>{label}</div>
              </div>
            ))}
            {depotCount > 0 && (
              <div style={{ fontSize: 10, color: '#8b949e', marginTop: 4 }}>
                차고지 {depotCount}개 · 1초당 1대 스폰 · 현재 {agents.length}대 운행
              </div>
            )}
          </div>

          {/* OHT 상태 목록 */}
          <div style={{ padding: '12px 12px 0', overflowY: 'auto', flex: 1 }}>
            <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              OHT 상태
            </div>
            {agents.length === 0 && (
              <div style={{ fontSize: 12, color: '#444c56' }}>
                {running ? '로봇 스폰 대기 중...' : '시뮬레이션 시작 후 표시'}
              </div>
            )}
            {agents.map(a => (
              <div key={a.id} style={{
                background: '#21262d',
                border: '1px solid #30363d',
                borderLeft: `3px solid ${a.color}`,
                borderRadius: 6,
                padding: '7px 9px',
                marginBottom: 5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#e6edf3', fontWeight: 600 }}>{a.id}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                    background: (STATE_COLOR[a.state] ?? '#8b949e') + '22',
                    color: STATE_COLOR[a.state] ?? '#8b949e',
                  }}>
                    {a.state}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: a.recalling ? '#f85149' : '#58a6ff', marginTop: 3 }}>
                  {a.recalling ? '↩ 차고지 귀환 중' : `다음: ${PROCESS_CYCLE[a.processStage % 4]} 공정`}
                </div>
                <div style={{ fontSize: 9, color: '#444c56', marginTop: 1 }}>
                  이동 {a.totalDistance}칸 · 완료 {a.totalJobs}건
                </div>
              </div>
            ))}
          </div>

          {/* 맵 정보 */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #30363d', fontSize: 11, color: '#8b949e' }}>
            노드 {nodes.length}개 · 레일 {edges.length}개
          </div>
        </div>
      </div>
    </div>
  );
}
