namespace OHTSim.Core.OHT.States
{
    public class LoadingState : IOHTState
    {
        private const float LoadDurationSeconds = 0.5f;

        public void Enter(OHTActor actor)
        {
            actor.StateTimer = 0f;
        }

        public void Tick(OHTActor actor, float deltaTime)
        {
            actor.StateTimer += deltaTime;

            if (actor.StateTimer >= LoadDurationSeconds)
            {
                actor.SetHasFOUP(true);
                actor.SetJobPhase(JobPhase.GoingToDestination);
                actor.BuildAndSetPath(actor.CurrentNode, actor.CurrentJob.DestinationNode);
                actor.StateMachine.TransitionTo(OHTStateType.Moving, actor);
            }
        }

        public void Exit(OHTActor actor)
        {
            actor.StateTimer = 0f;
        }
    }
}
