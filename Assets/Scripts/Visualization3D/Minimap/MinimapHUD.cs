using UnityEngine;
using UnityEngine.UI;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 미니맵 또는 풀스크린 토뷰 상단에 현재 로봇 수 / 속도 배율을 표시.
    /// SimEvents 구독으로 자동 갱신.
    /// </summary>
    public class MinimapHUD : MonoBehaviour
    {
        [Header("UI 연결")]
        public Text robotCountLabel;
        public Text speedMultiplierLabel;
        public Text modeLabel;          // "MINIMAP" / "TOP VIEW"

        [Header("의존성")]
        public CameraModeController modeController;

        void OnEnable()
        {
            SimEvents.ActiveRobotCountChanged += UpdateRobotCount;
            SimEvents.SpeedMultiplierChanged  += UpdateSpeed;
            SimEvents.CameraModeChanged       += UpdateMode;
        }

        void OnDisable()
        {
            SimEvents.ActiveRobotCountChanged -= UpdateRobotCount;
            SimEvents.SpeedMultiplierChanged  -= UpdateSpeed;
            SimEvents.CameraModeChanged       -= UpdateMode;
        }

        void Start()
        {
            UpdateRobotCount(GameServices.FleetController?.ActiveCount ?? 0);
            UpdateSpeed(GameServices.SpeedMultiplier);
            UpdateMode(modeController != null ? modeController.CurrentMode : SimEvents.CameraMode.ThirdPerson);
        }

        void UpdateRobotCount(int n)
        {
            if (robotCountLabel != null) robotCountLabel.text = $"🤖 ROBOTS: {n}";
        }

        void UpdateSpeed(float m)
        {
            if (speedMultiplierLabel != null) speedMultiplierLabel.text = $"⚡ SPEED: {m:F1}×";
        }

        void UpdateMode(SimEvents.CameraMode mode)
        {
            if (modeLabel != null)
            {
                if (mode == SimEvents.CameraMode.FullscreenTopView)
                    modeLabel.text = "TOP VIEW (ESC to exit)";
                else if (mode == SimEvents.CameraMode.Cameraman)
                    modeLabel.text = "🎥 DRONE (WASD to Walk, Shift: Boost, Scroll: FPV/3PS, ESC: exit)";
                else
                    modeLabel.text = "MINIMAP (click to expand / C: Drone View)";
            }
        }
    }
}
