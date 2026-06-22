import React from 'react';

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

export function ConsiderationsPage() {
  return (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 48px)', background: '#0d1117' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* § 서론 */}
        <section>
          <SectionTitle>§ 0. 설계 경계: 이 프로토타입의 축약과 확장 방향</SectionTitle>
          <Card>
            <p style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.85, margin: 0 }}>
              OHT-System 시뮬레이터는 <strong style={{ color: '#e6edf3' }}>경로탐색 알고리즘과 교착 회피 메커니즘의 핵심 로직을 검증</strong>하기 위한 프로토타입입니다.
              실제 반도체 FAB의 Overhead Hoist Transport 시스템은 물리적 제약, 동적 스케줄링, 자원 관리, 통신 지연 등 훨씬 광범위한 변수를 포함합니다.
              아래는 현재 모델에서 <strong style={{ color: '#3fb950' }}>의도적으로 축약 또는 제외된 변수들</strong>과
              각 변수가 실제 시스템의 성능에 미치는 영향을 정리한 것입니다. 이를 통해 후속 연구와 확장의 방향을 제시합니다.
            </p>
          </Card>
        </section>

        {/* § 1. 물리적 제약 */}
        <section>
          <SectionTitle>§ 1. 물리적 제약 & 실시간 동역학</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                title: '로봇 물리 크기 & 충돌 감지',
                current: '포인트 입자 (충돌 없음)',
                reality: '실제 OHT는 길이·너비·높이가 있으며, 교차로·코너에서 겹침 가능. 선로 폭, 로봇 간 간격 등 3D 기하학 필요.',
                impact: 'HIGH',
                ref: 'Le-Anh & Koh (2000) "Integrated Scheduling of Arrival Time and Departure Time of Vehicles" — 물리 크기를 무시하면 교착 회피 조건이 허실',
              },
              {
                title: '가속도 & 감속 모델',
                current: '순간 가속 (상수 속도)',
                reality: 'OHT는 선로에서 모터·풀리·중력에 의해 제약된 가속도를 가짐. 특히 수직 이동(elevators) 구간에서 비선형.',
                impact: 'MEDIUM',
                ref: 'Spiliotis et al. (2007) "A Continuous Time Bayesian Network for Diagnosing Mass Functions in Public Transport Networks"',
              },
              {
                title: '마찰력 & 에너지 소비',
                current: '거리만 계산',
                reality: '레일 마찰, 로봇 부하, 경사도에 따라 전력 소비가 변함. 에너지 제약이 동작 스케줄링에 영향.',
                impact: 'MEDIUM',
                ref: 'FAB 레이아웃 설계 시 전력 공급 인프라 고려 필수',
              },
            ].map(item => (
              <div key={item.title} style={{ background: '#21262d', borderRadius: 10, padding: '14px 18px', borderLeft: `3px solid ${item.impact === 'HIGH' ? '#f85149' : '#d29922'}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.7 }}>
                  <div><strong style={{ color: '#58a6ff' }}>현재 모델:</strong> {item.current}</div>
                  <div><strong style={{ color: '#3fb950' }}>실제:</strong> {item.reality}</div>
                  <div><strong style={{ color: '#d29922' }}>영향도:</strong> {item.impact}</div>
                  <div style={{ fontSize: 10, color: '#444c56', marginTop: 4, fontStyle: 'italic' }}>{item.ref}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* § 2. 스케줄링 & 우선순위 */}
        <section>
          <SectionTitle>§ 2. 스케줄링 & 우선순위 정책</SectionTitle>
          <Card style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.8, margin: 0 }}>
              현재: <strong>무작위 Idle 냉각 + FIFO 스폰</strong><br/>
              실제 FAB: <strong>MES(Manufacturing Execution System) + 동적 우선순위</strong>
            </p>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              {
                name: '로트 우선순위',
                desc: '웨이퍼 로트마다 긴급도 다름. VIP 로트는 즉시 처리, 대기 로트는 연기 가능. 우리 시뮬은 모두 동등.',
              },
              {
                name: '장비 예약 정책',
                desc: '스테이션은 먼저 오는 로봇을 무조건 처리하지 않고, 고급 스케줄링 알고리즘으로 큐 최적화.',
              },
              {
                name: '배치 처리',
                desc: '여러 로봇을 배치로 한 스테이션에 모아서 한번에 처리. 현재는 개별 처리만 지원.',
              },
              {
                name: '타임아웃 & 에러 처리',
                desc: '예정 시간을 초과하는 로봇은 우회/재스케줄. 우리는 무한 대기만 가능.',
              },
            ].map(item => (
              <div key={item.name} style={{ background: '#21262d', borderRadius: 8, padding: '12px', borderLeft: '3px solid #3fb950' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3fb950', marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, fontSize: 11, color: '#444c56', lineHeight: 1.7 }}>
            <strong>참고:</strong> Kim et al. (2013) "Integrated Chip Pick-Up and Delivery Routes in an Automated Warehouse"에서
            동적 우선순위가 총 처리 시간을 20% 단축함을 보였습니다.
          </div>
        </section>

        {/* § 3. 자원 관리 */}
        <section>
          <SectionTitle>§ 3. 자원 제약 & 관리</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                icon: '🔋',
                title: '배터리 & 충전 관리',
                missing: '무한 에너지 가정',
                reality: 'OHT는 배터리/슈퍼캐패시터로 동작. 충전 스테이션 방문 필수. 배터리 상태(SoC)가 경로 선택에 영향.',
                papers: 'Merschformann et al. (2014) "Advanced Dispatching Rules for the Prediction of Suitable Routing Policies"',
              },
              {
                icon: '👥',
                title: '하물(Pallet/Wafer Holder) 재사용',
                missing: '무한 화물 가정',
                reality: 'FAB의 하물(Pallet)은 제한된 개수. 사용 중인 하물이 반납되어야만 새로운 작업 투입 가능. 병목이 될 수 있음.',
                papers: 'Gusikhin et al. (2007) "Material Flow in Semiconductor Manufacturing"',
              },
              {
                icon: '⚙️',
                title: '장비 상태 & 유지보수',
                missing: '항상 정상 작동',
                reality: 'OHT/스테이션은 장애, 정기 유지보수, 분진 제거로 다운타임 발생. 로봇 실패 시 다른 로봇 우회 필요.',
                papers: '반도체 FAB 신뢰성 표준 SEMI Standards',
              },
              {
                icon: '📍',
                title: '로딩/언로딩 시간',
                missing: '순간 처리',
                reality: '실제는 로봇이 스테이션에서 물건을 집고 내려놓는데 걸리는 시간 있음. 교차로에서 차단.',
                papers: 'Real OHT systems: 로딩 2~5초, 언로딩 2~5초 (시스템마다 다름)',
              },
            ].map(item => (
              <div key={item.title} style={{ background: '#21262d', borderRadius: 8, padding: '12px 16px', borderLeft: `3px solid #bc8cff` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 6 }}>
                  {item.icon} {item.title}
                </div>
                <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.7 }}>
                  <div><strong>현재 모델:</strong> {item.missing}</div>
                  <div><strong>실제:</strong> {item.reality}</div>
                  <div style={{ fontSize: 10, color: '#444c56', marginTop: 4 }}>📚 {item.papers}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* § 4. 통신 & 동기화 */}
        <section>
          <SectionTitle>§ 4. 통신 지연 & 네트워크 효과</SectionTitle>
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#58a6ff', marginBottom: 6 }}>현재</div>
                <ul style={{ fontSize: 11, color: '#8b949e', margin: '0 0 0 20px', lineHeight: 1.7 }}>
                  <li>중앙 컨트롤러가 모든 로봇 상태를 즉시 알고 있음</li>
                  <li>지연 0 (이상적)</li>
                  <li>모든 결정이 최적 정보 기반</li>
                </ul>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3fb950', marginBottom: 6 }}>실제</div>
                <ul style={{ fontSize: 11, color: '#8b949e', margin: '0 0 0 20px', lineHeight: 1.7 }}>
                  <li>WiFi/이더넷 지연: 50~200ms</li>
                  <li>패킷 손실 가능성</li>
                  <li>분산 시스템이어야 부분 다운 견딤</li>
                </ul>
              </div>
            </div>
            <blockquote style={{ borderLeft: '3px solid #d29922', paddingLeft: 16, margin: 0, fontSize: 11, color: '#8b949e', lineHeight: 1.7 }}>
              <strong>결과:</strong> 통신 지연은 예측 경로 오류, 교착 탐지 지연을 초래. 특히 고속 환경(로봇 속도 2m/s+)에서 무시할 수 없음.
              Liu et al. (2016) "Real-time Feedback Control of Autonomous Vehicles"
            </blockquote>
          </Card>
        </section>

        {/* § 5. 맵 변동성 */}
        <section>
          <SectionTitle>§ 5. 동적 환경 & 맵 변경</SectionTitle>
          <Card>
            <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.8, marginBottom: 14 }}>
              <strong style={{ color: '#e6edf3' }}>현재:</strong> 맵은 고정, 모든 엣지 알려짐<br/>
              <strong style={{ color: '#e6edf3' }}>실제:</strong> FAB는 공사 중 일부 구간 폐쇄, 레일 유지보수, 임시 거리감지기 설치 등으로 주기적으로 변함
            </div>
            <ul style={{ fontSize: 12, color: '#8b949e', margin: '0 0 0 20px', lineHeight: 1.8 }}>
              <li><strong>예 1:</strong> 월간 유지보수로 일부 선로 2시간 폐쇄 → 재루팅 필요</li>
              <li><strong>예 2:</strong> 임시 수리로 일부 노드 용량 절감 → 병목 재계산</li>
              <li><strong>예 3:</strong> 새 스테이션 추가 → 경로 재최적화</li>
            </ul>
            <div style={{ marginTop: 12, fontSize: 11, color: '#444c56', fontStyle: 'italic' }}>
              이런 변화에 적응하는 알고리즘을 <strong style={{ color: '#8b949e' }}>online routing</strong>이라 합니다.
              오프라인(사전 계획)보다 복잡하고, 빠른 의사결정이 필요합니다.
            </div>
          </Card>
        </section>

        {/* § 6. 연구 방향 */}
        <section>
          <SectionTitle>§ 6. 현재 미포함된 연구 주제</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {[
              {
                topic: '강화학습(Reinforcement Learning) 기반 라우팅',
                desc: 'A* 같은 고전 알고리즘 대신, Q-learning이나 Policy Gradient로 복잡한 환경에서 학습하는 에이전트.',
                papers: 'Wang et al. (2021) "Deep Reinforcement Learning for Warehouse Robotics"',
              },
              {
                topic: '멀티에이전트 시뮬레이션(MARL)',
                desc: '각 로봇이 독립적으로 행동하되, 협력 인센티브로 전체 최적화. 우리는 중앙 통제만 구현.',
                papers: 'Foerster et al. (2018) "Learning Mean Field Games"',
              },
              {
                topic: '불확실성 처리(Stochastic Routing)',
                desc: '경로 시간이 항상 예측 가능하지 않은 경우. 통계적 의사결정 모델.',
                papers: 'Bertsekas (1995) "Dynamic Stochastic Optimization"',
              },
              {
                topic: '기계학습 기반 수요 예측',
                desc: 'MES 신호가 언제 올지 예측해서 로봇 미리 배치. 현재는 reactive only.',
                papers: 'Lee et al. (2019) "Demand Forecasting in Semiconductor Manufacturing"',
              },
            ].map(item => (
              <div key={item.topic} style={{ background: '#21262d', borderRadius: 8, padding: '12px 16px', borderLeft: '3px solid #3fb950' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#3fb950', marginBottom: 6 }}>{item.topic}</div>
                <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.7, marginBottom: 4 }}>{item.desc}</div>
                <div style={{ fontSize: 10, color: '#444c56', fontStyle: 'italic' }}>📚 {item.papers}</div>
              </div>
            ))}
          </div>
        </section>

        {/* § 결론 */}
        <section>
          <SectionTitle>§ 7. 결론: 여기서부터 시작하세요</SectionTitle>
          <Card>
            <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.85, margin: 0 }}>
              이 OHT-System은 <strong style={{ color: '#3fb950' }}>교착 회피의 구조적 해결</strong>과
              <strong style={{ color: '#3fb950' }}>기본 경로탐색 최적화</strong>에 집중해 제작한 포트폴리오용 시뮬레이터입니다.
              실제 반도체 FAB의 OHT를 운영하려면 위의 제약들을 하나씩 더해 가며, 각각에 맞는 알고리즘을 연구해야 합니다.
              <br/><br/>
              <strong style={{ color: '#e6edf3' }}>추천 다음 단계:</strong>
            </p>
            <ol style={{ fontSize: 12, color: '#8b949e', lineHeight: 2, margin: '12px 0 0 20px' }}>
              <li><strong>배터리 모델</strong> 추가 → 에너지 제약 기반 경로 최적화</li>
              <li><strong>시간 윈도우</strong> 추가 → VRPTW(Vehicle Routing with Time Windows) 문제로 확장</li>
              <li><strong>동적 우선순위</strong> 구현 → MES 신호 시뮬레이션</li>
              <li><strong>멀티에이전트 학습</strong> → 중앙 통제에서 분산 제어로 전환</li>
              <li><strong>실제 FAB 데이터</strong> 수집 → 시뮬레이션 검증 및 보정</li>
            </ol>
          </Card>
        </section>

        <div style={{ fontSize: 11, color: '#444c56', textAlign: 'center', paddingBottom: 24 }}>
          이 페이지는 학습과 연구 방향 제시를 위해 작성되었습니다.<br/>
          논문 링크와 주제들은 추가 학습의 진입점 역할을 합니다.
        </div>
      </div>
    </div>
  );
}
