using UnityEngine;
using OHTSim.Core.Graph;

namespace OHTSim.Visualization
{
    /// <summary>
    /// RailGraph의 엣지를 LineRenderer로 씬에 그린다.
    /// UnityAI가 prefab을 설정한 후 Initialize()를 호출하면 자동 생성.
    /// </summary>
    public class RailRenderer : MonoBehaviour
    {
        [SerializeField] private Material railMaterial;
        [SerializeField] private float    lineWidth       = 0.1f;
        [SerializeField] private Color    normalColor     = new Color(0.2f, 0.6f, 1f);
        [SerializeField] private Color    intersectColor  = new Color(1f, 0.6f, 0.1f);

        public void Initialize(RailGraph graph)
        {
            foreach (var node in graph.AllNodes)
            {
                foreach (var edge in node.Edges)
                    CreateEdgeLine(edge);
            }

            // 노드 마커
            foreach (var node in graph.AllNodes)
                CreateNodeMarker(node);
        }

        private void CreateEdgeLine(RailEdge edge)
        {
            var go = new GameObject($"Edge_{edge.From.Id}_{edge.To.Id}");
            go.transform.SetParent(transform);

            var lr = go.AddComponent<LineRenderer>();
            lr.positionCount = 2;
            lr.SetPosition(0, ToWorld(edge.From));
            lr.SetPosition(1, ToWorld(edge.To));
            lr.startWidth = lineWidth;
            lr.endWidth   = lineWidth;

            if (railMaterial != null) lr.material = railMaterial;

            bool isIntersectionEdge = edge.From.IsIntersection || edge.To.IsIntersection;
            lr.startColor = isIntersectionEdge ? intersectColor : normalColor;
            lr.endColor   = lr.startColor;
            lr.useWorldSpace = true;
        }

        private void CreateNodeMarker(RailNode node)
        {
            float size = node.IsIntersection ? 0.4f : 0.25f;
            Color col  = node.Type switch
            {
                NodeType.Source      => Color.cyan,
                NodeType.Destination => Color.magenta,
                NodeType.Intersection => intersectColor,
                _                    => Color.white * 0.4f,
            };

            var go  = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = $"Node_{node.Id}";
            go.transform.SetParent(transform);
            go.transform.position   = ToWorld(node);
            go.transform.localScale = Vector3.one * size;
            Destroy(go.GetComponent<Collider>());

            var mat = go.GetComponent<Renderer>().material;
            mat.color = col;
        }

        private static Vector3 ToWorld(RailNode n) => new Vector3(n.X, 0f, n.Y);
    }
}
