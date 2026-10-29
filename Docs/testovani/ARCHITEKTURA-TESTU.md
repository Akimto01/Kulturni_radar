# Architektura automatizace testů – Kulturní radar

Návrh architektury automatizace testů (TAA) pro Kulturní radar, zpracovaný podle
metodiky kurzu *Architektura automatizovaných testů v praxi* (Tesena, 10/2026).
Struktura dokumentu kopíruje osnovu kurzu: **A** strategie, **B** framework,
**C** CI/CD, **D** reporting a hodnota automatizace. Část **E** popisuje, jak
architektura postupně vznikala, a API nástroje použité mimo hlavní sadu.

Na rozdíl od cvičného e-shopu v kurzu tady automatizace už běží. Dokument proto
u každého rozhodnutí uvádí stav: **zavedeno** (platí dnes, s odkazem na důkaz),
nebo **navrženo** (rozhodnutí je udělané, ale ještě není v kódu).

**Vztah k ostatním dokumentům.** [TESTY.md](TESTY.md) je testovací plán podle
ISO/IEC/IEEE 29119 (rizika, úrovně, kritéria). Tento dokument se dívá na stejný
projekt očima architekta: proč a kde test vzniká, jak je framework postavený
a jak běží v pipeline. Podrobnosti se neopakují, odkazují se.

**Dokument jako zadání pro AI agenta.** Kurz staví na tom, že návrh architektury
je zadání, podle kterého může pracovat AI agent. V tomto projektu to platí
doslova: testy píše a udržuje Claude Code podle tohoto dokumentu a workflow
skillu (`Docs/kulturni-radar-workflow/SKILL.md`). Pravidla v částech B a C jsou
proto psaná tak, aby se podle nich dalo rozhodnout v code review.

---

## Část A: Strategie automatizace

### A1. Informační zdroje

| Zdroj | Co z něj vychází |
|---|---|
| Zdrojový kód (`apps-script/kulturni_radar.gs`, `Index.html`) | jediný úplný popis chování; komentáře u funkcí nesou i důvody rozhodnutí |
| [ARCHITEKTURA-APLIKACE.md](../aplikace/ARCHITEKTURA-APLIKACE.md) | architektura aplikace, toky dat, dvě prostředí (statický web, Apps Script) |
| [CHANGELOG.md](../CHANGELOG.md) | historie změn s diagnózou každé chyby: hlavní zdroj rizik |
| [DEFEKTY.md](../kvalita/DEFEKTY.md), [PRIBEHY-CHYB.md](../kvalita/PRIBEHY-CHYB.md) | klasifikované defekty a analýza úniků |
| [TESTY.md](TESTY.md), [POKRYTI.md](POKRYTI.md), [TESTOVACI-ANALYZA.md](TESTOVACI-ANALYZA.md) | testovací plán, matice pokrytí, odvození testů z testovací báze |
| [AUDIT-SELEKTORU.md](../audity/AUDIT-SELEKTORU.md) | stabilní selektory pro E2E testy |
| [PROVOZ.md](../aplikace/PROVOZ.md) | provozní postupy, triggery, nasazení |
| Živá aplikace a Google Sheet | ruční průzkum, ověření dat po nasazení |
| Zpětná vazba rodiny (BACKLOG) | skutečné potíže uživatelů |

**Co chybí a jak to ovlivňuje strategii:**

- **Formální požadavky a user stories** neexistují. Testovací báze se skládá ze
  zdrojového kódu, CHANGELOGu a zpětné vazby (postup v TESTOVACI-ANALYZA.md).
  Důsledek: testy ověřují spíš invarianty a doložené chyby než úplnou specifikaci.
- **Specifikace API** (např. OpenAPI) neexistuje. Kontrakt hlídají API testy
  ověřující strukturu odpovědí, ne dokument.
- **Samostatné testovací prostředí** neexistuje, testy běží proti produkci
  s vyhrazeným testovacím profilem (zdůvodnění v TESTY.md, 4.4). Důsledek:
  zápisové testy musí vracet stav a CI se nespouští při každém pushi.
- **Data o používání** (analytika) chybí, priority proto vycházejí z dopadu na
  uživatele, ne z četnosti použití.

### A2. Pět rozhodnutí Test Automation Architekta

**1. Proč automatizujeme?** Aplikaci vyvíjí jeden člověk s AI agentem a mění se
často (desítky nasazení měsíčně). Bez automatizace by každá změna znamenala
ruční přetestování, které by se nedělalo, a regrese by našli až uživatelé.
Automatizace má dát **rychlou zpětnou vazbu před nasazením** (unit testy) a
**jistotu, že produkce opravdu funguje** (týdenní E2E proti ostré appce).
Rozhodnutí, ke kterým pomáhá: smím nasadit, a funguje to, co je nasazené.

**2. Co automatizujeme a co ne?** Automatizujeme rizika s doloženým incidentem
nebo vysokým dopadem: správnost dat akcí, načtení akcí pro zvolené město,
osobní označení, shodu nasazené verze s repem a notifikace. Neautomatizujeme:
kvalitu obsahu generovaného AI (posuzuje člověk namátkou), vizuální dojem
z designu, chování na reálném telefonu a placené akce (spouštění vyhledávání
přes Claude API stojí peníze). Seznam s důvody je v TESTY.md, kapitola 8.

**3. Kde test vznikne?** Platí jedno pravidlo: **co jde vytáhnout do čisté
funkce, testuje se jednotkově v Node; E2E test ověřuje jen napojení a to, co
vzniká až složením částí** (DOM, mapa, kalendář, komunikace s reálným API).
Příklad: sestavení obsahu popupu mapy má 5 jednotkových testů, jeho vykreslení
2 E2E testy.

**4. Jak často mají testy běžet?** Jednotkové testy a kontrola syntaxe RF při
každém pushi (běží zhruba sekundu a nemají vedlejší efekty). Smoke E2E ručně po
každém nasazení. Plná sada E2E a API jednou týdně, protože běží proti produkci,
část testů zapisuje a Apps Script pod opakovanou zátěží zpomaluje.

**5. Jak poznáme, že automatizace funguje?** Podle toho, zda podle výsledků
skutečně rozhoduji: nasazuji jen se zelenými unit testy a smoke testem, a selhání
týdenního běhu se řeší do další pracovní session. Sledované signály jsou v části
D. Lekce z října 2026: týdenní běh selhával deset týdnů a nikdo to nevěděl, takže
automatizace „běžela“, ale nefungovala (PRIBEHY-CHYB.md, příběh 2).

### A3. Klíčové rizikové oblasti

| Riziková oblast | Reprezentativní scénář | Priorita | Proč automatizovat | Automatizovat? / předpoklady | Úroveň testu | Frekvence běhu |
|---|---|---|---|---|---|---|
| Správnost dat akcí | Akce s datem uloženým jako sériové číslo se zobrazí jako české datum a po proběhnutí se skryje | 1 | Špatné datum = uživatel přijde o akci; opakovaně doložené chyby (#17, #23) | Ano; předpoklad: čisté funkce pro převod dat, harness se stuby Google API | Unit (převod a validace), API (formát data), samotest (audit dat) | Unit každý push; API týdně; samotest týdně |
| Načtení akcí pro zvolené město | Přepnutí na město s diakritikou načte jeho akce | 1 | Hlavní funkce appky; chyba se dlouho skrývala (#31, #26) | Ano; předpoklad: město s diakritikou v datech, vybírá se dynamicky | Unit (sestavení požadavku, stráž pozdní odpovědi), E2E | Unit každý push; E2E smoke po nasazení a týdně |
| Osobní označení ★/✓/🏛 | Označená akce zůstane označená po znovunačtení stránky | 2 | Ztráta označení = ztráta osobních dat uživatele | Ano; předpoklad: vyhrazený testovací profil, test vrací stav | E2E se zápisem a ověřením reloadem | Týdně (ne smoke, zápis do produkce) |
| Nasazená verze odpovídá repu | API vrací verzi shodnou s verzí v repu | 1 | Oprava „nasazená“, ale neběžící (doloženo 8. 8. 2026) | Ano; bez předpokladů | API | Smoke po každém nasazení, týdně |
| Notifikace | Týdenní přehled dorazí do kanálu ntfy | 2 | Systém má umět ohlásit vlastní selhání; mrtvý kanál nic neohlásí | Částečně; obsah zprávy unit, živost kanálu API, doručení na telefon ručně | Unit, API (kontrola kanálu za 48 h) | Unit každý push; API týdně |

Oblasti odpovídají rizikům R1, R9, R3, R2 a R4 v [TESTY.md](TESTY.md), kapitola 3,
která je jediným zdrojem seznamu rizik. Ostatní rizika (R5 až R8, R10 a R11)
mají méně kritický dopad na uživatele nebo se řeší mimo testy aplikace
(B3, C1, C5).

### A4. Lokalizace a internacionalizace

**Rozhodnutí:** appka je záměrně jednojazyčná (čeština, cs-CZ), texty rozhraní
jsou přímo v kódu a i18n framework se nepoužívá. Překlad do dalších jazyků
není v plánu, proto se netestuje.

Jednojazyčnost ale neznamená, že lokalizace nehraje roli. Appka je na české
lokalizaci silně závislá a **tři z osmi říjnových defektů byly lokalizační**:
dvojí zakódování diakritiky (#31, 80 dní bez povšimnutí), datum jako sériové číslo
(#17) a text „neuvedeno“ místo data (#23).

| Lokalizační oblast | Kde v kódu | Pokrytí dnes | Mezera |
|---|---|---|---|
| Diakritika v URL a požadavcích | `encodeURIComponent` a `decodeURIComponent` (v3.65), odkazy do Google kalendáře | 4 jednotkové testy, E2E s dynamicky vybraným městem s diakritikou | jen karty akcí, ne stálá místa; API `places` s diakritikou netestováno; normalizace NFC/NFD a velikost písmen nepokryté |
| České formáty dat | převod textu, sériových čísel a rozsahů na datum | zhruba 30 jednotkových testů převodu, API ověřuje formát `d. M. yyyy` | rozsah typu „8.–9. 8. 2026“ vezme první datum (sledováno v BACKLOGu) |
| Řazení podle češtiny | `localeCompare(…, 'cs')` na čtyřech místech frontendu (města, typy míst) | žádný test | pořadí s „Č“ a „Ch“ |
| Časová zóna | backend `Europe/Prague`, frontend čas prohlížeče | jeden test hranice půlnoci | jednotkové testy v CI běží v `TZ=Europe/Prague` (zavedeno 29. 10. 2026, issue #37; výsledky jsou stejné i v UTC a jiných zónách); žádný test přechodu letního času; uživatel v jiné zóně může vidět posunuté dny (neověřeno) |

**Zavedeno (29. 10. 2026, issue #37):** `TZ=Europe/Prague` pro jednotkové testy v CI, aby se
lokální a CI běh nelišily. **Navrženo:** jednotkový test českého řazení; testy pomocných
funkcí pro datum přes hranici půlnoci a přechod letního času; E2E a API ověření
stálých míst pro město s diakritikou. Diakritika a české formáty patří mezi
povinné třídy vstupů podle pravidla B5.5.

---

## Část B: Návrh test automation frameworku

### B1. Struktura projektu a rozdělení odpovědností

```
tests/
  harness.js              # backend: načte .gs do Node vm sandboxu se stuby Google API
  frontend-harness.js     # frontend: vytáhne funkce z Index.html, bez DOM
  unit.test.js            # jednotkové testy backendu (node:test)
  frontend.test.js        # jednotkové testy frontendu
  robot/
    resources.robot       # sdílené proměnné: URL, testovací profil, timeouty, DATUM_RE
    api.robot             # API kontrakt (RequestsLibrary)
    frontend.robot        # E2E UI (Browser Library, Chromium) + sdílená klíčová slova
    requirements.txt      # připnuté verze RF knihoven
cloudflare-worker/*.test.mjs   # testy workeru, samostatná sada
api-tests/                # cvičné sady SoapUI, Bruno, JMeter (výuka nástrojů, mimo CI)
.github/workflows/        # pipeline: node-tests, rf-tests, publikovat-report, worker
.github/scripts/          # generátor veřejného reportu, pojistka souladu testů s architekturou
```

Odpovědnosti: **harness** odděluje testy od platformy (Google Apps Script), takže
jednotkové testy nepotřebují síť ani Google. **resources.robot** drží vše, co se
mění podle prostředí. **Testy** obsahují scénáře a aserce, **klíčová slova**
opakované kroky (přihlášení, plný cyklus označení).

Stav: **zavedeno.** Navrženo do budoucna: až E2E sada naroste zhruba na
dvojnásobek, rozdělit `frontend.robot` podle oblastí, které už dnes odpovídají
tagům (mapa, kalendář, filtry, zápisy), s vlastním setupem každé suity.

### B2. Konkrétní prvky frameworku

| Prvek (pojem z kurzu) | Jak je řešený zde | Příklad |
|---|---|---|
| Page objecty | Robot Framework nepoužívá třídy stránek; jejich roli plní **klíčová slova nad stabilními selektory** (`data-*` atributy přímo v appce) | `Přihlásit se do radaru`, `Otevřít radar na mobilním viewportu` |
| Vrstva opakovaných kroků | sdílená klíčová slova ve `frontend.robot` | `Ověřit plný cyklus označení (přidat i odebrat) s reloadem` (★, ✓ i 🏛) |
| Fixtures | `Suite Setup` (otevření prohlížeče, přihlášení testovacího profilu), `[Teardown]` s návratem stavu; v Node harness se stuby | `Otevřít radar`; teardown `Nastavit ikonu první karty na` |
| Testovací data | testovací profil `rf-test`, výchozí město Brno, dynamicky vybraná města (s diakritikou, dosud neprohledaná) | město s diakritikou se vybírá za běhu z dat API |
| Stuby a mocky | stuby Google API v harnessu; služby, které unit test nemá použít, vyhazují výjimku | `UrlFetchApp` v unit testu = okamžitý pád |
| Fault injection | ruční, v prohlížeči (zpožděná odpověď přes obal `fetch`) | důkaz závodu odpovědí v3.61 |

### B3. Data, konfigurace a credentials

- **Testovací data** nejsou v souborech: E2E testy pracují s produkčními daty a
  ověřují **invarianty a strukturu**, ne konkrétní hodnoty (TESTY.md, 4.6).
  Jednotková data jsou přímo v testech (malé, čitelné vstupy).
- **Co vzniká za běhu:** označení ★/✓/🏛 a nastavení notifikací testovacího
  profilu; vše se v testu nebo teardownu vrací do původního stavu.
- **Výběr prostředí:** proměnné `RADAR_URL`, `RADAR_SITE_URL` a `RF_FRAME`
  (statický web, nebo Apps Script v iframu) s výchozími hodnotami
  v `resources.robot`.
- **Timeouty:** čekání na server v proměnných `CEKANI_ZAPIS`,
  `CEKANI_PRIHLASENI` a `CEKANI_NAVIGACE`; výchozí hodnoty platí lokálně, CI je
  zvyšuje přes `--variable` (Apps Script v CI odpovídá pomaleji; hodnoty pro CI
  ověří první plánovaný běh 1. 11. 2026). **Opakování padlých testů** záměrně
  není (viz C3).
- **Secrets:** PIN testovacího profilu, ntfy téma a tokeny nikdy nejsou v repu:
  lokálně v proměnných prostředí, v CI v GitHub Secrets. V klíčových slovech se
  PIN zadává přes `Fill Secret`, volání s tajnou hodnotou běží při vypnutém
  logování a CI před nahráním reportů hledá tajné hodnoty v souborech
  (zavedeno po incidentu #33).

### B4. Základní pravidla pro tým

| Oblast | Pravidlo |
|---|---|
| Pojmenování testů | česká věta popisující chování a očekávaný výsledek, u regresí verze s chybou: „Přepnutí na město s diakritikou načte jeho akce (regrese v3.65)“ |
| Selektory | jen strukturální `data-*` atributy a ID, nikdy pozice nebo text, který se mění s daty; chybí-li atribut, přidá se do appky (AUDIT-SELEKTORU.md) |
| Vrstva klíčových slov | kroky opakované aspoň ve dvou testech nebo kroky s vlastní logikou čekání se vytahují do klíčového slova |
| Flaky testy | postup v C3; tag `krehky` nově jen po prokázání vnější příčiny (dnešních 12 označených testů čeká na revizi, viz Známé mezery) |
| Ownership | jediný vlastník (Vojta); AI agent píše a opravuje testy podle pravidel tohoto dokumentu a skillu, vlastník schvaluje diff |
| Test management | GitHub Issues a board, defekty formulářem a v pohledu Defekty (DEFEKTY.md); tagy RF (`smoke`, `api`, `ui`, `zapis`, `regrese`, `mapa`, `filtr`, `kalendar`, `notifikace`, `kontakt`, `krehky`) slouží k výběru sad |
| Tajné hodnoty | nikdy v kódu, issue ani logu; ověřuje se počítáním výskytů, nikdy vypsáním hodnoty |

### B5. Pravidla test designu

1. **Jeden test ověřuje jedno chování.** Průchod více kroky je v pořádku, pokud
   všechny kroky vedou k ověření téhož chování (plný cyklus označení:
   přidat, reload, ověřit, odebrat, reload, ověřit).
2. **Aserce jsou v testu nebo ve sdíleném klíčovém slově, které je součástí
   ověřovaného chování.** `resources.robot` a pomocná klíčová slova pro navigaci
   aserce neobsahují. K prvkům se test dostává přes stabilní selektory.
3. **Test ověřuje obsah, ne existenci.** Nestačí, že stránka nebo odpověď
   existuje: kontroluje se formát data, počet karet po filtru, změna obsahu po
   přepnutí. Čekání na „nějaký prvek“ nestačí, protože projde i nad starým
   stavem stránky (poučení z v3.62).
4. **Nezávislost testů.** Každý test, který zapisuje, vrací stav (teardown s
   bezpečnou výchozí hodnotou nastavenou před rizikovým krokem). Testy ve
   `frontend.robot` sdílejí jednu stránku prohlížeče kvůli rychlosti, proto
   test, který přepne město, ho na konci vrací. Paralelní běh dnes není
   podporovaný (C4). Audit z 28. 10. ukázal, že stav se dnes vrací hlavně na
   úspěšné cestě a po pádu testu zůstane sdílená stránka v cizím stavu; náprava
   je dávka 1 v [AUDIT-SOULADU-TESTU.md](../audity/AUDIT-SOULADU-TESTU.md).
5. **UI, nebo API?** Na UI patří jen to, co vzniká v prohlížeči (vykreslení,
   interakce, napojení na API). Kontrakt dat se ověřuje na API, logika
   jednotkově. Data se testují nezávisle na městě, ale **ze všech tříd
   ekvivalence vstupů** (s diakritikou, bez ní, prázdné město), protože část
   analyzovaných defektů unikla právě kvůli jediné třídě vstupů (jen Brno, jen
   textové datum; DEFEKTY.md).
6. **Data se mohou měnit:** chybějí-li podmínky ke spuštění, test se hlasitě
   přeskočí (`Skip If`), neprojde naprázdno.

---

## Část C: CI/CD a provoz testů

### C1. Testovací sady

| Sada | Obsah | Spouštění | Blokuje | Kdo sleduje |
|---|---|---|---|---|
| Jednotkové testy | 630 testů backendu a frontendu (Node) | každý push a PR | nasazení (pravidlo vlastníka: nenasazuje se s červenou) | vlastník, odznak v README |
| Statická kontrola testů | `robot --dryrun` celé RF sady (syntaxe, existence klíčových slov, argumenty) | každý push a PR | nasazení | vlastník |
| Pojistka souladu s architekturou | počty porušení pravidel B4, B5 a C3 proti baseline (`.github/scripts/kontrola-architektury-testu.py`); selže, když porušení přibude | každý push a PR | push s novým porušením | vlastník |
| Kontrola počtů testů v README | porovná tabulku „Testy v číslech“ se skutečností (Node, RF přes robot.api, worker) | každý push a PR | push s rozdílem | vlastník |
| Mutační testování | Stryker (`node tests/mutace/spustit.js --kriticke`) mutuje kopii backendu a ověřuje, že jednotkové testy mutaci zachytí; postup v [MUTACNI-TESTOVANI.md](MUTACNI-TESTOVANI.md) | ručně (kritická sada ~3 min, celý backend ~40 min), zatím ne v CI | nic | vlastník |
| Kontrola soupisu nástrojů v README | `.github/scripts/kontrola-nastroju.py` (jen čte): nástroje ze zdrojů v repu (`package.json`, `requirements.txt`, knihovny v `.robot`, akce třetích stran, `clasp`, `wrangler`, `api-tests/`, unpkg) musí mít řádek s identifikátorem v tabulkách sekce „Nástroje a technologie“; samotest vč. negativních zkoušek | každý push a PR (job `rf-dryrun`) | push s nástrojem bez řádku | vlastník |
| Kontrola boardu a defektů | `.github/scripts/kontrola-boardu.py` a `kontrola-defektu.py` (jen čtou): pole boardu, stavy, WIP limit, Odhad u Todo, lhůty defektů, checklisty, soulad BACKLOG.md a DEFEKTY.md s issues; `navrh-session.py` navrhuje práci podle času | automaticky denně 6:40 UTC workflow `kontrola-projektu.yml` (v pondělí týdenní souhrn, jinak notifikace ntfy jen při nálezu), ručně při „Start“ a „End“ | nic (nálezy se opraví před další prací) | vlastník (ntfy); token `BOARD_READ_TOKEN` je classic jen se scope `read:project`, protože fine-grained token uživatelský projekt číst neumí; riziko je přijatelné (jen čtení, veřejný obsah, na účtu jediný projekt, platnost do 27. 1. 2027 s připomínkou #51), viz [DEFEKTY.md](../kvalita/DEFEKTY.md), Kontrola úplnosti |
| Testy workeru | 7 testů e-mailového webhooku | push se změnou `cloudflare-worker/**` | nasazení workeru | vlastník |
| Smoke po nasazení | 11 E2E a API testů s tagem `smoke` | ručně po každém nasazení | další práci, dokud neprojde | vlastník |
| Týdenní regrese | API (9) a E2E (52) proti produkci | plán, neděle 20:20 UTC (21:20 SEČ, 22:20 SELČ; od 28. 10. 2026, dřív 19:00 UTC; GitHub plánované běhy zdržuje, dřívější skutečný start byl zhruba 2 až 4 h po plánu); ručně | nic automaticky; selhání = úkol na další session | notifikace na telefon (jen plánované běhy), veřejný report |
| Publikace reportu | stažení artefaktu, kontrola úniku, nasazení na GitHub Pages | po dokončení týdenní regrese (automatické spuštění ověří běh 1. 11.; ručně ověřeno) | nic | veřejné, hodnotitelé |

Obecný linter (ESLint, Robocop) ani kontrola typů zavedené nejsou; konvence
specifické pro tento projekt hlídá pojistka souladu. Zavedení Robocopu je
**navrženo** jako levný další krok.

### C2. Umístění testů a pipeline

- **Všechny testy jsou v repozitáři aplikace** (monorepo): projekt má jednoho
  vlastníka a testy se mění spolu s kódem ve stejném commitu, samostatný
  testovací repozitář by jen přidal synchronizaci.
- **Nasazení není v pipeline** (frontend `git push` na Cloudflare Pages, backend
  přes `clasp`), takže testy běží v **samostatné testovací pipeline**. Proto je
  ruční smoke po nasazení povinný krok workflow, ne volitelný.
- **Prostředí a credentials do pipeline:** URL z GitHub Secrets a proměnných
  `--variable`, přihlašovací údaje testovacího profilu ze Secrets.
- **Čas, prostředí a commit běhu** jsou vidět v běhu GitHub Actions a na úvodní
  stránce veřejného reportu (datum, způsob spuštění, commit, odkaz na běh).

### C3. Práce s flaky testy

**Zavedeno:**

- **Pád analyzuje vlastník** (s agentem) postupem ze skillu: nikdy nepředpokládat
  „je to jen flake“, izolovaný rerun, u zápisových testů ověřit skutečný stav
  dat, hledat vzorec napříč běhy (padá pokaždé jiný test → vnější vliv; padá
  stále týž → spíš chyba).
- **Padlé testy se automaticky neopakují** (žádný `--rerunfailed`). Opakování
  by schovalo závody odpovědí, které se v tomto projektu dvakrát ukázaly jako
  skutečné chyby v appce (mapa 21. 8., přepínání měst v3.61). Od toho se liší
  dvě věci, které opakováním pádu nejsou: `Wait Until Keyword Succeeds` ve čtyřech
  místech čeká na optimistickou odezvu ikony (dotazování na stav, ne opakování
  testu) a appka sama od v3.63 při HTTP 404 jednou zopakuje čtení nebo
  idempotentní zápis (filtry, nastavení notifikací), nikdy přepínače, přihlášení
  ani placené akce (vlastnost produktu, ne testu).
- **Tag `krehky`** dnes nese 12 testů, označených historicky za náchylnost na
  časování (zápisy, mapa, kalendář, sticky hlavička, responzivní pásma). U mapy
  a kalendáře se příčina později ukázala jako chyba v appce (v3.55). Pravidlo
  platné od teď: tag jen po prokázání vnější příčiny, kterou nejde rozumně
  odstranit (zátěž Apps Scriptu); stávajících 12 testů projde revizí.

**Navrženo (karanténa):** test, který padá ve dvou ze čtyř týdenních běhů
s prokázanou vnější příčinou, dostane tag `karantena` a v týdenní regresi poběží
v samostatném kroku, jehož selhání nespouští notifikaci. Z karantény se vrací po
opravě příčiny a třech zelených bězích. Pokud příčinu nejde odstranit a test
nemá jinou hodnotu, přesune se ověření na nižší úroveň (unit nebo API), nebo do
ručního kontrolního seznamu.

### C4. Výkon a paralelizace

- **Paralelizace se nepoužívá, záměrně.** Zápisové testy sdílejí jeden testovací
  profil a Apps Script má kvóty a pod souběžnou zátěží zpomaluje. Paralelní běh
  by předpokládal izolaci dat (samostatný testovací profil na workera).
- **Rychlost:** jednotkové testy zhruba 1 s, týdenní regrese 3 až 5 minut.
  Hlídá se délka běhu v Actions a timeouty v CI (B3).
- **Izolace dat:** vyhrazený profil `rf-test` (nikdy rodinný), návrat stavu
  v každém zápisovém testu, kontrola stavu dat po nestandardním běhu.
- **Na CI infrastruktuře** se sleduje hlavně odezva Apps Scriptu (příčina většiny
  nestabilit), ne prostředky runneru.
- **Jen při selhání** se ukládají screenshoty (Browser Library je pořizuje
  automaticky u padlého kroku).

### C5. Reporting a artefakty

| Co | Kde | Poznámka |
|---|---|---|
| Chybová hláška a log kroků | `log.html`, `report.html`, `output.xml` v artefaktu běhu | retence 30 dní |
| Screenshot | v artefaktu, jen při selhání | nezveřejňuje se (může zachytit dialog s ntfy tématem profilu a kontrola úniku obrázky neumí číst) |
| Ladicí log Playwrightu | nenahrává se | zapisuje hodnoty z DOM mimo dosah logování RF |
| Prostředí, commit, odkaz na běh | GitHub Actions, úvodní stránka veřejného reportu | |
| Veřejný report | [akimto01.github.io/Kulturni_radar](https://akimto01.github.io/Kulturni_radar/) | jen `report.html` a `log.html`, po kontrole úniku |

Každý artefakt před nahráním projde **kontrolou úniku tajných hodnot**; při nálezu
se nenahraje a běh selže.

---

## Část D: Reporting, observabilita a hodnota automatizace

Kapitola pokrývá témata 4. týdne kurzu podle jeho osnovy (reporting,
observabilita, analýza selhání, důvěryhodnost a hodnota automatizace).

### D1. Reporting a observabilita

- **Výsledky testů:** odznaky v README, veřejný report, notifikace na telefon při
  selhání plánovaného běhu (doručení na telefon ověřeno 28. 10. na ručních bězích,
  podmínku pro plánovaný běh ověří běh 1. 11.).
- **Observabilita produkce** (doplněk testů): týdenní samotest a audit dat v Apps
  Scriptu, denní watchdog, týdenní report kvality dat. Řada defektů byla vidět
  nejdřív v datech, ne v testech (DEFEKTY.md).

### D2. Analýza příčin selhání

Postup je popsaný v C3. Každý skutečný defekt projde životním cyklem
v DEFEKTY.md včetně **analýzy úniku** (na které úrovni měl být chycen a proč
nebyl) a končí regresním testem nebo pojistkou.

### D3. Metriky automatizace

Hodnoty k 28. 10. 2026, spočítané z historie GitHub Actions, gitu a DEFEKTY.md.

| Metrika | Dnes | Cíl | Komentář |
|---|---|---|---|
| Spolehlivost týdenní regrese | 7 z 22 běhů zelených (31 %); od 23. 8. jen 2 ze 17 | aspoň 3 ze 4 posledních týdenních běhů zelené | nízké číslo je poctivý výchozí bod: deset týdnů nikdo nesledoval |
| Doba do odhalení selhání CI | 66 dní (23. 8. až 28. 10.) | do 1 dne | notifikace při selhání plánovaného běhu, ověří běh 1. 11. |
| Rychlost zpětné vazby | jednotkové testy 0,8 s, workflow medián 12 s; týdenní regrese medián 3 min 39 s | jednotkové pod 2 s, týdenní pod 6 min | |
| Stabilita rychlé sady | 231 z 232 běhů `node-tests.yml` zelených (99,6 %) | udržet | jediný červený běh 4. 8. |
| Podíl defektů odhalených automatizací | 2 z 8 (25 %); u závažnosti S1 a S2 1 ze 4 | aspoň 40 % | ostatní odhalila živá kontrola (4) a analýza (2), viz DEFEKTY.md |
| Stáří defektu při odhalení | #31 80 dní, #17 78 až 86 dní | sledovat u nových defektů | dlouhé stáří = slepé místo sady |
| Údržba testů | 75 z 92 commitů měnících appku mění i testy (81 %); 22 commitů mění jen testy | sledovat podíl oprav testů bez chyby v appce | rozlišení „oprava testu“ vs. „nový test“ zatím ručně |
| Pokrytí kódu backendu | 92,0 % řádků, 85,0 % větví (Node, harness, k 29. 10. 2026) | neklesat, kritické funkce podle [POKRYTI.md](POKRYTI.md) nad 70 % | CI zatím jen vypisuje, bez prahu; kritické funkce pod 70 % nejsou žádné (seznam z #35 je hotový kromě scénáře #48) |
| Pokrytí kódu frontendu | 98,9 % řádků ve vykrojených funkcích (57 ze 113, 440 z 445 řádků), 25,3 % celého skriptu `Index.html` (440 z 1736 řádků); Node, `tests/pokryti-frontendu.js` | neklesat, zvyšovat podíl vykrojených funkcí | zbytek skriptu (vykreslování, mapa, kalendář, obsluha událostí) pokrývá jen E2E; tabulka z `--experimental-test-coverage` u `Index.html` nesedí, proto vlastní skript |
| Soulad s architekturou | baseline porušení 11 / 9 / 11 / 61 / 0 / 11 / 6 / 12 (pojistka v CI) | klesat k nule po dávkách issue #34 | |
| Síla testů | mutační ověření nových testů ručně (12 záznamů v CHANGELOGu) | průběžně, doplňuje ho metrika níže | ruční mutace zůstávají u nových testů, Stryker pokrývá vybrané funkce |
| Mutační skóre kritických funkcí | 82,4 % (448 mutantů v 10 kritických funkcích z [POKRYTI.md](POKRYTI.md): 369 zabito, 65 přežilo, 14 bez pokrytí; Stryker, 29. 10. 2026, po dávce 1 z #13; výchozí hodnota 78,1 %) | neklesat, zvyšovat po dávkách testů z #13; práh se stanoví po triáži přeživších (ekvivalentní mutanty se odečtou) | ručně, zatím ne v CI; postup a výklad v [MUTACNI-TESTOVANI.md](MUTACNI-TESTOVANI.md) |

**Co se zatím měřit nedá:** mutační skóre celého backendu průběžně (kritická sada se měří ručně),
nestabilita po jednotlivých testech (artefakty expirují po 30 dnech) a cena běhu
mimo minuty GitHub Actions.

**Metriky slouží k rozhodování, ne k vykazování:** nízká spolehlivost regrese
vedla k notifikacím a delším čekáním v CI, nízký podíl defektů z automatizace
k auditu souladu a k pravidlu tříd vstupů (B5.5).

---

## Část E: Jak architektura vznikala

### E1. Časová osa

Architektura nevznikla podle návrhu předem. Rostla po vrstvách a téměř každá
vrstva přibyla jako odpověď na konkrétní incident. Tento dokument je zpětný
popis toho, kam se došlo, doplněný o rozhodnutí do budoucna.

| Kdy | Co přibylo | Spouštěč |
|---|---|---|
| 1. 8. | první verze v repu (v2.8) bez automatických testů | chyby se hledaly ručně |
| 2. 8. | první jednotkové testy v Node s harnessem a stuby Google API (v2.9, 20 testů); první RF testy (API přes RequestsLibrary, frontend přes Browser Library) a týdenní workflow, harness rozšířený o stub `UrlFetchApp` (v3.4); test živosti ntfy kanálu | samotest a datová hygiena (v2.9); chybná data v kartách, sériová čísla místo dat (v3.3) |
| 3. 8. | frontend harness pro čisté funkce z `Index.html` (v3.6) | logika frontendu šla testovat jen přes prohlížeč |
| 8. 8. | vyhrazený testovací profil `rf-test`, zápisové testy s návratem stavu, testy pro dvě prostředí (statický web a Apps Script v iframu), sdílený `resources.robot` | uživatelské profily a přechod na statický web; regulární výraz pro datum se do 7. 8. ve dvou souborech rozjel |
| 9. 8. | secrets testovacího profilu v CI | E2E sada se dva dny tiše přeskakovala (secrets chyběly) a běh byl přesto zelený |
| 21. 8. | audit testovacího dluhu v pěti krocích, regresní testy, první diagnóza nestabilit | série desítek běhů ukázala, že zápisy pod zátěží Apps Scriptu selhávají |
| 20.–27. 8. | API nástroje SoapUI, Bruno, JMeter (E2) | procvičení nástrojů proti skutečnému API |
| 23. 8. | stabilní `data-*` selektory v appce (v3.57) | audit selektorů po redesignu |
| 29. 8. | tagy RF sady (`smoke`, `zapis`, `krehky`…) | výběr podmnožin: smoke po nasazení, vynechání zápisů při opakovaných bězích |
| 8. 10. | repo veřejné, Secret scanning, testovací plán TESTY.md přepracovaný podle ISO 29119 | příprava na quality check |
| 26.–27. 10. | fault injection v prohlížeči, systematické mutační ověřování nových testů, dry run RF při každém pushi, strukturální selektory pro zbytek sady (v3.64) | závod odpovědí v3.61 a test, který čekal na staré karty |
| 28. 10. | notifikace při selhání, kontrola úniku tajných hodnot, veřejný report, delší čekání v CI, správa defektů | deset tichých červených týdnů, únik tajných hodnot (#33) |

**Co z toho plyne pro návrh:** reaktivní růst vedl k sadě, která chrání přesně
ta místa, kde se chyby už staly, ale slabá místa jinde zůstávala neviditelná
(proto 6 z 8 říjnových defektů nenašly automatické testy). Části A až D tento
stav převádějí na vědomá rozhodnutí: riziková analýza místo reakce na incidenty.

### E2. API nástroje mimo hlavní sadu

Vedle RF API testů vznikla v srpnu samostatná sada v `api-tests/` pro procvičení
nástrojů **SoapUI (ReadyAPI)**, **Bruno** a **JMeter** proti produkčnímu API:

- **SoapUI a Bruno:** stejných 8 scénářů (struktura `?api=meta`, přihlášení se
  správným a špatným PINem, zápis označení s platným a neplatným profilem,
  e-mailový webhook s platným a chybějícím tokenem, požadavek bez akce).
  Výsledek 8/8 v obou nástrojích (27. 8. 2026). Zápisové scénáře používají
  testovací profil, ale **stav samy nevracejí**: přepnutí označení při každém
  běhu změní ★ (druhý běh ji vrátí), po běhu se stav ověřoval a vracel ručně,
  a scénář e-mailového webhooku založí testovací řádek ve frontě. Na rozdíl od
  RF sady, kde zápisové testy uklízí teardown, je to známé omezení cvičné sady.
- **JMeter:** jednoduchý zátěžový plán se záměrně nízkým počtem vláken (Apps
  Script má sdílené kvóty a část volání stojí peníze za AI).
- **Proč mimo CI:** sada slouží k procvičení nástrojů, pokrytí API v CI
  zajišťuje RF. Duplikovat by ji znamenalo udržovat stejné scénáře dvakrát.

**Nejcennější poučení:** v SoapUI vracely všechny POST požadavky HTTP 405,
i když curl se stejným tělem fungoval. Diagnóza ukázala, že Apps Script na POST
odpovídá přesměrováním na jednorázovou URL, která přijímá jen GET; prohlížeč,
curl i Bruno metodu při přesměrování změní na GET, SoapUI ji zachová. Stejný
mechanismus přesměrování (jednorázová „echo“ URL) stojí i za opakováním
požadavku při HTTP 404 v appce (v3.63): když se ztratí odpověď z echo URL,
skript na serveru už proběhl, proto se opakují jen čtení a idempotentní zápisy.

## Známé mezery a další kroky

| Mezera | Návrh |
|---|---|
| Chybí obecný linter testů (pojistka souladu hlídá jen konvence projektu) | zavést Robocop v pipeline jednotkových testů |
| Lokalizační mezery (A4) | řazení podle češtiny, přechod letního času, stálá místa s diakritikou |
| Počty testů se v dokumentech rozcházely | jediný zdroj je tabulka „Testy v číslech“ v README; od 29. 10. 2026 ji hlídá CI skriptem `.github/scripts/kontrola-poctu-testu.py` (issue #45) |
| Tag `krehky` u 12 testů z doby před pravidlem | revize: ponechat jen u prokázané vnější příčiny |
| Karanténa flaky testů není v kódu | zavést podle C3 při prvním opakovaném vnějším pádu |
| Jedna velká E2E suita | rozdělit podle oblastí po dalším růstu (B1) |
| Opakované scénáře s různými vstupy jsou psané jako samostatné testy | data-driven testy (`Test Template`): toggle ★/✓/🏛, neplatné PINy, responzivní pásma |
| Bez paralelizace | jen s izolací dat (víc testovacích profilů), dnes nevýhodné |
| Kapitola D | porovnat s obsahem 4. týdne kurzu po jeho zveřejnění |
| Stávající testy neodpovídají pravidlům B4, B5 a C3 | audit [AUDIT-SOULADU-TESTU.md](../audity/AUDIT-SOULADU-TESTU.md) (20 porušení, plán v 10 dávkách po plánovaném běhu 1. 11. 2026); pojistka proti nárůstu `.github/scripts/kontrola-architektury-testu.py` běží v CI v jobu `rf-dryrun` |

## Historie dokumentu

| Datum | Změna |
|---|---|
| 28. 10. 2026 | První verze podle osnovy kurzu (týdny 1–3, týden 4 podle popisu modulu), část E: vznik architektury a API nástroje |
| 28. 10. 2026 | Konsolidace dokumentace: A4 lokalizace, D3 metriky s hodnotami a cíli, vazba A3 na rizika v TESTY.md, pojistka souladu v C1 |
| 28. 10. 2026 | D3: metrika pokrytí kódu backendu (82,2 % řádků), pokrytí odebráno z toho, co se neměří |
| 29. 10. 2026 | D3: metrika pokrytí kódu frontendu (98,9 % vykrojených funkcí, 25,3 % celého skriptu), skript `tests/pokryti-frontendu.js` |
| 29. 10. 2026 | D3: pokrytí backendu 84,6 % řádků a 81,3 % větví po dávce 1 z #35 (harness se stubem tabulky, zámku a triggerů; `setupTriggers` a `watchdogDailyCheck` 100 % řádků) |
| 29. 10. 2026 | D3: pokrytí backendu 86,8 % řádků a 81,7 % větví po dávce 2 z #35 (platba AI v `runCheck_` a `dailyCheck`, obě 100 % řádků); `runCheck_` odebrána ze seznamu funkcí pod 70 % |
| 29. 10. 2026 | D3: pokrytí backendu 90,1 % řádků a 82,6 % větví po dávce 3 z #35 (`updateMista`, `callAnthropicPlaces_`, `apiNajdiProUzivatele_` 100 % řádků); ze seznamu funkcí pod 70 % zůstává `apiToggle_` |
| 29. 10. 2026 | D3: pokrytí backendu 90,3 % řádků a 83,0 % větví po dávce 3b z #35 (`spustKontroluCore_`, `menuRunNow` a obsazený zámek ve `zpracovatSledovanaMesta` pod testem) |
| 29. 10. 2026 | D3: pokrytí backendu 92,0 % řádků a 85,0 % větví po dávce 4 z #35 (`apiSetFiltry_`, `apiToggle_`, `nastavPin_`, přehledy a `notifyFail_` 100 % řádků); mezi funkcemi pod 70 % žádná kritická nezůstává |
| 29. 10. 2026 | C1: řádek Kontrola boardu a defektů (ruční skripty při konci session, ne v CI) |
| 29. 10. 2026 | C1 a D3: mutační testování Strykerem (řádek v C1, metrika mutační skóre kritických funkcí 78,1 %), [MUTACNI-TESTOVANI.md](MUTACNI-TESTOVANI.md) |
| 29. 10. 2026 | D3: mutační skóre kritických funkcí 82,4 % po dávce 1 z #13 (`parseCzDate_`, `apiSetFiltry_`, `apiToggle_`, `runCheck_`, `apiNajdiProUzivatele_`; 18 mutantů zabito, bonusem #226 v `upsertEvents_`; `serioveCisloNaDatum_` 100 %), backend 413 na 421 testů |
| 29. 10. 2026 | C1: kontrola boardu a defektů běží automaticky (workflow `kontrola-projektu.yml`, token jen pro čtení) |
