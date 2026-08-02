# Strategie testování

Systém má vzácně čistou hranici mezi deterministickou logikou (parsování,
deduplikace, formátování — čistý JS) a nedeterministickým okolím (obsah LLM,
počasí, doručení notifikací). Testovací strategie ji kopíruje ve 4 vrstvách.

## Vrstva 1 — Jednotkové regresní testy (Node.js, CI) ✅ hotovo

**Kde:** `tests/` + `.github/workflows/tests.yml` — běží při každém pushi,
lokálně `node --test` z kořene repa.

**Jak:** `tests/harness.js` načte `kulturni_radar.gs` do Node VM sandboxu se
stubovanými Google API (Utilities, MailApp, PropertiesService…). Služby,
které jednotkový test nemá potřebovat (UrlFetchApp, ScriptApp), vyhazují
výjimku — únik do sítě test shodí nahlas. Pozor na cross-realm `instanceof`
(Date se v testech tvoří přes `r.__Date`).

**Co pokrývá (18 testů):** každý produkční bug z nočního ladění má svůj
regresní test s reálnou fixture — useknutý JSON, komentář místo pole,
restartované pole, konce řádků v řetězcích (parseEvents_); fuzzy deduplikace
na skutečných dvojicích (Hradozámecká noc, Festival planet, ŠTETL FEST);
datumové klíče; WMO kódy počasí; zkracování pro ntfy (plný e-mail vs.
zkrácený push) a kategorizované seskupení notifikací.

**Pravidlo:** nový bug = nejdřív fixture + červený test, pak oprava.

## Vrstva 2 — Samotest prostředí (Apps Script, týdně) 🔜 návrh v2.9

Funkce `runSelfTest()` (menu + nedělní trigger) kontrolující invarianty,
které jednotkové testy nevidí: existence listů a hlaviček, čitelnost
KRITÉRIÍ, přítomnost všech 5 triggerů, vyplněné Script Properties,
PŘEHLED!E4:E7 bez chybových hodnot, `weatherFor_('Brno', zítřek)` vrací
neprázdno, LOKALITY řádek aktivního profilu. Výsledek jednou souhrnnou
notifikací „Samotest: OK / N problémů“.

## Vrstva 3 — Kontinuální E2E + watchdog 🔜 návrh v2.9

Denní kontrola v 8:00 **je** každodenní E2E test s reálným AI — chybí jen
hlídač jejího výsledku. Watchdog (trigger ~20:00): existuje dnešní řádek
„denní kontrola“ v KONTROLÁCH? Neselhal? Sedí invarianty (0 ≤ nalezeno ≤ 15,
přírůstek řádků AKCE == Nové)? Pokud ne → poplašná notifikace. Obsahové
asserty na výstup LLM záměrně žádné — kontrolují se invarianty chování,
ne konkrétní akce.

## Vrstva 4 — Datová hygiena (týdně) 🔜 návrh v2.9

Suchý běh detekce duplicit (0 očekáváno) + detektor vycpávkových názvů
(„letní akce města“, „víkendový program“…) + počet akcí bez URL/kategorie.
Report jen při nálezu.

## Co záměrně netestujeme automaticky

Kvalitu a úplnost obsahu od LLM (našel „správné“ akce?) — nedeterministické,
bez věrohodného orákula. Hlídá se lidsky: občasný pohled na notifikaci
+ měsíční minutový spot-check VÝBĚRU proti webu jednoho pořadatele.

## Roadmap

| Krok | Obsah | Stav |
|---|---|---|
| 1 | Vrstva 1 v CI | ✅ |
| 2 | v2.9: runSelfTest + watchdog + hygiena | 🔜 |
| 3 | (volitelně) clasp: verzování .gs přímo z repa | nápad |

## Backlog testů

- [ ] **`cellText_` jednotkové testy** (v3.3): tři reprezentace datumu z buněk
  — Date objekt, string „d. M. yyyy", sériové číslo (46156 → 14. 5. 2026);
  čas jako datum r. 1899 → „H:mm". Vzniklo při ladění frontendu 2. 8. 2026.
- [ ] **API kontrakt testy** (RF RequestsLibrary): `apiMeta/apiEvents/apiPlaces`
  přes google.script.run nelze volat zvenčí — testovat přes doGet JSON endpointy
  (`?api=...`), případně wrapper funkce v Node harnessu se stub Spreadsheetem.
- [ ] **RF + Browser Library E2E** na frontend (karty, filtry, FAB) — až se
  ustálí vzhled; ntfy polling assert na notifikaci po Spustit kontrolu.
