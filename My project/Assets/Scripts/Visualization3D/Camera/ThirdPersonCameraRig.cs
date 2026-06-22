using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 3인칭 시점 카메라 — 방대한 공장 내부를 사람 키 정도에서 둘러보는 느낌.
    /// 우클릭 드래그로 회전, 휠로 줌, WASD로 패닝.
    /// 풀스크린 토뷰 모드 진입 시 비활성화된다.
    /// </summary>
    public class ThirdPersonCameraRig : MonoBehaviour
    {
        [Header("타겟 (없으면 맵 중심)")]
        public Transform target;

        [Header("초기 파라미터 (VisualizationConfig가 우선)")]
        public float height   = 6f;
        public float distance = 10f;
        public float pitch    = 25f;
        public float yaw      = 0f;

        Camera _cam;
        VisualizationConfig _config;
        bool _enabled = true;

        void Awake()
        {
            _cam = GetComponent<Camera>();
            if (_cam == null) _cam = gameObject.AddComponent<Camera>();
        }

        void Start()
        {
            _config = GameServices.Config;
            if (_config != null)
            {
                height   = _config.cameraInitialHeight;
                distance = _config.cameraInitialDistance;
            }
            CenterOnMap();
        }

        void OnEnable()
        {
            SimEvents.CameraModeChanged += HandleCameraModeChanged;
            SimEvents.MapBuilt          += HandleMapBuilt;
        }

        void OnDisable()
        {
            SimEvents.CameraModeChanged -= HandleCameraModeChanged;
            SimEvents.MapBuilt          -= HandleMapBuilt;
        }

        void HandleCameraModeChanged(SimEvents.CameraMode mode)
        {
            _enabled = (mode == SimEvents.CameraMode.ThirdPerson);
            _cam.enabled = _enabled;
        }

        void HandleMapBuilt(int _, int __) => CenterOnMap();

        void CenterOnMap()
        {
            var builder = GameServices.MapBuilder;
            if (builder == null) return;
            var b = builder.WorldBounds;
            if (target == null)
            {
                var go = new GameObject("CameraTarget");
                go.transform.position = b.center;
                target = go.transform;
            }
            else target.position = b.center;

            // 사용자가 "공장 중앙에서 둘러보기" 요청 — 가까운 거리, 사람 키 시점
            float maxExtent = Mathf.Max(b.extents.x, b.extents.z);
            // 너무 멀어지지 않게 cap. 사람이 공장 안에서 둘러보는 느낌.
            distance = Mathf.Clamp(maxExtent * 0.3f, 8f, 25f);
            height   = _config != null ? _config.cameraInitialHeight : 6f;
            pitch    = 15f;  // 살짝 위에서 비스듬히 — 위압적인 구조물이 보이도록
        }

        void LateUpdate()
        {
            if (!_enabled || target == null) return;
            HandleInput();
            ApplyTransform();
        }

        void HandleInput()
        {
            float orbit = _config != null ? _config.cameraOrbitSpeed : 100f;
            float zoom  = _config != null ? _config.cameraZoomSpeed  : 5f;
            float pan   = _config != null ? _config.cameraPanSpeed   : 8f;

            // 우클릭 드래그 → 회전
            if (Input.GetMouseButton(1))
            {
                yaw   += Input.GetAxis("Mouse X") * orbit * Time.deltaTime;
                pitch -= Input.GetAxis("Mouse Y") * orbit * Time.deltaTime;
                pitch  = Mathf.Clamp(pitch, 5f, 80f);
            }

            // 휠 → 줌
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.001f)
                distance = Mathf.Clamp(distance - scroll * zoom * 10f, 3f, 200f);

            // WASD → 패닝 (타겟 이동)
            Vector3 move = Vector3.zero;
            if (Input.GetKey(KeyCode.W)) move += Forward();
            if (Input.GetKey(KeyCode.S)) move -= Forward();
            if (Input.GetKey(KeyCode.A)) move -= Right();
            if (Input.GetKey(KeyCode.D)) move += Right();
            if (move.sqrMagnitude > 0.001f)
                target.position += move.normalized * pan * Time.deltaTime;
        }

        Vector3 Forward()
        {
            float r = yaw * Mathf.Deg2Rad;
            return new Vector3(Mathf.Sin(r), 0, Mathf.Cos(r));
        }
        Vector3 Right()
        {
            float r = (yaw + 90f) * Mathf.Deg2Rad;
            return new Vector3(Mathf.Sin(r), 0, Mathf.Cos(r));
        }

        void ApplyTransform()
        {
            Quaternion rot = Quaternion.Euler(pitch, yaw, 0f);
            Vector3 offset = rot * new Vector3(0, 0, -distance);
            transform.position = target.position + offset + Vector3.up * height;
            transform.LookAt(target.position + Vector3.up * height * 0.3f);
        }
    }
}
