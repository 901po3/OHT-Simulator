using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// Service Locator — 시스템 간 1:1 직접 참조 대신 여기서 해소한다.
    /// SceneBootstrapper가 부팅 시 한 번만 등록하고, 이후 시스템은 읽기만 한다.
    /// 런타임 속도 배율(SpeedMultiplier)도 여기에 둔다 — 모든 로봇이 매 프레임 참조하는 글로벌.
    /// </summary>
    public static class GameServices
    {
        // ── 등록된 서비스 (SceneBootstrapper에서 주입) ────────────────
        public static VisualizationConfig Config           { get; private set; }
        public static NodePrefabRegistry  PrefabRegistry   { get; private set; }
        public static Map3DBuilder        MapBuilder       { get; private set; }
        public static RobotFleetController FleetController { get; private set; }

        // ── 런타임 글로벌 (UI ↔ 로봇 공유) ─────────────────────────────
        static float _speedMultiplier = 1f;
        public static float SpeedMultiplier
        {
            get => _speedMultiplier;
            set
            {
                float clamped = Mathf.Clamp(value, 0.1f, 5f);
                if (Mathf.Approximately(_speedMultiplier, clamped)) return;
                _speedMultiplier = clamped;
                SimEvents.RaiseSpeedMultiplierChanged(clamped);
            }
        }

        // ── 등록 API ───────────────────────────────────────────────────
        public static void RegisterConfig(VisualizationConfig c)            => Config = c;
        public static void RegisterPrefabRegistry(NodePrefabRegistry r)     => PrefabRegistry = r;
        public static void RegisterMapBuilder(Map3DBuilder b)               => MapBuilder = b;
        public static void RegisterFleetController(RobotFleetController f)  => FleetController = f;

        /// <summary>씬 언로드 등 정리 시점에 호출 — 메모리 누수 방지.</summary>
        public static void Reset()
        {
            Config = null;
            PrefabRegistry = null;
            MapBuilder = null;
            FleetController = null;
            _speedMultiplier = 1f;
        }
    }
}
