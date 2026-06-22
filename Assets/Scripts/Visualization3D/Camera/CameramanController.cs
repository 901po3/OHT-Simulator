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

        [Header("수직 이동")]
        public float verticalSpeed = 5f;
        public float minHoverHeight = 0.5f;
        public float maxHoverHeight = 15f;

        [Header("키보드 회전")]
        public float keyboardTurnSpeed = 90f;  // 도/초

        private GameObject _droneAvatar;
        private Camera _cam;
        private CameraModeController _modeController;
        private bool _active = false;

        private float _yaw = 0f;
        private float _pitch = 15f;
        private float _bobTimer = 0f;
        private bool _isFirstPerson = false;

        // 베이스 호버 높이(수직 이동으로 변화). bobbing은 이 값에 더해진다
        private float _baseHoverHeight = 1.7f;

        // 부드러운 뱅킹(롤) 연출용 상태
        private float _currentRoll = 0f;
        private float _yawPrev = 0f;

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

            // 베이스 호버 높이는 인스펙터의 hoverHeight 초기값으로 동기화
            _baseHoverHeight = hoverHeight;

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
                _yawPrev = _yaw;
                _currentRoll = 0f;
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
                _yawPrev = _yaw;
                _currentRoll = 0f;
                _pitch = 15f;

                // 베이스 호버 높이를 초기값으로 재설정 (Cameraman 진입 시 깔끔한 출발)
                _baseHoverHeight = Mathf.Clamp(hoverHeight, minHoverHeight, maxHoverHeight);

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
                    return new Vector3(0, _baseHoverHeight, 0);
                }
                Vector3 center = b.center;
                center.y = _baseHoverHeight;
                return center;
            }
            return new Vector3(0, _baseHoverHeight, 0);
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

            // ── 1-b. 키보드 회전 (Q/E - 마우스 보조, 신규/구형 인풋 멀티 호환) ──
            float keyTurn = 0f;
            bool upKey = false;
            bool downKey = false;
#if ENABLE_INPUT_SYSTEM
            var kbTurn = UnityEngine.InputSystem.Keyboard.current;
            if (kbTurn != null)
            {
                if (kbTurn.qKey.isPressed) keyTurn -= 1f;
                if (kbTurn.eKey.isPressed) keyTurn += 1f;
                upKey   = kbTurn.spaceKey.isPressed;
                downKey = kbTurn.leftCtrlKey.isPressed || kbTurn.rightCtrlKey.isPressed;
            }
            else
#endif
            {
                if (Input.GetKey(KeyCode.Q)) keyTurn -= 1f;
                if (Input.GetKey(KeyCode.E)) keyTurn += 1f;
                upKey   = Input.GetKey(KeyCode.Space);
                downKey = Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl);
            }
            _yaw += keyTurn * keyboardTurnSpeed * Time.deltaTime;

            // 시점 클램프 완화 (위/아래도 시원하게 볼 수 있도록)
            _pitch = Mathf.Clamp(_pitch, -80f, 80f);

            // ── 1-c. 부드러운 뱅킹(롤) — 좌/우 회전 시 살짝 기울어지는 Gamer Juice ──
            float yawDelta = Mathf.DeltaAngle(_yawPrev, _yaw);
            // yawDelta는 프레임당 도 단위라 그대로 곱하면 너무 작음 → 속도화하여 보강
            float targetRoll = Mathf.Clamp(-yawDelta * 2f, -25f, 25f);
            _currentRoll = Mathf.Lerp(_currentRoll, targetRoll, Time.deltaTime * 5f);
            _yawPrev = _yaw;

            _droneAvatar.transform.rotation = Quaternion.Euler(0, _yaw, _currentRoll);

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
            // forward/right의 Y 성분 제거 — 수평 이동만 (수직은 Space/Ctrl 전용)
            forward.y = 0f; forward.Normalize();
            right.y = 0f;   right.Normalize();

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
            float tiltAngle = 0f;
            if (moveDir.sqrMagnitude > 0.001f)
            {
                _droneAvatar.transform.position += moveDir.normalized * speed * Time.deltaTime;

                // 이동 시 앞으로 약간 기울어지는 드론 연출 (Gamer Juice!)
                tiltAngle = 10f;
                _droneAvatar.transform.rotation = Quaternion.Euler(tiltAngle, _yaw, _currentRoll);
            }

            // ── 2-b. 수직 이동 (Space: 상승 / LeftCtrl: 하강) ──
            float vertical = 0f;
            if (upKey)   vertical += 1f;
            if (downKey) vertical -= 1f;
            if (Mathf.Abs(vertical) > 0.001f)
            {
                float vSpeed = verticalSpeed * (shiftPressed ? sprintSpeedMultiplier : 1f);
                _baseHoverHeight = Mathf.Clamp(
                    _baseHoverHeight + vertical * vSpeed * Time.deltaTime,
                    minHoverHeight, maxHoverHeight);
            }

            // 3. 월드 경계(공장 내벽) 안쪽으로 강제 클램프 (X/Z만; Y는 별도 클램프)
            ClampToFactoryBounds();

            // 4. 호버링 위아래 흔들림 (Bobbing) — 베이스 높이에 더해진다
            _bobTimer += Time.deltaTime * hoverBobSpeed;
            var pos = _droneAvatar.transform.position;
            pos.y = _baseHoverHeight + Mathf.Sin(_bobTimer) * hoverBobAmount;
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

        private void OnGUI()
        {
            if (!_active) return;

            var style = new GUIStyle(GUI.skin.label)
            {
                fontSize = 12,
                normal = { textColor = new Color(0.7f, 0.9f, 1f, 0.9f) },
            };

            GUI.Box(new Rect(10, Screen.height - 130, 230, 120), "");
            GUI.Label(new Rect(20, Screen.height - 125, 220, 110),
                "카메라 컨트롤\n" +
                "WASD: 이동\n" +
                "Space/Ctrl: 상승/하강\n" +
                "Q/E: 좌/우 회전\n" +
                "Mouse: 시점 (휠: 1/3인칭)\n" +
                "Shift: 가속  |  ESC: 종료",
                style);
        }
    }
}
