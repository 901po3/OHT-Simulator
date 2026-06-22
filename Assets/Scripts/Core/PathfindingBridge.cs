using System;
using System.Collections.Generic;

namespace OHTSim.Core
{
    // 웹 TypeScript algorithms.ts → C# 포팅
    // 동일한 알고리즘 6종 + 레지스트리 패턴 유지
    // SRP: 경로 탐색 계산만 담당 (상태 없음, 순수 static)

    public enum AlgorithmId
    {
        Standard,    // Standard A*
        Dijkstra,    // Dijkstra
        Greedy,      // Greedy BFS
        Stochastic,  // Stochastic A* (노이즈 ±30%)
        Priority,    // Priority A* (혼잡 가중치) ← 채택
        CbsLite,     // CBS-Lite (예약 테이블 페널티) ← 채택
    }

    public static class PathfindingBridge
    {
        // ── 공개 API: 알고리즘 ID로 경로 탐색 ──────────────────────
        public static List<MapNode> FindPath(
            AlgorithmId algorithmId,
            MapNode from,
            MapNode to,
            OHTMapData map,
            Dictionary<string, float> congestion = null,    // Priority A*용
            Dictionary<string, int> reservations = null,    // CBS-Lite용
            float noiseLevel = 0.3f)                        // Stochastic A*용
        {
            return algorithmId switch
            {
                AlgorithmId.Standard   => StandardAStar(from, to),
                AlgorithmId.Dijkstra   => Dijkstra(from, to),
                AlgorithmId.Greedy     => GreedyBFS(from, to),
                AlgorithmId.Stochastic => StochasticAStar(from, to, noiseLevel),
                AlgorithmId.Priority   => PriorityAStar(from, to, congestion ?? new Dictionary<string, float>()),
                AlgorithmId.CbsLite    => CbsLite(from, to, reservations ?? new Dictionary<string, int>()),
                _                      => StandardAStar(from, to),
            };
        }

        // ── 1. Standard A* ──────────────────────────────────────────
        public static List<MapNode> StandardAStar(MapNode from, MapNode to)
        {
            var open   = new HashSet<MapNode> { from };
            var came   = new Dictionary<MapNode, MapNode>();
            var g      = new Dictionary<MapNode, float> { [from] = 0f };
            var f      = new Dictionary<MapNode, float> { [from] = Heuristic(from, to) };

            while (open.Count > 0)
            {
                var cur = MinF(open, f);
                if (cur == to) return Reconstruct(came, cur);
                open.Remove(cur);
                foreach (var e in cur.edges)
                {
                    float tg = Get(g, cur) + e.weight;
                    if (tg < Get(g, e.to))
                    {
                        came[e.to] = cur;
                        g[e.to]    = tg;
                        f[e.to]    = tg + Heuristic(e.to, to);
                        open.Add(e.to);
                    }
                }
            }
            return new List<MapNode>();
        }

        // ── 2. Dijkstra ─────────────────────────────────────────────
        public static List<MapNode> Dijkstra(MapNode from, MapNode to)
        {
            var open = new HashSet<MapNode> { from };
            var came = new Dictionary<MapNode, MapNode>();
            var dist = new Dictionary<MapNode, float> { [from] = 0f };

            while (open.Count > 0)
            {
                var cur = MinDist(open, dist);
                if (cur == to) return Reconstruct(came, cur);
                open.Remove(cur);
                foreach (var e in cur.edges)
                {
                    float d = Get(dist, cur) + e.weight;
                    if (d < Get(dist, e.to))
                    {
                        came[e.to] = cur;
                        dist[e.to] = d;
                        open.Add(e.to);
                    }
                }
            }
            return new List<MapNode>();
        }

        // ── 3. Greedy BFS ───────────────────────────────────────────
        public static List<MapNode> GreedyBFS(MapNode from, MapNode to)
        {
            var open    = new HashSet<MapNode> { from };
            var came    = new Dictionary<MapNode, MapNode>();
            var visited = new HashSet<MapNode>();

            while (open.Count > 0)
            {
                var cur = MinH(open, to);
                if (cur == to) return Reconstruct(came, cur);
                open.Remove(cur); visited.Add(cur);
                foreach (var e in cur.edges)
                {
                    if (!visited.Contains(e.to)) { came[e.to] = cur; open.Add(e.to); }
                }
            }
            return new List<MapNode>();
        }

        // ── 4. Stochastic A* ────────────────────────────────────────
        static readonly Random _rng = new Random();

        public static List<MapNode> StochasticAStar(MapNode from, MapNode to, float noise = 0.3f)
        {
            var open = new HashSet<MapNode> { from };
            var came = new Dictionary<MapNode, MapNode>();
            var g    = new Dictionary<MapNode, float> { [from] = 0f };
            var f    = new Dictionary<MapNode, float> { [from] = Heuristic(from, to) };

            while (open.Count > 0)
            {
                var cur = MinF(open, f);
                if (cur == to) return Reconstruct(came, cur);
                open.Remove(cur);
                foreach (var e in cur.edges)
                {
                    float w  = e.weight * (1f + (float)(_rng.NextDouble() - 0.5) * noise);
                    float tg = Get(g, cur) + w;
                    if (tg < Get(g, e.to))
                    {
                        came[e.to] = cur;
                        g[e.to]    = tg;
                        f[e.to]    = tg + Heuristic(e.to, to);
                        open.Add(e.to);
                    }
                }
            }
            return new List<MapNode>();
        }

        // ── 5. Priority A* (혼잡 가중치) ────────────────────────────
        // 웹: congestion[nodeId] → 0~1, edge cost ×(1 + cong×2.5)
        public static List<MapNode> PriorityAStar(
            MapNode from, MapNode to, Dictionary<string, float> congestion)
        {
            var open = new HashSet<MapNode> { from };
            var came = new Dictionary<MapNode, MapNode>();
            var g    = new Dictionary<MapNode, float> { [from] = 0f };
            var f    = new Dictionary<MapNode, float> { [from] = Heuristic(from, to) };

            while (open.Count > 0)
            {
                var cur = MinF(open, f);
                if (cur == to) return Reconstruct(came, cur);
                open.Remove(cur);
                foreach (var e in cur.edges)
                {
                    congestion.TryGetValue(e.to.id, out float cong);
                    float costMul = 1f + cong * 2.5f;
                    float tg      = Get(g, cur) + e.weight * costMul;
                    if (tg < Get(g, e.to))
                    {
                        came[e.to] = cur;
                        g[e.to]    = tg;
                        f[e.to]    = tg + Heuristic(e.to, to);
                        open.Add(e.to);
                    }
                }
            }
            return new List<MapNode>();
        }

        // ── 6. CBS-Lite (예약 테이블 페널티) ────────────────────────
        // 웹: reservations.has(nodeId) → cost ×8
        public static List<MapNode> CbsLite(
            MapNode from, MapNode to, Dictionary<string, int> reservations)
        {
            var open = new HashSet<MapNode> { from };
            var came = new Dictionary<MapNode, MapNode>();
            var g    = new Dictionary<MapNode, float> { [from] = 0f };
            var f    = new Dictionary<MapNode, float> { [from] = Heuristic(from, to) };

            while (open.Count > 0)
            {
                var cur = MinF(open, f);
                if (cur == to) return Reconstruct(came, cur);
                open.Remove(cur);
                foreach (var e in cur.edges)
                {
                    float penalty = reservations.ContainsKey(e.to.id) ? 8f : 1f;
                    float tg      = Get(g, cur) + e.weight * penalty;
                    if (tg < Get(g, e.to))
                    {
                        came[e.to] = cur;
                        g[e.to]    = tg;
                        f[e.to]    = tg + Heuristic(e.to, to);
                        open.Add(e.to);
                    }
                }
            }
            return new List<MapNode>();
        }

        // ── 헬퍼 ─────────────────────────────────────────────────────
        static float Heuristic(MapNode a, MapNode b)
            => Math.Abs(a.x - b.x) + Math.Abs(a.y - b.y);

        static List<MapNode> Reconstruct(Dictionary<MapNode, MapNode> came, MapNode end)
        {
            var path = new List<MapNode> { end };
            var cur  = end;
            while (came.TryGetValue(cur, out var prev)) { path.Insert(0, prev); cur = prev; }
            return path;
        }

        static float Get(Dictionary<MapNode, float> dict, MapNode key)
            => dict.TryGetValue(key, out float v) ? v : float.MaxValue;

        static MapNode MinF(HashSet<MapNode> open, Dictionary<MapNode, float> f)
        {
            MapNode best = null;
            float   min  = float.MaxValue;
            foreach (var n in open)
            {
                float v = f.TryGetValue(n, out float fv) ? fv : float.MaxValue;
                if (v < min) { min = v; best = n; }
            }
            return best;
        }

        static MapNode MinDist(HashSet<MapNode> open, Dictionary<MapNode, float> dist)
            => MinF(open, dist);

        static MapNode MinH(HashSet<MapNode> open, MapNode goal)
        {
            MapNode best = null;
            float   min  = float.MaxValue;
            foreach (var n in open)
            {
                float h = Heuristic(n, goal);
                if (h < min) { min = h; best = n; }
            }
            return best;
        }
    }
}
