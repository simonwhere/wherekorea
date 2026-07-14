# 기획 — 실시간 데이터 & 차별화 옵션

> 목적: "지금 베스트"를 카피가 아니라 **실제 데이터 기반 랭킹**으로 만들어 경쟁력을 올리고,
> 블로그·관광청과 다른 차별화 포인트를 정리한다. (PROJECT-BRIEF §7 backlog의 본체)

---

## 0. 전제 — 가장 큰 갭
홈 헤드라인은 *"Ranked by season, weather, crowd level and travel time"* 라고 말하지만,
현재 `matchesCategory('best-now')`는 `return true` — **정렬이 없다.** live weather는 받아오지만 랭킹에 안 쓰임.
→ 실시간 데이터의 목적은 결국 **"Best now 점수화/정렬"을 진짜로 구현**하는 것.

---

## A. 실시간으로 받아올 데이터 (경쟁력)

각 항목 = 무엇을 강화하나 / 소스 / 무료여부 / 난이도 / 어떤 필드를 업그레이드하나.
한국 공공데이터(data.go.kr)는 대부분 **무료 인증키**로 열려 있어 비용 부담이 낮다.

| 우선 | 데이터 | 무엇을 강화 | 소스 | 난이도 | 대체 필드 |
|---|---|---|---|---|---|
| ★1 | **혼잡도(실시간)** | "지금 한가한 곳" 랭킹·신뢰 | 한국관광공사 TourAPI 혼잡도 (KT 이동통신 30일 예측 + 티맵) | 중 | `crowd_friction` (현재 static) |
| ★1 | **날씨(이미 연동됨)** | 여행 적합도 점수 | open-meteo (연동 완료) | 낮음 | `live_weather_*` |
| ★2 | **축제/행사** | "지금 가야 할 이유" (Time Out식) | TourAPI KorService2, 날짜별 조회 | 중 | (신규) 이벤트 신호 |
| ★2 | **대기질(미세먼지)** | 한국 여행 핵심 결정요인 | 에어코리아(한국환경공단) PM10/PM2.5 + 예보 | 중 | (신규) air 신호 |
| 3 | **교통/접근 실시간** | 정확한 from-Seoul | (KTX/대중교통 실시간은 난이도 높음) | 높음 | `travel_time` (현재 static로 충분) |

### 구현 메모
- 이미 `lib/weather.ts`에 **fallback 패턴**이 있다 (API 실패 시 seed값). 모든 신규 실시간 소스는 이 패턴을 그대로 따른다 — live 실패해도 화면 안 깨짐.
- data.go.kr 키 관리·rate limit·캐싱 필요. Next.js `revalidate`(이미 weather에서 사용)로 시간 캐싱.
- 일부 공공 API는 한국어 문서/응답 → 파싱 래퍼 필요.
- **순서 추천:** 혼잡도 먼저(랭킹 IP의 핵심) → 축제 → 대기질. 교통 실시간은 보류.

---

## B. "Best now" 랭킹 점수 (차별화의 본체)

블로그와 다른 단 하나의 이유 = **"지금 조건"에 맞춰 순위를 매긴다.** 제안 가중치(예시, 튜닝 대상):

> ⚠️ 아래 v1 초안 공식은 **폐기됨** — `best-now-ranking.md` v2(LOCKED)로 대체.
> 2026-07-11 확정: **혼잡·축제는 점수 미반영, 정보 표시만** (Quietest now 탭 안에서만 혼잡이 렌즈).

```
(v2 확정) best_now_score = base_appeal×5 + season_fit + weather_now
(폐기)   낮은 혼잡 + / 대기질 + / 축제 보너스 + …
```

→ 이 점수로 'Best now' 그리드를 정렬. 카드/preview에 "왜 지금 상위인지" 한 줄("맑고 한산함 · 벚꽃축제 중")을 **동적으로** 생성하면 신뢰가 크게 오른다.

---

## C. 차별화 추가 옵션 (데이터 위에 얹는 것)

데이터 자체보다 "그걸로 뭘 하느냐"가 차별화. 우선순위순:

1. **타이밍 인텔리전스 — "지금 vs 2주 뒤".** 같은 곳도 "이번 주는 미세먼지/혼잡, 2주 뒤가 베스트" 같은 *언제 가야 하나*를 알려줌. 블로그가 절대 못 하는 것.
2. **동적 why-now / skip-now 카피.** 실시간 신호에서 "지금 좋은 이유 / 지금 피할 이유"를 자동 생성. editorial 톤(best for / skip if)과 결합.
3. **혼잡 회피 큐레이션 — "지금 가장 한산한 곳".** 실시간 혼잡도 기반 'low-crowd' 탭을 진짜 데이터로. (Atlas Obscura 감성 + 실데이터)
4. **축제 어웨어 — "이번 주 여행할 가치 있는 축제".** 날짜별 축제 데이터로 destination을 surface.
5. **여정 형태 개인화.** from-Seoul / 무차 / 일수 선택 → 랭킹 재정렬 (필터를 넘어 *재랭킹*).
6. **알림/스케줄(확장).** "제주 미세먼지 나쁨 — 이번 주는 강릉이 나아요" 같은 주간 푸시 (스케줄 작업 영역).
7. **비교 기반 결정(이미 코어).** 위 신호들을 compare 화면 필드로 노출하면 비교가 더 날카로워짐.

> 주의(제품 경계 유지): 위 옵션들은 **결정을 돕는 방향**이어야 함. 예약·itinerary·식당 디렉토리·커뮤니티로 새지 않기 (CLAUDE.md non-goals).

---

## D. 결정 완료 (2026-07-11)
- [x] 랭킹 가중치 → `best-now-ranking.md` v2로 확정 (appeal×5 + season + weather). **혼잡·축제·대기질은 점수 미반영.**
- [x] 실시간 소스 1순위 = 혼잡도 확정 + 축제 동시 설계 (같은 TourAPI 키). 미세먼지는 다음 라운드.
- [x] v1.5 차별화 = C-2 동적 why-now(구현됨) + C-3 혼잡 회피 큐레이션(Quietest now 시즌 인식, 구현됨) + 축제 정보 표시(설계됨).
- [x] live/seed 경계: weather=live(연동됨) · crowd=seed→live 업그레이드 예정(fallback 유지) · 축제=live only(실패 시 미표시) · budget/editorial=seed 유지.
→ 연동 설계: [[design-live-crowd-festival]] (키 발급 후 구현)

---

## Sources
- [한국관광공사 국문 관광정보 서비스(TourAPI) — 공공데이터포털](https://www.data.go.kr/data/15101578/openapi.do)
- [한국관광공사 TourAPI 안내](https://www.2025tourapi.com/sub/sub01.html)
- [한국관광콘텐츠랩 (TourAPI 4.0)](https://api.visitkorea.or.kr/)
- [한국환경공단 에어코리아 대기오염정보 — 공공데이터포털](https://www.data.go.kr/data/15073861/openapi.do)
- [한국환경공단 에어코리아 대기오염 예보정보](https://www.data.go.kr/data/15109350/openapi.do)
- [open-meteo (현재 연동된 날씨 API)](https://open-meteo.com/)
