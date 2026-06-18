using System;
using System.Collections.Generic;
using OHTSim.Core.Graph;

namespace OHTSim.Core.Pathfinding
{
    public class AStarPathFinder : IPathFinder
    {
        public List<RailNode> FindPath(RailNode from, RailNode to)
        {
            if (from == to) return new List<RailNode> { from };

            var openSet  = new List<RailNode> { from };
            var cameFrom = new Dictionary<RailNode, RailNode>();
            var gScore   = new Dictionary<RailNode, float> { [from] = 0f };
            var fScore   = new Dictionary<RailNode, float> { [from] = Heuristic(from, to) };

            while (openSet.Count > 0)
            {
                var current = LowestFScore(openSet, fScore);

                if (current == to)
                    return Reconstruct(cameFrom, current);

                openSet.Remove(current);

                foreach (var edge in current.Edges)
                {
                    float tentativeG = gScore[current] + edge.Weight;

                    if (!gScore.TryGetValue(edge.To, out float knownG) || tentativeG < knownG)
                    {
                        cameFrom[edge.To] = current;
                        gScore[edge.To]   = tentativeG;
                        fScore[edge.To]   = tentativeG + Heuristic(edge.To, to);

                        if (!openSet.Contains(edge.To))
                            openSet.Add(edge.To);
                    }
                }
            }

            return new List<RailNode>();
        }

        private static float Heuristic(RailNode a, RailNode b)
        {
            float dx = a.X - b.X;
            float dy = a.Y - b.Y;
            return MathF.Sqrt(dx * dx + dy * dy);
        }

        private static RailNode LowestFScore(List<RailNode> set, Dictionary<RailNode, float> fScore)
        {
            RailNode best     = set[0];
            float    bestF    = fScore.TryGetValue(best, out var f) ? f : float.MaxValue;

            for (int i = 1; i < set.Count; i++)
            {
                float fi = fScore.TryGetValue(set[i], out var v) ? v : float.MaxValue;
                if (fi < bestF) { best = set[i]; bestF = fi; }
            }
            return best;
        }

        private static List<RailNode> Reconstruct(Dictionary<RailNode, RailNode> cameFrom, RailNode current)
        {
            var path = new List<RailNode> { current };
            while (cameFrom.TryGetValue(current, out var prev))
            {
                path.Insert(0, prev);
                current = prev;
            }
            return path;
        }
    }
}
