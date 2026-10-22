-- Signed-in devices: anyone can see the sign-ins on their account (Settings >
-- Signed-in devices, on the website and the iPhone app) and end any of them.
-- Push registrations remember the sign-in that made them, so ending a sign-in
-- also stops that device's notifications.

-- The sign-in (auth.sessions.id) the caller's token belongs to, or null.
create or replace function public.current_session_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when (auth.jwt() ->> 'session_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (auth.jwt() ->> 'session_id')::uuid
  end
$$;

-- Push rows record the sign-in that registered them. Only a signed-in
-- request sets it, so the dispatcher's service-role updates leave it alone.
-- (native_push_tokens comes from the iPhone app's migration.)
alter table public.push_subscriptions add column if not exists session_id uuid;
alter table if exists public.native_push_tokens add column if not exists session_id uuid;

create or replace function public.stamp_push_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  sid uuid := public.current_session_id();
begin
  if sid is not null then
    new.session_id := sid;
  end if;
  return new;
end
$$;

drop trigger if exists push_subscriptions_session on public.push_subscriptions;
create trigger push_subscriptions_session
  before insert or update on public.push_subscriptions
  for each row execute function public.stamp_push_session();

do $$
begin
  if to_regclass('public.native_push_tokens') is not null then
    drop trigger if exists native_push_tokens_session on public.native_push_tokens;
    create trigger native_push_tokens_session
      before insert or update on public.native_push_tokens
      for each row execute function public.stamp_push_session();
  end if;
end
$$;

-- Stops the notifications of the given sign-ins (all but `keep` when `ids` is null).
create or replace function public.forget_session_push(uid uuid, ids uuid[], keep uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_subscriptions
    where user_id = uid and session_id is not null
      and (case when ids is null then session_id <> keep else session_id = any(ids) end);
  if to_regclass('public.native_push_tokens') is not null then
    execute 'delete from public.native_push_tokens
      where user_id = $1 and session_id is not null
        and (case when $2 is null then session_id <> $3 else session_id = any($2) end)'
      using uid, ids, keep;
  end if;
end
$$;
revoke all on function public.forget_session_push(uuid, uuid[], uuid) from public, anon, authenticated;

-- Every sign-in on the caller's account, this one first.
create or replace function public.list_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  last_active_at timestamptz,
  user_agent text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.created_at,
    greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'utc') as last_active_at,
    s.user_agent,
    s.id = public.current_session_id() as is_current
  from auth.sessions s
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by (s.id = public.current_session_id()) desc nulls last,
    greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'utc') desc
$$;

-- False once this sign-in has been ended (from another device or by signing
-- out everywhere). Null when the token doesn't say which sign-in it is, so a
-- client never signs out on a guess.
create or replace function public.my_session_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_session_id() is null then null
    else exists (
      select 1 from auth.sessions s
      where s.id = public.current_session_id() and s.user_id = auth.uid()
    )
  end
$$;

-- Ends one of the caller's sign-ins and stops its notifications.
create or replace function public.revoke_my_session(target uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  perform public.forget_session_push(uid, array[target], null);
  delete from auth.sessions where id = target and user_id = uid;
  return found;
end
$$;

-- Ends every sign-in but this one, and their notifications. Returns how many.
create or replace function public.revoke_my_other_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_sid uuid := public.current_session_id();
  ended integer;
begin
  if uid is null or current_sid is null then
    raise exception 'not signed in';
  end if;
  perform public.forget_session_push(uid, null, current_sid);
  delete from auth.sessions where user_id = uid and id <> current_sid;
  get diagnostics ended = row_count;
  return ended;
end
$$;

revoke all on function public.list_my_sessions() from public, anon;
revoke all on function public.my_session_active() from public, anon;
revoke all on function public.revoke_my_session(uuid) from public, anon;
revoke all on function public.revoke_my_other_sessions() from public, anon;
grant execute on function public.list_my_sessions() to authenticated;
grant execute on function public.my_session_active() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;
grant execute on function public.revoke_my_other_sessions() to authenticated;
