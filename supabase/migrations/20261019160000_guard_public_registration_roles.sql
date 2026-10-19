-- Public registration always starts with a student profile. Profile owners cannot
-- promote themselves or claim an unlinked teacher profile directly through REST.
create or replace function public.app_guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    if not public.app_is_publisher() and new.role <> 'student' then
      raise exception 'New accounts must start as students';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role and not public.app_is_publisher() then
    raise exception 'Only the administrator can change profile roles';
  end if;

  if old.role = 'teacher'
     and old.auth_user_id is null
     and new.auth_user_id is not null
     and not public.app_is_publisher() then
    raise exception 'Teacher profiles must be assigned by the administrator';
  end if;

  return new;
end;
$$;

drop trigger if exists app_guard_profile_role_trigger on public.app_profiles;
create trigger app_guard_profile_role_trigger
before insert or update on public.app_profiles
for each row execute function public.app_guard_profile_role();
