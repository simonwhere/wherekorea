# Claude Code 작업 지시문 — Best-now 랭킹 v2

> VS Code의 Claude Code에 붙여넣으세요. 공식은 `docs/best-now-ranking.md`(v2)에 확정됨.
> v1과 차이: crowd 점수 제거 / base_appeal·best_months 신규 필드 추가.

---

Read first:
- `docs/best-now-ranking.md` (v2 공식·가중치·값 — 그대로 구현)
- `docs/skills/10-implementation-guardrails.md`

## Task — Best-now 점수 정렬 + 신규 필드 (smallest coherent change)

### 1) `data/types.ts` — Destination에 2 필드 추가
```ts
  base_appeal: number    // 1–10 editorial, year-round draw strength (required)
  best_months: number[]  // months 1–12 when it's genuinely good to visit (required)
```

### 2) `data/destinations.ts` — 10개 도시 값 채우기
| slug | base_appeal | best_months |
|---|---|---|
| seoul | 10 | [4,5,6,9,10,11] |
| busan | 9 | [5,6,7,8,9,10] |
| jeju | 9 | [4,5,6,7,8,9,10] |
| gyeongju | 6 | [4,10,11] |
| jeonju | 5 | [4,5,9,10,11] |
| gangneung | 5 | [6,7,8,9,10] |
| sokcho | 5 | [7,8,9,10] |
| tongyeong | 4 | [4,5,7,8,9] |
| namhae | 3 | [4,5,7,8] |
| jirisan | 4 | [5,6,9,10,11] |

### 3) 새 파일 `lib/best-now.ts`
```ts
import type { Destination } from '@/data/types'
// month: 1–12
export function bestNowScore(d: Destination, month: number): number { /* appeal*5 + season + weather */ }
```
- appeal: `d.base_appeal * 5` (0–50)
- season_fit: `d.best_months` (in 35 / 인접±1 18 / else 5)
- weather: `d.live_weather_current` 밴드 (15–25→40, 10–14.9·25.1–28→28, 5–9.9·28.1–31→15, <5·>31→6, 없음→24)
- **crowd는 점수에 넣지 말 것** (정보 지표).
- `best-now-ranking.md`의 7월 프리뷰 점수와 일치할 것.

### 4) `components/homepage/HomepageClient.tsx` 정렬 연결
- `const [month] = useState(() => new Date().getMonth() + 1)`
- `activeCategory === 'best-now'`일 때만 `filtered`를 `bestNowScore(d, month)` 내림차순 정렬. 동점 → season_fit → weather → name.
- 다른 카테고리는 기존 순서.

## Constraints
- UI 변경 없음 — 카드 순서만. 마크업·스타일 건드리지 말 것.
- `crowd_friction`은 카드에 그대로 표시 유지(정보), 단 점수엔 미포함.
- weather/compare/filter/routing 로직 수정 금지(`live_weather_current` 읽기만).
- 가중치·값은 문서 그대로. 새 의존성 없음.
- `matchesCategory('best-now')`는 true 유지(멤버십), 정렬만 추가.

## Verify
- `npx tsc --noEmit` (base_appeal/best_months required → 누락 도시 잡힘)
- `npm run build` (EXIT_CODE=0)
- dev 'Best now' 탭 순서가 `best-now-ranking.md` 7월 프리뷰 방향과 맞는지 확인 (live 날씨로 약간 차이 정상)

## Report
- types.ts / destinations.ts / lib/best-now.ts 변경 요약
- 현재 월 실제 Top 5
- tsc / build 결과
- 다음 단계: "왜 지금 상위" 동적 카피 + crowd를 카드에 정보 배지로
