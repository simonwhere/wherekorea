# Design Review — 홈페이지 (2026-07-13, Cowork)

> Skill 11 기준 코드 리뷰 (변경 없음, 점검만). 대상: Header · CategoryRail · FilterStrip ·
> HomepageClient · DestinationCard · DestinationPreviewPanel(일부) · globals.css.
> 빌드/실행 검증은 안 함 — VS Code에서 dev 서버 + `npx tsc --noEmit`로 확인 필요.
> 레퍼런스 근거: `docs/research-design-references.md` (craft = Vercel/Linear 계열).

---

## High

### H1. FilterStrip sticky 좌표 붕괴 (레이아웃 버그 의심)
`FilterStrip.tsx:32` — `sticky top-0 z-20`.
Header가 `top:0 z-40`, CategoryRail이 `top:56 z-30`으로 이미 그 자리를 차지하므로,
스크롤하면 필터 스트립이 **헤더 뒤로 들어가 가려질** 것으로 보임.
스택 의도라면 `top:112`(56+56) + z 정리가 필요. 스택 의도가 아니면 sticky 제거가 맞음
(필터는 보이되 화면을 지배하지 말 것 — design-system.md).
→ **dev 서버에서 스크롤 재현 확인 먼저.**

### H2. 데스크톱 프리뷰 패널이 그리드를 덮음
`HomepageClient.tsx` — 패널은 `position:fixed; width:480` 인데 `main`은 패널 열림과 무관하게 동일 폭.
오른쪽 카드 1~2열이 패널 밑에 깔려 클릭 불가 → "browsing context 보존 + 카드 가시성" 인바리언트 부분 위반.
`panelOpenOnDesktop`이 레이아웃에 쓰이지 않고 있음(렌더에만 사용).
제안: 패널 열릴 때 `main`에 `marginRight: 480px` + transition — 그리드가 reflow 되어 전 카드 접근 유지.

### H3. Header 모바일 미대응
`Header.tsx` — 로고 + nav 3개 + saved + Now 칩 + **고정폭 220px 검색**이 한 줄, 미디어쿼리 없음.
~640px 이하에서 가로 넘침/찌그러짐 예상. 모바일은 최소: 로고 + 검색(축소형) + saved만 남기고 nav는 다른 進입으로.

## Medium

### M1. 컨트롤 문법이 두 개
CategoryRail(라운드 10 사각 칩, active=오렌지 채움, inline style) 바로 아래에
FilterStrip(pill, active=흰색 채움, Tailwind)이 붙음 — 인접한 두 줄의 컨트롤이 서로 다른 언어.
카테고리(뷰 전환)와 필터(좁히기)는 역할이 다르니 시각 구분 자체는 맞지만, radius·active 문법·구현 방식까지 다 다른 건 잡음.
제안: radius 체계와 active 규칙("채움=선택") 하나로 통일, 구분은 크기/위치로.

### M2. 액센트(#FF6A3D) 의미 과부하
현재 오렌지 용처: 로고, Now 칩, 카테고리 active, compare added, saved(#FF8E6B 변형), bestNow reason 칩, 검색 focus.
"지금성" 시그널과 "선택됨" 상태가 같은 색 → 액센트의 정보값 희석 (연구문서 §5-3).
제안: 오렌지 = **시간/지금 관련**(Now 칩, bestNow reason)에만. 선택 상태(카테고리 active, compare added)는 흰색 채움 계열로 이동.
이러면 M1 통일도 자연히 풀림 (FilterStrip의 흰색 active가 오히려 표준이 됨).

### M3. 디자인 토큰 우회
globals.css에 CSS 변수 정의돼 있으나 컴포넌트 전부 하드코딩:
- 카드 bg `#1c1d24` ≠ `--bg-card #1e2029` (미묘하게 다른 다크 2종 공존)
- FilterStrip `bg-gray-900`(#111827) — Tailwind 기본 팔레트의 **푸른 회색**, 우리 배경톤과 어긋남
- Header/Rail `rgba(20,22,28,0.96)`, 패널 `#1a1c24` 하드코딩
- `ACCENT` 상수가 4개 파일에 중복 선언
제안: 값 변경 없이 var() 참조로 치환하는 기계적 패스 1회. 다크 톤 미세조정(연구문서의 "웜 다크" 실험)이 이후 1곳 수정으로 가능해짐.

### M4. 페이지 h1(28/800)과 카드명 h2(26/700)가 거의 동급
스케일 차 2px — 페이지 위계가 타이포로 안 읽힘. h1을 34~36으로 올리고 여백(현재 26px)도
페이지 상단 호흡을 더 주는 쪽(36~40px)이 프리미엄 방향 (연구문서 craft §여백).

## Low
- L1. 빈 상태 문구 `rgba(255,255,255,0.20)` — 너무 희미. text-2(0.65) 수준 + "Clear filters" 액션 링크 동반.
- L2. 아이콘이 유니코드 글리프(⌕ ♥ ♡ ✓ ×) — 플랫폼별 렌더 편차. 당장은 무방, 아이콘 정리는 폴리싱 단계로.
- L3. 패널 `top: 56 + 56` 매직넘버 — 헤더/레일 높이 상수화 (H1 수정과 같이).
- L4. (기존 G2) 프리뷰 패널 가짜 캐러셀 — 이미 트래킹됨.

## 잘 되어 있는 것 (지킬 것)
- bestNowReason 칩 — Steam의 "왜 추천하는지" 패턴이 이미 구현됨. 방향 맞음.
- 카드 그라디언트(하단 0.92) + textShadow — 이미지 위 텍스트 대비 확보 잘 됨.
- 카드 키보드 접근성(role/tabIndex/aria) + hover 리프트 — 유지.
- 카테고리별 에디토리얼 헤딩(SECTION_COPY) — freshness 카피 얹기 좋은 자리.

## 다음 최소 유용한 수정 (skill 11 보고 형식)
**H1 확인 → 한 줄 수정** (FilterStrip sticky 좌표). 그 다음 순서 제안: H2 → M3(기계적) → M2+M1(한 묶음) → H3 → M4.
