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

## 변경 이력

[History.log](./History.log) 참고.
