using System.Collections.Generic;
using UnityEngine;
using OHTSim.Core.Dispatcher;
using OHTSim.Core.Graph;
using OHTSim.Core.Intersection;
using OHTSim.Core.OHT;
using OHTSim.Core.Pathfinding;
using OHTSim.Visualization;

namespace OHTSim.Simulation
{
    public class SimulationController : MonoBehaviour
    {
        [Header("Simulation Parameters")]
        [SerializeField] private int   ohtCount         = 8;
        [SerializeField] private float ohtSpeed         = 2f;
        [SerializeField] private float jobSpawnInterval = 2f;

        [Header("Visualization")]
        [SerializeField] private OHTView      ohtViewPrefab;
        [SerializeField] private RailRenderer railRendererPrefab;

        // ── 공개 참조 (StatsPanel 등 외부에서 읽음) ─────────────────────

        public RailGraph           Graph      { get; private set; }
        public List<OHTActor>      Actors     { get; private set; }
        public TransportJobDispatcher Dispatcher { get; private set; }
        public SimulationStats     Stats      { get; private set; }

        // ── Private ──────────────────────────────────────────────────────

        private readonly List<OHTView> _views = new List<OHTView>();

        private void Start()
        {
            Graph = MapBuilder.BuildDefaultMap();

            var pathFinder           = new AStarPathFinder();
            var intersectionManager  = new IntersectionReservationManager();

            Actors = new List<OHTActor>();
            var normalNodes = new List<RailNode>();
            foreach (var n in Graph.AllNodes) normalNodes.Add(n);

            for (int i = 0; i < ohtCount; i++)
            {
                var startNode = normalNodes[i % normalNodes.Count];
                var actor     = new OHTActor($"OHT-{i + 1:00}", startNode, pathFinder, intersectionManager);
                actor.Speed   = ohtSpeed;
                Actors.Add(actor);
            }

            Dispatcher = new TransportJobDispatcher(Graph, Actors, jobSpawnInterval);
            Stats      = new SimulationStats(Actors);

            SpawnVisualization();
        }

        private void Update()
        {
            float dt   = Time.deltaTime;
            float time = Time.time;

            foreach (var actor in Actors)
            {
                actor.Tick(dt, time);
                ReportDeadlockIfNeeded(actor);
            }

            Dispatcher.Tick(dt);
            Stats.Tick(dt);
        }

        // Core 계층은 UnityEngine을 사용할 수 없으므로, 데드락 경고 로그는 여기서 처리
        private static void ReportDeadlockIfNeeded(OHTActor actor)
        {
            if (actor.State == OHTStateType.WaitingAtIntersection && actor.StateTimer > 4f)
                Debug.LogWarning($"[OHT] {actor.Id} waiting {actor.StateTimer:F1}s — potential deadlock");
        }

        private void SpawnVisualization()
        {
            if (railRendererPrefab != null)
            {
                var rr = Instantiate(railRendererPrefab);
                rr.Initialize(Graph);
            }

            if (ohtViewPrefab == null) return;

            foreach (var actor in Actors)
            {
                var view = Instantiate(ohtViewPrefab);
                view.Initialize(actor, Graph);
                _views.Add(view);
            }
        }
    }
}
