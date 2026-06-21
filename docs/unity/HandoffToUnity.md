# OHT 시뮬레이터 — Unity 3D 핸드오프 문서

> 기준 경로: `C:\Users\User\OneDrive\문서\react\OHT_System\Unity\3dSimulation`

---

## 프로젝트 구조

```
Assets/
  Scripts/
    Core/
      OHTMapData.cs        — 데이터 모델 (NodeType, MapNode, MapEdge, OHTMapData)
      MapXmlParser.cs      — XML → OHTMapData 파서
      MapBuilder.cs        — OHTMapData → 3D GameObject 생성
      MapLoaderService.cs  — StreamingAssets/Maps/ 로드 오케스트레이터
    Simulation/
      SimulationController.cs — 시뮬레이션 상태 기계 (WaitingForMap→Ready→Running)
    UI/
      MapSelectorUI.cs     — 플레이 모드 진입 시 맵 선택 전체화면 패널
      StartSimButtonUI.cs  — 상단 중앙 대형 시작/중지 버튼
  StreamingAssets/
    Maps/                  — 웹 에디터에서 내보낸 .xml 파일 저장 위치
```

---

## XML 포맷 (웹 에디터 출력)

웹 `xmlSerializer.ts`가 생성하는 포맷:

```xml
<OHTMap version="1.0">
  <Nodes>
    <Node id="n1" x="100" y="200" type="Deposition"/>
    <Node id="n2" x="300" y="200" type="Exposure"/>
  </Nodes>
  <Edges>
    <Edge id="e1" from="n1" to="n2" weight="1"/>
  </Edges>
</OHTMap>
```

NodeType 값: `Normal` | `Deposition` | `Exposure` | `Etching` | `Cleaning` | `Depot`

---

## [E] Unity 확장 기능

### E-1 MapSelectorUI — 맵 선택 다이얼로그

- **구현 파일**: `Assets/Scripts/UI/MapSelectorUI.cs`
- **동작**: 플레이 모드 Start() 시 전체화면 패널 표시
- **동작**: `StreamingAssets/Maps/` 내 `.xml` 파일 목록을 스크롤 리스트로 표시
- **동작**: 파일 선택 → `MapLoaderService.LoadMap()` → `SimulationController.OnMapLoaded()`
- **Unity 씬 설정**:
  - Canvas > Panel (panelRoot) > ScrollView > Content (fileListContent)
  - Button 프리팹 (buttonPrefab) — Text 자식 포함
  - Text (emptyLabel) — 파일 없을 때 안내
  - Inspector에서 loaderService, simController 연결

### E-2 3D 렌더링 — MapBuilder

- **구현 파일**: `Assets/Scripts/Core/MapBuilder.cs`
- **동작**: `Build(OHTMapData)` 호출 시 OHTMap 루트 오브젝트 아래에 노드·엣지 생성
- **노드**: Sphere Primitive (또는 커스텀 프리팹), 타입별 색상 (웹 에디터 NODE_META 기준)
- **엣지**: LineRenderer, 방향 표시 없음 (단순 연결선)
- **색상 매핑**:
  - Normal `#58a6ff` | Deposition `#bc8cff` | Exposure `#ffa657`
  - Etching `#f85149` | Cleaning `#3fb950` | Depot `#8b949e`
- **스케일**: 웹 px × 0.01 = Unity 단위 (Inspector에서 `mapScale` 조정 가능)

### E-3 시뮬레이션 시작 버튼 — StartSimButtonUI

- **구현 파일**: `Assets/Scripts/UI/StartSimButtonUI.cs`
- **위치**: Canvas 상단 중앙 고정 앵커 (Anchor Preset: Top-Center)
- **동작**:
  1. 맵 미선택 시 비활성 ("⏳ 맵 로딩 중...")
  2. 맵 로드 완료 → 활성화 ("▶ 시뮬레이션 시작")
  3. 클릭 → `SimulationController.StartSimulation()`, 레이블 "■ 시뮬레이션 중지"로 전환
  4. 재클릭 → `SimulationController.StopSimulation()`
- **Unity 씬 설정**: Canvas > Button (button) + Text (label), Inspector에서 simController 연결

---

## Unity 씬 조립 순서

1. **빈 씬** 생성 (또는 URP Sample Scene 초기화)
2. **빈 GameObject** `[Services]` 생성:
   - `MapLoaderService` 컴포넌트 부착 (MapBuilder 자동 Required)
   - `MapBuilder` Inspector에서 nodePrefab 연결 (없으면 Sphere 자동 생성)
3. **빈 GameObject** `[SimController]` 생성:
   - `SimulationController` 컴포넌트 부착
   - loaderService 필드에 `[Services]` 연결
4. **UI Canvas** (Screen Space - Overlay) 생성:
   - **MapSelectorUI 패널** — 전체화면 Panel, ScrollView, Button 프리팹, Text
   - **StartSimButton** — 상단 중앙 Button (폰트 크기 28+, 너비 320px)
5. MapSelectorUI Inspector: loaderService / simController 연결
6. StartSimButtonUI Inspector: simController 연결
7. **재생 버튼** → 맵 선택 패널 자동 표시

---

## 웹 → Unity 맵 파일 전달

1. 웹 에디터에서 맵 편집 후 **"XML 내보내기"** 클릭
2. 다운로드된 `.xml` 파일을 `Assets/StreamingAssets/Maps/` 에 복사
3. Unity 플레이 모드 진입 → MapSelectorUI에서 파일 선택

---

## 미구현 (다음 세션)

- `AgentController.cs` — 에이전트 3D 이동 (SimulationController.OnSimulationStarted 구독)
- `PathfindingBridge.cs` — 웹 BFS/CBS 알고리즘의 C# 포팅
- `SimOverlayUI.cs` — 진행 중 통계 (처리 완료 수, 처리량) HUD
