using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using OHTSim.Core;

namespace OHTSim.Simulation
{
    // 3D 에이전트 생성 및 이동 관리
    // SimulationController.OnSimulationStarted 구독 → 에이전트 스폰 → 경로 이동
    [RequireComponent(typeof(SimulationController))]
    public class AgentController : MonoBehaviour
    {
        [Header("에이전트 설정")]
        public GameObject agentPrefab;     // 없으면 Capsule 자동 생성
        public int agentCount = 4;
        [Tooltip("노드 간 이동 속도 (Unity 단위/초)")]
        public float moveSpeed = 1.5f;

        [Header("서비스 연결")]
        public MapLoaderService loaderService;
        public MapBuilder mapBuilder;

        SimulationController _sim;
        readonly List<AgentInstance> _agents = new();

        void Awake()
        {
            _sim = GetComponent<SimulationController>();
        }

        void OnEnable()
        {
            _sim.OnSimulationStarted += HandleStart;
            _sim.OnSimulationStopped += HandleStop;
        }

        void OnDisable()
        {
            _sim.OnSimulationStarted -= HandleStart;
            _sim.OnSimulationStopped -= HandleStop;
        }

        void HandleStart()
        {
            if (!loaderService.IsLoaded) return;
            SpawnAgents(loaderService.CurrentMap);
        }

        void HandleStop()
        {
            foreach (var a in _agents) StopCoroutine(a.Coroutine);
            _agents.Clear();
            // 스폰된 오브젝트 제거
            foreach (Transform child in transform)
            {
                if (child.CompareTag("OHTAgent")) Destroy(child.gameObject);
            }
        }

        void SpawnAgents(OHTMapData map)
        {
            if (map.nodes.Count == 0) return;

            // Depot 노드 또는 첫 번째 노드를 출발점으로 사용
            var depotNodes = map.nodes.FindAll(n => n.type == NodeType.Depot);
            var startNodes = depotNodes.Count > 0 ? depotNodes : map.nodes;

            for (int i = 0; i < agentCount; i++)
            {
                var startNode = startNodes[i % startNodes.Count];
                var go = agentPrefab != null
                    ? Instantiate(agentPrefab, transform)
                    : CreateCapsuleAgent(i);

                go.tag = "OHTAgent";
                go.name = $"Agent_{i:D2}";
                go.transform.position = startNode.WorldPosition(loaderService is MapLoaderService ml
                    ? (mapBuilder != null ? mapBuilder.mapScale : 0.01f)
                    : 0.01f) + Vector3.up * 0.5f;

                SetAgentColor(go, i);

                var instance = new AgentInstance { Go = go, Map = map, CurrentNodeId = startNode.id };
                _agents.Add(instance);
                instance.Coroutine = StartCoroutine(AgentLoop(instance));
            }
        }

        IEnumerator AgentLoop(AgentInstance agent)
        {
            while (true)
            {
                // 다음 목표 노드 선택 (공정 노드 순환)
                var target = PickNextTarget(agent);
                if (target == null) { yield return new WaitForSeconds(1f); continue; }

                // 단순 BFS 경로 탐색
                var path = SimpleBFS(agent.Map, agent.CurrentNodeId, target.id);
                if (path == null || path.Count < 2) { yield return new WaitForSeconds(0.5f); continue; }

                // 경로를 따라 이동
                for (int i = 1; i < path.Count; i++)
                {
                    var toNode = agent.Map.FindNode(path[i]);
                    if (toNode == null) continue;

                    var dest = toNode.WorldPosition(mapBuilder != null ? mapBuilder.mapScale : 0.01f)
                               + Vector3.up * 0.5f;

                    while (Vector3.Distance(agent.Go.transform.position, dest) > 0.01f)
                    {
                        agent.Go.transform.position = Vector3.MoveTowards(
                            agent.Go.transform.position, dest, moveSpeed * Time.deltaTime);
                        agent.Go.transform.LookAt(new Vector3(dest.x, agent.Go.transform.position.y, dest.z));
                        yield return null;
                    }

                    agent.CurrentNodeId = path[i];
                }

                // 공정 처리 대기 (타입별 시간)
                yield return new WaitForSeconds(ProcessTime(target.type));
            }
        }

        // 공정 노드 순환 선택 (Depot 제외)
        static readonly NodeType[] PROCESS_CYCLE =
            { NodeType.Deposition, NodeType.Exposure, NodeType.Etching, NodeType.Cleaning };

        MapNode PickNextTarget(AgentInstance agent)
        {
            // 현재 공정 단계 다음을 찾음
            agent.ProcessStep = (agent.ProcessStep + 1) % PROCESS_CYCLE.Length;
            var targetType = PROCESS_CYCLE[agent.ProcessStep];
            var candidates = agent.Map.nodes.FindAll(n => n.type == targetType);
            if (candidates.Count == 0) return null;
            return candidates[Random.Range(0, candidates.Count)];
        }

        // 단순 BFS (노드 ID 기반)
        static List<string> SimpleBFS(OHTMapData map, string fromId, string toId)
        {
            if (fromId == toId) return new List<string> { fromId };

            var queue   = new Queue<string>();
            var visited = new HashSet<string>();
            var parent  = new Dictionary<string, string>();

            queue.Enqueue(fromId);
            visited.Add(fromId);

            // 엣지 인접 맵 빌드
            var adj = new Dictionary<string, List<string>>();
            foreach (var e in map.edges)
            {
                if (!adj.ContainsKey(e.fromId)) adj[e.fromId] = new List<string>();
                adj[e.fromId].Add(e.toId);
            }

            while (queue.Count > 0)
            {
                var cur = queue.Dequeue();
                if (cur == toId)
                {
                    // 경로 역추적
                    var path = new List<string>();
                    var node = toId;
                    while (node != null)
                    {
                        path.Insert(0, node);
                        parent.TryGetValue(node, out node);
                    }
                    return path;
                }

                if (!adj.TryGetValue(cur, out var neighbors)) continue;
                foreach (var next in neighbors)
                {
                    if (!visited.Contains(next))
                    {
                        visited.Add(next);
                        parent[next] = cur;
                        queue.Enqueue(next);
                    }
                }
            }
            return null;
        }

        static float ProcessTime(NodeType type) => type switch
        {
            NodeType.Deposition => 1.5f,
            NodeType.Exposure   => 1.2f,
            NodeType.Etching    => 1.8f,
            NodeType.Cleaning   => 1.0f,
            _                   => 0.5f,
        };

        GameObject CreateCapsuleAgent(int index)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            go.transform.SetParent(transform);
            go.transform.localScale = new Vector3(0.3f, 0.4f, 0.3f);
            return go;
        }

        static readonly Color[] AGENT_COLORS =
        {
            new Color(0.35f, 0.65f, 1f),
            new Color(0.74f, 0.55f, 1f),
            new Color(1f,   0.65f, 0.34f),
            new Color(0.25f, 0.71f, 0.31f),
            new Color(0.97f, 0.32f, 0.29f),
            new Color(0.55f, 0.58f, 0.62f),
        };

        void SetAgentColor(GameObject go, int index)
        {
            var rend = go.GetComponentInChildren<Renderer>();
            if (rend == null) return;
            rend.material = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            rend.material.color = AGENT_COLORS[index % AGENT_COLORS.Length];
        }

        class AgentInstance
        {
            public GameObject Go;
            public OHTMapData Map;
            public string CurrentNodeId;
            public int ProcessStep = -1;
            public Coroutine Coroutine;
        }
    }
}
