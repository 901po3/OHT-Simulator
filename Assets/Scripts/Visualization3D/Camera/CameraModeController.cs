using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 3인칭 ↔ 풀스크린 토뷰 ↔ 카메라맨(드론 탐색) 전환 매니저.
    /// MinimapRenderer가 클릭 콜백을 호출하거나, C 키로 탐색 모드 진입, ESC 키로 복귀.
    /// </summary>
    public class CameraModeController : MonoBehaviour
    {
        public SimEvents.CameraMode CurrentMode { get; private set; } = SimEvents.CameraMode.ThirdPerson;

        void Update()
        {
            if (CurrentMode == SimEvents.CameraMode.FullscreenTopView
                && Input.GetKeyDown(KeyCode.Escape))
            {
                SetMode(SimEvents.CameraMode.ThirdPerson);
            }

            // 'C' 키를 누르면 카메라맨 드론 모드를 토글 (게이머 편의 단축키!)
            if (Input.GetKeyDown(KeyCode.C))
            {
                ToggleCameramanView();
            }
        }

        public void ToggleTopView()
        {
            SetMode(CurrentMode == SimEvents.CameraMode.FullscreenTopView
                ? SimEvents.CameraMode.ThirdPerson
                : SimEvents.CameraMode.FullscreenTopView);
        }

        public void ToggleCameramanView()
        {
            SetMode(CurrentMode == SimEvents.CameraMode.Cameraman
                ? SimEvents.CameraMode.ThirdPerson
                : SimEvents.CameraMode.Cameraman);
        }

        public void SetMode(SimEvents.CameraMode mode)
        {
            if (CurrentMode == mode) return;
            CurrentMode = mode;
            SimEvents.RaiseCameraModeChanged(mode);
        }
    }
}
