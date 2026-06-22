using UnityEngine;
using OHTSim.Core;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 3D 씬에 배치된 노드 GameObject에 부착되는 메타데이터.
    /// 로봇이 자신의 현재 노드를 조회하거나, 미니맵이 노드 색을 가져올 때 사용.
    /// 기존 Core.NodeInfo와 역할이 분리되어 있어 충돌 없음.
    /// </summary>
    public class NodeView : MonoBehaviour
    {
        public string   NodeId   { get; private set; }
        public NodeType NodeType { get; private set; }
        public Vector3  WorldPos { get; private set; }

        private TextMesh _textMesh;
        private Transform _labelTransform;
        private Transform _camTransform;

        public void Bind(MapNode node, Vector3 worldPos)
        {
            NodeId   = node.id;
            NodeType = node.type;
            WorldPos = worldPos;
            name     = $"Node_{node.id}_{node.type}";

            CreateNameTag();
        }

        private void CreateNameTag()
        {
            if (_labelTransform != null)
            {
                Destroy(_labelTransform.gameObject);
            }

            GameObject labelGo = new GameObject("NameTag");
            labelGo.transform.SetParent(transform, false);
            // Position above the node
            labelGo.transform.localPosition = new Vector3(0f, 1.8f, 0f);
            _labelTransform = labelGo.transform;

            _textMesh = labelGo.AddComponent<TextMesh>();
            _textMesh.fontSize = 28;
            _textMesh.characterSize = 0.12f;
            _textMesh.anchor = TextAnchor.MiddleCenter;
            _textMesh.alignment = TextAlignment.Center;
            _textMesh.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            _textMesh.GetComponent<Renderer>().sharedMaterial = _textMesh.font.material;

            // Set color and text based on node type
            Color textColor;
            string typeStr;

            switch (NodeType)
            {
                case NodeType.Normal:
                    textColor = new Color(0.7f, 0.85f, 1.0f); // Soft cyan/gray
                    typeStr = ""; // Don't show type for normal routing nodes to avoid clutter
                    break;
                case NodeType.Deposition:
                    textColor = new Color(1.0f, 0.85f, 0.1f); // Neon gold
                    typeStr = "Deposition";
                    break;
                case NodeType.Exposure:
                    textColor = new Color(0.9f, 0.3f, 1.0f); // Neon magenta/purple
                    typeStr = "Exposure";
                    break;
                case NodeType.Etching:
                    textColor = new Color(0.2f, 1.0f, 0.4f); // Neon green
                    typeStr = "Etching";
                    break;
                case NodeType.Cleaning:
                    textColor = new Color(0.1f, 0.8f, 1.0f); // Neon blue
                    typeStr = "Cleaning";
                    break;
                case NodeType.Depot:
                    textColor = new Color(1.0f, 1.0f, 1.0f); // Pure white
                    typeStr = "Depot";
                    break;
                default:
                    textColor = Color.white;
                    typeStr = NodeType.ToString();
                    break;
            }

            _textMesh.color = textColor;

            if (NodeType == NodeType.Normal)
            {
                _textMesh.text = NodeId;
            }
            else
            {
                _textMesh.text = $"{NodeId}\n[{typeStr}]";
            }
        }

        void Start()
        {
            if (Camera.main != null)
                _camTransform = Camera.main.transform;
        }

        void LateUpdate()
        {
            if (_labelTransform == null) return;

            if (_camTransform == null)
            {
                if (Camera.main != null)
                    _camTransform = Camera.main.transform;
                return;
            }

            // Always face the current rendering camera
            _labelTransform.LookAt(_labelTransform.position + _camTransform.rotation * Vector3.forward, _camTransform.rotation * Vector3.up);
        }
    }
}
