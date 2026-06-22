using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 3D 시각화 전반 설정. 인스펙터에서 조정 가능.
    /// 코드에 매직 넘버를 박지 않는다 — 모두 여기로 모은다.
    /// </summary>
    [CreateAssetMenu(fileName = "VisualizationConfig", menuName = "OHT/Visualization Config")]
    public class VisualizationConfig : ScriptableObject
    {
        [Header("월드 스케일")]
        [Tooltip("웹 에디터 픽셀 → Unity 단위 변환 (1px = 0.05 → 큰 공장 느낌)")]
        public float mapScale = 0.05f;

        [Tooltip("노드 사이를 더 멀리 떨어뜨려 레일을 길게 보이게 한다 (1.0 = 원본 거리, 2.0 = 두 배)")]
        public float nodeSeparationMultiplier = 2.5f;

        [Header("로봇")]
        [Tooltip("로봇 기본 이동 속도 (Unity 단위/초). 런타임 SpeedMultiplier로 곱해진다.")]
        public float robotBaseSpeed = 2.0f;

        [Tooltip("로봇 회전 속도 (도/초)")]
        public float robotRotationSpeed = 540f;

        [Tooltip("로봇 부유 높이 (천장 OHT 느낌)")]
        public float robotHoverHeight = 1.2f;

        [Header("초기값")]
        [Range(1, 100)] public int initialRobotCount = 12;
        [Range(0.1f, 5f)] public float initialSpeedMultiplier = 1f;

        [Header("플릿 제한")]
        [Range(1, 200)] public int maxRobotCount = 100;

        [Header("3인칭 카메라")]
        public float cameraInitialHeight = 6f;
        public float cameraInitialDistance = 10f;
        public float cameraOrbitSpeed = 100f;
        public float cameraZoomSpeed = 5f;
        public float cameraPanSpeed = 8f;

        [Header("미니맵")]
        public Vector2 minimapSize = new Vector2(220, 220);
        public Vector2 minimapMargin = new Vector2(20, 20);
        [Tooltip("미니맵 카메라 직교 사이즈 (자동 계산 fallback)")]
        public float minimapOrthoSizeFallback = 30f;

        [Header("풀스크린 토뷰")]
        public float topViewMinOrtho = 5f;
        public float topViewMaxOrtho = 80f;
        public float topViewZoomStep = 3f;
        public float topViewPanSpeed = 30f;
    }
}
