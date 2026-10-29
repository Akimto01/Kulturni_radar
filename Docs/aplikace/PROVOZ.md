# Provozní příručka (runbook)

## Script Properties (Apps Script → Nastavení projektu)

| Vlastnost           | Povinná | Význam |
|---------------------|---------|--------|
| `ANTHROPIC_API_KEY` | ano     | klíč k Anthropic API (`sk-ant-…`) |
| `NTFY_TOPIC`        | ne      | název kanálu ntfy (funguje jako heslo — kdo ho zná, čte i píše) |
| `NOTIFY_EMAIL`      | ne      | adresa pro e-mailové notifikace |

Bez `NTFY_TOPIC`/`NOTIFY_EMAIL` běhy jen zapisují do tabulky.

### Dvě témata ntfy (od 29. 10. 2026)

Název tématu funguje jako heslo, proto jsou témata jen v Script Properties a v GitHub Secrets, nikdy v repu ani v logu.

| Název | Kde | K čemu |
|-------|-----|--------|
| `NTFY_TOPIC` | Script Property appky a GitHub Secret | kanál appky (přehledy akcí, osobní notifikace); RF test „Notifikační kanál ntfy je živý“ čte tento kanál a čeká v něm zprávy appky |
| `NTFY_TOPIC_DEV` | jen GitHub Secret | jen vývojové zprávy z GitHub Actions (`kontrola-projektu.yml`, upozornění na selhání v `rf-tests.yml`); dokud neexistuje, workflow použijí `NTFY_TOPIC` |

## Triggery (vytváří `setupTriggers()` — spustit po každé změně jejich sestavy)

| Funkce | Kdy | Co dělá | Jak poznat selhání |
|---|---|---|---|
| `onEditInstallable` | při úpravě tabulky | reaguje jen na zaškrtnutí KRITÉRIA!B11, pak spustí mimořádnou kontrolu | notifikace „Mimořádná kontrola selhala“; checkbox B11 zůstane zaškrtnutý |
| `dailyCheck` | denně ~8:00 (okno 8–9) | označí proběhlé akce, zpracuje frontu EMAIL_TIPY, provede denní kontrolu a doplní chybějící souřadnice | notifikace „Denní kontrola selhala“; chybí-li dnešní záznam v KONTROLÁCH, ohlásí to `watchdogDailyCheck` ve 20:00 |
| `sendUserNotifications` | denně ~9:00 (po `dailyCheck`) | pošle uživatelům osobní přehled akcí podle jejich nastavení notifikací (ntfy, e-mail) a zapíše čas posledního odeslání | funkce nemá vlastní notifikaci o selhání, chybu ukáže jen Spuštění v Apps Scriptu; u uživatelů, kterým se neposlalo, log „Notifikace <jméno>: přeskočeno – <důvod>“; suchý běh z menu |
| `weeklyDigest` | pondělí ~7:00 | přehled akcí na 7 dní | notifikace „Týdenní přehled selhal“ |
| `weekendDigest` | čtvrtek ~16:00 | tipy na pátek až neděli, volitelně i na adresu `NOTIFY_EMAIL_VIKEND` | notifikace „Víkendové tipy selhaly“ |
| `updateMista` | 1. den v měsíci ~6:00 | obnova stálých míst a otevíracích dob přes Anthropic API, zapíše řádek „aktualizace stálých míst“ do KONTROL | notifikace „Aktualizace stálých míst selhala“; úspěch hlásí „Stálá místa aktualizována“ |
| `runSelfTest` | neděle ~18:00 | samotest: listy, KRITÉRIA, Script Properties, přítomnost triggerů (`onEditInstallable`, `dailyCheck`, `weeklyDigest`, `weekendDigest`, `updateMista`, `runSelfTest`, `watchdogDailyCheck`), PŘEHLED, počasí, audit dat, OZNAČENÍ a týdenní report kvality hledání | výsledek vždy přijde jako notifikace „Samotest: OK“ nebo „Samotest: N problémů“; nepřijde-li, samotest neproběhl. Přítomnost triggerů `sendUserNotifications` a `zpracovatSledovanaMesta` nekontroluje |
| `watchdogDailyCheck` | denně ~20:00 | ohlásí, pokud v KONTROLÁCH chybí dnešní záznam denní kontroly | notifikace „Watchdog: denní kontrola dnes neproběhla“; sám při chybě jen zapíše do logu („Watchdog selhal“), bez notifikace |
| `zpracovatSledovanaMesta` | neděle ~20:00 a čtvrtek ~10:00 | tiché doplnění dat sledovaných měst (nejstarší kontrola první, časový rozpočet 4,5 min, město už dnes zpracované se přeskočí), pak přepočet POČASÍ u budoucích akcí; bez notifikace | jen v logu: „Sledované město „X“ selhalo“ a „hotovo, zpracováno N z M měst“; stav v KONTROLÁCH (typ „sledované město“) |
| RF testy v GitHub Actions (`rf-tests.yml`) | neděle 20:20 UTC (cron `20 20 * * 0`), tedy 21:20 SEČ, v létě 22:20 SELČ | API a frontend testy proti produkci | červený běh a při plánovaném běhu notifikace ntfy; GitHub e-maily o selhání plánovaných běhů neposílá |

**Čas v GitHub Actions je v UTC a nepřechází na letní čas.** Triggery Apps Scriptu běží v místním čase projektu, takže po změně času (březen, říjen) se jejich souběh s RF během posune o hodinu. Kontrolovat zejména nedělní `zpracovatSledovanaMesta` (okno 20–21 místního času): RF běh má startovat až po něm.

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
