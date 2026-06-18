# Unity AI 작업 요청서 (RequestToUnity.md)

> 이 파일은 UnityAI(Unity Editor AI)가 수행해야 할 씬 구성 및 에셋 작업을 정의한다.
> 코드는 이미 완성되어 있으므로, 아래 항목만 처리하면 된다.

---

## 1. 씬 생성

- **파일명**: `Assets/Scenes/OHTSimulator.unity`
- 기존 `SampleScene`은 유지하고 새 씬을 별도 생성

---

## 2. 씬 기본 설정

```
Camera
  - Position: (7.5, 18, 4.5)    // 맵 중앙 상단에서 내려다보는 시점
  - Rotation: (60, 0, 0)
  - Projection: Orthographic (Size: 12) 또는 Perspective FOV 45

Directional Light
  - Rotation: (45, -45, 0)
  - Intensity: 1.2

환경
  - Skybox: 기본 URP Skybox 또는 단색 배경(어두운 네이비 #0D1B2A)
```

---

## 3. SimulationManager GameObject 생성

```
GameObject 이름: SimulationManager
Component 추가: SimulationController (스크립트 경로: Assets/Scripts/Simulation/SimulationController.cs)

Inspector 설정:
  - OHT Count: 8
  - OHT Speed: 2
  - Job Spawn Interval: 2
  - Oht View Prefab: [4번에서 만들 OHTPrefab 연결]
  - Rail Renderer Prefab: [5번에서 만들 RailRendererPrefab 연결]
```

---

## 4. OHT Prefab 생성

```
경로: Assets/Prefabs/OHTPrefab.prefab

GameObject 구성:
  Root
  ├── Component: OHTView (Assets/Scripts/Visualization/OHTView.cs)
  ├── Component: Renderer (MeshRenderer)
  ├── 자식 GameObject "Body"
  │     Mesh: Cube
  │     Scale: (0.4, 0.2, 0.6)     // 작고 납작한 OHT 차체
  │     Material: OHTMaterial (URP/Lit, Albedo=#00FF88)
  └── 자식 GameObject "Hoist"
        Mesh: Cylinder
        Scale: (0.05, 0.15, 0.05)
        Position: (0, -0.2, 0)      // 차체 아래 호이스트 팔

OHTView Inspector:
  - Color Idle: gray
  - Color Moving: #00FF88 (밝은 녹색)
  - Color Waiting: #FF4444 (빨강)
  - Color Loading Or Unloading: #FFCC00 (노랑)
```

---

## 5. RailRenderer Prefab 생성

```
경로: Assets/Prefabs/RailRendererPrefab.prefab

GameObject 구성:
  Root
  ├── Component: RailRenderer (Assets/Scripts/Visualization/RailRenderer.cs)

RailRenderer Inspector:
  - Rail Material: [새 URP/Unlit Material, 색상 #3399FF, 이름 RailMaterial]
  - Line Width: 0.08
  - Normal Color: #3399FF
  - Intersect Color: #FF8800
```

---

## 6. UI Canvas (StatsPanel)

```
GameObject: Canvas
  - Render Mode: Screen Space - Overlay
  - UI Scale Mode: Scale With Screen Size (Reference: 1920×1080)

Canvas 자식 — Panel "StatsPanel"
  Background: 반투명 검정 (#000000, Alpha 0.6)
  Position: 앵커 우측 상단, Pivot (1, 1), Pos (-10, -10)
  Size: (240, 200)

  자식 Text 오브젝트 (각각 UnityEngine.UI.Text 또는 TMP_Text):
    - "TextCompleted"    → StatsPanel.textCompleted
    - "TextThroughput"   → StatsPanel.textThroughput
    - "TextMoving"       → StatsPanel.textMoving
    - "TextWaiting"      → StatsPanel.textWaiting
    - "TextIdle"         → StatsPanel.textIdle
    - "TextTime"         → StatsPanel.textTime

  StatsPanel Component (Assets/Scripts/Visualization/StatsPanel.cs):
    - Simulation: [SimulationManager 오브젝트 연결]
    - 각 Text 필드: 위에서 만든 Text 오브젝트 연결
```

---

## 7. 레이어 및 Physics

```
Physics 설정 (Edit > Project Settings > Physics):
  - Auto Simulation: OFF  // 코드가 직접 Tick() 관리

Layer 추가 (Edit > Project Settings > Tags and Layers):
  - "OHT"   → OHT Prefab에 적용
  - "Rail"  → RailRenderer가 생성하는 오브젝트에 적용
```

---

## 8. 카메라 컨트롤 (선택, 여유 있으면)

```
Main Camera에 간단한 스크립트 추가:
  - 마우스 휠: Orthographic Size 조절 (줌 인/아웃)
  - 마우스 우클릭 드래그: 카메라 팬
  스크립트명: CameraController.cs (Assets/Scripts/Visualization/에 생성)
```

---

## 9. 완료 체크리스트

- [ ] OHTSimulator 씬 생성 및 저장
- [ ] SimulationManager 오브젝트 + SimulationController 연결
- [ ] OHTPrefab 생성 및 SimulationController에 연결
- [ ] RailRendererPrefab 생성 및 SimulationController에 연결
- [ ] UI Canvas + StatsPanel 구성
- [ ] Play 버튼 눌렀을 때 레일과 OHT가 씬에 자동 생성되는지 확인
- [ ] OHT가 이동하며 색상이 상태에 따라 바뀌는지 확인
- [ ] StatsPanel에 숫자가 올라가는지 확인
