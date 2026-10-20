-- Articles belong to their authors, not to one class. A teacher can assign an
-- assignable article to students in any class they manage.

alter table public.app_articles disable trigger app_guard_article_workflow_trigger;

update public.app_articles
set team_id = null
where team_id is not null;

alter table public.app_articles enable trigger app_guard_article_workflow_trigger;

create or replace function public.app_set_article_assignment(
  target_team_id uuid,
  target_profile_id text,
  target_article_id text,
  target_assigned boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cleaned_assignments jsonb;
  article_title_value text;
  teacher_profile_id text := public.app_current_profile_id();
begin
  if not public.app_can_manage_team(target_team_id) then
    raise exception 'team_access_denied';
  end if;
  if not public.app_is_team_member(target_team_id, target_profile_id)
     or not exists (
       select 1
       from public.app_profiles profile
       where profile.id = target_profile_id
         and profile.role = 'student'
     ) then
    raise exception 'student_not_in_team';
  end if;

  select article.title into article_title_value
  from public.app_articles article
  where article.id = target_article_id
    and (
      public.app_is_publisher()
      or public.app_is_article_owner(article.owner_profile_id)
      or (
        article.visibility = 'public'
        and article.approval_status = 'approved'
        and article.published = true
      )
    );
  if article_title_value is null then
    raise exception 'article_not_assignable';
  end if;

  insert into public.app_profile_data (profile_id, data, updated_at)
  values (target_profile_id, '{}'::jsonb, now())
  on conflict (profile_id) do nothing;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into cleaned_assignments
  from jsonb_array_elements(
    coalesce((select data -> 'assignments' from public.app_profile_data where profile_id = target_profile_id), '[]'::jsonb)
  ) item
  where item ->> 'articleId' is distinct from target_article_id;

  if target_assigned then
    cleaned_assignments := cleaned_assignments || jsonb_build_array(jsonb_build_object(
      'articleId', target_article_id,
      'articleTitle', article_title_value,
      'teacherId', teacher_profile_id,
      'teamId', target_team_id,
      'assignedAt', now()
    ));
  end if;

  update public.app_profile_data
  set data = jsonb_set(data, '{assignments}', cleaned_assignments, true),
      updated_at = now()
  where profile_id = target_profile_id;
  return true;
end;
$$;

revoke all on function public.app_set_article_assignment(uuid, text, text, boolean) from public;
grant execute on function public.app_set_article_assignment(uuid, text, text, boolean) to authenticated;
