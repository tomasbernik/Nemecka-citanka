-- Repeatable assignments plus safe publisher-only deletion of classes and teachers.
-- Deleting a class keeps student accounts and learning progress. Deleting a
-- teacher keeps authored articles, whose owner_profile_id becomes null through
-- the existing foreign key.

create or replace function public.app_reassign_article_assignment(
  target_team_id uuid,
  target_profile_id text,
  target_article_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  cleaned_assignments jsonb;
  previous_assignment jsonb;
  article_title_value text;
  teacher_profile_id text := public.app_current_profile_id();
  next_round integer := 2;
begin
  if not public.app_can_manage_team(target_team_id) then
    raise exception 'team_access_denied';
  end if;
  if not public.app_is_team_member(target_team_id, target_profile_id)
     or not exists (
       select 1 from public.app_profiles profile
       where profile.id = target_profile_id and profile.role = 'student'
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

  select item into previous_assignment
  from public.app_profile_data profile_data,
       jsonb_array_elements(coalesce(profile_data.data -> 'assignments', '[]'::jsonb)) item
  where profile_data.profile_id = target_profile_id
    and item ->> 'articleId' = target_article_id
  limit 1;
  if previous_assignment is null then
    raise exception 'assignment_not_found';
  end if;

  next_round := greatest(2, coalesce((previous_assignment ->> 'assignmentRound')::integer, 1) + 1);

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into cleaned_assignments
  from jsonb_array_elements(
    coalesce((select data -> 'assignments' from public.app_profile_data where profile_id = target_profile_id), '[]'::jsonb)
  ) item
  where item ->> 'articleId' is distinct from target_article_id;

  cleaned_assignments := cleaned_assignments || jsonb_build_array(jsonb_build_object(
    'articleId', target_article_id,
    'articleTitle', article_title_value,
    'teacherId', teacher_profile_id,
    'teamId', target_team_id,
    'assignedAt', now(),
    'assignmentRound', next_round,
    'requiresNewCompletion', true,
    'previousAssignedAt', previous_assignment ->> 'assignedAt'
  ));

  update public.app_profile_data
  set data = jsonb_set(data, '{assignments}', cleaned_assignments, true),
      updated_at = now()
  where profile_id = target_profile_id;
  return true;
end;
$$;

create or replace function public.app_admin_delete_team(target_team_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.app_is_publisher() then
    raise exception 'admin_required';
  end if;
  if not exists (select 1 from public.app_teams where id = target_team_id) then
    raise exception 'team_not_found';
  end if;

  update public.app_profile_data profile_data
  set data = jsonb_set(
        profile_data.data,
        '{assignments}',
        coalesce((
          select jsonb_agg(item)
          from jsonb_array_elements(coalesce(profile_data.data -> 'assignments', '[]'::jsonb)) item
          where item ->> 'teamId' is distinct from target_team_id::text
        ), '[]'::jsonb),
        true
      ),
      updated_at = now()
  where exists (
    select 1
    from jsonb_array_elements(coalesce(profile_data.data -> 'assignments', '[]'::jsonb)) item
    where item ->> 'teamId' = target_team_id::text
  );

  delete from public.app_teams where id = target_team_id;
  return true;
end;
$$;

create or replace function public.app_admin_delete_teacher_account(target_profile_id text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_auth_user_id uuid;
  auth_user_is_shared boolean := false;
  target_team_ids text[];
begin
  if not public.app_is_publisher() then
    raise exception 'admin_required';
  end if;

  select profile.auth_user_id into target_auth_user_id
  from public.app_profiles profile
  where profile.id = target_profile_id and profile.role = 'teacher';
  if not found then
    raise exception 'teacher_profile_not_found';
  end if;
  if target_auth_user_id = auth.uid() then
    raise exception 'cannot_delete_current_account';
  end if;

  select coalesce(array_agg(team.id::text), array[]::text[])
  into target_team_ids
  from public.app_teams team
  where team.owner_profile_id = target_profile_id;

  update public.app_profile_data profile_data
  set data = jsonb_set(
        profile_data.data,
        '{assignments}',
        coalesce((
          select jsonb_agg(item)
          from jsonb_array_elements(coalesce(profile_data.data -> 'assignments', '[]'::jsonb)) item
          where item ->> 'teacherId' is distinct from target_profile_id
            and not coalesce((item ->> 'teamId') = any(target_team_ids), false)
        ), '[]'::jsonb),
        true
      ),
      updated_at = now()
  where exists (
    select 1
    from jsonb_array_elements(coalesce(profile_data.data -> 'assignments', '[]'::jsonb)) item
    where item ->> 'teacherId' = target_profile_id
       or (item ->> 'teamId') = any(target_team_ids)
  );

  if target_auth_user_id is not null then
    select exists (
      select 1 from public.app_profiles profile
      where profile.id <> target_profile_id
        and (profile.auth_user_id = target_auth_user_id or profile.owner_auth_user_id = target_auth_user_id)
    ) into auth_user_is_shared;
  end if;

  delete from public.app_profiles where id = target_profile_id and role = 'teacher';
  if target_auth_user_id is not null and not auth_user_is_shared then
    delete from auth.users where id = target_auth_user_id;
  end if;
  return true;
end;
$$;

revoke all on function public.app_reassign_article_assignment(uuid, text, text) from public;
revoke all on function public.app_admin_delete_team(uuid) from public;
revoke all on function public.app_admin_delete_teacher_account(text) from public;
grant execute on function public.app_reassign_article_assignment(uuid, text, text) to authenticated;
grant execute on function public.app_admin_delete_team(uuid) to authenticated;
grant execute on function public.app_admin_delete_teacher_account(text) to authenticated;
