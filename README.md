# Nemecká čítanka – PWA prototyp

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
- minutes
- summary
- text
- vocabulary
- questions

Po nahratí novej verzie na hosting stačí v appke kliknúť na „Aktualizovať“.
