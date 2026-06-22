using System.Collections.Generic;
using UnityEngine;
using OHTSim.Core;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 로봇 플릿 관리 — 런타임 로봇 수/속도 조절 핵심.
    /// SetTargetCount(n): 목표 수에 맞춰 활성 로봇을 늘리거나 줄인다. 줄여도 나머지는 계속 동작.
    /// SetSpeedMultiplier(m): GameServices 글로벌에 위임 → 모든 로봇이 다음 프레임부터 반영.
    /// </summary>
    public class RobotFleetController : MonoBehaviour
    {
        [Header("의존성")]
        public GameObject robotPrefab;     // 없으면 Primitive Capsule fallback
        public MapLoaderService mapLoader; // 기존 OHTSim.Core 서비스 재사용

        [Header("초기값 (VisualizationConfig가 우선)")]
        [Range(1, 100)] public int initialCount = 12;

        Transform _robotsRoot;
        RobotPool _pool;
        readonly List<RobotAgent3D> _active = new();

        public int ActiveCount => _active.Count;
        public IReadOnlyList<RobotAgent3D> ActiveRobots => _active;

        void Awake()
        {
            GameServices.RegisterFleetController(this);
        }

        void OnEnable()
        {
            SimEvents.SimulationStarted += HandleSimulationStarted;
            SimEvents.SimulationStopped += HandleSimulationStopped;
        }

        void OnDisable()
        {
            SimEvents.SimulationStarted -= HandleSimulationStarted;
            SimEvents.SimulationStopped -= HandleSimulationStopped;
        }

        // ── 공개 API (UI가 호출) ──────────────────────────────────────
        public void SetTargetCount(int n)
        {
            int max = GameServices.Config != null ? GameServices.Config.maxRobotCount : 100;
            n = Mathf.Clamp(n, 0, max);

            while (_active.Count < n) Spawn();
            while (_active.Count > n) Despawn();
            SimEvents.RaiseActiveRobotCountChanged(_active.Count);
        }

        public void SetSpeedMultiplier(float m) => GameServices.SpeedMultiplier = m;

        // ── 라이프사이클 ───────────────────────────────────────────────
        void HandleSimulationStarted()
        {
            EnsurePool();
            int initial = GameServices.Config != null
                ? GameServices.Config.initialRobotCount
                : initialCount;
            SetTargetCount(initial);

            if (GameServices.Config != null)
                SetSpeedMultiplier(GameServices.Config.initialSpeedMultiplier);
        }

        void HandleSimulationStopped()
        {
            SetTargetCount(0);
        }

        // ── 내부 ──────────────────────────────────────────────────────
        void EnsurePool()
        {
            if (_pool != null) return;
            if (_robotsRoot == null)
            {
                _robotsRoot = new GameObject("Robots").transform;
                _robotsRoot.SetParent(transform, false);
            }
            _pool = new RobotPool(robotPrefab, _robotsRoot);
        }

        void Spawn()
        {
            if (mapLoader == null || !mapLoader.IsLoaded)
            {
                Debug.LogWarning("[RobotFleetController] 맵이 로드되지 않아 스폰 불가");
                return;
            }
            EnsurePool();

            var map = mapLoader.CurrentMap;
            string depotId = PickSpawnNodeId(map, _active.Count);

            var agent = _pool.Rent();
            agent.transform.SetParent(_robotsRoot, false);
            agent.name = $"Robot_{_active.Count:D3}";
            agent.Initialize(map, depotId);
            _active.Add(agent);
        }

        void Despawn()
        {
            if (_active.Count == 0) return;
            int last = _active.Count - 1;
            var agent = _active[last];
            _active.RemoveAt(last);
            _pool.Return(agent);
        }

        static string PickSpawnNodeId(OHTMapData map, int index)
        {
            var depots = map.nodes.FindAll(n => n.type == NodeType.Depot);
            if (depots.Count > 0) return depots[index % depots.Count].id;
            return map.nodes.Count > 0 ? map.nodes[index % map.nodes.Count].id : null;
        }
    }
}
