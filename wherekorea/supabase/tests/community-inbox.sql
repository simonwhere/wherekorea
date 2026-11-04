-- Isolated regression suite only. Apply both exact migrations before this file.
-- Fixtures are rolled back; never run the test bootstrap on hosted Supabase.
begin;
insert into auth.users(id,email_confirmed_at) values
 ('11000000-0000-4000-8000-000000000001',now()),
 ('11000000-0000-4000-8000-000000000002',now()),
 ('11000000-0000-4000-8000-000000000003',now()),
 ('11000000-0000-4000-8000-000000000004',null),
 ('11000000-0000-4000-8000-000000000005',now());
insert into community_private.profiles(user_id,display_name) values
 ('11000000-0000-4000-8000-000000000001','Alice'),
 ('11000000-0000-4000-8000-000000000002','Bob'),
 ('11000000-0000-4000-8000-000000000003','Cara');
insert into community_private.questions(id,author_id,city,title,body) values
 ('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','andong','Andong station question','The original question body.'),
 ('21000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002','jeonju','Jeonju station question','Another original question body.');
update community_private.settings set posting_enabled=true;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select community_test.expect_error('select public.community_my_questions()','permission denied');
select community_test.expect_error('select public.community_notifications()','permission denied');
select community_test.expect_error('select public.community_read_notifications(array[gen_random_uuid()])','permission denied');
select community_test.expect_error('select * from community_private.reply_notifications','permission denied');

set local role authenticated;
select community_test.expect_error('select public.community_my_questions()','WK_AUTH_REQUIRED');
select community_test.expect_error('select public.community_notifications()','WK_AUTH_REQUIRED');
select community_test.expect_error('select public.community_read_notifications(array[gen_random_uuid()])','WK_AUTH_REQUIRED');
select community_test.expect_error('select community_private.visible_reply_notifications(gen_random_uuid())','permission denied');
select community_test.expect_error('insert into community_private.reply_notifications(recipient_id,comment_id) values(gen_random_uuid(),gen_random_uuid())','permission denied');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000004',true);
select community_test.expect_error('select public.community_notifications()','WK_EMAIL_REQUIRED');
select community_test.expect_error('select public.community_my_questions()','WK_EMAIL_REQUIRED');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000005',true);
select community_test.assert(public.community_my_questions()->'questions'='[]'::jsonb,'new account can read empty own questions before nickname');
select community_test.assert(public.community_notifications()->'notifications'='[]'::jsonb,'new account can read empty inbox before nickname');

select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
select public.community_create_comment('31000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','A reply body that must not appear in an alert.');
select public.community_create_comment('31000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','A reply body that must not appear in an alert.');
select community_test.assert(public.community_notifications()->'notifications'='[]'::jsonb,'reply author does not receive own alert');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select public.community_create_comment('31000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000001','Adding detail to my own question.');
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=1,'idempotent retry plus own comment produce only one alert');
select community_test.assert((public.community_notifications()->>'unreadCount')::integer=1,'unread is derived from recipient visible items');
select community_test.assert(not (public.community_notifications()->'notifications'->0 ? 'body'),'alert has no reply body');
select community_test.assert(public.community_notifications()::text not like '%reply body%' and public.community_notifications()::text not like '%11000000-%','alert has no excerpt or private auth identity');
select community_test.assert(jsonb_array_length(public.community_my_questions()->'questions')=1,'my questions do not include another author');
select community_test.assert(public.community_my_questions()->'questions'->0->>'id'='21000000-0000-4000-8000-000000000001','mine uses trusted caller identity');
select set_config('community_test.alice_notification',public.community_notifications()->'notifications'->0->>'id',true);
select public.community_create_comment('31000000-0000-4000-8000-000000000004','21000000-0000-4000-8000-000000000002','An answer for Bob.');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
select set_config('community_test.bob_notification',public.community_notifications()->'notifications'->0->>'id',true);
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000003',true);
select public.community_create_comment('31000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000001','A second answer for Alice.');

select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select community_test.expect_error('select public.community_notifications(0)','WK_INVALID');
select community_test.expect_error('select public.community_notifications(1001)','WK_INVALID');
select community_test.expect_error('select public.community_my_questions(null)','WK_INVALID');
select community_test.expect_error('select public.community_read_notifications(null)','WK_INVALID');
select community_test.expect_error('select public.community_read_notifications(array[]::uuid[])','WK_INVALID');
select community_test.expect_error('select public.community_read_notifications(array[null]::uuid[])','WK_INVALID');
select community_test.expect_error('select public.community_read_notifications(array_fill(gen_random_uuid(),array[51]))','WK_INVALID');
select community_test.expect_error('select public.community_read_notifications(array_fill(gen_random_uuid(),array[2,2]))','WK_INVALID');
select community_test.assert((public.community_read_notifications(array[current_setting('community_test.bob_notification')::uuid,gen_random_uuid()])->>'unreadCount')::integer=2,'foreign and missing receipts do not change callers unread');
select community_test.assert((public.community_read_notifications(array[current_setting('community_test.alice_notification')::uuid])->>'unreadCount')::integer=1,'own read receipt persisted');
select community_test.assert((public.community_read_notifications(array[current_setting('community_test.alice_notification')::uuid])->>'unreadCount')::integer=1,'receipt retry is idempotent');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true);
select community_test.assert((public.community_notifications()->>'unreadCount')::integer=1,'other account cannot mark my notification read');

reset role;
select community_test.assert((select count(*)=3 from community_private.reply_notifications),'one notification per other-person comment');
select set_config('community_test.cara_public',(select public_id::text from community_private.profiles where user_id='11000000-0000-4000-8000-000000000003'),true);
select set_config('community_test.alice_public',(select public_id::text from community_private.profiles where user_id='11000000-0000-4000-8000-000000000001'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select public.community_set_block(current_setting('community_test.cara_public')::uuid,true);
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=1 and (public.community_notifications()->>'unreadCount')::integer=0,'blocking hides list and unread count');
select community_test.assert((public.community_my_questions()->'questions'->0->>'commentCount')::integer=2,'my question count excludes blocked author');
select public.community_set_block(current_setting('community_test.cara_public')::uuid,false);
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000003',true);
select public.community_set_block(current_setting('community_test.alice_public')::uuid,true);
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=1 and (public.community_notifications()->>'unreadCount')::integer=0,'reverse blocking also hides both paths');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000003',true);
select public.community_set_block(current_setting('community_test.alice_public')::uuid,false);

reset role;
insert into community_private.bans(user_id) values('11000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=1 and (public.community_notifications()->>'unreadCount')::integer=0,'banned replier is removed from list and badge');
reset role;
delete from community_private.bans where user_id='11000000-0000-4000-8000-000000000003';
update community_private.comments set status='hidden' where id='31000000-0000-4000-8000-000000000003';
select set_config('community_test.hidden_notification',(select id::text from community_private.reply_notifications where comment_id='31000000-0000-4000-8000-000000000003'),true);
set local role authenticated;
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=1 and (public.community_notifications()->>'unreadCount')::integer=0,'hidden comment is removed from list and badge');
select public.community_read_notifications(array[current_setting('community_test.hidden_notification')::uuid]);
reset role;
select community_test.assert((select read_at is null from community_private.reply_notifications where id=current_setting('community_test.hidden_notification')::uuid),'hidden receipt cannot mutate its target');
update community_private.comments set status='published' where id='31000000-0000-4000-8000-000000000003';
update community_private.questions set status='hidden' where id='21000000-0000-4000-8000-000000000001';
set local role authenticated;
select community_test.assert(public.community_notifications()->'notifications'='[]'::jsonb and (public.community_notifications()->>'unreadCount')::integer=0,'hidden question hides all related alerts');
select community_test.assert(public.community_my_questions()->'questions'='[]'::jsonb,'hidden own question not presented as available');
reset role;
update community_private.questions set status='published' where id='21000000-0000-4000-8000-000000000001';
update community_private.settings set posting_enabled=false;
set local role authenticated;
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=2,'posting pause does not prevent reading existing replies');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000003',true);
select public.community_delete_comment('31000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',true);
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=1 and (public.community_notifications()->>'unreadCount')::integer=0,'deleted comment cannot leak through notification');
select public.community_delete_question('21000000-0000-4000-8000-000000000001');
select community_test.assert(public.community_notifications()->'notifications'='[]'::jsonb,'deleted question removes alert visibility');
select community_test.assert(public.community_my_questions()->'questions'='[]'::jsonb,'deleted own question removed from mine');

-- More than one page, including identical timestamps: UUID tie-break makes order deterministic.
reset role;
insert into community_private.questions(id,author_id,city,title,body,created_at)
select gen_random_uuid(),'11000000-0000-4000-8000-000000000001','andong','Andong question '||i,'A pagination test question.',now() from generate_series(1,23) i;
select set_config('community_test.question',(select id::text from community_private.questions where author_id='11000000-0000-4000-8000-000000000001' and status='published' order by created_at desc,id desc limit 1),true);
insert into community_private.comments(id,question_id,author_id,body)
select gen_random_uuid(),current_setting('community_test.question')::uuid,'11000000-0000-4000-8000-000000000002','A distinct reply '||i from generate_series(1,21) i;
select set_config('community_test.first_notification',(select id::text from community_private.reply_notifications where recipient_id='11000000-0000-4000-8000-000000000001' order by created_at desc,id desc limit 1),true);
-- A prior deleted question's rows share the same timestamp: use visible rows for the expected order.
select set_config('community_test.first_notification',(select n.id::text from community_private.reply_notifications n join community_private.comments c on c.id=n.comment_id where c.question_id=current_setting('community_test.question')::uuid order by n.created_at desc,n.id desc limit 1),true);
set local role authenticated;
select community_test.assert(jsonb_array_length(public.community_my_questions(1)->'questions')=20 and (public.community_my_questions(1)->>'hasMore')::boolean,'mine page one is bounded');
select community_test.assert(jsonb_array_length(public.community_my_questions(2)->'questions')=3 and not (public.community_my_questions(2)->>'hasMore')::boolean,'mine page two terminates');
select community_test.assert(public.community_my_questions(1)->'questions'->0->>'id'=current_setting('community_test.question'),'my questions order uses timestamp and uuid');
select community_test.assert(jsonb_array_length(public.community_notifications(1)->'notifications')=20 and (public.community_notifications(1)->>'hasMore')::boolean,'notification page one is bounded');
select community_test.assert(jsonb_array_length(public.community_notifications(2)->'notifications')=1 and not (public.community_notifications(2)->>'hasMore')::boolean,'notification page two terminates');
select community_test.assert(public.community_notifications()->'notifications'->0->>'id'=current_setting('community_test.first_notification'),'notification order uses timestamp and uuid');
select community_test.assert((public.community_notifications(2)->>'unreadCount')::integer=21,'badge counts all visible pages, not page length');

reset role;
insert into community_private.bans(user_id) values('11000000-0000-4000-8000-000000000001');
set local role authenticated;
select community_test.expect_error('select public.community_notifications()','WK_FORBIDDEN');
select community_test.expect_error('select public.community_my_questions()','WK_FORBIDDEN');
select community_test.expect_error('select public.community_read_notifications(array[gen_random_uuid()])','WK_FORBIDDEN');
-- Existing data deletion remains possible, and new private rows cascade with the profile.
select public.community_delete_my_data('DELETE MY COMMUNITY DATA');
reset role;
select community_test.assert(not exists(select 1 from community_private.reply_notifications),'community erasure removes received alerts and alerts for deleted replies');
select community_test.assert((select count(*)=11 from pg_tables where schemaname='community_private' and rowsecurity),'new inbox table has RLS');
select community_test.assert(not has_table_privilege('authenticated','community_private.reply_notifications','SELECT,INSERT,UPDATE,DELETE'),'no direct notification table access');
select community_test.assert(not has_function_privilege('anon','public.community_notifications(integer)','EXECUTE'),'no anonymous inbox RPC access');
select community_test.assert(not has_function_privilege('authenticated','community_private.visible_reply_notifications(uuid)','EXECUTE'),'recipient-selection helper stays private');
rollback;
