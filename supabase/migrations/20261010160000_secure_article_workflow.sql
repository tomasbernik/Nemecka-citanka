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
