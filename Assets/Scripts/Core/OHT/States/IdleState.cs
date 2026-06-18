namespace OHTSim.Core.OHT.States
{
    public class IdleState : IOHTState
    {
        public void Enter(OHTActor actor) { }

        public void Tick(OHTActor actor, float deltaTime)
        {
            // 작업 배정은 외부 Dispatcher가 AssignJob()을 호출해 처리
        }

        public void Exit(OHTActor actor) { }
    }
}
