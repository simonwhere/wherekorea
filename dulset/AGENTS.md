# AGENTS.md — 둘셋 (dulset)

Codex, Claude Code 등 코딩 에이전트가 이 폴더에서 일할 때 따르는 규칙이에요. `CLAUDE.md`도 이 파일을 그대로 가져다 써요. 현재 상태·백로그·인수인계 기록은 `docs/STATUS.md`에 있어요.

## 제품 한 줄

**임신을 준비하는 부부가 같이 쓰는 앱이에요.** 두 사람의 매일 체크, 가임기 *예상*과 함께 받는 알림, 병원·검사·신청 로드맵, 둘만의 시간(데이트)을 담고 있어요. 임신한 뒤에는 임신 탭, 태어난 뒤에는 아기 탭과 육아일기로 이어져요. **중심 사용자는 임신 준비 중인 부부**예요(창업자 방향). 임신·육아 기능은 그다음이에요.

## 명령어 (모두 `dulset/` 안에서)

```bash
npm ci               # 설치 (lockfile 기준)
npm run dev          # http://localhost:3000
npm test             # vitest — lib/logic 단위 테스트
npm run typecheck    # tsc --noEmit
npm run build        # next build → out/ (정적 export)
```

- `?today=YYYY-MM-DD`를 붙이면 앱의 오늘 날짜가 고정돼요(데모·재현용).
- 첫 화면의 "예시로 둘러보기"(준비 중 / 임신 중 / 육아 중)를 누르면 가상 커플 민수·지은의 데이터가 채워져요.
- 네트워크 없이도 전부 동작해요. 외부 API 호출, 외부 폰트·분석 SDK가 없어요.

## 완료 기준 (PR 전에 반드시)

1. `npm run typecheck` 통과
2. `npm test` 통과. 로직을 바꿨으면 `tests/`에 테스트를 추가하거나 고쳐요.
3. `npm run build` 통과
4. UI를 바꿨으면 390px 폭에서 라이트·다크 모드로 직접 확인해요(가로 스크롤 없음, 콘솔 에러 없음).
5. `docs/STATUS.md`의 인수인계 기록에 한 줄을 남겨요.

## 구조

```
app/page.tsx            한 페이지짜리 앱. 탭 이동은 해시(#today …)로 해요.
components/AppShell.tsx 상단 바(⇄ 화면 전환, 🔔 알림, ⚙️ 설정), 단계별 하단 탭
components/tabs/*.tsx   TodayTab CycleTab PlanTab DateTab UsTab(=#diary) PregnancyTab BabyTab SettingsTab
components/<기능>/*     화면 조각: today cycle plan date diary us pregnancy baby settings onboarding signals
components/ui/index.tsx 공통 UI: Card Button Chip Toggle Field Sheet EmptyState Avatar useToast NumberStepper …
lib/types.ts            도메인 타입 (AppState가 앱 전체 상태)
lib/store.tsx           StoreProvider · useApp() → { state, update, today, me, partner, cycleOwner, viewer, setViewer, replace }
lib/storage.ts          localStorage 저장, normalize(새 필드 기본값), parseState → sanitizeBackup
lib/logic/*.ts          순수 함수 로직 (cycle, checks, notifications, plan, roadmap, appointments, anniversary, …)
lib/content/*.ts        콘텐츠 데이터 (roadmap 60개 항목, programs 정부 지원, supplements, dateIdeas, pregnancy, baby, fertility)
lib/useNotificationEngine.ts  알림 규칙을 실행해 앱 안 알림함에 쌓아요
tests/*.test.ts         vitest
docs/                   research.md (시장·근거), research/*.json (조사 원자료), next-steps.md (서버·출시 계획), STATUS.md
```

- **단계(stage)**: `preparing | pregnant | parenting`. 단계마다 하단 탭이 달라요(`AppShell.tsx`의 `TAB_SETS`).
- **두 사람**: 멤버 id는 `'a' | 'b'`이고, `tracksCycle`인 사람이 주기를 기록해요. 폰마다 보는 사람(`viewer`)은 탭별 sessionStorage에 있어요. 프로토타입에서는 ⇄ 버튼이나 브라우저 탭 두 개로 두 사람을 흉내 내요.
- **알림**: `lib/logic/notifications.ts`의 `scheduledNotices`와 `lib/logic/planNotices.ts`(병원 일정·법정 기한)를 `useNotificationEngine`이 합쳐서 `key`로 중복을 걸러요. 알림을 눌렀을 때 이동할 곳은 `lib/logic/today.ts`의 `noticeTarget`이 key 접두사(`anniv:` `appt:` `deadline:` `reaction:`)로 정해요.

## 코드 규칙

- 상태는 `update((s) => 순수함수(s, …))`로만 바꿔요. 순수 함수는 `lib/logic/<기능>.ts`에 두고 `tests/`에서 테스트해요. 상태를 직접 수정(mutate)하지 않아요.
- "오늘"은 항상 `useApp().today`를 써요. 날짜 로직에 `new Date()`를 쓰지 않아요. 시각이 필요하면 `stampOn(today)`(`lib/logic/today.ts`)을 써요.
- 날짜는 `'YYYY-MM-DD'` 문자열이고, 계산은 `lib/dates.ts`(`addDays`, `diffDays`, `addMonths`, `formatKo`, `dLabel` …)로 해요.
- 한국식 날짜 세기: 시작일이 1일이에요. 백일·100일은 시작일 + 99일이고, "생후 60일 안에"는 출생일을 1일째로 세요.
- 새 상태 필드를 추가할 때는 다섯 곳을 모두 고쳐요: `lib/types.ts` → `lib/initial.ts` → `lib/storage.ts`의 `normalize` → `lib/logic/settings.ts`의 `sanitizeBackup`(검증) → `lib/demo.ts`(예시 데이터). 테스트도 함께 추가해요.
- 단계 전환은 가드를 통과해야 해요: `canStartPregnancy` / `canRecordBirth` / `backToPreparing`. 다른 폰에 열려 있던 시트가 기록을 덮어쓰면 안 돼요.
- `window.confirm`/`alert`를 쓰지 않아요. 확인은 화면 안의 버튼으로 받아요.
- `Sheet`는 포털로 뜨고 뒤 배경을 `inert`로 막아요. `onClose`는 `useCallback`으로 고정된 함수를 넘겨요.
- 스타일은 테마 토큰만 써요: `bg-bg bg-surface bg-surface-2 border-line text-ink text-ink-2 text-ink-3 brand brand-soft brand-ink him her ok warn fert period (+ -soft)`. `gray-*`나 hex 색은 쓰지 않아요. 다크 모드는 `app/globals.css`의 CSS 변수로 바뀌고, 명도 대비는 4.5:1 이상으로 맞춰 뒀어요.
- 터치 영역은 44px 이상이에요. 아이콘만 있는 버튼에는 `aria-label`을 붙여요.
- **import 순환 주의**: `lib/logic/pregnancyView.ts` → `notifications.ts`로 이어지고, `lib/content/roadmap.ts`는 모듈 최상위에서 `prenatalKey` 같은 `const`를 호출해요. 그래서 `notifications.ts`, `appointments.ts`, `pregnancyView.ts`, `babyView.ts`에서 `content/roadmap`이나 `logic/plan`을 import하지 마세요. 로드맵이 필요한 알림은 `planNotices.ts`에 둬요.
- 서버 호출, 분석·광고 SDK, 외부 폰트를 추가하지 않아요. 건강 데이터는 기기 밖으로 나가지 않아요(프로토타입 원칙).

## 제품·문구 규칙 (꼭 지켜요)

- **말투**: 해요체로 따뜻하고 짧게 써요.
- **금지어**: 숙제, 실패, 노력, "오늘 꼭", "관계를 가져야". 가임기는 "둘만의 시간 / 우리의 주간"으로 표현해요.
- **예측은 항상 '예상'이에요.** 피임이나 진단 용도라고 쓰지 않아요. "정확한 배란일", "임신 성공률을 높여요" 같은 표현도 금지예요(의료기기 경계).
- 각자의 **알림 방식**(`settings.alertStyle[viewer]` = explicit / soft / off)과 **부담 줄이기 모드**(`lowPressure`)를 지켜요. soft·off인 사람에게는 가임기·배란 같은 단어가 보이면 안 돼요.
- **잠금화면 숨김**(`discreet`)이 켜져 있으면 브라우저 알림과 .ics에 건강 용어를 넣지 않아요.
- **유산·임신 종료 배려**: 끝난 뒤 42일(`QUIET_DAYS_AFTER_END`) 동안은 축하·상담 알림이 나가지 않아요.
- 부부 둘 다 쓸 수 있게 써요. 역할은 `carrier / partner / both`예요. 예비부부·사실혼 커플도 사용자예요.
- **의학·정부 지원·법 관련 숫자**는 `docs/research/*.json` 또는 `docs/research.md`에 근거가 있어야 해요. 콘텐츠에는 출처 URL과 시행일을 붙이고, "병원·회사·보건소마다 달라요"를 덧붙여요. 근거가 없으면 쓰지 않아요.
- 특정 영양제·보험·조리원 상품을 추천하지 않아요. 일반 정보만 줘요.

## 협업 규칙 (Claude Code ↔ Codex)

- **브랜치**: 작업마다 `codex/<주제>` 또는 `claude/<주제>`로 새로 만들고, PR로 합쳐요. 작게 나눠요.
- **동시 작업 금지**: 같은 파일을 두 에이전트가 동시에 고치지 않아요. 시작하기 전에 `docs/STATUS.md`의 "진행 중"에 이름을 적어요.
- **인수인계**: 끝나면 `docs/STATUS.md`의 "인수인계 기록"에 날짜, 에이전트, 바뀐 것, 확인한 것, 남은 문제를 남겨요.
- **커밋 메시지**: `feat(dulset): …`, `fix(dulset): …`, `docs(dulset): …`
- 이 레포의 `wherekorea/` 폴더(다른 프로젝트)는 건드리지 않아요.
