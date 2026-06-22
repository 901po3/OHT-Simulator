using UnityEngine;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 3인칭 ↔ 풀스크린 토뷰 전환 매니저.
    /// MinimapRenderer가 클릭 콜백을 호출하거나, ESC 키로 토뷰에서 빠져나옴.
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
        }

        public void ToggleTopView()
        {
            SetMode(CurrentMode == SimEvents.CameraMode.FullscreenTopView
                ? SimEvents.CameraMode.ThirdPerson
                : SimEvents.CameraMode.FullscreenTopView);
        }

        public void SetMode(SimEvents.CameraMode mode)
        {
            if (CurrentMode == mode) return;
            CurrentMode = mode;
            SimEvents.RaiseCameraModeChanged(mode);
        }
    }
}
