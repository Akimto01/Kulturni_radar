# Backlog — Kulturní radar

Poslední aktualizace: 3. 8. 2026. Neplánované nápady a rozpracované položky —
na rozdíl od CHANGELOG.md, který dokumentuje hotové změny.

## K ověření zítra (5. 8. 2026)
- Dojezd v km u nově nalezených akcí (v3.12 prompt) — zkontrolovat řádek „Festival Milotice 2026" v listu AKCE, sloupec H (dojezd).
- iPad: ověřit, jestli window.open() (v3.7 Index.html) vyřešil otevírání „Více info"/„Do kalendáře" v nové záložce — dcera se vrací s iPadem.

## Nejvyšší priorita
- Poslat URL rodině, počkat na zpětnou vazbu — určí prioritu všeho níže.
- Předat `Index.html` dceři k designu (CSS tokeny v `:root`).

## Zpětná vazba syna — 5. 8. 2026
### Design/rozvržení (patří do dceřina designového večera, ne bodová oprava)
- Příliš mnoho textu bez struktury — zvážit boční osnovu/navigaci stránky
- Obsah zbytečně úzký uprostřed, nevyužitý prostor po stranách na širších obrazovkách
- Chipy „★ Oblíbené"/„✓ Navštívené" vizuálně sjednotit s výškou filtrů vlevo
- Barevné rozlišení mezi položkami/kategoriemi (budoucí potřeba, ne akutní)

### Chybí/neúplné (vysvětleno, není to bug)
- Počasí ve webu — dnes jen v e-mailových přehledech (~1–2 h, ale s architektonickou pastí: nesmí se volat živě při načtení stránky, potřebuje cache jako souřadnice)
- Dojezd v km a piny na mapě u starších akcí — čeká na doběhnutí zpětného geokódování/přegenerování dat, není potřeba nic opravovat

### Nové funkce k prozkoumání
- Kalendářní pohled s proklikem na akce v daném termínu (~4–6 h, odhad nejistý bez detailního rozvržení)
- Filtr podle vystupujících/žánrů (taneční, hudební…) — pole `podkategorie` v datech existuje, ale nepoužívá se nikde ve frontendu; nejdřív ověřit, jestli in data reálně obsahuje užitečné hodnoty, než slibovat rozsah

## Ke kontrole

## Probíhající měření
- Haiku vs. Sonnet na denní kontrole — týden sledovat kvalitu úlovků, pak rozhodnout.

## Nové funkce (schváleno, čeká na zpětnou vazbu rodiny)
- Sdílení jedné akce (tlačítko vedle „Do kalendáře", text pro WhatsApp/SMS).
- Doporučení podle historie navštívených akcí.
- Roční přehled/statistika navštívených akcí a typů.

## Počasí ve webu
- `weatherFor_` dnes jen v digestech; šlo by vystavit přes API i na kartu/místa ve webové aplikaci.

## Větší témata
- Plnohodnotná interaktivní mapa akcí (víc pinů najednou, places_map) — vědomě odložená budoucí varianta. Odkaz „📍 Mapa" na kartě (v3.10, garantovaný pin díky souřadnicím z Nominatim) pokrývá jednu akci najednou a je hotový.
- Strukturované časy `cas_od`/`cas_do` — přesnější „Do kalendáře" (dnes celodenní), řazení akcí v rámci dne.
- Frontendový večer: `Index.html` → GitHub Pages + DNS `kulturniradar.cz`.
  ⚠️ Nutno prověřit HNED na začátku: `google.script.run` funguje jen když Apps Script sám servíruje HTML; po přesunu na GitHub Pages bude nutné přejít na `fetch()` a ověřit CORS chování `/exec` endpointu.
- Případná Android aplikace (výukový projekt) — cesta: PWA → Trusted Web Activity → Google Play. Podmíněno dokončením frontendového večera výše.

## Plán rozvoje — schváleno 4. 8. 2026, v tomto pořadí
1. **Rodinné profily** (~3–5 h) — rozšíření OZNAČENÍ o „Kdo" (jméno vybrané
   z výběru, uloženo v prohlížeči jako dnešní token). Bez hesla, bez
   autentizace. Reálný limit souběžnosti: appka takhle unese rodinu i
   přátelskou partu (desítky lidí); stovky+ už by narážely na limity
   Sheets/Apps Scriptu — signál pro krok 5.
2. **Frontendový večer** (~3–4 h, možná 2 sezení) — GitHub Pages + DNS
   kulturniradar.cz. Riziko: CORS chování `/exec` z cizí domény nikdy
   neověřeno, první hodina bude zjišťování.
3. **Lehčí sdílení** (~2–3 h) — veřejný odkaz s vybranými akcemi v URL, bez
   účtů pro čtenáře. Nezávislé na kroku 2, může jít kdykoli mezitím.
4. **Android appka** (~3–4 h práce + dny čekání na schválení Play Store) —
   vyžaduje krok 2 hotový (PWA potřebuje vlastní doménu).
5. **Multi-tenant systém** — řádově týdny, viz vize níže.

## Dlouhodobá vize — multi-tenant platforma (jiný produkt, ne rozšíření)
Nápad z 4. 8. 2026: plnohodnotné přihlašování s heslem + sdílení plánů mezi
cizími rodinami (ne jen v rámci jedné domácnosti). Vyžaduje kategoricky
jinou architekturu, ne přírůstek k dnešní appce:
- Sheets → skutečná multi-tenant databáze (Firestore/Postgres)
- Apps Script → hostovaný backend (Cloud Run / Firebase Functions)
- „Token v URL" → skutečné přihlašování (doporučeno: Google Sign-In/Firebase Auth, ne vlastní hesla)
- Nutná moderace veřejně sdíleného obsahu
- GDPR vrstva: zásady ochrany osobních údajů, právo na výmaz, souhlas
- Reálné provozní náklady a odpovědnost (dnes běží zdarma na Google infra)

Přenositelné beze změny: AI vyhledávací logika (`callAnthropic_`,
`report_events` schéma), UX vzorce (karty, chipy, Oblíbené/Navštívené),
doména kulturniradar.cz, veškerá logika datové hygieny (deduplikace,
parsování datumů, detekce vycpávek).

Doporučený postupný krok (ne najednou):
1. Osobní profily v rámci jedné rodiny (lehká varianta, dnešní architektura)
2. Frontendový večer (GitHub Pages + doména) – nutný předstupeň
3. Lehčí sdílení: veřejná stránka s plánem bez účtů pro čtenáře
4. Plnohodnotný multi-tenant systém – dlouhodobý horizont, ne blízký plán

Odhad rozsahu: řádově týdny soustředěné práce, ne jedna session.

## Trvalá pravidla (ne úkoly, ale konvence)
- Při každém „Nová verze" v Apps Scriptu vyplnit pole Popis podle aktuální `VERZE`.
- Formalizováno jako Claude skill kulturni-radar-workflow (4. 8. 2026) — viz Docs/kulturni-radar-workflow/.
