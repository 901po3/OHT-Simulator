# OHT-System → Unity 3D 시뮬레이션 가이드

## 🎯 개요

OHT-System 웹 시뮬레이터에서 최적화된 맵 데이터와 효율 정보를 **XML**로 내보내어, Unity에서 3D 시뮬레이션으로 구축할 수 있습니다.

---

## 📋 1단계: 웹 시뮬레이션에서 데이터 내보내기

### 1️⃣ 시뮬레이션 페이지 이동
- OHT-System 시뮬레이션 탭 진입
- 맵 선택: "초대형 팹 ∞" (320노드, 단방향 그리드)

### 2️⃣ 시뮬레이션 실행
- **▶ 시작** 버튼 클릭
- 로봇 수: 권장 70~100대 설정
- 속도: 4.0~5.0 설정
- 최소 30초 이상 운행하며 효율 메트릭 누적

### 3️⃣ XML 내보내기
- 우측 상단 **💾 XML 내보내기** 버튼 클릭
- `oht-simulation-YYYY-MM-DD.xml` 파일 다운로드
- 파일을 Unity 프로젝트의 `Assets/Resources/OHT/` 폴더에 저장

---

## 📦 2단계: Unity C# 클래스 추가

### 파일 위치
```
Assets/Scripts/OHT/OHTSimulationData.cs
```

### 클래스 구조
```
OHTSimulationData
├── MapMetadata (맵 기본 정보)
├── Nodes[] (노드 목록)
├── Edges[] (레일 엣지)
├── ProcessStations[] (공정 스테이션)
├── Depots[] (로봇 차고지)
└── OptimizationHints (성능 최적화 정보)
```

---

## 🔧 3단계: Unity에서 로드 및 사용

### 기본 사용 예시

```csharp
using UnityEngine;

public class OHTSimulationManager : MonoBehaviour
{
    private OHTSimulationData simulationData;

    void Start()
    {
        // XML 파일 로드
        string xmlPath = Application.persistentDataPath + "/oht-simulation-2026-06-22.xml";
        simulationData = OHTSimulationLoader.LoadFromXML(xmlPath);

        if (simulationData != null)
        {
            InitializeSimulation();
        }
    }

    void InitializeSimulation()
    {
        // 맵 메타데이터 확인
        Debug.Log($"맵: {simulationData.MapMetadata.Name}");
        Debug.Log($"노드: {simulationData.Nodes.Count}개");
        Debug.Log($"추천 로봇: {simulationData.OptimizationHints.OptimalRobotCount}대");

        // 노드 기반 3D 오브젝트 생성
        foreach (var node in simulationData.Nodes)
        {
            CreateNodePrefab(node);
        }

        // 레일 생성
        foreach (var edge in simulationData.Edges)
        {
            CreateRailSegment(edge);
        }

        // 공정 스테이션 생성
        foreach (var station in simulationData.ProcessStations)
        {
            CreateProcessStation(station);
        }

        // 차고지 생성
        foreach (var depot in simulationData.Depots)
        {
            CreateDepot(depot);
        }
    }

    void CreateNodePrefab(Node node)
    {
        // 위치: (node.X, 0, node.Y)
        Vector3 pos = new Vector3(node.X * 5f, 0.5f, node.Y * 5f); // 5 단위 간격

        GameObject nodeObj = new GameObject($"Node_{node.Id}");
        nodeObj.transform.position = pos;

        if (node.IsProcessStation())
        {
            // 공정 스테이션용 빨간색 큐브
            var renderer = nodeObj.AddComponent<MeshRenderer>();
            var filter = nodeObj.AddComponent<MeshFilter>();
            filter.mesh = Resources.GetBuiltinResource<Mesh>("Cube.fbx");
            renderer.material = new Material(Shader.Find("Standard"));
            renderer.material.color = Color.red;
        }
        else if (node.IsDepot())
        {
            // 차고지용 파란색 큐브
            var renderer = nodeObj.AddComponent<MeshRenderer>();
            var filter = nodeObj.AddComponent<MeshFilter>();
            filter.mesh = Resources.GetBuiltinResource<Mesh>("Cube.fbx");
            renderer.material = new Material(Shader.Find("Standard"));
            renderer.material.color = Color.blue;
        }
        else
        {
            // 일반 노드용 회색 구
            var renderer = nodeObj.AddComponent<MeshRenderer>();
            var filter = nodeObj.AddComponent<MeshFilter>();
            filter.mesh = Resources.GetBuiltinResource<Mesh>("Sphere.fbx");
            renderer.material = new Material(Shader.Find("Standard"));
            renderer.material.color = Color.gray;
        }
    }

    void CreateRailSegment(Edge edge)
    {
        var fromNode = simulationData.FindNodeById(edge.From);
        var toNode = simulationData.FindNodeById(edge.To);

        if (fromNode == null || toNode == null) return;

        Vector3 fromPos = new Vector3(fromNode.X * 5f, 0.3f, fromNode.Y * 5f);
        Vector3 toPos = new Vector3(toNode.X * 5f, 0.3f, toNode.Y * 5f);

        // Line Renderer로 레일 그리기
        GameObject railObj = new GameObject($"Rail_{edge.Id}");
        var lineRenderer = railObj.AddComponent<LineRenderer>();
        lineRenderer.SetPosition(0, fromPos);
        lineRenderer.SetPosition(1, toPos);
        lineRenderer.material = new Material(Shader.Find("Sprites/Default"));
        lineRenderer.startColor = edge.IsOneWay ? Color.cyan : Color.green;
        lineRenderer.endColor = edge.IsOneWay ? Color.cyan : Color.green;
        lineRenderer.startWidth = 0.2f;
        lineRenderer.endWidth = 0.2f;
    }

    void CreateProcessStation(ProcessStation station)
    {
        Vector3 pos = new Vector3(station.X * 5f, 1.5f, station.Y * 5f);
        GameObject stationObj = new GameObject($"Station_{station.Type}_{station.NodeId}");
        stationObj.transform.position = pos;

        // 공정 타입별 색상
        Color stationColor = station.Type switch
        {
            "증착" => new Color(0.8f, 0.4f, 0.8f), // 보라색
            "노광" => new Color(1f, 0.8f, 0.2f),   // 황색
            "식각" => new Color(1f, 0.4f, 0.2f),   // 주황색
            "세정" => new Color(0.2f, 0.8f, 0.4f), // 초록색
            _ => Color.white
        };

        var renderer = stationObj.AddComponent<MeshRenderer>();
        var filter = stationObj.AddComponent<MeshFilter>();
        filter.mesh = Resources.GetBuiltinResource<Mesh>("Cube.fbx");
        renderer.material = new Material(Shader.Find("Standard"));
        renderer.material.color = stationColor;

        // UI 라벨
        var text = stationObj.AddComponent<TextMesh>();
        text.text = $"{station.Type}\n({station.ProcessingTimeMs}ms)";
        text.fontSize = 10;
    }

    void CreateDepot(Depot depot)
    {
        Vector3 pos = new Vector3(depot.X * 5f, 0.5f, depot.Y * 5f);
        GameObject depotObj = new GameObject($"Depot_{depot.NodeId}");
        depotObj.transform.position = pos;

        var renderer = depotObj.AddComponent<MeshRenderer>();
        var filter = depotObj.AddComponent<MeshFilter>();
        filter.mesh = Resources.GetBuiltinResource<Mesh>("Cube.fbx");
        renderer.material = new Material(Shader.Find("Standard"));
        renderer.material.color = new Color(0.2f, 0.2f, 0.8f); // 진한 파란색

        var text = depotObj.AddComponent<TextMesh>();
        text.text = $"Depot\n(±{depot.SpawnRatePerSec}/s)";
        text.fontSize = 8;
    }
}
```

---

## 🤖 4단계: 로봇 시뮬레이션 구축

### 로봇 생성 및 경로 이동

```csharp
public class RobotAgent : MonoBehaviour
{
    private OHTSimulationData mapData;
    private Queue<Node> currentPath;
    private float speed = 5f; // m/s

    public void Initialize(OHTSimulationData data)
    {
        mapData = data;
        currentPath = new Queue<Node>();
    }

    public void MoveTo(List<Node> path)
    {
        currentPath = new Queue<Node>(path);
    }

    void Update()
    {
        if (currentPath.Count > 0)
        {
            var nextNode = currentPath.Peek();
            Vector3 targetPos = new Vector3(nextNode.X * 5f, 0.5f, nextNode.Y * 5f);
            
            transform.position = Vector3.MoveTowards(transform.position, targetPos, speed * Time.deltaTime);

            if (Vector3.Distance(transform.position, targetPos) < 0.1f)
            {
                currentPath.Dequeue();
            }
        }
    }
}
```

---

## 📊 5단계: 최적화 정보 활용

```csharp
public class SimulationOptimizer : MonoBehaviour
{
    public void ApplyOptimizationHints(OHTSimulationData data)
    {
        var hints = data.OptimizationHints;
        
        Debug.Log("=== 시뮬레이션 최적화 정보 ===");
        Debug.Log($"최적 로봇 수: {hints.OptimalRobotCount}대");
        Debug.Log($"권장 범위: {hints.RecommendedRobotMin}~{hints.RecommendedRobotMax}대");
        Debug.Log($"평균 이동거리: {hints.AvgMoveDistance} 칸");
        Debug.Log($"혼잡도: {hints.CongestionLevel * 100:F1}%");
        Debug.Log($"공정 가동률 목표: {hints.ProcessUtilizationTarget * 100}%");
        Debug.Log($"알고리즘: {hints.AlgorithmUsed}");
        Debug.Log("");
        Debug.Log(hints.GetRecommendation());
    }
}
```

---

## 🔄 웹 시뮬레이션 ↔ Unity 실시간 연동 (선택사항)

WebSocket을 통해 웹 시뮬레이터의 실시간 데이터를 Unity로 스트리밍할 수 있습니다:

```csharp
using WebSocketSharp;

public class SimulationWebSocketClient : MonoBehaviour
{
    private WebSocketBehavior socket;

    void Start()
    {
        socket = new WebSocketBehavior();
        socket.OnMessage += (sender, e) =>
        {
            // 웹 시뮬에서 받은 데이터 처리
            var update = JsonUtility.FromJson<RobotStateUpdate>(e.Data);
            UpdateRobotPosition(update);
        };
    }
}

[System.Serializable]
public class RobotStateUpdate
{
    public string robotId;
    public int nodeX;
    public int nodeY;
    public string state; // "Moving", "Processing", "Idle", "Waiting"
    public float timestamp;
}
```

---

## ✅ 체크리스트

- [ ] XML 파일이 `Assets/Resources/OHT/` 폴더에 있음
- [ ] `OHTSimulationData.cs`가 프로젝트에 포함됨
- [ ] `OHTSimulationManager` 스크립트가 씬에 있음
- [ ] 노드/엣지/스테이션이 3D에 정상 렌더링됨
- [ ] 로봇이 경로를 따라 이동함
- [ ] 최적화 정보가 콘솔에 출력됨

---

## 🎮 주의사항

1. **좌표계**: 웹에서는 (X, Y), Unity에서는 (X*scale, 고정높이, Y*scale)로 변환
2. **단위**: 웹 1칸 = Unity 5 단위 (조정 가능)
3. **시간**: XML의 `ProcessingTimeMs`는 밀리초 단위
4. **일방향**: 단방향 그리드에서 역방향 이동 불가 (엣지 방향 확인)

---

## 📞 문제 해결

| 문제 | 해결 방법 |
|------|---------|
| XML 로드 실패 | 파일 인코딩이 UTF-8인지 확인 |
| 노드 위치 이상 | 좌표 변환 공식(X*5, 0.5, Y*5) 재확인 |
| 로봇이 움직이지 않음 | `currentPath` 큐가 비어있지 않은지 확인 |
| 메모리 부족 | 노드/엣지 렌더링 최적화 (오브젝트 풀링) |

---

**생성일**: 2026-06-22  
**호환성**: Unity 2022.3 LTS+, .NET 4.x
