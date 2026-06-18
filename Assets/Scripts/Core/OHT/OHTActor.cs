using System;
using System.Collections.Generic;
using OHTSim.Core.Dispatcher;
using OHTSim.Core.Graph;
using OHTSim.Core.Intersection;
using OHTSim.Core.Pathfinding;

namespace OHTSim.Core.OHT
{
    public class OHTActor
    {
        // ── Public (읽기 전용, 시각화 계층용) ──────────────────────────────

        public string       Id          { get; }
        public OHTStateType State       => _stateMachine.CurrentStateType;
        public RailNode     CurrentNode { get; private set; }
        public RailNode     NextNode    { get; private set; }
        public float        EdgeProgress { get; private set; }
        public bool         HasFOUP     { get; private set; }
        public TransportJob CurrentJob  { get; private set; }
        public float        SimulationTime { get; private set; }
        public float        Speed       { get; set; } = 2f;

        public event Action<OHTActor> OnJobCompleted;

        // ── Internal (상태 클래스 전용) ────────────────────────────────────

        internal OHTStateMachine      StateMachine         => _stateMachine;
        internal IPathFinder          PathFinder           => _pathFinder;
        internal IIntersectionManager IntersectionManager  => _intersectionManager;
        internal RailNode             PendingIntersection  { get; set; }
        // 시각화/진단용으로 public — 상태 내부에서 set은 internal로 제한
        public  float                StateTimer           { get; internal set; }
        internal JobPhase             CurrentJobPhase      { get; private set; }

        // ── Private ────────────────────────────────────────────────────────

        private readonly OHTStateMachine      _stateMachine;
        private readonly IPathFinder          _pathFinder;
        private readonly IIntersectionManager _intersectionManager;

        private List<RailNode> _currentPath  = new List<RailNode>();
        private int            _pathIndex;

        // ── Constructor ────────────────────────────────────────────────────

        public OHTActor(
            string id,
            RailNode startNode,
            IPathFinder pathFinder,
            IIntersectionManager intersectionManager)
        {
            Id                   = id;
            CurrentNode          = startNode;
            _pathFinder          = pathFinder;
            _intersectionManager = intersectionManager;
            _stateMachine        = new OHTStateMachine();
            _stateMachine.Initialize(this, OHTStateType.Idle);
        }

        // ── Public API ─────────────────────────────────────────────────────

        public void AssignJob(TransportJob job)
        {
            if (State != OHTStateType.Idle) return;

            CurrentJob      = job;
            CurrentJobPhase = JobPhase.GoingToSource;

            if (CurrentNode == job.SourceNode)
            {
                _stateMachine.TransitionTo(OHTStateType.Loading, this);
                return;
            }

            BuildAndSetPath(CurrentNode, job.SourceNode);
            _stateMachine.TransitionTo(OHTStateType.Moving, this);
        }

        public void Tick(float deltaTime, float currentTime)
        {
            SimulationTime = currentTime;
            _stateMachine.Tick(this, deltaTime);
        }

        // ── Internal helpers (상태 클래스에서 호출) ────────────────────────

        internal RailNode GetNextPathNode()
            => _pathIndex < _currentPath.Count ? _currentPath[_pathIndex] : null;

        internal void SetNextNode(RailNode node)
        {
            NextNode     = node;
            EdgeProgress = 0f;
        }

        internal void AdvanceEdge(float deltaTime)
        {
            if (NextNode == null) return;
            var edge = CurrentNode.GetEdgeTo(NextNode);
            EdgeProgress += Speed / edge.Length * deltaTime;
        }

        // 엣지 이동 완료 → 다음 노드 도착 처리
        // 교차로 예약은 이 시점에서 해제하지 않는다.
        // 아직 해당 노드를 물리적으로 점유 중이므로, 다음 노드를 향해 출발할 때 해제한다.
        internal void ArriveAtNextNode()
        {
            if (NextNode == null) return;

            CurrentNode  = NextNode;
            NextNode     = null;
            EdgeProgress = 0f;
            _pathIndex++;
        }

        // 현재 노드가 교차로인 경우 예약 해제 (다음 엣지 출발 직전에 호출)
        internal void ReleaseCurrentIntersectionIfHeld()
        {
            if (CurrentNode.IsIntersection)
                _intersectionManager.Release(CurrentNode, Id);
        }

        internal void SetHasFOUP(bool value) => HasFOUP = value;

        internal void SetJobPhase(JobPhase phase) => CurrentJobPhase = phase;

        internal void BuildAndSetPath(RailNode from, RailNode to)
        {
            var full = _pathFinder.FindPath(from, to);
            // 시작 노드를 제외하고 저장 (현재 위치는 이미 알고 있음)
            _currentPath = full.Count > 1 ? full.GetRange(1, full.Count - 1) : new List<RailNode>();
            _pathIndex   = 0;
        }

        internal void FireJobCompleted()
        {
            CurrentJob      = null;
            CurrentJobPhase = JobPhase.None;
            OnJobCompleted?.Invoke(this);
        }
    }
}
