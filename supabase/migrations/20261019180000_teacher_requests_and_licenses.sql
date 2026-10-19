-- Teacher access requests and licenses.
-- New public accounts remain students until the publisher approves a request.

alter table public.app_profiles
add column if not exists license_tier text not null default 'none';

alter table public.app_profiles
drop constraint if exists app_profiles_license_tier_check;

alter table public.app_profiles
add constraint app_profiles_license_tier_check
check (license_tier in ('none', 'pilot', 'paid'));

update public.app_profiles profile
set license_tier = case
  when exists (
    select 1
    from auth.users account
    where account.id = profile.auth_user_id
      and lower(coalesce(account.email, '')) = 'tomas.bernik@gmail.com'
  ) then 'paid'
  else 'pilot'
end
where profile.role = 'teacher'
  and profile.license_tier = 'none';

create table if not exists public.app_teacher_requests (
  profile_id text primary key references public.app_profiles(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  license_tier text not null default 'none'
    check (license_tier in ('none', 'pilot', 'paid'))
);

alter table public.app_teacher_requests enable row level security;

drop policy if exists "app_teacher_requests_select" on public.app_teacher_requests;

create policy "app_teacher_requests_select"
on public.app_teacher_requests for select
to authenticated
using (
  auth_user_id = auth.uid()
  or public.app_is_publisher()
);

create or replace function public.app_submit_teacher_request(
  request_profile_id text,
  request_email text
)
returns setof public.app_teacher_requests
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.app_profiles profile
    where profile.id = request_profile_id
      and profile.auth_user_id = auth.uid()
      and profile.role = 'student'
  ) then
    raise exception 'The teacher request must belong to the signed-in student profile';
  end if;

  return query
  insert into public.app_teacher_requests (
    profile_id,
    auth_user_id,
    email,
    status,
    requested_at,
    reviewed_at,
    license_tier
  )
  values (
    request_profile_id,
    auth.uid(),
    lower(coalesce(nullif(auth.jwt() ->> 'email', ''), trim(request_email))),
    'pending',
    now(),
    null,
    'none'
  )
  on conflict (profile_id) do update
  set auth_user_id = excluded.auth_user_id,
      email = excluded.email,
      status = 'pending',
      requested_at = now(),
      reviewed_at = null,
      license_tier = 'none'
  returning *;
end;
$$;

create or replace function public.app_review_teacher_request(
  target_profile_id text,
  target_decision text,
  target_license_tier text default 'pilot'
)
returns setof public.app_teacher_requests
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.app_is_publisher() then
    raise exception 'Only the administrator can review teacher requests';
  end if;

  if target_decision not in ('approved', 'rejected') then
    raise exception 'Invalid teacher request decision';
  end if;

  if target_decision = 'approved'
     and target_license_tier not in ('pilot', 'paid') then
    raise exception 'Approved teachers need a pilot or paid license';
  end if;

  update public.app_profiles
  set role = case when target_decision = 'approved' then 'teacher' else 'student' end,
      license_tier = case when target_decision = 'approved' then target_license_tier else 'none' end,
      teacher_group_id = case
        when target_decision = 'approved' then id
        else coalesce(teacher_group_id, id)
      end
  where id = target_profile_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  return query
  update public.app_teacher_requests
  set status = target_decision,
      reviewed_at = now(),
      license_tier = case when target_decision = 'approved' then target_license_tier else 'none' end
  where profile_id = target_profile_id
  returning *;
end;
$$;

revoke all on function public.app_submit_teacher_request(text, text) from public;
revoke all on function public.app_review_teacher_request(text, text, text) from public;
grant execute on function public.app_submit_teacher_request(text, text) to authenticated;
grant execute on function public.app_review_teacher_request(text, text, text) to authenticated;

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
      from public.app_profiles profile
      where profile.role = 'teacher'
        and profile.license_tier in ('pilot', 'paid')
        and profile.auth_user_id = auth.uid()
        and coalesce(profile.teacher_group_id, profile.id) = target_group_id
    );
$$;

revoke all on function public.app_is_teacher_for_group(text) from public;
grant execute on function public.app_is_teacher_for_group(text) to authenticated;

create or replace function public.app_guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    if not public.app_is_publisher()
       and (new.role <> 'student' or new.license_tier <> 'none') then
      raise exception 'New accounts must start as unlicensed students';
    end if;
    return new;
  end if;

  if (
    new.role is distinct from old.role
    or new.license_tier is distinct from old.license_tier
  ) and not public.app_is_publisher() then
    raise exception 'Only the administrator can change roles and licenses';
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

