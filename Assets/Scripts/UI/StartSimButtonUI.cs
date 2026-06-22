using UnityEngine;
using UnityEngine.UI;
using OHTSim.Simulation;

namespace OHTSim.UI
{
    // 상단 중앙 대형 시뮬레이션 시작 버튼
    // 맵이 준비될 때까지 비활성, 클릭 시 SimulationController.StartSimulation() 호출
    public class StartSimButtonUI : MonoBehaviour
    {
        [Header("UI 연결")]
        public Button button;
        public Text   label;

        [Header("서비스 연결")]
        public SimulationController simController;

        void Awake()
        {
            button.interactable = false;
            label.text = "⏳ 맵 로딩 중...";
        }

        void OnEnable()
        {
            simController.OnMapReady        += HandleMapReady;
            simController.OnSimulationStarted += HandleStarted;
            simController.OnSimulationStopped += HandleStopped;
        }

        void OnDisable()
        {
            simController.OnMapReady        -= HandleMapReady;
            simController.OnSimulationStarted -= HandleStarted;
            simController.OnSimulationStopped -= HandleStopped;
        }

        void HandleMapReady()
        {
            button.interactable = true;
            label.text = "▶ 시뮬레이션 시작";
        }

        void HandleStarted()
        {
            label.text = "■ 시뮬레이션 중지";
            // 버튼 재사용: 시작 후 누르면 중지
            button.onClick.RemoveAllListeners();
            button.onClick.AddListener(simController.StopSimulation);
        }

        void HandleStopped()
        {
            label.text = "▶ 시뮬레이션 시작";
            button.onClick.RemoveAllListeners();
            button.onClick.AddListener(simController.StartSimulation);
        }

        void Start()
        {
            button.onClick.AddListener(simController.StartSimulation);
        }
    }
}
