-- Merge only edited fields under the row lock. Two devices changing different
-- switches must not replace each other's notification preferences.
create or replace function public.patch_notification_preferences(changes jsonb, device_timezone_offset integer)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if changes is null or jsonb_typeof(changes) <> 'object' then
    raise exception 'Expected preference changes' using errcode = '22023';
  end if;
  insert into public.notification_prefs (user_id, prefs, timezone_offset_minutes, updated_at)
  values (auth.uid(), changes, device_timezone_offset, now())
  on conflict (user_id) do update
    set prefs = notification_prefs.prefs || excluded.prefs,
        timezone_offset_minutes = excluded.timezone_offset_minutes,
        updated_at = now()
  returning prefs into result;
  return result;
end;
$$;

revoke all on function public.patch_notification_preferences(jsonb, integer) from public;
grant execute on function public.patch_notification_preferences(jsonb, integer) to authenticated;

-- Keep the canonical photo and the metadata used by native clients in the
-- same transaction, including explicit removal. Clients must not mirror a
-- stale form's avatar into auth metadata in a separate request.
create or replace function public.set_avatar_path(requested_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if requested_path is not null and requested_path !~ ('^' || auth.uid()::text || '/[a-zA-Z0-9._-]+$') then
    raise exception 'Invalid avatar path' using errcode = '22023';
  end if;

  insert into public.account_profiles (user_id, avatar_path, updated_at)
  values (auth.uid(), requested_path, now())
  on conflict (user_id) do update
    set avatar_path = excluded.avatar_path, updated_at = now();

  update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('avatar_path', requested_path)
    where id = auth.uid();
  return requested_path;
end;
$$;

revoke all on function public.set_avatar_path(text) from public;
grant execute on function public.set_avatar_path(text) to authenticated;
