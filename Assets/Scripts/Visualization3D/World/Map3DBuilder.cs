using System.Collections.Generic;
using UnityEngine;
using OHTSim.Core;

namespace OHTSim.Visualization3D
{
    /// <summary>
    /// OHTMapData → 3D 씬으로 빌드.
    /// 기존 OHTSim.Core.MapBuilder와 분리되어 있으며, 노드별 프리팹 + 긴 레일 세그먼트로 방대한 공장 느낌 연출.
    /// </summary>
    public class Map3DBuilder : MonoBehaviour
    {
        [Header("필수 의존성")]
        public NodePrefabRegistry   prefabRegistry;
        public VisualizationConfig  config;

        [Header("부모 컨테이너 (자동 생성)")]
        Transform _mapRoot;
        Transform _nodesRoot;
        Transform _railsRoot;

        readonly Dictionary<string, NodeView>    _nodeViews    = new();
        readonly Dictionary<string, RailSegment> _railSegments = new();  // key = "fromId->toId"
        readonly List<MapNode> _nodes = new();

        public IReadOnlyDictionary<string, NodeView> NodeViews => _nodeViews;
        public IReadOnlyDictionary<string, RailSegment> RailSegments => _railSegments;
        public Bounds WorldBounds { get; private set; }

        // 서비스 등록은 SceneBootstrapper 단일 책임.
        // 이 컴포넌트는 자기 자신만 등록하여 Bootstrapper 미사용 시에도 동작하나,
        // Config/Registry는 인스펙터 직접 할당 → GameServices와 충돌 회피.
        void Awake()
        {
            if (GameServices.MapBuilder == null)
                GameServices.RegisterMapBuilder(this);
        }

        public void Build(OHTMapData data)
        {
            if (data == null || prefabRegistry == null || config == null)
            {
                Debug.LogError("[Map3DBuilder] data/prefabRegistry/config 누락");
                return;
            }
            Clear();
            CreateContainers();

            _nodes.Clear();
            _nodes.AddRange(data.nodes);

            foreach (var node in data.nodes) BuildNode(node);
            foreach (var edge in data.edges) BuildRail(edge, data);

            WorldBounds = ComputeBounds();
            SimEvents.RaiseMapBuilt(data.nodes.Count, data.edges.Count);
            Debug.Log($"[Map3DBuilder] 빌드 완료 — 노드 {data.nodes.Count}, 엣지 {data.edges.Count}, bounds size={WorldBounds.size}");
        }

        public void Clear()
        {
            _nodeViews.Clear();
            _railSegments.Clear();
            if (_mapRoot != null)
            {
                // 같은 프레임에 Build를 다시 호출해도 이전 GameObject가 공존하지 않도록
                // 에디트 모드면 DestroyImmediate, 플레이 모드는 Destroy 후 _mapRoot null화 직후 신규 컨테이너 생성.
#if UNITY_EDITOR
                if (!Application.isPlaying) DestroyImmediate(_mapRoot.gameObject);
                else                        Destroy(_mapRoot.gameObject);
#else
                Destroy(_mapRoot.gameObject);
#endif
                _mapRoot = null;
            }
        }

        public NodeView GetNodeView(string nodeId)
            => _nodeViews.TryGetValue(nodeId, out var v) ? v : null;

        /// <summary>월드 좌표 변환 — VisualizationConfig의 scale + separationMultiplier 적용.</summary>
        public Vector3 ToWorld(MapNode node)
            => new Vector3(
                node.x * config.mapScale * config.nodeSeparationMultiplier,
                0f,
                -node.y * config.mapScale * config.nodeSeparationMultiplier
            );

        // ── 내부 ───────────────────────────────────────────────────────
        void CreateContainers()
        {
            _mapRoot = new GameObject("Map3D").transform;
            _mapRoot.SetParent(transform, false);
            _nodesRoot = new GameObject("Nodes").transform; _nodesRoot.SetParent(_mapRoot, false);
            _railsRoot = new GameObject("Rails").transform; _railsRoot.SetParent(_mapRoot, false);
        }

        void BuildNode(MapNode node)
        {
            var prefab = prefabRegistry.GetPrefab(node.type);
            GameObject go;
            if (prefab != null)
            {
                go = Instantiate(prefab, _nodesRoot);
            }
            else
            {
                go = GameObject.CreatePrimitive(PrimitiveType.Cube);
                go.transform.SetParent(_nodesRoot, false);
                go.transform.localScale = Vector3.one * 1.5f;
            }

            Vector3 worldPos = ToWorld(node);
            go.transform.position = worldPos;

            var entry = prefabRegistry.Get(node.type);
            if (entry != null)
                go.transform.rotation *= Quaternion.Euler(entry.rotationOffset);

            var view = go.GetComponent<NodeView>() ?? go.AddComponent<NodeView>();
            view.Bind(node, worldPos);

            _nodeViews[node.id] = view;
        }

        void BuildRail(MapEdge edge, OHTMapData data)
        {
            var from = data.FindNode(edge.fromId);
            var to   = data.FindNode(edge.toId);
            if (from == null || to == null) return;

            string key = $"{edge.fromId}->{edge.toId}";
            if (_railSegments.ContainsKey(key)) return; // 중복 방지

            GameObject go;
            if (prefabRegistry.railSegmentPrefab != null)
            {
                go = Instantiate(prefabRegistry.railSegmentPrefab, _railsRoot);
            }
            else
            {
                go = GameObject.CreatePrimitive(PrimitiveType.Cube);
                go.transform.SetParent(_railsRoot, false);
            }
            go.name = $"Rail_{edge.id}";

            var seg = go.GetComponent<RailSegment>() ?? go.AddComponent<RailSegment>();
            Vector3 fromW = ToWorld(from);
            Vector3 toW   = ToWorld(to);

            // 노드 반경 추정값 (프리팹 bounds로 정밀 추출 가능하나 우선 1.0)
            float nodeRadius = 0.8f;
            seg.Setup(fromW, toW, prefabRegistry.railWidth, prefabRegistry.railHeight, nodeRadius);

            _railSegments[key] = seg;
        }

        Bounds ComputeBounds()
        {
            if (_nodeViews.Count == 0) return new Bounds(Vector3.zero, Vector3.one * 10f);
            bool first = true;
            Bounds b = default;
            foreach (var v in _nodeViews.Values)
            {
                if (first) { b = new Bounds(v.WorldPos, Vector3.zero); first = false; }
                else b.Encapsulate(v.WorldPos);
            }
            b.Expand(4f); // 여유 패딩
            return b;
        }
    }
}
