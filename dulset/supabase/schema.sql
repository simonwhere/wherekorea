-- 둘셋 · Next A ① — 남편용 설치 없는 웹 화면 (partner link): tables + RPC
--
-- Run in the Supabase SQL Editor of a Seoul-region project (ap-northeast-2),
-- this file first, then policies.sql. Idempotent: safe to run again.
--
-- ┌────────────────────────────────────────────────────────────────────┐
-- │ NOT YET RUN AGAINST A REAL PROJECT (none exists while this is      │
-- │ written). The client that calls these functions is                 │
-- │ lib/sync/supabaseTransport.ts; its request shaping is unit-tested, │
-- │ the SQL is not. Keep docs/next-a-setup.md open on the first run.   │
-- └────────────────────────────────────────────────────────────────────┘
--
-- What is stored (and what is not):
--   • couples            one row per couple space; only the SHA-256 of the
--                        owner's device key (the phone that tracks the cycle)
--   • couple_tokens      share tokens for the link she sends — hash only,
--                        with an expiry and a revoke mark
--   • partner_snapshots  the PartnerSnapshot her phone built through the
--                        privacy lenses (lib/logic/partnerSnapshot.ts): what
--                        his page shows, nothing more. No period, LH or test
--                        record, no personal log, no 관계일 ever gets here.
--   • partner_events     what his page sends back: ids and dates only
--                        (lib/logic/partnerEvents.ts), never free text
--   • link_opens         '링크 연 날' (research only, Now 3 decision
--                        2026-10-03): couple id · Seoul date · how many
--                        opens. No IP, no device, no time of day, no token,
--                        no content. Never shown on her phone. Deleted after
--                        the study (README → 연구가 끝나면).
--
-- Trust model, honestly: there is no account. The owner key and the share
-- token are the secrets (the server keeps their hashes; the strings travel
-- over TLS inside RPC calls). Whoever has the link sees the snapshot until it
-- expires or is revoked. The anon key is public by design and gives no table
-- access (policies.sql) — only these functions. Next step (② / ③): Supabase
-- Auth anonymous sign-in, so auth.uid() replaces the owner key in RLS.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ── Tables ──────────────────────────────────────────────────

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  owner_key_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_tokens (
  token_hash text primary key,
  couple_id uuid not null references public.couples (id) on delete cascade,
  role text not null default 'partner-view' check (role in ('partner-view')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists couple_tokens_couple_idx on public.couple_tokens (couple_id);

create table if not exists public.partner_snapshots (
  couple_id uuid not null references public.couples (id) on delete cascade,
  version integer not null check (version > 0),
  published_at timestamptz not null default now(),
  payload jsonb not null,
  primary key (couple_id, version)
);

create table if not exists public.partner_events (
  id text not null,
  couple_id uuid not null references public.couples (id) on delete cascade,
  from_role text not null default 'partner-view' check (from_role in ('partner-view')),
  kind text not null,
  payload jsonb not null,
  -- The server's clock: the moment the event was taken in. The client pages on it.
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (couple_id, id)
);
create index if not exists partner_events_couple_created_idx on public.partner_events (couple_id, created_at);

-- '링크 연 날': one row per couple per Seoul date; `count` is how many times
-- the page was loaded that day (the page polls every few seconds, but only a
-- load counts — lib/sync/linkOpens.ts). The study reads distinct days.
create table if not exists public.link_opens (
  couple_id uuid not null references public.couples (id) on delete cascade,
  day date not null,
  count integer not null default 1 check (count > 0),
  primary key (couple_id, day)
);

-- ── Limits (one place) ──────────────────────────────────────

-- A snapshot is seven days of a page's worth of text (v2, ~25 KB; 128 KB
-- at most); an event is a handful of ids.
-- Tokens live 30 days by default, 90 at most. A couple's link may send at
-- most 200 events a day (the app itself allows far fewer taps).

-- ── Internal helpers (not callable from the API — see policies.sql) ──

create or replace function public.dulset_hash(p_secret text)
returns text
language sql
immutable
strict
set search_path = public, extensions
as $$
  select encode(extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256'), 'hex')
$$;

-- The couple `p_owner_key` owns, or an error (42501 → HTTP 403).
create or replace function public.dulset_owner_couple(p_owner_key text, p_couple_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_owner_key is null or length(p_owner_key) < 32 or p_couple_id is null then
    raise exception 'owner key or couple missing' using errcode = '42501';
  end if;
  select c.id into v_id
    from public.couples c
   where c.id = p_couple_id and c.owner_key_hash = public.dulset_hash(p_owner_key);
  if v_id is null then
    raise exception 'not the owner of this couple' using errcode = '42501';
  end if;
  return v_id;
end
$$;

-- The couple a live (unexpired, unrevoked) share token opens, or an error.
create or replace function public.dulset_token_couple(p_token text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'link not valid' using errcode = '42501';
  end if;
  select t.couple_id into v_id
    from public.couple_tokens t
   where t.token_hash = public.dulset_hash(p_token)
     and t.revoked_at is null
     and t.expires_at > now();
  if v_id is null then
    raise exception 'link not valid' using errcode = '42501';
  end if;
  return v_id;
end
$$;

-- ── Owner side (her phone) ──────────────────────────────────

-- Register this device as the owner of a new couple space. Returns its id;
-- the app keeps it next to the owner key (lib/sync/supabaseTransport.ts).
create or replace function public.create_couple(p_owner_key text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_owner_key is null or length(p_owner_key) < 32 then
    raise exception 'owner key too short' using errcode = '22023';
  end if;
  insert into public.couples (owner_key_hash)
  values (public.dulset_hash(p_owner_key))
  returning id into v_id;
  return v_id;
end
$$;

-- Issue (or extend / un-revoke) a share token for the link. The owner makes
-- the random token on her phone; only its hash is stored. Returns the expiry.
create or replace function public.issue_token(p_owner_key text, p_couple_id uuid, p_token text, p_days integer default 30)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple uuid := public.dulset_owner_couple(p_owner_key, p_couple_id);
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 90);
  v_expires timestamptz;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'token too short' using errcode = '22023';
  end if;
  insert into public.couple_tokens (token_hash, couple_id, expires_at)
  values (public.dulset_hash(p_token), v_couple, now() + make_interval(days => v_days))
  on conflict (token_hash) do update
     set expires_at = excluded.expires_at, revoked_at = null
   where public.couple_tokens.couple_id = excluded.couple_id
  returning expires_at into v_expires;
  if v_expires is null then
    raise exception 'token belongs to another couple' using errcode = '42501';
  end if;
  return v_expires;
end
$$;

-- The link stops working at once (the row stays for the audit trail).
create or replace function public.revoke_token(p_owner_key text, p_couple_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple uuid := public.dulset_owner_couple(p_owner_key, p_couple_id);
begin
  update public.couple_tokens
     set revoked_at = coalesce(revoked_at, now())
   where token_hash = public.dulset_hash(coalesce(p_token, ''))
     and couple_id = v_couple;
end
$$;

-- Publish the latest snapshot under `p_token` (issued on first use, 30 days).
-- Keeps the last three versions; returns the new version number. Since v2
-- the payload carries today and the six days after it (N20).
create or replace function public.publish_snapshot(
  p_owner_key text,
  p_couple_id uuid,
  p_token text,
  p_payload jsonb,
  p_published_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple uuid := public.dulset_owner_couple(p_owner_key, p_couple_id);
  v_tok_couple uuid;
  v_revoked timestamptz;
  v_version integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'snapshot must be an object' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 131072 then
    raise exception 'snapshot too large' using errcode = '22023';
  end if;
  if p_token is null or length(p_token) < 16 then
    raise exception 'token too short' using errcode = '22023';
  end if;

  -- The link's token: issue it on first publish; never publish under a
  -- revoked one or one that belongs to another couple.
  select t.couple_id, t.revoked_at into v_tok_couple, v_revoked
    from public.couple_tokens t
   where t.token_hash = public.dulset_hash(p_token);
  if v_tok_couple is null then
    insert into public.couple_tokens (token_hash, couple_id, expires_at)
    values (public.dulset_hash(p_token), v_couple, now() + interval '30 days');
  elsif v_tok_couple <> v_couple or v_revoked is not null then
    raise exception 'token not usable for this couple' using errcode = '42501';
  end if;

  -- One publisher at a time per couple, so version numbers never collide.
  perform pg_advisory_xact_lock(hashtext(v_couple::text));
  select coalesce(max(s.version), 0) + 1 into v_version
    from public.partner_snapshots s
   where s.couple_id = v_couple;
  insert into public.partner_snapshots (couple_id, version, published_at, payload)
  values (v_couple, v_version, coalesce(p_published_at, now()), p_payload);
  delete from public.partner_snapshots
   where couple_id = v_couple and version < v_version - 2;
  return v_version;
end
$$;

-- The events his page sent after `p_since` (null = all), oldest first, 200 at most.
create or replace function public.pull_events(p_owner_key text, p_couple_id uuid, p_since timestamptz default null)
returns table (id text, kind text, payload jsonb, created_at timestamptz, read_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_couple uuid := public.dulset_owner_couple(p_owner_key, p_couple_id);
begin
  return query
    select e.id, e.kind, e.payload, e.created_at, e.read_at
      from public.partner_events e
     where e.couple_id = v_couple
       and (p_since is null or e.created_at > p_since)
     order by e.created_at, e.id
     limit 200;
end
$$;

-- Mark events her phone has applied. Returns how many rows changed.
create or replace function public.mark_events_read(p_owner_key text, p_couple_id uuid, p_ids text[])
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple uuid := public.dulset_owner_couple(p_owner_key, p_couple_id);
  v_n integer;
begin
  update public.partner_events e
     set read_at = coalesce(e.read_at, now())
   where e.couple_id = v_couple
     and e.id = any (coalesce(p_ids, array[]::text[]))
     and e.read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- ── Partner side (his browser, with the link's token) ───────

-- The latest snapshot a live token opens — no rows (not an error) when the
-- token is unknown, expired, revoked, or nothing was published yet.
create or replace function public.snapshot_by_token(p_token text)
returns table (couple_id uuid, version integer, published_at timestamptz, payload jsonb)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select s.couple_id, s.version, s.published_at, s.payload
    from public.couple_tokens t
    join public.partner_snapshots s on s.couple_id = t.couple_id
   where p_token is not null
     and length(p_token) >= 16
     and t.token_hash = public.dulset_hash(p_token)
     and t.revoked_at is null
     and t.expires_at > now()
   order by s.version desc
   limit 1
$$;

-- One event from his page. Idempotent by (couple, id); small; rate-limited.
create or replace function public.send_event(p_token text, p_event_id text, p_kind text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple uuid := public.dulset_token_couple(p_token);
  v_today integer;
begin
  if p_event_id is null or length(p_event_id) < 1 or length(p_event_id) > 64 or p_event_id !~ '^[A-Za-z0-9_.:-]+$' then
    raise exception 'event id not valid' using errcode = '22023';
  end if;
  if p_kind is null or length(p_kind) < 1 or length(p_kind) > 40 then
    raise exception 'event kind not valid' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 4096 then
    raise exception 'event payload not valid' using errcode = '22023';
  end if;
  select count(*) into v_today
    from public.partner_events e
   where e.couple_id = v_couple and e.created_at > now() - interval '1 day';
  if v_today >= 200 then
    raise exception 'too many events today' using errcode = '54000';
  end if;
  insert into public.partner_events (id, couple_id, from_role, kind, payload)
  values (p_event_id, v_couple, 'partner-view', p_kind, p_payload)
  on conflict (couple_id, id) do nothing;
end
$$;

-- '링크 연 날' (research only): his page says it was opened. The token is the
-- only argument; the couple comes from its hash, the day is the server's own
-- Seoul date. An unknown, expired or revoked token records nothing — and no
-- error either, so the page never learns more than it sent.
create or replace function public.record_link_open(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_couple uuid;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_token is null or length(p_token) < 16 then
    return;
  end if;
  select t.couple_id into v_couple
    from public.couple_tokens t
   where t.token_hash = public.dulset_hash(p_token)
     and t.revoked_at is null
     and t.expires_at > now();
  if v_couple is null then
    return;
  end if;
  insert into public.link_opens as o (couple_id, day, count)
  values (v_couple, v_day, 1)
  on conflict (couple_id, day) do update
     set count = least(o.count + 1, 100000);
end
$$;

-- Research only: on how many distinct days in p_from…p_to (inclusive) the
-- couple's link was opened. The owner key is checked like every owner call.
-- The app never shows this number on her phone (positioning §6 — 읽음 표시는
-- 압박이에요); it is for the study's own export.
create or replace function public.link_open_days(p_owner_key text, p_couple_id uuid, p_from date, p_to date)
returns integer
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_couple uuid := public.dulset_owner_couple(p_owner_key, p_couple_id);
  v_n integer;
begin
  select count(*)::integer into v_n
    from public.link_opens o
   where o.couple_id = v_couple
     and o.day between p_from and p_to
     and o.count > 0;
  return coalesce(v_n, 0);
end
$$;

-- ── Housekeeping (optional: schedule with pg_cron, see README) ──

-- Old events, old snapshots and long-expired tokens go; nothing a live link needs.
-- DURING THE STUDY do not schedule it (README → 연구 중에는): the study reads
-- old snapshots and events. It never touches link_opens — that table goes
-- whole after the study.
create or replace function public.dulset_cleanup()
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from public.partner_events where created_at < now() - interval '30 days';
  delete from public.partner_snapshots s
   where s.published_at < now() - interval '7 days'
     and s.version < (select max(x.version) from public.partner_snapshots x where x.couple_id = s.couple_id);
  delete from public.couple_tokens where expires_at < now() - interval '30 days';
$$;
