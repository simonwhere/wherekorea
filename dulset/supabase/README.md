# supabase/ — 남편용 웹 화면(파트너 링크)의 서버 쪽

> **아직 실제 프로젝트에서 돌려 본 적이 없어요.** 이 글을 쓰는 시점에 Supabase 프로젝트가 없어요. 클라이언트(`lib/sync/supabaseTransport.ts`)의 요청 모양은 가짜 fetch로 단위 테스트했고, SQL은 문법만 다시 읽었어요. 처음 돌릴 때는 `docs/next-a-setup.md`를 열어 두고 오류를 하나씩 맞춰 주세요.

| 파일 | 하는 일 | 실행 순서 |
|---|---|---|
| `schema.sql` | 표 4개 + 함수(RPC) 10개 | 1 |
| `policies.sql` | RLS 켜기, 표 접근 전부 막기, 함수만 열기 | 2 |

둘 다 여러 번 실행해도 괜찮아요(`if not exists` / `create or replace`).

## 표

| 표 | 내용 | 비밀 |
|---|---|---|
| `couples` | 커플 공간 하나에 한 줄 | 주인(주기를 기록하는 폰) 기기 키의 SHA-256만 |
| `couple_tokens` | 아내가 보내는 링크의 토큰 | 해시만, 만료일(`expires_at`), 해제(`revoked_at`) |
| `partner_snapshots` | 아내 폰이 **개인정보 렌즈를 거쳐** 만든 `PartnerSnapshot` (`lib/logic/partnerSnapshot.ts`) — 남편 화면에 보이는 것 그대로 | 생리·LH·임테기 기록, 나만 보기, 컨디션, 관계일은 애초에 들어오지 않아요 |
| `partner_events` | 남편 화면이 보내는 것: 체크·답장·신호·콕·응원·이번 달 할 일 — id와 날짜만 (`lib/logic/partnerEvents.ts`) | 자유 텍스트 없음 |

## 함수(RPC) — `POST /rest/v1/rpc/<이름>`

| 쪽 | 함수 | 검사 |
|---|---|---|
| 아내 폰 | `create_couple(p_owner_key)` → uuid | 키 32자 이상 |
| 아내 폰 | `issue_token(p_owner_key, p_couple_id, p_token, p_days=30)` → 만료 시각 | 주인 키 일치, 1~90일 |
| 아내 폰 | `revoke_token(...)` | 주인 키 일치 |
| 아내 폰 | `publish_snapshot(p_owner_key, p_couple_id, p_token, p_payload, p_published_at)` → 버전 | 주인 키, 64 KB, 토큰 처음 쓰면 30일로 발급, 최근 3개 버전만 보관 |
| 아내 폰 | `pull_events(p_owner_key, p_couple_id, p_since)` → 줄들 | 주인 키, 200개 |
| 아내 폰 | `mark_events_read(p_owner_key, p_couple_id, p_ids)` → 바뀐 수 | 주인 키 |
| 남편 브라우저 | `snapshot_by_token(p_token)` → 최신 1줄 또는 0줄 | 살아 있는 토큰(만료·해제 아님) — 아니면 **오류가 아니라 0줄** |
| 남편 브라우저 | `send_event(p_token, p_event_id, p_kind, p_payload)` | 살아 있는 토큰, id 64자·kind 40자·4 KB, 하루 200개, 같은 id는 무시 |

내부 도우미(`dulset_hash`, `dulset_owner_couple`, `dulset_token_couple`, `dulset_cleanup`)는 API에서 부를 수 없어요(`policies.sql`).

### 왜 토큰 해시를 서버에서 만들어요?

클라이언트가 해시를 보내면 그 해시가 곧 비밀이 돼요(DB가 새면 해시로 바로 읽을 수 있음). 그래서 **토큰 원문이 TLS 안에서 RPC 인자로 오고, 서버가 pgcrypto `digest`로 해시해 저장된 해시와 비교**해요. 저장소에는 원문이 없어요.

## 접근 규칙 (`policies.sql`)

- 표 4개 모두 RLS 켬 + **정책 0개** + anon/authenticated에서 모든 권한 회수 → API로 표를 직접 읽거나 쓸 수 없어요.
- 함수는 `security definer`라 소유자(SQL을 실행한 역할) 권한으로 돌아요. 각 함수가 주인 키 또는 토큰을 스스로 검사해요.
- PostgREST는 `errcode 42501`을 HTTP 403으로, `22023`은 400으로 돌려줘요. 클라이언트는 `SupabaseTransportError(code: 'http', status)`로 받아요.

## 솔직한 한계 (지금 단계)

1. **토큰이 곧 비밀**이에요. 링크가 새면 만료(최대 90일)나 해제 전까지 스냅샷을 읽을 수 있어요. 카톡으로 보낼 때 "이 링크는 남편에게만"을 화면에 적어요.
2. **주인 키가 곧 비밀**이에요. 아내 폰 localStorage(`dulset:sync:ownerKey`)에 있고, 브라우저 데이터를 지우면 사라져요 → 새 커플 id가 만들어지고 예전 링크는 죽어요. 복구 방법이 없어요(의도).
3. anon key는 공개 키예요. 남용은 함수 안의 크기·횟수 검사와 Supabase 자체 한도로만 막아요.
4. 누가 언제 읽었는지는 `created_at` / `read_at` 외에 기록하지 않아요.
5. 스냅샷은 **평문 jsonb**예요(민감 기록은 애초에 안 들어오지만, 이름·오늘의 카드 문구는 들어가요). 서울 리전을 고르는 이유예요(`docs/research/regulation.json` PIPA 국외 이전).

②·③에서 **Supabase Auth 익명 로그인**으로 바꾸면 1·2·4가 해결돼요: 주인 키 대신 `auth.uid()`를 RLS 정책에서 비교하고, 기기 해제는 사용자 삭제가 돼요. 그때 `dulset_owner_couple`만 바꾸면 나머지 함수는 그대로예요.

## 정리 작업 (선택)

`dulset_cleanup()`은 30일 지난 이벤트, 7일 지난 옛 스냅샷(최신 1개는 남김), 만료 뒤 30일 지난 토큰을 지워요. Dashboard → Database → Extensions에서 `pg_cron`을 켜고 `policies.sql` 끝의 주석처럼 하루 한 번 걸어 두면 돼요.

## 클라이언트와 맞춰야 하는 것

`lib/sync/supabaseTransport.ts`가 부르는 함수 이름·인자 이름(`p_…`)이 여기와 같아야 해요. 바꾸면 `tests/syncTransport.test.ts`도 같이 바꿔요.
