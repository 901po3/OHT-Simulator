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
        /// <summary>미니맵/탑뷰 카메라에서만 보이는 혼잡도 오버레이 레이어 인덱스.</summary>
        public const int MinimapOnlyLayer = 31;

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

        /// <summary>월드 좌표 변환 — VisualizationConfig의 scale + separationMultiplier 적용 (천장 레일 높이인 Y=5.5f로 상향 조정).</summary>
        public Vector3 ToWorld(MapNode node)
            => new Vector3(
                node.x * config.mapScale * config.nodeSeparationMultiplier,
                5.5f,
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
            
            Vector3 worldPos = ToWorld(node); // Y=5.5f
            Vector3 spawnPos = worldPos;

            // 라우팅용 노드(Normal)는 천장(Y=5.5f)에 그대로 두고, 제조 장비 노드는 바닥(Y=0f)에 배치합니다.
            if (node.type != NodeType.Normal)
            {
                spawnPos.y = 0f;
            }

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

            go.transform.position = spawnPos;

            var entry = prefabRegistry.Get(node.type);
            if (entry != null)
                go.transform.rotation *= Quaternion.Euler(entry.rotationOffset);

            var view = go.GetComponent<NodeView>() ?? go.AddComponent<NodeView>();
            // NodeView는 레일/로봇 이동 기준이 되는 천장 좌표(Y=5.5f)를 월드 좌표로 바인딩합니다.
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

            // ── 미니맵 전용 혼잡도 오버레이 ──────────────────────────
            CreateCongestionOverlay(go.transform, seg, fromW, toW, nodeRadius);

            _railSegments[key] = seg;
        }

        /// <summary>
        /// 레일 위에 얇고 평평한 발광 큐브를 생성한다. MinimapOnly 레이어에 두어
        /// 메인 3D 카메라에서는 보이지 않고 미니맵/탑뷰에서만 혼잡도 히트맵으로 보인다.
        /// </summary>
        void CreateCongestionOverlay(Transform railTransform, RailSegment seg, Vector3 fromW, Vector3 toW, float nodeRadius)
        {
            Vector3 dir = toW - fromW;
            float len = dir.magnitude;
            if (len < 0.001f) return;
            Vector3 dirN = dir / len;
            float effectiveLen = Mathf.Max(0.1f, len - nodeRadius * 2f);

            var overlay = GameObject.CreatePrimitive(PrimitiveType.Cube);
            overlay.name = "CongestionOverlay";

            // 콜라이더 제거 (시각 전용)
            var col = overlay.GetComponent<Collider>();
            if (col != null)
            {
#if UNITY_EDITOR
                if (!Application.isPlaying) DestroyImmediate(col);
                else                        Destroy(col);
#else
                Destroy(col);
#endif
            }

            // 레일 위에 살짝 띄워 같은 구간을 덮는 얇은 판
            overlay.transform.SetParent(railTransform, false);
            overlay.transform.position = (fromW + toW) * 0.5f + Vector3.up * 0.3f;
            overlay.transform.rotation = Quaternion.LookRotation(dirN, Vector3.up);
            overlay.transform.localScale = new Vector3(prefabRegistry.railWidth * 1.2f, 0.05f, effectiveLen);

            // MinimapOnly 레이어로 재귀 설정
            SetLayerRecursive(overlay, MinimapOnlyLayer);

            // URP Lit + 발광 머티리얼 인스턴스
            var renderer = overlay.GetComponent<Renderer>();
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader != null && renderer != null)
            {
                var mat = new Material(shader);
                mat.EnableKeyword("_EMISSION");
                mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
                renderer.sharedMaterial = mat;
            }

            seg.SetCongestionOverlay(renderer);
            seg.SetCongestion(0f);
        }

        static void SetLayerRecursive(GameObject go, int layer)
        {
            go.layer = layer;
            foreach (Transform child in go.transform)
                SetLayerRecursive(child.gameObject, layer);
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
