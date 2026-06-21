# Skill 11 — Design QA (review checklist)

> 디자인/UX 변경 후, 또는 리뷰 요청 시 읽는다. **변경 없이 점검만** 할 때 기본 사용.
> 이슈는 심각도로 보고: Blocker / High / Medium / Low.

## 빌드/타입 (먼저)
- [ ] `npx tsc --noEmit` 통과
- [ ] `npm run build` 통과 (로컬에서 확인)
- [ ] 콘솔 에러/경고 없음 (특히 hydration mismatch)

## master-detail browsing
- [ ] 카드 클릭이 browsing context 보존 (full-page 전환 안 함)
- [ ] desktop 우측 패널 정상 (≥1100px)
- [ ] mobile bottom sheet/drawer 정상 (<1100px)
- [ ] 선택 카드 하이라이트 분명
- [ ] 패널 닫기 후 scroll·filter·category 상태 유지
- [ ] Esc / close 버튼 / 모바일 오버레이 탭 모두 닫힘

## 카드 위계 (design-system.md 순서)
name → vibe → stay → weather → budget → tags 순으로 읽히는가.
- [ ] name·vibe 가독성 (이미지 위 텍스트 대비 충분)
- [ ] stay/now/per-day metric 읽힘
- [ ] crowd dot·compare 버튼 명확
- [ ] 이미지가 너무 어두워 정보가 묻히지 않음

## 필터
- [ ] control처럼 보임 (tag 아님), active state 분명
- [ ] mobile 가로 스크롤 자연스러움
- [ ] 필터 변경이 선택/compare 상태 깨지 않음
- [ ] **dead 필터 컴포넌트 공존 안 함** (skill 06)

## compare
- [ ] max 3 유지, 초과 시 disabled+피드백
- [ ] compare 클릭이 실수로 카드 선택 트리거 안 함
- [ ] added state가 카드·패널·트레이 일치

## 이미지 (skill 07)
- [ ] destination-specific·recognizable
- [ ] 가짜 캐러셀(점/"1/3")이 실제 사진 수와 불일치하지 않음

## 콘텐츠 톤 (editorial-guidelines.md)
- [ ] decision language(best for / skip if), 관광청식 과장 없음
- [ ] recommended_stay는 가이드 톤("most travelers find…")

## 보고 형식
변경하지 말고 심각도별로 이슈 나열 후, 다음 최소 유용한 수정 1개 제안.
