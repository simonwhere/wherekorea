-- WhereKorea only. Additive: no existing application tables or auth identities are changed.
-- Posting starts CLOSED. Enable only after the documented operational launch checks.
begin;

create schema if not exists community_private;
revoke all on schema community_private from public, anon, authenticated;

create table community_private.settings (
  singleton boolean primary key default true check (singleton),
  posting_enabled boolean not null default false
);
insert into community_private.settings(singleton, posting_enabled) values (true, false);

create table community_private.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_id uuid not null unique default gen_random_uuid(),
  display_name text not null check (char_length(display_name) between 2 and 40),
  guidelines_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- These records are owner-managed, never populated from user-editable JWT metadata.
create table community_private.moderators (user_id uuid primary key references auth.users(id) on delete cascade);
create table community_private.bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table community_private.questions (
  id uuid primary key,
  author_id uuid not null references community_private.profiles(user_id) on delete cascade,
  city text not null check (city in ('seoul','busan','jeju','gyeongju','jeonju','gangneung','sokcho','tongyeong','namhae','jirisan','yeosu','andong','suwon','chuncheon','damyang-boseong')),
  title text not null,
  body text not null,
  status text not null default 'published' check (status in ('published','hidden','deleted')),
  created_at timestamptz not null default now(),
  check (status = 'deleted' or (char_length(title) between 5 and 140 and char_length(body) between 10 and 3000))
);
create index community_questions_recent on community_private.questions (created_at desc, id desc) where status = 'published';
create index community_questions_city on community_private.questions (city, created_at desc, id desc) where status = 'published';

create table community_private.comments (
  id uuid primary key,
  question_id uuid not null references community_private.questions(id) on delete cascade,
  author_id uuid not null references community_private.profiles(user_id) on delete cascade,
  body text not null,
  status text not null default 'published' check (status in ('published','hidden','deleted')),
  created_at timestamptz not null default now(),
  check (status = 'deleted' or char_length(body) between 2 and 2000)
);
create index community_comments_question on community_private.comments(question_id, created_at, id) where status = 'published';

create table community_private.blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_profile_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id),
  check (user_id <> blocked_user_id)
);
create index community_blocks_reverse on community_private.blocks(blocked_user_id, user_id);

create table community_private.reports (
  id uuid primary key,
  reporter_id uuid not null references community_private.profiles(user_id) on delete cascade,
  question_id uuid references community_private.questions(id) on delete cascade,
  comment_id uuid references community_private.comments(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','personal_information','unsafe','other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((question_id is not null) <> (comment_id is not null))
);
create unique index community_report_question_unique on community_private.reports(reporter_id, question_id) where question_id is not null;
create unique index community_report_comment_unique on community_private.reports(reporter_id, comment_id) where comment_id is not null;
create index community_reports_queue on community_private.reports(created_at) where status = 'open';

create table community_private.rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  bucket timestamptz not null,
  count integer not null check (count > 0),
  primary key(user_id, action, bucket)
);
create table community_private.moderation_log (
  id bigint generated always as identity primary key,
  moderator_id uuid references auth.users(id) on delete set null,
  target_id uuid not null,
  action text not null check (action in ('hide','resolve','ban')),
  created_at timestamptz not null default now()
);

alter table community_private.settings enable row level security;
alter table community_private.profiles enable row level security;
alter table community_private.moderators enable row level security;
alter table community_private.bans enable row level security;
alter table community_private.questions enable row level security;
alter table community_private.comments enable row level security;
alter table community_private.blocks enable row level security;
alter table community_private.reports enable row level security;
alter table community_private.rate_limits enable row level security;
alter table community_private.moderation_log enable row level security;
-- No client table policy or privilege: all allowed operations use the RPCs below.
revoke all on all tables in schema community_private from public, anon, authenticated;
revoke all on all sequences in schema community_private from public, anon, authenticated;

create function community_private.valid_text(value text, minimum integer, maximum integer)
returns boolean language sql immutable set search_path = '' as $$
  select value is not null and char_length(value) between minimum and maximum
    and value = btrim(value) and value !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]';
$$;

create function community_private.current_user_id(needs_profile boolean default true, posting boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'WK_AUTH_REQUIRED'; end if;
  if not exists(select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null) then
    raise exception 'WK_EMAIL_REQUIRED';
  end if;
  if exists(select 1 from community_private.bans b where b.user_id = uid) then raise exception 'WK_FORBIDDEN'; end if;
  if needs_profile and not exists(select 1 from community_private.profiles p where p.user_id = uid) then raise exception 'WK_PROFILE_REQUIRED'; end if;
  if posting and not exists(select 1 from community_private.settings s where s.singleton and s.posting_enabled) then raise exception 'WK_DISABLED'; end if;
  -- Serialize mutations for one identity: rate checks and idempotent retries are atomic.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wherekorea:' || uid::text, 0));
  return uid;
end;
$$;

create function community_private.consume_rate(uid uuid, kind text, maximum integer, seconds integer)
returns void language plpgsql security definer set search_path = '' as $$
declare slot timestamptz := pg_catalog.to_timestamp(floor(extract(epoch from now()) / seconds) * seconds); total integer;
begin
  insert into community_private.rate_limits(user_id, action, bucket, count) values(uid, kind, slot, 1)
  on conflict (user_id, action, bucket) do update set count = community_private.rate_limits.count + 1
  returning count into total;
  if total > maximum then raise exception 'WK_RATE_LIMIT'; end if;
  delete from community_private.rate_limits where user_id = uid and bucket < now() - interval '2 days';
end;
$$;

create function community_private.blocked(first_user uuid, second_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from community_private.blocks b where
    (b.user_id = first_user and b.blocked_user_id = second_user) or
    (b.user_id = second_user and b.blocked_user_id = first_user));
$$;

create function community_private.author_visible(author uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists(select 1 from community_private.bans b where b.user_id = author)
    and not community_private.blocked(auth.uid(), author);
$$;

create function community_private.question_json(q community_private.questions)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',q.id,'city',q.city,'title',q.title,'body',q.body,
    'authorId',p.public_id,'authorName',p.display_name,'createdAt',q.created_at,
    'owned',coalesce(q.author_id = auth.uid(),false),
    'commentCount',(select count(*) from community_private.comments c where c.question_id=q.id
      and c.status='published' and community_private.author_visible(c.author_id)))
  from community_private.profiles p where p.user_id=q.author_id;
$$;

create function community_private.comment_json(c community_private.comments)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',c.id,'questionId',c.question_id,'body',c.body,
    'authorId',p.public_id,'authorName',p.display_name,'createdAt',c.created_at,
    'owned',coalesce(c.author_id = auth.uid(),false))
  from community_private.profiles p where p.user_id=c.author_id;
$$;

create function public.community_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('postingEnabled',coalesce((select posting_enabled from community_private.settings where singleton),false));
$$;

create function public.community_get_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('displayName',coalesce((select display_name from community_private.profiles where user_id=auth.uid()),''),
    'acceptedGuidelines',exists(select 1 from community_private.profiles where user_id=auth.uid()),
    'banned',exists(select 1 from community_private.bans where user_id=auth.uid()),
    'moderator',exists(select 1 from community_private.moderators where user_id=auth.uid()));
$$;

create function public.community_set_profile(p_display_name text, p_accepted_guidelines boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.current_user_id(false,false);
begin
  if p_accepted_guidelines is distinct from true or not community_private.valid_text(p_display_name,2,40)
    or p_display_name ~ '[\r\n\t@<>]' or p_display_name ~* 'https?://' then raise exception 'WK_INVALID'; end if;
  if regexp_replace(lower(p_display_name),'[^a-z0-9]','','g') like '%wherekorea%'
    or regexp_replace(lower(p_display_name),'[^a-z0-9]','','g') in ('admin','administrator','moderator','support') then raise exception 'WK_INVALID'; end if;
  perform community_private.consume_rate(uid,'profile_hour',5,3600);
  insert into community_private.profiles(user_id,display_name) values(uid,p_display_name)
    on conflict(user_id) do update set display_name=excluded.display_name;
  return public.community_get_profile();
end;
$$;

create function public.community_list_questions(p_city text default 'all', p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; more boolean;
begin
  if p_page is null or p_page < 1 or p_page > 1000 or p_city is null or p_city not in
    ('all','seoul','busan','jeju','gyeongju','jeonju','gangneung','sokcho','tongyeong','namhae','jirisan','yeosu','andong','suwon','chuncheon','damyang-boseong') then raise exception 'WK_INVALID'; end if;
  select coalesce(jsonb_agg(items.value order by items.created_at desc, items.id desc),'[]'::jsonb) into result from (
    select community_private.question_json(q) value,q.created_at,q.id from community_private.questions q
    where q.status='published' and (p_city='all' or q.city=p_city) and community_private.author_visible(q.author_id)
    order by q.created_at desc,q.id desc limit 20 offset (p_page-1)*20
  ) items;
  select exists(select 1 from community_private.questions q where q.status='published' and (p_city='all' or q.city=p_city)
    and community_private.author_visible(q.author_id) order by q.created_at desc,q.id desc offset p_page*20 limit 1) into more;
  return jsonb_build_object('questions',result,'hasMore',more);
end;
$$;

create function public.community_get_question(p_id uuid, p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q community_private.questions; result jsonb; more boolean;
begin
  if p_page is null or p_page < 1 or p_page > 1000 then raise exception 'WK_INVALID'; end if;
  select * into q from community_private.questions where id=p_id and status='published' and community_private.author_visible(author_id);
  if not found then raise exception 'WK_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(items.value order by items.created_at,items.id),'[]'::jsonb) into result from (
    select community_private.comment_json(c) value,c.created_at,c.id from community_private.comments c
    where c.question_id=p_id and c.status='published' and community_private.author_visible(c.author_id)
    order by c.created_at,c.id limit 30 offset (p_page-1)*30
  ) items;
  select exists(select 1 from community_private.comments c where c.question_id=p_id and c.status='published'
    and community_private.author_visible(c.author_id) order by c.created_at,c.id offset p_page*30 limit 1) into more;
  return jsonb_build_object('question',community_private.question_json(q),'comments',result,'hasMore',more);
end;
$$;

create function public.community_create_question(p_id uuid,p_city text,p_title text,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.current_user_id(true,true); q community_private.questions;
begin
  if p_id is null or p_city is null or p_city not in ('seoul','busan','jeju','gyeongju','jeonju','gangneung','sokcho','tongyeong','namhae','jirisan','yeosu','andong','suwon','chuncheon','damyang-boseong')
    or not community_private.valid_text(p_title,5,140) or not community_private.valid_text(p_body,10,3000) then raise exception 'WK_INVALID'; end if;
  select * into q from community_private.questions where id=p_id;
  if found then
    if q.author_id<>uid or q.status<>'published' or q.city<>p_city or q.title<>p_title or q.body<>p_body then raise exception 'WK_CONFLICT'; end if;
    return community_private.question_json(q);
  end if;
  perform community_private.consume_rate(uid,'question_hour',5,3600);
  perform community_private.consume_rate(uid,'question_minute',1,60);
  insert into community_private.questions(id,author_id,city,title,body) values(p_id,uid,p_city,p_title,p_body) returning * into q;
  return community_private.question_json(q);
end;
$$;

create function public.community_create_comment(p_id uuid,p_question_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.current_user_id(true,true); q community_private.questions; c community_private.comments;
begin
  if p_id is null or not community_private.valid_text(p_body,2,2000) then raise exception 'WK_INVALID'; end if;
  select * into q from community_private.questions where id=p_question_id and status='published' and community_private.author_visible(author_id) for share;
  if not found then raise exception 'WK_NOT_FOUND'; end if;
  select * into c from community_private.comments where id=p_id;
  if found then
    if c.author_id<>uid or c.status<>'published' or c.question_id<>p_question_id or c.body<>p_body then raise exception 'WK_CONFLICT'; end if;
    return community_private.comment_json(c);
  end if;
  perform community_private.consume_rate(uid,'comment_hour',30,3600);
  perform community_private.consume_rate(uid,'comment_minute',5,60);
  insert into community_private.comments(id,question_id,author_id,body) values(p_id,p_question_id,uid,p_body) returning * into c;
  return community_private.comment_json(c);
end;
$$;

create function public.community_delete_question(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  -- Banned authors can still remove their own content; no posting gate applies.
  if uid is null then raise exception 'WK_AUTH_REQUIRED'; end if;
  update community_private.questions set status='deleted',title='',body='' where id=p_id and author_id=uid;
  if not found then raise exception 'WK_NOT_FOUND'; end if;
  return jsonb_build_object('ok',true);
end;
$$;

create function public.community_delete_comment(p_id uuid,p_question_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'WK_AUTH_REQUIRED'; end if;
  update community_private.comments set status='deleted',body='' where id=p_id and question_id=p_question_id and author_id=uid;
  if not found then raise exception 'WK_NOT_FOUND'; end if;
  return jsonb_build_object('ok',true);
end;
$$;

create function public.community_report(p_id uuid,p_question_id uuid,p_comment_id uuid,p_reason text,p_details text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.current_user_id(true,false); existing community_private.reports; target_author uuid;
begin
  if p_id is null or (p_question_id is not null)=(p_comment_id is not null) or p_reason is null
    or p_reason not in ('spam','harassment','personal_information','unsafe','other')
    or not community_private.valid_text(p_details,0,1000) then raise exception 'WK_INVALID'; end if;
  if p_question_id is not null then
    select author_id into target_author from community_private.questions where id=p_question_id and status='published' and community_private.author_visible(author_id);
  else
    select c.author_id into target_author from community_private.comments c join community_private.questions q on q.id=c.question_id
    where c.id=p_comment_id and c.status='published' and q.status='published' and community_private.author_visible(c.author_id) and community_private.author_visible(q.author_id);
  end if;
  if target_author is null then raise exception 'WK_NOT_FOUND'; end if;
  select * into existing from community_private.reports where id=p_id;
  if found then
    if existing.reporter_id<>uid or existing.question_id is distinct from p_question_id or existing.comment_id is distinct from p_comment_id then raise exception 'WK_CONFLICT'; end if;
    return jsonb_build_object('ok',true);
  end if;
  -- One report per person/content; retries under a different ID do not grow the queue.
  if exists(select 1 from community_private.reports where reporter_id=uid and
    ((p_question_id is not null and question_id=p_question_id) or (p_comment_id is not null and comment_id=p_comment_id))) then return jsonb_build_object('ok',true); end if;
  perform community_private.consume_rate(uid,'report_hour',10,3600);
  insert into community_private.reports(id,reporter_id,question_id,comment_id,reason,details) values(p_id,uid,p_question_id,p_comment_id,p_reason,p_details);
  return jsonb_build_object('ok',true);
end;
$$;

create function public.community_get_blocks()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'WK_AUTH_REQUIRED'; end if;
  return jsonb_build_object('blocks',coalesce((select jsonb_agg(jsonb_build_object('userId',b.blocked_profile_id,
    'displayName',coalesce(p.display_name,'Community member'),'createdAt',b.created_at) order by b.created_at desc)
    from community_private.blocks b left join community_private.profiles p on p.user_id=b.blocked_user_id where b.user_id=auth.uid()),'[]'::jsonb));
end;
$$;

create function public.community_set_block(p_user_id uuid,p_blocked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.current_user_id(true,false); target_uid uuid;
begin
  if p_user_id is null or p_blocked is null then raise exception 'WK_INVALID'; end if;
  if p_blocked then
    select user_id into target_uid from community_private.profiles where public_id=p_user_id;
    if target_uid is null then raise exception 'WK_NOT_FOUND'; end if;
    if target_uid=uid then raise exception 'WK_INVALID'; end if;
    if not exists(select 1 from community_private.blocks where user_id=uid and blocked_user_id=target_uid) then
      perform community_private.consume_rate(uid,'block_hour',30,3600);
      insert into community_private.blocks(user_id,blocked_user_id,blocked_profile_id) values(uid,target_uid,p_user_id) on conflict do nothing;
    end if;
  else
    delete from community_private.blocks where user_id=uid and blocked_profile_id=p_user_id;
  end if;
  return jsonb_build_object('ok',true);
end;
$$;

create function public.community_moderation_reports()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from community_private.moderators where user_id=auth.uid())
    or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
    or exists(select 1 from community_private.bans where user_id=auth.uid()) then raise exception 'WK_FORBIDDEN'; end if;
  return jsonb_build_object('reports',coalesce((select jsonb_agg(x.value order by x.created_at) from (
    select r.created_at,jsonb_build_object('id',r.id,'questionId',r.question_id,'commentId',r.comment_id,
      'reason',r.reason,'details',r.details,'createdAt',r.created_at,'status',r.status,'title',q.title,
      'body',coalesce(c.body,q.body),'authorId',p.public_id,'authorName',p.display_name,
      'contentStatus',coalesce(c.status,q.status)) value
    from community_private.reports r left join community_private.questions q on q.id=r.question_id
    left join community_private.comments c on c.id=r.comment_id
    join community_private.profiles p on p.user_id=coalesce(c.author_id,q.author_id)
    where r.status='open' order by r.created_at limit 100
  ) x),'[]'::jsonb));
end;
$$;

create function public.community_moderate(p_report_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.current_user_id(false,false); r community_private.reports; author uuid;
begin
  if not exists(select 1 from community_private.moderators where user_id=uid) then raise exception 'WK_FORBIDDEN'; end if;
  if p_action is null or p_action not in ('hide','resolve','ban') then raise exception 'WK_INVALID'; end if;
  select * into r from community_private.reports where id=p_report_id for update;
  if not found then raise exception 'WK_NOT_FOUND'; end if;
  if r.status='resolved' then return jsonb_build_object('ok',true); end if;
  if r.question_id is not null then select author_id into author from community_private.questions where id=r.question_id;
  else select author_id into author from community_private.comments where id=r.comment_id; end if;
  if p_action='hide' then
    update community_private.questions set status='hidden' where id=r.question_id and status='published';
    update community_private.comments set status='hidden' where id=r.comment_id and status='published';
  elsif p_action='ban' then
    if author=uid or exists(select 1 from community_private.moderators where user_id=author) then raise exception 'WK_FORBIDDEN'; end if;
    insert into community_private.bans(user_id) values(author) on conflict do nothing;
  end if;
  update community_private.reports set status='resolved',resolved_at=now() where id=r.id;
  insert into community_private.moderation_log(moderator_id,target_id,action) values(uid,coalesce(r.comment_id,r.question_id),p_action);
  return jsonb_build_object('ok',true);
end;
$$;

create function public.community_delete_my_data(p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'WK_AUTH_REQUIRED'; end if;
  if p_confirmation is distinct from 'DELETE MY COMMUNITY DATA' then raise exception 'WK_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wherekorea:' || uid::text,0));
  delete from community_private.profiles where user_id=uid;
  delete from community_private.blocks where user_id=uid;
  -- Rate/bans and non-content moderation audit remain to prevent immediate abuse on rejoin.
  -- Other people's blocks remain effective. The existing Supabase auth account is NOT deleted.
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on all functions in schema community_private from public, anon, authenticated;
-- PostgreSQL grants function EXECUTE to PUBLIC by default; remove for EVERY entrypoint.
revoke all on function public.community_status() from public, anon, authenticated;
revoke all on function public.community_get_profile() from public, anon, authenticated;
revoke all on function public.community_set_profile(text,boolean) from public, anon, authenticated;
revoke all on function public.community_list_questions(text,integer) from public, anon, authenticated;
revoke all on function public.community_get_question(uuid,integer) from public, anon, authenticated;
revoke all on function public.community_create_question(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.community_create_comment(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.community_delete_question(uuid) from public, anon, authenticated;
revoke all on function public.community_delete_comment(uuid,uuid) from public, anon, authenticated;
revoke all on function public.community_report(uuid,uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.community_get_blocks() from public, anon, authenticated;
revoke all on function public.community_set_block(uuid,boolean) from public, anon, authenticated;
revoke all on function public.community_moderation_reports() from public, anon, authenticated;
revoke all on function public.community_moderate(uuid,text) from public, anon, authenticated;
revoke all on function public.community_delete_my_data(text) from public, anon, authenticated;

grant execute on function public.community_status(),public.community_list_questions(text,integer),public.community_get_question(uuid,integer) to anon, authenticated;
grant execute on function public.community_get_profile(),public.community_set_profile(text,boolean),
  public.community_create_question(uuid,text,text,text),public.community_create_comment(uuid,uuid,text),
  public.community_delete_question(uuid),public.community_delete_comment(uuid,uuid),
  public.community_report(uuid,uuid,uuid,text,text),public.community_get_blocks(),public.community_set_block(uuid,boolean),
  public.community_moderation_reports(),public.community_moderate(uuid,text),public.community_delete_my_data(text) to authenticated;

commit;
