create table if not exists public.account_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,24}$'
  )
);

create unique index if not exists account_profiles_username_unique
  on public.account_profiles (lower(username))
  where username is not null;

alter table public.account_profiles enable row level security;

create policy "Users can read their own account profile"
  on public.account_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own account profile"
  on public.account_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own account profile"
  on public.account_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_username(requested_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := nullif(lower(trim(requested_username)), '');
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if normalized is not null and normalized !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3–24 characters using only letters, numbers, and underscores'
      using errcode = '22023';
  end if;

  insert into public.account_profiles (user_id, username, updated_at)
  values (auth.uid(), normalized, now())
  on conflict (user_id) do update
    set username = excluded.username,
        updated_at = now();

  return normalized;
exception
  when unique_violation then
    raise exception 'That username is already taken' using errcode = '23505';
end;
$$;

create or replace function public.username_available(requested_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(trim(requested_username)) ~ '^[a-z0-9_]{3,24}$'
    and not exists (
      select 1
      from public.account_profiles
      where lower(username) = lower(trim(requested_username))
        and user_id is distinct from auth.uid()
    );
$$;

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
    set avatar_path = excluded.avatar_path,
        updated_at = now();

  return requested_path;
end;
$$;

grant execute on function public.set_username(text) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.set_avatar_path(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can view their own avatar"
  on storage.objects for select
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can replace their own avatar"
  on storage.objects for update
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
