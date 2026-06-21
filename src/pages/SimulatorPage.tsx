import { useEffect, useRef, useState } from 'react';
import { SimCanvas } from '../components/canvas/SimCanvas';
import { ControlPanel } from '../components/ui/ControlPanel';
import { AgentPanel } from '../components/panels/AgentPanel';
import { useSimStore } from '../store/simStore';

export function SimulatorPage() {
  const { init, tick, running } = useSimStore();
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - 48 - 52 });

  useEffect(() => {
    init();
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight - 48 - 52 });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const loop = (time: number) => {
      if (running) {
        const dt = lastTimeRef.current != null
          ? Math.min((time - lastTimeRef.current) / 1000, 0.05)
          : 0;
        lastTimeRef.current = time;
        tick(dt);
      } else {
        lastTimeRef.current = null;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, tick]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      <ControlPanel />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
          <SimCanvas width={size.w - 220} height={size.h} />
        </div>
        <AgentPanel />
      </div>
    </div>
  );
}
