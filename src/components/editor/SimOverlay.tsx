import { Layer, Rect, Circle, Text, Arrow, Group } from 'react-konva';
import { useSimRunStore } from '../../store/simRunStore';

const PROCESS_CYCLE = ['증착', '노광', '식각', '세정'];

const STATE_COLOR: Record<string, string> = {
  Idle:       '#8b949e',
  Moving:     '#58a6ff',
  Processing: '#3fb950',
};

export function SimOverlay() {
  const { agents, running, congestion } = useSimRunStore();
  if (!running) return null;

  return (
    <Layer>
      {/* 혼잡도 히트맵 */}
      {[...congestion.entries()].map(([nodeId, cong]) => {
        if (cong < 0.1) return null;
        const agent = agents.find(a => a.currentNode.id === nodeId);
        if (!agent?.currentNode) return null;
        const { x, y } = agent.currentNode;
        return (
          <Circle
            key={`cong-${nodeId}`}
            x={x} y={y}
            radius={28 + cong * 16}
            fill={`rgba(248,81,73,${cong * 0.15})`}
            listening={false}
          />
        );
      })}

      {/* 경로 미리보기 */}
      {agents.map(agent => {
        if (agent.state !== 'Moving' || agent.path.length < 2) return null;
        const remaining = agent.path.slice(agent.pathIndex);
        if (remaining.length < 2) return null;
        const points: number[] = [];
        remaining.forEach(n => { points.push(n.x, n.y); });
        return (
          <Arrow
            key={`path-${agent.id}`}
            points={points}
            stroke={agent.color}
            strokeWidth={1.5}
            opacity={0.25}
            dash={[4, 4]}
            fill={agent.color}
            pointerLength={6}
            pointerWidth={5}
            listening={false}
          />
        );
      })}

      {/* 에이전트 */}
      {agents.map(agent => {
        let ax = agent.currentNode.x;
        let ay = agent.currentNode.y;
        if (agent.nextNode) {
          ax = agent.currentNode.x + (agent.nextNode.x - agent.currentNode.x) * agent.progress;
          ay = agent.currentNode.y + (agent.nextNode.y - agent.currentNode.y) * agent.progress;
        }

        const stageLabel = PROCESS_CYCLE[agent.processStage % 4];

        return (
          <Group key={agent.id} x={ax} y={ay} listening={false}>
            <Rect
              x={-12} y={-12} width={24} height={24}
              fill={agent.color}
              stroke="#0d1117"
              strokeWidth={2}
              cornerRadius={5}
            />
            <Text
              text={agent.id.replace('OHT-', '')}
              fontSize={10} fontStyle="bold"
              fill="#0d1117"
              width={24} x={-12} y={-6}
              align="center"
              listening={false}
            />
            {/* 현재 공정 단계 표시 */}
            <Text
              text={stageLabel}
              fontSize={8}
              fill="#e6edf3"
              width={36} x={-18} y={14}
              align="center"
              listening={false}
            />
            <Circle
              x={12} y={-12} radius={5}
              fill={STATE_COLOR[agent.state] ?? '#8b949e'}
              stroke="#0d1117" strokeWidth={1.5}
            />
            {agent.state === 'Processing' && (
              <Circle
                x={0} y={0} radius={18}
                fill="transparent"
                stroke={STATE_COLOR['Processing']}
                strokeWidth={2}
                opacity={0.6}
              />
            )}
          </Group>
        );
      })}
    </Layer>
  );
}
