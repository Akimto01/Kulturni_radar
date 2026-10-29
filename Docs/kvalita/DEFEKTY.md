# Správa defektů – Kulturní radar

Jak se v projektu hlásí, třídí a uzavírají defekty, a zpětná klasifikace
skutečných defektů z října 2026 včetně analýzy úniků: na které úrovni testů měl
být každý defekt chycen a proč nebyl.

Nový defekt se zakládá formulářem **Defekt** (Issues → New issue). Formulář
ho rovnou přidá na [board](https://github.com/users/Akimto01/projects/1), kde se
mu nastaví pole *Závažnost*, *Priorita*, *Jak nalezeno* a *Stav defektu*.
Podrobné technické záznamy oprav jsou v [CHANGELOG.md](../CHANGELOG.md), tři
nejzajímavější defekty jsou rozepsané v [PRIBEHY-CHYB.md](PRIBEHY-CHYB.md).

## Závažnost (dopad chyby)

| Stupeň | Název | Definice | Příklad z projektu |
|---|---|---|---|
| **S1** | Kritická (*Blocker/Critical*) | Bezpečnost, únik nebo ztráta dat. Appka ohrožuje uživatele nebo je nepoužitelná. | Únik PINu a ntfy tématu ve veřejných reportech (#33) |
| **S2** | Vysoká (*Major*) | Hlavní funkce nefunguje nebo ukazuje chybná data a nejde to obejít. | Města s diakritikou bez akcí (#31) |
| **S3** | Střední (*Normal*) | Funkce funguje s omezením nebo s nepřesnými či neúplnými daty. | Chybějící počasí a souřadnice (#18) |
| **S4** | Nízká (*Minor*) | Zavádějící informace nebo drobná chyba, která nebrání použití. | Hláška prázdného stavu s časem jiného města (#27) |
| **S5** | Triviální (*Trivial*) | Čistě kosmetická vada: překlep, zarovnání, barva. | zatím žádný |

## Priorita (naléhavost opravy)

| Stupeň | Název | Kdy řešit | Typický případ | Lhůta pro kontrolu |
|---|---|---|---|---|
| **P1** | Okamžitá (*Highest*) | Ihned, ostatní práce počká. | S1, nebo S2, na kterou narazí každý | 1 den |
| **P2** | Vysoká (*High*) | V téže nebo nejbližší pracovní session. | S2 s omezeným dopadem, S3 postihující všechny | 3 dny |
| **P3** | Střední (*Medium*) | Podle plánu, zhruba do dvou týdnů. | běžná položka Doporučeného pořadí v BACKLOGu | 14 dní |
| **P4** | Nízká (*Low*) | Až na ni přijde řada, bez termínu. | Testovací dluh, drobnosti | bez lhůty |
| **P5** | Sledovat (*Lowest*) | Zapsat a sledovat, opravit jen pokud se zhorší. | položky „Sledovat, bez akce“ v BACKLOGu | bez lhůty |

Lhůta je doba od založení defektu, do které se má začít řešit nebo aspoň ověřit; lhůtu hlídá kontrola boardu (`.github/scripts/kontrola-boardu.py`) jako varování „defekt po lhůtě“, ne jako chybu. Měří se od založení, protože GitHub neukládá, kdy se změnila Priorita. Defekt ve stavu Ověřuje se se nehlídá (čeká na data, ne na práci). Lhůty jsou konstanta `LHUTY_DNI` v `.github/scripts/gh_projekt.py`.

**Závažnost popisuje dopad chyby, priorita pořadí její opravy.** Většinou jdou
spolu, ale ne vždy: závod pozdních odpovědí (#26) je S2, protože zobrazí chybná
data, ale běžný uživatel na něj narazí jen při velmi rychlém přepínání měst, proto
P2. Opačný případ by byl překlep v názvu appky na úvodní obrazovce: S5, ale kvůli
dojmu z appky P1. Priorita se v čase může měnit (třeba před otevřením appky
přátelům), závažnost zůstává, dokud se nezmění chování chyby.

## Životní cyklus

| Stav | Význam | Kdo a kdy ho nastaví |
|---|---|---|
| **Nový** | Nahlášeno, zatím neposouzeno. | při založení |
| **Potvrzený** | Chyba se zreprodukovala nebo je doložená, má závažnost a prioritu. | po prvním posouzení |
| **V opravě** | Probíhá diagnóza kořenové příčiny a oprava. | při zahájení práce |
| **Ověřuje se** | Oprava je nasazená, čeká se na ověření v produkci nebo v datech. | po nasazení |
| **Uzavřený** | Oprava ověřená, regresní test nebo pojistka existuje. | po ověření |
| **Zamítnutý** | Nejde o chybu (záměrné chování, duplicita). | při posouzení |
| **Nereprodukovatelný** | Chybu se nepodařilo vyvolat, zapsáno pro případ opakování. | při posouzení |

Defekt se uzavírá až po ověření v produkci, ne po nasazení: řada oprav v tomto
projektu závisí na datech, která přinese až další běh (týdenní kontrola, samotest).

### Uzavírací komentář

Při zavření defektu se přidá komentář s těmito čtyřmi sekcemi (vzor ke zkopírování; kontrola úplnosti hledá všechny čtyři názvy). Pak se na boardu nastaví Stav defektu Uzavřený (Status Done se nastaví sám).

```markdown
### Kořenová příčina
Co a proč bylo špatně (funkce, podmínka, data).

### Oprava
Backend vX.YY, Index.html vX.YY, commit abc1234. Co se změnilo.

### Regresní test
Název testu (soubor). Mutace: co se v kódu vrátilo a že test spadl.

### Analýza úniku
Na které úrovni testů měl být defekt chycen, proč nebyl a co se změnilo, aby se to neopakovalo.
```

## Jak nalezeno

Pole sleduje, která aktivita defekt odhalila. Hodnoty: *Automatický test
(jednotkový)*, *Automatický test (E2E nebo API)*, *Živá kontrola*, *Monitoring nebo
samotest*, *Analýza nebo review*, *Uživatel*. Živá kontrola znamená průzkumné
testování na produkci (web, API, data v tabulce), typicky při ověření po nasazení.
Počítá se aktivita, která defekt odhalila poprvé.

## Kontrola úplnosti

Skript `.github/scripts/kontrola-defektu.py` projde všechny issues se štítkem bug a jen čte (nic neopravuje): hlídá (a) vyplněná pole boardu a milník, (b) sekce formuláře `defekt.yml` a titulek „Defekt: “ (výjimka pro issues do #33, které vznikly před formulářem), (c) soulad stavů (zavřené = Uzavřený, Zamítnutý nebo Nereprodukovatelný a Status Done, otevřené = jiný stav), (d) uzavírací komentář se čtyřmi sekcemi u zavřených defektů (u starších stačí komentář „Zpětná klasifikace“ s analýzou úniku) a (e) shodu tabulky klasifikace v tomto souboru s boardem. Výstup je tabulka nálezů, při nálezu exit 1.

Správu boardu a BACKLOGu pro všechna issues (nejen bug) hlídá druhý skript `kontrola-boardu.py` (chyby a varování, viz jeho hlavička) a `navrh-session.py` navrhuje práci podle času; všechny tři mají přepínač `--json` a sdílejí načítání z GitHubu v `gh_projekt.py`.

**Automatický běh.** Workflow `.github/workflows/kontrola-projektu.yml` spouští skripty denně v 6:40 UTC (7:40 SEČ, 8:40 SELČ) bez session; v pondělí jako týdenní souhrn. Denní režim pošle notifikaci (ntfy) jen při chybě kontroly, defektu P1 nebo P2 po lhůtě nebo termínu dnes či v minulosti, jinak je ticho. Pondělní režim pošle souhrn vždy: počty chyb a varování, otevřené defekty podle priority, In Progress, termíny na týden a návrh práce na 3 h. Při selhání samotné kontroly (typicky vypršelý token) přijde upozornění. Nic se nenahrává jako artefakt, zpráva obsahuje jen čísla a názvy issues z veřejného repa. Ruční spuštění (workflow_dispatch s volbou režimu) i spouštění skriptů při „Start“ a „End“ zůstává.

**Token.** Board je uživatelský projekt účtu Akimto01 (ne organizace) a výchozí `GITHUB_TOKEN` ho nepřečte. Fine-grained token ho číst neumí: GitHub mezi omezeními uvádí přístup k projektům vlastněným uživatelským účtem a v Account permissions není Projects (oprávnění Projects existuje jen pro organizace). Použit je proto classic token `BOARD_READ_TOKEN` s jediným scope `read:project` (jen čtení uživatelských i organizačních projektů, žádný přístup k repu), uložený v secrets repa a předaný jen kroku, který spouští kontroly. Platnost je do 27. 1. 2027, obnova je naplánovaná jako issue „Obnovit BOARD_READ_TOKEN“ (#51) s Termínem 20. 1. 2027; po vypršení workflow selže a pošle upozornění.

**Proč je riziko přijatelné.** Token je jen pro čtení, repo i board jsou veřejné a obsah issues je tedy veřejný, takže únik tokenu neprozradí nic, co už není vidět, a nic nejde změnit. Classic token nejde omezit na jedno repo ani jeden projekt, ale na účtu Akimto01 je jediný projekt (Kulturni radar - prace, ověřeno v prohlížeči), takže token nepřečte nic jiného. **Pozor:** nový projekt založený na tomto účtu by byl tímto tokenem také čitelný; při zakládání dalšího boardu zvážit, zda je to v pořádku, případně token zúžit nebo nahradit. Dřívější úvaha, že samostatný secret jen kvůli kontrole nechceme (viz #33, kde se tajné hodnoty dostaly do reportů testů), je splněna jinak: token je jen pro čtení, nepoužívá se nikde jinde a nic z běhu se neukládá.

## Zpětná klasifikace defektů 26.–28. 10. 2026

| Issue | Defekt | Závažnost | Priorita | Jak nalezeno | Stav |
|---|---|---|---|---|---|
| [#33](https://github.com/Akimto01/Kulturni_radar/issues/33) | Únik tajných hodnot v reportech CI | S1 | P1 | Analýza nebo review | Uzavřený |
| [#31](https://github.com/Akimto01/Kulturni_radar/issues/31) | Města s diakritikou bez akcí | S2 | P1 | Živá kontrola | Uzavřený |
| [#17](https://github.com/Akimto01/Kulturni_radar/issues/17) | Proběhlé akce na webu (sériové číslo data) | S2 | P1 | Živá kontrola | Uzavřený |
| [#26](https://github.com/Akimto01/Kulturni_radar/issues/26) | Závod pozdních odpovědí při přepínání měst | S2 | P2 | Automatický test (E2E nebo API) | Uzavřený |
| [#18](https://github.com/Akimto01/Kulturni_radar/issues/18) | Počasí ve stavu CHYBA, chybějící souřadnice | S3 | P2 | Živá kontrola | Ověřuje se |
| [#23](https://github.com/Akimto01/Kulturni_radar/issues/23) | Akce s datem „neuvedeno“ | S3 | P3 | Živá kontrola | Uzavřený |
| [#21](https://github.com/Akimto01/Kulturni_radar/issues/21) | Duplicity stálých míst | S3 | P3 | Analýza nebo review | Uzavřený |
| [#27](https://github.com/Akimto01/Kulturni_radar/issues/27) | Hláška prázdného stavu s časem jiného města | S4 | P3 | Automatický test (E2E nebo API) | Uzavřený |
| [#48](https://github.com/Akimto01/Kulturni_radar/issues/48) | Tichá selhání: samotest nehlídá triggery `sendUserNotifications` a `zpracovatSledovanaMesta`, `sendUserNotifications` nehlásí chybu | S3 | P3 | Analýza nebo review | Potvrzený |
| [#49](https://github.com/Akimto01/Kulturni_radar/issues/49) | Sledovaná města: běh narazí na limit 6 min, přepočet počasí se nespustí a selhání se nenahlásí | S3 | P2 | Živá kontrola | Ověřuje se |
| [#50](https://github.com/Akimto01/Kulturni_radar/issues/50) | Server neověřuje identitu uživatele u zápisových akcí: stačí veřejné `uzivatelId` | S2 | P3 | Analýza nebo review | Potvrzený |
| [#4](https://github.com/Akimto01/Kulturni_radar/issues/4) | Cloudflare: crawlery GPTBot a ClaudeBot blokované, `robots.txt`, `sitemap.xml` a `favicon.svg` se na kulturniradar.cz neservírují (doplněno 29. 10. při kontrole úplnosti) | S4 | P4 | Živá kontrola | Potvrzený |

#48 (29. 10. 2026) je první defekt založený formulářem `defekt.yml`, ne zpětnou klasifikací: nalezen čtením kódu při psaní tabulky triggerů v `PROVOZ.md` (#47), oprava spolu s testy v #35.

#49 (29. 10. 2026) našla živá kontrola při ověřovačce #6: čtvrteční běh `zpracovatSledovanaMesta` skončil na časovém limitu 6 minut (361 s) uprostřed volání AI třetího města a přepočet počasí se vůbec nespustil. Čtení kódu potvrdilo, že rozpočet 4,5 minuty se kontroluje jen před městem (město trvá kolem 2 minut), počasí běží až za smyčkou a přerušení na limitu se nikam nezapíše. Hypotéza, že datum na hraně předpovědi (dnes + 7) skončí jako CHYBA místo NA, se nepotvrdila: `vyhodnotPocasiUdalosti_` vrací CHYBA jen tehdy, když neodpověděl Open-Meteo ani met.no; tři záznamy CHYBA s datem 5. 11. jsou nejspíš starší stav, který se kvůli #49 nepřepsal. Samostatný defekt proto nevznikl.

#4 (založeno 31. 8. 2026 z BACKLOGu) bylo při kontrole úplnosti 29. 10. 2026 klasifikováno zpětně: S4 (appka funguje, jen není dohledatelná pro AI crawlery a chybí soubory pro indexaci), P4 (bez časové tísně, vyžaduje práci v Cloudflare dashboardu), Živá kontrola (po nasazení v3.58 se `curl` na `robots.txt` a `sitemap.xml` vrátil SPA fallback; blokaci crawlerů Cloudflare podle dokumentace přidává do `robots.txt` automaticky).

#50 (29. 10. 2026) našlo čtení kódu při psaní testů #35 dávky 4: akce `toggle`, `toggle-misto`, `filtry`, `set-notifikace` a `vygenerovat-ntfy-tema` berou jen veřejné `uzivatelId` (seznam profilů vrací `api=uzivatele` bez přihlášení), takže jde měnit cizí data a přesměrovat cizí notifikace na libovolný e-mail. Závažnost S2, priorita P3, protože dnes appku používá jen rodina; musí se vyřešit před otevřením přátelům (Cíl 2), souvisí s #16.

#18 zůstává ve stavu *Ověřuje se* a issue je proto otevřená: oprava počasí
a souřadnic čeká na ověření v datech po čtvrtečním běhu sledovaných měst (issue #6).
Duplicitu stálých míst (#21) poprvé zaznamenal rozbor dat při přípravě quality
checku (7.–8. 10. 2026), živá kontrola 26. 10. ji potvrdila.

## Analýza úniků

U každého defektu: na které úrovni testů **měl** být chycen, proč nebyl a co se
změnilo, aby se to neopakovalo.

| Issue | Měl být chycen | Proč unikl | Co se změnilo |
|---|---|---|---|
| #33 | Review testovací infrastruktury při zveřejnění repa (8. 10.) | Review před zveřejněním kontrolovalo repo a jeho historii (Secret scanning), ne obsah artefaktů CI; GitHub tajné hodnoty maskuje jen v konzoli běhu, ne v souborech, které si testy vytvoří | Automatická kontrola úniku v CI před nahráním reportů, výměna hodnot |
| #31 | E2E test | Testy jely jen s Brnem (bez diakritiky); ruční kontrola ostatních měst šla přímo přes API, ne přes appku | E2E test s dynamicky vybraným městem s diakritikou, 4 jednotkové testy |
| #17 | Jednotkový test | Testy znaly jen textové datum; řádky se sériovým číslem nejspíš vznikly jednorázovou ruční úpravou dat (podle rozboru v3.48) | 6 jednotkových testů pro sériové číslo |
| #26 | Jednotkový test nebo E2E test | E2E test čekal na „nějakou“ kartu, tedy i na staré karty, a chyba se projevila jen při pomalé odpovědi serveru | Ochrana proti pozdní odpovědi, 4 jednotkové testy, přepracovaný E2E test |
| #18 | Monitoring (podíl akcí se souřadnicemi a počasím) | Neúspěšné geokódování se nikdy nezopakovalo a nic nesledovalo úplnost dat | 13 jednotkových testů, denní dohledání souřadnic, HTTP kódy v logu |
| #23 | Validace vstupu při zápisu, samotest | Výstup AI se bral jako spolehlivě ve správném formátu | Akce bez data se nezapíše, samotest ji nahlásí, 6 jednotkových testů |
| #21 | Samotest (kontrola duplicit) | Kontrola duplicit existovala jen pro akce, ne pro stálá místa | Párování míst podle klíče názvu, 8 jednotkových testů |
| #27 | E2E test | Předchozí oprava (v3.59) se ověřovala přes URL parametr, ne přepnutím města, jak to dělá uživatel | Přepracovaný E2E test přepnutí profilu, 4 jednotkové testy |
| #50 | Jednotkový test zápisových API nebo review API | E2E testy běží vždy přihlášené (Suite Setup se přihlašuje PINem), takže chybějící ověření u zápisů neuvidí; jednotkové testy zápisových API autorizaci neměly v zadání a ověřovaly jen správnost zápisu | otevřeno; po opravě test odmítnutí zápisu bez ověření |

### Co z toho plyne

- **Šest z osmi defektů neodhalily automatické testy**, ale živá kontrola
  a analýza dat. Proto jsou živé kontroly pravidelnou součástí práce (ověření po
  nasazení, průzkum webu a dat), ne náhrada automatizace: každý defekt nalezený
  ručně skončil novým automatickým testem nebo pojistkou.
- **Opakující se příčina úniků: testovací data a cesta.** Tři defekty unikly,
  protože testy pokrývaly jen jednu třídu vstupů (jen Brno, jen textové datum)
  nebo protože se ověřovalo jinou cestou, než jde uživatel (přímé API, URL
  parametr). Odtud pravidlo: ověřovat cestou uživatele a s daty z různých tříd
  ekvivalence.
- **Druhá opakující se příčina: chybějící monitoring dat.** U #18, #21 a #23 byla
  chyba vidět v datech dlouho předtím, než si jí někdo všiml. Samotest teď hlásí
  úplnost a kvalitu dat každý týden.
