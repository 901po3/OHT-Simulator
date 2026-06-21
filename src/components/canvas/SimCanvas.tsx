import React from 'react';
import { Stage, Layer, Circle, Line, Text, Rect } from 'react-konva';
import { useSimStore } from '../../store/simStore';

const NODE_R = 12;

const NODE_COLOR: Record<string, string> = {
  Normal:       '#21262d',
  Warehouse:    '#1f6feb',
  Delivery:     '#238636',
  Intersection: '#9e6a03',
  Depot:        '#8b949e',
};

const NODE_BORDER: Record<string, string> = {
  Normal:       '#30363d',
  Warehouse:    '#58a6ff',
  Delivery:     '#3fb950',
  Intersection: '#d29922',
  Depot:        '#6e7681',
};

const STATE_COLOR: Record<string, string> = {
  Idle:      '#8b949e',
  Moving:    '#58a6ff',
  Loading:   '#d29922',
  Unloading: '#3fb950',
};

export function SimCanvas({ width, height }: { width: number; height: number }) {
  const { nodes, agents } = useSimStore();

  const nodeList = [...nodes.values()];

  // 엣지 렌더 (중복 방지: from.id < to.id 만)
  const edgeLines: React.JSX.Element[] = [];
  const seen = new Set<string>();
  for (const node of nodeList) {
    for (const edge of node.edges) {
      const key = [node.id, edge.to.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edgeLines.push(
        <Line
          key={key}
          points={[node.x, node.y, edge.to.x, edge.to.y]}
          stroke="#30363d"
          strokeWidth={2}
        />
      );
    }
  }

  return (
    <Stage width={width} height={height}>
      <Layer>
        {/* 엣지 */}
        {edgeLines}

        {/* 노드 */}
        {nodeList.map(node => (
          <React.Fragment key={node.id}>
            <Circle
              x={node.x} y={node.y} radius={NODE_R}
              fill={NODE_COLOR[node.type] ?? '#21262d'}
              stroke={NODE_BORDER[node.type] ?? '#30363d'}
              strokeWidth={2}
            />
            {node.type !== 'Normal' && (
              <Text
                x={node.x - 20} y={node.y + NODE_R + 2}
                text={node.type[0]}
                fontSize={10}
                fill={NODE_BORDER[node.type]}
                width={40}
                align="center"
              />
            )}
          </React.Fragment>
        ))}

        {/* OHT 에이전트 */}
        {agents.map(agent => {
          let ax = agent.currentNode.x;
          let ay = agent.currentNode.y;

          if (agent.nextNode) {
            ax = agent.currentNode.x + (agent.nextNode.x - agent.currentNode.x) * agent.progress;
            ay = agent.currentNode.y + (agent.nextNode.y - agent.currentNode.y) * agent.progress;
          }

          return (
            <React.Fragment key={agent.id}>
              <Rect
                x={ax - 10} y={ay - 10}
                width={20} height={20}
                fill={agent.color}
                stroke="#0d1117"
                strokeWidth={2}
                cornerRadius={4}
              />
              <Text
                x={ax - 12} y={ay - 7}
                text={agent.id.replace('OHT-', '')}
                fontSize={10}
                fill="#0d1117"
                fontStyle="bold"
                width={24}
                align="center"
              />
              {/* 상태 표시 점 */}
              <Circle
                x={ax + 10} y={ay - 10}
                radius={4}
                fill={STATE_COLOR[agent.state]}
              />
            </React.Fragment>
          );
        })}
      </Layer>
    </Stage>
  );
}

