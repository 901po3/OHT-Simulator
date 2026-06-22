using UnityEngine;
using OHTSim.Simulation;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 맵이 로드되면 한 프레임 뒤 자동으로 시뮬레이션을 시작한다.
    /// Map3DBuilder가 빌드를 끝낸 후 시작하도록 의도적으로 yield.
    /// StartSimButtonUI를 대체하거나 공존 가능 (둘 다 OnMapReady 구독).
    /// </summary>
    public class AutoStartOnMapReady : MonoBehaviour
    {
        [Header("의존성")]
        public SimulationController simController;

        [Tooltip("맵 로드 후 시작까지 지연 (초). 0이면 다음 프레임.")]
        public float delaySeconds = 0.1f;

        void OnEnable()
        {
            if (simController != null)
                simController.OnMapReady += HandleMapReady;
        }

        void OnDisable()
        {
            if (simController != null)
                simController.OnMapReady -= HandleMapReady;
        }

        void HandleMapReady()
        {
            if (delaySeconds <= 0f) Invoke(nameof(StartNow), 0.01f);
            else                    Invoke(nameof(StartNow), delaySeconds);
        }

        void StartNow()
        {
            if (simController != null && simController.State == SimulationController.SimState.Ready)
            {
                simController.StartSimulation();
                Debug.Log("[AutoStartOnMapReady] 시뮬레이션 자동 시작");
            }
        }
    }
}
