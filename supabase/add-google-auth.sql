alter table public.app_profiles
add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

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

drop policy if exists "app_profiles_select" on public.app_profiles;
drop policy if exists "app_profiles_insert" on public.app_profiles;
drop policy if exists "app_profiles_update" on public.app_profiles;
drop policy if exists "app_profile_data_select" on public.app_profile_data;
drop policy if exists "app_profile_data_insert" on public.app_profile_data;
drop policy if exists "app_profile_data_update" on public.app_profile_data;
drop policy if exists "app_articles_select" on public.app_articles;
drop policy if exists "app_articles_insert" on public.app_articles;
drop policy if exists "app_articles_update" on public.app_articles;
drop policy if exists "app_articles_delete" on public.app_articles;
drop policy if exists "app_events_insert" on public.app_events;
drop policy if exists "app_devices_select" on public.app_devices;
drop policy if exists "app_devices_insert" on public.app_devices;
drop policy if exists "app_devices_update" on public.app_devices;

create policy "app_profiles_select"
on public.app_profiles for select
to anon, authenticated
using (true);

create policy "app_profiles_insert"
on public.app_profiles for insert
to anon, authenticated
with check (true);

create policy "app_profiles_update"
on public.app_profiles for update
to anon, authenticated
using (true)
with check (true);

create policy "app_profile_data_select"
on public.app_profile_data for select
to anon, authenticated
using (true);

create policy "app_profile_data_insert"
on public.app_profile_data for insert
to anon, authenticated
with check (true);

create policy "app_profile_data_update"
on public.app_profile_data for update
to anon, authenticated
using (true)
with check (true);

create policy "app_articles_select"
on public.app_articles for select
to anon, authenticated
using (true);

create policy "app_articles_insert"
on public.app_articles for insert
to anon, authenticated
with check (true);

create policy "app_articles_update"
on public.app_articles for update
to anon, authenticated
using (true)
with check (true);

create policy "app_articles_delete"
on public.app_articles for delete
to anon, authenticated
using (true);

create policy "app_events_insert"
on public.app_events for insert
to anon, authenticated
with check (true);

create policy "app_devices_select"
on public.app_devices for select
to anon, authenticated
using (true);

create policy "app_devices_insert"
on public.app_devices for insert
to anon, authenticated
with check (true);

create policy "app_devices_update"
on public.app_devices for update
to anon, authenticated
using (true)
with check (true);
