# Čítanka – PWA prototyp

Jednoduchá offline čítanka pre Android.

## Spustenie na notebooku

V priečinku projektu spusti:

```bash
python -m http.server 8000
```

Potom otvor:

```text
http://localhost:8000
```

## Test na Androide v rovnakej Wi‑Fi

Zisti IP adresu notebooku a v mobile otvor napríklad:

```text
http://192.168.1.50:8000
```

Poznámka: Inštalácia PWA cez „Pridať na plochu“ v Chrome najlepšie funguje cez HTTPS. Na lokálne testovanie môže stačiť otvorenie v prehliadači, ale pre pohodlnú inštaláciu je lepší GitHub Pages alebo Netlify.

## Pridávanie článkov

Uprav súbor `articles.json`. Každý článok má:

- id
- title
- level
- category
- summary
- text
- vocabulary
- questions

Po nahratí novej verzie na hosting stačí v appke kliknúť na „Aktualizovať“.

## Kontrola prekladov

Po pridaní nového textu alebo nového jazyka spusti:

```bash
node scripts/check-translations.mjs
```

Skript porovná všetky podporované jazyky so slovenským zdrojom pravdy, skontroluje chýbajúce UI kľúče, prompt preklady, placeholdery typu `{count}` a preklady kategórií. Ak niečo chýba, skončí chybou a vypíše konkrétne kľúče.

## Evidencia a AI kontrola prekladov

Preklady, ktoré treba neskôr filtrovať a kontrolovať, sa evidujú v Supabase tabuľke `app_translation_entries`. Najprv v Supabase SQL editore znovu spusti aktuálny `supabase-schema.sql`.

Generovanie nových jazykov cez Google Translate skript teraz okrem `translations/new-languages.js` vytvorí aj audit súbor:

```bash
node scripts/generate-new-language-translations.mjs
```

Audit sa uloží do `translations/generated-translation-audit.json` a označí položky ako `provider = google_translate_script`, `review_status = unreviewed`.

Synchronizácia všetkých lokálnych viacjazyčných textov do evidencie:

```bash
SUPABASE_URL="https://tvoj-projekt.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." node scripts/sync-translation-entries.mjs --supabase
```

Bez Supabase zápisu si vieš najprv vytvoriť kontrolný JSON:

```bash
node scripts/sync-translation-entries.mjs --output translations/translation-entries.preview.json
```

Export dávky pre AI kontrolu, napríklad všetky anglické preklady vytvorené Google skriptom:

```bash
SUPABASE_URL="https://tvoj-projekt.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." node scripts/export-translation-review-batch.mjs --provider google_translate_script --language en --limit 100 --output translations/review-en.json
```

AI má v exporte meniť iba `corrected_text` a prípadne `notes`. Import opravenej dávky:

```bash
SUPABASE_URL="https://tvoj-projekt.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." node scripts/import-reviewed-translations.mjs --input translations/review-en.json --review-provider chatgpt
```

Import nastaví `review_status = ai_reviewed`, zachová pôvodného poskytovateľa prekladu a uloží `review_provider`.

## Obrázky k článkom

V editore článkov môžeš vybrať obrázok zo zariadenia. Appka ho pri uložení článku automaticky prevedie na JPG, nahrá do Supabase Storage bucketu `article-images` a uloží k článku URL obrázka.

Pre túto funkciu musí byť v Supabase spustený aktuálny `supabase-schema.sql`, ktorý pridá stĺpec `image` a vytvorí Storage bucket `article-images`.

Starší ručný spôsob stále funguje:

Obrázok ulož do priečinka `images/articles/` a pomenuj ho podľa ID článku:

```text
images/articles/wohin-fahren-wir-dieses-jahr.jpg
```

Appka najprv hľadá `.jpg`, potom `.png`. Ak súbor existuje, zobrazí sa v článku tesne pred textom. Ak neexistuje, článok ostane bez obrázka.

## Online databáza cez Supabase

Appka vie bežať aj bez online databázy. Ak v `config.js` necháš prázdne hodnoty, používa iba lokálne uloženie v konkrétnom mobile.

Pre spoločné dáta medzi dvoma mobilmi:

1. Vytvor projekt v Supabase.
2. Otvor SQL editor a spusti obsah súboru `supabase-schema.sql`.
3. V Supabase otvor Project Settings → API.
4. Do `config.js` vlož `Project URL` a `anon public` kľúč:

```js
window.NC_SUPABASE_CONFIG = {
  url: "https://tvoj-projekt.supabase.co",
  anonKey: "tvoj-anon-public-kluc",
  authRedirectUrl: "https://tvoja-adresa-appky.example"
};
```

Pre prihlasenie cez Google aj magic link zapni v Supabase `Authentication`.
Pri magic linku povol email prihlasovanie/OTP a v URL konfiguracii pridaj adresu appky medzi povolene redirect URL.
V Supabase nastav `Site URL` aj `Redirect URLs` na realnu adresu appky, nie na `localhost`. `localhost` funguje iba na tom istom zariadeni, kde bezi vyvojovy server.
Pozývacie linky potrebujú v `app_profiles` stĺpce `invite_token` a `invite_claimed_at`; ak aktualizuješ existujúci projekt, znovu spusti aktuálny `supabase-schema.sql`.

Admini, ktorí môžu schvaľovať verejné články, sa nastavujú v `config.js`:

```js
window.NC_ADMIN_PROFILE_IDS = [
  "tomas"
];
```

ID profilu vzniká z mena bez diakritiky, malými písmenami. Napríklad `Tomáš` má ID `tomas`.

Ak už tabuľka `app_events` existuje a chceš sledovať unikátne zariadenia, pridaj stĺpec:

```sql
alter table public.app_events
add column if not exists device_id text;

alter table public.app_events
add column if not exists device_name text;

alter table public.app_events
add column if not exists country text;

alter table public.app_events
add column if not exists city text;

alter table public.app_events
add column if not exists ip_hash text;

create table if not exists public.app_devices (
  device_id text primary key,
  device_name text,
  automatic_name text,
  profile_id text references public.app_profiles(id) on delete set null,
  user_agent text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
```

`automatic_name` nie je skutočný systémový názov telefónu alebo notebooku, pretože prehliadač ho z bezpečnostných dôvodov neposkytuje. Appka ho skladá z profilu, platformy, prehliadača a krátkej časti `device_id`, napríklad `Tomas • Windows • Chrome • 5bd2a0`.

Ak chceš vlastný názov zariadenia, uprav v tabuľke `app_devices` stĺpec `device_name`, napríklad `Tomas-PC` alebo `Tomas-Mobil`. Appka toto meno použije pri budúcich eventoch.

Voliteľná Edge Function `log-app-opened` dopĺňa pri otvorení appky približnú krajinu/mesto a hash IP. Appka ju volá maximálne raz denne na jedno zariadenie; ostatné eventy sa ukladajú priamo ako doteraz. Deploy cez Supabase CLI:

```bash
supabase functions deploy log-app-opened
```

Ak chceš stabilnejší anonymný hash IP, nastav pre funkciu aj secret:

```bash
supabase secrets set IP_HASH_SALT="nahodny-dlhy-retazec"
```

## Preklad slov a viet cez DeepL

Kliknutie na slovo v článku ponúka preklad slova alebo celej vety. Existujúce
preklady z `inlineVocabulary` sa zobrazia bez externého API. Ostatné preklady
spracuje Supabase Edge Function `translate-text` a výsledok uloží do
`app_text_translations`, aby sa rovnaký text neprekladal opakovane.

1. V Supabase SQL editore spusti `supabase/add-text-translations.sql`.
2. Aktivuj DeepL Developer API a skopíruj API kľúč.
3. Ulož kľúč ako Supabase secret:

```bash
supabase secrets set DEEPL_API_KEY="tvoj-deepl-api-kluc"
```

4. Nasaď Edge Function:

```bash
supabase functions deploy translate-text
```

Funkcia automaticky použije `https://api-free.deepl.com` pre starší Free kľúč
končiaci na `:fx`; pre Developer API použije `https://api.deepl.com`. Adresu
možno podľa potreby nastaviť explicitne:

```bash
supabase secrets set DEEPL_API_URL="https://api-free.deepl.com"
```

5. Nahraj novú verziu appky na hosting.
6. Pri prvom spustení vytvor profily. Druhý mobil si ich potom načíta z databázy a stačí sa prihlásiť menom a PINom.

Poznámka: Toto je jednoduchý súkromný režim pre dvoch ľudí. PINy sú uložené v databáze ako obyčajný text, takže to nie je bezpečnostný systém pre verejnú aplikáciu.
