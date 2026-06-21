import type { RailNode } from '../graph/types';
import { aStar } from '../pathfinding/AStar';

export type OHTState = 'Idle' | 'Moving' | 'Loading' | 'Unloading';

export interface OHTAgent {
  id: string;
  color: string;
  currentNode: RailNode;
  nextNode: RailNode | null;
  path: RailNode[];
  pathIndex: number;
  state: OHTState;
  progress: number; // 0~1 between currentNode → nextNode
  job: { from: RailNode; to: RailNode } | null;
  stateTimer: number;
}

const LOAD_TIME  = 1.0; // seconds
const UNLOAD_TIME = 1.0;

const COLORS = ['#58a6ff','#3fb950','#ffa657','#bc8cff','#f85149','#39d353','#d29922','#58a6ff'];

export function createAgent(id: string, startNode: RailNode, colorIndex: number): OHTAgent {
  return {
    id,
    color: COLORS[colorIndex % COLORS.length],
    currentNode: startNode,
    nextNode: null,
    path: [],
    pathIndex: 0,
    state: 'Idle',
    progress: 0,
    job: null,
    stateTimer: 0,
  };
}

export function assignJob(agent: OHTAgent, from: RailNode, to: RailNode): void {
  agent.job = { from, to };
  const path = aStar(agent.currentNode, from);
  agent.path = path;
  agent.pathIndex = 0;
  agent.state = 'Moving';
}

const SPEED = 2.0; // nodes per second

export function tickAgent(agent: OHTAgent, dt: number, occupied: Set<string>): void {
  agent.stateTimer += dt;

  if (agent.state === 'Loading') {
    if (agent.stateTimer >= LOAD_TIME) {
      agent.stateTimer = 0;
      if (agent.job) {
        const path = aStar(agent.currentNode, agent.job.to);
        agent.path = path;
        agent.pathIndex = 0;
        agent.state = 'Moving';
      }
    }
    return;
  }

  if (agent.state === 'Unloading') {
    if (agent.stateTimer >= UNLOAD_TIME) {
      agent.stateTimer = 0;
      agent.job = null;
      agent.state = 'Idle';
    }
    return;
  }

  if (agent.state !== 'Moving' || agent.path.length === 0) return;

  // 다음 노드로 이동
  if (agent.nextNode === null) {
    const nextIdx = agent.pathIndex + 1;
    if (nextIdx >= agent.path.length) {
      // 목적지 도착
      if (agent.job && agent.currentNode === agent.job.from) {
        agent.state = 'Loading';
        agent.stateTimer = 0;
      } else if (agent.job && agent.currentNode === agent.job.to) {
        agent.state = 'Unloading';
        agent.stateTimer = 0;
      } else {
        agent.state = 'Idle';
      }
      return;
    }

    const candidate = agent.path[nextIdx];
    if (occupied.has(candidate.id)) return; // 대기

    agent.nextNode = candidate;
    agent.progress = 0;
    occupied.delete(agent.currentNode.id);
    occupied.add(candidate.id);
  }

  agent.progress += dt * SPEED;
  if (agent.progress >= 1) {
    agent.currentNode = agent.nextNode!;
    agent.nextNode = null;
    agent.pathIndex++;
    agent.progress = 0;
  }
}
