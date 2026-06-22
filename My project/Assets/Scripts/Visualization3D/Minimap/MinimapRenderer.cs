using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 우상단 미니맵 UI — RawImage에 MinimapCamera의 RenderTexture를 표시한다.
    /// 클릭하면 풀스크린 토뷰로 전환. ESC 또는 미니맵 영역 우상단의 "닫기" 버튼으로 복귀.
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public class MinimapRenderer : MonoBehaviour, IPointerClickHandler
    {
        public static RenderTexture SharedRenderTexture { get; private set; }

        [Header("의존성")]
        public MinimapCamera        minimapCam;
        public CameraModeController modeController;

        [Header("UI 요소")]
        public RawImage rawImage;
        public RectTransform rootRect;

        VisualizationConfig _config;

        void Awake()
        {
            if (rawImage == null) rawImage = GetComponent<RawImage>();
            if (rootRect == null) rootRect = GetComponent<RectTransform>();
        }

        void Start()
        {
            _config = GameServices.Config;
            EnsureRenderTexture();
            ApplyLayout(SimEvents.CameraMode.ThirdPerson);
        }

        void OnEnable()  => SimEvents.CameraModeChanged += ApplyLayout;
        void OnDisable() => SimEvents.CameraModeChanged -= ApplyLayout;

        void OnDestroy()
        {
            if (SharedRenderTexture != null)
            {
                SharedRenderTexture.Release();
                SharedRenderTexture = null;
            }
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (modeController == null) return;
            modeController.ToggleTopView();
        }

        void Update()
        {
            // 풀스크린 토뷰일 때 카메라 입력 위임
            if (minimapCam != null && modeController != null)
                minimapCam.HandleTopViewInput(modeController.CurrentMode);
        }

        void EnsureRenderTexture()
        {
            if (SharedRenderTexture != null) return;
            Vector2 size = _config != null ? _config.minimapSize : new Vector2(220, 220);
            SharedRenderTexture = new RenderTexture(
                Mathf.RoundToInt(size.x * 2),  // 2x 해상도로 선명하게
                Mathf.RoundToInt(size.y * 2),
                16);
            SharedRenderTexture.name = "MinimapRT";
            if (minimapCam != null) minimapCam.Cam.targetTexture = SharedRenderTexture;
            if (rawImage != null)   rawImage.texture = SharedRenderTexture;
        }

        void ApplyLayout(SimEvents.CameraMode mode)
        {
            if (rootRect == null) return;

            if (mode == SimEvents.CameraMode.FullscreenTopView)
            {
                // 미니맵 RawImage를 숨김 (카메라가 직접 화면에 그림)
                if (rawImage != null) rawImage.enabled = false;
            }
            else
            {
                // 우상단 미니맵 복귀
                Vector2 size   = _config != null ? _config.minimapSize   : new Vector2(220, 220);
                Vector2 margin = _config != null ? _config.minimapMargin : new Vector2(20, 20);

                rootRect.anchorMin = new Vector2(1, 1);
                rootRect.anchorMax = new Vector2(1, 1);
                rootRect.pivot     = new Vector2(1, 1);
                rootRect.sizeDelta        = size;
                rootRect.anchoredPosition = new Vector2(-margin.x, -margin.y);
                if (rawImage != null) rawImage.enabled = true;
            }
        }
    }
}
