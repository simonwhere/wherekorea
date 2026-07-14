# 🧭 WhereKorea — Dashboard

> 이 Vault의 홈. 주말 작업 시작할 때 **여기부터 연다.**
> 제품 정의·협업 방식은 [[PROJECT-BRIEF]], 코드 검증 상태는 [[STATUS-and-NEXT]].

---

## 지금 한 줄

master-detail + 필터 통합(G1) + **Best-now 랭킹 v2 구현 완료**. 갭 정리(G2·G5)도 끝. 남은 건 빌드 로컬 확정 + 폴리싱 + 라이브 데이터 확장.

마지막 업데이트: 2026-07-08

---

## 🎯 다음 작업 (우선순위)

- [x] **G1 — 필터 통합** · FilterStrip 연결 + `lib/filters.ts` 재사용 (완료, handoff는 archive)
- [x] **Best-now 랭킹 v2** · `lib/best-now.ts` + base_appeal/best_months 필드 + 'Best now' 정렬 (2026-07-08, 7월 프리뷰 점수 일치 검증)
- [x] **G2 — preview 사진** · 가짜 "1/3" 캐러셀 UI 제거, 단일 이미지로 정직하게 (photos[] 추가 시 복원)
- [x] **G5 — hydration** · `useIsDesktop` 초기 렌더 SSR과 일치하도록 수정 (mount 후 보정)
- [x] "왜 지금 상위" 동적 카피 (2026-07-11 — Best now 카테고리 카드에 배지)
- [x] 이미지 audit (2026-07-11 — 실물 확인, 4장 flag → [[image-audit]])
- [x] compare 폴리싱 (2026-07-11 — 다크테마 정합 수정, Skip if/Food 행 추가)
- [ ] **빌드 확정** · 로컬 VS Code에서 `npm run build` 1회 통과 확인 (tsc는 clean — Cowork 샌드박스에선 빌드가 시간 내 안 끝남)
- [x] **이미지 4장 교체** (2026-07-11 — 실물 검증 완료 → [[image-audit]])
- [x] **확장 v1.1 구현** (2026-07-11 — 15개 destination, 이미지 포함 → [[expansion-v1.1]])
- [x] 라이브 데이터 v1.5 논의·결정 (2026-07-11): **혼잡·축제 = 정보 표시만, 랭킹 미반영.** peak 배지 + Quietest now 시즌 인식 구현됨 → [[design-live-crowd-festival]]
- [ ] **TourAPI 키 발급 (승익)** · data.go.kr 가입 → TourAPI 활용신청 → `.env.local`에 `TOUR_API_KEY`
- [ ] 키 발급 후: 혼잡도 live + 축제 "Happening now" 구현 (설계 문서 §5 순서대로)
- [ ] 미세먼지(에어코리아)는 다음 라운드
- [ ] **동네 블록 & 이벤트 티켓팅 라벨** (2026-07-12 발의·설계 → [[planning-neighborhoods-events]]): ①detail "Where to base yourself"(런칭 전 콘텐츠 가능) ②KOPIS 공연 + 외국인 접근성 3단계 라벨(v1.6, KOPIS 활용신청 필요)
- [ ] **AI 경쟁력 로드맵** (2026-07-11 분석 → [[planning-ai-competitiveness]]): P1 GEO(schema.org) → 텔레그램 채널 → P3 미세먼지. 동행 매칭은 비추천, UGC는 v2에 구조화 신호로만. (P2 타이밍은 완료 ↓)
- [x] **경쟁 갭 G-A~F 구현** (2026-07-11 → [[planning-competitive-gaps]]): /when-to-go 페이지 + detail 타이밍·혼잡차트 + $병기 + 7일 예보 + 저장. G-D 재랭킹만 오픈 후.
- [ ] **dev 서버 재시작 후 저장(♡) 클릭 검증** — 서버 503으로 검증 중단됨

> 갭 상세는 [[STATUS-and-NEXT]] §2, 작업 순서는 §3.

---

## 🗂️ 주말 로그

새 주말마다 `log/` 폴더에 한 장씩. 템플릿: [[_template]]

- [[2026-07-11]] — 동적 카피 + 이미지 audit + compare 수정 + 확장 5개 선정
- [[2026-07-08]] — 검증 + Best-now 랭킹 v2 구현 + G2·G5 정리
- [[2026-06-21]] — Vault 세팅 / 추적 구조 시작

---

## 📚 문서 지도

- [[PROJECT-BRIEF]] — 제품 정의 · 협업 방식 · 문서 허브
- [[STATUS-and-NEXT]] — 현재 구현 상태 · 갭 · 다음 작업 (코드 검증본)
- [[PRD-v1]] — v1 제품 스펙
- [[design-system]] — 비주얼 방향
- [[destination-taxonomy]] — v1 destination 셋
- [[editorial-guidelines]] — 카피 톤
- [[data-policy]] — 필드/데이터 규칙
- [[measurement-plan]] — 분석 이벤트 · KPI

---

## 협업 규칙 (요약)

- **여기(Cowork/옵시디언)** = 생각·구조·판단·기록
- **VS Code** = 실제 코딩
- 둘 다 같은 폴더를 봄. 변경은 "가장 작은 일관된 단위(smallest coherent change)".
