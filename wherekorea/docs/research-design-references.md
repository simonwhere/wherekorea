# Design Reference Research — 홈페이지 개선용

> 2026-07-13 Cowork 조사. 쓰론(throneinvest.ai) 논의에서 파생.
> 결론 먼저: 지금 다크 프리미엄 카드 그리드 방향은 맞다. 바꿀 건 "구조"가 아니라
> (1) freshness 신호의 밀도, (2) 카드 위 데이터 위계, (3) 타이포/여백의 craft 수준.

---

## 0. 홈 "전체 디자인" 레퍼런스 (2026-07-13 추가)

> 솔직한 진단: "다크 프리미엄 + 데이터 카드 + 여행 발견" 홈은 여행 도메인에 존재하지 않는다
> (여행 사이트는 전부 밝은 프로모션 톤 아니면 예약 퍼널). 즉 빈 카테고리 = 기회.
> 홈 전체의 구조적 쌍둥이는 여행이 아니라 **다크 카드 discovery 제품**에 있다.

### Dice.fm ★ — 홈 전체 레퍼런스 1순위
https://dice.fm/
- "오늘 밤 이 도시에서 뭐 보러 갈까" = "지금 한국에서 어디 갈까"와 동형의 결정 문제. 다크 기본, 카드 그리드, freshness(오늘/이번 주)가 내장된 발견 홈.
- 볼 것: 사진이 감성을 전담하고 UI 크롬은 절제되는 역할 분리, 강한 타이포 2서체 체계(Favorit + Times), 도시 컨텍스트 헤더 아래 바로 카드가 시작되는 구성(히어로 없음 — product-as-landing).

### Letterboxd — 이미지-카드 관계의 교과서
https://letterboxd.com/
- 포스터가 곧 카드. 이미지가 장르·톤·품질을 한눈에 전달하고, 메타데이터(평점·리뷰)는 어두운 크롬에 얇게. "갤러리를 걷는 느낌"의 브라우징.
- 교훈(역방향): 리디자인 분석들이 지적한 실패 지점이 카드 텍스트 위계 붕괴/불균등 카드 높이 — 우리 카드 위계 6개 규칙이 왜 헌법인지 재확인.

### Steam 스토어 — 데이터 카드 + 필터의 스케일 검증판
https://store.steampowered.com/
- 다크 + 태그 + 지표 + 필터 + 개인화 추천이 한 홈에서 돌아가는 가장 검증된 사례.
- 훔칠 아이디어 하나: 추천에 **"왜 이걸 추천하는지" 이유를 표기** → "Best now" 랭킹에 "sunny all week · festival on" 같은 이유 한 줄 붙이기.

### 직접 훑는 갤러리 (여행 카테고리 말고 dark/directory 카테고리로)
- https://www.dark.design/ — 다크 사이트만 큐레이션
- https://godly.website/ , https://land-book.com/ — directory/gallery 유형으로 필터해서 볼 것

**합성 공식**: 레이아웃·무드 = Dice/Letterboxd 계열, 정보 구조 = Nomad List, craft 디테일 = Vercel/Linear.

---

## 1. 아키타입이 같은 사이트 (구조를 배울 곳)

### Nomad List / nomads.com — 가장 가까운 레퍼런스 ★
https://nomads.com/
- **왜 핵심인가**: "지금 어느 도시 갈까"를 카드 그리드 + 필터 + 실시간 데이터로 푸는, WhereKorea와 정확히 같은 아키타입. 랜딩이 곧 제품(로그인 벽 없음).
- 훔칠 것:
  - 카드 위에 live 데이터 오버레이(온도, 대기질, 비용)를 얹어 "지금성"을 카드 단위로 표현
  - 점수/랭킹이 10분마다 재계산된다는 걸 명시 → freshness 자체가 신뢰 신호. "Best now" 랭킹(backlog 항목)이 완성되면 같은 방식으로 노출할 것
  - 필터가 사이드에 있어도 카드가 시각적 주인공을 유지
- 피할 것: 데이터 항목 과적재(카드당 지표 6~8개까지 가는 구간은 가독성 무너짐). design-system.md의 위계 6개 유지.

### Where And When (whereandwhen.net)
https://www.whereandwhen.net/
- "이번 달 어디가 좋은가"를 날씨+예산으로 답하는 decision tool. 컨셉은 동일하지만 디자인이 구식 → **컨셉 검증용이지 비주얼 레퍼런스 아님**. WhereKorea가 이 카테고리를 다크 프리미엄으로 하면 비주얼만으로 차별화된다는 방증.

### Kayak Explore / Google Flights Explore
- map + 가격 카드로 "어디 갈지"를 여는 canonical 패턴. 지도는 컨텍스트, 카드가 결정 단위라는 우리 원칙과 일치. 지도-카드 동기화(지도 hover ↔ 카드 하이라이트) 인터랙션 참고.

## 2. "지금 타이밍" 표현을 배울 곳 (WhereKorea의 무기)

> Surfline류(분 단위 스포츠 컨디션)는 결이 다름 — WhereKorea의 "지금"은
> **계절·주 단위 타이밍을 목적지 단위 상태 라벨로** 보여주는 것. 아래가 그 계열.

### 일본 벚꽃 예보 지도 (japan-guide / weathermap.jp) ★
https://www.japan-guide.com/sakura/ , https://sakura.weathermap.jp/en.php
- 목적지마다 "개화 → 만개 → 지는 중" **상태 라벨**을 부여 — 수치가 아니라 단계. 외국인 여행자가 즉시 이해.
- WhereKorea 적용: 카드에 "cherry blossoms peaking" / "foliage starting" / "beach season" 같은 시즌 상태 라벨 1개. 데이터는 seed 달력 기반이면 충분(실시간 API 불필요) → v1에서 바로 가능.
- 한국은 벚꽃 남→북, 단풍 북→남 진행이라 이 패턴이 그대로 성립. 외국인 대상 한국판은 사실상 없음 = 차별화 + SEO 기회("korea cherry blossom forecast").

### SmokyMountains.com 단풍 예측 지도 ★
https://smokymountains.com/fall-foliage-map
- 주 단위 슬라이더를 움직이면 지도 전체에 단풍 진행이 색으로 번지는 인터랙션. 매년 언론(Forbes, AFAR)에 회자될 만큼 공유가 잘 됨 — **타이밍 시각화 자체가 바이럴 자산**이 된다는 증거.
- WhereKorea 적용: `when-to-go` 페이지에 월/주 슬라이더 + 목적지 상태 변화. Reddit GTM에 최적인 공유형 콘텐츠. (지도 룰 준수: 검증 후 SVG 구조화)

### Skyscanner "Everywhere"
https://www.skyscanner.net/flights/advice/skyscanner-everywhere-search-how-to-find-flights-to-anywhere-in-the-world
- 목적지를 비워두고 기준(가격)으로 정렬해 "어디든" 탐색 — "Best now" 랭킹의 정렬 철학과 같음. 기준이 가격이 아니라 "지금 좋음"일 뿐.
- UX 케이스 스터디 인사이트: 탐색 의도가 생긴 순간엔 이미지가 검색/필터와 주목 경쟁하면 안 됨 → 필터 스트립 주변은 이미지 절제.

### Atlas Obscura
https://www.atlasobscura.com/
- 에디토리얼 큐레이션 + 카드 발견의 균형. 테마 "Hubs"(컬렉션 허브)로 카드를 묶는 방식 → CategoryRail / "East Coast" 태그형 컬렉션 그룹핑 규칙과 정확히 일치. 큐레이션 톤(과장 없는 발견 언어)도 editorial-guidelines와 결 맞음.

## 3. Craft(만듦새)를 배울 곳 — 다크 프리미엄의 기준선

### Linear / Vercel 계열
https://vercel.com/design/guidelines , https://seedflip.co/blog/vercel-design-system
- 현재 globals.css 토큰 구조는 이미 이 계열. 끌어올릴 디테일:
  - **타이포**: 디스플레이 사이즈에 타이트한 letter-spacing(-0.02em대), 굵기는 400–510 밴드 위주(볼드 남발 금지)
  - **보더**: hairline(현재 rgba 0.08은 적절) + 그림자 대신 지오메트리로 구분
  - **여백**: 섹션 수직 패딩 96–128px — "비어 보일 만큼"이 프리미엄의 실체
  - **색 절제**: 액센트(#FF6A3D)는 Linear의 라임처럼 "지금 주목할 것" 하나에만. 배지·태그·CTA에 다 쓰면 효과 소멸
- 주의: 이건 developer-tool 미학. 여행 감성이 죽지 않게 이미지가 감성을 담당하고 UI 크롬은 절제 — 역할 분리로 해결.

### Awwwards travel 갤러리 (수시 탐색용)
https://www.awwwards.com/websites/travel-tourism/ , https://cssdesignawards.com/website-gallery?industry=travel
- 최근 honorable mention: Clarity Business Travel, Snami Travel 등. 단, 어워드 사이트는 스토리텔링/스크롤 연출 위주 → **모션 디테일만 훔치고 구조는 무시** (홈은 발견용, 스토리텔링 아님 — 헌법).

## 4. 패턴 원칙 (map + card)
- Map UI Patterns "List and Details": https://mapuipatterns.com/list-details/
  리스트는 최소 컬럼만, 구분선/줄무늬/그림자 제거 → 우리 preview 패널 및 카드 그리드와 일치. 지도-카드 data brushing(상호 하이라이트)은 v1.5 후보.

---

## 5. 적용 우선순위 제안 (smallest coherent change 순)
1. **카드의 시즌 상태 라벨** — 벚꽃 예보 지도식 단계 라벨("peaking" 등), seed 달력 기반이라 v1 즉시 가능. G1 필터 통합 및 "Best now" 랭킹 작업과 자연스럽게 묶임.
1b. (v1.5 후보) **when-to-go 타이밍 슬라이더** — SmokyMountains식. 공유형 콘텐츠라 Reddit GTM 자산.
2. **타이포/여백 패스** — letter-spacing, 굵기 밴드, 섹션 여백만 조정하는 1회성 polish. 구조 변경 없음.
3. **액센트 사용처 감사** — #FF6A3D가 쓰이는 곳 나열 → "지금 주목" 1용도로 축소.
4. **freshness 카피** — 헤더/히어로에 "매일 업데이트 · 실시간 날씨 기준" 한 줄 (Nomad List의 재계산 명시 참고).
5. (v1.5) 지도-카드 상호 하이라이트.

## 비적용 결정
- 쓰론식 마케팅 랜딩 + 로그인 벽 구조 (SEO/Reddit GTM 훼손 — 이전 대화 결론 유지)
- 어워드 사이트식 풀스크린 스크롤 스토리텔링
- 카드 지표 확장(Nomad List 밀도 추종 금지)
