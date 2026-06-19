using UnityEngine;
using OHTSim.Core.Graph;
using OHTSim.Core.OHT;

namespace OHTSim.Visualization
{
    /// <summary>
    /// OHTActor의 상태를 읽어 Unity Transform과 머티리얼을 갱신한다.
    /// Core 로직에 전혀 의존하지 않으므로 OHTActor를 교체해도 이 클래스는 무수정.
    /// </summary>
    [RequireComponent(typeof(Renderer))]
    public class OHTView : MonoBehaviour
    {
        [SerializeField] private Color colorIdle                 = Color.gray;
        [SerializeField] private Color colorMoving               = Color.green;
        [SerializeField] private Color colorWaiting              = Color.red;
        [SerializeField] private Color colorLoadingOrUnloading   = Color.yellow;

        private OHTActor  _actor;
        private RailGraph _graph;
        private Renderer  _renderer;
        private Renderer[] _renderers;
        private MaterialPropertyBlock _propBlock;

        public void Initialize(OHTActor actor, RailGraph graph)
        {
            _actor    = actor;
            _graph    = graph;
            _renderer = GetComponent<Renderer>();
            _renderers = GetComponentsInChildren<Renderer>();
            _propBlock = new MaterialPropertyBlock();
            name = actor.Id;
        }

        private void Update()
        {
            if (_actor == null) return;

            UpdatePosition();
            UpdateColor();
        }

        private void UpdatePosition()
        {
            Vector3 pos;

            if (_actor.NextNode != null)
            {
                var from = NodeToWorld(_actor.CurrentNode);
                var to   = NodeToWorld(_actor.NextNode);
                pos = Vector3.Lerp(from, to, _actor.EdgeProgress);
            }
            else
            {
                pos = NodeToWorld(_actor.CurrentNode);
            }

            transform.position = pos;
        }

        private void UpdateColor()
        {
            Color c = _actor.State switch
            {
                OHTStateType.Idle                  => colorIdle,
                OHTStateType.Moving                => colorMoving,
                OHTStateType.WaitingAtIntersection => colorWaiting,
                OHTStateType.Loading               => colorLoadingOrUnloading,
                OHTStateType.Unloading             => colorLoadingOrUnloading,
                _                                  => Color.white,
            };

            _propBlock.SetColor("_BaseColor", c);
            if (_renderers != null)
            {
                foreach (var r in _renderers)
                {
                    if (r != null) r.SetPropertyBlock(_propBlock);
                }
            }
            else if (_renderer != null)
            {
                _renderer.SetPropertyBlock(_propBlock);
            }
        }

        // Core 좌표 (X, Y) → Unity 월드 좌표 (X, 0.5, Y)
        private static Vector3 NodeToWorld(RailNode node)
            => new Vector3(node.X, 0.5f, node.Y);
    }
}
