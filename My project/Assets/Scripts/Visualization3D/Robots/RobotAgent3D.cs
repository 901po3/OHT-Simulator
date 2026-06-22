using System.Collections.Generic;
using UnityEngine;
using OHTSim.Core;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// 3D 환경의 단일 OHT 로봇.
    /// 코루틴 대신 Update() 기반 상태머신으로 동작 — 런타임 비활성화/풀링이 매끄럽다.
    /// 속도는 매 프레임 GameServices.SpeedMultiplier × VisualizationConfig.robotBaseSpeed.
    /// </summary>
    public class RobotAgent3D : MonoBehaviour
    {
        public enum State { Idle, Moving, Processing, Returning }

        [Header("런타임 (읽기 전용)")]
        public State CurrentState = State.Idle;
        public string CurrentNodeId;
        public string TargetNodeId;

        // 경로 (노드 ID 시퀀스)
        readonly Queue<string> _path = new();

        // 처리 대기 타이머
        float _processTimer;
        // 노드 간 보간 진행도
        float _moveProgress;
        Vector3 _moveFrom;
        Vector3 _moveTo;

        OHTMapData _map;
        Map3DBuilder _builder;
        VisualizationConfig _config;

        // 공정 순환 사이클
        static readonly NodeType[] PROCESS_CYCLE =
            { NodeType.Deposition, NodeType.Exposure, NodeType.Etching, NodeType.Cleaning };
        int _processStep = -1;

        public void Initialize(OHTMapData map, string spawnNodeId)
        {
            _map     = map;
            _builder = GameServices.MapBuilder;
            _config  = GameServices.Config;
            CurrentNodeId = spawnNodeId;

            var node = _builder.GetNodeView(spawnNodeId);
            if (node != null)
                transform.position = node.WorldPos + Vector3.up * _config.robotHoverHeight;

            CurrentState = State.Idle;
            _path.Clear();
        }

        void Update()
        {
            if (_map == null || _builder == null) return;
            switch (CurrentState)
            {
                case State.Idle:       TickIdle();       break;
                case State.Moving:     TickMoving();     break;
                case State.Processing: TickProcessing(); break;
                case State.Returning:  TickMoving();     break; // 동일 로직, 도착 후 다시 Idle
            }
        }

        // ── 상태별 ─────────────────────────────────────────────────────
        void TickIdle()
        {
            // 다음 공정 노드 선택
            _processStep = (_processStep + 1) % PROCESS_CYCLE.Length;
            var targetType = PROCESS_CYCLE[_processStep];

            MapNode target = PickNearestNodeOfType(targetType);
            if (target == null) return;

            TargetNodeId = target.id;
            var fromNode = _map.FindNode(CurrentNodeId);
            if (fromNode == null) return;

            var pathNodes = PathfindingBridge.FindPath(AlgorithmId.Priority, fromNode, target, _map);
            if (pathNodes == null || pathNodes.Count < 2) return;

            _path.Clear();
            for (int i = 1; i < pathNodes.Count; i++) _path.Enqueue(pathNodes[i].id);
            AdvanceToNextHop();
        }

        void TickMoving()
        {
            float speed = _config.robotBaseSpeed * GameServices.SpeedMultiplier;
            float segLen = Vector3.Distance(_moveFrom, _moveTo);
            if (segLen < 0.001f) { ArriveAtHop(); return; }

            _moveProgress += (speed * Time.deltaTime) / segLen;
            if (_moveProgress >= 1f)
            {
                transform.position = _moveTo;
                ArriveAtHop();
                return;
            }

            Vector3 newPos = Vector3.Lerp(_moveFrom, _moveTo, _moveProgress);
            transform.position = newPos;

            // 진행 방향 회전
            Vector3 lookDir = _moveTo - _moveFrom;
            lookDir.y = 0f;
            if (lookDir.sqrMagnitude > 0.001f)
            {
                Quaternion target = Quaternion.LookRotation(lookDir, Vector3.up);
                transform.rotation = Quaternion.RotateTowards(
                    transform.rotation, target, _config.robotRotationSpeed * Time.deltaTime);
            }
        }

        void TickProcessing()
        {
            _processTimer -= Time.deltaTime * GameServices.SpeedMultiplier;
            if (_processTimer <= 0f) CurrentState = State.Idle;
        }

        // ── 헬퍼 ───────────────────────────────────────────────────────
        void AdvanceToNextHop()
        {
            if (_path.Count == 0)
            {
                StartProcessing();
                return;
            }
            string nextId = _path.Dequeue();
            var nextView = _builder.GetNodeView(nextId);
            if (nextView == null)
            {
                CurrentState = State.Idle;
                return;
            }
            _moveFrom = transform.position;
            _moveTo   = nextView.WorldPos + Vector3.up * _config.robotHoverHeight;
            _moveProgress = 0f;
            CurrentNodeId = nextId;
            CurrentState = State.Moving;
        }

        void ArriveAtHop()
        {
            if (_path.Count > 0) AdvanceToNextHop();
            else StartProcessing();
        }

        void StartProcessing()
        {
            CurrentState = State.Processing;
            _processTimer = ProcessTime(_map.FindNode(CurrentNodeId)?.type ?? NodeType.Normal);
        }

        MapNode PickNearestNodeOfType(NodeType type)
        {
            MapNode cur = _map.FindNode(CurrentNodeId);
            if (cur == null) return null;
            MapNode best = null;
            float bestDist = float.MaxValue;
            foreach (var n in _map.nodes)
            {
                if (n.type != type) continue;
                float d = Mathf.Abs(n.x - cur.x) + Mathf.Abs(n.y - cur.y);
                if (d < bestDist) { bestDist = d; best = n; }
            }
            return best;
        }

        static float ProcessTime(NodeType type) => type switch
        {
            NodeType.Deposition => 1.5f,
            NodeType.Exposure   => 1.2f,
            NodeType.Etching    => 1.8f,
            NodeType.Cleaning   => 1.0f,
            _                   => 0.5f,
        };
    }
}
