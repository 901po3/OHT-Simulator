import React from 'react';

/* ══════════════════════════════════════════
   맵 설계 고려사항 — 왜 이런 맵을 만들었는가
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

const PROC_COLOR = ['#bc8cff', '#ffa657', '#f85149', '#3fb950']; // 증착·노광·식각·세정

/* 단방향 교차 그리드 동작 시각화 (buildFabMap 축소판) */
function OneWayGridDiagram() {
  const cols = 6, rows = 5, gap = 70, m = 34, r = 11;
  const w = m * 2 + (cols - 1) * gap;
  const h = m * 2 + (rows - 1) * gap;
  const pos = (c: number, rr: number) => ({ x: m + c * gap, y: m + rr * gap });

  type Cell = { c: number; r: number; type: 'normal' | 'proc' | 'depot'; color: string };
  const cells: Cell[] = [];
  let stIdx = 0;
  const depotKey = new Set(['0,0', `${rows - 1 - ((rows - 1) % 2)},${cols - 1 - ((cols - 1) % 2)}`]);
  for (let rr = 0; rr < rows; rr++) {
    for (let c = 0; c < cols; c++) {
      if (rr % 2 === 0 && c % 2 === 0) {
        if (depotKey.has(`${rr},${c}`)) cells.push({ c, r: rr, type: 'depot', color: '#8b949e' });
        else { cells.push({ c, r: rr, type: 'proc', color: PROC_COLOR[stIdx % 4] }); stIdx++; }
      } else {
        cells.push({ c, r: rr, type: 'normal', color: '#30506e' });
      }
    }
  }

  // 단방향 엣지: 가로 짝수행→오른쪽/홀수행→왼쪽, 세로 짝수열→아래/홀수열→위
  const arrows: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const shrink = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    return { x1: a.x + ux * (r + 3), y1: a.y + uy * (r + 3), x2: b.x - ux * (r + 7), y2: b.y - uy * (r + 7) };
  };
  for (let rr = 0; rr < rows; rr++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) {
        const a = pos(c, rr), b = pos(c + 1, rr);
        arrows.push(rr % 2 === 0 ? shrink(a, b) : shrink(b, a));
      }
      if (rr + 1 < rows) {
        const a = pos(c, rr), b = pos(c, rr + 1);
        arrows.push(c % 2 === 0 ? shrink(a, b) : shrink(b, a));
      }
    }
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: 520, display: 'block', margin: '0 auto' }}>
      <defs>
        <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="5.5" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill="#58a6ff" opacity="0.75" />
        </marker>
      </defs>
      {arrows.map((a, i) => (
        <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
          stroke="#58a6ff" strokeWidth={1.6} opacity={0.5} markerEnd="url(#arrowhead)" />
      ))}
      {cells.map((cell, i) => {
        const p = pos(cell.c, cell.r);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={r}
              fill={cell.color + '33'} stroke={cell.color} strokeWidth={cell.type === 'normal' ? 1.4 : 2} />
            {cell.type === 'depot' && <rect x={p.x - 4} y={p.y - 4} width={8} height={8} fill="#8b949e" />}
          </g>
        );
      })}
    </svg>
  );
}

const PRINCIPLES = [
  {
    icon: '🛤',
    color: '#39d353',
    title: '단방향 강결합 (one-way & strongly connected)',
    body: '모든 레일을 일방통행으로 두되, 가로·세로 방향을 행/열 패리티로 교차시켜 그래프 전체가 강결합(모든 노드 상호 도달)을 유지합니다. 역방향 엣지가 없으므로 두 로봇의 정면충돌(2-cycle 교착)이 구조적으로 발생할 수 없습니다. 실제 반도체 FAB의 OHT 트랙이 이 원리(일방통행 루프)로 동작합니다.',
  },
  {
    icon: '⬡',
    color: '#bc8cff',
    title: '특수 노드 비인접 (no-adjacent stations)',
    body: '공정 스테이션(증착·노광·식각·세정)과 차고지를 (짝수행,짝수열) 부분격자에만 배치해 어떤 두 특수 노드도 상하좌우로 붙지 않게 했습니다. 스테이션이 인접하면 처리 중인 로봇들이 서로의 진입로를 막아 국소 정체가 생기는데, 한 칸 이상 떨어뜨려 통과 차선을 항상 확보합니다.',
  },
  {
    icon: '🎯',
    color: '#58a6ff',
    title: '균등 분산 스테이션 (even distribution)',
    body: '각 공정 종류를 맵 전역에 순환 배치(D·E·Et·C 반복)해 어느 위치에서든 다음 공정 노드가 가깝습니다. 동선이 짧아져 이동 비용이 줄고, 특정 구역으로 로봇이 쏠리는 핫스팟을 방지합니다. 초대형 팹 맵은 종류별 약 18~20개 스테이션을 균등 분산합니다.',
  },
  {
    icon: '⬛',
    color: '#8b949e',
    title: '외곽 분산 차고지 (perimeter depots)',
    body: '차고지(로봇 스폰 지점)를 맵 외곽에 8개 분산 배치합니다. 한곳에 몰린 차고지는 스폰 직후 입구 정체를 만들지만, 외곽 분산은 100대를 빠르게(차고지당 2대/초) 그리고 여러 방향에서 투입해 초기 램프업을 매끄럽게 합니다.',
  },
];

const PRESETS = [
  { name: '소형', nodes: '13', conn: '양방향', proc: '종류별 1개', use: '알고리즘 기본 동작 확인', color: '#58a6ff' },
  { name: '중형', nodes: '20', conn: '양방향', proc: '종류별 2개', use: '2개 루트 분산 테스트', color: '#ffa657' },
  { name: '대형', nodes: '30', conn: '양방향', proc: '종류별 3개', use: '3개 루트 분산 테스트', color: '#bc8cff' },
  { name: '초대형 팹 ∞', nodes: '320', conn: '단방향', proc: '종류별 ~20개', use: '100대 무한 운전 (교착-free)', color: '#39d353' },
];

const ANTIPATTERNS = [
  { bad: '양방향 단일 차선', why: '두 로봇이 마주 보면 정면충돌·교착. 우회로가 없으면 영구 정지.', fix: '일방통행 + 평행 차선(반대 방향은 옆 줄)' },
  { bad: '막다른 길 (dead-end)', why: '진입한 로봇이 빠져나올 방향이 없어 후속 로봇까지 연쇄 정체.', fix: '모든 노드가 최소 1개의 진입·진출 엣지를 갖는 순환 구조' },
  { bad: '특수 노드 인접', why: '처리 중인 로봇들이 서로의 진입로를 막아 스테이션 군집 정체.', fix: '부분격자 배치로 특수 노드 간 최소 1칸 간격' },
  { bad: '단일 중앙 차고지', why: '스폰 입구에 병목. 100대 램프업이 느리고 입구가 막힘.', fix: '외곽에 차고지 다수 분산' },
];

export function MapDesignPage() {
  return (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 48px)', background: '#0d1117' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* § 1 핵심 명제 */}
        <section>
          <SectionTitle>§ 1. 맵 구조가 교착을 결정한다</SectionTitle>
          <Card>
            <p style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.85, marginBottom: 16 }}>
              경로탐색 알고리즘을 아무리 정교하게 다듬어도, <strong style={{ color: '#e6edf3' }}>맵 구조 자체가 교착을 허용하면</strong> 로봇 수가
              늘어날수록 결국 시스템은 멈춥니다. 양방향 레일 + "점유 시 대기" 조합에서는 순환 의존 교착이 통계적으로 필연이기 때문입니다.
            </p>
            <p style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.85, margin: 0 }}>
              그래서 접근을 뒤집었습니다 — <strong style={{ color: '#39d353' }}>"교착을 푸는 맵"이 아니라 "교착이 생길 수 없는 맵"</strong>을 설계하는 것.
              아래 네 가지 원칙이 그 결과입니다.
            </p>
          </Card>
        </section>

        {/* § 2 설계 원칙 */}
        <section>
          <SectionTitle>§ 2. 네 가지 설계 원칙</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PRINCIPLES.map(p => (
              <div key={p.title} style={{
                background: '#161b22', border: '1px solid #30363d',
                borderLeft: `3px solid ${p.color}`, borderRadius: 10, padding: '14px 18px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: p.color, marginBottom: 6 }}>{p.title}</div>
                  <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.8, margin: 0 }}>{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* § 3 단방향 그리드 동작 원리 */}
        <section>
          <SectionTitle>§ 3. 단방향 교차 그리드는 어떻게 동작하는가</SectionTitle>
          <Card>
            <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.8, marginBottom: 20 }}>
              가로 레일은 짝수 행에서 오른쪽, 홀수 행에서 왼쪽으로 흐릅니다. 세로 레일은 짝수 열에서 아래, 홀수 열에서 위로 흐릅니다.
              이 교차 패턴은 맨해튼의 일방통행 도로망과 같아, <strong style={{ color: '#e6edf3' }}>모든 노드가 서로 도달 가능</strong>하면서도
              같은 구간을 마주 보고 진입할 수 없습니다.
            </p>
            <OneWayGridDiagram />
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
              {[
                { c: '#bc8cff', t: '공정 스테이션' },
                { c: '#8b949e', t: '차고지(스폰)' },
                { c: '#30506e', t: '일반 통행 노드' },
                { c: '#58a6ff', t: '단방향 레일(화살표)' },
              ].map(({ c, t }) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                  <span style={{ fontSize: 11, color: '#8b949e' }}>{t}</span>
                </div>
              ))}
            </div>
            <blockquote style={{ borderLeft: '3px solid #39d353', paddingLeft: 16, margin: '20px 0 0', fontSize: 13, color: '#8b949e', lineHeight: 1.8 }}>
              화살표를 따라가 보면 어떤 노드에서 출발해도 모든 노드로 갈 수 있습니다(강결합). 동시에 어떤 두 노드 사이에도
              양방향 화살표가 없어 정면충돌이 원천적으로 불가능합니다. 남는 교착은 3대 이상이 사각형 루프를 도는 경우뿐이며,
              이는 시뮬레이터의 <strong style={{ color: '#3fb950' }}>사이클 회전</strong>으로 같은 틱에 동시 전진시켜 해소합니다.
            </blockquote>
          </Card>
        </section>

        {/* § 4 적정 로봇 투입량 */}
        <section>
          <SectionTitle>§ 4. 적정 로봇 투입량 — 공정 노드당 몇 대?</SectionTitle>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 40, fontWeight: 800, color: '#3fb950', fontFamily: 'monospace', lineHeight: 1 }}>≈ 1.5</div>
                <div style={{ fontSize: 12, color: '#8b949e', marginTop: 6 }}>대 / 공정 노드</div>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <p style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.85, margin: 0 }}>
                  병목은 <strong style={{ color: '#e6edf3' }}>공정 노드의 처리 시간</strong>입니다. 한 노드는 1.5초에 1건만 처리하므로,
                  공정 노드 수보다 로봇이 많아도 처리량은 늘지 않고 통행 혼잡만 커집니다. 노드 1개당
                  <strong style={{ color: '#3fb950' }}> 처리 중 1대 + 진입 대기 1대</strong> 정도가 이상적입니다.
                </p>
              </div>
            </div>

            {/* 밀도 게이지 */}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 34, fontSize: 11, fontWeight: 700 }}>
              {[
                { label: '과소', sub: '< 1×', flex: 30, bg: '#30363d', fg: '#8b949e' },
                { label: '권장', sub: '1 ~ 1.5×', flex: 25, bg: '#238636', fg: '#fff' },
                { label: '허용', sub: '1.5 ~ 2×', flex: 22, bg: '#9e6a03', fg: '#fff' },
                { label: '과잉', sub: '> 2×', flex: 33, bg: '#7d2622', fg: '#fdaba6' },
              ].map(z => (
                <div key={z.label} style={{ flex: z.flex, background: z.bg, color: z.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2 }}>
                  <span>{z.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.9 }}>{z.sub}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#444c56', marginTop: 4 }}>
              <span>공정 노드가 놀아 처리량 손실</span>
              <span>혼잡만 증가 · 비용 낭비</span>
            </div>

            {/* 프리셋별 권장 대수 */}
            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { name: '소형', proc: 4, rec: '4~6대', color: '#58a6ff' },
                { name: '중형', proc: 8, rec: '8~12대', color: '#ffa657' },
                { name: '대형', proc: 12, rec: '12~18대', color: '#bc8cff' },
                { name: '초대형 팹', proc: 72, rec: '70~100대', color: '#39d353' },
              ].map(p => (
                <div key={p.name} style={{ background: '#21262d', borderRadius: 8, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: p.color }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: '#444c56', margin: '3px 0' }}>공정 {p.proc}개</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3', fontFamily: 'monospace' }}>{p.rec}</div>
                </div>
              ))}
            </div>
            <blockquote style={{ borderLeft: '3px solid #3fb950', paddingLeft: 16, margin: '18px 0 0', fontSize: 12, color: '#8b949e', lineHeight: 1.8 }}>
              공식: <strong style={{ color: '#e6edf3' }}>최적 로봇 ≈ 공정 노드 수 × 1.5</strong> (상한 ×2).
              시뮬레이션 우측 패널의 <strong style={{ color: '#3fb950' }}>"로봇당 평균 처리량"</strong> 그래프로 이 지점을 직접 확인할 수 있습니다 —
              로봇을 권장치 이상으로 늘리면 로봇당 처리량 곡선이 꺾여 내려갑니다.
            </blockquote>
          </Card>
        </section>

        {/* § 5 프리셋 비교 */}
        <section>
          <SectionTitle>§ 5. 맵 프리셋 비교</SectionTitle>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.7fr 0.8fr 1fr 1.6fr', fontSize: 12 }}>
              {['프리셋', '노드', '연결', '공정 노드', '용도'].map(h => (
                <div key={h} style={{ padding: '10px 14px', background: '#21262d', color: '#8b949e', fontWeight: 700, borderBottom: '1px solid #30363d' }}>{h}</div>
              ))}
              {PRESETS.map(p => (
                <React.Fragment key={p.name}>
                  <div style={{ padding: '10px 14px', color: p.color, fontWeight: 700, borderBottom: '1px solid #21262d' }}>{p.name}</div>
                  <div style={{ padding: '10px 14px', color: '#e6edf3', fontFamily: 'monospace', borderBottom: '1px solid #21262d' }}>{p.nodes}</div>
                  <div style={{ padding: '10px 14px', color: p.conn === '단방향' ? '#39d353' : '#8b949e', borderBottom: '1px solid #21262d' }}>{p.conn}</div>
                  <div style={{ padding: '10px 14px', color: '#8b949e', borderBottom: '1px solid #21262d' }}>{p.proc}</div>
                  <div style={{ padding: '10px 14px', color: '#8b949e', borderBottom: '1px solid #21262d' }}>{p.use}</div>
                </React.Fragment>
              ))}
            </div>
          </Card>
          <p style={{ fontSize: 12, color: '#444c56', lineHeight: 1.7, marginTop: 12 }}>
            소·중·대형은 알고리즘 비교용 양방향 맵이며, <strong style={{ color: '#8b949e' }}>초대형 팹 ∞</strong>만 단방향 구조로
            100대 무한 운전을 보장합니다. 에디터의 "자동 생성 ▼"에서 불러올 수 있습니다.
          </p>
        </section>

        {/* § 6 안티패턴 */}
        <section>
          <SectionTitle>§ 6. 피해야 할 맵 안티패턴</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ANTIPATTERNS.map(a => (
              <div key={a.bad} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#f85149', background: '#f8514922', padding: '2px 8px', borderRadius: 4 }}>✕ {a.bad}</span>
                </div>
                <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.7, marginBottom: 6 }}>
                  <strong style={{ color: '#f85149' }}>문제 </strong>{a.why}
                </div>
                <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.7 }}>
                  <strong style={{ color: '#3fb950' }}>해결 </strong>{a.fix}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ fontSize: 11, color: '#444c56', textAlign: 'center', paddingBottom: 24 }}>
          알고리즘 선택 과정은 "길찾기 알고리즘 선택 과정" 탭을 참고하세요
        </div>
      </div>
    </div>
  );
}
