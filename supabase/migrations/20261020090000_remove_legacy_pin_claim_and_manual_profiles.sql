-- Profiles are now created only for authenticated Supabase users.
-- Keep existing profile data, but remove the obsolete PIN-based recovery path.

drop function if exists public.app_claim_legacy_student_profile(text, text);
drop function if exists public.app_legacy_pin_profile(text, text);
drop table if exists public.app_legacy_profile_claim_attempts;

drop policy if exists "app_profiles_insert" on public.app_profiles;

create policy "app_profiles_insert"
on public.app_profiles
for insert
to authenticated
with check (
  auth_user_id = auth.uid()
  and owner_auth_user_id = auth.uid()
  and role = 'student'
  and license_tier = 'none'
);

-- Profile owners may edit ordinary profile fields, but role and license changes
-- remain reserved for the publisher/admin workflow.
create or replace function public.app_guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or public.app_is_publisher() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.license_tier is distinct from old.license_tier then
    raise exception 'profile_privileged_fields_forbidden' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists app_guard_profile_privileged_fields on public.app_profiles;
create trigger app_guard_profile_privileged_fields
before update on public.app_profiles
for each row execute function public.app_guard_profile_privileged_fields();

revoke all on function public.app_guard_profile_privileged_fields() from public;
