using System.Collections.Generic;
using UnityEngine;

namespace OHTSim.Core
{
    // 웹 에디터 XML 포맷과 1:1 대응하는 데이터 클래스
    // xmlSerializer.ts의 OHTMap 포맷 기준

    public enum NodeType { Normal, Deposition, Exposure, Etching, Cleaning, Depot }

    [System.Serializable]
    public class MapNode
    {
        public string id;
        public NodeType type;
        public float x;
        public float y;

        // 인접 엣지 — BuildAdjacency() 호출 후 채워짐 (PathfindingBridge용)
        [System.NonSerialized]
        public List<MapEdge> edges = new();

        // 3D 월드 좌표 (y축이 Unity에서 깊이 방향)
        public Vector3 WorldPosition(float scale = 0.01f)
            => new Vector3(x * scale, 0f, -y * scale);
    }

    [System.Serializable]
    public class MapEdge
    {
        public string id;
        public string fromId;
        public string toId;
        public float weight;

        // PathfindingBridge가 참조하는 목적지 노드 (BuildAdjacency 후 유효)
        [System.NonSerialized]
        public MapNode to;
    }

    [System.Serializable]
    public class OHTMapData
    {
        public string version;
        public List<MapNode> nodes = new();
        public List<MapEdge> edges = new();

        public MapNode FindNode(string id)
            => nodes.Find(n => n.id == id);

        // 파싱 후 한 번 호출 — PathfindingBridge와 AgentController용 인접 리스트 구성
        public void BuildAdjacency()
        {
            var nodeMap = new Dictionary<string, MapNode>();
            foreach (var n in nodes) { n.edges.Clear(); nodeMap[n.id] = n; }

            foreach (var e in edges)
            {
                e.to = nodeMap.TryGetValue(e.toId, out var toNode) ? toNode : null;
                if (nodeMap.TryGetValue(e.fromId, out var fromNode) && e.to != null)
                    fromNode.edges.Add(e);
            }
        }
    }
}
