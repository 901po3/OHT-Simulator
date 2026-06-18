using System.Collections.Generic;

namespace OHTSim.Core.Graph
{
    public class RailGraph
    {
        private readonly Dictionary<string, RailNode> _nodes = new Dictionary<string, RailNode>();

        public IEnumerable<RailNode> AllNodes => _nodes.Values;

        public RailNode AddNode(string id, float x, float y, NodeType type = NodeType.Normal)
        {
            var node = new RailNode(id, x, y, type);
            _nodes[id] = node;
            return node;
        }

        // 단방향 엣지 추가 (실제 OHT 레일은 단방향)
        public RailEdge AddEdge(string fromId, string toId, float length = -1f)
        {
            var from = GetNode(fromId);
            var to   = GetNode(toId);

            if (length < 0f)
            {
                float dx = to.X - from.X;
                float dy = to.Y - from.Y;
                length = System.MathF.Sqrt(dx * dx + dy * dy);
            }

            var edge = new RailEdge(from, to, length);
            from.AddEdge(edge);
            return edge;
        }

        public RailNode GetNode(string id)
        {
            _nodes.TryGetValue(id, out var node);
            return node;
        }

        public bool HasNode(string id) => _nodes.ContainsKey(id);
    }
}
