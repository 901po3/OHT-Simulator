import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimRunStore } from '../store/simRunStore';
import { useEditorStore } from '../store/editorStore';
import { ALGORITHM_META, ALGORITHM_ORDER } from '../core/pathfinding/algorithms';
import { SimMapCanvas } from '../components/simulation/SimMapCanvas';
import { StallReportModal } from '../components/simulation/StallReportModal';
const PROCESS_CYCLE = ['증착', '노광', '식각', '세정'];

const STATE_COLOR: Record<string, string> = {
  Idle:       '#8b949e',
  Moving:     '#58a6ff',
  Waiting:    '#d29922',
  Processing: '#3fb950',
};

// 처리량 스파크라인 (작은 라인 차트)
function Sparkline({ data, color, height = 44 }: { data: number[]; color: string; height?: number }) {
  const w = 210, h = height, pad = 3;
  if (data.length < 2) {
    return (
      <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#444c56' }}>
        데이터 수집 중…
      </div>
    );
  }
  const max = Math.max(...data, 0.0001);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (data.length - 1);
  const xy = (v: number, i: number) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  };
  const pts = data.map((v, i) => xy(v, i).join(',')).join(' ');
  const [lx, ly] = xy(data[data.length - 1], data.length - 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, display: 'block' }}>
      <polygon points={`${pad},${h - pad} ${pts} ${lx},${h - pad}`} fill={color} opacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={lx} cy={ly} r={2.6} fill={color} />
    </svg>
  );
}

export function SimulationPage() {
  const navigate = useNavigate();
  const { nodes, edges } = useEditorStore();
  const {
    running, algorithmId, agentCount, speed, stats, autoDispatch, agents,
    stallReport, overcrowdWarning, efficiency,
    selectedAgentId, throughputHistory, agentRateHistory,
    startSim, stopSim, setAlgorithm, setAgentCount, setSpeed, setAutoDispatch, tick,
    setSelectedAgent, dismissStallReport,
  } = useSimRunStore();

  const rafRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTRef = useRef<number | null>(null);

  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleWarning, setVisibleWarning] = useState<string | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ w: width, h: height });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 경고 메시지 유지: 새 경고가 들어오면 3초 이상 표시 후 사라짐
  useEffect(() => {
    if (overcrowdWarning) {
      setVisibleWarning(overcrowdWarning);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = setTimeout(() => {
        setVisibleWarning(null);
      }, 3000); // 3초 유지
    }
    return () => {
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [overcrowdWarning]);

  useEffect(() => {
    if (!running) { lastTRef.current = null; return; }
    const INTERVAL_MS = 33; // ~30fps
    rafRef.current = setInterval(() => {
      const now = performance.now();
      const dt = lastTRef.current != null
        ? Math.min((now - lastTRef.current) / 1000, 0.05)
        : 0;
      lastTRef.current = now;
      tick(dt);
    }, INTERVAL_MS);
    return () => { if (rafRef.current != null) clearInterval(rafRef.current); };
  }, [running, tick]);

  useEffect(() => {
    if (!running && nodes.length >= 2) {
      startSim(nodes, edges);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportSimulation = async () => {
    const simulationExporter = await import('../core/export/simulationExporter');
    const xml = simulationExporter.generateSimulationXML(
      [...nodes.values?.() ?? nodes],
      edges,
      efficiency?.optimalRobotCount ?? agentCount,
      efficiency?.avgMoveDist ?? 0,
      efficiency?.congestionLevel ?? 0,
      nodes.filter(n => {
        const type = n.type as string;
        return ['증착', '노광', '식각', '세정'].includes(type);
      }).length,
      algorithmId,
    );
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oht-simulation-${new Date().toISOString().slice(0, 10)}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      {/* ── 과잉 투입 경고 배너 ──
          min-height: 36px로 고정 → 화면이 밀리지 않음
          visibleWarning 상태로 3초 이상 유지 → 메시지 안 팍 사라짐 */}
      <div
        aria-live="polite"
        style={{
          background: visibleWarning ? '#d297001a' : 'transparent',
          borderBottom: visibleWarning ? '1px solid #d2970066' : '1px solid transparent',
          color: '#d29700', fontSize: 11,
          minHeight: 36,  // 항상 36px 높이 유지 (화면 밀림 방지)
          opacity: visibleWarning ? 1 : 0,
          padding: '6px 14px',
          overflow: 'hidden',
          transition: 'opacity 0.3s ease, background 0.3s ease, border-color 0.3s ease',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          pointerEvents: visibleWarning ? 'auto' : 'none',
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
        <span>{visibleWarning ?? ''}</span>
      </div>

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

        {/* 알고리즘 선택 — 성능 순서 */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ALGORITHM_ORDER.map(id => {
            const meta = ALGORITHM_META[id];
            const active = algorithmId === id;
            const isCaution = meta.status === 'caution';
            return (
              <button
                key={id}
                onClick={() => setAlgorithm(id)}
                title={meta.desc}
                style={{
                  padding: '4px 9px', borderRadius: 6, fontSize: 11,
                  border: `1px solid ${active ? meta.color : isCaution ? '#f8514966' : '#30363d'}`,
                  background: active ? meta.color + '18' : isCaution ? '#f8514911' : '#21262d',
                  color: active ? meta.color : isCaution ? '#f85149aa' : '#8b949e',
                  cursor: 'pointer', fontWeight: active ? 700 : 400,
                  transition: 'all 0.15s', opacity: isCaution ? 0.8 : 1,
                }}
              >
                {meta.label}{isCaution ? ' ⚠' : ''}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 22, background: '#30363d', flexShrink: 0 }} />

        {/* 최대 로봇 수 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#8b949e' }}>최대 로봇</span>
          <input type="range" min={1} max={100} step={1} value={agentCount}
            onChange={e => setAgentCount(parseInt(e.target.value))}
            style={{ width: 90, accentColor: '#58a6ff' }} />
          <span style={{ fontSize: 12, color: '#58a6ff', fontWeight: 700, minWidth: 40 }}>{agentCount}대</span>
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
          <button
            onClick={handleExportSimulation}
            title="현재 시뮬레이션 데이터를 Unity용 XML로 내보내기"
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #30363d',
              background: '#21262d', color: '#8b949e', fontWeight: 600, fontSize: 12,
              cursor: 'pointer',
            }}
          >
            💾 XML 내보내기
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
                차고지 {depotCount}개 · 현재 {agents.length}대 운행
              </div>
            )}
          </div>

          {/* 처리량 차트 — 전체 평균 또는 선택 로봇 */}
          {(() => {
            const sel = selectedAgentId ? agents.find(a => a.id === selectedAgentId) : null;
            let series: number[];
            let curr: number, avg: number, title: string, color: string;
            if (sel) {
              const hist = (agentRateHistory.get(sel.id) ?? []).map(s => s.rate);
              series = hist;
              curr = hist.length ? hist[hist.length - 1] : 0;
              const lifeMin = Math.max(stats.elapsedSec - sel.spawnElapsed, 0.001) / 60;
              avg = sel.totalJobs / lifeMin;
              title = `${sel.id} 처리량`;
              color = sel.color;
            } else {
              series = throughputHistory.map(s => s.perRobot);
              curr = series.length ? series[series.length - 1] : 0;
              avg = series.length ? series.reduce((s, v) => s + v, 0) / series.length : 0;
              title = '로봇당 평균 처리량';
              color = '#3fb950';
            }
            return (
              <div style={{ padding: 12, borderBottom: '1px solid #30363d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {title}
                  </span>
                  {sel && (
                    <button onClick={() => setSelectedAgent(null)}
                      style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                        border: '1px solid #30363d', background: '#21262d', color: '#8b949e' }}>
                      전체 평균 보기
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'monospace' }}>{curr.toFixed(1)}</span>
                    <span style={{ fontSize: 10, color: '#8b949e' }}> 작업/분 · 현재</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#8b949e', fontFamily: 'monospace' }}>{avg.toFixed(1)}</span>
                    <span style={{ fontSize: 10, color: '#8b949e' }}> 평균</span>
                  </div>
                </div>
                <Sparkline data={series} color={color} />
                <div style={{ fontSize: 9, color: '#444c56', marginTop: 4 }}>
                  {sel ? '로봇 1대의 분당 완료 공정 추이' : '로봇을 클릭하면 개별 추이를 봅니다 · 로봇당(전체÷대수) 분당 공정'}
                </div>
              </div>
            );
          })()}

          {/* 효율 대시보드 */}
          {efficiency && (
            <div style={{ padding: 12, borderBottom: '1px solid #30363d' }}>
              <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                🎯 맵 효율 & 최적화
              </div>
              {/* 핵심 3가지 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                {[
                  { label: '공정 가동률', val: efficiency.procUtil, unit: '%', color: efficiency.procUtil > 60 ? '#3fb950' : '#d29922' },
                  { label: '평균 대기', val: efficiency.avgWaitSec, unit: '초', color: efficiency.avgWaitSec < 3 ? '#3fb950' : '#f85149' },
                  { label: '유휴 비율', val: efficiency.idleRatio, unit: '%', color: efficiency.idleRatio < 40 ? '#3fb950' : '#d29922' },
                ].map(m => (
                  <div key={m.label} style={{ background: '#21262d', borderRadius: 6, padding: '6px 4px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: 'monospace' }}>{m.val}</div>
                    <div style={{ fontSize: 8, color: '#8b949e' }}>{m.label} {m.unit}</div>
                  </div>
                ))}
              </div>
              {/* 맵 점수 */}
              <div style={{ fontSize: 9, background: '#21262d', borderRadius: 6, padding: '8px', marginBottom: 10, lineHeight: 1.6 }}>
                <div style={{ color: '#58a6ff', fontWeight: 700, marginBottom: 4 }}>📊 맵 점수</div>
                <div style={{ color: '#8b949e' }}>
                  이동거리: {efficiency.avgMoveDist} 칸/로봇<br/>
                  혼잡도: {efficiency.congestionLevel}%<br/>
                  {efficiency.bottleneckNodeId && <span>병목: {efficiency.bottleneckNodeId} ({efficiency.bottleneckCongestion}%)</span>}
                </div>
              </div>
              {/* 최적 로봇 수 */}
              {efficiency.optimalRobotCount > 0 && (
                <div style={{ fontSize: 9, background: '#3fb950' + '22', borderRadius: 6, padding: '6px', marginBottom: 10, borderLeft: '2px solid #3fb950', color: '#3fb950', fontWeight: 600 }}>
                  ✓ 처리량 꺾이는 지점: {efficiency.optimalRobotCount}대 투입
                </div>
              )}
              {/* 최적 투입 판정 */}
              <div style={{
                fontSize: 10, lineHeight: 1.5, padding: '6px 8px', borderRadius: 6,
                background: efficiency.optimalHint.includes('최적') ? '#238636' + '22' : efficiency.optimalHint.includes('과잉') ? '#f85149' + '22' : '#21262d',
                color: efficiency.optimalHint.includes('최적') ? '#3fb950' : efficiency.optimalHint.includes('과잉') ? '#f85149' : '#d29922',
              }}>
                {efficiency.optimalHint}
              </div>
            </div>
          )}

          {/* OHT 상태 목록 */}
          <div style={{ padding: '12px 12px 0', overflowY: 'auto', flex: 1 }}>
            <div style={{ fontSize: 10, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              OHT 상태 <span style={{ color: '#444c56', fontWeight: 400, textTransform: 'none' }}>· 클릭해 처리량 보기</span>
            </div>
            {agents.length === 0 && (
              <div style={{ fontSize: 12, color: '#444c56' }}>
                {running ? '로봇 스폰 대기 중...' : '시뮬레이션 시작 후 표시'}
              </div>
            )}
            {agents.map(a => {
              const isSel = a.id === selectedAgentId;
              const lifeMin = Math.max(stats.elapsedSec - a.spawnElapsed, 0.001) / 60;
              const avgRate = a.totalJobs / lifeMin;
              return (
                <div key={a.id}
                  onClick={() => setSelectedAgent(isSel ? null : a.id)}
                  style={{
                    background: isSel ? a.color + '1f' : '#21262d',
                    border: `1px solid ${isSel ? a.color : '#30363d'}`,
                    borderLeft: `3px solid ${a.color}`,
                    borderRadius: 6,
                    padding: '7px 9px',
                    marginBottom: 5,
                    cursor: 'pointer',
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
                    이동 {a.totalDistance}칸 · 완료 {a.totalJobs}건 · <span style={{ color: a.color }}>{avgRate.toFixed(1)}/분</span>
                  </div>
                </div>
              );
            })}
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
