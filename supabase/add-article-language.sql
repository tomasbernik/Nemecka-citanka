alter table public.app_articles
add column if not exists language text not null default 'de';

update public.app_articles
set language = case
  when id like 'en-%' then 'en'
  else 'de'
end
where language is null
  or language = ''
  or (id like 'en-%' and language <> 'en');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_articles_language_check'
  ) then
    alter table public.app_articles
    add constraint app_articles_language_check
    check (language in ('de', 'en', 'sk', 'ru', 'pl', 'hu', 'ro', 'it', 'fr', 'tr'));
  end if;
end $$;
