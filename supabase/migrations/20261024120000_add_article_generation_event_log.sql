create table if not exists public.article_generation_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.article_generation_jobs(id) on delete cascade,
  phase text not null check (phase in ('draft', 'review', 'materials')),
  attempt integer not null check (attempt > 0),
  model text not null,
  outcome text not null check (outcome in ('succeeded', 'retry', 'failed')),
  error_code text,
  provider_status integer,
  duration_ms integer not null check (duration_ms >= 0),
  will_retry boolean not null default false,
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists article_generation_job_events_job_idx
on public.article_generation_job_events (job_id, created_at);

create index if not exists article_generation_job_events_created_idx
on public.article_generation_job_events (created_at);

alter table public.article_generation_job_events enable row level security;
revoke all on public.article_generation_job_events from public, anon, authenticated;

comment on table public.article_generation_job_events is
  'Short-lived metadata-only audit log for AI article generation attempts; retained for 30 days.';

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'article-generation-log-cleanup';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'article-generation-log-cleanup',
  '17 3 * * *',
  $cleanup$
    delete from public.article_generation_job_events
    where created_at < now() - interval '30 days';
  $cleanup$
);
