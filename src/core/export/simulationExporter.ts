/**
 * Unity 3D 시뮬레이션용 최종 시뮬레이션 데이터를 XML로 내보냄
 * C# Serializable 구조와 매칭되는 깔끔한 계층 구조
 */

export interface ExportableSimulation {
  mapMetadata: MapMetadata;
  nodes: ExportNode[];
  edges: ExportEdge[];
  processStations: ProcessStation[];
  depots: DepotStation[];
  optimizationHints: OptimizationHints;
}

interface MapMetadata {
  name: string;
  cols: number;
  rows: number;
  totalNodes: number;
  totalEdges: number;
  gridType: 'one-way' | 'bidirectional';
  description: string;
  exportedAt: string;
}

interface ExportNode {
  id: string;
  x: number;
  y: number;
  type: 'Normal' | 'Process' | 'Depot';
  processType?: string; // '증착' | '노광' | '식각' | '세정'
  capacity: number;
}

interface ExportEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  direction: 'Forward' | 'Backward' | 'Bidirectional';
  cost: number;
  isOneWay: boolean;
}

interface ProcessStation {
  nodeId: string;
  stationType: string; // '증착' | '노광' | '식각' | '세정'
  processingTimeMs: number;
  position: { x: number; y: number };
  count: number; // 이 타입의 스테이션 개수
}

interface DepotStation {
  nodeId: string;
  position: { x: number; y: number };
  spawnRatePerSec: number;
  maxRobots: number;
}

interface OptimizationHints {
  optimalRobotCount: number;
  recommendedRobotRange: { min: number; max: number };
  avgMoveDistance: number;
  congestionLevel: number;
  processUtilizationTarget: number;
  algorithmUsed: string;
}

export function generateSimulationXML(
  nodes: any[],
  edges: any[],
  optimalRobotCount: number,
  avgMoveDistance: number,
  congestionLevel: number,
  processNodeCount: number,
  algorithmId: string,
): string {
  const PROC_CYCLE = ['증착', '노광', '식각', '세정'];

  // 메타데이터
  const mapMetadata: MapMetadata = {
    name: '초대형 팹 ∞ — 단방향 교차 그리드',
    cols: 20,
    rows: 16,
    totalNodes: nodes.length,
    totalEdges: edges.length,
    gridType: 'one-way',
    description: '반도체 OHT 시뮬레이션용 단방향 그리드. 모든 노드 상호 도달 가능(강결합), 정면충돌 불가능.',
    exportedAt: new Date().toISOString(),
  };

  // 노드 변환
  const exportNodes: ExportNode[] = nodes.map(n => {
    let type: 'Normal' | 'Process' | 'Depot' = 'Normal';
    let processType: string | undefined;

    if (n.type === 'Depot') {
      type = 'Depot';
    } else if (PROC_CYCLE.includes(n.type)) {
      type = 'Process';
      processType = n.type;
    }

    return {
      id: n.id,
      x: n.x,
      y: n.y,
      type,
      processType,
      capacity: type === 'Process' ? 1 : 0,
    };
  });

  // 엣지 변환
  const exportEdges: ExportEdge[] = edges.map((e, idx) => {
    const fromNodeId = typeof e.from === 'string' ? e.from : (typeof e.fromId === 'string' ? e.fromId : String(e.fromId));
    const toNodeId = typeof e.to === 'string' ? e.to : (typeof e.toId === 'string' ? e.toId : String(e.toId));
    return {
      id: e.id || `edge_${idx}`,
      fromNodeId,
      toNodeId,
      direction: 'Forward',
      cost: 1,
      isOneWay: true,
    };
  });

  // 공정 스테이션 집계
  const stationsByType = new Map<string, { nodeIds: Set<string>; positions: Array<{ x: number; y: number }> }>();
  for (const proc of PROC_CYCLE) {
    stationsByType.set(proc, { nodeIds: new Set(), positions: [] });
  }
  for (const n of nodes) {
    if (PROC_CYCLE.includes(n.type)) {
      const entry = stationsByType.get(n.type)!;
      entry.nodeIds.add(n.id);
      entry.positions.push({ x: n.x, y: n.y });
    }
  }
  const processStations: ProcessStation[] = Array.from(stationsByType.entries()).map(([type, data]) => ({
    nodeId: Array.from(data.nodeIds)[0] || '',
    stationType: type,
    processingTimeMs: 1500,
    position: data.positions[0] || { x: 0, y: 0 },
    count: data.nodeIds.size,
  }));

  // 차고지 스테이션
  const depots: DepotStation[] = nodes
    .filter(n => n.type === 'Depot')
    .map(n => ({
      nodeId: n.id,
      position: { x: n.x, y: n.y },
      spawnRatePerSec: 2,
      maxRobots: 100,
    }));

  // 최적화 힌트
  const optimizationHints: OptimizationHints = {
    optimalRobotCount: Math.max(optimalRobotCount, processNodeCount),
    recommendedRobotRange: {
      min: Math.ceil(processNodeCount * 1.0),
      max: Math.ceil(processNodeCount * 1.5),
    },
    avgMoveDistance,
    congestionLevel,
    processUtilizationTarget: 0.7,
    algorithmUsed: algorithmId,
  };

  // XML 생성
  const xml = buildXML({
    mapMetadata,
    nodes: exportNodes,
    edges: exportEdges,
    processStations,
    depots,
    optimizationHints,
  });

  return xml;
}

function buildXML(data: ExportableSimulation): string {
  const lines: string[] = ['<?xml version="1.0" encoding="utf-8"?>'];
  lines.push('<OHTSimulation>');

  // MapMetadata
  lines.push('  <MapMetadata>');
  lines.push(`    <Name>${escape(data.mapMetadata.name)}</Name>`);
  lines.push(`    <Cols>${data.mapMetadata.cols}</Cols>`);
  lines.push(`    <Rows>${data.mapMetadata.rows}</Rows>`);
  lines.push(`    <TotalNodes>${data.mapMetadata.totalNodes}</TotalNodes>`);
  lines.push(`    <TotalEdges>${data.mapMetadata.totalEdges}</TotalEdges>`);
  lines.push(`    <GridType>${data.mapMetadata.gridType}</GridType>`);
  lines.push(`    <Description>${escape(data.mapMetadata.description)}</Description>`);
  lines.push(`    <ExportedAt>${data.mapMetadata.exportedAt}</ExportedAt>`);
  lines.push('  </MapMetadata>');

  // Nodes
  lines.push('  <Nodes>');
  for (const node of data.nodes) {
    lines.push(`    <Node Id="${node.id}" Type="${node.type}" X="${node.x}" Y="${node.y}"${node.processType ? ` ProcessType="${node.processType}"` : ''} />`);
  }
  lines.push('  </Nodes>');

  // Edges
  lines.push('  <Edges>');
  for (const edge of data.edges) {
    lines.push(
      `    <Edge Id="${edge.id}" From="${edge.fromNodeId}" To="${edge.toNodeId}" Direction="${edge.direction}" Cost="${edge.cost}" IsOneWay="${edge.isOneWay}" />`,
    );
  }
  lines.push('  </Edges>');

  // ProcessStations
  lines.push('  <ProcessStations>');
  for (const station of data.processStations) {
    lines.push(
      `    <Station NodeId="${station.nodeId}" Type="${station.stationType}" ProcessingTimeMs="${station.processingTimeMs}" Count="${station.count}" X="${station.position.x}" Y="${station.position.y}" />`,
    );
  }
  lines.push('  </ProcessStations>');

  // Depots
  lines.push('  <Depots>');
  for (const depot of data.depots) {
    lines.push(`    <Depot NodeId="${depot.nodeId}" SpawnRatePerSec="${depot.spawnRatePerSec}" MaxRobots="${depot.maxRobots}" X="${depot.position.x}" Y="${depot.position.y}" />`);
  }
  lines.push('  </Depots>');

  // OptimizationHints
  lines.push('  <OptimizationHints>');
  lines.push(`    <OptimalRobotCount>${data.optimizationHints.optimalRobotCount}</OptimalRobotCount>`);
  lines.push(
    `    <RecommendedRobotMin>${data.optimizationHints.recommendedRobotRange.min}</RecommendedRobotMin>`,
  );
  lines.push(
    `    <RecommendedRobotMax>${data.optimizationHints.recommendedRobotRange.max}</RecommendedRobotMax>`,
  );
  lines.push(`    <AvgMoveDistance>${data.optimizationHints.avgMoveDistance}</AvgMoveDistance>`);
  lines.push(`    <CongestionLevel>${data.optimizationHints.congestionLevel}</CongestionLevel>`);
  lines.push(`    <ProcessUtilizationTarget>${data.optimizationHints.processUtilizationTarget}</ProcessUtilizationTarget>`);
  lines.push(`    <AlgorithmUsed>${data.optimizationHints.algorithmUsed}</AlgorithmUsed>`);
  lines.push('  </OptimizationHints>');

  lines.push('</OHTSimulation>');
  return lines.join('\n');
}

function escape(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
