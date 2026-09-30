# Testovací plán a strategie – Kulturní radar

> **Pracovní verze k 30. 9. 2026.** Dokument je zpětně sestavený podle
> aktuálního stavu repozitáře a reálného způsobu, jakým projekt vyvíjím a
> testuji. Cílem není formálně „odškrtnout normu“, ale mít na jednom místě
> přehled o tom, co testuji, proč právě takhle a kde jsou vědomé mezery.

## 0. O dokumentu

- **Typ:** Test plan ve smyslu ISO/IEC/IEEE 29119-3; testovací strategie je
  jeho jádrem (sekce 4), ne samostatný dokument.
- **Vznik:** přepracováno **zpětně** v září 2026 z původní strategie
  (2. 8. 2026, v2.9) na základě stávající sady, `Docs/CHANGELOG.md`,
  `Docs/BACKLOG.md` a git historie (186 commitů od 1. 8. 2026). Testy
  vznikaly průběžně s vývojem; původní strategie popisovala 18 unit,
  6 API a 7 E2E testů a samotest s watchdogem jako návrh.
- **Související dokumenty:** `Docs/POKRYTI.md` (matice pokrytí),
  `Docs/ARCHITEKTURA.md`, `Docs/PROVOZ.md`, `Docs/AUDIT-SELEKTORU.md`.

Původní strategie z 2. 8. už přestala odpovídat tomu, kam se projekt za
dva měsíce posunul. Testovací sada narostla z 31 na zhruba 540 testů, přibyl
frontend na vlastní doméně, profily uživatelů i mapa. Dokument proto dávám
dohromady hlavně zpětně podle toho, co skutečně funguje. Chci, aby mi dával
smysl i za půl roku a aby se v něm případně zorientoval někdo další, kdo by
projekt převzal.

## 1. Kontext a předmět testování

Kulturní radar je rodinná aplikace, která automaticky hledá kulturní akce
v okolí Brna a dalších měst ČR (Claude s web searchem), ukládá je do
Google Sheetu a posílá přehledy a notifikace. Uživatelé: 4 rodinné
profily a 1 vyhrazený testovací profil `rf-test`. Veřejně dostupná na
`kulturniradar.cz`.

**Testované položky:**

| Položka | Popis | Nasazení |
|---|---|---|
| `apps-script/kulturni_radar.gs` | Jediný backend (164 funkcí): data v Google Sheetu, triggery, AI volání, notifikace, JSON API | `clasp deploy` → Apps Script `/exec` |
| `apps-script/Index.html` | Frontend v jednom souboru, dvě prostředí (Apps Script iframe a statický web) | `git push` → Cloudflare Pages `kulturniradar.cz` |
| `cloudflare-worker/email-webhook.js` | Přeposílání mailů z `info@` a webhook do appky | `wrangler deploy` |

**Externí závislosti:** Anthropic API s web search, Open-Meteo / met.no
(počasí), Nominatim (geokódování), ntfy (notifikace), Google Sheet.

Pro uživatele je nejdůležitější, aby dostali správné akce ve správný čas
a se správnými údaji – hlavně datum, místo a odkaz. Stejně důležité je, aby
se neztrácelo to, co si už označili. Vizuální detaily, počasí nebo mapa jsou
užitečné, ale případná chyba v nich má menší dopad než chyba v datech.

## 2. Rozsah

**V rozsahu:** deterministická logika backendu a frontendu, API kontrakt,
chování UI v prohlížeči, správnost nasazení, provozní invarianty (samotest,
watchdog, datová hygiena).

**Mimo rozsah:** viz sekce 8.

## 3. Rizika

Seřazeno podle dopadu na uživatele.

| # | Riziko | Dopad | Doložený incident | Hlavní pokrytí |
|---|---|---|---|---|
| R1 | Špatná data akcí (datum, duplicity, tiché sloučení dvou akcí) | Vysoký – uživatel přijde o akci nebo dostane nesmysl | Sériová čísla místo dat (v3.2–3.3), duplicita „Light Up Tugendhat“ (31. 8.), tichý fuzzy přepis (v3.41–3.42) | Node unit (parsování, deduplikace), API regex dat, samotest (`auditDat_`) |
| R2 | Produkce běží na jiné verzi než repo | Vysoký – opravy „jsou nasazené“, ale neběží | `clasp deploy` bez `-i` (8. 8.) | API „Nasazená verze odpovídá repu“ |
| R3 | Ztráta nebo poškození uživatelských označení ★/✓/🏛 | Střední | Zaseknutá hvězda u `rf-test` (21. 8.) | RF zápisové testy s ověřením reloadem |
| R4 | Nedoručené notifikace | Střední – systém „neumí selhat potichu“ jen pokud kanál funguje | – | Node unit (sestavení zpráv), API živost ntfy, watchdog |
| R5 | Rozbití jednoho ze dvou prostředí (iframe vs. statický web) | Střední | Odhlášení v sandboxovaném iframu → prázdná stránka (7. 8.) | RF s volitelným `FRAME`, Node testy `sestavFetchPozadavek_` |
| R6 | Zbytečně utracený API kredit | Střední – přímé náklady | – | Testy záměrně nespouštějí placené akce; zamítnutí neplatného tokenu |
| R7 | Zneužití kontaktního formuláře nebo webhooku | Nízký až střední | – | RF cooldown formuláře, API neplatný token, testy workeru |
| R8 | Rozbité rozvržení na mobilu nebo desktopu | Nízký | Redesign v3.39–3.45 | RF responzivní pásma, mobilní viewport; zbytek ručně |

Největší důraz dávám na data a na správné nasazení. U obou už se v projektu
reálně ukázalo, že chyba může znamenat špatný výsledek pro uživatele, i když
samotná aplikace na první pohled „funguje“. Vizuální stránku proto testuji
méně důkladně – problém v layoutu je nepříjemný, ale většinou uživatele
nepřipraví o samotnou informaci.

## 4. Testovací strategie

### 4.1 Princip

Systém má čistou hranici mezi deterministickou logikou (parsování,
deduplikace, formátování) a nedeterministickým okolím (obsah od LLM,
počasí, doručení notifikací). Strategie ji kopíruje: deterministické věci
se testují co nejníž a co nejrychleji, nedeterministické okolí se hlídá
invarianty chování, ne konkrétním obsahem.

**Výchozí pravidlo pro chyby:** nový bug = nejdřív fixture a červený test, pak
oprava. Tam, kde test ověřuje ochranný mechanismus, se jeho účinnost
ověřuje i mutací: např. test orchestrátoru `zpracovatSledovanaMesta`
(21. 8.) – ochrana dočasně vyřazena, potvrzeno, že test spadne, pak
vráceno.

U backendové logiky se snažím pravidlo „nejdřív červený test, potom oprava“
dodržovat prakticky vždy, protože z reálných dat jde většinou snadno udělat
fixture a chybu spolehlivě reprodukovat. U UI to není vždy tak čisté. Tam
někdy vznikne regresní test až společně s opravou nebo krátce po ní, protože
reprodukce v prohlížeči je výrazně dražší a často závisí na více věcech
najednou.

### 4.2 Úrovně testů (pyramida)

| Úroveň | Nástroj | Počet | Kde / kdy běží |
|---|---|---|---|
| Unit – backend | Node `node:test`, `tests/harness.js` (vm sandbox, stuby Google API) | 291 | CI při každém push/PR |
| Unit – frontend | Node, `tests/frontend-harness.js` (čisté funkce z `Index.html`, bez DOM) | 186 | CI při každém push/PR |
| Unit – worker | Node, `cloudflare-worker/email-webhook.test.mjs` | 7 | CI při změně `cloudflare-worker/**` |
| API kontrakt | RF + RequestsLibrary, `api.robot` | 9 | CI neděle 19:00 UTC + ručně |
| E2E UI | RF + Browser Library (Chromium), `frontend.robot` | 50 | CI neděle 19:00 UTC + ručně |
| Provozní kontroly v produkci | Apps Script `runSelfTest`, `watchdogDailyCheck`, `auditDat_` | – | triggery v produkci |
| Ruční | reálný telefon, spot-check obsahu LLM, vizuální kontrola | – | občas |

Stav k 30. 9. 2026: všech 477 Node testů backendu a frontendu prochází
(obě sady dohromady za zhruba 1 s); 7 testů workeru běží v samostatné sadě.

**Klíčové technické prvky:**

- Backend harness: služby, které unit test nemá potřebovat (`UrlFetchApp`,
  `ScriptApp`, `LockService`), vyhazují výjimku – únik do sítě shodí test
  nahlas, ne potichu.
- Dělba mezi vrstvami: logika se vytahuje do čistých funkcí testovaných
  v Node, RF ověřuje jen tenký DOM wrapper. Příklad: `sestavPopupDataMapy_`
  (5 Node testů) vs. `sestavPopupMapy_` (2 RF testy), v3.56.
- Frontend RF umí dva cíle: statický web (výchozí) a Apps Script přes
  frame-piercing prefix `id=sandboxFrame >>> id=userHtmlFrame >>>`.

Pyramida má pořád široký základ – 477 unit testů backendu a frontendu
a 7 testů workeru proti 59 testům v Robot
Frameworku. E2E testů je ale i tak relativně hodně, protože část chování
frontendu se projeví až v DOMu, v práci s Leafletem, kalendářem, sticky
layoutem nebo při komunikaci s reálným API.

Pravidlo, které používám dnes, je jednoduché: pokud jde logiku vytáhnout do
čisté funkce, testuju ji v Node a v RF už jen ověřím, že je správně napojená.
RF používám hlavně tam, kde chyba vzniká až složením více částí systému. Tenhle
přístup se v projektu spíš postupně ustálil, než že by byl takhle jasně daný
od prvního dne.

### 4.3 Průřezové typy testů

Tagy v RF sadě (zavedeno 29. 8. 2026 podle skutečného chování testů):
`smoke`, `regrese`, `zapis`, `krehky`, `api`, `ui`, `mapa`, `kalendar`,
`filtr`, `notifikace`, `kontakt`.

- **Smoke:** rychlá kontrola „appka žije“ po nasazení (`--include smoke`).
- **Regrese:** testy navázané na konkrétní zdokumentovaný bug (verze a datum
  v `[Documentation]`).
- **Ověření nasazení:** „Nasazená verze odpovídá repu“ (API).
- **Nefunkční:** responzivita (pásma 900 a 1360 px, mobilní viewport přes
  `New Context`), JS chyby v konzoli, sticky prvky.
- **Monitoring:** živost ntfy kanálu (API test), samotest a watchdog
  v produkci.
- **Mimo hlavní sadu:** `api-tests/` (SoapUI a Bruno se stejnými 8
  scénáři, JMeter pro zátěž nad `meta` a `events`). Cvičný projekt pro
  srovnání nástrojů, není součástí verzování appky ani CI.

Kontrolu živosti ntfy beru spíš jako monitoring než klasický test. Neověřuje
konkrétní kus kódu, ale to, že se do kanálu v posledních 48 hodinách opravdu
něco doručilo. V testovací sadě ji nechávám hlavně proto, že nedělní CI běh je
pravidelná kontrola „zvenku“ a není závislá jen na tom, jestli se správně
spustil samotný Apps Script. Pokud by projekt rostl, přesunul bych to do
samostatného monitoringu.

### 4.4 Testovací prostředí

- **Jediné prostředí je produkce** (Apps Script `/exec`, `kulturniradar.cz`).
- Závislosti: `tests/robot/requirements.txt` (RF ≥ 7.0, RequestsLibrary
  ≥ 0.9, Browser ≥ 18.0), `rfbrowser init chromium`, Node 22.
- Konfigurace přes proměnné prostředí: `RADAR_URL`, `RADAR_SITE_URL`,
  `RF_FRAME`, `RF_TEST_USER_ID`, `RF_TEST_PIN`, `NTFY_TOPIC`.

Samostatné testovací prostředí by tady znamenalo druhý Google Sheet, druhé
nasazení Apps Scriptu, další Cloudflare Pages prostředí a zároveň řešit, jak
udržovat testovací data. U rodinné aplikace s několika uživateli mi to zatím
ten poměr přínos/cena zatím nevychází.

Riziko testování proti produkci proto omezuju jinak: mám vyhrazený testovací
profil, zápisové testy jsou oddělené tagem `zapis`, po testu vracím původní
stav a automatizované testy nespouštějí placené operace. U klientského projektu
bych to takhle nedělal – tam bych chtěl samostatné testovací prostředí s
řízenými daty a proti produkci bych nechal jen nezapisující smoke testy.

### 4.5 Testovací data

- Vyhrazený testovací profil „RF Test“ (`RF_TEST_USER_ID`), nikdy reálný
  rodinný profil.
- Zápisové testy (tag `zapis`) vracejí stav v `[Teardown]` (★/✓/🏛),
  s bezpečnou výchozí hodnotou `${puvodni}` nastavenou ještě před
  rizikovým krokem. Notifikační test vrací stav plným cyklem v těle testu.
- Kontaktní formulář: jediný test, který posílá reálný e-mail, spojený
  s ověřením cooldownu.
- Bez `RF_TEST_USER_ID`/`RF_TEST_PIN` se frontend suita hlasitě přeskočí
  (`Skip If` v Suite Setup).

Round-trip testy označení ★ a ✓ mají teardown s bezpečnou výchozí hodnotou
nastavenou ještě před rizikovým krokem od začátku (3. 8., v3.9); test 🏛
převzal stejný vzor. Při sérii desítek RF běhů 21. 8. se ale ukázalo, že to samo
nestačí. Zápisové testy začaly padat na timeout při ukládání a pod zátěží
Apps Scriptu selhal i úklid v teardownu. Po běhu zůstala u `rf-test` dvakrát
viset hvězda, kterou jsem musel ručně uklidit a ověřit přímo ze serveru.

Pro mě z toho plyne hlavně to, že timeout u zápisového testu není jen „spadl
test“. Může po něm zůstat změněný stav v produkčních datech, i když je teardown
napsaný správně. Proto po nestandardním běhu kontroluju i skutečný stav dat,
ne jen výsledek reportu.

### 4.6 Testovací orákulum

Produkční data se mění denně, testy proto ověřují **strukturu a
invarianty**, ne konkrétní hodnoty: schéma odpovědi (`lat`/`lng`), regex
českého data (`DATUM_RE` sdílený v `resources.robot`), „změna a návrat“
(kalendář), ověření zápisu reloadem, invarianty denní kontroly
(0 ≤ nalezeno ≤ 15, přírůstek řádků = Nové).

Testy závislé na datech se chovají dvojím způsobem:

- `Skip If`, když data chybí (např. počasí, ikona první karty),
- `Log … level=WARN` a projití (chipy typů míst ř. 498, seznam míst pod
  mapou ř. 877 ve `frontend.robot`).

Varianta s `WARN` je starší a dnes ji nepovažuju za ideální. Když potřebná
data nejsou k dispozici, test sice projde, ale reálně nic neověří a v souhrnu
to vypadá jako běžný PASS. `Skip If` je v tomhle čitelnější, protože je rovnou
vidět, že test neměl podmínky ke spuštění. Proto chci tyhle případy postupně
sjednotit na `Skip`.

### 4.7 Spouštění a CI

| Workflow | Trigger | Obsah |
|---|---|---|
| `node-tests.yml` | každý push, PR, ručně | unit + frontend unit |
| `cloudflare-worker-tests.yml` | push/PR se změnou `cloudflare-worker/**`, ručně | worker |
| `rf-tests.yml` | neděle 19:00 UTC (po nedělním samotestu), ručně | API, pak frontend (`if: always()`), reporty jako artefakt na 14 dní |

Běží na `ubuntu-latest`. Lokální podmnožiny přes tagy (`--include smoke`
po nasazení, `--exclude zapis` pro opakované běhy).

**Poučení z provozu:** 8.–9. 8. 2026 se `frontend.robot` v CI celý
přeskakoval (chyběly secrety `RF_TEST_USER_ID`/`RF_TEST_PIN`) a běh přesto
skončil zeleně. Odhaleno z logu GitHub Actions a porovnáním git historie
workflow s historií zavedení profilů; opraveno 9. 8.

Robot Framework nespouštím při každém pushi. Běží proti produkci, část testů
zapisuje a při opakovaných bězích se už ukázalo, že Apps Script začne pod
zátěží zpomalovat. Navíc push do repozitáře automaticky neznamená, že je stejná
verze opravdu nasazená do obou částí aplikace.

Po nasazení proto spouštím ručně smoke testy a celý RF běh nechávám pravidelně
jednou týdně. Unit testy naproti tomu běží při každém pushi a PR, protože jsou
rychlé, izolované a bez vedlejších efektů.

### 4.8 Nestabilita (flaky testy)

Tag `krehky` označuje testy s prokázanou náchylností na timing. Postup:
nejdřív izolovaný rerun, u zápisových testů ověření dat, hledání vzorce
napříč běhy (mění se sada padajících testů → vnější vliv; padá stále týž
→ spíš bug).

Dva doložené případy:

- **Mapa a kalendář (#14–19, 21. 8.):** původní hypotéza „artefakt
  testování přes syrový `/exec`“ byla **vyvrácena** – stejné testy padaly
  i proti `kulturniradar.cz`. Skutečná příčina byl race condition
  v aplikaci, tedy reálný bug, ne flake.
- **Zápisové testy (21. 8.):** pokaždé jiná skladba selhání (45/4, 44/5)
  → kumulativní zátěž Apps Scriptu, potvrzeno izolovanou reprodukcí 5/5.

Tag `krehky` nedávám testu jen proto, že jednou spadl. Nejdřív se snažím
zjistit, jestli je příčina v aplikaci, v samotném testu nebo opravdu někde
venku. Jako křehký ho označím až ve chvíli, kdy se podaří prokázat vnější
příčinu, kterou nedává smysl nebo nejde rozumně odstranit – typicky zátěž
platformy nebo závislost na externím zdroji. Pokud je problém v testu nebo v
aplikaci, radši ho opravím, než abych ho schoval za označení „flaky“.

## 5. Kritéria

Za hotovou změnu považuju stav, kdy jsou Node testy zelené v CI, nová logika
má odpovídající test a oprava konkrétního bugu má regresní test. Po nasazení
musí projít `--include smoke`; u změn UI spouštím i odpovídající RF tagy.

Selhání toleruju jen tehdy, když mám doložené, že je příčina mimo změnu
samotnou – například krátkodobá zátěž Apps Scriptu nebo výpadek třetí strany –
a izolovaný rerun projde. Padající Node test, smoke nebo regresní test beru jako
blokující problém.

## 6. Architektura testů a údržba

`resources.robot` sdílí proměnné (`BASE_URL`, `SITE_URL`, `FRAME`,
`DATUM_RE`) mezi oběma suitami. Zavedeno poté, co se regex dat v obou
souborech rozjel (do 7. 8. 2026). Stabilita selektorů je řešena v aplikaci
(`data-iso`, `data-id`, `data-klic`, v3.57), viz `Docs/AUDIT-SELEKTORU.md`.

Pokud by RF sada narostla zhruba na dvojnásobek, už bych ji nenechával v
jednom velkém `frontend.robot`. Rozdělil bych ji podle oblastí, které už dnes
odpovídají tagům – mapa, kalendář, filtry, zápisy – a každá suita by měla
vlastní setup. Opakující se kroky bych vytáhl do sdílených keywordů a scénáře,
které se liší hlavně vstupními daty, převedl na `Test Template`.

## 7. Role a způsob práce

Projekt vyvíjí a testuje jedna osoba s AI asistencí (Claude v chatu,
Claude Code v repu). Pracovní postupy jsou zdokumentované ve skillu
`kulturni-radar-workflow`.

Rozhodnutí o tom, co má smysl testovat, co už je zbytečně drahé a jaký
kompromis je ještě přijatelný, dělám já. AI používám hlavně jako pomoc při
psaní kódu a testů, při diagnostice a při dokumentaci. Její výstup ale neberu
jako důkaz – ověřuju ho proti běžící aplikaci, logům z CI nebo přímo proti
datům.

V projektu se už několikrát ukázalo, proč je to potřeba, například:

- **Plán na „Oblíbené“ (8. 8.):** Claude navrhl postavit funkci Oblíbené
  od nuly – nový list `OBLÍBENÉ`, novou API funkci, odhad 1,5–2 hodiny.
  Vycházel přitom ze zastaralých poznámek. Zeptal jsem se, jestli by to
  nešlo vyřešit stejně jako Navštívené. Ověření přímo v kódu ukázalo, že
  funkce už existuje od začátku srpna (list `OZNAČENÍ`, `apiToggle`,
  RF testy procházely). Místo dvouhodinové práce na duplicitní funkci
  stačila oprava poznámek. Poučení: návrh AI ověřit proti skutečnému kódu
  dřív, než se začne stavět.
- **Pády testů mapy a kalendáře (21. 8.):** Claude označil pět padajících
  testů za známý testovací dluh s vysvětlením, že jde o artefakt
  testování přes syrový `/exec`. Nechtěl jsem je tak nechat a zeptal se,
  jestli je nejde dořešit. Běh proti `kulturniradar.cz` hypotézu vyvrátil,
  stejné testy padaly i tam. Skutečná příčina byl race condition
  v `inicializovatMapu_()` (čekání na načtení Leafletu z CDN), tedy reálný
  bug v aplikaci. Opraven ve v3.55, spolu se dvěma chybami v testech
  samotných.

## 8. Co se netestuje a proč

| Oblast | Důvod |
|---|---|
| Kvalita a úplnost obsahu od LLM | Nedeterministické, bez věrohodného orákula; ruční spot-check |
| Skutečné spuštění kontroly s platným tokenem | API kredit a cooldown; testuje se jen zamítnutí |
| Klik na „Najít akce pro mě“ | Placené AI hledání; ověřuje se jen UI dialogu |
| Klik na Sdílet | Web Share / clipboard v headless prohlížeči nedeterministické |
| Pixelové zarovnání redesignu | Nejkřehčí typ testu, vizuální kontrola je spolehlivější a levnější (odloženo 18. 8.) |
| Automatizovaný výkonnostní test | Baseline 1,4–2,9 s daná platformou Apps Script, pevný práh by byl zdrojem falešných poplachů (uzavřeno 19. 8.) |
| Jiné prohlížeče než Chromium | Automatizace je zatím postavená na Chromium; browser matrix má vzhledem k velikosti projektu nižší prioritu |
| Přístupnost | Zatím není systematicky pokrytá; případné budoucí rozšíření je axe-core přes Browser Library |
| Bezpečnost nad rámec validací a tokenů | Projekt nemá platby; automatizované pokrytí se zatím soustředí na tokeny, validace a cooldowny, hlubší security testování není součástí této sady |
| Mobil na reálném zařízení | Emulace viewportu v RF; skutečné zařízení ručně |

## 9. Dokumentace podle 29119-3 a čím je nahrazena

| Dokument | Stav |
|---|---|
| Test Policy, Organizational Test Practices | Nepoužito – organizační úroveň |
| Test Plan (vč. strategie) | Tento dokument |
| Test Model / Case / Procedure Specification | `[Documentation]` v RF testech, přehled přes `python -m robot.testdoc`; traceabilita v `POKRYTI.md` |
| Test Data / Environment Requirements | Sekce 4.4 a 4.5 |
| Readiness reports, Status report | Nepoužito – sólo projekt bez předávek |
| Execution log, Actual results | Generováno: `output.xml`, `log.html`, CI artefakty |
| Incident report | GitHub Issues (label `bug`), `CHANGELOG.md` |
| Completion report | Volitelně pro audit testovacího dluhu (17.–21. 8. 2026) |

## 10. Známé mezery a další kroky

Seřazeno podle poměru přínos / cena.

1. Sjednotit testy závislé na datech na `Skip If` (místo WARN a PASS).
2. Návrat stavu u notifikačního testu přesunout do `[Teardown]`.
3. Data-driven testy (`Test Template`): toggle ★/✓/🏛, neplatné PINy,
   responzivní pásma.
4. Aktualizovat `Docs/PROVOZ.md`: tabulka triggerů neobsahuje
   `runSelfTest`, `watchdogDailyCheck`, `sendUserNotifications`,
   `zpracovatSledovanaMesta`.
5. Browser matrix (Chromium, Firefox, WebKit) v `rf-tests.yml`.
6. Spouštění RF v Dockeru pro shodné prostředí lokálně i v CI.
7. Základní kontrola přístupnosti (axe-core přes Browser Library), nízká
   priorita.

## Historie dokumentu

| Datum | Změna |
|---|---|
| 2. 8. 2026 | Původní strategie (4 vrstvy, v2.9) |
| 30. 9. 2026 | Přepracováno na test plan dle 29119-3, zpětná rekonstrukce |
