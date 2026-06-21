# Skill 06 — Filter & Search

> 필터/검색 작업 시 읽는다. 같이: `10-implementation-guardrails.md`, `11-design-qa.md`.

## 현재 상태 (중요 — 정리 먼저)
홈에는 두 종류의 좁히기 UI가 공존하고, intent 필터는 **연결돼 있지 않다.**

- `components/homepage/CategoryRail.tsx` — 상단 9개 카테고리(Best now / Weekend / Near Seoul / Food / Nature / Beach / Mountains / Culture / Low crowd). `data/destinations-meta.ts`의 `matchesCategory`로 매칭. **사용 중.**
- `components/homepage/RefineBar.tsx` — stay 3개 + No-car friendly만. **사용 중.**
- `components/homepage/FilterStrip.tsx` — user-intent 필터(Beach & Coast, Culture & History, Couples, Solo, Weekend…) 그룹/라벨/active/모바일 가로스크롤까지 완성. **HomepageClient가 import 안 함 = 미사용.**
- `lib/filters.ts` (`filterDestinations`, `matchesTag`) — **사용처 없음(dead code).**

## 결정 (작업 전 반드시 택1)
- **옵션 A (추천):** `FilterStrip`을 `HomepageClient`에 연결, `RefineBar` 제거. intent 필터 노출 → data-policy/§7 방향에 맞음. 연결 시 FilterStrip의 `FilterTag` 로직과 HomepageClient의 `filterByRefine`/category 필터 통합 필요.
- **옵션 B:** 현행 CategoryRail+RefineBar 유지, `FilterStrip.tsx` + `lib/filters.ts` 삭제.

→ 어느 쪽이든 **dead code 한쪽은 반드시 제거.** 두 필터 시스템 동시 유지 금지.

## 필터 원칙
- 필터는 DB taxonomy가 아니라 **user intent**를 표현한다. 표시 라벨은 traveler-facing("Beach & Coast"), 내부 값은 `FilterTag` enum 유지(`FilterStrip.tsx`의 `DISPLAY_LABELS` 패턴이 좋은 예).
- tag처럼 보이지 말고 **clickable control**처럼: default / hover / active / disabled / clear-all 상태 필요.
- active state는 분명하게. mobile은 가로 스크롤(스크롤바 숨김), desktop은 그룹 라벨 + wrap.

## 상태 보존
필터 상태는 카드 클릭·preview 열기/닫기·compare·모바일 sheet 동작에서 유지 (skill 10 §2).

## 분석 이벤트
필터 변경 시 `filter_used` 발화 (measurement-plan.md). 현재 미계측이면 추가 고려.

## 하지 말 것
- vibe 필터를 위해 새 데이터 필드 추가 (이미 `Destination.tags: VibeTag[]` 존재).
- 필터 로직을 여러 곳에 중복 정의 (single source 유지).
