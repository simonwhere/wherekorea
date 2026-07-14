# 설계 — 라이브 혼잡도 + 축제 (v1.5)

> 2026-07-11 논의 결정본. 코드 연동은 **API 키 발급 후** VS Code에서.
> 원칙: `lib/weather.ts`의 fallback 패턴을 그대로 따른다 — live 실패해도 화면 안 깨짐.

## 0. 확정 원칙 (제품 결정)

- **혼잡도는 정보 지표다. Best-now 랭킹 점수에 절대 반영하지 않는다.**
  (붐빔 감점 → 명소 묻힘 / 가점 → 조용한 곳 수요 배신. `best-now-ranking.md` v2와 일치)
- 예외 하나: **'Quietest now' 탭 안에서만** 혼잡이 렌즈가 된다 — 사용자가 선택한 뷰이므로.
- 축제도 같은 원칙: v1.5에서는 **정보 표시만**. 랭킹 보너스 여부는 추후 별도 논의.
- 미세먼지(에어코리아)는 v1.5 범위 밖 — 다음 라운드.

## 1. 이미 구현된 것 (seed 기반, 2026-07-11)

- 카드: `{crowd} crowd · peak now` — `crowd_peak_months`에 현재 월 포함 시
- preview 패널: `{crowd} crowds · peak season now`
- 'Quietest now' 탭: Low friction **AND** 현재 피크월 아님 (`lib/crowd.ts` `isPeakNow`)
- 이 seed 레이어가 live 실패 시의 fallback 그 자체가 된다.

## 2. 혼잡도 — 방문자수 데이터 검증 (✅ 실행 완료 2026-07-11)

**실측 결론: "실시간 혼잡"은 이 소스로 불가** — locgoRegnVisitrDDList 데이터가 2~3개월 지연됨(7월 시점 4월분까지).
따라서 런타임 live 연동 대신 **연중 방문 패턴으로 `crowd_peak_months`를 데이터 검증·보정**했다 (혼잡=정보 원칙과도 부합).

- 방법: 2025-05~2026-04 12개월 × 월 2일 샘플(둘째 수·토), 외지인+외국인 방문자(현지인 제외), 도시 월평균 ÷ 연평균 비율
- 시군구 코드 15개 수집 (수원 41110 / 여수 46130 / 경주 47130 / 안동 47170 / 통영 48220 / 남해 48840 / 지리산=하동 48850+산청 48860 / 춘천 51110 / 강릉 51150 / 속초 51210 / 전주 52110 / 담양 46710+보성 46780 / 서울·부산·제주는 prefix 합산)
- 결과: **10월이 전국 공통 피크** (통영 1.77배, 여수 1.68, 강릉 1.50, 제주 1.31). 강릉·속초만 여름(7–8월) 피크 동반. 지리산권은 3–4월(산수유·벚꽃) 피크 — 데이터로 확인됨. 서울·수원은 연중 flat → peak 없음 처리.
- 보정 반영: `crowd_peak_months` 15개 전부 갱신 + `trust.crowd = api/medium/2026-07-11`
- ⚠️ 캐비앗: 10월 샘플일(10/8, 10/11)이 2025 추석 연휴권 → 10월 다소 과대 가능. 1년치·월2일 샘플이라 confidence는 medium. 내년 재검증 권장.

## 2b. (보류) 혼잡도 live 연동 구상 — 데이터 지연으로 v1.5에서 제외

### 소스 (2026-07-11 확인)
**한국관광공사_빅데이터_지역별 방문자수_GW** (data.go.kr/15101972, KT 내국인 + SKT 외국인 이동통신 기반).
"관광지별 혼잡도 예측" 전용 오픈API는 data.go.kr에 없음(데이터랩 웹서비스) → 지역별 방문자수를 혼잡 신호로 사용.
⚠️ 정확한 파라미터/응답 스키마는 키 발급 후 실제 문서로 확인.

### 매핑 (단순해짐)
방문자수는 광역/기초지자체 단위 → 우리 카드도 도시 단위라 **시군구 코드 매핑만** 있으면 됨. POI contentId 불필요.

```ts
// data/area-codes.ts (신규) — slug ↔ 시군구 코드 시드 (축제 조회와 공유)
export const AREA_CODES: Record<string, { areaCd: string; sigunguCd?: string }> = {
  seoul: {...}, busan: {...}, // … 15개. damyang-boseong은 두 군 합산 or 대표 1곳.
}
```

레벨 산출: 해당 지역의 최근 방문자수를 같은 지역의 과거 분포(또는 전 지역 분포)와 비교해 Low/Medium/High 밴드로 — 절대값이 아니라 **상대 밴드**여야 서울이 항상 High로 고정되지 않음. 구체 공식은 실데이터 보고 보정.

### 구조
```
lib/live/congestion.ts
  fetchCongestion(slug) → { level: 'Low'|'Medium'|'High', asOf: string } | null
  - POI별 혼잡도 조회 → 도시 요약(최대값 기준 권장: 여행자가 겪을 최악값)
  - fetch(url, { next: { revalidate: 21600 } })  // 6h 캐시
  - 실패/누락 → null → UI는 seed crowd_friction 그대로
```

### 데이터 반영
- `Destination.live_crowd_level?: CrowdFriction` (런타임 주입, weather 패턴)
- live 있으면: dot/라벨은 live 값 + `trust.crowd = { source:'api', confidence:'high', last_verified: 당일 }`
- 카드 라벨: live면 `Busy now` / `Calm now` 같은 시점 언어로 구분 표시 가능 (seed는 `High crowd` 유지) — 구현 시 결정

## 3. 축제 연동 (TourAPI KorService2)

### 소스
`searchFestival2` (날짜 기준 진행 중/예정 축제, 지역코드 필터). 같은 data.go.kr 키.

### 구조 (✅ 구현·검증 완료 2026-07-11)
```
lib/live/festivals.ts
  fetchFestivalsForAll() → 전국 활성 축제 1회 조회 → 좌표 지오매칭(15km) → slug별 최대 2개
  - ⚠️ 실측 결과 2026년 영문 데이터는 areacode가 빈 값 → area 필터 불가, mapx/mapy 지오매칭으로 전환
  - eventStartDate=오늘 (API 의미: 그 날짜 기준 진행 중+예정) + 시작≤오늘≤종료 필터
  - 30km는 안양 행사가 서울/수원에 오배정됨 → 15km 확정
  - revalidate: 86400 (24h) / 실패 → [] → UI 섹션 안 뜸
  - 검증: 7/11 기준 seoul(N Seoul Tower Night Walk)·jeonju(Hanok Village Parade) 정상 매칭
data/area-codes.ts — TourAPI 시군구 코드 15개 수집 완료 (축제엔 미사용, 방문자수 API 대비 보존)
```

### UI (정보 표시만)
- preview 패널: "Happening now" 한 줄 — `🎪 {축제명} · until {끝날짜}`
- 카드는 건드리지 않음 (카드 밀도 유지, 배지 과밀 방지 — 이미 peak/reason 있음)
- detail page: WeatherBlock 옆에 compact 블록 (선택)

## 4. 키/환경

- 승익님이 직접: [data.go.kr](https://www.data.go.kr) 가입 → "한국관광공사 국문 관광정보 서비스(TourAPI)" 활용신청 (자동승인, 무료) → 인증키 발급
- `.env.local`에 `TOUR_API_KEY=...` (서버 전용 — `NEXT_PUBLIC_` 접두사 금지, fetch는 전부 서버 컴포넌트/route에서)
- rate limit: 개발계정 1,000회/일 수준 — 6h/24h revalidate면 15개 도시 × POI 3 = 여유 충분

## 5. 구현 순서 (키 발급 후 VS Code handoff)

1. contentId/areaCode 시드 수집 (TourAPI 목록조회 1회성 스크립트)
2. `lib/live/congestion.ts` + `app/page.tsx` 주입 (weather와 병렬 `Promise.all`)
3. 카드/패널/Quietest now에 live 값 반영 (seed fallback 확인)
4. `lib/live/festivals.ts` + preview 패널 "Happening now"
5. 검증: 키 없이도(=fallback) 화면 정상 / tsc / build

→ 연결: [[planning-data-and-differentiation]] · [[best-now-ranking]] · [[data-policy]]
