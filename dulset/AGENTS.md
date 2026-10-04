# AGENTS.md — 둘셋 (dulset)

Codex, Claude Code 등 코딩 에이전트가 이 폴더에서 일할 때 따르는 규칙이에요. `CLAUDE.md`도 이 파일을 그대로 가져다 써요. 현재 상태·백로그·인수인계 기록은 `docs/STATUS.md`에 있어요.

## 제품 한 줄

**남편이 같이 하는 임신 준비**(창업자 결정, 2026-10-03). 임신 준비가 아내 혼자의 일이 되지 않게 하는 앱이에요. 함께하는 사람(남편)은 무엇을 언제 할지 재촉 없이 알고, 주기를 기록하는 사람(아내)은 상대가 무엇을 볼지 정해요.

지금 담고 있는 것:
- 두 사람의 매일 체크
- 가임기 *예상*과 각자 고르는 알림
- 남편의 이번 달 할 일(한국 제도 기한)과 우리 신호
- 설치 없이 여는 남편용 링크(`/link`, 아직 모의 전송)
- 병원·검사·신청 로드맵과 '병원과 함께' 모드
- 우리 기록장(이야기·앨범·기념일)과 둘만의 시간 아이디어(`#date`) — 준비 단계에서는 뒤로 숨겨요(지우지 않아요)

임신한 뒤에는 임신 탭, 태어난 뒤에는 아기 탭과 육아일기로 이어져요. **중심 사용자는 임신 준비 중인 부부**이고, 임신·육아 기능은 그다음이에요. 화면에서는 역할어보다 이름과 '기록하는 사람 / 함께하는 사람'을 써요. 마케팅 헤드라인 아래에는 늘 서브카피('부부·예비부부·사실혼, 함께 준비하는 두 사람 누구나')를 붙여요. 무엇을 키우고, 유지하고, 숨기는지(지우지 않아요), 그리고 하지 않는 것(병원 찾기 포함)은 `docs/positioning.md`에 있어요.

## 명령어 (모두 `dulset/` 안에서)

```bash
npm ci               # 설치 (lockfile 기준)
npm run dev          # http://localhost:3000
npm test             # vitest — lib/logic 단위 테스트
npm run typecheck    # tsc --noEmit
npm run build        # next build → out/ (정적 export)
```

- `?today=YYYY-MM-DD`를 붙이면 앱의 오늘 날짜가 고정돼요(데모·재현용).
- 첫 화면의 '준비 중 예시 보기'를 누르면 가상 커플 민수·지은의 데이터가 채워져요. 임신 중·육아 중 예시는 설정 › 정보에 있어요(N27).
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
components/AppShell.tsx 상단 바(⇄ 화면 전환, 🔔 알림, ⚙️ 설정), 단계별 하단 탭(준비: 오늘 · 주기 · [+ 기록] · 챙길 것 · 우리)
components/tabs/*.tsx   TodayTab CycleTab PlanTab DateTab(#date, 탭 아님) UsTab(=#diary) PregnancyTab BabyTab SettingsTab
components/log/*        '+ 기록' 시트 (openLog()로 열어요, lib/logLauncher.ts)
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
- 새 상태 필드를 추가할 때는 다섯 곳을 모두 고쳐요: `lib/types.ts` → `lib/initial.ts` → `lib/storage.ts`의 `normalize` → `lib/logic/settings.ts`의 `sanitizeBackup`(검증) → `lib/demo.ts`(예시 데이터). 테스트도 함께 추가해요. 저장된 모양 자체가 바뀌면(필드 이동·이름 변경·stub → 필드) `lib/sync/migrations.ts`에 `SCHEMA_VERSION`을 올리고 단계를 하나 더해요(순수·멱등, `tests/syncModel.test.ts`).
- 단계 전환은 가드를 통과해야 해요: `canStartPregnancy` / `canRecordBirth` / `backToPreparing`. 다른 폰에 열려 있던 시트가 기록을 덮어쓰면 안 돼요.
- `window.confirm`/`alert`를 쓰지 않아요. 확인은 화면 안의 버튼으로 받아요.
- `Sheet`는 포털로 뜨고 뒤 배경을 `inert`로 막아요. `onClose`는 `useCallback`으로 고정된 함수를 넘겨요.
- 스타일은 테마 토큰만 써요: `bg-bg bg-surface bg-surface-2 border-line text-ink text-ink-2 text-ink-3 brand brand-soft brand-ink him her ok warn fert period (+ -soft)`. `gray-*`나 hex 색은 쓰지 않아요. 다크 모드는 `app/globals.css`의 CSS 변수로 바뀌고, 명도 대비는 4.5:1 이상으로 맞춰 뒀어요.
- 터치 영역은 44px 이상이에요. 아이콘만 있는 버튼에는 `aria-label`을 붙여요.
- **import 순환 주의**: `lib/logic/pregnancyView.ts` → `notifications.ts`로 이어지고, `lib/content/roadmap.ts`는 모듈 최상위에서 `prenatalKey` 같은 `const`를 호출해요. 그래서 `notifications.ts`, `appointments.ts`, `pregnancyView.ts`, `babyView.ts`에서 `content/roadmap`이나 `logic/plan`을 import하지 마세요. 로드맵이 필요한 알림은 `planNotices.ts`에 둬요. `lib/logic/settings.ts`는 다른 로직 파일을 많이 불러오니 `notifications.ts`, `anniversary.ts`, `cover.ts`, `pregnancy.ts`, `ttc.ts`, `prefs.ts`, `cycle.ts`, `positiveBleeding.ts`, `intimacy.ts`, `treatments.ts`, `logs.ts`에서 `settings.ts`를 import하지 마세요. `tests/integrationNextB.test.ts`가 `lib/logic` 안의 값 import 순환이 0개인지 검사해요.
- 코드 서식은 `.prettierrc`(세미콜론 없음 · 작은따옴표 · 끝 쉼표 · 140칸)를 따라요. 설정 없이 `prettier --write`를 돌리면 파일 전체가 큰따옴표·세미콜론·80칸으로 바뀌니 하지 마세요.
- 서버 호출은 두 가지만 해요: 남편 링크 전송(`lib/sync/transport.ts` — 아내 폰이 렌즈를 거쳐 만든 스냅숏과 남편의 이벤트)과 연구용 '링크 연 날' 카운터(커플 id·날짜·횟수만, 아내 화면에는 어떤 형태로도 보이지 않아요). 원본 건강 기록(생리·LH·임테기 기록, 컨디션·나만 보기·관계일)은 어느 쪽으로도 보내지 않아요. 분석·광고 SDK와 외부 폰트는 추가하지 않아요.

## 제품·문구 규칙 (꼭 지켜요)

- **말투**: 해요체로 따뜻하고 짧게 써요.
- **금지어**: 숙제, 실패, 노력, "오늘 꼭", "관계를 가져야". 가임기는 "둘만의 시간 / 우리의 주간"으로 표현해요.
- **예측은 항상 '예상'이에요.** 피임이나 진단 용도라고 쓰지 않아요. "정확한 배란일", "임신 성공률을 높여요" 같은 표현도 금지예요(의료기기 경계).
- 각자의 **알림 방식**(`settings.alertStyle[viewer]` = explicit / soft / off)과 **부담 줄이기 모드**(`lowPressureFor(settings, viewer)`)를 지켜요. soft·off인 사람에게는 가임기·배란·LH 같은 단어가 보이면 안 돼요. 예외: 주기 주인의 달력(`주기` 탭)과 '+ 기록' 시트는 자기 기록 도구라서 알림을 꺼도 그대로 보여요. 홈 카드·띠·알림은 알림 방식을 따라요.
- **공유 범위**: 주기 기록(생리·LH·임테기)은 주기 주인만 해요(`canLogCycle`). 상대가 무엇을 볼지는 주인이 정해요(`settings.shareLevel` = `none` 날짜 없음 / `week` 우리의 주간(기본) / `details` 자세히, `lib/logic/prefs.ts`의 `shareLevelOf` · `canSeeWeekBand` · `canSeeCycleDetails`). 넓히는 쪽은 주인의 동의를 한 번 더 받고, 좁히는 쪽은 바로 적용돼요. 화면을 새로 만들 때 `lib/logic/calendarView.ts`의 `cycleLens(state, viewer)`로 보이는 범위를 정해요.
  - 자세히가 아닌 상대의 화면은 `lib/logic/cycleRing.ts`의 `sharedWeek` 하나로 정해요(기록한 생리 시작일만 써요. LH·테스트는 안 쓰고, 생리 1~3일·쉬는 주기·병원과 함께·양성 확인 전에는 꺼져요). 날짜 없음이면 띠·날짜·주기 단계가 상대 화면 어디에도 없어요.
  - **알리지 않은 기록은 상대 화면을 바꾸지 않아요**(앱, 링크의 7일 칸 모두). 남편이 보는 것은 아내가 보낸 것(신호·[알리기]·공유 동의)이나 자기 것뿐이고, 화면이 바뀌는 것도 정보예요. `tests/leakInference.test.ts`·`tests/integrationNow3.test.ts`가 지켜요.
  - 상대에게는 횟수 문장('하루나 이틀에 한 번' 등)을 보이지 않아요(알림·달력·요약 모두).
  - 남편 화면의 우리의 주간 아이디어·`#date` 띠는 `lib/logic/dateIdeas.ts`의 `partnerHintState` 하나로 정해요(홈 카드·링크 아이디어·`dateBanner` 셋 다, 소스 검사 테스트가 지켜요). 남편의 주기 탭·홈·링크가 같은 창을 그리려면 `cycleLens`/`sharedWeek`에 `decisions`·`notifications`(아내가 [알리기]로 보낸 `period-told:<시작일>`)를 함께 넘겨요.
  - '해 줄 말 · 아껴 둘 말'(`lib/logic/signals.ts`의 `sayForTold`·`sayForSignal`)은 아내가 보낸 순간(신호, [알리기])에만 붙고, 앱과 링크가 같은 줄을 그려요(`components/signals/SayText.tsx`). 답 2개는 'signal' 이벤트로 돌아오고 `partnerEvents.toldAnswerOpen`이 그 카드가 있는 동안 한 번만 받아요.
  - 콕은 하루에 함께하는 사람 1번, 주기를 기록하는 사람 3번이에요(`notifications.ts`의 `nudgesPerDay`).
- **쉬는 주기·병원 확인 전**(`restCycle`, `positivePending`)에는 가임기 표시·알림·데이트 제안이 멈춰요. 판단은 `lib/logic/ttc.ts`의 `activeRest` / `activePositivePending`으로 해요.
- 주기 기록은 `lib/logic/logs.ts`(기록자·되돌리기·쉬는 주기 해제가 함께 처리돼요)나 `openLog()`로만 바꿔요.
- **잠금화면 숨김**(`discreet`)이 켜져 있으면 브라우저 알림과 .ics에 건강 용어를 넣지 않아요.
- **유산·임신 종료 배려**: 끝난 뒤 42일(`QUIET_DAYS_AFTER_END`) 동안은 축하·상담 알림이 나가지 않아요.
- 부부 둘 다 쓸 수 있게 써요. 콘텐츠의 대상은 성별이 아니라 `carrier / partner / both`(`lib/logic/roadmap.ts:39` `RoadmapWho`, 주기를 기록하는 사람 기준)로 정해요. 사람 역할(`lib/types.ts:32` `wife | husband | partner`)은 각자 고르는 호칭이에요(설정 › 우리 둘에 보이고, 이름이 비었을 때 부르는 말). 기능은 호칭이 아니라 `tracksCycle`(주기를 기록하는 사람)로 나눠요. 예비부부·사실혼 커플도 사용자예요.
- **의학·정부 지원·법 관련 숫자**는 `docs/research/*.json` 또는 `docs/research.md`에 근거가 있어야 해요. 콘텐츠에는 출처 URL과 시행일을 붙이고, "병원·회사·보건소마다 달라요"를 덧붙여요. 근거가 없으면 쓰지 않아요.
- 특정 영양제·보험·조리원 상품을 추천하지 않아요. 일반 정보만 줘요.

## 협업 규칙 (Claude Code ↔ Codex)

- **브랜치**: 작업마다 `codex/<주제>` 또는 `claude/<주제>`로 새로 만들고, PR로 합쳐요. 작게 나눠요.
- **동시 작업 금지**: 같은 파일을 두 에이전트가 동시에 고치지 않아요. 시작하기 전에 `docs/STATUS.md`의 "진행 중"에 이름을 적어요.
- **인수인계**: 끝나면 `docs/STATUS.md`의 "인수인계 기록"에 날짜, 에이전트, 바뀐 것, 확인한 것, 남은 문제를 남겨요.
- **커밋 메시지**: `feat(dulset): …`, `fix(dulset): …`, `docs(dulset): …`
- 이 레포의 `wherekorea/` 폴더(다른 프로젝트)는 건드리지 않아요.
