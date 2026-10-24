alter table public.article_generation_jobs
  add column if not exists provider_used text;

alter table public.article_generation_job_events
  add column if not exists provider text;

update public.article_generation_job_events
set provider = case
  when model like 'gemini-%' then 'gemini'
  else 'unknown'
end
where provider is null;

alter table public.article_generation_job_events
  alter column provider set not null;

comment on column public.article_generation_jobs.provider_used is
  'AI provider used by the latest article-generation phase.';

comment on column public.article_generation_jobs.model_used is
  'AI model used by the latest article-generation phase.';

comment on column public.article_generation_job_events.provider is
  'AI provider used for this generation attempt.';

comment on column public.article_generation_job_events.model is
  'Exact AI model identifier used for this generation attempt.';
