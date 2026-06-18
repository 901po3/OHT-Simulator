namespace OHTSim.Core.OHT.States
{
    public class UnloadingState : IOHTState
    {
        private const float UnloadDurationSeconds = 0.5f;

        public void Enter(OHTActor actor)
        {
            actor.StateTimer = 0f;
        }

        public void Tick(OHTActor actor, float deltaTime)
        {
            actor.StateTimer += deltaTime;

            if (actor.StateTimer >= UnloadDurationSeconds)
            {
                actor.SetHasFOUP(false);
                actor.FireJobCompleted();
                actor.StateMachine.TransitionTo(OHTStateType.Idle, actor);
            }
        }

        public void Exit(OHTActor actor)
        {
            actor.StateTimer = 0f;
        }
    }
}
