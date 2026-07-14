# WhereKorea — 현재 상태 & 다음 작업 (코드 검증본)

> **2026-07-08 갱신:** G1 ✅(FilterStrip 연결 + lib/filters 사용, RefineBar 제거) · G2 ✅(가짜 캐러셀 UI 제거) ·
> G5 ✅(unused 변수 제거 + useIsDesktop hydration 수정) · 예산 보정 ✅ · trust/crowd 메타 ✅ ·
> **Best-now 랭킹 v2 ✅** (`lib/best-now.ts`, `base_appeal`/`best_months` 필드, 'Best now' 카테고리 점수 정렬 — 7월 프리뷰 점수와 일치 검증됨).
> tsc clean. `npm run build`는 로컬에서 1회 확인 필요. 아래 §2 갭 목록은 당시 기록용으로 유지.

> 작성 목적: handoff 문서(전략)와 **실제 코드**를 대조해 검증한 결과.
> VS Code / Claude Code 작업의 단일 출발점으로 쓴다.
> 검증일 기준 코드 트리: `app/`, `components/`, `data/`, `lib/`.

---

## 0. 한 줄 결론

핵심 전환(master-detail browsing)은 **이미 구현 완료**됐다. 지금 필요한 건 리디자인이 아니라,
**문서가 요구한 기능 중 코드에 안 붙은 것 연결 + 가짜 UI 정리 + 빌드/문서 정합성 맞추기**다.

---

## 1. 검증된 현재 상태 (실제 코드 기준)

### 작동하는 것 (handoff 문서 요구사항 충족)

- **Master-detail browsing 완성** — `components/homepage/HomepageClient.tsx`
  - URL query state: `/?destination=seoul` (`router.replace`, `scroll: false`)
  - Desktop(≥1100px): 우측 고정 preview panel (`PANEL_WIDTH = 480`)
  - Mobile(<1100px): bottom sheet + 오버레이 + 드래그 핸들 + 슬라이드 애니메이션
  - Esc 키로 닫기, 선택 카드 하이라이트(`isSelected`), 카테고리 변경 시 선택 해제
- **Preview panel** — `components/homepage/DestinationPreviewPanel.tsx` (345줄)
  - name / Korean name / region / vibe / 4-metric strip(stay·now·per-day·from-seoul) / why / best-for / skip-if / access(no-car·crowd·car-recommended) / compare / "Open full page" 링크
- **Destination card** — `components/cards/DestinationCard.tsx`
  - name·vibe·stay·now·per-day·crowd·compare 버튼, compare 클릭은 `e.stopPropagation()`으로 카드 선택과 분리됨 ✅ (문서 §6.6 anti-pattern 회피)
- **Compare** — `lib/compare-context.tsx`: max 3 강제, localStorage 영속(hydration guard 있음), 카드/패널/트레이 상태 동기화
- **Detail page**: `app/destination/[slug]/page.tsx` + `components/detail/*` (9개 블록 컴포넌트)
- **Live weather**: `lib/weather.ts` — open-meteo 연동, fallback 처리. (API 도달 확인됨: HTTP 200)
- **Data**: `data/destinations.ts` 10개 destination 풀 데이터, `data/types.ts` 통제 어휘(enum) 정의

### 검증 결과

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | ✅ **clean (에러 0)** |
| `npm run build` | ⚠️ 미확인 — 검증 환경의 명령 시간제한 때문에 끝까지 못 돌림. **로컬에서 직접 확인 필요** (tsc가 깨끗해 통과 가능성 높음) |
| `npm run lint` | ⚠️ ESLint 미설정 (대화형 셋업 프롬프트 뜸). 설정하거나 무시 |

---

## 2. 문서 ↔ 코드 갭 (중요)

실제 작업에서 우선 처리할 항목들. 번호 = 권장 우선순위.

### G1. user-intent 필터가 만들어졌는데 연결 안 됨 ⭐
- 문서 §7이 원한 "user-facing 필터"(Beach & Coast, Culture & History, Weekend, Couples…)는
  이미 **`components/homepage/FilterStrip.tsx`에 완성돼 있다** (그룹/라벨/active state/모바일 가로스크롤까지).
- 그런데 `HomepageClient`는 이걸 **import 안 함.** 대신 더 단순한 `RefineBar`(stay 3개 + no-car만) + `CategoryRail`(상단 9개 카테고리)만 씀.
- 결과: vibe 태그 필터(coastal/couple/solo 등)가 홈에서 노출 안 됨. `lib/filters.ts`(`filterDestinations`)도 **사용처 없음(dead code)**.
- **결정 필요:** FilterStrip을 홈에 붙일지 / RefineBar+CategoryRail 조합을 유지하고 FilterStrip·lib/filters.ts를 삭제할지. 둘 중 하나로 정리해야 혼선이 없다.

### G2. preview panel의 사진 캐러셀이 가짜 ⭐
- `DestinationPreviewPanel`이 "1 / 3" 배지 + 점 3개를 그리는데, 실제 이미지는 `d.image` **1장뿐**.
- `data/types.ts`의 `Destination`에 `photos: DestinationImage[]` 없음.
- 문서 §5.2가 요구한 "2–3 destination-specific photos"는 **미구현 + 가짜 UI로 위장된 상태.**
- **선택지:** (a) `photos` 필드 추가 후 실제 캐러셀 구현, 또는 (b) MVP에선 가짜 점/배지 제거하고 단일 이미지로 정직하게.

### G3. CLAUDE.md / AGENTS.md가 없는 파일을 가리킴
- 두 파일 모두 `docs/skills/00~12-*.md`를 읽으라고 지시하지만 **`docs/skills/` 폴더가 존재하지 않음.**
- `.claude/skills/`엔 무관한 stub 3개(design-map, detail-page, plan-product)만 있음.
- **선택지:** (a) `docs/skills/` 실제 생성(특히 04-master-detail, 05-preview-panel, 10-guardrails), 또는 (b) CLAUDE.md/AGENTS.md에서 skill 참조 섹션 삭제. 지금은 "지키라는 규칙이 가리키는 파일이 없는" 상태라 에이전트가 혼란스러워한다.

### G4. 스타일링 방식 혼재
- 대부분 inline style인데 `FilterStrip.tsx`만 Tailwind 클래스. tailwind는 설정돼 있음.
- 큰 문제는 아니지만, G1 정리할 때 한 방식으로 통일 권장.

### G5. 잠재 버그 — 사소
- `HomepageClient` line 57 `const { compareList } = useCompare()` → 렌더에서 미사용(unused). tsc는 통과하나 정리 권장.
- `useIsDesktop` 초기값이 `window.innerWidth`를 읽음 → SSR은 `true`로 렌더, 모바일 클라이언트와 불일치 시 hydration 경고 가능(문서 §19.4가 경고한 패턴). CSS media query 기반으로 바꾸면 안전.

---

## 3. 다음 작업 우선순위

handoff 문서 §21 로드맵을 **코드 검증 결과로 갱신**한 버전:

1. **빌드 확정** — 로컬에서 `npm run build` 1회 통과 확인 (tsc는 이미 clean)
2. **필터 정리 (G1)** — FilterStrip 연결 vs RefineBar 유지 결정 → 한쪽으로 통일, dead code 제거
3. **사진 처리 (G2)** — 가짜 캐러셀 제거 또는 `photos[]` 추가해 실제 구현
4. **문서 정합성 (G3)** — `docs/skills/` 생성 또는 CLAUDE.md의 skill 참조 제거
5. **카드 위계 미세조정** — 문서 §6.5 (name/vibe/metric 가독성). 현재도 괜찮은 편
6. **이미지 audit** — destination별 이미지 정확도 점검(문서 §9.2 키워드 활용), 교체는 그 다음
7. **hydration 정리 (G5)** — useIsDesktop → CSS 기반

---

## 4. VS Code / Claude Code 작업 팁

- **typecheck script 추가** 권장 — `package.json`에 `"typecheck": "tsc --noEmit"` (현재 없음).
- 작업 전 읽기 순서(AGENTS.md): `CLAUDE.md` → `docs/PRD-v1.md` → `docs/data-policy.md` → `docs/destination-taxonomy.md` → 작업별 문서. (단 `docs/skills/*`는 G3 해결 전까진 존재 안 함에 주의.)
- 변경 최소 원칙 유지(AGENTS.md "smallest coherent change").
- preview panel에서 쓰는 데이터 필드는 전부 `Destination` 타입에 존재함 → master-detail 관련 추가 작업 시 타입 깨질 위험 낮음. 단 `photos` 추가(G2) 시에만 seed 데이터 동기화 필요.

---

## 5. 파일 맵 (빠른 참조)

```
app/page.tsx                              # 서버: weather fetch + HomepageClient 주입
app/destination/[slug]/page.tsx           # detail page
app/compare/page.tsx                      # compare page
components/homepage/HomepageClient.tsx    # ★ master-detail 핵심 (필터/선택/패널 오케스트레이션)
components/homepage/DestinationPreviewPanel.tsx  # ★ 우측/바텀시트 preview
components/homepage/RefineBar.tsx         # 현재 쓰는 필터(stay+no-car)
components/homepage/FilterStrip.tsx       # ⚠️ 미연결된 user-intent 필터 (G1)
components/homepage/CategoryRail.tsx      # 상단 9개 카테고리
components/cards/DestinationCard.tsx      # ★ 카드 (compare 클릭 분리 처리됨)
components/compare/CompareView.tsx        # compare 화면
lib/compare-context.tsx                   # compare 상태(max3 + localStorage)
lib/weather.ts                            # open-meteo 연동
lib/filters.ts                            # ⚠️ dead code (G1)
data/destinations.ts                      # 10개 destination 데이터
data/destinations-meta.ts                 # 카테고리/한글명/지역/일일예산/지도좌표
data/types.ts                             # 통제 어휘 + Destination 타입
```
