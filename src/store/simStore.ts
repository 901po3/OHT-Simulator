import { create } from 'zustand';
import { buildGraph } from '../core/graph/RailGraph';
import { createAgent, assignJob, tickAgent } from '../core/oht/OHTAgent';
import type { OHTAgent } from '../core/oht/OHTAgent';
import type { RailNode } from '../core/graph/types';
import { nodesDef, edgesDef } from '../simulation/mapPreset';

interface SimState {
  nodes: Map<string, RailNode>;
  agents: OHTAgent[];
  running: boolean;
  speed: number;
  stats: { completed: number; tick: number };

  init: () => void;
  start: () => void;
  pause: () => void;
  setSpeed: (s: number) => void;
  tick: (dt: number) => void;
  spawnJob: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  nodes: new Map(),
  agents: [],
  running: false,
  speed: 1,
  stats: { completed: 0, tick: 0 },

  init() {
    const nodes = buildGraph(nodesDef, edgesDef);

    // 창고 노드를 시작점으로 에이전트 4대 배치
    const warehouses = [...nodes.values()].filter(n => n.type === 'Warehouse');
    const normals    = [...nodes.values()].filter(n => n.type === 'Normal');

    const agents: OHTAgent[] = warehouses.map((wh, i) =>
      createAgent(`OHT-${i + 1}`, normals[i * 3] ?? wh, i)
    );

    set({ nodes, agents, stats: { completed: 0, tick: 0 } });
  },

  start: () => set({ running: true }),
  pause: () => set({ running: false }),
  setSpeed: (s) => set({ speed: s }),

  tick(dt) {
    const { agents, stats, speed } = get();
    const scaledDt = dt * speed;
    const occupied = new Set(agents.map(a => a.currentNode.id));

    let completed = stats.completed;

    for (const agent of agents) {
      const prevState = agent.state;
      tickAgent(agent, scaledDt, occupied);
      if (prevState === 'Unloading' && agent.state === 'Idle') completed++;
    }

    set({ agents: [...agents], stats: { completed, tick: stats.tick + 1 } });
  },

  spawnJob() {
    const { agents, nodes } = get();
    const idle = agents.find(a => a.state === 'Idle');
    if (!idle) return;

    const warehouses = [...nodes.values()].filter(n => n.type === 'Warehouse');
    const deliveries = [...nodes.values()].filter(n => n.type === 'Delivery');
    if (warehouses.length === 0 || deliveries.length === 0) return;

    const from = warehouses[Math.floor(Math.random() * warehouses.length)];
    const to   = deliveries[Math.floor(Math.random() * deliveries.length)];
    assignJob(idle, from, to);
    set({ agents: [...agents] });
  },
}));
