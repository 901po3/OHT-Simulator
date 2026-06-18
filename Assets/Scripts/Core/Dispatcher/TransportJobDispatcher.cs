using System;
using System.Collections.Generic;
using OHTSim.Core.Graph;
using OHTSim.Core.OHT;

namespace OHTSim.Core.Dispatcher
{
    public class TransportJobDispatcher
    {
        private readonly List<RailNode>  _sources;
        private readonly List<RailNode>  _destinations;
        private readonly List<OHTActor>  _actors;
        private readonly Random          _random;

        private float _spawnInterval;
        private float _spawnTimer;
        private int   _jobCounter;

        public int CompletedJobCount { get; private set; }
        public int PendingJobCount   { get; private set; }

        public TransportJobDispatcher(
            RailGraph graph,
            List<OHTActor> actors,
            float spawnInterval = 2f,
            int randomSeed = 42)
        {
            _actors        = actors;
            _spawnInterval = spawnInterval;
            _random        = new Random(randomSeed);

            _sources      = new List<RailNode>();
            _destinations = new List<RailNode>();

            foreach (var node in graph.AllNodes)
            {
                if (node.IsSource)      _sources.Add(node);
                if (node.IsDestination) _destinations.Add(node);
            }

            foreach (var actor in actors)
                actor.OnJobCompleted += HandleJobCompleted;
        }

        public void Tick(float deltaTime)
        {
            _spawnTimer += deltaTime;
            if (_spawnTimer >= _spawnInterval)
            {
                _spawnTimer = 0f;
                TryDispatch();
            }
        }

        private void TryDispatch()
        {
            if (_sources.Count == 0 || _destinations.Count == 0) return;

            // 유휴 OHT 찾기
            OHTActor idleActor = null;
            foreach (var a in _actors)
            {
                if (a.State == OHTStateType.Idle) { idleActor = a; break; }
            }
            if (idleActor == null) return;

            var src  = _sources[_random.Next(_sources.Count)];
            var dest = _destinations[_random.Next(_destinations.Count)];
            if (src == dest) return;

            var job = new TransportJob($"J{++_jobCounter:000}", src, dest);
            PendingJobCount++;
            idleActor.AssignJob(job);
        }

        private void HandleJobCompleted(OHTActor _)
        {
            CompletedJobCount++;
            PendingJobCount = System.Math.Max(0, PendingJobCount - 1);
            TryDispatch();
        }
    }
}
