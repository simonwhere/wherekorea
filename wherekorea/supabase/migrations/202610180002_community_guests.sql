-- Additive guest participation; apply after both existing community migrations.
-- Anonymous Auth users keep an authenticated role and their own auth.uid().
-- This does NOT grant writes to the unauthenticated anon database role.
-- Configure Supabase Auth CAPTCHA and signup limits before enabling guests.
begin;

alter table community_private.settings add column guest_enabled boolean not null default false;

-- A shared safety ceiling bounds writes even when identities are replaced.
-- Fixed UTC-day buckets, not a promise of rolling-window or IP-level protection.
create table community_private.guest_rate_limits (
  action text not null check (action in ('question_day','comment_day')),
  bucket timestamptz not null,
  count integer not null check (count > 0),
  primary key(action,bucket)
);
alter table community_private.guest_rate_limits enable row level security;
revoke all on table community_private.guest_rate_limits from public, anon, authenticated;

create function community_private.consume_guest_rate(kind text, maximum integer)
returns void language plpgsql security definer set search_path = '' as $$
declare slot timestamptz := pg_catalog.to_timestamp(floor(extract(epoch from now()) / 86400) * 86400); total integer;
begin
  -- The unique row's ON CONFLICT update serializes concurrent identities.
  -- Exceeding a ceiling rolls the entire write (including all quotas) back.
  insert into community_private.guest_rate_limits(action,bucket,count) values(kind,slot,1)
  on conflict(action,bucket) do update set count=community_private.guest_rate_limits.count+1
  returning count into total;
  if total>maximum then raise exception 'WK_RATE_LIMIT'; end if;
  delete from community_private.guest_rate_limits where bucket<now()-interval '2 days';
end;
$$;

create or replace function community_private.current_user_id(needs_profile boolean default true, posting boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); guest boolean;
begin
  if uid is null then raise exception 'WK_AUTH_REQUIRED'; end if;
  select coalesce(u.is_anonymous,false) into guest from auth.users u
    where u.id=uid and (u.is_anonymous is true or u.email_confirmed_at is not null);
  if not found then raise exception 'WK_EMAIL_REQUIRED'; end if;
  if exists(select 1 from community_private.bans b where b.user_id=uid) then raise exception 'WK_FORBIDDEN'; end if;
  if needs_profile and not exists(select 1 from community_private.profiles p where p.user_id=uid) then raise exception 'WK_PROFILE_REQUIRED'; end if;
  if posting and not exists(select 1 from community_private.settings s where s.singleton and s.posting_enabled) then raise exception 'WK_DISABLED'; end if;
  if posting and guest and not exists(select 1 from community_private.settings s where s.singleton and s.guest_enabled) then raise exception 'WK_GUEST_DISABLED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('wherekorea:' || uid::text,0));
  return uid;
end;
$$;

create or replace function community_private.inbox_user_id()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'WK_AUTH_REQUIRED'; end if;
  if not exists(select 1 from auth.users u where u.id=uid and (u.is_anonymous is true or u.email_confirmed_at is not null)) then raise exception 'WK_EMAIL_REQUIRED'; end if;
  if exists(select 1 from community_private.bans b where b.user_id=uid) then raise exception 'WK_FORBIDDEN'; end if;
  return uid;
end;
$$;

create function community_private.is_moderator(p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u join community_private.moderators m on m.user_id=u.id
    where u.id=p_uid and u.is_anonymous is not true and u.email_confirmed_at is not null)
    and not exists(select 1 from community_private.bans b where b.user_id=p_uid);
$$;

create or replace function public.community_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'postingEnabled',coalesce((select posting_enabled from community_private.settings where singleton),false),
    'guestEnabled',coalesce((select guest_enabled from community_private.settings where singleton),false),
    'guestSchemaVersion',1);
$$;

create or replace function public.community_get_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('displayName',coalesce((select display_name from community_private.profiles where user_id=auth.uid()),''),
    'acceptedGuidelines',exists(select 1 from community_private.profiles where user_id=auth.uid()),
    'banned',exists(select 1 from community_private.bans where user_id=auth.uid()),
    'moderator',community_private.is_moderator(auth.uid()));
$$;

create or replace function public.community_create_question(p_id uuid,p_city text,p_title text,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.current_user_id(true,true); q community_private.questions; guest boolean;
begin
  if p_id is null or p_city is null or p_city not in ('seoul','busan','jeju','gyeongju','jeonju','gangneung','sokcho','tongyeong','namhae','jirisan','yeosu','andong','suwon','chuncheon','damyang-boseong')
    or not community_private.valid_text(p_title,5,140) or not community_private.valid_text(p_body,10,3000) then raise exception 'WK_INVALID'; end if;
  select * into q from community_private.questions where id=p_id;
  if found then
    if q.author_id<>uid or q.status<>'published' or q.city<>p_city or q.title<>p_title or q.body<>p_body then raise exception 'WK_CONFLICT'; end if;
    return community_private.question_json(q);
  end if;
  select u.is_anonymous is true into guest from auth.users u where u.id=uid;
  perform community_private.consume_rate(uid,'question_hour',case when guest then 3 else 5 end,3600);
  perform community_private.consume_rate(uid,'question_minute',1,60);
  if guest then
    perform community_private.consume_rate(uid,'question_day',5,86400);
    perform community_private.consume_guest_rate('question_day',100);
  end if;
  insert into community_private.questions(id,author_id,city,title,body) values(p_id,uid,p_city,p_title,p_body) returning * into q;
  return community_private.question_json(q);
end;
$$;

create or replace function public.community_create_comment(p_id uuid,p_question_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.current_user_id(true,true); q community_private.questions; c community_private.comments; guest boolean;
begin
  if p_id is null or not community_private.valid_text(p_body,2,2000) then raise exception 'WK_INVALID'; end if;
  select * into q from community_private.questions where id=p_question_id and status='published' and community_private.author_visible(author_id) for share;
  if not found then raise exception 'WK_NOT_FOUND'; end if;
  select * into c from community_private.comments where id=p_id;
  if found then
    if c.author_id<>uid or c.status<>'published' or c.question_id<>p_question_id or c.body<>p_body then raise exception 'WK_CONFLICT'; end if;
    return community_private.comment_json(c);
  end if;
  select u.is_anonymous is true into guest from auth.users u where u.id=uid;
  perform community_private.consume_rate(uid,'comment_hour',case when guest then 10 else 30 end,3600);
  perform community_private.consume_rate(uid,'comment_minute',case when guest then 3 else 5 end,60);
  if guest then
    perform community_private.consume_rate(uid,'comment_day',30,86400);
    perform community_private.consume_guest_rate('comment_day',500);
  end if;
  insert into community_private.comments(id,question_id,author_id,body) values(p_id,p_question_id,uid,p_body) returning * into c;
  return community_private.comment_json(c);
end;
$$;

create or replace function public.community_moderation_reports()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not community_private.is_moderator(auth.uid()) then raise exception 'WK_FORBIDDEN'; end if;
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

create or replace function public.community_moderate(p_report_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r community_private.reports; author uuid;
begin
  if not community_private.is_moderator(uid) then raise exception 'WK_FORBIDDEN'; end if;
  -- Keep the existing mutation serialization after the stronger moderator gate.
  perform community_private.current_user_id(false,false);
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
    if author=uid or community_private.is_moderator(author) then raise exception 'WK_FORBIDDEN'; end if;
    insert into community_private.bans(user_id) values(author) on conflict do nothing;
  end if;
  update community_private.reports set status='resolved',resolved_at=now() where id=r.id;
  insert into community_private.moderation_log(moderator_id,target_id,action) values(uid,coalesce(r.comment_id,r.question_id),p_action);
  return jsonb_build_object('ok',true);
end;
$$;

-- CREATE OR REPLACE retains existing narrowly scoped RPC grants. New helpers
-- must not inherit PostgreSQL's default PUBLIC execute permission.
revoke all on function community_private.consume_guest_rate(text,integer) from public, anon, authenticated;
revoke all on function community_private.is_moderator(uuid) from public, anon, authenticated;
commit;
