# OHT System — 포트폴리오 웹 애플리케이션

반도체 팹 OHT(Overhead Hoist Transport) 시뮬레이터 포트폴리오.  
Unity 3D 시뮬레이터 개발 과정에서 시도한 알고리즘, 설계 결정, 최적화 이력을 인터랙티브하게 보여주는 웹 앱.

## 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| 빌드 | Vite + TypeScript |
| UI | React 18 |
| 2D 캔버스 | react-konva (Konva.js) |
| 상태 관리 | Zustand + persist |
| 라우팅 | React Router v6 |

## 페이지 구성

### `/editor` — 맵 에디터
- 6종 노드 드래그&드롭 (Normal, Deposition, Exposure, Etching, Cleaning, Depot)
- 레일 연결 (단방향 / 양방향)
- 레일 중간에 노드 삽입 (드래그해서 레일 위에 드롭)
- 캔버스 Pan (빈 공간 드래그) / Zoom (스크롤, 버튼)
- Undo/Redo (Ctrl+Z/Y, 최대 50단계)
- JSON 저장/불러오기 (로컬 파일)
- XML 내보내기 (Unity 에디터 연동용)
- 자동 저장 (localStorage)

### `/simulation` — 시뮬레이션
- 에디터 맵 위에서 OHT 에이전트 실시간 이동
- 6종 길찾기 알고리즘 선택:
  - Standard A* / Dijkstra / Greedy BFS / Stochastic A* / Priority A* / CBS-Lite
- 로봇 수(1~8대), 이동 속도 슬라이더
- 자동 최적화 출하 토글 (최근접 에이전트 배정)
- 실시간 통계: 이동거리/초, 완료 작업 수, 경과 시간
- 에이전트별 상태 (Idle/Moving/Loading/Unloading)
- 혼잡도 히트맵, 경로 미리보기

### `/process` — 반도체 공정 시각화
- 증착 / 노광 / 식각 / 세정 공정 단계별 애니메이션
- Canvas 2D API 파티클 시스템

### `/algorithm` — 알고리즘 문서
- 개발 타임라인 (4단계, 시도/실패/채택 이력)
- 7종 알고리즘 4지표 비교 차트
- CBS vs CBS-Lite 심화 분석
- Priority A* + WHCA* 하이브리드 설명
- 보조 기법 8종 (BinaryHeap, CommitmentSteps, WHCA* 등)
- 데드락 에스컬레이션 L1~L4 타임라인

## 프로젝트 구조

```
src/
├── core/
│   ├── graph/types.ts          # RailNode, RailEdge 타입 정의
│   ├── pathfinding/
│   │   └── algorithms.ts       # 6종 알고리즘 + ALGORITHM_META
│   └── export/
│       └── xmlSerializer.ts    # Unity XML 직렬화
├── store/
│   ├── editorStore.ts          # 맵 상태 (nodes, edges, undo/redo, persist)
│   └── simRunStore.ts          # 시뮬레이션 런타임 (agents, tick, stats)
├── components/
│   ├── editor/
│   │   ├── EditorCanvas.tsx    # Konva Stage (pan/zoom/edge-insert)
│   │   ├── NodePalette.tsx     # 팔레트 + connectType + JSON 저장
│   │   ├── MapEditor.tsx       # 에디터 레이아웃 + 키보드 단축키
│   │   ├── NodeTooltip.tsx     # 노드 선택 툴팁
│   │   └── SimOverlay.tsx      # 에디터 위 에이전트 Konva Layer
│   ├── simulation/
│   │   └── SimMapCanvas.tsx    # 시뮬레이션 페이지 전용 읽기 전용 캔버스
│   ├── layout/
│   │   └── TopBar.tsx          # 네비게이션 + Undo/Redo + XML 내보내기
│   ├── process/
│   │   └── ProcessViewer.tsx   # 공정 애니메이션
│   └── algorithm/
│       └── AlgorithmPage.tsx   # 알고리즘 문서
├── pages/
│   ├── EditorPage.tsx
│   ├── ProcessPage.tsx
│   ├── AlgorithmPageRoute.tsx
│   └── SimulationPage.tsx      # 시뮬레이션 전용 페이지 + RAF 루프
└── App.tsx                     # BrowserRouter + 라우트 정의
```

## 저장 방식

| 방식 | 위치 | 형식 | 용도 |
|------|------|------|------|
| 자동 저장 | `localStorage['oht-editor-map']` | JSON | 새로고침 후 맵 유지 |
| JSON 저장 | 다운로드 `.json` | `{nodes[], edges[]}` | 파일 백업/복원 |
| XML 내보내기 | 다운로드 `.xml` | `<OHTMap>` | Unity 에디터 연동 |

## 개발

```bash
npm install
npm run dev      # localhost:5173
npm run build    # dist/ 빌드
```

## 🧠 기술 결정 사항 (Technical Decisions)

### 1️⃣ 경로탐색: Priority A* + CBS-Lite 하이브리드

**도전:** 100대 로봇 무한 운행 중 교착(deadlock) 제거

**진화 과정 (Standard A* = 100% 기준):**

| 단계 | 알고리즘 | CPU 효율 | 교착 방지 | 결과 |
|------|---------|--------|---------|------|
| 1 | Standard A* | 100% | ❌ 5~10% | 불안정 |
| 2 | CBS-Lite (시공간 예약) | 82% (-18%) | ✅ 0% | 느림 |
| 3 | **Priority A* 하이브리드** | 100% | ✅ 0% | ✅ 채택 |

**구현:**
- **기본:** Priority A* (혼잡도 가중치)
  - 간선 비용 = 기본값 × (1.0 + 혼잡도 × 2.5)
  - 혼잡도: 주변 8노드 점유율 (0~1)
- **보조:** CBS-Lite (시공간 예약 테이블)
  - 8스텝 루킹 어헤드로 미래 충돌 감지
  - (NodeId, Timestep) 차원에서 예약 확인
  - ×8 페널티로 충돌 회피

**검증:**
- 100대 로봇 × 300프레임 테스트
- 처리율: 19.0개/s (안정)
- 최대 대기시간: 0.9초 (개선)
- 교착률: 0% ✅

**관련 문서:** [`docs/ALGORITHM_DECISIONS.md`](./docs/ALGORITHM_DECISIONS.md)

---

### 2️⃣ 아키텍처: Service Locator + Event Hub

**목표:** 느슨한 결합, 높은 확장성

**패턴:**
```csharp
// Service Locator: 전역 상태 관리
GameServices.Register<IPathfinding>(new PathfindingBridge());
var pathfinder = GameServices.Get<IPathfinding>();

// Event Hub: 컴포넌트 간 통신
SimEvents.OnRobotSpawned += (robot) => MinimapRenderer.AddDot(robot.Id);
SimEvents.RaiseMapBuilt();
```

**이점:**
- MonoBehaviour 간 직접 참조 제거 (순환 의존성 방지)
- ScriptableObject 설정으로 Inspector에서 파라미터 조정
- 런타임 알고리즘 전환 가능

---

### 3️⃣ 맵 설계: 단방향 그리드 (Unidirectional Grid)

**목표:** 정면충돌 구조적 불가능

**원리:**
```
행(row) 패리티:
  짝수 행 → 우측 이동 (→)
  홀수 행 → 좌측 이동 (←)

열(col) 패리티:
  짝수 열 → 하향 이동 (↓)
  홀수 열 → 상향 이동 (↑)

결과: 2-cycle 구조적 불가능, 정면충돌 0%
```

**프리셋:**
| 맵 | 크기 | 노드 | 공정역 | 특징 |
|----|------|------|--------|------|
| 소형 | 6×4 | 24 | 4 | 학습용 |
| 중형 | 8×6 | 48 | 8 | 기본 |
| 대형 | 12×8 | 96 | 18 | 포트폴리오 |
| 초대형 | 20×16 | 320 | 72 | 스트레스 테스트 |

---

### 4️⃣ 웹 ↔ Unity 포팅 (TypeScript ↔ C#)

**과제:** 같은 알고리즘, 두 언어/런타임

**해법:**
1. **웹 (TS):** 인터랙티브 데모, 설명 목적
   ```typescript
   export function priorityAstar(...): NodeId[]
   ```

2. **Unity (C#):** 성능 최적화, Burst 호환
   ```csharp
   public static List<int> PriorityAstar(...): ...
   ```

3. **검증:** 같은 맵 × 같은 시드 → 같은 경로 생성

**관련 커밋:** `2e48b1e` (feat(core): PathfindingBridge C# integration)

---

### 5️⃣ UX: 안정적인 경고 배너

**문제:** 경고 표시/숨김 시 화면 레이아웃이 밀림 & 메시지가 너무 빨리 사라짐

**해법:**
1. **고정 높이** — 배너 공간을 항상 36px로 예약
   ```css
   minHeight: 36px  /* 높이 고정 */
   opacity: visibleWarning ? 1 : 0  /* 투명도로만 조절 */
   ```
2. **메시지 유지** — 새 경고 시 최소 3초 표시
   ```typescript
   useEffect(() => {
     if (overcrowdWarning) {
       setVisibleWarning(overcrowdWarning);
       setTimeout(() => setVisibleWarning(null), 3000);  // 3초 유지
     }
   }, [overcrowdWarning]);
   ```

**결과:** 
- 화면이 밀리지 않음 (공간 예약)
- 메시지가 충분한 시간 표시 (가독성 ↑)
- 부드러운 fade-in/out 애니메이션

---

## 변경 이력

[History.log](./History.log) 참고.
