# Backlog — Kulturní radar

Poslední aktualizace: 8. 8. 2026. Neplánované nápady a rozpracované položky —
na rozdíl od CHANGELOG.md, který dokumentuje hotové změny.

## K ověření
- iPad: ověřit, jestli window.open() (v3.7 Index.html) vyřešil otevírání „Více info"/„Do kalendáře" v nové záložce — dcera se ještě nevrátila s iPadem. (Dojezd v km u nově nalezených akcí ověřen 7. 8. jako OK, položka odstraněna.)

## Nejvyšší priorita
- Předat `Index.html` dceři k designu (CSS tokeny v `:root`). (Rodina appku už používá – 4 profily aktivně vyzkoušené 7.–8. 8., položka „poslat URL rodině" splněna a odstraněna.)

## Zpětná vazba syna — 5. 8. 2026
### Design/rozvržení (patří do dceřina designového večera, ne bodová oprava)
- Příliš mnoho textu bez struktury — zvážit boční osnovu/navigaci stránky
- Obsah zbytečně úzký uprostřed, nevyužitý prostor po stranách na širších obrazovkách
- Chipy „★ Oblíbené"/„✓ Navštívené" vizuálně sjednotit s výškou filtrů vlevo
- Barevné rozlišení mezi položkami/kategoriemi (budoucí potřeba, ne akutní)

### Chybí/neúplné (vysvětleno, není to bug)
- Počasí ve webu — dnes jen v e-mailových přehledech (~1–2 h, ale s architektonickou pastí: nesmí se volat živě při načtení stránky, potřebuje cache jako souřadnice)
- Dojezd v km a piny na mapě u starších akcí — čeká na doběhnutí zpětného geokódování/přegenerování dat, není potřeba nic opravovat
- Rozdíl v počtu akcí mezi městy (Praha 7, Brno 30+, jiná 0) — dané tím, že automatika běží jen pro aktivní profil; ostatní mají data jen z jednorázových ručních kontrol, nebo žádná

### Nové funkce k prozkoumání
- Kalendářní pohled s proklikem na akce v daném termínu (~4–6 h, odhad nejistý bez detailního rozvržení)
- Filtr podle vystupujících/žánrů (taneční, hudební…) — pole `podkategorie` v datech existuje, ale nepoužívá se nikde ve frontendu; nejdřív ověřit, jestli in data reálně obsahuje užitečné hodnoty, než slibovat rozsah
- UX: rozlišit „0 akcí, nikdy neprohledáno" od „0 akcí, prohledáno, nic nenalezeno" (jasnější stav pro neaktivní profily v dropdownu)
- Zapamatovat si poslední zvolené kategorie-chipy v horní liště per uživatelský profil (čistě UI preference k zobrazení; nápad Vojty 7. 8. 2026 — neplést s „filtry" v profilu, které řídí AI hledání na vyžádání, to je jiná věc)

## Ke kontrole

## Testovací dluh
- RF test na opakované přepnutí profilu v dropdownu — regresní pojistka na bug v3.12 (#status mizel z DOM).
- RF test na opakované spuštění zpracovatSledovanaMesta — regresní pojistka na bug v3.18 (chybějící skip logika).

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
  CORS chování `/exec` endpointu ověřeno 7. 8. 2026 (GET i POST z cizí
  originy procházejí bez blokace) — migrace proveditelná bez proxy/JSONP.
  Zbývá přepsat `google.script.run` volání na `fetch()`.
- Případná Android aplikace (výukový projekt) — cesta: PWA → Trusted Web Activity → Google Play. Podmíněno dokončením frontendového večera výše.

## Plán rozvoje — schváleno 4. 8. 2026, aktualizováno 8. 8. 2026
1. ~~**Rodinné profily**~~ — **HOTOVO 7.–8. 8. 2026** (backend v3.20, frontend
   v3.13), viz CHANGELOG.md. Realizováno s PINem (ne bez hesla, jak původně
   plánováno) a s podporou osobních vyhledávacích filtrů navíc oproti
   původnímu rozsahu. Realita: 4 rodinné profily + 1 vyhrazený `rf-test`
   pro CI, prostor pro další.
2. **Frontendový večer** (~3–4 h, možná 2 sezení) — GitHub Pages + DNS
   kulturniradar.cz. Riziko z minula **vyřešeno 7. 8. 2026**: CORS spike
   potvrdil, že GET i POST na `/exec` z cizí originy procházejí bez
   blokace (Apps Script vrací CORS hlavičky defaultně), takže migrace je
   proveditelná bez proxy/JSONP obchvatu. Zbývá samotné přestěhování
   `Index.html` a přepis `google.script.run` volání na `fetch()`.
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
1. ~~Osobní profily v rámci jedné rodiny~~ — hotovo 7.–8. 8. 2026, viz plán výše.
2. Frontendový večer (GitHub Pages + doména) – nutný předstupeň, CORS ověřen
3. Lehčí sdílení: veřejná stránka s plánem bez účtů pro čtenáře
4. Plnohodnotný multi-tenant systém – dlouhodobý horizont, ne blízký plán

Odhad rozsahu: řádově týdny soustředěné práce, ne jedna session.

## Trvalá pravidla (ne úkoly, ale konvence)
- Při každém „Nová verze" v Apps Scriptu vyplnit pole Popis podle aktuální `VERZE`.
- Formalizováno jako Claude skill kulturni-radar-workflow (4. 8. 2026) — viz Docs/kulturni-radar-workflow/.
