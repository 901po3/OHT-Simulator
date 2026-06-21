using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using OHTSim.Core;
using OHTSim.Simulation;

namespace OHTSim.UI
{
    // 시뮬레이션 진행 중 HUD — 처리 완료 수, 처리량, 경과 시간
    // AgentController.OnJobCompleted 이벤트 구독
    public class SimOverlayUI : MonoBehaviour
    {
        [Header("UI 연결")]
        public GameObject panelRoot;     // 오버레이 패널 루트 (시뮬레이션 중에만 표시)
        public Text       labelCompleted; // "처리 완료: 0"
        public Text       labelThroughput; // "처리량: 0.0 /min"
        public Text       labelElapsed;   // "경과: 00:00"

        [Header("서비스 연결")]
        public SimulationController simController;
        public AgentController      agentController;

        int   _completedJobs;
        float _simStartTime;
        bool  _running;

        void OnEnable()
        {
            simController.OnSimulationStarted += HandleStart;
            simController.OnSimulationStopped += HandleStop;
        }

        void OnDisable()
        {
            simController.OnSimulationStarted -= HandleStart;
            simController.OnSimulationStopped -= HandleStop;
        }

        void HandleStart()
        {
            _completedJobs = 0;
            _simStartTime  = Time.time;
            _running       = true;
            panelRoot.SetActive(true);

            agentController.OnJobCompleted += HandleJobCompleted;
            StartCoroutine(UpdateLoop());
        }

        void HandleStop()
        {
            _running = false;
            panelRoot.SetActive(false);
            agentController.OnJobCompleted -= HandleJobCompleted;
        }

        void HandleJobCompleted()
        {
            _completedJobs++;
        }

        IEnumerator UpdateLoop()
        {
            while (_running)
            {
                float elapsed  = Time.time - _simStartTime;
                float minutes  = elapsed / 60f;
                float throughput = minutes > 0f ? _completedJobs / minutes : 0f;

                int mins = (int)(elapsed / 60f);
                int secs = (int)(elapsed % 60f);

                if (labelCompleted  != null) labelCompleted.text  = $"처리 완료: {_completedJobs}";
                if (labelThroughput != null) labelThroughput.text = $"처리량: {throughput:F1} /min";
                if (labelElapsed    != null) labelElapsed.text    = $"경과: {mins:D2}:{secs:D2}";

                yield return new WaitForSeconds(0.5f);
            }
        }
    }
}
