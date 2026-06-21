# Skill 08 — Compare

> compare 작업 시 읽는다. 같이: `10-implementation-guardrails.md`, `12`(analytics, 있으면).

## 구현 위치
- 상태: `lib/compare-context.tsx` (`CompareProvider`, `useCompare`)
- 트레이: `components/layout/CompareTray.tsx`
- 비교 화면: `app/compare/page.tsx` + `components/compare/CompareView.tsx`
- 동기화: `components/compare/CompareContextSync.tsx`
- 진입점: 카드(`DestinationCard.tsx`)·preview(`DestinationPreviewPanel.tsx`)의 compare 버튼

## 불변식 (깨지 말 것)
- **max 3.** `toggleCompare`는 3 초과 시 추가 무시. 초과 시 버튼 disabled + 피드백.
- compare 상태는 localStorage(`wk_compare`)에 영속. hydration guard(`isHydrated`) 있음 — mount 복원 후에만 persist. 이 순서 유지(안 그러면 저장값 덮어씀).
- `replaceCompareList`는 dedupe + 3개 cap. 외부 입력(URL 등) 받을 때 사용.
- compare 버튼 클릭이 카드 선택(preview open)을 **트리거하면 안 됨** → 카드 내부는 `e.stopPropagation()` 유지.
- added state는 카드·preview·트레이 **세 곳 모두**에 반영.

## 비교 화면 필드 (data-policy / editorial 근거)
one-line vibe · recommended_stay · live_weather_snapshot · card_budget_level · from Seoul(`travel_time.from_seoul`) · no_car_friendliness · crowd_friction · best_for · skip_if · food. 전부 `Destination` 타입에 존재 → 새 필드 불필요.

## 분석 이벤트
`compare_added`(카드/preview에서 이미 발화) · `compare_view_opened`(measurement-plan.md). 누락 시 추가.

## 하지 말 것
- compare를 새 전역 상태로 중복 구현 (`useCompare`만 사용).
- max를 3 외 값으로 변경 (제품 규칙).
