using UnityEngine;
using OHTSim.Core;
using OHTSim.Simulation;
using OHTSim.UI;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 3D 씬 부팅 — 모든 서비스 등록 + 기존 SimulationController 이벤트를 SimEvents로 브리지.
    /// 씬에 단 하나만 배치한다. 인스펙터에서 모든 의존성을 주입한다.
    /// </summary>
    public class SceneBootstrapper : MonoBehaviour
    {
        [Header("ScriptableObject 설정 (필수)")]
        public VisualizationConfig config;
        public NodePrefabRegistry  prefabRegistry;

        [Header("씬 컴포넌트 (필수)")]
        public Map3DBuilder         mapBuilder;
        public RobotFleetController fleetController;
        public MapLoaderService     mapLoader;
        public SimulationController simController;

        [Header("씬 컴포넌트 (선택)")]
        public Camera                   mainCamera;   // 미지정 시 Camera.main 사용
        public ThirdPersonCameraRig     thirdPersonCamera;
        public MinimapCamera            minimapCamera;
        public MinimapRenderer          minimapRenderer;
        public CameraModeController     cameraModeController;
        public MinimapHUD               minimapHUD;
        public RuntimeControlsUI        runtimeControlsUI;
        public FactoryEnvironmentBuilder factoryEnvironment;
        public AutoStartOnMapReady       autoStart;

        bool _subscribed;

        void Awake()
        {
            // 최대 프레임 레이트를 60FPS로 고정 (게이머 요청 사양)
            Application.targetFrameRate = 60;

            if (!ValidateRequired()) { enabled = false; return; }

            // 서비스 등록은 Awake에서 — 다른 컴포넌트의 Start()보다 먼저 보장.
            // Awake 순서는 Unity가 결정하지만 Bootstrapper가 모든 SO/MonoBehaviour를
            // 인스펙터로 직접 참조하므로 그 시점에는 모두 유효함.
            GameServices.RegisterConfig(config);
            GameServices.RegisterPrefabRegistry(prefabRegistry);
            GameServices.RegisterMapBuilder(mapBuilder);
            GameServices.RegisterFleetController(fleetController);
            GameServices.SpeedMultiplier = config.initialSpeedMultiplier;
        }

        // 카메라 컬링 마스크 설정은 Start()에서 — MinimapCamera.Awake()가 Cam을 할당한 뒤를 보장.
        void Start()
        {
            ConfigureCullingMasks();

            // ── 런타임 CameramanController 자동 장착 ──
            Camera mainCam = mainCamera != null ? mainCamera : Camera.main;
            if (mainCam != null)
            {
                if (mainCam.GetComponent<CameramanController>() == null)
                {
                    mainCam.gameObject.AddComponent<CameramanController>();
                    Debug.Log("[SceneBootstrapper] Main Camera에 CameramanController 자동 장착 완료!");
                }
            }

            // ── 런타임 🎥 DRONE VIEW 버튼 동적 생성 ──
            CreateCameramanButton();

            // ── 런타임 🗺️ MAP CHANGE 버튼 동적 생성 ──
            CreateChangeMapButton();

            // ── 런타임 UI Text 화질 개선 샤프닝 ──
            var canvas = GameObject.Find("UICanvas");
            if (canvas != null)
            {
                var sharpener = canvas.GetComponent<OHTSim.UI.TextSharpener>() ?? canvas.AddComponent<OHTSim.UI.TextSharpener>();
                sharpener.SharpenAllTextsInCanvas();
            }
        }

        private void CreateCameramanButton()
        {
            if (cameraModeController == null) return;

            // StartSimButton 찾기
            var startSimBtnUI = Object.FindAnyObjectByType<StartSimButtonUI>();
            if (startSimBtnUI == null) return;

            // 버튼의 부모 Canvas/Panel 찾기
            Transform uiParent = startSimBtnUI.transform.parent;
            if (uiParent == null) return;

            // 1. 새로운 버튼 GameObject 생성
            GameObject btnGo = new GameObject("CameramanViewButton", typeof(RectTransform));
            var rect = btnGo.GetComponent<RectTransform>();
            rect.SetParent(uiParent, false);

            // 2. RectTransform 배치 (시뮬레이션 시작 버튼 오른쪽에 이격하여 배치)
            var startSimRect = startSimBtnUI.GetComponent<RectTransform>();
            rect.anchorMin = startSimRect.anchorMin;
            rect.anchorMax = startSimRect.anchorMax;
            rect.pivot = startSimRect.pivot;
            rect.sizeDelta = new Vector2(130f, 36f); // 버튼 크기

            // 시뮬레이션 시작 버튼 위치로부터 오른쪽으로 약 155픽셀 이격
            rect.anchoredPosition = startSimRect.anchoredPosition + new Vector2(155f, 0f);

            // 3. 버튼 이미지 및 컬러 스타일링 (스마트 팩토리 글로잉 테마)
            var btnImg = btnGo.AddComponent<UnityEngine.UI.Image>();
            btnImg.color = new Color(0.08f, 0.13f, 0.22f, 0.92f); // 딥 네이비 반투명

            // 아웃라인 효과 추가
            var outline = btnGo.AddComponent<UnityEngine.UI.Outline>();
            outline.effectColor = new Color(0f, 0.85f, 1f, 0.6f); // 형광 청록
            outline.effectDistance = new Vector2(1.5f, 1.5f);

            // 4. Button 컴포넌트 추가 및 클릭 리스너 연결
            var btn = btnGo.AddComponent<UnityEngine.UI.Button>();
            btn.transition = UnityEngine.UI.Selectable.Transition.ColorTint;
            var colors = btn.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(0f, 0.9f, 1f);
            colors.pressedColor = new Color(0f, 0.6f, 0.8f);
            btn.colors = colors;

            btn.onClick.AddListener(() => {
                cameraModeController.ToggleCameramanView();
            });

            // 5. 버튼 텍스트 추가
            GameObject txtGo = new GameObject("Text", typeof(RectTransform));
            var txtRect = txtGo.GetComponent<RectTransform>();
            txtRect.SetParent(rect, false);
            txtRect.anchorMin = Vector2.zero;
            txtRect.anchorMax = Vector2.one;
            txtRect.sizeDelta = Vector2.zero;
            txtRect.anchoredPosition = Vector2.zero;

            var txt = txtGo.AddComponent<UnityEngine.UI.Text>();
            txt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            txt.text = "🎥 DRONE VIEW";
            txt.fontStyle = FontStyle.Bold;
            txt.fontSize = 12;
            txt.alignment = TextAnchor.MiddleCenter;
            txt.color = new Color(0f, 0.9f, 1f); // 청록 발광 텍스트

            // 텍스트 샤프닝 적용!
            OHTSim.UI.TextSharpener.SharpenText(txt);
        }

        private void CreateChangeMapButton()
        {
            if (simController == null) return;

            // StartSimButton 찾기
            var startSimBtnUI = Object.FindAnyObjectByType<StartSimButtonUI>();
            if (startSimBtnUI == null) return;

            // 버튼의 부모 Canvas/Panel 찾기
            Transform uiParent = startSimBtnUI.transform.parent;
            if (uiParent == null) return;

            // 1. 새로운 버튼 GameObject 생성
            GameObject btnGo = new GameObject("ChangeMapButton", typeof(RectTransform));
            var rect = btnGo.GetComponent<RectTransform>();
            rect.SetParent(uiParent, false);

            // 2. RectTransform 배치 (시뮬레이션 시작 버튼 왼쪽에 대칭으로 배치 - 게이머 UI 주스!)
            var startSimRect = startSimBtnUI.GetComponent<RectTransform>();
            rect.anchorMin = startSimRect.anchorMin;
            rect.anchorMax = startSimRect.anchorMax;
            rect.pivot = startSimRect.pivot;
            rect.sizeDelta = new Vector2(130f, 36f); // 버튼 크기

            // 시뮬레이션 시작 버튼 위치로부터 왼쪽으로 155픽셀 이격
            rect.anchoredPosition = startSimRect.anchoredPosition - new Vector2(155f, 0f);

            // 3. 버튼 이미지 및 컬러 스타일링 (스마트 팩토리 글로잉 테마 - 딥 블루/오렌지 하이브리드)
            var btnImg = btnGo.AddComponent<UnityEngine.UI.Image>();
            btnImg.color = new Color(0.08f, 0.11f, 0.2f, 0.92f); // 딥 네이비 반투명

            // 아웃라인 효과 추가 (오렌지/호버링 느낌)
            var outline = btnGo.AddComponent<UnityEngine.UI.Outline>();
            outline.effectColor = new Color(1f, 0.6f, 0f, 0.6f); // 따뜻한 주황빛 발광 아웃라인
            outline.effectDistance = new Vector2(1.5f, 1.5f);

            // 4. Button 컴포넌트 추가 및 클릭 리스너 연결
            var btn = btnGo.AddComponent<UnityEngine.UI.Button>();
            btn.transition = UnityEngine.UI.Selectable.Transition.ColorTint;
            var colors = btn.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1f, 0.7f, 0.2f);
            colors.pressedColor = new Color(0.8f, 0.4f, 0f);
            btn.colors = colors;

            btn.onClick.AddListener(() => {
                // 1. 시뮬레이션이 런타임 중이라면 먼저 중지 (OHT 로봇 풀링 및 정리)
                simController.StopSimulation();

                // 2. 맵 선택기 UI 열기
                var mapUI = Object.FindAnyObjectByType<OHTSim.UI.MapSelectorUI>();
                if (mapUI != null)
                {
                    mapUI.ShowSelector();
                }
            });

            // 5. 버튼 텍스트 추가
            GameObject txtGo = new GameObject("Text", typeof(RectTransform));
            var txtRect = txtGo.GetComponent<RectTransform>();
            txtRect.SetParent(rect, false);
            txtRect.anchorMin = Vector2.zero;
            txtRect.anchorMax = Vector2.one;
            txtRect.sizeDelta = Vector2.zero;
            txtRect.anchoredPosition = Vector2.zero;

            var txt = txtGo.AddComponent<UnityEngine.UI.Text>();
            txt.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            txt.text = "🗺️ CHANGE MAP";
            txt.fontStyle = FontStyle.Bold;
            txt.fontSize = 12;
            txt.alignment = TextAnchor.MiddleCenter;
            txt.color = new Color(1f, 0.7f, 0.2f); // 밝은 오렌지 발광 텍스트

            // 텍스트 샤프닝 적용!
            OHTSim.UI.TextSharpener.SharpenText(txt);
        }

        /// <summary>
        /// MinimapOnly 레이어를 메인 3D 카메라에서는 숨기고, 미니맵/탑뷰 카메라에서는 보이게 한다.
        /// 혼잡도 오버레이가 미니맵에서만 보이도록 한다.
        /// </summary>
        void ConfigureCullingMasks()
        {
            int mask = 1 << Map3DBuilder.MinimapOnlyLayer;

            Camera mainCam = mainCamera != null ? mainCamera : Camera.main;
            if (mainCam != null) mainCam.cullingMask &= ~mask;          // 3D에서 숨김

            if (minimapCamera != null && minimapCamera.Cam != null)
                minimapCamera.Cam.cullingMask |= mask;                  // 미니맵에서 표시
        }

        // 이벤트 구독은 OnEnable/OnDisable 짝으로 — 도메인 재로딩·컴포넌트 토글 안전.
        void OnEnable()
        {
            if (!enabled || simController == null) return;
            if (_subscribed) return;  // 안전 가드 (Domain Reload 등)
            simController.OnMapReady          += BridgeMapReady;
            simController.OnSimulationStarted += SimEvents.RaiseSimulationStarted;
            simController.OnSimulationStopped += SimEvents.RaiseSimulationStopped;
            _subscribed = true;
        }

        void OnDisable()
        {
            if (!_subscribed || simController == null) return;
            simController.OnMapReady          -= BridgeMapReady;
            simController.OnSimulationStarted -= SimEvents.RaiseSimulationStarted;
            simController.OnSimulationStopped -= SimEvents.RaiseSimulationStopped;
            _subscribed = false;
        }

        void OnDestroy() => GameServices.Reset();

        void BridgeMapReady()
        {
            if (mapLoader != null && mapLoader.IsLoaded)
                mapBuilder.Build(mapLoader.CurrentMap);
        }

        bool ValidateRequired()
        {
            bool ok = true;
            void Check(Object obj, string name)
            {
                if (obj == null) { Debug.LogError($"[SceneBootstrapper] {name} 누락"); ok = false; }
            }
            Check(config,          nameof(config));
            Check(prefabRegistry,  nameof(prefabRegistry));
            Check(mapBuilder,      nameof(mapBuilder));
            Check(fleetController, nameof(fleetController));
            Check(mapLoader,       nameof(mapLoader));
            Check(simController,   nameof(simController));
            return ok;
        }
    }
}
