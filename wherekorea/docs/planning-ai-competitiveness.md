# 기획 — AI 검색 시대의 경쟁력 & 커뮤니티/소통 전략

> 2026-07-11 조사·분석. 질문: "ChatGPT에 물어보는 것보다 WhereKorea가 나은 이유를 어떻게 만드나."

---

## 1. 시장 상황 (조사 요약)

- AI 챗봇/AI Overviews가 여행 정보 트래픽을 흡수 중 — TripAdvisor 트래픽 -7.5%, 구글 검색량 -14.9%. 일부 퍼블리셔는 최대 -97%.
- 단순 정보 콘텐츠(블로그·가이드·디렉토리)는 AI에게 요약당해서 죽는 카테고리.
- 2026 방어 논리: 기능·콘텐츠는 모트가 아님. **실시간 데이터 + 워크플로(도구) + 신뢰 + 커뮤니티 + 도메인 특화**의 중첩이 모트.
- 역발상: AI Overviews에 **인용되는** 브랜드는 오히려 클릭 +35% — AI 검색은 적이자 유통 채널 (GEO: Generative Engine Optimization).

## 2. WhereKorea가 AI를 이기는 지점 (이미 가진 것)

AI가 구조적으로 못 하는 것 = 우리의 본체:

| AI 검색의 한계 | WhereKorea의 대응 자산 (구축됨) |
|---|---|
| 학습 데이터엔 "지금"이 없음 | Best-now 랭킹 (live 날씨) · 축제 live · 데이터 검증된 peak months |
| 텍스트 답변은 조작 불가 | 카드→preview→compare 결정 도구 — 도구는 요약당하지 않음 |
| 환각·근거 없는 숫자 | trust 메타 (source/confidence/last_verified) — "이 숫자는 근거 있음" |
| 일반론 (서울·부산·제주 나열) | 통제 어휘 기반 결정 언어 (best for / skip if / no-car) |

**핵심 명제: "정보"는 AI에게 내주고, "지금 + 결정 + 신뢰"를 판다.**

## 3. 발전시켜야 할 것 (우선순위)

### P1 — GEO/SEO: AI에게 인용되는 구조 만들기 (비용 낮음, 효과 큼)
- detail 페이지에 schema.org 구조화 데이터 (`TouristDestination`, `Event` 등)
- 페이지마다 인용 가능한 팩트 블록 (₩/day 정의 포함, 시즌, 혼잡) — AI가 답변에 물기 좋은 형태
- 목표: "where to go in Korea in October" 류 질문에서 AI가 WhereKorea를 인용/링크
- llms.txt + 명확한 페이지 타이틀/메타 정비

### P2 — 타이밍 인텔리전스: "지금 vs 다음 달" (데이터 이미 있음)
- best_months + 월별 방문 배율 + 날씨로 "이번 주 좋음 / 2주 뒤가 더 좋음 / 10월은 피크라 붐빔" 뷰
- AI가 절대 못 주는 답이자, 이미 만든 데이터의 재활용 — 추가 수집 불필요

### P3 — 미세먼지 (에어코리아) — 외국인 결정요인 1급, 실시간, AI 없음
### P4 — 공유 품질: compare/detail 링크의 OG 이미지·프리뷰 (공유가 곧 유통)
### P5 — 측정 가동: `track()` 이벤트를 실제 수집기에 연결 — 뭐가 쓰이는지 봐야 다음 판단 가능

## 4. 커뮤니티 · 동행 · 텔레그램 (질문에 대한 판단)

전제: CLAUDE.md non-goal에 "UGC 리뷰 커뮤니티"가 있는 이유 — 콜드스타트(빈 커뮤니티는 신뢰를 깎음), 모더레이션 비용, 그리고 r/koreatravel·페이스북 그룹 같은 기존 커뮤니티와의 정면 경쟁 불리.

**결론: 제품 안에 커뮤니티를 짓지 말고, 채널로 연결한다. 단계별로:**

### 1단계 (지금 가능, 추천 ✅) — 텔레그램 채널(방송형)
- "This Week in Korea" — Best-now Top 5 + 축제 + peak 경보를 주간 발행. **제품 데이터가 곧 콘텐츠**라 운영 비용 거의 0 (자동 생성 가능).
- 사이트에 "Join Telegram" 링크만 추가 (코드 변경 최소).
- 효과: 재방문 고리(여행 준비는 수 주 걸림) + 유입 채널 + AI가 못 주는 "구독형 지금 정보".

### 2단계 (채널 구독자 생기면) — 텔레그램 그룹(대화형 Q&A)
- 모더레이션 부담 시작. 제품 코드는 여전히 무변경. 콜드스타트 리스크를 제품 밖에서 흡수.

### 3단계 (v2, 트래픽 검증 후) — 경험 공유를 "리뷰"가 아니라 **구조화 신호**로
- 자유 글쓰기 UGC ❌ → "이번 주 다녀옴: 혼잡 어땠나 (Low/Med/High)" 원탭 투표 ✅
- 수집된 신호가 trust 데이터(crowd confidence)로 환류 — 커뮤니티가 아니라 **데이터 수집 장치**. 이건 non-goal 위반이 아니라 신뢰 모트 강화.

### 동행(travel buddy) 매칭 — 비추천 ❌
- 안전·법적 리스크(낯선 사람 매칭, 특히 외국인 여행자 대상), 신고/차단/검증 인프라 필요 — 운영 비용이 코어 제품을 잡아먹음.
- 수요는 실재하나 기존 커뮤니티(r/koreatravel, FB 그룹)가 이미 담당. 우리가 뺏을 우위 없음.
- 대안: 3단계 시점에 "동행 구하기는 여기서" 큐레이션 링크 정도로 수요만 받아넘김.

## 5. 제안 실행 순서
1. P1 GEO (schema.org + 팩트 블록) — 다음 코딩 세션
2. 텔레그램 채널 개설 + 주간 요약 자동 생성 스크립트 (Best-now 데이터 → 포스트 문안)
3. P2 타이밍 인텔리전스 뷰
4. P3 미세먼지 → P4 OG → P5 측정
5. 커뮤니티 3단계는 월 방문 지표 생긴 후 재논의

## Sources
- [Traffic Drops of the Biggest Websites After AI Chats — Loopex](https://www.loopexdigital.com/blog/website-traffic-drops-after-ai-chats)
- [The AI Search Reckoning — AdExchanger](https://www.adexchanger.com/publishers/the-ai-search-reckoning-is-dismantling-open-web-traffic-and-publishers-may-never-recover/)
- [AI Search vs Google 2026 — Growth Engines](https://growth-engines.com/insights/seo-aeo/ai-search-vs-google)
- [AI Moats in 2026 — Valtorian](https://www.valtorian.com/blog/ai-moats-2026)
- [What Travelers Expect from a Travel App in 2026 — Smartvel](https://www.smartvel.com/resources/blog/what-travelers-expect-from-a-travel-app-in-2026)
- [Competitive Moat for AI-Era SaaS — Momentum Nexus](https://www.momentumnexus.com/blog/competitive-moat-ai-era-saas-7-defensibility-types)
