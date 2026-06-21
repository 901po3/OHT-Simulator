import { useSimStore } from '../../store/simStore';

const btn = (color: string) => ({
  padding: '8px 18px',
  borderRadius: 6,
  border: 'none',
  background: color,
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 13,
} as const);

export function ControlPanel() {
  const { running, speed, stats, start, pause, setSpeed, spawnJob } = useSimStore();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 20px',
      background: '#161b22',
      borderBottom: '1px solid #30363d',
      flexWrap: 'wrap',
    }}>
      <button style={btn('#1f6feb')} onClick={running ? pause : start}>
        {running ? '⏸ Pause' : '▶ Start'}
      </button>

      <button style={btn('#238636')} onClick={spawnJob}>
        + Job
      </button>

      <label style={{ color: '#8b949e', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
        Speed ×{speed.toFixed(1)}
        <input
          type="range" min={0.5} max={5} step={0.5}
          value={speed}
          onChange={e => setSpeed(parseFloat(e.target.value))}
          style={{ width: 100 }}
        />
      </label>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 24 }}>
        <Stat label="완료 작업" value={stats.completed} color="#3fb950" />
        <Stat label="틱" value={stats.tick} color="#58a6ff" />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8b949e' }}>{label}</div>
    </div>
  );
}
