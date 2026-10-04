# Next A 준비 — 창업자용 설정 안내 (Supabase · 카톡 링크 · 앱 전환 · 푸시)

> 2026-10-02 기준, 2026-10-03 갱신(Now 3: 일주일 버티는 링크 N20 · 링크 첫 30초 N22 · '이번 주 우리 둘' N21 · 링크 연 날 카운터), 2026-10-04 갱신(N25 준비: **키를 받으면 몇 분 안에 확인하는 순서 — 바로 아래 '키를 받았을 때 빠른 순서'**, `scripts/verify-supabase.mjs`, `.env.local.example`, SQL 보완).

## 키를 받았을 때 빠른 순서 (N25, 2026-10-04)

키(URL·anon key)가 있으면 아래 네 가지만 하면 돼요. 막히면 확인 스크립트가 어느 단계에서 왜 막혔는지 한국어로 알려 줘요.

1. **SQL은 창업자가 Supabase에서 직접 실행해요.** anon 키로는 표를 만들 수 없어요(그래서 안전한 거예요). Supabase 대시보드 → **SQL Editor** → `supabase/schema.sql` 붙여 넣고 Run → 이어서 `supabase/policies.sql` Run. 둘 다 여러 번 실행해도 괜찮아요. 2026-10-04에 고친 SQL(`create_couple`이 앱이 만든 커플 id를 받음, `delete_couple` 추가)을 아직 안 돌렸다면 다시 한 번 실행해요.
2. **Claude Code 클라우드 환경이면 Network access에 `*.supabase.co`를 허용해요.** 지금 이 환경은 바깥 주소를 정책으로 막고 있어서, 허용하지 않으면 확인 스크립트가 1단계에서 '네트워크에서 막혔어요'로 끝나요. 세션 제목 줄의 클라우드 환경 메뉴 → **Edit** → **Network access** → **Custom** → **Allowed domains**에 `*.supabase.co`를 더해요. 패키지 매니저 기본 목록(npm 등)은 그대로 둬요(지우면 `npm ci`가 막혀요). 자세한 화면: https://code.claude.com/docs/en/cloud-environments#network-access
3. **환경 변수는 채팅이 아니라 환경 설정에 넣어요.** 같은 Edit 화면의 환경 변수(API credentials 칸이 있으면 그곳)에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 두 이름으로 넣어요. **새 세션부터** 읽혀요(지금 열린 세션에는 안 보여요). 내 컴퓨터라면 `cp .env.local.example .env.local` 뒤 값을 채워요(.env.local은 git에 안 올라가요). anon(또는 publishable) 키만 — service_role·secret 키는 스크립트가 거절해요.
4. **확인 스크립트를 돌려요**(`dulset/` 안에서):
   ```bash
   node scripts/verify-supabase.mjs
   ```
   환경 변수 → 없으면 `.env.local` 순서로 두 값을 읽고, 버리는 데이터로 앱과 똑같은 왕복을 해요: `create_couple → issue_token → publish_snapshot`(건강 기록이 하나도 없는 가짜 스냅숏) `→ snapshot_by_token → send_event → pull_events → record_link_open → link_open_days → revoke_token →` 해제 뒤 다시 읽기(**읽히면 FAIL**) `→ delete_couple`(만든 줄을 cascade로 모두 지움). 결과는 단계마다 PASS/FAIL·HTTP 상태·고칠 것 한 줄이에요. 키 값은 어디에도 출력하지 않아요(종류와 길이만).

| 스크립트가 말하는 것 | 뜻 | 할 일 |
|---|---|---|
| 네트워크에서 막혔어요 | 이 환경이 `*.supabase.co`로 못 나가요(또는 주소 오타) | 위 2번 — Network access 허용 |
| HTTP 404 | 함수가 없어요 = SQL을 안 돌렸거나 예전 SQL | 위 1번 — schema.sql → policies.sql 실행(방금 했으면 1분 뒤 다시) |
| HTTP 401 | 키가 틀렸거나 다른 프로젝트 것 | anon public 키를 다시 복사 |
| HTTP 403 | 키·정책(권한) 문제 | policies.sql 실행 여부, 키가 이 프로젝트 것인지 |
| HTTP 400 | 인자 모양이 다름 | schema.sql 최신본 다시 실행 |
| 해제 뒤 읽기 FAIL | 해제한 링크로 아직 읽혀요 | schema.sql 다시 실행(그대로면 다음 세션에 결과를 붙여 주세요) |
| 테스트 데이터 지우기 FAIL | `delete_couple`이 없음(예전 SQL) | 메모에 나온 `delete from public.couples where id = '…';`를 SQL Editor에서 실행 |

종료 코드: 0 모두 통과 · 1 한 단계 이상 FAIL · 2 두 값이 없거나 쓸 수 없는 키. 프록시가 있는 환경(클라우드)에서는 스크립트가 `NODE_USE_ENV_PROXY=1`로 자기 자신을 한 번 다시 실행해요(Node 22.21 이상). 스크립트의 요청 모양은 앱(`lib/sync/supabaseTransport.ts`)과 같은지 `tests/verifySupabase.test.ts`가 지켜요.

모두 PASS면: 같은 두 값으로 `npm run build` → 설정 › 데이터에 '연결: Supabase' → 아래 §5의 2~4번(실제 앱으로 한 번 더, `payload`에 생리·LH 날짜가 없는지 눈으로). 코드는 **지금도 서버 없이** 돌아요. 아래는 "남편용 설치 없는 웹 화면(①)"을 실제로 켤 때 창업자가 할 일과, 그다음 단계(② 앱 전환, ③ 실제 연결·푸시)에 필요한 계정·비용이에요. 가격은 각 회사 공식 페이지 기준으로 썼고 바뀔 수 있으니 결제 전에 한 번 더 확인해요.

## 0. 지금 상태 — 무엇이 되고 무엇이 모의인가

| 조각 | 지금 | 켜면 |
|---|---|---|
| 데이터 모델 | `schemaVersion: 4`(공유 범위 3단계 `settings.shareLevel`), 기록마다 `id`·`updatedAt`(저장할 때 `lib/store.tsx`가 바뀐 기록에 찍어요 — `lib/sync/model.ts` `stampChanges`; 톰스톤 `deletedAt` 자리), 결정(알렸어요·괜찮아요·남편 화면 이벤트 적용 표시)은 `decisions` 필드, 두 탭 동기화 표시는 상태 밖(`dulset:sync:v1`), 링크는 `couple.link`(커플 id + 토큰의 SHA-256 — 토큰 원문은 아내 폰 `dulset:link`에만), '링크에 표지 사진'은 `settings.coverOnLink`, 저장할 때 자동 마이그레이션 (`lib/sync/migrations.ts`) | 그대로 |
| 전송 (`lib/sync/transport.ts`) | **모의**: 같은 브라우저의 localStorage + BroadcastChannel. 탭 두 개가 두 폰이에요. 기기 밖으로 아무것도 안 나가요. 토큰은 처음 발급된 커플에 묶여요(다른 커플이 그 토큰으로 올리거나 해제하면 `foreign-token` 오류) | 빌드할 때 아래 환경 변수 두 개가 있으면 **Supabase** |
| 서버 쪽 | `supabase/schema.sql` + `policies.sql` 준비만 (실행해 본 적 없음) | SQL Editor에서 실행 |
| 남편 화면·카톡 공유·설정 표시 | 있어요: `/link/#t=<토큰>` 페이지(`app/link`, `components/link/*`), 설정 › 연결(링크 만들기·카톡으로 보내기·새 링크·해제·'링크에 표지 사진'), 온보딩 4화면의 '카톡으로 링크 보내기', 설정 › 데이터의 `TRANSPORT_LABEL` 줄. 모의 전송에서는 같은 브라우저의 다른 탭이 남편 폰이에요 | 그대로 (전송만 Supabase로) |
| 스냅숏 v2 (N20) | 아내 폰이 **오늘~+6일 7칸**을 한 번에 올려요(`days[]`, `validUntil` = 오늘+6). 남편 페이지는 자기 날짜의 칸을 그려서, 아내가 며칠 앱을 안 열어도 일주일은 그대로 돌아가요. 미래 칸은 그날 스냅숏과 똑같이 렌즈를 거치고, 예측만으로 바뀌는 '늦음'은 앞 칸을 그대로 둬요. 남편 이벤트는 **전송이 받은 시각**(`receivedAt` — 모의는 그 탭의 시계, 서버는 `created_at`)의 날짜로 검사해요 | 그대로 |
| 링크 첫 30초 (N22) | 처음 연 기기에 세 줄 카드('이게 뭐예요 · 지은님이 고른 것만 보여요 · 내 할 일 하나') + 습관 2문항·소식 받는 방식 → `setup` 이벤트. 링크를 만든 뒤 2주는 신청 단계가 맨 위. 카톡 안 브라우저면 '사파리/크롬으로 열기', 그 밖에는 '홈 화면에 두기' 카드(닫으면 그 기기에서 다시 안 떠요) | 그대로 |
| 링크 연 날 카운터 | 페이지를 열 때 한 번 `recordLinkOpen` — **토큰만** 보내요. 모의 전송은 이 브라우저 저장소에 (커플 id, 날짜) → 횟수로, Supabase는 `link_opens` 표에 같은 모양으로 남겨요. IP·기기·시각·내용 없음. **아내 화면에는 어떤 형태로도 보이지 않아요**(`positioning.md` §6) — 숫자는 연구 기간에 SQL로만 뽑아요(`supabase/README.md`) | `link_opens` 표 + `record_link_open` / `link_open_days` 함수 |
| 실제 두 폰 연결·푸시·앱 잠금 | 없음 (③·④) | — |

규칙은 그대로예요: **건강 기록(생리·LH·임테기·컨디션·나만 보기·관계일)은 어떤 전송에서도 기기 밖으로 나가지 않아요.** 서버로 가는 것은 아내 폰이 개인정보 렌즈를 거쳐 만든 "남편 화면 한 장"(`PartnerSnapshot`)과, 남편 화면이 보내는 id·날짜뿐인 작은 이벤트예요.

## 1. Supabase 프로젝트 만들기 (서울)

1. https://supabase.com 에서 가입 → **New project**.
2. **Region: Northeast Asia (Seoul)** — `ap-northeast-2`. 국내 리전이어야 개인정보 국외 이전 고지·동의(개인정보보호법 제28조의8, `docs/research/regulation.json`)를 피해요. 나중에 못 바꾸니 여기서 꼭 서울을 골라요.
3. Database password는 비밀번호 관리자에 저장해요(SQL Editor를 쓸 때는 필요 없지만 나중에 백업·마이그레이션 도구에서 써요).
4. 요금: **Free** 플랜으로 시작해도 돼요(2026-10 기준 프로젝트 2개, DB 500 MB, 일주일 동안 요청이 없으면 프로젝트가 잠시 멈춤 — 대시보드에서 다시 켤 수 있어요). 인터뷰 5쌍 수준이면 충분해요. 유료(Pro)는 월 US$25부터이고 멈춤이 없어요. 정확한 숫자는 https://supabase.com/pricing 에서 확인해요.

## 2. SQL 실행

SQL은 **창업자가 Supabase 대시보드에서 직접** 실행해요. 앱과 확인 스크립트가 쓰는 anon 키로는 표나 함수를 만들 수 없어요(그게 정상이고, 그래서 공개돼도 되는 키예요).

1. 왼쪽 메뉴 **SQL Editor** → New query.
2. `dulset/supabase/schema.sql` 내용을 붙여 넣고 **Run**. "Success. No rows returned"가 정상이에요.
3. 이어서 `dulset/supabase/policies.sql`을 같은 방법으로 Run.
4. **Table Editor**에 `couples` `couple_tokens` `partner_snapshots` `partner_events` `link_opens` 다섯 표가 보이고, 각 표 이름 옆에 RLS 자물쇠가 켜져 있으면 끝이에요. 바로 `node scripts/verify-supabase.mjs`로 함수까지 확인해요(맨 위 '빠른 순서' 4번). (`link_opens`는 5쌍 검증용 '링크 연 날' 카운터예요. 연구가 끝나면 지워요 — `supabase/README.md` '연구가 끝나면'.)
5. 오류가 나면 줄 번호와 메시지를 그대로 다음 작업 세션에 붙여 주세요(처음 실행이라 손볼 곳이 있을 수 있어요 — `supabase/README.md` 맨 위 경고).

## 3. URL과 anon key 찾기

**Project Settings(톱니) → API**:

- **Project URL** → `https://xxxxxxxx.supabase.co`
- **Project API keys → `anon` `public`** → 긴 문자열 (`eyJ…`)

`service_role` 키는 **절대** 앱이나 환경 변수에 넣지 않아요(모든 규칙을 우회해요). anon 키는 공개돼도 되는 키예요 — 표 접근이 전부 막혀 있고 함수만 열려 있어서요(`policies.sql`).

## 4. 환경 변수 넣기

앱은 빌드할 때 아래 두 이름을 읽어요(둘 다 있어야 Supabase, 하나라도 없으면 모의 전송).

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
```

- **내 컴퓨터에서**: `cp .env.local.example .env.local` 뒤 두 줄을 채워요(이 파일은 git에 올라가지 않아요 — `dulset/.gitignore`). `npm run build` 또는 `npm run dev`.
- **Claude Code 작업 환경(이 저장소의 클라우드 환경)**: 세션 제목 줄의 클라우드 환경 메뉴 → **Edit** → 환경 변수(API credentials 칸이 있으면 그곳)에 위 두 이름으로 값을 넣어요. **새 세션부터** 읽혀요. 값을 채팅에 붙여 넣지는 마세요 — 채팅 기록에 남아요. 같은 화면의 **Network access**에서 `*.supabase.co`도 허용해야 해요(Custom → Allowed domains, 패키지 매니저 기본값은 그대로).
- **Vercel 같은 호스팅**: 프로젝트 Settings → Environment Variables에 같은 두 이름. Preview와 Production을 따로 넣을 수 있어요.

주의: `NEXT_PUBLIC_` 접두사라서 빌드 결과(JS)에 값이 그대로 들어가요. anon 키는 그래도 되지만, 다른 비밀은 이 접두사로 넣지 않아요.

## 5. 확인하기

0. 먼저 `node scripts/verify-supabase.mjs` — 서버 함수 11단계를 버리는 데이터로 돌려 보고 PASS/FAIL 표를 보여 줘요(맨 위 '빠른 순서'). 여기서 모두 PASS면 아래는 앱 쪽 확인이에요.
1. 환경 변수를 넣고 `npm run build` → 앱의 **설정 › 데이터**에 **'연결: Supabase'**가 보이면 빌드가 변수를 읽은 거예요. ('연결: 이 기기 안 (모의)'면 변수가 비었거나 빌드 전에 넣지 않은 거예요.) — 설정 › 연결에도 같은 줄이 있어요; 코드의 문구는 `lib/sync/transport.ts` `TRANSPORT_LABEL`에 있어요.
2. 브라우저 개발자 도구 → Network에서 `rest/v1/rpc/create_couple` → `publish_snapshot` 호출이 200으로 끝나는지 봐요. 403이면 주인 키·토큰 검사에서 걸린 것, 400이면 인자 모양이 다른 것, 404면 SQL이 안 돌아간 거예요.
3. Supabase **Table Editor → partner_snapshots**에 한 줄이 생기고, `payload` 안에 생리·LH·임테기 날짜가 **없는지** 눈으로 확인해요(이름, 날짜별 카드 문구 7칸 `days[]`, 이번 달 할 일, 체크 항목 이름, 이번 주 고를 것 3개만 있어야 해요).
4. 다른 브라우저(또는 시크릿 창)에서 링크를 열어 남편 화면이 보이고, 거기서 체크 하나를 누르면 **partner_events**에 줄이 생기는지 봐요. 같은 순간 **link_opens**에 (커플, 오늘 날짜, 1) 한 줄이 생기면 카운터도 돌아가는 거예요(페이지를 다시 열면 `count`만 올라가요).

## 6. 아직 모의인 것 / 켜도 안 되는 것

- 남편 화면·카톡 공유·설정 › 연결(만료·해제·새 링크)은 모의 전송에서 끝까지 확인됐어요. Supabase 전송(`lib/sync/supabaseTransport.ts`)과 서버 함수는 실제 프로젝트에서 아직 한 번도 돌려 보지 않았어요 — `scripts/verify-supabase.mjs`가 첫 확인이에요(§5).
- 2026-10-04에 고친 것(첫 실행 전에 찾은 것): 앱은 커플 id를 폰에서 만들어 쓰는데 서버에 그 id를 등록하는 호출이 없어서, 실제 프로젝트에서는 첫 publish부터 403이 났을 거예요. 이제 전송이 issue·publish·pull 전에 `create_couple(주인 키, 그 id)`를 한 번 불러 등록해요(같은 키·id면 아무 일 없음). 새 키 체계의 publishable 키(`sb_publishable_…`)는 JWT가 아니라 `apikey` 헤더로만 보내요.
- 모의 전송에서 남편 링크의 '지금은 불러올 수 없어요'를 보려면: 링크 주소에 `?mockOffline=1`을 붙이거나 그 브라우저 localStorage에 `dulset:mock-offline` = `1`. 남편 쪽 호출만 막히고 아내 폰은 그대로 올려요(모의 전용 — 실제 전송에는 없는 스위치예요).
- 링크에 표지 사진을 켜도 사진 파일 자체는 서버로 가지 않아요(스냅샷에는 사진 id만). 같은 브라우저(모의)에서는 보이고, 실제 두 폰에서는 그림만 보여요 — 사진 전송은 ③에서 정해요.
- 실시간 갱신: 남편 화면은 주기적으로 다시 읽어요(폴링). Supabase Realtime은 ③에서.
- 아내 폰을 바꾸거나 브라우저 데이터를 지우면 주인 키가 사라져 링크가 죽어요 → 새 링크를 보내면 돼요. 복구는 ③(익명 로그인)에서.

## 7. 카카오톡 공유 흐름 (①에서 화면이 붙으면)

1. 아내 폰: 설정 › 연결 → **'링크 만들기'** → **'카톡으로 보내기'** → 앱이 랜덤 토큰을 만들고(첫 전송 때 토큰이 등록돼요, 30일) → 링크 `https://<앱 주소>/link/#t=<토큰>` (정적 export는 `out/link/index.html`이라 어떤 호스트에서도 열려요).
2. `navigator.share`(iOS는 공유 시트, Android는 카톡 선택)로 보내요. 카톡 미리보기(OG 태그)에는 **앱 이름만**, 건강 단어 없음 — `app/link/layout.tsx`가 제목 '둘셋'과 '설치 없이 보는 화면이에요'만 내보내고 검색 색인도 막아요(noindex).
3. 남편: 카톡 안 브라우저에서 링크가 열려요 — 설치 없이 바로 보여요. 맨 위에 '카카오톡 안에서 열었어요 · 사파리나 크롬으로 열면 홈 화면에 둘 수 있어요' 안내와 [사파리/크롬으로 열기](카카오톡의 `kakaotalk://web/openExternal`, 토큰이 든 주소 그대로) · [주소 복사]가 떠요. 사파리·크롬에서는 아래쪽에 '홈 화면에 두기' 카드(iPhone: 사파리 공유 → 홈 화면에 추가 / Android: 크롬 메뉴 → 홈 화면에 추가)가 떠요. 둘 다 ✕로 닫으면 그 기기에서는 다시 안 떠요(`components/link/LinkInstall.tsx`).
4. 처음 연 기기: 세 줄 카드('이게 뭐예요 · 지은님이 고른 것만 보여요 · 내 할 일 하나')와 30초 설정(담배·술 2문항, 소식 받는 방식). [이대로 시작하기]는 답한 것만 `setup` 이벤트로 보내고, [나중에 할게요]는 그대로 둬요(`components/link/LinkIntro.tsx`).
5. 남편 화면: 우리의 주간 띠 · 이번 달 할 일(링크를 만든 뒤 2주는 신청 단계가 맨 위) · '이번 주 우리 둘'(셋 중 하나 → [했어요], 내 준비 한 줄, 지은님의 고마워요) · 신호 답장 · 콕/응원 · 자기 체크. 생리·LH·임테기·컨디션·나만 보기는 **애초에 스냅샷에 없어요**.
6. 아내 폰이 열릴 때마다(그리고 기록이 바뀔 때) 오늘~+6일 스냅샷을 다시 올려요. 아내 폰이 일주일 넘게 안 열리면 남편 화면은 '새 화면은 곧 채워져요 · 지은님 폰이 열리면 다시 채워져요'로 바뀌고, 그동안에도 신호와 응원은 보낼 수 있어요. 링크는 30일 뒤 만료, 설정에서 언제든 해제.
7. 안내 문구에 넣을 것: "이 링크는 남편에게만 보내요. 링크가 있는 사람은 만료 전까지 이 화면을 볼 수 있어요."
8. (N31) 링크 아래 '매주 이 시간에 알려 받기': 남편이 요일을 고르면 그 자리에서 반복 .ics('둘셋 · 이번 주 우리', 매주 저녁 8시)를 만들어요. 캘린더에는 **토큰 없는 `/link/`**만 들어가고, 그 폰에서 열면 브라우저가 기억한 토큰(`dulset:link-token:v1`)으로 열려요. 서버로 가는 것은 없어요.
9. (N32) '병원과 함께' 모드가 켜져 있으면 링크의 카드 안에 앞으로 7일의 남편·'둘이 함께' 일정(날짜·시각·장소·종류 한 단어 — 제목·메모·시술·횟수는 없음)과 [같이 갈게요]가 보여요. 누르면 `join-appointment` 이벤트(일정 id만)가 가고, 아내 폰은 `decisions`에 남기고 🔔 하나로 알려요. 난임치료휴가 한 줄(남성 근로자도 · 2026-11-27부터 유급 4일, 연 6일)은 `docs/research/kr-programs.json`의 출처와 함께 보여요. 병원을 찾거나 추천하는 기능은 없어요.

### 7-1. 링크 연 날 (연구용 카운터, 2026-10-03 결정)

- 무엇을: 남편 페이지가 열릴 때 한 번, 그 링크의 커플이 **그날** 열었다는 것만. 페이지는 5초마다 다시 읽지만 그건 세지 않아요.
- 무엇을 안 남기나: IP, 기기·브라우저, 시각, 토큰 원문, 화면 내용. 서버는 토큰 해시로 커플을 찾고 서버의 서울 날짜로 (커플, 날짜) 횟수만 올려요(`supabase/schema.sql` `record_link_open`).
- 누가 보나: 연구하는 사람만, SQL로(`supabase/README.md` '연구 중에는'). **아내 앱에는 어떤 형태로도 보이지 않아요** — 읽음 표시는 압박이에요(`docs/positioning.md` §6·§7). 코드에 있는 `linkOpenDays`(주인 키로 서로 다른 날 수를 읽는 함수)는 연구 도구용이고 화면에 붙이지 않아요.
- 동의서: '링크를 연 날'을 저장하는 데이터 목록에 적어요(`positioning.md` §7 운영 규칙).
- 끝나면: 표와 두 함수를 지우거나 프로젝트째 지워요(`supabase/README.md` '연구가 끝나면'). 앱은 함수가 없어도 깨지지 않아요.
- 모의 전송에서는 이 브라우저의 `dulset:mock-sync:v1` 안 `opens`에 같은 모양으로 남아요(모든 기록 지우기로 함께 지워져요).

## 8. ② Capacitor 앱 전환 + 로컬 알림

- **코드**: 지금 정적 export(`out/`)를 Capacitor로 감싸요. 플러그인: `@capacitor/local-notifications`(엽산·LH 시각 — `CheckItem.remindAt`, `settings.personal[x].lhTestTime`), `@capacitor/share`(카톡 공유), `@capacitor/preferences`(localStorage 대신 안전한 저장 — iOS가 웹뷰 저장소를 지우는 문제 회피).
- **계정과 비용** (2026-10 기준, 공식 페이지에서 재확인):
  - **Apple Developer Program**: 연 US$99 (한국 결제 시 원화 환산). 개인 또는 법인. 법인은 D-U-N-S 번호 필요(무료, 1~2주). TestFlight 배포에도 필요해요.
  - **Google Play Console**: 일회성 US$25. 새 개인 계정은 일정 수의 테스터와 14일 비공개 테스트를 거쳐야 정식 출시가 가능해요(인원 기준은 바뀌니 콘솔 안내를 따라요).
  - **Mac**: iOS 빌드는 macOS + Xcode가 필요해요(없으면 클라우드 Mac 빌드 서비스를 빌려요).
- **스토어 신고**: Apple 5.1.3(건강 데이터), Google Play **Health apps declaration**(Period tracking·Reproductive and sexual health) — `docs/research/regulation.json`. 개인정보 처리방침 URL이 둘 다 필수예요(N18).
- 로컬 알림은 서버가 필요 없어요. 잠금화면 숨김(`discreet`)이 켜져 있으면 알림 본문에 건강 단어를 넣지 않는 규칙을 그대로 지켜요.

## 9. ③ 실제 연결·푸시

- **연결**: Supabase Auth **익명 로그인**(이메일 없이 기기당 사용자 1명) → 주인 키 대신 `auth.uid()`. 초대는 양쪽 수락(아내가 링크 → 남편 앱이 수락 → `couples.status = 'active'`). 원본 기록은 기록자 기기에만, 상대에게는 렌즈를 거친 스냅샷·이벤트만 — 지금 모델 그대로예요. `lib/sync/model.ts`의 `updatedAt` / `deletedAt`은 그때 두 기기 간 병합(마지막 수정 우선)에 써요.
- **푸시**: Firebase 프로젝트(무료) → FCM. iOS는 Apple Developer의 **APNs 키(.p8)**를 Firebase에 등록. Capacitor `@capacitor/push-notifications`. 서버에서는 Supabase **Edge Function + pg_cron**이 `lib/logic/notifications.ts`의 순수 규칙을 그대로 돌려 보내요.
- **국외 이전**: FCM/APNs는 해외에서 처리돼요. 알림 본문에 건강 단어를 넣지 않더라도(잠금화면 규칙) 처리위탁·국외이전 고지는 처리방침에 적어요(`regulation.json` PIPA 국외 이전 항목).
- **비용**: Firebase FCM 무료, Supabase Edge Function은 Free 플랜 한도 안, Pro면 월 US$25. 푸시 양이 작아요(하루 몇 건 × 부부 수).

## 10. ④ 앱 잠금·연결 해제

- 생체 잠금: `@capacitor-community/biometric-auth`(또는 동급) — 서버 불필요.
- 연결 해제 규칙(설정 › 데이터의 약속 그대로): 해제 전 두 사람 모두 사본 받기 → 삭제 7일 전·1일 전 알림 → `couples` 행 삭제(cascade로 토큰·스냅샷·이벤트 함께).
- 남편 첫 실행 시트(습관·알림 방식·잠금화면 숨김·동의)는 지금 `PartnerFirstRunSheet`를 앱에서 그대로 써요.

## 비용 한눈에 (2026-10 기준 추정)

| 항목 | 비용 | 언제 |
|---|---|---|
| Supabase Free | 0원 (멈춤 있음) | ① 지금 |
| Supabase Pro | 월 US$25 | 사용자가 생기면 |
| Apple Developer | 연 US$99 | ② |
| Google Play Console | 일회 US$25 | ② |
| Firebase (FCM) | 0원 | ③ |
| 도메인(앱 주소) | 연 1~2만 원 | ① (링크 주소) |

> 이 문서의 가격·한도는 공식 페이지 기준이지만 바뀌어요. 결제 전에 https://supabase.com/pricing, https://developer.apple.com/programs/, https://play.google.com/console 에서 확인해요.
