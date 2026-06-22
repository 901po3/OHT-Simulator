using System.Collections.Generic;
using OHTSim.Core;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 노드 점유 레지스트리 — "한 노드에는 로봇 최대 1대" 불변식을 강제한다.
    /// 설계 제약(docs/ALGORITHM_DECISIONS.md): "겹치는 노드 최대 1대, 레일은 무제한 통행".
    /// 레일(엣지) 위에는 점유 제한이 없다 — 여러 로봇이 동시에 통행/대기 가능.
    /// "점유"는 (1) 현재 그 노드에 서 있음, (2) 그 노드로 이동 중이라 예약함 — 두 경우를 포함한다.
    /// 맵 재빌드/시뮬레이션 정지 시 Clear()로 초기화한다.
    /// 단일 스레드(메인 루프)에서만 호출되므로 락이 필요 없다.
    /// </summary>
    public static class NodeOccupancyService
    {
        static readonly Dictionary<string, RobotAgent3D> _owner = new();

        public static void Clear() => _owner.Clear();

        /// <summary>해당 노드를 robot이 점유 가능한가? (비어 있거나 이미 자신이 소유)</summary>
        public static bool IsClaimable(string nodeId, RobotAgent3D robot)
        {
            if (string.IsNullOrEmpty(nodeId)) return false;
            return !_owner.TryGetValue(nodeId, out var o) || o == null || o == robot;
        }

        /// <summary>원자적 점유 시도. 성공(또는 이미 자신 소유) 시 true.</summary>
        public static bool TryClaim(string nodeId, RobotAgent3D robot)
        {
            if (string.IsNullOrEmpty(nodeId) || robot == null) return false;
            if (_owner.TryGetValue(nodeId, out var o) && o != null && o != robot)
                return false;
            _owner[nodeId] = robot;
            return true;
        }

        /// <summary>robot이 소유한 경우에만 해제.</summary>
        public static void Release(string nodeId, RobotAgent3D robot)
        {
            if (string.IsNullOrEmpty(nodeId)) return;
            if (_owner.TryGetValue(nodeId, out var o) && o == robot)
                _owner[nodeId] = null;
        }

        public static RobotAgent3D GetOwner(string nodeId)
            => _owner.TryGetValue(nodeId, out var o) ? o : null;

        /// <summary>
        /// 점유되지 않은 노드 하나를 찾는다.
        /// prefer 조건을 만족하는 빈 노드를 우선 탐색하고, 없으면 조건 없이 빈 노드를 찾는다.
        /// nearest=true면 (refX, refY)에 가장 가까운 노드를, 아니면 처음 발견한 노드를 반환.
        /// </summary>
        public static string FindFreeNode(OHTMapData map, RobotAgent3D robot,
            System.Func<MapNode, bool> prefer = null,
            float refX = 0f, float refY = 0f, bool nearest = false)
        {
            if (map == null) return null;
            string best = PickFree(map, robot, prefer, refX, refY, nearest);
            if (best == null && prefer != null)
                best = PickFree(map, robot, null, refX, refY, nearest); // 조건 완화 후 재탐색
            return best;
        }

        static string PickFree(OHTMapData map, RobotAgent3D robot,
            System.Func<MapNode, bool> prefer, float refX, float refY, bool nearest)
        {
            string best = null;
            float bestDist = float.MaxValue;
            foreach (var n in map.nodes)
            {
                if (prefer != null && !prefer(n)) continue;
                if (!IsClaimable(n.id, robot)) continue;
                if (!nearest) return n.id;
                float dx = n.x - refX, dy = n.y - refY;
                float d = dx * dx + dy * dy;
                if (d < bestDist) { bestDist = d; best = n.id; }
            }
            return best;
        }
    }
}
