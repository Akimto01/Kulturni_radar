# api-tests/ — cvičný projekt pro přípravu na pohovor

Tahle složka **není součástí appky** Kulturní radar a nijak neovlivňuje
produkci ani balíčky/nasazení popsané v `Docs/CHANGELOG.md`. Vznikla čistě
jako cvičení na API testovací nástroje (SoapUI/ReadyAPI, Bruno, potažmo
JMeter) pro pracovní pohovor — testuje reálné produkční API appky Kulturní
radar (`doGet`/`doPost` v `apps-script/kulturni_radar.gs`), ale jde o
samostatný, oddělený projekt bez vazby na verzování appky (žádný bump
`VERZE`).

Stav (23. 8. 2026): všechny tři nástroje živě odladěné a spuštěné proti
produkčnímu API — viz sekce „Diagnostika HTTP 405" níže a `Docs/BACKLOG.md`
pro plný zápis diagnózy a výsledků.

Pokrývá stejných 8 testovacích scénářů ve všech nástrojích (SoapUI/ReadyAPI,
Bruno) a navíc jednoduchý zátěžový plán v JMeteru:

1. `GET ?api=meta` — struktura odpovědi (profily, kategorie, verze)
2. `POST akce=login` — správný i špatný PIN
3. `POST akce=toggle` (typ `oblibene`) — platný i neplatný `uzivatelId`
4. `POST akce=email-tip` — platný i chybějící token
5. Negativní test — `POST` úplně bez pole `akce` (očekává `"Neznámá akce."`)

## ⚠️ Tajné hodnoty — nikdy necommitovat

Testy pro `login`, `toggle` a `email-tip` potřebují reálné přihlašovací
údaje / token, které v repu nejsou a neměly by v něm nikdy skončit:

- `testUserId` — ID existujícího uživatelského profilu. Doporučeno
  použít vyhrazený testovací profil, stejný princip jako
  `RF_TEST_USER_ID` v `tests/robot/resources.robot` — ne ostrý rodinný
  profil (test `toggle` zapisuje ★ do listu OZNAČENÍ).
- `testPin` — PIN k tomuto profilu.
- `testEventId` — ID existující akce z listu AKCE (pro `toggle`). V
  SoapUI projektu je předvyplněné reálnou hodnotou
  `2026-07-25-folkove-prazdniny` („Folkové prázdniny 2026", dlouhodobá
  akce 25. 7.–1. 8., ověřeno živě 20. 8. 2026) — není to tajná hodnota,
  jen ID záznamu, takže může zůstat v souboru.
- `emailWebhookToken` — Script Property `EMAIL_WEBHOOK_TOKEN` z Apps
  Scriptu (viz `cloudflare-worker/email-webhook.js`).

**`testPin` a `emailWebhookToken` jsou skutečně citlivé** (PIN k účtu,
sdílený token) — ty se **nikam neukládají jako hodnota v souboru
trackovaném gitem**, viz sekce níže (stejný princip — proměnné prostředí
OS, ne hodnota v souboru — u SoapUI i Bruno). `testUserId` a `testEventId`
citlivé nejsou (jen identifikátory, ne přístupové údaje), takže v SoapUI
zůstávají jako obyčejné Project Properties přímo v XML — v Bruno kolekci
pak jako proměnné v `environments/Produkce.bru`, kam si je doplň lokálně.

## Bruno (`api-tests/bruno/`)

1. Nainstaluj [Bruno](https://www.usebruno.com/) (desktopová appka nebo
   `npm install -g @usebruno/cli`).
2. V Bruno: **Open Collection** → vyber složku `api-tests/bruno/`.
3. Vyber prostředí **Produkce** (pravý horní roh) a doplň proměnné
   `testUserId` a `testEventId` (ikona tužky u prostředí) — nejsou citlivé
   (jen identifikátory), takže se ukládají přímo do `environments/Produkce.bru`.
   `testPin` a `emailWebhookToken` do tohohle souboru **nedávej** — čtou se
   z proměnných prostředí operačního systému, viz sekce „Nastavení citlivých
   hodnot" níže (stejný princip jako u SoapUI).
4. Requesty jsou očíslované ve složkách `01-meta` … `05-negative`, každý
   má v záložce **Tests** asserty (status 200, `ok` true/false, přítomnost
   očekávaných polí).
5. Spuštění celé kolekce: pravý klik na kolekci → **Run** (GUI), nebo
   `bru run --env Produkce` (CLI) ve složce `api-tests/bruno/`. ⚠️ Dokud
   je `testUserId`/`testEventId` v `environments/Produkce.bru` jen
   placeholder `DOPLNIT_RUCNE` (appka ověřuje jen že `uzivatelId` není
   prázdné, ne že profil fakt existuje), spuštění **celé** kolekce by
   `Toggle - platny uzivatel` zapsalo ★ k neexistujícímu uživateli
   `DOPLNIT_RUCNE` do produkčního listu OZNAČENÍ — vyplň nejdřív skutečné
   hodnoty, nebo spouštěj jednotlivé requesty (`bru run "01-meta/GET
   meta.bru" --env Produkce`).
   Živě ověřeno (Bruno CLI 4.0.0, 23. 8. 2026): **5/8 requestů PASS** bez
   žádné úpravy configu (`GET meta`, `Login - spatny PIN`,
   `Toggle - neplatny uzivatel`, oba `Email tip` negativní scénáře i
   negativní test bez `akce`) — Bruno staví na `fetch`, který na 302
   sám degraduje POST→GET, takže na rozdíl od SoapUI zde k HTTP 405
   vůbec nedochází. Zbylé 3 (`Login - spravny PIN`, `Email tip - platny
   token`, `Toggle - platny uzivatel`) vyžadují skutečné `TEST_PIN`/
   `EMAIL_WEBHOOK_TOKEN`/`testUserId` — první dva byly živě vyzkoušeny
   bez nich a selhaly jen na chybějícím assertu `ok je true` (očekávané,
   žádný zápis do produkce neproběhl), `Toggle - platny uzivatel`
   záměrně nespuštěn (viz varování výše).

### Nastavení citlivých hodnot (Bruno, Windows)

Bruno umí v `.bru` souborech číst proměnné prostředí **operačního systému**
přímo v requestu přes `{{process.env.NAZEV}}` — na rozdíl od běžných
`{{promenna}}` z prostředí (`environments/Produkce.bru`) se tahle hodnota
nikdy neuloží do souboru trackovaného gitem. V kolekci to používají dva
requesty: `02-auth/Login - spravny PIN.bru` (`{{process.env.TEST_PIN}}`)
a `04-email-tip/Email tip - platny token.bru`
(`{{process.env.EMAIL_WEBHOOK_TOKEN}}`).

Potřeba nastavit **stejné dvě proměnné jako u SoapUI** — `TEST_PIN` a
`EMAIL_WEBHOOK_TOKEN` — ať si je Vojta nemusí pamatovat dvoje:

**Dočasně, jen pro aktuální PowerShell okno** (zmizí po zavření):
```powershell
$env:TEST_PIN = "skutecny-pin"
$env:EMAIL_WEBHOOK_TOKEN = "skutecny-token"
```
Pak z **téhož** okna spustit Bruno (desktopovou appku spuštěnou odjinud
nastavení neuvidí, viz „Důležité" níže).

**Trvale** (přežije restart): Windows Start → napsat „environment
variables" → **Upravit proměnné prostředí účtu** (nebo `sysdm.cpl` →
záložka Upřesnit → Proměnné prostředí…) → **New…** pod „User variables"
→ název `TEST_PIN` / `EMAIL_WEBHOOK_TOKEN`, hodnota skutečný PIN/token.

⚠️ **Důležité:** stejné omezení jako u SoapUI — Bruno (desktopová appka)
čte proměnné prostředí jen při svém **startu**, takže pokud už běží,
spuštění requestu z téhož okna nepomůže; zavři ji a spusť znovu ze
stejného terminálu, kde je `TEST_PIN`/`EMAIL_WEBHOOK_TOKEN` nastavené
(u Bruno CLI `bru run` stačí spustit z toho samého okna, žádný restart
appky netřeba). Ověření: spusť request s `{{process.env.TEST_PIN}}` —
v odeslaném těle by se měla objevit skutečná hodnota, ne doslovný text.

## SoapUI / ReadyAPI (`api-tests/soapui/`)

1. Otevři SoapUI (nebo ReadyAPI) → **File → Import Project** → vyber
   `api-tests/soapui/Kulturni-radar-soapui-project.xml`.
2. Projekt obsahuje jednoduché REST rozhraní (`Kulturni radar` — GET
   meta + POST akce) a Test Suite **„Kulturni radar API testy"** s 8
   pojmenovanými Test Cases (`01 GET meta` … `08 Negativní test`). `01`
   je klasický REST Test Request s asserty (Valid HTTP Status Codes,
   JsonPath Match/Existence Match); `02`–`08` (všechny POST) jsou Groovy
   Script test kroky — důvod viz sekce „Diagnostika HTTP 405" níže.
3. Doplň Project Property `testUserId` (klik na kořen projektu → záložka
   **Custom Properties**) — requesty na ni odkazují přes
   `${#Project#testUserId}`. `baseUrl` a `testEventId` jsou tam už
   předvyplněné (produkční URL, resp. reálné ID akce `2026-07-25-folkove-prazdniny`).
4. `testPin` a `emailWebhookToken` do Project Properties **nedávej** —
   ty se čtou z proměnných prostředí operačního systému přímo v Groovy
   skriptech kroků `02`/`06` (`System.getenv('TEST_PIN')`, viz sekce
   „Nastavení citlivých hodnot" níže). Ve zbylých dvou Project
   Properties (`testPin`, `emailWebhookToken`) je jen poznámka, že se
   nastavují jinde — jejich hodnota se v requestech nepoužívá.
5. Spuštění: pravý klik na Test Suite → **Run** (GUI), nebo
   `testrunner.bat -s "Kulturni radar API testy" Kulturni-radar-soapui-project.xml`
   (CLI, `testrunner.sh` na Linux/Mac, dostupné jako `SoapUITestCaseRunner`
   v `bin/` složce SoapUI). Živě ověřeno (SoapUI 5.10.0 CLI, 23. 8. 2026):
   **6/8 test cases PASS** (`01`, `03`, `04`, `05`, `07`, `08`); zbylé 2
   (`02`, `06`) selžou jen bez skutečných `TEST_PIN`/`EMAIL_WEBHOOK_TOKEN`
   proměnných — očekávané. Pozor: CLI `-s` spustí **celou** Test Suite
   sekvenčně, nejde vynechat jeden Test Case — pokud `testUserId` v
   Project Properties ukazuje na skutečný profil, `04 Toggle - platny
   uzivatel` při každém běhu skutečně přepne ★ v listu OZNAČENÍ (je to
   toggle, takže druhé spuštění stavu vrátí zpět).

### Diagnostika HTTP 405 (Email tip / POST testy) — vyřešeno 23. 8. 2026

**Příznak:** všechny POST requesty (`02`–`08`) v SoapUI vracely HTTP 405
Method Not Allowed, i když identické tělo poslané ručně (curl) fungovalo.

**Diagnóza (živě ověřeno přes `curl -v`, ne jen teoreticky):** Apps Script
`/exec` endpoint na POST *vždy* odpoví `302 Found` s `Location` na
jednorázovou `https://script.googleusercontent.com/macros/echo?...` URL,
která skutečný JSON obsah doručí — a tahle echo URL přijímá jen `GET`/`HEAD`
(potvrzeno hlavičkou `Allow: HEAD, GET` v její 405 odpovědi). Prohlížeče,
curl (bez `-X`/`--post302`) i Bruno (staví na `fetch`) při 302 metodu
automaticky degradují POST→GET, takže druhý request na echo URL projde.
SoapUI ale interně používá Apache HttpClient `LaxRedirectStrategy`, která
naopak **zachovává původní metodu (POST) přes redirect** — proto POST na
echo URL a 405. Ověřeno i opačně: `curl --post302 -X POST` (vynucené
zachování POST přes redirect) reprodukuje identický 405 s `Allow: HEAD, GET`.

Původní hypotéza „vypnout Follow Redirects v SoapUI" byla **částečně
mylná** — vypnutí by 405 sice odstranilo, ale request by skončil na holém
302 s prázdným tělem, takže by selhaly asserty na status 200 a JSON obsah
(jiný typ selhání, ne oprava). SoapUI navíc nemá UI přepínač na „následuj
redirect, ale sniž metodu na GET" — tohle chování Apache HttpClient
nevystavuje jako nastavitelnou volbu.

**Oprava:** kroky `02`–`08` (`01 GET meta` beze změny — GET přes redirect
funguje bez úprav) přepsány z REST Test Requestu na Groovy Script test
krok, který redirect zpracuje ručně přes `java.net.HttpURLConnection`:
POST s `setInstanceFollowRedirects(false)` → přečti `Location` hlavičku
z 302 odpovědi → samostatný `GET` na tuhle URL → teprve na tomhle druhém
JSON tělu se vyhodnotí `assert` (nahrazují původní `con:assertion` prvky,
zachovávají stejných 26 kontrol jako předtím).

### Nastavení citlivých hodnot (SoapUI, Windows)

Groovy skripty v krocích `02`/`06` čtou proměnné prostředí **operačního
systému** přes `System.getenv('TEST_PIN')`/`System.getenv('EMAIL_WEBHOOK_TOKEN')`
(s fallbackem na `System.getProperty(...)`) — nikdy se neukládají do
SoapUI Project Properties ani do XML souboru. Potřeba nastavit dvě
proměnné: `TEST_PIN` a `EMAIL_WEBHOOK_TOKEN`.

**Dočasně, jen pro aktuální PowerShell okno** (zmizí po zavření):
```powershell
$env:TEST_PIN = "skutecny-pin"
$env:EMAIL_WEBHOOK_TOKEN = "skutecny-token"
```
Pak z **téhož** okna spustit SoapUI (pokud běží jako GUI appka spuštěná
odjinud, tohle nastavení neuvidí).

**Trvale** (přežije restart): Windows Start → napsat „environment
variables" → **Upravit proměnné prostředí účtu** (nebo `sysdm.cpl` →
záložka Upřesnit → Proměnné prostředí…) → **New…** pod „User variables"
→ název `TEST_PIN` / `EMAIL_WEBHOOK_TOKEN`, hodnota skutečný PIN/token.

⚠️ **Důležité:** SoapUI čte proměnné prostředí jen při svém **startu** —
pokud SoapUI už běží, proměnnou nezahlédne, dokud ho nezavřeš a znovu
nespustíš (po nastavení trvalé proměnné navíc často pomůže i restart
Windows relace/přihlášení, ne jen aplikace). Ověření, že to SoapUI vidí:
spusť test case `02 Login - spravny PIN` — pokud selže na `ok neni true`,
buď `TEST_PIN` není v prostředí vidět, nebo `testUserId`/PIN nesedí; log
kroku (`log.info`) vypíše skutečnou JSON odpověď appky pro diagnostiku.

Soubor je zjednodušená, ale validní SoapUI REST Project XML struktura —
formát byl ověřen proti reálným SoapUI projektovým souborům (ne dopsán z
paměti) a XML je prokazatelně dobře formované. Import do skutečného
SoapUI byl živě otestován a potvrzen (20. 8. 2026) — projekt se naimportoval
bez chyby a POST tělo (JSON) se v editoru requestu zobrazilo správně. Celá
Test Suite pak živě spuštěna a ověřena přes CLI `testrunner` (23. 8. 2026,
viz bod 5 výše a sekce „Diagnostika HTTP 405").

### Poznámka k ReadyAPI

[ReadyAPI](https://www.soapui.org/) (komerční nástroj od stejné firmy,
trial dostupný na soapui.org) je nadstavba nad stejným jádrem jako SoapUI
— existující `api-tests/soapui/Kulturni-radar-soapui-project.xml` jde
otevřít přímo i v ReadyAPI (**File → Import Project**, stejný krok jako
u SoapUI výše). Žádný samostatný ReadyAPI projekt tedy není potřeba.

## JMeter (`api-tests/jmeter/`)

Jednoduchý zátěžový (load) test plán — na rozdíl od SoapUI/Bruno (funkční
testy jednotlivých scénářů) JMeter simuluje víc souběžných uživatelů
najednou. **Nízké počty vláken jsou záměrné** — jde o cvičný projekt na
pohovor, ne o skutečný zátěžový test produkce: appka běží na Google Apps
Script (sdílené kvóty) a `apiEvents` volání mohou spouštět ověření přes
Anthropic API (viz `apps-script/kulturni_radar.gs`), takže zbytečně
vysoká zátěž by stála reálné peníze a mohla appku i nepříjemně zpomalit
ostatním uživatelům.

1. Stáhni [Apache JMeter](https://jmeter.apache.org/download_jmeter.cgi)
   (binární `.zip`/`.tgz`, sekce Binaries) — **žádná instalace**, jen
   rozbal a spusť `bin\jmeter.bat` (Windows) — vyžaduje nainstalovanou
   Javu (JDK/JRE 8+).
2. V JMeter GUI: **File → Open** → vyber
   `api-tests/jmeter/kulturni-radar-loadtest.jmx`.
3. Zkontroluj proměnnou `baseUrl` v elementu **User Defined Variables -
   baseUrl** (produkční URL appky, stejná jako v Bruno/SoapUI) — pokud se
   appka přesune na jinou `/exec` URL, stačí přepsat na jednom místě tady.
4. Spuštění: zelené **▶ (Play)** tlačítko v horní liště (nebo **Run →
   Start**, klávesa Ctrl+R).
5. Výsledky:
   - **View Results Tree** — detail každého jednotlivého requestu/odpovědi
     (zelená/červená ikonka podle úspěchu asserty), dobré pro první ruční
     ověření, že appka opravdu odpovídá.
   - **Summary Report** — souhrnné statistiky za celý běh (počet
     requestů, průměr/min/max doba odezvy, chybovost v %) po vláknové
     skupině.
   - Oba listenery se před dalším spuštěním dají vyčistit tlačítkem
     **Clear** (nebo **Clear All** pro obojí najednou) v horní liště.

Plán obsahuje dvě vláknové skupiny (Thread Groups), obě s malým počtem
vláken a pevným počtem opakování (ne nekonečná smyčka):

- **Zatezovy test - api=meta** — 10 vláken, ramp-up 5 s, 3 opakování,
  `GET ${baseUrl}?api=meta`.
- **Zatezovy test - apiEvents** — 5 vláken, ramp-up 5 s, 2 opakování,
  `GET ${baseUrl}?api=events&profil=Brno&oznacene=1&uzivatel=`.

Každý request má dva Response Assertion prvky (status kód 200 a tělo
obsahující `"ok":true`) — v **View Results Tree** se dá po kliknutí na
konkrétní vzorek v záložce **Assertion Result** ověřit, který z nich
případně selhal.

Formát `.jmx` byl ověřen proti reálným JMeter test plánům (ne dopsán z
paměti) — struktura elementů/`hashTree` byla strukturálně zkontrolována
skriptem, XML je prokazatelně dobře formované.

Živě spuštěno (JMeter 5.6.3 CLI, `-n -t ... -l results.jtl`, 23. 8. 2026)
proti produkci — žádná úprava konfigurace nebyla potřeba, plán fungoval
napoprvé (obě vláknové skupiny volají jen `GET`, takže se na ně
nevztahuje SoapUI problém popsaný výše — u `GET` klient metodu nemusí
měnit, redirect přes `googleusercontent.com` proběhne bez potíží):

| Vláknová skupina | Requestů | Chybovost | Průměr | Min | Max |
|---|---|---|---|---|---|
| Zatezovy test - api=meta | 30 | 0 % | ~2,5 s | 1,7 s | 4,1 s |
| Zatezovy test - apiEvents | 10 | 0 % | ~2,6 s | 1,2 s | 5,2 s |

Celkem 40/40 requestů bez chyby, throughput ~3,5 req/s, celý běh ~11 s.
Vyšší jednotlivé časy (do ~5 s) odpovídají už dřív zdokumentované
Apps Script „studené" latenci (viz `Docs/BACKLOG.md`, „Automatizovaný
výkonnostní test") — první request v každé vláknové skupině byl
nejpomalejší, další v témže vlákně byly už jen ~200–700 ms.
