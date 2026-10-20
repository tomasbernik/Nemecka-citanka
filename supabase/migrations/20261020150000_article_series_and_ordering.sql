-- Publisher-controlled home page ordering and chapter series.

alter table public.app_articles
  add column if not exists display_order integer,
  add column if not exists series_id text,
  add column if not exists series_title text,
  add column if not exists chapter_order integer;

with ordered_articles as (
  select id, (row_number() over (order by updated_at desc, title asc) - 1)::integer as position
  from public.app_articles
)
update public.app_articles article
set display_order = ordered.position
from ordered_articles ordered
where article.id = ordered.id
  and article.display_order is null;

create index if not exists app_articles_display_order_idx
on public.app_articles (display_order, updated_at desc);

create index if not exists app_articles_series_id_idx
on public.app_articles (series_id, chapter_order);

create or replace function public.app_guard_article_organization()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.app_is_publisher() and (
    (tg_op = 'INSERT' and (
      new.display_order is not null
      or new.series_id is not null
      or new.series_title is not null
      or new.chapter_order is not null
    ))
    or (tg_op = 'UPDATE' and (
      new.display_order is distinct from old.display_order
      or new.series_id is distinct from old.series_id
      or new.series_title is distinct from old.series_title
      or new.chapter_order is distinct from old.chapter_order
    ))
  ) then
    raise exception 'Only the publisher can organize articles';
  end if;
  return new;
end;
$$;

revoke all on function public.app_guard_article_organization() from public;

drop trigger if exists app_guard_article_organization_trigger on public.app_articles;
create trigger app_guard_article_organization_trigger
before insert or update on public.app_articles
for each row execute function public.app_guard_article_organization();
