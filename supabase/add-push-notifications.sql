create table if not exists public.app_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null references public.app_profiles(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_id text,
  user_agent text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.app_push_subscriptions
add column if not exists is_admin boolean not null default false;

alter table public.app_teacher_requests
add column if not exists push_notified_at timestamptz;

create index if not exists app_push_subscriptions_profile_idx
on public.app_push_subscriptions (profile_id);

alter table public.app_push_subscriptions enable row level security;
revoke all on public.app_push_subscriptions from anon;
revoke all on public.app_push_subscriptions from authenticated;
grant all on public.app_push_subscriptions to service_role;
