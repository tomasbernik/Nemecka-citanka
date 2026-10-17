-- Atomic per-user and global daily quotas for Gemini generation.
create table if not exists public.ai_article_usage (
  usage_day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_count integer not null default 0 check (used_count >= 0),
  primary key (usage_day, user_id)
);
alter table public.ai_article_usage enable row level security;
revoke all on public.ai_article_usage from anon, authenticated;

create or replace function public.claim_ai_article_generation()
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  today_utc date := (now() at time zone 'UTC')::date;
  user_used integer;
  global_used integer;
begin
  if uid is null then return false; end if;
  -- Serialize all claims, including requests from different users.
  perform pg_advisory_xact_lock(827343, 109122);
  select coalesce(sum(used_count),0) into global_used
  from public.ai_article_usage where usage_day = today_utc;
  select coalesce(used_count,0) into user_used
  from public.ai_article_usage where usage_day = today_utc and user_id = uid;
  if global_used >= 50 or user_used >= 20 then return false; end if;
  insert into public.ai_article_usage(usage_day,user_id,used_count)
  values(today_utc,uid,1)
  on conflict(usage_day,user_id)
  do update set used_count = ai_article_usage.used_count + 1;
  return true;
end;
$$;
revoke all on function public.claim_ai_article_generation() from public, anon;
grant execute on function public.claim_ai_article_generation() to authenticated;
