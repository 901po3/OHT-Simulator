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

/* 단방향 교차 그리드 동작 시각화 (buildFabMap 축소판, 10×8) */
function OneWayGridDiagram() {
  const cols = 10, rows = 8, gap = 50, m = 28, r = 9;
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
    title: '단방향 강결합 토폴로지 (One-Way Strongly Connected Graph)',
    body: '모든 레일을 단방향으로 설계하되, 행과 열의 방향성을 패리티 패턴(짝수행→우측, 홀수행→좌측)으로 교차시켜 전체 그래프의 강결합성(모든 노드 쌍이 상호 도달 가능)을 보장합니다. 역방향 엣지의 부재로 인해 두 개 이상의 로봇 간 2-사이클 순환 대기 교착이 구조적으로 불가능합니다. 이는 현대 반도체 FAB의 OHT 시스템에서 채택하는 표준 토폴로지입니다.',
  },
  {
    icon: '⬡',
    color: '#bc8cff',
    title: '특수 노드 비인접 배치 (No-Adjacent Station Placement)',
    body: '처리 스테이션(증착·노광·식각·세정)과 차고지를 짝수행×짝수열 부분격자에만 배치하여 임의의 두 특수 노드 간 인접성(4-근접)을 제거합니다. 인접 스테이션은 처리 로봇들이 상호 진입로를 점유하여 국소 병목을 생성하지만, 최소 1칸 이상 간격을 두면 회피 경로가 항상 보장되어 혼잡도 급증을 방지합니다.',
  },
  {
    icon: '🎯',
    color: '#58a6ff',
    title: '균등 분산 스테이션 배치 (Uniform Station Distribution)',
    body: '공정 종류(증착·노광·식각·세정)를 맵 전역에 순환 배치하여 각 로봇이 다음 공정까지 유사한 거리를 이동합니다. 결과적으로 이동 비용이 최소화되고, 특정 구역으로의 로봇 집중(hotspot)이 제거되어 혼잡도 편차를 줄입니다. 320노드 초대형 맵에서는 공정 종류당 약 18~20개 스테이션을 균등 분산합니다.',
  },
  {
    icon: '⬛',
    color: '#8b949e',
    title: '주변부 분산 차고지 (Perimeter Depot Distribution)',
    body: '로봇 스폰점(차고지)을 맵 주변부 8개 위치에 분산 배치합니다. 중앙 집중식 차고지는 스폰 직후 입구 병목을 야기하지만, 주변부 분산은 100대 이상의 로봇을 고속(차고지당 2대/초)으로 다중 진입 경로를 통해 투입하여 초기 램프업을 선형화합니다.',
  },
];

const PRESETS = [
  { name: '소형',         nodes: '24',  conn: '단방향', proc: '종류별 1개',    use: '알고리즘 기본 동작 확인',        color: '#58a6ff' },
  { name: '중형',         nodes: '48',  conn: '단방향', proc: '종류별 2개',    use: '2개 루트 분산 테스트',           color: '#ffa657' },
  { name: '대형',         nodes: '96',  conn: '단방향', proc: '종류별 4~5개',  use: '중규모 라인 부하 테스트',        color: '#bc8cff' },
  { name: '초대형 팹 ∞',  nodes: '320', conn: '단방향', proc: '종류별 ~18개', use: '100대 무한 운전 (교착-free)',     color: '#39d353' },
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
          <SectionTitle>§ 1. 문제의 재정의: 알고리즘에서 아키텍처로</SectionTitle>
          <Card>
            <p style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.85, marginBottom: 16 }}>
              이 프로젝트의 핵심 통찰은 다음과 같습니다: <strong style={{ color: '#e6edf3' }}>높은 정확도의 경로탐색 알고리즘도, 맵 토폴로지가 순환 의존 교착을 허용하면 로봇 밀도 증가에 따라 필연적으로 교착 상황이 발생합니다.</strong>
              양방향 레일 기반 그리드에서 "점유 시 대기" 정책은 로봇 수에 비례하여 순환 대기 형태의 교착을 야기합니다.
            </p>
            <p style={{ fontSize: 14, color: '#8b949e', lineHeight: 1.85, margin: 0 }}>
              따라서 문제를 <strong style={{ color: '#39d353' }}>알고리즘 최적화에서 맵 아키텍처 설계로 재정의</strong>했습니다.
              "발생한 교착을 해소하는 기법"이 아니라 "구조적으로 교착이 불가능한 토폴로지를 설계하는 방식"입니다.
              다음 섹션은 이를 실현하는 네 가지 설계 원칙입니다.
            </p>
          </Card>
        </section>

        {/* § 2 설계 원칙 */}
        <section>
          <SectionTitle>§ 2. 구조적 교착 제거의 네 가지 원칙</SectionTitle>
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
          <SectionTitle>§ 3. 단방향 교차 그리드의 동작 원리와 강결합성 보증</SectionTitle>
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
                { name: '소형',      proc: 4,  rec: '4~6대',    color: '#58a6ff' },
                { name: '중형',      proc: 8,  rec: '8~12대',   color: '#ffa657' },
                { name: '대형',      proc: 18, rec: '18~27대',  color: '#bc8cff' },
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
            네 프리셋 모두 § 2의 <strong style={{ color: '#8b949e' }}>네 가지 설계 원칙(단방향 강결합 · 비인접 · 균등 분산 · 외곽 차고지)</strong>을 동일하게 따릅니다.
            크기만 다를 뿐 토폴로지 구조가 일관되어, 알고리즘 비교가 공정한 조건에서 이뤄집니다. 에디터의 "프리셋 ▼"에서 불러올 수 있습니다.
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
