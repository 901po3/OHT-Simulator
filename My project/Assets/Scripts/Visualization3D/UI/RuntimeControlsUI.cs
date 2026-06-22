using UnityEngine;
using UnityEngine.UI;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 런타임 슬라이더: 로봇 수 (0~max), 속도 배율 (0.1~5.0).
    /// FleetController에 직접 호출 — Service Locator로 참조 해소.
    /// </summary>
    public class RuntimeControlsUI : MonoBehaviour
    {
        [Header("UI 연결")]
        public Slider robotCountSlider;
        public Text   robotCountValueLabel;
        public Slider speedSlider;
        public Text   speedValueLabel;

        void Start()
        {
            var config = GameServices.Config;
            int maxRobots = config != null ? config.maxRobotCount : 100;

            if (robotCountSlider != null)
            {
                robotCountSlider.wholeNumbers = true;
                robotCountSlider.minValue = 0;
                robotCountSlider.maxValue = maxRobots;
                robotCountSlider.value    = config != null ? config.initialRobotCount : 12;
                robotCountSlider.onValueChanged.AddListener(OnRobotCountChanged);
            }

            if (speedSlider != null)
            {
                speedSlider.minValue = 0.1f;
                speedSlider.maxValue = 5f;
                speedSlider.value    = config != null ? config.initialSpeedMultiplier : 1f;
                speedSlider.onValueChanged.AddListener(OnSpeedChanged);
            }

            UpdateLabels();
        }

        void OnEnable()
        {
            SimEvents.ActiveRobotCountChanged += SyncRobotSlider;
            SimEvents.SpeedMultiplierChanged  += SyncSpeedSlider;
        }

        void OnDisable()
        {
            SimEvents.ActiveRobotCountChanged -= SyncRobotSlider;
            SimEvents.SpeedMultiplierChanged  -= SyncSpeedSlider;
        }

        void OnRobotCountChanged(float v)
        {
            var fleet = GameServices.FleetController;
            if (fleet != null) fleet.SetTargetCount(Mathf.RoundToInt(v));
            UpdateLabels();
        }

        void OnSpeedChanged(float v)
        {
            var fleet = GameServices.FleetController;
            if (fleet != null) fleet.SetSpeedMultiplier(v);
            else GameServices.SpeedMultiplier = v;
            UpdateLabels();
        }

        void SyncRobotSlider(int n)
        {
            if (robotCountSlider != null && !Mathf.Approximately(robotCountSlider.value, n))
                robotCountSlider.SetValueWithoutNotify(n);
            UpdateLabels();
        }

        void SyncSpeedSlider(float m)
        {
            if (speedSlider != null && !Mathf.Approximately(speedSlider.value, m))
                speedSlider.SetValueWithoutNotify(m);
            UpdateLabels();
        }

        void UpdateLabels()
        {
            if (robotCountValueLabel != null && robotCountSlider != null)
                robotCountValueLabel.text = $"로봇: {Mathf.RoundToInt(robotCountSlider.value)}대";
            if (speedValueLabel != null && speedSlider != null)
                speedValueLabel.text = $"속도: {speedSlider.value:F1}×";
        }
    }
}
