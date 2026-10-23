alter table public.article_generation_jobs
  add column if not exists request_key text,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_until timestamptz,
  add column if not exists draft_attempts integer not null default 0,
  add column if not exists review_attempts integer not null default 0,
  add column if not exists materials_attempts integer not null default 0,
  add column if not exists last_error_code text,
  add column if not exists model_used text,
  add column if not exists completed_at timestamptz;

alter table public.article_generation_jobs
  drop constraint if exists article_generation_jobs_status_check;

alter table public.article_generation_jobs
  add constraint article_generation_jobs_status_check check (status in (
    'created',
    'draft_queued', 'draft_running', 'draft_ready', 'draft_failed',
    'review_queued', 'review_running', 'review_ready', 'review_failed',
    'materials_queued', 'materials_running', 'completed', 'materials_failed'
  ));

create index if not exists article_generation_jobs_due_idx
on public.article_generation_jobs (next_attempt_at, created_at)
where status in (
  'created', 'draft_queued', 'review_queued', 'materials_queued',
  'draft_running', 'review_running', 'materials_running'
);

create index if not exists article_generation_jobs_request_idx
on public.article_generation_jobs (user_id, request_key, created_at desc);

create or replace function public.claim_article_generation_job()
returns table (
  id uuid,
  user_id uuid,
  phase text,
  phase_attempt integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select job.id
    from public.article_generation_jobs job
    where job.article is null
      and job.next_attempt_at <= now()
      and (
        job.status in ('created', 'draft_queued', 'review_queued', 'materials_queued')
        or (
          job.status in ('draft_running', 'review_running', 'materials_running')
          and job.locked_until < now()
        )
      )
    order by job.next_attempt_at, job.created_at
    for update skip locked
    limit 1
  ), updated as (
    update public.article_generation_jobs job
    set status = case
        when job.draft is null then 'draft_running'
        when job.reviewed is null then 'review_running'
        else 'materials_running'
      end,
      draft_attempts = job.draft_attempts + case when job.draft is null then 1 else 0 end,
      review_attempts = job.review_attempts + case when job.draft is not null and job.reviewed is null then 1 else 0 end,
      materials_attempts = job.materials_attempts + case when job.reviewed is not null then 1 else 0 end,
      locked_until = now() + interval '4 minutes',
      last_error = null,
      last_error_code = null,
      updated_at = now()
    from candidate
    where job.id = candidate.id
    returning job.*
  )
  select
    updated.id,
    updated.user_id,
    case
      when updated.draft is null then 'draft'
      when updated.reviewed is null then 'review'
      else 'materials'
    end,
    case
      when updated.draft is null then updated.draft_attempts
      when updated.reviewed is null then updated.review_attempts
      else updated.materials_attempts
    end
  from updated;
end;
$$;

revoke all on function public.claim_article_generation_job() from public, anon, authenticated;
grant execute on function public.claim_article_generation_job() to service_role;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'article_generation_worker_secret'
  ) then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'article_generation_worker_secret',
      'Authenticates the scheduled article-generation worker.'
    );
  end if;
end;
$$;

create or replace function public.verify_article_generation_worker_secret(candidate text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'article_generation_worker_secret'
      and decrypted_secret = candidate
  );
$$;

revoke all on function public.verify_article_generation_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_article_generation_worker_secret(text) to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'article-generation-worker';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'article-generation-worker',
  '30 seconds',
  $worker$
    select net.http_post(
      url := 'https://yeqxqwbjlhcwiikrmynl.supabase.co/functions/v1/generate-article-workflow',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_70mufWi07rem018nQ2CFsg_8eBlTLMn',
        'x-workflow-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'article_generation_worker_secret'
        )
      ),
      body := '{"action":"tick"}'::jsonb,
      timeout_milliseconds := 5000
    ) as request_id;
  $worker$
);

comment on function public.claim_article_generation_job() is
  'Atomically claims one due article-generation phase for the Edge Function worker.';
