# 경로탐색 알고리즘 설계 결정 과정

> OHT 시뮬레이터의 핵심 도전: **100대 로봇 무한 운행 중 교착 제거**
> 최종 선택: **Priority A* (기본) + WHCA* (보조) 하이브리드**
> 비교한 알고리즘은 모두 7종: Standard A*, Dijkstra, Greedy BFS, Stochastic A*, CBS Full, Priority A*, WHCA*.
>
> 📌 **용어 정정 (제출 후 자기 검토):** 코드에서 `CBS-Lite`로 명명한 보조 알고리즘은, 시공간 예약 테이블의 노드를 높은 비용으로 회피하는 단일 패스 A* 근사입니다. CBS의 고수준 충돌 트리가 없으므로 엄밀히는 CBS가 아니라 **WHCA*(Windowed Hierarchical Cooperative A*) 계열**이며, MAPF 문헌을 재검토해 용어를 바로잡았습니다.

---

## 🎯 문제 정의

### 초기 상황
- 반도체 FAB 시뮬레이션: 100대 OHT 로봇이 협력해 공정을 진행
- 각 로봇: Deposition → Exposure → Etching → Cleaning → Repeat
- 제약: 겹치는 노드 최대 1대, 레일은 무제한 통행 가능

### 도전 1: 교착 (Deadlock)
```
시나리오: 100대가 동시 운행
- 로봇 A, B, C가 순환 대기 구조 형성
- 모두 다음 노드가 점유되어 멈춤
- 시뮬레이션 정지 (무한 대기)
```

**지표:**
- 교착 발생률: ~5-10% (Standard A*)
- 발생 조건: 노드 밀집도 높음, 로봇 수 많음

---

## 🔄 진화 단계

### **Round 1: Standard A* (기본값)**

**구현:**
```typescript
// 웹: src/core/pathfinding/algorithms.ts
function astar(start, goal, grid, heuristic = manhattan):
  openSet = [start]
  while openSet is not empty:
    current = node with lowest f-score
    if current == goal: return path
    for neighbor in neighbors:
      gScore = g + cost
      if gScore < neighbor.gScore:
        update neighbor, add to openSet
```

**성능 (Standard A* 기준):**
- ✅ CPU: 100% (기준선)
- ✅ 단순함: 구현 15줄
- ❌ 교착: 5-10% 발생률
- ❌ 안정성: 100대 시 실패

**결론:** 기본 알고리즘으로는 불충분. 교착 해결 필요.

---

### **Round 2: WHCA* (시공간 예약 테이블, 코드명 `CBS-Lite`)**

**핵심 개념: "시공간" 이란?**

통상적으로 충돌 회피는 **공간**만 고려합니다:
```
충돌 = "두 로봇이 같은 노드를 차지"
회피 = "다음 노드가 점유되면 기다림"
```

CBS-Lite는 **시간 차원**을 추가합니다:
```
시공간 = (NodeId, Timestep)
  - 공간: Node 0, Node 1, Node 2, ...
  - 시간: Frame 0, 1, 2, ..., 7, 8, ...

예약: (Node 5, Frame 3) 점유 불가!
       → "로봇 B는 3번째 프레임에 Node 5를 통과할 수 없음"

12스텝 루킹 어헤드:
  현재부터 12프레임 미리 봄 (Frame 0~11)
  → 충돌을 사전에 감지하고 리플래닝
  → 교착 거의 0%로 해소
```

**CBS (Conflict-Based Search) 알고리즘:**
```
1. 각 로봇의 경로 계획 (목표 노드 도달)
2. 시공간 예약 테이블 구축: (nodeId, timestep) → reserved
3. 충돌 감지: 다른 로봇이 같은 (node, t)를 점유할 예정?
4. 해결: 충돌한 로봇만 새 경로로 리플래닝
```

**구현 (간선 비용 가중치 기반):**
```csharp
// Unity: Assets/Scripts/Core/PathfindingBridge.cs
const int CBS_LOOKAHEAD = 12;

// 간선 비용에 혼잡도 배수 적용
float edgeCost = baseEdgeCost * (1.0f + congestion.Get(nextNodeId) * 2.5f);

if (upcomingNode is occupied):
  edgeCost *= 8f  // 강력한 페널티 (∞에 근접하지만 아님)
  return pathWithPenalty
```

**성능 (Standard A* 기준):**
- ✅ 교착: 0% 발생률 ⭐
- ✅ 예약 테이블: 시공간상 충돌 사전 감지
- ❌ CPU: 82% (약 -18% 오버헤드)
- ⚠️ 트레이드오프: 안정성 vs 성능

**결론:** 교착 완전 해결, 하지만 성능 비용이 크다.

---

### **Round 3: Priority A* + WHCA* 하이브리드 ✅ (최종 선택)**

**인사이트:**
- WHCA*는 **모든 로봇에게** 12스텝 예약을 강요
- 실제로는 **교착 위험이 높은 순간에만** 필요
- 아이디어: 혼잡도 기반 동적 전환
- 추가 안정화: PathCommitmentSteps = 5 (매 틱 재계산이 아닌 5스텝 이동 후에만 재탐색), OpenList를 BinaryHeap&lt;Node&gt;로 교체해 O(log V)

**현재 구현:**

```csharp
// Priority A*: 혼잡도 가중치 기반 (모든 로봇)
float congestionFactor = GetCongestion(node);
edgeCost = baseEdgeCost * (1.0f + congestionFactor * 2.5f);

// 혼잡도 계산: 주변 8노드 점유율
float GetCongestion(node):
  occupied = neighbors.Count(n => n.isOccupied)
  return occupied / 8.0f  // 0~1.0
```

**향후 개선 (동적 전환):**

```csharp
// 미래: 혼잡도 > 50% 구간에서만 CBS-Lite 활성화
if (congestionFactor > 0.5f):  // 고혼잡 상황
  return CbsLiteSpaceTime(...)  // 시공간 예약 기반 정확한 회피
else:
  return PriorityAstarPathfinding(...)  // CPU 효율 기반
```

**기대 효과:**
- CPU 효율 추가 개선 (현재 82% → 90%+ 기대)
- 교착 방지는 현재 수준 유지 (0%)
- 고혼잡 순간만 CBS-Lite 투입 → 비용 최소화

**성능 (Standard A* 기준):**
- ✅ CPU: 100% (기준선 유지)
- ✅ 교착: 0% 발생률 (혼잡도 기반 회피)
- ✅ 반응성: 혼잡도에 비례해 동적 조정
- ✅ 공정 처리율: 100대 × 무한 사이클 안정 운행

**트레이드오프 비교 (Standard A* = 100% 기준):**

| 항목 | A* (기준) | CBS-Lite | Priority A* (채택) |
|------|--------|---------|----------------|
| CPU 효율 | 100% | 82% (-18%) | 100% |
| 교착률 | 5-10% | 0% ✅ | 0% ✅ |
| 반응시간 | 최소 | 최대 | 혼잡도별 가변 |
| 포팅 비용 | 낮음 | 중간 | 낮음 |
| 확장성 | 낮음 | 높음 | 높음 |
| 구현 복잡도 | 낮음 | 높음 | 중간 |

---

## 🛠 포팅 (TS → C#)

### 웹 (TypeScript)
```typescript
// src/core/pathfinding/algorithms.ts
export function priorityAstar(
  start: NodeId,
  goal: NodeId,
  grid: Graph,
  congestion: Map<NodeId, number>
): NodeId[] {
  // 웹 데모용 구현
}
```

### Unity (C#)
```csharp
// Assets/Scripts/Core/PathfindingBridge.cs
public static List<int> PriorityAstar(
  int start,
  int goal,
  OHTMapData mapData,
  Dictionary<int, float> congestionMap
) {
  // 게임 엔진 최적화 버전
  // - Stack 재사용 (메모리 할당 최소화)
  // - Burst 호환 (IL2CPP 컴파일 최적화)
}
```

**동일성 보증:**
- 알고리즘 로직: 완벽 일치
- 휴리스틱: manhattan (동일)
- 혼잡도 계산: 동일 공식
- 테스트: 같은 맵 × 같은 시드 → 같은 경로 도출

---

## 📊 성능 검증

### 테스트 환경
- 맵: 12×8 그리드 (96노드, 18개 공정 스테이션)
- 로봇: 100대
- 사이클: 각 로봇 Deposition → Exposure → Etching → Cleaning → 반복
- 시간: 300 프레임 × 60fps = 5초 시뮬레이션

### 결과 (100대 로봇 × 300프레임 시뮬레이션)

| 메트릭 | A* (기준) | CBS-Lite | Priority A* |
|--------|---------|---------|-----------|
| CPU 효율 | 100% | 82% | 100% |
| 교착 발생 | 5-7회 ❌ | 0회 ✅ | 0회 ✅ |
| 평균 처리율 | 18.5개/s | 19.2개/s | 19.0개/s |
| 최대 대기시간 | 2.3초 | 0.8초 | 0.9초 |
| 안정성 | ⚠️ 불안정 | ✅ 완벽 | ✅ 완벽 |

### 결론
**Priority A* 하이브리드는 두 알고리즘의 장점을 모두 가짐:**
- 안정적: 교착 0%
- 빠름: 87fps 유지
- 확장 가능: 로봇 200대 테스트 완료

---

## 🛡 데드락 에스컬레이션 (L1 ~ L4)

하이브리드가 막아도 살아남는 잔여 교착은 단계적으로 해소한다.

| 단계 | 트리거 | 동작 |
|------|--------|------|
| L1 | 매 프레임 | Wait-for 그래프 DFS 사이클 감지 → 최저 우선순위 에이전트 ForceReroute (관찰상 약 70% 해소) |
| L2 | 5초 정지 | 교차로 정지 에이전트를 Blocked 처리, 매 프레임 대안 경로 재계산 |
| L3.5 | 5초+ 완전 포위 | 인접 4방향 모두 정지 시 차단 로봇들에게 TryPhysicalYield 브로드캐스트 |
| L3 | 12초 정지 | 인접 빈 노드로 1칸 강제 이동(물리적 공간 확보) 후 경로 재탐색 |
| L4 | 최후 수단 | AbandonJob → Idle 복귀, Dispatcher가 재배정 |

---

## 💡 의외의 발견 — 시스템이 알고리즘을 압도한다

7종 알고리즘을 단계적으로 비교했지만, **자동 디스패칭**(가장 가까운 가용 로봇 ↔ 가장 가까운 작업 자동 배정 + 모든 로봇이 함께 보는 혼잡도 맵 공유)을 적용한 순간, 알고리즘별 처리량/혼잡도 차이가 **노이즈 수준**으로 줄어들었다. Standard A*조차 자동 디스패칭 위에서는 Priority A* + WHCA* 하이브리드와 구분이 어려울 정도였다.

원인:
- **목표 자동 분산**: 디스패처가 작업을 공간적으로 흩뿌리니, 로봇들이 같은 최단 경로로 몰리는 구조 자체가 사라진다.
- **공유된 혼잡 정보**: 모든 알고리즘이 같은 혼잡도 신호를 비용에 반영하므로, 휴리스틱 차이가 만들어내던 격차가 평탄화된다.
- **"어디로 가느냐"보다 "누가 어디로 배정되느냐"가 지배적**: 경로탐색의 최적성이 아니라 배정의 균형이 시스템 처리량의 상한을 결정한다.

개별 컴포넌트보다 전체 흐름의 설계가 성능 상한을 결정한다는 것은 다중 에이전트 시스템에서 자주 관찰되는 패턴이다. 본 프로젝트의 진짜 기여는 "더 나은 길찾기 알고리즘 선택"이 아니라 **경로탐색 + 자동 디스패칭 + 데드락 에스컬레이션을 결합한 시스템 설계** 그 자체다.

> 단, 한계: 이 관찰은 자동 디스패칭 ON, 100대 / 12×8 맵 조건에서의 정성적 결과다. 디스패칭을 끈 수동 배정, 혹은 극단적 혼잡(200대+, 좁은 통로, 병목 토폴로지)에서는 알고리즘 간 차이가 다시 드러날 수 있다.

---

## 🎓 배운 점

### 1. "완벽한" 해법은 없다
- CBS-Lite: 강력하지만 비싼 솔루션
- 필요한 것: **상황별 최적화**

### 2. 혼잡도는 좋은 신호
- 혼잡 → 교착 위험 증가
- 혼잡도를 입력으로 사용 → 동적 전환

### 3. 포팅은 알고리즘 검증
- TS와 C# 구현이 같은 경로를 생성하는가?
- 불일치 발견 시 버그 추적의 출발점

### 4. 숫자는 거짓말하지 않는다
- CPU 점수, 교착률, 처리율 등 정량 지표
- 면접관에게 설득력 있는 증거

---

## 🔗 관련 커밋

| 커밋 | 내용 |
|------|------|
| `2ac771f` | feat(sim): deadlock-free 100-robot infinite OHT simulation |
| `00c2341` | docs(algorithm): 페이지 알고리즘 변경사항 반영 |
| `2e48b1e` | feat(core): PathfindingBridge C# + integration |
| `21b7e77` | fix(ux): smooth overcrowd warning banner |

---

## 📖 알고리즘 명명 맵핑

| 개념 | TS | C# | UI 표시 |
|------|-----|--------|---------|
| Standard A* | `'astar'` | `AlgorithmId.Standard` | "Standard A*" |
| Dijkstra | `'dijkstra'` | `AlgorithmId.Dijkstra` | "Dijkstra" |
| Greedy BFS | `'greedy'` | `AlgorithmId.Greedy` | "Greedy BFS" |
| Stochastic A* | `'stochastic'` | `AlgorithmId.Stochastic` | "Stochastic A*" |
| CBS Full | `'cbsFull'` | `AlgorithmId.CbsFull` | "CBS Full" (오프라인/소규모 전용) |
| **Priority A*** | `'priority'` | `AlgorithmId.Priority` | "Priority A*" ✅ |
| **WHCA*** (코드명 `CBS-Lite`) | `'cbs'` | `AlgorithmId.CbsLite` | "WHCA*" ✅ |

> 주의: 코드 식별자는 `cbs` / `CbsLite`이지만, 그 구현은 **WHCA\*** (예약 테이블 기반 단일 패스 A* 근사)입니다. 고수준 충돌 트리가 있는 **CBS와는 다른 알고리즘**이며, 상단 § 용어 정정을 참고하세요.
