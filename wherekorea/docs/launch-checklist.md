# 오픈 전 체크리스트 (2026-07-11 라이브 QA 기준)

> dev 서버 실화면 QA 결과 (skill 11). 심각도순.

## 🔴 Blocker — 오픈 불가 사유
1. ~~Detail 페이지 라이트 테마 잔재~~ ✅ 해결 (2026-07-11) — 8개 컴포넌트 다크 정합, 실화면 확인 완료
2. ~~Header "When to go" 404~~ ✅ 해결 — 네비에서 제거 + Explore/Compare에 실제 라우팅 연결 (기존엔 네비 전체가 클릭 무동작이었음). "When to go"는 타이밍 인텔리전스(P2) 페이지 생기면 복귀.
3. **`npm run build` 통과 미확정** — tsc는 clean, build 1회 확인 필요. ← 유일하게 남은 블로커

### 추가 해결 (같은 날)
- 이미지 재검증: 지리산 → 위키미디어 실측 지리산 가을 능선(CC BY 2.0, credit 저장) / 안동 → 하회 별신굿 탈놀이 공연(CC0, Quality Image). 홈·preview 실화면 확인.
- 안동 이동시간 팩트 수정: 서울발 ~2h KTX-Eum(웹 검증, 기존 2h30 과대), 부산발 ~2h 30m bus
- 긴 travel_time 4건 축약 (preview 메트릭 칸 4줄 깨짐 해결): jirisan/andong/sokcho/damyang-boseong
- ⚠️ 신규 항목: **이미지 크레딧 표기** — CC BY 2.0(지리산)은 attribution 필요. credit 필드는 저장됨, detail 페이지에 표기 UI 추가 필요 (High로 승격)

## 🟠 High — 오픈 주간에
4. **메타/SEO 기본**: 페이지별 title/description, OG 태그, favicon, robots.txt, sitemap.xml — 없으면 검색/공유 유통 전부 죽음.
5. **모바일 QA 미실시**: bottom sheet, 필터 가로스크롤, 카드 그리드 — 실기기/뷰포트 확인 필요.
6. **분석 수집 가동**: `track()`이 수집기 미연결이면 오픈해도 데이터 0. Plausible/Umami급 하나 연결.
7. **배포 env**: `TOUR_API_KEY` 프로덕션 환경변수 설정 (없으면 축제 섹션만 조용히 사라짐 — fallback은 안전).

## 🟡 Medium — 오픈 후 순차
8. 데스크톱 preview 패널이 열릴 때 그리드 우측 카드를 덮음 (main에 margin-right 미적용) — "카드 보이며 탐색" 스펙 대비 아쉬움.
9. compare/detail 공유 링크 OG 이미지 (P4).
10. damyang-boseong 녹차밭 이미지 업그레이드 (generic — image-audit 참조).
11. 검색 동작 범위 점검 (placeholder가 "cities, food, seasons" 약속).

## ✅ 이번 QA에서 정상 확인된 것
홈 Best-now 라이브 정렬(기온 변화 따라 순위 변동 확인) · reason/peak 배지 · 이모지 온도 · 15개 카드 이미지 · preview 패널(URL 상태, 축제 블록 실데이터 "Gugak Performance Jinyeon") · compare 다크 테마 + Skip if/Food 행 · 카테고리/필터 전환.
