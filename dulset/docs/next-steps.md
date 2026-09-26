# 둘셋 — 프로토타입에서 실제 앱으로

프로토타입은 "한 기기 + 로컬 저장"이에요. 두 사람의 **폰이 실제로 연결되고, 두 폰에 푸시가 가려면** 아래가 필요해요.

## 1. 추천 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 앱 | 지금 코드(Next.js 정적 export)를 **Capacitor**로 감싸 iOS/Android 앱 | 코드 재사용. 로컬 알림·푸시 플러그인 있음 |
| 서버·DB·인증 | **Supabase** (Postgres + Row Level Security). **서울 리전(ap-northeast-2)**을 고르면 DB·인증·스토리지를 국내에 둘 수 있어요. 다만 푸시(FCM/APNs)·이메일 같은 부가 서비스는 해외에서 처리되니 처리위탁·국외이전 고지는 따로 점검해요. 또는 국내 클라우드 + 자체 API | RLS로 "연결된 두 사람만" 접근 규칙을 DB에서 강제 |
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
create table diary_reactions (entry_id uuid references diary_entries on delete cascade, user_id uuid, emoji text, primary key (entry_id, user_id));

-- 우리 둘의 날 (기록장 레이어 — 건강 기록과 분리)
alter table couples add column met_on date, add column married_on date;
create table anniversaries (id uuid primary key default gen_random_uuid(), couple_id uuid references couples on delete cascade, title text not null, on_date date not null, yearly boolean not null default true, emoji text);

-- 챙길 것: 템플릿은 서버 콘텐츠(시행일·출처 버전 관리), 진행 상황만 커플 데이터
create table plan_done (couple_id uuid references couples on delete cascade, template_id text, done_on date not null, done_by uuid, primary key (couple_id, template_id));
create table custom_tasks (id uuid primary key default gen_random_uuid(), couple_id uuid references couples on delete cascade, title text not null, phase text not null, who text not null, due_on date, done_on date, done_by uuid, created_by uuid);
create table appointments (id uuid primary key default gen_random_uuid(), couple_id uuid references couples on delete cascade, on_date date not null, at_time time, title text not null, place text, who text not null, kind text not null, note text, task_id text, created_by uuid, done boolean default false);
```

**RLS 핵심 규칙**
- 모든 테이블: `couple_id`가 내가 속한 **active** 커플일 때만 읽기.
- `period_logs`, `lh_tests`: 쓰기는 `owner_id = auth.uid()` 또는 (공유 설정에서 허용한 경우) 파트너. 읽기는 본인 + 공유 범위가 켜진 항목만.
- `couple_members.alert_style`: 본인만 수정.
- 연결 해제(`status = 'unlinked'`) 즉시 상대 데이터 읽기 차단. 각자 자기 데이터를 내보내고 삭제할 수 있게 해요.
- 사진: Supabase Storage 비공개 버킷, 커플 단위 경로, 서명 URL만 사용.

병원 예약·검사 일정은 산전검사·정액검사·난임 상담처럼 민감할 수 있어요. 기본 공개 범위는 '둘만'으로 두고, 양가 가족과 나누는 기능이 생겨도 고른 일정만 공유해요.

## 3. 알림

- 서버가 매일 아침(예: 08:50 KST) 커플마다 `scheduledNotices(state, today)`를 실행해요. `dedup_key` 유니크 제약이 있어서 같은 알림을 두 번 보내지 않아요.
- 잠금화면 문구: 기본은 "둘셋 — 새 알림이 있어요". 앱 안에서만 자세히 보여요(iOS `hiddenPreviewsBodyPlaceholder`, Android `VISIBILITY_PRIVATE` + `setPublicVersion`).
- 콕·응원·우리 신호는 즉시 푸시해요. 하루 한도는 서버에서도 강제해요.
- 병원 예약은 전날·당일, 기념일은 7일 전·당일에 보내요(`appointmentNotices`, `anniversaryNotices`). 잠금화면에는 "둘셋 일정"처럼 중립적으로만 보여요.
- 홈 화면·잠금화면 위젯을 만든다면 기본은 '우리 D+1234'만 보여 주고, 가임기·임신 주수는 본인이 켤 때만 보여요.
- 광고성 알림(제휴 데이트 등)은 **별도 채널, 별도 동의**, 21~08시 발송 금지(정보통신망법 제50조).

## 4. 기록장(우리 탭) 원칙

비트윈·썸원·みてね를 살펴보고 정한 약속이에요 (조사 확인일 2026-09-26, 보도·고객센터 자료 기준). 비트윈은 2025-09에 무료 이용자의 앨범 사진이 복구할 수 없게 삭제되는 사고가 있었어요. 기록장에서 사용자가 가장 두려워하는 건 기록이 사라지는 거예요.

1. **내보내기는 언제나 무료**: 지금도 백업(.json)과 '우리 이야기'(HTML) 내보내기는 무료예요. 서버가 생기면 사진 원본 + JSON + HTML을 묶은 ZIP 전체 내보내기를 무료로 두고, 월 1회 백업 알림을 보내요. 해지한 뒤에도 기록 읽기와 내보내기는 막지 않아요. 유료는 인쇄(포토북)·원본 백업·테마 같은 것만, 한 사람이 결제하면 둘 다 쓰는 커플 1구독으로 해요.
2. **v1에 1:1 채팅은 넣지 않기**: 부부 대화는 이미 카카오톡(국내 MAU 약 4,963만, 2026년 2분기)에서 해요. 채팅은 서버 부담·보관 비용·암호화 부담이 가장 큰 기능이고, 비트윈 사고도 채팅 미디어 보관 비용을 줄이려던 약관 개정에서 시작됐어요. 대신 기록마다 짧은 리액션(지금 구현), 필요하면 기록 단위 댓글과 카톡 공유 링크로 해요.
3. **종단간 암호화(E2EE)는 다음 단계에**: v0(지금)은 기기에만 저장. v1은 텍스트 기록·일정·기념일만 두 기기에 동기화하되 서버는 암호화된 변경분만 중계해요(CRDT를 쓴다면 암호화 중계는 직접 만들어야 해요). 초대할 때 WebCrypto로 커플 키를 교환(ECDH)하고 기기에서 암호화(AES-GCM)해요. 두 사람의 폰 OS가 다를 수 있어 플랫폼 기능(iCloud 등)에 기대지 않아요. 사진은 축소본만 동기화하고 원본은 찍은 기기에 둬요. v2에서 원본 암호화 백업을 더해도, 운영사가 사라지면 기록은 기기에 남아요.
4. **사진 보관 약속은 처음부터 보수적으로**: '무제한'을 약속하지 않고 무료 한도를 처음부터 밝혀요. 줄여야 할 일이 생기면 충분히 미리, 내보내기 방법과 함께 알려요.
5. **연결 해제·이별 때의 데이터 규칙을 미리 정하기**: 비트윈은 연결을 끊으면 30일 뒤, 썸원은 30일(골드 90일) 뒤 영구 삭제해요. 둘셋은 해제할 때 두 사람 모두 자기 사본을 내려받을 수 있게 하고, 소유권은 작성자 기준으로 두되 아기 기록은 두 부모 모두 가져요. 삭제 7일 전과 1일 전에 알려요.
6. **기록장 레이어와 건강 레이어 분리**: 사진·기념일·일정과 주기·가임기·검사 결과를 저장소·동의·공유 범위에서 나눠요(개인정보보호법 제23조 민감정보). 파트너가 먼저 보는 건 기록장이고, 건강 정보는 주기를 기록하는 사람이 항목별로 허용해요.
7. **숙제처럼 만들지 않기**: 질문·기록은 주 1~2회 선택형, 미답변 재촉 알림은 기본으로 꺼 두고, 연속 기록을 강요하지 않아요. 임신 상실 뒤에는 해당 챕터를 숨길 수 있게 하고 예정일·주수 알림과 'N년 전 오늘' 회상에서 빼요.

## 5. 출시 전 체크리스트

- [ ] 식약처에 의료기기 해당 여부 질의 (가임기 '추정' 표시만, 피임·진단 문구 없음 유지)
- [ ] 개인정보 처리방침, 민감정보 별도 동의, 파트너 공유 동의 (각자)
- [ ] 광고·분석 SDK 없음 확인 (건강 화면 이벤트에 주기 정보 넣지 않기)
- [ ] App Store 개인정보 라벨(Health, Sensitive Info), Google Play Health apps declaration
- [ ] 계정 삭제·데이터 내보내기 기능, 연결 해제 흐름
- [ ] 정부 지원사업·챙길 것 콘텐츠를 서버에서 관리(시행일·출처), 분기마다 갱신. 곧 바뀌는 날짜: 난임치료휴가 유급 4일(2026-11-27 시행), 산모·신생아 건강관리 예외지원 '2026-09-30 신청분까지'(일부 지자체 안내에서만 확인, 전국 공통인지 확인 필요)
- [ ] 챙길 것의 거주지별 지자체 사업(산후조리비·임산부 교통비 등) 분리, 고용 형태에 따라 달라지는 항목(5인 미만 사업장, 우선지원대상기업) 입력 받기
- [ ] 연결 해제·계정 삭제 때 각자 사본 내려받기, 삭제 7일·1일 전 알림
- [ ] 경쟁 앱(KONOTOKI, 핑크다이어리 커플커넥트, 베이비빌리, Soonr) 직접 설치해 비교
- [ ] 난임 장기화·유산 상황에서 알림·데이트 제안을 조용히 끄는 흐름 사용자 테스트

## 6. 수익 모델 후보

- **부부 1구독**(두 사람 이용): 핑크다이어리 커플커넥트 월 2,500원이 시장 가격대 참고. 기록과 내보내기는 항상 무료
- 포토북(연애 → 준비 → 임신 → 첫돌 한 권 인쇄). 연속 작성 조건 대신 페이지가 채워지는 진행감으로
- ❌ 건강 데이터 기반 광고 타기팅은 하지 않아요 (Flo, Premom 제재 사례)
- △ 영양제 커머스: 효능 표현 금지, 건강기능식품 광고 자율심의 대상
