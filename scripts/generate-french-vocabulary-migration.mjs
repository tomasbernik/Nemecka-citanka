import fs from "node:fs/promises";

const cache = JSON.parse(
  await fs.readFile("translations/generated-remote-vocab-translations.json", "utf8")
);
const frenchTranslations = Object.fromEntries(
  Object.entries(cache)
    .filter(([, translations]) => translations?.fr)
    .map(([german, translations]) => [german, translations.fr])
);

const translationsJson = JSON.stringify(frenchTranslations, null, 2);

process.stdout.write(`-- Backfill missing French vocabulary translations without overwriting reviewed values.
do $migration$
declare
  french_translations jsonb := $translations$
${translationsJson}
$translations$::jsonb;
begin
  update public.app_articles as article
  set
    vocabulary = (
      select coalesce(
        jsonb_agg(
          case
            when coalesce(btrim(item ->> 'fr'), '') = ''
              and french_translations ? coalesce(item ->> 'de', item ->> 'base')
            then jsonb_set(
              item,
              '{fr}',
              to_jsonb(french_translations ->> coalesce(item ->> 'de', item ->> 'base')),
              true
            )
            else item
          end
          order by item_order
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(article.vocabulary) = 'array' then article.vocabulary
          else '[]'::jsonb
        end
      ) with ordinality as entries(item, item_order)
    ),
    inline_vocabulary = (
      select coalesce(
        jsonb_agg(
          case
            when coalesce(btrim(item ->> 'fr'), '') = ''
              and french_translations ? coalesce(item ->> 'de', item ->> 'base')
            then jsonb_set(
              item,
              '{fr}',
              to_jsonb(french_translations ->> coalesce(item ->> 'de', item ->> 'base')),
              true
            )
            else item
          end
          order by item_order
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(article.inline_vocabulary) = 'array' then article.inline_vocabulary
          else '[]'::jsonb
        end
      ) with ordinality as entries(item, item_order)
    )
  where exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(article.vocabulary) = 'array' then article.vocabulary
        else '[]'::jsonb
      end
    ) as entries(item)
    where coalesce(btrim(item ->> 'fr'), '') = ''
      and french_translations ? coalesce(item ->> 'de', item ->> 'base')
  )
  or exists (
    select 1
    from jsonb_array_elements(
      case
        when jsonb_typeof(article.inline_vocabulary) = 'array' then article.inline_vocabulary
        else '[]'::jsonb
      end
    ) as entries(item)
    where coalesce(btrim(item ->> 'fr'), '') = ''
      and french_translations ? coalesce(item ->> 'de', item ->> 'base')
  );
end
$migration$;
`);
