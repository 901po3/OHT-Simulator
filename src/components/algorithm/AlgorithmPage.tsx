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
    desc: `레일 그래프 기반 TypeScript 시뮬레이터를 처음 구현할 때, 가장 검증된 탐색 알고리즘인 Standard A*와 Dijkstra를 직접 구현했습니다.
단일 로봇 환경에서는 정상 동작했지만, 멀티 에이전트 시나리오에서 두 알고리즘 모두 상대방 로봇을 인식하지 못해 같은 노드를 동시에 점유하는 충돌이 발생했습니다.
특히 교차로 노드에서 두 로봇이 서로를 기다리는 데드락이 분당 수십 회 발생했고, 시뮬레이션이 전체 정지하는 문제가 반복되었습니다.`,
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

TypeScript로 CBS를 완전히 구현했습니다. 로봇 2~4대 환경에서는 완벽한 충돌 회피와 최적 경로를 보여주었습니다. 그러나 로봇 수가 늘어날수록 Constraint Tree의 분기가 지수적으로 증가했습니다.

실제 팹 규모의 로봇 10대 환경에서 측정한 결과, 단일 경로 계획 호출에 평균 480~650ms가 소요되어 60fps 시뮬레이션 루프(16ms/frame)와 완전히 양립 불가능했습니다. 브라우저 메인 스레드가 블로킹되어 사실상 슬라이드쇼 수준으로 시뮬레이션이 멈추었습니다.

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

여기에 WHCA*(Windowed Hierarchical Cooperative A*)를 보조 기법으로 추가했습니다. 각 에이전트가 앞으로 이동할 8스텝(CBS_LOOKAHEAD)을 예약 테이블에 등록하고, 후순위 에이전트가 예약된 노드를 만나면 비용 ×8 페널티로 자동 우회하는 방식입니다.

결과적으로 60fps를 유지하면서 데드락 발생률을 95% 이상 감소시키는 데 성공했습니다.`,
    result: '채택 — 60fps 실시간 유지 + 교착 95% 감소',
    resultColor: '#3fb950',
  },
  {
    phase: '5단계',
    color: '#39d353',
    title: '단방향 그리드 + 예약·회전 — 100대 무한 운전',
    period: '현재 (최신)',
    algos: ['One-way Grid', 'Reservation', 'Cycle Rotation'],
    desc: `Priority A* + WHCA* 하이브리드로 교착을 95% 줄였지만, 로봇을 수십 대로 늘리자 남은 5%가 다시 시스템을 멈췄습니다. 원인을 추적한 결과 근본 문제는 경로탐색 알고리즘이 아니라 두 가지 구조적 결함이었습니다.

(1) 양방향 레일 — 두 로봇이 같은 구간을 반대로 진입하면 정면충돌(2-cycle 교착)이 필연적으로 발생합니다. (2) "점유 시 대기" 규칙 — A가 B를, B가 C를, C가 A를 기다리는 순환 의존이 생기면 누구도 스스로 빠져나오지 못합니다.

해법은 더 똑똑한 알고리즘이 아니라 맵 구조와 코디네이션 레이어에 있었습니다. 실제 반도체 FAB의 OHT 트랙처럼 모든 레일을 단방향(one-way)으로 만들면(가로·세로 교차 일방통행) 그래프는 여전히 강결합(모든 노드 상호 도달)이면서 역방향 엣지가 사라져 정면충돌이 구조적으로 불가능해집니다. 남는 교착은 3대 이상이 루프를 이루는 경우뿐인데, 이는 '사이클 회전(rotation)' — 루프 전원을 같은 틱에 동시에 한 칸 전진 — 으로 무조건 해소됩니다. 각자의 목표 칸이 동시에 비워지므로 회전은 항상 성공합니다.

이로써 영구 교착이 수학적으로 불가능해졌습니다. 100대·속도 5에서 2분 이상 무정지로 약 118 nodes/s 처리량을 안정적으로 유지하는 것을 검증했습니다.`,
    result: '채택 — 100대 무한 운전, 영구 교착 0건 (구조적 제거)',
    resultColor: '#39d353',
  },
];

const TECHNIQUES = [
  {
    icon: '🔺',
    title: 'allNodes 캐시 — 매 틱 재탐색 제거',
    category: '성능 최적화',
    color: '#58a6ff',
    problem: '시뮬레이션 틱마다 그래프 전체를 순회해 allNodes 배열을 재생성 → 에이전트 수×틱 수만큼 O(V) 탐색 반복',
    solution: 'startSim 시점에 allNodes를 Zustand 상태로 캐시, 이후 틱에서는 참조만 사용. 그래프가 변경되지 않으므로 항상 유효.',
    result: '틱당 노드 탐색 비용 완전 제거. 에이전트 10대 기준 틱당 N×V 연산 → O(1) 참조.',
    code: 'allNodes: store state (not recomputed)',
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
    title: 'WHCA* 시공간 예약 테이블 (= CBS-Lite)',
    category: '충돌 사전 차단',
    color: '#3fb950',
    problem: '혼잡도 맵만으로는 정확한 미래 위치를 알 수 없어 충돌이 잔존',
    solution: '각 에이전트가 다음 8스텝(CBS_LOOKAHEAD) 경로를 예약 테이블(node_id → timestep)에 등록. 후순위 에이전트가 예약된 노드를 만나면 비용 ×8 패널티 적용.',
    result: '충돌 사전 차단율 대폭 향상. 데드락 에스컬레이션 빈도 감소.',
    code: 'Window=8, Penalty=×8',
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
    title: 'CBS 예약 테이블 — 매 틱 초기화',
    category: '상태 정확성',
    color: '#39d353',
    problem: '예약 테이블을 틱 간 누적하면 이전 틱의 예약이 쌓여 모든 노드가 예약 상태가 됨 → 에이전트가 이동 불가 상태로 수렴',
    solution: '매 틱 시작 시 new Map()으로 새 예약 테이블 생성. 해당 틱의 에이전트 위치만 등록.',
    result: '예약 누적 버그 완전 제거. 에이전트들이 수 십 틱 후에도 이동 경로를 정상적으로 계획.',
    code: 'const newReservations = new Map() each tick',
  },
  {
    icon: '🔗',
    title: '에이전트 객체 불변성 — 얕은 복사 버그',
    category: '상태 정확성',
    color: '#d29922',
    problem: '[...agents]로 배열을 복사해도 배열 내 객체는 같은 참조를 공유 → 한 틱의 상태 변경이 다음 틱에 누적돼 에이전트가 몇 번 이동 후 영구 정지',
    solution: 'agents.map(a => ({ ...a }))로 매 틱마다 얕은 객체 복사. 틱 간 상태 격리.',
    result: '"로봇이 몇 번 움직이다 멈추는" 근본 버그 해소. 수백 틱 후에도 정상 이동.',
    code: 'agents.map(a => ({ ...a })) each tick',
  },
  {
    icon: '🔍',
    title: 'blockedSec 타이머 — 교착 자동 탈출',
    category: '데드락 해소',
    color: '#e8912d',
    problem: '서로를 기다리는 순환 의존(A→B→A)이 발생하면 어느 에이전트도 스스로 빠져나오지 못해 영구 교착',
    solution: '에이전트마다 blockedSec 타이머를 유지. Moving 상태에서 2초(REPATH_THRESHOLD_SEC) 이상 진전 없으면 Idle로 강제 복귀 → 경로 재탐색.',
    result: '2초 안에 교착 자동 해소. 추가 로직 없이 타이머 하나로 순환 의존 탈출.',
    code: 'if (blockedSec >= 2.0) → back to Idle',
  },
  {
    icon: '🗺',
    title: '공유 혼잡도 맵 — 동일 틱 경로 분산',
    category: '경로 분산',
    color: '#bc8cff',
    problem: '같은 틱 안에 여러 Idle 에이전트가 경로를 탐색할 때, 먼저 경로를 잡은 에이전트의 선택이 다음 에이전트에게 반영되지 않아 모두 같은 최단 경로를 선택',
    solution: '매 틱 시작 시 실제 혼잡도 맵의 얕은 복사본을 만들어 "이번 틱의 계획 혼잡도 맵"을 생성. Idle 에이전트가 경로를 확정할 때마다 그 경로 노드에 +0.35 가중치를 누적 적용. 다음 에이전트는 이미 선점된 경로가 비싸 보여 자연스럽게 대안 경로를 선택.',
    result: '동일 틱 내 경로 쏠림 방지. 그리드 맵에서 여러 등가 경로로 로봇 자연 분산. 실제 혼잡도 원본은 오염되지 않아 통계·과잉 경고 로직에 영향 없음.',
    code: '// 매 틱: plannedCong = new Map(newCong)',
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
  {
    icon: '🛤',
    title: '단방향(one-way) 교차 그리드',
    category: '교착 구조적 제거',
    color: '#39d353',
    problem: '양방향 레일에서는 두 로봇이 같은 엣지를 반대 방향으로 진입하는 정면충돌(2-cycle 교착)이 구조적으로 가능. 알고리즘만으로 100% 막기 어려움.',
    solution: '가로 짝수행→오른쪽/홀수행→왼쪽, 세로 짝수열→아래/홀수열→위로 모든 레일을 일방통행화. 그래프는 강결합(모든 노드 상호 도달)을 유지하면서 역방향 엣지가 사라짐.',
    result: '정면충돌·2-cycle 교착이 구조적으로 불가능. 남는 교착은 3대+ 루프뿐 → 회전으로 해소 가능.',
    code: 'even row → right, odd row → left',
  },
  {
    icon: '🔄',
    title: '사이클 회전(rotation) 교착 해소',
    category: '데드락 해소',
    color: '#3fb950',
    problem: '3대 이상이 서로의 목표 칸을 점유한 순환 교착은 "점유 시 대기"로는 영원히 풀리지 않음.',
    solution: '매 틱 대기 로봇들의 wait-for 그래프(각 로봇 → 목표칸 점유자)에서 사이클을 탐지. 사이클이 발견되면 전원을 같은 틱에 동시 전진 — 각자의 목표 칸이 동시에 비워지므로 회전이 항상 성공.',
    result: '영구 교착이 수학적으로 불가능. 100대 환경에서 2분+ 무정지 검증.',
    code: 'detect cycle → rotate all at once',
  },
  {
    icon: '🚊',
    title: '기차(train) 규칙 — 등속 행렬 이동',
    category: '처리량 최적화',
    color: '#58a6ff',
    problem: '"목표 칸 점유 시 무조건 대기"면 한 줄로 선 로봇들이 한 틱에 한 대씩만 전진(애벌레 이동)해 차선 처리량이 급감.',
    solution: '목표 칸의 점유자가 이미 떠나는 중(다음 칸 예약 완료)이면 같은 틱에 진입 허용. 반복 패스로 앞→뒤 순서와 무관하게 행렬 전체가 한 틱에 함께 전진. 일정 간격(1칸)이 유지돼 시각적 충돌도 없음.',
    result: '단방향 차선에서 로봇 행렬이 등속으로 흐름. 100대에서도 정체 없이 높은 처리량 유지.',
    code: 'claimable if occupant is leaving',
  },
  {
    icon: '📚',
    title: '바이너리 힙 A* — O(V²) → O(E log V)',
    category: '성능 최적화',
    color: '#ffa657',
    problem: '기존 A*는 매 확장마다 open 집합을 [...open].reduce로 선형 탐색 → O(V²). 수백 노드 그리드에서 100대가 동시에 재탐색하면 프레임 드롭.',
    solution: '최소 힙(MinHeap) 자료구조로 open 집합을 관리하는 공용 코어(aStarCore)로 6개 알고리즘 전부 교체. Dijkstra·Greedy·Stochastic·Priority·CBS-Lite가 동일 코어를 재사용.',
    result: '320노드 그리드 + 100대 동시 경로탐색을 실시간으로 처리. 알고리즘별 중복 코드도 제거.',
    code: 'class MinHeap → aStarCore(edgeCost, useHeuristic)',
  },
];

const DEADLOCK_LEVELS = [
  { level: 'L1', time: '즉시 (매 틱)',      color: '#3fb950', title: 'occupied 맵 + nextNode 예약',        desc: 'occupied 맵에 에이전트의 currentNode뿐 아니라 nextNode도 등록. 이동 중인 노드를 미리 점유해 두 에이전트가 같은 노드로 동시에 진입하는 충돌을 사전에 차단.' },
  { level: 'L2', time: '2초 이상 블로킹',    color: '#ffa657', title: 'blockedSec → Idle 강제 복귀',       desc: 'Moving 상태에서 2초 이상 경로 진전 없으면 Idle로 강제 복귀 후 경로 재탐색. 순환 의존의 약한 고리를 끊어 교착 탈출. (blockedSec 타이머 기반)' },
  { level: 'L3', time: '5초 이상 무처리',    color: '#e8912d', title: 'StallReport — 진단 리포트 생성',    desc: '5초 동안 완료 작업 수 증가 없으면 analyzeStall()이 실행. 원인(deadlock/no-path/no-process-nodes/all-idle)과 영향 에이전트, 혼잡 구간, 개선 방향을 분석해 웹 UI에 리포트 표시.' },
  { level: 'L4', time: '사용자 판단',        color: '#f85149', title: '맵 에디터 → 구조 개선',             desc: 'StallReport의 mapAdvice에 따라 사용자가 맵 에디터로 이동해 노드 추가·경로 수정. 알고리즘이 아닌 맵 구조 자체를 개선하는 최후 수단.' },
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
          <strong style={{ color: '#e6edf3' }}> 8스텝</strong>을 예약하고, 후순위 에이전트가 해당 셀을
          탐색할 때 <strong style={{ color: '#ffa657' }}>×8 비용 페널티</strong>를 받아 자동으로 우회합니다.
          (그리드 맵 대응으로 기존 5스텝에서 8스텝으로 확장. 경로가 길어질수록 더 넓은 충돌 사전 차단 범위 확보)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: '예약 윈도우', value: '8 스텝', color: '#58a6ff' },
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
            { step: '③ WHCA* 예약 등록', desc: '확정된 경로의 8스텝을 시공간 테이블에 등록 (CBS_LOOKAHEAD)', color: '#ffa657' },
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

/* 단방향 그리드 + 예약·회전 무한 운전 아키텍처 */
function DeadlockFreeArchitecture() {
  const fixes = [
    {
      head: '① 단방향(one-way) 그리드',
      color: '#39d353',
      bullets: [
        '가로: 짝수행→오른쪽, 홀수행→왼쪽',
        '세로: 짝수열→아래, 홀수열→위',
        '그래프 강결합 유지 (모든 노드 상호 도달)',
        '역방향 엣지 부재 → 정면충돌 불가',
        '✓ 2-cycle 교착 구조적으로 제거',
      ],
    },
    {
      head: '② 예약 + 사이클 회전',
      color: '#3fb950',
      bullets: [
        '각 로봇이 다음 칸을 예약(reservation)',
        '기차 규칙: 앞칸이 비워지면 같은 틱 진입',
        '3대+ 루프 = 유일하게 남는 교착',
        '회전(rotation): 루프 전원 동시 1칸 전진',
        '✓ 영구 교착 수학적으로 불가능',
      ],
    },
  ];
  const stats = [
    { label: '로봇 수', value: '100대', color: '#58a6ff' },
    { label: '무정지 운전', value: '2분+', color: '#3fb950' },
    { label: '처리량', value: '~118 n/s', color: '#ffa657' },
    { label: '영구 교착', value: '0건', color: '#39d353' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.85 }}>
          하이브리드 알고리즘으로 교착을 95% 줄였지만, 로봇을 수십 대 이상으로 늘리자 남은 5%가 다시 전체를 멈췄습니다.
          추적 결과 근본 원인은 <strong style={{ color: '#e6edf3' }}>경로탐색 알고리즘이 아니라 맵 구조와 코디네이션 레이어</strong>에 있었습니다.
          교착은 "더 똑똑한 A*"가 아니라 <strong style={{ color: '#39d353' }}>"교착이 생길 수 없는 구조"</strong>로 풀어야 했습니다.
        </div>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {fixes.map(f => (
          <div key={f.head} style={{ background: '#21262d', borderLeft: `3px solid ${f.color}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 700, color: f.color, fontSize: 13, marginBottom: 12 }}>{f.head}</div>
            {f.bullets.map(b => (
              <div key={b} style={{ fontSize: 12, color: '#8b949e', padding: '3px 0', lineHeight: 1.5 }}>• {b}</div>
            ))}
          </div>
        ))}
      </div>
      <Card>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e6edf3', marginBottom: 14 }}>검증 결과 (초대형 팹 맵 · 320노드)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {stats.map(({ label, value, color }) => (
            <div key={label} style={{ textAlign: 'center', background: '#21262d', borderRadius: 8, padding: '16px 8px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#444c56', marginTop: 12, lineHeight: 1.7 }}>
          맵 설계의 상세 근거는 상단 <strong style={{ color: '#8b949e' }}>"맵 설계 고려사항"</strong> 탭에서 확인할 수 있습니다.
        </div>
      </Card>
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
        <SectionTitle>§ 1. 다중 에이전트 경로탐색의 근본 과제 및 설계 기준</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.85, marginBottom: 16 }}>
            현대 반도체 FAB의 Overhead Hoist Transport(OHT) 시스템에서는 수십~수백 대의 로봇이 천장 레일을 통해 동시에 웨이퍼를 운반합니다.
            이러한 <strong style={{ color: '#e6edf3' }}>다중 에이전트 환경</strong>에서 경로탐색 알고리즘이 충족해야 할 설계 기준은 상충적입니다:
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
          <blockquote style={{ borderLeft: '3px solid #58a6ff', paddingLeft: 14, margin: '18px 0 0', fontSize: 12, color: '#8b949e', lineHeight: 1.7 }}>
            CBS-Lite(=WHCA*)는 4지표 중 3개가 Priority A*보다 우수합니다. 그럼에도 <strong style={{ color: '#e6edf3' }}>보조 채택</strong>인 이유는 (1) CPU 효율이 15p 낮아 60fps hard constraint를 위협하고,
            (2) 모든 에이전트가 갱신하는 <strong style={{ color: '#e6edf3' }}>공유 예약 테이블</strong>에 의존해 단독 동작이 불가능하기 때문입니다. 실제 채택 구조는
            <strong style={{ color: '#3fb950' }}> Priority A* (기본 경로계획) + CBS-Lite (예약 충돌 시 ×8 페널티 보강)</strong> 의 <strong>층화 하이브리드</strong>입니다.
          </blockquote>
        </Card>
      </section>

      {/* § 의외의 발견 — 시스템이 알고리즘을 압도한다 */}
      <section>
        <SectionTitle>💡 의외의 발견 — 시스템이 알고리즘을 압도한다</SectionTitle>
        <Card>
          <p style={{ fontSize: 13, color: '#e6edf3', lineHeight: 1.8, marginBottom: 14 }}>
            7종 알고리즘을 단계별로 비교했지만, <strong style={{ color: '#f0b72f' }}>자동 디스패칭</strong>(가장 가까운 가용 로봇 ↔ 가장 가까운 작업 자동 배정 + 모든 로봇이 함께 보는 <strong style={{ color: '#79c0ff' }}>공유 혼잡도 맵</strong> 활용)을 적용한 순간,
            알고리즘별 처리량·혼잡도 차이가 <strong style={{ color: '#f0b72f' }}>노이즈 수준</strong>으로 줄어들었습니다.
          </p>
          <ul style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.9, paddingLeft: 18, marginBottom: 14 }}>
            <li>목표 자동 분산 + <strong style={{ color: '#79c0ff' }}>공유 혼잡도 맵</strong> 덕분에 모든 알고리즘이 동일한 비용 신호를 받아, 휴리스틱 차이가 평탄화됩니다.</li>
            <li>개별 컴포넌트보다 <strong style={{ color: '#e6edf3' }}>전체 흐름의 설계</strong>가 성능 상한을 결정한다는 점은 다중 에이전트 시스템에서 자주 관찰되는 패턴입니다.</li>
            <li><strong style={{ color: '#f85149' }}>한계</strong>: 자동 디스패칭 ON, 100대 / 12×8 맵 조건의 관찰입니다. 디스패칭 OFF나 극단적 혼잡(200대+, 좁은 통로)에서는 차이가 다시 드러날 가능성이 있어 추가 벤치마크가 필요합니다.</li>
          </ul>
          <blockquote style={{ borderLeft: '3px solid #f0b72f', paddingLeft: 14, margin: 0, fontSize: 13, color: '#e6edf3', lineHeight: 1.8 }}>
            <strong style={{ color: '#f0b72f' }}>결론</strong> — 본 프로젝트의 진짜 기여는 "최적 알고리즘 선택"이 아니라
            <strong style={{ color: '#3fb950' }}> 경로탐색 + 디스패칭 + 데드락 에스컬레이션을 결합한 시스템 설계</strong>입니다.
          </blockquote>
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

      {/* § 단방향 그리드 무한 운전 */}
      <section>
        <SectionTitle>§ 6. 100대 무한 운전 — 단방향 그리드 + 예약·회전 코디네이션</SectionTitle>
        <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.7, marginBottom: 20 }}>
          알고리즘 튜닝의 한계를 넘어, 교착이 구조적으로 불가능한 맵과 코디네이션 레이어로 전환한 최신 단계입니다.
        </p>
        <DeadlockFreeArchitecture />
      </section>

      {/* § 보조 기법 */}
      <section>
        <SectionTitle>§ 7. 알고리즘을 살린 보조 기법들</SectionTitle>
        <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.7, marginBottom: 20 }}>
          알고리즘 자체만큼이나 성능과 안정성에 기여한 엔지니어링 기법들입니다. 클릭하면 문제·해결·결과를 확인할 수 있습니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TECHNIQUES.map(t => <TechniqueCard key={t.title} t={t} />)}
        </div>
      </section>

      {/* § 데드락 에스컬레이션 */}
      <section>
        <SectionTitle>§ 8. 데드락 에스컬레이션 L1 ~ L4</SectionTitle>
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
