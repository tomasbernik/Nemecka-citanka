alter table public.app_push_subscriptions
add column if not exists is_admin boolean not null default false;

alter table public.app_teacher_requests
add column if not exists push_notified_at timestamptz;
