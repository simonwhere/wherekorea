# 기획 — 동네(베이스) 블록 & 이벤트/티켓팅 접근성 (2026-07-12 발의)

> ✅ **시그니처 행사 구현 완료 (2026-07-13):** 2층 모델 확정 — ①시그니처(연례, 시드 1회 입력+연 1회 갱신) ②라이브(API 자동).
> `data/signature-events.ts` 26건 (14개 도시 × 2~3건, **불확실한 행사는 생략 원칙** — 속초는 확실한 연례 행사 없어 0건).
> UI: When to go 페이지 `SignatureEventsExplorer` (월 칩 12개 — **기본 선택 = 현재 월**, 도시 칩 보조, 행 클릭 → 도시 detail)
> + detail WhenToGoBlock "Annual highlights" (그 도시 것만 + 현재 월이면 'on this month' 표시).
> 티켓팅 라벨 `TicketingBadge`: Walk-in OK / Bookable in English / Hard for foreigners (KOPIS 단계에서 id-required 본격 사용).
> tsc clean · 실화면 검증은 dev 서버 재시작 후.

> 승익 발의 두 건에 대한 판단·설계. 구현은 런칭 후 (동네는 런칭 전 콘텐츠 작업 가능).

## 1. 핫플레이스 동네 → "Where to base yourself" 블록 ✅ 채택

- 근거: 도시 선택 다음의 결정이 "어느 동네에 묵나" — r/koreatravel 최다 질문 유형. CLAUDE.md "복잡한 하위 구조는 detail 안에" 원칙과 부합.
- 형태: detail 페이지 블록. 도시당 **3~4개 동네 × 한 줄 결정 언어** (best for / skip if 톤).
  예) Seoul: Hongdae(nightlife·young) / Myeongdong(first-timer convenience·soulless at night) / Bukchon-Insadong(hanok·quiet early) / Gangnam(K-pop·pricey).
- 경계(비확장 조건): 동네 지도 시스템 ❌ · 명소/식당 리스트 ❌ · 동네별 페이지 ❌ — 텍스트 블록만.
- 데이터: `Destination`에 `neighborhoods?: { name: string; note: string }[]` (optional, 도시형 destination만).
- 시점: 콘텐츠 작업이라 런칭 전 가능 (15도시 중 도시형 ~8곳).

## 2. 이벤트/콘서트 + 외국인 티켓팅 접근성 ✅ 채택 (v1.6)

- 통찰: 한국 공연 예매의 본인인증 벽 때문에 외국인이 "갈 수 있는지"를 아는 곳이 없음.
  **"Can I actually attend?" 라벨 = 아무도 없는 신뢰 기능, AI가 모르는 로컬 뉘앙스.**
- 데이터 소스 (확인됨): **KOPIS 공연예술통합전산망 오픈API** (data.go.kr 15097805, 무료) —
  전국 콘서트·뮤지컬·연극, 지역·날짜·공연장·예매처. 시청/민간 개별 조사보다 이걸 우선, 축제는 기존 TourAPI 유지.
- 접근성 라벨 (3단계):
  - 🟢 **Walk-in OK** — 현장 구매/무료 (축제 대부분)
  - 🟡 **Bookable in English** — Interpark Global / Yes24 Global 등 외국인 채널 취급
  - 🔴 **Hard for foreigners** — 본인인증(휴대폰/아이핀) 예매 필수
  - 판정: 예매처 필드 기반 휴리스틱 + 대형 공연 editorial 확인. 불확실하면 라벨 생략(과장 금지).
- 경계: 공연 디렉토리 ❌ — 도시당 상위 소수만, "지금/그때 갈 이유" 신호로. 랭킹 미반영(축제와 동일 원칙).
- 선행: KOPIS 활용신청(승익) → 응답 스키마 실측 → 라벨 휴리스틱 설계.

## 순서
S1(메타/schema) → 런칭 → ① 동네 블록 → ② KOPIS 이벤트+라벨(v1.6)

→ 연결: [[planning-launch-strategy-gaps]] · [[design-live-crowd-festival]] · [[CLAUDE.md 경계]]
