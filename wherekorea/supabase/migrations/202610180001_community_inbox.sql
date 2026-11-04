-- Additive follow-up to 202610170001_community_questions.sql.
-- In-site reply alerts only: no email, push, or backfill of earlier comments.
begin;

create table community_private.reply_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references community_private.profiles(user_id) on delete cascade,
  comment_id uuid not null unique references community_private.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index community_reply_notifications_recent
  on community_private.reply_notifications(recipient_id, created_at desc, id desc);
create index community_reply_notifications_unread
  on community_private.reply_notifications(recipient_id) where read_at is null;
create index community_questions_author
  on community_private.questions(author_id, created_at desc, id desc) where status='published';
alter table community_private.reply_notifications enable row level security;
revoke all on table community_private.reply_notifications from public, anon, authenticated;

-- Reading one's inbox does not require a nickname or an open publishing gate.
-- Do not trust a client-supplied recipient or user-editable account metadata.
create function community_private.inbox_user_id()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'WK_AUTH_REQUIRED'; end if;
  if not exists(select 1 from auth.users u where u.id=uid and u.email_confirmed_at is not null) then
    raise exception 'WK_EMAIL_REQUIRED';
  end if;
  if exists(select 1 from community_private.bans b where b.user_id=uid) then raise exception 'WK_FORBIDDEN'; end if;
  return uid;
end;
$$;

-- One committed comment yields at most one alert, including idempotent RPC retries.
-- No message text is copied, so content removal cannot leave a leaked excerpt.
create function community_private.notify_question_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  select q.author_id into recipient from community_private.questions q
    where q.id=new.question_id and q.status='published';
  if recipient is not null and recipient<>new.author_id and new.status='published'
    and not community_private.blocked(recipient,new.author_id)
    and not exists(select 1 from community_private.bans b where b.user_id in (recipient,new.author_id)) then
    insert into community_private.reply_notifications(recipient_id,comment_id)
      values(recipient,new.id) on conflict(comment_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger community_comment_reply_notification
  after insert on community_private.comments for each row
  execute function community_private.notify_question_reply();

-- All list, badge and receipt paths share the same current visibility rules.
create function community_private.visible_reply_notifications(p_uid uuid)
returns table(id uuid,question_id uuid,comment_id uuid,city text,question_title text,
  author_name text,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id,q.id,c.id,q.city,q.title,p.display_name,n.created_at,n.read_at
  from community_private.reply_notifications n
  join community_private.comments c on c.id=n.comment_id
  join community_private.questions q on q.id=c.question_id
  join community_private.profiles p on p.user_id=c.author_id
  where n.recipient_id=p_uid and q.author_id=p_uid and c.author_id<>p_uid
    and c.status='published' and q.status='published'
    and community_private.author_visible(c.author_id)
    and community_private.author_visible(q.author_id);
$$;

create function public.community_my_questions(p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := community_private.inbox_user_id(); result jsonb; more boolean;
begin
  if p_page is null or p_page<1 or p_page>1000 then raise exception 'WK_INVALID'; end if;
  select coalesce(jsonb_agg(items.value order by items.created_at desc,items.id desc),'[]'::jsonb) into result from (
    select q.id,q.created_at,jsonb_build_object('id',q.id,'city',q.city,'title',q.title,
      'createdAt',q.created_at,'commentCount',(select count(*) from community_private.comments c
        where c.question_id=q.id and c.status='published' and community_private.author_visible(c.author_id))) value
    from community_private.questions q where q.author_id=uid and q.status='published'
    order by q.created_at desc,q.id desc limit 20 offset (p_page-1)*20
  ) items;
  select exists(select 1 from community_private.questions q where q.author_id=uid and q.status='published'
    order by q.created_at desc,q.id desc offset p_page*20 limit 1) into more;
  return jsonb_build_object('questions',result,'hasMore',more);
end;
$$;

create function public.community_notifications(p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := community_private.inbox_user_id(); result jsonb; more boolean; unread bigint;
begin
  if p_page is null or p_page<1 or p_page>1000 then raise exception 'WK_INVALID'; end if;
  select coalesce(jsonb_agg(items.value order by items.created_at desc,items.id desc),'[]'::jsonb) into result from (
    select n.id,n.created_at,jsonb_build_object('id',n.id,'questionId',n.question_id,'commentId',n.comment_id,
      'city',n.city,'questionTitle',n.question_title,'authorName',n.author_name,
      'createdAt',n.created_at,'readAt',n.read_at) value
    from community_private.visible_reply_notifications(uid) n
    order by n.created_at desc,n.id desc limit 20 offset (p_page-1)*20
  ) items;
  select exists(select 1 from community_private.visible_reply_notifications(uid) n
    order by n.created_at desc,n.id desc offset p_page*20 limit 1) into more;
  select count(*) into unread from community_private.visible_reply_notifications(uid) n where n.read_at is null;
  return jsonb_build_object('notifications',result,'hasMore',more,'unreadCount',unread);
end;
$$;

create function public.community_read_notifications(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.inbox_user_id(); unread bigint;
begin
  if p_ids is null or cardinality(p_ids)<1 or cardinality(p_ids)>50
    or array_ndims(p_ids)<>1 then raise exception 'WK_INVALID'; end if;
  if array_position(p_ids,null) is not null then raise exception 'WK_INVALID'; end if;
  -- Foreign, hidden and missing IDs all have the same response; never disclose ownership.
  update community_private.reply_notifications n set read_at=now()
    where n.recipient_id=uid and n.read_at is null and n.id=any(p_ids)
      and n.id in (select v.id from community_private.visible_reply_notifications(uid) v);
  select count(*) into unread from community_private.visible_reply_notifications(uid) n where n.read_at is null;
  return jsonb_build_object('ok',true,'unreadCount',unread);
end;
$$;

revoke all on function community_private.inbox_user_id() from public, anon, authenticated;
revoke all on function community_private.notify_question_reply() from public, anon, authenticated;
revoke all on function community_private.visible_reply_notifications(uuid) from public, anon, authenticated;
revoke all on function public.community_my_questions(integer) from public, anon, authenticated;
revoke all on function public.community_notifications(integer) from public, anon, authenticated;
revoke all on function public.community_read_notifications(uuid[]) from public, anon, authenticated;
grant execute on function public.community_my_questions(integer),public.community_notifications(integer),
  public.community_read_notifications(uuid[]) to authenticated;

commit;
