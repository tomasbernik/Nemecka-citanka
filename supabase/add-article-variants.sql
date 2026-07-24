alter table public.app_articles
add column if not exists variant_group_id text;

update public.app_articles
set variant_group_id = case
  when id = 'en-a-very-big-breakfast-on-saturday' then 'ein-sehr-gro-es-fruhstuck-am-samstag'
  when id = 'en-the-vanished-server' then 'der-verschwundene-server'
  else id
end
where variant_group_id is null
  or variant_group_id = '';
