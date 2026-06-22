# OHT System — 기능 명세 (FEATURES.md)

> 이 파일은 세션에 걸쳐 요청된 모든 유효 기능을 추적한다.  
> 상태: ✅ 완료 | 🔧 구현 중 | ⏳ 대기 | ❌ 취소
> 마지막 갱신: 2026-06-21 (세션 12)

---

## 1. 맵 에디터 (EditorPage `/editor`)

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| E-01 | Konva 2D 캔버스 | ✅ | Stage/Layer/Group 기반 |
| E-02 | 노드 팔레트 6종 (Normal / Deposition / Exposure / Etching / Cleaning / Depot) | ✅ | 드래그&드롭으로 캔버스 배치 |
| E-03 | 노드 선택 → 툴팁 (이동/제거/연결) | ✅ | NodeTooltip |
| E-04 | 수동 패닝 (빈 공간 드래그) | ✅ | Stage draggable 제거, onMouseDown/Move/Up 직접 구현 |
| E-05 | 줌 (스크롤, 좌하단 +/−/⊡ 버튼) | ✅ | 20%~400% |
| E-06 | 레일 위 노드 드롭 → 엣지 자동 분리·삽입 | ✅ | 초록 하이라이트 피드백 포함 |
| E-07 | 단방향/양방향 연결 토글 | ✅ | NodePalette 하단 고정 영역 |
| E-08 | 마이크로 드래그 클릭 처리 (4px 미만) | ✅ | nodeDragStartRef |
| E-09 | 패닝/클릭 레이스 컨디션 방지 | ✅ | panMovedRef |
| E-10 | Undo / Redo (Ctrl+Z/Y/Shift+Z) | ✅ | editorStore _past/_future 스냅샷 50개 |
| E-11 | XML 내보내기 (Unity 호환 `<OHTMap>`) | ✅ | TopBar 버튼 |
| E-12 | JSON 다운로드 / JSON 파일 불러오기 | ✅ | NodePalette 하단 |
| E-13 | IndexedDB 맵 저장/불러오기/삭제 | ✅ | `mapStorage.ts`, DB 풀링, 에러 처리 포함 |
| E-14 | 에디터 내 시뮬레이션 오버레이 (SimOverlay) | ✅ | Konva Layer 오버레이 |

---

## 2. 시뮬레이션 페이지 (SimulationPage `/simulation`)

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| S-01 | 풀스크린 맵 + 에이전트 오버레이 (SimMapCanvas) | ✅ | 읽기 전용 맵, pan/zoom |
| S-02 | 7종 알고리즘 선택 (Standard A* / Dijkstra / Greedy BFS / Stochastic A* / CBS Full / Priority A* / CBS-Lite(WHCA*)) | ✅ | 상단 컨트롤 바 |
| S-03 | 로봇 수 슬라이더 (1–12) | ✅ | |
| S-04 | 속도 슬라이더 | ✅ | |
| S-05 | 자동 최적화 출하 (autoDispatch) 토글 | ✅ | true=최근접, false=고정 순환 |
| S-06 | 공정 사이클 (Deposition→Exposure→Etching→Cleaning→반복) | ✅ | processStage 0-3 |
| S-07 | 차고지(Depot) 자동 스폰 (1초 간격, 점유 시 대기) | ✅ | spawnTimers Map |
| S-08 | Processing 상태 (노드 타입별 1.0~1.8초: Deposition 1.5 / Exposure 1.2 / Etching 1.8 / Cleaning 1.0) 후 다음 공정으로 이동 | ✅ | |
| S-09 | 충돌 방지 (occupied Map, 다음 노드 점유 시 대기) | ✅ | |
| S-10 | 혼잡도 히트맵 오버레이 | ✅ | |
| S-11 | 경로 미리보기 (점선 Arrow) | ✅ | |
| S-12 | 실시간 통계 패널 (완료 작업 / 총 이동 / 경과 시간 / 처리율) | ✅ | |
| S-13 | OHT 상태 카드 (에이전트별 현재 공정 단계 표시) | ✅ | |
| S-14 | agentSeq Zustand 상태로 관리 (HMR 안전) | ✅ | 세션 12 수정 |
| S-15 | CBS 예약 테이블 갱신 | ✅ | reservations Map |

---

## 3. 알고리즘 페이지 (AlgorithmPage `/algorithm`)

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| A-01 | 7종 알고리즘 소개 및 비교 | ✅ | |
| A-02 | 4지표 비교 차트 | ✅ | |
| A-03 | 개발 타임라인 (4단계, 클릭 확장) | ✅ | |
| A-04 | CBS 심화 설명 (CT 분기 vs CBS-Lite) | ✅ | |
| A-05 | Priority A* + WHCA* 하이브리드 설명 | ✅ | |
| A-06 | 보조 기법 8종 카드 | ✅ | BinaryHeap, CommitmentSteps, WHCA*, 등 |
| A-07 | 데드락 에스컬레이션 L1~L4 타임라인 | ✅ | |
| A-08 | 페이지 이름: "길찾기 알고리즘 선택 과정" | ✅ | 세션 12 변경 |

---

## 4. 공정 페이지 (ProcessPage `/process`)

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| P-01 | 증착/노광/식각/세정 공정 애니메이션 (Canvas 2D 파티클) | ✅ | |
| P-02 | 페이지 이름: "나를 위한 반도체 공정 요약" | ✅ | 세션 12 변경, 마지막 탭 순서 |

---

## 5. 네비게이션 / 레이아웃

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| N-01 | TopBar 탭 순서: 맵 에디터 → 길찾기 알고리즘 선택 과정 → 나를 위한 반도체 공정 요약 | ✅ | 세션 12 |
| N-02 | Undo/Redo 버튼 (에디터 전용) | ✅ | |
| N-03 | XML 내보내기 버튼 (에디터 전용) | ✅ | |

---

## 6. 알고리즘 통합 (TS ↔ C#)

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| I-01 | TypeScript 알고리즘 (웹 데모용) | ✅ | `src/core/pathfinding/algorithms.ts` |
| I-02 | Unity C# 알고리즘 (7종: Standard A* / Dijkstra / Greedy BFS / Stochastic A* / CBS Full / Priority A* / CBS-Lite(WHCA*)) | ✅ | Assets/Scripts/Core/Pathfinding/ |
| I-03 | TS ↔ C# 직접 코드 통합 | ❌ | 브라우저/Unity 런타임 환경 차이로 불가. 문서화로 알고리즘적 동일성 보장 |
| I-04 | 알고리즘 대응 문서 (`AlgorithmMapping.md`) | ⏳ | 작성 예정 |

---

## 7. Unity 작업 (HandoffToUnity.md / Visualization3D_Setup.md 참조)

| # | 기능 | 상태 | 비고 |
|---|------|------|------|
| U-01 | ThirdPersonCameraRig (3인칭 시점) + 미니맵 카메라 | ✅ | `Visualization3D/Camera/`, `Visualization3D/Minimap/` |
| U-02 | SimOverlayUI (통계 대시보드) | ✅ | `UI/SimOverlayUI.cs` |
| U-03 | CameraModeController + MinimapRenderer (3인칭 ↔ 풀스크린 토뷰 전환) | ✅ | 미니맵 클릭 또는 ESC |
| U-04 | 런타임 컨트롤 (로봇 수·속도 슬라이더) | ✅ | `RuntimeControlsUI.cs` — 건설 모드 대신 동적 시뮬 제어 |
| U-05 | 맵 파일 선택 UI (플레이 모드 진입 시) | ✅ | `UI/MapSelectorUI.cs` — StreamingAssets/Maps 스캔 |
| U-06 | 선택된 맵 3D 렌더링 (Map3DBuilder + FactoryEnvironmentBuilder) | ✅ | 노드 프리팹·긴 레일·공장 환경 자동 생성 |
| U-07 | 시뮬레이션 시작 — AutoStartOnMapReady 자동 시작 (또는 StartSimButtonUI 수동) | ✅ | 둘 다 OnMapReady 구독, 양립 가능 |
| U-08 | 런타임 로봇 풀 + 속도 배율 | ✅ | `RobotFleetController` + `GameServices.SpeedMultiplier` |
| U-09 | 씬·프리팹 에디터 셋업 (SO 2종 + 노드 6종 + 로봇·레일 프리팹) | ⏳ | Unity AI 작업 — `Visualization3D_Setup.md` 참조 |

---

## 8. 미해결 / 향후 작업

| # | 항목 | 우선순위 | 비고 |
|---|------|----------|------|
| T-01 | AlgorithmMapping.md 작성 (TS ↔ C# 알고리즘 대응) | 중 | |
| T-02 | simRunStore SOLID 분리 (SpawnManager, CollisionResolver, CongestionTracker) | 낮 | 현재 단일 파일 과다 책임 |
| T-03 | SimOverlay DIP 해소 (props 주입) | 낮 | |
| T-04 | mapStorage.ts SavedMap.data 타입 강화 (EditorNode/EditorEdge 직접 사용) | 낮 | 현재 `unknown[]` + `as any` |
