using System.Collections.Generic;
using OHTSim.Core.OHT.States;

namespace OHTSim.Core.OHT
{
    public class OHTStateMachine
    {
        private readonly Dictionary<OHTStateType, IOHTState> _states;

        public OHTStateType CurrentStateType { get; private set; }
        private IOHTState _current;

        public OHTStateMachine()
        {
            _states = new Dictionary<OHTStateType, IOHTState>
            {
                { OHTStateType.Idle,                  new IdleState()                  },
                { OHTStateType.Moving,                new MovingState()                },
                { OHTStateType.WaitingAtIntersection, new WaitingAtIntersectionState() },
                { OHTStateType.Loading,               new LoadingState()               },
                { OHTStateType.Unloading,             new UnloadingState()             },
            };
        }

        internal void Initialize(OHTActor actor, OHTStateType initial)
        {
            CurrentStateType = initial;
            _current = _states[initial];
            _current.Enter(actor);
        }

        internal void Tick(OHTActor actor, float deltaTime)
            => _current?.Tick(actor, deltaTime);

        internal void TransitionTo(OHTStateType next, OHTActor actor)
        {
            _current?.Exit(actor);
            CurrentStateType = next;
            _current = _states[next];
            _current.Enter(actor);
        }
    }
}
