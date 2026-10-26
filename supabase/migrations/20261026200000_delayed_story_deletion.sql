-- Stories are hidden immediately, recoverable by the publisher for 24 hours,
-- and then permanently removed. Absolute instants stay in timestamptz (UTC);
-- clients render them in Europe/Berlin so CET/CEST is handled correctly.

alter table public.app_articles
  add column if not exists deleted_at timestamptz,
  add column if not exists purge_after timestamptz;

alter table public.app_articles
  drop constraint if exists app_articles_deletion_window_check;

alter table public.app_articles
  add constraint app_articles_deletion_window_check
  check (
    (deleted_at is null and purge_after is null)
    or (deleted_at is not null and purge_after is not null and purge_after >= deleted_at + interval '24 hours')
  );

create index if not exists app_articles_purge_after_idx
on public.app_articles (purge_after)
where purge_after is not null;

create or replace function public.app_schedule_story_deletion(target_series_id text)
returns setof public.app_articles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  deletion_time timestamptz := now();
begin
  if nullif(trim(target_series_id), '') is null then
    raise exception 'story_required';
  end if;

  if not exists (
    select 1 from public.app_articles where series_id = target_series_id
  ) then
    raise exception 'story_not_found';
  end if;

  if exists (
    select 1
    from public.app_articles article
    where article.series_id = target_series_id
      and not (
        public.app_is_publisher()
        or public.app_is_article_owner(article.owner_profile_id)
      )
  ) then
    raise exception 'story_delete_forbidden';
  end if;

  update public.app_articles
  set deleted_at = deletion_time,
      purge_after = deletion_time + interval '24 hours',
      updated_at = deletion_time
  where series_id = target_series_id;

  return query
  select article.*
  from public.app_articles article
  where article.series_id = target_series_id
  order by article.chapter_order nulls last, article.title;
end;
$$;

create or replace function public.app_restore_story(target_series_id text)
returns setof public.app_articles
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.app_is_publisher() then
    raise exception 'admin_required';
  end if;

  update public.app_articles
  set deleted_at = null,
      purge_after = null,
      updated_at = now()
  where series_id = target_series_id
    and deleted_at is not null
    and purge_after > now();

  if not found then
    raise exception 'story_restore_window_expired';
  end if;

  return query
  select article.*
  from public.app_articles article
  where article.series_id = target_series_id
  order by article.chapter_order nulls last, article.title;
end;
$$;

create or replace function public.app_deleted_story_articles()
returns setof public.app_articles
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.app_is_publisher() then
    return;
  end if;

  return query
  select article.*
  from public.app_articles article
  where article.deleted_at is not null
    and article.purge_after > now()
  order by article.purge_after, article.series_title, article.chapter_order nulls last;
end;
$$;

create or replace function public.app_purge_expired_stories()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.app_articles
  where deleted_at is not null
    and purge_after <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.app_schedule_story_deletion(text) from public, anon;
revoke all on function public.app_restore_story(text) from public, anon;
revoke all on function public.app_deleted_story_articles() from public, anon;
revoke all on function public.app_purge_expired_stories() from public, anon, authenticated;
grant execute on function public.app_schedule_story_deletion(text) to authenticated;
grant execute on function public.app_restore_story(text) to authenticated;
grant execute on function public.app_deleted_story_articles() to authenticated;
grant execute on function public.app_purge_expired_stories() to service_role;

create or replace function public.app_manageable_articles()
returns setof public.app_articles
language sql
stable
security invoker
set search_path = public, auth
as $$
  select article.*
  from public.app_articles article
  where article.deleted_at is null
    and (
      public.app_is_publisher()
      or public.app_is_article_owner(article.owner_profile_id)
      or public.app_is_teacher_for_group(article.teacher_group_id)
    )
  order by article.updated_at desc, article.title asc;
$$;

drop policy if exists "app_articles_select" on public.app_articles;
create policy "app_articles_select"
on public.app_articles for select
to anon, authenticated
using (
  (
    deleted_at is null
    and published = true
    and approval_status = 'approved'
    and visibility = 'public'
  )
  or public.app_is_publisher()
  or public.app_is_article_owner(owner_profile_id)
  or public.app_is_teacher_for_group(teacher_group_id)
);

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'purge-expired-stories';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'purge-expired-stories',
  '* * * * *',
  $purge$select public.app_purge_expired_stories();$purge$
);

comment on function public.app_schedule_story_deletion(text) is
  'Hides every chapter in an owned story immediately and schedules permanent deletion after exactly 24 hours.';
comment on function public.app_restore_story(text) is
  'Allows the publisher to restore a complete story during its 24-hour recovery window.';
