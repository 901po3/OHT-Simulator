using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 탑다운 직교 카메라. 미니맵(우상단 RawImage) + 풀스크린 토뷰 둘 다 이 카메라가 그린다.
    /// 풀스크린 토뷰일 땐 RenderTexture 대신 직접 화면에 렌더한다.
    /// </summary>
    [RequireComponent(typeof(Camera))]
    public class MinimapCamera : MonoBehaviour
    {
        public Camera Cam { get; private set; }
        VisualizationConfig _config;

        // 풀스크린 토뷰 모드용 카메라 컨트롤 상태
        Vector3 _topViewCenter;
        float   _topViewOrtho;

        void Awake()
        {
            Cam = GetComponent<Camera>();
            Cam.orthographic = true;
            Cam.clearFlags   = CameraClearFlags.SolidColor;
            Cam.backgroundColor = new Color(0.05f, 0.06f, 0.09f);
            // 위에서 아래로 내려다보는 각도
            transform.rotation = Quaternion.Euler(90f, 0f, 0f);
        }

        void Start()
        {
            _config = GameServices.Config;
        }

        void OnEnable()
        {
            SimEvents.MapBuilt          += HandleMapBuilt;
            SimEvents.CameraModeChanged += HandleCameraModeChanged;
        }

        void OnDisable()
        {
            SimEvents.MapBuilt          -= HandleMapBuilt;
            SimEvents.CameraModeChanged -= HandleCameraModeChanged;
        }

        void HandleMapBuilt(int _, int __)
        {
            var b = GameServices.MapBuilder.WorldBounds;
            _topViewCenter = b.center;
            float orthoNeeded = Mathf.Max(b.extents.x, b.extents.z) * 1.1f;
            _topViewOrtho = orthoNeeded > 0.1f ? orthoNeeded
                : (_config != null ? _config.minimapOrthoSizeFallback : 30f);
            ApplyTransform();
        }

        void HandleCameraModeChanged(SimEvents.CameraMode mode)
        {
            // 풀스크린 토뷰에 들어가면 RenderTexture 출력 해제 → 메인 화면에 직접
            if (mode == SimEvents.CameraMode.FullscreenTopView)
            {
                Cam.targetTexture = null;
                Cam.depth = 10; // 다른 카메라보다 위
            }
            else
            {
                // RenderTexture로 다시 출력 (MinimapRenderer가 설정)
                if (MinimapRenderer.SharedRenderTexture != null)
                    Cam.targetTexture = MinimapRenderer.SharedRenderTexture;
                Cam.depth = -1;
            }
            ApplyTransform();
        }

        // 입력 처리는 MinimapRenderer.Update가 모드별로 위임 호출한다.
        // 자체 Update를 두면 비활성 시에도 빈 호출이 발생하므로 제거.

        public void HandleTopViewInput(SimEvents.CameraMode currentMode)
        {
            if (currentMode != SimEvents.CameraMode.FullscreenTopView) return;
            if (_config == null) return;

            // 휠 줌
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.001f)
            {
                _topViewOrtho = Mathf.Clamp(_topViewOrtho - scroll * _config.topViewZoomStep * 2f,
                    _config.topViewMinOrtho, _config.topViewMaxOrtho);
            }

            // 좌클릭 드래그 → 패닝
            if (Input.GetMouseButton(0))
            {
                float dx = -Input.GetAxis("Mouse X") * _config.topViewPanSpeed * Time.deltaTime;
                float dz = -Input.GetAxis("Mouse Y") * _config.topViewPanSpeed * Time.deltaTime;
                _topViewCenter += new Vector3(dx, 0, dz);
            }

            // WASD 패닝
            Vector3 keyMove = Vector3.zero;
            if (Input.GetKey(KeyCode.W)) keyMove.z += 1;
            if (Input.GetKey(KeyCode.S)) keyMove.z -= 1;
            if (Input.GetKey(KeyCode.A)) keyMove.x -= 1;
            if (Input.GetKey(KeyCode.D)) keyMove.x += 1;
            if (keyMove.sqrMagnitude > 0.001f)
                _topViewCenter += keyMove.normalized * _config.topViewPanSpeed * Time.deltaTime;

            ApplyTransform();
        }

        void ApplyTransform()
        {
            // 맵 위쪽에서 내려다본다
            transform.position = new Vector3(_topViewCenter.x, 50f, _topViewCenter.z);
            Cam.orthographicSize = _topViewOrtho;
        }
    }
}
