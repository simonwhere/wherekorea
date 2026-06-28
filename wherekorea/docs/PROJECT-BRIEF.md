# WhereKorea — Project Brief & Collaboration Guide

> 이 프로젝트를 다루는 모든 새 대화의 **단일 출발점**. 세션 시작 시 먼저 읽는다.
> 성격이 다른 문서들의 허브 역할 — 자세한 내용은 각 문서로 링크.

---

## 1. 제품 한 줄 정의
WhereKorea는 **외국인 여행자가 한국에서 "지금 어디 갈지"를 빠르게 비교·결정하게 돕는 card-first decision tool**이다.
예쁜 여행지 갤러리가 아니라 의사결정 도구. 단, 현재의 다크 프리미엄 카드 그리드 방향은 유지.

핵심 질문: *"Where in Korea should I go right now?"* — 홈에서 30초 안에 답이 나와야 한다.

## 2. 무엇이 아닌가 (non-goals)
여행 블로그 · 관광청 포털 · 예약/결제 · UGC 커뮤니티 · 풀 itinerary 플래너 · 식당/명소 디렉토리 · 전국 exhaustive DB.
(상세: `CLAUDE.md` Non-goals, `docs/PRD-v1.md`)

## 3. 우리 협업 방식 ⭐
이 프로젝트는 두 공간으로 나눠 일한다:

- **여기 (Cowork / Claude)** = 생각·구조·판단. 컨셉/기획 논의, 코드 검토·갭 분석, 규칙·스펙 문서화, 작업 지시문 작성.
- **VS Code (Claude Code)** = 실제 코딩. dev 서버로 화면 보며 구현, build/타입체크, 시각 디테일 튜닝.

두 곳은 **같은 폴더**(`~/Documents/sbang_project/wherekorea`)를 본다. Cowork에서 만든 문서가 VS Code에 그대로 있고, 그 반대도 같음.
UI를 눈으로 보며 다듬는 작업은 VS Code가, 방향·문서·판단은 여기가 담당.

## 4. 문서 맵 (어디에 뭐가 있나)
- `CLAUDE.md` — 제품/코드 헌법 (always-on, 자동 로드)
- `AGENTS.md` — 코딩 에이전트 실행 규칙 + 읽기 순서
- `docs/PRD-v1.md` — v1 제품 스펙
- `docs/data-policy.md` — 필드/데이터 규칙 (통제 어휘 근거)
- `docs/destination-taxonomy.md` — v1 destination 셋
- `docs/design-system.md` — 비주얼 방향
- `docs/editorial-guidelines.md` — 카피 톤
- `docs/measurement-plan.md` — 분석 이벤트/KPI
- `docs/STATUS-and-NEXT.md` — **현재 구현 상태 + 갭 + 다음 작업** (코드 검증본)
- `docs/skills/` — 작업별 규칙 (06 filter · 07 image · 08 compare · 10 guardrails · 11 design-qa)
- `docs/handoff-*.md` — VS Code에 넘기는 작업 지시문

## 5. 현재 상태 (요약 — 자세히는 STATUS-and-NEXT.md)
- master-detail browsing **구현 완료** (카드 클릭 → preview 패널, 모바일 bottom sheet, URL query 상태). TypeScript clean.
- compare(max 3, localStorage), detail page, live weather(open-meteo), 10개 destination 데이터 모두 있음.
- 정리 필요한 갭: **G1** 필터 중복(FilterStrip 미연결 + lib/filters.ts 미사용) · **G2** preview 가짜 사진 캐러셀 · **G3** ✅해결(skill 문서 생성) · **G5** 사소 정리.

## 6. 다음 작업 순서
1. ⏳ **G1 — 필터 통합** (진행 예정, 지시문: `docs/handoff-G1-filter.md`)
   결정됨: "Best now" 랭킹은 디폴트로 유지 + FilterStrip을 좁히기 UI로 통일 + lib/filters.ts 재사용.
2. G2 — preview 사진 처리 (가짜 캐러셀 제거 or photos[] 추가)
3. G5 — unused 변수 / useIsDesktop hydration 정리
4. 카드 위계 미세조정 → 이미지 audit → compare 폴리싱

## 7. 기획 중 / 열린 질문 (planning backlog)
> 여기서 같이 다듬어 나갈 항목. 정해지면 위 섹션이나 PRD로 승격.

- **실시간 데이터 & 차별화** → `docs/planning-data-and-differentiation.md` (작성됨)
  - 핵심: "Best now"가 현재 정렬 안 됨(`return true`) → 실데이터 기반 랭킹이 차별화 본체.
  - 무료 실시간 소스 확인됨: TourAPI 혼잡도(★), 축제, 에어코리아 미세먼지, open-meteo(연동됨).
  - 미정: 랭킹 가중치 / 실시간 1순위 확정 / 차별화 옵션 중 v1.5 선정 / live vs seed 경계.
- (다음 세션) v1 이후 로드맵, destination 확장 기준, 수익 모델 경계

## 8. 고정 원칙 (헌법급)
홈은 발견용(스토리텔링 아님) · destination 카드가 코어 단위 · 탐색 중 context 보존 · metric은 deep read 전에 보임 · 필터는 user intent · 이미지는 destination-specific · compare max 3 · seed 데이터 우선 · **smallest coherent change**.
