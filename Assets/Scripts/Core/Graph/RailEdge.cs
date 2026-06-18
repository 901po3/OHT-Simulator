namespace OHTSim.Core.Graph
{
    public class RailEdge
    {
        public RailNode From   { get; }
        public RailNode To     { get; }
        public float    Length { get; }

        // 동적 혼잡 가중치 — 경로 탐색 시 반영
        public float CongestionWeight { get; set; } = 1f;
        public float Weight => Length * CongestionWeight;

        public RailEdge(RailNode from, RailNode to, float length)
        {
            From   = from;
            To     = to;
            Length = length;
        }

        public override string ToString() => $"Edge({From.Id}→{To.Id}, len={Length:F1})";
    }
}
