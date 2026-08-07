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

## 4. Konec pracovní session

Na konci každé pracovní session (rozloučení, „jdu spát", „končím na dnešek",
„díky za dnešek" apod.) **automaticky nabídnout stručné shrnutí v bodech**,
co se ten den udělalo — bez čekání, až o to Vojta výslovně požádá. Tohle je
obecná preference uložená i v paměti Claude (napříč projekty), tady je jen
zapsaná pro viditelnost v repu.

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
  ne celý objekt/pole najednou.

Frontend (`tests/frontend-harness.js`, `nactiFrontendFunkce(['fn1','fn2'])`):
- Vytáhne pojmenované funkce přímo z `<script>` bloku `Index.html` a
  spustí je izolovaně (počítá `{ }`, ne pevný regex — funguje i na
  funkce s vnořenými bloky). Bez DOM, bez `init()`.
- Nutné doplnit do sandboxu globály, které kód používá a `vm` je sám
  nemá (`URLSearchParams` byl jeden takový případ).
- Nová čistá funkce v `Index.html` → přidat její jméno do seznamu v
  `tests/frontend.test.js` a napsat testy stejným stylem jako u
  `gcalUrl_`/`mapsUrl_`/`sestavTextSdileni_`.
