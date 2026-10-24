alter table public.article_generation_jobs
  add column if not exists cancelled_at timestamptz;

alter table public.article_generation_jobs
  drop constraint if exists article_generation_jobs_status_check;

alter table public.article_generation_jobs
  add constraint article_generation_jobs_status_check check (status in (
    'created',
    'draft_queued', 'draft_running', 'draft_ready', 'draft_failed',
    'review_queued', 'review_running', 'review_ready', 'review_failed',
    'materials_queued', 'materials_running', 'completed', 'materials_failed',
    'cancelled'
  ));

alter table public.article_generation_job_events
  drop constraint if exists article_generation_job_events_outcome_check;

alter table public.article_generation_job_events
  add constraint article_generation_job_events_outcome_check
  check (outcome in ('succeeded', 'retry', 'failed', 'cancelled'));

comment on column public.article_generation_jobs.cancelled_at is
  'Time when the user cancelled article generation.';
