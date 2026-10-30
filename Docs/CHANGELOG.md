# Changelog

## CI: úklid nálezů ruffu a zastaralých tvrzení v dokumentaci – 30. 10. 2026
- **Ruff 17 → 2 nálezy:** opraveno 12× E741 (nejednoznačný název `l` přejmenován na `stitek` a `radek` v `gh_projekt.py`, `kontrola-boardu.py`, `navrh-session.py`, `sestav-notifikaci.py`), 2× B904 (`raise … from e` v `kontrola-dokumentace-kodu.py` a `sestav-notifikaci.py`) a 1× B034 (`re.split(..., maxsplit=1)` v `navrh-session.py`). Zbývají 2× B905 v `generovat-index-reportu.py`, které se do neděle 1. 11. 2026 nemění (BACKLOG, Testovací dluh). Baseline přepsána (`--zapsat-baseline`): Robocop 120 beze změny, ruff 2. Chování skriptů se nezměnilo: samotesty všech dotčených skriptů a ostré běhy kontrol prošly.
- **Zastaralá tvrzení v dokumentaci (ověřeno proti repu):** README (Stryker už běží v CI, výčet GitHub Actions a struktura repa včetně `.github/scripts/` a `tests/mutace/`, ntfy ve `mutacni-testy.yml`, popis Python skriptů), ARCHITEKTURA-TESTU (B1: strom projektu s `mutace/`, `pokryti-frontendu.js` a aktuálními workflow a skripty), PROVOZ.md (plánované běhy `kontrola-projektu.yml` a `mutacni-testy.yml` v tabulce, `NTFY_TOPIC_DEV` i u `mutacni-testy.yml`).

## CI: Robocop a ruff s baseline (#58) – 30. 10. 2026
- **Nástroje:** `.github/requirements-lint.txt` s pevnými verzemi `robotframework-robocop==9.1.0` (25. 9. 2026) a `ruff==0.17.1` (15. 10. 2026), obě starší než 14 dní. Záměrně ne v `tests/robot/requirements.txt` (instaluje ho týdenní běh `rf-tests.yml`, ten ani `tests/robot/` se před 1. 11. neměnily). V CI se instalují s `-c tests/robot/requirements.txt`, aby se `robotframework` (7.5) nezměnil. Žádný `pyproject.toml` ani jiná konfigurace v kořeni repa.
- **Skript `.github/scripts/kontrola-lintu.py`:** spustí Robocop nad `tests/robot/` (JSON report) a ruff nad `.github/scripts/` (JSON), spočítá nálezy podle pravidla a porovná je s `.github/scripts/baseline-lint.json`. CI selže jen při nárůstu (i nové pravidlo mimo baseline), pokles vypíše a vyzve ke snížení baseline (`--zapsat-baseline`). Krok „Lint“ v jobu `rf-dryrun` (`node-tests.yml`): instalace, samotest, ostrá kontrola.
- **Konfigurace s vypnutými pravidly (zdůvodnění přímo v souborech):** `.github/robocop.toml` vypíná `LEN08` (délka řádku: česká dokumentace testů), `NAME02` a `NAME18` (české názvy klíčových slov ve větném tvaru, ne Title Case), `NAME01` (verze s tečkou v názvu testu, např. „regrese v3.65“) a nastavuje pořadí `ORD01` podle projektu ([Tags] před [Documentation], [Teardown] před tělem testu). `.github/ruff.toml` vybírá `E`, `F`, `W`, `B` a vypíná `E501` (dlouhé řádky s českými hláškami), `E701`, `E702` a `E731` (jednořádkové pomocné funkce v samotestech).
- **Baseline k 30. 10. 2026:** Robocop 120 nálezů ve 23 pravidlech (bez konfigurace 293), ruff 17 nálezů ve 4 pravidlech. Žádný soubor v `tests/robot/` se neměnil (nálezy se jen počítají).
- **Samotest (15 zkoušek):** porovnání počtů (beze změny, nárůst, nové pravidlo, pokles) a negativní zkouška na dočasných souborech: beze změny = exit 0, nový nepoužitý import (ruff) a nový test s mezerami na konci řádku (Robocop) = exit 1, pokles = exit 0 s výzvou ke snížení baseline. Vlastní nález skriptu (`raise` bez `from`) se opravil, ne zapsal do baseline.
- **Dokumentace:** README (soupis nástrojů, `kontrola-nastroju.py` prošla), ARCHITEKTURA-TESTU (C1, text pod tabulkou, Známé mezery), AGENTS.md (příkaz), SKILL.md (obě kopie), `mapa-kod-dokumentace.json` (+3 položky: `ruff.toml`, `robocop.toml`, `requirements-lint.txt`), BACKLOG (bod 22, věta o mapování #62 u Větších témat).

## CI: varování „kód změněn, dokument ne“ (#62) – 30. 10. 2026
- **Skript `.github/scripts/kontrola-dokumentace-kodu.py`** (standardní knihovna, jen čte git, jen varování, exit 0; exit 2 jen při rozbité mapě nebo selhání gitu). Období `--od` (datum nebo git ref, výchozích 7 dní): pro každý commit se z `git show` zjistí změněné soubory a u funkcí z mapy změněné řádky (`-U0`), které se přiřadí k funkci podle řádků `function nazev(` ve verzi souboru v daném commitu. Varování, když se změnil kód z mapy a příslušný dokument v celém období vůbec ne (změna dokumentu v jakémkoli commitu období ho „obnovuje“). Commit se značkou `[bez-dokumentace]` se nepočítá. Výstup: seznam (dokument, kód, funkce, důvod, commity) nebo `--json`.
- **Mapa `.github/scripts/mapa-kod-dokumentace.json`** (12 položek): `setupTriggers` → PROVOZ.md; `doGet`, `doPost`, `routePost_` → ARCHITEKTURA-APLIKACE.md; workflow a `kontrola-*.py` → ARCHITEKTURA-TESTU.md; `sestav-notifikaci.py`, `navrh-session.py` a `defekt.yml` → DEFEKTY.md; `tests/mutace/**` a `stryker.config.json` → MUTACNI-TESTOVANI.md; `tests/mutace/package.json` a nová složka v kořeni → AGENTS.md; `cloudflare-worker/**` → ARCHITEKTURA-APLIKACE.md. Skript při načtení ověří, že každý dokument existuje a každá funkce je v souboru (rozpad mapy = chyba skriptu, ne ticho).
- **Samotest (18 zkoušek, dočasné git repo):** kód bez dokumentu varuje; s dokumentem v období, změna mimo mapované funkce a značka `[bez-dokumentace]` nic; dokument změněný před obdobím nestačí; vzor `*.yml`, nová složka v kořeni, období od data (staré a nové commity, budoucí datum), neexistující dokument, funkce a položka bez důvodu = chyba skriptu; mapa v repu projde. Běží v `node-tests.yml` (job `rf-dryrun`).
- **Zapojení:** SKILL.md (End: spustit s `--od` začátkem session a varování ukázat), pondělní přehled #52: sekce „Dokumentace k revizi“ jen v plném přehledu (`sestav-notifikaci.py --dokumentace`, +11 zkoušek v samotestu, celkem 137; chybějící nebo neplatný soubor přehled nezboří), `kontrola-projektu.yml`: checkout s `fetch-depth: 0` a krok bez tokenu jen v pondělním režimu. Krátká notifikace beze změny.
- **Ověřeno na skutečných datech (30. 10. 2026):** posledních 7 dní (120 commitů) a dnešek (9 commitů) bez varování; `--od 757699b` (po případové studii) varuje: `kontrola-boardu.py` změněn v 11685c0 (milníky, #63), ARCHITEKTURA-TESTU v období beze změny.
- **Dokumentace:** ARCHITEKTURA-TESTU (C1), AGENTS.md (příkaz mezi kontrolami), SKILL.md (obě kopie), DEFEKTY.md (pondělní souhrn), BACKLOG (bod 25). Ruční běh workflow se tentokrát nespouštěl.

## CI: sklonování počtů a duplicita v pondělním přehledu – 30. 10. 2026
- **Sklonování (`sestav-notifikaci.py`):** jedna funkce `pocet(n, slovo, pad)` s tabulkou tvarů `TVARY` pro všechna místa s počty v notifikaci i přehledu: „1 chyba“, „2 chyby“, „5 chyb“, „0 chyb“ (4. pád „hlásí 1 chybu“), „nález“, „varování“ (ve všech tvarech stejné) a „termín“. Dřív byly „1 chyb“ a „0 nálezů“ natvrdo v textu, jen krátká notifikace skloňovala.
- **Duplicita v #52:** chyba kontroly boardu, nález kontroly defektů, defekt P1 nebo P2 po lhůtě a termín dnes či v minulosti se vypsaly v „Naléhavé“ a znovu pod řádkem s počty. Pod počty zůstává jen to, co v „Naléhavé“ není (třeba varování o WIP limitu nebo chyby nad limit 8 řádků, aby se nic neztratilo).
- **Samotest:** +22 zkoušek (sklonování 0, 1, 2, 5 a hranice 4 a 21 pro chybu, varování, nález, termín; denní režim „hlásí 1 chybu“; duplicita v textu i v Markdownu, nad limit, bez nálezů); celkem 126.
- **Postup:** SKILL.md (obě kopie) a AGENTS.md: issue s přeškrtnutím v BACKLOGu zavřít hned po pushi a CI, kontroly i ruční běh `kontrola-projektu.yml` spouštět až po zavření (falešný nález z #57 a #63).

## CI: průběh milníků v pondělním přehledu (#63) – 30. 10. 2026
- **Sekce „Milníky“ v plném přehledu (issue #52):** pro každý otevřený milník řádek „Cíl N: X z Y issues hotovo, Z In Progress, zbývá odhadem H h“. Hotovo = zavřená issues, odhad = součet Odhadu (h) otevřených; u otevřených issues bez Odhadu se připojí „(u N bez Odhadu)“ (odhad je pak dolní mez), milník bez issues říká „zatím žádné issues“. Issues se štítkem `prehled` se nepočítají. Sekce stojí za otevřenými chybami a před In Progress.
- **Data:** `kontrola-boardu.py --json` má v souhrnu nový klíč `milniky` (funkce `milniky()`), spočtený z issues a boardu, které skript už načítá. Seznam otevřených milníků se čte jedním voláním `gh api repos/…/milestones` stejným tokenem (kvůli prázdným milníkům, které na boardu nejsou vidět); při selhání se odvodí z otevřených issues. Žádný nový token ani scope. `sestav-notifikaci.py` starší JSON bez klíče `milniky` zpracuje bez sekce.
- **Krátká notifikace se nemění:** všech 6 řádků je obsazeno (stav kontrol, rozpracováno, otevřené chyby, termíny, Na řadě, výzva), milníky by byly sedmý, takže tam nejsou. Hlídá to test.
- **Samotesty:** `kontrola-boardu.py --test` (+7 zkoušek: hotovo z celkem bez prehledu, In Progress, odhad jen otevřených, issue bez Odhadu, milník bez issues, odvození z issues) a `sestav-notifikaci.py --test` (+11 zkoušek: formát řádku, milník bez issues, issues bez Odhadu, hotový milník, starší JSON, krátká notifikace beze změny, Markdown). Živá data k 30. 10. 2026: Cíl 1 22 z 44, Cíl 2 5 z 14 (6 bez Odhadu), Cíl 3 6 z 10, Cíl 4 bez issues.
- **Dokumentace:** DEFEKTY.md (popis pondělního souhrnu), BACKLOG (bod 26).

## Docs: případová studie na jednu stránku (#57) – 30. 10. 2026
- **`Docs/PRIPADOVA-STUDIE.md`:** čtenář je hodnotitel nebo manažer se třemi minutami. EN abstrakt (2 věty ve stylu README) a sekce Výchozí situace, Výzvy (AI, platby za běh, limity Apps Scriptu, veřejné repo), Přístup (rizika, pyramida, CI s pojistkami, správa defektů, mutační testování, kontroly projektu), Výsledky, Co bych příště udělal jinak (notifikace CI od začátku, třídy ekvivalence, tajné hodnoty v artefaktech před zveřejněním), Kam dál.
- **Pravidlo pro čísla:** čísla s datem jsou historické fakty a v textu zůstávají; aktuální stav (počty testů, pokrytí, skóre) je jen odkazem na README a D3. Každé číslo ověřeno proti CHANGELOGu, D3, DEFEKTY.md a historii běhů: 20 testů (2. 8.) a 656 (29. 10.), mutační skóre 78,1 → 96,9 % (29. 10.), pokrytí backendu 82,2 % (28. 10.) → 92,0 % (29. 10.), 231 z 232 běhů rychlé sady, 7 z 22 týdenních běhů zelených, 2 z 8 defektů z automatizace, 66 dní, 80 dní u #31, 20 dní od zveřejnění repa u #33, 0,12 USD za běh hledání, 361 s u #49.
- **Zařazení:** README (první řádek „Pro hodnotitele“), `Docs/README.md` (mapa a rozcestník: CEO, Partner a Hodnotitel mají stav „máme“, „plánováno #57“ zmizelo).
- **Revize:** issue #69 „Revize případové studie“ (štítek docs, Cíl 1, Backlog, Termín 30. 1. 2027, Odhad 0,25 h) s tím, co ověřit: čísla s datem beze změny, odkazy, nové významné výsledky.

## Docs: historie incidentů a kontrola (#61) – 30. 10. 2026
- **`Docs/kvalita/HISTORIE-INCIDENTU.md`:** úvod (co je incident: dopad na uživatele nebo provoz, ne každá chyba, doba = od vzniku do opravy) a tabulka datum, co se stalo, dopad, doba, odkaz. Šest řádků: uzavřené defekty S1 a S2 (#17, #26, #31, #33), 66 dní nesledované CI a #49 (S3, ověřuje se, zapsáno na žádost jako provozní incident).
- **Ověření dat:** proti gitu (data commitů, `git log -S`), CHANGELOGu, issues a PRIBEHY-CHYB.md; 66 dní = 23. 8. až 28. 10. (první červený plánovaný běh, `gh run list`) potvrzeno, shoduje se s ARCHITEKTURA-TESTU (D3). Nesrovnalosti byly vypsány uživateli, v jiných dokumentech se neopravovaly.
- **`kontrola-defektu.py`, pravidlo f):** uzavřený defekt (Stav defektu Uzavřený) se závažností S1 nebo S2 musí mít v tabulce incidentů odkaz `[#N](…/issues/N)` v posledním sloupci. Zmínka o issue jinde nestačí; otevřený a zamítnutý defekt řádek nepotřebují. `--test` (7 zkoušek, bez sítě): S1 a S2 bez řádku jsou nález, S2 s řádkem, S3 bez řádku, otevřený S2 a zamítnutý S2 projdou, parser bere jen poslední sloupec. Samotest běží v `node-tests.yml` (job `rf-dryrun`), ostrou kontrolu dělá `kontrola-projektu.yml`. Ostrý běh: 12 defektů, bez nálezů.
- **Dokumentace:** Docs/README.md (mapa, role Provoz a Bezpečnost; z role Provoz zmizelo „plánováno #61“), DEFEKTY.md (krok uzavírací šablony a pravidlo f), ARCHITEKTURA-TESTU (C1), SKILL.md (obě kopie), BACKLOG (bod 24).

## CI: kontrola odkazů a úplnosti rozcestníku (#56) – 30. 10. 2026
- **Skript `.github/scripts/kontrola-dokumentace.py`** (standardní knihovna, jen čte, `--test`), krok v jobu `rf-dryrun` workflow `node-tests.yml` vedle kontroly počtů testů a nástrojů, každý push a PR. Kontroluje: (1) relativní odkazy v README, AGENTS.md, CLAUDE.md a `Docs/**` vedou na existující soubor se stejnou velikostí písmen jako na Linuxu, kotvy `#nadpis` na existující nadpis podle pravidel GitHubu (malá písmena, mezery na pomlčky, interpunkce pryč, diakritika zůstává, opakovaný nadpis dostane `-1`); odkazy v blocích kódu a v inline kódu se přeskočí; (2) každý `.md` v `Docs/` je v `Docs/README.md` a všech 11 rolí má řádek v „Podle rolí“; (3) „plánováno #N“ ukazuje na otevřené issue, zavřené je varování (stav čte `gh` s `GITHUB_TOKEN`, bez tokenu se bod přeskočí s výpisem).
- **Výjimky:** `Docs/archiv/` a `Docs/CHANGELOG.md` se jako zdroje odkazů nekontrolují (historické cesty), odkazy na ně z ostatních dokumentů ano. Konstanta `VYNECHAT_ZDROJE` s odůvodněním ve skriptu.
- **Samotest (13 zkoušek):** čistá data projdou; rozbitý odkaz, neexistující kotva, jiná velikost písmen v cestě, nezařazený dokument a chybějící role skončí chybou; zavřené issue a nezjištěný stav jsou jen varování; pět nadpisů dá správnou kotvu.
- **Ostrý běh na repu:** 19 souborů, 0 chyb, 0 varování.
- **Dokumentace:** ARCHITEKTURA-TESTU (C1), SKILL.md (obě kopie, nový dokument v `Docs/` = řádek v rozcestníku), AGENTS.md (příkaz mezi kontrolami repa), BACKLOG (bod 20). Workflow `rf-tests.yml` ani `publikovat-report.yml` se neměnily.

## Docs: rozcestník podle rolí (#55) – 30. 10. 2026
- **Sekce „Podle rolí“ v `Docs/README.md`:** 11 rolí (PM, CEO, partner, QA lead, hodnotitel, vývojář a AI agent, bezpečnost, provoz, AI specialista, právník, UX), sloupce role, co hledá, kam jít, stav (máme / základ / plánováno #N). Odkazy vedou jen na existující dokumenty, u plánovaného na issue; kdo nemá dokument (právník), má „zatím žádný dokument“.
- **Stav podle skutečnosti v repu, ne podle výchozího odhadu z issue:** vývojář a AI agent je **máme** (od #53 je AGENTS.md, výchozí odhad říkal „základ“); provoz a QA lead zůstávají máme.
- **README:** jeden řádek v „Pro hodnotitele“ s odkazem na rozcestník.
- **Údržba:** při zavření příslušného issue přepsat stav; kontrolu úplnosti a odkazů přidá #56.

## Docs: AGENTS.md a CLAUDE.md (#53) – 30. 10. 2026
- **`AGENTS.md` v kořeni repa** je hlavní, nástrojově neutrální vstupní soubor: co je projekt, struktura repa, hlavní příkazy (jednotkové testy, smoke, mutační testy, kontroly), pravidla (nikdy nenasazovat s červenou CI, tajné hodnoty nikdy do repa ani logu, nové testy = počty v README ve stejném commitu, nový nástroj = řádek v README, změna kritické funkce = počkat na mutační CI, verze a dva nasazovací kanály) a odkazy na `Docs/README.md`, README, ARCHITEKTURA-TESTU a skill. Obsah skillu se nekopíruje, jen se na něj odkazuje.
- **`CLAUDE.md`** má několik řádků: odkaz na AGENTS.md a na skill.
- **Ověření souladu:** příkazy a pravidla proti SKILL.md a README (počty testů se v AGENTS.md neopakují, jsou jen v README); `kontrola-poctu-testu.py` a `kontrola-nastroju.py` bez nálezů.
- **Dokumentace:** `Docs/README.md` (mapa, sekce Nástroje), README (struktura repozitáře), BACKLOG (bod 16 přeškrtnut). V `apps-script/`, `tests/robot/` ani ve workflow se nic neměnilo.

## CI: mutační testy (kritická sada s prahem 95 %, týdně celý backend), #13 uzavřeno – 29. 10. 2026
- **Workflow `mutacni-testy.yml`:** kritická sada při `push` a `pull_request` se změnou backendu, `tests/unit.test.js`, `tests/harness.js` nebo `tests/mutace/**`; práh `thresholds.break` 95 (`high` 97) v `stryker.config.json`. Celý backend v sobotu 3:40 UTC a ručně (`workflow_dispatch`, volba `kriticke` nebo `vse`), bez prahu, `timeout-minutes: 90`; selhání plánovaného běhu ohlásí ntfy (`NTFY_TOPIC_DEV` s fallbackem). Reporty (`mutation.json`, `mutation.html`) jako artefakt na 14 dní, `permissions: contents: read`, žádné secrets mimo ntfy. `kontrola-nastroju.py` nic nového nehlásí (jen `actions/*`).
- **`spustit.js --prah N`:** Stryker nemá argument pro práh, skript proto zapíše přepsanou kopii konfigurace do `.stryker-src/` (0 = bez prahu).
- **Ověření prahu:** kritická sada s prahem 95 projde (96,9 %, exit 0). Bez testů dávky 3b-3 klesne `upsertEvents_` z 94,5 % na 90,4 % a běh s prahem 94 skončí kódem 1. Odebrání samotných testů 3b-1 skóre nesníží (zrušenou akci zabíjí i test 3b-5).
- **Naměřeno na Linuxu (GitHub Actions):** kritická sada 96,9 % za 1 min 41 s až 2 min 42 s, celý backend **62,8 %** za 41 min 22 s (5 378 mutantů: 3 373 zabito, 2 timeout, 1 327 přežilo, 676 bez pokrytí; první měření). Stejné skóre kritické sady jako lokálně na Windows.
- **Dokumentace:** MUTACNI-TESTOVANI.md (CI, práh a proč 95, týdenní běh), ARCHITEKTURA-TESTU (C1, D3 včetně skóre celého backendu, Známé mezery), SKILL.md (změna kritické funkce = počkat na mutační CI, pod prahem doplnit testy, práh nesnižovat), BACKLOG (#13 přeškrtnuto, nápad na zlepšení skóre celého backendu).

## Testy: dávka 3 mutačního testování (#13), pevné locale a přísnější MemSheet – 29. 10. 2026
- **Skóre kritických funkcí 87,1 % → 96,9 %** (448 mutantů: 434 zabito, 11 přežilo, 3 bez pokrytí; po dávce 2 a pevném locale: 390, 48, 10). `upsertEvents_`: 138 ze 146 zabito (z 93). Zbývá 14 mutantů, žádný není mezera v testu: 8 ekvivalentních a 6 mezer v kódu (viz [MUTACE-TRIAZ.md](testovani/MUTACE-TRIAZ.md)). Bez ekvivalentních 98,6 %.
- **Pevné locale (oprava #425):** mutant `localeCompare(b, "")` nebyl ekvivalentní, ale závislý na prostředí (výchozí locale stroje a pořadí testů). `spustit.js` nastaví `RADAR_LOCALE=en-US` (a `LANG`, `LC_ALL` pro POSIX; na Windows je ICU ignoruje, ověřeno), `tests/harness.js` podle toho ve vm kontextu obalí `localeCompare` bez locale. #425 je zabitý, srovnání kritické sady před a po: změnil se jen #425. Mimo Stryker se nic nemění.
- **MemSheet (3a):** `getRange` s 0 řádky nebo sloupci vyhodí chybu jako skutečné Sheets. Všech 635 testů prošlo beze změny.
- **Testy (+21, backend 426 na 447, celkem 635 na 656), podskupiny 3b-1 až 3b-5:** zrušená akce, změna data a stavu, sloupec Změna a cizí profil, duplicity v jednom běhu a indexy ID a fuzzy, prázdný list a list s jedním řádkem, seznamy názvů ve statistikách (včetně kategorií a akce bez názvu). Každý nový test zabíjí aspoň jeden mutant (ověřeno test po testu).
- **Nález:** #170 (název v indexu fuzzy u akce bez názvu) je ekvivalentní, přesun do (b). V `apps-script/` se nic neměnilo.

## Testy: dávka 2 mutačního testování (#13) – 29. 10. 2026
- **Skóre kritických funkcí 82,4 % → 86,8 %** (448 mutantů: 389 zabito, 49 přežilo, 10 bez pokrytí; před: 369, 65, 14). `digestRange_`: 52 z 53 mutantů zabito (z 32). Zabito 20 z 21 mutantů dávky 2 z triáže, žádný dříve zabitý nepřežil.
- **Testy (+5, backend 421 na 426, celkem 630 na 635):** `digestRange_` ořízne profil s mezerami kolem názvu; bez stálých míst blok „Stálá místa“ vůbec není (chybí list i list jen s hlavičkou); `weeklyDigest` spuštěný v neděli bere jako sobotu poslední den okna; blok stálých míst přesně po řádcích: seskupení podle typu, česky řazené typy (`hrad`, `chrám`, `ostatní`, `zoo`), nadpis „· Hrad“, chybějící typ = „Ostatní“, otevírací doba jen když je; u míst počasí na sobotu s obcí, předpověď se stahuje jednou za obec.
- **Ověření testů:** každý nový test zabíjí aspoň jeden mutant (test po testu proti aktivnímu mutantu v zachovaném sandboxu), žádné nové volby harnessu.
- **Nález: mutant závislý na prostředí.** #425 (`localeCompare(b, 'cs')` → `""`) test sám zabíjí (prázdný locale vyhodí `RangeError`), v běhu celého souboru ale přežívá: V8 po prvním volání `localeCompare` bez locale (`shrnoutKodySelhani_`) bere prázdný locale jako výchozí collator, a ten je na stroji s `cs-CZ` stejný jako `cs`. Zařazen mezi ekvivalentní (b), v CI s `en-US` by byl zabit. Zbývá dávka 3 (`upsertEvents_`, 45, včetně zpřísnění `MemSheet`).

## Testy: dávka 1 mutačního testování (#13) – 29. 10. 2026
- **Skóre kritických funkcí 78,1 % → 82,4 %** (448 mutantů: 369 zabito, 65 přežilo, 14 bez pokrytí; před: 350 zabito včetně jednoho timeoutu, 84 přežilo, 14 bez pokrytí). Zabito všech 18 mutantů dávky 1 z triáže ([MUTACE-TRIAZ.md](testovani/MUTACE-TRIAZ.md)), bonusem #226 (`upsertEvents_`) a jeden dřívější timeout; žádný dříve zabitý mutant nepřežil. `serioveCisloNaDatum_`: 19 z 19.
- **Testy (+8, backend 413 na 421, celkem 622 na 630):** `parseCzDate_` bez mezery za tečkou nebo s více mezerami; hranice `serioveCisloNaDatum_` (30000 a 80000 nejsou datum, 30001 a 79999 ano); `apiToggle_` zneplatní cache `apiEvents`; `runCheck_`: zaškrtávátko a čas poslední mimořádné kontroly v KRITÉRIÍCH podle typu běhu (mimořádná bez políčka se nespustí, z menu ano, denní KRITÉRIA nemění), souřadnice se zajistí až po zápisu do AKCE, cache se zneplatní; `apiNajdiProUzivatele_`: osobní filtr jen s dojezdem nepřepíše kategorii z KRITÉRIÍ, souřadnice po zápisu. Do existujících testů přibyly aserce `ok: false` u chybových větví `apiSetFiltry_`, `apiToggle_`, `apiNajdiProUzivatele_` a přesný text chyby „Pro profil … nejsou v ZDROJÍCH žádné zdroje“ (`runCheck_`, `apiNajdiProUzivatele_`).
- **Ověření testů:** každý nový test zabíjí aspoň jeden mutant (běh jednotlivých testů proti aktivnímu mutantu v zachovaném sandboxu Strykeru), žádné nové volby harnessu. Zbývá dávka 2 (`digestRange_`, 21) a dávka 3 (`upsertEvents_`, 45, včetně zpřísnění `MemSheet`), viz checklist v #13.

## Testy: mutační testování Strykerem (#13, infrastruktura) – 29. 10. 2026
- **Zapojení:** StrykerJS 10.0.0 (14. 8. 2026, pevná verze) s `tap-runner` nad `tests/unit.test.js`. Nástroje mají vlastní `tests/mutace/package.json` a `package-lock.json`, kořen repa žádný `package.json` nemá (Cloudflare Pages by ho při `git push` mohl instalovat). Spouští se z kořene jedním příkazem `node tests/mutace/spustit.js --kriticke|--funkce …|--rozsah …|--vse`. Stryker nezná příponu `.gs`, skript proto mutuje bajt po bajtu shodnou kopii `.js`.
- **Harness:** `tests/harness.js` při `RADAR_ZDROJ` načte instrumentovanou kopii a předá do vm kontextu jmenný prostor Strykeru (bez toho jsou všechny mutanty `NoCoverage`); bez proměnné se nic nemění (622/622 testů). Vlastní TAP reporter obchází pád vestavěného reporteru na neplatném `Date` (mutant by jinak skončil jako `RuntimeError`, ne zabitý).
- **Ověření:** `serioveCisloNaDatum_` dává 19 mutantů, 17 zabito, 2 přežili (hranice 30000 a 80000, skutečná mezera v testu, ověřeno ruční mutací), 0 chyb; ruční mutace „sériové číslo nerozpoznáno“ z dávky 2 odpovídá zabitému mutantu „podmínka na true“. Kritická sada (10 funkcí z POKRYTI.md): 448 mutantů, 349 zabito, 1 timeout, 84 přežilo, 14 bez pokrytí, **skóre 78,1 %**, 3 min 37 s (4 procesy). Celý backend: 5 378 mutantů, odhad ~40 min.
- **Dokumentace:** README (řádek StrykerJS), ARCHITEKTURA-TESTU (D3 metrika, řádek v C1), nový [MUTACNI-TESTOVANI.md](testovani/MUTACNI-TESTOVANI.md) (spuštění, výklad Killed, Survived, ekvivalentní mutant, NoCoverage, triáž) a odkaz v `Docs/README.md`. `kontrola-nastroju.py` ignoruje pracovní složky `.stryker-tmp`, `.stryker-src` a `reports`.

## README: soupis nástrojů hlídaný v CI – 29. 10. 2026
- **README, sekce „Nástroje a technologie“** (za „Architekturou ve zkratce“): tabulky po oblastech (platforma a provoz, externí služby a API, testování, CI a automatizace, vývoj) s identifikátorem, účelem, umístěním v repu a verzí jen tam, kde je v repu pevně daná. Inventura vychází ze souborů v repu (zdroje, workflow, `requirements.txt`, `package.json`, `wrangler.toml`, `.clasp.json`, `api-tests/`).
- **`.github/scripts/kontrola-nastroju.py`** (jen čte, jen standardní knihovna, `--test`): ze zdrojů pravdy (`package.json` dependencies a devDependencies, `requirements*.txt`, Library v `tests/robot/*.robot`, `uses:` ve workflow mimo `actions/*`, unpkg v `apps-script/*.html`, `.clasp.json`, `wrangler.toml`, podsložky `api-tests/`) sestaví seznam nástrojů a ověří, že každý má v sekci README řádek s identifikátorem v prvním sloupci (volný text a zmínka v jiném sloupci nestačí). Výjimky jsou konstanty se zdůvodněním: standardní knihovny Robot Frameworku (pokrývá je `robotframework`) a oficiální `actions/*` (pokrývá `github-actions`). Exit 1 s výpisem chybějících. Negativní zkoušky: chybějící řádek pro každý nástroj zvlášť, nová závislost v `package.json`, balíček v `requirements.txt`, knihovna RF, akce třetí strany, knihovna z unpkg a nová složka v `api-tests/` bez řádku v README selžou, po doplnění řádku projdou; identifikátor v jiném sloupci, mimo sekci nebo chybějící sekce nestačí.
- **CI:** krok v jobu `rf-dryrun` vedle kontroly počtů testů (samotest, pak ostrá kontrola). SKILL.md (obě kopie): pravidlo „nový nástroj nebo závislost = řádek v README ve stejném commitu“. ARCHITEKTURA-TESTU C1: řádek nové kontroly.

## CI: vývojové notifikace do vlastního tématu NTFY_TOPIC_DEV – 29. 10. 2026
- **Důvod:** vývojové zprávy z GitHub Actions (denní kontrola projektu, pondělní souhrn, upozornění na selhání) chodily do stejného tématu jako zprávy appky. RF test „Notifikační kanál ntfy je živý“ počítá jakékoli zprávy v tématu za 48 h, takže mohl projít jen díky vývojovým zprávám, i kdyby byl kanál appky mrtvý. Zprávy se navíc mísily s přehledy akcí.
- **Změna:** `kontrola-projektu.yml` (job `oznameni` a `selhani`) a upozornění na selhání v `rf-tests.yml` berou `secrets.NTFY_TOPIC_DEV || secrets.NTFY_TOPIC` (fallback na starý secret, dokud nový neexistuje); upozornění na selhání mají titulek „Kulturni radar - vyvoj: …“. RF běh, test živosti kanálu appky a kontrola úniku zůstávají na `NTFY_TOPIC`. Popis obou témat je v `PROVOZ.md` a v `SKILL.md` (sekce 9).

## Board: opravy přehledu v issue #52, vývojové titulky – 29. 10. 2026
- **Přehled v #52:** položky „- 1. 11. #7 …“ se v Markdownu vykreslily jako číslovaný seznam a datum se rozpadlo (ověřeno přes GitHub Markdown API: 10× `<ol>`). Tečka za číslem na začátku položky se escapuje („1\. 11.“), po opravě 0× `<ol>`; `--test` hlídá, že žádná položka seznamu nezačíná vzorem „číslo. “. Řádek „Otevřené defekty: P1 0, …“ nahrazen slovním „Otevřené chyby: 2 vysoké, 2 střední, 1 nízká“ (společná funkce s krátkou notifikací).
- **Titulky notifikací vývoje**, ať se nepletou s přehledy akcí z appky: pondělní „Kulturni radar - vyvoj: stav projektu“, denní „Kulturni radar - vyvoj: kontrola hlasi nalez“ (ASCII, jdou do HTTP hlavičky). Titulek issue #52 je „Vývoj: stav projektu (automaticky)“.
- **Issue #8** (vyhodnocení Sonnetu 5.5) doplněno o tři otázky k rozhodnutí, zda denní kontrolu omezit na 3× týdně: cena za běh z tokenů v KONTROLÁCH (sloupce M–O), nové akce na běh celkově a podle dne v týdnu, předstih nalezených akcí a podíl těch, které by se našly i při běhu 3× týdně.
- **SKILL.md** (obě kopie, sekce 9): štítek `prehled` (jen #52, kontroly ho ignorují) a rozvrh automatické kontroly.

## Board: srozumitelný pondělní souhrn, celý přehled v issue – 29. 10. 2026
- **Po zkoušce na telefonu** byla krátká notifikace nesrozumitelná (kódy P1 až P5, „Termíny do 7 dní: 5“) a stránka běhu v mobilu job summary nezobrazuje. Krátká notifikace je teď slovy: „Kontroly v pořádku, bez nálezů.“ nebo „Kontroly: 1 chyba a 2 varování.“; „Rozpracováno:“ s krátkými názvy (bez předpony „Defekt: “ a verze na začátku, do 30 znaků po celých slovech); „Otevřené chyby: 2 vysoké, 2 střední, 1 nízká“ (kritické, vysoké, střední, nízké, ke sledování, nuly vynechány, správné tvary podle počtu); „Tento týden 5 termínů, první neděle 1. 11. (#7 …)“; „Na řadě: #13 … (2 h)“; „Klepni pro celý přehled“. Sekce Naléhavé zůstává celá nahoře.
- **Celý přehled v issue:** workflow při každém pondělním běhu přepíše tělo issue „Přehled projektu (automaticky)“ (štítek nového labelu `prehled`, popis „automaticky přepisovaný přehled, neplánuje se“) Markdownem s odkazy na issues, datem a odkazem na board; klepnutí na notifikaci otevře toto issue. Issue je zavřené (aby nebylo mezi otevřenou prací) a zamčené pro komentáře; zavřené a zamčené issue jde přepsat výchozím `GITHUB_TOKEN`. Job summary zůstává jako doplněk pro desktop.
- **Workflow o třech jobech:** oprávnění `GITHUB_TOKEN` se v Actions nastavují na úrovni jobu, ne kroku, proto zápis dělá samostatný job `prehled` s jediným právem `issues: write`; `kontrola` (čte board přes `BOARD_READ_TOKEN`, nic nezapisuje) a `oznameni` (`NTFY_TOPIC`) žádné právo zápisu nemají. Notifikace jde až po zápisu přehledu, ať je issue aktuální, než na ni někdo klepne; při selhání zápisu míří Click na běh. Denní režim má Click na běh. Selhání (kontroly nebo zápisu přehledu) plánovaného běhu hlásí upozornění ntfy.
- **`kontrola-boardu.py` a `navrh-session.py` ignorují issues se štítkem `prehled`** (společný `gh_projekt.bez_prehledu`); `kontrola-boardu.py` dostal `--test` (dosud žádný neměl). Mutační ověření: bez filtru padá 5 testů kontroly boardu a 2 testy návrhu session. `kontrola-defektu.py` se jich netýká (čte jen štítek bug).
- **Test:** `--test` v `sestav-notifikaci.py` pokrývá krátké názvy, slovní priority bez nul a tvary podle počtu, den v týdnu, nejvýš 8 řádků, Naléhavé celé nahoře, bez kódů P1 až P5 a obsah těla issue (nadpis s datem, poznámka o automatickém přepisu, sekce, odkazy).

## Board: pondělní souhrn na jednu obrazovku, detail v job summary – 29. 10. 2026
- **Rozhodnutí po druhé notifikaci:** pondělní souhrn má dvě podoby. `sestav-notifikaci.py` vytvoří krátkou notifikaci pro ntfy (6 řádků: stav kontroly „v pořádku“ nebo počty chyb a varování, defekty podle priority oddělené „ · “, rozpracované jen čísly, počet termínů do 7 dní s nejbližším, „Na řadě“ = první vybraná položka návrhu s odhadem, „Klepni pro celý přehled“; sekce Naléhavé zůstává celá a nahoře) a plný přehled v Markdownu (`--prehled`, bez duplicit, zkrácené názvy, čísla issues jako odkazy, odkaz na board). Na ostrých datech s datem 2. 11.: notifikace 585 B (z toho Naléhavé), bez Naléhavé 6 řádků; plný přehled 2352 B.
- **Workflow:** plný přehled jde do `$GITHUB_STEP_SUMMARY`, ntfy hlavička `Click` ukazuje na URL běhu (jako v `rf-tests.yml`), to platí i pro denní režim (dřív Click na board; odkaz na board je teď v přehledu a v textu denní zprávy). Denní režim je jinak beze změny.
- **Test:** `--test` rozšířen o krátkou notifikaci (nejvýš 8 řádků bez Naléhavé, obsah řádků, Naléhavé celé a nahoře) a plný přehled (nadpisy všech sekcí, odkazy na issues a board, escapování Markdownu, bez duplicit), v obou podobách bez tokenů a tématu ntfy. Stávající pondělní testy ověřují plný přehled v prostém textu a zůstaly beze změny.

## Board: kratší pondělní souhrn – 29. 10. 2026
- **`sestav-notifikaci.py`** podle první skutečné pondělní notifikace (čitelná, ale zbytečně dlouhá; na ostrých datech 1798 B → 1253 B): každé issue je v souhrnu jen jednou (In Progress má přednost, v Termínech jen ostatní, v řádku Později jen zbylé, prázdný řádek se vynechá a počty sedí); sekce Naléhavé smí issue zopakovat. Názvy issues nejvýš 50 znaků po celých slovech s „…“ (čísla a data se nezkracují). Názvy souborů v textu bez přípony (ntfy bral „AUDIT-SOULADU-TESTU.md“ jako doménu a udělal z něj odkaz); odkaz na board zůstává.
- **Test:** `--test` rozšířen o duplicity mezi sekcemi, zkracování (krátký, přesně 50 znaků, hranice slova, jedno dlouhé slovo) a soubory bez přípony. Jediný dřívější test se musel upravit: ověřoval řádek Později s issue, které bylo zároveň v Termínech (právě ta duplicita).

## Board: automatická kontrola projektu (workflow, JSON výstup, token jen pro čtení) – 29. 10. 2026
- **Token:** fine-grained token uživatelský projekt číst neumí (omezení fine-grained tokenů, v Account permissions není Projects), proto classic token `BOARD_READ_TOKEN` s jediným scope `read:project`, secret repa, platnost do 27. 1. 2027. Na účtu je jediný projekt (ověřeno v prohlížeči), token je jen pro čtení a obsah repa i boardu je veřejný. Nový projekt na účtu by byl tokenem také čitelný, při zakládání dalšího boardu zvážit. Issue #51 „Obnovit BOARD_READ_TOKEN“ (docs, Cíl 1, Backlog, Odhad 0,25, Termín 20. 1. 2027); kontrola boardu ji sama ohlásí po termínu.
- **`--json`** u `kontrola-boardu.py`, `kontrola-defektu.py` a `navrh-session.py` (textový výstup beze změny): chyby a varování, u boardu souhrn (In Progress, termíny na týden), u defektů souhrn otevřených podle priority, u návrhu vybrané, později, blokované, čeká na data a kandidáti s kategorií. Shoda s textem ověřena na vymyšlených datech s chybami a varováními (5 chyb, 2 varování, 16 nálezů u defektů, návrh pro 30 a 180 minut) i na ostrých datech. `navrh-session.py` teď text i JSON skládá z jednoho slovníku.
- **`.github/scripts/sestav-notifikaci.py`** (nový, `--test`): ze tří JSON sestaví text ntfy. Denní režim: ticho, dokud není chyba kontroly, defekt P1 nebo P2 po lhůtě nebo termín dnes či v minulosti (vysoká priorita u chyby kontroly a P1); pondělní: vždy souhrn (počty chyb a varování, defekty podle priority, In Progress, termíny na 7 dní, návrh práce na 3 h včetně seznamů později a blokováno, odkaz na board); pokud by denní režim ten den hlásil důvody, jsou na začátku souhrnu v sekci „Naléhavé“ a priorita se přebírá z denního režimu (chyba nebo P1 = high, jinak běžná). Text se zkracuje na 3500 B, titulek je ASCII, zpráva obsahuje jen čísla a názvy issues. Neplatný vstup (selhání kontroly) = exit 2. Test pokrývá oba režimy na simulovaných JSON včetně kontraktu se skutečnou zprávou „po lhůtě“.
- **Workflow `.github/workflows/kontrola-projektu.yml`:** cron denně 6:40 UTC (v pondělí režim souhrnu podle dne v týdnu), `workflow_dispatch` s volbou režimu; token `BOARD_READ_TOKEN` jen v kroku, který spouští skripty, `NTFY_TOPIC` jen v krocích odeslání, `permissions: contents: read`, žádný artefakt, upozornění ntfy i při selhání samotné kontroly (plánovaný běh).
- **Board přes GraphQL:** `gh_projekt.nacist_board()` čte board dotazem `gh api graphql` (`user(login) { projectV2(number) { items } }`, stránkování, pole podle názvu z `fieldValues`) místo `gh project item-list`, který i pro osobní board vyžaduje `read:org` a `read:discussion` (s tokenem jen `read:project` hlásil „unknown owner type“, s `--owner @me` „missing required scopes“); token rozšiřovat nechceme. Výstup má stejný tvar jako dřív, shoda ověřena na ostrých datech: 51 z 51 položek shodných (i se stránkou po 10), výstupy tří skriptů a všechny `--test` bajt po bajtu stejné jako před změnou.
- **Dokumentace:** `DEFEKTY.md` (Kontrola úplnosti: automatický běh, token, proč je riziko přijatelné), `ARCHITEKTURA-TESTU.md` C1, BACKLOG (nápad kontroly v CI přeškrtnut jako realizovaný), SKILL.md (ranní kontrola běží sama, při „Start“ navázat a znovu spustit návrh s aktuálním časem).

## Board: návrh session z boardu, lhůty defektů – 29. 10. 2026
- **Lhůty defektů** v `DEFEKTY.md` (kapitola Priorita, nový sloupec): P1 1 den, P2 3 dny, P3 14 dní, P4 a P5 bez lhůty; hlídá je kontrola boardu jako varování. Konstanty `LHUTY_DNI` a `WIP_LIMIT` a čtení BACKLOGu (`projit_backlog`) jsou teď v `gh_projekt.py`, `kontrola-boardu.py` je používá.
- **`kontrola-boardu.py`: nové varování „defekt po lhůtě“** pro otevřený bug starší než lhůta jeho Priority; stáří od založení issue (datum změny Priority GitHub neukládá, historii polí boardu má jen Status), výjimka pro Stav defektu „Ověřuje se“. Negativní zkouška na vymyšlených datech: P2 po 9 dnech, P3 po 15 dnech a P1 po 2 dnech varují, P2 „Ověřuje se“, P3 po 10 dnech a P4 ne; všechny dřívější simulované chyby se dál najdou. Ostrý běh: 0 chyb, 0 varování.
- **`.github/scripts/navrh-session.py --cas ČAS`** (nový, jen čte): navrhne obsah session podle času. Čas přijímá jako `60`, `90m`, `90 min`, `1h`, `3 h`, `1,5h`, `1.5 h`, `2:30`, `1h30`, také s „cca“ nebo „~“; neplatný vstup dá srozumitelnou chybu s příklady (exit 2). Kandidáti v pořadí: Termín dnes nebo po termínu, defekty P1 a P2 (bez „Ověřuje se“), In Progress, defekty P3 po polovině lhůty, Todo podle Doporučeného pořadí, nejbližší fáze Backlogu; vybere, co se vejde podle Odhadu, položky bez Odhadu nabídne zvlášť, vypíše součet, zbývající čas a nálezy kontroly boardu. `--test` ověří převod času na tabulce příkladů včetně neplatných vstupů a výběr kandidátů na vymyšlených datech (exit 0 nebo 1). Po první kontrole výstupu doplněno: (1) Termín po dnešku (i u Stavu „Ověřuje se“) = issue se nenavrhuje a vypíše se v seznamu „Naplánováno na později“ s datem, Termín dnes nebo v minulosti zůstává nejvyšší priorita; (2) závislost „až po #N“ v řádku BACKLOG.md nebo v těle issue (konvence v SKILL.md, sekce 9) blokuje issue, dokud je #N otevřené (seznam „Blokováno“ s důvodem); (3) issue s neodškrtnutým checklistem se navrhne po částech, má-li první neodškrtnutá položka odhad v textu (`(1,5 h)`, `(1,5 až 2 h)`, `(45 min)`, horní mez), např. „dávka 1: Úklid sdílené stránky (2 h)“; (4) „Ověřuje se“ bez Termínu se nenavrhuje a vypíše se v seznamu „Čeká na data“ (doplnit Termín); (5) `--test` rozšířen o tyto případy (Termín zítra, Ověřuje se s budoucím Termínem, blokace otevřeným i zavřeným #N, odhady v různých tvarech). Krok (6) pokračuje další fází, když v nejbližší fázi Backlogu není nic navrhnutelného (vše blokované, naplánované na později nebo bez Odhadu; položky bez Odhadu se vypíšou zvlášť), dokud se navrhnutelná položka nenajde nebo fáze nedojdou; `--test` pokrývá oba směry. Úpravy boardu před commitem: Termín 2. 11. u #34 (dávky začínají až po nedělním běhu 1. 11.) a #18 (ověření po běhu), #35 má v těle „Zbývá jen scénář #48 (až po #48).“ a Odhad (h) 0,5 (zbytek), takže ji skript blokuje (a #38 blokuje #35). Výstup pro `--cas "cca 3h"` k 29. 10.: navrhne se jen #13 Mutační testování (Stryker, 2 h, fáze 4); #6, #7, #18, #34, #36, #49 a #8 jsou v seznamu „Naplánováno na později“, #35 a #38 v seznamu „Blokováno“, pro `--cas 60` není co navrhnout.
- **SKILL.md (obě kopie):** při „Start“ (ideálně s časem) spustit `navrh-session.py` a oba kontrolní skripty, výstup do hlavního chatu a plán s ohledem na dočasná omezení; po potvrzení vybrané do In Progress; bez času se Claude zeptá. Týdenní revize boardu v pondělí (~15 min). BACKLOG: nápad rozšíření plánování (omezení, závislosti, měření skutečného času).

## Board: kontrola správy boardu, sdílené načítání z GitHubu – 29. 10. 2026
- **`.github/scripts/gh_projekt.py`** (nový): sdílené načítání issues (včetně těl, komentářů a data poslední změny) a položek boardu se všemi poli přes `gh`. `kontrola-defektu.py` ho používá a dává beze změny 0 nálezů ve 12 defektech a stejné výsledky negativních zkoušek jako před úpravou (70 nálezů bez výjimky pro issues do #33, simulovaná chyba v DEFEKTY.md najde chybějící řádek a rozdíl závažnosti).
- **`.github/scripts/kontrola-boardu.py`** (nový, jen čte, všechna issues): CHYBY (exit 1): otevřené issue bez položky boardu, Statusu, milníku nebo štítku (feature, bug, docs, testing, research); zavřené issue bez Status Done a otevřené se Status Done; Todo nebo In Progress bez Odhadu (h); zavřené issue s neodškrtnutou položkou „- [ ]“ v těle; BACKLOG.md: „→ issue #N“ na neexistující issue, přeškrtnutá položka u otevřeného issue, nepřeškrtnutá u zavřeného (u položek s víc issues platí pravidlo „přeškrtnutá jen když jsou všechna zavřená“). VAROVÁNÍ (exit 0): issue z fáze 3 a dál ve Todo (konstanta `FAZE_PRO_TODO` = fáze 1 a 2; issue ve víc fázích se bere podle nejbližší), víc než `WIP_LIMIT` = 3 issues In Progress, In Progress bez změny déle než 14 dní, Termín v minulosti u otevřeného issue. Logika je čistá funkce `zkontrolovat(issues, board, backlog)`, takže jde zkoušet na vymyšlených datech.
- **První ostrý běh (29. 10.):** 50 issues, 23 otevřených, 1 chyba: #18 je In Progress bez Odhadu (h), 0 varování. Negativní zkouška na vymyšlených datech našla všech 10 simulovaných chyb a 4 simulovaná varování a nic navíc. Nález se neopravuje automaticky, návrh opravy je ve zprávě k commitu.
- **SKILL.md (obě kopie):** sekce „Defekty na konci session“ přejmenována na „Kontroly projektu na konci session“: při „End“ spustit oba skripty, nálezy do shrnutí; pravidla WIP limitu (nejvýš 3 In Progress) a Odhadu u Todo a In Progress. `ARCHITEKTURA-TESTU.md` C1: řádek Kontrola boardu a defektů (ručně při „End“, ne v CI), `DEFEKTY.md` a BACKLOG (nápad kontroly v CI s read-only tokenem rozšířen na oba skripty). `.gitignore` už obsahuje `__pycache__/`.

## Defekty: kontrola úplnosti, šablona uzavření, #4 klasifikován – 29. 10. 2026
- **#4 (Cloudflare crawlery)** doplněn na boardu při kontrole úplnosti: Závažnost S4, Priorita P4, Jak nalezeno Živá kontrola (z historie: po nasazení v3.58 23. 8. 2026 `curl` vrátil místo `robots.txt` a `sitemap.xml` SPA fallback, viz BACKLOG; issue založeno 31. 8. z BACKLOGu bez komentářů), Stav defektu Potvrzený (byl Nový). `DEFEKTY.md`: řádek v tabulce klasifikace s poznámkou „doplněno 29. 10. při kontrole úplnosti“ a odstavec.
- **Šablona uzavíracího komentáře** v `DEFEKTY.md` (Životní cyklus): sekce Kořenová příčina, Oprava, Regresní test, Analýza úniku, vzor ke zkopírování.
- **`.github/scripts/kontrola-defektu.py`** (jen čte, přes `gh`): pro všechny issues se štítkem bug kontroluje pole boardu a milník, sekce formuláře `defekt.yml` a titulek (výjimka pro issues do #33 jako konstanta se zdůvodněním), soulad stavů s otevřeným nebo zavřeným issue a Status Done, uzavírací komentář se čtyřmi sekcemi a shodu s tabulkou v `DEFEKTY.md`. Tabulka nálezů, exit 1 při nálezu. Neběží v CI: board je uživatelský projekt, výchozí `GITHUB_TOKEN` ho nepřečte, samostatný secret jen kvůli kontrole nechceme (viz #33). Odstavec „Kontrola úplnosti“ v `DEFEKTY.md`.
- **SKILL.md (obě kopie):** v sekci Konec session při „End“ spustit kontrolu defektů a nálezy uvést ve shrnutí; defekt zakládat vždy formulářem se všemi poli boardu; při zavření uzavírací komentář podle šablony.
- **BACKLOG:** nápad „Kontrola defektů v CI s read-only tokenem“ (k budoucímu zvážení).

## Testy: filtry, přehledy, označení a PIN (#35 dávka 4) – 29. 10. 2026
- **Jen testy**, `apps-script/` beze změny a nic se nenasazuje. Přehledy testují s pevným „dnes“: kontext dostane podtřídu `Date`, jejíž konstruktor bez argumentů vrací daný okamžik.
- **Testy (+15, backend 398 na 413, celkem 607 na 622):** `apiSetFiltry_` (uložení přes `routePost_` do správného řádku a sloupce, PIN hash a filtry jiného uživatele beze změny, chybějící nebo neznámý uživatel bez zápisu, prázdné filtry jako `{}`); `apiToggle_` (neplatný typ, chybějící ID nebo uživatel, neexistující akce, označení a odznačení oblíbených i navštívených nezávisle, izolace uživatelů); `nastavPin_` (formát „sůl$hash“, round trip s `overitPin_`, nová sůl při každém nastavení, neznámý profil bez zápisu, PIN se nikam nezapíše čitelně); `notifyFail_` (předmět a tělo „Chyba: …“); `weeklyDigest` (okno 7 dní včetně posledního dne a vícedenní akce, prázdné okno, zrušené a cizí akce); `weekendDigest` (nejbližší pátek pro všech 7 dnů v týdnu, akce jen pátek až neděle, extra příjemce `NOTIFY_EMAIL_VIKEND` jen u víkendu, stálá místa top 5 podle skóre se sobotou v okně, výpadek počasí se vynechá); selhání obou přehledů s `notifyFail_` a propuštěnou výjimkou.
- **Od zadání se liší:** `apiSetFiltry_` žádnou validaci velikosti ani tvaru vstupu nemá (ukládá `JSON.stringify(filtry || {})`), takže scénář „poškozený nebo příliš velký vstup“ neexistuje a netestuje se. `apiSetFiltry_`, `apiToggle_` ani `nastavPin_` neověřují PIN ani token, stačí `uzivatelId` (PIN chrání jen přihlášení ve frontendu). Ověřeno v kódu (`routePost_`, `doGet`) a založeno jako defekt #50 (S2, P3, Cíl 2, musí se vyřešit před otevřením přátelům, souvisí s #16): zápisové akce `toggle`, `toggle-misto`, `filtry`, `set-notifikace` a `vygenerovat-ntfy-tema` jsou bez ověření, `api=uzivatele` vrací ID veřejně a `set-notifikace` jde použít k přesměrování cizích notifikací na libovolný e-mail; `login` hlídá PIN, `run`, `najdi` a `email-tip` sdílený `WEB_TOKEN`. Analýza úniku v `DEFEKTY.md`. `nastavPin_` je ruční pomocná funkce z editoru (volá `getActiveSpreadsheet`, ne API).
- **Mutace** (32, každá shodí aspoň jeden test; skript po neaplikované mutaci končí chybou): `apiSetFiltry_` (bez kontroly uživatele, bez kontroly profilu, zápis do sloupce PIN_hash, o řádek vedle, prázdné filtry bez `{}`), `apiToggle_` (bez validace typu, ID, uživatele a existence akce, izolace uživatelů v `toggleOznaceni_`, stav vrácený i z řádků jiných uživatelů), `nastavPin_` (pevná sůl, jiný sloupec, jiný řádek, bez kontroly profilu), `notifyFail_` (bez předpony, zpráva chyby se nepoužije), `weeklyDigest` (okno 8 dní, okno od včerejška, bez `notifyFail_`, spolknutá výjimka, extra příjemce navíc), `weekendDigest` (pátek bez modulo i bez +7, okno jen pátek až sobota, extra příjemce se nepředá, bez `notifyFail_`, spolknutá výjimka), `digestRange_` (6 stálých míst, počasí na neděli), `readEventsInRange_` (poslední den okna, akce před oknem).
- **Pokrytí (přeměřeno):** `apiSetFiltry_` 8 z 8 řádků (před 0 %), `apiToggle_` 13 z 13 (před 38 %; 44 % podle měření z 28. 10.), `nastavPin_` 9 z 9 (před 0 %), `weeklyDigest` 8 z 8 (před 0 %), `weekendDigest` 11 z 11 (před 0 %), `digestRange_` 33 z 33 (před 36 %), `notifyFail_` 2 z 2; backend 92,0 % řádků, 85,0 % větví, 90,9 % funkcí (po dávce 3b: 90,3 %, 83,0 %, 88,6 %). Žádná kritická funkce ze seznamu #35 není pod 70 %.
- **R4 v POKRYTI.md zůstává ◐** (změna odůvodnění, ne hodnocení): odesílací cesty jsou pokryté a ověřené mutacemi, ale otevřený defekt #48 (trigger `sendUserNotifications` bez hlášení chyb, samotest ho nehlídá, obálka 0 %) znamená, že výpadek doručování uživatelům stále nikdo nezachytí; po opravě #48 se R4 zvedne na ●. R3 (`apiToggle_`) a oblasti 5 a 6 doplněny o měření. README, ARCHITEKTURA-TESTU (D3, počet testů) a BACKLOG aktualizovány.

## Testy: placené cesty updateMista, apiNajdiProUzivatele_ a webové spuštění (#35 dávka 3) – 29. 10. 2026
- **Jen testy a harness**, `apps-script/` beze změny a nic se nenasazuje. Harness: stub triggeru umí `after(ms)` (pole `zaMs` v `ctx.__triggery`). Fixture a stub fetchů z dávky 2 (`pripravKontrolu_` dostala parametr `extraListy` pro MÍSTA, UŽIVATELÉ a SLEDOVANÁ MĚSTA).
- **Testy (+17, backend 381 na 398, celkem 590 na 607):** `updateMista` (zámek obsazený bez volání AI a beze změny MÍST; úspěch: nové místo, existující místo se stejným klíčem `klicMista_` a jiným ID i názvem se přepíše bez duplicity (případ z #21), LOKALITY, notifikace „Stálá místa aktualizována“, řádek KONTROL s tokeny M–O, zámek uvolněn; chyba AI: MÍSTA beze změny, „Aktualizace stálých míst selhala“, výjimka propuštěna, zámek uvolněn); `callAnthropicPlaces_` (model, nástroje a profil v požadavku, chybějící klíč bez volání sítě, odpověď bez nástroje a `pause_turn` s výzvou k odevzdání, poškozená odpověď, nevalidní JSON, HTTP 429); `apiNajdiProUzivatele_` (špatný, chybějící token a neznámý uživatel bez volání AI, zámek obsazený, úspěch přes `routePost_` s osobními filtry v dotazu a tvarem odpovědi pro frontend, chyba AI, prázdné zdroje, poškozené filtry). Dávka 3b: `spustKontroluCore_` (špatný nebo chybějící `WEB_TOKEN` bez triggeru a beze změny `WEB_LAST_RUN`, cooldown včetně hranice, úspěch s jediným triggerem `menuRunNow` za 1 s a nastaveným `WEB_LAST_RUN`, první spuštění), `menuRunNow` (typ „mimořádná kontrola (menu)“ a platba AI přes `runCheck_`), `zpracovatSledovanaMesta` s obsazeným zámkem (žádné volání AI ani přepočet počasí, nic se nezapíše).
- **Od zadání se liší:** cooldown u `apiNajdiProUzivatele_` v kódu není (je jen ve `spustKontroluCore_`, tedy u webového spuštění), takže scénář 6 testuje jen obsazený zámek (odpověď „Jiná kontrola právě probíhá, zkus to za chvíli.“). Autorizace je jen token `WEB_TOKEN`, ne PIN. `updateMista` při obsazeném zámku mlčky skončí (bez notifikace).
- **Nález (pole `aktualizovano`):** odpověď `apiNajdiProUzivatele_` obsahuje pole `aktualizovano`, které je vždy 0, protože `upsertEvents_` vrací `zmenene`, ne `aktualizovano`. Frontend používá jen `nove`, takže bez dopadu, ale pole je zavádějící. Přidáno jako další bod k opravě do #48 (při stejném nasazení).
- **Mutace** (18, každá shodí aspoň jeden test; skript po neaplikované mutaci končí chybou): `updateMista` bez kontroly zámku, bez uvolnění zámku, zápis MÍST před voláním AI, bez `notifyFail_`; párování míst jen přes ID (bez `klicMista_`); chybný model v `callAnthropicPlaces_`; `apiNajdiProUzivatele_` bez kontroly tokenu, kontrola tokenu za voláním AI, bez kontroly zámku, bez uvolnění zámku, filtry uživatele se nepromítnou; `spustKontroluCore_` bez kontroly tokenu, bez cooldownu, cooldown s `<=`, `WEB_LAST_RUN` se nenastaví, trigger se nezaloží; `menuRunNow` s jiným typem; `zpracovatSledovanaMesta` bez kontroly zámku.
- **Pokrytí (přeměřeno):** `updateMista` 33 z 33 řádků (před 0 %; 5 % podle měření z 28. 10.), `callAnthropicPlaces_` 62 z 62 (před 0 %; 3 %), `apiNajdiProUzivatele_` 26 z 26 (před 19 %; 23 %), `spustKontroluCore_` 9 z 9 (před 56 %), `menuRunNow` 2 z 2 (před 0 %); backend 90,3 % řádků, 83,0 % větví, 88,6 % funkcí (po dávce 2: 86,8 %, 81,7 %, 87,4 %).
- **R6 v POKRYTI.md zpět ● (změna hodnocení):** všechny placené cesty (`runCheck_`, `dailyCheck`, `zpracovatSledovanaMesta`, `updateMista`, `apiNajdiProUzivatele_`, e-mailové tipy, webové spuštění) jsou nad 70 % řádků a mají testy zámku a tokenu (u webového spuštění i cooldownu), ověřené mutacemi; důvod a seznam v řádku R6 a v historii POKRYTI.md. R4 zůstává ◐. README, ARCHITEKTURA-TESTU (D3, počet testů) a BACKLOG aktualizovány.

## Testy: platba AI v runCheck_ a dailyCheck (#35 dávka 2) – 29. 10. 2026
- **Jen testy**, `apps-script/` beze změny a nic se nenasazuje. Testy používají volby harnessu z dávky 1 (`ss`, `zamek`, `urlFetch`); fronta fetchů obsahuje jen odpovědi AI a test kontroluje počet i URL volání, protože `zajistitSouradnice_` výjimky polyká a nečekané volání Nominatimu nebo počasí by jinak prošlo tiše.
- **Testy (+12, backend 369 na 381, celkem 578 na 590):** `runCheck_`: zámek obsazený (AI se nezavolá, nic se nezapíše), úspěch (nová akce ve správných sloupcích AKCE, řádek KONTROL s počty, modelem a tokeny ve sloupcích M–O, LOKALITY, notifikace, zámek uvolněn, payload s modelem a profilem), chyba AI HTTP 500 (výjimka, nic nezapsáno, zámek uvolněn), chybějící klíč a prázdné zdroje (bez volání AI), deduplikace s datem jako sériové číslo i jako `Date` (#17); mimořádná kontrola (`onEditInstallable`): po úspěchu se B11 vypne a B12 dostane čas, po selhání B11 zůstane zaškrtnutý a přijde „Mimořádná kontrola selhala“, filtry (jiná buňka, list, odškrtnutí, dvojklik) nezaplatí AI; `dailyCheck`: pořadí kroků včetně e-mailových tipů a jediný report se statistikou tipů, selhání uvnitř (notifikace „Denní kontrola selhala“ s textem chyby, výjimka se propustí, souřadnice se nedoplňují), zámek obsazený.
- **Od zadání se liší:** `runCheck_` sama chybu nehlásí (žádné `notifyFail_`), hlásí ji až volající (`dailyCheck`, `onEditInstallable`), test to dokumentuje. Obsazený zámek se nehlásí nikde (ani v `dailyCheck`). Nález: obsazený zámek se nehlásí; v `dailyCheck` ho nepřímo kryje `watchdogDailyCheck` (chybí řádek denní kontroly v KONTROLÁCH). Navíc oproti zadání: chybějící klíč a prázdné zdroje, filtry a dvojklik v `onEditInstallable`, `dailyCheck` s obsazeným zámkem.
- **Mutace** (každá shodí aspoň jeden test): bez kontroly zámku, bez uvolnění zámku ve finally, zápis do AKCE před voláním AI, bez `notifyFail_` v `dailyCheck`, chybný model (payload i KONTROLY), deduplikace (bez přesného klíče; klíč i fuzzy vypnuty; sériové číslo data nerozpoznáno, regrese #17).
- **Pokrytí (přeměřeno):** `runCheck_` 28 z 28 řádků, `dailyCheck` 9 z 9, `onEditInstallable` 11 z 11 (před: 0 % podle vlastního měření řádků, 11 % a 38 % podle měření z 28. 10.); backend 86,8 % řádků, 81,7 % větví, 87,4 % funkcí (po dávce 1: 84,6 %, 81,3 %, 85,1 %). README, ARCHITEKTURA-TESTU (D3, počet testů), POKRYTI.md (R6 zůstává ◐, důvod tamtéž), BACKLOG aktualizovány. SKILL.md (obě kopie): poznatek k mutačnímu ověření (neaplikovaná mutace musí skončit chybou, testy se nepouštějí).

## Testy: harness se stubem tabulky, zámku a triggerů; setupTriggers a watchdog (#35 dávka 1) – 29. 10. 2026
- **`tests/harness.js`:** tři volitelné volby `nactiRadar`, výchozí chování beze změny (služba zakázaná, dokud si ji test nevyžádá): `ss` (`SpreadsheetApp.getActiveSpreadsheet` vrátí předaný `fakeSpreadsheet`), `zamek` true/false (`LockService.getScriptLock` s `tryLock`, záznam volání a uvolnění v `ctx.__zamek`), `triggery` (stub `ScriptApp`: `getProjectTriggers`, `deleteTrigger`, builder `newTrigger(...)...create()` se záznamem funkce, typu, dne, hodiny, dne v měsíci a intervalu dnů v `ctx.__triggery`, plus `ScriptApp.WeekDay`). Backend (`apps-script/`) beze změny, nic se nenasazuje.
- **Testy (+9, backend 360 na 369, celkem 569 na 578):** 2 testy harnessu (výchozí stav dál vyhazuje, s volbou funguje); `setupTriggers`: přesný rozvrh všech 10 triggerů jako tabulka očekávaných hodnot (včetně neděle 20:00 a čtvrtka 10:00 `zpracovatSledovanaMesta`) a idempotence (staré smazané, nové založené jednou); `watchdogDailyCheck`: dnešní kontrola s datem jako text a jako objekt (bez notifikace), chybějící kontrola (notifikace s předmětem „Watchdog: denní kontrola dnes neproběhla“), prázdný a chybějící list, chyba čtení tabulky. Komentář v testu: změna rozvrhu musí jít ruku v ruce s PROVOZ.md a kontrolou souběhu s cronem RF (UTC).
- **Mutace:** hodina `dailyCheck` 8 na 9, nedělní `zpracovatSledovanaMesta` 20 na 21, čtvrteční 10 na 11, vynechaný `weeklyDigest`, bez úklidu starých triggerů, den v měsíci `updateMista`, `runSelfTest` neděle na sobotu, opačná podmínka watchdogu, nekontrolovaný typ, opačné porovnání data a bez ochrany prázdného listu; každá shodí aspoň jeden test.
- **Pokrytí (přeměřeno):** backend 84,6 % řádků, 81,3 % větví, 85,1 % funkcí (28. 10.: 82,2 %, 80,9 %, 84,2 %); nárůst je součtem v3.51 (#49) a této dávky. `setupTriggers` 0 na 100 % řádků (53 z 53), `watchdogDailyCheck` 0 na 100 % (14 z 14). Hodnocení R4 v POKRYTI.md zůstává ◐ (`notifyFail_` a přehledy bez testu). README, ARCHITEKTURA-TESTU (D3, počet testů), POKRYTI.md a BACKLOG aktualizovány. SKILL.md (obě kopie), sekce Měření pokrytí kódu: konkrétní hodnoty nahrazeny odkazem na README a ARCHITEKTURA-TESTU.md, D3 (jediné místo pro čísla). Zbývá z #35: platba AI, `apiSetFiltry_`, `notifyFail_` a přehledy, `apiToggle_`, `nastavPin_`, scénář #48.

## Backend v3.51: rozpočet sledovaných měst podle délky města, počasí před smyčkou (#49, část 1) – 29. 10. 2026
- **Příčina (#49):** `zpracovatSledovanaMesta` kontroloval rozpočet 4,5 min jen před městem a město trvá kolem 2 minut, takže třetí město začalo a běh 29. 10. skončil na limitu 6 minut (361 s) uprostřed volání AI. Přepočet počasí běžel až za smyčkou, nespustil se a o přerušení se nic nezapsalo.
- **Oprava:** nová čistá funkce `smiZacitDalsiMesto_(uplynuloMs, delkyMestMs)`: další město začne jen když `uplynulo + odhad < 330 s`, odhad = nejdelší dosavadní město, nejméně 150 s (konstanty `SLEDOVANA_LIMIT_MS` = 6 min minus rezerva 30 s, `SLEDOVANA_MIN_ODHAD_MESTA_MS`). Vzorec platí i pro první město (bez změřené délky je odhad jen 150 s): zabité zaplacené volání AI je horší než přeskočený běh a přerušení je vidět v KONTROLÁCH. Pokud počasí zabere tolik času, že se nevejde ani první město, nezpracuje se žádné a zapíše se řádek přerušení. Délka každého zpracovaného města (i selhaného) se měří. Kontrola rozpočtu je až za přeskočením domácího profilu a dnes hotových měst, takže přeskočená města rozpočet nespotřebují.
- **Počasí před smyčkou (B):** `aktualizujPocasi_` běží na začátku běhu a jeho čas se započítá do rozpočtu. Důsledek: akce nalezené až v tomhle běhu dostanou počasí při příštím běhu.
- **Záznam přerušení:** při zastavení rozpočtem se do KONTROL zapíše řádek „sledovaná města přerušena“ (zpracováno X, zbývá Y, uplynulý čas), obsah sestavuje čistá funkce `sestavRadekPreruseniSledovanychMest_`. Tvrdé ukončení limitem Apps Scriptu se tím nezachytí, to je část 2 (D).
- **Testy:** +11 (backend 349 na 360, celkem 558 na 569): hranice rozpočtu (první město začne při 179 s a nezačne při 180 s, těsně pod limitem, přesně na limitu, odhad z nejdelšího města, minimum 150 s), obsah řádku přerušení a pět průchodů orchestrátorem s řízenými hodinami (počasí první a jeho čas v rozpočtu, počasí 200 s: žádné město a řádek „Zpracováno měst: 0, zbývá: 3“, město 170 s zastaví druhé, všechna města se vejdou bez řádku přerušení, případ z 29. 10.). Mutace ověřeny: `<` na `<=`, bez minima 150 s, první město vždy (výjimka pro prázdný seznam), bez odhadu, `min` místo `max`, bez měření délky, bez zápisu přerušení, limit bez rezervy (každá shodí aspoň jeden test). README a ARCHITEKTURA-TESTU: počty (360 backend, 569 celkem). POKRYTI.md beze změny (hodnocení R4 a R6 zůstává ◐).
- **Ověření v produkci:** nedělní běh 1. 11. 2026 ve 20:00, kontrola v pondělí 2. 11. (Spuštění: doba pod 6 min a stav Dokončeno, KONTROLY: řádek počasí nebo jeho absence, případný řádek o přerušení). Část 2 (počasí jako samostatný trigger a záznam o tvrdém ukončení) po 2. 11.

## Docs: defekt časový limit sledovaných měst (#49), ověřovačka #6 posunuta – 29. 10. 2026
- **Nález (živá kontrola při ověřovačce #6):** `zpracovatSledovanaMesta` 29. 10. 10:31:51 skončil po 361 s na časovém limitu (25. 10.: 338,7 s, dokončeno). KONTROLY: Třinec 10:34, Olomouc 10:36, žádný další řádek ani řádek „aktualizace počasí“. Budoucí akce: souřadnice 43 z 86, počasí do 7 dní OK 10, NA 20, CHYBA 3 (všechny s datem 5. 11.).
- **Analýza kódu (backend v3.50, bez změn v `apps-script/`):** (a) potvrzeno, rozpočet 4,5 min se kontroluje jen před městem a nebere v úvahu délku města (~2 min) ani čas na `aktualizujPocasi_`; (b) potvrzeno, limit nejde zachytit, `logKontrola_` se volá až po zápisu a nic se nehlásí, hláška o přerušení je jen v Loggeru a jen při vlastním přerušení; (c) potvrzeno, volání AI se ukončí před `upsertEvents_`, nic se nezapíše a město zůstane nejstarší na řadě; (d) nepotvrzeno, CHYBA vzniká jen když neodpoví Open-Meteo ani met.no, datum na hraně předpovědi dává NA, tři záznamy CHYBA jsou starý stav nepřepsaný kvůli (b).
- **Issue #49** (defekt, formulář): S3, P2, Živá kontrola, štítek bug, Cíl 3, board Todo, Stav defektu Potvrzený, odhad 4 h. Varianty opravy a doporučení jsou v komentáři issue. Samostatný defekt k bodu (d) nevznikl.
- **Ověřovačka #6:** komentář v #6 a #18, termín #6 posunut na 2. 11. (nedělní běh 1. 11.), #18 zůstává In Progress. `DEFEKTY.md`: řádek #49 a poznámka. BACKLOG: fáze 1, bod 1 posunut, nový bod 1a. Rozhodnutí 29. 10.: minimální oprava části 1 (A + B + zápis přerušení, backend v3.51) před nedělním během 1. 11., část 2 (C + D) po 2. 11.

## CI: TZ=Europe/Prague pro jednotkové testy (#37) – 29. 10. 2026
- **`node-tests.yml`:** krok Spustit testy má `env: TZ: Europe/Prague`, takže jednotkové testy v CI běží ve stejné zóně jako backend (`Europe/Prague`) a lokálně na stroji v SEČ/SELČ.
- **Ověření:** 558/558 prochází s `TZ=UTC`, `TZ=Europe/Prague`, `TZ=Pacific/Auckland` i `TZ=America/Los_Angeles`, seznam výsledků po jednotlivých testech je pro UTC a Europe/Prague shodný. Žádný test se tedy podle zóny nechová jinak. Stub `Utilities.formatDate` v harnessu formátuje podle zóny procesu, nastavení `TZ` ho proto přibližuje skutečnému skriptu.
- `ARCHITEKTURA-TESTU.md` A4: část o časové zóně přepnuta z „navrženo“ na zavedeno, zbývá řazení podle češtiny, přechod letního času a stálá místa s diakritikou. Closes #37.

## Testy: měření pokrytí frontendu (#39) – 29. 10. 2026
- **`tests/frontend-harness.js`:** každá vykrojená funkce se spouští s předponou, která má stejnou délku a stejná zalomení jako text před funkcí v `Index.html`, takže offsety V8 sedí na skutečný soubor (správné řádky i sloupce). 558/558 prochází.
- **Proč vlastní skript:** tabulka z `node --test --experimental-test-coverage` pro `Index.html` nesedí. Harness vytvoří pro každou funkci zvláštní skript téhož souboru a node je nesloučí (zkoušené varianty ukázaly 94 %, 2 % a 6 %, podle toho, který skript vyhrál). Skript `tests/pokryti-frontendu.js` proto čte syrová data V8 (`NODE_V8_COVERAGE`) a počítá jen řádky uvnitř vykrojených funkcí. `filename` proto zůstává `Index.html#název`, ne `file://` URL jako u backendu.
- **Naměřeno:** 98,9 % řádků ve vykrojených funkcích (440 z 445, 57 ze 113 funkcí) a 25,3 % celého `<script>` bloku (440 z 1736 řádků). Nepokryté řádky vykrojených funkcí jsou jen 1223 (`api`, `throw` pro neznámý endpoint) a 1766, 1767, 1770, 1771 (`nactiAkce`: větev `data.generovano` a hlášení chyby aktuálního požadavku); ověřeno proti textu `Index.html`. Řádek se bere jako spustitelný, pokud obsahuje kód, a pokrytý, pokud jeho první znak kódu má počet spuštění větší než 0 (přibližná metoda).
- **CI:** `node-tests.yml` vypisuje výsledek v novém kroku „Pokrytí frontendu (Index.html)“, zatím bez prahu. `ARCHITEKTURA-TESTU.md` D3: nová metrika, pokrytí frontendu odebráno z „co se zatím měřit nedá“. README: poznámka pod tabulkou. Closes #39.

## CI: kontrola počtu testů v README (#45) – 29. 10. 2026
- **Nový skript** `.github/scripts/kontrola-poctu-testu.py` (jen standardní knihovna a `robotframework`): přečte počty z tabulky „Testy v číslech“ v README a porovná je s repem. Node testy počítá jako volání `test(` na začátku řádku v `tests/unit.test.js` (349), `tests/frontend.test.js` (209) a `cloudflare-worker/email-webhook.test.mjs` (7), shoda s `node --test` ověřena; RF testy přes `robot.api.TestSuiteBuilder` nad `tests/robot` včetně rozdělení api (9) a frontend (52), celkem 61. Při rozdílu vypíše tabulku README vs. repo a skončí chybou.
- **Zapojení:** job `rf-dryrun` v `node-tests.yml`, krok za pojistkou souladu.
- **Ověření:** dnešní stav projde; dočasně změněné číslo v README (350 místo 349, mimo commit) skončí kódem 1 s označeným rozdílem.
- README: věta pod tabulkou, že počty hlídá CI. `ARCHITEKTURA-TESTU.md` (Známé mezery): z „navrženo“ na zavedeno. Cvičné API testy (SoapUI, Bruno, JMeter) se nekontrolují. Closes #45.

## Docs: defekt Tichá selhání (#48) – 29. 10. 2026
- **Issue #48** (první defekt založený formulářem `defekt.yml`, ne zpětně): `runSelfTest` nehlídá existenci triggerů `sendUserNotifications` a `zpracovatSledovanaMesta` a `sendUserNotifications` nemá `try/catch` ani `notifyFail_`. Závažnost S3, priorita P3, jak nalezeno Analýza nebo review (při psaní tabulky triggerů pro #47), stav Potvrzený, board Backlog, milník Cíl 1. Oprava spolu s testy v #35.
- `DEFEKTY.md`: řádek v tabulce klasifikace s poznámkou o prvním defektu z formuláře. BACKLOG: položka v Testovacím dluhu, → issue #48.
- Oprava záznamu k #47 níže: tabulka triggerů vychází z 10 triggerů (9 funkcí, `zpracovatSledovanaMesta` dvakrát), ne z 11.

## Docs: PROVOZ.md, tabulka triggerů (#47) – 29. 10. 2026
- **`Docs/aplikace/PROVOZ.md`:** tabulka triggerů je kompletní podle `setupTriggers()` v `kulturni_radar.gs` (10 triggerů, `zpracovatSledovanaMesta` dvakrát): doplněny `sendUserNotifications`, `runSelfTest`, `watchdogDailyCheck` a `zpracovatSledovanaMesta`, nový sloupec „Jak poznat selhání“, vše z kódu. Přidán řádek o týdenním RF běhu v GitHub Actions (`20 20 * * 0`, 21:20 SEČ) a upozornění na UTC a letní čas.
- Z kódu vyplynulo: `runSelfTest` nehlídá existenci triggerů `sendUserNotifications` a `zpracovatSledovanaMesta` a `sendUserNotifications` nemá vlastní notifikaci o selhání. Closes #47.

## Docs: board se sloupcem Backlog, issues pro fázi 5, pravidlo v SKILL – 28. 10. 2026
- **Board:** Status má novou volbu Backlog (pořadí Backlog, Todo, In Progress, Done; ostatní volby si ponechaly id, statusy existujících položek se nezměnily). Backlog dostaly #4, #5, #8, #13, #14, #15, #16, #35, #38 a #39 (#4 a #5 podle nového pravidla, nejsou vybrané na nejbližší práci). Pohled Kanban ověřen v prohlížeči: Backlog se zobrazuje jako první sloupec. Fáze 1 (#6, #7, #36, #37) a #34 zůstávají Todo.
- **Nové issues ve stavu Backlog** (Cíl 1, Odhad): #40 Lokalizační testy (A4, 5 h), #41 Kontrola verze frontendu ve smoke testu (R2, 1 h), #42 Smoke přes Apps Script iframe v CI (R5, 1 h), #43 Přímý API test přihlášení (0,5 h), #44 Katalog testů na GitHub Pages (0,5 h), #45 Hlídat počty testů v README skriptem (0,5 h), #46 Sdílený skript kontroly úniku (0,5 h, až po #36), #47 PROVOZ.md: doplnit triggery (0,5 h, štítek docs). BACKLOG má u příslušných položek → issue #N.
- **Soulad BACKLOGu a boardu:** všechny odkazy → issue #N mají existující issue na boardu s milníkem. Odhad chybí u #4, #5, #15 a #16 (odhad po návrhu), Termín u #37.
- **SKILL.md (obě kopie), sekce 9:** nové pravidlo „položky z Doporučeného pořadí mají issue ve stavu Backlog; Todo jen pro vybrané na nejbližší práci; nápady mimo Doporučené pořadí zůstávají jen v BACKLOGu“ a poznámka, že nové issue na boardu dostane automaticky Todo.

## Docs: BACKLOG plán po 28. 10. (fáze 1 až 5), nové issues, čas nedělního běhu – 28. 10. 2026
- **Čas týdenního běhu:** cron `rf-tests.yml` z `0 19 * * 0` na `20 20 * * 0` (neděle 20:20 UTC, 21:20 SEČ, 22:20 SELČ): po nedělním triggeru `zpracovatSledovanaMesta` ve 20:00 místního času a mimo celou hodinu, kdy je fronta plánovaných běhů GitHubu nejvytíženější. Časy opraveny v `ARCHITEKTURA-TESTU.md` (C1) a `TESTY.md` (4.2).
- **BACKLOG, Doporučené pořadí:** přepsáno na pět fází (ověření do 2. 11., zpevnění základu, pokrytí kritických funkcí, měření, šířka); hotové body zůstaly v bloku Hotovo.
- **Nové issues** (Cíl 1, štítek testing, board Todo): #36 Ověřit první plánovaný běh CI 1. 11. 2026 (Termín 2. 11., 0,5 h), #37 TZ pro jednotkové testy v CI (0,25 h), #38 Práh pokrytí backendu v CI (0,5 h), #39 Měření pokrytí frontendu (1 h). Termíny nastaveny i u #6 (29. 10.), #7 (1. 11.) a #8 (9. 11.).
- Bez zásahu do `apps-script/`, bez bumpu verze a bez nasazení.

## Testy: měření pokrytí backendu, korekce matice pokrytí, úklid – 28. 10. 2026
- **Běhy z 28. 10. (kontrola po dnešních změnách):** Node 558/558, test workeru 7/7, `robot --dryrun` 61/61, pojistka souladu bez nárůstu (baseline 11 / 9 / 11 / 61 / 0 / 11 / 6 / 12). Jeden plný lokální běh RF proti produkci se stejnými proměnnými jako CI (`CEKANI_ZAPIS:30s`, `CEKANI_PRIHLASENI:40s`, `CEKANI_NAVIGACE:30s`): API 8 PASS a 1 SKIP (ntfy test, lokálně není `NTFY_TOPIC`), frontend 52/52 za 188 s. Žádný pád, takže nebylo co přiřazovat dnešním změnám, auditu #34 ani zátěži Apps Scriptu.
- **Kontrola úniku z workflow nad výstupy běhu:** PIN, ntfy témata `radar-<32 hex>` ani `EMAIL_WEBHOOK_TOKEN` v reportech nenalezeny. `playwright-log.txt` obsahoval ntfy téma profilu, CI ho před nahráním maže, lokálně smazán. Stav profilu rf-test po běhu: notifikace bez kanálů a bez e-mailu (ntfy téma zůstává podle návrhu), ★ a ✓ nikde, 🏛 v Brně žádné.
- **Měření pokrytí:** `tests/harness.js` předává `vm.runInContext` jako `filename` URL souboru (`pathToFileURL`), takže `node --test --experimental-test-coverage` přiřadí pokrytí k `kulturni_radar.gs`: **82,2 % řádků, 80,9 % větví, 84,2 % funkcí** (uvnitř funkcí 75,1 %). `node-tests.yml` ve kroku Spustit testy vypisuje pokrytí, zatím bez prahu. 558/558 dál prochází. Frontend se měřit nedá, harness vykrajuje funkce z `Index.html` bez čísel řádků.
- **Mapa funkcí:** backend 187 funkcí (116 pokrytých Node přímo, 32 jen přes jiné funkce, 4 jen přes E2E nebo API, 35 nepokrytých), frontend 113 funkcí (57 pokrytých Node, 56 jen nepřímo E2E podle statické dosažitelnosti).
- **Korekce `POKRYTI.md`:** R6 a R4 z ● na ◐ (`callAnthropicPlaces_` 3 %, `runCheck_` 11 %, `apiNajdiProUzivatele_` 23 %; `watchdogDailyCheck`, `notifyFail_` a přehledy 0 %), poznámka u R3 (`apiToggle_` 44 %), `apiSetFiltry_` v oblasti 6 bez jednotkového testu (E2E ji volá jen nepřímo), upřesněný `runSelfTest` (unit test čte jen zdroj). Věta o vzniku matice podle názvů testů a korekci měřením.
- **Dokumentace:** `ARCHITEKTURA-TESTU.md` D3 má metriku pokrytí kódu backendu (cíl: neklesat, kritické funkce nad 70 %) a pokrytí kódu už není mezi tím, co se nedá měřit. README: poznámka s pokrytím pod tabulkou „Testy v číslech“.
- **Úklid lokálních pozůstatků (mimo git):** stará kopie skillu `.claude/skills/kulturni-radar-workflow.zip` ze 7. 9., `log.html`, `output.xml`, `report.html` a `playwright-log.txt` v kořeni, prázdná složka `browser/`, staré podsložky `vysledky/`, `api-tests/jmeter/jmeter.log`. `.claude/settings.json` přidán do `.gitignore`.
- **Issue #35** „Pokrytí kritických funkcí backendu“ (Cíl 1, odhad 5 h, štítek testing, board Todo) s mezerami v pořadí podle rizika. BACKLOG: položka v Testovacím dluhu, → issue #35.
- Bez zásahu do `apps-script/`, bez bumpu verze a bez nasazení.

## Docs: struktura složky Docs do podsložek a mapa dokumentace – 28. 10. 2026
- **Přesuny přes `git mv`** (historie souborů zůstává): `aplikace/` (ARCHITEKTURA-APLIKACE.md dříve ARCHITEKTURA.md, PROVOZ.md, `design/ikona-varianta-C.svg`), `testovani/` (TESTY.md, ARCHITEKTURA-TESTU.md, POKRYTI.md, TESTOVACI-ANALYZA.md), `kvalita/` (DEFEKTY.md, PRIBEHY-CHYB.md), `audity/` (AUDIT-SELEKTORU.md, AUDIT-INDEXACE.md, AUDIT-SOULADU-TESTU.md), `archiv/quality-check-2026-10/` (dříve `Quality Check/`). BACKLOG.md, CHANGELOG.md a `kulturni-radar-workflow/` zůstávají. Nadpis ARCHITEKTURA-APLIKACE.md je teď „Architektura aplikace“.
- **Nový `Docs/README.md`:** mapa dokumentace s rolí každého dokumentu.
- **Opravené odkazy:** relativní odkazy přepočítané podle nového umístění zdroje i cíle, prosté zmínky cest v Docs, README, obou kopiích SKILL.md, `.github` (formulář defektu, pojistka souladu, workflow) a komentářích. Historické záznamy tohoto CHANGELOGu a přeškrtnuté položky BACKLOGu zůstaly beze změny, trvalé odkazy na konkrétní commit také.
- **Jen komentáře v kódu:** odkaz na AUDIT-INDEXACE.md v komentářích `apps-script/Index.html` (3 místa) a v komentáři `tests/frontend.test.js`. Bez bumpu verze. Frontend se po pushi nasadí automaticky přes Cloudflare Pages, mění se ale jen komentáře, chování appky je stejné. Apps Script (clasp) se nenasazuje.

## Testy: audit souladu s architekturou a pojistka proti nárůstu porušení – 28. 10. 2026
- **Audit** `Docs/AUDIT-SOULADU-TESTU.md`: stávajících 61 testů proti pravidlům B4, B5 a C3 z `ARCHITEKTURA-TESTU.md`. Metoda je čtení kódu, dopad je odhad. Výsledek: 20 porušení, tabulka tagu `krehky` (z 12 testů je vnější příčina doložená u 5) a plán oprav v 10 dávkách. Nejvážnější je chybějící návrat sdíleného stavu stránky (44 z 52 E2E testů bez `[Teardown]`) a 9 testů, které při chybějících datech jen zalogují varování a projdou. Pravidlo B5.2 nikde porušené není. TESTY.md opraven: WARN je v 9 testech (11 výskytů), ne v 10.
- **Pojistka (ratchet)** `.github/scripts/kontrola-architektury-testu.py` v jobu `rf-dryrun` workflow `node-tests.yml`: spočítá porušení hlídatelných pravidel a selže, jen když některý počet vzroste proti `baseline-architektury-testu.json`. Baseline: WARN v testech 11, testy bez teardownu 9, `text=` 11, `nth=` 61, aserce v `resources.robot` 0, Sleep bez „# povoleno:“ 11, regrese bez verze v názvu 6, `krehky` bez „Příčina nestability:“ 12. Volba `--zapsat-baseline` baseline snižuje.
- **Ověření:** dnešní stav projde (exit 0). Synteticky přidaná porušení všech osmi metrik v dočasné kopii mimo repo skončila chybou (exit 1). Pokles počtu vypsal výzvu ke snížení baseline. Suite-level Test Teardown snížil počet testů bez teardownu z 9 na 0. Chování v CI s Robot Frameworkem 7.5 ověří první běh na commitu.
- **Dávky oprav** začnou až po plánovaném běhu 1. 11. 2026, který ověřuje změny CI z 28. 10. (jedna proměnná naráz). Dávka 1: suite-level Test Teardown obnovuje stránku jen při selhání testu kvůli zátěži Apps Scriptu. Skill (obě kopie) má nové pravidlo: nové a upravované testy se řídí B5, před commitem dvě otázky o třídách vstupů a o čekání nad starým stavem.

## Docs: architektura automatizace testů (#12) – 28. 10. 2026
Issue #12, commit `1283c99`. Nový dokument `Docs/ARCHITEKTURA-TESTU.md`, odkaz v tabulce „Pro hodnotitele“ v README.
- **Obsah:** návrh architektury automatizace testů podle osnovy kurzu *Architektura automatizovaných testů v praxi*: A strategie (zdroje, pět rozhodnutí, rizikové oblasti), B framework (struktura, prvky, data a secrets, pravidla týmu a test designu), C CI/CD (sady, umístění, flaky testy, výkon, artefakty), D reporting a hodnota automatizace, E jak architektura vznikala (časová osa od 1. 8. do 28. 10. se spouštěči a API nástroje SoapUI, Bruno a JMeter včetně diagnózy HTTP 405). U každého rozhodnutí je uvedeno, jestli je zavedené, nebo navržené.
- **Ověření:** čísla (558 Node, 61 RF = 9 API + 52 frontend, 11 smoke, 7 worker), tagy RF, soubory a klíčová slova ve stromu, hodnoty `CEKANI_*`, retence 30 dní, `Fill Secret` a kontrola úniku proti repu, délky běhů proti historii Actions (3 min 38 s až 4 min 6 s u úplných běhů), datum každého řádku časové osy proti git historii, scénáře api-tests proti README a obsah v3.63 proti CHANGELOGu. První verze měla osm nepřesností (data v časové ose, vracení stavu v api-tests, rozsah opakování ve v3.63 a další), všechny byly před commitem opraveny.
- **Zjištění, která dokument zapsal:** tag `krehky` nese 12 testů, i když pravidlo zní „jen po prokázání vnější příčiny“ (revize je v BACKLOGu); karanténa flaky testů je jen navržená; chybí linter testů (Robocop) a paralelizace je záměrně vypnutá.
- **Doručení notifikací** na telefon při selhání potvrdil majitel screenshoty z 28. 10. Platnost podmínky pro plánovaný běh (a automatické spuštění publikace reportu) ověří až plánovaný běh 1. 11. 2026.

## Docs: správa defektů (#32) – 28. 10. 2026
Issue #32, commit `fd18940` (dokumentace a formulář), úprava boardu a issues přes `gh`.
### Co
- **Formulář defektu** `.github/ISSUE_TEMPLATE/defekt.yml` (štítek `bug`, automaticky na board): shrnutí, oblast, verze a prostředí, kroky, očekávaný a skutečný výsledek, závažnost, priorita, jak nalezeno a důkazy. Upozorňuje, že se nikdy nevkládají tajné hodnoty.
- **`Docs/DEFEKTY.md`:** stupnice závažnosti S1 až S5 a priority P1 až P5 s příklady z projektu, životní cyklus (Nový, Potvrzený, V opravě, Ověřuje se, Uzavřený, Zamítnutý, Nereprodukovatelný), zpětná klasifikace osmi defektů z 26.–28. 10. 2026 a analýza úniků (na které úrovni testů měl být každý defekt chycen, proč unikl a co se změnilo). Odkaz je v tabulce „Pro hodnotitele“ v README.
- **Pole na boardu** (single-select): Závažnost, Priorita, Jak nalezeno, Stav defektu, s hodnotami shodnými s dokumentem a formulářem.
- **Pohled „Defekty“** na boardu: filtr `label:bug`, seskupení podle Závažnosti, sloupce Title, Status, Priorita, Jak nalezeno, Stav defektu.
- **Zpětná klasifikace:** hodnoty polí u #17, #18, #21, #23, #26, #27, #31 a #33 a do každé issue komentář „Zpětná klasifikace“ s analýzou úniku. Hodnoty i komentáře jsem načetl programově z tabulek v `Docs/DEFEKTY.md`, takže odpovídají dokumentu přesně.
- **#18 znovu otevřena** (Stav defektu Ověřuje se, Status In Progress): podle životního cyklu se defekt uzavírá až po ověření v produkci, ověření v datech čeká na čtvrteční běh sledovaných měst, viz #6.
- **#4 (Cloudflare, štítek `bug`)** má jen Stav defektu Nový (nahlášeno, zatím neposouzeno), závažnost a prioritu nemá záměrně vyplněnou.
- **SKILL.md** (sekce 9, obě kopie): pravidlo, že se defekty zakládají formulářem a že se při zavření ručně nastavuje Stav defektu na Uzavřený.
### Zjištění z klasifikace
- Šest z osmi defektů neodhalily automatické testy, ale živá kontrola a analýza (každý nalezený ručně skončil novým testem nebo pojistkou).
- Opakující se příčiny úniků: testovací data a cesta (jen Brno, jen textové datum, ověřování přímým API nebo URL parametrem) a chybějící monitoring dat (#18, #21, #23).
### Ověření
- Formulář se v GitHubu při zakládání issue zobrazuje správně (10 polí, povinná označená), ověřeno v prohlížeči.
- Pohled „Defekty“ po uložení a znovunačtení čisté URL drží filtr, seskupení i sloupce, ověřeno v prohlížeči.
- Pole a komentáře: `gh project item-list` ukázal u všech osmi defektů vyplněná čtyři pole, každá issue má právě jeden komentář „Zpětná klasifikace“.
### Poznámka k provozu
- Vestavěná automatika boardu při zavření issue mění jen Status (Done), ne pole Stav defektu. Při zavření defektu ho nastavit ručně na Uzavřený. Ani znovuotevření issue Status samo nepřepne zpět, viz #18.

## Docs: příběhy chyb – 28. 10. 2026
Issue #10, commit `fd7c012`. Nový dokument `Docs/PRIBEHY-CHYB.md` se třemi případovými studiemi (od příznaku přes diagnózu a kořenovou příčinu po pojistku a poučení): města s diakritikou bez akcí (Index.html v3.65, #31), CI deset týdnů červená (v3.61 a v3.62, #26, #27) a únik tajných hodnot v reportech testů (#33). Odkaz přibyl do tabulky „Pro hodnotitele“ v README.
- Fakta jsem před commitem ověřil proti CHANGELOGu, issues #26, #27, #31 a #33, git historii a živým odkazům (data, počty akcí, rozsah běhů #6 až #15, pořadí nálezu čtyř cest úniku). První verze obsahovala pět nepřesností (stáří chyby, popis starého testu přepínání, lokální běhy, pojistky v CI, téma testovacího profilu), všechny byly opraveny před commitem.
- Zbývající nejistota je v textu uvedená: kořenová příčina deseti červených týdnů je silná nepřímá shoda, ne přímý důkaz, a celá sada úprav v CI se ověří až plánovaným během 1. 11. 2026.

## CI: veřejný RF report přes GitHub Pages – 28. 10. 2026
Issue #11, commit `f2404f8`. Stránka: https://akimto01.github.io/Kulturni_radar/
### Co
- Nový workflow `.github/workflows/publikovat-report.yml` („Publikovat RF report (GitHub Pages)“). Spouští se po dokončení běhu `rf-tests.yml` na `main` (`workflow_run`) a ručně (`workflow_dispatch` s `run_id` běhu).
- Postup: ověří, že zadaný běh patří `rf-tests.yml` z větve `main`, zjistí, jestli má artefakt `rf-reporty` (když ne, skončí bez publikace s vysvětlením v souhrnu běhu), stáhne ho, znovu spustí **stejnou kontrolu úniku tajných hodnot** jako `rf-tests.yml` (při nálezu nepublikuje a selže), smaže všechna PNG a `playwright-log.txt`, vygeneruje `index.html` a nasadí přes `actions/deploy-pages`. Pages mají zdroj GitHub Actions (`build_type=workflow`).
- Generátor stránky: `.github/scripts/generovat-index-reportu.py` (jen standardní knihovna). Index ukazuje datum a čas běhu, spouštěč, commit (odkaz), počty prošlých a selhaných testů obou sad z `output.xml`, odkazy na `report.html` a `log.html` a na běh v Actions. Bez externích zdrojů, česky, světlý i tmavý režim.
### Co se zveřejňuje a co ne
- Zveřejní se jen `index.html` a `report.html` a `log.html` sad API a frontend (5 souborů). Pojistka ve workflow selže, pokud by na webu bylo cokoli dalšího.
- Nezveřejňují se `output.xml`, screenshoty pádů a `playwright-log.txt`. Screenshot může zachytit dialog s ntfy tématem a kontrola obrázky číst neumí, ladicí log zapisuje hodnoty z DOM mimo dosah logování RF. Poznámka o tom je i na stránce.
- Před návrhem jsem prošel obsah artefaktu z hlediska soukromí: jména rodinných profilů se v reportech nevyskytují, jediná e-mailová adresa je veřejný kontakt `info@kulturniradar.cz` z webu.
### Ověření (28. 10. 2026, ruční spuštění pro běh #22)
- Workflow prošel, `https://akimto01.github.io/Kulturni_radar/` vrací 200, stejně jako čtyři odkazy na report a log.
- Index ukazuje API 9/9 a frontend 51/52, což odpovídá běhu #22 (selhal „Notifikace: vygenerování ntfy tématu“, viz záznam o timeoutech).
- Soubory `output.xml`, PNG i `playwright-log.txt` na webu vrací 404, ve stromu je 5 souborů.
- Stažená publikovaná HTML: 0 výskytů vzoru `radar-[0-9a-f]{32}` a 0 výskytů nového PINu. Lokální kopie jsem smazal.
- Lokálně před nasazením: generátor na reálném artefaktu, simulace kroků workflow (čistý výstup projde, umělý únik tématu selže a web se negeneruje).
### Poznámky a rizika
- Stránka dnes ukazuje běh #22 s jedním selhaným testem. Po týdenním běhu 1. 11. 2026 ji přepíše výsledek plánovaného běhu. Automatický průchod `workflow_run` se do té doby neověřil, ověřeno bylo jen ruční spuštění.
- Kontrola úniku je zkopírovaná ve dvou workflow (`rf-tests.yml` a `publikovat-report.yml`). Při změně udržovat obě shodná, případně ji později vyčlenit do sdíleného skriptu.
- Publikuje se každý dokončený běh včetně selhaných. Kdo chce prezentovat jen zelené výsledky, musí to řešit podmínkou ve workflow, záměrně to tak není.

## CI: delší čekání na server jen v CI – 28. 10. 2026
Commit `04538e8`. Týdenní RF běh proti produkci (`rf-tests.yml`).
### Proč
Po běhu #19 (zelený, 52/52) selhaly tři ruční běhy za sebou (#20, #21, #22), pokaždé jiný test a vždy čekání na Apps Script: v #20 viselo přihlášení v Suite Setup přes 15 s (celá frontend sada 0/52, tlačítko zůstalo „Přihlašuji…“), v #21 zápis u „🏛 Oblíbené místo“ přes 10 s, v #22 uložení filtrů v testu notifikací přes 10 s. Stejný vzorec měl běh #17 (zápis ★ přes 10 s, `page.goto` po 10 s). Pravděpodobná příčina je kolísající odezva Apps Scriptu pod zátěží (pokaždé jiný test, vždy čekání na server, odezva backendu při ruční kontrole 2 až 4 s). Je to nepřímá shoda, přímý důkaz nemáme.
### Co
- Tři proměnné v `tests/robot/resources.robot`. **Výchozí hodnoty se rovnají dosavadním pevným timeoutům, takže lokální chování se nemění a přísnost se nesnižuje:**
  - `${CEKANI_ZAPIS}` 10 s: dokončení zápisu,
  - `${CEKANI_PRIHLASENI}` 15 s: přihlášení,
  - `${CEKANI_NAVIGACE}` 10 s: `Set Browser Timeout` v Suite Setup (page.goto a akce bez vlastního timeoutu).
- `rf-tests.yml` je u frontend běhu přepisuje na **30 s, 40 s a 30 s** (`--variable CEKANI_ZAPIS:30s --variable CEKANI_PRIHLASENI:40s --variable CEKANI_NAVIGACE:30s`). API běh beze změny.
### Pokrytá čekání (`frontend.robot`)
- `${CEKANI_PRIHLASENI}`: zmizení `#login-overlay` po přihlášení (keyword „Přihlásit se do radaru“), čekání na dlaždice profilů (keyword a tři testy s přihlašovací obrazovkou).
- `${CEKANI_ZAPIS}`: `:not(.ukladani)` po zápisu ★, ✓ a 🏛 (test „Označení ★ se skutečně promítne do filtru“ dvakrát a sdílený keyword „Ověřit plný cyklus označení“ dvakrát), ntfy téma po vygenerování nebo rotaci (`rotovat:not([disabled])`, `s-tematem`) a zavření `#filtry-dialog` po uložení (dvakrát).
- `${CEKANI_NAVIGACE}`: Browser timeout nastavený před prvním `New Page`, dědí ho i testy s vlastní stránkou.
### Co záměrně ne a proč
- **Čistě klientské věci** (3 až 5 s): otevření a zavření dialogů přes `#filtry-zavrit`, přepínání oblastí e-mail a ntfy, kalendář, mapa, tooltip, optimistická odezva ikon (`Wait Until Keyword Succeeds 10s`). Nečekají na server.
- **Čtení dat** (`.karta`, `.chip` po načtení a reloadu, 15 až 20 s): není to zápis ani přihlášení a neselhávalo to.
- **Odeslání kontaktního formuláře** (`#kontakt-odeslat:not([disabled])`, 15 s): je to serverový zápis, ale na timeout nikdy nespadl a dnešní výchozí hodnota je jiná než u `${CEKANI_ZAPIS}`, proto bez nové proměnné.
### Notifikace
Krok „Upozornění na selhání (ntfy)“ běží jen pro plánované běhy (`failure() && github.event_name == 'schedule'`). Ruční běh notifikaci neposílá, sleduje ho ten, kdo ho spustil.
### Ověření a rizika
- Lokálně: RF dry run 61/61, zkušební test přepsání proměnných přes `--variable`, smoke 11/11 s výchozími hodnotami (bez výskytu PINu v jeho výstupu).
- **V CI zatím neověřeno.** Dnes se v CI nic nespouštělo (Apps Script měl za sebou hodně zátěže). První ověření bude plánovaný běh v neděli 1. 11. 2026.
- Browser timeout je globální: v CI platí 30 s pro všechny akce bez vlastního timeoutu (klik, čtení), takže skutečná chyba se projeví později a při pomalém backendu může běh trvat výrazně déle. Přísnost testů se nesnižuje.

## Bezpečnost: únik tajných hodnot v artefaktech CI – 28. 10. 2026
Issue #33 (závažnost: vysoká, veřejně dostupné tajemství; priorita: okamžitá). Hodnoty se tu z principu neuvádějí.
### Co unikalo a kde
- **PIN profilu rf-test.** Keyword „Přihlásit se do radaru“ zadával PIN přes `Fill Text`. Browser Library zapsala hodnotu do zprávy „Fills the text …“ v `frontend/output.xml` (3 až 9 výskytů na artefakt) a `frontend/log.html`.
- **Téma ntfy (secret `NTFY_TOPIC`)**, na třech místech:
  1. vyřešená URL ve zprávách `RequestsLibrary.GET` (`api/output.xml`, `api/log.html`),
  2. dokumentace testu: RF v `[Documentation]` rozvíjí proměnné, takže zápis `${NTFY_TOPIC}` v textu se propsal jako hodnota do `output.xml`, `log.html` i `report.html`. První rozbor to přehlédl, protože hledal jen vzor `ntfy.sh/`,
  3. po první opravě: hodnoty iterační proměnné cyklu `FOR` (každý řádek odpovědi ntfy obsahuje pole `topic`). RF je zapisuje do `output.xml` i při `Set Log Level NONE`. Zachytila to nová kontrola v CI (běh #18), artefakt se proto nenahrál. Příčina potvrzena lokálně na umělé odpovědi s fiktivním tématem: cyklus `FOR` 2 výskyty, jeden `Evaluate` 0.
- Artefakty `rf-reporty` týdenního workflow. Repo je veřejné, artefakty si mohl stáhnout kdokoli přihlášený. Logy běhů v Actions secrets maskují a nic neprozradily.
### Od kdy podle kódu
- Téma: `GET https://ntfy.sh/${NTFY_TOPIC}/json` v `api.robot` od 2. 8. 2026 (`16b8207`).
- PIN: `Fill Text` s `${pin}` od 8. 8. 2026 (`3285555`, uživatelské profily), secret `RF_TEST_PIN` vznikl 7. 8. 2026.
- V době nálezu existovaly 4 artefakty (běhy #14 až #17, vždy postižené). Starší artefakty už expirovaly (retence 14 dní), takže rozsah za dobu od srpna nejde zpětně ověřit a hodnoty jsem považoval za kompromitované.
### Jak nalezeno
Při přípravě veřejného RF reportu (issue #11) vzniklo podezření, že `log.html` a `output.xml` obsahují tajné hodnoty. Ověřeno stažením artefaktu a spočítáním výskytů (jen počty a názvy keywordů).
### Poznámka k PINu
Starý PIN byl shodný s testovací hodnotou, kterou používají veřejné unit testy v repu (nalezeno v `kulturni_radar.gs`, `unit.test.js` a `frontend.test.js`). Byl tedy slabý a uhodnutelný i bez úniku v reportech.
### Oprava
- Smazány všechny 4 artefakty, lokální stažené kopie také.
- `Fill Secret` místo `Fill Text` pro PIN (`b2efc37`). U testu živosti ntfy `Set Log Level NONE` s `TRY/FINALLY`, stav se kontroluje až po obnovení logování (`b2efc37`), escapovaná proměnná v dokumentaci, zprávy se počítají jedním `Evaluate` místo `FOR` (`6e80329`).
- Nový krok „Kontrola úniku tajných hodnot“ v `rf-tests.yml`: prohledá `vysledky/` na hodnoty obou secretů, při nálezu vypíše jen název souboru a secretu a skončí chybou. Upload artefaktu je na úspěchu kontroly závislý, takže uniklý report se nenahraje, a notifikace na ntfy při selhání (`74eb619`) pokryje i únik. U PINu kratšího než 8 znaků krok hlásí `::warning::` a hledá jen v uvozovkách a jako celý text prvku (`7b98fd4`).
### Výměna hodnot (28. 10. 2026)
- Nový PIN rf-test (8 náhodných alfanumerických znaků), hash vypočten skutečnou `hashPin_` přes `tests/harness.js` a ručně vložen do listu UŽIVATELÉ.
- Nové téma ntfy: Script Property `NTFY_TOPIC`, GitHub secret, odběr v telefonu. Test notifikací z menu dorazil na nové téma.
- GitHub secrets `RF_TEST_PIN` a `NTFY_TOPIC` přenastaveny. Lokální uživatelské proměnné `RF_TEST_PIN` a `TEST_PIN` (SoapUI a Bruno sdílejí profil rf-test, jinak by omylem spuštěný test se starým PINem profil zamkl) nastaveny na nový PIN.
### Ověření
- Lokální smoke 11/11 s novým PINem, v jeho výstupu 0 výskytů PINu.
- Ruční běh #19: API 9/9, frontend 52/52, kontrola úniku prošla, artefakt nahrán (retence 30 dní), v něm 0 výskytů nového PINu a žádné téma s délkou nového secretu. Přesnou hodnotu tématu lokálně neznám, kontrolu s reálnou hodnotou provedl krok v CI.
- Běh #18 ukázal, že kontrola funguje: našla únik, který jsem lokálně nezachytil, a report se nenahrál.
### Poučení
- Při `Log Level NONE` RF stále zapisuje do `output.xml` hodnoty iterační proměnné `FOR`. Tajná data se nesmí procházet cyklem.
- RF v `[Documentation]` rozvíjí proměnné: tajnou proměnnou v dokumentaci escapovat (`\${…}`).
- Krátký PIN se nehledá spolehlivě prostým `grep` (falešné shody v kódu knihovny, časech a číslech). Proto 8 znaků a pojistka v kroku.
### Zbytková položka vyřešena: téma ntfy profilu rf-test (28. 10. 2026, `af89207`)
- **Co:** test notifikací generuje téma profilu rf-test (`radar-` + 32 hex, `apiVygenerovatNtfyTema_`). Hodnota se zapisovala do reportů frontendu: `Get Attribute` a přiřazení proměnné, chybové zprávy asercí, `playwright-log.txt`. Kdo téma zná, může číst notifikace profilu. Citlivost nižší než u produkčního `NTFY_TOPIC`, ale veřejně dostupná.
- **Jak:** test „Notifikace: vygenerování ntfy tématu…“ jede kolem čtení odkazu při `Set Log Level NONE` (`TRY/FINALLY`), podmínky `IF` jsou přes `$proměnnou`, aby hodnota nebyla v textu podmínky, a aserce jsou po obnovení logování bez hodnot ve zprávě. Kontrola úniku v `rf-tests.yml` hledá navíc obecný vzor `radar-[0-9a-f]{32}`, takže pokryje téma kteréhokoli profilu.
- **Rozhodnutí: `playwright-log.txt` se do artefaktů nenahrává.** Browser Library do něj zapisuje i hodnoty vrácené z DOM mimo dosah úrovně logování RF, takže ho nelze maskovat. Kontrolní krok ho před nahráním maže. Pro diagnostiku pádů v CI slouží `log.html` a screenshoty, ladicí log zůstává při lokálních bězích.
- **Ověření:** lokální běh testu: vzor `radar-[0-9a-f]{32}` má 0 výskytů v `output.xml`, `log.html` i `report.html` (v `playwright-log.txt` 2, proto se maže). Blok kontroly nad výstupem skončil exit 0, na umělém výskytu exit 1. V artefaktu běhu #22 (CI) je 0 výskytů vzoru, 0 výskytů PINu a soubor `playwright-log.txt` chybí. Artefakt z běhu #19, který ještě obsahoval téma profilu z doby před opravou, jsem smazal.
- **Běhy po opravě nebyly zelené, příčina není oprava:** #20 (frontend 0/52, přihlášení v Suite Setup viselo přes 15 s, tlačítko „Přihlašuji…“, žádná chyba PINu), #21 (51/52, „🏛 Oblíbené místo“, zápis přes 10 s) a #22 (51/52, „Notifikace: vygenerování ntfy tématu“, po uložení filtrů se dialog nezavřel do 10 s, maskovaná část testu prošla). Pokaždé jiný test a vždy čekání na zápis nebo přihlášení na Apps Scriptu, stejný vzorec jako v běhu #17. Kontrola úniku prošla ve všech třech a artefakty se nahrály. Řeší položka „Timeouty v CI“ v BACKLOGu. Zelený běh s novou kontrolou byl #19 (před touto opravou).
- Po pádech jsem ověřil stav rf-test: 0 označených akcí, 0 označených míst, přihlášení s novým PINem funguje.
### Otevřené
- Screenshoty pádů (`browser/screenshot/*.png`): prohlédl jsem jeden (běh #20), PIN je v poli maskovaný tečkami a téma na něm není. Ostatní jsem neprošel, kontrola úniku v CI PNG nehledá.

## CI: týdenní RF běh byl 10 týdnů červený – 28. 10. 2026
### Co se stalo
- Workflow `rf-tests.yml` (neděle 19:00 UTC, proti produkci) selhal v běhách #6 až #15 (23. 8. až 25. 10. 2026), poslední zelený byl #5 (16. 8.). Nikdo si toho nevšiml, protože selhání nikam nehlásí. Odznak RF testů v novém README byl kvůli tomu červený.
- Mezi #5 a #6 se nezměnilo `rf-tests.yml`, `requirements.txt` ani secrets (naposledy 7. 8.). Změnila se sada: `frontend.robot` z 25 na 50 testů (+656 řádků) a Index.html v3.43 až v3.57. API testy (9) procházely vždy.
- Ověřeno v Gmailu 28. 10. 2026: plánované běhy #6 až #15 nevyvolaly žádný e-mail o selhání. E-maily „Run failed: RF testy“ přišly jen u ručně spuštěných běhů (28. 10. 2026) a e-maily ze starého push workflow „Testy“ (19. 8. 2026) skončily přes filtr mimo doručenou poštu. Selhání tedy bylo skutečně tiché, ntfy notifikace z plánovaného běhu je správná oprava.
### Pády frontendu podle běhů
| Běh | Datum | Commit | Pády | Padlé testy |
|---|---|---|---|---|
| #6 | 23. 8. | 8311581 | 4 | chip typu stálého místa, ★ promítne do filtru, ★ lze označit, ✓ lze označit |
| #7 | 30. 8. | 44ddc5b | 4 | karty mají ikony ★/✓, ★ promítne do filtru, ★ lze označit, ✓ lze označit |
| #8 | 6. 9. | 273d2a4 | 4 | chip Neověřeno, ★ promítne do filtru, ★ lze označit, ✓ lze označit |
| #9 | 13. 9. | a237630 | 23 | téměř vše timeout (výpadek odezvy backendu) |
| #10 | 20. 9. | a347382 | 5 | chip typu místa, chip Neověřeno, trojice ★/✓ |
| #11 | 27. 9. | a347382 | 3 | trojice ★/✓ |
| #12 | 4. 10. | e85f804 | 3 | trojice ★/✓ |
| #13 | 11. 10. | 3f04d62 | 4 | chip Neověřeno, trojice ★/✓ |
| #14 | 18. 10. | 3f04d62 | 4 | chip typu místa, trojice ★/✓ |
| #15 | 25. 10. | 3f04d62 | 4 | chip Oblíbené, chip Neověřeno, ★ lze označit (po reloadu hvězda nedrží), kalendář hover |
- V #6 až #14 se navíc přeskakoval test „🏛 Oblíbené místo“ (první karta neměla známé místo). Podrobnosti jsou z logů, artefakty mají retenci 14 dní.
### Seskupení příčin
| Příčina | Pády | Stav |
|---|---|---|
| Opraveno 26.–27. 10. | kalendář hover, část chip testů (`0 != N`), skip 🏛 | v3.61 až v3.65 a opravy testů |
| Pravděpodobně závod odpovědí + slabý test (nepřímá shoda, viz sekce níže) | trojice ★/✓ (#6 až #14), pak jiný pád ★ v #15 | 9 běhů za sebou stejný pád, 0 karet na stránce |
| Prostředí CI / backend | #9 (23 pádů), timeout `page.goto` v #17 | přechodné výpadky odezvy Apps Scriptu nebo webu |
| Nestabilní test | chip typu stálého místa, chip Neověřeno | výsledek závisí na datech profilu, viz BACKLOG |
### Ověření hypotézy: zápis ★ na řádek „Léto na Zelňáku“
- Hypotéza: zápis ★ na řádek se sériovým číslem místo data (ID `2026-05-14-leto-na-zelnaku`) selhával na serveru, hvězda zůstala v „ukládání“ a testy timeoutovaly.
- Test: POST na `/exec` akce `toggle` (typ `oblibene`, profil rf-test) dvakrát za sebou na Zelňák a dvakrát na běžnou budoucí akci Brna (`2026-10-29-hollywood-halloween`).
- Výsledek: všechna čtyři volání vrátila `ok:true` za 2 až 3 s, odpovědi mají stejný tvar (Zelňák false, pak true; Halloween true, pak false). **Hypotéza o selhání zápisu na serveru se nepotvrdila.** Řádek Zelňáku zápis přijímá stejně jako běžná akce.
- Zelňák navíc měl ★ nastavenou už před testem (první volání ji vypnulo, druhé vrátilo), takže po dřívějších pádech zůstala u rf-test ★ na tomhle řádku. Původní stav jsem obnovil.
- V logu #6 až #14 test čekal na ikonu `.ikona-oznaceni.hvezda` u první karty a ta se neobjevila vůbec (nešlo o stav „ukládání“). Vysvětlení viz další sekce.
### Pravděpodobná příčina ★/✓ trojice a chip testů
**Jde o silnou nepřímou shodu, ne o přímý důkaz.** Příčinu jsem nereprodukoval ani neviděl v datech běhu.
- (a) Ikony ★/✓ se na kartě vykreslují bez podmínky i ve starém kódu (ověřeno v `8311581` i `3f04d62`). Chyba „Karty mají ikony pro Oblíbené a Navštívené: `0 != 1`“ proto neznamená chybějící ikony, ale **0 karet na stránce**. Totéž platí pro timeout na `.karta .first .ikona-oznaceni`: žádná karta, žádná ikona.
- (b) Test „Opakované přepnutí profilu“ přibyl 21. 8. 2026 (viz BACKLOG), první červený běh #6 byl 23. 8. Časově to sedí.
- (c) Test přepínal profily rychle za sebou bez čekání na dokončení načtení. Závod pozdních odpovědí (opraven v Index.html v3.61, test přepsán ve v3.62) mohl nechat seznam prázdný a následující testy v souboru pak narazily na 0 karet. V CI s pomalejší odezvou Apps Scriptu je to pravděpodobnější než lokálně.
- (d) Stejný příznak (0 karet) mají nestabilní chip testy (`0 != N`).
- (e) Po opravách prošel #16. Běh #17 sice selhal, ale jinak: pomalý zápis ★ a timeout `page.goto`, ne 0 karet.
### Ověření opakovaným během
- Ruční běh #16 (HEAD `7109792`): API 9/9, frontend 52/52, nic přeskočeného.
- Ruční běh #17 (stejný commit): frontend 50/52. ★ lze označit (ikona zůstala v „ukládání“ přes 10 s) a „Mapa lze otevřít a zavřít“ (timeout `page.goto` na kulturniradar.cz po 10 s). #16 tedy nebyl důkaz stability, týdenní běh je pořád křehký.
- Po #17 zůstala u rf-test nastavená ★ na první kartě Brna (Hollywood Halloween): test při pádu uprostřed zápisu hvězdu nevrátil. Viz write-safety v sekci 8 skillu.
### Změna CI (commit `74eb619`)
- `rf-tests.yml`: krok `if: failure()` pošle notifikaci na ntfy (secret `NTFY_TOPIC`, titulek a odkaz na běh), `retention-days` 14 na 30. Notifikace jde přímo na ntfy.sh přes HTTP (appka používá e-mailovou bránu kvůli kvótě sdílených IP Googlu, runner GitHubu má jiné IP). Krok zatím nebyl vyzkoušený na skutečném selhání.
- `tests/robot/requirements.txt`: přesné verze z instalace v #16: robotframework 7.5, robotframework-requests 0.9.7, robotframework-browser 20.6.0. Tranzitivní závislosti zamčené nejsou. Lokálně mám starší verze (7.4.2 a 20.0.0), takže se lokální a CI prostředí liší.
### Další kroky
- Ošetřit chip testy (BACKLOG, Testovací dluh).
- Timeouty v CI (zápis ★/✓, `page.goto`), viz BACKLOG, Testovací dluh.
- Po #17 jsem hvězdu u rf-test na Halloweenu vrátil a ověřil přes `?api=events` (0 označených akcí v seznamu Brna). Zelňák (minulá akce, v seznamu se nezobrazuje) má ★ nastavenou dál, testy ho nevidí.

## Docs: README jako rozcestník – 28. 10. 2026
- Nové `README.md` pro hodnotitele: odznaky CI, odkaz na kulturniradar.cz, krátké EN shrnutí, tabulka „Pro hodnotitele: kde co najít“ (board a testovací dokumentace), „Testy v číslech“, „Jak pracuji“ s vybranými chybami (#31, #26, #27, #22), aktualizované „Co appka umí“, architektura, struktura repa a provoz s aktuálními náklady.
- Čísla ověřena proti repu: Node 349 (backend) a 209 (frontend), RF dry run 61 (frontend 52, API 9), Worker 7. Všechny relativní odkazy vedou na existující soubory, odznaky vrací HTTP 200.
- Bez změny kódu (backend 3.50, `Index.html` v3.65). Commit `5b044a7`, issue #9 uzavřeno.

## Index.html v3.65 – oprava dvojitého kódování profilu (města s diakritikou) – 27. 10. 2026
### Chyba
- Při ověřování v3.64 ukazovaly Plzeň a Zlín na kulturniradar.cz 0 akcí i 0 míst, přestože API pro ně akce vrací (Plzeň 18).
- Příčina (ověřeno v prohlížeči): `nactiAkce`/`nactiMista` předají profil přes `encodeURIComponent`, `api()` ho nechalo zakódovaný a `sestavFetchPozadavek_` ho zakódoval znovu. Server dostal „Zl%C3%ADn“ místo „Zlín“.
- Rozsah: všechna města s diakritikou (Plzeň, Zlín, Třinec…). Brno a další ASCII názvy fungovaly.
### Od kdy chyba existovala (git log/blame)
- Řádek `const profil = param.replace('profil=', '');` v `api()` vznikl v `c0a1549` (2. 8. 2026, v3.3) spolu s `encodeURIComponent` v `nactiAkce`/`nactiMista`. Už tehdy šel zakódovaný profil přímo do `google.script.run`, a backend nikde nedekóduje (v `kulturni_radar.gs` není `decodeURIComponent`). Podle kódu tedy chyba v režimu `google.script.run` pravděpodobně existovala od 2. 8. 2026; živě jsem ten režim neověřoval.
- Fetch režim (`sestavFetchPozadavek_`, statický web) vznikl v `7326b54` (8. 8. 2026, v3.15/v3.21) a profil kóduje podruhé.
### Proč to testy nezachytily
- RF testy jedou s Brnem (bez diakritiky).
- Včerejší kontrola ostatních měst šla přímo přes API, ne přes appku.
### Oprava
- `api()` profil před předáním dekóduje: `decodeURIComponent(param.replace('profil=', ''))`.
### Testy
- Node 554 → 558 (+4), mutačně ověřené: bez opravy spadnou 3 ze 4. Čtvrtý je regrese pro Brno a prázdný profil.
- Nový RF test „Přepnutí na město s diakritikou načte jeho akce (regrese v3.65)“: dynamicky vybere prohledané město s diakritikou a město „nikdy neprohledáno“, přes ně ověří, že se akce vybraného města načtou, a vrátí původní profil.
- Riziko testu: vybere první prohledané město s diakritikou v abecedě (dnes Plzeň). Kdyby to bylo město bez budoucích akcí, falešně spadne (viz BACKLOG).
### Živé ověření 27. 10. 2026 (claude-in-chrome)
| Město | Před opravou | Po opravě |
|---|---|---|
| Plzeň | 0 akcí | 18 akcí |
| Zlín | 0 akcí | 9 akcí |
| Třinec | 0 akcí | 0 akcí (správně, API vrací 0) |
- Žádný ze 6 požadavků nemá dvojité kódování (`%25`).
### RF po nasazení
- Nový test 2× PASS (vybral Plzeň, prázdné město Česká Lípa), smoke 11/11, frontend sada bez zápisových testů 46/46.
### Poznámka
- Backend beze změny (3.50), `Index.html` v3.65. Apps Script verze projektu 112, commit `7e21952`.

## Index.html v3.64 – audit selektorů D–H – 27. 10. 2026
### Změněno (jen atributy, chování beze změny)
- D: `.misto-karta[data-misto="název|obec"]`.
- E: `.btn-url[data-akce="vice-info|kalendar|mapa|sdilet"]`.
- F: chipy typů míst `[data-typ]` („Vše“ = prázdný řetězec). Refaktor na `vytvorChip()` vědomě vynechán, návrh ho doporučuje posoudit zvlášť.
- G: `.mapa-stat[data-stat="akci|mist|kategorii"]`.
- H: `#den-probiha` na hlavičce skupiny „Probíhá / dlouhodobé“.
### Zpevněné RF testy
- Odkazy Do kalendáře, Mapa a Sdílet přes `data-akce`, u prvních dvou i ověření cíle odkazu.
- Test sekce stálých míst ověří `data-misto` u všech karet.
- Test chipů typů míst přes `data-typ` místo pozice a textu „Vše“.
### Ověření v Chrome (claude-in-chrome)
- D: 18/18 karet míst má `data-misto`. E: všechny čtyři `data-akce`. F: chipy mají `data-typ`. G: tři buňky statistiky mají `data-stat`.
- Zjištění: stejnou třídu `.mapa-stat` používají i dlaždice mini předpovědi počasí, ty `data-stat` nemají. Nový atribut je spolehlivě odliší.
- H živě neověřeno: žádný kontrolovaný profil teď nemá probíhající akci, skupina „Probíhá“ se nevykresluje.
### RF po nasazení
- Smoke 11/11, frontend sada bez zápisových testů 45/45, bez SKIP.
### Poznámka
- Backend beze změny (3.50), `Index.html` v3.64. Apps Script verze projektu 111, commit `8a5b663`.

## Backend v3.50 – počet fuzzy sloučení v týdenním reportu; uzavření „kategorie D“ – 27. 10. 2026
### Analýza
- Zdroj: log fuzzy sloučení ve sloupci Z listu AKCE, čteno přes claude-in-chrome 27. 10. 2026. 25 řádků se záznamem (9. 9.–27. 10. 2026).
- Zhruba 20 sloučení je správných (táž akce pod jiným názvem), např. „Festival Serial Killer 2026“ → „Serial Killer festival“, „Maker Faire Brno“ → „Maker Faire Brno 2026“.
- 4–5 sloučení je podezřelých na spojení dvou různých akcí:

| Sloučení | Podezření |
|---|---|
| NPÚ bezplatné prohlídky | série, změna obce |
| Slavnostní / Zahajovací koncert v Obecním domě | dva různé koncerty |
| Výstava v Galerii města Třince → „To to letí… 95 let města Třince“ | různé výstavy |
| Západočeské baroko 2026 → „– Manětín“ | přepsáno i datum do |
| Výstava Olomouc buďme kámoši → Olomouc buďme 2026 | různé akce |

### Rozhodnutí: chování ponechat, jen sledovat počet
- Bezpečnější varianta (nesluč při pochybnosti) by u zhruba 20 správných případů vytvořila duplicity na webu, tedy víc škody než užitku.
- Spolehlivé pravidlo pro rozlišení série od přejmenování nejde z 25 případů navrhnout bez hádání.
### Změna v3.50
- `spocitatFuzzySlouceni_(bunky, ted)` (čistá funkce) spočítá záznamy „[fuzzy merge D. M. RRRR …]“ za posledních 7 dní a 7 dní před tím, stejné okno jako `hodnotitKvalituHledani_`.
- `runSelfTest` předá sloupec Z do `hodnoceni.fuzzy`, `sestavReportKvality_` přidá řádek „fuzzy sloučení v AKCE: N | dříve: M“. Jen viditelnost, nic se nezapisuje.
### Testy
- Node 551 → 554 (+3), mutačně ověřené 2/3. Třetí mutant je ekvivalentní (data v logu jsou bez času).
- Zapojení do `runSelfTest` není pokryté testem, ověří se s reportem 1. 11. 2026.
- RF po nasazení: smoke 11/11.
### Poznámka
- Backend v3.50, `Index.html` beze změny (v3.63). Apps Script verze projektu 110, commit `bf02050`.

## Index.html v3.63 – jeden retry při HTTP 404 z echo URL – 27. 10. 2026
### Kontext
- Přerušované výpadky Apps Scriptu 7.–8. 10. 2026 se projevovaly HTTP 404 na přesměrované „echo“ URL (`script.googleusercontent.com/macros/echo`), viz skill, vzorec B. Frontend je ukázal uživateli jako chybu.
### Klíčové zjištění
- Při 404 na echo URL už skript na serveru proběhl, ztratila se jen odpověď. Opakovat tedy nelze naslepo: u zápisů by se akce provedla dvakrát.
### Pravidlo
- `gsrPresFetch_` při HTTP 404 jednou zopakuje požadavek po 800 ms (`OPAKOVANI_PAUZA_MS_`). Rozhoduje nová čistá funkce `lzeOpakovatPozadavek_(poz, status)`.
- Opakuje se: čtení (GET) a idempotentní zápisy `filtry` a `set-notifikace` (jen nastaví hodnotu, opakování dá stejný výsledek).
- Neopakuje se:
  - přepínače ★/✓/🏛 – druhé volání by stav vrátilo zpět,
  - login – špatný PIN by se započítal dvakrát (limit v3.45),
  - kontakt – odešly by dva maily,
  - run a najdi – kontrola by dvakrát zaplatila AI,
  - ntfy téma – vygenerovalo by se jiné.
- Režim `google.script.run` beze změny.
### Testy
- Node 544 → 551 (+7), mutačně ověřené 5/5, včetně mutací „retry pro přepínače“ a „retry ve smyčce“.
### Živé ověření 27. 10. 2026 (claude-in-chrome, fault injection obalem `window.fetch`, jen v záložce)
| Scénář | Podvržená 404 | Volání | Výsledek |
|---|---|---|---|
| Načtení akcí Brna | jen 1. pokus | 2, rozestup 811 ms | 17 akcí, bez chyby |
| `apiToggle` | stále | 1 | chyba „Server vrátil HTTP 404“, bez opakování |
| `apiSetFiltry` | stále | 2 | po druhém pokusu chyba |
- U scénářů 2 a 3 stub požadavky zachytil, na server nic neodešlo.
### Testy po nasazení
- RF: smoke 11/11, frontend sada bez zápisových testů 45/45.
- RF frontend testy jdou přes appku, takže je retry chrání i před vzorcem B. API testy volají server přímo a nemění se.
### Poznámka
- Backend beze změny (3.49), `Index.html` v3.63. Apps Script verze projektu 109, commit `5f61ed7`.
- Frontend se nasazuje `git push` (Cloudflare Pages), na Apps Script jde přes clasp.

## Index.html v3.62 + RF test přepnutí profilu – 27. 10. 2026
### Chyba
- Po přepnutí v dropdownu na město „nikdy neprohledáno“ (Česká Lípa) se v prázdném stavu zobrazila hláška „Žádné akce pro vybraný filtr (naposledy zkontrolováno: 27. 10. 2026 8:13)“ – čas Brna. Ověřeno živě přes claude-in-chrome.
- Příčina: `renderAkce` bral `posledniKontrolaProfilu_[aktivniProfil]`, ale `aktivniProfil` se nastaví jen při startu stránky. Změna v3.59 se ověřovala přes URL `?profil=`, kde to funguje, takže přepnutí v dropdownu nezachytila.
- Chybu odhalil až přepracovaný RF test (původní verze dvakrát po sobě spadla na čekání na hlášku, viz níže).
### Oprava
- `nactiAkce` si po stráži z v3.61 zapamatuje `zobrazenyProfil_` (profil, jehož akce jsou právě zobrazené).
- Nová čistá funkce `hlaskaPrazdnehoStavuProProfil_(mapaKontrol, zobrazenyProfil, aktivni)` podle něj vybere hlášku; `renderAkce` ji používá místo `aktivniProfil`.
### Testy
- Node 540 → 544 (+4), mutačně ověřené 3/4. Čtvrtou mutaci (zapojení v `renderAkce`) hlídá RF test, který před opravou 2× spadl a po ní prošel.
### Změna RF testu „Opakované přepnutí profilu v dropdownu nerozbije appku (regrese v3.12)“
- Stará verze po každém přepnutí čekala jen na viditelnou kartu, což splnily ještě staré karty. Bug z v3.12 by nezachytila a nechávala běžet překrývající se požadavky (souvislost s pády chip testů, viz v3.61).
- Nová verze střídá původní profil s městem „nikdy neprohledáno“ (vybraným dynamicky), čeká na hlášku prázdného stavu a 0 karet, pak na návrat karet; 2 cykly. Pozorovatelné přechody 0 ↔ karty.
- Omezení: schopnost zachytit bug z v3.12 nejde ověřit mutačně bez nasazení rozbité appky.
### Výsledky po nasazení (27. 10. 2026)
- Nový test 2× PASS (před opravou 2× FAIL), smoke 11/11, frontend sada bez zápisových testů 45/45.
### Poznámka
- Backend beze změny (3.49), `Index.html` v3.62. Apps Script verze projektu 108, commit `56a2cd1`.
- Frontend se nasazuje `git push` (Cloudflare Pages), na Apps Script jde přes clasp.

## Index.html v3.61 – zahodit pozdní odpověď při přepínání profilu – 26. 10. 2026
### Kontext
- V plném běhu frontend sady (26. 10. 2026) spadly dva chip testy (Chip typu stálého místa: 0 != 18, Chip Oblíbená místa: 0 != 15), izolovaně 2× PASS. Vysvětlení s pevným `Sleep 300ms` se ukázalo jako chybné (chipy překreslují synchronně bez síťového požadavku, ověřeno čtením `Index.html`).
### Důkaz chyby (fault injection)
- V prohlížeči (claude-in-chrome) s odpovědí pro Českou Lípu uměle zpožděnou o 4 s (obal `window.fetch`, jen v záložce) a přepnutím Česká Lípa → Brno stránka po pozdní odpovědi pod volbou Brno ukázala 0 akcí a 0 míst. `nactiAkce` a `nactiMista` neměly ochranu proti pozdní odpovědi.
- Bez zpoždění se chyba ani před opravou 4× nezreprodukovala.
### Změněno
- `nactiAkce` a `nactiMista`: pořadová čísla požadavků (`poradiNacteniAkci_`, `poradiNacteniMist_`). Zpracuje se jen odpověď na poslední požadavek, zastaralá odpověď i chyba zastaralého požadavku se zahodí.
- `tests/frontend-harness.js`: podpora `async function` (vezme i předchozí klíčové slovo `async`).
### Testy
- Node 536 → 540 (+4), mutačně ověřené 4/4, včetně mutace „stráž nezpracuje nic“.
### Živé ověření 26. 10. 2026 (fault injection, Česká Lípa → Brno, odpověď zpožděná o 4 s)
| | v3.60 (před opravou) | v3.61 (po opravě, 2 pokusy) |
|---|---|---|
| Akcí pod volbou Brno | 0 | 14 |
| Míst pod volbou Brno | 0 | 18 |
- RF po nasazení: smoke 11/11, frontend sada bez zápisových testů 45/45.
### Závěr a omezení
- Že šlo o příčinu dnešních pádů chip testů, je pravděpodobné, ne dokázané: bez zpoždění se chyba nereprodukovala a pády se v plném běhu objevily jen jednou.
### Poznámka
- Backend beze změny (3.49), `Index.html` v3.61. Apps Script verze projektu 107, commit `d86001c`.
- Frontend se nasazuje `git push` (Cloudflare Pages), na Apps Script jde přes clasp.

## RF testy (bez bump verze) – kalendář hover: deterministická souhra s předchozím testem – 26. 10. 2026
### Kontext
- Pád testu „Kalendář: hover na den s akcí zobrazí tooltip…“ v plném běhu (26. 10. 2026), izolovaně PASS.
### Příčina
- Předchozí test „Kalendář: klik na den s akcí odscrolluje…“ klikne na buňku 29. 10. (v říjnu 2026 jediný den s akcí s vlastní sekcí). Klik tooltip schová a myš zůstane nad buňkou. Hover test najede na tutéž buňku (první `.ma-akce`), myš se nepohne, `mouseenter` nevznikne a tooltip se neukáže (`TimeoutError` na `#kalendar-tooltip.zobrazeno`).
### Reprodukce a oprava
- Na původním kódu spuštění obou testů za sebou: klik PASS, hover FAIL, 2× z 2×.
- Oprava v `tests/robot/frontend.robot`: před hoverem na buňku nejdřív `Hover` na `header h1`, čímž se zaručí skutečný `mouseenter`.
### Ověření
- Stejný pár testů po opravě: 2× oba PASS.
- Plná frontend sada po opravě: 43/45; dva pády (Chip typu stálého místa: 0 != 18, Chip Oblíbená místa: 0 != 15) izolovaně 2× PASS. Příčina neznámá. Původní vysvětlení (pevný Sleep 300ms) je chybné: oba chipy překreslují synchronně bez síťového požadavku (ověřeno čtením Index.html), takže na délce čekání nezáleží. Hypotéza k ověření viz BACKLOG.
### Poznámka
- Jen testy a dokumentace, žádná změna kódu appky, bez bumpu verze (backend i frontend beze změny).
- `Docs/BACKLOG.md`: přepsaná sekce „Doporučené pořadí“ (aktualizace 26. 10. 2026).

## Backend v3.49 + Index.html v3.60 – testovací profily skryté na veřejné přihlašovací obrazovce – 26. 10. 2026
### Kontext
- Nález ze živé kontroly 26. 10. 2026: profil „RF Test“ byl vidět na veřejné přihlašovací obrazovce.
- Je to kosmetika pro veřejný web, ne zabezpečení: profil dál chrání PIN a limit pokusů z v3.45.
### Změněno
- Backend v3.49: `apiSeznamUzivatelu_` přidává ke každému profilu `testovaci: true/false` (`jeTestovaciProfil_`: ID začíná „rf-“). Odpověď dál nenese PINy ani nic dalšího.
- Index.html v3.60: `viditelneProfily_` skryje testovací dlaždice, pokud v `localStorage` není `kr_testovaci_profily=1` (`testovaciProfilyPovoleny_`, čtení v try/catch). Běžný návštěvník příznak nemá.
- RF (`frontend.robot`): nový keyword „Povolit testovací profily“ v „Otevřít radar“ (Suite Setup) před přihlášením nastaví příznak v `localStorage`. Nový test „Testovací profil je bez příznaku na přihlašovací obrazovce skrytý (vlastní kontext)“ ověří, že čistý kontext žádnou dlaždici `rf-…` nevidí. Test dlaždic má doplněnou chybovou hlášku o příznaku.
- API testy (SoapUI, Bruno, `api.robot`) se nemění, přihlašují se přímo POSTem.
### Testy
- Node 530 → 536 (+6), mutačně ověřené 4/4. RF 59 → 60 (dry run 60/60).
### Živé ověření 26. 10. 2026
- Backend: verze projektu 106, `?api=meta` → `"verze":"3.49"`, `?api=uzivatele` vrací u `rf-test` `"testovaci": true`.
- Frontend: po `git push` Cloudflare Pages servíruje komentář „Index.html v3.60“.
- Pohled běžného návštěvníka (claude-in-chrome, bez příznaku v localStorage): přihlašovací obrazovka nabízí jen Vojta, Monika, Míša, Jarda, dlaždice rf-test chybí.
- RF: smoke 11/11. Frontend sada bez zápisových testů: 44/45, oba nové či dotčené testy (nový test skrytí, test dlaždic) PASS, testy po novém testu běžely dál v kontextu ze Suite Setup.
- 1 pád v plném běhu, izolovaně 2× PASS, nesouvisí se změnou (kalendář v3.49/v3.60 neměnily): „Kalendář: hover na den s akcí zobrazí tooltip…“, `TimeoutError` při čekání na `#kalendar-tooltip.zobrazeno` (3 s). Screenshot z pádu: stránka odscrollovaná k kartám 5. a 6. 11., sticky hlavička a lišta chipů nahoře, kalendář „Říjen 2026“ viditelný a nepřekrytý, den 29 zvýrazněný, tooltip není vidět. Příčina nepotvrzena, odhad: hover během dojezdu scrollu po předchozím testu (klik na den). Viz BACKLOG.
### Poznámka
- Commit `9bad768`. Frontend se nasazuje `git push` (Cloudflare Pages), backend přes clasp (verze projektu 106). Backend i `Index.html` mají vlastní číslo verze (3.49 a 3.60).

## Backend v3.48 – akce bez rozpoznatelného data: nezapisovat, skrýt, hlásit – 26. 10. 2026
### Diagnóza (čteno přes claude-in-chrome, 26. 10. 2026)
- Bod 1, zdroj sériových čísel v listu AKCE: všech 19 řádků se sériovým číslem nebo textem s apostrofem leží v souvislém bloku řádků 36–59 z 1.–9. 8. 2026. Žádný z nich nemá vyplněný „První nález“, který `upsertEvents_` vždy zapisuje, a od srpna žádný další nevznikl. Nejpravděpodobněji šlo o jednorázovou ruční operaci. Současný kód tuto formu nevytváří a v3.43 ji už zvládá, kódová oprava proto není potřeba.
- Bod 2, nový problém: 5 řádků z běhů sledovaných měst má jako „Datum od“ text „neuvedeno“ (Olomouc: Youngfest Šumperk, KarmaFest; Zlín: Rajnochovická lesní železnice, Slavnost pod jabloní, Mineral-Expo) a všech 5 bylo na webu. Nikdy neproběhnou, nemají počasí ani digest a dedup je nepáruje.
### Změněno
- `upsertEvents_`: akce bez rozpoznatelného data začátku (`parseCzDate_` vrátí `null`) nezapíše. Počet vyřazených jde do poznámky v KONTROLY („Vyřazeno bez data: N.“).
- `readEventsApi_`: skryjí se jen řádky, ze kterých `parseCzDate_` datum nevyčte (např. „neuvedeno“, „říjen 2026“, prázdné). Sériová čísla od v3.43 projdou jako platné datum.
- `auditDat_` a `runSelfTest`: řádky bez rozpoznatelného data (neprázdné, ne proběhlé, ne zrušené) se hlásí jako problém samotestu.
- Prompt (`callAnthropic_`, `callAnthropicEmailTip_`): zákaz odevzdávat akci bez konkrétního data začátku.
### Testy
- 6 nových Node testů (524 → 530), mutačně ověřené (6 mutací).
### Živé ověření 26. 10. 2026 (`?api=events`, akce bez číslice v `datumOd`)
| Profil | Před (v3.47): akcí / bez data | Po (v3.48): akcí / bez data |
|---|---|---|
| Olomouc | 10 / 2 | 8 / 0 |
| Zlín | 12 / 3 | 9 / 0 |
- Smoke RF 11/11.
### Poznámka
- Samotest bude těch 5 řádků hlásit, dokud je někdo ručně nesmaže nebo jim nedoplní datum. Řádky v listu AKCE zůstávají, jen se nezobrazují.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.48"`), verze projektu 105, ověřeno `?api=meta` → `"verze":"3.48"`. Commit `c6be82a`.
- Verze patří jen backendu (`kulturni_radar.gs` 3.48), `Index.html` beze změny.

## Backend v3.47 – Sonnet 5.5 pro všechny běhy, spotřeba tokenů, týdenní report kvality – 26. 10. 2026
### Kontext a diagnóza
- Diagnostika nízkého počtu akcí (živá kontrola 26. 10. 2026, list KONTROLY): denní kontrola Brna na Haiku v září vrátila 25 z 30 běhů s 0 akcemi, v říjnu 10 z 26.
- Měsíční průměry denní kontroly Brna z KONTROLY:

| Období a model | Nalezeno ø | Nové ø | Nulových běhů |
|---|---|---|---|
| srpen, Sonnet 4.6 | 4,2 | 1,2 | 1/19 |
| srpen, Haiku | 5,0 | 0,3 | 1/12 |
| září, Haiku | 0,7 | 0,3 | 25/30 |
| říjen, Haiku | 2,2 | 1,0 | 10/26 |

- Sledovaná města na Sonnetu 4.6 (srpen–říjen): ~10 nalezených, 6–9 nových na běh.
### Poučení
- Srpnové vyhodnocení Haiku (31. 8. 2026) sledovalo jen „nalezeno celkem“. Průměr NOVÝCH akcí (0,3 vs. 1,2) ukazoval propad už tehdy. Týdenní report proto měří primárně nové akce.
### Změněno (4 body)
- Všechny běhy na `claude-sonnet-5-5`. Sonnet 4.6 je legacy a dražší, Haiku pro denní kontrolu (v3.27) je ukončen. Ceny z ceníku Anthropic (USD za milion tokenů, vstup/výstup): Sonnet 4.6 $3/$15 (legacy), Sonnet 5.5 $2/$10. `vyberModelProKontrolu_` zůstává jako jediné místo rozhodnutí.
- Spotřeba tokenů z každého běhu do nových sloupců M–O listu KONTROLY (`zapocitatSpotrebu_`, `odebratSpotrebu_`, hlavičku doplní `zajistitHlavickuSpotreby_`): tokeny vstup, výstup, počet webových vyhledávání. Pokrývá i formátovací dovolání a stálá místa.
- Týdenní report kvality hledání v nedělním samotestu (`hodnotitKvalituHledani_`, `sestavReportKvality_`): posledních 7 kalendářních dní proti předchozím 7, zvlášť pro „denní kontrola“ a „sledované město“, počet běhů, ø nových, nulové běhy, odhad ceny. Bez dalšího volání API.
- Poplach v samotestu: 3+ nulové běhy denní kontroly za týden nebo průměr nových akcí pod 0,5.
- Odhad ceny je bez poplatků za webové vyhledávání (ty se účtují zvlášť).
### Testy
- 10 nových Node testů, celkem 514 → 524, mutačně ověřené (9 mutací). 4 staré testy přepsány, protože zakládaly zrušené rozhodnutí Haiku pro denní kontrolu.
- Netestované: zapojení reportu do `runSelfTest`, ověří se první nedělí.
### Živé ověření 26. 10. 2026 (spuštěno z menu „Spustit kontrolu teď“ přes claude-in-chrome, 22:38)
| | Denní kontrola na Haiku (dnes 8:12) | Mimořádná kontrola na Sonnetu 5.5 (22:38) |
|---|---|---|
| Nalezeno / nové | 0 / 0 | 9 / 8 |
| Model | Haiku | claude-sonnet-5-5 |
| Tokeny vstup / výstup | nezaznamenáno | 40466 / 4321 |
| Webová vyhledávání | nezaznamenáno | 3 |
- `?api=events&profil=Brno`: 6 → 14 akcí. Odhad ceny ~$0,12 za běh bez poplatků za vyhledávání.
### Nasazení
- Verze projektu 104 (číslo za @ v `clasp deployments` je číslo verze projektu, ne implementace), ověřeno `?api=meta` → `"verze":"3.47"`, smoke RF 11/11. Commit `387449e`.
- Verze patří jen backendu (`kulturni_radar.gs` 3.47), `Index.html` beze změny.

## Backend v3.46 – stálá místa: párování podle klíče názvu, skrytí duplicit – 26. 10. 2026
### Kontext
- Příčina ověřená v listu MÍSTA: AI při měsíční aktualizaci (`updateMista`) vymýšlí pokaždé jiné ID a mírně jiný název („Punkevní jeskyně a propast Macocha“ vs. „… & propast Macocha“, „VIDA! science centrum“ vs. „VIDA! Science Centrum Brno“). `upsertMista_` párovala přes přesné ID nebo přesný název+obec, takže vznikl nový řádek a starý zůstal.
### Změněno
- Nová čistá `klicMista_(nazev, obec)`: slova názvu (bez diakritiky, interpunkce, číslic) bez spojky „a“ a bez slov obce, seřazená, + normalizovaná obec. Když by po odebrání slov obce nic nezbylo, použije se celý název.
- `upsertMista_` páruje přes `klicMista_` (dřív přes přesný název+obec). Zápis se mění jen v párování: příští měsíční aktualizace přepíše existující řádek místo přidání nového.
- Nová čistá `deduplikovatMista_`: z řádků listu MÍSTA nechá pro každý klíč jeden, s nejnovější „Poslední aktualizací“ (sloupec N), při shodě pozdější řádek.
- `readMista_` nejdřív vyfiltruje aktivní řádky profilu a pak skryje duplicity.
- Nic se nemaže. Staré duplicitní řádky v listu MÍSTA zůstávají, jen se nezobrazují. Dva staré řádky (Macocha s „a“, „VIDA! science centrum“) jdou případně ručně smazat.
### Ověřené riziko
- Oblíbená místa (🏛) se vážou na AKCE, ne na list MÍSTA, takže skrytí řádku nemůže zrušit uživatelovo označení (ověřeno čtením kódu: apiToggleMisto_ ukládá do listu OZNAČENÍ typ oblibene_misto pod klíčem klicSouradnic_(misto, obec) z akce; výstup readMista_ žádnou informaci o oblíbenosti nenese).
### Kompromis
- Tolerantní klíč by sloučil i dvě různá místa v téže obci, která se liší jen pořadím slov, spojkou „a“ nebo slovem z názvu obce.
- U stálých míst jednoho profilu je to nepravděpodobné. Dopad by byl jen na zobrazení (skrytý řádek) a na párování při aktualizaci, žádná data se nemažou.
### Testy
- 8 nových Node testů (506 → 514, sekce „v3.46“ v `tests/unit.test.js`), mutačně ověřené.
### Živé ověření 26. 10. 2026 (`?api=places&profil=Brno`)
| | Před (v3.45) | Po (v3.46) |
|---|---|---|
| Počet míst | 20 | 18 |
| VIDA | 2× („VIDA! science centrum“, „VIDA! Science Centrum Brno“) | 1× „VIDA! Science Centrum Brno“ |
| Macocha | 2× (s „a“ a s „&“) | 1× s „&“ |
- Smoke RF 11/11.
### Poznámka
- Verze patří jen backendu (`kulturni_radar.gs` 3.46), `Index.html` beze změny.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.46"`, verze projektu 103), ověřeno `?api=meta` → `"verze":"3.46"`. Commit `f6e784e`.

## CI: RF dry run při každém pushi – 26. 10. 2026
### Přidáno
- `.github/workflows/node-tests.yml`: samostatný job `rf-dryrun` vedle `node-testy`. Kroky: `actions/setup-python` (Python 3.12, pip cache podle `tests/robot/requirements.txt`), `actions/setup-node` (Node 22), `pip install -r tests/robot/requirements.txt`, `rfbrowser init --skip-browsers`, `robot --dryrun --output NONE --report NONE --log NONE tests/robot/`.
- Co dry run ověří: syntaxi všech 59 testů, existenci klíčových slov a platnost názvů argumentů, a to bez sítě a bez přístupu k Apps Scriptu, takže nezávisí na stavu produkce.
- Proč `--skip-browsers`: Browser knihovna potřebuje při načtení své Node závislosti (listener), ale prohlížeče se v dry runu nespouštějí, takže se nestahují (rychlejší a levnější běh).
### Mutační ověření
- Provedeno dvakrát nezávisle se shodným výsledkem: na Windows (Claude Code, mutace níže) a na Linuxu (Claude v chatu, jiné mutace stejných tří typů: překlep `Clsoe Page`, `msg=` u jiného volání `Wait For Elements State`, proměnná `${NEEXISTUJE}`).
- Překlep v názvu keywordu (`Wait For Elementz State`): dry run ho chytí („No keyword with name … found“), 49/50, exit 1.
- Nepodporovaný argument `msg=` u `Wait For Elements State`: chytí („got unexpected named argument 'msg'“), 49/50, exit 1.
- Neexistující proměnná (`${FRAME_NEEXISTUJE}`): NEchytí, 59/59, exit 0. Dry run proměnné nevyhodnocuje. Omezení je zapsané i v komentáři v `node-tests.yml`.
### Výsledek v CI
- Commit `f3a2e9b`: `rf-dryrun` zelený, 59/59, běh 21 s (první běh se studenou pip cache; zrychlení s teplou cache zatím neověřeno). `node-testy` zelený, 7 s.
### Poznámka
- Jen CI, žádná změna kódu appky ani testů, bez bumpu verze (backend i frontend beze změny).

## Backend v3.45 – limit pokusů na PIN – 26. 10. 2026
### Kontext
- Nález z přípravy quality checku (7.–8. 10. 2026): nejkratší PIN má 4 znaky a nic neomezovalo počet pokusů, PIN šlo hádat.
### Pravidlo
- 5 chybných PINů v řadě → zámek 15 min. Každých dalších 5 chyb bez úspěchu zdvojnásobí zámek (15 → 30 → 60 min …, strop 24 h). Úspěch počítadlo vynuluje.
- Během zámku se PIN vůbec neověřuje, ani správný, jinak by odpověď prozradila trefu. Odpověď nese `zamceno:true` a hlášku s počtem minut.
- Neexistující profil vrací „profil nenalezen“ a nezapisuje žádný stav, ať nejde plnit úložiště vymyšlenými ID.
### Rozhodnutí a kompromisy
- Stav je v Script Properties (`pin_pokusy_<id>`), ne v CacheService: cache má strop 6 h a Google ji může kdykoli vyhodit, což by zámek tiše zrušilo.
- Fail-open: když úložiště selže nebo je JSON rozbitý, přihlášení pokračuje bez limitu. Výpadek Googlu nesmí rodinu zamknout.
- Vědomě vynechaný `LockService`: souběžné pokusy mohou čtení a zápis počítadla přeskočit a nějaký pokus se nezapočítá. U rodinné appky je to přijatelné, hádání PINu to prakticky neusnadní.
- Nouzové odemčení: nové menu Sheetu „Odemknout všechny profily (limit PINu)“ (`odemknoutVsechnyProfily`) smaže jen klíče `pin_pokusy_*`.
### Testy
- 10 nových Node testů (496 → 506, sekce „v3.45“ v `tests/unit.test.js`), mutačně ověřené. Pokrývají i dřív netestovanou větev „chybí profil nebo PIN“ a „profil nenalezen“ (BACKLOG, položka k `apiPrihlaseniUzivatele_`).
- `tests/harness.js`: `getScriptProperties` dostal `deleteProperty`, `getKeys`, volbu `propertiesThrows` (simulace výpadku) a ukládá hodnoty jako řetězce jako skutečný Apps Script.
### Živé ověření 26. 10. 2026 (záměrný zápis do produkce, jen profil `rf-test`)
| Pokus | PIN | ok | zamceno | error |
|---|---|---|---|---|
| 1–4 | špatný | false | – | nesprávný PIN |
| 5 | špatný | false | true | nesprávný PIN – příliš mnoho pokusů, zkus to znovu za 15 min. |
| 6 | správný | false | true | Příliš mnoho pokusů, zkus to znovu za 15 min. |
- Pokus 6 potvrdil, že se PIN během zámku neověřuje.
- Po odemčení z menu Sheetu login `rf-test` se správným PINem vrátil `ok:true`, smoke RF 11/11, test „Špatný PIN zobrazí chybu a nepřihlásí (vlastní stránka)“ PASS.
### Poznatky z živého ověření
- Zamčený `rf-test` vyřadí celou frontend sadu: Suite Setup (keyword „Otevřít radar“) se přihlašuje `rf-test`. Běh 26. 10. 2026 za zámku skončil 3/11 (všech 8 frontendových smoke testů padlo).
- Nouzové odemčení: první pokus o odemčení se neprojevil a není jisté, zda menu tehdy skutečně proběhlo. Po spuštění menu přes claude-in-chrome (Google ohlásil „Skript byl dokončen“ bez výzvy k autorizaci) login prošel. Pravděpodobné vysvětlení je známé chování Apps Scriptu: první spuštění nové funkce z menu spotřebuje jen autorizaci a funkce neproběhne. Tady to nebylo přímo potvrzeno.
### Poznámka
- Verze patří jen backendu (`kulturni_radar.gs` 3.45), `Index.html` beze změny.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.45"`, verze projektu 102), ověřeno `?api=meta` → `"verze":"3.45"`. Commit `0b32326`.

## Backend v3.44 – počasí a souřadnice: N/A mimo dosah, HTTP kódy, záložní geokódování – 26. 10. 2026
### Kontext
- Diagnostika ze živé kontroly 26. 10. 2026 (listy KONTROLY a SOUŘADNICE) odhalila dvě příčiny.
- Počasí CHYBA: vzniká jen v nedělních a čtvrtečních bězích sledovaných měst, kdy část volání Open-Meteo selže (důvod neznámý, `fetchJson_` zahazoval HTTP kód). Záložní met.no vidí jen ~9 dní, takže pro akce za 10+ dní nemá data, a to se chybně hodnotilo jako CHYBA.
- Souřadnice chybí, protože klíč je přesný text místa (např. „Fléda, Štefánikova 266/24, Brno“) a Nominatim ho nenajde. Neúspěšná lokalita se navíc už nikdy nezkusila znovu (geokódovalo se jen pro akce z právě proběhlého běhu).
### Změněno (5 bodů)
- N/A místo CHYBA: `vyhodnotPocasiUdalosti_` dostala parametr `metNoOdpovedel`. Když met.no odpoví, ale pro datum akce nemá data, je to dosah předpovědi, stav je NA.
- HTTP kódy v logu KONTROLY: nová `fetchJsonSKodem_` (vrací `{data, kod}`, kod = HTTP kód, „síť“ nebo „neplatný JSON“), `fetchJson_` je tenký obal. Nové `ziskatOpenMeteoPredpovedSKodem_` a `shrnoutKodySelhani_` (například „HTTP 429 ×3, síť ×1“). `logKontrolaPocasi_` zapisuje kódy selhání Open-Meteo i met.no.
- Záložní zjednodušený dotaz pro Nominatim: `sestavZjednodusenyDotazGeokodovani_` (první část místa před čárkou, pomlčkou nebo závorkou + obec). Výsledek se ukládá pod PŮVODNÍ klíč, ať ho `readEventsApi_` najde.
- Počasí podle souřadnic obce: když místo akce nemá souřadnice, použijí se souřadnice obce (max 10 nově geokódovaných obcí za běh, `POCASI_LIMIT_NOVYCH_OBCI`). Pin na mapě z toho nevzniká. Cache předpovědí je teď klíčovaná souřadnicemi, ne klíčem místa.
- Denní dohledání chybějících souřadnic: `vyberLokalityBezSouradnic_` (čistá) a `doplnitChybejiciSouradnice_` volaná z `dailyCheck`, max 10 lokalit na běh (`SOURADNICE_DENNI_LIMIT`), nejbližší termíny první, chyba nesmí shodit denní kontrolu.
### Testy
- 13 nových Node testů (483 → 496, sekce „v3.44“ v `tests/unit.test.js`), mutačně ověřené.
- Netestované je jen samotné zapojení `doplnitChybejiciSouradnice_` do `dailyCheck`.
### Kompromis
- Neúspěšné lokality se teď zkouší znovu každý den: nejhůř 10 lokalit × 2 dotazy × 1,1 s pauza ≈ 22 s navíc v denní kontrole. Cena za to, že lokalita, které se jednou nepodaří, už neskončí bez pinu a počasí navždy.
### Poznámka
- Verze patří jen backendu (`kulturni_radar.gs` 3.44), `Index.html` beze změny.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.44"`, verze projektu 101), ověřeno `?api=meta` → `"verze":"3.44"`, RF `--include smoke` 11/11. Commit `8e85860`.
- Čeká na živé ověření po nejbližším běhu sledovaných měst (čtvrtek 10:00) a denní kontrole.

## Backend v3.43 – parseCzDate_ rozpozná sériové číslo data – 26. 10. 2026
### Kontext
- Živá kontrola 26. 10. 2026 ukázala, že API vrací dávno proběhlé akce (Brno 2, Praha 4, Znojmo 5 z 6). Příčina: `parseCzDate_` neuměla sériové číslo data ze Sheets (dny od 30. 12. 1899, buňka bez datumového formátu), uměla ho jen `cellText_`. Web proto ukazoval hezké datum, ale všechno, co záviselo na `parseCzDate_`, takovou buňku nevidělo jako datum.
### Změněno
- Nová čistá funkce `serioveCisloNaDatum_(v)`: převede číslo v rozsahu 30000–80000 na `Date` o půlnoci místního času, jinak vrací `null`. Převod byl vytažen z `cellText_`, která ho teď volá a sdílí s `parseCzDate_`.
- `parseCzDate_` nejdřív zkusí sériové číslo, pak teprve textový zápis `d. M. rrrr`.
### Dopad opravy
- Filtr proběhlých akcí v API (`readEventsApi_`): proběhlé akce se sériovým datem se zase nevrací (pokryto testem).
- `markPastEvents`: akce se sériovým „Datum do“ v minulosti dostanou stav „proběhlo“ (pokryto testem).
- Aktualizace počasí: buňky se sériovým datem se už berou jako datum (ověřeno čtením kódu: aktualizujPocasi_ a readEventsInRange_ přeskočí řádek, když parseCzDate_ vrátí null; bez vlastního testu).
- Digesty: akce se sériovým datem se zase započítají podle termínu (ověřeno čtením kódu: aktualizujPocasi_ a readEventsInRange_ přeskočí řádek, když parseCzDate_ vrátí null; bez vlastního testu).
- Deduplikace: `dateKey_` dá pro sériové číslo ISO klíč (dřív třeba „46242“), takže klíč sedí s textovým zápisem téhož data (pokryto testem).
### Poznámka
- 6 nových Node testů (477 → 483): převod `serioveCisloNaDatum_`, `parseCzDate_`, shoda s `cellText_` (regresní pojistka), `dateKey_`, `readEventsApi_`, `markPastEvents`.
- Verze patří jen backendu (`kulturni_radar.gs` 3.43), `Index.html` beze změny.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.43"`, verze projektu 100), ověřeno `?api=meta` → `"verze":"3.43"`. Commit `f99aed6`.
- Živě ověřeno po nasazení 26. 10. 2026 (claude-in-chrome, ?api=events): Brno 8 → 6 akcí, Praha 21 → 17, Znojmo 6 → 1, ve všech 6 kontrolovaných městech 0 proběhlých akcí v odpovědi.
- Příčina, proč se v některých buňkách sloupců B/C listu AKCE vůbec objevuje číslo místo data, zůstává neprošetřená (viz BACKLOG.md). Oprava řeší důsledek, ne zdroj.

## Docs: ukázky testů - odkazy na kód – 8. 10. 2026
### Změněno
- `Docs/Quality Check/UKAZKY-TESTU.md`: u všech tří rozebraných testů přidány trvalé odkazy na kód testu na GitHubu (odkazy na konkrétní commit `2ac6d1e`, řádky se proto neposunou), u prvního testu i odkaz na změnu před/po (commit `8ca3c96`). Doplněna věta o tom, že odkazy míří na stav repa z 8. 10. 2026.
### Poznámka
- Jen dokumentace, žádná změna kódu ani testů, bez bumpu verze (backend i frontend beze změny).

## Docs: testovací analýza a ukázky testů pro quality check – 8. 10. 2026
### Přidáno
- `Docs/TESTOVACI-ANALYZA.md`: testovací analýza na příkladu přihlášení profilem s PINem.
- `Docs/Quality Check/UKAZKY-TESTU.md`: rozbor tří testů (jak navrhuji testy).
- `Docs/Quality Check/README.md`: odkazy na oba nové dokumenty.
### Změněno
- `Docs/BACKLOG.md`: položka „Unit testy `apiPrihlaseniUzivatele_`“ upřesněna – větev „chybí profil nebo PIN“ nemá test, neexistující profil se testuje jen přes `ok:false` bez ověření textu chyby (slabá aserce).
### Poznámka
- Jen dokumentace, žádná změna kódu ani testů, bez bumpu verze (backend i frontend beze změny).

## Docs: TESTY.md - tajné hodnoty a zabezpečení veřejného repa – 8. 10. 2026
### Přidáno
- `Docs/TESTY.md`: v sekci 4.4 odstavec o tajných hodnotách (PIN testovacího profilu, tokeny, ntfy téma): v repu nejsou, lokálně jsou v proměnných prostředí, v CI v GitHub Secrets. Repo je od 8. 10. 2026 veřejné; před zveřejněním zapnuto GitHub Secret scanning (celá historie bez nálezu) a push protection.
- Do sekce 10 přidán krok „Zapnout Dependabot alerts“ (navazující bod přečíslován) a řádek v historii dokumentu.
### Změněno
- Drobná stylistická oprava věty o poměru přínos/cena v sekci 4.4.
### Poznámka
- Jen dokumentace, žádná změna kódu ani testů, bez bumpu verze (backend i frontend beze změny).

## Docs: BACKLOG - nálezy z přípravy quality checku — 8. 10. 2026
### Přidáno
- `Docs/BACKLOG.md`: 5 nových položek z přípravy 7.–8. 10. 2026: duplicita „Punkevní jeskyně a propast Macocha“ vs. „… & propast Macocha“ ve stálých místech, `robot --dryrun` v `node-tests.yml`, jeden automatický retry při HTTP 404 z `script.googleusercontent.com/macros/echo`, chybějící limit pokusů na PIN, unit testy větví `apiPrihlaseniUzivatele_`.
### Poznámka
- Jen dokumentace, žádná změna kódu ani testů, bez bumpu verze (backend i frontend beze změny).

## Docs: TESTY.md - sekce Platforma a dvě prostředí — 8. 10. 2026
### Přidáno
- `Docs/TESTY.md`: nová sekce 1.1 Platforma a dvě prostředí (Apps Script vs. statický web na Cloudflare Pages, sandbox ve dvou iframech, proměnná `${FRAME}`, dopady platformy na testy).
- Upraven řádek v historii dokumentu (7. 10. 2026).
### Poznámka
- Jen dokumentace, žádná změna kódu ani testů, bez bumpu verze (backend i frontend beze změny).

## RF testy: chip typu místa - Skip If, čekání na načtení, přísnější aserce — 8. 10. 2026
### Změněno
- `tests/robot/frontend.robot`, test „Chip typu stálého místa zúží seznam“: datová precondition (profil má 2+ typů míst) je nově `Skip If` místo `Log … level=WARN` + PASS, takže nesplněná precondition se ve výsledcích ukáže jako SKIP, ne jako zelený test.
- Aserce `filtrovanych <= vsech` zpřísněna na `<`: původní by prošla i s nefunkčním filtrem, který nic nezúží.
- Aktualizována dokumentace testu.
### Opraveno
- Přidáno `Wait For Elements State` na první kartu místa před počítáním chipů: test dřív závodil s asynchronním načítáním sekce míst. `Skip If` závod odhalil, `WARN` by ho schoval.
### Poznámka
- Jen testy, bez bumpu verze (backend i frontend beze změny). Lokálně ověřeno: dry run i ostrý běh, 1 test, 1 passed.

## Docs: TESTY.md - sekce Volba nástrojů — 7. 10. 2026
### Přidáno
- `Docs/TESTY.md`: nová sekce 4.9 Volba nástrojů (proč RF s Browser Library, srovnání se SeleniumLibrary a čistým Playwrightem, `node:test` pro jednotkové testy).
- Nový řádek v historii dokumentu (7. 10. 2026).
### Změněno
- `Docs/TESTY.md`, sekce 4.6: upřesněno, že `Log … level=WARN` a projití používá 10 testů ve `frontend.robot` (dřív popsány dva s odkazy na čísla řádků).
### Poznámka
- Jen dokumentace, žádná změna kódu ani testů, bez bumpu verze (backend i frontend beze změny).

## Docs: matice pokrytí POKRYTI.md — 6. 10. 2026
### Přidáno
- Nový dokument `Docs/POKRYTI.md` (matice pokrytí): pokrytí testy podle rizik R1–R8 (z `Docs/TESTY.md`) a podle 18 funkčních oblastí, s vrstvami testů (Node unit, RF API, RF frontend, worker).
- Seznam nalezených mezer, mj. netestovaná verze frontendu (`Index.html`) nasazeného na Cloudflare Pages – API test hlídá jen verzi backendu (riziko R2).
### Změněno
- `Docs/Quality Check/README.md`: zmínka o `POKRYTI.md` změněna z „(připravuje se)“ na funkční odkaz.
### Poznámka
- Jen dokumentace, žádná změna kódu ani testů, bez bumpu verze (backend i frontend beze změny).

## Docs: TESTY.md přepracován na testovací plán a strategii, nová složka Quality Check — 30. 9. 2026
### Změněno
- `Docs/TESTY.md` přepracován na testovací plán a strategii podle ISO/IEC/IEEE 29119-3 (zpětná rekonstrukce ze stavu repa).
### Přidáno
- Nová složka `Docs/Quality Check/` (s `README.md`) pro podklady k internímu quality checku role TAE II (říjen 2026).
### Poznámka
- Jen dokumentace, žádná změna kódu ani testů, bez bumpu verze (backend i frontend beze změny).

## Index.html v3.59 — dropdown + prázdný stav rozlišují „nikdy neprohledáno" od „prohledáno, nic nenalezeno" — 9. 9. 2026
### Kontext
- Navazuje na BACKLOG.md, sekce „Zpětná vazba syna — 5. 8. 2026": appka pro některá sledovaná města ukazovala 0 akcí, aniž by šlo poznat, jestli je to proto, že appka to město ještě nikdy neprohledala (žádná automatická kontrola nikdy neproběhla), nebo proto, že ho opakovaně kontrolovala a fakt tam nic není. Data pro rozlišení už existovala v API (`readMetaApi_` posílá `posledniKontrola` per profil, prázdný řetězec = nikdy nekontrolováno), jen se ve frontendu nikde nepoužívala.
### Přidáno
- **`sestavOznaceniProfiluDropdown_(profil, kraj, posledniKontrola)`** — text volby v `#profil-select`, přidává krátký marker „ (nikdy neprohledáno)" u měst s prázdným `posledniKontrola`.
- **`sestavHlaskuPrazdnehoStavu_(posledniKontrola)`** — hláška prázdného stavu v `renderAkce()` (`filtrovane.length === 0`), nahradila jednu univerzální hlášku dvěma: „Tohle město appka ještě nikdy neprohledala." (nikdy nekontrolováno) vs. „Žádné akce pro vybraný filtr (naposledy zkontrolováno: D. M. RRRR H:mm)." (kontrolováno, beze změny formátu data ze serveru).
- Obě jako pojmenované čisté funkce (ne inline v DOM kódu) — stejný vzor jako `sestavPopupDataMapy_`/`sestavTextSdileni_`, testovatelné bez DOM.
- Nová modulová proměnná `posledniKontrolaProfilu_` (mapa `profil → posledniKontrola`) — plní se při stavbě `#profil-select`, čte ji `renderAkce()`. Záměrně jen tahle mapa, ne celé `meta.profily`, ať se globální stav zbytečně nerozšiřuje.
### Poznámka k architektuře
- 5 nových Node testů (472 → 477): marker přidán u nikdy nekontrolovaného města / nepřidán u kontrolovaného / chybějící kraj se vynechá beze změny chování; obě varianty hlášky prázdného stavu.
- Čistě frontendová změna — `readMetaApi_` v `.gs` posílal `posledniKontrola` per profil už dřív, žádný zásah do Apps Scriptu ani bump `VERZE` (backend zůstává 3.42).
- RF testy pracující s `#profil-select`/`#status` (`Přepínač profilů je naplněn z meta API`, `Opakované přepnutí profilu v dropdownu…`, `Chip Oblíbené/Neověřeno filtruje…`) ověřeny beze změny — čtou jen `value`/počet elementů, ne text, takže marker/nová hláška je neovlivnily. Nový RF test se záměrně nepsal — jestli existuje „nikdy nekontrolované" město, závisí na živých produkčních datech (SLEDOVANÁ MĚSTA), ne na deterministické fixtuře.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Frontend v3.59 - rozliseni nikdy neprohledano/prohledano"`).

## Backend v3.42 — upsertEvents_: fuzzy shoda už nezahazuje tiše odlišná data — 9. 9. 2026
### Kontext
- Navazuje na v3.41 (audit log fuzzy sloučení) — vedlejší zjištění z testu „fuzzy shoda BEZE změny obsahu nezapisuje log" odhalilo DRUHÝ, samostatný mechanismus zapsaný do BACKLOG.md jako nová „K PROŠETŘENÍ": když `upsertEvents_` najde fuzzy shodu, ale nová akce má stejné `datum_do` i `stav` jako existující řádek, `changed` vyjde `false` — a v tom případě se nepřevezme vůbec nic z nových dat (ani `misto`, `cena`, `kategorie`, `popis`), jen se bumpne „Poslední kontrola". Skutečně jiná konkrétní akce se tak potichu ZAHODÍ, ne smíchá s cizími daty jako u v3.41 — jde o ztrátu informace, ne o její záměnu.
- Diagnostika (9. 9. 2026) ukázala, že tenhle případ je pravděpodobně ČASTĚJŠÍ, ne vzácnější, než přepis opravený v3.41: jednodenní akce mají `datum_od == datum_do`, takže dvě jednodenní akce se stejným datem mají shodné `datum_do` STRUKTURÁLNĚ (ne náhodou); `stav = "potvrzeno"` je naprostá většina aktivních akcí. ID navíc generuje AI nanovo každý běh (`RRRR-MM-DD-slug-názvu`, žádná kontinuita s předchozím dnem, appka existující ID do promptu nedává) — i genuinně TATÁŽ akce může snadno spadnout do fuzzy větve místo přesné shody ID, jakmile AI mírně přeformuluje název.
### Rozhodnutí
- Zváženy 3 varianty (rozšířit `changed` všude; u fuzzy nikdy nepovolit `changed=false`; rozšířit `changed` jen pro fuzzy větev). Zvolena třetí — nejpřesnější zásah, žádná regrese na exaktní cestě.
### Změněno
- `upsertEvents_` — `changed` se teď počítá jinak podle toho, jak se řádek našel. Pro PŘESNOU shodu ID/klíče beze změny (`datum_od`/`datum_do`/`stav`) — vědomý záměr z v2.8 (ignorovat kosmetickou přeformulaci AI u jistě téže akce) zůstává nedotčen. Pro FUZZY shodu (`viaFuzzy`) se `changed` počítá přes už existující `zjistiZmenenaPole_`/`POLE_PRO_FUZZY_LOG_` z v3.41 (i `misto`/`kategorie`/`cena`/`popis`, ne jen `datum_do`/`stav`) — cokoli obsahového se liší, bere se jako změna, data se převezmou a zaloguje se do sloupce Z (v3.41 log teď pokrývá i tenhle dřív neviditelný případ).
- Výsledek `zjistiZmenenaPole_` se počítá jednou a znovu použije i pro zápis do logu (žádné duplicitní volání).
### Poznámka k architektuře
- 3 nové Node testy (470 → 472): exaktní shoda ID s kosmetickou přeformulací popisu/ceny (žádná změna data/stavu) → `changed=false` jako dosud — chrání záměr z v2.8 před regresí; fuzzy shoda se stejným `datum_do`/`stav`, ale jiným místem/kategorií/cenou/popisem → `changed=true`, data převzata a zalogována; fuzzy shoda s úplně stejným obsahem (jen jiné ID a mírně jiný název) → `changed=false`, žádný log — potvrzuje, že `zjistiZmenenaPole_` správně vrací prázdno, když se opravdu nic neliší.
- **Vědomý zbytkový kompromis** (zapsáno i do BACKLOG.md): tahle oprava nesnižuje, jak často `isSameName_` falešně shodí dvě různé akce (kategorie D) — to řeší jen budoucí změna samotné shody/modelu zápisu. Mění jen důsledek: falešná shoda, která dřív (má-li náhodou stejné `datum_do`+`stav`) skončila neškodně (tiché zahození, řádek netknutý), teď skončí jako přepsání — zalogované a opravitelné přes Historii verzí, ale pořád přepsání. Cena za odstranění tiché ztráty dat u genuinně stejných akcí.
- BACKLOG.md „K PROŠETŘENÍ" (tiché zahození) označeno VYŘEŠENO 9. 9. 2026, s odkazem na tuhle opravu.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Backend v3.42 - fuzzy shoda uz nezahazuje odlisna data"`). Bez frontendového zásahu.

## Backend v3.41 — upsertEvents_: audit log fuzzy sloučení do sloupce Z (beze změny chování) — 9. 9. 2026
### Kontext
- Navazuje na BACKLOG.md „K PROŠETŘENÍ" (zapsáno 31. 8. 2026 u v3.37): `upsertEvents_` (zápisová cesta) sdílí `isSameName_`/`nazevTokens_`/`ruznyDenSerie_` s `najdiDuplicity_`, ale narozdíl od `najdiDuplicity_` (přes `navrhniDuplicity_`, v3.37 — návrh k ručnímu schválení) sám automaticky přepisuje řádek existující akce při fuzzy shodě, bez lidské kontroly a bez jakékoli stopy.
- Diagnostika (9. 9. 2026) potvrdila: `upsertEvents_` volá IDENTICKÉ sdílené funkce jako `najdiDuplicity_`, žádná rozjetá kopie logiky. Jediný rozdíl je párování podle PŘESNÉHO data (ne ±2 dny tolerance jako u úklidu) — vědomé rozhodnutí z v3.34. Podmnožinová větev `isSameName_` (kategorie D — série vs. konkrétní instance) zůstává neopravená a plně přítomná v zápisové cestě, protože v3.37 řešilo problém procesně (návrh+schválení) jen na straně `najdiDuplicity_`, ne v samotné `isSameName_`. Když `changed===true` (posun termínu/stavu), `upsertEvents_` přepíše CELÝ obsah řádku (název, místo, cena, popis, kategorie…), ne jen datum_do/stav — beze stopy v KONTROLY (ta loguje jen agregáty) ani jinde.
### Rozhodnutí
- Zváženy 3 varianty (jen log beze změny chování; přechod na model „návrh → ruční schválení" i pro zápis; kombinace obou). Zvolena nejmenší varianta — audit log, žádná změna chování. Důvod: dnes nejde ani odhadnout, jak často se fuzzy větev v zápisové cestě vůbec spouští (KONTROLY loguje jen agregát „Změněné", nerozlišuje mechanismus shody) — log dá tuhle odpověď z reálného provozu, než se bude řešit případná změna chování.
### Změněno
- **`COL_Z = 26`** — nový sloupec v AKCE, mimo `AKCE_COLS`/`AKCE_WRITE_AV` (zapisuje se adresovaně, stejně jako `COL_Y`). `readEventsApi_`/`apiEvents` čte přesně `AKCE_COLS` (25) sloupců, takže se log do veřejného JSONu appky nedostane.
- `upsertEvents_` — nový `viaFuzzy` flag (`true` jen když se řádek našel fuzzy větví, ne přes přesné ID/klíč). Log se zapíše jen když `viaFuzzy && changed` — tedy přesně tam, kde reálně dochází k tichému přepsání obsahu.
- **`zjistiZmenenaPole_`** — porovná starý řádek s novým obsahem přes 16 obsahových polí (bez názvu — ten je v logu zvlášť jako starý→nový, a bez bookkeeping polí jako ID/Novinka/Poslední kontrola), vrátí seznam názvů těch, co se skutečně liší.
- **`zapsatFuzzyMergeLog_`** — append (ne overwrite) do sloupce Z: `[fuzzy merge D. M. RRRR H:mm] "starý název" → "nový název"; přepsáno: pole1, pole2, …`. Hlavička sloupce Z se zajistí při prvním zápisu (`zajistitHlavickuLogSlouceni_`, stejný vzor jako „Vykonavatel" v KONTROLY, viz `logKontrola_`).
### Poznámka k architektuře
- 4 nové Node testy (466 → 470): (1) dokumentuje současné chování — fuzzy shoda přepíše CELÝ řádek, ne jen datum_do/stav (reprodukce kategorie D: existující „deštníková" položka série vs. nová konkrétní akce, jejíž název ji obsahuje jako podřetězec — přesně vzorec z v3.37); (2) log se zapíše se správným formátem (starý+nový název, seznam přepsaných polí); (3) regrese — přesná shoda ID nezapisuje log, i když se obsah legitimně změní; (4) fuzzy shoda BEZE změny obsahu (`changed===false`) nezapisuje log.
- **Vedlejší zjištění při psaní testu (4)**: jiný, dosud nezalogovaný mechanismus — když `changed===false` (fuzzy kandidát má stejné datum_do i stav jako existující řádek), `upsertEvents_` nepřevezme vůbec nic z nových dat, i kdyby se misto/cena/popis/kategorie lišily. Tiché ZAHOZENÍ dat jiné konkrétní akce, ne záměna dat jako u dnešní opravy — jiný problém (ztráta informace, ne její záměna). Zapsáno do BACKLOG.md jako samostatná otevřená položka „K PROŠETŘENÍ" (9. 9. 2026), mimo rozsah v3.41.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Backend v3.41 - audit log fuzzy slouceni (sloupec Z)"`). Bez frontendového zásahu.

## Backend v3.40 — auditDat_: nehlásit znovu duplicitní páry už ručně posouzené v NÁVRH DUPLICIT — 8. 9. 2026
### Incident (produkce, 1.–7. 9. 2026)
- Tři páry ručně posouzené 31. 8. 2026 (backend v3.37, kategorie D — sdílejí jen obecné brandingové slovo, legitimně jiné akce) a označené `Stav = "Zamítnuto"` v listu `NÁVRH DUPLICIT` (Festival planet Brno 2026 — srpen/srpnový turnus, dvakrát, a Kulturní léto na Poděbradech — konkrétní koncert vs. celá série) se den co den znovu objevovaly jako „duplicity v AKCÍCH" v denním e-mailu „Samotest: 1 problém".
### Diagnóza
- `auditDat_` volala `najdiDuplicity_(data)` a všechny výsledky reportovala jako problém přímo, BEZ křížové kontroly proti už existujícím zaznamenaným párům v `NÁVRH DUPLICIT` (bez ohledu na jejich `Stav`) — na rozdíl od `navrhniDuplicity_`, která tuhle kontrolu už měla (append-only chování zavedené v v3.37).
### Změněno
- **`nactiPosouzenePary_(ss)`** — nová sdílená funkce, extrahovaná z `navrhniDuplicity_`: množina párů `ID(ponechat)|ID(smazat)` z `NÁVRH DUPLICIT`, bez ohledu na `Stav`. Čte přes `getSheetByName` (ne `ensureNavrhDuplicitSheet_`) — čtení nesmí mít vedlejší účinek založení listu.
- `navrhniDuplicity_` — inline výpočet nahrazen voláním `nactiPosouzenePary_(ss)`, chování beze změny.
- `auditDat_` — kandidáty z `najdiDuplicity_` filtruje proti `nactiPosouzenePary_(ss)` před přidáním do `out.duplicity`. Pravidlo: „jednou ručně posouzeno (jakýkoli Stav) = samotest ho už nikdy nehlásí" — konzistentní s append-only filozofií `NÁVRH DUPLICIT`. Klíč je vázaný na konkrétní dvojici ID, ne na název/datum, takže nový pár se stejným názvem ale jinými řádky (jiná ID) se pořád správně nahlásí.
### Poznámka k architektuře
- 2 nové Node testy (464 → 466): pár se `Stav = "Zamítnuto"` v `NÁVRH DUPLICIT` → `auditDat_` ho nereportuje; zcela nový, dosud neznámý pár → `auditDat_` ho pořád správně reportuje (pojistka, že oprava nezpůsobila, že samotest přestane hlásit duplicity úplně).
- Existující testy `navrhniDuplicity_` ověřeny izolovaně (`--test-name-pattern`) — extrakce `nactiPosouzenePary_` chování nezměnila.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Backend v3.40 - auditDat_ nehlasi jiz posouzene pary"`). Bez frontendového zásahu.

## Backend v3.39 — DOPORUCENE_ZDROJE_NAPOVEDA: cílené doporučení zdroje v promptu (Olomouc) — 1. 9. 2026
### Diagnóza
- Navazuje na BACKLOG.md „Rozšíření zdrojů pro objevování akcí" — třetí a poslední ze tří samostatných příčin nalezených diagnostikou 31. 8. 2026. Olomoucká kontrola běží spolehlivě (4+ běhů, 13-15 akcí/běh), ale `olomouckadrbna.cz` se ani jednou neobjevil jako `primarni_zdroj`, ani jako `dalsi_zdroj` (ověřeno přímo v AKCE) — přestože je v ZDROJE se správným profilem. Ne bug, preferenční chování AI: systémový prompt v `callAnthropic_` říká „agregátory jen jako doplňkové ověření", ale sloupec Typ z listu ZDROJE (agregátor u Olomoucké Drbny i Žurnálu Plzeň, „oficiální kulturní organizace" u fungujícího Zlína) se do promptu vůbec nepřenáší — AI si roli zdroje musí odvodit sama.
### Změněno
- **`DOPORUCENE_ZDROJE_NAPOVEDA`** — mapa `norm_(profil) → text`, zatím jen `olomouc`. Cílená výjimka z obecné instrukce o agregátorech, NE plošné zjemnění pravidla pro všechny agregátory/města — u měst se silným oficiálním pokrytím (Brno, Praha) je dnešní chování žádoucí, regionální zdroje se přidávaly právě PROTO, že oficiální pokrytí je v menších městech řídké.
- `callAnthropic_` — `userMsg` refaktorováno na pole (`userMsgRadky`) s podmíněným vložením nápovědy mezi seznam zdrojů a zbytek promptu. Pro profily bez záznamu v mapě je výstupní prompt bajt přesně stejný jako dřív.
### Poznámka k architektuře
- 2 nové Node testy (462 → 464): profil Olomouc → prompt obsahuje doporučení; jiný profil (Brno) → prompt nápovědu neobsahuje (ověřeno na skutečném odeslaném payloadu, ne jen na počtu volání — vlastní lokální stub `frontaFetchuSPayloadem_`, sdílený `frontaFetchu` payload nezaznamenává).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Backend v3.39 - cilene doporuceni zdroje (Olomouc)"`), samostatně od v3.38. Bez frontendového zásahu.
- **Ještě nepotvrzeno v produkčních datech** — čeká se několik dní, než se dá v AKCE ověřit, jestli se `olomouckadrbna.cz` konečně objeví jako `primarni_zdroj`.

## Backend v3.38 — zpracovatSledovanaMesta: řazení podle stáří poslední kontroly — 31. 8. 2026
### Diagnóza
- Navazuje na BACKLOG.md „Rozšíření zdrojů pro objevování akcí" — ruční ověření v datech (list KONTROLY, typ „sledované město") ukázalo silně nerovnoměrnou frekvenci zpracování sledovaných měst za 11 dní od 20. 8.: Olomouc běžela spolehlivě (4+ běhů), Plzeň jen 2×, **Třinec ani jednou**.
- Kořenová příčina: `zpracovatSledovanaMesta` procházela seznam SLEDOVANÁ MĚSTA v PEVNÉM pořadí řádků, s časovým rozpočtem ~4,5 min na běh. Ochrana `jeDnesJizZpracovano_` řeší jen „bylo to zpracované DNES" — pomáhá při více spuštěních TÉHOŽ dne, ale triggery běží ve čtvrtek a v neděli (dva různé dny), takže nedělní běh vždy znovu začínal od indexu 0. Město na konci seznamu se tak při dost dlouhém seznamu nemuselo dostat na řadu nikdy — ne náhodná nespolehlivost, ale deterministický důsledek pozice v seznamu.
### Změněno
- **`serazenaSledovanaMesta_(mesta, kontroly)`** (nová, čistá) — řadí sledovaná města podle stáří poslední kontroly (`readPosledniKontrolyLokalit_`, už dřív čtena, jen se nepoužívala k řazení), nejstarší/nikdy-kontrolované první. Samoopravné řešení: když nějaký běh skončí dřív kvůli časovému limitu, příští běh automaticky upřednostní právě přeskočená města, bez nutnosti ukládat si samostatný rotační stav.
- `zpracovatSledovanaMesta` — jen přeházené pořadí čtení (`kontroly` před `mesta`) + zapojení řazení. Skip-dnes logika, časový limit i per-město try/catch beze změny.
### Poznámka k architektuře
- 4 nové Node testy (458 → 462): základní řazení podle stáří, nikdy-kontrolované město první, nerozparsovatelný text v mapě = nikdy-kontrolované, funkce nemutuje vstupní pole. Existující wiring test (Praha/Ostrava skip-dnes scénář) prošel beze změny — potvrzuje, že přeřazení pořadí zpracování nerozbilo skip logiku.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Backend v3.38 - razeni sledovanych mest podle stari"`). Bez frontendového zásahu.

## Backend v3.37 — Odstranit duplicity → Návrh duplicit (ruční schválení, ne auto-mazání) — 31. 8. 2026
### Navazující incident (produkce, po nasazení v3.36)
- Po v3.36 spuštěno „Odstranit duplicity" potřetí — smazáno **9 řádků místo očekávané 1**. Ruční audit všech párů (Google Sheets Historie verzí) potvrdil: Ostravský seriál i Balkan Soirée/Dunja Knebl (oba false positivy z v3.35/v3.36) se už NEobjevily — obě předchozí opravy fungují správně na produkci. 5 párů bylo skutečných duplicit (Rivec Fest, Den Brna, Velhartice, Na prknech, Balkan Night/Fanfare — všechny 1 den posunuté termíny stejné akce). Ale objevil se **ČTVRTÝ mechanismus chybné shody**: „Festival planet Brno 2026 – Gigalon (2. turnus)" vs. „…– srpnový turnus" a „Pražský výběr tribute – Kulturní léto na Poděbradech" vs. „Kulturní léto na Poděbradech" (celá sezónní série).
- **Mechanismus**: konkrétní akce v rámci sezónní/deštníkové série má název série jako součást svého vlastního názvu („Konkrétní akce – Název série"). U Festivalu planet Brno to spouští **poměrovou větev** (`festival`+`planet`+`brno`+`turnus` = 4 sdílená slova z 5, poměr 0,8 ≥ 0,5). U Poděbrad **podmnožinovou větev** — „Kulturní léto na Poděbradech" po stopwords filtru dá `{leto, podebradech}` (2 tokeny), což je doslovná podmnožina delšího názvu (100 % z definice), STEJNÝ tvar jako legitimní zkrácený název „Balkan Night" → `{balkan, night}` (taky 2 tokeny). **Žádný syntaktický signál (počet tokenů, poměr, přítomnost obecných slov) tenhle pár nerozliší** — rozdíl je čistě sémantický (série vs. konkrétní instance), ne rozpoznatelný bag-of-words heuristikou. Místo (misto) jako doplňkový signál nepomáhá — konkrétní instance je typicky na STEJNÉM místě jako její série.
- Data znovu ručně obnovena přes Historii verzí do čistého stavu.
### Rozhodnutí
- **Čtyři různé mechanismy chybné shody v jedné session** (v3.34: přesné datum bez tolerance; v3.35: generická brandingová slova; v3.36: číslice smazané normalizací; v3.37: série vs. konkrétní instance) — silný signál, že fuzzy shoda názvů je STRUKTURÁLNĚ nespolehlivá pro automatické NEVRATNÉ mazání. Každá dosavadní oprava řešila jen už nalezený vzorec, ne kategorii. Namísto další cílené záplaty (přístup by byl analogický v3.36, ale pro kategorii D neexistuje srovnatelně jednoznačný textový marker jako „N. měsíc") → **automatické mazání na základě fuzzy shody vypnuto úplně.**
### Změněno
- **„Odstranit duplicity" nahrazeno režimem návrhu k ručnímu schválení.** Nový list `NÁVRH DUPLICIT` (sloupce: Datum návrhu, ID/Název ponechat, ID/Název smazat, Datum od obou, Profil, Stav, Poznámka).
- **`navrhniDuplicity_(ss)`** — používá beze změny existující `najdiDuplicity_` (dry-run, nikdy nemazal), zapíše kandidáty do `NÁVRH DUPLICIT`. Append-only: páry, které v listu už existují v JAKÉMKOLI stavu (čeká/Potvrzeno/Zamítnuto/Smazáno), se znovu nenabízí — žádné mazání/přepis listu, dřívější rozhodnutí zůstávají navždy zachovaná.
- **`smazatPotvrzeneDuplicity_(ss)`** — maže z AKCE JEN řádky ručně označené `Stav = "Potvrzeno ke smazání"`. Identifikace přes `najdiAkciPodleId_` (rozšířeno o `radek`), NE přes uložené číslo řádku — mezi návrhem a potvrzením se mohlo v AKCE psát/mazat jinde, čísla řádků by neseděla.
- Obě funkce berou `ss` jako parametr (testovatelné přímo, stejný vzorec jako `zpracovatEmailTipy_(ss)`) — tenké menu-vázané obálky `menuNavrhniDuplicity_()`/`menuSmazatPotvrzeneDuplicity_()` volají `SpreadsheetApp.getActiveSpreadsheet()` a menu je zavolá bez argumentů.
- Menu: „Odstranit duplicity" nahrazeno dvěma položkami — „Najít možné duplicity" (bezpečné, jen čte) + „Smazat potvrzené duplicity" (jedná jen podle ručně potvrzených řádků).
### Poznámka k architektuře
- 6 nových Node testů (452 → 458): `navrhniDuplicity_` (zápis kandidátů, AKCE beze změny; existující pár se znovu nenabízí), `smazatPotvrzeneDuplicity_` (maže jen Potvrzené, ignoruje Zamítnuté; správně najde řádek podle ID i po posunu pořadí v AKCE; chybějící ID → označí Chybu, nespadne; chybějící list → nulový výsledek).
- Otevřená otázka zapsána do BACKLOG.md (K PROŠETŘENÍ, ne vyřešeno): `upsertEvents_` sdílí stejnou `isSameName_` logiku a stejnou zranitelnost vůči kategorii D, ale běží automaticky a TICHO při každém zápisu (tiché sloučení/přepsání dat místo mazání — hůř viditelné riziko). Mimo rozsah dnešní opravy, k budoucímu prošetření.

## Backend v3.34 — najdiDuplicity_: tolerační okno ±2 dny v datu (úklid/samotest) — 31. 8. 2026
### Změněno
- **`najdiDuplicity_`** — kandidáti se dřív bucketovali podle PŘESNÉ shody profil+datum_od, teprve uvnitř bucketu se porovnávaly názvy (`isSameName_`). Nová **`jsouDataBlizkoProDuplicitu_`** (toleranční okno `DUPLICITY_OKNO_DNI = 2` dny) posouvá porovnání data z klíče bucketu na podmínku uvnitř porovnání kandidátů — skupina se teď tvoří jen podle profilu, shoda data (±2 dny) i shoda názvu se ověřují až při srovnání dvojice. Fallback na přesnou textovou shodu zůstává pro nezpracovatelná data.
- **`upsertEvents_`** (zápisová cesta) — vědomě beze změny, zůstává na přesné shodě data. Vyšší cena chybného sloučení dvou různých akcí při zápisu než u periodického úklidu, který se dá bez rizika spustit znovu.
### Poznámka k architektuře
- Vychází z diagnostiky reálné duplicity v listu AKCE: „Light Up Tugendhat" (zahrada vily Tugendhat, Brno) měla dva řádky pro tutéž akci (7.–9. 8. 2026) — jeden zdroj ji zapsal jako součást „Maratonu hudby" s `datum_od` 6. 8. 2026, druhý samostatně s `datum_od` 7. 8. 2026. `isSameName_` by shodu názvů rozeznal (ověřeno přesným výpočtem tokenů), ale k porovnání vůbec nedošlo, protože oba záznamy skončily v různých bucketech přesné shody data. Zářijový výskyt téhož názvu (`2026-09-07-light-up-tugendhat`, jiný termín) zůstává správně NEspárovaný i po rozšíření okna.
- 5 nových Node testů (441 → 446): nalezený případ (posun o 1 den, jiné znění názvu), hraniční okno (přesně 2 dny = duplicita, 3 dny = ne), tolerance nepřebíjí oddělení podle profilu, zrcadlo zářijového případu (stejný název/profil, termín o měsíc jinam).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Index v3.34 - najdiDuplicity tolerance"`). Po nasazení ručně spuštěno „Odstranit duplicity" z menu Kulturní radar v Sheetu — výsledek a náprava viz „Backend v3.35" níže.

## Backend v3.35 — isSameName_: stopwords + poměrový práh (oprava chybných slučování) — 31. 8. 2026
### Incident (produkce, mezi v3.34 a v3.35)
- První běh opraveného `najdiDuplicity_` (tolerance ±2 dny, v3.34) na produkčních datech odhalil 12 „duplicit". Ruční ověření přímo v datech (Google Sheets Historie verzí) potvrdilo, že jde skutečně o duplicitu jen u 1 z nich (Light Up Tugendhat) — zbylé smazané řádky byly **chybná sloučení opravdu odlišných akcí**, konkrétně minimálně:
  1. „Balkan Soirée – Dunja Knebl & Xanthoula Dakovanou (Maraton hudby)" (9. 8., vágní místo) sloučeno s „Balkan Night: Fanfare Ciocărlia + Džambo Aguševi Orchestra – Maraton hudby" (7. 8., Hrad Špilberk nádvoří) — různí umělci, sdílená jen obecná/brandingová slova „balkan"/"maraton"/"hudby".
  2. „Letní kulturní program Ostrava" — denní seriál, KAŽDÝ den má vlastní legitimní řádek (2., 8., 12., 13., 16. 8. ověřeny jako samostatné). Rozšířené datumové okno (±2 dny) + slabé pravidlo „3+ společných slov" sloučilo sousední dny, ačkoli má každý den jiný konkrétní program.
- **Náprava dat**: produkční AKCE obnoveny přes Google Sheets „Historie verzí" → „Obnovit tuto verzi" (verze před úklidem, 31. 8. 2026 8:14) — všech 12 smazaných řádků vráceno zpět, včetně jediné správné duplicity (Light Up Tugendhat, dočasně zpět jako neuklizená, do doby opraveného algoritmu).
### Změněno
- **`NAZEV_STOPWORDS_`** — malý, cílený seznam obecných/brandingových slov bez vlastní identifikační hodnoty (`maraton`, `maratonu`, `hudba`, `hudby`, `letni`, `kulturni`, `program`), vyloučených z `nazevTokens_`. Záměrně NEobsahuje širší slova jako „festival"/„slavnosti" — ta bývají legitimní součást vlastního jména akce (viz regresní test „Shakespearovské slavnosti" níže).
- **`isSameName_`** — podmnožinová větev (zkrácený název) beze změny. Větev „3+ společných slov" teď navíc vyžaduje **poměrový práh** `NAZEV_SHODA_POMER_PRAH = 0.5`: sdílená slova musí tvořit aspoň 50 % menší z obou porovnávaných množin, ne jen absolutní počet 3+ v libovolně dlouhých názvech.
- Sdílená verze pro obě cesty (`upsertEvents_` i `najdiDuplicity_`) — žádná oddělená „přísnější" varianta, vědomé rozhodnutí (přísnější porovnání jen snižuje riziko chybného sloučení, nikdy ho nezvyšuje).
### Poznámka k architektuře
- 3 nové Node testy (446 → 449): `isSameName_` přímo na páru Balkan Soirée/Balkan Night, `najdiDuplicity_` integrační test na stejném páru, `najdiDuplicity_` na denním seriálu Ostrava (5 po sobě jdoucích/blízkých dnů, žádná duplicita).
- Živě izolovaně ověřeno (`node --test --test-name-pattern`), že regresní test „3+ společných slov… Shakespearovské slavnosti" po zavedení stopwords pořád prochází jako duplicita — hlavní důvod, proč byl zvolen malý cílený seznam místo širokého.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Index v3.35 - oprava detekce duplicit"`). Po nasazení znovu spuštěno „Odstranit duplicity" na produkci — **Ostravský seriál se PORÁD chybně sloučil** (viz „Backend v3.36" níže pro kořenovou příčinu a opravu), Balkan pár byl tímhle kolem opravy už správně NEODSTRANĚN. Data znovu ručně obnovena přes Historii verzí do čistého stavu.

## Backend v3.36 — ruznyDenSerie_: rozpoznání „N. měsíc" v názvu (druhé kolo opravy detekce duplicit) — 31. 8. 2026
### Navazující incident (produkce, po nasazení v3.35)
- v3.35 (stopwords + poměrový práh) opravil Balkan pár, ale **Ostravský denní seriál se sloučil znovu**. Kořenová příčina: `normNazev_`/`nazevTokens_` maže všechny číslice — skutečný produkční formát názvu je „Letní kulturní program Ostrava **– 12. srpna**" (s příponou konkrétního dne), ne zjednodušený název beze dne, jaký byl testován v v3.35. Po odstranění stopwords (`letni`/`kulturni`/`program`) zbyde na OBOU stranách identická sada `{ostrava, srpna}` — bez čísla dne, protože to `normNazev_` smazal. Shoda prochází přes **podmnožinovou větev** `isSameName_` (100 % z definice), která poměrový práh z v3.35 úplně obchází.
- Data znovu ručně obnovena přes Google Sheets „Historie verzí" na čistý stav, žádný další zásah do produkce před schválením opravy.
### Změněno
- **`RE_DEN_SERIE_`/`denZeSerie_`** — nová raná kontrola na NEnormalizovaném názvu (dřív, než `normNazev_` smaže číslice): rozpozná vzor „N. měsíc v genitivu" (např. „13. srpna") a vrátí číslo dne, nebo `null`. Vzor je specifický (číslo + tečka + volitelná mezera + měsíc v genitivu) — „25 let UNESCO" (Light Up Tugendhat) na něj neudeří, protože za „25" není tečka.
- **`ruznyDenSerie_`** — když OBĚ porovnávaná jména mají vzor „N. měsíc" a čísla dne se LIŠÍ, nikdy nepovažovat za duplicitu bez ohledu na jinou shodu. Když aspoň jedna strana vzor nemá, nebo je číslo stejné (duplicitní zápis TÉHOŽ dne), nerozhoduje o ničem — `isSameName_` rozhodne jako dřív.
- Guard `!ruznyDenSerie_(...)` doplněn do `najdiDuplicity_` i `upsertEvents_` (sdílená logika, stejně jako v3.35) — kandidáti teď nesou i syrový `nazev`, ne jen tokeny.
### Poznámka k architektuře
- 3 nové Node testy (449 → 452): `najdiDuplicity_` na SKUTEČNÉM produkčním formátu („– N. srpna"), přímé testy `denZeSerie_` (včetně ověření, že „25 let" regex nespustí), `ruznyDenSerie_` na stejném čísle dne (nesmí blokovat opravdovou shodu).
- Regresně živě izolovaně ověřeny (`node --test --test-name-pattern`) všechny předchozí případy: Tugendhat (6 testů), Balkan (2 testy), Shakespearovské slavnosti, starší zjednodušený Ostrava test bez přípony dne — všechny beze změny prošly.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Index v3.36 - ruznyDenSerie_ oprava"`). Po nasazení potřetí spuštěno „Odstranit duplicity" na produkci.

## Index.html v3.58 — Indexace pro Google/AI crawlery, část (a) — 23. 8. 2026
### Přidáno
- **Meta tagy v `<head>`** — `description`, Open Graph (`og:type`/`site_name`/`title`/`description`/`url`/`locale`), Twitter card (`summary`). Statické, obecné pro celou appku (appka je client-side rendered — dynamický OG obsah pro konkrétní sdílenou akci by viděl jen JS-aware crawler, ne link-preview boty jako Facebook/Slack, viz `Docs/AUDIT-INDEXACE.md`).
- **`favicon.svg`** — nová vlastní SVG ikona (soustředné kružnice, paleta appky), appka dřív žádnou neměla.
- **`sestavEventJsonLd_(a, odkaz)`** (PURE) + **`vlozitJsonLdAkce_(jsonLd)`** (DOM wrapper) — Schema.org `Event` JSON-LD vložený do `<head>`, jen když stránka běží s `?akce=ID&profil=Město` deep linkem A appka danou akci najde v načtených datech. `cena`/`image` záměrně vynechány (cena je volný text, ne číslo; akce nemají URL obrázku) — bezpečnější žádný údaj než chybný.
- **4 nové Node testy** pro `sestavEventJsonLd_`: běžná akce se všemi poli, bez platného data → `null`, `stav` „zrušeno" → `EventCancelled`/jinak `EventScheduled`, chybějící volitelná pole se nepropíšou do výstupu.
- **`apps-script/robots.txt`** (`Allow: /` + `Sitemap:` řádek) a **`apps-script/sitemap.xml`** (jen homepage) — nové soubory, viz poznámka k nasazení níže.
### Poznámka k architektuře
- Vychází z návrhu `Docs/AUDIT-INDEXACE.md` (23. 8. 2026, BACKLOG.md „Indexace appky pro Google i AI crawlery", bod a) — schváleno Vojtou 23. 8. 2026.
- **Klíčové zjištění (dokumentováno s citacemi v AUDIT-INDEXACE.md):** `kulturniradar.cz` už dřív servíroval `robots.txt` — ne z appky, ale z Cloudflare platformy. Cloudflare do každé zóny automaticky vkládá „Managed content" blok s `Disallow: /` pro GPTBot, ClaudeBot a další AI crawlery, VŽDY předřazený před obsah originu (potvrzeno v oficiální Cloudflare dokumentaci) — soubor v repu ho nemůže přebít. Řešení je jen přes Cloudflare dashboard (AI Crawl Control), zapsáno jako úkol pro Vojtu v BACKLOG.md.
- **Nedokončeno, zjištěno až živým ověřením po nasazení:** nové statické soubory (`robots.txt`, `sitemap.xml`, `favicon.svg`) se na `kulturniradar.cz` neservírují na svých cestách — pořád vrací SPA fallback appky. Předpoklad, že `apps-script/` je Cloudflare Pages build output directory, se nepotvrdil. Vyžaduje diagnostiku v Cloudflare dashboardu (úkol pro Vojtu, viz BACKLOG.md).
- Node testy 437 → 441 (+4). Backend `VERZE` beze změny (3.33) — čistě frontendová/statická změna.
- Nasazeno na obou kanálech: `git push` (Cloudflare Pages, `kulturniradar.cz`) a `clasp push -f` + `clasp deploy -i … --description "Index v3.58 (indexace pro Google/AI crawlery, cast a)"` (Apps Script `/exec`) — oba živě ověřeny (`?api=meta`, obsah `Index.html` v odpovědi doGet).

## Index.html v3.57 — Audit selektorů: data-iso/data-id/data-klic (body A+B+C) — 23. 8. 2026
### Přidáno
- **`.kalendar-den[data-iso]`** (`vykreslitKalendar()`) — buňka kalendářní mřížky teď nese vlastní ISO datum přímo v DOM. RF test „Klik na den v kalendáři svolá k odpovídající sekci" dřív musel datum ke konkrétní buňce dohledat přes `Evaluate JavaScript` voláním interní `isoDatum_()` a čtením `kalendarRok`/`kalendarMesic` napřímo — komentář testu to sám označoval za křehké vůči budoucímu přejmenování těchhle proměnných. Teď čte `data-iso` přímo z DOM, žádná závislost na interních názvech appky.
- **`.mapa-popup-btn[data-id]`** (`sestavPopupMapy_()`) — tlačítko „Zobrazit v seznamu" v popupu mapového pinu teď nese ID akce. RF test dřív ověřoval jen obecně, že SE NĚJAKÁ karta zvýrazní (žádný způsob, jak spárovat konkrétní pin s konkrétní kartou) — teď ověřuje, že zvýrazněná je PRÁVĚ TA karta, jejíž ID neslo kliknuté tlačítko (`.karta[data-id="X"].zvyrazneno`).
- **`.mapa-misto[data-klic]`** (`vykreslitSeznamMist_()`) — řádek v seznamu míst pod mapou teď nese stejný souřadnicový klíč jako `.nazev[data-klic]` na titulku karty (existující vzor od v3.41). RF test dřív vždy klikal na `nth=0` a ověřoval jen že NĚJAKÝ pin dostal `.pin-vybrany` — teď navíc ověřuje, že se vybrala karta se STEJNÝM klíčem (`.nazev[data-klic="K"].vybrano`), včetně zrušení výběru druhým klikem.
### Poznámka k architektuře
- Vychází z návrhu `Docs/AUDIT-SELEKTORU.md` (23. 8. 2026) — audit existujících ID/class/data-atributů napříč appkou, body A a B byly vysoká priorita s přímým dopadem na existující RF testy (self-dokumentovaná mezera v komentářích testů), C střední priorita.
- Node testy beze změny (437) — čistě HTML/RF úprava, žádný backendový ani čistý JS kód se nedotkl. Backend `VERZE` beze změny (3.33).
- Zbývá D–H z návrhu (`.misto-karta`, `.btn-url` v kartě akce, chipy stálých míst, `.mapa-stat`, `.den-hlavicka` „Probíhá") — nižší priorita, bez přímého dopadu na existující testy, viz BACKLOG.md.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Index v3.57 (audit selektoru A+B+C)"`), ověřeno živě přes obsah `?exec` odpovědi (`dataset.iso`/`dataset.id`/`dataset.klic` přítomné v nasazeném JS).

## Testy (bez bump verze) — 3 zbývající regresní testy testovacího dluhu + dokumentace flaky testů — 21. 8. 2026
### Přidáno
- **RF: „Opakované přepnutí profilu v dropdownu nerozbije appku"** — regresní pojistka na bug v3.12 (statický `#status` se mazal z DOM po prvním úspěšném vykreslení, každé DALŠÍ volání `nactiAkce` po přepnutí profilu tak tiše spadlo PŘED try blokem). Přepne postupně přes 3 různé profily, `Wait For Elements State .karta` po každém přepnutí je přímý regresní signál — kdyby se bug vrátil, druhé/třetí přepnutí by timeoutovalo. Na konci vrátí sdílenou stránku na původní profil.
- **Node: „zpracovatSledovanaMesta – přeskočí dnes už zpracované město"** — regresní pojistka na bug v3.18 (chybějící skip logika, opakované spuštění vždy začínalo od začátku seznamu měst). Na rozdíl od existujících 4 testů na `jeDnesJizZpracovano_` (čistá logika) tenhle testuje WIRING celého orchestrátoru — stub 2 měst (jedno „dnes zpracované", jedno ne), ověří že se AI zavolá jen pro nezpracované. Ověřeno i negativně: dočasné vypnutí skip-checku v `.gs` test korektně rozbilo (2 volání místo 1), pak vráceno zpět.
- **RF: „Klik na podkategorii-chip skutečně zúží seznam karet"** — dosavadní RF pokrytí `#podkat-chips` ověřovalo jen strukturální chování (prázdný/plný kontejner), ne že klik na konkrétní podkategorii seznam skutečně zúží — produkční data dřív žádnou platnou podkategorii neměla. Živě ověřeno 21. 8. 2026 (`?api=events`): kategorie „festivaly" má 11 akcí, jen 1 s podkategorií „dětský" — konkrétní, ověřitelné zúžení. Podmíněné (Log WARN skip) pro budoucí změnu dat.
- **`tests/unit.test.js`: `MemSheet.getDataRange()`** — nový helper, `readSources_`/ZDROJE dřív nebylo přes test harness vůbec testovatelné.
- **`SKILL.md` (obě kopie): nová sekce 8 „Flaky testy — obecný princip a náš případ"** — obecná část (co je flaky test, kategorie příčin, proč jsou zákeřné, jak se s nimi správně zachází) + zdokumentovaný dnešní případ (proměnlivá nestabilita RF sady po desítkách živých běhů v jedné session, diagnóza kumulativní zátěže Apps Script, ne regrese — viz BACKLOG.md).
### Poznámka k architektuře
- Node testy 437 (beze změny od minulého záznamu, tenhle bod jen dokumentuje krok 2 regresního testu samostatně).
- Živě ověřeno: oba nové RF testy prošly spolehlivě ve všech bězích (izolovaně i ve 4 plných bězích celé sady, včetně jednoho s proměnlivou nestabilitou zbytku sady nesouvisející s touhle prací — viz `SKILL.md` sekce 8 a `BACKLOG.md`).
- Tímhle je **testovací dluh po redesignu kompletně uzavřen** — všech 5 kroků auditu (notifikace, kontaktní formulář, kalendář, responzivní pásma, mapové piny) + tyhle 3 dodatečné regresní testy (profil, sledovaná města, podkategorie).
- Žádný produkční kód se touhle změnou nedotkl, deploy nebyl potřeba.

## Index.html v3.56 (část 2/2) — Refaktor sestavPopupMapy_/sestavPopupDataMapy_ + testy (testovací dluh, krok 5 auditu — POSLEDNÍ) — 21. 8. 2026
### Přidáno
- **`sestavPopupDataMapy_(akce)`** (PURE) — extrahuje obsahová data popupu mapy (`{nazev, id}` na akci) z `sestavPopupMapy_`, oddělené od DOM stavby, stejný princip jako `sestavBlokyAkci_` u notifikací (krok C). `sestavPopupMapy_` je teď tenký DOM wrapper, který jen volá tuhle čistou funkci a staví DOM podle jejího výstupu — výsledná DOM struktura beze změny (mechanická extrakce, ne přepis chování).
- **2 nové RF testy**: „Klik na pin otevře popup se strukturálně konzistentním obsahem" (ověřuje počet názvů == počet tlačítek == počet oddělovačů + 1, funguje na libovolném pinu — osamoceném i seskupeném, bez potřeby předem znát data) a „Tlačítko „Zobrazit v seznamu" v popupu zvýrazní odpovídající kartu" (ověřitelné až po opravě self-cancel bugu z části 1/2).
- **5 nových Node testů** pro `sestavPopupDataMapy_`: jedna akce, víc akcí (pořadí/počet), chybějící název → `''`, prázdné pole, cizí pole vstupního objektu (lat/lng/kategorie) se nepropíšou do výstupu.
### Poznámka k architektuře
- Node testy 431 → 436 (+5).
- Popup samotný (Leaflet marker click → `.leaflet-popup .mapa-popup`) zůstává jinak netestovatelný v Node (DOM-only, `document.createElement`) — RF je jediná úroveň pokrytí pro samotnou DOM stavbu/klik, Node teď pokrývá OBSAH nezávisle na DOM.
- Živě ověřeno: celá sada proti lokální opravené kopii i po nasazení (viz níže) proti `kulturniradar.cz` — 47/47 (1 nesouvisející jednorázový zákmit u „✓ Navštívené" toggle testu vyloučen, potvrzeno izolovaným rerunem).
- **Tímhle je krok 5 (a tedy CELÝ audit testovacího dluhu, kroky 1–5) kompletně hotový** — viz BACKLOG.md.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Index v3.56 (část 2 - popup refaktor + testy)"`), ověřeno `?api=meta`. Backend beze změny.

## Index.html v3.56 (část 1/2) — Fix: zvyraznitAkci_ self-cancel bug (testovací dluh, krok 5 auditu) — 21. 8. 2026
### Opraveno
- **`zvyraznitAkci_`** — volaná zevnitř vlastního click handleru (tlačítko „Zobrazit v seznamu" v popupu mapy, viz část 2 níže) se sama okamžitě rušila: `document.addEventListener('click', odstranit)` registrovaný SYNCHRONNĚ uvnitř click handleru ještě stihl zachytit TENTÝŽ probublávající click, protože listener přidaný na předka, dokud u něj probíhající událost ještě nedorazila v bublání, se pro ni ještě stihne spustit. Objeveno živě 21. 8. 2026 při RF diagnostice mapových popupů (empiricky ověřeno: přímé volání mimo click event → zvýraznění zůstává; volání z click handleru → mizí okamžitě, bez `Sleep` potřeba k reprodukci). Oprava: `setTimeout(() => document.addEventListener('click', odstranit), 0)` odloží registraci o jeden tick, mimo aktuální probublávání. Volání ze sdíleného odkazu (`?akce=ID`, mimo click event) beze změny chování.
### Poznámka k architektuře
- Bug byl v produkci od zavedení mapových popupů (v3.38) — první call site (`?akce=ID` deep link) ho nikdy nevystavil, protože běží mimo click event. Objeven až testováním DRUHÉHO call site (popup tlačítko), který vznikl později a nikdy neměl žádné pokrytí (testovací dluh, viz BACKLOG.md).
- Samostatný, malý commit oddělený od navazujícího refaktoru `sestavPopupMapy_`/`sestavPopupDataMapy_` (část 2/2) — dvě nesouvisející změny.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Index v3.56 (část 1 - zvyraznitAkci fix)"`), ověřeno `?api=meta`. Backend beze změny.

## RF testy (bez bump verze) — Responzivní pásma: 900px/1360px breakpointy (testovací dluh, krok 4 auditu) — 21. 8. 2026
### Přidáno
- **„Responzivní pásma: střední (900-1359px) omezí main na 656px a mapu zalomí pod obsah"** — běží na sdílené desktopové stránce ze Suite Setup (1280×900, uvnitř tohohle pásma, žádný nový Context), ověřuje `main` šířku přesně `656px` (`max-width` strop z `@media (min-width:900px) and (max-width:1359px)`) a že `#mapa-panel` je zalomená POD `main` (`y` mapy ≥ `main` `y`+`výška`).
- **„Responzivní pásma: široké (≥1360px) main přesáhne 656px a mapa zůstává vedle obsahu"** — vlastní Context 1600px, ověřuje `main` šířku `> 656px` (strop zmizel) a že `#mapa-panel` je VEDLE `main` (podobná `y` pozice), ne pod ním.
- Počet sloupců mřížky (`grid-template-columns`) vědomě NEPOUŽIT jako signál — živě ověřeno (21. 8. 2026), že na 1280px i 1600px vychází stejně 2 sloupce (main na 1600px má jen 848px, na 3. sloupec 320px+gap nestačí) — šířka `main` a pozice `#mapa-panel` jsou přímý, spolehlivý otisk testovaného CSS pravidla.
### Poznámka k architektuře
- Node testy beze změny (431) — čistě CSS media query chování, žádná JS logika k testování.
- Žádná závislost na produkčních datech — obě měření jsou čistě layout výsledky nezávislé na počtu `.karta` prvků.
- Živě ověřeno proti `kulturniradar.cz`: celá sada 46/46 (44 předchozích + 2 nové).
- Žádný produkční kód se touhle změnou nedotkl — jen `tests/robot/frontend.robot`, deploy nebyl potřeba.

## RF testy (bez bump verze) — Kalendář: navigace, klik→scroll, tooltip (testovací dluh, krok 3 auditu) — 21. 8. 2026
### Přidáno
- **„Kalendář: navigace mezi měsíci mění nadpis měsíce/roku"** — ověřuje `#kalendar-predchozi`/`#kalendar-dalsi` (`posunoutMesic_`) tak, že sleduje ZMĚNU textu `#kalendar-nazev-mesice` a návrat na původní hodnotu (round-trip dalsi→predchozi), ne konkrétní očekávaný měsíc — appka běží proti reálnému „dnes", žádná závislost na produkčních datech.
- **„Kalendář: klik na den s akcí odscrolluje na odpovídající sekci v seznamu"** — protože buňka dne v DOM nenese žádné ISO datum (jen `textContent` = číslo dne), test spočítá ISO datum pro každou `.ma-akce` buňku přes `Evaluate JavaScript` (`isoDatum_(new Date(kalendarRok, kalendarMesic, den))` — čte přímo top-level proměnné appky, jsou dostupné, protože appka neběží v IIFE), najde první buňku s existujícím `#den-<iso>` cílem (dlouhodobé akce v sekci „Probíhá/dlouhodobé" cíl nemají, viz `skocitNaDen_`) a ověří scroll přes `getBoundingClientRect().top` blízko horního okraje viewportu (přesnější signál než jen změna `scrollY`), s `Wait Until Keyword Succeeds` kvůli `behavior:'smooth'`. Podmíněné na existenci aspoň jedné `.ma-akce` buňky s platným cílem — jinak `Log WARN` a přeskočí (stejný vzor jako „Sekce stálých míst").
- **„Kalendář: hover na den s akcí zobrazí tooltip s názvy akcí, mouseout ho schová"** — `Hover` na `.ma-akce` buňku ověří `#kalendar-tooltip.zobrazeno` + neprázdný obsah (tooltip obsahuje jen holé názvy akcí, žádné datum/počet), `Hover` na jiný prvek ověří schování. Podmíněné stejně jako výš.
### Poznámka k architektuře
- Node testy beze změny (431) — pure logika (`sestavKalendarMrizku_`, `vypocitejPoziciTooltipuKalendare_`, `akceDnePodleData_`) už dřív pokrytá, tahle trojice doplňuje E2E vrstvu.
- Test „klik→scroll" je vědomě zdokumentovaný jako vázaný na konkrétní interní názvy (`kalendarRok`/`kalendarMesic`/`isoDatum_`) — při budoucím refaktoru může tiše spadnout bez souvislosti se skutečným bugem, viz komentář přímo v testu.
- Živě ověřeno proti `kulturniradar.cz`: celá sada 44/44 (41 předchozích + 3 nové). Oba podmíněné testy prošly REÁLNOU ověřovací větví (žádný WARN skip) — srpen 2026 měl dostatek dat (7 z 8 `.ma-akce` dnů s platným scroll cílem).
- Žádný produkční kód se touhle změnou nedotkl — jen `tests/robot/frontend.robot`, deploy nebyl potřeba.

## RF testy (bez bump verze) — Kontaktní formulář: plný E2E cyklus + cooldown (testovací dluh, krok 2 auditu) — 21. 8. 2026
### Přidáno
- **„Kontaktní formulář: prázdná zpráva zobrazí inline chybu (bez odeslání)"** — ověřuje klientskou validaci (`kontakt-odeslat` handler v `Index.html`), která se vrací PŘED voláním serveru — žádný network request, nulové riziko, lze spouštět opakovaně.
- **„Odeslání kontaktního formuláře: úspěch, pak okamžité druhé odeslání selže na cooldown"** — jediný test v sadě, co skutečně pošle e-mail na `KONTAKT_EMAIL` (info@kulturniradar.cz), spojený s ověřením 30s cooldownu (`KONTAKT_COOLDOWN_MS`, `apiKontakt_`) do JEDNOHO testu s dvěma rychle po sobě jdoucími odesláními — druhý klik proběhne v řádu ms po prvním, hluboko uvnitř 30s okna, takže cooldown se ověří deterministicky bez časové závislosti/flake a pošle se jen 1 e-mail za běh. Zpráva má v textu jasný marker („Automaticky RF test (E2E)..."), e-mail pole záměrně prázdné (jde přes větev `MailApp` bez `replyTo`).
- Backend `apiKontakt_` byl už dřív plně pokrytý Node testy — tahle dvojice doplňuje chybějící E2E vrstvu (skutečný klik/formulář/DOM), ne logiku samotnou.
### Poznámka k architektuře
- Node testy beze změny (431) — žádná nová čistá logika, jen RF pokrytí existujícího, už otestovaného backendu.
- Živě ověřeno proti `kulturniradar.cz`: celá sada 41/41 (39 předchozích + 2 nové). Reálné doručení e-mailu potvrzeno přímo v Gmailu (`info@kulturniradar.cz`) — 3 zprávy z ladění (vlastní `msg=` bug na `Wait For Elements State`, dokumentovaná gotcha ze SKILL.md, odhalený a opravený před odesláním k review), všechny s markerem, žádná se netvářila jako skutečný dotaz.
- Žádný produkční kód se touhle změnou nedotkl (`Index.html`/`kulturni_radar.gs` beze změny) — jen `tests/robot/frontend.robot`, deploy proto nebyl potřeba.

## Index.html v3.55 — Fix: race condition v inicializovatMapu_() (testovací dluh #14-19) — 21. 8. 2026
### Opraveno
- **`inicializovatMapuAzPripravena_()`** — nová obálka nad `inicializovatMapu_()`, řeší časový závod objevený při živém RF běhu proti produkci (21. 8. 2026): `inicializovatMapu_()` se volala hned po prvním `await api('meta')`, což za normálních okolností stačilo (Leaflet `<script>` je head-blocking bez `async`/`defer`), ale zrychlené odpovědi (cache) tenhle náhodný časový polštář odstranily a `L` občas ještě nebylo definované. Oprava čeká na `load`/`error` event `<script id="leaflet-script">` tagu, s timeoutem 5 s jako pojistkou pro skutečný výpadek CDN — appka i pak běží dál beze mapy (nezměněná filozofie „bonus, ne kritické"). `inicializovatMapu_()` samotná beze změny, mění se jen KDY se volá.
- `<script>` tag pro Leaflet dostal `id="leaflet-script"` (dřív bez id) — nutné pro navěšení event listeneru na konkrétní tag.
- **4 opravy v `tests/robot/frontend.robot`** (testovací dluh #14-19, viz BACKLOG.md), objevené jako vedlejší nález při ověřování opravy výš:
  - 3× selektor `#mapa .leaflet-container` → `#mapa.leaflet-container` (bez mezery) v testech „Mapa se vykreslí (Leaflet)", „Seznam míst pod mapou...", „Klik na řádek v seznamu míst...". Leaflet stamps třídu `leaflet-container` přímo na `#mapa` (element předaný do `L.map(id)`), ne na vnořený potomek — descendant selektor s mezerou proto nikdy nemohl nic najít, nezávisle na časovém závodu výš. Ověřeno přímou DOM inspekcí (`#mapa .leaflet-container` → 0 shod, `#mapa.leaflet-container` → 1 shoda).
  - Keyword `Otevřít radar na mobilním viewportu` doplněn o `Wait For Elements State .karta >> nth=0 visible` (dřív čekal jen na `header h1`) — testy „Kalendář/Mapa lze otevřít... (mobil)" klikaly na `#kalendar-toggle`/`#mapa-toggle` dřív, než appka stihla doběhnout `init()` a navěsit listenery (samostatný, na Leaflet nezávislý časový závod v testu samotném, ne v appce).
### Poznámka k architektuře
- Node testy beze změny (431) — `inicializovatMapuAzPripravena_()` je DOM/timer-heavy (script element, event listenery, `setTimeout`), stejná kategorie jako ostatní DOM-vykreslovací funkce bez Node pokrytí, spoléhá na RF.
- Diagnostika: `file://` lokální kopie `Index.html` s reálnými fetch voláními proti nasazené `EXEC_URL` posloužila k ověření opravy PŘED nasazením (appka natahuje data vždy přes napevno zapsanou Apps Script URL, bez ohledu na to, odkud se HTML samo načetlo — CORS z `file://` originu funguje).
- Živě ověřeno: 5 původně selhávajících testů + celá sada (39/39) proti `file://` kopii s opravou, pak znovu po nasazení proti `kulturniradar.cz`. Jeden dodatečný, nesouvisející nález při plné sadě: test „Notifikace: vygenerování ntfy tématu..." jednou selhal na timeoutu při ukládání (ponechal `rf-test` s dočasně zapnutým kanálem ntfy) — potvrzeno jako jednorázový zákmit (rerun prošel čistě), účet ručně vrácen do `kanaly:[]` a ověřeno ze serveru.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "Index v3.55"`), ověřeno `?api=meta`. Backend (`kulturni_radar.gs`) se touhle změnou nedotkl, `VERZE` konstanta zůstává 3.33.

## Backend v3.33 + Index.html v3.54 — Notifikace: frontend UI (krok E) — 21. 8. 2026
### Přidáno
- **Nová sekce „Notifikace" v `#filtry-dialog`** (rozšíření existujícího „Můj profil" panelu, ne nový modal), po poli Dojezd, před akčními tlačítky: dva checkboxy kanálu (E-mail/Push-ntfy), pole e-mailu a blok ntfy tématu podmíněně viditelné jen podle zaškrtnutého kanálu (`prekreslitNotifOblasti_`), `<select>` frekvence s presety 1/3/7/14/30 dní, statický popisek obsahu (`obsah: ['kategorie']` posílá handler implicitně — žádný checkbox, jediná dnes podporovaná hodnota).
- **ntfy téma jen jako odkaz** na `https://ntfy.sh/<tema>` + tlačítko „Vygenerovat nové téma" (rotace) — vědomě ŽÁDNÁ QR knihovna pro MVP (rodina appku primárně používá na telefonu, kde odkaz stačí; QR lze doplnit později beze zásahu do zbytku). Téma samotné zůstává NIKDY needitovatelné jako text — jen `apiVygenerovatNtfyTema_` ho smí vytvořit (viz krok B).
- **Jedno sjednocené tlačítko „Uložit"** — volá `apiSetFiltry` a `apiSetNotifikace` sekvenčně (dvě nezávislé věci: selhání notifikací nezahodí už uložené filtry). Inline chybová hláška ve sdíleném `#filtry-chyba` (stejný vzor jako `#kontakt-chyba`), ne `alert()` — chyba nechá dialog otevřený k opravě.
- **`sestavNotifikace_`/`validovatNotifikaceKlient_`** (PURE) — sestaví objekt nastavení z formuláře a zrcadlí backendovou `validovatNotifikace_` pro okamžitou zpětnou vazbu PŘED voláním serveru (e-mail vyžaduje platný formát, ntfy vyžaduje už vygenerované téma).
- **Tři chybějící propojení (gaps) objevené při návrhu, doplněná jako součást kroku E:** no-underscore wrappery `apiSetNotifikace`/`apiVygenerovatNtfyTema` v `.gs` (potřebné pro `google.script.run`), odpovídající case větve v `sestavFetchPozadavek_` (potřebné pro statický frontend/Cloudflare Pages), a `sestavPrihlasenehoUzivatele_` (PURE) — rozšíření login handleru, aby `notifikace` z `apiPrihlaseniUzivatele_` už nepadalo pod stůl.
- 9 nových Node testů: `sestavNotifikace_` (2), `validovatNotifikaceKlient_` (3), `sestavPrihlasenehoUzivatele_` (2), `apiSetNotifikace`/`apiVygenerovatNtfyTema` wrappery (2) + rozšíření existujícího `sestavFetchPozadavek_` testu o obě nové akce. 4 nové RF scénáře v `tests/robot/frontend.robot` (checkbox toggle bez uložení, neplatný stav → inline chyba/dialog zůstává otevřený, plný cyklus generování tématu + uložení + reload + ověření populace ze serveru + návrat do původního stavu).
### Poznámka k architektuře
- Node testy 422 → 431 (+9).
- RF testy napsané, ale **neověřené živě** — tohle vývojové prostředí nemá prohlížeč ani přístup k nasazenému `?exec`; první ověření proběhne až po tomhle nasazení (viz BACKLOG.md, krok F).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.33 / Index v3.54"`), ověřeno `?api=meta` → `"verze":"3.33"`.
- **Kroky A–F notifikací jsou tímhle kompletně hotové.** Krok G (obsah „doporučení") zůstává vědomě odloženo, viz BACKLOG.md.

## Backend v3.32 — Notifikace: trigger + odesílací smyčka + dry-run (krok D) — 21. 8. 2026
### Přidáno
- **`odeslatNotifikaci_(title, body, htmlBody, topic, email)`** — nízkoúrovňová odesílací mechanika (ntfy e-mailová brána + zkracování dlouhých těl, MailApp pro e-mail) extrahovaná ze `sendNotification_`, teď bere EXPLICITNÍHO příjemce místo čtení Script Properties. `sendNotification_` je teď 3-řádkový wrapper (čte `NOTIFY_EMAIL`/`NTFY_TOPIC`, volá `odeslatNotifikaci_`) — beze změny chování, ověřeno existujícími testy (žádná nová regrese nebyla potřeba, protože `sendNotification_` už měl 4 přímé testovací scénáře, všechny beze změny prošly).
- **`jeDueNaNotifikaci_(notifikace, dnes)`** (PURE) — prázdné `posledniOdeslano` = due okamžitě, jinak `(dnes − posledniOdeslano) >= frekvenceDny` v celých dnech.
- **`planNotifikaceUzivatele_(notifikace, dnes)`** (PURE) — kombinuje tři přeskakovací podmínky (vypnuté kanály, obsah bez `'kategorie'`, ještě není čas) do `{ posli, duvod }`.
- **`sendUserNotifications_(dryRun)`** — denní odesílací orchestrátor. Pro každého uživatele: `planNotifikaceUzivatele_` → pokud due, `digestProUzivatele_` (krok C, okno = dnes až dnes+`frekvenceDny`) → `odeslatNotifikaci_` na uživatelův vlastní kanál (ntfy téma/e-mail, ne globální Script Properties) → zápis `posledniOdeslano` jako ISO 8601 string. Dry-run (`true`): neodešle, nezapíše, jen `Logger.log` + vrátí `[{uzivatelId, jmeno, posli, duvod, pocetAkci}]`.
- **Trigger `sendUserNotifications()`** (no-arg wrapper) registrovaný v `setupTriggers()`, denně v 9:00 — po `dailyCheck` (8:00), ať jsou data v AKCE čerstvá.
- **Menu „Notifikace: suchý běh (test)"** (`sendUserNotificationsDryRun_`) — spustí dry-run a zobrazí souhrn přes `SpreadsheetApp.getUi().alert(...)`, ať jde ověřit bez procházení Execution logu.
- 10 nových Node testů: `jeDueNaNotifikaci_` (3), `planNotifikaceUzivatele_` (4), `sendUserNotifications_` (3 — rozlišení due/not-due/vypnuto/bez-obsahu v jednom běhu, dry-run neodešle/nezapíše, reálný běh odešle a zapíše ISO string).
### Změněno
- **`validovatNotifikace_`: rozsah `frekvenceDny` snížen z 1–90 na 1–30 dní** (rozhodnutí 21. 8. 2026) — okno obsahu (`digestProUzivatele_`) nikdy nepokryje víc než ~30 dní (čitelnost + `weatherFor_` má smysluplná data jen ~16 dní dopředu), takže delší frekvence by matematicky garantovala tichou mezeru mezi okny (uživatel s frekvencí 90 dní by viděl jen prvních 30 dní každého cyklu). Řešeno na vstupu (nejde to vůbec zvolit), ne ořezáváním okna na výstupu — jednodušší kód v `sendUserNotifications_`. Migrace nebyla potřeba (žádný uživatel dnes nemá reálně nastavené notifikace).
### Poznámka k architektuře
- Node testy 412 → 422 (+10).
- Drobná neblokující poznámka pro budoucnost: `sendUserNotifications_` volá `readUzivatele_(ss)` znovu per odesílaný uživatel (kvůli indexu řádku) — pro ~4 rodinné profily zanedbatelné, zvážit cachování/index jen při výrazném nárůstu počtu uživatelů.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.32"`), ověřeno `?api=meta` → `"verze":"3.32"`.
- **Krok E (frontend UI) a F (testy/nasazení celku) zůstávají pro příští session.** Krok G (obsah „doporučení") zůstává vědomě odloženo, viz BACKLOG.md.

## Backend v3.31 — Notifikace: obsah „podle kategorií" (krok C) — 21. 8. 2026
### Přidáno
- **`digestProUzivatele_(ss, uzivatelId, from, to)`** — sestaví TEXTOVÝ i HTML obsah personalizovaného digestu pro JEDNOHO uživatele, filtrovaný podle jeho osobních kategorií (`UŽIVATELÉ.Filtry.kategorie`, volný text stejného formátu jako `KRIT.KATEGORIE`), místo celého rodinného profilu. Čistá funkce bez side-effectů — nevolá `sendNotification_` ani Anthropic API, jen čte už ověřená data přes `readEventsInRange_` (stejný zdroj jako `digestRange_`). Vrací `{ ok, pocetAkci, hlavicka, text, html }`; odeslání je úkolem budoucího odesílacího jobu (krok D).
- Prázdné/chybějící `Filtry.kategorie` → žádný filtr, zobrazí se vše z okna (stejná konvence jako frontendové `filtrovatKategorii_` — „prázdná množina = žádný filtr"), ne prázdný obsah.
- **`sestavBlokyAkci_(evs, profil, prazdnyText)`** — extrahováno z `digestRange_` (seskupení akcí podle kategorie, vložení data/času/počasí do detailů), teď sdílené mezi family-wide `digestRange_` a novým `digestProUzivatele_`, ať existuje jen JEDNA verze formátování položky digestu. `digestRange_` refaktorován na volání této funkce — mechanická extrakce, beze změny chování (ověřeno regresním testem).
- 5 nových Node testů: `digestProUzivatele_` (uživatel s kategoriemi, bez kategorií, žádné akce v období, neznámý profil) + regresní test `digestRange_` (přesný obsah e-mailu/HTML shodný s chováním před extrakcí).
### Poznámka k architektuře
- Node testy 407 → 412 (+5).
- **Známé omezení** (existující limitace celého systému, ne něco, co tenhle krok zavádí nově — viz BACKLOG.md): `readEventsInRange_`/`digestProUzivatele_` berou jen JEDNO aktivní město z KRITÉRIÍ pro celou domácnost, osobní digest dnes nemůže sledovat jiné město, než je zrovna aktivní.
- Vědomě mimo rozsah kroku C: sekce „Stálá místa" (není kategorie-related, ponecháno jen v `digestRange_`).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.31"`), ověřeno `?api=meta` → `"verze":"3.31"`.
- **Kroky D–F (odesílací trigger + dry-run, frontend UI, testy/nasazení) zůstávají pro příští session.** Krok G (obsah „doporučení") zůstává vědomě odloženo, viz BACKLOG.md.

## Backend v3.30 — Notifikace: datový model + backend API (kroky A–B) — 21. 8. 2026
### Přidáno
- **A) Datový model** — nový sloupec `Notifikace` (6.) v listu `UŽIVATELÉ` (`UZIVATELE_HLAVICKA`), JSON blob per uživatel: `{ kanaly: ['email','ntfy'], email, ntfyTema, frekvenceDny, obsah: ['kategorie'], posledniOdeslano }`. `readUzivatele_` čte i tenhle sloupec (chybějící/starý 5-sloupcový řádek → prázdný text → `{}`, žádný pád). Jednorázová migrace `migraceNotifikaceSloupec_()` (nová položka v menu Sheets) doplní hlavičku F1 na existujícím produkčním listu — nové listy ji mají automaticky přes `ensureUzivateleSheet_`.
- **B) Backend API** — `validovatNotifikace_` (PURE): e-mail vyžaduje platnou adresu jen když je `'email'` v `kanaly`, ntfy vyžaduje už vygenerované téma jen když je `'ntfy'` v `kanaly`, frekvence 1–90 dní; prázdné `kanaly` (vypnuto) projdou vždy. `apiSetNotifikace_` ukládá nastavení (nová akce `set-notifikace` v `routePost_`) — `kanaly`/`obsah` se tiše ořežou na povolené hodnoty (`POVOLENE_KANALY_`/`POVOLENY_OBSAH_`), nevalidní pokus se vůbec nezapíše. `apiVygenerovatNtfyTema_` (nová akce `vygenerovat-ntfy-tema`) vygeneruje a uloží nové ntfy téma (`novaNtfyTema_`, formát `radar-<32 hex>` z `Utilities.getUuid()`), zachová ostatní pole při rotaci. `apiPrihlaseniUzivatele_` teď vrací i `notifikace` vedle `filtry`.
- **Bezpečnostní rozhodnutí (21. 8. 2026):** ntfy téma je vždy server-generované, NIKDY nepřichází od klienta — ani přes `set-notifikace` (pole `ntfyTema` v požadavku se ignoruje, backend vždy použije to, co má už uložené). Důvod: ntfy.sh nemá autentizaci, kdokoli zná téma může na něj psát i číst, takže user-friendly/uhodnutelné téma (např. „vojta-radar") by bylo zranitelné. Stejně tak `posledniOdeslano` smí nastavit jen budoucí odesílací job (krok D), klient ho nikdy nezapisuje přímo.
- 14 nových Node testů (`validovatNotifikace_`, `novaNtfyTema_`, `apiSetNotifikace_`, `apiVygenerovatNtfyTema_`, rozšíření `apiPrihlaseniUzivatele_`, routing v `routePost_`).
### Poznámka k architektuře
- Node testy 393 → 407 (+14).
- `posledniOdeslano` se ukládá jako ISO 8601 string uvnitř JSON blobu, nikdy jako nativní Sheets Date — pole prochází jen přes `JSON.stringify`/`JSON.parse`, takže se nikde nedotkne Sheets automatické detekce typu buňky.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.30"`), ověřeno `?api=meta` → `"verze":"3.30"`.
- **Kroky C–F (obsah „podle kategorií", odesílací trigger, frontend UI, testy/nasazení) zůstávají pro příští session** — tenhle blok jen ukládá/čte preference, nic zatím neposílá. **Krok G (obsah „doporučení" v notifikacích) vědomě odloženo**, viz BACKLOG.md.
- **Manuální krok po nasazení:** jednou spustit „Přidat sloupec Notifikace do UŽIVATELÉ" z menu Sheets (`migraceNotifikaceSloupec_`) — bez toho zůstane hlavička sloupce F na produkčním listu prázdná (funkčnost dat to neovlivní, jen čitelnost tabulky).

## Index.html v3.53 — Roční přehled (Část 2): doporučení podle historie — 21. 8. 2026
### Přidáno
- **`spocitatDoporuceni_`** (PURE) — heuristika skóre podobnosti pro sekci „Doporučujeme pro vás". Pro každou dosud nenavštívenou a viditelnou budoucí akci (`jeViditelnaVSeznamu_` — bez proběhlých, bez neověřených-bez-URL) spočítá skóre vůči kategoriím/podkategoriím napříč všemi navštívenými akcemi uživatele: **+2** za shodu hlavní kategorie s libovolnou navštívenou akcí (jednorázově, ne za každou shodující se navštívenou akci zvlášť), **+1** za každou sdílenou podkategorii až do stropu **max 2 body celkem** (strop záměrně pod hodnotou kategorie, ať jemné podkategorie nikdy nepřeváží hlavní signál kategorie, i kdyby akce sdílela všechny 3 možné podkategorie), **+1** bonus za `mistoOblibene === true`. Vrací seřazený seznam (nejvyšší skóre první), jen akce se skóre > 0.
- **`vykreslitDoporuceni_`** (DOM) — vykreslí sekci „Doporučujeme pro vás" (max 5 karet, `vytvorKartu`) nad hlavní seznam akcí, volané z `prekreslit()` hned po `renderAkce()` (jen v běžném pohledu „Vše", ne ve speciálních filtrovaných pohledech). Stejný `main.prepend` vzor jako `vykreslitStatistikuNavstivenych_` (v3.52) — předchozí sekci smaže sama `renderAkce()`/`renderSpecialni()` clear-loop při příštím překreslení. Viditelná jen když je uživatel přihlášený, má aspoň **2 navštívené akce** (práh viditelnosti, rozhodnuto 21. 8. 2026 — ukázat brzy, i s méně spolehlivým skóre zpočátku) a existuje aspoň jedno doporučení se skóre > 0.
- 8 nových Node testů pro `spocitatDoporuceni_` (shoda kategorie, žádná shoda, prázdná historie, bonus za oblíbené místo, capping podkategorie na max 2 body, kombinace víc faktorů, už navštívená akce se nedoporučí znovu, proběhlá akce se nedoporučí).
### Poznámka k architektuře
- Čistě frontend, žádný zásah do `kulturni_radar.gs` — `apiEvents` už posílá `kategorie`, `podkategorie` i `mistoOblibene` pro všechny akce, stačila nová agregace nad daty, co appka měla k dispozici.
- Cap podkategorie (`PODKATEGORIE_BONUS_MAX = 2`) je záměrně deklarován jako lokální konstanta UVNITŘ `spocitatDoporuceni_`, ne jako sdílený modulový konstant — `tests/frontend-harness.js` extrahuje pro testy jen tělo pojmenované funkce (počítáním `{ }`), ne okolní kód, takže externí konstanta by v testovacím kontextu nebyla definovaná.
- Node testy 385 → 393 (+8).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.53"`), ověřeno `?api=meta` → HTTP 200, `ok:true` (backend `VERZE` beze změny, 3.29 — měnil se jen Index.html).
- Součást spárované položky „Roční přehled + Doporučení podle historie" (BACKLOG.md) — **obě části teď kompletně hotové** (Část 1 = Index.html v3.52, Část 2 = Index.html v3.53).

## Index.html v3.52 — Roční přehled (Část 1): souhrnná statistika nad „✓ Navštívené“ — 21. 8. 2026
### Přidáno
- **`spocitatStatistikuNavstivenych_`** (PURE) — agreguje statistiku nad už vyfiltrovaným seznamem navštívených akcí (výstup `filtrovatNavstivenaPodleObdobi_` + `filtrovatOblibenaMista_`): počet, rozpad podle hlavní kategorie (`a.kategorie[0]`, fallback `'ostatní'`), rozpad podle místa (`misto (obec)`, fallback `'neuvedeno'`).
- **`vykreslitStatistikuNavstivenych_`** (DOM) — vykreslí souhrnný box (počet + kategorie + top 5 míst) nad karty v pohledu „✓ Navštívené", volané z `prekreslit()` hned po `renderSpecialni` se stejným `seznam`, takže souhrn vždy odpovídá aktivnímu období (`obdobi-select`) i filtru „🏛 Oblíbená místa". Nic nevykreslí u prázdného seznamu (prázdný stav už řeší text z `renderSpecialni`).
- CSS `#navstivene-statistika`/`.navstivene-stat-pocet`/`.navstivene-stat-radek`, převzato ze stylu existující `.misto-karta`.
### Poznámka k architektuře
- Čistě frontend, žádný zásah do `kulturni_radar.gs` — data (kategorie, místo, `navstivenoDne`) i period-select už existovaly, stačila nová agregace. Kategorie/místo odráží AKTUÁLNÍ data akce (`apiEvents` je dohledává živě podle ID, OZNAČENÍ samo kategorii neukládá), ne stav v době návštěvy.
- Node testy 380 → 385 (+5 pro `spocitatStatistikuNavstivenych_`).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.52"`), ověřeno `?api=meta` → HTTP 200, `ok:true` (backend `VERZE` beze změny, 3.29 — měnil se jen Index.html).
- Součást spárované položky „Roční přehled + Doporučení podle historie" (BACKLOG.md) — Část 2 (Doporučení podle historie navštívených akcí) navazuje jako samostatná session.

## Backend v3.29 — Email zpracování návrhů: fronta EMAIL_TIPY, webhook, AI ověření webem — 20. 8. 2026
### Přidáno
- **A) Fronta EMAIL_TIPY + webhook příjem** — nový list `EMAIL_TIPY` (`ensureEmailTipySheet_`, vzniká automaticky při prvním tipu), nový endpoint `apiEmailTip_` v `routePost_` (`akce: 'email-tip'`). Autentizace přes VLASTNÍ sdílený token `EMAIL_WEBHOOK_TOKEN` (Script Property) — záměrně ne stejný jako `WEB_TOKEN` (jiná důvěryhodnostní hranice: únik webhook tokenu smí nanejvýš naplnit frontu textem k ověření, ne spustit přímé AI hledání). Endpoint jen zapisuje do fronty a hned odpovídá (žádné volání Anthropic API při příjmu mailu) — zpracování běží v denním rytmu, ne synchronně. Limit délky textu `EMAIL_TIP_TEXT_MAX = 5000` znaků.
- **B) AI ověření webem** — `callAnthropicEmailTip_` (jiný prompt než běžná kontrola: dostane syrový text tipu, má ho najít a ověřit na oficiálním zdroji přes web search; `events: []` je platný výsledek "nešlo ověřit", ne chyba). Retry smyčka `callAnthropic_` (pause_turn/end_turn/max_tokens, záchranné formátovací dovolání) vytažena do sdílené `volatAnthropicSTool_` beze změny chování, aby ji šlo použít i tady. `zpracovatEmailTipy_` zpracuje frontu: mapuje `obec` z ověřené akce na existující profil v LOKALITY (přesná shoda po normalizaci); bez shody se akce NEZAPISUJE do AKCE (řádek dostane stav `nelze-ověřit` s poznámkou k ruční kontrole) — vědomé rozhodnutí, raději nezapsat nespolehlivá data než riskovat matoucí výsledek, který by se stejně nikde nezobrazil. Úspěšně namapovaná akce se zapíše přes existující `upsertEvents_`/`zajistitSouradniceProAkce_`/`logKontrola_` (typ `'email-tip'`), takže dědí i automatickou invalidaci cache `apiEvents` — nová akce je v appce vidět hned po `dailyCheck`, ne až po vypršení 45s TTL. Časový rozpočet 2 minuty (dailyCheck pak ještě potřebuje čas na běžnou kontrolu v rámci 6min limitu Apps Scriptu).
- **C) Propojení do dailyCheck + denní report** — `zpracovatEmailTipy_` běží před `runCheck_('denní kontrola')`, výsledek se propaguje do `notifyOk_` (nový volitelný parametr `emailTipyStats`, zpětně kompatibilní pro ostatní typy běhů) jako nová sekce reportu: `E-mailové tipy: N přišlo (X zpracováno, Y nešlo ověřit, Z chyba)`.
- **Cloudflare Email Worker** (`cloudflare-worker/email-webhook.js` + `wrangler.toml` + `package.json` + `README.md` s krok-za-krokem návodem): nahrazuje dnešní dashboardové "forward" pravidlo pro `info@kulturniradar.cz` vlastním Worker skriptem, co pošle mail dál na Gmail **a navíc** jako webhook appce. Pořadí operací v `email()` handleru: `message.raw` se přečte a rozparsuje (přes `postal-mime`) PŘED voláním `message.forward()`, ne po něm — Cloudflare dokumentace nikde výslovně nepotvrzuje, že `raw` zůstává čitelný i po forwardu, takže se tomu tímhle pořadím appka záměrně vyhýbá (viz komentář v souboru). Forward vždy proběhne nezávisle na výsledku webhooku (vlastní try/catch + `ctx.waitUntil`, ať selhání appky nikdy neztratí mail). 7 vlastních testů (`node --test` v `cloudflare-worker/`, samostatné od hlavní sady), včetně tvrdé kontroly pořadí raw→forward na skutečném jednorázově čitelném `ReadableStream` mocku.
### Poznámka k architektuře
- Node testy 352 → 380 (+28: 10 pro `apiEmailTip_`/`ensureEmailTipySheet_`/routing, 5 pro `callAnthropicEmailTip_`, 2 pro `nazvyProfiluLokalit_`, 8 pro `zpracovatEmailTipy_`, 3 pro rozšíření `notifyOk_`) + 7 samostatných testů pro Cloudflare Worker.
- Bezpečnostní návrh webhooku i pořadí raw/forward ve Workeru byly explicitně ověřené a schválené předem (živá diskuze 20. 8. 2026), ne až po napsání kódu — obojí je jádro spolehlivosti celé funkce.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.29"`), ověřeno `?api=meta` → `"verze":"3.29"`.
- **AKTUALIZACE 20. 8. 2026 — Worker nasazen a ověřen naostro:** `wrangler login`/`secret put`/`deploy` provedeny (viz `cloudflare-worker/`), `EMAIL_WEBHOOK_TOKEN` nastavený na obou stranách, Email Routing pravidlo pro `info@kulturniradar.cz` přepnuto v Cloudflare dashboardu na "Send to a Worker". Ověřeno živým testovacím mailem: dorazil na Gmail beze změny a zároveň se propsal jako nový řádek do `EMAIL_TIPY`. Cestou opravena chyba ve `wrangler.toml` (`compatibility_date` bylo nastavené na datum v budoucnosti z pohledu Cloudflare API, opraveno na `2024-09-23`). Zpracování fronty (AI ověření webem + zápis do AKCE) proběhne až při příští `dailyCheck`.

## Index.html v3.51 — Oprava: folklorní podkategorie se nepletla do filtru jiných kategorií — 20. 8. 2026
### Opraveno
- **`dostupnePodkategorie_`** — akce s kombinací kategorií folklor+jiná (např. „Vavřinecké hody v Komíně", folklor+koncerty) nabízela svůj folklorní region (`folklorniRegion_`, backend v3.28) jako podkategorii-chip i pod filtrem té JINÉ kategorie (zjištěno živým ověřením na produkci 20. 8. 2026: zvolený chip „koncerty" nabízel „Slovácko/Podluží" jako podkategorii, ačkoli region s koncertem věcně nesouvisí). Oprava: akce s kategorií „folklor" mezi svými kategoriemi teď přispívá svou podkategorií do nabídky jen tehdy, když je „folklor" i mezi aktivně vybranými hlavními kategoriemi. Akce samotná se v seznamu pod jinou kategorií (zde koncerty) dál zobrazuje normálně beze změny — omezuje se jen nabídka podkategorie-chipů.
- 1 nový Node test (`dostupnePodkategorie_` – kombinovaná akce folklor+koncerty: podkategorie se neobjeví pod „koncerty", jen pod „folklor").
### Poznámka k architektuře
- `filtrovatPodkategorii_` beze změny — tam problém nebyl, filtrování podle už zvoleného chipu funguje správně i pro kombinované akce.
- Node testy 351 → 352 (+1).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.51"`), ověřeno `?api=meta` → HTTP 200 (backend `VERZE` beze změny, 3.28 — opravoval se jen Index.html).

## Backend v3.28 + Index.html v3.50 — Filtr žánrů/podkategorie — 20. 8. 2026
### Přidáno
- **Slovník podkategorií** (`PODKATEGORIE_SLOVNIK`) — 8 hlavních kategorií (koncerty, divadlo, festivaly, výstavy, historické slavnosti, vinařské/gastro kulturní akce, jarmarky, netradiční kulturní akce), každá s 3–5 podkategoriemi. Jediný zdroj pravdy pro `enum` v `REPORT_TOOL.podkategorie` i pro text instrukce v system promptu (`callAnthropic_`) — žádná ručně sync-ovaná druhá kopie.
- **AI teď dostává explicitní instrukci pro pole `podkategorie`** (dřív bylo v tool schématu, ale bez jakékoli instrukce v promptu → AI ho vyplňovala volným nekonzistentním textem, ověřeno na produkčních datech 20. 8. 2026: od jednoslovných tagů po výčty jmen kapel). `podkategorie` v `REPORT_TOOL` změněno ze `string` na `array` s `enum` (plochý seznam přes `vsechnyPodkategorie_()`).
- **`readEventsApi_` čte a validuje sloupec J** (`vypoctiPodkategorii_`) — hodnoty mimo schválený slovník (starý volný text z dob bez instrukce) se tiše zahodí, žádná migrace. `eventToRow_` spojuje nové pole podkategorií středníkem při zápisu (konzistentní s `kategorie`).
- **Folklor: speciální případ** — podkategorie se u kategorie „folklor" neurčuje přes AI (kulturně-geografický pojem), ale programově novou funkcí `folklorniRegion_(profil)` (Brno → Slovácko/Podluží, Zlín → Valašsko/Luhačovicko, Olomouc → Haná, jinak „jiný region"). AI folklor v promptu/enum vůbec nedostává, sloupec J se pro tyto akce ignoruje úplně — i u kombinace folklor + jiná kategorie (vědomé zjednodušení, AI stejně není pro kombinaci instruovaná).
- **Frontend: druhá úroveň chipů** (`#podkat-chips`) — viditelná jen po zvolení konkrétní hlavní kategorie v sidebaru, kombinovatelná s hlavní kategorií i ostatními filtry (mapa, kalendář, seznam). Žádný samostatný slovník na frontendu — `dostupnePodkategorie_` odvozuje nabídku chipů přímo z už načtených/validovaných dat (`a.podkategorie`), takže folklorní region funguje beze změny stejným mechanismem jako běžné podkategorie. Vlastní localStorage persistence (`radar_podkat_chipy:`) stejným vzorem jako hlavní kategorie, s automatickým prořezáním neplatných voleb při odškrtnutí hlavní kategorie.
- 21 nových Node testů (`folklorniRegion_`, `vypoctiPodkategorii_`, `eventToRow_` s polem podkategorií, `readEventsApi_` integrace, `dostupnePodkategorie_`, `filtrovatPodkategorii_`) + 1 nový RF test (zobrazení/skrytí druhé úrovně chipů podle hlavní kategorie).
### Poznámka k architektuře
- **Žádná migrace starých dat** — existující akce v AKCE mají sloupec J plný nekonzistentního volného textu; ten se při čtení prostě zahodí (mimo slovník), akce zůstanou bez podkategorie, dokud je nepřepíše příští AI kontrola s novým promptem.
- Zvažováno a zamítnuto: odeslání `PODKATEGORIE_SLOVNIK` přes `?api=meta` pro frontend (dřívější plán) — nahrazeno jednodušším odvozením z dat, viz výše. Frontend tak nemusí znát rozdíl mezi „běžnou" podkategorií a folklorním regionem vůbec.
- RF test pro druhou úroveň chipů záměrně neověřuje konkrétní počet/obsah podkategorie-chipů po výběru kategorie (produkční data je budou mít prázdné, dokud neproběhne re-kontrola) — jen strukturální chování (prázdný kontejner bez výběru hlavní kategorie, zase prázdný po návratu na „Vše").
- Node testy 328 → 351 (+23, z toho 2 pro `eventToRow_`).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.28"`, verze projektu 76), ověřeno `?api=meta` → `"verze":"3.28"`. Commit `9aab4fd`.

## Backend v3.27 — Haiku experiment pro denní kontrolu — 20. 8. 2026
### Přidáno
- **Podmíněný výběr modelu podle typu běhu** — nová konstanta `ANTHROPIC_MODEL_HAIKU = 'claude-haiku-4-5'` vedle `ANTHROPIC_MODEL` (`'claude-sonnet-4-6'`) a nová pure funkce `vyberModelProKontrolu_(typKontroly)`: `'denní kontrola'` (automatický ranní trigger, `dailyCheck`) → Haiku, všechno ostatní (mimořádné běhy z menu/webu, osobní hledání, sledovaná města, měsíční kontrola stálých míst) → beze změny na Sonnetu. Použito v `callAnthropic_` (hlavní požadavek i záchranné formátovací dovolání) a předáváno do `logKontrola_`, aby sloupec K v listu KONTROLY zaznamenal skutečně použitý model daného běhu, ne globální konstantu.
- 7 nových Node testů: `vyberModelProKontrolu_` (denní kontrola vs. ostatní typy), `callAnthropic_` posílá správný `model` v payloadu (nový stub zachytávající `options.payload`, ne jen URL), `logKontrola_` zapisuje předaný model do KONTROLY. Testovací harness (`MemSheet`) rozšířen o `getValue()`/`setValue()` (singulární varianty vedle existujících `getValues()`/`setValues()`) — `logKontrola_` je používá pro hlavičku sloupce „Vykonavatel", dřív to žádný test nepotřeboval.
### Poznámka k architektuře
- **Měření kvality běží 20.–27. 8. 2026** — po týdnu srovnat úlovky denní kontroly (Haiku) se zbytkem běhů (Sonnet) přes sloupec K v listu KONTROLY (nově obsahuje skutečný model, ne jen konstantu) a rozhodnout, jestli Haiku pro tenhle typ běhu trvale stačí. Termín rozhodnutí: 27. 8. 2026.
- `callAnthropicPlaces_` (měsíční kontrola stálých míst) se záměrně nemění — zůstává natvrdo na `ANTHROPIC_MODEL` (Sonnet), mimo rozsah experimentu.
- Node testy 321 → 328 (+7).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.27"`), ověřeno `?api=meta` → `"verze":"3.27"`.

## RF testy (bez bump verze) — Oblíbená místa: plný cyklus + filtr (I) — 19. 8. 2026
### Přidáno
- **I) `🏛 Oblíbené místo: lze označit i odznačit (obojí ověřeno reloadem)`** (`tests/robot/frontend.robot`) — stejný scénář jako u ★/✓, jen pro ikonu 🏛 (typ `misto`), reuse sdíleného keywordu `Ověřit plný cyklus označení (přidat i odebrat) s reloadem`. Defensive `Skip If` pro případ, že by první karta aktivního profilu neměla `a.misto`, `[Teardown]` vrací původní stav.
- **I) `Chip „Oblíbená místa" filtruje bez zápisu do tabulky`** — čistě klientský filtr test (stejný vzor jako „Chip Oblíbené"/„Chip Neověřeno"), bez mutace produkčních dat, bezpečný pro automatický běh v CI i bez přihlášení.
### Poznámka k architektuře
- RF-level test pro G (sync napříč VÍCE kartami se stejným místem) se záměrně nezavádí — dnešní scrapovaná data mají jen náhodný pár akcí se shodným místem (mění se denně), karty navíc nemají `data-misto` atribut pro spolehlivý výběr „druhé karty se stejným místem" v DOM. G zůstává pokryté Node testy pro `akceSeStejnymMistem_` (v3.49).
- RF `--dryrun` (syntax/keyword kontrola): 42 → 44 testů (33 → 35 ve frontend suitě, +2). Reálné spuštění necháno na CI, stejně jako ostatní RF testy dnes.
- Žádný bump verze appky (jen testy, žádná změna Index.html/kulturni_radar.gs).

## Index.html v3.49 — Oblíbená místa: sync stavu napříč kartami (G) — 19. 8. 2026
### Přidáno
- **G) `akceSeStejnymMistem_(vsechnaAkce, a)`** — nová pure funkce (stejný vzor jako H), najde všechny akce se stejným `misto`+`obec` (přes `klicMistoUkladani_`). Zapojena v `prepniOznaceniMista`: po úspěšné odpovědi backendu (`res.ok`) se `mistoOblibene` nastaví na VŠECH akcích se stejným místem, ne jen na té jedné, na které se kliklo — následné `prekreslit()` (ve `finally`) tak promítne správný vizuální stav ikony 🏛 na všechny karty se stejným místem i do `#mapa-mista`. 3 nové Node testy.
### Poznámka k architektuře
- Stav "ukládá se…" (`.ukladani`) byl už dřív synchronizovaný napříč kartami mimoděk — `probihaUkladani` je keyovaný podle místa (`klicMistoUkladani_`), ne podle ID akce jako u ★/✓, takže všechny karty se stejným místem tenhle indikátor sdílely od v3.26. G teď dorovnává i finální stav `.aktivni` po dokončení požadavku.
- Piny na mapě dnes nemají žádný vizuální indikátor `mistoOblibene` (na rozdíl od karet) — sync dat proběhne, ale není co na pinu zvýraznit. Přidání vizuálního rozlišení na pinech by byl samostatný rozsahový úkol, mimo dnešní G.
- Node testy 321 → 324 (+3: `akceSeStejnymMistem_`).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.49"`), ověřeno `?api=meta` → `"ok":true` (backend beze změny, nezávislé číslování Index.html vs. VERZE).

## Index.html v3.48 — Oblíbená místa: testovatelná část logiky ikony (H) — 19. 8. 2026
### Přidáno
- **H) `klicMistoUkladani_(a)`** — nová pure funkce, klíč do Setu `probihaUkladani` pro ikonu 🏛 (`misto|obec:misto`), dřív inline duplikovaný na dvou místech (render karty v `vytvorKartu` + `prepniOznaceniMista`) bez sdílení. Nasazena na obě místa, 3 nové Node testy.
### Poznámka k architektuře
- Prošetřeny i další kandidáti z E (ikona na kartě): podmínka zobrazení (`if (a.misto)`) a text/title tlačítka podle stavu jsou triviální inline ternary — extrakce by přidala jen umělou obálku bez přínosu, ponechány beze změny.
- Zbytek E logiky (DOM vytváření, event listener, `google.script.run` volání v `prepniOznaceniMista`) zůstává netestovatelný čistě v Node bez DOM mocku, stejně jako u ★/✓ — pokrytí patří RF (viz BACKLOG.md, položka I).
- Node testy 318 → 321 (+3: `klicMistoUkladani_`).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.48"`), ověřeno `?api=meta` → `"verze":"3.26"` (backend beze změny, nezávislé číslování Index.html vs. VERZE).

## Index.html v3.47 — Oblíbená místa: filtr chip (F) — 19. 8. 2026
### Přidáno
- **F) Nový chip `#chip-oblibena-mista` (🏛 Oblíbená místa)** v `#controls-oznaceni`, stejný vizuální vzor jako `chip-oblibene`/`chip-navstivene`/`chip-neoverene`. Na rozdíl od `rezimZobrazeni` (exkluzivní výběr mezi Vše/★/✓/❓) jde o nezávislý toggle (`filtrOblibenaMista`), kombinovatelný se všemi rezimy i s kategorie-filtrem — stejný vzor jako `aktKategorie`.
- **Nová pure funkce `filtrovatOblibenaMista_(akce, aktivni)`** — neaktivní = beze změny, aktivní = jen akce s `a.mistoOblibene === true` (pole z backend v3.26/`readEventsApi_`). Zapojena do `renderAkce` (pohled „Vše"), všech tří speciálních větví v `prekreslit()` (★/✓/❓), `vykreslitKalendar` a `akceProMapu_` (mapa) — piny i seznam míst pod mapou (`#mapa-mista`) sdílí stejná filtrovaná data přes `akceProMapu_`, takže se aktualizují automaticky, beze změny `sestavSeznamMist_`.
- `akceProMapu_` rozšířena o volitelný 4. parametr (`aktivniOblibenaMista`) — chybějící argument = beze změny chování, staré volání/testy dál fungují.
### Poznámka k architektuře
- Zadání dnešního promptu předpokládalo, že `jeViditelnaVSeznamu_` implementuje filtrování podle ★/✓/❓ chipů — ve skutečnosti ta funkce jen vylučuje proběhlé a budoucí neověřené-bez-URL akce (sdíleno mezi „Vše"/kalendářem/mapou); skutečná ★/✓/❓ logika je v samostatných větvích `prekreslit()`. Nový filtr byl proto zapojen přímo tam a ve všech čtyřech pipeline (Vše, ★, ✓, ❓), ne jen v `jeViditelnaVSeznamu_`.
- Záměrně mimo dnešní rozsah (viz BACKLOG.md): **G** sync ikony 🏛 napříč kartami/`#mapa-mista`/piny při kliknutí (známé omezení, stejné jako u ★/✓), **H/I** Node testy pro E (ikona na kartě) a RF test plného cyklu.
- Node testy 312 → 318 (+6: `filtrovatOblibenaMista_` 3×, `akceProMapu_` nový 4. parametr 3×).
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.47"`), ověřeno `?api=meta` → `"verze":"3.26"` (backend beze změny, nezávislé číslování Index.html vs. VERZE).

## Backend v3.26 + Index.html v3.46 — Oblíbená místa: základ (backend + ikona na kartě) — 19. 8. 2026
### Přidáno
- **A) `apiToggleMisto_`/`apiToggleMisto`** — nová funkce pro přepnutí „oblíbené MÍSTO" (ne jednotlivou akci) PRO PŘIHLÁŠENÝ profil. Na rozdíl od `apiToggle_` nebere ID akce (místo nemá jedno konkrétní ID akce) — identita místa se odvozuje přímo z `misto`+`obec` přes existující `klicSouradnic_` (stejný normalizovaný `misto|obec` klíč, který `readEventsApi_` už dnes používá pro lookup do SOUŘADNICE). Klíč se ukládá do sloupce „ID akce" v OZNAČENÍ (přepoužití sloupce u typu `oblibene_misto`); sloupec „Místo" dostává stejnou hodnotu jako „Název" (ne prázdno) — u tohoto typu pole „Místo konání" ztrácí původní význam, prázdná buňka by v Sheetu vypadala jako chybějící data. Zaroutováno v `routePost_` (`akce: 'toggle-misto'`), stejný toggle mechanismus (přidá/smaže řádek) jako `toggleOznaceni_`.
- **B) `oblibenaMistaSety_(rows)`** — nová pure funkce analogická `oznaceniMapy_`: pole řádků OZNAČENÍ (jednoho uživatele) → `Set` klíčů míst označených `oblibene_misto`. Node testy stejným stylem jako `oznaceniMapy_`/`toggleOznaceni_`, včetně plného cyklu přidání+odebrání přes `fakeSpreadsheet`.
- **C) `readEventsApi_` rozšíření** — každá akce v `apiEvents` teď nese nové pole `mistoOblibene: boolean`, lookup přes stejný `klicSouradnic_(row[5], row[6])`, co se už dnes počítá pro SOUŘADNICE. `oblibene`/`navstivenoDne` beze změny.
- **D) Wrapper `apiToggleMisto`** pro `google.script.run`, + routing v `sestavFetchPozadavek_` (Index.html) pro statický frontend mimo Apps Script (kulturniradar.cz), stejný vzor jako `apiToggle`.
- **E) Ikona 🏛 na kartě akce** — nové tlačítko v `karta-top-vpravo` vedle ★/✓, jen u akcí se známým místem. Klik volá `prepniOznaceniMista(a)` (optimistická odezva stejným vzorem jako `prepniOznaceni`), barevný stav `.ikona-oznaceni.aktivni.misto` (modrá, odlišná od zlaté ★ a zelené ✓).
### Poznámka k architektuře
- Backend `VERZE` (3.25 → 3.26) a `Index.html` verze (3.45 → 3.46) se dnes mění spolu — první backend změna po delší době, kdy se měnil jen frontend (poslední backend bump byl v3.25, 10. 8.).
- Záměrně mimo dnešní rozsah (viz BACKLOG.md, navazující položka): **F** filtr chip pro oblíbená místa, **G** sync stavu napříč `#mapa-mista`/piny na mapě (dnes se aktualizuje jen konkrétní karta, ne ostatní karty/seznam se stejným místem), **H/I** Node testy pro E a RF test plného cyklu.
- Node testy 308 → 312 (+4: `oblibenaMistaSety_` typová filtrace a prázdné pole, `apiToggleMisto_` validace vstupu a plný cyklus přes `fakeSpreadsheet`). E (DOM) netestováno mimo prohlížeč, stejně jako ostatní ikony ★/✓.
- Nasazeno přes clasp (`clasp push -f` + `clasp deploy -i … --description "v3.26"`), ověřeno `?api=meta` → `"verze":"3.26"`.

## Diagnostika (bez bump verze) — Uzavření zjištění k výkonu — 19. 8. 2026
### Zjištěno
- Ruční ověření přes claude-in-chrome na produkci (kulturniradar.cz): `api=meta` 2409 ms, `api=events` (Brno, 15 kB, cachovaná) 2858 ms, opakovaně 1397–2040 ms, `api=places` 1617 ms.
- Anomálie z 17.–18. 8. (4,3–6,5 s, jednou HTTP 404) odezněla — potvrzena hypotéza „dočasná zátěž z opakovaných nasazení" (viz BACKLOG.md, položka „Testovací dluh"). Zbylá ~1,4–2,9 s/request odpovídá základní režii Apps Script platformy (i cachovaná data z `CacheService` trvají podobně) — není to regrese ani něco jednoduše zoptimalizovatelného v našem kódu.
- Jediná reálná páka zjištěná měřením: appka při startu dělá 3 requesty (`meta`+`events`+`places`), což drží uživatele na „Načítám…" ~3–5 s celkem — případná budoucí optimalizace by cílila na počet/paralelizaci startovních requestů, ne na backend logiku.
- Rozhodnutí: automatizovaný výkonnostní test se nezavádí (viz BACKLOG.md) — přirozená variabilita (±50 %) baseline by u pevného prahu spíš generovala falešné poplachy.

## Index.html v3.45 — Statistika, mini předpověď počasí a reset výběru pod mapou — 18. 8. 2026
### Přidáno
- **O) Mini statistika aktuálního výběru** — nová sekce `#mapa-statistika` pod seznamem míst, jen desktop. Nová pure funkce `spocitejStatistikuVyberu_(akce)` → `{pocetAkci, pocetMist, pocetKategorii}` ze stejných dat, co dostává `#mapa-mista` (`akceProMapu_` výstup); počet míst sdílí klíč (`klicSouradnic_`) se `sestavSeznamMist_`/`seskupitPodleSouradnic_`, počet kategorií = unikátní hodnoty napříč poli `kategorie` všech akcí. Mřížka 3 čísel, terakotová paleta (`var(--accent)` na číslech).
- **P) Mini předpověď počasí pro výběr (Cesta A)** — nová sekce `#mapa-pocasi` pod O), jen desktop. Frontend volá **Open-Meteo přímo** (`fetch`, 3 dny, souřadnice první akce z aktuálního výběru — žádný geocoding, souřadnice už máme z akce), **bez nového backend endpointu** a bez `CacheService` — cache jen v paměti běhu stránky (`cachePocasiVyberu_`, klíčovaná přes `klicSouradnic_`, nefetchuje znovu při stejné poloze). Ikony/text sdílené s existující per-kartou logikou (`weathercodeEmoji_`/`pocasiZobrazeni_`) — vizuálně konzistentní s kartami, ne vlastní systém. Žádná akce se souřadnicemi ve výběru, nebo chyba fetch (síť/API nedostupné) → blok zůstane tiše prázdný, appka nespadne. `title`/`aria-label` vysvětlují, že jde o orientační předpověď pro přibližnou polohu výběru, ne přesné město.
  - Dedup souběžných fetchů řešen přes `Set` (`fetchPocasiVyberuProbihaKlice_`), ne jednu proměnnou — objevená a opravená hraniční situace: rychlé přepnutí výběru A → B → zpět na A dřív, než doběhne fetch A, mohlo se sdílenou proměnnou vést ke zbytečným duplicitním fetchům (ne k zobrazení špatného počasí — to už hlídala kontrola `cachePocasiVyberu_.klic !== klic` v render funkci).
- **Q) Tlačítko „Zobrazit vše na mapě"** — reset výběru pinů, viditelné jen když `vybranePiny_.size > 0` (kombinace media query pro desktop + třída `.viditelne`). Nová pure funkce `vycistitVyberPinu_(sada)` (`sada.clear()`, konzistentní se stylem `prepnoutVyberPinu_`). Klik vyprázdní výběr, sesynchronizuje `.vybrano` na všech titulcích karet a překreslí mapu (stejný vzor jako `vybratPin_`, jen hromadně).
### Poznámka k architektuře
- P běží záměrně **Cestou A** (frontend → Open-Meteo přímo) místo nového backend endpointu — menší zásah, konzistentní s tím, jak appka už dnes stahuje Leaflet dlaždice přímo z prohlížeče. Pokud by se ukázalo, že to zatěžuje Open-Meteo rate limit nebo je pomalé, zvážit migraci na Cestu B (nový `apiPocasiMesto` endpoint s `CacheService`) — viz BACKLOG.md.
- Node testy 301 → 308 (+7: `spocitejStatistikuVyberu_` 5×, `vycistitVyberPinu_` 2×). P nemá nové pure funkce k testování (reuse `weathercodeEmoji_`/`pocasiZobrazeni_`, zbytek je DOM+fetch, ověřeno ručně).

## Index.html v3.43 — Legenda seznamu míst, RF testy pro redesign (smoke + interakce) — 18. 8. 2026
### Přidáno
- **L) Legenda s miniaturou pinu u seznamu míst (`#mapa-mista`)** — každý řádek má před názvem malou CSS značku (kapka, `border-radius: 50% 50% 50% 0` + rotace, barva přibližně odpovídá výchozímu modrému Leaflet markeru), u vybraného řádku (`.vybrano`) se mění na kruh ve stejném odstínu jako `.pin-vybrany` na mapě — dva stavy jedné miniatury místo textu navíc. Řádek dostal `title="Klikněte pro zobrazení na mapě"`. `vykreslitSeznamMist_` teď staví `.mapa-misto-leva` wrapper (miniatura + název) místo přímého `nazev` span — nutné, protože `justify-content: space-between` na řádku by s třetí položkou rozházelo rozložení „název vlevo, počet vpravo".
- **M) RF smoke testy redesignu** (`tests/robot/frontend.robot`) — nová sekce s 5 testy: stránka bez JS chyby v konzoli (`Get Page Errors` + `Get Console Log` filtr `type=error`); kalendář/mapa toggle na mobilním viewportu (nová keyword `Otevřít radar na mobilním viewportu`, `New Context` 375×800, protože `#kalendar-toggle`/`#mapa-toggle` jsou na desktopu `display:none`); mapa se vykreslí (`.leaflet-container`); seznam míst obsahuje řádky, podmíněně na existenci pinů (stejný vzor jako existující „Sekce stálých míst").
- **N) RF testy klíčových interakcí** — klik na titulek karty (`.nazev-klikatelna`) i na řádek `#mapa-mista` přepne výběr pinu (`.pin-vybrany` na mapě, `.vybrano` na titulku/řádku), druhý klik zruší výběr (`detached`); header + `#controls-oznaceni` zůstávají na stejné Y pozici po scrollu (`Get BoundingBox key=y` před/po `Scroll By`) — bez testu přesného K zarovnání (viz nová BACKLOG položka).
### Poznámky k implementaci
- `Close Context` v Browser library po dokumentaci obnoví kontext aktivní před ním — mobilní testy tak po `[Teardown] Close Context CURRENT` automaticky vrátí desktopový kontext ze Suite Setup, bez ruční správy ID.
- `Wait For Elements State` (Browser library) nepodporuje pojmenovaný argument `msg=` (past ze SKILL.md, sekce 2) — odhaleno `--dryrun` kontrolou před spuštěním, opraveno přesunem vysvětlení do komentářů.
- Node testy beze změny (301/301) — L je čistě vizuální. RF: `--dryrun` (syntax/keyword kontrola) 33/33 (25 → 33, +8 nových). Reálné spuštění nechané na CI (lokálně chybí `RF_TEST_USER_ID`/`PIN` i nainstalované Playwright prohlížeče).

## Index.html v3.42 — Sticky header a filtry, mapa až k pravému okraji na širokých obrazovkách — 18. 8. 2026
### Přidáno
- **H) Horní tmavá lišta (`<header>`) sticky** — `position: sticky; top: 0;`, `z-index: 60`, jemný `box-shadow` na spodní hraně pro vizuální oddělení od obsahu, co se pod ní posouvá při scrollu. Neprůhledné pozadí (`var(--ink)`) beze změny.
- **I) Druhá lišta (`#controls` + `#controls-oznaceni`) sticky, navazuje hned pod headerem** — obě `position: sticky`, naskládané bez mezery (`top: var(--h-header)` a `top: calc(var(--h-header) + var(--h-controls))`), `z-index` 59/58 (pod headerem, nad běžným obsahem karet). Stín na spodní hraně `#controls-oznaceni` (poslední ve stacku).
- **J) CSS proměnné pro výšky sticky prvků** — nové `--h-header`/`--h-controls`/`--h-oznaceni` na `:root` (fallbacky 58/55/45px), nová funkce `aktualizovatStickyOffsety_()` měří skutečné `offsetHeight` header/`#controls`/`#controls-oznaceni` a zapisuje je jako CSS custom properties, volaná jednou při startu a znovu na `resize` (debounced, `setTimeout 150ms`). `#kat-sidebar` a `#mapa-panel` (`≥1360px`, dřív `top: 16px` napevno) teď navazují pod celý stack přes `calc(...)`. Soubor nepoužívá `DOMContentLoaded` (`<script>` je fyzicky až za veškerým HTML, běží přímo) — nová funkce se volá stejným stylem jako existující `init()`, ne přes vlastní event listener navíc.
### Změněno
- **K) Mapa (`≥1360px`) až k pravému okraji** — `#layout` dostal na tomto (nejširším) pásmu `max-width: none` (přebíjí `2400px` strop z obecného `≥900px` pravidla, jen zde) a `padding-right: 0` (`padding-left` 24px zachován, stejný princip jako u sidebaru vlevo od v3.36). `#mapa-panel` dostal `padding-right: 20px` (dřív 0), ať pravý okraj mapy (a nového seznamu míst `#mapa-mista`, v3.41) skončí na identické souřadnici jako pravý okraj obsahu `#controls-oznaceni` (to má taky `padding-right: 20px`) — bez tohohle doladění by mapa končila o 20px dál (přesně na okraji okna), zatímco lišta s chipy 20px před ním.
- Node testy beze změny (301/301) — `aktualizovatStickyOffsety_` čte DOM rozměry (`offsetHeight`), není pure, netestovatelné mimo prohlížeč; ověřeno ručně.

## Index.html v3.41 — Výběr pinů na mapě (dlaždice + seznam míst), vyšší strop mapy — 18. 8. 2026
### Přidáno
- **D) Sdílený mechanismus „vybrané piny"** — modulový `vybranePiny_` (Set klíčů souřadnic), nová pure funkce `prepnoutVyberPinu_(sada, klic)` (toggle, Set jako explicitní parametr kvůli izolované testovatelnosti přes frontend-harness). Nová sdílená pure `klicSouradnic_(lat, lng)` (refaktor z `seskupitPodleSouradnic_`, teď i vrací `klic` na skupině), ať tři místa (piny, titulek karty, seznam míst) počítají identický klíč. Vybraný pin dostane vlastní Leaflet `divIcon` (`.pin-vybrany`, tmavý puntík) — záměrně jiná barva než terakotový pulz `.karta.zvyrazneno` (sdílený odkaz `?akce=ID`), ať se dva různé signály nepletou. Sdílený orchestrátor `vybratPin_(klic)`: toggle → překreslí piny i seznam míst → sesynchronizuje `.vybrano` na titulcích karet se stejným klíčem → při PŘIDÁNÍ do výběru `flyTo` na dané místo (zoom min. 15, nezmenšuje už bližší přiblížení).
- **E) Klik na titulek karty** — `vytvorKartu` přidá klikací handler jen na `.nazev` (ne na celou kartu, ať nekoliduje s tlačítky Více info/Do kalendáře/Mapa/Sdílet/★/✓), jen u akcí s platnými souřadnicemi. Vizuální feedback `.nazev.vybrano` (podtržení + tmavé pozadí).
- **F) Seznam míst pod mapou** — nová sekce `#mapa-mista` v `#mapa-panel`, viditelná jen na desktopu (`≥900px`). Nová pure funkce `sestavSeznamMist_(akce)` → `[{klic, nazev, pocet}]`, seřazeno sestupně podle počtu akcí (chybějící `a.misto` → „Neznámé místo"). `vykreslitSeznamMist_()` vykresluje řádky (klikatelné, volají `vybratPin_`), volané automaticky z `vykreslitMapu()`, ať je seznam vždy v sync s piny.
### Změněno
- **G) Výškový strop mapy zvýšen** (`≥1360px`) — `clamp(480px, 45vh, 650px)` → `clamp(480px, 50vh, 850px)`, ať zbývá míň nevyužitého prostoru pod mapou na vysokých monitorech.
- Node testy 292 → 301 (+9: `prepnoutVyberPinu_` – select/deselect/opakovaný toggle/nedotčené ostatní klíče; `sestavSeznamMist_` – seskupení, řazení sestupně, chybějící `misto`, prázdný vstup; `seskupitPodleSouradnic_` – klíč skupiny odpovídá `klicSouradnic_`). Leaflet-závislé vykreslování (barva pinu, `flyTo`) a media queries netestovatelné mimo prohlížeč, ověřeno ručně.

## Index.html v3.40 — Fáze 3 doladění po živé kontrole: tooltip, popup mapy, sbalitelná mapa na mobilu — 18. 8. 2026
### Opraveno
- **A) Tooltip kalendáře přesahoval mimo sidebar** — `#kalendar-tooltip` (v3.38/v3.39) se pozicoval jen podle buňky dne, takže na užších sidebarech mohl přesáhnout do mřížky karet vpravo. Nová čistá funkce `vypocitejPoziciTooltipuKalendare_` oklampuje `left` přes `Math.min`/`Math.max` podle `#kat-sidebar.getBoundingClientRect()` (konstanta `SIRKA_TOOLTIP_KALENDARE_ = 240`, musí odpovídat CSS `max-width`) — tooltip se při přetečení zarovná k pravému okraji sidebaru místo přesahu, a nikdy nejde ani pod jeho levý okraj.
- **B) Popup na mapě se ořezával při zoomu/posunu** — `#mapa` má `overflow: hidden` (zaoblené rohy); otevřený Leaflet popup, který uživatel po otevření odzoomoval/posunul blízko okraje kontejneru, se oříznul. `inicializovatMapu_()` teď na `movestart zoomstart` zavře libovolný otevřený popup hned na začátku gesta; po dokončení jde otevřít znovu (Leaflet `autoPan` zajistí, že nový popup je vždy celý v kontejneru).
### Změněno
- **C) Mapa na mobilu (`<900px`) teď sbalitelná stejně jako kalendář** — dřív vždy viditelná, teď výchozí stav zavřeno, vlastní tlačítko `#mapa-toggle` (🗺️) v hlavičce vedle `#kalendar-toggle`, otevírání nezávislé na kalendáři (vlastní třída `otevreno` na `#mapa-panel`). Na `≥900px` beze změny — mapa trvale viditelná, toggle tlačítko skryté (zrcadlí existující chování `#kalendar-panel`/`#kalendar-toggle`). Listener navíc volá `mapaLeaflet.invalidateSize()` (přes `setTimeout 0` kvůli reflow) při každém otevření — Leaflet měří kontejner při inicializaci, kdy byl na mobilu ještě `display: none`, bez toho by po otevření zůstaly špatně spočítané rozměry dlaždic.
- Node testy 289 → 292 (+3 pro `vypocitejPoziciTooltipuKalendare_`). B a C nejdou testovat mimo prohlížeč (Leaflet, media queries) — jen A má pokrytí.

## Index.html v3.39 — Fix: tooltip v kalendáři překrytý Leaflet mapou — 18. 8. 2026
### Opraveno
- `#kalendar-tooltip` (v3.38) měl `z-index: 150`, což bylo pod interními "panes" Leafletu (marker/popup pane, z-index až ~700, generováno JS knihovnou, mimo naše CSS) — na produkci se tooltip při setkání kalendáře a mapy v layoutu schoval pod mapu. Zvýšeno na `z-index: 1000`.
- Node testy beze změny (289/289) — jen CSS.

## Index.html v3.38 — Fáze 3 doplněk: tooltip v kalendáři + seskupené piny — 18. 8. 2026
### Přidáno
- **Tooltip v kalendáři** — najetí myší (desktop hover) na den s tečkou zobrazí jména všech akcí toho dne, jeden název na řádek. Mobil beze změny (žádný hover, klik dál jen odscrolluje na seznam). Sdílený `#kalendar-tooltip` element s `position: fixed`, přepočítanou z `getBoundingClientRect()` konkrétní buňky — ne native `title` atribut (potřeba víc řádků a kontrola vzhledu).
- Nová čistá funkce `akceDnePodleData_` (Mapa ISO den → pole názvů viditelných akcí toho dne); `dnySAkcemi_` z ní teď odvozená (`new Set(...keys())`) místo paralelní implementace — stejný kontrakt, jeden zdroj pravdy.
- **Seskupené piny na mapě** — akce se souřadnicemi zaokrouhlenými na 5 desetinných míst (~1m přesnost) na stejnou hodnotu dostanou jeden pin místo překryvu. Popup takového pinu vypíše všechny akce na místě, každou s vlastním tlačítkem „Zobrazit v seznamu" (volá existující `zvyraznitAkci_`). Nová čistá funkce `seskupitPodleSouradnic_`, volaná až po `akceProMapu_` (skupinuje už vyfiltrovaná data). `sestavPopupMapy_` sjednocena ze signatury `(a)` na `(akce)` — funguje jednotně pro 1 i víc akcí na místě.
- Node testy 277 → 289 (+12: `akceDnePodleData_` — víc akcí stejný den, proběhlé/neověřené vyloučené, nevalidní datum; `seskupitPodleSouradnic_` — identické souřadnice, rozdíl na 4. vs. jen za 5. desetinným místem, prázdné vstupy).

## Index.html v3.37 — Fáze 3 doladění: mapa podle šířky i výšky okna — 17. 8. 2026
### Přidáno
- Mapa na širokém desktopu roste s velikostí okna v obou rozměrech: šířka `clamp(280px, 30vw, 800px)` (dřív `clamp(280px, 25vw, 600px)`), výška `clamp(480px, 45vh, 650px)` (dřív pevných 480px) — využívá volný prostor kolem sebe místo pevné velikosti.
- Hranice širokého pásma posunuta z `1280px` na `1360px` — při 30vw by na 1280px dala mapa 384px a main by klesl na 600px, pod 656px potřebných pro 2 sloupce (cliff, stejný typ problému jako při zavádění 1280px v předchozí verzi). Na 1360px vychází main přesně na 656px, kontinuita s úzkým pásmem (900–1359px, tam beze změny) zachována — ověřeno přepočtem pro 1359/1360/1600/1920/2560px, žádný skok v počtu sloupců.
- Floor výšky zvednut z původně navrhovaných 400px na **480px** — na nízkých oknech (typicky notebooky, výška okna prohlížeče 700–900px po odečtení lišt) by 45vh s floorem 400px dalo mapu menší než dřívější pevná hodnota, což by bylo proti smyslu zadání „zvětšit mapu"; s floorem 480px se mapa nikdy nezmenší oproti v3.36.
- Node testy beze změny (277/277) — jen CSS.

## Index.html v3.36 — Fáze 3 doladění: layout u levého okraje, větší mapa — 17. 8. 2026
### Opraveno/Přidáno
- `#layout` na `≥900px` ztratil `max-width: 1600px` + `margin: 0 auto` (centrování) — sidebar teď začíná blízko levého okraje místo symetrické prázdné mezery po stranách. Nová pojistka `max-width: 2400px` jen proti běhu mřížky do extrému na 4K+/ultrawide monitorech (bez ní by šlo až na 7 tenkých sloupců); pod touto šířkou strop vůbec nezasahuje.
- Mapa dostala flexibilní šířku `clamp(280px, 25vw, 600px)` (dřív pevných 280px) a výšku `480px` na širokém desktopu (dřív 350px; mobil zůstává na 350px).
- **Tři layoutová pásma místo dvou**, aby nikde nevznikl skokový propad počtu sloupců mřížky karet oproti stavu bez mapy: `<900px` mobil beze změny (mapa nad seznamem); `900–1279px` úzký desktop — sidebar+seznam vedle sebe (2 sloupce), mapa POD nimi na celou šířku (`flex-basis: 100%` + `flex-wrap: wrap` na `#layout`); `≥1280px` široký desktop — dnešní návrh, mapa jako trvalý 3. sloupec vpravo (`position: sticky`).
- V úzkém pásmu (900–1279px) main navíc omezen na `max-width: 656px` (přesně 2 sloupce) — bez stropu by kolem 1264px main sám naskočil na 3 sloupce a hned na hranici 1280px zase spadl zpět na 2, protože v širokém pásmu mapa vedle mřížky ukrajuje místo. Strop drží počet sloupců plynulý přes celý přechod.
- Hranice širokého pásma zvolena na `1280px`, ne `1200px` — při 1200px by `25vw` dalo mapě jen 300px a main by klesl pod 656px potřebných pro 2 sloupce (propad by trval až do ~1290px). Při 1280px dá `25vw` už 320px, main vychází přesně na 664px — 2 sloupce se vejdou hned na hranici, žádný skok.
- Ověřeno přepočtem pro 7 referenčních šířek (900/1100/1279/1280/1600/1920/2400px) — žádný cliff v počtu sloupců napříč celým rozsahem.
- Node testy beze změny (277/277) — jen CSS.

## Index.html v3.35 — Redesign fáze 3: vestavěná mapa + oprava fázování kalendáře — 17. 8. 2026
### Přidáno
- **Vestavěná mapa** (fáze 3 ze 3 většího redesignu, dokončení) — Leaflet 1.9.4 přes unpkg + dlaždice OpenStreetMap (bez API klíče), první externí JS závislost appky. Piny z existujících `lat`/`lng` polí v `apiEvents` (v3.14) — žádné nové geokódování, žádná změna backendu.
- Piny respektují stejnou množinu akcí jako seznam „Vše" (bez proběhlých, bez neověřených-bez-URL v budoucnu) i aktivní kategorie-filtr — přes novou čistou funkci `akceProMapu_`.
- Klik na pin → popup se jménem akce (stavěný přes DOM API, ne HTML string — `a.nazev` pochází z AI extrakce webového obsahu, takže sestavení jako raw HTML by bylo XSS riziko) + tlačítko „Zobrazit v seznamu", které využívá existující `zvyraznitAkci_()` (scroll + zvýraznění karty, dřív jen pro sdílené odkazy) — žádný nový `id` atribut na kartách nebyl potřeba.
- Umístění: `≥900px` trvalý 3. sloupec vpravo v `#layout` (280px, `position: sticky`) přes CSS `order` (v DOM je mapa mezi sidebarem a `#main`, aby na mobilu vyšla v přirozeném pořadí nad seznamem); na mobilu vždy viditelná (na rozdíl od kalendáře se neskládá), pevná výška 350px na obou breakpointech. Existující odkaz „📍 Mapa" na kartě (`mapsUrl_`, externí Google Maps pro 1 akci) beze změny — nesouvisí.
- **Oprava fázování kalendáře** (doplnění fáze 2): tečky v kalendáři dřív vždy ukazovaly všechny akce bez ohledu na aktivní kategorie-chip. Teď respektují stejný kategorie-filtr jako seznam — `vykreslitKalendar()` filtruje přes `filtrovatKategorii_()` před voláním `dnySAkcemi_` (ta zůstala beze změny signatury/chování). `vykreslitKalendar()`/`vykreslitMapu()` sjednoceny do centrálního `prekreslit()` místo roztroušených volání.
- Drobný refaktor: nová sdílená čistá funkce `jeViditelnaVSeznamu_` (dřív inline v `renderAkce`/`dnySAkcemi_`) — jeden zdroj pravdy pro „co je vidět v seznamu Vše" mezi `renderAkce`, `dnySAkcemi_` a `akceProMapu_`.
- Node testy 264 → 277 (+13 pro `jeViditelnaVSeznamu_`, `filtrovatKategorii_`, `akceProMapu_`) — nejdřív ověřeno, že refaktor nerozbil žádný z existujících testů.
- **Fáze 3 ze 3 — redesign UI dokončen.**

## Index.html v3.34 — Fix: mřížka karet na velmi širokých monitorech — 17. 8. 2026
### Opraveno
- Na monitorech 2500px+ zůstávala mřížka karet na 2 sloupcích, i když `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` měl prostor na víc. Příčina: `#layout` (fáze 1, `Index.html`) měl pevný `max-width: 1400px` — nad touto šířkou zůstal obsah vycentrovaný s prázdným prostorem po stranách bez ohledu na skutečnou šířku obrazovky.
- Základní strop zvýšen `1400px → 1600px`; nový breakpoint `@media (min-width: 1600px)` strop dál zvedá na `1900px` pro velmi široké monitory.
- Obě hodnoty okomentované jako **mezikrok před fází 3** — až přibude natrvalo mapa jako 3. panel v `#layout`, rozpočet šířky (sidebar/main-mřížka/mapa) se přepočítá znovu s ohledem na 3 sloupce, ne jen na dnešní sidebar+main.
- Node testy beze změny (264/264) — jen CSS.

## Index.html v3.32 + v3.33 — Redesign fáze 2: kalendářní pohled — 17. 8. 2026
### Přidáno
- **v3.32** doladění fáze 1 podle zpětné vazby rodiny (manželka): datumové/skupinové nadpisy (`.den-hlavicka`) výraznější — `font-size` `.72rem`→`.85rem`, `font-weight: 700` (dřív bez explicitní hodnoty), barva `var(--ink-3)`→`var(--ink)`, nová terakotová značka `border-left: 3px solid var(--accent)`. Sdíleno třemi typy nadpisů (datumové oddělovače, „Probíhá / dlouhodobé", nadpisy typu místa v „Stálých místech") — dopad na všechny tři vědomý a žádoucí kvůli konzistenci.
- **v3.33** kalendářní pohled (fáze 2 ze 3 většího redesignu, schváleno 17. 8. 2026): měsíční mřížka (Po–Ne) jako navigační pomůcka, ne filtr — klik na den s tečkou odscrolluje na odpovídající `.den-hlavicka` v existujícím seznamu, seznam se neschovává. Tečka „má akce" vychází ze stejné množiny akcí jako výchozí seznam „Vše" (bez `proběhlo`, bez neověřených-bez-URL v budoucnu) — nezávisí na kategorii-filtru; pokud aktivní kategorie-chip odfiltruje jediný cíl dne, klik tiše no-opne (vědomé rozhodnutí, ne bug).
- Umístění: na `≥900px` trvale pod kategoriemi v `#kat-sidebar`; na mobilu skládací panel (`#kalendar-panel`), výchozí zavřeno, otevírá `#kalendar-toggle` v hlavičce (ikona 📅 vedle „Kontakt").
- Nové čisté funkce (`isoDatum_`, `dnySAkcemi_`, `sestavKalendarMrizku_`) testované izolovaně přes `frontend-harness.js` — žádný přesah mřížky do sousedních měsíců (jen prázdné buňky před 1. dnem), bez expanze vícedenních akcí (tečka jen na `datumOd`).
- Node testy 251 → 264 (+13: reálné dny v týdnu ověřené přes `Date.getDay()`, ne odhadem; filtrační shoda `dnySAkcemi_` se seznamem „Vše"; dedup; edge-case minulost/budoucnost u neověřených bez URL).
- Fáze 2 ze 3. Zbývá fáze 3 — vestavěná mapa.

## Index.html v3.31 — Redesign fáze 1: barvy + responzivní layout — 17. 8. 2026
### Přidáno
- Nová barevná paleta (schváleno 17. 8. 2026, Vojta + Claude, bez dcery — záložní plán místo designového večera): `--accent` terakotová `#d85a30` (bylo `#c0392b`, „červená jako divadelní opona"), `--paper` krémová `#faf8f5` (bylo `#f7f6f2`), `--accent-2` jemná terakotová `#faece7` (bylo `#e8d5b0` pergamen) — kategorie na kartě (`.kat-badge`) teď jemný štítek místo solid pergamenové výplně, text `#993c1d` pro čitelnost. Navazující doladění: `.chip.active/:hover` border-color přepnut z pevného `#c8a870` na `var(--accent)`, ať sedí k nové paletě.
- Responzivní breakpoint `900px`: pod hranicí beze změny (kategorie-chipy nad seznamem, jednosloupcový seznam karet). Nad hranicí se kategorie-chipy strukturálně přesunou z `#controls` do nového `<aside id="kat-sidebar">` (sticky, vlevo), `#main` přepne na CSS grid (`auto-fill, minmax(320px,1fr)`) — vícesloupcová mřížka karet. Nový obalový `<div id="layout">` kolem sidebaru a `#main`; všechna ID zůstala stejná, JS ani RF selektory (`#kat-chips .chip`) se neměnily.
- Header (tmavě navy, bílý text) vědomě beze změny — „divadelnost" appky byla hlavně v červeném akcentu a pergamenové výplni, ne v tmavé hlavičce; zjemnění zváženo v pozdější iteraci, až bude zbytek palety vidět naživo.
- Node testy beze změny (251/251) — jen HTML/CSS, žádná JS funkce se nezměnila.
- Fáze 1 ze 3 většího redesignu UI. Kalendářní pohled (fáze 2) a vestavěná mapa (fáze 3) budou navazovat samostatně.

## v3.25 (backend) + Index.html v3.30 — Kontaktní formulář: e-mail pro odpověď — 10. 8. 2026
### Přidáno
- Nové nepovinné pole **„E-mail pro odpověď"** v kontaktním formuláři, mezi Jménem a Zprávou. Důvod: naostro ověřeno, že `MailApp.sendEmail()` odesílá jako vlastní Google účet provozovatele, takže bez tohoto pole nešlo poznat, komu na tip/připomínku odpovědět.
- Backend `apiKontakt_` rozšířen o parametr `email` (bez validace formátu, jen trim) — pokud je vyplněný, jde do `MailApp.sendEmail(..., {replyTo: email})` a navíc do těla zprávy (`Email pro odpověď: ...`); bez vyplnění se `replyTo` vůbec nepředává (ne prázdný string) a v těle je „(neuveden)".
- Node testy 247 → 251 (+4: e-mail → replyTo i tělo, trim bílých znaků, bez e-mailu žádné `options`, formát se nevaliduje). Cestou narazil na cross-realm past ze SKILL.md (`assert.deepEqual` na objektu z vm sandboxu padá i při shodném obsahu) — opraveno porovnáním jednotlivé vlastnosti (`mail.options.replyTo`).

## v3.24 (backend) + Index.html v3.29 — Kontaktní formulář — 10. 8. 2026
### Přidáno
- Tlačítko **„Kontakt"** (bez emoji) vedle profilového badge — otevře modální formulář (jméno nepovinné, předvyplní se z přihlášeného profilu; zpráva povinná, limit 2000 znaků). Dostupné i bez přihlášení, žádný PIN.
- Backend `apiKontakt_(jmeno, zprava, uzivatelId)` napojený do `routePost_` (`akce: 'kontakt'`) stejným vzorem jako `apiToggle` — funguje tedy shodně přes `google.script.run` i přes POST na statické doméně. Odesílá e-mail přes `MailApp.sendEmail()` na `info@kulturniradar.cz`; předmět nese jméno odesílatele (`'[Kulturní radar] Zpráva od ' + jméno/'anonym'`), tělo navíc uživatelský profil a časovou značku.
- Jednoduchý globální cooldown (30 s, `KONTAKT_COOLDOWN_MS`) proti spamu — stejný duch jako `WEB_COOLDOWN_MS`. Protože je cooldown globální (ne per-uživatel), hláška při zablokování výslovně upozorňuje, že poslední zprávu mohl odeslat kdokoli jiný z rodiny, ne nutně stejný člověk. Cooldown se nastaví až po úspěšném odeslání, ať neúspěšný pokus (výpadek MailApp) neblokuje opakování.
- Patička appky s krátkou zmínkou a `mailto:` odkazem na `info@kulturniradar.cz`.
- Node testy 240 → 247 (+7 pro `apiKontakt_`: prázdná/příliš dlouhá/přesně na limitu zpráva, OK případ, anonymní odeslání, cooldown, selhání MailApp bez nastavení cooldownu). Rozšířen `tests/harness.js` o stub `PropertiesService.setProperty` (dřív chyběl).

## CI: RF_TEST_USER_ID/PIN jako GitHub Secrets — 9. 8. 2026
### Opraveno
- `.github/workflows/rf-tests.yml`: krok „Frontend E2E" dostal `env:` blok s `RF_TEST_USER_ID`/`RF_TEST_PIN` ze secrets — stejný mechanismus, jaký `tests/robot/resources.robot` už dlouho čeká (`%{RF_TEST_USER_ID=}`, syntaxe pro proměnné prostředí). Potvrzeno přímo v GitHub Actions logu (ne odhadem): poslední úspěšný běh před opravou celou `frontend.robot` sadu (24 testů) přeskočil za 2 s s hláškou „RF_TEST_USER_ID/RF_TEST_PIN nenastaveny".
- Z git historie workflow souboru (beze změny od 2. 8. 2026) vůči historii zavedení uživatelských profilů (8. 8. 2026, commit zavádějící `RF_TEST_USER_ID`) plyne, že tahle mezera existovala od 8. 8. 2026 — `frontend.robot` se tedy v CI reálně nespustil ani jednou od zavedení přihlašování.
- `NTFY_TOPIC` v kroku „API kontrakt" jde jiným mechanismem (`--variable`, ne `env:`) — vědomě odlišný vzor, ne nekonzistence.

## Index.html v3.28 — Vizuální štítek „❓ Neověřeno" na kartě — 9. 8. 2026
### Přidáno
- Malý tlumený štítek **„❓ Neověřeno"** hned vedle 📍 místa na kartě akce — zobrazí se vždy, když má akce stav `neověřeno` a prázdné URL (bez ohledu na datum, na rozdíl od chipu z v3.27). Styl sdílí tlumení s políčkem N/A u počasí (`opacity: .45; font-style: italic`).
- Refaktor: `jeNeoverenaBezUrl_` (v3.27, filtruje podle data) teď staví na nové `jeNeoverena_` (jen stav+URL, bez data) — tu používá i štítek na kartě, ať se zobrazí i pro vzácnou výjimku starého ★/✓ záznamu mimo běžné okno.
- Node testy 236 → 240 (+4 pro `jeNeoverena_`).

## Index.html v3.27 — Chip „❓ Neověřeno" — 9. 8. 2026
### Přidáno
- Nový filtrovací chip **„❓ Neověřeno"** vedle ★ Oblíbené / ✓ Navštívené — po kliknutí ukáže jen budoucí akce se stavem `neověřeno` a prázdným URL. V běžném zobrazení se tyhle akce teď skrývají (`jeNeoverenaBezUrl_`), stejný princip jako dnes „proběhlo". Kategorie zůstávají viditelné na kartě i uvnitř tohoto pohledu — žádné backendové změny (`kulturni_radar.gs` beze změny, `apiEvents` už dnes vrací vše a filtruje se v UI, žádný dopad na cache klíč).
- Datum se kontroluje samostatně na klientovi (`datumOd >= dnes`), ne jen stav+URL — jinak by se přes výjimku `zahrnoutOznacene` (★/✓ mimo běžné okno) mohly vloudit dávno proběhlé neověřené akce.
- Zjištěno při implementaci: AI prompt (`callAnthropic_`) má stav natvrdo `"potvrzeno"` — `neověřeno` tedy není systematický jev, jen ojedinělá výjimka (aktuálně 1 případ v produkci, Festival Špilberk).
- Node testy 227 → 236 (frontend 61 → 70: +9 pro `jeNeoverenaBezUrl_`). RF: nový test „Chip Neověřeno filtruje bez zápisu do tabulky" (stejný bezpečný vzor jako u Oblíbené).

## v3.23 (backend) + v3.26 (frontend) — Zrychlení přihlášení: cache apiEvents + spinner — 8. 8. 2026
### Přidáno
- **Krátkodobá cache `apiEvents`** (`CacheService`, TTL 45 s) — diagnostikou zjištěno, že `apiEvents` je dominantní část 6–10s čekání při přihlášení (čte 4 listy: AKCE/OZNAČENÍ/SOUŘADNICE/POČASÍ při každém volání). Klíč cache zahrnuje verzi (kvůli invalidaci), profil, uživatele i `zahrnoutOznacene`, ať se nesmíchají data různých lidí/měst. **Fail-open**: jakákoli chyba CacheService (výpadek, kvóta, moc velká položka) spadne zpět na normální čtení ze Sheets — cache nikdy nesmí shodit `apiEvents`.
- Invalidace cache po každém zápisu, který mění data vracená `apiEvents`: AKCE (stav proběhlo), OZNAČENÍ (★/✓ toggle), SOUŘADNICE (nová souřadnice), POČASÍ (přepočet předpovědi).
- Frontend: viditelný spinner („Přihlašuji…") na tlačítku `#login-potvrdit` po dobu přihlašování — dřív tlačítko za tuhle dobu nedávalo žádnou zpětnou vazbu, uživatel nevěděl, jestli appka reaguje.
- Node testy 214 → 227 (+13).

### Ověřeno — reálné zrychlení přihlášení (měřeno na produkci po nasazení v3.23)
- Total (klik → zavření overlaye): 11147/4940/4937 ms → 7028/3943/3429 ms (-21 až -37 %)
- apiEvents samotné: 8605/2885/2535 ms → 3597/1870/1753 ms (-31 až -58 %)
- `apiPrihlaseniUzivatele` stabilně ~1,6–2,9 s i po cache — fixní síťová režie Apps Script web-app volání, cache to neovlivňuje (poznámka pro případné další optimalizace).

Poznámka k metodice: druhé měření použilo rekonstruovanou metodiku (slovní popis, ne uložený skript z prvního měření) — čísla jsou srovnatelná, ne byte-přesně identická metoda.

## RF testy — ověření nasazené verze a políčka počasí — 8. 8. 2026
### Přidáno (testovací dluh, ne feature — bez změny verze .gs/Index.html)
- `api.robot`: **„Nasazená verze odpovídá repu"** — čte `VERZE` přímo z `apps-script/kulturni_radar.gs` (regex, ne z dokumentace/paměti) a porovná s `verze` z `?api=meta`. Zachycuje přesně scénář z 8. 8. 2026, kdy `clasp deploy` bez `-i <deploymentId>` nechal produkci na staré verzi (viz SKILL.md sekce 6). Krátký timeout (10 s) + TRY/EXCEPT: bez připojení na produkci test selže srozumitelnou hláškou, ne visí na výchozím timeoutu.
- `frontend.robot`: **„Políčko počasí se zobrazuje správně"** — ověřuje na produkci u karty akce SPRÁVNÝ typ obsahu políčka počasí (v3.25), ne jen že appka nespadla: buď ikona + teplota s `°C` (stav OK/CHYBA se zachovanou hodnotou), nebo viditelné „N/A" se skutečně tlumeným stylem (`Get Style` na `opacity`, ne jen text). Selektory zúžené na `.karta` (stejný důvod jako u `.chip` kolize v SKILL.md sekci 2). Data v listu POČASÍ jsou nedeterministická — pokud aktuální karty nemají ani jeden ze dvou stavů, test se přeskočí se srozumitelnou zprávou, ne padá.
- RF testy 31 → 33 (api 8→9, frontend 23→24), oba nové testy ověřeny naostro proti produkci (`v3.22`/`@51`) — oba PASS.

## v3.22 (backend) + v3.25 (frontend) — Počasí u akce — 8. 8. 2026
### Přidáno
- **Nový list POČASÍ** (ID akce, Aktualizováno, Stav, Kód počasí, Teplota) – oddělený od AKCE (A:V se nedotýká), stejný duch jako OZNAČENÍ/SOUŘADNICE. Full-rewrite při každém běhu, takže staré (proběhlé/zrušené) akce z listu přirozeně odpadnou.
- `aktualizujPocasi_`: pro všechny budoucí akce (i mimo dosah předpovědi) přepočítá počasí – souřadnice bere z existující cache SOUŘADNICE (žádné druhé geokódování). Zdroj Open-Meteo (16denní denní předpověď), fallback met.no při výpadku (`metNoTextNaKod_` sjednotí jeho text na stejnou číselnou škálu jako WMO weathercode).
- Tři stavy: **OK** (předpověď nalezena), **NA** (akce mimo ~16denní dosah Open-Meteo – ne chyba, jen zatím nedostupné), **CHYBA** (výpadek Open-Meteo i met.no zároveň – zachová se poslední známá hodnota, pokud existuje; zaloguje se do KONTROL stejně jako jiné API chyby v projektu).
- Volá se z existujícího triggeru `zpracovatSledovanaMesta` (neděle 20:00, čtvrtek 10:00) – žádný nový trigger, předpověď se tak přirozeně zpřesňuje s blížícím se datem akce.
- `apiEvents` obohaceno o `pocasi: {stav, kod, teplota}` na akci.
- Frontend: malé políčko počasí (ikona podle `weathercodeEmoji_` + zaokrouhlená teplota) vedle data konání na kartě akce – ne samostatný blok. Stav NA/CHYBA-bez-hodnoty se zobrazí jako tlumené „N/A" (`pocasiZobrazeni_`), vizuálně jasně odlišené od běžné ikony, ať nepůsobí jako chyba appky.
- Node testy 196 → 214 (unit 142 → 153: +11 pro `metNoTextNaKod_`/`vyhodnotPocasiUdalosti_`/`aktualizujPocasi_` end-to-end přes fake Sheets + urlFetch stub, všechny tři stavy; frontend 54 → 61: +7 pro `weathercodeEmoji_`/`pocasiZobrazeni_`).
### Poznámka k nasazení
- Vyžaduje ruční „Nová verze" v Apps Script editoru (`aktualizujPocasi_` běží jen po nasazení backendu) – viz Docs/kulturni-radar-workflow/SKILL.md sekce 1.

## Index.html v3.24 — 8. 8. 2026
### Opraveno (UX, definitivní oprava oddělovače u sdílení)
- Prázdné koncové řádky (v3.22, zúžené z v3.21) se ukázaly nespolehlivé — Gmail je při vložení textu ořezává, takže se e-mailový podpis stejně lepil za sdílenou zprávu (zkoušeno naostro jako v3.23, přímo nasazeno bez commitu do repa, nahrazeno hned touto opravou). Řešení: viditelný podpis appky (`— Kulturní radar`) na konci `sestavTextSdileni_` i `sdiletVyber_` — text se ořezat nedá, navíc dává smysl i mimo e-mail (WhatsApp/SMS), kde příjemce hned vidí, odkud zpráva pochází.
- Node testy beze změny počtu (196/196) — existující testy přepsané na nový formát.

## Index.html v3.22 — 8. 8. 2026
### Opraveno (UX, ze živého testování v3.21 v Gmailu)
- Text sdílení zkompaktněn: bez prázdných řádků mezi částmi, odkaz teď jako druhá odrážka (`• Odkaz: ...`) místo samostatného řádku, na konci jen JEDEN prázdný řádek místo tří (`sestavTextSdileni_` i `sdiletVyber_`).
- Node testy beze změny počtu (196/196) — existující testy přepsané na nový formát.

## Index.html v3.21 — 8. 8. 2026
### Opraveno (UX, formát textu sdílení)
- `sestavTextSdileni_` (jedna akce): datum+místo teď na vlastní odrážce (`• `), oddělené prázdnými řádky od názvu i odkazu, čitelnější v e-mailu/SMS než dřívější tři řádky natěsno.
- Oba typy sdílení (jedna akce i `sdiletVyber_` — celý výběr) teď končí několika prázdnými řádky — e-mailoví klienti (Gmail apod.) jinak připojují firemní podpis hned za sdílený text, jako by byl jeho součástí.
- Node testy 195 → 196 (existující testy `sestavTextSdileni_` přepsané na nový formát, +1 nový test na koncové prázdné řádky napříč variantami).

## Index.html v3.20 — Lehčí sdílení: sdílet celý výběr — 8. 8. 2026
### Přidáno
- Nové tlačítko „📤 Sdílet výběr" vedle ★ Oblíbené/✓ Navštívené — sdílí aktuální město + zvolené kategorie jako deep link (`?profil=Město&kategorie=a,b`, `sestavOdkazNaVyber_`), odlišný formát od jedno-akcového `?akce=ID&profil=Město` (v3.17). Bez zvolené kategorie (= „Vše") se parametr `kategorie` vůbec nepřidává.
- Appka po otevření takového odkazu (`parsovatOdkazNaVyber_`) přepne na dané město a aplikuje jen kategorie, které fakticky zná — neplatný/starý název z odkazu se tiše ignoruje. Jedno-akcový odkaz má přednost, ať se oba formáty nekříží.
- Sdílený fallback řetězec (`sdiletText_`: navigator.share → schránka → prompt) vytažen z `sdiletAkci_` a použit i pro `sdiletVyber_`, ať se trojice fallbacků nekopíruje.
- Node testy 186 → 195 (+9 pro `sestavOdkazNaVyber_`/`parsovatOdkazNaVyber_`), RF testy 22 → 23 (existence tlačítka, bez klikání — stejný důvod jako u „Sdílet" na kartě).
### Beze změny (vědomě)
- Sdílený odkaz obsahuje filtr (město + kategorie), ne konkrétní seznam ID akcí — dostupné akce se dál řídí tím, co appka právě má načtené pro dané město.

## Index.html v3.19 — 8. 8. 2026
### Opraveno (UX, ze živého testování v3.18)
- Pulzování zvýrazněné karty (`zvyraznPulz`) teď trvá po celou dobu zvýraznění (do kliknutí nebo 30s pojistky), ne jen 2 opakování na začátku. Čistě CSS (`animation: ... 2` → `... infinite`), Node testy beze změny (186/186).

## Index.html v3.18 — 8. 8. 2026
### Opraveno (UX, ze živého testování v3.17)
- Zvýraznění karty otevřené přes sdílený odkaz (`.zvyrazneno`) teď zůstává, dokud uživatel nikam neklikne, místo pevných 4 vteřin — víc času se zorientovat. Pojistka 30 s, kdyby uživatel neklikl vůbec.
- Node testy beze změny (186/186) — `zvyraznitAkci_` pracuje s DOM/timerem, mimo testovatelnou čistou vrstvu.

## Index.html v3.17 — Lehčí sdílení: odkaz zpátky do appky — 8. 8. 2026
### Změněno
- Tlačítko „📤 Sdílet" u karty akce teď generuje odkaz zpátky do appky (`kulturniradar.cz/?akce=ID&profil=Město`, `sestavOdkazNaAkci_`) místo odkazu na zdrojovou stránku akce. Příjemce tak vidí náš zpracovaný přehled (dojezd, kategorie, skóre), ne holou úřední stránku.
- Appka po otevření takového odkazu (`parsovatOdkazNaAkci_` z `window.location.search`) automaticky přepne na správné město a danou kartu odscrolluje a dočasně zvýrazní (`.zvyrazneno`, pulzující animace). Neplatný/starý odkaz (akce mezitím zmizela) se tiše ignoruje.
- `sestavTextSdileni_` beze změny — jen se jí teď předává kopie akce s přepsanou `url`.
- Node testy 179 → 186 (+7 pro `sestavOdkazNaAkci_`/`parsovatOdkazNaAkci_`, včetně round-tripu a escapování diakritiky).
### Beze změny (vědomě)
- Sdílení CELÉHO výběru/filtrovaného seznamu (víc akcí najednou, veřejný odkaz bez účtu) zůstává samostatný budoucí krok — dnešní změna řeší jen jedno-akcové sdílení. Viz BACKLOG.md.

## Index.html v3.16 — Zapamatování kategorie-chipů per uživatelský profil — 8. 8. 2026
### Přidáno
- Výběr kategorie-chipů v horní liště se teď ukládá do `localStorage` per přihlášený profil a po přihlášení se automaticky obnoví (`ulozitChipyProfil_`/`nacistChipyProfil_`, klíč `radar_chipy:<uzivatelId>` z `klicUlozenychChipu_`). Čistě klientská UI preference k zobrazení — nemá nic společného s „filtry" v profilu, které řídí AI hledání na vyžádání.
- Po odhlášení se výběr resetuje (`aktKategorie.clear()`), ať osobní preference „neprosakuje" do anonymního prohlížení ani do dalšího profilu.
- Bez přihlášení se nic neukládá ani nenačítá.
- Node testy 173 → 179 (+6 pro `klicUlozenychChipu_`/`serializovatKategorie_`/`deserializovatKategorie_`, včetně fallbacku na rozbitá/nečistá data v `localStorage`).

## Infrastruktura — migrace na Cloudflare Pages + doména kulturniradar.cz — 8. 8. 2026
### Přidáno
- Frontend (`Index.html`) migrován z Apps Script webové appky na statický hosting **Cloudflare Pages**, napojený na privátní GitHub repo (přístup jen k tomuto repu, žádný jiný).
- Vlastní doména **kulturniradar.cz** (+ `www.kulturniradar.cz`) aktivní, SSL certifikát zdarma.
- **Email Routing**: `info@kulturniradar.cz` → přesměrování, ověřeno živým doručením.
- RF sada přepnuta na novou doménu beze změny jednotlivých selektorů: `tests/robot/resources.robot` má nově `SITE_URL` (výchozí `https://kulturniradar.cz`, žádný iframe → `FRAME` prázdné) pro `frontend.robot`, zatímco `BASE_URL` zůstává vyhrazené pro `api.robot` (přímé volání Apps Script `/exec` — statický frontend vlastní API endpointy nemá, jen volá stejnou `/exec` URL). Test proti starému Apps Script vstupu (sandboxovaný iframe) zůstává možný přes `--variable SITE_URL:... --variable FRAME:"id=sandboxFrame >>> id=userHtmlFrame >>>"`.
### Ověřeno
- RF 22/22 na kulturniradar.cz.

## v3.21 (backend) + v3.15 (frontend) — Dvourežimový gsr() + HTTP API — 8. 8. 2026
### Přidáno
- **Dvourežimový `gsr()`** ve frontendu: detekuje prostředí a volá `google.script.run` uvnitř Apps Scriptu, nebo `fetch()` jinde — příprava na provoz mimo Apps Script (viz migrace na Cloudflare Pages výše).
- `sestavFetchPozadavek_`: překlad volání na HTTP požadavky; PIN i token se posílají vždy POSTem, nikdy v URL.
- Backend: `routePost_` směruje POST akce (login/toggle/filtry/najdi/run) pro statický frontend, `doGet` přidává `api=uzivatele`.
- Node testy 164 → 173 (unit +9 pro `routePost_`, frontend +6 pro `sestavFetchPozadavek_`).

## v3.14 (frontend) — 8. 8. 2026
### Přidáno
- **Anonymní režim prohlížení**: appka od teď startuje rovnou plně funkční (karty, filtry, vyhledávání), bez vynuceného přihlášení. Přihlašovací obrazovka se otevírá jen na vyžádání – klikem na badge "Přihlásit se" v hlavičce, nebo automaticky při pokusu o ★ Oblíbené / ✓ Navštívené (osobní funkce), se srozumitelnou hláškou proč se přihlášení žádá.
- Nové tlačítko "Pokračovat bez přihlášení" – zavře login overlay, appka zůstává funkční anonymně.
- Po odhlášení appka zůstává funkční v anonymním režimu (žádné ★/✓ konkrétního profilu), ne vynucený návrat na login.
- RF testy 21 → 22: nový klíčový test "Anonymní režim: appka funguje bez přihlášení a ★ vyžádá login" + upravené login/odhlašovací testy na nový flow (overlay se otevírá badgem, ne automaticky).
### Opraveno
- BUG (race condition, nalezeno při RF testování 8. 8.): po přihlášení se přihlašovací overlay zavíral DŘÍV, než doběhlo dotažení osobních ★/✓ dat (`nactiAkce` po loginu) – klik na kartu hned po přihlášení mohl zasáhnout element, který vzápětí přepsal ještě doběhající přechod anonymní→osobní data, a optimistický zápis (★) se ztratil z UI i přes úspěšný zápis na serveru. Fix: `nactiAkce` po přihlášení se teď čeká (`await`) PŘED zavřením overlaye, ne po něm.
### Beze změny
- Backend (`.gs`) – zůstává v3.20, tahle verze je čistě frontendová.

## v3.20 (backend) + v3.13 (frontend) — 7.–8. 8. 2026
### Přidáno
- **Uživatelské profily**: nový list UŽIVATELÉ (ID, Jméno, PIN_hash, Filtry, Vytvořeno). Přihlášení PIN (SHA-256 + sůl, `hashPin_`/`overitPin_`) – hash se nikdy neposílá na frontend, PIN se zadává při každém vstupu (žádné localStorage přihlášení, rozhodnutí 7. 8.).
- Oblíbené/Navštívené jsou od teď **osobní** (per profil), ne sdílené za celou domácnost jako dřív – OZNAČENÍ rozšířeno o sloupec Uživatel (`toggleOznaceni_`, `oznaceniMapy_`, `apiToggle_` přijímají uzivatelId).
- Osobní filtry (kategorie/dojezd) + `apiNajdiProUzivatele_`: AI hledání NA VYŽÁDÁNÍ s přepsanými kritérii, chráněné WEB_TOKEN + zámkem proti souběhu. Náklad vzniká jen při explicitním kliknutí "Najít akce pro mě", automatické běhy (denní/týdenní/sledovaná města) beze změny – vědomé rozhodnutí proti nekontrolovanému ×4 nárůstu API volání.
- Frontend: přihlašovací obrazovka (dlaždice profilů + PIN), badge profilu v hlavičce, dialog osobních filtrů.
- Migrace: menu "Nastavit uživatelské profily (jednorázově)" – založí UŽIVATELÉ, vymaže staré sdílené OZNAČENÍ (rozhodnutí 7. 8.: bez majitele, nedalo by se spravedlivě přiřadit, historie začíná od nuly pro všechny profily).
- Samotest: kontrola sirotčích záznamů v OZNAČENÍ odkazujících na neexistující uživatelský profil.
- `tests/robot/resources.robot`: sdílené proměnné pro RF sadu (BASE_URL, DATUM_RE, RF_TEST_USER_ID/PIN) – sjednocuje dřív mírně odlišný DATUM_RE mezi api.robot a frontend.robot.
- Vyhrazený testovací uživatelský profil `rf-test` pro CI/RF, oddělený od rodinných profilů (toggle testy nezasahují do rodinné historie).
- Node testy 151 → 164 (137 unit +10, 27 frontend +2). RF testy: 21 frontend (+4 nové – přihlašovací dlaždice, špatný PIN, odhlášení, dialog profilu), 8 API beze změny.
### Opraveno (nalezeno při ostrém testování 7. 8.)
- BUG: `location.reload()` uvnitř sandboxovaného Apps Script iframu restartoval jen vnitřní iframe, ne skutečnou `/exec` URL → appka po odhlášení zůstala na prázdné stránce. Fix: "měkké" odhlášení (vyčištění stavu v paměti + znovu-zobrazení login obrazovky), žádný reload.
- BUG: `init()` se od teď volá vícekrát (při každém přihlášení), ne jen jednou při načtení stránky – bez pojistky by se listenery na statických prvcích (chip-oblibene, chip-navstivene, obdobi-select, profil-select) skládaly na sebe s každým dalším přihlášením a klik by postupně spouštěl akci 2×, 3×… Fix: vyčištění DOM (`kat-chips`, `profil-select` se mažou před znovu-naplněním) + jednorázové přidání listenerů přes flag.
- BUG: "Najít akce pro mě" spouštělo osobní hledání s POSLEDNÍ ULOŽENOU hodnotou filtrů, ne s aktuálně vyplněnými poli – kdo neklikl napřed zvlášť na "Uložit", hledalo se se starými/prázdnými filtry (potvrzeno živě: dojezd 30 min v poli, ale KONTROLY log ukázal použitých 120 min). Fix: uložení filtrů proběhne vždy těsně před spuštěním hledání, ne jen na vyžádání.
- RF: `.den-hlavicka` sdílí třídu mezi denními hlavičkami akcí a hlavičkami typů stálých míst (renderMista) – testy na české datum ji sbíraly obě dohromady, spadlo to až s příchodem druhého typu místa v Brně ("AQUAPARK"). Fix: selektor zúžen na `:not(#mista-sekce .den-hlavicka)`.
### Ověřeno
- Node 164/164. RF 21/21 frontend + 7/8 API (1 skip bez NTFY_TOPIC v lokálním běhu, záměrné chování). Živě ověřeno: přihlášení a PIN validace pro 5 profilů, osobní ★/✓ izolace mezi profily (Vojta/Monika nezávisle), osobní hledání s filtry zapsalo správná kritéria do KONTROLY po opravě bugu.

## v3.19 — 7. 8. 2026
### Přidáno
- Víkendové tipy: volitelný druhý příjemce (`NOTIFY_EMAIL_VIKEND`) – posílá se v jednom e-mailu spolu se základním příjemcem (`MailApp.sendEmail` podporuje čárkou oddělené adresy). Ovlivňuje jen tenhle jeden typ notifikace, ostatní (denní kontrola, samotest, chyby) beze změny.
- Node testy 143 → 151 (`spojitPrijemce_` + integrace v `sendNotification_`).
### Ověřeno
- Živě: e-mail „Víkendové tipy" dorazil oběma adresátům v jednom odeslání.

## v3.16–v3.18 — 5. 8. 2026
### Přidáno
- Sledovaná města: nový list SLEDOVANÁ MĚSTA, funkce `zpracovatSledovanaMesta` tiše (bez notifikace) doplňuje data pro vybraná města mimo domácí profil – stejná kritéria jako domácí profil (dojezd/horizont/kategorie), jen jiné cílové město. Dva nové triggery (neděle 20:00, čtvrtek 10:00) + menu položka pro ruční spuštění. Časově rozpočtováno (~4,5 min).
- Node testy 137 → 139 (`cfgProMesto_`).
### Opraveno
- BUG: zastaralá shrnovací hláška `setupTriggers()` nezmiňovala nové triggery sledovaných měst (v3.17, kosmetické).
- BUG (kritický): `zpracovatSledovanaMesta` při opakovaném spuštění vždy začínala od začátku seznamu měst, takže se stejná první města zpracovávala opakovaně a ke zbytku seznamu se nikdy nedostala. Nová funkce `jeDnesJizZpracovano_` přeskočí města už dnes zpracovaná (v3.18). Node testy 139 → 143.
### Provozní poznatky (viz i Docs/PROVOZ.md)
- List AKCE, sloupec Y (Profil lokality) měl samo-odkazující pravidlo ověření dat, které blokovalo zápis jakéhokoli nového jména města. Odstraněno ručně v tabulce.
- KRITÉRIA!B2 (aktivní domácí profil) se při ladění omylem přepsalo na „Praha" – vráceno na „Brno".
### Ověřeno
- Node 143/143. Živě ověřeno: sledovaná města úspěšně doplnila data (Praha 13 akcí), skip logika potvrzena (2. běh přeskočil 3 už hotová města).

## Index.html v3.12 — 5. 8. 2026
### Opraveno
- BUG (kritický, zpětná vazba syna 5. 8.): statický `#status` z počátečního HTML se po prvním úspěšném vykreslení smazal z DOM (renderAkce() čistí #main). Každé DALŠÍ volání `nactiAkce` (přepnutí profilu v dropdownu) tak narazilo na `getElementById('status')` vracející null a tiše spadlo PŘED try blokem (async fire-and-forget = odmítnutý Promise, žádná viditelná chyba) – appka na přepnutí města vůbec nereagovala. Pravděpodobně starý bug, ne dnešní regrese; RF sada ho nikdy nechytila, protože testuje jen jedno čerstvé načtení stránky, ne druhé přepnutí profilu (zapsáno jako testovací dluh).
- Profily v dropdownu teď řazené abecedně (dřív v pořadí z listu LOKALITY).
### Testovací dluh
- RF test na přepnutí profilu podruhé (regresní pojistka na tento bug) – zatím chybí, přidat příště.

## Index.html v3.11 — 5. 8. 2026
### Opraveno
- BUG (zpětná vazba syna): `window.open(url, '_blank', 'noopener')` vrací null i při úspěchu (specifikace) – fallback na window.location.href se tak spouštěl i po úspěšném otevření a přesměroval PŮVODNÍ stránku na cizí web. Oprava: noopener se nastavuje přes `okno.opener = null` po úspěchu, ne jako argument window.open.
- BUG (zpětná vazba syna): přepnutí profilu v dropdownu neaktualizovalo sekci Stálá místa (volal se jen `nactiAkce`, ne `nactiMista`).

## Testy — 4. 8. 2026 (bez změny produkčního kódu)
### Přidáno
- 9 nových Node testů pro `callAnthropic_` – poslední netestovaná část jádra AI zpracování. Pokrývá celou retry smyčku (pause_turn pokračování, end_turn vyžádání odevzdání, max_tokens záchrana přes parseEvents_, druhé formátovací dovolání, úplné selhání, HTTP chybu, chybějící API klíč, prázdný seznam akcí jako platný výsledek).
- Node testy: 128 → 137.

## v3.15 — 4. 8. 2026
### Změněno
- Prompt `callAnthropic_`/`callAnthropicPlaces_`: skóre 1–10 dostalo explicitní rubriku (9–10 jedinečná akce, 6–8 solidní výlet, 3–5 průměrná, 1–2 drobnost) místo pouhého "číslo 1–10" bez kritérií. Cíl: konzistentnější hodnocení napříč běhy. Platí pro nově nalezené/aktualizované akce od tohoto nasazení.
- Node testy 126 → 128.

## Index.html v3.8–v3.10 — 4. 8. 2026
### Přidáno
- 📤 Sdílet: tlačítko na kartě, `navigator.share` (nativní panel WhatsApp/SMS/e-mail na mobilu) s odstupňovaným fallbackem (schránka → prompt). Čistá funkce `sestavTextSdileni_`, 5 testů.
- 📍 Mapa: odkaz na Google Maps (URL schéma, žádný API klíč). Čistá funkce `mapsUrl_`, 3 testy.
- Node testy 110 → 113, RF testy 16 → 17 (existence obou tlačítek, bez klikání – chování navigator.share/clipboard v headless testu je nedeterministické).

## v3.14 (backend) + Index.html v3.10 — 4. 8. 2026
### Přidáno
- Souřadnice akcí přes Nominatim (OpenStreetMap, zdarma, bez klíče, 1 dotaz/s): nový list SOUŘADNICE (cache), geokódování na pozadí po každé kontrole (`zajistitSouradniceProAkce_`), nikdy synchronně při načtení stránky. `mapsUrl_` teď preferuje souřadnice → garantovaný pin na mapě; bez nich spadá zpět na textové vyhledávání jako dřív.
- Nová položka menu „Doplnit souřadnice (jednorázově)" pro zpětné geokódování existujících akcí (respektuje 6min limit Apps Scriptu, resumable přes cache).
- Node testy 113 → 126 (klicSouradnic_, sestavDotazGeokodovani_, souradniceMapy_, geocodovatNominatim_ vč. retry/výpadku/cachování, mapsUrl_ souřadnicová větev).
- RF testy 17 → 18 (schema check: pole lat/lng v odpovědi apiEvents).
### Ověřeno
- Node 126/126, RF 25/25 (dva přechodné zákmity na Google echo URL potvrzeny opakovaným během).

## v3.12 — 4. 8. 2026
### Změněno
- Prompt `callAnthropic_`: pole `dojezd` teď žádá čas i vzdálenost v km (`"cca 30–40 min, ~35 km"`), dřív jen čas. Zpětná vazba rodiny 4. 8. Platí pro nově nalezené akce od tohoto nasazení; existující řádky v AKCE se nepřepisují zpětně (standardní chování upsertu).

## Index.html v3.7 — 4. 8. 2026
### Přidáno
- Odkazy „Více info"/„Do kalendáře" teď používají explicitní `window.open()` z kliku místo spoléhání jen na `target="_blank"` – pokus o opravu známého chování Safari uvnitř vnořeného sandboxovaného iframe Apps Scriptu (na iPadu se detail otevíral ve stejné stránce místo nové záložky). `href`/`target` zůstávají jako fallback. **Zatím neověřeno na reálném iPadu** – čeká na návrat dcery s tabletem.
- Chipy „★ Oblíbené"/„✓ Navštívené" přesunuty doprava (`justify-content: flex-end`) – zpětná vazba rodiny.
- Zvětšený základní text (`.nazev`, `.meta`, `.popis`, `.misto-nazev`, `.misto-meta`, explicitní `font-size: 16px` na `body`) kvůli čitelnosti na Androidu. Provizorní zásah – čeká na systematičtější doladění při designovém průchodu.

## v3.13 — 4. 8. 2026
### Opraveno
- BUG (nalezen zpětnou vazbou rodiny): `readOznaceni_` četla sloupec „Datum označení" přes syrové `String()` místo `cellText_` – u data uloženého jako Sheets Date se na kartě zobrazovalo `✓ navštíveno Tue Aug 04 2026 00:00:00 GMT+0200…` místo `✓ navštíveno 4. 8. 2026`. Stejný vzorec bugu jako v3.8, jen v novém místě (funkce vznikla až ve v3.9). Regresní test doplněn.
### Ověřeno
- Node 105/105 (beze změny od dnešního rána – tyto tři verze testy přímo neměnily). `?api=meta` → 3.13. Oprava data u „navštíveno" potvrzena živě na produkci.

## Testy — 4. 8. 2026 (bez změny produkčního kódu)
### Přidáno
- 15 nových Node testů pro `parseEvents_` (záchranný parser textové odpovědi AI, když model nezavolá report_events strukturovaně – markdown ohraničení, čárka navíc, syrové konce řádků, pause_turn restart pole, useknutí max_tokens) a `eventToRow_` (mapování akce na 22 sloupců AKCE).
- Node testy: 90 → 105.

## Testy — 3. 8. 2026 (bez změny produkčního kódu)
### Přidáno
- 17 nových Node testů pro existující (dosud netestované) čisté funkce: `najdiDuplicity_`, `jeVycpavka_`, `normNazev_`, `nazevTokens_`, `isSameName_` – jádro deduplikace a datové hygieny. Zahrnuje fuzzy shodu (dvě různě formulované verze téhož názvu akce) a hraniční případy (jiný profil/den = ne duplicita, prázdný název, tokeny kratší než 3 znaky).
- Node testy: 74 → 89.

## Index.html v3.6 — 3. 8. 2026
### Přidáno
- `tests/frontend-harness.js`: nová obecná infrastruktura pro jednotkové testy čisté JS logiky z `Index.html` v Node (bez prohlížeče) – vytáhne pojmenovanou funkci ze `<script>` bloku a spustí ji izolovaně (počítá závorky, funguje na libovolnou funkci). Řeší dlouhodobou mezeru: frontend JS byl dosud testovaný jen pomalu a křehce přes RF.
- `tests/frontend.test.js`: 14 testů nad harness – `parseCeskeDatum`, `gcalUrl_`, a hlavně `filtrovatNavstivenaPodleObdobi_` (logika retrospektivy „✓ Navštívené" vytažená z `prekreslit()`), včetně přesných hraničních testů (30 dní ještě patří do období, 31 už ne).
- RF testy 13 → 15: integrace „★ se skutečně promítne do filtru Oblíbené" (ne jen že se zapíše) a klik na typ stálého místa filtruje seznam (adaptivní na počet typů v datech profilu).
- `.github/workflows/node-tests.yml` teď spouští oba testové soubory (`unit.test.js` + `frontend.test.js`).
### Ověřeno
- Node 74/74 (60 backend + 14 frontend), RF 22/22 (dva přechodné zákmity na Google echo URL potvrzeny jako false positive opakovaným během).

## v3.11 — 3. 8. 2026
### Změněno
- `zahrnoutAkciDoVysledku_`: filtrovací rozhodnutí (proběhlo/staré/zrušeno/označené) vytažené z `readEventsApi_` do samostatné čisté funkce – žádná změna chování, jen testovatelnost. 7 nových Node testů (přímé pokrytí místo dosavadního nepřímého přes RF).
### Přidáno
- `.github/workflows/node-tests.yml`: Node testy teď běží automaticky při každém push/PR (dřív jen ručně lokálně) – nezávisí na paměti, žádné secrety.
- Node testy: 53 → 60.

## v3.10 — 3. 8. 2026 (backend) + Index.html v3.5
### Přidáno
- met.no jako záložní zdroj počasí – `weatherFor_` ho zkusí, jen když Open-Meteo selže nebo pro daný den nemá data; cachuje se, nevolá se zbytečně. 9 nových testů (`agregovatMetNoDen_`, `metNoTextFor_`, integrace fallbacku).
- „📅 Do kalendáře" na kartě (Google Calendar šablonová URL, celodenní událost – strukturované časy zůstávají v backlogu).
- Chipy typů stálých míst ve webu (jen když profil má 2+ typů), zrcadlí seskupení z digestu.
- Vizuální stav „ukládá se" (`ukladani`) na ikonách ★/✓ po dobu round-tripu na server – opravuje závod, kdy `Reload` mohl proběhnout dřív než zápis do OZNAČENÍ (odhaleno RF testem 3. 8. 2026).
- RF testy 12 → 13 (odkaz do kalendáře); opraven selektor „Vše" (kolize mezi chipy kategorií a chipy typů míst) a odstraněn nepodporovaný `msg=` u `Wait For Elements State`.
### Ověřeno
- Node 60/60, `?api=meta` → 3.11, RF proti produkci.

## v3.9 (backend) + Index.html v3.4 — 3. 8. 2026
### Přidáno
- ⭐ Oblíbené a ✓ Navštívené: nový list OZNAČENÍ (vzniká sám při prvním použití), `apiToggle(id, typ)` přes google.script.run, ikony na kartě, chipy „★ Oblíbené" / „✓ Navštívené" (druhý s výběrem období pro retrospektivu).
- Označené akce se v `apiEvents` výjimečně zobrazí i mimo běžné okno (staré/proběhlé) jako inspirace; neoznačené staré akce zůstávají skryté jako dosud.
- Samotest: kontrola sirotků v OZNAČENÍ (záznam k neexistující akci).
- Node testy 36 → 44 (BUG v3.8 digest čas, toggleOznaceni_, oznaceniMapy_, sirotciOznaceni_, validace apiToggle_).
- RF testy (frontend.robot) 8 → 12: existence ikon, bezpečný filtr chipu (bez zápisu), a dva plné obousměrné round-trip testy (★ i ✓) s reloadem a idempotentním teardownem — ověřují skutečný zápis/odzápis v produkčním listu OZNAČENÍ, aniž by trvale změnily data.
### Opraveno
- BUG v3.8 „Sat Dec 30 1899…“: `readEventsInRange_` (digesty) četla čas akce přes syrové `String(row[3])` místo `cellText_` – u buňky typu „jen čas“ (Sheets ji interně ukládá jako Date epochy 30. 12. 1899) se do e-mailu/ntfy propsalo syrové `Date.toString()` místo „H:mm“ (reálně zachyceno u Balkan Night).
### Ověřeno
- Node 44/44, RF 18/19 (ntfy pád nesouvisí – vyšetřeno zvlášť jako doručovací zpoždění).

## v3.7 — 3. 8. 2026
### Opraveno
- Meta API: „poslední kontrola" profilu ztrácela čas (Sheets autokonvertoval zapsaný řetězec na Date a cellText_ Date záměrně formátuje bez času). Nový cellTextCas_ čas u Date zachová; cellText_ beze změny. Node testy 35 → 36.

## v3.6 — 3. 8. 2026
### Přidáno
- Digesty se posílají e-mailem jako HTML (předsazené odrážky — konec „utržených" řádků na mobilu); prostý text zůstává pro ntfy a jako záloha. Nové renderery renderDigestText_/renderDigestHtml_ nad společným datovým modelem, esc_ proti rozbití HTML názvy akcí.
- „Probíhá od" přesunuto z titulku akce na vlastní odsazený řádek k času.
- Stálá místa v digestu seskupená podle typu (· Zoo, · Jeskyně, …).
- Node testy 31 → 35 (oba renderery, escapování, HTML jen do e-mailu).
### Změněno
- MAX_WEB_SEARCHES 5 → 3 (optimalizace API kreditů).
### Diagnostikováno
- Ranní výpadky počasí: Open-Meteo je ze sdílených IP Google serverů dostupné přerušovaně (ráno kvóta, večer OK); kód v pořádku, řeší retry + klasifikace varování ze v3.5. Trvalé řešení (met.no fallback, cache souřadnic) v backlogu.

## v3.5 — 2. 8. 2026
### Přidáno
- `sklonuj_` — správné české skloňování v samotestu („1 problém", ne „1 problémů").
- `fetchJson_` s jedním retry po 1,5 s; `weatherFor_` přes něj volá geokódování i předpověď.
- `weatherApiDostupne_` + samotest rozlišuje varování (externí výpadek Open-Meteo, titulek zůstává OK) od problému (naše chyba).
- `const VERZE` — jediný zdroj pravdy pro číslo verze v `?api=meta` (regrese: meta hlásila 3.4 u kódu 3.5).
- Node testy: 20 → 31 (cellText_ vč. sériového 46156 → „14. 5. 2026", sklonuj_, retry počasí, konzistence VERZE); harness umí stub UrlFetchApp a Utilities.sleep.
### Změněno
- `rf-tests.yml`: checkout@v5, setup-python@v6, upload-artifact@v6 (Node 24, konec deprecation varování).
### Ověřeno
- Node 31/31; nasazení potvrzeno přes `?api=meta` → 3.5.

## Index.html v3.3 — 2. 8. 2026 (backend beze změny, 3.4)
### Přidáno
- Frontend: sekce „Probíhá / dlouhodobé" na začátku seznamu — akce s datem začátku v minulosti (celoléto běžící série apod.) už nedrží dávno minulou denní hlavičku nad aktuálními akcemi; na kartě se zobrazuje původní začátek („od 14. 5. 2026").
- `frontend.robot`: nový regresní test „Dlouhodobé akce nevytvářejí hlavičky s minulým datem" (žádná datumová hlavička < dnešek; sekce Probíhá vždy první) — sada má nyní 14 testů.
### Změněno
- Test hlaviček dnů toleruje nedatumový label sekce (case-insensitive, label v proměnné `${PROBIHA_LABEL}`).
### Ověřeno
- Nasazeno (Nová verze), RF 14/14 PASS proti produkci (2. 8. 2026).

## v3.4 — 2. 8. 2026
### Opraveno
- Frontend: volání backendu převedeno z `fetch` na `google.script.run` (iframe sandbox Apps Scriptu blokoval fetch na vlastní /exec).
- `cellText_`: sjednocené čtení buněk — Date objekt, string i sériové číslo (46156), časy s datem r. 1899; konec chybných datumů v kartách.
- Opravené indexy sloupců při čtení akcí.
- `?api=meta`: u profilů se vrací kraj místo dojezdu.
### Přidáno
- Robot Framework sada `tests/robot/`: api.robot (6 testů — kontrakt endpointů, regrese datumů, odmítnutí neplatného tokenu) a frontend.robot (7 E2E testů, piercing dvojitého iframe sandboxu).
- Workflow `rf-tests.yml`: ruční dispatch + neděle 19:00, vyžaduje secret `RADAR_URL`.
### Ověřeno
- Nasazení: backend 3.4 + Index.html 3.2, `?api=meta` vrací verzi 3.4 a 30 profilů s kraji.
- RF testy proti produkční /exec URL: 13/13 PASS (2. 8. 2026).

Kompletní historie verzí včetně produkčních bugů a jejich řešení —
zároveň případová studie testování a ladění AI-integrovaného systému.

## v3.0–3.3 (2. 8. 2026) – FRONTEND (webová aplikace)
- **v3.0**: `doGet`/`doPost` + `Index.html` — Apps Script web app servíruje
  HTML aplikaci (karty akcí po dnech, filtry kategorií, přepínač profilů,
  stálá místa, FAB „Spustit kontrolu" s tokenem WEB_TOKEN, cooldown 10 min,
  asynchronní start přes jednorázový trigger).
- **v3.1**: **Bug:** `fetch()` z web appky na vlastní URL nefunguje — Apps
  Script servíruje HTML ze sandboxovaného iframe na `googleusercontent.com`,
  fetch dostal HTML místo JSON. **Fix:** `google.script.run` (nativní bridge)
  + wrapper funkce `apiMeta/apiEvents/apiPlaces/apiSpustKontrolu`; oprava
  posunutých indexů sloupců (cena/popis/skóre).
- **v3.2–3.3**: **Bug:** datumy z buněk přicházely ve 3 podobách — Date objekt
  (→ „FRI AUG 07…"), string, i holé sériové číslo („46156"); časy jako datum
  r. 1899. **Fix:** `cellText_` normalizuje všechny tři reprezentace
  (sériové číslo → datum; rok < 1930 → čas H:mm). Lekce: Sheets jako datový
  zdroj vyžaduje obranné programování — jeden sloupec, tři typy.
- Nasazování: každá změna kódu vyžaduje „Spravovat implementace → Nová
  verze" — implementace jsou zmrazené snapshoty!

## v2.9 (1. 8. 2026)
- **Samotest** (`runSelfTest`, menu + nedělní trigger 18:00): listy a hlavičky,
  kritéria, properties, všech 7 triggerů, vzorce PŘEHLEDU, Open-Meteo,
  datová hygiena (duplicity suchým během, vycpávkové názvy, akce bez URL).
- **Watchdog** (denně ~20:00): poplach, pokud dnes neproběhla denní kontrola —
  chytá tichá selhání a nevystřelené triggery.
- Refaktor: detekce duplicit vytažena do `najdiDuplicity_` (sdílí ji úklid
  i audit); nový čistý detektor `jeVycpavka_` (pokrytý jednotkovými testy).
- **Fix latentního bugu:** `updateMista` předávala `readCriteria_` celý
  spreadsheet místo listu KRITÉRIA — fungovalo jen díky pořadí listů.

## v2.8 (1. 8. 2026)
- Všechny notifikace seskupené podle kategorií (Festivaly / Koncerty / Výstavy…);
  u kontrol uvnitř sekcí Nové/Změněné/Zrušené, u přehledů jako hlavní nadpisy.

## v2.7 (1. 8. 2026)
- Nový subsystém **STÁLÁ MÍSTA**: list MÍSTA (samovytvářecí), AI aktualizace
  přes nástroj `report_places`, měsíční trigger, sekce ve víkendových tipech
  s otevírací dobou a sobotním počasím.

## v2.6 (1. 8. 2026)
- **Bug:** brána ntfy mění těla > ~4 kB na přílohu `.txt` (dlouhé digesty
  dorazily jako soubor). **Fix:** inteligentní zkrácení ntfy verze po celých
  řádcích; e-mail vždy plná verze.

## v2.5 (1. 8. 2026)
- Po každém běhu se aktualizuje LOKALITY (Poslední kontrola profilu, stav mapy) —
  PŘEHLED se plní bez ručních zásahů.

## v2.3–2.4 (1. 8. 2026)
- Položky „Beze změny“ vypsané jmenovitě; chronologické řazení; odkaz na tabulku
  v každé notifikaci; kategorie u položek.
- Týdenní (po) a víkendový (čt) přehled s **počasím z Open-Meteo**
  (geokódování + denní předpověď, zdarma bez klíče, cache per běh).

## v2.0–2.2 (1. 8. 2026)
- **Zásadní architektonická změna:** výsledky hledání se odevzdávají
  **voláním nástroje** (`report_events` s pevným input_schema) místo textového
  JSON — validitu struktury garantuje API. Textový parser zůstal jen jako
  poslední záloha. Vyřešilo celou třídu chyb parsování.
- Notifikace: položky na řádcích, bez emoji, limit 20; zákaz vycpávkových
  obecných akcí v promptu.

## v1.7–1.9 (31. 7. – 1. 8. 2026)
- Notifikace s konkrétními názvy akcí.
- **Bugy parsování textového JSON z LLM** (chronologie eskalace):
  useknutá odpověď → záchrana konce pole; komentář místo pole → druhá fáze
  („formátovací dovolání“ bez web searche); restart pole při pause_turn →
  parsování od posledního `[`; nelegální znaky v řetězcích → sanitizace.
  Každá vrstva pomohla, ale definitivně to vyřešil až tool use ve v2.0.
  **Lekce: strukturovaný výstup LLM nikdy neparsovat z textu, když platforma
  nabízí schéma.**

## v1.4–1.6 (31. 7. 2026)
- **Bug:** push notifikace nikdy nedorazily. Diagnóza po vrstvách:
  1. v1.2: česká diakritika v HTTP hlavičce → UrlFetchApp výjimka;
  2. v1.4 log odhalil **HTTP 429 z ntfy.sh** — kvóta se u anonymních requestů
     počítá na IP a sdílené IP Google serverů ji mají trvale vyčerpanou;
  3. token bezplatného účtu nepomáhá (limity zůstávají na IP; přenos na účet
     až v ntfy Pro).
  **Fix (v1.6): publikace přes SMTP bránu `ntfy-<topic>@ntfy.sh`** — jde přes
  Gmail infrastrukturu a HTTP limitům nepodléhá.
- v1.5: pokusný token; v1.4: logování odpovědí, testNtfy(), časový rozpočet
  pause_turn smyčky, formátovací dovolání.

## v1.1–1.3 (31. 7. 2026)
- Deduplikace: normalizace datumů, fuzzy překryv názvů (podmnožina nebo 3+
  společná slova), registrace nových řádků do indexů v rámci běhu.
- „Změna“ jen při posunu termínu/stavu (ne při přeformulování textů).
- pause_turn pokračovací smyčka; toast místo blokujícího alertu
  (**bug:** `getUi().alert()` z editoru čekal na dialog v tabulce → 5min timeout).
- Pravidlo proti fragmentaci vícedenních akcí.

## v1.0 (31. 7. 2026)
- První verze: onEdit trigger na checkbox, denní trigger, Anthropic API
  s web searchem, zápis do AKCE (jen A:V + Y), KONTROLY audit, menu.

## Oprava mimo skript (1. 8. 2026)
- PŘEHLED!E4:E7 `#VALUE!`: zděděné vzorce (SOUČIN.SKALÁRNÍ) měly ve větvi
  KDYŽ skalár místo pole — padaly, kdykoli „Malé lokální akce“ = ANO.
  Nahrazeno výrazem, který je polem vždy.
