# Dokumentace – Kulturní radar

Mapa dokumentace: co kde je a k čemu slouží. Pro rychlou orientaci
hodnotitele je určená tabulka „Pro hodnotitele“ v [hlavním README](../README.md).

Každý fakt má v dokumentaci jedno místo, ostatní dokumenty na něj odkazují.
Počty testů jsou jen v hlavním README (tabulka „Testy v číslech“).

## Podle rolí

Čtenář obvykle přichází s rolí, ne s tématem. Stav oblasti: **máme** (dokument existuje a je aktuální), **základ** (část je pokrytá, ale není to ucelený dokument), **plánováno #N** (zatím nic, odkaz na issue). Stav se přepisuje při zavření příslušného issue.

| Role | Co hledá | Kam jít | Stav |
|---|---|---|---|
| PM | co se dělá, v jakém pořadí a jak to jde | [BACKLOG.md](BACKLOG.md), [CHANGELOG.md](CHANGELOG.md), [GitHub Projects board](https://github.com/users/Akimto01/projects/1), přehled v issue [#52](https://github.com/Akimto01/Kulturni_radar/issues/52) | máme |
| CEO | k čemu appka je a co stojí | [README.md](../README.md) (Co appka umí, Náklady) | základ, plánováno [#57](https://github.com/Akimto01/Kulturni_radar/issues/57) |
| Partner | co appka umí a jak spolehlivá je | [README.md](../README.md), [kulturniradar.cz](https://kulturniradar.cz) | základ, plánováno [#57](https://github.com/Akimto01/Kulturni_radar/issues/57) |
| QA lead | jak se testuje, co je pokryté a co ne | [testovani/TESTY.md](testovani/TESTY.md), [testovani/ARCHITEKTURA-TESTU.md](testovani/ARCHITEKTURA-TESTU.md), [testovani/POKRYTI.md](testovani/POKRYTI.md), [testovani/MUTACNI-TESTOVANI.md](testovani/MUTACNI-TESTOVANI.md) | máme, katalog testů plánováno [#44](https://github.com/Akimto01/Kulturni_radar/issues/44) |
| Hodnotitel | důkaz postupu a práce s chybami | [README.md](../README.md) (Pro hodnotitele), [kvalita/PRIBEHY-CHYB.md](kvalita/PRIBEHY-CHYB.md), [kvalita/DEFEKTY.md](kvalita/DEFEKTY.md), [testovani/TESTOVACI-ANALYZA.md](testovani/TESTOVACI-ANALYZA.md) | máme, případová studie plánováno [#57](https://github.com/Akimto01/Kulturni_radar/issues/57) |
| Vývojář a AI agent | jak je appka postavená a jak se v repu pracuje | [../AGENTS.md](../AGENTS.md), [aplikace/ARCHITEKTURA-APLIKACE.md](aplikace/ARCHITEKTURA-APLIKACE.md), [kulturni-radar-workflow/SKILL.md](kulturni-radar-workflow/SKILL.md) | máme, specifikace API plánováno [#59](https://github.com/Akimto01/Kulturni_radar/issues/59) |
| Bezpečnost | ochrana tajných hodnot, hesel a dat | [aplikace/PROVOZ.md](aplikace/PROVOZ.md) (Bezpečnost), [aplikace/ARCHITEKTURA-APLIKACE.md](aplikace/ARCHITEKTURA-APLIKACE.md) (Uživatelské profily, hash PINu), [kvalita/PRIBEHY-CHYB.md](kvalita/PRIBEHY-CHYB.md) (únik tajných hodnot v reportech), [kvalita/HISTORIE-INCIDENTU.md](kvalita/HISTORIE-INCIDENTU.md) (incident #33) | základ, plánováno [#65](https://github.com/Akimto01/Kulturni_radar/issues/65) |
| Provoz | triggery, nasazení, co dělat při výpadku, co se už stalo | [aplikace/PROVOZ.md](aplikace/PROVOZ.md), [kvalita/HISTORIE-INCIDENTU.md](kvalita/HISTORIE-INCIDENTU.md) | máme, denní smoke plánováno [#54](https://github.com/Akimto01/Kulturni_radar/issues/54) |
| AI specialista | jak appka používá AI, kvalita a náklady | [aplikace/ARCHITEKTURA-APLIKACE.md](aplikace/ARCHITEKTURA-APLIKACE.md) (`callAnthropic_`), [README.md](../README.md) (Samokontrola, Náklady) | základ, plánováno [#64](https://github.com/Akimto01/Kulturni_radar/issues/64) |
| Právník | osobní údaje a licence zdrojů | zatím žádný dokument | plánováno [#66](https://github.com/Akimto01/Kulturni_radar/issues/66) |
| UX | vzhled, přístupnost, uživatelská příručka | [audity/AUDIT-SELEKTORU.md](audity/AUDIT-SELEKTORU.md), [audity/AUDIT-INDEXACE.md](audity/AUDIT-INDEXACE.md), [aplikace/design/](aplikace/design/) | základ, plánováno [#67](https://github.com/Akimto01/Kulturni_radar/issues/67) a [#68](https://github.com/Akimto01/Kulturni_radar/issues/68) |

## Projekt

| Dokument | K čemu |
|---|---|
| [BACKLOG.md](BACKLOG.md) | cíle, doporučené pořadí práce, testovací dluh a nápady |
| [CHANGELOG.md](CHANGELOG.md) | historie změn včetně diagnózy každé chyby |

## Aplikace

| Dokument | K čemu |
|---|---|
| [aplikace/ARCHITEKTURA-APLIKACE.md](aplikace/ARCHITEKTURA-APLIKACE.md) | jak je postavená appka: komponenty, listy tabulky, datové toky, volání AI, notifikace |
| [aplikace/PROVOZ.md](aplikace/PROVOZ.md) | triggery, nasazení a provozní postupy |
| [aplikace/design/](aplikace/design/) | návrhy vzhledu (ikona aplikace) |

## Testování

| Dokument | K čemu |
|---|---|
| [testovani/TESTY.md](testovani/TESTY.md) | testovací plán: **co a proč** se testuje (rizika, úrovně, kritéria, mapování na ISO 29119) |
| [testovani/ARCHITEKTURA-TESTU.md](testovani/ARCHITEKTURA-TESTU.md) | architektura automatizace: **jak** jsou testy postavené a jak běží (strategie, framework, CI/CD, metriky) |
| [testovani/POKRYTI.md](testovani/POKRYTI.md) | matice pokrytí: které riziko a oblast je pokrytá na jaké úrovni a co ne |
| [testovani/TESTOVACI-ANALYZA.md](testovani/TESTOVACI-ANALYZA.md) | ukázka testovací analýzy od testovací báze k testovacím případům |
| [testovani/MUTACNI-TESTOVANI.md](testovani/MUTACNI-TESTOVANI.md) | mutační testování Strykerem: spuštění, zapojení, výklad výsledků a triáž přeživších |
| [testovani/MUTACE-TRIAZ.md](testovani/MUTACE-TRIAZ.md) | triáž 98 přeživších a nepokrytých mutantů kritické sady (podklad k #13) |

## Kvalita a defekty

| Dokument | K čemu |
|---|---|
| [kvalita/DEFEKTY.md](kvalita/DEFEKTY.md) | správa defektů: stupnice závažnosti a priority, životní cyklus, analýza úniků |
| [kvalita/PRIBEHY-CHYB.md](kvalita/PRIBEHY-CHYB.md) | tři případové studie chyb od příznaku po pojistku |
| [kvalita/HISTORIE-INCIDENTU.md](kvalita/HISTORIE-INCIDENTU.md) | tabulka incidentů: co se stalo, dopad, doba, odkaz; každý uzavřený defekt S1 a S2 má řádek |

## Audity

Jednorázové rozbory s plánem nebo katalogem. Ve stavu na začátku každého auditu
je uvedeno, zda je hotový, nebo se podle něj ještě pracuje.

| Dokument | Stav | K čemu |
|---|---|---|
| [audity/AUDIT-SOULADU-TESTU.md](audity/AUDIT-SOULADU-TESTU.md) | aktivní (issue #34) | soulad existujících testů s architekturou testů, plán oprav v dávkách |
| [audity/AUDIT-SELEKTORU.md](audity/AUDIT-SELEKTORU.md) | hotový, slouží jako katalog | stabilní `data-*` atributy v appce pro E2E testy |
| [audity/AUDIT-INDEXACE.md](audity/AUDIT-INDEXACE.md) | hotový | indexace webu pro vyhledávače a AI crawlery |

## Archiv

| Dokument | K čemu |
|---|---|
| [archiv/quality-check-2026-10/](archiv/quality-check-2026-10/) | podklady k internímu quality checku (říjen 2026): rozcestník a rozbor tří testů; odkazy vedou na kód ve stavu z 8. 10. 2026 |

## Nástroje

| Dokument | K čemu |
|---|---|
| [../AGENTS.md](../AGENTS.md) | vstupní bod pro AI agenty a nové vývojáře: účel, struktura repa, hlavní příkazy, pravidla; [../CLAUDE.md](../CLAUDE.md) jen odkazuje na něj a na skill |
| [kulturni-radar-workflow/SKILL.md](kulturni-radar-workflow/SKILL.md) | pracovní postupy pro Claude Code (nasazení, testy, dokumentace); zdroj pravdy, nainstalovaná kopie je v `.claude/skills/` |
