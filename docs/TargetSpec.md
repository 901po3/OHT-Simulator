# OHT Simulator — Target Specification

> 조사 출처: SK하이닉스 Newsroom, MDPI Electronics 2024, ResearchGate AMHS 논문군, Muratec CFA 제품군
> 작성일: 2026-06-18

---

## 1. 실제 AMHS/OHT 시스템 조사 요약

### 1.1 OHT 물리 스펙 (실제 팹 기준)
| 항목 | 실제 값 | 시뮬레이터 적용 값 |
|------|---------|------------------|
| 주행 속도 | 1~4 m/s (최고 6 m/s) | 2 m/s (기본), 파라미터 조정 가능 |
| 가속도 | 0.5~1.0 m/s² | 0.8 m/s² |
| 운반 화물 | FOUP (Front Opening Unified Pod, 300mm 웨이퍼 25장) | FOUP 아이콘으로 표현 |
| 차량 수 | 팹당 수백~수천 대 | 시뮬레이터 초기 5~30대 |
| 레일 구조 | 단방향/양방향 루프, 교차로(분기점/합류점) | 격자형 + 루프 혼합 |
| 가용률 | 99.999% | 고장 이벤트 미구현 (v1 범위 외) |
| 통신 방식 | 중앙 컨트롤러 ↔ OHT 무선 양방향 | 중앙 디스패처 ↔ OHT Agent |

### 1.2 제어 시스템 구조
- **중앙 컨트롤러 (OHT Controller)**: 모든 OHT 위치/상태 수신, 작업 배정
- **경로 탐색**: Dijkstra 기반 최단경로 → 혼잡 시 동적 재라우팅
- **교차로 관리**: Reservation-based 예약 시스템 (선진입 우선 + 우선순위)
- **교착 회피**: Deadlock detection + rerouting (실제 팹에서는 RL 기반도 사용)

### 1.3 핵심 병목 문제
- **합류점(Merge)**: 여러 경로가 하나로 합쳐질 때 대기열 급증
- **교차점(Intersection)**: 직진/좌회전/우회전 경합, 데드락 발생 가능
- **핫스팟**: 특정 공정장비 앞 loadport 앞 집중

---

## 2. 시뮬레이터 목표 스펙 (현실적 2일 범위)

### 2.1 범위 정의
**In Scope (v1.0 — 2일 내 목표)**
- [x] 격자 기반 레일 맵 (노드/엣지 그래프)
- [x] OHT Agent — 상태 머신 (Idle / Moving / Loading / Unloading / WaitingAtIntersection)
- [x] A* 경로 탐색 (정적 가중치 기반)
- [x] 교차로 예약 시스템 (Reservation-based 충돌 방지)
- [x] 다수 OHT 동시 시뮬레이션 (5~20대)
- [x] 작업 디스패처 (랜덤 Transport Job 생성 → OHT 배정)
- [x] 시각화: OHT 이동, 교차로 점유 상태, 대기 큐 표시
- [x] 통계 패널: 처리량(Throughput), 평균 대기시간, 교차로 혼잡도

**Out of Scope (v2 이후)**
- [ ] RL 기반 동적 경로 최적화
- [ ] 실제 FAB 맵 import
- [ ] FOUP 물리 시뮬레이션
- [ ] 장비 loadport 연동
- [ ] 고장/유지보수 이벤트

### 2.2 맵 구조
```
레일 노드: 격자 교차점 (예: 10×10 = 100 노드)
레일 엣지: 노드 간 단방향 연결 (실제 OHT 레일은 단방향)
특수 노드:
  - Source: FOUP 픽업 지점 (공정장비 출구)
  - Destination: FOUP 전달 지점 (공정장비 입구)
  - Intersection: 교차로 (예약 필요)
  - Bypass: 대기 루프 (혼잡 회피)
```

### 2.3 OHT Actor 상태
```
Idle           → 작업 대기 중, 빈 레일에서 대기
Moving         → 경로를 따라 이동 중
WaitingAtIntersection → 교차로 예약 대기 중
Loading        → Source 노드에서 FOUP 픽업 중
Unloading      → Destination 노드에서 FOUP 전달 중
```

### 2.4 성능 목표
| 지표 | 목표 |
|------|------|
| OHT 20대 동시 시뮬레이션 | 60 FPS 유지 |
| 교차로 데드락 | 발생 시 자동 감지 + 해소 |
| 경로 탐색 시간 | 100노드 기준 < 1ms |

---

## 3. 2일 작업 타임라인

### Day 1 (오늘)
- [x] Git 연결, 문서 초기화
- [ ] 코드 컨벤션 확정
- [ ] 레일 그래프 자료구조 (RailGraph, RailNode, RailEdge)
- [ ] A* 경로탐색 (PathFinder)
- [ ] OHT Actor + 상태 머신 (OHTActor, OHTStateMachine)
- [ ] 교차로 예약 시스템 (IntersectionReservationManager)
- [ ] 작업 디스패처 (TransportJobDispatcher)

### Day 2 (내일)
- [ ] Unity 씬 배치 (UnityAI 활용)
- [ ] 시각화 (레일 렌더링, OHT 이동 애니메이션)
- [ ] 통계 UI 패널
- [ ] 시뮬레이션 파라미터 조정 UI (속도, OHT 수, 작업 생성 빈도)
- [ ] 최종 리뷰 + 버그 수정 + 커밋
