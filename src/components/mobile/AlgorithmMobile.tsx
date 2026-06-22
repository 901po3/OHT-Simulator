const ALGO_DATA = [
  { name: 'Standard A*',     period: '1단계', q: 60, d: 15, cpu: 90, t: 55, verdict: '기준선',     color: '#8b949e', why: '멀티 에이전트 충돌 미처리 — 교착 발생 시 전체 정지' },
  { name: 'Dijkstra',        period: '1단계', q: 70, d: 18, cpu: 85, t: 60, verdict: '기준선',     color: '#8b949e', why: '방향 그래프에서 A*보다 느림. 충돌 해결 없음.' },
  { name: 'Greedy BFS',      period: '2단계', q: 38, d: 10, cpu: 97, t: 42, verdict: '품질 부족',  color: '#f85149', why: '비최적 경로로 병목 심화. 로봇이 같은 구간에 집중.' },
  { name: 'Stochastic A*',   period: '3단계', q: 72, d: 30, cpu: 82, t: 68, verdict: '실험적',    color: '#d29922', why: '경로 분산은 되지만 비결정성으로 디버깅 어려움.' },
  { name: 'Priority A*',     period: '4단계', q: 88, d: 65, cpu: 80, t: 84, verdict: '실전 채택', color: '#3fb950', why: '우선순위 기반으로 교착을 크게 줄이며 안정적 성능.' },
  { name: 'CBS-Lite',        period: '4단계', q: 92, d: 78, cpu: 70, t: 88, verdict: '실전 채택', color: '#3fb950', why: '예약 테이블로 충돌을 사전에 회피. 처리량 최고.' },
  { name: 'Full CBS',        period: '향후',  q: 96, d: 90, cpu: 35, t: 92, verdict: '미채택',    color: '#8b949e', why: '품질 최고지만 CPU 비용이 너무 큼 — 실시간성 손실.' },
];

const BAR_COLOR = {
  q:   '#58a6ff',
  d:   '#3fb950',
  cpu: '#d29922',
  t:   '#a371f7',
};

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8b949e', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: '#e6edf3' }}>{value}</span>
      </div>
      <div style={{ height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

export function AlgorithmMobile() {
  return (
    <div style={{ padding: 14, color: '#e6edf3' }}>
      <h2 style={{ margin: '4px 0 6px', fontSize: 18, color: '#58a6ff' }}>길찾기 알고리즘 선택 과정</h2>
      <p style={{ fontSize: 13, color: '#8b949e', margin: '0 0 14px', lineHeight: 1.5 }}>
        7개 알고리즘을 순차적으로 검토한 결과 Priority A* 와 CBS-Lite 를 실전 채택했습니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ALGO_DATA.map((a, i) => (
          <div key={i} style={{
            background: '#161b22',
            border: `1px solid ${a.color}55`,
            borderLeft: `4px solid ${a.color}`,
            borderRadius: 10,
            padding: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{a.name}</span>
              <span style={{ fontSize: 11, color: '#8b949e' }}>{a.period}</span>
            </div>
            <div style={{
              display: 'inline-block', padding: '2px 8px', borderRadius: 4,
              background: `${a.color}22`, color: a.color, fontSize: 11, fontWeight: 600, marginBottom: 10,
            }}>
              {a.verdict}
            </div>

            <Bar label="품질"     value={a.q}   color={BAR_COLOR.q} />
            <Bar label="교착 회피" value={a.d}   color={BAR_COLOR.d} />
            <Bar label="CPU 효율" value={a.cpu} color={BAR_COLOR.cpu} />
            <Bar label="처리량"   value={a.t}   color={BAR_COLOR.t} />

            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: '1px solid #30363d',
              fontSize: 12, color: '#9ca3af', lineHeight: 1.5,
            }}>
              {a.why}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
