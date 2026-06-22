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

        // Idle 시 pathfinding 실패 후 쿨다운 — 매 프레임 무의미한 재탐색 방지
        float _idleCooldown;
        const float IDLE_RETRY_COOLDOWN = 0.5f;

        OHTMapData _map;
        Map3DBuilder _builder;
        VisualizationConfig _config;

        // ── 노드 점유(겹침 방지) ──────────────────────────────────────────
        // 설계 제약: "겹치는 노드 최대 1대, 레일은 무제한 통행" (docs/ALGORITHM_DECISIONS.md)
        // 다음 노드로 출발하기 전 NodeOccupancyService에 점유를 요청하고, 성공해야만 이동한다.
        // 점유 실패 시 현재 노드에서 대기하다, 타임아웃되면 경로를 폐기하고 리라우팅한다.
        float _blockTimer;                          // 다음 노드가 막혀 대기한 누적 시간
        const float BLOCK_REROUTE_TIMEOUT = 2.5f;   // 이 시간 이상 막히면 경로 폐기 후 재탐색
        // 초과 로봇(노드 수보다 많은 경우)이 레일에서 대기 시, 가까운 빈 노드 탐색 기준 좌표
        float _railRefX, _railRefY;
        // 초과 로봇을 레일 위에 분산 배치하기 위한 슬롯 카운터
        static int _railSlotCounter;

        // 공정 순환 사이클
        static readonly NodeType[] PROCESS_CYCLE =
            { NodeType.Deposition, NodeType.Exposure, NodeType.Etching, NodeType.Cleaning };
        int _processStep = -1;

        // ── LED & FOUP (런타임 생성, 풀링 안전) ───────────────────────────
        // 풀에서 재대여될 때 자식이 중복 생성되지 않도록 1회만 생성.
        bool _childrenCreated;
        Renderer _ledRenderer;
        Material _ledMaterial;
        Transform _foup;

        Renderer _minimapMarkerRenderer;
        Material _minimapMarkerMaterial;

        const float LED_EMISSION_INTENSITY = 2.5f; // HDR 블룸용 발광 강도

        // FOUP 로컬 Y 위치
        const float FOUP_CARRIED_Y  = -0.4f; // 로봇 본체 아래 매달린(운반) 위치
        const float FOUP_LOWER_DROP =  6.0f; // 하강 거리 — 천장(5.5m)에서 바닥(0.3m)까지 하강하도록 수정
        const float PHASE_DURATION  =  1.2f; // 승/하강 연출 시간(초) — 더 먼 거리이므로 부드럽게 증가

        // 공정 서브 페이즈 (코루틴 없이 Update 기반 — 풀링 안전)
        enum ProcessPhase { Lowering, Working, Raising }
        ProcessPhase _processPhase;
        float _phaseTimer;

        public void Initialize(OHTMapData map, string preferredNodeId)
        {
            _map     = map;
            _builder = GameServices.MapBuilder;
            _config  = GameServices.Config;

            EnsureChildrenCreated();

            // 풀 재대여 시 상태 리셋
            SetFoupY(FOUP_CARRIED_Y);
            _path.Clear();
            _processStep  = -1;
            _blockTimer   = 0f;
            _idleCooldown = 0f;
            TargetNodeId  = null;

            // ── 점유 가능한 스폰 노드 확보 (한 노드 1대 불변식) ──
            // 우선순위: 지정 노드 → 빈 Depot(없으면 아무 빈 노드). 모두 실패하면 초과분 → 레일 대기.
            string spawn = null;
            if (NodeOccupancyService.TryClaim(preferredNodeId, this))
            {
                spawn = preferredNodeId;
            }
            else
            {
                string free = NodeOccupancyService.FindFreeNode(map, this, n => n.type == NodeType.Depot);
                if (free != null && NodeOccupancyService.TryClaim(free, this))
                    spawn = free;
            }

            CurrentNodeId = spawn;

            if (spawn != null)
            {
                var node = _builder.GetNodeView(spawn);
                if (node != null)
                    transform.position = node.WorldPos + Vector3.up * _config.robotHoverHeight;
            }
            else
            {
                // 초과 로봇: 노드가 만석이므로 레일 위에서 대기
                PlaceOnRailFallback();
            }

            SetState(State.Idle);
        }

        // 풀 반환/파괴/비활성화 시 점유 노드를 반드시 해제 — 다른 로봇이 그 노드를 쓸 수 있게.
        void OnDisable()
        {
            NodeOccupancyService.Release(CurrentNodeId, this);
            CurrentNodeId = null;
            _path.Clear();
        }

        // 자식 오브젝트(LED 비콘 + FOUP + 미니맵 마커)를 1회만 생성. 풀링으로 재활성화돼도 중복 생성 안 함.
        void EnsureChildrenCreated()
        {
            if (_childrenCreated) return;
            _childrenCreated = true;

            var litShader = Shader.Find("Universal Render Pipeline/Lit");

            // 상태 LED 비콘 — 로봇 상단의 작은 발광 구체
            var led = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            led.name = "StatusLED";
            led.transform.SetParent(transform, false);
            led.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            led.transform.localScale = Vector3.one * 0.25f;
            var ledCol = led.GetComponent<SphereCollider>();
            if (ledCol != null) Destroy(ledCol); // 물리 오버헤드 제거

            _ledRenderer = led.GetComponent<Renderer>();
            _ledMaterial = new Material(litShader);
            _ledMaterial.EnableKeyword("_EMISSION");
            _ledRenderer.material = _ledMaterial;

            // 미니맵 전용 마커 (큰 구체) — MinimapOnly 레이어(31)에 배치하여 메인 3D 뷰에는 안 보이고 미니맵/탑뷰에만 크고 뚜렷하게 보임
            var marker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            marker.name = "MinimapMarker";
            marker.transform.SetParent(transform, false);
            marker.transform.localPosition = new Vector3(0f, 2.0f, 0f); // 레일 위에 가려지지 않는 완벽한 수직 정렬
            marker.transform.localScale = new Vector3(2.5f, 2.5f, 2.5f); // 미니맵 카메라에서 잘 식별되는 큼직한 스케일
            
            var markerCol = marker.GetComponent<SphereCollider>();
            if (markerCol != null) Destroy(markerCol);

            _minimapMarkerRenderer = marker.GetComponent<Renderer>();
            _minimapMarkerMaterial = new Material(litShader);
            _minimapMarkerMaterial.EnableKeyword("_EMISSION");
            _minimapMarkerRenderer.material = _minimapMarkerMaterial;
            
            // MinimapOnlyLayer (31) 레이어 지정
            marker.layer = Map3DBuilder.MinimapOnlyLayer;

            // FOUP(웨이퍼 박스) 언더캐리지 — 로봇 아래 매달린 반투명 청회색 큐브
            var foup = GameObject.CreatePrimitive(PrimitiveType.Cube);
            foup.name = "FOUP";
            foup.transform.SetParent(transform, false);
            foup.transform.localPosition = new Vector3(0f, FOUP_CARRIED_Y, 0f);
            foup.transform.localScale = Vector3.one * 0.4f;
            var foupCol = foup.GetComponent<BoxCollider>();
            if (foupCol != null) Destroy(foupCol);

            var foupRenderer = foup.GetComponent<Renderer>();
            var foupMat = new Material(litShader) { color = new Color(0.5f, 0.6f, 0.8f, 1f) };
            foupRenderer.material = foupMat;

            _foup = foup.transform;
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
            // 초과 로봇(레일 대기): 빈 노드를 찾아 진입 시도
            if (CurrentNodeId == null) { TickRailWaiting(); return; }

            // 경로가 남아 있는데 Idle = 다음 노드가 막혀 대기 중. 점유 재시도 + 타임아웃 시 리라우팅.
            if (_path.Count > 0)
            {
                _blockTimer += Time.deltaTime;
                if (_blockTimer >= BLOCK_REROUTE_TIMEOUT)
                {
                    _path.Clear();              // 경로 폐기 → 다음 사이클에서 새 목표/경로
                    _blockTimer = 0f;
                    _idleCooldown = IDLE_RETRY_COOLDOWN;
                    return;
                }
                TryAdvanceHop();
                return;
            }

            // 매 프레임 재탐색 방지 — 직전 실패 시 쿨다운만큼 대기.
            if (_idleCooldown > 0f)
            {
                _idleCooldown -= Time.deltaTime;
                return;
            }

            // 다음 공정 노드 선택 (점유되지 않은 빈 노드만)
            int nextStep = (_processStep + 1) % PROCESS_CYCLE.Length;
            var targetType = PROCESS_CYCLE[nextStep];

            MapNode target = PickNearestFreeNodeOfType(targetType);
            if (target == null) { _idleCooldown = IDLE_RETRY_COOLDOWN; return; }

            var fromNode = _map.FindNode(CurrentNodeId);
            if (fromNode == null) { _idleCooldown = IDLE_RETRY_COOLDOWN; return; }

            var pathNodes = PathfindingBridge.FindPath(AlgorithmId.Priority, fromNode, target, _map);
            if (pathNodes == null || pathNodes.Count < 2)
            {
                _idleCooldown = IDLE_RETRY_COOLDOWN;
                return;
            }

            // 성공 시에만 step 진행
            _processStep = nextStep;
            TargetNodeId = target.id;
            _path.Clear();
            for (int i = 1; i < pathNodes.Count; i++) _path.Enqueue(pathNodes[i].id);
            _blockTimer = 0f;
            TryAdvanceHop();
        }

        // 초과 로봇이 레일에서 대기하다, 빈 노드가 생기면 진입한다.
        void TickRailWaiting()
        {
            if (_idleCooldown > 0f) { _idleCooldown -= Time.deltaTime; return; }

            // 가까운 빈 노드 탐색 — Depot 우선, 없으면 아무 노드
            string dest = NodeOccupancyService.FindFreeNode(
                _map, this, n => n.type == NodeType.Depot, _railRefX, _railRefY, true);

            if (dest == null || !NodeOccupancyService.TryClaim(dest, this))
            {
                _idleCooldown = IDLE_RETRY_COOLDOWN; // 여전히 만석 → 레일 대기 유지
                return;
            }

            var view = _builder.GetNodeView(dest);
            if (view == null)
            {
                NodeOccupancyService.Release(dest, this);
                _idleCooldown = IDLE_RETRY_COOLDOWN;
                return;
            }

            // 레일 → 노드 진입
            CurrentNodeId = dest;
            _path.Clear();
            _moveFrom = transform.position;
            _moveTo   = view.WorldPos + Vector3.up * _config.robotHoverHeight;
            _moveProgress = 0f;
            SetState(State.Moving);
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
            // 의도: SpeedMultiplier가 시뮬레이션 전체 속도. 이동·처리·승하강 모두 동일 배율 적용.
            // 사용자가 "속도 5×"를 선택하면 처리/연출 시간도 5배 빠르게 — 직관적 시뮬 가속.
            float dt = Time.deltaTime * GameServices.SpeedMultiplier;

            switch (_processPhase)
            {
                // ① 하강: FOUP를 운반 위치에서 도크(로드포트) 위치로 내림
                case ProcessPhase.Lowering:
                {
                    _phaseTimer += dt;
                    float t = Mathf.Clamp01(_phaseTimer / PHASE_DURATION);
                    SetFoupY(Mathf.Lerp(FOUP_CARRIED_Y, FOUP_CARRIED_Y - FOUP_LOWER_DROP, t));
                    if (t >= 1f) _processPhase = ProcessPhase.Working;
                    break;
                }
                // ② 작업: 기존 공정 타이머 카운트다운
                case ProcessPhase.Working:
                {
                    _processTimer -= dt;
                    if (_processTimer <= 0f)
                    {
                        _phaseTimer = 0f;
                        _processPhase = ProcessPhase.Raising;
                    }
                    break;
                }
                // ③ 상승: FOUP를 다시 운반 위치로 올린 뒤 Idle로 복귀
                case ProcessPhase.Raising:
                {
                    _phaseTimer += dt;
                    float t = Mathf.Clamp01(_phaseTimer / PHASE_DURATION);
                    SetFoupY(Mathf.Lerp(FOUP_CARRIED_Y - FOUP_LOWER_DROP, FOUP_CARRIED_Y, t));
                    if (t >= 1f)
                    {
                        SetFoupY(FOUP_CARRIED_Y);
                        SetState(State.Idle);
                    }
                    break;
                }
            }
        }

        // ── 헬퍼 ───────────────────────────────────────────────────────
        // 다음 홉으로 진행 시도. 다음 노드를 점유할 수 있을 때만 이동하고,
        // 점유 실패 시 현재 노드에서 대기한다 (경로는 보존 → TickIdle이 재시도).
        void TryAdvanceHop()
        {
            if (_path.Count == 0)
            {
                ArriveAtDestination();
                return;
            }

            string nextId = _path.Peek();
            var nextView = _builder.GetNodeView(nextId);
            if (nextView == null)
            {
                // 뷰 누락(맵 변경 등) → 경로 폐기 후 재탐색
                _path.Clear();
                _idleCooldown = IDLE_RETRY_COOLDOWN;
                SetState(State.Idle);
                return;
            }

            // 다음 노드 점유 시도 — 실패 시 현재 노드에서 대기 (레일은 무제한이나 노드는 1대)
            if (!NodeOccupancyService.TryClaim(nextId, this))
            {
                SetState(State.Idle); // 현재 노드 점유를 유지한 채 대기
                return;
            }

            // 점유 성공 → 출발. 현재 노드를 즉시 해제하여 레일로 진입(다른 로봇/초과분이 사용 가능).
            _path.Dequeue();
            string from = CurrentNodeId;
            if (!string.IsNullOrEmpty(from) && from != nextId)
                NodeOccupancyService.Release(from, this);
            CurrentNodeId = nextId; // 이제 nextId 소유 — 이동 중에도 예약 유지(겹침 불가)

            _moveFrom = transform.position;
            _moveTo   = nextView.WorldPos + Vector3.up * _config.robotHoverHeight;
            _moveProgress = 0f;
            _blockTimer = 0f;
            SetState(State.Moving);
        }

        void ArriveAtHop()
        {
            transform.position = _moveTo;
            if (_path.Count > 0) { TryAdvanceHop(); return; }
            ArriveAtDestination();
        }

        // 목적지 노드 도착: 공정 노드면 처리 시작, 그 외(Normal/Depot)면 Idle로 다음 목표 탐색.
        void ArriveAtDestination()
        {
            var node = _map.FindNode(CurrentNodeId);
            if (node != null && IsProcessType(node.type)) StartProcessing();
            else SetState(State.Idle);
        }

        void StartProcessing()
        {
            _processTimer = ProcessTime(_map.FindNode(CurrentNodeId)?.type ?? NodeType.Normal);
            _processPhase = ProcessPhase.Lowering; // FOUP 하강부터 시작
            _phaseTimer = 0f;
            SetState(State.Processing);
        }

        // ── 상태/연출 헬퍼 ──────────────────────────────────────────────
        // 모든 상태 전환은 이 메서드를 통해 — LED 색을 항상 동기화.
        void SetState(State newState)
        {
            CurrentState = newState;
            UpdateLedColor(newState);
        }

        void UpdateLedColor(State state)
        {
            if (_ledMaterial == null) return;
            Color c = state switch
            {
                State.Idle       => new Color(0f,   1f,   0.3f),
                State.Moving     => new Color(0f,   0.9f, 1f),
                State.Processing => new Color(1f,   0.15f, 0.1f),
                State.Returning  => new Color(1f,   0f,   0.8f),
                _                => Color.white,
            };
            _ledMaterial.color = c;
            _ledMaterial.SetColor("_EmissionColor", c * LED_EMISSION_INTENSITY);

            if (_minimapMarkerMaterial != null)
            {
                _minimapMarkerMaterial.color = c;
                // 미니맵에서 돋보이도록 마커에 아주 선명하고 강한 고대비 발광 강도 설정
                _minimapMarkerMaterial.SetColor("_EmissionColor", c * 4.5f);
            }
        }

        void SetFoupY(float y)
        {
            if (_foup == null) return;
            var p = _foup.localPosition;
            p.y = y;
            _foup.localPosition = p;
        }

        // 점유되지 않은(빈) 목표 타입 노드 중 가장 가까운 것을 고른다.
        MapNode PickNearestFreeNodeOfType(NodeType type)
        {
            MapNode cur = _map.FindNode(CurrentNodeId);
            float rx = cur != null ? cur.x : _railRefX;
            float ry = cur != null ? cur.y : _railRefY;
            MapNode best = null;
            float bestDist = float.MaxValue;
            foreach (var n in _map.nodes)
            {
                if (n.type != type) continue;
                if (!NodeOccupancyService.IsClaimable(n.id, this)) continue; // 빈 노드만
                float d = Mathf.Abs(n.x - rx) + Mathf.Abs(n.y - ry);
                if (d < bestDist) { bestDist = d; best = n; }
            }
            return best;
        }

        static bool IsProcessType(NodeType t)
            => t == NodeType.Deposition || t == NodeType.Exposure ||
               t == NodeType.Etching   || t == NodeType.Cleaning;

        // 초과 로봇을 레일(엣지) 위에 분산 배치한다. 엣지마다 여러 위치(t)로 흩어 겹침을 줄인다.
        // (설계상 레일 위 다중 점유는 허용되지만, 시각적 겹침을 최소화한다.)
        void PlaceOnRailFallback()
        {
            if (_map.edges.Count == 0)
            {
                // 엣지가 없으면 첫 노드 근처에 둠
                if (_map.nodes.Count > 0)
                {
                    var n0 = _map.nodes[0];
                    var v0 = _builder.GetNodeView(n0.id);
                    if (v0 != null) transform.position = v0.WorldPos + Vector3.up * _config.robotHoverHeight;
                    _railRefX = n0.x; _railRefY = n0.y;
                }
                return;
            }

            int slot    = _railSlotCounter++;
            int edgeIdx = slot % _map.edges.Count;
            int band    = (slot / _map.edges.Count) % 4;   // 엣지당 4개 위치 밴드
            float t     = 0.3f + 0.4f * (band / 3f);        // 0.3 ~ 0.7

            var edge = _map.edges[edgeIdx];
            var from = _map.FindNode(edge.fromId);
            var to   = _map.FindNode(edge.toId);
            var vf   = from != null ? _builder.GetNodeView(from.id) : null;
            var vt   = to   != null ? _builder.GetNodeView(to.id)   : null;

            if (vf != null && vt != null)
            {
                transform.position = Vector3.Lerp(vf.WorldPos, vt.WorldPos, t) + Vector3.up * _config.robotHoverHeight;
                _railRefX = to.x; _railRefY = to.y; // 진행 방향 노드를 탐색 기준으로
            }
            else if (vt != null)
            {
                transform.position = vt.WorldPos + Vector3.up * _config.robotHoverHeight;
                _railRefX = to.x; _railRefY = to.y;
            }
            else if (vf != null)
            {
                transform.position = vf.WorldPos + Vector3.up * _config.robotHoverHeight;
                _railRefX = from.x; _railRefY = from.y;
            }
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
