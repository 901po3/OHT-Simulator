# OHT 시뮬레이터 — Unity 3D 핸드오프 문서

> Unity AI 작업 범위: 웹 에디터가 내보낸 XML 파일을 파싱하고 3D 씬으로 구현한다.

---

## 1. XML 포맷 (웹 에디터 출력)

웹 에디터의 "XML 내보내기" 버튼이 생성하는 포맷:

```xml
<OHTMap version="1.0">
  <Nodes>
    <Node id="node-1" x="100" y="200" type="Deposition"/>
    <Node id="node-2" x="300" y="200" type="Exposure"/>
    <Node id="node-3" x="200" y="100" type="Normal"/>
  </Nodes>
  <Edges>
    <Edge id="edge-1" from="node-1" to="node-2" weight="1"/>
    <Edge id="edge-2" from="node-2" to="node-1" weight="1"/>
    <Edge id="edge-3" from="node-1" to="node-3" weight="1"/>
  </Edges>
</OHTMap>
```

**NodeType 값:** `Normal` | `Deposition` | `Exposure` | `Etching` | `Cleaning` | `Depot`

**좌표계:** 웹 에디터의 픽셀 좌표 (x, y). Unity 변환: `x → X축`, `y → Z축`, `Y축 = 0` (바닥 평면).
스케일: `웹 px × 0.01 = Unity 단위` (예: 웹 100px → Unity 1.0).

---

## 2. C# 데이터 모델

XML을 파싱해서 담을 C# 클래스 (`OHTMapData.cs`):

```csharp
using System.Collections.Generic;

namespace OHTSim.Core
{
    public enum NodeType { Normal, Deposition, Exposure, Etching, Cleaning, Depot }

    public class MapNode
    {
        public string   Id;
        public float    X, Y;   // 웹 에디터 픽셀 좌표 (그대로 보존)
        public NodeType Type;
        public List<MapEdge> Edges = new List<MapEdge>();
    }

    public class MapEdge
    {
        public string   Id;
        public MapNode  From;
        public MapNode  To;
        public float    Weight;
    }

    public class OHTMapData
    {
        public List<MapNode> Nodes = new List<MapNode>();
        public List<MapEdge> Edges = new List<MapEdge>();

        // 파싱 후 반드시 호출 — MapNode.Edges 연결 리스트를 채운다
        public void BuildAdjacency()
        {
            var nodeMap = new Dictionary<string, MapNode>();
            foreach (var n in Nodes) nodeMap[n.Id] = n;
            foreach (var e in Edges)
            {
                if (nodeMap.TryGetValue(e.From.Id, out var from))
                    from.Edges.Add(e);
            }
        }
    }
}
```

---

## 3. XML 파서 (`MapXmlParser.cs`)

```csharp
using System.Xml;
using System.Collections.Generic;
using UnityEngine;

namespace OHTSim.Core
{
    public static class MapXmlParser
    {
        public static OHTMapData Parse(string xmlText)
        {
            var data    = new OHTMapData();
            var nodeMap = new Dictionary<string, MapNode>();

            var doc = new XmlDocument();
            doc.LoadXml(xmlText);

            // ── 노드 파싱 ──────────────────────────────────────
            foreach (XmlElement el in doc.SelectNodes("//Node"))
            {
                var node = new MapNode
                {
                    Id   = el.GetAttribute("id"),
                    X    = float.Parse(el.GetAttribute("x")),
                    Y    = float.Parse(el.GetAttribute("y")),
                    Type = ParseNodeType(el.GetAttribute("type")),
                };
                data.Nodes.Add(node);
                nodeMap[node.Id] = node;
            }

            // ── 엣지 파싱 ──────────────────────────────────────
            foreach (XmlElement el in doc.SelectNodes("//Edge"))
            {
                var fromId = el.GetAttribute("from");
                var toId   = el.GetAttribute("to");

                if (!nodeMap.TryGetValue(fromId, out var from) ||
                    !nodeMap.TryGetValue(toId,   out var to))
                {
                    Debug.LogWarning($"[MapXmlParser] 엣지 {el.GetAttribute("id")}: 노드 미발견");
                    continue;
                }

                data.Edges.Add(new MapEdge
                {
                    Id     = el.GetAttribute("id"),
                    From   = from,
                    To     = to,
                    Weight = float.TryParse(el.GetAttribute("weight"), out var w) ? w : 1f,
                });
            }

            data.BuildAdjacency();
            return data;
        }

        static NodeType ParseNodeType(string s) => s switch
        {
            "Deposition" => NodeType.Deposition,
            "Exposure"   => NodeType.Exposure,
            "Etching"    => NodeType.Etching,
            "Cleaning"   => NodeType.Cleaning,
            "Depot"      => NodeType.Depot,
            _            => NodeType.Normal,
        };
    }
}
```

---

## 4. MapBuilder — XML 데이터 → 3D 씬 (`MapBuilder.cs`)

```csharp
using UnityEngine;
using System.Collections.Generic;
using OHTSim.Core;

namespace OHTSim.Core
{
    public class MapBuilder : MonoBehaviour
    {
        [Header("스케일")]
        public float mapScale = 0.01f;  // 웹 px → Unity 단위

        [Header("노드 프리팹 (null이면 Sphere 자동 생성)")]
        public GameObject nodePrefab;

        // 노드 타입별 색상 (웹 에디터 NODE_META 기준)
        static readonly Dictionary<NodeType, Color> NODE_COLORS = new()
        {
            { NodeType.Normal,      new Color(0.345f, 0.651f, 1.000f) }, // #58a6ff
            { NodeType.Deposition,  new Color(0.737f, 0.549f, 1.000f) }, // #bc8cff
            { NodeType.Exposure,    new Color(1.000f, 0.651f, 0.341f) }, // #ffa657
            { NodeType.Etching,     new Color(0.973f, 0.318f, 0.286f) }, // #f85149
            { NodeType.Cleaning,    new Color(0.247f, 0.722f, 0.314f) }, // #3fb950
            { NodeType.Depot,       new Color(0.545f, 0.580f, 0.620f) }, // #8b949e
        };

        GameObject _root;

        // 기존 씬 제거 후 새 맵 생성 — MapLoaderService에서 호출
        public void Build(OHTMapData data)
        {
            if (_root != null) Destroy(_root);
            _root = new GameObject("OHTMap");

            var nodeObjects = new Dictionary<string, Transform>();

            // ── 노드 생성 ──────────────────────────────────────
            foreach (var node in data.Nodes)
            {
                var go = nodePrefab != null
                    ? Instantiate(nodePrefab, _root.transform)
                    : CreateSphere(_root.transform);

                go.name = $"{node.Type}_{node.Id}";

                // 웹 좌표 → Unity 좌표 (y=0 평면, 웹 y → Unity -z)
                go.transform.localPosition = new Vector3(
                    node.X * mapScale,
                    0f,
                    -node.Y * mapScale
                );

                if (go.TryGetComponent<Renderer>(out var rend))
                    rend.material.color = NODE_COLORS.GetValueOrDefault(node.Type, Color.white);

                nodeObjects[node.Id] = go.transform;
            }

            // ── 레일(엣지) 생성 ────────────────────────────────
            foreach (var edge in data.Edges)
            {
                if (!nodeObjects.TryGetValue(edge.From.Id, out var fromT) ||
                    !nodeObjects.TryGetValue(edge.To.Id,   out var toT)) continue;

                var rail = new GameObject($"Rail_{edge.Id}");
                rail.transform.SetParent(_root.transform);

                var lr = rail.AddComponent<LineRenderer>();
                lr.positionCount = 2;
                lr.SetPosition(0, fromT.position);
                lr.SetPosition(1, toT.position);
                lr.startWidth = lr.endWidth = 0.05f;
                lr.material   = new Material(Shader.Find("Sprites/Default"));
                lr.startColor = lr.endColor = new Color(0.188f, 0.212f, 0.251f); // #30363d
            }
        }

        static GameObject CreateSphere(Transform parent)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.transform.SetParent(parent);
            go.transform.localScale = Vector3.one * 0.3f;
            return go;
        }
    }
}
```

---

## 5. MapLoaderService — XML 파일 로드 오케스트레이터 (`MapLoaderService.cs`)

```csharp
using UnityEngine;
using System.IO;

namespace OHTSim.Core
{
    [RequireComponent(typeof(MapBuilder))]
    public class MapLoaderService : MonoBehaviour
    {
        MapBuilder _builder;

        void Awake() => _builder = GetComponent<MapBuilder>();

        // StreamingAssets/Maps/ 내 파일명 목록
        public static string[] GetAvailableMapNames()
        {
            var dir = Path.Combine(Application.streamingAssetsPath, "Maps");
            if (!Directory.Exists(dir)) return System.Array.Empty<string>();
            var files = Directory.GetFiles(dir, "*.xml");
            var names = new string[files.Length];
            for (int i = 0; i < files.Length; i++)
                names[i] = Path.GetFileNameWithoutExtension(files[i]);
            return names;
        }

        // 파일명으로 맵 로드 → MapBuilder.Build() 호출
        public void LoadMap(string mapName)
        {
            var path = Path.Combine(Application.streamingAssetsPath, "Maps", mapName + ".xml");
            if (!File.Exists(path))
            {
                Debug.LogError($"[MapLoaderService] 파일 없음: {path}");
                return;
            }
            var xml  = File.ReadAllText(path);
            var data = MapXmlParser.Parse(xml);
            _builder.Build(data);
        }
    }
}
```

---

## 6. 씬 조립 순서

1. 빈 씬 생성
2. 빈 GameObject `[Services]` 생성
   - `MapLoaderService` 컴포넌트 추가 (MapBuilder 자동 Required)
   - `MapBuilder` Inspector: `nodePrefab` 연결 (null이면 Sphere 자동)
3. 재생 → `MapLoaderService.LoadMap("파일명")` 호출로 맵 로드

---

## 7. 웹 → Unity 맵 전달

1. 웹 에디터에서 맵 편집 후 **"XML 내보내기"** 클릭
2. 다운로드된 `.xml` 파일을 `Assets/StreamingAssets/Maps/` 에 복사
3. Unity에서 `MapLoaderService.LoadMap("파일명")` 호출
