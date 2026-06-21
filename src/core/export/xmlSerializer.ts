import type { EditorNode, EditorEdge } from '../../store/editorStore';

export function exportToXml(nodes: EditorNode[], edges: EditorEdge[]): string {
  const nodeLines = nodes.map(n =>
    `    <Node id="${n.id}" type="${n.type}" x="${n.x.toFixed(2)}" y="${n.y.toFixed(2)}" />`
  ).join('\n');

  const edgeLines = edges.map(e =>
    `    <Edge id="${e.id}" from="${e.fromId}" to="${e.toId}" weight="1" />`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<OHTMap version="1.0" createdAt="${new Date().toISOString()}">
  <Nodes count="${nodes.length}">
${nodeLines}
  </Nodes>
  <Edges count="${edges.length}">
${edgeLines}
  </Edges>
</OHTMap>`;
}

export function downloadXml(xml: string, filename = 'oht_map.xml') {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
