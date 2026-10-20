-- A class invitation is only for student profiles. Teachers and publishers
-- manage classes; they must not become members of another teacher's class.
create or replace function public.app_join_team(raw_code text)
returns table (
  join_status text,
  team_id uuid,
  team_name text,
  teacher_name text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  profile_id_value text := public.app_current_profile_id();
  invite_row public.app_team_invites%rowtype;
  failure_count integer;
begin
  if auth.uid() is null or profile_id_value is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.app_profiles profile
    where profile.id = profile_id_value
      and profile.auth_user_id = auth.uid()
      and profile.role = 'student'
  ) then
    raise exception 'student_profile_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  delete from public.app_team_invite_attempts
  where auth_user_id = auth.uid() and attempted_at < now() - interval '1 hour';
  select count(*) into failure_count
  from public.app_team_invite_attempts
  where auth_user_id = auth.uid() and attempted_at >= now() - interval '1 hour';
  if failure_count >= 5 then
    raise exception 'invite_attempt_limit';
  end if;

  select invite.* into invite_row
  from public.app_team_invites invite
  where invite.code_hash = public.app_hash_team_invite_code(raw_code)
    and invite.revoked_at is null
    and invite.expires_at > now()
  limit 1;

  if invite_row.id is null then
    insert into public.app_team_invite_attempts (auth_user_id) values (auth.uid());
    return query select 'invalid'::text, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1 from public.app_team_memberships membership
    where membership.team_id = invite_row.team_id
      and membership.profile_id = profile_id_value
  ) then
    delete from public.app_team_invite_attempts where auth_user_id = auth.uid();
    return query
    select 'already_member'::text, team.id, team.name, owner.name, invite_row.expires_at
    from public.app_teams team
    join public.app_profiles owner on owner.id = team.owner_profile_id
    where team.id = invite_row.team_id;
    return;
  end if;

  insert into public.app_team_memberships (team_id, profile_id)
  values (invite_row.team_id, profile_id_value)
  on conflict on constraint app_team_memberships_pkey do nothing;
  delete from public.app_team_invite_attempts where auth_user_id = auth.uid();

  return query
  select 'joined'::text, team.id, team.name, owner.name, invite_row.expires_at
  from public.app_teams team
  join public.app_profiles owner on owner.id = team.owner_profile_id
  where team.id = invite_row.team_id;
end;
$$;

revoke all on function public.app_join_team(text) from public;
grant execute on function public.app_join_team(text) to authenticated;
