# 예산 보정표 — 10개 도시 card_daily_total

> 기준: `data-policy.md` → card_daily_total (persona A, 올인 1인/일).
> 방법: Seoul 베이스라인을 잡고, 지역 보정(숙박·식사 위주)을 적용.
> ⚠️ 1차 보정치(estimate). 식사=참가격 지역값, 숙박=지역 ADR로 추후 도시별 실측 검증 필요. confidence로 그 한계를 드러냄.

## 바구니 구성 (1인/일)
`숙박(중급÷2) + 식사(일반2+업리프트1+카페) + 현지교통 + 활동`

## 도시별 산출

| 도시 | 숙박 | 식사 | 교통 | 활동 | 합계 | 카드값 | confidence | 보정 근거 |
|---|---|---|---|---|---|---|---|---|
| Seoul | 65 | 55 | 10 | 15 | 145 | **₩145k** | medium | 베이스라인 |
| Busan | 52 | 48 | 10 | 13 | 123 | **₩125k** | medium | 서울 대비 ~15% 저렴(확인됨) |
| Jeju | 75 | 58 | 12 | 18 | 163 | **₩165k** | medium | 섬·숙박 프리미엄, 관광 uplift |
| Gyeongju | 48 | 45 | 8 | 15 | 116 | **₩115k** | medium | 입장료 많음, Numbeo 데이터 있음 |
| Jeonju | 48 | 45 | 8 | 12 | 113 | **₩110k** | low–med | 저렴한 음식도시, 한옥스테이 |
| Gangneung | 58 | 52 | 10 | 12 | 132 | **₩130k** | low | 카페문화 uplift, 여름 성수기 / 앵커: Seoul −10% |
| Sokcho | 52 | 48 | 9 | 13 | 122 | **₩120k** | low | 해산물 / 앵커: Gangneung −8% |
| Tongyeong | 45 | 45 | 8 | 12 | 110 | **₩110k** | low | 앵커: Busan −12% |
| Namhae | 45 | 42 | 9 | 10 | 106 | **₩105k** | low | 농촌·섬, 펜션, 차 필요 / 앵커: Tongyeong −5% |
| Jirisan | 40 | 40 | 8 | 8 | 96 | **₩100k** | low | 농촌·산, 기본 숙소 / 최저 baseline |

(단위 ₩k = 천원)

## 기존값 → 새값 (변화)

| 도시 | 기존 DAILY_AVG | 새 카드값 | 비고 |
|---|---|---|---|
| Seoul | ₩155k | ₩145k | ↓ |
| Busan | ₩140k | ₩125k | ↓ |
| Jeju | ₩210k | ₩165k | ↓↓ persona A로 숙박 절반 반영 (기존은 솔로·고급 추정) |
| Gyeongju | ₩110k | ₩115k | ↑ |
| Jeonju | ₩105k | ₩110k | ↑ |
| Gangneung | ₩140k | ₩130k | ↓ |
| Sokcho | ₩130k | ₩120k | ↓ |
| Tongyeong | ₩100k | ₩110k | ↑ |
| Namhae | ₩120k | ₩105k | ↓ |
| Jirisan | ₩95k | ₩100k | ↑ |

→ 가장 큰 변화는 Jeju(₩210k→₩165k). 기존값이 정의 없이 들쭉날쭉했던 것을, persona A 올인 기준으로 **내부 일관성** 있게 재정렬.

## 다음 검증 (confidence 올리기)
- low 도시(Sokcho·Tongyeong·Namhae·Jirisan): 참가격 해당 지역(강원/경남) 외식비 + 지역 ADR로 실측 1회 → confidence low→medium.
- 식사 업리프트·카페 라인은 관광 집중지(Jeju·Gangneung)만 상향 검토.
- 각 값에 `last_verified`(오늘) + `source`(estimate/official) 부여 → 결정 C에서 구조화.

→ 연결: [[data-policy]] · [[planning-trust-and-expansion]]
