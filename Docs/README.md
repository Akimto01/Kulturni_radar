# Dokumentace – Kulturní radar

Mapa dokumentace: co kde je a k čemu slouží. Pro rychlou orientaci
hodnotitele je určená tabulka „Pro hodnotitele“ v [hlavním README](../README.md).

Každý fakt má v dokumentaci jedno místo, ostatní dokumenty na něj odkazují.
Počty testů jsou jen v hlavním README (tabulka „Testy v číslech“).

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

## Kvalita a defekty

| Dokument | K čemu |
|---|---|
| [kvalita/DEFEKTY.md](kvalita/DEFEKTY.md) | správa defektů: stupnice závažnosti a priority, životní cyklus, analýza úniků |
| [kvalita/PRIBEHY-CHYB.md](kvalita/PRIBEHY-CHYB.md) | tři případové studie chyb od příznaku po pojistku |

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
| [kulturni-radar-workflow/SKILL.md](kulturni-radar-workflow/SKILL.md) | pracovní postupy pro Claude Code (nasazení, testy, dokumentace); zdroj pravdy, nainstalovaná kopie je v `.claude/skills/` |
