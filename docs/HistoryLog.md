# History Log — OHT Simulator

커밋마다 작업 내용을 기록한다. 최신 항목이 상단에 위치한다.

---

## [2026-06-18] Day 1 — 코어 로직 전체 구현

**커밋 예정**: `feat(core): implement OHT simulator core — graph, pathfinding, state machine, dispatcher`

### 생성 파일

| 계층 | 파일 | 역할 |
|------|------|------|
| Graph | `NodeType.cs` | 노드 타입 열거형 |
| Graph | `RailNode.cs` | 레일 노드 (좌표, 엣지 목록) |
| Graph | `RailEdge.cs` | 단방향 엣지 (길이, 혼잡 가중치) |
| Graph | `RailGraph.cs` | 그래프 컨테이너, 노드/엣지 추가 |
| Pathfinding | `IPathFinder.cs` | 경로 탐색 추상화 인터페이스 |
| Pathfinding | `AStarPathFinder.cs` | A* 구현 (Euclidean 휴리스틱) |
| OHT | `OHTStateType.cs` | 상태 열거형 (Idle/Moving/Waiting/Loading/Unloading) |
| OHT | `IOHTState.cs` | 상태 인터페이스 (Enter/Tick/Exit) |
| OHT | `JobPhase.cs` | 작업 단계 (GoingToSource / GoingToDestination) |
| OHT | `OHTStateMachine.cs` | 상태 머신 (딕셔너리 기반, 상태 인스턴스 재사용) |
| OHT | `OHTActor.cs` | OHT 엔티티 (이동, 작업 배정, 이벤트) |
| OHT/States | `IdleState.cs` | 대기 상태 |
| OHT/States | `MovingState.cs` | 이동 상태 (엣지 진행, 교차로 예약 시도) |
| OHT/States | `WaitingAtIntersectionState.cs` | 교차로 대기 (매 틱 재시도) |
| OHT/States | `LoadingState.cs` | FOUP 픽업 (0.5초 대기) |
| OHT/States | `UnloadingState.cs` | FOUP 전달 (0.5초 대기 후 JobCompleted 발행) |
| Intersection | `IIntersectionManager.cs` | 교차로 예약 인터페이스 |
| Intersection | `IntersectionReservationManager.cs` | 예약 관리 (데드락 타임아웃 5초) |
| Dispatcher | `TransportJob.cs` | 작업 데이터 (ID, Source, Dest) |
| Dispatcher | `TransportJobDispatcher.cs` | 작업 생성 + OHT 배정 (이벤트 기반) |
| Simulation | `MapBuilder.cs` | 6×4 Serpentine 격자 맵 생성 |
| Simulation | `SimulationStats.cs` | 처리량/대기 수 등 통계 집계 |
| Simulation | `SimulationController.cs` | Unity MonoBehaviour 진입점 |
| Visualization | `OHTView.cs` | OHTActor → Transform/Color 갱신 |
| Visualization | `RailRenderer.cs` | 엣지 LineRenderer + 노드 마커 생성 |
| Visualization | `StatsPanel.cs` | UI Text로 통계 표시 |

### 설계 결정
- **Core ↔ Unity 완전 분리**: `Core/` 폴더의 모든 클래스는 `UnityEngine` 미사용
- **State Pattern**: OHTActor 상태 로직이 IOHTState 구현체에 캡슐화
- **Strategy Pattern**: IPathFinder 인터페이스로 알고리즘 교체 가능
- **Observer (이벤트)**: OnJobCompleted로 OHT → Dispatcher 느슨한 결합
- **교차로 예약**: TryReserve + Release, 5초 타임아웃 데드락 해소
- **맵 구조**: 6×4 Serpentine 단방향 레일 (실제 AMHS 모델링)

### UnityAI 작업 목록
- `docs/RequestToUnity.md` 참조 (씬 구성, Prefab 생성, UI 배치)

---

## [2026-06-18] 프로젝트 초기화 및 설계

**커밋**: `feat: initial Unity URP project setup for OHT Digital Twin`
**커밋**: `chore: resolve .gitignore merge conflict`

### 작업 내용
- Unity URP 프로젝트 생성
- GitHub 연결: https://github.com/901po3/OHT-Simulator.git
- AMHS/OHT 실제 스펙 조사 (SK하이닉스 Newsroom, MDPI 2024 논문)
- 목표 스펙, 코드 컨벤션, 히스토리 로그, 트러블슈팅 문서 초기화

---
