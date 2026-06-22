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
                // 초기값은 SetValueWithoutNotify로 — listener 부착 전이라도 의미 명확화
                robotCountSlider.SetValueWithoutNotify(config != null ? config.initialRobotCount : 12);
                // 런타임 조작 가능하도록 명시적으로 보장
                robotCountSlider.interactable = true;
                robotCountSlider.onValueChanged.RemoveListener(OnRobotCountChanged);
                robotCountSlider.onValueChanged.AddListener(OnRobotCountChanged);
            }
            else
            {
                Debug.LogWarning("[RuntimeControlsUI] robotCountSlider 미연결 — 런타임 로봇 수 조절 불가");
            }

            if (speedSlider != null)
            {
                speedSlider.minValue = 0.1f;
                speedSlider.maxValue = 5f;
                speedSlider.SetValueWithoutNotify(config != null ? config.initialSpeedMultiplier : 1f);
                speedSlider.interactable = true;
                speedSlider.onValueChanged.RemoveListener(OnSpeedChanged);
                speedSlider.onValueChanged.AddListener(OnSpeedChanged);
            }
            else
            {
                Debug.LogWarning("[RuntimeControlsUI] speedSlider 미연결 — 런타임 속도 조절 불가");
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
