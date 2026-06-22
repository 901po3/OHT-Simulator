---
name: oht-unity3d
description: OHT-System Unity 3D Visualization 레이어 작업 가이드. Use when the user works on Unity 3D scene setup, prefab authoring, ScriptableObject configuration, runtime robot/speed controls, third-person camera, minimap, or any Visualization3D namespace code under "Assets/Scripts/Visualization3D/".
---

# OHT Unity 3D Visualization Skill

이 스킬은 OHT-System의 **Visualization3D 레이어** 작업 시 활성화한다.
웹 시뮬레이터 코드(React/TS)나 기존 OHTSim.Core/Simulation/UI 레이어 작업에는 사용하지 않는다.

## 작업 범위

| 영역 | 위치 | 비고 |
|------|------|------|
| 3D 코드 | `Assets/Scripts/Visualization3D/` | OHTSim.Visualization3D 네임스페이스 |
| 셋업 문서 | `docs/unity/Visualization3D_Setup.md` | 씬·프리팹·SO 작업 |
| 핸드오프 | `docs/unity/HandoffToUnity.md` | XML 포맷 (불변) |
| ScriptableObjects | `Assets/Resources/OHT3D/` | VisualizationConfig, NodePrefabRegistry |

## 아키텍처 핵심 원칙

1. **Service Locator (`GameServices`)**: 시스템 간 직접 참조 금지 — 등록·조회만
2. **이벤트 허브 (`SimEvents`)**: cross-system 통신은 모두 static 이벤트
3. **ScriptableObject Config**: 매직 넘버 금지 — `VisualizationConfig`에 모은다
4. **Prefab Registry**: 노드 타입 추가 = enum + entry 추가, 코드 수정 없음
5. **Object Pool (`RobotPool`)**: 런타임 add/remove는 풀에서 활성화/비활성화로
6. **상태머신 (`RobotAgent3D`)**: 코루틴 X, Update 기반 — 풀링 친화적

## 자주 하는 작업

### 새 노드 타입 추가
1. `OHTSim.Core.NodeType` enum에 추가
2. `NodePrefabRegistry.asset` Entries에 신규 entry + 프리팹 매핑
3. (선택) `RobotAgent3D.PROCESS_CYCLE`에 포함시킬지 결정
4. `MapXmlParser` / 웹 측 NodeType과도 동기화

### 런타임 컨트롤 새 슬라이더 추가
1. UI에 Slider 추가
2. `RuntimeControlsUI`에 필드 + `onValueChanged` 핸들러 추가
3. 값이 다른 시스템에 공유돼야 한다면 → `GameServices`에 프로퍼티 추가 + `SimEvents`에 이벤트 추가
4. 직접 호출은 금지

### 새 카메라 모드 추가
1. `SimEvents.CameraMode` enum에 추가
2. `CameraModeController.SetMode`에 분기 추가
3. 각 카메라 컴포넌트가 `SimEvents.CameraModeChanged` 구독하여 enabled 토글
4. UI 진입 트리거 (버튼/단축키) 추가

## 검수 (작업 후 반드시 확인)

- [ ] Play 모드에서 컴파일 에러 없이 부팅
- [ ] `[SceneBootstrapper] xxx 누락` 경고 0건
- [ ] 로봇 수 슬라이더 0 → max → 0 왕복 정상
- [ ] 속도 슬라이더 0.1 → 5.0 즉시 반영
- [ ] 미니맵 클릭 → 풀스크린 → ESC 복귀 정상
- [ ] HMR 없이 씬 재진입 후에도 동일 동작
- [ ] GameObject 누수 없음 (Hierarchy에 남는 임시 객체 X)

## 안티 패턴 (하지 말 것)

- **싱글톤 새로 만들기** — `GameServices` 사용
- **MonoBehaviour 간 직접 참조 추가** — `SimEvents` 사용
- **`Find` / `FindObjectOfType` 호출** — Bootstrapper에서 주입
- **하드코딩된 숫자 사용** — `VisualizationConfig`로 이전
- **로봇 Instantiate/Destroy 직접 호출** — `RobotPool` 경유
- **기존 `OHTSim.Core` / `Simulation` 네임스페이스 수정** — 신규는 모두 `Visualization3D`에

## 디버깅 팁

- 로봇이 한 자리에서 안 움직이면 → `RobotAgent3D.CurrentState` Inspector 확인
- 미니맵이 검은색이면 → `MinimapCamera.Cam.targetTexture` 가 `MinimapRenderer.SharedRenderTexture`인지
- 노드 위치가 너무 가까우면 → `VisualizationConfig.nodeSeparationMultiplier` ↑
- 카메라가 너무 멀면 → `ThirdPersonCameraRig.CenterOnMap()`이 `WorldBounds` 잘 계산했는지

## 알고리즘 명명 매핑 (혼동 방지)

문서/코드 위치마다 표기가 달라 혼란을 줄 수 있다. 매핑을 명시한다:

| 개념 | 웹 TS (`algorithms.ts`) | Unity C# (`PathfindingBridge.cs`) | 문서/UI 표기 |
|------|------------------------|----------------------------------|--------------|
| Standard A* | `'astar'` | `AlgorithmId.Standard` | "Standard A*" |
| Dijkstra | `'dijkstra'` | `AlgorithmId.Dijkstra` | "Dijkstra" |
| Greedy BFS | `'greedy'` | `AlgorithmId.Greedy` | "Greedy BFS" |
| Stochastic A* | `'stochastic'` | `AlgorithmId.Stochastic` | "Stochastic A*" |
| Priority A* (혼잡 가중치) | `'priority'` | `AlgorithmId.Priority` | "Priority A*" — **기본 채택** |
| 예약 테이블 ×8 페널티 | `'cbs'` | `AlgorithmId.CbsLite` | "CBS-Lite" 또는 "WHCA*" — **동일 알고리즘** |

**중요**: `WHCA*`와 `CBS-Lite`는 이 프로젝트 내에서 **동일한 메커니즘**(시공간 예약 테이블 + ×8 페널티)을
가리키는 두 이름이다. PathfindingBridge에는 `CbsLite` 메서드 단 하나만 존재.

## 관련 문서

- 셋업: `docs/unity/Visualization3D_Setup.md`
- 기존 핸드오프: `docs/unity/HandoffToUnity.md`
- 웹 측 XML 포맷: `src/core/export/xmlSerializer.ts`
- 알고리즘 포팅 원본: `src/core/sim/algorithms.ts` → `PathfindingBridge.cs`
