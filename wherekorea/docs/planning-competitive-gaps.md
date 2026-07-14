# 검수 — 경쟁 사이트 대비 갭 (가이드 안에서 추가할 것)

> ✅ **구현 완료 (2026-07-11 같은 날):** G-A(타이밍 스트립 detail+compare+/when-to-go 페이지+네비 복귀) ·
> G-B(₩→$ 병기, 패널+예산 블록) · G-C(월별 방문 배율 12개월 재샘플링 → `data/crowd-monthly.ts` + detail 막대차트) ·
> G-E(7일 예보 스트립) · G-F(저장 하트+헤더 카운트+/saved — 코드 완료, dev 서버 503으로 실클릭 검증 대기).
> G-D(조건 재랭킹)만 오픈 후로 보류 — 현재 필터가 하드 필터로 같은 니즈를 이미 커버, 소프트 재랭킹은 별도 UX 필요.

> 2026-07-11. 기준: CLAUDE.md 헌법 위반 없이 (no 예약·UGC·itinerary·식당디렉토리·전국커버리지),
> "결정 도구" 정체성을 강화하는 것만 채택.

---

## 1. 경쟁자들이 잘하는 것 vs 우리

| 사이트 | 그들의 강점 | 우리 대응 상태 |
|---|---|---|
| **Nomad List** | 도시별 데이터 대시보드 (월별 기후 스트립, 비용 USD, 대기질, 필터 기반 랭킹) | 구조는 유사(우리가 여행판) — **월별 뷰·통화 환산이 없음** |
| **Trip.com** | 예약·가격 | non-goal — 안 함 (링크아웃도 v1 안 함) |
| **TripAdvisor** | 리뷰 볼륨·평점 | non-goal — 대신 trust 메타 + 데이터 검증으로 신뢰 확보 |
| **Wanderlog** | itinerary 빌더·지도 플래닝 | non-goal — 결정까지가 우리 영역 |
| **공통 약점** | "지금/언제" 신호 없음, 계절 무감각 | **우리의 본체** — Best-now·축제·peak (유지·강화) |

## 2. 채택 — 가이드 안이면서 부족한 것 (우선순위)

### G-A. 월별 타이밍 스트립 ⭐ (Nomad List Climate Finder의 여행판)
- detail 페이지에 12개월 미니 스트립: 각 달 = best_months(초록)/shoulder(노랑)/off(회색) + peak 표시(붉은 점).
- **데이터 100% 보유** (best_months + 월별 방문 배율 + open-meteo archive). 새 수집 없음.
- 이게 완성되면 "When to go" 네비 복귀 = P2 타이밍 인텔리전스 페이지 (전 도시 × 12개월 매트릭스).
- compare에도 행 추가 → "부산 vs 제주, 10월엔 어디"가 한눈에.

### G-B. 통화 환산 (小) ⭐
- 외국인 대상 제품인데 예산이 ₩만 표시. 카드/detail의 ₩145k 옆 `≈ $105` 병기.
- 정적 근사 환율(분기 갱신, data-policy에 기준일 기록)로 충분 — live 환율 불필요.

### G-C. 월별 혼잡 미니차트 (detail crowd 블록)
- 이미 계산한 12개월 방문 배율 = **경쟁 사이트 어디에도 없는 독점 데이터.** 막대 12개면 끝.
- crowd_notes 옆에 붙이면 "10월 피크" 주장에 시각 근거 생김 → trust 강화.

### G-D. 여정 조건 재랭킹 (中)
- Nomad List의 핵심 UX = 필터가 곧 랭킹. 우리는 필터(포함/제외)만 있고 재정렬이 없음.
- "3 days · no car" 선택 시 Best-now 점수에 적합도 가중 → 정렬 변화. (공식 v2는 유지, 사용자 명시 조건일 때만 레이어)
- planning-data C-5와 동일 항목. v1.5 다음 단계 후보.

### G-E. 7일 날씨 스트립 (小)
- open-meteo daily 7일치를 **이미 fetch 중** (summary만 쓰고 버림). detail WeatherBlock에 7칸 아이콘+최고/최저 표시만 추가.

### G-F. 저장(shortlist) (小)
- compare는 max 3 비교용. 별개로 "save" 하트 → localStorage 목록 (계정 없음, UGC 아님).
- 여행 준비는 수 주 — 재방문 고리. 텔레그램 채널과 함께 리텐션 담당.

## 3. 명시적으로 안 하는 것 (재확인)
예약/가격 비교 · 리뷰/평점 · itinerary 빌더 · 식당 디렉토리 · 실시간 채팅 커뮤니티(→ 텔레그램 채널로 외부화) · 호텔 제휴 위젯 (v1 수익모델 논의 전까지).

## 4. 제안 순서 (기존 로드맵과 병합)
1. G-B 통화 환산 + G-E 날씨 스트립 (한 세션, 소품 2개)
2. G-A 타이밍 스트립 + When to go 페이지 (P2와 동일 — 오픈 전 핵심 차별화)
3. G-C 혼잡 미니차트 (G-A와 같은 detail 리듬에서)
4. G-F 저장 → G-D 재랭킹 (오픈 후)

→ 연결: [[planning-ai-competitiveness]] · [[launch-checklist]] · [[best-now-ranking]]

## Sources
- [Nomads.com (구 Nomad List)](https://nomads.com/) · [Climate Finder](https://nomads.com/climate-finder)
- [Nomad List 리뷰 — Nomad Magazine](https://nomad-magazine.com/blog/nomad-list-the-oldest-go-to-resource-for-discovering-the-best-cities-for-remote-work/)
