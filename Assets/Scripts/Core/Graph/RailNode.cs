using System.Collections.Generic;

namespace OHTSim.Core.Graph
{
    public class RailNode
    {
        public string Id { get; }
        public float X { get; }
        public float Y { get; }
        public NodeType Type { get; }

        public bool IsIntersection => Type == NodeType.Intersection;
        public bool IsSource      => Type == NodeType.Source;
        public bool IsDestination => Type == NodeType.Destination;

        private readonly List<RailEdge> _edges = new List<RailEdge>();
        public IReadOnlyList<RailEdge> Edges => _edges;

        public RailNode(string id, float x, float y, NodeType type = NodeType.Normal)
        {
            Id   = id;
            X    = x;
            Y    = y;
            Type = type;
        }

        internal void AddEdge(RailEdge edge) => _edges.Add(edge);

        public RailEdge GetEdgeTo(RailNode to)
        {
            foreach (var e in _edges)
                if (e.To == to) return e;
            return null;
        }

        public override string ToString() => $"Node({Id})";
    }
}
