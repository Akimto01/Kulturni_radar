---
name: kulturni-radar-workflow
description: Nasazení, balení, ladění testů (Node i Robot Framework) a údržba dokumentace (CHANGELOG.md/BACKLOG.md) pro projekt Kulturní radar Vojty Čermáka (Apps Script + Google Sheets + GitHub, repo Akimto01/Kulturni_radar). VŽDY použij tento skill, když uživatel žádá o zabalení/nasazení změny v Kulturním radaru, když posílá výstup z Robot Framework testů (obzvlášť pokud něco spadlo), když se má bumpnout verze, nebo když se upravuje Docs/CHANGELOG.md či Docs/BACKLOG.md pro tento projekt. Spouštěj i implicitně při jakékoli práci na souborech kulturni_radar.gs / Index.html / tests/*, i bez výslovné zmínky slova "skill". Spouštěj i na samostatné klíčové slovo "Start" nebo "End" na začátku zprávy, i bez dalšího kontextu (bez zmínky nasazení/testů) — jde o explicitní hranice pracovní session, viz sekce 4.
---

# Kulturní radar — vývojový workflow

Shrnuje mechanické, snadno zapomenutelné kroky vytěžené z reálné práce na
projektu (marat­on session 2.–4. 8. 2026). Doplňuje paměť Claude (ta má
"co a proč", tenhle skill má "přesně jak, krok za krokem, a na co si dát
pozor").

## 1. Balení a nasazení změny

### Pravidlo verzování (nikdy nevynechat)
Každá změna kódu = bump verze na **dvou místech** v `kulturni_radar.gs`:
```
 * Verze: 3.15 (4. 8. 2026) – krátký popis změny        ← řádek 4 (komentář)
const VERZE = '3.15';       ← const o pár řádků níž
```
`Index.html` má **vlastní nezávislé číslo verze**, jen jako komentář na
řádku 2 (žádný `const`, nikam se nehlásí přes API):
```
<!-- Kulturní radar Index.html v3.10 – krátký popis změny -->
```
Backendová `VERZE` a číslo verze `Index.html` se vyvíjejí **nezávisle** —
je normální mít např. backend 3.15 a frontend pořád 3.6, pokud se dnes měnil
jen `.gs`. Do CHANGELOGu vždy jasně napsat, které číslo patří ke kterému
souboru.

### Kontrolní seznam před balením
1. Provést změnu(y) v pracovní kopii.
2. Bump verze (viz výše) — vždy, i u jednořádkové opravy.
3. Syntaktická kontrola (bez Apps Scriptu, jen Node):
   ```bash
   node -e "new Function(require('fs').readFileSync('kulturni_radar.gs','utf8')); console.log('OK')"
   ```
   U `Index.html` totéž nad extrahovaným `<script>` blokem:
   ```python
   import re
   html = open('Index.html', encoding='utf-8').read()
   js = re.search(r'<script>([\s\S]*)</script>', html).group(1)
   open('/tmp/app.js','w',encoding='utf-8').write(js)
   ```
   ```bash
   node --check /tmp/app.js
   ```
4. Spustit **celou** testovací sadu — **pozor na přesný příkaz**:
   ```bash
   node --test tests/unit.test.js tests/frontend.test.js
   ```
   `node --test tests/` (jen adresář) na novějším Node **selže** ("Cannot
   find module") — vždy vyjmenovat konkrétní soubory.
5. Zabalit **jen soubory, které se skutečně změnily** (ne celý repo
   pokaždé) do zipu se strukturou repa:
   ```
   apps-script/kulturni_radar.gs
   apps-script/Index.html
   tests/unit.test.js
   tests/frontend.test.js
   tests/harness.js
   tests/frontend-harness.js
   tests/robot/resources.robot
   tests/robot/api.robot
   tests/robot/frontend.robot
   .github/workflows/*.yml
   ```
6. `present_files` s krátkým shrnutím, co se změnilo a kolik testů prošlo.

### Nasazovací kroky (dělá je uživatel v Apps Script editoru)
1. Rozbalit zip do lokálního repa.
2. `node --test tests/unit.test.js tests/frontend.test.js` — potvrdit
   stejný počet testů jako v balíčku.
3. Obsah `kulturni_radar.gs` → vložit do souboru **`Kulturní radar.gs`**
   v editoru (pozor: jiné jméno souboru v editoru než v repu — s
   diakritikou a mezerou). `Index.html` → do `Index.html` (jméno sedí).
4. **Spravovat implementace → Upravit aktivní implementaci → Nová verze.**
   Do pole **Popis** vyplnit aktuální `VERZE` (např. „v3.15") — jinak se
   Apps Scriptovo vlastní číslo implementace (`Verze N`, autoinkrement bez
   vztahu k naší `VERZE`) nedá zpětně spárovat s naší verzí. **Tohle
   pravidlo se snadno zapomíná — vždy připomenout.**
5. Ověřit: otevřít `<URL>/exec?api=meta` (ne uloženou "echo" URL ze
   staré karty prohlížeče — ta má krátkou životnost, viz sekce 2) a
   zkontrolovat `"verze"` v odpovědi.
6. RF sada (viz sekce 2 pro `$URL` a diagnostiku pádů).

## 2. Diagnostika pádů Robot Framework

Tři vzorce pokrývají prakticky všechny pády, na které jsme za celou
session narazili. Než cokoli opravovat v kódu, nejdřív rozpoznat vzorec.

### Vzorec A — `$URL` je prázdná
```
MissingSchema: Invalid URL '': No scheme supplied.
```
`$URL` v PowerShellu žije **jen v rámci jednoho okna/session**. Nové okno
terminálu, restart VS Code, nebo dost dlouhá pauza = proměnná je pryč.
**Oprava:** nastavit znovu oba řádky ve stejném okně, kde se pak spouští
testy:
```powershell
$URL = "https://script.google.com/macros/s/AKfycb.../exec"
robot --variable BASE_URL:$URL --variable NTFY_TOPIC:<topic> --outputdir vysledky tests/robot/
```
Rychlá pojistka před spuštěním: `echo $URL` musí vypsat celou adresu.

### Vzorec B — `HTTPError: 404` na `script.googleusercontent.com/macros/echo?...`
Google Apps Script interně přesměrovává `/exec` na dočasnou "echo" URL
s `user_content_key`. Při souběhu víc požadavků (celá RF sada běží rychle
za sebou) občas jedna z nich vyprší nebo zkolabuje — **to není náš kód**.
**Ověření:** spustit JEN ten jeden padlý test samostatně, s odstupem:
```powershell
robot --variable BASE_URL:$URL --test "Přesný název testu" tests/robot/api.robot
```
Pokud podruhé projde → potvrzený přechodný zákmit, nic se neopravuje.
Stalo se to za session minimálně 4× a pokaždé se to takhle potvrdilo.

### Vzorec C — frontend suite: `Parent suite setup failed: TimeoutError... header h1`
Toto je **následek**, ne příčina. Frontend RF suite naviguje na
`BASE_URL` v Suite Setup; pokud je neplatná (vzorec A) nebo backend
zrovna nedostupný (vzorec B), hlavička se nikdy nenačte a **celá**
frontend sada spadne najednou. Řešit kořenovou příčinu (A nebo B), ne
tenhle symptom.

### Drobnosti, na které jsme narazili jen jednou, ale stojí za zapsání
- `Wait For Elements State` (knihovna Browser) **nepodporuje** pojmenovaný
  argument `msg=` (na rozdíl od `Should Be Equal` a podobných) —
  `Keyword 'Browser.Wait For Elements State' got unexpected named argument 'msg'`.
- Selektor `.chip >> text=Vše` může kolidovat, pokud vzniknou dva prvky se
  stejným textem v různých sekcích (kategorie vs. typy míst) — vždy
  zúžit na kontejner (`#kat-chips .chip`), ne spoléhat na obecný `.chip`.
- Testy, které **zapisují** do produkčních dat (např. toggle ★/✓), nikdy
  neklikat naslepo v automatickém RF běhu bez teardownu, co vrátí původní
  stav — viz vzor v `tests/robot/frontend.robot` (`Ověřit plný cyklus
  označení… s reloadem`).
- Gotcha: VS Code Problems panel hlásí "robotframework not installed"
  u .robot souborů — lokální Python prostředí (ne to, co appka/CI
  používá) nemá nainstalovaný balíček robotframework, takže Language
  Server nemůže poskytovat zvýrazňování/kontrolu syntaxe. NETÝKÁ SE
  appky ani CI (RF testy tam běží správně) — je to čistě editor
  pohodlí. Oprava: nainstalovat robotframework do Python prostředí, co
  VS Code používá (cesta se liší podle instalace, viz chybová hláška
  v Problems panelu pro přesnou cestu k python.exe), pak Reload Window
  ve VS Code.

## 3. Sync CHANGELOG.md ↔ BACKLOG.md

Po **každém** zápisu do `Docs/CHANGELOG.md` zkontrolovat, jestli
odpovídající položka nezůstala viset v `Docs/BACKLOG.md`, a smazat ji
odtud. Tohle se v session opakovaně zapomínalo (Claude Code to muselo
2× samo upozornit) — je to nejsnáz uklouznuvší krok z celého workflow.

Postup:
1. Po přidání záznamu do CHANGELOGu vypsat klíčová slova/název funkce.
2. Projít `BACKLOG.md` a najít položku se stejným tématem.
3. Smazat ji. Pokud tím zůstane sekce/nadpis prázdný, smazat i nadpis
   (ne nechávat prázdné hlavičky sekcí v souboru).
4. Commit hláška typu: `BACKLOG.md — odstraněna dokončená položka X`.

### Testovací dluh — kde hledat, než se řekne "netestováno"
Než se něco označí jako netestované, ověřit v `tests/unit.test.js` — za
session se ukázalo, že několik funkcí (`parseEvents_`, `najdiDuplicity_`,
`jeVycpavka_`, `callAnthropic_`) vypadalo netestovaně, ale ve skutečnosti
testy měly, jen chyběly v BACKLOG.md poznámce.

### Udržovat aktuální "Doporučené pořadí"
Při každé větší změně BACKLOG.md (přidání/dokončení položky, změna
odhadu) zkontrolovat, jestli sekce „Doporučené pořadí" na začátku
souboru pořád odpovídá realitě — závislosti mezi položkami se mohou
změnit (např. dokončení jedné položky odemkne jinou). Aktualizovat
pořadí při změně, ne nechávat zastaralé.

## 4. Konec pracovní session

Na konci každé pracovní session (rozloučení, „jdu spát", „končím na dnešek",
„díky za dnešek" apod.) **automaticky nabídnout stručné shrnutí v bodech**,
co se ten den udělalo — bez čekání, až o to Vojta výslovně požádá. Tohle je
obecná preference uložená i v paměti Claude (napříč projekty), tady je jen
zapsaná pro viditelnost v repu.

Součástí tohoto shrnutí je i stručný výpis dalších plánovaných aktivit
z BACKLOG.md (co ještě čeká), každá s hrubým časovým odhadem (např.
„1–2 h", „2–3 h") — ať je hned vidět, co by se dalo stihnout v rámci
zbývajícího času případně pokračující session, bez nutnosti znovu
procházet celý BACKLOG.md ručně.

Kromě shrnutí co se udělalo, na konci session (i) zkontrolovat, jestli
se v jejím průběhu objevil nový poznatek/vzorec/gotcha hodný zapsání
do SKILL.md (nová automatizace, nový diagnostický postup, zastaralá
informace v existující sekci), a (ii) pokud ano, navrhnout konkrétní
úpravu ke schválení, ne ji jen zmínit mimochodem.

### Explicitní hranice session (Start/End)
Kromě automatického rozpoznání farewell frází platí i explicitní
anglická klíčová slova, protože v jedné dlouhé konverzaci může dojít
k příchodu a odchodu od práce vícekrát:

- **"Start"** (samostatně, na začátku zprávy) - explicitní hranice:
  od této chvíle se počítá nová session pro účely závěrečného
  shrnutí. Vše řečené/udělané před touto hranicí (i v témže dni) se
  do příštího shrnutí nezahrnuje. Pokud "Start" zazní znovu bez
  předchozího "End", jen se hranice posune dopředu - předchozí
  neuzavřený úsek zůstává nezahrnutý do budoucích shrnutí.
- **"End"** - explicitní vyžádání závěrečného shrnutí + výčtu
  plánovaných bodů s časovými odhady (stejné chování jako farewell
  fráze), zároveň uzavírá aktuální okno session.

Doplňkově, kvůli prevenci zapomnění:
- Když zpráva obsahuje pozdrav nebo náznak začátku (např. "dobré ráno",
  "ahoj", "jsem zpět" apod.) BEZ explicitního slova "Start", zeptej se,
  jestli tímhle začíná nová session ("Chceš tímto začít novou session?
  Napiš 'Start' pro potvrzení."), a čekej na potvrzení slovem "Start"
  před tím, než to tak započítáš. Bez potvrzení "Start" se žádná
  hranice nenastavuje.
- Když zpráva obsahuje náznak konce (např. "půjdu spát", "budu
  končit", "zatím díky" apod.) BEZ explicitního slova "End", zeptej
  se, jestli tímhle session končí ("Ukončujeme tím aktuální session?
  Napiš 'End' pro potvrzení a shrnutí."), a čekej na potvrzení slovem
  "End" před tím, než uděláš závěrečné shrnutí/retrospektivu. Bez
  potvrzení "End" se shrnutí negeneruje automaticky.

## Referenční vzorce pro psaní nových testů (harness)

Backend (`tests/harness.js`, `nactiRadar(volby)`):
- `volby.properties` — Script Properties (`ANTHROPIC_API_KEY` apod.)
- `volby.urlFetch` — stub pro `UrlFetchApp.fetch`, viz `frontaFetchu(fronta, volane)`
  v `tests/unit.test.js` (fronta odpovědí `{code, body}` nebo řetězec
  `'throw'` pro síťovou chybu)
- Cross-realm past: objekty vzniklé uvnitř `vm` sandboxu mají jiný
  `Object.prototype` než testovací soubor. `assert.deepEqual`/`assert/strict`
  na takových objektech **padá** i při stejném obsahu
  (`Values have same structure but are not reference-equal`). Řešení:
  porovnávat jednotlivé vlastnosti (`assert.equal(obj.pole, hodnota)`),
  ne celý objekt/pole najednou. U polí/objektů, kde je porovnání nutné
  celé, použít helper `shodneNapricRealmy(skutecne, ocekavane)` (JSON.stringify
  porovnání) — viz `tests/frontend.test.js`, sekce v3.15.

Frontend (`tests/frontend-harness.js`, `nactiFrontendFunkce(['fn1','fn2'])`):
- Vytáhne pojmenované funkce přímo z `<script>` bloku `Index.html` a
  spustí je izolovaně (počítá `{ }`, ne pevný regex — funguje i na
  funkce s vnořenými bloky). Bez DOM, bez `init()`.
- Nutné doplnit do sandboxu globály, které kód používá a `vm` je sám
  nemá (`URLSearchParams` byl jeden takový případ).
- Nová čistá funkce v `Index.html` → přidat její jméno do seznamu v
  `tests/frontend.test.js` a napsat testy stejným stylem jako u
  `gcalUrl_`/`mapsUrl_`/`sestavTextSdileni_`.

## 5. Release šablona — balíček + Claude Code prompt v jednom kroku

Vytěženo ze session 8. 8. 2026, kde se tenhle cyklus opakoval ~15×
(anonymní režim → migrace na Cloudflare Pages → zapamatování chipů →
sdílení, 4 iterace formátu podle živého testování). Cíl: pokaždé stejný,
předvídatelný tvar, ať se nemusí vymýšlet znovu.

### Kdy použít
Pokaždé, když Claude (v tomhle chatu, ne Claude Code) dokončí a otestuje
změnu v `apps-script/kulturni_radar.gs` a/nebo `apps-script/Index.html`
(příp. testovací soubory), kterou má Vojta dostat do repa a nasadit.

### Krok A — balíček (dělá Claude v chatu)
1. Bump verze (viz sekce 1 výše — vždy).
2. Syntaktická kontrola + `node --test tests/unit.test.js tests/frontend.test.js`
   — zapsat si přesný počet testů (staré → nové).
3. Zip **jen skutečně změněných souborů**, zachovat strukturu repa
   (`apps-script/...`, `tests/...`). Žádné soubory navíc "pro jistotu".
4. `present_files` s jednořádkovým shrnutím (co se změnilo, kolik testů).

### Krok B — Claude Code prompt (dělá Claude v chatu, hned pod balíčkem)
Pevná šablona, měnit jen vyplněné části v `[hranatých závorkách]`:

```
Postupuj podle skillu kulturni-radar-workflow.

Kontext: [1-3 věty CO a PROČ se změnilo]. Přiložený zip obsahuje
[seznam souborů].

Udělej prosím:

1. Rozbal zip do repa (přepíše [N] soubor/y).
2. `git status` — potvrď, že se změnily jen tyhle [N].
3. `node --test tests/unit.test.js tests/frontend.test.js` — očekávám
   [staré]/[staré] → [nové]/[nové] ([+X] nových testů pro [co]).
4. Ukaž mi diff [souborů] před commitem.
5. Po mém potvrzení: [je-li apps-script/*.gs či Index.html mezi soubory:]
   nasaď do Apps Script editoru (Nová verze, Popis "[vXX]"), commitni
   s hláškou: "[commit hláška v ~7 slovech, česky bez diakritiky]"
6. Aktualizuj Docs/CHANGELOG.md [a Docs/BACKLOG.md, pokud se tím něco
   z BACKLOGu dokončuje — viz sekce 3].
7. `git add`, `git commit`, `git push`.
8. Krátké shrnutí a finální commit hash.

Před commitem mi ukaž diff, ať vidím přesně, co jde do gitu.
```

### Pravidlo pro krok 5 (ruční nasazení)
Claude Code **nemá přístup** do Apps Script editoru — to je vždy ruční
krok Vojty. Prompt na to musí vždy explicitně upozornit (krok 5 výše),
jinak hrozí přesně to, co se stalo 8. 8.: commit proběhne, ale appka na
`kulturniradar.cz` (statický Cloudflare Pages) se aktualizuje automaticky
přes `git push`, zatímco Apps Script `/exec` zůstane na staré verzi, dokud
ho někdo ručně nenasadí — **tohle jsou dva nezávislé nasazovací kanály**,
je snadné zapomenout na ten druhý.

### Časté doladění po living testu
Session 8. 8. ukázala vzorec: první verze funkce → živý test → menší
úprava (barva, časování, formát textu) → nová verze o +0,01–0,1 výš,
znovu celý cyklus A+B. To je v pořádku a čekané, ne known-issue — raději
rychlé malé iterace s ověřením v produkci než snaha odhadnout formát
napoprvé dokonale.

## 6. Automatizace nasazení do Apps Script (clasp) — aktivně používáno od 8. 8. 2026

Zavedeno 8. 8. 2026 jako náhrada za ruční nasazení (krok 5 v sekci 5) —
dřív jediný neautomatizovaný krok release cyklu. **Ověřeno v praxi
8.–18. 8. 2026, opakovaně, bez incidentu** — jen 18. 8. samotného sedm
nasazení za sebou (v3.39 → v3.45), vždy stejný vzorec: `clasp push -f`
→ `clasp deploy -i <ID> --description "vX"` → ověření `?api=meta`.

### Aktuální stav
Clasp běží na Vojtově stroji přes Claude Code (ne v tomhle hlavním
chatu — tohle prostředí má síťový přístup omezený na povolený seznam
domén, `script.google.com`/`accounts.google.com` v něm nejsou, takže
`clasp login`/`push`/`deploy` odsud spustit nejde). Na Vojtově stroji:
- `clasp` nainstalovaný (`npm install -g @google/clasp`) a přihlášený
  (`clasp login`, token v `~/.clasprc.json` — v `.gitignore`, nikdy
  necommitovat).
- OAuth souhlas obsahuje přesně tři potřebné scopy (`script.projects`,
  `script.deployments`, `script.webapp.deploy` — viz sekce níže), bez
  širšího přístupu k Disku.
- `.clasp.json` napojený na existující Apps Script projekt "Kulturní
  radar" (`scriptId`), `apps-script/appsscript.json` existuje lokálně
  i v repu (commitnuto).

### Zjištění
- `clasp` (`google/clasp` na GitHubu) je oficiální CLI od Googlu pro
  Apps Script — `clasp push` nahraje soubory, `clasp deploy` vytvoří
  novou verzi s popisem. Přesně nahrazuje dnešní ruční kopírování do
  editoru + "Nová verze".
- **Podporuje přímé napojení na Claude Code** jako MCP server/plugin
  (`google/clasp` repo, sekce o Claude Code CLI) — Claude Code by tak
  mohl volat `clasp push`/`clasp deploy` přímo jako nástroj, ne přes
  obcházení přes bash.
- Běžný vzorec i pro GitHub Actions (auto-deploy při `git push`, stejně
  jako dnes funguje Cloudflare Pages) — `.clasprc.json` s OAuth tokenem
  jako GitHub Secret, `clasp push -f` (force, jinak čeká na interaktivní
  potvrzení a v CI zůstane viset).

### OAuth scopy — co push/deploy potřebují a co ne
Ověřeno 8. 8. 2026 při prvním napojení: `clasp list-scripts` selhává na
"Insufficient Permission" s výchozím grantem z `clasp login` — potřebuje
širokoúhlé prohledávání celého Disku (`drive.readonly`/`drive`), které
grant neobsahuje (jen `drive.metadata.readonly` a `drive.file`). To je
v pořádku a nevadí — `list-scripts` je jen doplňková kontrola, kterou
nepotřebujeme, protože `scriptId` máme napevno v `.clasp.json`.

`clasp push` a `clasp deploy` naproti tomu nejedou přes Drive API vůbec,
ale přímo přes Apps Script API (`script.projects`, `script.deployments`,
`script.webapp.deploy`) — ty výchozí grant obsahuje. Push/deploy do už
napojeného projektu tedy funguje bez nutnosti šířeho OAuth souhlasu
nebo opakovaného loginu.

### Které konkrétní scopy zaškrtnout při clasp login
Ověřeno 8. 8. 2026: výchozí `clasp login` grant obsahuje jen identity
scopy (email/profile/openid) — BEZ přístupu k Apps Script API. Při
OAuth souhlasu v prohlížeči je nutné ručně zaškrtnout přesně tyto tři
položky (ne "Vybrat vše" — zbytečně široký přístup k Disku a Cloud
nastavením):
- "Vytvoření a aktualizace projektu v jazyce Google Apps Script"
  (`script.projects` — pro `push`)
- "Vytvoření a aktualizace nasazení jazyka Google Apps Script"
  (`script.deployments` — pro `deploy`)
- "Publikování aplikace jako webové aplikace nebo služby…"
  (`script.webapp.deploy` — nutné, protože appka běží jako webová
  aplikace)
Ověření scopů jde udělat přes Google `tokeninfo` endpoint na
`~/.clasprc.json` access_token, ne jen spolehnutím na to, že přihlášení
"prošlo".

### appsscript.json manifest musí existovat lokálně
`clasp push` selže na "Project contents must include a manifest file
named appsscript", i když manifest dávno existuje na serveru — clasp
vyžaduje i lokální kopii v `apps-script/`. NEPOUŽÍVAT `clasp pull` na
opravu (přepsalo by `kulturni_radar.gs`/`Index.html` starší verzí ze
serveru). Bezpečný postup: stáhnout JEN manifest přes Apps Script API
(`script.projects.getContent`, stejné scriptId) a uložit jako
`apps-script/appsscript.json`, bez zásahu do ostatních souborů. Po
prvním stažení commitnout do repa, ať je pro příští push už připravený.

### clasp deploy vyžaduje -i, jinak vznikne nová implementace
Ověřeno 8. 8. 2026 při prvním ostrém použití: `clasp deploy` spuštěný
BEZ parametru `-i <deploymentId>` nevytvoří "Novou verzi" na existující
aktivní implementaci (jak dělá ruční postup "Spravovat implementace →
Upravit aktivní implementaci → Nová verze"), ale založí ÚPLNĚ NOVOU
implementaci s novou, dosud nikde nepoužitou `/exec` URL. Produkce
(URL používaná v `tests/robot/resources.robot` i appkou na
kulturniradar.cz) zůstane běžet na starém kódu, dokud se to nezjistí
a neopraví.

Správný příkaz pro aktualizaci existující produkční implementace:

```
clasp deploy -i <ID_PRODUKČNÍ_IMPLEMENTACE> --description "vXX"
```

ID produkční implementace lze zjistit z `clasp deployments` (řádek bez
`@HEAD`, s aktuálním popisem předchozí verze) nebo přímo z produkční
`/exec` URL, kterou používá `tests/robot/resources.robot`.

Pokud omylem vznikne nová implementace bez `-i` (jak se stalo při prvním
použití), lze ji bezpečně smazat přes `clasp deployments` + ruční
identifikaci ID — nová implementace není nikde odkazovaná, takže její
smazání nic nerozbije.

### PYTHONIOENCODING a RF na pozadí
Ověřeno 8. 8. 2026: systémová proměnná `PYTHONIOENCODING=utf-8:surrogateescape`
shazuje Robot Framework, když běží s přesměrovaným výstupem (na pozadí/
přes skript), ne v interaktivním terminálu — známý RF bug, nesouvisí
s appkou. Obchvat: před spuštěním RF sady takhle nastavit
`$env:PYTHONIOENCODING = "utf-8"` jen pro daný běh.

### Přenos textových souborů s diakritikou do Claude Code
Ověřeno 8. 8. 2026 (SKILL.md samotný): vkládání textového souboru s
českou diakritikou jako přílohy přímo do promptu (ať už přes kopírování
textu, nebo drag&drop souboru) opakovaně způsobovalo nevratný mojibake
(ztracený C1 control byte) — ověřeno byte-přesně identickým výsledkem
bez ohledu na zdroj/formát přílohy. Spolehlivé řešení: uložit soubor
ručně přímo na disk do repa (mimo chat, mimo přílohy) a požádat Claude
Code, ať ho přečte přímo ze souborového systému (svým file/read
nástrojem), ne z přílohy zprávy.

## 7. Diagnostika přes claude-in-chrome (živé ověření na produkci)

Vytěženo ze session 18. 8. 2026 (redesign v3.39–v3.45), kde Claude
v hlavním chatu (ne Claude Code) opakovaně použil claude-in-chrome MCP
tool k živému ověřování přímo na `kulturniradar.cz` — kontrola nasazené
verze, zjišťování z-index/stacking-context řetězce, přesné pixelové
měření zarovnání prvků, ověření sticky chování po scrollu.

**Dělá tohle Claude v hlavním chatu** (má přístup k claude-in-chrome),
**ne Claude Code** — ten pracuje jen v terminálu/editoru na Vojtově
stroji a žádný prohlížeč k dispozici nemá.

### Kdy použít
- Ověření, že nasazený deploy skutečně odpovídá poslednímu commitu
  (ne uložená stará verze v cache prohlížeče).
- Podezření na z-index/stacking-context kolizi (proč se prvek
  s vyšším z-index přesto schovává pod jiným).
- Přesné pixelové zarovnání dvou prvků layoutu (dřív, než se to
  potvrdí/vyvrátí ručně přepočtem CSS).

### Snippety pro opakované použití

```javascript
// Ověření nasazené verze (z HTML komentáře na začátku Index.html)
const it = document.createNodeIterator(document, NodeFilter.SHOW_COMMENT);
let n, first = null;
while ((n = it.nextNode())) { if (!first) first = n.textContent; }
first;

// Zjištění z-index/stacking-context řetězce (transform/filter na
// ancestor elementech může "polapit" position:fixed potomky)
function stackingInfo(el) {
  const chain = [];
  let node = el;
  while (node && node !== document.documentElement) {
    const cs = getComputedStyle(node);
    chain.push({ tag: node.tagName, id: node.id, position: cs.position,
      zIndex: cs.zIndex, transform: cs.transform, overflow: cs.overflow });
    node = node.parentElement;
  }
  return chain;
}

// Přesné pixelové zarovnání dvou prvků (right/left okraje)
document.getElementById('A').getBoundingClientRect().right ===
document.getElementById('B').getBoundingClientRect().right;
```

### Gotcha: resize_window nespolehlivě simuluje mobilní viewport
Ověřeno 18. 8. 2026: nastavení užšího viewportu přes claude-in-chrome
`resize_window` (zkoušeno 375×812) neovlivnilo skutečné
`window.innerWidth` stránky, které zůstalo přes 900px — mobilní CSS
breakpointy se tak nikdy nespustily. `resize_window` v tomhle vzdáleném
browser prostředí tedy nespolehlivě zužuje skutečný viewport. Mobilní
vizuální ověření (sbalitelná mapa/kalendář apod.) dělat na reálném
zařízení (Vojtův Android telefon), nebo přes Vojtův vlastní Chrome
DevTools (Ctrl+Shift+M) — ne přes claude-in-chrome `resize_window`.
RF testy tohle omezení nemají (vlastní `New Context` s `viewport`
parametrem, viz sekce M/N testů v `tests/robot/frontend.robot`) a
fungují spolehlivě.

## 8. Flaky testy — obecný princip a náš případ (21. 8. 2026)

### Co je flaky test
Test, který na STEJNÉM kódu a STEJNÉM vstupu jednou projde a podruhé
selže, aniž by se testovaný kód mezitím jakkoli změnil. Liší se od
běžného pádu právě tímhle — deterministický bug spadne pokaždé stejně,
flaky test je nespolehlivý sám o sobě, nezávisle na tom, jestli je kód
v pořádku.

### Hlavní kategorie příčin
- **Časování/race conditions** — test nečeká na správný signál dokončení
  (viz i vlastní historie tohohle projektu: race condition v
  `inicializovatMapu_()`, self-cancel bug v `zvyraznitAkci_`).
- **Sdílený/měnící se stav** — víc testů čte/zapisuje stejná data
  (produkční Sheet, sdílený testovací účet), pořadí běhu ovlivňuje
  výsledek.
- **Vnější závislosti pod zátěží** — síť, backend API (typicky Apps
  Script), třetí strana — reagují pomaleji nebo nespolehlivě při
  vysokém zatížení, ne kvůli chybě v testovaném kódu.
- **Pořadí testů/vedlejší efekty** — test A nechá stav, který ovlivní
  test B, aniž by to bylo zjevné z kódu testu B samotného.
- **Konkurence/paralelismus** — souběžné operace, které se dřív
  nekřížily, začnou kolidovat.

### Proč jsou zákeřné
Podkopávají důvěru v celou testovací sadu ("zase to spadlo, asi nic") —
riziko, že se přehlédne SKUTEČNÁ regrese schovaná mezi šumem. Navíc se
špatně reprodukují na požádání: přesně to, co je dělá neškodnými pro
kód, je dělá těžko prokazatelnými.

### Jak se s nimi správně zachází
- **Nikdy automaticky nepředpokládat "je to jen flake"** — nejdřív
  diagnostikovat (izolovaný rerun, trasování, u zápisových testů i
  přímé ověření dat), teprve pak uzavřít jako flake nebo jako reálný bug.
- **Ověřit dopad na DATA, ne jen na testovací výstup** — hlavně u
  zápisových testů: selhání uprostřed zápisu může nechat sdílený účet
  v nekonzistentním stavu, i když samotný test "jen" timeoutnul.
- **Hledat vzorec napříč víc pokusy** — mění se pokaždé JINÁ sada
  selhávajících testů (ukazuje na vnější zátěž/timing), nebo padá
  VŽDY ten samý test na tom samém místě (ukazuje spíš na reálný bug)?

### Náš konkrétní případ (21. 8. 2026)
- **Kontext**: desítky živých RF běhů proti produkci během jedné dlouhé
  session (audit testovacího dluhu, kroky 1–5).
- **Pozorování**: 3–4 plné běhy sady (50 testů) v řadě, pokaždé jiný
  počet a skladba selhání (45/4, 45/4 s jinou 4. položkou, 44/5).
- **Konzistentně postižené**: `★ Oblíbené`, `✓ Navštívené`, `Označení ★`
  — vždy timeout na ULOŽENÍ. Jediný společný znak: jsou to jediné
  zápisové testy v celé sadě.
- **Diagnóza**: kumulativní zátěž Apps Script platformy po desítkách
  živých běhů za sebou — NE regrese v kódu.
- **Ověření**: cílená izolovaná reprodukce přesně postižené pětice
  testů proběhla čistě, 5/5.
- **Write-safety důsledek**: po každém běhu s tímhle problémem bylo
  nutné ověřit skutečný stav dat (ne předpokládat "nic se nestalo") —
  nalezen `rf-test` se zaseknutou hvězdou 2×, oba případy ručně
  uklizeny a ověřeny ze serveru (reload+login).
- **Poučení pro budoucnost**: při rozsáhlém RF testování v jedné
  session počítat s tímhle typem nestability u zápisových testů,
  nepanikařit, diagnostikovat izolovanou reprodukci PŘED závěrem
  "regrese".
