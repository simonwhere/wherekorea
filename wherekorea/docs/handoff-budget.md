# Claude Code 작업 지시문 — 예산(budget) 마무리

> VS Code의 Claude Code에 아래 블록을 그대로 붙여넣으세요.
> 정의는 이미 문서에 확정됨, DAILY_AVG도 갱신됨. 여기선 검증 + 신뢰 마무리만.

---

Read first:
- `docs/data-policy.md` → card_daily_total / card_budget_level / detail_budget
- `docs/budget-calibration.md` (per-destination 보정표)
- `docs/skills/10-implementation-guardrails.md`

## Context (이미 된 것)
- 예산 정의 확정: card ₩/day = mid traveler **all-in per person**, persona A (2명이 중급 1실 공유 → 숙박 ÷2). 바구니 = 숙박 + 식사(일반2+업리프트1+카페₩13k) + 현지교통 + 활동. 도시 간 교통·항공·쇼핑 제외.
- `data/destinations-meta.ts`의 `DAILY_AVG`는 이미 새 보정값으로 갱신됨 (tsc 통과 확인됨).

## Task (검증 + 신뢰 마무리, smallest change)
1. `DAILY_AVG` 값이 `budget-calibration.md` 표와 일치하는지 확인 (Seoul 145 / Busan 125 / Jeju 165 / Gyeongju 115 / Jeonju 110 / Gangneung 130 / Sokcho 120 / Tongyeong 110 / Namhae 105 / Jirisan 100, 단위 ₩k).
2. `npm run dev`로 홈 카드에서 새 ₩ 값이 정상 렌더되는지 눈으로 확인.
3. **신뢰 마무리 — detail page에 "포함 항목" 한 줄 추가.** `components/detail/BudgetBlock.tsx`(또는 budget 표시 위치)에 카드 ₩숫자가 "1인 기준, 2인 1실, 숙박·식사·현지교통·활동 포함 / 도시 간 교통·항공·쇼핑 제외"임을 짧게 명시. 숫자가 약속이 되려면 정의가 보여야 함.
4. **일관성 점검(보고만, 임의 수정 금지).** `data/destinations.ts`의 각 `detail_budget.mid`가 해당 도시 `DAILY_AVG`(card_daily_total)와 대략 맞는지 확인. 어긋나는 도시는 목록으로 보고. (예: card는 올인 1인, detail_budget는 정의가 다를 수 있음 → 차이 나면 알려줘)
5. `card_budget_level`($/$$/$$$) 티어가 새 ₩ 값 순서와 모순되지 않는지 확인.

## Constraints
- 데이터 값/카피만. 컴포넌트 구조·라우팅·compare·weather 로직 건드리지 말 것.
- 새 의존성 없음. 정의 문서와 다른 숫자를 임의로 만들지 말 것 — 불일치는 수정 대신 **보고**.

## Verify
- `npx tsc --noEmit`
- `npm run build` (EXIT_CODE=0 확인)

## Report
- DAILY_AVG 일치 여부
- detail 포함 항목 문구 추가한 위치
- detail_budget.mid vs card 불일치 도시 목록
- card_budget_level 점검 결과
- tsc / build 결과
- 다음 단계: 결정 C(types.ts에 source/confidence/last_verified) → 그다음 B(혼잡도)
