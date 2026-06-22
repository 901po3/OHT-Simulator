using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 레일별 혼잡도를 주기적으로(0.2초) 계산하여 RailSegment.SetCongestion에 전달한다.
    /// 혼잡도 = 해당 레일 구간 위에 근접한(수직거리 임계값 이내) 활성 로봇 수를 정규화한 값.
    /// GameServices를 통해 MapBuilder/FleetController를 매 틱 조회하므로 자급자족적이다.
    /// </summary>
    public class CongestionMonitor : MonoBehaviour
    {
        [Header("샘플링")]
        [Tooltip("혼잡도 재계산 주기(초). 매 프레임이 아닌 누적 방식.")]
        [SerializeField] float _updateInterval = 0.2f;

        [Header("혼잡도 파라미터")]
        [Tooltip("로봇이 레일에 속한 것으로 간주할 최대 수직 거리(월드 단위).")]
        [SerializeField] float _perpendicularThreshold = 1.5f;

        [Tooltip("이 수의 로봇이 한 레일에 있으면 혼잡도 1.0(최대)으로 본다.")]
        [SerializeField] float _maxExpectedPerRail = 3f;

        float _accum;

        void Update()
        {
            _accum += Time.deltaTime;
            if (_accum < _updateInterval) return;
            _accum = 0f;

            Recompute();
        }

        void Recompute()
        {
            var mapBuilder = GameServices.MapBuilder;
            var fleet      = GameServices.FleetController;
            if (mapBuilder == null || fleet == null) return;

            var rails  = mapBuilder.RailSegments;
            var robots = fleet.ActiveRobots;
            if (rails == null || robots == null) return;

            float maxExpected = Mathf.Max(0.001f, _maxExpectedPerRail);
            float threshSqr   = _perpendicularThreshold * _perpendicularThreshold;

            foreach (var kvp in rails)
            {
                var seg = kvp.Value;
                if (seg == null) continue;

                // XZ 평면 기준 선분 (레일 끝점은 Y=0, 로봇은 높이 편차가 있으므로 평탄화)
                Vector3 a = seg.FromPos; a.y = 0f;
                Vector3 b = seg.ToPos;   b.y = 0f;
                Vector3 ab = b - a;
                float abLenSqr = ab.sqrMagnitude;
                if (abLenSqr < 0.0001f) { seg.SetCongestion(0f); continue; }

                int count = 0;
                for (int i = 0; i < robots.Count; i++)
                {
                    var robot = robots[i];
                    if (robot == null) continue;

                    Vector3 p = robot.transform.position; p.y = 0f;
                    float t = Vector3.Dot(p - a, ab) / abLenSqr;
                    if (t < 0f || t > 1f) continue;          // 구간 밖 투영은 제외
                    Vector3 closest = a + ab * t;
                    if ((p - closest).sqrMagnitude <= threshSqr)
                        count++;
                }

                float congestion = Mathf.Clamp01(count / maxExpected);
                seg.SetCongestion(congestion);
            }
        }
    }
}