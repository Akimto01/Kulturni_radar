# Kulturní radar

[![Node testy](https://github.com/Akimto01/Kulturni_radar/actions/workflows/node-tests.yml/badge.svg)](https://github.com/Akimto01/Kulturni_radar/actions/workflows/node-tests.yml)
[![RF testy](https://github.com/Akimto01/Kulturni_radar/actions/workflows/rf-tests.yml/badge.svg)](https://github.com/Akimto01/Kulturni_radar/actions/workflows/rf-tests.yml)
[![Cloudflare Worker testy](https://github.com/Akimto01/Kulturni_radar/actions/workflows/cloudflare-worker-tests.yml/badge.svg)](https://github.com/Akimto01/Kulturni_radar/actions/workflows/cloudflare-worker-tests.yml)

Rodinná appka, která pomocí AI s webovým vyhledáváním hlídá kulturní akce
v Brně a dalších městech ČR. Běží na **[kulturniradar.cz](https://kulturniradar.cz)**.
Zároveň slouží jako ukázka mé práce testera automatizace: strategie, testy
na více úrovních, CI a řízený proces od nalezení chyby po její ověření v produkci.

*In short (EN): a family app that uses an AI agent with web search to track
cultural events in Czech cities. It doubles as my test automation portfolio:
test strategy, multi-level test suites, CI and a traceable bug-to-fix process.
Documentation is in Czech.*

## Pro hodnotitele: kde co najít

| Co | Kde |
|---|---|
| Plán, průběh a hotová práce (Kanban, přehled podle cílů, časový plán) | [GitHub Projects board](https://github.com/users/Akimto01/projects/1) |
| Poslední výsledky E2E testů (report a log Robot Frameworku) | [GitHub Pages](https://akimto01.github.io/Kulturni_radar/) |
| Testovací plán a strategie (rizika, úrovně, kritéria, mezery) | [Docs/testovani/TESTY.md](Docs/testovani/TESTY.md) |
| Architektura automatizace testů (strategie, framework, CI/CD, reporting) | [Docs/testovani/ARCHITEKTURA-TESTU.md](Docs/testovani/ARCHITEKTURA-TESTU.md) |
| Matice pokrytí (co je pokryté, na jaké úrovni a co ne) | [Docs/testovani/POKRYTI.md](Docs/testovani/POKRYTI.md) |
| Testovací analýza: od testovací báze k testovacím případům | [Docs/testovani/TESTOVACI-ANALYZA.md](Docs/testovani/TESTOVACI-ANALYZA.md) |
| Rozbor tří testů: jak navrhuji testy | [Docs/archiv/quality-check-2026-10/UKAZKY-TESTU.md](Docs/archiv/quality-check-2026-10/UKAZKY-TESTU.md) |
| Příběhy chyb: od příznaku přes diagnózu k pojistce | [Docs/kvalita/PRIBEHY-CHYB.md](Docs/kvalita/PRIBEHY-CHYB.md) |
| Správa defektů: stupnice závažnosti a priority, životní cyklus, analýza úniků | [Docs/kvalita/DEFEKTY.md](Docs/kvalita/DEFEKTY.md) |
| Historie změn včetně diagnózy každé chyby | [Docs/CHANGELOG.md](Docs/CHANGELOG.md) |
| Cíle projektu a doporučené pořadí práce | [Docs/BACKLOG.md](Docs/BACKLOG.md) |

## Testy v číslech

| Úroveň | Nástroj | Počet | Kdy běží |
|---|---|---|---|
| Jednotkové testy backendu (logika Apps Scriptu přes vlastní harness, bez Googlu) | `node:test` | 447 | každý push (CI) |
| Jednotkové testy frontendu (čisté funkce z `Index.html`) | `node:test` | 209 | každý push (CI) |
| Kontrola syntaxe a klíčových slov RF sady (dry run) | Robot Framework | 61 | každý push (CI) |
| E2E testy proti produkci: frontend + API kontrakt | Robot Framework + Browser Library (Playwright), RequestsLibrary | 52 + 9 | týdně (CI) a smoke po každém nasazení |
| Testy e-mailového Workeru | `node:test` | 7 | push nebo PR se změnou `cloudflare-worker/**` (CI) |
| Cvičné API testy produkčního API | SoapUI, Bruno, JMeter | 8 + 8 + zátěžový scénář | ručně, viz [api-tests/](api-tests/README.md) |

Počty v této tabulce hlídá CI (skript `.github/scripts/kontrola-poctu-testu.py` v jobu `rf-dryrun`): při rozdílu proti repu workflow selže.

Pokrytí řádků backendu jednotkovými testy: 92,0 % (k 29. 10. 2026, měří a vypisuje CI v jobu `node-testy`). Pokrytí frontendu (`node tests/pokryti-frontendu.js`, k 29. 10. 2026): 98,9 % řádků ve vykrojených funkcích (57 ze 113), 25,3 % celého skriptu `Index.html`, protože zbytek pokrývají jen E2E testy.

## Jak pracuji

- **Každá oprava má diagnózu, test a živé ověření.** Nejdřív příčina (ne příznak),
  pak test, který chybu zachytí (často ověřený mutací: vrátím opravu a test musí
  spadnout), nasazení a ověření v produkci. Všechno zapsané v CHANGELOGu.
- **Nalezené chyby se dokumentují jako issues** s odkazem na commit, přiřazené
  k cílům projektu (milníky) na boardu.
- **Testy se zlepšují podle toho, co jim uniklo.** Například chyba s dvojitým
  kódováním profilu unikala testům od srpna, protože E2E testy jely jen
  s Brnem (bez diakritiky). Teď ji hlídá samostatný regresní test.

### Vybrané nalezené chyby

| Chyba | Jak se našla | Issue |
|---|---|---|
| Města s diakritikou (Plzeň, Zlín) ukazovala 0 akcí kvůli dvojitému URL kódování | ruční ověření v prohlížeči při jiné změně | [#31](https://github.com/Akimto01/Kulturni_radar/issues/31) |
| Pozdní odpověď serveru pro dříve vybrané město přepsala aktuální data | nestabilní E2E test, potvrzeno fault injection | [#26](https://github.com/Akimto01/Kulturni_radar/issues/26) |
| Hláška prázdného stavu ukazovala čas kontroly jiného města | přepracovaný E2E test, který čeká na skutečný obsah | [#27](https://github.com/Akimto01/Kulturni_radar/issues/27) |
| Levnější AI model přestal nacházet akce; srpnové vyhodnocení sledovalo špatnou metriku | analýza logu běhů | [#22](https://github.com/Akimto01/Kulturni_radar/issues/22) |

## Co appka umí

- **Hledání akcí pomocí AI** (Claude s webovým vyhledáváním): denní kontrola
  pro domovské město, dvakrát týdně pro další sledovaná města, mimořádná kontrola na povel.
- **Web** [kulturniradar.cz](https://kulturniradar.cz): seznam akcí podle dnů,
  kalendář, mapa, filtry podle kategorií, stálá místa (zoo, hrady, muzea…),
  mini předpověď počasí, sdílení výběru.
- **Uživatelské profily** s PINem (limit pokusů): oblíbené a navštívené akce,
  osobní filtry a notifikace.
- **Přehledy a notifikace**: týdenní přehled a víkendové tipy e-mailem
  a na telefon (ntfy).
- **Samokontrola**: týdenní samotest dat (duplicity, chybějící údaje,
  kvalita hledání AI, náklady) a denní hlídač vynechané kontroly. Selhání se
  hlásí stejnými kanály, systém neumí selhat potichu.

## Architektura ve zkratce

```
[kulturniradar.cz]  ──fetch──→  [Apps Script /exec]  ←→  [Google Sheet (data)]
 (Cloudflare Pages,              kulturni_radar.gs         AKCE, MÍSTA, KONTROLY, …
  Index.html)                      │
                                   ├→ [Anthropic API + web search]  hledání akcí
                                   ├→ [Open-Meteo / met.no]         počasí
                                   └→ [Nominatim]                   geokódování
[Cloudflare Worker] ── e-mail s tipem na akci ──→ fronta EMAIL_TIPY
```

Podrobně viz [Docs/aplikace/ARCHITEKTURA-APLIKACE.md](Docs/aplikace/ARCHITEKTURA-APLIKACE.md), provoz a řešení
potíží viz [Docs/aplikace/PROVOZ.md](Docs/aplikace/PROVOZ.md).

## Nástroje a technologie

Soupis toho, co projekt používá. První sloupec obsahuje identifikátor v zpětných apostrofech; skript `.github/scripts/kontrola-nastroju.py` (job `rf-dryrun` v CI) selže, když repo používá nástroj, který tu nemá řádek. Hlídá balíčky z `package.json` a `requirements.txt`, knihovny Robot Frameworku, akce třetích stran ve workflow, knihovny z unpkg, `clasp`, `wrangler` a podsložky `api-tests/`. Verze je uvedená jen tam, kde je v repu pevně daná. Pravidlo: nový nástroj nebo závislost = řádek tady ve stejném commitu.

### Platforma a provoz

| Nástroj | K čemu | Kde v repu | Verze |
|---|---|---|---|
| Google Apps Script (`apps-script`) | backend a API `/exec`: hledání akcí, triggery, notifikace, zápis do tabulky | `apps-script/kulturni_radar.gs`, `apps-script/appsscript.json` | běhové prostředí V8 |
| Google Sheets (`google-sheets`) | databáze (listy AKCE, MÍSTA, KONTROLY a další), přístup přes `SpreadsheetApp` | `apps-script/kulturni_radar.gs` | |
| Služby Apps Scriptu (`apps-script-sluzby`) | `UrlFetchApp` (HTTP volání), `MailApp` (e-maily), `PropertiesService` (tajné hodnoty), `ScriptApp` (triggery), `CacheService`, `LockService` | `apps-script/kulturni_radar.gs` | |
| Cloudflare Pages (`cloudflare-pages`) | hosting frontendu na kulturniradar.cz, nasazuje `git push` | `apps-script/Index.html` (jeden soubor pro oba nasazovací kanály); konfigurace v repu není | |
| Cloudflare Workers (`cloudflare-workers`) | e-mailový Worker: tip na akci přepošle dál a pošle ho jako webhook do appky | `cloudflare-worker/email-webhook.js`, `cloudflare-worker/wrangler.toml` | `compatibility_date` 2024-09-23 |
| `wrangler` | nasazení a vývoj Workeru | `cloudflare-worker/package.json` (devDependencies) | ^4.0.0 |
| `postal-mime` | čtení příchozího e-mailu ve Workeru | `cloudflare-worker/package.json` (dependencies) | ^3.0.0 |
| `clasp` | nasazení backendu do Apps Scriptu (`clasp push`, `clasp deploy -i`) | `.clasp.json` | |

### Externí služby a API

| Nástroj | K čemu | Kde v repu | Verze |
|---|---|---|---|
| Anthropic Claude API (`anthropic-api`) | hledání kulturních akcí s webovým vyhledáváním (`web_search_20250305`) | `apps-script/kulturni_radar.gs` (`ANTHROPIC_MODEL`, `ANTHROPIC_URL`) | model `claude-sonnet-5-5`, API `2023-06-01` |
| Open-Meteo (`open-meteo`) | předpověď počasí a geokódování obcí | `apps-script/kulturni_radar.gs`, `apps-script/Index.html` | |
| MET Norway (`met-no`) | záložní zdroj předpovědi, když Open-Meteo pro den nic nemá | `apps-script/kulturni_radar.gs` | |
| Nominatim (`nominatim`) | geokódování míst akcí (souřadnice pro mapu) | `apps-script/kulturni_radar.gs` | |
| ntfy (`ntfy`) | push notifikace na telefon: zprávy appky i vývojové zprávy z GitHub Actions | `apps-script/kulturni_radar.gs`, `.github/workflows/kontrola-projektu.yml`, `.github/workflows/rf-tests.yml` | |
| Leaflet (`leaflet`) | mapa akcí a míst ve frontendu | `apps-script/Index.html` (načítá se z unpkg) | 1.9.4 |
| OpenStreetMap (`openstreetmap`) | dlaždice mapy pod Leafletem | `apps-script/Index.html` | |
| Odkazy Google (`google-odkazy`) | „Přidat do kalendáře“ a otevření místa v mapách, jen odkazy bez API | `apps-script/Index.html` | |
| Schema.org (`schema-org`) | strukturovaná data Event (JSON-LD) u sdílených akcí | `apps-script/Index.html` | |

### Testování

| Nástroj | K čemu | Kde v repu | Verze |
|---|---|---|---|
| `node:test` | jednotkové testy backendu (přes vlastní harness bez Googlu), frontendu a Workeru | `tests/unit.test.js`, `tests/frontend.test.js`, `tests/harness.js`, `cloudflare-worker/email-webhook.test.mjs` | Node 22 (CI) |
| StrykerJS (`@stryker-mutator/core`, `@stryker-mutator/tap-runner`) | mutační testování backendu: mutuje kopii `kulturni_radar.gs` a ověřuje, že jednotkové testy mutaci zachytí; spouští se ručně (`node tests/mutace/spustit.js --kriticke`), zatím ne v CI, postup v [MUTACNI-TESTOVANI.md](Docs/testovani/MUTACNI-TESTOVANI.md) | `tests/mutace/package.json` (devDependencies), `tests/mutace/stryker.config.json`, `tests/mutace/spustit.js` | 10.0.0 |
| Robot Framework (`robotframework`) | E2E a API testy proti produkci, dry run v každém pushi; standardní knihovny (Collections, OperatingSystem, String) jsou jeho součástí | `tests/robot/` | 7.5 |
| Browser Library (`robotframework-browser`) | E2E testy frontendu v prohlížeči (Playwright, Chromium) | `tests/robot/frontend.robot`, `tests/robot/requirements.txt` | 20.6.0 |
| RequestsLibrary (`robotframework-requests`) | testy kontraktu API | `tests/robot/api.robot`, `tests/robot/requirements.txt` | 0.9.7 |
| SoapUI (`soapui`) | cvičné API testy (8 test cases) | `api-tests/soapui/` | 5.10.0 (z projektového souboru) |
| Bruno (`bruno`) | stejná sada cvičných API testů jako textová kolekce | `api-tests/bruno/` | formát kolekce 1 |
| JMeter (`jmeter`) | cvičný zátěžový scénář (`?api=meta`, `?api=events`) | `api-tests/jmeter/` | 5.6.3 (z projektového souboru) |

### CI a automatizace

| Nástroj | K čemu | Kde v repu | Verze |
|---|---|---|---|
| GitHub Actions (`github-actions`) | Node testy, RF dry run a kontroly, týdenní E2E, testy Workeru, publikace reportu, denní kontrola projektu | `.github/workflows/` | `actions/checkout` v5, `setup-node` v6 (Node 22), `setup-python` v6 (Python 3.12), `upload-artifact` v6, `download-artifact` v8, `upload-pages-artifact` v5, `deploy-pages` v5 |
| GitHub Pages (`github-pages`) | veřejný report E2E testů | `.github/workflows/publikovat-report.yml`, `.github/scripts/generovat-index-reportu.py` | |
| GitHub Projects a Issues (`github-projects`) | board, issues, formulář defektu, automaticky přepisovaný přehled projektu | `.github/ISSUE_TEMPLATE/defekt.yml`, `.github/workflows/kontrola-projektu.yml` | |
| Python skripty (`python`) | kontroly projektu a testů, návrh práce, sestavení notifikací; jen standardní knihovna, kontroly testů navíc `robot.api` | `.github/scripts/` | Python 3.12 (CI) |
| GitHub CLI (`gh`) | čtení boardu a issues, zápis přehledu; předinstalované na runnerech | `.github/scripts/gh_projekt.py`, `.github/workflows/` | |
| `curl` a `jq` | odeslání zpráv do ntfy a zpracování JSON ve workflow | `.github/workflows/` | |

### Vývoj

| Nástroj | K čemu | Kde v repu | Verze |
|---|---|---|---|
| Claude Code (`claude-code`) | vývoj, nasazení přes `clasp`, údržba dokumentace podle projektového skillu | `.claude/skills/kulturni-radar-workflow/SKILL.md` (kopie v `Docs/kulturni-radar-workflow/`) | |
| claude-in-chrome (`claude-in-chrome`) | živé ověření produkce v prohlížeči (diagnostika, měření rozložení) | popsáno v `SKILL.md`, sekce 7 | |

## Struktura repozitáře

| Cesta | Obsah |
|---|---|
| `apps-script/` | backend (`kulturni_radar.gs`) a frontend (`Index.html`, jeden soubor pro oba nasazovací kanály) |
| `tests/` | Node testy a harness pro Apps Script, `tests/robot/` E2E a API testy v Robot Frameworku |
| `cloudflare-worker/` | Worker pro e-mailové tipy a jeho testy |
| `api-tests/` | cvičné API testy (SoapUI, Bruno, JMeter) |
| `AGENTS.md`, `CLAUDE.md` | vstupní pokyny pro AI agenty a nové vývojáře (CLAUDE.md jen odkazuje) |
| `Docs/` | testovací dokumentace, architektura, provoz, CHANGELOG, BACKLOG |
| `.github/workflows/` | CI: Node testy, RF dry run a pojistka souladu testů s architekturou, týdenní E2E, testy Workeru, publikace reportu na GitHub Pages |

## Zprovoznění a provoz

Nasazení backendu přes `clasp`, frontendu přes `git push` (Cloudflare Pages).
Vlastnosti skriptu, triggery a řešení častých situací popisuje
[Docs/aplikace/PROVOZ.md](Docs/aplikace/PROVOZ.md).

**Náklady:** jeden běh hledání na modelu Claude Sonnet 5.5 stojí zhruba
0,12 USD plus poplatky za webová vyhledávání (měřeno 26.–27. 10. 2026).
Přehledy, počasí a geokódování jsou zdarma. Spotřebu každého běhu zapisuje
appka do listu KONTROLY a týdně ji vyhodnocuje samotest.
