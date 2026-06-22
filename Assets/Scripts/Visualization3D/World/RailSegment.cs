using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 두 노드 사이의 긴 통로(레일).
    /// 단순 LineRenderer가 아니라 실제 메시(혹은 프리팹)를 늘려 배치하여 로봇이 그 위를 보행하는 것처럼 보인다.
    /// 프리팹이 제공되지 않으면 Primitive Cube를 늘려서 사용한다.
    /// </summary>
    public class RailSegment : MonoBehaviour
    {
        public Vector3 FromPos { get; private set; }
        public Vector3 ToPos   { get; private set; }
        public float   Length  { get; private set; }
        public Vector3 Direction { get; private set; }

        /// <summary>
        /// 양 끝 좌표를 받아 노드 반경만큼 잘라낸 후 정중앙에 배치, Z축이 진행 방향이 되도록 회전.
        /// </summary>
        public void Setup(Vector3 from, Vector3 to, float width, float height, float nodeRadius)
        {
            FromPos = from;
            ToPos   = to;

            Vector3 dir = to - from;
            Length      = dir.magnitude;
            if (Length < 0.001f) return;
            Direction   = dir / Length;

            // 노드 반경만큼 양쪽을 잘라낸 실제 길이
            float effectiveLen = Mathf.Max(0.1f, Length - nodeRadius * 2f);

            // 중심점에 배치
            Vector3 center = (from + to) * 0.5f;
            transform.position = center;
            transform.rotation = Quaternion.LookRotation(Direction, Vector3.up);

            // Z축으로 길게, X축은 폭, Y축은 높이
            transform.localScale = new Vector3(width, height, effectiveLen);
        }

        /// <summary>레일 진행도(0~1) → 월드 좌표 보간.</summary>
        public Vector3 GetPointOnRail(float t)
        {
            t = Mathf.Clamp01(t);
            return Vector3.Lerp(FromPos, ToPos, t);
        }
    }
}
