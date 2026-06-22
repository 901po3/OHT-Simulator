import { useEffect, useRef, useState } from 'react';
import { useSimRunStore } from '../../store/simRunStore';
import { useEditorStore } from '../../store/editorStore';
import { ALGORITHM_META, ALGORITHM_ORDER } from '../../core/pathfinding/algorithms';
import { SimMapCanvas } from '../simulation/SimMapCanvas';

export function SimulationMobile() {
  const { nodes, edges } = useEditorStore();
  const {
    running, algorithmId, agentCount, speed, stats, agents,
    startSim, stopSim, tick,
  } = useSimRunStore();

  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTRef = useRef<number | null>(null);
  const [w, setW] = useState(window.innerWidth);

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  // Auto-start once on mount
  useEffect(() => {
    if (!running && nodes.length >= 2) startSim(nodes, edges);
    return () => { stopSim(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) { lastTRef.current = null; return; }
    rafRef.current = setInterval(() => {
      const now = performance.now();
      const dt = lastTRef.current != null
        ? Math.min((now - lastTRef.current) / 1000, 0.05)
        : 0;
      lastTRef.current = now;
      tick(dt);
    }, 33);
    return () => { if (rafRef.current != null) clearInterval(rafRef.current); };
  }, [running, tick]);

  const canvasW = Math.max(280, w - 24);
  const canvasH = Math.round(canvasW * 0.85);
  const algo = ALGORITHM_META[algorithmId];

  return (
    <div style={{ padding: 14, color: '#e6edf3' }}>
      <h2 style={{ margin: '4px 0 6px', fontSize: 18, color: '#58a6ff' }}>시뮬레이션 (보기 전용)</h2>
      <p style={{ fontSize: 13, color: '#8b949e', margin: '0 0 12px', lineHeight: 1.5 }}>
        현재 맵에서 길찾기 알고리즘이 어떻게 동작하는지 확인할 수 있습니다.
      </p>

      <div style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: 10,
        padding: 6, marginBottom: 12, overflow: 'hidden',
      }}>
        {nodes.length < 2 ? (
          <div style={{
            height: canvasH, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6e7681', fontSize: 13, textAlign: 'center', padding: 20,
          }}>
            맵이 비어있습니다. PC에서 맵을 먼저 생성하세요.
          </div>
        ) : (
          <SimMapCanvas width={canvasW} height={canvasH} />
        )}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12,
      }}>
        <Stat label="알고리즘" value={algo?.label ?? algorithmId} />
        <Stat label="로봇 수" value={String(agentCount)} />
        <Stat label="속도" value={`${speed.toFixed(1)}x`} />
        <Stat label="완료 작업" value={String(stats?.completedJobs ?? 0)} />
        <Stat label="이동중" value={String(agents?.filter(a => a.state === 'Moving').length ?? 0)} />
        <Stat label="대기중" value={String(agents?.filter(a => a.state === 'Waiting').length ?? 0)} />
      </div>

      <div style={{
        background: '#1f2a37', border: '1px solid #2f4660', borderRadius: 10,
        padding: 12, fontSize: 13, color: '#9bb4d4', lineHeight: 1.5,
      }}>
        💡 알고리즘 변경·로봇 수 조절은 PC 화면에서 사용할 수 있습니다.
        모바일은 현재 설정으로 자동 실행됩니다.
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#6e7681' }}>
        총 알고리즘 {ALGORITHM_ORDER.length}종 · 노드 {nodes.length} · 엣지 {edges.length}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}
