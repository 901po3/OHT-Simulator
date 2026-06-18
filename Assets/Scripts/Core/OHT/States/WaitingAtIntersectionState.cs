namespace OHTSim.Core.OHT.States
{
    public class WaitingAtIntersectionState : IOHTState
    {
        public void Enter(OHTActor actor)
        {
            actor.StateTimer = 0f;
        }

        public void Tick(OHTActor actor, float deltaTime)
        {
            actor.StateTimer += deltaTime;

            var target = actor.PendingIntersection;
            if (target == null)
            {
                actor.StateMachine.TransitionTo(OHTStateType.Moving, actor);
                return;
            }

            if (actor.IntersectionManager.TryReserve(target, actor.Id, actor.SimulationTime))
            {
                actor.PendingIntersection = null;
                actor.ReleaseCurrentIntersectionIfHeld();
                actor.SetNextNode(target);
                actor.StateMachine.TransitionTo(OHTStateType.Moving, actor);
            }
            // StateTimer는 SimulationController에서 읽어 데드락 경고 로그에 사용
        }

        public void Exit(OHTActor actor)
        {
            actor.StateTimer = 0f;
        }
    }
}
