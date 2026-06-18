using System.Collections.Generic;
using OHTSim.Core.OHT;

namespace OHTSim.Simulation
{
    public class SimulationStats
    {
        private readonly List<OHTActor> _actors;

        public int   CompletedJobs      { get; private set; }
        public float ElapsedTime        { get; private set; }
        public float Throughput         => ElapsedTime > 0f ? CompletedJobs / ElapsedTime * 60f : 0f; // jobs/min
        public int   WaitingCount       { get; private set; }
        public int   MovingCount        { get; private set; }
        public int   IdleCount          { get; private set; }

        public SimulationStats(List<OHTActor> actors)
        {
            _actors = actors;
            foreach (var a in actors)
                a.OnJobCompleted += _ => CompletedJobs++;
        }

        public void Tick(float deltaTime)
        {
            ElapsedTime += deltaTime;

            WaitingCount = 0;
            MovingCount  = 0;
            IdleCount    = 0;

            foreach (var a in _actors)
            {
                switch (a.State)
                {
                    case OHTStateType.WaitingAtIntersection: WaitingCount++; break;
                    case OHTStateType.Moving:                MovingCount++;  break;
                    case OHTStateType.Idle:                  IdleCount++;    break;
                }
            }
        }
    }
}
