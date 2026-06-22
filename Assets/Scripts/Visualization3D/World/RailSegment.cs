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

        // ── 미니맵 전용 혼잡도 오버레이 ──────────────────────────────
        // Map3DBuilder가 별도 생성한 발광 오버레이(레일 위 얇은 큐브, MinimapOnly 레이어)를 등록받아
        // 혼잡도(0~1)에 따라 색/발광을 보간한다.
        [SerializeField] Renderer _congestionRenderer;
        Material _congestionMaterial;

        static readonly int _colorId    = Shader.PropertyToID("_BaseColor");
        static readonly int _emissionId = Shader.PropertyToID("_EmissionColor");

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

        /// <summary>Map3DBuilder가 생성한 혼잡도 오버레이 렌더러를 등록한다.</summary>
        public void SetCongestionOverlay(Renderer overlayRenderer)
        {
            _congestionRenderer = overlayRenderer;
            if (_congestionRenderer != null)
                _congestionMaterial = _congestionRenderer.material; // 인스턴스 머티리얼
        }

        /// <summary>혼잡도(0~1)에 따라 오버레이 색/발광을 보간한다. 0=투명한 어두운 파랑, 1=네온 빨강.</summary>
        public void SetCongestion(float t01)
        {
            if (_congestionRenderer == null || _congestionMaterial == null) return;

            t01 = Mathf.Clamp01(t01);
            Color low  = new Color(0.1f, 0.2f, 0.6f);   // 저혼잡: 어두운 파랑
            Color high = new Color(1f,   0.1f, 0.05f);  // 고혼잡: 네온 빨강
            Color baseCol = Color.Lerp(low, high, t01);

            _congestionMaterial.SetColor(_colorId, baseCol);
            // 미니맵 블룸용 HDR 발광
            _congestionMaterial.SetColor(_emissionId, baseCol * (0.5f + t01 * 2.5f));
        }
    }
}
