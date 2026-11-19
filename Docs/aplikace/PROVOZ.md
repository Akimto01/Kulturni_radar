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
| `NTFY_TOPIC_DEV` | jen GitHub Secret | jen vývojové zprávy z GitHub Actions (`kontrola-projektu.yml`, upozornění na selhání v `rf-tests.yml` a `mutacni-testy.yml`); dokud neexistuje, workflow použijí `NTFY_TOPIC` |

## Triggery (vytváří `setupTriggers()` — spustit po každé změně jejich sestavy)

| Funkce | Kdy | Co dělá | Jak poznat selhání |
|---|---|---|---|
| `onEditInstallable` | při úpravě tabulky | reaguje jen na zaškrtnutí KRITÉRIA!B11, pak spustí mimořádnou kontrolu | notifikace „Mimořádná kontrola selhala“; checkbox B11 zůstane zaškrtnutý |
| `dailyCheck` | denně ~8:00 (okno 8–9) | označí proběhlé akce, zpracuje frontu EMAIL_TIPY, provede denní kontrolu a doplní chybějící souřadnice | notifikace „Denní kontrola selhala“; chybí-li dnešní záznam v KONTROLÁCH, ohlásí to `watchdogDailyCheck` ve 20:00 |
| `sendUserNotifications` | denně ~9:00 (po `dailyCheck`) | pošle uživatelům osobní přehled akcí podle jejich nastavení notifikací (ntfy, e-mail) a zapíše čas posledního odeslání | při chybě pošle notifikaci „Notifikace uživatelům selhaly“ a výjimku propustí (od v3.52, #48), takže ji ukáže i Spuštění v Apps Scriptu; u uživatelů, kterým se neposlalo, log „Notifikace <jméno>: přeskočeno – <důvod>“; suchý běh z menu |
| `weeklyDigest` | pondělí ~7:00 | přehled akcí na 7 dní | notifikace „Týdenní přehled selhal“ |
| `weekendDigest` | čtvrtek ~16:00 | tipy na pátek až neděli, volitelně i na adresu `NOTIFY_EMAIL_VIKEND` | notifikace „Víkendové tipy selhaly“ |
| `updateMista` | 1. den v měsíci ~6:00 | obnova stálých míst a otevíracích dob přes Anthropic API, zapíše řádek „aktualizace stálých míst“ do KONTROL | notifikace „Aktualizace stálých míst selhala“; úspěch hlásí „Stálá místa aktualizována“ |
| `runSelfTest` | neděle ~18:00 | samotest: listy, KRITÉRIA, Script Properties, přítomnost všech triggerů ze `setupTriggers` (konstanta `POTREBNE_TRIGGERY`: `onEditInstallable`, `dailyCheck`, `sendUserNotifications`, `weeklyDigest`, `weekendDigest`, `updateMista`, `runSelfTest`, `watchdogDailyCheck`, `zpracovatSledovanaMesta`, od v3.59 i `prepocitatPocasi`; od v3.52, #48), PŘEHLED, počasí, audit dat, OZNAČENÍ a týdenní report kvality hledání | výsledek vždy přijde jako notifikace „Samotest: OK“ nebo „Samotest: N problémů“; nepřijde-li, samotest neproběhl. Přítomnost triggerů `sendUserNotifications` a `zpracovatSledovanaMesta` nekontroluje |
| `watchdogDailyCheck` | denně ~20:00 | ohlásí, pokud v KONTROLÁCH chybí dnešní záznam denní kontroly | notifikace „Watchdog: denní kontrola dnes neproběhla“; sám při chybě jen zapíše do logu („Watchdog selhal“), bez notifikace |
| `zpracovatSledovanaMesta` | neděle ~20:00 a čtvrtek ~10:00 | tiché doplnění dat sledovaných měst (nejstarší kontrola první, rozpočet 330 s podle délky města od v3.51, město už dnes zpracované se přeskočí); bez notifikace. Počasí od v3.59 nepočítá (#81) | jen v logu: „Sledované město „X“ selhalo“ a „hotovo, zpracováno N z M měst“; stav v KONTROLÁCH (typ „sledované město“, při zastavení rozpočtem „sledovaná města přerušena“); od v3.61 tvrdé ukončení limitem 6 min ohlásí až další běh řádkem „běh ukončen limitem“ a notifikací „Běh nedoběhl: sledovaná města“ (značka `BEH_SLEDOVANA_MESTA` ve Script Properties) |
| `prepocitatPocasi` | neděle ~22:00 a čtvrtek ~11:00 (od v3.59, #81) | přepočet POČASÍ u budoucích akcí, i těch, které sledovaná města právě přidala; sdílí zámek se sledovanými městy (čeká až 30 s) | řádek „aktualizace počasí“ v KONTROLÁCH; při obsazeném zámku jen log „prepocitatPocasi: jiný běh právě probíhá“, počasí přepočítá příští trigger; od v3.61 tvrdé ukončení ohlásí další běh („běh ukončen limitem“, notifikace „Běh nedoběhl: přepočet počasí“, značka `BEH_POCASI`) |
| RF testy v GitHub Actions (`rf-tests.yml`) | neděle 20:20 UTC (cron `20 20 * * 0`), tedy 21:20 SEČ, v létě 22:20 SELČ | API a frontend testy proti produkci | červený běh a při plánovaném běhu notifikace ntfy; GitHub e-maily o selhání plánovaných běhů neposílá |
| Kontrola projektu (`kontrola-projektu.yml`) | denně 6:40 UTC (cron `40 6 * * *`), tedy 7:40 SEČ, 8:40 SELČ; v pondělí týdenní souhrn | čte board, defekty a návrh práce, v pondělí přepíše přehled v issue #52 | notifikace ntfy jen při nálezu (v pondělí vždy); při selhání samotné kontroly (typicky vypršelý `BOARD_READ_TOKEN`) upozornění ntfy |
| Mutační testy (`mutacni-testy.yml`) | sobota 3:40 UTC (cron `40 3 * * 6`), tedy 4:40 SEČ, 5:40 SELČ; kritická sada navíc při změně backendu nebo jeho testů | celý backend bez prahu (~41 min); kritická sada s prahem 95 % | červený běh a u plánovaného běhu notifikace ntfy |

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

### E-mailové adresy (Cloudflare Email Routing)

Konfigurace žije **jen v dashboardu Cloudflare** (doména kulturniradar.cz → Email Routing), v repu žádná není.

- **`info@kulturniradar.cz`** → Worker `kulturni-radar-email-webhook` (`cloudflare-worker/`):
  přeposlání na osobní Gmail a zároveň zápis do fronty `EMAIL_TIPY`.
- **`podpora@kulturniradar.cz`** → přímé přeposlání na osobní Gmail, bez Workeru (založeno
  16. 11. 2026). Je to veřejný e-mail profilu vývojáře v Google Play; do `EMAIL_TIPY` nechodí.

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

## Cloudflare Pages (kulturniradar.cz)

Frontend na `kulturniradar.cz` nasazuje Cloudflare Pages po každém `git push`.
Konfigurace žije **jen v dashboardu Cloudflare** (projekt Pages → Settings → Builds),
v repu žádná není (`_redirects`, `_headers` ani `wrangler.toml` pro Pages). Stav k 16. 11. 2026:

- **Build command:**
  `mkdir -p dist && cp apps-script/Index.html dist/index.html && cp apps-script/robots.txt dist/robots.txt && cp apps-script/sitemap.xml dist/sitemap.xml && cp apps-script/favicon.svg dist/favicon.svg && cp apps-script/pwa/* dist/`
- **Build output directory:** `dist`

Na web se tedy dostanou jen vyjmenované soubory a obsah `apps-script/pwa/`; ostatní soubory
z `apps-script/` (kód backendu, `appsscript.json`) se záměrně nezveřejňují a jejich cesty
vrátí stránku appky (SPA fallback). **Nový statický soubor pro web** patří do
`apps-script/pwa/` (zkopíruje se sám), jinak je nutné ho přidat do build příkazu v dashboardu.
Po pushi ověřit `curl -sI https://kulturniradar.cz/<soubor>`: správný content-type, ne `text/html`.
Soubory v `apps-script/pwa/` clasp do Apps Scriptu nenahrává (nejsou to typy, které Apps Script zná).

## Pilot Claude Code GitHub Action

Workflow `.github/workflows/claude-pilot.yml` (od 18. 11. 2026, issue #82). Spouští se jen ručně: Actions, „Claude pilot (implementace issue)“, Run workflow, číslo issue. Ruční spuštění vyžaduje právo zápisu do repa a workflow navíc odmítne issue, které nezaložil správce repa; komentáře issue nečte. Nic nenasazuje (žádný clasp), merge a nasazení zůstávají ručně.

Dva joby kvůli tokenům. Akce si bere GitHub token ze vstupu `github_token` nebo z `github.token` a ten má Claude k dispozici; skutečnou ochranou jsou proto oprávnění jobu, ne prompt. Job **claude** má jen `contents: read` a `issues: read` a nemá `id-token: write`, takže si akce nevymění token aplikace Claude: Claude upraví soubory, spustí Node testy, workflow testy spustí znovu a změny uloží jako artefakt (diff a shrnutí). Job **pr** jako jediný smí zapisovat a nespouští žádný kód z repa: aplikuje diff, založí větev `claude/issue-N-<běh>`, commit a **draft PR** a do issue napíše odkaz (když Claude nic nezměnil, napíše jen jeho shrnutí). Limity: 30 min na job s Claudem, `--max-turns 40`, úzké `--allowedTools`, jeden běh najednou. Od úpravy po 1. běhu (#82) job **claude** po Claudovi spustí stejné kontroly jako `node-tests.yml` (dry run RF, architektura testů, počty, dokumentace, lint s baseline); spadne-li některá, PR nevznikne. Nové soubory v repu se vypíší do shrnutí v PR a prompt Claudovi ukládá výstupy nástrojů jen do `RUNNER_TEMP`.

Jednorázové nastavení (dělá Vojta): (1) secret `CLAUDE_CODE_OAUTH_TOKEN` v Settings → Secrets and variables → Actions, vygenerovaný příkazem `claude setup-token` (čerpá z předplatného, ne z API klíče appky, který je ve Script Properties s měsíčním limitem); místo něj jde použít samostatný API klíč jako `ANTHROPIC_API_KEY` a ve workflow vstup `anthropic_api_key`; (2) v Settings → Actions → General → Workflow permissions povolit „Allow GitHub Actions to create and approve pull requests“, jinak job pr selže. Aplikace Claude pro GitHub potřeba není. PR založený tokenem workflow nespouští CI automaticky (pravidlo GitHubu), CI na PR jde pustit ručně.

## Diagnostika

1. **Spuštění** (Apps Script) — stav, délka, po rozkliknutí Logger výstup.
2. **KONTROLY** — auditní řádek každého běhu (typ, počty, vykonavatel).
3. **Test notifikací** z menu — ověří doručovací cestu bez API běhu.

## Bezpečnost

- API klíč a topic jen ve Script Properties — nikdy do kódu ani do repa.
- Kanál ntfy je veřejný pro znalce názvu → držet název v tajnosti,
  případně jednou za čas obměnit (properties + odběry v telefonech).
