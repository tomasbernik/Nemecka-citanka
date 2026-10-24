-- Authors may group their own articles into a chapter series. Home-page
-- ordering remains publisher-only.
create or replace function public.app_guard_article_organization()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  owns_article boolean := public.app_is_article_owner(new.owner_profile_id);
begin
  if public.app_is_publisher() then
    return new;
  end if;

  if (tg_op = 'INSERT' and new.display_order is not null)
     or (tg_op = 'UPDATE' and new.display_order is distinct from old.display_order) then
    raise exception 'Only the publisher can change article order';
  end if;

  if tg_op = 'INSERT' and (
    new.series_id is not null
    or new.series_title is not null
    or new.chapter_order is not null
  ) and not owns_article then
    raise exception 'Only the article owner can organize it into a story';
  end if;

  if tg_op = 'UPDATE' and (
    new.series_id is distinct from old.series_id
    or new.series_title is distinct from old.series_title
    or new.chapter_order is distinct from old.chapter_order
  ) and not public.app_is_article_owner(old.owner_profile_id) then
    raise exception 'Only the article owner can organize it into a story';
  end if;

  return new;
end;
$$;

revoke all on function public.app_guard_article_organization() from public;
