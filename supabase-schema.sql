create table if not exists public.app_profiles (
  id text primary key,
  name text not null unique,
  pin text not null,
  role text not null check (role in ('teacher', 'student'))
);

create table if not exists public.app_profile_data (
  profile_id text primary key references public.app_profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_profiles enable row level security;
alter table public.app_profile_data enable row level security;

drop policy if exists "app_profiles_select" on public.app_profiles;
drop policy if exists "app_profiles_insert" on public.app_profiles;
drop policy if exists "app_profiles_update" on public.app_profiles;
drop policy if exists "app_profile_data_select" on public.app_profile_data;
drop policy if exists "app_profile_data_insert" on public.app_profile_data;
drop policy if exists "app_profile_data_update" on public.app_profile_data;

create policy "app_profiles_select"
on public.app_profiles for select
to anon
using (true);

create policy "app_profiles_insert"
on public.app_profiles for insert
to anon
with check (true);

create policy "app_profiles_update"
on public.app_profiles for update
to anon
using (true)
with check (true);

create policy "app_profile_data_select"
on public.app_profile_data for select
to anon
using (true);

create policy "app_profile_data_insert"
on public.app_profile_data for insert
to anon
with check (true);

create policy "app_profile_data_update"
on public.app_profile_data for update
to anon
using (true)
with check (true);
