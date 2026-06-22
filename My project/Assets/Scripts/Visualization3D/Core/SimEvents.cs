using System;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 전역 이벤트 허브 — 시스템 간 직접 참조 대신 이 정적 클래스를 통해 통신한다.
    /// 의존성 격리 핵심 메커니즘.
    /// 구독은 OnEnable에서, 해제는 OnDisable에서.
    /// </summary>
    public static class SimEvents
    {
        // 맵 라이프사이클
        public static event Action<int /*nodeCount*/, int /*edgeCount*/> MapBuilt;

        // 시뮬레이션 라이프사이클
        public static event Action SimulationStarted;
        public static event Action SimulationStopped;

        // 로봇 플릿 상태
        public static event Action<int /*activeRobots*/> ActiveRobotCountChanged;
        public static event Action<float /*multiplier*/> SpeedMultiplierChanged;

        // 카메라 모드
        public enum CameraMode { ThirdPerson, FullscreenTopView }
        public static event Action<CameraMode> CameraModeChanged;

        // 발행자(publisher) 헬퍼 — null 체크 일관성
        public static void RaiseMapBuilt(int nodes, int edges)        => MapBuilt?.Invoke(nodes, edges);
        public static void RaiseSimulationStarted()                    => SimulationStarted?.Invoke();
        public static void RaiseSimulationStopped()                    => SimulationStopped?.Invoke();
        public static void RaiseActiveRobotCountChanged(int n)         => ActiveRobotCountChanged?.Invoke(n);
        public static void RaiseSpeedMultiplierChanged(float m)        => SpeedMultiplierChanged?.Invoke(m);
        public static void RaiseCameraModeChanged(CameraMode m)        => CameraModeChanged?.Invoke(m);
    }
}
