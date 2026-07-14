# Best-now 랭킹 공식 v2 (LOCKED)

> 제품 핵심 IP. "Best now" 카테고리를 `return true` → **실데이터 점수 정렬**로.
> v1의 문제(한산한 소도시가 서울·제주를 이김) 수정:
> - **혼잡(crowd)은 점수에서 제거** → 정보 지표로만 (붐빔 = 인기 신호, 감점하면 명소가 묻힘).
> - **base_appeal 추가** → 도시 기본 매력도(연중 앵커)로 세계급/소도시 구분.
> - **season_fit은 `best_months`(가기 좋은 달)로** — `crowd_peak_months`(붐비는 달) 아님.

## 공식
```
best_now_score = base_appeal×5  +  season_fit  +  weather_now
   (crowd는 점수 미포함 — 카드에 정보로만 표시)
```

### 1) base_appeal×5 (0–50) — 연중 기본 매력도 (editorial)
`base_appeal` 1–10 × 5. 가장 큰 가중치 → 명소가 안 묻힘. 단 season+weather(합 0–75)가 "지금"을 가름.
| seoul | busan | jeju | gyeongju | jeonju | gangneung | sokcho | tongyeong | namhae | jirisan |
|---|---|---|---|---|---|---|---|---|---|
| 10 | 9 | 9 | 6 | 5 | 5 | 5 | 4 | 3 | 4 |

### 2) season_fit (0–35) — 지금이 가기 좋은 철인가 (`best_months`)
- 현재 월 ∈ `best_months` → **35**
- 인접 ±1 → **18**
- 그 외 → **5**

`best_months` (editorial — 붐빔이 아니라 "경험이 좋은 달"):
| 도시 | best_months |
|---|---|
| seoul | [4,5,6,9,10,11] |
| busan | [5,6,7,8,9,10] |
| jeju | [4,5,6,7,8,9,10] |
| gyeongju | [4,10,11] |
| jeonju | [4,5,9,10,11] |
| gangneung | [6,7,8,9,10] |
| sokcho | [7,8,9,10] |
| tongyeong | [4,5,7,8,9] |
| namhae | [4,5,7,8] |
| jirisan | [5,6,9,10,11] |

### 3) weather_now (0–40) — 실시간 기온 쾌적도
입력: `live_weather_current` (°C).
| 기온 | 점수 |
|---|---|
| 15–25 | 40 |
| 10–14.9 / 25.1–28 | 28 |
| 5–9.9 / 28.1–31 | 15 |
| <5 / >31 | 6 |
| 없음/0 | 24 (중립) |

정렬: score 내림차순. 동점 → season_fit → weather → name.

## crowd 처리 (점수 밖)
`crowd_friction`은 카드/상세에 **정보 지표**로 유지 (붐빔/인기 표시). 점수에 영향 없음.
혼잡 회피 수요는 별도 'Quietest now' 뷰가 담당. `crowd_peak_months`는 추후 "지금 성수기" 정보 표시용으로 보존.

## 7월 프리뷰 (실측 기온 2026-06-28, month=7)
| 도시 | appeal×5 | season | weather | score |
|---|---|---|---|---|
| jeju | 45 | 35 | 40(22°) | **120** |
| busan | 45 | 35 | 40(25°) | **120** |
| gangneung | 25 | 35 | 40(25°) | **100** |
| sokcho | 25 | 35 | 40(22°) | **100** |
| seoul | 50 | 18(6월인접) | 28(28°) | **96** |
| tongyeong | 20 | 35 | 40(24°) | **95** |
| namhae | 15 | 35 | 40(24°) | **90** |
| gyeongju | 30 | 5(비철) | 40(25°) | **75** |
| jirisan | 20 | 18 | 28(14°) | **66** |
| jeonju | 25 | 5 | 28(26°) | **58** |

→ 제주·부산 상위(여름 prime + 높은 appeal), 서울은 더운 비수기 날씨에도 appeal로 5위 유지(안 묻힘), 해변 도시 강세, 더운 내륙·비철 하위. **v1의 결함 해소.** 통영은 1위→6위로 정상화.

## 엣지
- `live_weather_current` 없으면 24(중립).
- month는 클라이언트 1회 고정(`useState(() => new Date().getMonth()+1)`) → hydration 안전.

## 적용 범위 (v1 구현)
- 'Best now' 카테고리에서만 정렬. 다른 카테고리 기존 순서.
- UI 변경 없음(순서만). "왜 지금 상위" 동적 카피는 다음 단계.
- 신규 필드 `base_appeal`(number 1–10), `best_months`(number[]) → types.ts + 10개 도시.

## v1.1 확장 시드 (2026-07-11 추가 — 공식 변경 없음)
| slug | base_appeal | best_months | crowd_peak |
|---|---|---|---|
| yeosu | 6 | [4,5,6,7,8,9,10] | [7,8] |
| andong | 5 | [4,5,9,10] | [10] |
| suwon | 5 | [4,5,6,9,10,11] | [4,10] |
| chuncheon | 4 | [4,5,6,9,10] | [5,10] |
| damyang-boseong | 4 | [4,5,6,7] | [5] |

→ 연결: [[planning-data-and-differentiation]] · [[data-policy]] · [[expansion-v1.1]]
