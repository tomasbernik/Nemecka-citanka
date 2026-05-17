alter table public.app_profiles
add column if not exists owner_auth_user_id uuid references auth.users(id) on delete set null;

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

drop policy if exists "app_profiles_insert" on public.app_profiles;
drop policy if exists "app_profiles_update" on public.app_profiles;

create policy "app_profiles_insert"
on public.app_profiles for insert
to authenticated
with check (
  owner_auth_user_id is null
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
