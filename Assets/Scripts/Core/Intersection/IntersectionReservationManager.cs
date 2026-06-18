using System.Collections.Generic;
using OHTSim.Core.Graph;

namespace OHTSim.Core.Intersection
{
    public class IntersectionReservationManager : IIntersectionManager
    {
        // 교차로 노드 → 점유 OHT ID
        private readonly Dictionary<RailNode, string> _reservations  = new Dictionary<RailNode, string>();
        private readonly Dictionary<RailNode, float>  _reservedTimes = new Dictionary<RailNode, float>();

        // 이 시간(초) 이상 점유 중이면 데드락으로 판단 후 강제 해제
        private const float DeadlockTimeoutSeconds = 5f;

        public int ReservationCount => _reservations.Count;

        public bool TryReserve(RailNode node, string ohtId, float currentTime)
        {
            if (_reservations.TryGetValue(node, out var holder))
            {
                if (holder == ohtId) return true;

                // 데드락 타임아웃 체크
                if (_reservedTimes.TryGetValue(node, out float since)
                    && currentTime - since > DeadlockTimeoutSeconds)
                {
                    ForceRelease(node);
                }
                else
                {
                    return false;
                }
            }

            _reservations[node]  = ohtId;
            _reservedTimes[node] = currentTime;
            return true;
        }

        public void Release(RailNode node, string ohtId)
        {
            if (_reservations.TryGetValue(node, out var holder) && holder == ohtId)
                ForceRelease(node);
        }

        public bool IsReservedBy(RailNode node, string ohtId)
            => _reservations.TryGetValue(node, out var h) && h == ohtId;

        public string GetReserver(RailNode node)
            => _reservations.TryGetValue(node, out var h) ? h : null;

        private void ForceRelease(RailNode node)
        {
            _reservations.Remove(node);
            _reservedTimes.Remove(node);
        }
    }
}
