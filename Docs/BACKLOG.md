# Backlog — Kulturní radar

Poslední aktualizace: 3. 8. 2026. Neplánované nápady a rozpracované položky —
na rozdíl od CHANGELOG.md, který dokumentuje hotové změny.

## Nejvyšší priorita
- Poslat URL rodině, počkat na zpětnou vazbu — určí prioritu všeho níže.
- Předat `Index.html` dceři k designu (CSS tokeny v `:root`).

## Ke kontrole
- Auto-reload v konzoli Anthropic — ověřit, jestli je zapnutý (screenshot z 3. 8. ukazoval "off").

## Probíhající měření
- Haiku vs. Sonnet na denní kontrole — týden sledovat kvalitu úlovků, pak rozhodnout.

## Testovací dluh
- `parseEvents_`, `callAnthropic_`/`callAnthropicPlaces_` — jádro zpracování AI odpovědi, zaslouží si fixture s reálnými i pokaženými odpověďmi.

## Nové funkce (schváleno, čeká na zpětnou vazbu rodiny)
- Mapa akcí (Google Maps / places_map).
- Sdílení jedné akce (tlačítko vedle „Do kalendáře", text pro WhatsApp/SMS).
- Doporučení podle historie navštívených akcí.
- Roční přehled/statistika navštívených akcí a typů.
- Explicitní rubrika pro AI skóre akcí (1–10) v promptu `callAnthropic_` — dnes model hodnotí bez pevných kritérií.

## Počasí ve webu
- `weatherFor_` dnes jen v digestech; šlo by vystavit přes API i na kartu/místa ve webové aplikaci.

## Větší témata
- Strukturované časy `cas_od`/`cas_do` — přesnější „Do kalendáře" (dnes celodenní), řazení akcí v rámci dne.
- Frontendový večer: `Index.html` → GitHub Pages + DNS `kulturniradar.cz`.
  ⚠️ Nutno prověřit HNED na začátku: `google.script.run` funguje jen když Apps Script sám servíruje HTML; po přesunu na GitHub Pages bude nutné přejít na `fetch()` a ověřit CORS chování `/exec` endpointu.
- Případná Android aplikace (výukový projekt) — cesta: PWA → Trusted Web Activity → Google Play. Podmíněno dokončením frontendového večera výše.

## Trvalá pravidla (ne úkoly, ale konvence)
- Při každém „Nová verze" v Apps Scriptu vyplnit pole Popis podle aktuální `VERZE`.
