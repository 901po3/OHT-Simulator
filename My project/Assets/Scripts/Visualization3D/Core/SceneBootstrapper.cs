using UnityEngine;
using OHTSim.Core;
using OHTSim.Simulation;

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
