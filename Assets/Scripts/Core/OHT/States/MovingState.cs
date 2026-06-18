namespace OHTSim.Core.OHT.States
{
    public class MovingState : IOHTState
    {
        public void Enter(OHTActor actor) { }

        public void Tick(OHTActor actor, float deltaTime)
        {
            // 현재 엣지를 이동 중인 경우
            if (actor.NextNode != null)
            {
                actor.AdvanceEdge(deltaTime);

                if (actor.EdgeProgress >= 1f)
                    actor.ArriveAtNextNode();

                return;
            }

            // 다음 경로 노드 확인
            var nextNode = actor.GetNextPathNode();

            if (nextNode == null)
            {
                HandleArrival(actor);
                return;
            }

            // 교차로이면 예약 시도
            if (nextNode.IsIntersection)
            {
                if (!actor.IntersectionManager.TryReserve(nextNode, actor.Id, actor.SimulationTime))
                {
                    actor.PendingIntersection = nextNode;
                    actor.StateMachine.TransitionTo(OHTStateType.WaitingAtIntersection, actor);
                    return;
                }
            }

            // BUG-1 수정: 현재 노드(교차로)를 떠나는 시점에 예약 해제
            actor.ReleaseCurrentIntersectionIfHeld();
            actor.SetNextNode(nextNode);
        }

        public void Exit(OHTActor actor) { }

        private static void HandleArrival(OHTActor actor)
        {
            if (actor.CurrentJobPhase == JobPhase.GoingToSource
                && actor.CurrentNode == actor.CurrentJob?.SourceNode)
            {
                actor.StateMachine.TransitionTo(OHTStateType.Loading, actor);
                return;
            }

            if (actor.CurrentJobPhase == JobPhase.GoingToDestination
                && actor.CurrentNode == actor.CurrentJob?.DestinationNode)
            {
                actor.StateMachine.TransitionTo(OHTStateType.Unloading, actor);
                return;
            }

            // BUG-2 수정: 경로 소진 후 목적지가 아닌 경우 — 경로 재탐색 후 이동 재개
            var target = actor.CurrentJobPhase == JobPhase.GoingToSource
                ? actor.CurrentJob?.SourceNode
                : actor.CurrentJob?.DestinationNode;

            if (target != null && actor.CurrentNode != target)
            {
                actor.BuildAndSetPath(actor.CurrentNode, target);
                // Moving 상태 유지, 다음 Tick에서 새 경로를 따름
            }
            else
            {
                // 유효한 작업이 없거나 경로를 찾을 수 없는 경우 Idle로 복귀
                actor.FireJobCompleted();
                actor.StateMachine.TransitionTo(OHTStateType.Idle, actor);
            }
        }
    }
}
