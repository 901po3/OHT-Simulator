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

        public void Bind(MapNode node, Vector3 worldPos)
        {
            NodeId   = node.id;
            NodeType = node.type;
            WorldPos = worldPos;
            name     = $"Node_{node.id}_{node.type}";
        }
    }
}
