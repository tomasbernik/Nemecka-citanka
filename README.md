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

5. Nahraj novú verziu appky na hosting.
6. Pri prvom spustení vytvor profily. Druhý mobil si ich potom načíta z databázy a stačí sa prihlásiť menom a PINom.

Poznámka: Toto je jednoduchý súkromný režim pre dvoch ľudí. PINy sú uložené v databáze ako obyčajný text, takže to nie je bezpečnostný systém pre verejnú aplikáciu.
