using System.Collections.Generic;
using UnityEngine;

namespace OHTSim.Core
{
    // OHTMapData → 3D 씬 오브젝트 생성
    // 웹 에디터 NODE_META 색상과 1:1 대응
    public class MapBuilder : MonoBehaviour
    {
        [Header("노드 프리팹 (없으면 Primitive 자동 생성)")]
        public GameObject nodePrefab;
        public GameObject edgePrefab;   // LineRenderer 포함 프리팹 (없으면 자동 생성)

        [Header("노드 스케일")]
        public float nodeRadius  = 0.3f;
        public float mapScale    = 0.01f;  // 웹 px → Unity 단위 변환

        // 타입별 색상 (웹 NODE_META 기준)
        static readonly Dictionary<NodeType, Color> NodeColors = new()
        {
            { NodeType.Normal,     HexColor("#58a6ff") },
            { NodeType.Deposition, HexColor("#bc8cff") },
            { NodeType.Exposure,   HexColor("#ffa657") },
            { NodeType.Etching,    HexColor("#f85149") },
            { NodeType.Cleaning,   HexColor("#3fb950") },
            { NodeType.Depot,      HexColor("#8b949e") },
        };

        readonly Dictionary<string, GameObject> _nodeObjects = new();
        GameObject _mapRoot;

        public void Build(OHTMapData data)
        {
            Clear();
            _mapRoot = new GameObject("OHTMap");
            _mapRoot.transform.SetParent(transform);

            foreach (var node in data.nodes)
                BuildNode(node);

            foreach (var edge in data.edges)
                BuildEdge(edge, data);
        }

        public void Clear()
        {
            _nodeObjects.Clear();
            if (_mapRoot != null)
                Destroy(_mapRoot);
        }

        // 노드에 연결된 GameObject 반환 (에이전트 위치 조회용)
        public GameObject GetNodeObject(string nodeId)
            => _nodeObjects.TryGetValue(nodeId, out var go) ? go : null;

        void BuildNode(MapNode node)
        {
            GameObject go = nodePrefab != null
                ? Instantiate(nodePrefab, _mapRoot.transform)
                : CreatePrimitiveNode();

            go.name = $"Node_{node.id}_{node.type}";
            go.transform.position = node.WorldPosition(mapScale);
            go.transform.localScale = Vector3.one * nodeRadius * 2f;

            // 색상 설정
            if (NodeColors.TryGetValue(node.type, out var color))
            {
                var rend = go.GetComponent<Renderer>();
                if (rend != null)
                {
                    rend.material = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                    rend.material.color = color;
                    rend.material.SetColor("_EmissionColor", color * 0.3f);
                    rend.material.EnableKeyword("_EMISSION");
                }
            }

            // 타입 레이블 (TextMesh)
            var label = new GameObject("Label");
            label.transform.SetParent(go.transform);
            label.transform.localPosition = Vector3.up * 1.5f;
            label.transform.localScale    = Vector3.one * 0.5f;
            var tm = label.AddComponent<TextMesh>();
            tm.text      = node.type.ToString();
            tm.fontSize  = 24;
            tm.alignment = TextAlignment.Center;
            tm.anchor    = TextAnchor.MiddleCenter;
            tm.color     = Color.white;

            // NodeInfo 컴포넌트 부착 (시뮬레이션에서 참조)
            var info = go.AddComponent<NodeInfo>();
            info.nodeId   = node.id;
            info.nodeType = node.type;

            _nodeObjects[node.id] = go;
        }

        void BuildEdge(MapEdge edge, OHTMapData data)
        {
            var fromNode = data.FindNode(edge.fromId);
            var toNode   = data.FindNode(edge.toId);
            if (fromNode == null || toNode == null) return;

            var go = new GameObject($"Edge_{edge.id}");
            go.transform.SetParent(_mapRoot.transform);

            var lr = go.AddComponent<LineRenderer>();
            lr.positionCount = 2;
            lr.SetPosition(0, fromNode.WorldPosition(mapScale) + Vector3.up * 0.05f);
            lr.SetPosition(1, toNode.WorldPosition(mapScale)   + Vector3.up * 0.05f);
            lr.startWidth  = 0.04f;
            lr.endWidth    = 0.04f;
            lr.material    = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            lr.material.color = new Color(0.35f, 0.65f, 1f, 0.7f);
        }

        GameObject CreatePrimitiveNode()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.transform.SetParent(_mapRoot.transform);
            return go;
        }

        static Color HexColor(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            return c;
        }
    }

    // 노드 메타데이터 컴포넌트 (에이전트가 노드 타입 조회에 사용)
    public class NodeInfo : MonoBehaviour
    {
        public string   nodeId;
        public NodeType nodeType;
    }
}
