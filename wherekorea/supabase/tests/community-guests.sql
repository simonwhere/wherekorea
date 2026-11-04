-- Isolated fixtures only; never run this test file on hosted Supabase.
-- Trusted gateway claims are simulated. CAPTCHA/provider signup/cookies require
-- separate integration tests and are deliberately not claimed by this suite.
begin;
insert into auth.users(id,email_confirmed_at,is_anonymous) values
 ('12000000-0000-4000-8000-000000000001',null,true),
 ('12000000-0000-4000-8000-000000000002',null,true),
 ('12000000-0000-4000-8000-000000000003',null,true),
 ('12000000-0000-4000-8000-000000000004',null,false),
 ('12000000-0000-4000-8000-000000000005',now(),false),
 ('12000000-0000-4000-8000-000000000006',now(),true);
insert into community_private.moderators(user_id) values
 ('12000000-0000-4000-8000-000000000001'),
 ('12000000-0000-4000-8000-000000000004'),
 ('12000000-0000-4000-8000-000000000005'),
 ('12000000-0000-4000-8000-000000000006');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select community_test.assert((public.community_status()->>'guestEnabled')::boolean=false,'guest gate is closed on migration');
select community_test.assert((public.community_status()->>'guestSchemaVersion')::integer=1,'guest schema is discoverable without writes');
select community_test.expect_error('select public.community_create_question(gen_random_uuid(),''andong'',''A question'',''A question body.'')','permission denied');
select community_test.expect_error('select * from community_private.guest_rate_limits','permission denied');
select community_test.expect_error('select public.community_notifications()','permission denied');

set local role authenticated;
select community_test.expect_error('select public.community_set_profile(''Missing session'',true)','WK_AUTH_REQUIRED');
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claim.is_anonymous','true',true);
select community_test.expect_error('select public.community_set_profile(''Unverified account'',true)','WK_EMAIL_REQUIRED');
select community_test.expect_error('select public.community_notifications()','WK_EMAIL_REQUIRED');
select community_test.expect_error('select public.community_moderation_reports()','WK_FORBIDDEN');
select community_test.expect_error('select public.community_moderate(gen_random_uuid(),''hide'')','WK_FORBIDDEN');
select community_test.assert(not (public.community_get_profile()->>'moderator')::boolean,'unverified allowlisted identity not labelled moderator');

select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select community_test.assert(public.community_my_questions()->'questions'='[]'::jsonb,'new guest can read own empty list before nickname');
select community_test.assert(public.community_notifications()->'notifications'='[]'::jsonb,'new guest can read own empty inbox');
select community_test.assert(public.community_set_profile('Guest Alice',true)->>'displayName'='Guest Alice','guest nickname saved without email');
select community_test.assert(not (public.community_get_profile()->>'moderator')::boolean,'accidentally allowlisted guest is not moderator');
select community_test.expect_error('select public.community_moderation_reports()','WK_FORBIDDEN');
select community_test.expect_error('select public.community_moderate(gen_random_uuid(),''hide'')','WK_FORBIDDEN');
select community_test.expect_error('select public.community_create_question(''22000000-0000-4000-8000-000000000001'',''andong'',''Andong village buses'',''Where are the village return buses?'')','WK_DISABLED');
reset role;
update community_private.settings set posting_enabled=true;
set local role authenticated;
select community_test.expect_error('select public.community_create_question(''22000000-0000-4000-8000-000000000001'',''andong'',''Andong village buses'',''Where are the village return buses?'')','WK_GUEST_DISABLED');
reset role;
update community_private.settings set guest_enabled=true;
set local role authenticated;
select community_test.assert((public.community_status()->>'guestEnabled')::boolean,'guest gate can open independently');
select community_test.assert(public.community_create_question('22000000-0000-4000-8000-000000000001','andong','Andong village buses','Where are the village return buses?')->>'id'='22000000-0000-4000-8000-000000000001','guest A publishes question');
select public.community_create_question('22000000-0000-4000-8000-000000000001','andong','Andong village buses','Where are the village return buses?');
select community_test.expect_error('select public.community_create_question(''22000000-0000-4000-8000-000000000001'',''andong'',''A modified title'',''Where are the village return buses?'')','WK_CONFLICT');
select community_test.expect_error('select public.community_create_question(gen_random_uuid(),''andong'',''Second question'',''A second question body.'')','WK_RATE_LIMIT');

select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
select public.community_set_profile('Guest Bob',true);
select public.community_create_question('22000000-0000-4000-8000-000000000002','jeonju','Jeonju station buses','Where does the station bus stop?');
select public.community_create_comment('32000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','Check the return bus board at the stop.');
select public.community_create_comment('32000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','Check the return bus board at the stop.');
select community_test.expect_error('select public.community_create_question(''22000000-0000-4000-8000-000000000001'',''andong'',''Andong village buses'',''Where are the village return buses?'')','WK_CONFLICT');
select community_test.expect_error('select public.community_delete_question(''22000000-0000-4000-8000-000000000001'')','WK_NOT_FOUND');
select community_test.assert(public.community_my_questions()->'questions'->0->>'id'='22000000-0000-4000-8000-000000000002' and jsonb_array_length(public.community_my_questions()->'questions')=1,'guest B own list never includes guest A question');
select community_test.assert(public.community_notifications()->'notifications'='[]'::jsonb,'reply author gets no self notification');

select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select community_test.assert(public.community_my_questions()->'questions'->0->>'id'='22000000-0000-4000-8000-000000000001' and jsonb_array_length(public.community_my_questions()->'questions')=1,'guest A own list uses caller identity');
select community_test.assert((public.community_notifications()->>'unreadCount')::integer=1 and jsonb_array_length(public.community_notifications()->'notifications')=1,'guest reply creates exactly one private notification');
select community_test.assert(public.community_notifications()::text not like '%12000000-%' and not (public.community_notifications()->'notifications'->0 ? 'body'),'guest alerts reveal neither auth ID nor copied body');
select set_config('community_test.guest_notification',public.community_notifications()->'notifications'->0->>'id',true);
select public.community_create_comment('32000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001','Adding detail to my question.');
select community_test.assert((public.community_notifications()->>'unreadCount')::integer=1,'own guest reply makes no notification');
select community_test.expect_error('select public.community_delete_comment(''32000000-0000-4000-8000-000000000001'',''22000000-0000-4000-8000-000000000001'')','WK_NOT_FOUND');
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
select public.community_read_notifications(array[current_setting('community_test.guest_notification')::uuid]);
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select community_test.assert((public.community_notifications()->>'unreadCount')::integer=1,'foreign receipt leaves owner unread state untouched');
select community_test.assert((public.community_read_notifications(array[current_setting('community_test.guest_notification')::uuid])->>'unreadCount')::integer=0,'guest own read receipt works');
select community_test.assert((public.community_read_notifications(array[current_setting('community_test.guest_notification')::uuid])->>'unreadCount')::integer=0,'guest read receipt retry is idempotent');
select public.community_report('42000000-0000-4000-8000-000000000001',null,'32000000-0000-4000-8000-000000000001','spam','Guest report test.');
select public.community_report('42000000-0000-4000-8000-000000000002',null,'32000000-0000-4000-8000-000000000001','spam','Duplicate test.');
select public.community_set_block((public.community_get_question('22000000-0000-4000-8000-000000000002')->'question'->>'authorId')::uuid,true);
select community_test.assert(public.community_notifications()->'notifications'='[]'::jsonb,'guest block removes notification visibility');
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
select community_test.expect_error('select public.community_create_comment(gen_random_uuid(),''22000000-0000-4000-8000-000000000001'',''Blocked reply.'')','WK_NOT_FOUND');
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select public.community_set_block((public.community_get_blocks()->'blocks'->0->>'userId')::uuid,false);
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=1,'unblock restores visible guest inbox');

-- Strict comment minute/hour/day limits. Privileged fixture seeding models a
-- consumed fixed bucket without sleeping or changing real provider clocks.
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
select public.community_create_comment('32000000-0000-4000-8000-000000000003','22000000-0000-4000-8000-000000000001','A second comment.');
select public.community_create_comment('32000000-0000-4000-8000-000000000004','22000000-0000-4000-8000-000000000001','A third comment.');
select community_test.expect_error('select public.community_create_comment(gen_random_uuid(),''22000000-0000-4000-8000-000000000001'',''Fourth in a minute.'')','WK_RATE_LIMIT');
reset role;
select community_test.assert((select count=3 from community_private.rate_limits where user_id='12000000-0000-4000-8000-000000000002' and action='comment_hour'),'failed minute limit rolls back hour counter');
delete from community_private.rate_limits where user_id='12000000-0000-4000-8000-000000000002' and action='comment_minute';
update community_private.rate_limits set count=10 where user_id='12000000-0000-4000-8000-000000000002' and action='comment_hour';
set local role authenticated;
select community_test.expect_error('select public.community_create_comment(gen_random_uuid(),''22000000-0000-4000-8000-000000000001'',''Eleventh in an hour.'')','WK_RATE_LIMIT');
reset role;
delete from community_private.rate_limits where user_id='12000000-0000-4000-8000-000000000002' and action='comment_hour';
update community_private.rate_limits set count=30 where user_id='12000000-0000-4000-8000-000000000002' and action='comment_day';
set local role authenticated;
select community_test.expect_error('select public.community_create_comment(gen_random_uuid(),''22000000-0000-4000-8000-000000000001'',''Thirty first in a day.'')','WK_RATE_LIMIT');

-- Strict question hour/day limits and retry invariants.
reset role;
delete from community_private.rate_limits where user_id='12000000-0000-4000-8000-000000000001' and action='question_minute';
update community_private.rate_limits set count=3 where user_id='12000000-0000-4000-8000-000000000001' and action='question_hour';
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select community_test.expect_error('select public.community_create_question(gen_random_uuid(),''andong'',''Fourth hourly question'',''A question body for quota.'')','WK_RATE_LIMIT');
reset role;
delete from community_private.rate_limits where user_id='12000000-0000-4000-8000-000000000001' and action='question_hour';
update community_private.rate_limits set count=5 where user_id='12000000-0000-4000-8000-000000000001' and action='question_day';
set local role authenticated;
select community_test.expect_error('select public.community_create_question(gen_random_uuid(),''andong'',''Sixth daily question'',''A question body for quota.'')','WK_RATE_LIMIT');
select public.community_create_question('22000000-0000-4000-8000-000000000001','andong','Andong village buses','Where are the village return buses?');
reset role;
select community_test.assert((select count=2 from community_private.guest_rate_limits where action='question_day'),'retries and rejected questions do not consume shared quota');
select community_test.assert((select count=4 from community_private.guest_rate_limits where action='comment_day'),'retries and rejected comments do not consume shared quota');
select community_test.assert((select count(*)=1 from community_private.reports),'guest reports keep existing deduplication');

-- A new identity cannot escape shared daily ceilings. Rejections are atomic.
update community_private.guest_rate_limits set count=100 where action='question_day';
update community_private.guest_rate_limits set count=500 where action='comment_day';
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000003',true);
select public.community_set_profile('Guest Cara',true);
select community_test.expect_error('select public.community_create_question(gen_random_uuid(),''andong'',''New guest question'',''Cannot escape shared quota.'')','WK_RATE_LIMIT');
select community_test.expect_error('select public.community_create_comment(gen_random_uuid(),''22000000-0000-4000-8000-000000000001'',''Cannot escape shared quota.'')','WK_RATE_LIMIT');
select community_test.expect_error('select community_private.consume_guest_rate(''question_day'',999999)','permission denied');
reset role;
select community_test.assert(not exists(select 1 from community_private.rate_limits where user_id='12000000-0000-4000-8000-000000000003' and action like 'question_%'),'global ceiling failure rolls back new identity question quotas');
select community_test.assert(not exists(select 1 from community_private.rate_limits where user_id='12000000-0000-4000-8000-000000000003' and action like 'comment_%'),'global ceiling failure rolls back new identity comment quotas');
select community_test.assert((select count=100 from community_private.guest_rate_limits where action='question_day') and (select count=500 from community_private.guest_rate_limits where action='comment_day'),'global failed increments roll back');

-- A verified email attached to an anonymous identity does not make it a moderator.
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000006',true);
select community_test.assert(not (public.community_get_profile()->>'moderator')::boolean,'verified-looking anonymous identity still not moderator');
select community_test.expect_error('select public.community_moderation_reports()','WK_FORBIDDEN');
select community_test.expect_error('select public.community_moderate(''42000000-0000-4000-8000-000000000001'',''hide'')','WK_FORBIDDEN');

-- Pausing guests leaves verified accounts and existing owner controls intact.
reset role;
update community_private.settings set guest_enabled=false;
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000005',true);
select public.community_set_profile('Verified Moderator',true);
select public.community_create_question('22000000-0000-4000-8000-000000000005','gyeongju','Gyeongju station question','Verified accounts keep their existing access.');
select public.community_create_comment('32000000-0000-4000-8000-000000000005','22000000-0000-4000-8000-000000000001','Verified replies still work.');
select community_test.assert((public.community_get_profile()->>'moderator')::boolean,'verified allowlisted moderator retains role');
select community_test.assert(jsonb_array_length(public.community_moderation_reports()->'reports')=1,'verified moderator reads guest report');
select public.community_moderate('42000000-0000-4000-8000-000000000001','hide');
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select community_test.expect_error('select public.community_create_question(gen_random_uuid(),''andong'',''Paused guest question'',''Guest gate remains enforced.'')','WK_GUEST_DISABLED');
select community_test.expect_error('select public.community_create_comment(gen_random_uuid(),''22000000-0000-4000-8000-000000000001'',''Guest gate remains enforced.'')','WK_GUEST_DISABLED');
select community_test.assert(jsonb_array_length(public.community_my_questions()->'questions')=1,'guest own questions remain accessible while guest paused');
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=3,'hidden reply disappears but other inbox items survive guest pause');
reset role;
update community_private.settings set posting_enabled=false;
set local role authenticated;
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=3,'full posting pause still allows inbox');
select public.community_read_notifications(array[(public.community_notifications()->'notifications'->0->>'id')::uuid]);
select public.community_delete_comment('32000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000001');

-- Bans hide guest material and block mutations/inbox but retain own deletion.
reset role;
insert into community_private.bans(user_id) values('12000000-0000-4000-8000-000000000002');
set local role authenticated;
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=1,'banned guest replies absent from inbox');
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
select community_test.expect_error('select public.community_set_profile(''Ban evasion'',true)','WK_FORBIDDEN');
select community_test.expect_error('select public.community_notifications()','WK_FORBIDDEN');
select community_test.expect_error('select public.community_my_questions()','WK_FORBIDDEN');
select public.community_delete_question('22000000-0000-4000-8000-000000000002');
select public.community_delete_my_data('DELETE MY COMMUNITY DATA');
reset role;
select community_test.assert(exists(select 1 from community_private.bans where user_id='12000000-0000-4000-8000-000000000002'),'guest data deletion cannot erase ban');
select community_test.assert(exists(select 1 from auth.users where id='12000000-0000-4000-8000-000000000002'),'guest data deletion does not erase Auth identity');
select community_test.assert((select count=500 from community_private.guest_rate_limits where action='comment_day'),'guest data deletion cannot reset shared daily count');
set local role authenticated;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
select public.community_delete_my_data('DELETE MY COMMUNITY DATA');
select community_test.assert(public.community_notifications()->'notifications'='[]'::jsonb,'guest erasure removes own inbox');
select community_test.assert(public.community_my_questions()->'questions'='[]'::jsonb,'guest erasure removes own questions');
reset role;
select community_test.assert((select count(*)=12 from pg_tables where schemaname='community_private' and rowsecurity),'new quota table has RLS');
select community_test.assert(not has_function_privilege('anon','public.community_create_comment(uuid,uuid,text)','EXECUTE'),'guest support never grants anon writes');
rollback;
