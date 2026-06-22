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
        public ThirdPersonCameraRig thirdPersonCamera;
        public MinimapCamera         minimapCamera;
        public MinimapRenderer       minimapRenderer;
        public CameraModeController  cameraModeController;
        public MinimapHUD            minimapHUD;
        public RuntimeControlsUI     runtimeControlsUI;

        void Awake()
        {
            if (!ValidateRequired()) { enabled = false; return; }

            // 서비스 등록
            GameServices.RegisterConfig(config);
            GameServices.RegisterPrefabRegistry(prefabRegistry);
            GameServices.RegisterMapBuilder(mapBuilder);
            GameServices.RegisterFleetController(fleetController);

            // 초기 속도 배율
            GameServices.SpeedMultiplier = config.initialSpeedMultiplier;

            // 기존 SimulationController ↔ SimEvents 브리지
            simController.OnMapReady          += BridgeMapReady;
            simController.OnSimulationStarted += SimEvents.RaiseSimulationStarted;
            simController.OnSimulationStopped += SimEvents.RaiseSimulationStopped;
        }

        void OnDestroy()
        {
            if (simController != null)
            {
                simController.OnMapReady          -= BridgeMapReady;
                simController.OnSimulationStarted -= SimEvents.RaiseSimulationStarted;
                simController.OnSimulationStopped -= SimEvents.RaiseSimulationStopped;
            }
            GameServices.Reset();
        }

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
