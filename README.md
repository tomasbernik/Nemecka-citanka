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
  anonKey: "tvoj-anon-public-kluc"
};
```

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

5. Nahraj novú verziu appky na hosting.
6. Pri prvom spustení vytvor profily. Druhý mobil si ich potom načíta z databázy a stačí sa prihlásiť menom a PINom.

Poznámka: Toto je jednoduchý súkromný režim pre dvoch ľudí. PINy sú uložené v databáze ako obyčajný text, takže to nie je bezpečnostný systém pre verejnú aplikáciu.
