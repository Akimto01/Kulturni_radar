---
name: kulturni-radar-workflow
description: Nasazení, balení, ladění testů (Node i Robot Framework) a údržba dokumentace (CHANGELOG.md/BACKLOG.md) pro projekt Kulturní radar Vojty Čermáka (Apps Script + Google Sheets + GitHub, repo Akimto01/Kulturni_radar). VŽDY použij tento skill, když uživatel žádá o zabalení/nasazení změny v Kulturním radaru, když posílá výstup z Robot Framework testů (obzvlášť pokud něco spadlo), když se má bumpnout verze, nebo když se upravuje Docs/CHANGELOG.md či Docs/BACKLOG.md pro tento projekt. Spouštěj i implicitně při jakékoli práci na souborech kulturni_radar.gs / Index.html / tests/*, i bez výslovné zmínky slova "skill".
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

## 6. Automatizace nasazení do Apps Script (clasp) — prozkoumáno, zatím NEzapojeno

Zkoumáno 8. 8. 2026 jako reakce na to, že krok 5 výše (ruční nasazení)
byl jediný krok v celém release cyklu, který nešel automatizovat.

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

### Proč to NEJDE spustit odsud (Claude v tomhle chatu)
Síťový přístup z tohoto prostředí je omezený na povolený seznam domén
(GitHub, npm, PyPI apod.) — `script.google.com` ani `accounts.google.com`
v seznamu nejsou. I kdyby se `clasp` nainstaloval přes npm (to by šlo),
samotné `clasp login`/`clasp push` by selhalo na síťovém blokování.
**Tohle není řešitelné odsud, jen z prostředí, kde `clasp` reálně běží.**

### Reálná cesta, pokud by Vojta chtěl pokračovat
Jde to udělat přes **Claude Code na jeho vlastním počítači** (plný síťový
přístup, jeho vlastní Google účet už přihlášený v prohlížeči):
1. `npm install -g @google/clasp`
2. Povolit Google Apps Script API v nastavení Google účtu (jednorázově,
   přes web).
3. `clasp login` — otevře prohlížeč, OAuth souhlas, uloží token do
   `~/.clasprc.json`.
4. `clasp clone <scriptId>` NEBO ruční `.clasp.json` se stávajícím
   `scriptId` (Apps Script projekt "Kulturní radar" už existuje, jen se
   k němu clasp musí napojit, ne založit nový).
5. **`~/.clasprc.json` obsahuje access i refresh token** — nikdy
   necommitovat, přidat do `.gitignore` (pravděpodobně tam analogicky
   jako `playwright-log.txt`).
6. Vyzkoušet `clasp push -f` a `clasp deploy --description "vXX"` ručně
   napřed, než se to zapojí do promptu/CI.

### Doporučení
**Zatím nezavádět bez výslovného rozhodnutí Vojty** — vyžaduje to OAuth
souhlas s jeho Google účtem (citlivé oprávnění, ne něco, co se zapojí
"mimochodem"). Až/pokud se Vojta rozhodne pokračovat, je tohle hotový
podklad k tomu, aby to šlo rovnou technicky realizovat, ne znovu zkoumat
od nuly.

### Přenos textových souborů s diakritikou do Claude Code
Ověřeno 8. 8. 2026 (SKILL.md samotný): vkládání textového souboru s
českou diakritikou jako přílohy přímo do promptu (ať už přes kopírování
textu, nebo drag&drop souboru) opakovaně způsobovalo nevratný mojibake
(ztracený C1 control byte) — ověřeno byte-přesně identickým výsledkem
bez ohledu na zdroj/formát přílohy. Spolehlivé řešení: uložit soubor
ručně přímo na disk do repa (mimo chat, mimo přílohy) a požádat Claude
Code, ať ho přečte přímo ze souborového systému (svým file/read
nástrojem), ne z přílohy zprávy.

