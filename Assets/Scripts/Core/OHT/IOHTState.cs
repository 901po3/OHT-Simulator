namespace OHTSim.Core.OHT
{
    public interface IOHTState
    {
        void Enter(OHTActor actor);
        void Tick(OHTActor actor, float deltaTime);
        void Exit(OHTActor actor);
    }
}
