create table if not exists public.app_profiles (
  id text primary key,
  name text not null unique,
  pin text not null,
  role text not null check (role in ('teacher', 'student')),
  native_language text not null default 'sk' check (native_language in ('sk', 'ru', 'pl', 'hu'))
);

alter table public.app_profiles
add column if not exists native_language text not null default 'sk';

create table if not exists public.app_profile_data (
  profile_id text primary key references public.app_profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_articles (
  id text primary key,
  owner_profile_id text references public.app_profiles(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('private', 'public')),
  approval_status text not null default 'approved' check (approval_status in ('draft', 'pending', 'approved', 'rejected')),
  title text not null,
  level text not null,
  category text not null,
  summary text not null,
  text jsonb not null default '[]'::jsonb,
  vocabulary jsonb not null default '[]'::jsonb,
  inline_vocabulary jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.app_articles
add column if not exists owner_profile_id text references public.app_profiles(id) on delete set null;

alter table public.app_articles
add column if not exists visibility text not null default 'public';

alter table public.app_articles
add column if not exists approval_status text not null default 'approved';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_articles_visibility_check'
  ) then
    alter table public.app_articles
    add constraint app_articles_visibility_check
    check (visibility in ('private', 'public'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'app_articles_approval_status_check'
  ) then
    alter table public.app_articles
    add constraint app_articles_approval_status_check
    check (approval_status in ('draft', 'pending', 'approved', 'rejected'));
  end if;
end $$;

alter table public.app_profiles enable row level security;
alter table public.app_profile_data enable row level security;
alter table public.app_articles enable row level security;

drop policy if exists "app_profiles_select" on public.app_profiles;
drop policy if exists "app_profiles_insert" on public.app_profiles;
drop policy if exists "app_profiles_update" on public.app_profiles;
drop policy if exists "app_profile_data_select" on public.app_profile_data;
drop policy if exists "app_profile_data_insert" on public.app_profile_data;
drop policy if exists "app_profile_data_update" on public.app_profile_data;
drop policy if exists "app_articles_select" on public.app_articles;
drop policy if exists "app_articles_insert" on public.app_articles;
drop policy if exists "app_articles_update" on public.app_articles;
drop policy if exists "app_articles_delete" on public.app_articles;

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

create policy "app_articles_select"
on public.app_articles for select
to anon
using (true);

create policy "app_articles_insert"
on public.app_articles for insert
to anon
with check (true);

create policy "app_articles_update"
on public.app_articles for update
to anon
using (true)
with check (true);

create policy "app_articles_delete"
on public.app_articles for delete
to anon
using (true);
