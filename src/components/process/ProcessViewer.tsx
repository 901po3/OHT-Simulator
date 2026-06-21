import React, { useState, useEffect, useRef } from 'react';

/* ── 공정 데이터 ────────────────────────────────────── */
export type ProcessStep = 'deposition' | 'exposure' | 'etching' | 'cleaning';

interface StepMeta {
  id: ProcessStep;
  label: string;
  color: string;
  description: string;
  detail: string;
}

const STEPS: StepMeta[] = [
  {
    id: 'deposition',
    label: '증착 (Deposition)',
    color: '#bc8cff',
    description: '웨이퍼 위에 박막(Thin Film)을 쌓는 공정입니다.',
    detail: 'CVD·PVD 방식으로 SiO₂, Si₃N₄ 등 절연막 또는 금속막을 수 나노미터 ~ 수 마이크로미터 두께로 균일하게 증착합니다.',
  },
  {
    id: 'exposure',
    label: '노광 (Photolithography)',
    color: '#ffa657',
    description: '회로 패턴을 감광액(PR)에 새기는 공정입니다.',
    detail: 'UV/EUV 광원으로 마스크(레티클) 패턴을 웨이퍼의 감광액에 투영합니다. 노광된 PR은 화학적으로 변성되어 현상 후 패턴이 남습니다.',
  },
  {
    id: 'etching',
    label: '식각 (Etching)',
    color: '#f85149',
    description: '불필요한 박막을 정교하게 제거하는 공정입니다.',
    detail: '플라즈마(건식) 또는 화학 용액(습식)으로 회로 패턴 외 박막을 선택적으로 제거합니다. 이방성 식각으로 수직 프로파일을 유지합니다.',
  },
  {
    id: 'cleaning',
    label: '세정 (Cleaning)',
    color: '#3fb950',
    description: '공정 후 잔류 오염물을 제거하는 공정입니다.',
    detail: 'SC-1(NH₄OH+H₂O₂), SC-2(HCl+H₂O₂), DHF 등 화학 용액과 탈이온수(DI Water)로 파티클·금속 불순물·PR 잔류물을 제거합니다.',
  },
];

/* ── 레이어 구성 ────────────────────────────────────── */
interface Layer {
  label: string;
  color: string;
  height: number;
  visible: boolean;
  opacity: number;
}

function getLayers(step: ProcessStep, animT: number): Layer[] {
  const t = Math.min(animT, 1);

  switch (step) {
    case 'deposition':
      return [
        { label: '웨이퍼 (Si)', color: '#4b5563', height: 60, visible: true,  opacity: 1 },
        { label: '박막 (Oxide)', color: '#3b82f6', height: 24, visible: true,  opacity: 1 },
        { label: '증착층',       color: '#a855f7', height: Math.round(20 * t), visible: t > 0.05, opacity: t },
      ];
    case 'exposure':
      return [
        { label: '웨이퍼 (Si)', color: '#4b5563', height: 60, visible: true, opacity: 1 },
        { label: '박막 (Oxide)', color: '#3b82f6', height: 24, visible: true, opacity: 1 },
        { label: '감광액 (PR)', color: '#22c55e', height: 20, visible: true, opacity: 1 },
        { label: '노광된 PR',   color: '#f97316', height: 20, visible: true, opacity: t },
      ];
    case 'etching':
      return [
        { label: '웨이퍼 (Si)', color: '#4b5563', height: 60, visible: true, opacity: 1 },
        { label: '박막 (Oxide)', color: '#3b82f6', height: 24, visible: true, opacity: 1 - t * 0.6 },
        { label: '감광액 (PR)', color: '#22c55e', height: 20, visible: true, opacity: 1 },
      ];
    case 'cleaning':
      return [
        { label: '웨이퍼 (Si)', color: '#4b5563', height: 60, visible: true, opacity: 1 },
        { label: '박막 (Oxide)', color: '#3b82f6', height: 24, visible: true, opacity: 1 },
        { label: '잔류물',       color: '#6b7280', height: 6,  visible: t < 0.8, opacity: 1 - t },
      ];
  }
}

/* ── 파티클 ────────────────────────────────────────── */
interface Particle { x: number; y: number; vx: number; vy: number; r: number; life: number; }

function makeParticle(step: ProcessStep, canvasW: number): Particle {
  return {
    x: Math.random() * canvasW,
    y: -10,
    vx: (Math.random() - 0.5) * 0.5,
    vy: step === 'cleaning' ? -1.5 - Math.random() : 1.2 + Math.random() * 0.8,
    r: 2 + Math.random() * 3,
    life: 1,
  };
}

/* ── 메인 컴포넌트 ─────────────────────────────────── */
export function ProcessViewer() {
  const [stepIdx, setStepIdx] = useState(0);
  const [animT,   setAnimT]   = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const tRef      = useRef(0);

  const step = STEPS[stepIdx];
  const W = 640, H = 220;

  // 애니메이션 루프
  useEffect(() => {
    tRef.current = 0;
    setAnimT(0);
    setParticles([]);

    const tick = () => {
      tRef.current += 0.008;
      setAnimT(Math.min(tRef.current, 1));
      setParticles(prev => {
        const next = prev
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.005 }))
          .filter(p => p.life > 0 && p.y < H + 10 && p.y > -20);
        if (next.length < 120) next.push(makeParticle(step.id, W));
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stepIdx]);

  // Canvas 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    const layers = getLayers(step.id, animT);
    const totalH = layers.filter(l => l.visible).reduce((s, l) => s + l.height, 0);
    let y = (H + totalH) / 2;

    // 레이어 렌더 (아래→위)
    [...layers].reverse().forEach(layer => {
      if (!layer.visible || layer.height === 0) return;
      y -= layer.height;
      ctx.globalAlpha = layer.opacity;
      ctx.fillStyle = layer.color;

      // 패턴 효과 (식각: 세그먼트 분리)
      if (step.id === 'etching' && layer.label === '박막 (Oxide)') {
        const seg = 5;
        const sw = (W - 120) / seg;
        for (let i = 0; i < seg; i++) {
          ctx.fillRect(60 + i * sw + 2, y, sw - 4, layer.height);
        }
      } else {
        ctx.fillRect(60, y, W - 120, layer.height);
      }

      // 레이어 레이블
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(layer.label, 52, y + layer.height / 2 + 4);
      ctx.globalAlpha = 1;
    });

    // 파티클
    particles.forEach(p => {
      ctx.globalAlpha = p.life * 0.8;
      const color =
        step.id === 'deposition' ? '#c084fc' :
        step.id === 'exposure'   ? '#fbbf24' :
        step.id === 'etching'    ? '#f87171' : '#6ee7b7';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }, [particles, animT, stepIdx]);

  const prev = () => { setStepIdx(i => Math.max(0, i - 1)); };
  const next = () => { setStepIdx(i => Math.min(STEPS.length - 1, i + 1)); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 32 }}>
      {/* 제목 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#e6edf3', marginBottom: 6 }}>
          반도체 4대 공정 과정
        </div>
        <div style={{ fontSize: 13, color: '#8b949e' }}>각 단계를 클릭해 인터랙티브 애니메이션 확인</div>
      </div>

      {/* 스텝 탭 */}
      <div style={{ display: 'flex', gap: 8 }}>
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStepIdx(i)}
            style={{
              padding: '8px 18px',
              borderRadius: 20,
              border: `1px solid ${i === stepIdx ? s.color : '#30363d'}`,
              background: i === stepIdx ? s.color + '22' : '#161b22',
              color: i === stepIdx ? s.color : '#8b949e',
              fontWeight: i === stepIdx ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {s.label.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* 캔버스 */}
      <div style={{
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: 12,
        padding: '12px 0',
        position: 'relative',
      }}>
        <canvas ref={canvasRef} width={W} height={H} />
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', gap: 20 }}>
        {getLayers(step.id, 1).map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
            <span style={{ fontSize: 11, color: '#8b949e' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* 설명 */}
      <div style={{
        maxWidth: 600,
        background: '#161b22',
        border: `1px solid ${step.color}44`,
        borderLeft: `3px solid ${step.color}`,
        borderRadius: 8,
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: step.color }}>
            현재 공정: {step.label}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={prev} disabled={stepIdx === 0}
              style={{ background: '#21262d', border: '1px solid #30363d', color: stepIdx === 0 ? '#30363d' : '#e6edf3', borderRadius: 6, padding: '4px 10px', cursor: stepIdx === 0 ? 'default' : 'pointer' }}>
              ‹
            </button>
            <button onClick={next} disabled={stepIdx === STEPS.length - 1}
              style={{ background: '#21262d', border: '1px solid #30363d', color: stepIdx === STEPS.length - 1 ? '#30363d' : '#e6edf3', borderRadius: 6, padding: '4px 10px', cursor: stepIdx === STEPS.length - 1 ? 'default' : 'pointer' }}>
              ›
            </button>
          </div>
        </div>
        <p style={{ fontSize: 14, color: '#e6edf3', marginBottom: 8 }}>{step.description}</p>
        <p style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.7 }}>{step.detail}</p>
      </div>

      {/* 하단 공정 단계 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div
              onClick={() => setStepIdx(i)}
              style={{
                padding: '6px 12px',
                background: i === stepIdx ? '#21262d' : 'transparent',
                border: `1px solid ${i === stepIdx ? '#30363d' : 'transparent'}`,
                borderRadius: 6,
                color: i <= stepIdx ? s.color : '#30363d',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: i === stepIdx ? 700 : 400,
              }}
            >
              {i + 1}. {s.label.split(' ')[0]}
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ color: '#30363d', fontSize: 16, margin: '0 2px' }}>→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
