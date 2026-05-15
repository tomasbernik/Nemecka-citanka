create table if not exists public.app_profiles (
  id text primary key,
  name text not null unique,
  pin text not null,
  role text not null check (role in ('teacher', 'student')),
  teacher_group_id text,
  native_language text not null default 'sk' check (native_language in ('sk', 'ru', 'pl', 'hu'))
);

alter table public.app_profiles
add column if not exists native_language text not null default 'sk';

alter table public.app_profiles
add column if not exists teacher_group_id text;

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
  questions jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  updated_at timestamptz not null default now()
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
