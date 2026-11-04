-- Isolated SQL regression: works after all migrations or after missing-inbox repair.
-- Never run on the hosted project. Fixtures roll back.
begin;
insert into auth.users(id,is_anonymous,email_confirmed_at) values
 ('13000000-0000-4000-8000-000000000001',true,null),
 ('13000000-0000-4000-8000-000000000002',true,null),
 ('13000000-0000-4000-8000-000000000003',false,null);
insert into community_private.profiles(user_id,display_name) values
 ('13000000-0000-4000-8000-000000000001','Guest A'),
 ('13000000-0000-4000-8000-000000000002','Guest B');
insert into community_private.questions(id,author_id,city,title,body) values
 ('23000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001','andong','A guest question','Existing question content.'),
 ('23000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000002','jeonju','Another guest question','Another question content.');
update community_private.settings set guest_enabled=true,posting_enabled=true;
select community_test.assert(public.community_status()->>'inboxSchemaVersion'='1','inbox has a separate ready marker');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select community_test.expect_error('select public.community_notifications()','permission denied');
select community_test.expect_error('select public.community_my_questions()','permission denied');
select community_test.expect_error('select * from community_private.reply_notifications','permission denied');
set local role authenticated;
select community_test.expect_error('select public.community_notifications()','WK_AUTH_REQUIRED');
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000003',true);
select community_test.expect_error('select public.community_notifications()','WK_EMAIL_REQUIRED');
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
select public.community_create_comment('33000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','A real reply fixture.');
select public.community_create_comment('33000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','A real reply fixture.');
select community_test.assert(public.community_notifications()->'notifications'='[]'::jsonb,'reply author has no self alert');
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select community_test.assert(jsonb_array_length(public.community_my_questions()->'questions')=1,'guest only sees own question');
select community_test.assert((public.community_notifications()->>'unreadCount')::int=1,'exactly one other-person reply notification');
select community_test.assert(not (public.community_notifications()->'notifications'->0 ? 'body'),'notification contains no copied body');
select set_config('community_test.repair_receipt',public.community_notifications()->'notifications'->0->>'id',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
select public.community_read_notifications(array[current_setting('community_test.repair_receipt')::uuid]);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
select community_test.assert((public.community_notifications()->>'unreadCount')::int=1,'another guest cannot mark my receipt');
select community_test.assert((public.community_read_notifications(array[current_setting('community_test.repair_receipt')::uuid])->>'unreadCount')::int=0,'owner receipt persists');
reset role;
update community_private.settings set guest_enabled=false,posting_enabled=false;
set local role authenticated;
select community_test.assert(jsonb_array_length(public.community_my_questions()->'questions')=1,'guest questions readable while paused');
select community_test.assert(jsonb_array_length(public.community_notifications()->'notifications')=1,'guest inbox readable while paused');
reset role;
select community_test.assert((select relrowsecurity from pg_class where oid='community_private.reply_notifications'::regclass),'notification RLS enabled');
select community_test.assert(not has_function_privilege('anon','public.community_read_notifications(uuid[])','EXECUTE'),'anonymous role has no receipt write');
select community_test.assert(not has_function_privilege('authenticated','community_private.inbox_user_id()','EXECUTE'),'private helper not callable directly');
rollback;
