// 6×6 단순 격자 맵 (데모용)
const CELL = 80; // px per cell

export const nodesDef = (() => {
  const nodes = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const id = `N-${r}-${c}`;
      let type: 'Normal' | 'Warehouse' | 'Delivery' = 'Normal';
      if (r === 0 && (c === 0 || c === 5)) type = 'Warehouse';
      if (r === 5 && (c === 0 || c === 5)) type = 'Delivery';
      nodes.push({ id, x: c * CELL + CELL, y: r * CELL + CELL, type });
    }
  }
  return nodes;
})();

export const edgesDef = (() => {
  const edges = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const from = `N-${r}-${c}`;
      if (c < 5) {
        edges.push({ from, to: `N-${r}-${c + 1}` });
        edges.push({ from: `N-${r}-${c + 1}`, to: from });
      }
      if (r < 5) {
        edges.push({ from, to: `N-${r + 1}-${c}` });
        edges.push({ from: `N-${r + 1}-${c}`, to: from });
      }
    }
  }
  return edges;
})();
