create table if not exists public.app_profiles (
  id text primary key,
  name text not null unique,
  pin text not null,
  role text not null check (role in ('teacher', 'student')),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  owner_auth_user_id uuid references auth.users(id) on delete set null,
  teacher_group_id text,
  native_language text not null default 'sk' check (native_language in ('sk', 'ru', 'pl', 'hu'))
);

alter table public.app_profiles
add column if not exists native_language text not null default 'sk';

alter table public.app_profiles
add column if not exists teacher_group_id text;

alter table public.app_profiles
add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

alter table public.app_profiles
add column if not exists owner_auth_user_id uuid references auth.users(id) on delete set null;

update public.app_profiles
set owner_auth_user_id = auth_user_id
where owner_auth_user_id is null
  and auth_user_id is not null;

update public.app_profiles
set owner_auth_user_id = (
  select owner_profile.auth_user_id
  from public.app_profiles owner_profile
  where owner_profile.id = 'tomas'
    and owner_profile.auth_user_id is not null
  limit 1
)
where owner_auth_user_id is null
  and exists (
    select 1
    from public.app_profiles owner_profile
    where owner_profile.id = 'tomas'
      and owner_profile.auth_user_id is not null
  );

create table if not exists public.app_profile_data (
  profile_id text primary key references public.app_profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_articles (
  id text primary key,
  owner_profile_id text references public.app_profiles(id) on delete set null,
  teacher_group_id text,
  visibility text not null default 'public' check (visibility in ('private', 'public')),
  approval_status text not null default 'approved' check (approval_status in ('draft', 'pending', 'approved', 'rejected')),
  title text not null,
  level text not null,
  category text not null,
  summary text not null,
  text jsonb not null default '[]'::jsonb,
  vocabulary jsonb not null default '[]'::jsonb,
  inline_vocabulary jsonb not null default '[]'::jsonb,
  image jsonb,
  questions jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  profile_id text references public.app_profiles(id) on delete set null,
  article_id text references public.app_articles(id) on delete set null,
  article_title text,
  device_id text,
  device_name text,
  country text,
  city text,
  ip_hash text,
  ui_language text,
  native_language text,
  details jsonb not null default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_devices (
  device_id text primary key,
  device_name text,
  automatic_name text,
  profile_id text references public.app_profiles(id) on delete set null,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create or replace view public.app_vocabulary_missing_translations
with (security_invoker = true) as
with article_vocabulary as (
  select
    article.id as article_id,
    article.title as article_title,
    'vocabulary'::text as source,
    item.ordinality::int as item_index,
    item.value as item
  from public.app_articles article
  cross join lateral jsonb_array_elements(article.vocabulary) with ordinality as item(value, ordinality)

  union all

  select
    article.id as article_id,
    article.title as article_title,
    'inline_vocabulary'::text as source,
    item.ordinality::int as item_index,
    item.value as item
  from public.app_articles article
  cross join lateral jsonb_array_elements(article.inline_vocabulary) with ordinality as item(value, ordinality)
),
missing as (
  select
    article_id,
    article_title,
    source,
    item_index,
    item ->> 'de' as de,
    array_remove(array[
      case when coalesce(item ->> 'sk', '') = '' then 'sk' end,
      case when coalesce(item ->> 'ru', '') = '' then 'ru' end,
      case when coalesce(item ->> 'pl', '') = '' then 'pl' end,
      case when coalesce(item ->> 'hu', '') = '' then 'hu' end
    ], null) as missing_languages,
    item
  from article_vocabulary
  where coalesce(item ->> 'de', '') <> ''
)
select
  article_id,
  article_title,
  source,
  item_index,
  de,
  missing_languages,
  item
from missing
where array_length(missing_languages, 1) > 0
order by article_title, source, item_index;

revoke all on public.app_vocabulary_missing_translations from anon;
revoke all on public.app_vocabulary_missing_translations from authenticated;
grant select on public.app_vocabulary_missing_translations to service_role;

alter table public.app_articles
add column if not exists owner_profile_id text references public.app_profiles(id) on delete set null;

alter table public.app_articles
add column if not exists teacher_group_id text;

alter table public.app_articles
add column if not exists visibility text not null default 'public';

alter table public.app_articles
add column if not exists approval_status text not null default 'approved';

alter table public.app_articles
add column if not exists image jsonb;

alter table public.app_events
add column if not exists device_id text;

alter table public.app_events
add column if not exists device_name text;

alter table public.app_events
add column if not exists country text;

alter table public.app_events
add column if not exists city text;

alter table public.app_events
add column if not exists ip_hash text;

create table if not exists public.app_devices (
  device_id text primary key,
  device_name text,
  automatic_name text,
  profile_id text references public.app_profiles(id) on delete set null,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-images', 'article-images', true, 5242880, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "article_images_select" on storage.objects;
drop policy if exists "article_images_insert" on storage.objects;
drop policy if exists "article_images_update" on storage.objects;
drop policy if exists "article_images_delete" on storage.objects;

create policy "article_images_select"
on storage.objects for select
using (bucket_id = 'article-images');

create policy "article_images_insert"
on storage.objects for insert
with check (bucket_id = 'article-images');

create policy "article_images_update"
on storage.objects for update
using (bucket_id = 'article-images')
with check (bucket_id = 'article-images');

create policy "article_images_delete"
on storage.objects for delete
using (bucket_id = 'article-images');

update public.app_profiles
set teacher_group_id = case
  when role = 'teacher' then id
  else coalesce(
    (select id from public.app_profiles where role = 'teacher' order by name asc limit 1),
    id
  )
end
where teacher_group_id is null;

update public.app_articles article
set teacher_group_id = profile.teacher_group_id
from public.app_profiles profile
where article.owner_profile_id = profile.id
  and article.teacher_group_id is null;

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
alter table public.app_events enable row level security;
alter table public.app_devices enable row level security;

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
drop policy if exists "app_events_insert" on public.app_events;
drop policy if exists "app_devices_select" on public.app_devices;
drop policy if exists "app_devices_insert" on public.app_devices;
drop policy if exists "app_devices_update" on public.app_devices;

create policy "app_profiles_select"
on public.app_profiles for select
to anon, authenticated
using (true);

create policy "app_profiles_insert"
on public.app_profiles for insert
to authenticated
with check (
  owner_auth_user_id is null
  or owner_auth_user_id = auth.uid()
  or auth_user_id = auth.uid()
);

create policy "app_profiles_update"
on public.app_profiles for update
to authenticated
using (
  owner_auth_user_id is null
  or owner_auth_user_id = auth.uid()
  or auth_user_id = auth.uid()
)
with check (
  owner_auth_user_id is null
  or owner_auth_user_id = auth.uid()
  or auth_user_id = auth.uid()
);

create policy "app_profile_data_select"
on public.app_profile_data for select
to anon, authenticated
using (true);

create policy "app_profile_data_insert"
on public.app_profile_data for insert
to anon, authenticated
with check (true);

create policy "app_profile_data_update"
on public.app_profile_data for update
to anon, authenticated
using (true)
with check (true);

create policy "app_articles_select"
on public.app_articles for select
to anon, authenticated
using (true);

create policy "app_articles_insert"
on public.app_articles for insert
to anon, authenticated
with check (true);

create policy "app_articles_update"
on public.app_articles for update
to anon, authenticated
using (true)
with check (true);

create policy "app_articles_delete"
on public.app_articles for delete
to anon, authenticated
using (true);

create policy "app_events_insert"
on public.app_events for insert
to anon, authenticated
with check (true);

create policy "app_devices_select"
on public.app_devices for select
to anon, authenticated
using (true);

create policy "app_devices_insert"
on public.app_devices for insert
to anon, authenticated
with check (true);

create policy "app_devices_update"
on public.app_devices for update
to anon, authenticated
using (true)
with check (true);
