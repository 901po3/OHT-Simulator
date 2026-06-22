# OHT-System Visualization3D — Unity AI 셋업 가이드

> **목적**: 웹 시뮬레이터가 검증한 OHT 시뮬레이션을 Unity 3D 환경(방대한 로우폴리 공장)으로 시각화한다.
> **대상**: Unity AI (씬 셋업·프리팹 제작·머티리얼 작업 담당)
> **선행 문서**: [`HandoffToUnity.md`](./HandoffToUnity.md) — XML 포맷·기존 2D 빌더 설명

---

## 🎯 작업 범위 (Unity AI가 할 일)

신규 `OHTSim.Visualization3D` 코드는 **모두 작성됨**. Unity AI는 다음 에디터 작업만 수행하면 된다:

| # | 작업 | 결과물 | 비고 |
|---|------|--------|------|
| 1 | ScriptableObject 2종 생성 | `VisualizationConfig.asset`, `NodePrefabRegistry.asset` | Assets/Resources/OHT/ |
| 2 | 로우폴리 노드 프리팹 6종 제작 | Normal/Deposition/Exposure/Etching/Cleaning/Depot | Assets/Prefabs/Nodes/ |
| 3 | 레일 세그먼트 프리팹 | RailSegment.prefab (Cube + 머티리얼) | Assets/Prefabs/ |
| 4 | 로봇 프리팹 | Robot.prefab (로우폴리 OHT) | Assets/Prefabs/ |
| 5 | Visualization3D 씬 구성 | Sim3D.unity | Assets/Scenes/ |
| 6 | UI Canvas (런타임 컨트롤 + 미니맵) | 씬 내 UI 트리 | — |

---

## 📦 1. ScriptableObject 생성

> **사전 작업**: 다음 폴더들이 없으면 Project 창에서 미리 생성하세요.
> - `Assets/Resources/OHT/`
> - `Assets/Prefabs/Nodes/`
> - `Assets/StreamingAssets/Maps/` (웹에서 내보낸 XML 보관용)

### 1-A. VisualizationConfig
1. Project 창 > 우클릭 > `Create > OHT > Visualization Config`
2. 파일명: `VisualizationConfig.asset`
3. 위치: `Assets/Resources/OHT/`
4. 권장 초기값 (인스펙터):
   ```
   Map Scale: 0.05
   Node Separation Multiplier: 2.5       ← 레일을 길게 보이게 함
   Robot Base Speed: 2.0
   Robot Rotation Speed: 540
   Robot Hover Height: 1.2
   Initial Robot Count: 12
   Initial Speed Multiplier: 1.0
   Max Robot Count: 100
   Camera Initial Height: 6
   Camera Initial Distance: 10
   Minimap Size: (220, 220)
   Minimap Margin: (20, 20)
   Top View Min/Max Ortho: 5 / 80
   ```

### 1-B. NodePrefabRegistry
1. `Create > OHT > Node Prefab Registry`
2. 파일명: `NodePrefabRegistry.asset`
3. Entries 리스트에 6개 추가 (NodeType 별)
4. 각 Entry에 2-단계에서 만든 프리팹 드래그
5. Fallback Prefab: Normal 노드와 동일하게 설정
6. Rail Segment Prefab: 3-단계의 RailSegment 프리팹

---

## 🎨 2. 로우폴리 노드 프리팹 6종

> **컨셉**: 방대한 반도체 공장 — 사람 키에서 올려다보는 거대한 구조물. 로우폴리지만 위압감.

### 권장 사양

| NodeType    | 형태 | 크기 (X,Y,Z) | 색상 (HEX) | 부가 |
|-------------|------|--------------|------------|------|
| Normal      | 낮은 플랫폼 (8각 기둥) | 2 × 0.5 × 2 | `#58a6ff` | 발광 림 |
| Deposition  | 큰 챔버 + 가스 파이프 | 3 × 4 × 3 | `#bc8cff` | 상단 LED |
| Exposure    | 광학 타워 | 3 × 5 × 3 | `#ffa657` | 노란 글로우 |
| Etching     | 산성 챔버 (붉은 패널) | 3 × 4 × 3 | `#f85149` | 경고등 |
| Cleaning    | 투명/유리 챔버 | 3 × 3.5 × 3 | `#3fb950` | 청록 파티클 |
| Depot       | 차고 (대형 격납고) | 5 × 3 × 5 | `#8b949e` | 입구 라이트 |

### 제작 규칙
- **모든 프리팹의 피벗은 바닥 중앙** (transform.position이 바닥에 닿도록)
- 각 프리팹 루트에 `NodeView` 컴포넌트 부착 (자동 등록되지만 명시적 부착이 안전)
- URP/Lit 머티리얼 사용, `_EmissionColor` 활성화로 어두운 공장에서도 식별
- 자식 GameObject로 라벨용 빈 자리 (TextMeshPro Optional) 가능

---

## 🛤 3. 레일 세그먼트 프리팹

1. Hierarchy에 Cube 생성
2. Scale: `(1, 1, 1)` (스크립트가 런타임에 늘림)
3. 머티리얼: 어두운 메탈 + 약한 emission (`#1f2a3a` + emission `#3b6ea8 × 0.2`)
4. `RailSegment` 컴포넌트 추가
5. 프리팹화: `Assets/Prefabs/RailSegment.prefab`

---

## 🤖 4. 로봇 프리팹

> **컨셉**: 천장 OHT — 가로로 긴 슬림한 운반체. 큐브 + 작은 그리퍼.

1. Empty GameObject > `Robot`
2. 자식: Cube (몸체, Scale `0.8 × 0.4 × 0.5`), Cube × 2 (그리퍼, 아래로 향함)
3. 머티리얼: 흰색 + 청색 띠 (`#e6edf3` + 액센트 `#58a6ff`)
4. `RobotAgent3D` 컴포넌트 추가
5. (선택) 작은 점등 라이트 (Point Light, Intensity 1, Range 3)
6. 프리팹화: `Assets/Prefabs/Robot.prefab`

---

## 🎬 5. 씬 구성 (Sim3D.unity)

### 5-A. Hierarchy 구조
```
─ Bootstrapper                   (SceneBootstrapper + AutoStartOnMapReady)
─ Map Loader Service             (MapLoaderService + MapBuilder [기존 2D])
─ Map 3D Builder                 (Map3DBuilder)
─ Factory Environment Builder    (FactoryEnvironmentBuilder ← 신규: 바닥·벽·천장·조명 자동 생성)
─ Simulation Controller          (SimulationController + AgentController [기존])
─ Robot Fleet Controller         (RobotFleetController)
─ Camera Mode Controller         (CameraModeController)
─ Main Camera                    (ThirdPersonCameraRig + Camera + AudioListener)
─ Minimap Camera                 (MinimapCamera + Camera, 화면에 표시 안 됨)
─ Directional Light              (해 — 5°×30° 회전, intensity 1.2)
─ UI Canvas                      (Screen Space - Overlay)
   ├─ MapSelectorPanel           (기존 MapSelectorUI)
   ├─ SimOverlay                 (기존 SimOverlayUI) — 선택
   ├─ RuntimeControls            (RuntimeControlsUI — 좌하단)
   │   ├─ RobotCountSlider + Label
   │   └─ SpeedSlider + Label
   └─ MinimapRoot                (RawImage + MinimapRenderer — 우상단)
       ├─ MinimapImage           (RawImage)
       └─ MinimapHUD             (MinimapHUD — 로봇 수/속도 표시)
           ├─ RobotCountLabel
           ├─ SpeedLabel
           └─ ModeLabel

* `StartSimButtonUI`는 코드상 여전히 존재하며 AutoStartOnMapReady와 양립 가능
  (둘 다 OnMapReady 구독). 자동 시작 흐름에서는 버튼 GameObject를 씬에 배치하지 않거나
  비활성화하여 사용하지 않는다.
```

### 5-B. Bootstrapper 인스펙터 필드 주입
- Config: `VisualizationConfig.asset`
- Prefab Registry: `NodePrefabRegistry.asset`
- Map Builder: Hierarchy의 Map 3D Builder
- Fleet Controller: 동
- Map Loader: 동
- Sim Controller: 동
- Third Person Camera: Main Camera
- Minimap Camera: Minimap Camera
- Minimap Renderer: MinimapRoot
- Camera Mode Controller: Camera Mode Controller
- Minimap HUD: MinimapHUD
- Runtime Controls UI: RuntimeControls

### 5-C. RobotFleetController 인스펙터
- Robot Prefab: `Assets/Prefabs/Robot.prefab`
- Map Loader: 동일 씬의 MapLoaderService

### 5-D. Map 3D Builder 인스펙터
- Prefab Registry: `NodePrefabRegistry.asset`
- Config: `VisualizationConfig.asset`

---

## ▶ 6. 동작 흐름 (자동 시작 모드)

```
[Play] → MapSelectorUI: StreamingAssets/Maps/*.xml 목록 표시
       → 사용자가 맵 1개 선택
       → MapLoaderService.LoadMap() — XML 파싱 + 인접 리스트 구축
       → SimulationController.OnMapReady 발행
           ├─ SceneBootstrapper.BridgeMapReady → Map3DBuilder.Build()
           │       → 노드 프리팹 6종 + 긴 레일 세그먼트 생성
           │       → WorldBounds 산출
           │       → SimEvents.MapBuilt 발행
           │           ├─ FactoryEnvironmentBuilder.Rebuild() — 바닥·벽·천장·조명 자동
           │           ├─ ThirdPersonCameraRig.CenterOnMap() — 공장 중앙, 사람 시점
           │           └─ MinimapCamera.HandleMapBuilt() — 전경 ortho 자동 조정
           └─ AutoStartOnMapReady — 0.1초 후 자동 StartSimulation()
       → SimulationController.OnSimulationStarted → SimEvents.RaiseSimulationStarted
       → RobotFleetController가 InitialRobotCount만큼 차고지에서 스폰
       → 사용자는 공장 중앙에서 로봇 작동을 둘러보는 상태
           - 우클릭 드래그: 시야 회전
           - 휠: 줌 (가까이/멀리)
           - WASD: 공장 내 이동
           - 좌하단 슬라이더: 로봇 수 0~100, 속도 0.1~5.0×
           - 우상단 미니맵 클릭: 풀스크린 2D 토뷰 (휠 줌 + 드래그 패닝, ESC 복귀)
```

---

## ✅ 검수 체크리스트

- [ ] Play 모드 진입 → 맵 선택 UI 표시
- [ ] 맵 선택 → 3D 노드/레일 생성, 카메라가 맵 중심에 자동 배치
- [ ] 시뮬레이션 시작 → 로봇 12대가 차고지에서 스폰
- [ ] 로봇이 레일을 따라 부드럽게 이동 (텔레포트 X)
- [ ] 로봇 수 슬라이더 → 0~100 조절, 줄여도 나머지 계속 동작
- [ ] 속도 슬라이더 → 0.1~5.0×, 즉시 반영
- [ ] 우상단 미니맵에 맵 전경 + 로봇 위치 표시
- [ ] 미니맵 클릭 → 풀스크린 토뷰 진입
- [ ] 토뷰에서 휠 줌, 좌클릭 드래그 패닝, WASD 키 이동
- [ ] ESC → 3인칭 시점 복귀
- [ ] 미니맵 HUD에 로봇 수 / 속도 / 모드 표시

---

## 🧯 Troubleshooting

| 증상 | 원인 | 해결 |
|------|------|------|
| `SceneBootstrapper] xxx 누락` 에러 | 인스펙터 필드 미주입 | Bootstrapper에서 누락 필드 채움 |
| 노드가 회색 큐브로만 표시 | NodePrefabRegistry Entries 비어있음 | 프리팹 6종 매핑 |
| 로봇이 안 보임 | Robot Prefab 미할당 → Primitive Capsule fallback 동작하나 작음 | Fleet Controller에 Robot.prefab 할당 |
| 미니맵이 검은색 | Minimap Camera가 RenderTexture 출력 안 함 | MinimapRenderer 인스펙터에 MinimapCamera 할당 확인 |
| 로봇이 같은 노드에서 멈춤 | 맵이 강결합 아님 (출구 엣지 없음) | 웹 에디터에서 양방향 엣지 또는 단방향 순환 구조로 수정 |

---

## 🔗 관련 코드

| 클래스 | 위치 | 역할 |
|--------|------|------|
| `SceneBootstrapper` | Visualization3D/Core | 서비스 등록·이벤트 브리지 |
| `GameServices` | Visualization3D/Core | Service Locator |
| `SimEvents` | Visualization3D/Core | 전역 이벤트 허브 |
| `VisualizationConfig` | Visualization3D/Configs | SO 설정 |
| `NodePrefabRegistry` | Visualization3D/Configs | 노드 프리팹 매핑 |
| `Map3DBuilder` | Visualization3D/World | 3D 맵 빌드 |
| `RailSegment` | Visualization3D/World | 긴 레일 메시 |
| `NodeView` | Visualization3D/World | 노드 메타데이터 |
| `RobotAgent3D` | Visualization3D/Robots | 상태머신 기반 로봇 |
| `RobotFleetController` | Visualization3D/Robots | 런타임 수/속도 관리 |
| `RobotPool` | Visualization3D/Robots | 오브젝트 풀 |
| `ThirdPersonCameraRig` | Visualization3D/Camera | 3인칭 카메라 |
| `CameraModeController` | Visualization3D/Camera | 모드 전환 |
| `MinimapCamera` | Visualization3D/Minimap | 직교 탑다운 카메라 |
| `MinimapRenderer` | Visualization3D/Minimap | 우상단 UI + 클릭 토글 |
| `MinimapHUD` | Visualization3D/Minimap | 로봇 수/속도 표시 |
| `RuntimeControlsUI` | Visualization3D/UI | 런타임 슬라이더 |
