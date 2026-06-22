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
            SimEvents.MapBuilt          += HandleMapBuilt;
        }

        void OnDisable()
        {
            SimEvents.SimulationStarted -= HandleSimulationStarted;
            SimEvents.SimulationStopped -= HandleSimulationStopped;
            SimEvents.MapBuilt          -= HandleMapBuilt;
        }

        // ── 공개 API (UI가 호출) ──────────────────────────────────────
        // 런타임 슬라이더 호출 핵심 진입점. 맵 로드 전이면 스폰이 무시되지만
        // 슬라이더 값 자체는 보존되어 다음 시뮬레이션 시작 때 적용된다.
        public void SetTargetCount(int n)
        {
            int max = GameServices.Config != null ? GameServices.Config.maxRobotCount : 100;
            n = Mathf.Clamp(n, 0, max);
            int before = _active.Count;

            while (_active.Count < n) {
                int prevCount = _active.Count;
                Spawn();
                // 스폰 실패(맵 미로드 등)로 카운트가 늘지 않으면 무한루프 방지를 위해 즉시 탈출
                if (_active.Count == prevCount) break;
            }
            while (_active.Count > n) Despawn();
            if (before != _active.Count)
                Debug.Log($"[RobotFleetController] SetTargetCount {before} → {_active.Count} (요청={n})");
            SimEvents.RaiseActiveRobotCountChanged(_active.Count);
        }

        public void SetSpeedMultiplier(float m)
        {
            GameServices.SpeedMultiplier = m;
            Debug.Log($"[RobotFleetController] SetSpeedMultiplier → {GameServices.SpeedMultiplier:F2}×");
        }

        // 맵이 새로 빌드되면 기존 로봇 인스턴스의 노드 참조가 모두 무효화된다.
        // 풀까지 폐기하여 다음 스폰 사이클에서 새 맵 기준으로 깨끗하게 다시 만든다.
        void HandleMapBuilt(int nodeCount, int edgeCount)
        {
            ClearAllRobots();
            Debug.Log($"[RobotFleetController] 맵 재빌드 감지 — 로봇 풀 초기화 (nodes={nodeCount})");
        }

        void ClearAllRobots()
        {
            // 활성 로봇 강제 디스폰
            for (int i = _active.Count - 1; i >= 0; i--)
            {
                var a = _active[i];
                if (a != null) Destroy(a.gameObject);
            }
            _active.Clear();

            // 풀과 루트 컨테이너도 폐기 — 다음 EnsurePool 호출에서 새로 만든다
            if (_robotsRoot != null)
            {
                Destroy(_robotsRoot.gameObject);
                _robotsRoot = null;
            }
            _pool = null;

            // 노드 점유 레지스트리 초기화 — 새 맵/사이클은 빈 점유 상태에서 시작.
            // (로봇 OnDisable이 개별 해제하지만, 일괄 Clear로 잔여 점유를 확실히 제거)
            NodeOccupancyService.Clear();

            SimEvents.RaiseActiveRobotCountChanged(0);
        }

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
