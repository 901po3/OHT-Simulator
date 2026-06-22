using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// GTA 및 스카이림 시점의 3인칭/1인칭 공장 내부 탐색 시스템 (Cameraman).
    /// 마우스 휠로 1인칭 FPV와 3인칭 Over-the-shoulder 뷰를 실시간 전환합니다.
    /// 공장 바닥(Y=0)을 기준으로 호버링하는 세련된 검사 드론 아바타를 포함합니다.
    /// 구형/신규 인풋 시스템 모두를 완벽하게 동시에 호환 제어합니다 (Gamer Juice!).
    /// </summary>
    public class CameramanController : MonoBehaviour
    {
        [Header("이동 파라미터")]
        public float moveSpeed = 8f;
        public float sprintSpeedMultiplier = 2.0f;
        public float hoverHeight = 1.7f;
        public float hoverBobSpeed = 2.5f;
        public float hoverBobAmount = 0.06f;

        [Header("카메라 감도 및 댐핑")]
        public float mouseSensitivity = 120f;
        public float followDistance = 4.5f;
        public float followHeight = 1.3f;
        public float lookDamping = 15f;

        private GameObject _droneAvatar;
        private Camera _cam;
        private CameraModeController _modeController;
        private bool _active = false;

        private float _yaw = 0f;
        private float _pitch = 15f;
        private float _bobTimer = 0f;
        private bool _isFirstPerson = false;

        private void Awake()
        {
            _cam = GetComponent<Camera>();
            if (_cam == null) _cam = Camera.main;
        }

        private void Start()
        {
            EnsureModeController();
            SimEvents.CameraModeChanged += HandleCameraModeChanged;
            SimEvents.MapBuilt          += HandleMapBuilt;

            // 드론 아바타를 프로그래밍 방식으로 제작 (Low-poly Sci-fi 스타일)
            CreateDroneAvatar();
            _droneAvatar.SetActive(false);
        }

        private void OnDestroy()
        {
            SimEvents.CameraModeChanged -= HandleCameraModeChanged;
            SimEvents.MapBuilt          -= HandleMapBuilt;
            if (_droneAvatar != null) Destroy(_droneAvatar);
        }

        private void EnsureModeController()
        {
            if (_modeController == null)
            {
                _modeController = Object.FindAnyObjectByType<CameraModeController>();
            }
        }

        private Quaternion GetSafeCameraLookRotation()
        {
            if (_cam == null) return Quaternion.identity;
            Vector3 camForward = _cam.transform.forward;
            Vector3 flatForward = new Vector3(camForward.x, 0f, camForward.z);
            
            // 카메라가 수직(위/아래)을 보고 있을 때 NaN 회전 에러 예방용 대체 연산
            if (flatForward.sqrMagnitude < 0.001f)
            {
                Vector3 camUp = _cam.transform.up;
                flatForward = new Vector3(camUp.x, 0f, camUp.z);
                if (flatForward.sqrMagnitude < 0.001f)
                {
                    flatForward = Vector3.forward;
                }
            }
            return Quaternion.LookRotation(flatForward.normalized, Vector3.up);
        }

        private void HandleMapBuilt(int nodeCount, int edgeCount)
        {
            // 새로운 맵이 빌드되면 드론 위치를 새 맵의 중심지로 즉시 강제 이동 (이상한 위치 스폰 및 기둥 외곽 갇힘 현상 방지)
            if (_droneAvatar != null)
            {
                var spawnPos = GetInitialSpawnPosition();
                _droneAvatar.transform.position = spawnPos;
                
                _droneAvatar.transform.rotation = GetSafeCameraLookRotation();
                _yaw = _droneAvatar.transform.eulerAngles.y;
                _pitch = 15f;
            }
        }

        private void HandleCameraModeChanged(SimEvents.CameraMode mode)
        {
            _active = (mode == SimEvents.CameraMode.Cameraman);
            if (_droneAvatar != null) _droneAvatar.SetActive(_active);

            if (_active)
            {
                // 진입 시 아바타 위치를 현재 카메라가 보던 타겟 또는 카메라의 15m 앞 바닥으로 초기화
                var targetPos = GetInitialSpawnPosition();
                _droneAvatar.transform.position = targetPos;
                _droneAvatar.transform.rotation = GetSafeCameraLookRotation();

                _yaw = _droneAvatar.transform.eulerAngles.y;
                _pitch = 15f;

                // 마우스 잠금 및 감춤
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
                _isFirstPerson = false;
            }
            else
            {
                // 해제 시 마우스 잠금 풀기
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
        }

        private Vector3 GetInitialSpawnPosition()
        {
            // 월드 경계 내에 드론 스폰
            var builder = GameServices.MapBuilder;
            if (builder != null)
            {
                Bounds b = builder.WorldBounds;
                // 만약 맵 바운드가 비어 있다면 월드 원점으로 예방 세팅
                if (b.size.sqrMagnitude < 0.1f)
                {
                    return new Vector3(0, hoverHeight, 0);
                }
                Vector3 center = b.center;
                center.y = hoverHeight;
                return center;
            }
            return new Vector3(0, hoverHeight, 0);
        }

        private void Update()
        {
            if (!_active || _droneAvatar == null) return;

            // ESC 누르면 3인칭 기본 Orbit 뷰로 빠져나감
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                EnsureModeController();
                if (_modeController != null)
                    _modeController.SetMode(SimEvents.CameraMode.ThirdPerson);
                return;
            }

            HandleInputAndMovement();
        }

        private void LateUpdate()
        {
            if (!_active || _droneAvatar == null || _cam == null) return;

            ApplyCameraView();
        }

        private void HandleInputAndMovement()
        {
            // ── 1. 마우스 회전 (요와 피치 - 신규/구형 인풋 멀티 호환 연산) ──
            float mouseX = 0f;
            float mouseY = 0f;

#if ENABLE_INPUT_SYSTEM
            var mouse = UnityEngine.InputSystem.Mouse.current;
            if (mouse != null)
            {
                Vector2 delta = mouse.delta.ReadValue();
                // 신형 인풋의 감도 스케일 보정
                mouseX = delta.x * mouseSensitivity * 0.0012f;
                mouseY = delta.y * mouseSensitivity * 0.0012f;
            }
            else
#endif
            {
                mouseX = Input.GetAxis("Mouse X") * mouseSensitivity * 0.02f;
                mouseY = Input.GetAxis("Mouse Y") * mouseSensitivity * 0.02f;
            }

            _yaw += mouseX;
            _pitch -= mouseY;
            _pitch = Mathf.Clamp(_pitch, -45f, 75f);

            _droneAvatar.transform.rotation = Quaternion.Euler(0, _yaw, 0);

            // ── 2. 키보드 이동 (WASD - 신규/구형 인풋 멀티 호환 연산) ──
            float speed = moveSpeed;
            bool shiftPressed = false;

#if ENABLE_INPUT_SYSTEM
            var keyboard = UnityEngine.InputSystem.Keyboard.current;
            if (keyboard != null)
            {
                shiftPressed = keyboard.leftShiftKey.isPressed || keyboard.rightShiftKey.isPressed;
            }
            else
#endif
            {
                shiftPressed = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
            }

            if (shiftPressed) speed *= sprintSpeedMultiplier;

            Vector3 moveDir = Vector3.zero;
            Vector3 forward = _droneAvatar.transform.forward;
            Vector3 right = _droneAvatar.transform.right;

#if ENABLE_INPUT_SYSTEM
            if (keyboard != null)
            {
                if (keyboard.wKey.isPressed) moveDir += forward;
                if (keyboard.sKey.isPressed) moveDir -= forward;
                if (keyboard.aKey.isPressed) moveDir -= right;
                if (keyboard.dKey.isPressed) moveDir += right;
            }
            else
#endif
            {
                if (Input.GetKey(KeyCode.W)) moveDir += forward;
                if (Input.GetKey(KeyCode.S)) moveDir -= forward;
                if (Input.GetKey(KeyCode.A)) moveDir -= right;
                if (Input.GetKey(KeyCode.D)) moveDir += right;
            }

            // 이동 벡터 적용
            if (moveDir.sqrMagnitude > 0.001f)
            {
                _droneAvatar.transform.position += moveDir.normalized * speed * Time.deltaTime;

                // 이동 시 앞으로 약간 기울어지는 드론 연출 (Gamer Juice!)
                float tiltAngle = 10f;
                _droneAvatar.transform.rotation = Quaternion.Euler(tiltAngle, _yaw, 0);
            }

            // 3. 월드 경계(공장 내벽) 안쪽으로 강제 클램프 (탈출 방지)
            ClampToFactoryBounds();

            // 4. 호버링 위아래 흔들림 (Bobbing)
            _bobTimer += Time.deltaTime * hoverBobSpeed;
            var pos = _droneAvatar.transform.position;
            pos.y = hoverHeight + Mathf.Sin(_bobTimer) * hoverBobAmount;
            _droneAvatar.transform.position = pos;

            // 5. 마우스 휠로 1인칭 <-> 3인칭 전환
            float scroll = 0f;
#if ENABLE_INPUT_SYSTEM
            if (mouse != null)
            {
                scroll = mouse.scroll.ReadValue().y * 0.008f;
            }
            else
#endif
            {
                scroll = Input.GetAxis("Mouse ScrollWheel");
            }

            if (Mathf.Abs(scroll) > 0.01f)
            {
                if (scroll > 0f)
                {
                    followDistance = Mathf.Max(0f, followDistance - scroll * 15f);
                    if (followDistance < 1f) _isFirstPerson = true;
                }
                else
                {
                    followDistance = Mathf.Min(10f, followDistance - scroll * 15f);
                    if (followDistance >= 1f) _isFirstPerson = false;
                }
            }
        }

        private void ApplyCameraView()
        {
            if (_isFirstPerson)
            {
                // 1인칭 시점 (드론의 정중앙 카메라 눈 높이)
                _cam.transform.position = _droneAvatar.transform.position;
                _cam.transform.rotation = Quaternion.Euler(_pitch, _yaw, 0);
            }
            else
            {
                // 3인칭 시점 (GTA 스타일 Over-the-shoulder 및 부드러운 카메라 추적)
                Quaternion cameraRot = Quaternion.Euler(_pitch, _yaw, 0);
                Vector3 targetCamPos = _droneAvatar.transform.position - (cameraRot * Vector3.forward * followDistance) + Vector3.up * followHeight;

                // 충돌 방지: 카메라가 바닥밑으로 파묻히는 것 예방
                if (targetCamPos.y < 0.2f) targetCamPos.y = 0.2f;

                _cam.transform.position = Vector3.Lerp(_cam.transform.position, targetCamPos, Time.deltaTime * lookDamping);
                _cam.transform.LookAt(_droneAvatar.transform.position + Vector3.up * 0.2f);
            }
        }

        private void ClampToFactoryBounds()
        {
            var builder = GameServices.MapBuilder;
            if (builder == null) return;

            Bounds b = builder.WorldBounds;
            // 패딩을 주어 벽 밖으로 나가지 못하게 하되, 맵이 작거나 패딩 연산 오류로 갇히는 현상을 예방하기 위해 adaptive 패딩 계산
            float paddingX = Mathf.Min(4f, b.extents.x * 0.4f);
            float paddingZ = Mathf.Min(4f, b.extents.z * 0.4f);

            float minX = b.min.x + paddingX;
            float maxX = b.max.x - paddingX;
            float minZ = b.min.z + paddingZ;
            float maxZ = b.max.z - paddingZ;

            // 역치 역전 현상 원천 차단 (Gamer UX!)
            if (minX > maxX) { float tmp = minX; minX = maxX; maxX = tmp; }
            if (minZ > maxZ) { float tmp = minZ; minZ = maxZ; maxZ = tmp; }

            Vector3 pos = _droneAvatar.transform.position;
            pos.x = Mathf.Clamp(pos.x, minX, maxX);
            pos.z = Mathf.Clamp(pos.z, minZ, maxZ);
            _droneAvatar.transform.position = pos;
        }

        private void CreateDroneAvatar()
        {
            _droneAvatar = new GameObject("CameramanDroneAvatar");
            _droneAvatar.transform.position = Vector3.zero;

            var litShader = Shader.Find("Universal Render Pipeline/Lit");

            // 1. 드론 본체 (중앙 구체 - 하이테크 구체)
            var body = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            body.transform.SetParent(_droneAvatar.transform, false);
            body.transform.localScale = new Vector3(0.5f, 0.4f, 0.5f);
            Destroy(body.GetComponent<SphereCollider>());
            var bodyMat = new Material(litShader) { color = new Color(0.12f, 0.15f, 0.22f) };
            bodyMat.SetFloat("_Metallic", 0.9f);
            bodyMat.SetFloat("_Smoothness", 0.8f);
            body.GetComponent<Renderer>().material = bodyMat;

            // 2. 전면 빛나는 눈 카메라 렌즈 (원기둥)
            var eye = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            eye.transform.SetParent(_droneAvatar.transform, false);
            eye.transform.localPosition = new Vector3(0f, 0f, 0.22f);
            eye.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            eye.transform.localScale = new Vector3(0.18f, 0.08f, 0.18f);
            Destroy(eye.GetComponent<CapsuleCollider>());
            var eyeMat = new Material(litShader);
            eyeMat.color = new Color(0f, 0.9f, 1f);
            eyeMat.EnableKeyword("_EMISSION");
            eyeMat.SetColor("_EmissionColor", new Color(0f, 0.9f, 1f) * 2f);
            eye.GetComponent<Renderer>().material = eyeMat;

            // 3. 측면 좌우 날개 보호대 (납작한 큐브)
            for (int i = 0; i < 2; i++)
            {
                float side = i == 0 ? -1f : 1f;
                var wing = GameObject.CreatePrimitive(PrimitiveType.Cube);
                wing.transform.SetParent(_droneAvatar.transform, false);
                wing.transform.localPosition = new Vector3(side * 0.35f, 0f, 0f);
                wing.transform.localScale = new Vector3(0.12f, 0.08f, 0.6f);
                Destroy(wing.GetComponent<BoxCollider>());
                var wingMat = new Material(litShader) { color = new Color(0.85f, 0.86f, 0.9f) };
                wingMat.SetFloat("_Metallic", 0.5f);
                wingMat.SetFloat("_Smoothness", 0.5f);
                wing.GetComponent<Renderer>().material = wingMat;

                // 날개 회전 날개 (원기둥)
                var rotor = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                rotor.transform.SetParent(wing.transform, false);
                rotor.transform.localPosition = new Vector3(0f, 0.5f, 0f);
                rotor.transform.localScale = new Vector3(0.8f, 0.05f, 0.8f);
                Destroy(rotor.GetComponent<CapsuleCollider>());
                rotor.GetComponent<Renderer>().material = bodyMat;
            }

            // 4. 전면 서치라이트 (Spotlight)
            var lightGo = new GameObject("DroneSpotlight");
            lightGo.transform.SetParent(_droneAvatar.transform, false);
            lightGo.transform.localPosition = new Vector3(0f, 0f, 0.25f);
            lightGo.transform.localRotation = Quaternion.identity;
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Spot;
            light.color = new Color(0f, 0.85f, 1f);
            light.intensity = 4.5f;
            light.range = 15f;
            light.spotAngle = 45f;
        }
    }
}
