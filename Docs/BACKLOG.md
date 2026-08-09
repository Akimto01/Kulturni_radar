# Backlog — Kulturní radar

Poslední aktualizace: 8. 8. 2026. Neplánované nápady a rozpracované položky —
na rozdíl od CHANGELOG.md, který dokumentuje hotové změny.

## Doporučené pořadí
Zohledňuje závislosti mezi položkami a paralelizaci čekacích dob
(Google Play schvalování běží mimo aktivní práci), stanoveno 8. 8. 2026:

1. **Design večer s dcerou** (rozvržení, ikony/branding appky) —
   odemyká Android submission a snižuje riziko předělávek u
   kalendářního pohledu
2. **Android appka — start submission** (~3–4 h aktivní práce) —
   spustit hned po designu, schvalovací proces v Google Play trvá
   dny a běží na pozadí, ať se nečeká zbytečně
3. **API credit optimalizace** (~0,5–1 h) — rychlý nezávislý win,
   kdykoli mezi ostatním
4. **Filtr žánrů/podkategorie** (~2–4 h) — nezávislý, nejdřív ověřit
   kvalitu dat v poli podkategorie (~30 min)
5. **Roční přehled** + **Doporučení podle historie** (~2–3 h + 2–3 h) —
   spárováno, obě staví na stejných datech (OZNAČENÍ)
6. **Mapa akcí** — vědomě odložená budoucí varianta (viz Větší
   témata), ne aktivně plánovaná v tomhle pořadí; jednotlivá akce
   je už pokrytá hotovým odkazem „📍 Mapa" na kartě
7. **Kalendářní pohled** (~4–6 h) — po designu, největší UI zásah
8. **Email zpracování návrhů** (~2–3 h) — potřebuje nejdřív ujasnit
   koncept
9. **Cesta B zrychlení přihlášení** (~1–2 h) — volitelné, nejvyšší
   riziko regrese, nejnižší priorita

Poznámka: pořadí není striktní závazek, jen doporučení podle
závislostí a efektivity — aktualizuj tuto sekci při každé větší
změně BACKLOGu.

## K ověření
- iPad: ověřit, jestli window.open() (v3.7 Index.html) vyřešil otevírání „Více info"/„Do kalendáře" v nové záložce — dcera se ještě nevrátila s iPadem. (Dojezd v km u nově nalezených akcí ověřen 7. 8. jako OK, položka odstraněna.)
- Duplicita „ŠTETL FEST 2026 – Návraty" v AKCÍCH (profil Brno, 2 řádky: ID `2026-08-26-stetl-fest` a `2026-08-26-stetl-fest-2026`) — příčina zatím jen hypotéza (rozdílný formát data při vzniku záznamu, viz diagnostika 9. 8. 2026), potřeba potvrdit ze sloupců Q (První nález) a R (Poslední kontrola) obou řádků přímo v Google Sheet (přes veřejné API nejdou přečíst). I po potvrzení příčiny bude potřeba ruční úklid — `cleanupDuplicates()` není v automatických triggerech, jen ruční spuštění z menu.
- „Festival Špilberk" (ID `2026-08-17-festival-spilberk`, profil Brno) — AI ho našla jako neověřenou akci bez URL, teď se zobrazuje přes chip „❓ Neověřeno" (v3.27). Potřeba ručně dohledat spolehlivý zdroj/URL (web pořadatele, Brno.cz) a buď označit jako potvrzeno, nebo smazat, pokud zdroj neexistuje.

## Nejvyšší priorita
- Předat `Index.html` dceři k designu (CSS tokeny v `:root`). (Rodina appku už používá – 4 profily aktivně vyzkoušené 7.–8. 8., položka „poslat URL rodině" splněna a odstraněna.)

## Zpětná vazba syna — 5. 8. 2026
### Design/rozvržení (patří do dceřina designového večera, ne bodová oprava)
- Příliš mnoho textu bez struktury — zvážit boční osnovu/navigaci stránky
- Obsah zbytečně úzký uprostřed, nevyužitý prostor po stranách na širších obrazovkách
- Chipy „★ Oblíbené"/„✓ Navštívené" vizuálně sjednotit s výškou filtrů vlevo
- Barevné rozlišení mezi položkami/kategoriemi (budoucí potřeba, ne akutní)

### Chybí/neúplné (vysvětleno, není to bug)
- Dojezd v km a piny na mapě u starších akcí — čeká na doběhnutí zpětného geokódování/přegenerování dat, není potřeba nic opravovat
- Rozdíl v počtu akcí mezi městy (Praha 7, Brno 30+, jiná 0) — dané tím, že automatika běží jen pro aktivní profil; ostatní mají data jen z jednorázových ručních kontrol, nebo žádná

### Nové funkce k prozkoumání
- Kalendářní pohled s proklikem na akce v daném termínu (~4–6 h, odhad nejistý bez detailního rozvržení)
- Filtr podle vystupujících/žánrů (taneční, hudební…) — pole `podkategorie` v datech existuje, ale nepoužívá se nikde ve frontendu; nejdřív ověřit, jestli pole reálně obsahuje užitečné hodnoty, než slibovat rozsah (~2–4 h, z toho ~30 min na ověření, jestli pole obsahuje užitečné hodnoty)
- UX: rozlišit „0 akcí, nikdy neprohledáno" od „0 akcí, prohledáno, nic nenalezeno" (jasnější stav pro neaktivní profily v dropdownu)

## Ke kontrole

## Testovací dluh
- RF test na opakované přepnutí profilu v dropdownu — regresní pojistka na bug v3.12 (#status mizel z DOM).
- RF test na opakované spuštění zpracovatSledovanaMesta — regresní pojistka na bug v3.18 (chybějící skip logika).

## Probíhající měření
- Haiku vs. Sonnet na denní kontrole — týden sledovat kvalitu úlovků, pak rozhodnout.

## Nové funkce (schváleno, čeká na zpětnou vazbu rodiny)
- Doporučení podle historie navštívených akcí.
- Roční přehled/statistika navštívených akcí a typů.

## Větší témata
- Plnohodnotná interaktivní mapa akcí (víc pinů najednou, places_map) — vědomě odložená budoucí varianta. Odkaz „📍 Mapa" na kartě (v3.10, garantovaný pin díky souřadnicím z Nominatim) pokrývá jednu akci najednou a je hotový.
- Strukturované časy `cas_od`/`cas_do` — přesnější „Do kalendáře" (dnes celodenní), řazení akcí v rámci dne.
- Případná Android aplikace (výukový projekt) — cesta: PWA → Trusted Web Activity → Google Play. Frontendový večer (podmínka vlastní domény) hotov 8. 8. 2026.
- **API credit optimalizace** (~0,5–1 h): v konzoli Anthropic snížit Monthly spend limit (~$15) + e-mailové notifikace, zvážit auto-reload s malým prahem; v kódu `MAX_WEB_SEARCHES` už je 3 (ověřeno dříve); experiment: denní kontrolu zkusit na Haiku, Sonnet jen pro mimořádné a měsíční místa (týden měření kvality úlovků před rozhodnutím).
- **Email zpracování návrhů** (~2–3 h, rozsah zatím nejasný): `info@kulturniradar.cz` už přesměrovává na Gmail (Cloudflare Email Routing, hotovo 8. 8.) — další krok je zpracování takových mailů (ruční nebo AI) na návrh nové akce do systému; potřebuje nejdřív ujasnit konkrétní koncept, než se odhad zpřísní.
- **Cesta B zrychlení přihlášení** (~1–2 h, volitelné, vyšší riziko): omezit `apiEvents` čtení jen na relevantní profil místo plných čtení celých listů (AKCE/OZNAČENÍ/SOUŘADNICE/POČASÍ) — alternativa/doplněk k už hotové cache (v3.23); vyšší riziko regrese ve filtrovací logice než cache řešení.
- **Redesign UI** (odhad neurčen, závisí na rozsahu) — záložní plán z 9. 8. 2026 pro případ, že dcera nebude mít čas na navržený "designový večer": větší redesign layoutu/struktury appky, posun od současné "divadelní" identity (červená jako opona, pergamenová barva kategorií) k neutrálnějšímu/modernějšímu vzhledu. Cílovka pro rozšíření appky mimo rodinu: přátelé 30–50 let, intelektuální profese, SŠ/VŠ vzdělání. Plánováno na některou z příštích sessions (~10.–11. 8. 2026) — Claude připraví konkrétní návrhy k probrání společně.

## Plán rozvoje — schváleno 4. 8. 2026, aktualizováno 8. 8. 2026
1. ~~**Rodinné profily**~~ — **HOTOVO 7.–8. 8. 2026** (backend v3.20, frontend
   v3.13), viz CHANGELOG.md. Realizováno s PINem (ne bez hesla, jak původně
   plánováno) a s podporou osobních vyhledávacích filtrů navíc oproti
   původnímu rozsahu. Realita: 4 rodinné profily + 1 vyhrazený `rf-test`
   pro CI, prostor pro další.
2. ~~**Frontendový večer**~~ — **HOTOVO 8. 8. 2026**: `Index.html` migrován
   na Cloudflare Pages (ne GitHub Pages, jak se plánovalo — jinak beze
   změny záměru), doména kulturniradar.cz aktivní se SSL, Email Routing
   pro info@ ověřeno doručením, RF sada 22/22 na nové doméně. Viz
   CHANGELOG.md.
3. ~~**Sdílení celého výběru/filtrovaného seznamu**~~ — **HOTOVO 8. 8. 2026**
   (frontend v3.20): tlačítko „📤 Sdílet výběr" vedle ★ Oblíbené/✓ Navštívené
   sdílí aktuální město + zvolené kategorie jako deep link
   (`?profil=Město&kategorie=a,b`), odlišný formát od jedno-akcového
   `?akce=ID&profil=Město` (v3.17). Příjemce otevře odkaz a appka je rovnou
   předfiltrovaná. Viz CHANGELOG.md.
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
2. ~~Frontendový večer (doména)~~ — hotovo 8. 8. 2026 (Cloudflare Pages,
   ne GitHub Pages, viz plán výše)
3. ~~Sdílení celého výběru/filtrovaného seznamu~~ — hotovo 8. 8. 2026, viz plán výše.
4. Plnohodnotný multi-tenant systém – dlouhodobý horizont, ne blízký plán

Odhad rozsahu: řádově týdny soustředěné práce, ne jedna session.

## Trvalá pravidla (ne úkoly, ale konvence)
- Při každém „Nová verze" v Apps Scriptu vyplnit pole Popis podle aktuální `VERZE`.
- Formalizováno jako Claude skill kulturni-radar-workflow (4. 8. 2026) — viz Docs/kulturni-radar-workflow/.
