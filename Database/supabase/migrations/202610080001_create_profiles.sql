-- Pet-Care user profiles
--
-- Supabase Auth owns credentials in auth.users and hashes passwords there.
-- This public profile table deliberately contains no password columns.
-- The requested primary key is the normalized user email; user_id ties the row
-- to the unforgeable Supabase Auth subject used by Row Level Security.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.profiles (
  email text primary key check (email = lower(email)),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Data API access is deliberately limited: an authenticated person can read
-- only their own profile row. The signup trigger creates rows server-side.
grant select on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (email, user_id)
  values (lower(new.email), new.id)
  on conflict (email) do update set user_id = excluded.user_id;

  return new;
end;
$$;

-- The function exists only for the auth.users trigger; it is not callable from
-- the Data API or by application roles.
revoke all on function private.create_profile_for_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.create_profile_for_new_user();

-- Populate a profile for any Auth users that existed before this migration.
insert into public.profiles (email, user_id)
select lower(email), id
from auth.users
where email is not null
on conflict (email) do nothing;
