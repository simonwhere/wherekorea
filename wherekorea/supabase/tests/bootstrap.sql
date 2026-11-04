-- Test-only miniature Supabase Auth surface for an isolated PostgreSQL/PGlite database.
-- Never run this bootstrap on an existing Supabase project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email_confirmed_at timestamptz, is_anonymous boolean not null default false);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;

create schema community_test;
create function community_test.assert(p_condition boolean,p_label text)
returns void language plpgsql as $$
begin
  if p_condition is distinct from true then raise exception 'ASSERTION FAILED: %',p_label; end if;
end;
$$;
create function community_test.expect_error(p_sql text,p_expected text)
returns void language plpgsql as $$
declare actual text;
begin
  begin
    execute p_sql;
  exception when others then
    actual := sqlerrm;
  end;
  if actual is null or actual not like '%' || p_expected || '%' then
    raise exception 'Expected error %, received %',p_expected,coalesce(actual,'NO ERROR');
  end if;
end;
$$;
grant usage on schema community_test to anon,authenticated;
grant execute on all functions in schema community_test to anon,authenticated;
