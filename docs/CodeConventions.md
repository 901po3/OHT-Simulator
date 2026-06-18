# Code Conventions — OHT Simulator

> 프로젝트: OHT Digital Twin Simulator (Unity 2022+ / URP)
> 작성일: 2026-06-18

---

## 1. 언어 및 환경
- **언어**: C# (.NET Standard 2.1)
- **엔진**: Unity 2022 LTS 이상, URP
- **최소 타겟**: PC Standalone (Windows)

---

## 2. 네이밍

### 2.1 클래스 / 인터페이스 / 열거형
```csharp
// PascalCase
public class OHTActor { }
public interface IPathFinder { }
public enum OHTState { Idle, Moving, WaitingAtIntersection, Loading, Unloading }
```

### 2.2 메서드
```csharp
// PascalCase
public void AssignJob(TransportJob job) { }
private void UpdateMovement(float deltaTime) { }
```

### 2.3 필드 / 프로퍼티
```csharp
// private 필드: _camelCase
private float _currentSpeed;
private OHTState _state;

// public 프로퍼티: PascalCase
public OHTState State => _state;
public RailNode CurrentNode { get; private set; }
```

### 2.4 상수 / 정적 읽기 전용
```csharp
private const float MaxSpeed = 2.0f;
private static readonly int AnimatorMoveHash = Animator.StringToHash("Move");
```

### 2.5 이벤트
```csharp
// on + PascalCase
public event Action<OHTActor> OnJobCompleted;
public event Action<RailNode> OnNodeReached;
```

---

## 3. 파일 / 폴더 구조

```
Assets/
├── Scripts/
│   ├── Core/               # 순수 C# 도메인 로직 (MonoBehaviour 없음)
│   │   ├── Graph/          # RailNode, RailEdge, RailGraph
│   │   ├── Pathfinding/    # IPathFinder, AStarPathFinder
│   │   ├── OHT/            # OHTActor, OHTStateMachine, OHTState
│   │   ├── Intersection/   # IntersectionReservationManager
│   │   └── Dispatcher/     # TransportJob, TransportJobDispatcher
│   ├── Simulation/         # SimulationController (MonoBehaviour, 진입점)
│   ├── Visualization/      # OHTView, RailRenderer, StatsPanel
│   └── UI/                 # SimulationUIController
├── Prefabs/
│   ├── OHTPrefab.prefab
│   └── RailNodePrefab.prefab
├── Scenes/
│   └── OHTSimulator.unity
└── Settings/
```

---

## 4. 설계 원칙

### 4.1 Core ↔ Visualization 분리
- `Core/` 내 클래스는 `UnityEngine` 네임스페이스를 import하지 않는다.
- Unity 의존성은 `Simulation/`, `Visualization/` 계층에서만 허용.
- 테스트 가능성 보장.

### 4.2 인터페이스 우선
```csharp
// 경로 탐색 알고리즘은 교체 가능하도록 인터페이스로 추상화
public interface IPathFinder
{
    List<RailNode> FindPath(RailNode from, RailNode to);
}
```

### 4.3 상태 패턴 (State Pattern)
- OHTActor의 행동은 `IOHTState` 인터페이스를 구현한 상태 클래스가 처리.
- 상태 전환 로직은 `OHTStateMachine`이 담당.
- OHTActor는 상태 내부 구현을 알 필요 없음.

### 4.4 이벤트 기반 통신
- OHT → Dispatcher: 이벤트(`OnJobCompleted`)로 결과 통보.
- Dispatcher → OHT: 메서드 호출(`AssignJob`).
- 직접 참조 대신 이벤트를 통해 결합도 최소화.

---

## 5. 주석 정책
- 코드 자체가 의도를 설명해야 한다. 무의미한 주석은 작성하지 않는다.
- WHY가 비자명한 경우에만 한 줄 주석 허용.
```csharp
// OHT 레일은 단방향이므로 역방향 엣지는 별도 추가 필요
graph.AddEdge(nodeA, nodeB);
```

---

## 6. SOLID 적용 요약

| 원칙 | 적용 위치 |
|------|---------|
| **S** Single Responsibility | OHTActor(이동만), Dispatcher(배정만), PathFinder(탐색만) |
| **O** Open/Closed | IOHTState 구현으로 상태 추가 시 기존 코드 수정 없음 |
| **L** Liskov Substitution | IPathFinder → AStarPathFinder, DijkstraPathFinder 교체 가능 |
| **I** Interface Segregation | IPathFinder, IIntersectionManager 분리 |
| **D** Dependency Inversion | OHTActor는 IPathFinder에 의존, 구현체에 직접 의존 안 함 |
