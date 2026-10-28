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
| Jednotkové testy backendu (logika Apps Scriptu přes vlastní harness, bez Googlu) | `node:test` | 349 | každý push (CI) |
| Jednotkové testy frontendu (čisté funkce z `Index.html`) | `node:test` | 209 | každý push (CI) |
| Kontrola syntaxe a klíčových slov RF sady (dry run) | Robot Framework | 61 | každý push (CI) |
| E2E testy proti produkci: frontend + API kontrakt | Robot Framework + Browser Library (Playwright), RequestsLibrary | 52 + 9 | týdně (CI) a smoke po každém nasazení |
| Testy e-mailového Workeru | `node:test` | 7 | push nebo PR se změnou `cloudflare-worker/**` (CI) |
| Cvičné API testy produkčního API | SoapUI, Bruno, JMeter | 8 + 8 + zátěžový scénář | ručně, viz [api-tests/](api-tests/README.md) |

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

## Struktura repozitáře

| Cesta | Obsah |
|---|---|
| `apps-script/` | backend (`kulturni_radar.gs`) a frontend (`Index.html`, jeden soubor pro oba nasazovací kanály) |
| `tests/` | Node testy a harness pro Apps Script, `tests/robot/` E2E a API testy v Robot Frameworku |
| `cloudflare-worker/` | Worker pro e-mailové tipy a jeho testy |
| `api-tests/` | cvičné API testy (SoapUI, Bruno, JMeter) |
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
