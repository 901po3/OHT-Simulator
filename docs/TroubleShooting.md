# Trouble Shooting Log — OHT Simulator

AI 작업 간 소통 문제, 구현 실수, 오해를 기록한다.

---

## [2026-06-18] 리뷰어 서브에이전트의 부당한 지적 (CONV-1, BUG-3)

**문제**: 리뷰어가 Arrow Puzzle 프로젝트의 UI 컨벤션(UI Toolkit 강제)을 OHT 프로젝트에 적용해 `StatsPanel.cs`의 UGUI 사용을 blocking으로 판정함
**분석**: OHT 프로젝트의 `CodeConventions.md`는 UI 프레임워크를 명시하지 않음. 다른 프로젝트 컨벤션 적용은 잘못된 기준
**결론**: 수정 불필요. 리뷰어에게 기준 문서를 명확히 지정해야 함
**예방**: 서브에이전트 리뷰 요청 시 "기준 문서는 이 프로젝트의 CodeConventions.md만 적용" 명시

## [2026-06-18] 리뷰어 미발견 버그 — Core 계층 UnityEngine 의존성 위반

**발견**: 1차 리뷰 후 수정 과정에서 자체 발견
**파일**: `WaitingAtIntersectionState.cs`
**문제**: `Debug.LogWarning` 추가를 위해 `using UnityEngine`을 Core 계층 파일에 추가 → `CodeConventions.md §4.1` 위반
**해결**: `using UnityEngine` 제거, `Debug.LogWarning`을 `SimulationController.ReportDeadlockIfNeeded()`로 이동 (Unity 계층에서 처리)
**교훈**: 서브에이전트 리뷰는 컨벤션 위반을 모두 잡지 못할 수 있음. 자체 검증 필수

---

## [2026-06-18] 교차로 예약 즉시 해제 버그 (BUG-1)

**발견**: 코드 리뷰어 서브에이전트
**파일**: `OHTActor.cs:ArriveAtNextNode()`
**문제**: 교차로 도착 즉시 `IntersectionManager.Release()` 호출 → OHT가 노드를 점유 중인데도 다른 OHT가 예약 가능 → 교차로 충돌 방지 무력화
**해결**: Release를 ArriveAtNextNode에서 제거, 대신 `ReleaseCurrentIntersectionIfHeld()`를 MovingState에서 "다음 노드로 출발 직전"에 호출하도록 변경
**교훈**: Reservation 기반 충돌 방지는 "진입 시 예약, 출발 시 해제" 원칙을 엄격히 지켜야 함

---

## [2026-06-18] MovingState HandleArrival 폴백 누락 (BUG-2)

**발견**: 코드 리뷰어 서브에이전트
**파일**: `MovingState.cs:HandleArrival()`
**문제**: 경로 소진 후 목적지 조건이 불충족할 때 상태 전환 없이 Moving 영구 고착
**해결**: else 분기 추가 — 경로 재탐색 후 Moving 유지, 작업 없으면 Idle 전환
**교훈**: 상태 머신의 모든 조건 분기는 반드시 폴백 경로가 있어야 함

---

## [2026-06-18] Git 초기 push 충돌

**문제**: GitHub 리포에 이미 커밋(README)이 존재해 push rejected
**원인**: `git push` 전 remote 상태 확인 누락
**해결**: `git pull --allow-unrelated-histories --no-rebase` 후 .gitignore merge conflict 수동 해소
**예방**: 이후 리포 생성 시 "Initialize with README" 체크 해제 후 로컬에서 push

---
