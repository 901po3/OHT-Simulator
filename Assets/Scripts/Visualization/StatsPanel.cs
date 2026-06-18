using UnityEngine;
using UnityEngine.UI;
using OHTSim.Simulation;

namespace OHTSim.Visualization
{
    /// <summary>
    /// SimulationStats를 읽어 UI Text로 표시한다.
    /// Canvas 아래 배치 후 Inspector에서 SimulationController를 연결.
    /// </summary>
    public class StatsPanel : MonoBehaviour
    {
        [SerializeField] private SimulationController simulation;
        [SerializeField] private Text textCompleted;
        [SerializeField] private Text textThroughput;
        [SerializeField] private Text textMoving;
        [SerializeField] private Text textWaiting;
        [SerializeField] private Text textIdle;
        [SerializeField] private Text textTime;

        private void Update()
        {
            if (simulation?.Stats == null) return;

            var s = simulation.Stats;

            if (textCompleted  != null) textCompleted.text  = $"완료 작업: {s.CompletedJobs}";
            if (textThroughput != null) textThroughput.text = $"처리량: {s.Throughput:F1} 작업/분";
            if (textMoving     != null) textMoving.text     = $"이동 중: {s.MovingCount}대";
            if (textWaiting    != null) textWaiting.text    = $"대기 중: {s.WaitingCount}대";
            if (textIdle       != null) textIdle.text       = $"유휴: {s.IdleCount}대";
            if (textTime       != null) textTime.text       = $"경과: {s.ElapsedTime:F0}초";
        }
    }
}
