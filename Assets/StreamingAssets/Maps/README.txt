OHT Simulation Map Files Directory
==================================

Place your exported XML map files from the React-Konva web editor in this directory.
The simulation loader will automatically detect all .xml files in this folder and make them available in the Map Selection UI.

XML Format Guidelines:
- Root element must be <OHTMap version="...">
- Under <Nodes>, each <Node> must have attributes: id, x, y, and type.
- Allowed Node types match the NodeType enum:
  - Normal
  - Deposition
  - Exposure
  - Etching
  - Cleaning
  - Depot
- Under <Edges>, each <Edge> must have attributes: id, from, to, and weight.
- Edges should represent directed connections between nodes to form the OHT rail network topology.
