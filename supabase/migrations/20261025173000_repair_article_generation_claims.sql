-- Keep retry diagnostics available to the worker and allow complete-story jobs
-- to continue after storing learning materials for the first chapter.
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
    where job.next_attempt_at <= now()
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

comment on function public.claim_article_generation_job() is
  'Claims one due article generation phase while preserving retry diagnostics and partial complete-story results.';
