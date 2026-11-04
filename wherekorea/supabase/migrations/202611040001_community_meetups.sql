-- Dated travel-buddy posts share moderation, comment, block, ownership and inbox rules with questions.
-- Run after the inbox repair. Existing rows remain ordinary questions. Separate write switch starts closed.
begin;
alter table community_private.questions add column if not exists meetup_date date;
alter table community_private.settings add column if not exists meetup_posting_enabled boolean not null default false;
create index if not exists community_meetups_upcoming on community_private.questions(meetup_date,created_at desc,id desc)
  where meetup_date is not null and status='published';

create or replace function community_private.korea_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;
-- Catch common public contact handles. Reports and human moderation also apply to free text.
create or replace function community_private.check_meetup_text(content text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if content ~* '(@[[:alnum:]_]+|t[.]me/|open[.]kakao[.]com/|wa[.]me/|discord[.]gg/|[[:digit:]]{3}[- .][[:digit:]]{3,4}[- .][[:digit:]]{4})'
  then raise exception 'WK_PUBLIC_CONTACT'; end if;
end;
$$;

create or replace function community_private.question_json(q community_private.questions)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',q.id,'city',q.city,'title',q.title,'body',q.body,
    'authorId',p.public_id,'authorName',p.display_name,'createdAt',q.created_at,
    'type',case when q.meetup_date is null then 'questions' else 'meetups' end,
    'meetupDate',q.meetup_date,'expired',coalesce(q.meetup_date < community_private.korea_today(),false),
    'owned',coalesce(q.author_id = auth.uid(),false),
    'commentCount',(select count(*) from community_private.comments c where c.question_id=q.id
      and c.status='published' and community_private.author_visible(c.author_id)))
  from community_private.profiles p where p.user_id=q.author_id;
$$;

create or replace function community_private.create_post(p_id uuid,p_city text,p_title text,p_body text,p_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := community_private.current_user_id(true,true); q community_private.questions; guest boolean;
begin
  if p_id is null or p_city is null or p_city not in ('seoul','busan','jeju','gyeongju','jeonju','gangneung','sokcho','tongyeong','namhae','jirisan','yeosu','andong','suwon','chuncheon','damyang-boseong')
    or not community_private.valid_text(p_title,5,140) or not community_private.valid_text(p_body,10,3000) then raise exception 'WK_INVALID'; end if;
  if p_date is not null and not exists(select 1 from community_private.settings where singleton and meetup_posting_enabled)
    then raise exception 'WK_MEETUPS_CLOSED'; end if;
  select * into q from community_private.questions where id=p_id;
  if found then
    if q.author_id<>uid or q.status<>'published' or q.meetup_date is distinct from p_date or q.city<>p_city or q.title<>p_title or q.body<>p_body then raise exception 'WK_CONFLICT'; end if;
    return community_private.question_json(q);
  end if;
  if p_date is not null then
    if p_date < community_private.korea_today() or p_date > community_private.korea_today() + 365 then raise exception 'WK_INVALID'; end if;
    perform community_private.check_meetup_text(p_title || ' ' || p_body);
  end if;
  select u.is_anonymous is true into guest from auth.users u where u.id=uid;
  perform community_private.consume_rate(uid,'question_hour',case when guest then 3 else 5 end,3600);
  perform community_private.consume_rate(uid,'question_minute',1,60);
  if guest then
    perform community_private.consume_rate(uid,'question_day',5,86400);
    perform community_private.consume_guest_rate('question_day',100);
  end if;
  insert into community_private.questions(id,author_id,city,title,body,meetup_date) values(p_id,uid,p_city,p_title,p_body,p_date) returning * into q;
  return community_private.question_json(q);
end;
$$;

create or replace function public.community_create_question(p_id uuid,p_city text,p_title text,p_body text)
returns jsonb language sql security definer set search_path = '' as $$
  select community_private.create_post(p_id,p_city,p_title,p_body,null);
$$;

create or replace function public.community_create_meetup(p_id uuid,p_city text,p_title text,p_body text,p_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_date is null then raise exception 'WK_INVALID'; end if;
  return community_private.create_post(p_id,p_city,p_title,p_body,p_date);
end;
$$;

create or replace function community_private.list_posts(p_city text,p_page integer,meetups boolean,p_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if p_page is null or p_page < 1 or p_page > 1000 or p_city is null or p_city not in
    ('all','seoul','busan','jeju','gyeongju','jeonju','gangneung','sokcho','tongyeong','namhae','jirisan','yeosu','andong','suwon','chuncheon','damyang-boseong') then raise exception 'WK_INVALID'; end if;
  -- Fetch one extra row to distinguish the last full page from a following page.
  with page_rows as (
    select q from community_private.questions q
      where q.status='published' and (p_city='all' or q.city=p_city) and community_private.author_visible(q.author_id)
        and ((meetups and q.meetup_date >= community_private.korea_today() and (p_date is null or q.meetup_date=p_date))
          or (not meetups and q.meetup_date is null))
      order by q.meetup_date,q.created_at desc,q.id desc limit 21 offset (p_page-1)*20
  ), numbered as (
    select q, row_number() over (order by (q).meetup_date,(q).created_at desc,(q).id desc) n from page_rows
  ) select jsonb_build_object('questions',coalesce(jsonb_agg(community_private.question_json(q) order by n) filter(where n<=20),'[]'::jsonb),
         'hasMore',count(*)>20) into result from numbered;
  return result;
end;
$$;
create or replace function public.community_list_questions(p_city text default 'all',p_page integer default 1)
returns jsonb language sql stable security definer set search_path = '' as $$
  select community_private.list_posts(p_city,p_page,false,null);
$$;
create or replace function public.community_list_meetups(p_city text default 'all',p_page integer default 1,p_date date default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select community_private.list_posts(p_city,p_page,true,p_date);
$$;

-- Applies even to direct RPC calls. Existing successful comment retries need no new insert.
create or replace function community_private.check_meetup_reply()
returns trigger language plpgsql security definer set search_path = '' as $$
declare scheduled date;
begin
  select meetup_date into scheduled from community_private.questions where id=new.question_id;
  if scheduled is not null then
    if scheduled < community_private.korea_today() then raise exception 'WK_MEETUP_ENDED'; end if;
    if not exists(select 1 from community_private.settings where singleton and meetup_posting_enabled)
      then raise exception 'WK_MEETUPS_CLOSED'; end if;
    perform community_private.check_meetup_text(new.body);
  end if;
  return new;
end;
$$;
create or replace trigger community_meetup_reply before insert on community_private.comments
  for each row execute function community_private.check_meetup_reply();

revoke all on function community_private.create_post(uuid,text,text,text,date),community_private.list_posts(text,integer,boolean,date),
  community_private.korea_today(),community_private.check_meetup_text(text),community_private.check_meetup_reply()
  from public,anon,authenticated;
revoke all on function public.community_list_meetups(text,integer,date),public.community_create_meetup(uuid,text,text,text,date)
  from public,anon,authenticated;
grant execute on function public.community_list_meetups(text,integer,date) to anon,authenticated;
grant execute on function public.community_create_meetup(uuid,text,text,text,date) to authenticated;
create or replace function public.community_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'postingEnabled',coalesce((select posting_enabled from community_private.settings where singleton),false),
    'guestEnabled',coalesce((select guest_enabled from community_private.settings where singleton),false),
    'meetupSchemaVersion',1,
    'meetupPostingEnabled',coalesce((select meetup_posting_enabled from community_private.settings where singleton),false),
    'guestSchemaVersion',1,'inboxSchemaVersion',1);
$$;
notify pgrst,'reload schema';
commit;
