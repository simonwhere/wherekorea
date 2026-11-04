-- Run only after bootstrap.sql + the exact migration in an isolated test database.
-- Every fixture is rolled back. Claims simulate the trusted Supabase gateway, not app input.
begin;
insert into auth.users(id,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001',now()),
 ('10000000-0000-4000-8000-000000000002',now()),
 ('10000000-0000-4000-8000-000000000003',now()),
 ('10000000-0000-4000-8000-000000000004',null),
 ('10000000-0000-4000-8000-000000000005',now());
insert into community_private.moderators(user_id) values('10000000-0000-4000-8000-000000000005');

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select community_test.assert((public.community_status()->>'postingEnabled')::boolean=false,'posting is closed by default');
select community_test.assert(public.community_list_questions()->'questions'='[]'::jsonb,'empty list is real');
select community_test.expect_error('select * from community_private.profiles','permission denied');
select community_test.expect_error('select public.community_set_profile(''Visitor'',true)','permission denied');
select community_test.expect_error('select community_private.current_user_id(false,false)','permission denied');
select community_test.expect_error('select public.community_list_questions(''fake-city'',1)','WK_INVALID');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select community_test.expect_error('select public.community_set_profile(''Visitor'',true)','WK_EMAIL_REQUIRED');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select community_test.expect_error('select public.community_set_profile(''Where Korea Team'',true)','WK_INVALID');
select community_test.expect_error('select public.community_set_profile(''a@b.com'',true)','WK_INVALID');
select community_test.expect_error('select public.community_set_profile(''Alice'',false)','WK_INVALID');
select community_test.assert(public.community_set_profile('Alice',true)->>'displayName'='Alice','profile saved');
select community_test.assert((public.community_get_profile()->>'moderator')::boolean=false,'user cannot self assign moderator');
select community_test.expect_error('update community_private.settings set posting_enabled=true','permission denied');
select community_test.expect_error('select public.community_create_question(''20000000-0000-4000-8000-000000000001'',''jeonju'',''Jeonju trains'',''How does the station connection work?'')','WK_DISABLED');

reset role;
update community_private.settings set posting_enabled=true;
set local role authenticated;
select community_test.assert(public.community_create_question('20000000-0000-4000-8000-000000000001','jeonju','Jeonju trains','How does the station connection work?')->>'title'='Jeonju trains','question saved');
select community_test.assert(public.community_create_question('20000000-0000-4000-8000-000000000001','jeonju','Jeonju trains','How does the station connection work?')->>'id'='20000000-0000-4000-8000-000000000001','idempotent question retry');
select community_test.assert(jsonb_array_length(public.community_list_questions()->'questions')=1,'retry makes only one question');
select community_test.expect_error('select public.community_create_question(''20000000-0000-4000-8000-000000000001'',''jeonju'',''A changed title'',''How does the station connection work?'')','WK_CONFLICT');
select community_test.expect_error('select public.community_create_question(''20000000-0000-4000-8000-000000000002'',''jeonju'',''Another title'',''A separate question body.'')','WK_RATE_LIMIT');
select community_test.expect_error('select public.community_create_question(''20000000-0000-4000-8000-000000000002'',''invalid'',''Another title'',''A separate question body.'')','WK_INVALID');
select community_test.assert((public.community_get_question('20000000-0000-4000-8000-000000000001')->'question'->>'owned')::boolean,'ownership server computed');
select community_test.assert(public.community_get_question('20000000-0000-4000-8000-000000000001')->'question'->>'authorId'<>'10000000-0000-4000-8000-000000000001','public author id is not auth identity');

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select public.community_set_profile('Bob',true);
select community_test.assert(public.community_create_comment('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','<script>alert(1)</script> is plain text.')->>'body'='<script>alert(1)</script> is plain text.','markup remains plain text');
select public.community_create_comment('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','<script>alert(1)</script> is plain text.');
select community_test.assert(jsonb_array_length(public.community_get_question('20000000-0000-4000-8000-000000000001')->'comments')=1,'comment retry creates one');
select community_test.expect_error('select public.community_delete_question(''20000000-0000-4000-8000-000000000001'')','WK_NOT_FOUND');
select community_test.expect_error('select public.community_moderation_reports()','WK_FORBIDDEN');
select public.community_report('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',null,'other','Check this question.');
select public.community_report('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',null,'other','Duplicate report.');
select public.community_set_block((public.community_get_question('20000000-0000-4000-8000-000000000001')->'question'->>'authorId')::uuid,true);
select community_test.assert(jsonb_array_length(public.community_get_blocks()->'blocks')=1,'block persisted');
select community_test.expect_error('select public.community_get_question(''20000000-0000-4000-8000-000000000001'')','WK_NOT_FOUND');
select community_test.expect_error('select public.community_create_comment(''30000000-0000-4000-8000-000000000002'',''20000000-0000-4000-8000-000000000001'',''Cannot bypass block.'')','WK_NOT_FOUND');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select community_test.assert(jsonb_array_length(public.community_get_question('20000000-0000-4000-8000-000000000001')->'comments')=0,'block suppresses both directions');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select public.community_set_block((public.community_get_blocks()->'blocks'->0->>'userId')::uuid,false);
select community_test.assert(jsonb_array_length(public.community_get_question('20000000-0000-4000-8000-000000000001')->'comments')=1,'unblock restores visibility');
select public.community_delete_comment('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
select public.community_delete_comment('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
select community_test.expect_error('select public.community_create_comment(''30000000-0000-4000-8000-000000000001'',''20000000-0000-4000-8000-000000000001'',''<script>alert(1)</script> is plain text.'')','WK_CONFLICT');

reset role;
select community_test.assert((select body='' from community_private.comments where id='30000000-0000-4000-8000-000000000001'),'delete scrubs body');
select community_test.assert((select count(*)=1 from community_private.reports),'reports deduplicate by person and target');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
select community_test.assert((public.community_get_profile()->>'moderator')::boolean,'owner assigned moderator works');
select community_test.assert(jsonb_array_length(public.community_moderation_reports()->'reports')=1,'moderation queue real report');
select public.community_moderate('40000000-0000-4000-8000-000000000001','ban');
select community_test.assert(jsonb_array_length(public.community_list_questions()->'questions')=0,'banned author content hidden');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select community_test.expect_error('select public.community_set_profile(''Rejoined'',true)','WK_FORBIDDEN');
select community_test.assert((public.community_get_profile()->>'banned')::boolean,'ban reflected in profile');
select public.community_delete_my_data('DELETE MY COMMUNITY DATA');
select community_test.assert((public.community_get_profile()->>'acceptedGuidelines')::boolean=false,'data deletion removes profile');
select community_test.assert((public.community_get_profile()->>'banned')::boolean,'data deletion cannot erase ban');
select community_test.expect_error('select public.community_set_profile(''Rejoined'',true)','WK_FORBIDDEN');
reset role;
select community_test.assert(exists(select 1 from auth.users where id='10000000-0000-4000-8000-000000000001'),'shared auth identity preserved');
select community_test.assert(not exists(select 1 from community_private.questions where author_id='10000000-0000-4000-8000-000000000001'),'community content removed');
select community_test.assert((select count(*)=10 from pg_tables where schemaname='community_private' and rowsecurity),'all community tables have RLS');
select community_test.assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'community_%' and not ('search_path=""'=any(p.proconfig))),'public RPC search paths hardened');

-- Direct gateway bypass and lifecycle probes: API validation is not the boundary.
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select community_test.expect_error('select public.community_set_profile(''No identity'',true)','WK_AUTH_REQUIRED');
select community_test.expect_error('select public.community_delete_my_data(''DELETE MY COMMUNITY DATA'')','WK_AUTH_REQUIRED');
select community_test.expect_error('select community_private.consume_rate(null,''x'',100,60)','permission denied');
select community_test.expect_error('insert into community_private.profiles(user_id,display_name) values(gen_random_uuid(),''Fake'')','permission denied');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select community_test.expect_error('select public.community_create_question(''20000000-0000-4000-8000-000000000003'',''busan'',''A new question'',''Details for the question.'')','WK_PROFILE_REQUIRED');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select public.community_create_question('20000000-0000-4000-8000-000000000003','busan','A new question','Details for the question.');
select community_test.expect_error('select public.community_report(''40000000-0000-4000-8000-000000000003'',''20000000-0000-4000-8000-000000000003'',null,''other'',null)','WK_INVALID');
select community_test.expect_error('select public.community_report(''40000000-0000-4000-8000-000000000003'',''20000000-0000-4000-8000-000000000003'',''30000000-0000-4000-8000-000000000003'',''other'','''')','WK_INVALID');
select community_test.expect_error('select public.community_report(''40000000-0000-4000-8000-000000000003'',''20000000-0000-4000-8000-000000000003'',null,''other'',repeat(''x'',1001))','WK_INVALID');
select public.community_report('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003',null,'spam','');
select community_test.expect_error('select public.community_list_questions(''all'',null)','WK_INVALID');
select community_test.expect_error('select public.community_get_question(''20000000-0000-4000-8000-000000000003'',1001)','WK_INVALID');

reset role;
insert into community_private.moderators(user_id) values('10000000-0000-4000-8000-000000000004');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',true);
select community_test.expect_error('select public.community_moderation_reports()','WK_FORBIDDEN');
reset role;
insert into community_private.bans(user_id) values('10000000-0000-4000-8000-000000000005');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',true);
select community_test.expect_error('select public.community_moderation_reports()','WK_FORBIDDEN');
select community_test.expect_error('select public.community_moderate(''40000000-0000-4000-8000-000000000003'',''hide'')','WK_FORBIDDEN');
reset role;
delete from community_private.bans where user_id='10000000-0000-4000-8000-000000000005';
set local role authenticated;
select public.community_moderate('40000000-0000-4000-8000-000000000003','hide');
select community_test.expect_error('select public.community_get_question(''20000000-0000-4000-8000-000000000003'')','WK_NOT_FOUND');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select public.community_delete_question('20000000-0000-4000-8000-000000000003');
select public.community_delete_question('20000000-0000-4000-8000-000000000003');
select community_test.expect_error('select public.community_create_question(''20000000-0000-4000-8000-000000000003'',''busan'',''A new question'',''Details for the question.'')','WK_CONFLICT');
reset role;
select community_test.assert((select title='' and body='' and status='deleted' from community_private.questions where id='20000000-0000-4000-8000-000000000003'),'question deletion scrubs hidden body and title');
select community_test.assert((select count=1 from community_private.rate_limits where user_id='10000000-0000-4000-8000-000000000002' and action='question_hour'),'idempotency and failed writes do not use extra quota');
select community_test.assert(not has_function_privilege('anon','public.community_set_profile(text,boolean)','EXECUTE'),'anon cannot set profile');
select community_test.assert(not has_function_privilege('authenticated','community_private.consume_rate(uuid,text,integer,integer)','EXECUTE'),'authenticated cannot call internal helper');

-- Pagination is bounded and stable even with more than one page of real rows.
insert into community_private.questions(id,author_id,city,title,body,created_at)
select gen_random_uuid(),'10000000-0000-4000-8000-000000000002','busan','Busan question '||i,'Question details for pagination.',now()-i*interval '1 minute' from generate_series(1,22) i;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select community_test.assert(jsonb_array_length(public.community_list_questions('busan',1)->'questions')=20,'page size bounded to twenty');
select community_test.assert((public.community_list_questions('busan',1)->>'hasMore')::boolean,'first page has more');
select community_test.assert(jsonb_array_length(public.community_list_questions('busan',2)->'questions')=2,'remaining page contains two');
select community_test.assert((public.community_list_questions('busan',2)->>'hasMore')::boolean=false,'last page terminates');
select community_test.assert((public.community_list_questions('busan',1)->'questions'->0->>'owned')::boolean=false,'anonymous reader owns nothing');
rollback;
