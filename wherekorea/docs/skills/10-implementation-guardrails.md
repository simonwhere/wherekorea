# Skill 10 — Implementation Guardrails (always-on)

> 거의 모든 코드 작업에서 먼저 읽는다. 다른 skill보다 우선한다.
> master-detail / preview panel / mobile 불변식을 여기에 통합한다 (별도 04/05/09 파일 없음).

## 0. 원칙
- **Smallest coherent change.** 요청된 작업만 끝낸다. 무관한 리팩토링·리네이밍·재디자인 금지.
- 기존 컴포넌트·데이터·상태를 재사용한다. 새 의존성은 정말 필요할 때만.
- selected destination의 single source of truth는 **URL query (`?destination=slug`)** 다. 별도 state로 중복 보관 금지.
- 정적/seed 데이터 우선. live 연동은 명시적으로 요구될 때만.

## 1. master-detail 불변식 (이미 구현됨 — 깨지 말 것)
구현 위치: `components/homepage/HomepageClient.tsx`, `components/homepage/DestinationPreviewPanel.tsx`

- 홈 탐색 중 카드 클릭은 **full-page 전환을 강제하지 않는다.** preview를 연다.
- Desktop(≥1100px): 우측 고정 패널. Mobile(<1100px): bottom sheet + 오버레이.
- 선택은 `router.replace('?destination=...', { scroll: false })` 로만 바꾼다. scroll 보존 필수.
- 닫기 경로 3개 유지: Esc 키 / close 버튼 / (모바일) 오버레이 탭.
- 카테고리 변경 시 선택 해제(`clearSelected`).
- preview의 "Open full page →"는 `/destination/[slug]` 로 가는 별도 경로. dedicated detail page는 SEO/공유용으로 유지.

## 2. 상태 보존 규칙
다음 동작에서 search / refine filter / category / compare / scroll 상태가 **유지**돼야 한다:
- 카드 클릭 · preview 열기/닫기
- compare 추가/제거
- 모바일 sheet 열기/닫기

## 3. compare 충돌 방지
- 카드/패널의 compare 버튼은 카드 선택과 분리. 카드 내 compare 클릭은 `e.stopPropagation()` 유지(`DestinationCard.tsx`).
- compare max는 **3**. 초과 시 버튼 disabled + 시각적 피드백.

## 4. 데이터/타입 규칙
- 통제 어휘는 `data/types.ts` 의 enum과 **정확히** 일치해야 한다 (`RecommendedStay`, `NoCar`, `CrowdFriction`, `BudgetLevel`, `VibeTag`). data-policy.md가 근거.
- preview/card가 쓰는 필드는 전부 `Destination` 타입에 이미 존재. 새 필드 추가 시 `data/destinations.ts` 10개 전부 동기화.

## 5. SSR / hydration
- 렌더 초기값에서 `window.innerWidth` 직접 읽기 지양 → hydration mismatch 위험. 가능하면 CSS media query.
- client 전용 훅(`useSearchParams`, `useRouter`, `window`)은 `'use client'` 컴포넌트에서만.

## 6. 범위 밖 (추가 금지, 명시 요청 없으면)
booking · accounts · itinerary builder · 대규모 map 시스템 · restaurant directory · community/UGC.

## 7. 작업 완료 보고 항목 (AGENTS.md)
변경 요약 / 가정 / 미정의 항목 / 다음 최소 단계 + browsing context·filter·compare·analytics 영향 여부.
