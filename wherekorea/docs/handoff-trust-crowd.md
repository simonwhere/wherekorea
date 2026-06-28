# Claude Code 작업 지시문 — B(혼잡도 모델) + C(신뢰 메타데이터)

> VS Code의 Claude Code에 아래 블록을 그대로 붙여넣으세요.
> 정의는 `data-policy.md`에 확정됨. 여기선 types.ts 확장 + 10개 도시 값 채우기 + 검증. UI 변경 없음.

---

Read first:
- `docs/data-policy.md` → crowd_friction (hybrid model) / Trust metadata
- `docs/skills/10-implementation-guardrails.md`

## Task — 데이터 구조 확장 (smallest coherent change, no UI)

### 1) `data/types.ts` 에 타입 추가
```ts
export type MetricSource = 'official' | 'estimate' | 'api' | 'seed'
export type Confidence = 'high' | 'medium' | 'low'

export interface MetricMeta {
  source: MetricSource
  confidence: Confidence
  last_verified: string   // ISO date, e.g. '2026-06-28'
}
```
그리고 `Destination` 인터페이스에 추가:
```ts
  crowd_peak_months: number[]   // months 1–12 when crowding spikes (now-aware crowd + ranking ready)
  trust?: {
    budget?: MetricMeta
    crowd?: MetricMeta
  }
```
- `crowd_peak_months`는 **required** (10개 다 채움 → 안 채우면 tsc가 잡아줌).
- `trust`는 optional.

### 2) `data/destinations.ts` 10개 도시에 값 채우기
아래 표대로. `last_verified`는 모두 `'2026-06-28'`. budget.source=`'estimate'`, crowd.source=`'seed'`.

| slug | crowd_peak_months | budget.confidence | crowd.confidence |
|---|---|---|---|
| seoul | [4,5,10] | medium | medium |
| busan | [7,8] | medium | medium |
| jeju | [7,8] | medium | medium |
| gyeongju | [4,10] | medium | medium |
| jeonju | [5,10] | low | low |
| gangneung | [7,8] | low | medium |
| sokcho | [7,8,10] | low | medium |
| tongyeong | [7,8] | low | low |
| namhae | [7,8] | low | low |
| jirisan | [5,10] | low | medium |

예시 (seoul):
```ts
  crowd_peak_months: [4, 5, 10],
  trust: {
    budget: { source: 'estimate', confidence: 'medium', last_verified: '2026-06-28' },
    crowd:  { source: 'seed',     confidence: 'medium', last_verified: '2026-06-28' },
  },
```

## Constraints
- 데이터 구조 + 값만. **UI 변경 금지** (trust/peak_months는 아직 화면에 안 보임).
- compare / weather / routing / filter 로직 건드리지 말 것.
- 새 의존성 없음. crowd_friction 기존 값(Low/Med/High)은 그대로 둠 — baseline tier로 유지.
- 표에 없는 값을 임의로 만들지 말 것.

## Verify
- `npx tsc --noEmit` (crowd_peak_months 누락 도시가 있으면 여기서 잡힘 → 다 채울 것)
- `npm run build` (EXIT_CODE=0)

## Report
- types.ts 변경 요약
- 10개 도시 값 다 채웠는지
- tsc / build 결과
- 다음 단계: 이 신뢰 데이터로 detail page에 "last verified" compact 표시(나중) + Best-now 랭킹에서 crowd_peak_months 활용
