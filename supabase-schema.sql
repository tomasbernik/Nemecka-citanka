create table if not exists public.app_profiles (
  id text primary key,
  name text not null unique,
  pin text not null,
  role text not null check (role in ('teacher', 'student')),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  owner_auth_user_id uuid references auth.users(id) on delete set null,
  teacher_group_id text,
  invite_token text unique,
  invite_claimed_at timestamptz,
  native_language text not null default 'de' check (native_language in ('de', 'sk', 'ru', 'pl', 'hu', 'ro', 'it', 'en', 'fr', 'tr'))
);

alter table public.app_profiles
add column if not exists native_language text not null default 'de';

alter table public.app_profiles
alter column native_language set default 'de';

do $$
begin
  alter table public.app_profiles
  drop constraint if exists app_profiles_native_language_check;

  alter table public.app_profiles
  add constraint app_profiles_native_language_check
  check (native_language in ('de', 'sk', 'ru', 'pl', 'hu', 'ro', 'it', 'en', 'fr', 'tr'));
end $$;

alter table public.app_profiles
add column if not exists teacher_group_id text;

alter table public.app_profiles
add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

alter table public.app_profiles
add column if not exists owner_auth_user_id uuid references auth.users(id) on delete set null;

alter table public.app_profiles
add column if not exists invite_token text unique;

alter table public.app_profiles
add column if not exists invite_claimed_at timestamptz;

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
  language text not null default 'de' check (language in ('de', 'en', 'sk', 'ru', 'pl', 'hu', 'ro', 'it', 'fr', 'tr')),
  variant_group_id text,
  owner_profile_id text references public.app_profiles(id) on delete set null,
  teacher_group_id text,
  visibility text not null default 'public' check (visibility in ('private', 'public')),
  approval_status text not null default 'approved' check (approval_status in ('draft', 'pending', 'approved', 'rejected')),
  title text not null,
  level text not null,
  category text not null,
  category_labels jsonb not null default '{}'::jsonb,
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

create table if not exists public.app_text_translations (
  id uuid primary key default gen_random_uuid(),
  article_id text not null references public.app_articles(id) on delete cascade,
  source_type text not null check (source_type in ('word', 'sentence')),
  source_language text not null,
  source_text text not null,
  source_context text not null default '',
  target_language text not null,
  translated_text text not null,
  provider text not null default 'deepl',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_text_translations_unique
    unique (article_id, source_type, source_text, source_context, target_language)
);

create index if not exists app_text_translations_lookup_idx
on public.app_text_translations (
  article_id,
  source_type,
  target_language
);

create table if not exists public.app_translation_entries (
  id uuid primary key default gen_random_uuid(),
  namespace text not null,
  source_entity_id text not null,
  source_field text not null,
  source_path text not null default '',
  source_language text not null,
  target_language text not null,
  source_text text not null,
  translated_text text not null,
  provider text not null default 'unknown',
  provider_run_id text,
  review_status text not null default 'unreviewed',
  review_provider text,
  reviewed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_translation_entries_language_check
    check (
      source_language in ('de', 'sk', 'ru', 'pl', 'hu', 'ro', 'it', 'en', 'fr', 'tr')
      and target_language in ('de', 'sk', 'ru', 'pl', 'hu', 'ro', 'it', 'en', 'fr', 'tr')
    ),
  constraint app_translation_entries_review_status_check
    check (review_status in ('unreviewed', 'ai_reviewed', 'human_reviewed', 'rejected')),
  constraint app_translation_entries_provider_check
    check (provider in ('unknown', 'manual', 'google_translate_script', 'chatgpt', 'deepl', 'human')),
  constraint app_translation_entries_unique_source
    unique (namespace, source_entity_id, source_field, source_path, source_language, target_language)
);

create index if not exists app_translation_entries_review_idx
on public.app_translation_entries (review_status, provider, target_language, namespace);

create index if not exists app_translation_entries_entity_idx
on public.app_translation_entries (namespace, source_entity_id, source_field);

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
      case when coalesce(item ->> 'hu', '') = '' then 'hu' end,
      case when coalesce(item ->> 'ro', '') = '' then 'ro' end,
      case when coalesce(item ->> 'it', '') = '' then 'it' end,
      case when coalesce(item ->> 'en', '') = '' then 'en' end,
      case when coalesce(item ->> 'fr', '') = '' then 'fr' end,
      case when coalesce(item ->> 'tr', '') = '' then 'tr' end
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
add column if not exists language text not null default 'de';

alter table public.app_articles
add column if not exists variant_group_id text;

alter table public.app_articles
add column if not exists teacher_group_id text;

alter table public.app_articles
add column if not exists visibility text not null default 'public';

alter table public.app_articles
add column if not exists approval_status text not null default 'approved';

alter table public.app_articles
add column if not exists image jsonb;

alter table public.app_articles
add column if not exists category_labels jsonb not null default '{}'::jsonb;

update public.app_articles
set language = case
  when id like 'en-%' then 'en'
  else 'de'
end
where language is null
  or language = ''
  or (id like 'en-%' and language <> 'en');

update public.app_articles
set variant_group_id = case
  when id = 'en-a-very-big-breakfast-on-saturday' then 'ein-sehr-gro-es-fruhstuck-am-samstag'
  when id = 'en-the-vanished-server' then 'der-verschwundene-server'
  else id
end
where variant_group_id is null
  or variant_group_id = '';

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

alter table public.app_translation_entries
add column if not exists provider_run_id text;

alter table public.app_translation_entries
add column if not exists review_provider text;

alter table public.app_translation_entries
add column if not exists reviewed_at timestamptz;

alter table public.app_translation_entries
add column if not exists notes text;

alter table public.app_translation_entries
add column if not exists metadata jsonb not null default '{}'::jsonb;

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

  if not exists (
    select 1 from pg_constraint where conname = 'app_articles_language_check'
  ) then
    alter table public.app_articles
    add constraint app_articles_language_check
    check (language in ('de', 'en', 'sk', 'ru', 'pl', 'hu', 'ro', 'it', 'fr', 'tr'));
  end if;
end $$;

alter table public.app_profiles enable row level security;
alter table public.app_profile_data enable row level security;
alter table public.app_articles enable row level security;
alter table public.app_events enable row level security;
alter table public.app_translation_entries enable row level security;
alter table public.app_text_translations enable row level security;
alter table public.app_devices enable row level security;

drop policy if exists "app_profiles_select" on public.app_profiles;
drop policy if exists "app_profiles_insert" on public.app_profiles;
drop policy if exists "app_profiles_update" on public.app_profiles;
drop policy if exists "app_profiles_claim_unlinked_pin_profile" on public.app_profiles;
drop policy if exists "app_profile_data_select" on public.app_profile_data;
drop policy if exists "app_profile_data_insert" on public.app_profile_data;
drop policy if exists "app_profile_data_update" on public.app_profile_data;
drop policy if exists "app_articles_select" on public.app_articles;
drop policy if exists "app_articles_insert" on public.app_articles;
drop policy if exists "app_articles_update" on public.app_articles;
drop policy if exists "app_articles_delete" on public.app_articles;
drop policy if exists "app_events_insert" on public.app_events;
drop policy if exists "app_translation_entries_select" on public.app_translation_entries;
drop policy if exists "app_translation_entries_insert" on public.app_translation_entries;
drop policy if exists "app_translation_entries_update" on public.app_translation_entries;
drop policy if exists "app_devices_select" on public.app_devices;
drop policy if exists "app_devices_insert" on public.app_devices;
drop policy if exists "app_devices_update" on public.app_devices;

create policy "app_profiles_select"
on public.app_profiles for select
to anon, authenticated
using (true);

create policy "app_profiles_insert"
on public.app_profiles for insert
to anon, authenticated
with check (
  auth.role() = 'anon'
  or owner_auth_user_id is null
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

create policy "app_profiles_claim_unlinked_pin_profile"
on public.app_profiles for update
to authenticated
using (auth_user_id is null)
with check (auth_user_id = auth.uid());

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

create policy "app_translation_entries_select"
on public.app_translation_entries for select
to authenticated
using (true);

create policy "app_translation_entries_insert"
on public.app_translation_entries for insert
to authenticated
with check (true);

create policy "app_translation_entries_update"
on public.app_translation_entries for update
to authenticated
using (true)
with check (true);

revoke all on public.app_text_translations from anon;
revoke all on public.app_text_translations from authenticated;
grant all on public.app_text_translations to service_role;

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


-- All articles are public, teachers approve their group, and one publisher controls publication.

create or replace function public.app_is_publisher()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'tomas.bernik@gmail.com';
$$;

create or replace function public.app_is_article_owner(target_owner_profile_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_profiles profile
    where profile.id = target_owner_profile_id
      and (
        profile.auth_user_id = auth.uid()
        or profile.owner_auth_user_id = auth.uid()
      )
  );
$$;

create or replace function public.app_is_teacher_for_group(target_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_profiles profile
    where profile.role = 'teacher'
      and profile.auth_user_id = auth.uid()
      and coalesce(profile.teacher_group_id, profile.id) = target_group_id
  );
$$;

revoke all on function public.app_is_publisher() from public;
revoke all on function public.app_is_article_owner(text) from public;
revoke all on function public.app_is_teacher_for_group(text) from public;
grant execute on function public.app_is_publisher() to anon, authenticated;
grant execute on function public.app_is_article_owner(text) to authenticated;
grant execute on function public.app_is_teacher_for_group(text) to authenticated;

update public.app_articles
set visibility = 'public'
where visibility <> 'public';

update public.app_articles
set published = false
where published = true
  and approval_status <> 'approved';

alter table public.app_articles
  alter column visibility set default 'public',
  alter column published set default false;

alter table public.app_articles
  drop constraint if exists app_articles_visibility_check;

alter table public.app_articles
  add constraint app_articles_visibility_check
  check (visibility = 'public');

alter table public.app_articles
  drop constraint if exists app_articles_publication_requires_approval;

alter table public.app_articles
  add constraint app_articles_publication_requires_approval
  check (not published or approval_status = 'approved');

create or replace function public.app_guard_article_workflow()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  publisher boolean := public.app_is_publisher();
  content_changed boolean := false;
begin
  if new.visibility <> 'public' then
    raise exception 'All articles must be public';
  end if;

  if tg_op = 'INSERT' then
    if not publisher then
      new.published := false;
      if new.approval_status not in ('draft', 'pending') then
        new.approval_status := 'pending';
      end if;
    end if;
    return new;
  end if;

  if new.owner_profile_id is distinct from old.owner_profile_id
    or new.teacher_group_id is distinct from old.teacher_group_id then
    if not publisher then
      raise exception 'Only the publisher can change article ownership';
    end if;
  end if;

  content_changed :=
    new.title is distinct from old.title
    or new.language is distinct from old.language
    or new.variant_group_id is distinct from old.variant_group_id
    or new.level is distinct from old.level
    or new.category is distinct from old.category
    or new.category_labels is distinct from old.category_labels
    or new.summary is distinct from old.summary
    or new.text is distinct from old.text
    or new.vocabulary is distinct from old.vocabulary
    or new.inline_vocabulary is distinct from old.inline_vocabulary
    or new.image is distinct from old.image
    or new.questions is distinct from old.questions;

  if content_changed and not publisher then
    new.approval_status := 'pending';
    new.published := false;
  end if;

  if new.approval_status is distinct from old.approval_status
    and not publisher
    and not public.app_is_teacher_for_group(old.teacher_group_id) then
    raise exception 'Only the group teacher can approve this article';
  end if;

  if new.published is distinct from old.published and not publisher then
    raise exception 'Only the publisher can change publication';
  end if;

  if new.approval_status <> 'approved' then
    new.published := false;
  end if;

  if new.published and new.approval_status <> 'approved' then
    raise exception 'Only approved articles can be published';
  end if;

  return new;
end;
$$;

drop trigger if exists app_guard_article_workflow_trigger on public.app_articles;
create trigger app_guard_article_workflow_trigger
before insert or update on public.app_articles
for each row execute function public.app_guard_article_workflow();

drop policy if exists "app_articles_select" on public.app_articles;
drop policy if exists "app_articles_insert" on public.app_articles;
drop policy if exists "app_articles_update" on public.app_articles;
drop policy if exists "app_articles_delete" on public.app_articles;

create policy "app_articles_select"
on public.app_articles for select
to anon, authenticated
using (
  (published = true and approval_status = 'approved' and visibility = 'public')
  or public.app_is_publisher()
  or public.app_is_article_owner(owner_profile_id)
  or public.app_is_teacher_for_group(teacher_group_id)
);

create policy "app_articles_insert"
on public.app_articles for insert
to authenticated
with check (
  visibility = 'public'
  and published = false
  and public.app_is_article_owner(owner_profile_id)
);

create policy "app_articles_update"
on public.app_articles for update
to authenticated
using (
  public.app_is_publisher()
  or public.app_is_article_owner(owner_profile_id)
  or public.app_is_teacher_for_group(teacher_group_id)
)
with check (
  visibility = 'public'
  and (
    public.app_is_publisher()
    or public.app_is_article_owner(owner_profile_id)
    or public.app_is_teacher_for_group(teacher_group_id)
  )
);

create policy "app_articles_delete"
on public.app_articles for delete
to authenticated
using (
  public.app_is_publisher()
  or public.app_is_article_owner(owner_profile_id)
);

create or replace function public.app_manageable_articles()
returns setof public.app_articles
language sql
stable
security invoker
set search_path = public, auth
as $$
  select article.*
  from public.app_articles article
  where public.app_is_publisher()
    or public.app_is_article_owner(article.owner_profile_id)
    or public.app_is_teacher_for_group(article.teacher_group_id)
  order by article.updated_at desc, article.title asc;
$$;

create or replace function public.app_set_article_approval(
  target_article_id text,
  target_status text
)
returns setof public.app_articles
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if target_status not in ('approved', 'rejected') then
    raise exception 'Invalid approval status';
  end if;

  return query
  update public.app_articles
  set approval_status = target_status,
      published = case when target_status = 'approved' then published else false end,
      updated_at = now()
  where id = target_article_id
    and (
      public.app_is_publisher()
      or public.app_is_teacher_for_group(teacher_group_id)
    )
  returning *;
end;
$$;

create or replace function public.app_set_article_published(
  target_article_id text,
  target_published boolean
)
returns setof public.app_articles
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if not public.app_is_publisher() then
    raise exception 'Only the publisher can change publication';
  end if;

  return query
  update public.app_articles
  set published = target_published,
      updated_at = now()
  where id = target_article_id
    and (not target_published or approval_status = 'approved')
  returning *;
end;
$$;

revoke all on function public.app_manageable_articles() from public;
revoke all on function public.app_set_article_approval(text, text) from public;
revoke all on function public.app_set_article_published(text, boolean) from public;
grant execute on function public.app_manageable_articles() to authenticated;
grant execute on function public.app_set_article_approval(text, text) to authenticated;
grant execute on function public.app_set_article_published(text, boolean) to authenticated;


-- Allow owner edits to reset an approved article to pending without treating the automatic reset as moderation.

create or replace function public.app_guard_article_workflow()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  publisher boolean := public.app_is_publisher();
  content_changed boolean := false;
  requested_approval_changed boolean := false;
  requested_publication_changed boolean := false;
begin
  if new.visibility <> 'public' then
    raise exception 'All articles must be public';
  end if;

  if tg_op = 'INSERT' then
    if not publisher then
      new.published := false;
      if new.approval_status not in ('draft', 'pending') then
        new.approval_status := 'pending';
      end if;
    end if;
    return new;
  end if;

  if new.owner_profile_id is distinct from old.owner_profile_id
    or new.teacher_group_id is distinct from old.teacher_group_id then
    if not publisher then
      raise exception 'Only the publisher can change article ownership';
    end if;
  end if;

  requested_approval_changed := new.approval_status is distinct from old.approval_status;
  requested_publication_changed := new.published is distinct from old.published;

  if requested_approval_changed
    and not publisher
    and not public.app_is_teacher_for_group(old.teacher_group_id) then
    raise exception 'Only the group teacher can approve this article';
  end if;

  if requested_publication_changed and not publisher then
    raise exception 'Only the publisher can change publication';
  end if;

  content_changed :=
    new.title is distinct from old.title
    or new.language is distinct from old.language
    or new.variant_group_id is distinct from old.variant_group_id
    or new.level is distinct from old.level
    or new.category is distinct from old.category
    or new.category_labels is distinct from old.category_labels
    or new.summary is distinct from old.summary
    or new.text is distinct from old.text
    or new.vocabulary is distinct from old.vocabulary
    or new.inline_vocabulary is distinct from old.inline_vocabulary
    or new.image is distinct from old.image
    or new.questions is distinct from old.questions;

  if content_changed and not publisher then
    new.approval_status := 'pending';
    new.published := false;
  end if;

  if new.approval_status <> 'approved' then
    new.published := false;
  end if;

  if new.published and new.approval_status <> 'approved' then
    raise exception 'Only approved articles can be published';
  end if;

  return new;
end;
$$;
