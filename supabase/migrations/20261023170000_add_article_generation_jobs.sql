create table if not exists public.article_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'created' check (status in (
    'created',
    'draft_running', 'draft_ready', 'draft_failed',
    'review_running', 'review_ready', 'review_failed',
    'materials_running', 'completed', 'materials_failed'
  )),
  request_payload jsonb not null,
  draft jsonb,
  reviewed jsonb,
  article jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists article_generation_jobs_user_created_idx
on public.article_generation_jobs (user_id, created_at desc);

alter table public.article_generation_jobs enable row level security;
revoke all on public.article_generation_jobs from public, anon, authenticated;

comment on table public.article_generation_jobs is
  'Server-managed checkpoints for multi-phase AI article generation.';
