-- Teacher-managed class membership and administrator-only student account deletion.

create or replace function public.app_set_team_member(
  target_team_id uuid,
  target_profile_id text,
  target_member boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.app_can_manage_team(target_team_id) then
    raise exception 'team_access_denied';
  end if;

  if not exists (
    select 1
    from public.app_profiles profile
    where profile.id = target_profile_id
      and profile.role = 'student'
  ) then
    raise exception 'student_profile_not_found';
  end if;

  if target_member
     and not public.app_is_publisher()
     and not exists (
       select 1
       from public.app_team_memberships membership
       where membership.profile_id = target_profile_id
         and public.app_can_manage_team(membership.team_id)
     ) then
    raise exception 'student_access_denied';
  end if;

  if target_member then
    insert into public.app_team_memberships (team_id, profile_id)
    values (target_team_id, target_profile_id)
    on conflict (team_id, profile_id) do nothing;
  else
    delete from public.app_team_memberships
    where team_id = target_team_id
      and profile_id = target_profile_id;
  end if;

  return true;
end;
$$;

create or replace function public.app_admin_delete_student_account(
  target_profile_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_auth_user_id uuid;
  auth_user_is_shared boolean := false;
begin
  if not public.app_is_publisher() then
    raise exception 'admin_required';
  end if;

  select profile.auth_user_id
  into target_auth_user_id
  from public.app_profiles profile
  where profile.id = target_profile_id
    and profile.role = 'student';

  if not found then
    raise exception 'student_profile_not_found';
  end if;

  if target_auth_user_id is not null then
    select exists (
      select 1
      from public.app_profiles profile
      where profile.id <> target_profile_id
        and (
          profile.auth_user_id = target_auth_user_id
          or profile.owner_auth_user_id = target_auth_user_id
        )
    )
    into auth_user_is_shared;
  end if;

  delete from public.app_profiles
  where id = target_profile_id
    and role = 'student';

  if target_auth_user_id is not null and not auth_user_is_shared then
    delete from auth.users
    where id = target_auth_user_id;
  end if;

  return true;
end;
$$;

revoke all on function public.app_set_team_member(uuid, text, boolean) from public;
revoke all on function public.app_admin_delete_student_account(text) from public;
grant execute on function public.app_set_team_member(uuid, text, boolean) to authenticated;
grant execute on function public.app_admin_delete_student_account(text) to authenticated;

