alter table public.app_profiles
  alter column native_language set default 'de';

alter table public.app_profiles
  drop constraint if exists app_profiles_native_language_check;

alter table public.app_profiles
  add constraint app_profiles_native_language_check
  check (native_language in ('de', 'sk', 'ru', 'pl', 'hu', 'ro', 'it', 'en', 'fr', 'tr'));
