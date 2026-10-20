-- Articles no longer belong to a class. Keep the team lookup for migrated
-- articles, but also recognize the licensed teacher profile that owns the
-- legacy group. Without this fallback, a pilot teacher without a newly created
-- app_teams row cannot approve their own article after team_id is cleared.

create or replace function public.app_is_teacher_for_group(target_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select public.app_is_publisher()
    or exists (
      select 1
      from public.app_teams team
      where (team.id::text = target_group_id or team.legacy_group_id = target_group_id)
        and public.app_can_manage_team(team.id)
    )
    or exists (
      select 1
      from public.app_profiles profile
      where profile.role = 'teacher'
        and profile.license_tier in ('pilot', 'paid')
        and profile.auth_user_id = auth.uid()
        and coalesce(profile.teacher_group_id, profile.id) = target_group_id
    );
$$;

revoke all on function public.app_is_teacher_for_group(text) from public;
grant execute on function public.app_is_teacher_for_group(text) to authenticated;
