# 🧭 WhereKorea — Dashboard

> 이 Vault의 홈. 주말 작업 시작할 때 **여기부터 연다.**
> 제품 정의·협업 방식은 [[PROJECT-BRIEF]], 코드 검증 상태는 [[STATUS-and-NEXT]].

---

## 지금 한 줄

master-detail browsing **구현 완료**. 지금은 리디자인이 아니라 **갭 정리(필터 통합 → 사진 처리 → hydration)** 단계.

마지막 업데이트: 2026-06-21 → [[2026-06-21]]

---

## 🎯 다음 작업 (우선순위)

- [ ] **G1 — 필터 통합** · FilterStrip 좁히기 UI로 통일 + `lib/filters.ts` 재사용 → 지시문 [[handoff-G1-filter]]
- [ ] **G2 — preview 사진** · 가짜 캐러셀 제거 or `photos[]` 추가
- [ ] **빌드 확정** · 로컬에서 `npm run build` 1회 통과 확인 (tsc는 clean)
- [ ] **G5 — 정리** · unused 변수 / `useIsDesktop` hydration
- [ ] 카드 위계 미세조정 → 이미지 audit → compare 폴리싱

> 갭 상세는 [[STATUS-and-NEXT]] §2, 작업 순서는 §3.

---

## 🗂️ 주말 로그

새 주말마다 `log/` 폴더에 한 장씩. 템플릿: [[_template]]

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
