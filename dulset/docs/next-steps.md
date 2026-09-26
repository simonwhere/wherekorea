# 둘셋 — 프로토타입에서 실제 앱으로

프로토타입은 "한 기기 + 로컬 저장"이에요. 두 사람의 **폰이 실제로 연결되고, 두 폰에 푸시가 가려면** 아래가 필요해요.

## 1. 추천 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 앱 | 지금 코드(Next.js 정적 export)를 **Capacitor**로 감싸 iOS/Android 앱 | 코드 재사용. 로컬 알림·푸시 플러그인 있음 |
| 서버·DB·인증 | **Supabase** (Postgres + Row Level Security, 국내 리전 없음 → 국외 이전 고지 필요) 또는 국내 클라우드 + 자체 API | RLS로 "연결된 두 사람만" 접근 규칙을 DB에서 강제 |
| 푸시 | FCM(안드로이드) / APNs(iOS). 서버 스케줄러(Supabase cron/Edge Function)가 `lib/logic/notifications.ts`의 규칙을 그대로 실행 | 규칙은 이미 순수 함수라 서버로 옮기기 쉬움 |
| 파트너 초대 | 카카오톡 공유 링크 → 앱 설치 전에는 웹으로 먼저 보기 | 핑크다이어리처럼 남성 진입장벽 낮추기 |

## 2. 데이터 모델 (초안)

```sql
-- 커플 공간. 두 사람이 모두 수락해야 active.
create table couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  created_by uuid not null references auth.users,
  status text not null default 'pending' check (status in ('pending','active','unlinked')),
  stage text not null default 'preparing',
  created_at timestamptz default now()
);

create table couple_members (
  couple_id uuid references couples on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null,               -- wife | husband | partner
  tracks_cycle boolean not null default false,
  alert_style text not null default 'soft',  -- explicit | soft | off (본인만 수정)
  sensitive_consent_at timestamptz,  -- 민감정보 별도 동의
  share_consent_at timestamptz,      -- 파트너 공유 별도 동의
  primary key (couple_id, user_id)
);

-- 공유 범위: 주기를 기록하는 사람이 항목별로 켜고 끔
create table share_settings (
  couple_id uuid references couples on delete cascade,
  owner_id uuid references auth.users,
  share_fertile_window boolean default true,
  share_period_days boolean default false,
  share_lh_tests boolean default false,
  primary key (couple_id, owner_id)
);

create table period_logs (id uuid primary key default gen_random_uuid(), couple_id uuid, owner_id uuid, start_date date not null, end_date date);
create table lh_tests    (couple_id uuid, owner_id uuid, test_date date, result text, primary key (couple_id, owner_id, test_date));
create table check_items (id uuid primary key default gen_random_uuid(), couple_id uuid, owner_id uuid, label text, kind text, note text, created_on date, archived_on date);
create table check_logs  (item_id uuid references check_items on delete cascade, log_date date, primary key (item_id, log_date));
create table notifications (id uuid primary key default gen_random_uuid(), couple_id uuid, to_user uuid, from_user uuid, kind text, title text, body text, dedup_key text, read_at timestamptz, created_at timestamptz default now(), unique (to_user, dedup_key));
create table diary_entries (id uuid primary key default gen_random_uuid(), couple_id uuid, author_id uuid, entry_date date, stage text, body text, mood text, photo_path text, created_at timestamptz default now());
```

**RLS 핵심 규칙**
- 모든 테이블: `couple_id`가 내가 속한 **active** 커플일 때만 읽기.
- `period_logs`, `lh_tests`: 쓰기는 `owner_id = auth.uid()` 또는 (공유 설정에서 허용한 경우) 파트너. 읽기는 본인 + 공유 범위가 켜진 항목만.
- `couple_members.alert_style`: 본인만 수정.
- 연결 해제(`status = 'unlinked'`) 즉시 상대 데이터 읽기 차단. 각자 자기 데이터를 내보내고 삭제할 수 있게 해요.
- 사진: Supabase Storage 비공개 버킷, 커플 단위 경로, 서명 URL만 사용.

## 3. 알림

- 서버가 매일 아침(예: 08:50 KST) 커플마다 `scheduledNotices(state, today)`를 실행해요. `dedup_key` 유니크 제약이 있어서 같은 알림을 두 번 보내지 않아요.
- 잠금화면 문구: 기본은 "둘셋 — 새 알림이 있어요". 앱 안에서만 자세히 보여요(iOS `hiddenPreviewsBodyPlaceholder`, Android `VISIBILITY_PRIVATE` + `setPublicVersion`).
- 콕·응원·우리 신호는 즉시 푸시해요. 하루 한도는 서버에서도 강제해요.
- 광고성 알림(제휴 데이트 등)은 **별도 채널, 별도 동의**, 21~08시 발송 금지(정보통신망법 제50조).

## 4. 출시 전 체크리스트

- [ ] 식약처에 의료기기 해당 여부 질의 (가임기 '추정' 표시만, 피임·진단 문구 없음 유지)
- [ ] 개인정보 처리방침, 민감정보 별도 동의, 파트너 공유 동의 (각자)
- [ ] 광고·분석 SDK 없음 확인 (건강 화면 이벤트에 주기 정보 넣지 않기)
- [ ] App Store 개인정보 라벨(Health, Sensitive Info), Google Play Health apps declaration
- [ ] 계정 삭제·데이터 내보내기 기능, 연결 해제 흐름
- [ ] 정부 지원사업 콘텐츠를 서버에서 관리(시행일·출처), 분기마다 갱신
- [ ] 경쟁 앱(KONOTOKI, 핑크다이어리 커플커넥트, 베이비빌리, Soonr) 직접 설치해 비교
- [ ] 난임 장기화·유산 상황에서 알림·데이트 제안을 조용히 끄는 흐름 사용자 테스트

## 5. 수익 모델 후보

- **부부 1구독**(두 사람 이용): 핑크다이어리 커플커넥트 월 2,500원이 시장 가격대 참고
- 포토북(육아일기 인쇄)
- ❌ 건강 데이터 기반 광고 타기팅은 하지 않아요 (Flo, Premom 제재 사례)
- △ 영양제 커머스: 효능 표현 금지, 건강기능식품 광고 자율심의 대상
