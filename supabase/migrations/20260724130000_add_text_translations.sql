create table if not exists public.app_text_translations (
  id uuid primary key default gen_random_uuid(),
  article_id text not null references public.app_articles(id) on delete cascade,
  source_type text not null check (source_type in ('word', 'sentence')),
  source_language text not null,
  source_text text not null,
  source_context text not null default '',
  target_language text not null,
  translated_text text not null,
  provider text not null default 'deepl',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_text_translations_unique
    unique (article_id, source_type, source_text, source_context, target_language)
);

create index if not exists app_text_translations_lookup_idx
on public.app_text_translations (
  article_id,
  source_type,
  target_language
);

alter table public.app_text_translations enable row level security;

revoke all on public.app_text_translations from anon;
revoke all on public.app_text_translations from authenticated;
grant all on public.app_text_translations to service_role;
