-- 둘셋 · Next A ① — access rules. Run AFTER schema.sql (same SQL Editor).
-- Idempotent: safe to run again.
--
-- The rule in one line: the API roles (anon, authenticated) can touch no
-- table at all; everything goes through the security-definer functions in
-- schema.sql, each of which checks the owner key or the share token itself.
--
-- Why "RLS on, zero policies": with row-level security enabled and no
-- policy, PostgREST sees no rows and can insert none — even if a grant were
-- ever added by mistake. The explicit REVOKEs below make the tables
-- invisible to the API on top of that. The functions run as their owner
-- (the role that ran schema.sql), which bypasses RLS by design.
--
-- Honest limits of this stage (no auth yet):
--   • the share token IS the secret for reading a snapshot and sending
--     events — a leaked link reads until it expires (≤ 90 days) or she revokes it;
--   • the owner key IS the secret for publishing and pulling — it lives in
--     her phone's localStorage; a wiped browser loses it (a new couple id is
--     created; the old link dies). No way to recover it — by design, for now;
--   • the anon key is public; abuse is bounded only by the size and rate
--     checks inside the functions and Supabase's own API limits;
--   • no audit of who read what beyond created_at / read_at.
-- The fix for all four is Supabase Auth anonymous sign-in (Next A ② / ③):
-- the owner key becomes auth.uid(), policies compare it, and a revoked
-- device is a deleted user.

alter table public.couples enable row level security;
alter table public.couple_tokens enable row level security;
alter table public.partner_snapshots enable row level security;
alter table public.partner_events enable row level security;

-- No policies on purpose (see above).

revoke all on table public.couples from anon, authenticated;
revoke all on table public.couple_tokens from anon, authenticated;
revoke all on table public.partner_snapshots from anon, authenticated;
revoke all on table public.partner_events from anon, authenticated;

-- Functions: Postgres grants EXECUTE to PUBLIC by default, so the internal
-- helpers are taken away explicitly and the entry points granted by name.

revoke execute on function public.dulset_hash(text) from public, anon, authenticated;
revoke execute on function public.dulset_owner_couple(text, uuid) from public, anon, authenticated;
revoke execute on function public.dulset_token_couple(text) from public, anon, authenticated;
revoke execute on function public.dulset_cleanup() from public, anon, authenticated;

-- Owner side (her phone, with the owner key)
grant execute on function public.create_couple(text) to anon, authenticated;
grant execute on function public.issue_token(text, uuid, text, integer) to anon, authenticated;
grant execute on function public.revoke_token(text, uuid, text) to anon, authenticated;
grant execute on function public.publish_snapshot(text, uuid, text, jsonb, timestamptz) to anon, authenticated;
grant execute on function public.pull_events(text, uuid, timestamptz) to anon, authenticated;
grant execute on function public.mark_events_read(text, uuid, text[]) to anon, authenticated;

-- Partner side (his browser, with the link's token)
grant execute on function public.snapshot_by_token(text) to anon, authenticated;
grant execute on function public.send_event(text, text, text, jsonb) to anon, authenticated;

-- Optional housekeeping with pg_cron (Dashboard → Database → Extensions →
-- pg_cron on), once a day at 04:00 KST (19:00 UTC):
--   select cron.schedule('dulset-cleanup', '0 19 * * *', $$select public.dulset_cleanup()$$);
