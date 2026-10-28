# Provozní příručka (runbook)

## Script Properties (Apps Script → Nastavení projektu)

| Vlastnost           | Povinná | Význam |
|---------------------|---------|--------|
| `ANTHROPIC_API_KEY` | ano     | klíč k Anthropic API (`sk-ant-…`) |
| `NTFY_TOPIC`        | ne      | název kanálu ntfy (funguje jako heslo — kdo ho zná, čte i píše) |
| `NOTIFY_EMAIL`      | ne      | adresa pro e-mailové notifikace |

Bez `NTFY_TOPIC`/`NOTIFY_EMAIL` běhy jen zapisují do tabulky.

## Triggery (vytváří `setupTriggers()` — spustit po každé změně jejich sestavy)

| Funkce             | Kdy                        | Co dělá |
|--------------------|----------------------------|---------|
| `onEditInstallable`| při úpravě tabulky         | reaguje jen na zaškrtnutí KRITÉRIA!B11 |
| `dailyCheck`       | denně ~8:00 (okno 8–9)     | označí proběhlé + denní kontrola |
| `weeklyDigest`     | pondělí ~7:00              | přehled akcí na 7 dní |
| `weekendDigest`    | čtvrtek ~16:00             | tipy na pátek–neděli |
| `updateMista`      | 1. den v měsíci ~6:00      | obnova stálých míst a otevíracích dob |

Pozn.: Google denní/týdenní triggery rozprostírá do ±hodinového okna — čas
v notifikaci je směrodatný.

## Menu tabulky „Kulturní radar“

Horní lišta (za Nápovědou); položky se objeví pár vteřin po otevření tabulky.
Spustit kontrolu teď · Označit proběhlé akce · Odstranit duplicity ·
Test notifikací · Týdenní přehled teď · Víkendové tipy teď ·
Aktualizovat stálá místa.

## Notifikační kanály

- **ntfy:** publikace e-mailem na `ntfy-<topic>@ntfy.sh` (SMTP brána).
  HTTP API z Apps Scriptu **nefunguje** — sdílené IP Googlu mají trvale
  vyčerpanou kvótu (429); neřešit tokenem (bezplatný účet limity nepřenáší).
  Těla > ~3,5 kB se pro ntfy automaticky zkracují (plná verze v e-mailu).
- **E-mail:** MailApp z účtu vlastníka skriptu; předmět `[Kulturní radar] …`.
- Selhání běhu se hlásí oběma kanály (`… selhala` + text chyby).

## Časté situace

| Příznak | Příčina / řešení |
|---|---|
| Položka menu „chybí“ | menu se načítá líně a staví při otevření dokumentu → F5 tabulky, počkat pár vteřin |
| Spuštění z editoru „nic nedělá“ | druhý klik na Spustit zabíjí první běh; čekání na zámek končí tichým návratem → spouštět JEDNOU, ideálně z menu tabulky |
| Checkbox B11 zůstal zaškrtnutý | poslední běh selhal (schválně se nevypíná) → odškrtnout, příčinu ukáže notifikace/Spuštění |
| Zpráva v ntfy jako `attachment.txt` | jen u verzí < 2.6; od 2.6 se dlouhá těla zkracují |
| Denní kontrola „pozdě“ (8:39) | normální — Google okno 8–9 h |
| `#VALUE!` v PŘEHLEDU | viz CHANGELOG „Oprava mimo skript“; vzorce v E4:E7 už jsou opravené |
| Nový profil města | přidat řádek v LOKALITY + zdroje v ZDROJE, přepnout KRITÉRIA!B2, spustit kontrolu a „Aktualizovat stálá místa“ |

## Přidání nového sledovaného/domácího města
Kromě přidání řádku do LOKALITY a (u sledovaných měst) do listu SLEDOVANÁ MĚSTA
zkontroluj list AKCE, sloupec Y (Profil lokality) – mělo by na něm NEBÝT
pravidlo ověření dat. Objevilo se tam kdysi samo-odkazující pravidlo
(„Hodnota obsahuje jednu z rozsahu Y2:Y1986" – tedy porovnávalo nový zápis
proti tomu, co už ve sloupci JE, ne proti seznamu měst v LOKALITY). To
znamenalo, že úplně NOVÉ jméno města (nikdy dřív do Y nezapsané) appka
nemohla zapsat – narazila na chybu ověření dat (5. 8. 2026, poprvé u Třince).
Oprava: Data → Ověření dat na libovolné buňce sloupce Y → Odstranit vše.
Appka do tohoto sloupce zapisuje výhradně sama a sama si hlídá platnost
jmen měst (podle LOKALITY) – ruční ověřovací pravidlo na Y je tedy zbytečné
a případná budoucí obnova by měla znovu skončit jeho odstraněním, ne opravou rozsahu.

## Diagnostika

1. **Spuštění** (Apps Script) — stav, délka, po rozkliknutí Logger výstup.
2. **KONTROLY** — auditní řádek každého běhu (typ, počty, vykonavatel).
3. **Test notifikací** z menu — ověří doručovací cestu bez API běhu.

## Bezpečnost

- API klíč a topic jen ve Script Properties — nikdy do kódu ani do repa.
- Kanál ntfy je veřejný pro znalce názvu → držet název v tajnosti,
  případně jednou za čas obměnit (properties + odběry v telefonech).
