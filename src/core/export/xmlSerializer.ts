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

/**
 * XML을 파일로 다운로드합니다.
 *
 * @param xml XML 콘텐츠 문자열
 * @param filename 저장할 파일명 (확장자 포함, 예: "map.xml")
 *
 * 사용 예:
 *   const xml = exportToXml(nodes, edges);
 *   downloadXml(xml, 'my-custom-map.xml');
 *
 * 경로 안내:
 *   Assets/StreamingAssets/Maps/{filename}
 */
export function downloadXml(xml: string, filename = 'oht_map.xml') {
  // 파일명에 .xml 확장자가 없으면 추가
  const finalFilename = filename.endsWith('.xml') ? filename : `${filename}.xml`;

  const blob = new Blob([xml], { type: 'application/xml; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;

  // 다운로드 트리거 (모던 브라우저 대응)
  if (document.body.contains(link)) {
    link.click();
  } else {
    // IE 또는 구형 브라우저 대응
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 메모리 정리
  URL.revokeObjectURL(url);
}
