using UnityEngine;
using OHTSim.Core;

namespace OHTSim.Simulation
{
    // 시뮬레이션 시작/중지 공개 API
    // SRP: 상태 전환만 담당, 실제 에이전트 로직은 별도 컴포넌트에서 구독
    public class SimulationController : MonoBehaviour
    {
        public enum SimState { WaitingForMap, Ready, Running, Paused }

        public SimState State { get; private set; } = SimState.WaitingForMap;

        // 다른 컴포넌트(StartSimButtonUI, 에이전트 등)가 구독
        public event System.Action OnSimulationStarted;
        public event System.Action OnSimulationStopped;
        public event System.Action OnMapReady;

        [Header("서비스 연결")]
        public MapLoaderService loaderService;

        // MapSelectorUI가 맵 로드 완료 후 호출
        public void OnMapLoaded()
        {
            if (!loaderService.IsLoaded)
            {
                Debug.LogWarning("[SimulationController] OnMapLoaded 호출됐으나 맵이 없음");
                return;
            }
            State = SimState.Ready;
            OnMapReady?.Invoke();
            Debug.Log("[SimulationController] 맵 준비 완료. 시뮬레이션 시작 대기 중");
        }

        public void StartSimulation()
        {
            if (State != SimState.Ready && State != SimState.Paused)
            {
                Debug.LogWarning($"[SimulationController] StartSimulation 무시 — 현재 상태: {State}");
                return;
            }
            State = SimState.Running;
            OnSimulationStarted?.Invoke();
            Debug.Log("[SimulationController] 시뮬레이션 시작");
        }

        public void StopSimulation()
        {
            if (State == SimState.WaitingForMap) return;
            State = SimState.Ready;
            OnSimulationStopped?.Invoke();
            Debug.Log("[SimulationController] 시뮬레이션 중지");
        }

        public void PauseSimulation()
        {
            if (State != SimState.Running) return;
            State = SimState.Paused;
        }

        public void ResumeSimulation()
        {
            if (State != SimState.Paused) return;
            State = SimState.Running;
        }
    }
}
