import { useSimStore } from '../../store/simStore';

const STATE_COLOR: Record<string, string> = {
  Idle:      '#8b949e',
  Moving:    '#58a6ff',
  Loading:   '#d29922',
  Unloading: '#3fb950',
};

export function AgentPanel() {
  const { agents } = useSimStore();

  return (
    <div style={{
      width: 220,
      background: '#161b22',
      borderLeft: '1px solid #30363d',
      padding: 16,
      overflowY: 'auto',
    }}>
      <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
        OHT 상태
      </div>
      {agents.map(agent => (
        <div key={agent.id} style={{
          background: '#21262d',
          border: `1px solid #30363d`,
          borderRadius: 8,
          padding: 10,
          marginBottom: 8,
          borderLeft: `3px solid ${agent.color}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#e6edf3', fontSize: 13 }}>{agent.id}</span>
            <span style={{
              fontSize: 10,
              background: `${STATE_COLOR[agent.state]}22`,
              color: STATE_COLOR[agent.state],
              padding: '2px 6px',
              borderRadius: 4,
              fontWeight: 600,
            }}>
              {agent.state}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
            현재: {agent.currentNode.id}
          </div>
          {agent.job && (
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
              작업: {agent.job.from.id} → {agent.job.to.id}
            </div>
          )}
          {agent.state === 'Moving' && (
            <div style={{ marginTop: 6 }}>
              <div style={{ height: 3, background: '#30363d', borderRadius: 2 }}>
                <div style={{
                  height: '100%',
                  width: `${(agent.pathIndex / Math.max(agent.path.length - 1, 1)) * 100}%`,
                  background: agent.color,
                  borderRadius: 2,
                  transition: 'width 0.1s',
                }} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
