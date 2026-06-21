import React, { useState } from 'react';

/* ══════════════════════════════════════════
   데이터 정의
══════════════════════════════════════════ */

const ALGO_DATA = [
  {
    name: 'Standard A*',
    quality: 60, deadlock: 15, cpu: 90, throughput: 55,
    verdict: '기준선', verdictColor: '#8b949e',
    period: '1단계',
    failReason: '멀티 에이전트 충돌 미처리 — 교착 발생 시 전체 정지',
  },
  {
    name: 'Dijkstra',
    quality: 70, deadlock: 18, cpu: 85, throughput: 60,
    verdict: '기준선', verdictColor: '#8b949e',
    period: '1단계',
    failReason: '방향 그래프에서 A*보다 느림. 충돌 해결 없음.',
  },
  {
    name: 'Greedy BFS',
    quality: 38, deadlock: 10, cpu: 97, throughput: 42,
    verdict: '품질 부족', verdictColor: '#f85149',
    period: '2단계',
    failReason: '비최적 경로로 병목 심화. 로봇이 같은 구간에 집중.',
  },
  {
    name: 'Stochastic A*',
    quality: 55, deadlock: 20, cpu: 88, throughput: 50,
    verdict: '불안정', verdictColor: '#d29922',
    period: '2단계',
    failReason: '노이즈로 경로가 매 틱 변경. 진동(oscillation) 현상으로 처리량 급감.',
  },
  {
    name: 'CBS (full)',
    quality: 99, deadlock: 99, cpu: 3, throughput: 99,
    verdict: '실시간 불가', verdictColor: '#f85149',
    period: '3단계',
    failReason: '로봇 10대 기준 프레임당 500ms+ 소요. 지수적 복잡도로 포기.',
  },
  {
    name: 'Priority A*',
    quality: 80, deadlock: 75, cpu: 87, throughput: 82,
    verdict: '채택 ✓', verdictColor: '#3fb950',
    period: '4단계',
    failReason: null,
  },
  {
    name: 'CBS-Lite',
    quality: 88, deadlock: 85, cpu: 72, throughput: 86,
    verdict: '보조 채택', verdictColor: '#58a6ff',
    period: '4단계',
    failReason: null,
  },
];

const TIMELINE = [
  {
    phase: '1단계',
    color: '#8b949e',
    title: '단일 에이전트 알고리즘 이식',
    period: '초기',
    algos: ['Standard A*', 'Dijkstra'],
    desc: `Unity NavMesh를 사용하던 구조에서 레일 그래프 기반으로 전환하며 Standard A*와 Dijkstra를 직접 구현했습니다.
단일 로봇 환경에서는 정상 동작했지만, 멀티 에이전트 시나리오에서 두 알고리즘 모두 상대방 로봇을 인식하지 못해 같은 노드를 동시에 점유하는 충돌이 발생했습니다.
특히 교차로(Intersection) 노드에서 두 로봇이 서로를 기다리는 데드락이 분당 수십 회 발생했고, 시뮬레이션이 전체 정지하는 문제가 반복되었습니다.`,
    result: '실패 — 멀티 에이전트 충돌 처리 없음',
    resultColor: '#f85149',
  },
  {
    phase: '2단계',
    color: '#d29922',
    title: '경량 알고리즘 실험 (Greedy BFS · Stochastic A*)',
    period: '초기~중기',
    algos: ['Greedy BFS', 'Stochastic A*'],
    desc: `CPU 부하를 줄이려고 Greedy BFS를 도입했습니다. 목표 방향만 보고 빠르게 이동하지만, 최적 경로를 보장하지 않아 특정 구간에 로봇이 집중되는 병목이 심화되었습니다.

다음으로 경로 다양성을 위해 Stochastic A*를 시도했습니다. 엣지 가중치에 ±30% 노이즈를 추가하면 로봇들이 서로 다른 경로를 자연스럽게 선택할 것이라 기대했습니다. 그러나 매 틱마다 경로가 재계산되면서 로봇이 진행 방향을 계속 바꾸는 진동(Oscillation) 현상이 발생했고, 같은 구간을 앞뒤로 반복 이동하며 처리량이 오히려 감소했습니다.

이 시점에서 경로 진동을 막기 위해 PathCommitmentSteps(=5) 개념을 도입했습니다 — 5노드 이동 후에만 경로를 재계산하는 방식으로 진동을 억제했습니다.`,
    result: '실패 — 병목 심화 또는 진동 현상 / PathCommitmentSteps 보조 도입',
    resultColor: '#d29922',
  },
  {
    phase: '3단계',
    color: '#f85149',
    title: 'CBS 전체 구현 시도 → 실시간 포기',
    period: '중기',
    algos: ['CBS (full)'],
    desc: `Conflict-Based Search(CBS)는 다중 에이전트 경로 탐색(MAPF)의 이론적 최적 해법입니다. 고수준 탐색에서 충돌을 감지하고, 제약(Constraint)을 추가해 저수준 A*를 재탐색하는 2계층 구조입니다.

Unity C#으로 CBS를 완전히 구현했습니다. 로봇 2~4대 환경에서는 완벽한 충돌 회피와 최적 경로를 보여주었습니다. 그러나 로봇 수가 늘어날수록 Constraint Tree의 분기가 지수적으로 증가했습니다.

실제 팹 규모의 로봇 10대 환경에서 측정한 결과, 단일 경로 계획 호출에 평균 480~650ms가 소요되어 60fps 게임 루프(16ms/frame)와 완전히 양립 불가능했습니다. 프레임 드롭이 아닌 사실상 슬라이드쇼 수준으로 시뮬레이션이 멈추었습니다.

CBS는 오프라인 계획이나 소규모 정적 환경에는 최적이지만, 실시간 동적 환경에서는 사용 불가라는 결론을 내렸습니다.`,
    result: '실패 — 10대 기준 프레임당 500ms+ 소요. 실시간 포기.',
    resultColor: '#f85149',
  },
  {
    phase: '4단계',
    color: '#3fb950',
    title: 'Priority A* + WHCA* 하이브리드 설계 → 채택',
    period: '현재',
    algos: ['Priority A*', 'CBS-Lite'],
    desc: `CBS가 너무 비싸고 Standard A*가 너무 무지하다면, 중간 지점이 필요했습니다. 해답은 혼잡도 맵을 에이전트들이 공유하고, 시공간 예약 테이블로 충돌을 사전 차단하는 것이었습니다.

Priority A*는 각 에이전트가 A* 탐색 시 다른 에이전트들의 현재 위치를 혼잡도(0~1)로 받아 엣지 비용에 ×2.5 패널티를 부여합니다. 비싼 전역 탐색 없이도 로봇들이 자연스럽게 분산됩니다.

여기에 WHCA*(Windowed Hierarchical Cooperative A*)를 보조 기법으로 추가했습니다. 각 에이전트가 앞으로 이동할 12스텝을 예약 테이블에 등록하고, 후순위 에이전트가 예약된 노드를 만나면 비용 ×8 페널티로 자동 우회하는 방식입니다.

결과적으로 60fps를 유지하면서 데드락 발생률을 95% 이상 감소시키는 데 성공했습니다.`,
    result: '채택 — 60fps 실시간 유지 + 교착 95% 감소',
    resultColor: '#3fb950',
  },
];

const TECHNIQUES = [
  {
    icon: '🔺',
    title: 'Binary Heap 오픈 리스트',
    category: '성능 최적화',
    color: '#58a6ff',
    problem: '기존 A*가 오픈 리스트를 List<Node>로 관리 → 최솟값 탐색이 O(V) 선형 탐색',
    solution: 'BinaryHeap<Node> 로 교체 → 삽입·추출 모두 O(log V)',
    result: '전체 A* 실행 속도 ×35 향상. 가장 단순하고 임팩트가 컸던 최적화.',
    code: 'O(V²) → O(E log V)',
  },
  {
    icon: '⏭',
    title: 'PathCommitmentSteps = 5',
    category: '진동 방지',
    color: '#ffa657',
    problem: 'Stochastic A* 실험 중 발견: 매 틱 경로 재계산 → 로봇이 방향을 계속 바꾸는 진동 현상',
    solution: '5노드 이동 후에만 경로 재계산. 중간 단계는 기존 경로를 그대로 따름.',
    result: 'A* 호출 횟수 80% 감소. 진동 현상 완전 제거. CPU 부하 큰 폭 감소.',
    code: 'pathStep % 5 == 0 → Recalculate()',
  },
  {
    icon: '🗺',
    title: 'WHCA* 시공간 예약 테이블',
    category: '충돌 사전 차단',
    color: '#3fb950',
    problem: '혼잡도 맵만으로는 정확한 미래 위치를 알 수 없어 충돌이 잔존',
    solution: '각 에이전트가 다음 12스텝 경로를 예약 테이블(node_id → timestep)에 등록. 후순위 에이전트가 예약된 노드를 만나면 비용 ×8 패널티 적용.',
    result: '충돌 사전 차단율 대폭 향상. 데드락 에스컬레이션 빈도 감소.',
    code: 'Window=12, Penalty=×8',
  },
  {
    icon: '🚦',
    title: 'TrafficController 혼잡도 맵',
    category: '협력 최적화',
    color: '#bc8cff',
    problem: '에이전트들이 독립적으로 A*를 실행 → 같은 경로에 집중 → 병목',
    solution: '중앙 TrafficController가 모든 에이전트 위치를 집계해 혼잡도(0~1)를 계산. 매 틱 Priority A* 호출 시 공유.',
    result: '에이전트 간 암묵적 협력 달성. 경로 분산 효과로 처리량 증가.',
    code: 'congestion[nodeId] = agentCount / totalAgents',
  },
  {
    icon: '♻',
    title: 'GC 스파이크 제거 (컬렉션 재사용)',
    category: '성능 최적화',
    color: '#39d353',
    problem: '매 프레임 A* 호출 시 new List<>(), new Dictionary<>() 생성 → Unity GC 스파이크 → 주기적 프레임 드롭',
    solution: 'A* 내부 컬렉션을 클래스 멤버로 선언 후 Clear()만 호출하여 재사용.',
    result: 'GC Alloc 제거. GC 스파이크 완전 해소. 프레임 시간 안정화.',
    code: '_openList.Clear() vs new List<>()',
  },
  {
    icon: '🔗',
    title: 'inEdge 캐시 (역방향 엣지 O(1))',
    category: '성능 최적화',
    color: '#d29922',
    problem: '데드락 감지용 Wait-for 그래프에서 역방향 엣지 탐색 시 AllNodes O(V) 순회 반복',
    solution: 'Start() 시점에 inEdge[node] = List<RailEdge> 역방향 캐시 빌드. O(V) → O(1) 조회.',
    result: 'V 비례 비용 완전 제거. 데드락 감지 루프 성능 향상.',
    code: 'inEdges[to] = new List<>() at Start()',
  },
  {
    icon: '🔍',
    title: 'Wait-for 그래프 + DFS 사이클 감지 (L1)',
    category: '데드락 감지',
    color: '#e8912d',
    problem: '여러 로봇이 서로를 기다리는 순환 의존 → 자동으로 풀리지 않는 영구 교착',
    solution: '매 프레임 Wait-for 그래프(agent → waiting_for_agent)를 구성하고 DFS로 사이클 탐지. 사이클 감지 즉시 최저 우선순위 에이전트에 ForceReroute 발령.',
    result: 'L1에서 교착의 약 70%가 즉시 해소. 이후 단계 부하 감소.',
    code: 'DFS cycle detection, O(V+E)',
  },
  {
    icon: '🚗',
    title: 'TryPhysicalYield (L3 — 물리적 공간 양보)',
    category: '데드락 해소',
    color: '#f85149',
    problem: 'L2 ForceReroute도 실패하는 완전 포위 상황 (모든 인접 노드에 다른 에이전트)',
    solution: 'Blocked 12초 초과 시 인접 빈 노드로 1칸 강제 이동하여 물리적 공간을 확보. 이동 완료 후 경로 재계산.',
    result: '완전 포위 데드락 해소. 최후 수단 전 물리적 교착 해소 성공률 향상.',
    code: 'MoveToFirstEmpty(adjacents)',
  },
];

const DEADLOCK_LEVELS = [
  { level: 'L1', time: '즉시 (매 프레임)',  color: '#3fb950', title: 'DFS 사이클 감지 + ForceReroute',    desc: 'Wait-for 그래프에서 순환 의존을 DFS로 탐지. 사이클에 포함된 최저 우선순위 OHT에게 즉시 우회 경로(ForceReroute) 발령. 약 70%의 교착이 이 단계에서 해소.' },
  { level: 'L2', time: '5초 초과',          color: '#d29922', title: 'WaitingAtIntersection → ForceReroute', desc: '교차로에서 5초 이상 정지한 에이전트를 Blocked 상태로 전환. TrafficController가 매 프레임 대안 경로를 재계산해 적용.' },
  { level: 'L3.5', time: '5초+ (완전 포위)', color: '#ffa657', title: '협력 청소 (신규 추가)',              desc: '인접 4방향 모두 정지 로봇으로 포위된 특수 패턴 감지 시 인접 차단 로봇들에게 TryPhysicalYield 요청을 브로드캐스트. L3 전 선제 해소 시도.' },
  { level: 'L3', time: '12초 초과',          color: '#e8912d', title: 'TryPhysicalYield — 1칸 강제 이동',  desc: 'Blocked 상태 12초 초과 → 인접 빈 노드로 1칸 강제 이동하여 물리적 공간 확보. 이동 후 경로 재계산.' },
  { level: 'L4', time: '최후 수단',          color: '#f85149', title: 'AbandonJob → Idle 복귀',            desc: '인접 노드 전부 다른 에이전트로 막힘 → 현재 작업 포기 후 Idle 상태로 복귀. 다음 Dispatcher 틱에서 재배정.' },
];

/* ══════════════════════════════════════════
   서브 컴포넌트
══════════════════════════════════════════ */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #30363d' }}>
      {children}
    </h2>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: '20px 24px', ...style }}>
      {children}
    </div>
  );
}

/* 개발 타임라인 */
function DevelopmentTimeline() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div style={{ position: 'relative', paddingLeft: 32 }}>
      <div style={{
        position: 'absolute', left: 12, top: 8, bottom: 8, width: 2,
        background: 'linear-gradient(to bottom, #8b949e, #d29922, #f85149, #3fb950)',
        borderRadius: 2,
      }} />
      {TIMELINE.map((t, i) => (
        <div key={i} style={{ position: 'relative', marginBottom: i < TIMELINE.length - 1 ? 32 : 0 }}>
          {/* 타임라인 점 */}
          <div style={{
            position: 'absolute', left: -26, top: 12,
            width: 14, height: 14, borderRadius: '50%',
            border: `2px solid ${t.color}`,
            background: t.color + '33',
          }} />

          {/* 카드 */}
          <div
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{
              background: '#161b22',
              border: `1px solid ${expanded === i ? t.color + '88' : '#30363d'}`,
              borderLeft: `3px solid ${t.color}`,
              borderRadius: 10,
              padding: '14px 18px',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                    background: t.color + '22', color: t.color, letterSpacing: 0.5,
                  }}>{t.phase}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3' }}>{t.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {t.algos.map(a => (
                    <span key={a} style={{
                      fontSize: 11, padding: '1px 7px', borderRadius: 10,
                      background: '#21262d', color: '#8b949e', border: '1px solid #30363d',
                    }}>{a}</span>
                  ))}
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: t.resultColor,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ fontSize: 9 }}>▶</span> {t.result}
                </div>
              </div>
              <span style={{ color: '#444c56', fontSize: 16, marginLeft: 12, flexShrink: 0 }}>
                {expanded === i ? '▲' : '▼'}
              </span>
            </div>

            {expanded === i && (
              <div style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid #30363d',
                fontSize: 13,
                color: '#8b949e',
                lineHeight: 1.85,
                whiteSpace: 'pre-line',
              }}>
                {t.desc}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* 알고리즘 성능 비교 차트 */
function AlgoCompareChart() {
  const METRICS: Array<{ key: keyof typeof ALGO_DATA[0]; label: string; color: string }> = [
    { key: 'quality',    label: '경로 품질',     color: '#58a6ff' },
    { key: 'deadlock',   label: '교착 회피',     color: '#3fb950' },
    { key: 'throughput', label: '처리량',        color: '#ffa657' },
    { key: 'cpu',        label: 'CPU 효율',      color: '#f85149' },
  ];

  return (
    <div>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        {METRICS.map(m => (
          <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: m.color }} />
            <span style={{ fontSize: 11, color: '#8b949e' }}>{m.label}</span>
          </div>
        ))}
      </div>

      {/* 알고리즘별 멀티 막대 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ALGO_DATA.map(algo => (
          <div key={algo.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{
                fontSize: 12, fontWeight: algo.verdict === '채택 ✓' ? 700 : 400,
                color: algo.verdict === '채택 ✓' ? '#3fb950' : algo.verdict === '보조 채택' ? '#58a6ff' : '#e6edf3',
              }}>{algo.name}</span>
              <span style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 4,
                background: algo.verdictColor + '22', color: algo.verdictColor,
                fontWeight: 600,
              }}>{algo.verdict}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {METRICS.map(m => {
                const val = algo[m.key] as number;
                return (
                  <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#444c56', width: 52, textAlign: 'right', flexShrink: 0 }}>{m.label}</span>
                    <div style={{ flex: 1, height: 7, background: '#21262d', borderRadius: 4 }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${val}%`,
                        background: m.color,
                        opacity: algo.verdict.includes('실패') || algo.verdict === '품질 부족' || algo.verdict === '불안정' || algo.verdict === '실시간 불가' ? 0.35 : 0.9,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#8b949e', width: 28, textAlign: 'right', fontFamily: 'monospace' }}>{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 보조 기법 카드 */
function TechniqueCard({ t }: { t: typeof TECHNIQUES[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: '#161b22',
        border: `1px solid ${open ? t.color + '66' : '#30363d'}`,
        borderLeft: `3px solid ${t.color}`,
        borderRadius: 10,
        padding: '12px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{t.title}</div>
            <div style={{ fontSize: 10, color: t.color, marginTop: 2 }}>{t.category}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <code style={{ fontSize: 11, color: '#8b949e', background: '#21262d', padding: '2px 7px', borderRadius: 4 }}>{t.code}</code>
          <span style={{ color: '#444c56', fontSize: 14 }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #21262d', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#f85149', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>문제</div>
            <p style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.7, margin: 0 }}>{t.problem}</p>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#58a6ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>해결</div>
            <p style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.7, margin: 0 }}>{t.solution}</p>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#3fb950', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>결과</div>
            <p style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.7, margin: 0 }}>{t.result}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* CBS 심화 설명 */
function CbsDeepDive() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 개념 설명 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#21262d', borderLeft: '3px solid #f85149', borderRadius: 8, padding: 16 }}>
          <div style={{ fontWeight: 700, color: '#f85149', fontSize: 13, marginBottom: 12 }}>CBS 전체 구현의 문제</div>
          {[
            '고수준: Constraint Tree(CT) 분기 탐색',
            '저수준: 제약 조건부 A* 재탐색',
            '로봇 n대 기준 최악 O(2ⁿ) 복잡도',
            '10대 → 평균 480~650ms/호출',
            '❌ 실시간 60fps(16ms) 불가',
          ].map(s => (
            <div key={s} style={{ fontSize: 12, color: '#8b949e', padding: '3px 0' }}>• {s}</div>
          ))}
        </div>
        <div style={{ background: '#21262d', borderLeft: '3px solid #58a6ff', borderRadius: 8, padding: 16 }}>
          <div style={{ fontWeight: 700, color: '#58a6ff', fontSize: 13, marginBottom: 12 }}>CBS-Lite (현재 채택)</div>
          {[
            '고수준 CT 분기 없이 1패스로 근사',
            '예약 테이블로 충돌 노드 비용 ×8',
            'O(E log V) — A*와 동일 복잡도 유지',
            '이론 최적성 포기, 실용성 확보',
            '✓ 실시간 환경 동작 가능',
          ].map(s => (
            <div key={s} style={{ fontSize: 12, color: '#8b949e', padding: '3px 0' }}>• {s}</div>
          ))}
        </div>
      </div>

      {/* CBS 동작 원리 시각화 */}
      <div style={{ background: '#21262d', borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', marginBottom: 12 }}>CBS 2계층 구조 (개념)</div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#8b949e', lineHeight: 2 }}>
          <div style={{ color: '#58a6ff' }}>【고수준 — Constraint Tree (CT)】</div>
          <div>  root: 제약 없음</div>
          <div>  ├─ 충돌 감지: Agent1@NodeA t=3, Agent2@NodeA t=3</div>
          <div>  ├─ 분기 1: Agent1에게 제약 추가 → A* 재탐색</div>
          <div>  └─ 분기 2: Agent2에게 제약 추가 → A* 재탐색</div>
          <div style={{ marginTop: 8, color: '#f85149' }}>→ n대 시 분기 최악 2ⁿ개 → 폭발</div>
          <div style={{ marginTop: 8, color: '#3fb950' }}>【CBS-Lite — 1패스 근사】</div>
          <div>  예약 테이블: {'{'} NodeA: t=3, NodeB: t=5, ... {'}'}</div>
          <div>  A* 탐색 중 예약 노드 발견 → cost ×8 패널티</div>
          <div>  → CT 분기 없이 단일 탐색으로 충돌 회피</div>
        </div>
      </div>
    </div>
  );
}

/* Priority A* + WHCA* 현재 채택 알고리즘 */
function CurrentAlgoExplain() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.85, marginBottom: 16 }}>
          <strong style={{ color: '#3fb950' }}>Priority A*</strong>는 각 에이전트가 독립적으로 A*를 실행하되,
          다른 에이전트들의 현재 위치를 <strong style={{ color: '#e6edf3' }}>혼잡도 맵</strong>으로 공유받아
          붐비는 노드의 엣지 비용을 ×2.5 높이는 방식입니다. 전역 탐색 없이도 에이전트들이 자연스럽게
          분산된 경로를 선택하게 됩니다.
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, background: '#21262d', borderRadius: 8, padding: 14, color: '#8b949e', lineHeight: 1.8 }}>
          <span style={{ color: '#58a6ff' }}>// Priority A* 핵심 코드</span><br />
          <span style={{ color: '#e6edf3' }}>edgeCost</span> = baseWeight × (<span style={{ color: '#3fb950' }}>1</span> + congestion[node] × <span style={{ color: '#ffa657' }}>2.5</span>)<br />
          <span style={{ color: '#58a6ff' }}>// congestion: 0(비어있음) ~ 1(가득 참)</span>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.85, marginBottom: 16 }}>
          <strong style={{ color: '#58a6ff' }}>WHCA* (Windowed Hierarchical Cooperative A*)</strong>는
          시공간 예약 테이블을 통해 미래 충돌을 사전에 차단합니다. 각 에이전트가 앞으로 이동할
          <strong style={{ color: '#e6edf3' }}> 12스텝</strong>을 예약하고, 후순위 에이전트가 해당 셀을
          탐색할 때 <strong style={{ color: '#ffa657' }}>×8 비용 페널티</strong>를 받아 자동으로 우회합니다.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: '예약 윈도우', value: '12 스텝', color: '#58a6ff' },
            { label: '예약 페널티', value: '× 8 비용', color: '#ffa657' },
            { label: 'A* 호출 감소', value: '80%', color: '#3fb950' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center', background: '#21262d', borderRadius: 8, padding: '16px 12px' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', marginBottom: 12 }}>두 기법의 시너지</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { step: '① 혼잡도 맵 수집', desc: 'TrafficController가 모든 에이전트 위치 집계 → 노드별 혼잡도(0~1) 계산', color: '#58a6ff' },
            { step: '② Priority A* 경로 탐색', desc: '혼잡 노드 회피하며 초기 경로 결정. 에이전트 간 자연스러운 분산 발생', color: '#3fb950' },
            { step: '③ WHCA* 예약 등록', desc: '확정된 경로의 12스텝을 시공간 테이블에 등록', color: '#ffa657' },
            { step: '④ 후순위 에이전트 우회', desc: '다음 에이전트 탐색 시 예약 노드 ×8 페널티 적용 → 자동 우회', color: '#bc8cff' },
            { step: '⑤ PathCommitmentSteps', desc: '5스텝마다 재탐색 — 잦은 재계산 없이 변화에 적응', color: '#e8912d' },
          ].map(({ step, desc, color }) => (
            <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 140, flexShrink: 0 }}>{step}</span>
              <span style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>{desc}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* 데드락 에스컬레이션 */
function DeadlockTimeline() {
  return (
    <div style={{ position: 'relative', paddingLeft: 24 }}>
      <div style={{
        position: 'absolute', left: 8, top: 6, bottom: 6, width: 2,
        background: 'linear-gradient(to bottom, #3fb950, #d29922, #ffa657, #e8912d, #f85149)',
        borderRadius: 2,
      }} />
      {DEADLOCK_LEVELS.map((lv, i) => (
        <div key={lv.level} style={{ position: 'relative', paddingLeft: 20, marginBottom: i < DEADLOCK_LEVELS.length - 1 ? 24 : 0 }}>
          <div style={{
            position: 'absolute', left: -4, top: 4, width: 12, height: 12, borderRadius: '50%',
            border: `2px solid ${lv.color}`, background: lv.color + '44',
          }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: lv.color, minWidth: 36 }}>{lv.level}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>{lv.title}</span>
            <span style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>{lv.time}</span>
          </div>
          <p style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.7, margin: 0 }}>{lv.desc}</p>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   메인 페이지
══════════════════════════════════════════ */
export function AlgorithmPage() {
  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 48 }}>

      {/* § 개요 */}
      <section>
        <SectionTitle>§ 1. 프로젝트 목표와 알고리즘 선택 기준</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.85, marginBottom: 16 }}>
            반도체 팹의 천장 레일에서 다수의 OHT(Overhead Hoist Transport) 로봇이 웨이퍼를 운반합니다.
            이 환경에서 알고리즘은 동시에 세 가지 조건을 만족해야 했습니다.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: '📦', title: '처리량 최대화', desc: '단위 시간당 완료 작업 수 최대화. 로봇 간 협력 필수.', color: '#3fb950' },
              { icon: '🔒', title: '교착 완전 제거', desc: '데드락 발생 시 전체 시스템 정지. 허용 불가.', color: '#f85149' },
              { icon: '⚡', title: 'CPU 부하 최소화', desc: '실시간 60fps 유지. 로봇 수에 무관하게 일정한 연산량.', color: '#58a6ff' },
            ].map(({ icon, title, desc, color }) => (
              <div key={title} style={{ background: '#21262d', borderRadius: 8, padding: '16px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
          <blockquote style={{ borderLeft: '3px solid #58a6ff', paddingLeft: 16, margin: '16px 0 0', fontSize: 13, color: '#8b949e', lineHeight: 1.8 }}>
            총 6가지 알고리즘을 직접 구현·비교하는 과정에서,
            CBS가 이론상 완벽하지만 실시간 환경에서 주기적 프레임 드롭을 유발한다는 사실을 발견했습니다.
            이를 해결하기 위해 <strong style={{ color: '#58a6ff' }}>Priority A* + WHCA* 하이브리드</strong>를 설계했습니다.
          </blockquote>
        </Card>
      </section>

      {/* § 개발 타임라인 */}
      <section>
        <SectionTitle>§ 2. 알고리즘 개발 타임라인 — 시도와 실패의 기록</SectionTitle>
        <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.7, marginBottom: 20 }}>
          각 단계를 클릭하면 당시 시도한 내용과 실패 원인을 확인할 수 있습니다.
        </p>
        <DevelopmentTimeline />
      </section>

      {/* § 알고리즘 비교 차트 */}
      <section>
        <SectionTitle>§ 3. 전체 알고리즘 성능 비교</SectionTitle>
        <Card>
          <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 20, lineHeight: 1.6 }}>
            직접 구현·테스트한 7개 알고리즘의 4가지 지표. 반투명 막대는 채택되지 않은 알고리즘.
          </p>
          <AlgoCompareChart />
        </Card>
      </section>

      {/* § CBS 심화 */}
      <section>
        <SectionTitle>§ 4. CBS — 이론 최적과 실시간의 충돌</SectionTitle>
        <CbsDeepDive />
      </section>

      {/* § 현재 채택 알고리즘 */}
      <section>
        <SectionTitle>§ 5. 현재 채택 — Priority A* + WHCA* 하이브리드</SectionTitle>
        <CurrentAlgoExplain />
      </section>

      {/* § 보조 기법 */}
      <section>
        <SectionTitle>§ 6. 알고리즘을 살린 보조 기법들</SectionTitle>
        <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.7, marginBottom: 20 }}>
          알고리즘 자체만큼이나 성능과 안정성에 기여한 엔지니어링 기법들입니다. 클릭하면 문제·해결·결과를 확인할 수 있습니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TECHNIQUES.map(t => <TechniqueCard key={t.title} t={t} />)}
        </div>
      </section>

      {/* § 데드락 에스컬레이션 */}
      <section>
        <SectionTitle>§ 7. 데드락 에스컬레이션 L1 ~ L4</SectionTitle>
        <Card>
          <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.8, marginBottom: 20 }}>
            알고리즘으로 사전 차단하지 못한 교착은 반응형 에스컬레이션으로 해소합니다.
            대부분 L1~L2에서 종결되며, L3.5는 완전 포위 패턴 전용 신규 단계입니다.
          </p>
          <DeadlockTimeline />
        </Card>
      </section>

      <div style={{ fontSize: 11, color: '#444c56', textAlign: 'center', paddingBottom: 24 }}>
        알고리즘 개선이 이루어질 때마다 이 페이지가 업데이트됩니다
      </div>
    </div>
  );
}
