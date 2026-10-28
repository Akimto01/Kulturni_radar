# Audit souladu testů s architekturou – Kulturní radar

Audit stávajících testů proti pravidlům z [ARCHITEKTURA-TESTU.md](../testovani/ARCHITEKTURA-TESTU.md),
plán jejich oprav a pojistka, která hlídá, aby porušení nepřibývala.

## Úvod

**Proč.** Dokument [ARCHITEKTURA-TESTU.md](../testovani/ARCHITEKTURA-TESTU.md) (28. 10. 2026) popisuje
pravidla, podle kterých se testy mají psát. Testy ale vznikaly dřív a po vrstvách
(viz část E tohoto dokumentu). Audit zjišťuje, kolik stávajících testů pravidla
porušuje a jaký to má dopad, aby se opravy daly plánovat podle přínosu, ne podle
pořadí v souboru.

**Proti čemu.** Pravidla B4 (selektory, pojmenování), B5.2 až B5.6 (umístění asercí,
čekání na obsah, nezávislost testů, třídy vstupů, chybějící data) a C3 (tag `krehky`).
Pravidlo B5.1 (jeden test, jedno chování) se nehodnotilo.

**Metoda.** Čtení kódu: celý `tests/robot/frontend.robot`, `api.robot` a `resources.robot`
(stav repa k commitu `b9e1023`, 61 testů). U unit testů (`tests/*.test.js`) jen
mechanické kontroly: žádné `skip` ani `todo`, žádný sdílený stav na úrovni modulu,
každý test má aserci a diakritika je pokrytá. Nic se nespouštělo proti produkci.
**Dopad každého porušení je odhad autora**, ne měření. Čísla řádků míří na začátek
problematického bloku a po úpravách testů se posunou.

**Hlavní závěr.** Nejvážnější nejsou jednotlivé testy, ale jejich vztah ke sdílené
stránce: 44 z 52 E2E testů nemá `[Teardown]`, takže po pádu zkreslují testy za sebou.
Druhý největší problém je 9 testů, které při chybějících datech jen zalogují varování
a projdou bez jediné aserce. Pravidlo B5.2 (aserce mimo test) nikde porušené není.

## Tabulka porušení

Seřazeno podle dopadu: skrývá selhání, snižuje udržovatelnost, kosmetika.

| # | Pravidlo | Test | Soubor:řádek | Popis porušení | Dopad | Odhad |
|---|---|---|---|---|---|---|
| 1 | B5.6 | 9 testů: Opakované přepnutí profilu, Klik na podkategorii-chip, Kalendář klik na den, Kalendář hover, Seznam míst pod mapou, Klik na titulek karty, Klik na řádek v seznamu míst, Klik na pin otevře popup, Tlačítko „Zobrazit v seznamu“ | frontend:325, 440, 447, 878, 890, 906, 964, 977, 1012, 1046, 1075 | Bez dat jen `Log level=WARN`, test projde bez jediné aserce. Dřívější údaj v TESTY.md (10 testů) neseděl, skutečně je to 11 řádků v 9 testech. | skrývá selhání | 1 až 1,5 h |
| 2 | B5.5 | Events vrací akce s validními českými datumy | api:55 | Kontroluje jen výchozí profil (Brno). Chyba #17 postihla hlavně jiná města (Brno 2, Praha 4, Znojmo 5 ze 6). Stejně slabé jsou E2E obdoby frontend:345 a 369. | skrývá selhání | 45 min |
| 3 | B5.3, B5.5 | Events umí filtrovat podle profilu; Places vrací stálá místa se skóre; Events obsahují lat/lng | api:82, 90, 71 | :82 má Ostravu natvrdo a ověřuje jen echo `profil` (Ostrava byla naposledy kontrolována 1. 8.). :90 slibuje „skóre“, ale testuje jen počet ≥1, a to bez profilu. :71 čte jen `[akce][0]`, při prázdném seznamu IndexError. | skrývá selhání | 1 h |
| 4 | B5.3 | Chip Oblíbené, Chip Neověřeno, Chip „Oblíbená místa“ filtruje bez zápisu | frontend:592, 609, 708 | Test projde, když `#status` existuje, a `#status` vzniká i při chybě nebo načítání, takže projde i na rozbité appce. Výchozí počet karet `${vsech}` se bere bez čekání na karty a z toho plynou známé pády `0 != N`. Navíc fixní Sleep (viz #16). | skrývá selhání, flaky | 1,5 h |
| 5 | B5.4 | Testy s vlastní stránkou: Přihlašovací obrazovka, Anonymní režim, Špatný PIN, Odhlášení, Stránka bez JS chyby | frontend:27, 86, 108, 130, 806 | `Close Page` je jen na konci úspěšné cesty bez Teardownu. Po pádu zůstane aktivní cizí stránka a následující testy běží nad ní. Odpovídá běhu #9, kde seznam padlých začíná právě těmito testy. | skrývá selhání (kaskáda maskuje příčinu) | 20 min |
| 6 | B5.4 | ★ promítne do filtru, ★, ✓, 🏛 a sdílená klíčová slova | frontend:628, 667, 680, 690 (+ kw 1173, 1185) | Teardown přes `Run Keyword And Ignore Error` polyká selhání. Test i teardown berou `.karta >> nth=0`, po Reloadu může být první karta jiná (nová akce, přelom dne). Doloženo: ★ zůstala u rf-test po bězích #6 až #14 a po #17. | skrývá selhání (data drift bez signálu) | 1 až 1,5 h |
| 7 | B5.4 | Notifikace: vygenerování ntfy tématu… | frontend:217 | Zapisuje, ale nemá `[Teardown]`. Doloženo po #22: u rf-test zůstal zapnutý ntfy kanál s tématem. | zanechá pozměněná data | 30 min |
| 8 | B5.4 | 22 testů bez návratu sdíleného stavu | 59, 302, 391, 406, 426, 549, 592, 609, 708, 842, 860, 898, 967, 991, 1032, 1061; dialogy 150, 167, 194, 728, 737, 756 | Změna stavu (město, kategorie, typ místa, měsíc kalendáře, popup, dialog) se vrací jen na úspěšné cestě. Příklad: po pádu na :842 běží :860 a :898 v jiném měsíci, skončí ve WARN větvi a projdou. | skrývá selhání (kaskáda) | 1,5 až 2 h (jeden suite-level Test Teardown) |
| 9 | B5.3 | Odhlášení vrátí appku do anonymního režimu | frontend:142 | Čeká na `.karta nth=0`, kterou splní i karty z přihlášeného stavu. Následná kontrola „overlay == 0“ proběhne hned, takže pozdě otevřený login overlay by prošel. | skrývá selhání | 15 min |
| 10 | B5.3, B5.4 | Klik na pin otevře popup; Tlačítko „Zobrazit v seznamu“ | frontend:1049, 1078, 1032 | Čekání na `.leaflet-popup` splní popup z předchozího testu (:1032 ho nezavírá). :1061 čte `.zvyrazneno` hned po kliku bez čekání. | skrývá selhání, flaky (nízké) | 30 min |
| 11 | B5.5 | Přepnutí na město s diakritikou | frontend:59 (74 až 84) | Ověřuje jen karty akcí. Chyba v3.65 postihla i stálá místa (0 akcí i 0 míst). | skrývá selhání (částečně) | 20 min |
| 12 | B4 selektory | 8× selektor podle textu v kategorie-chipech | frontend:397, 402, 416, 419, 421, 438, 442, 460 | `>> text=koncerty`, `text=Vše`, `text=festivaly`, přestože chipy mají `data-kat` (`vytvorChip`). | udržovatelnost | 15 min |
| 13 | B4 selektory | 3× text hlášky prázdného stavu | frontend:75, 82, 329 | `text=Tohle město appka ještě nikdy neprohledala.`. `#status` nemá datový atribut, je třeba přidat `data-stav` do appky (Index.html, nasadit oba kanály). | udržovatelnost | 45 min |
| 14 | B4 selektory | Pozice karty `nth=` (61× celkem, z toho 38× `.karta >> nth=0`) | např. 99, 483, 496, 512, 587, 642, 1160, 1180, 1204, 1218 | U idiomu „libovolná karta“ je to přijatelné (strict mode). U konkrétní karty (toggle ★/✓/🏛, odkazy) má být `data-id`, které část testů už používá (:649, :660). Částečně se řeší v #6. | udržovatelnost | 1 h |
| 15 | B5.3 | Slabé aserce na existenci: Hlavička, Profil dialog, Přepínač profilů, Chipy kategorií, Sekce stálých míst, Karty mají ikony, Mapa se vykreslí | frontend:21, 150, 297, 340, 464, 582, 939 | :297 projde s 1 volbou z 32, :340 stačí ≥4 chipů. :582 nečeká na karty a hlásí `0 != 1`, i když chybí karty (viz chyby běhů #7 a #9). | udržovatelnost, nízká citlivost | 1 h |
| 16 | B5.3 (duch pravidla) | Fixní `Sleep` 11× (10× 300 ms, 1× 200 ms) | 568, 576, 598, 604, 617, 623, 648, 659, 717, 723, 1097 | Chipy překreslují synchronně (ověřeno 26. 10.), Sleep je zbytečný a nechrání před `0 != N`. | udržovatelnost | 30 min (součást #4) |
| 17 | B5.5 | Filtr kategorie omezí karty; Klik na podkategorii-chip | frontend:391, 438, 445 | Natvrdo „koncerty“, „festivaly“, „dětský“ a komentář „Koncerty v Brně vždycky nějaké jsou“, tedy předpoklad dat jednoho města. | udržovatelnost | 30 min |
| 18 | B4 pojmenování | 8 vágních názvů, 6 regresí bez verze, šum v názvech | 21, 297, 340, 464, 498, 517, 582, 939; regrese 43, 130, 345, 369, api:30, api:55; šum 43, 86, 108, 130, 825, 924 | „Chipy kategorií se vykreslily“, „Políčko počasí se zobrazuje správně“ nemají očekávaný výsledek. Šum: „(vlastní stránka)“, „#kalendar-toggle“. Při přejmenování je třeba opravit odkazy v dokumentech a skillu. | kosmetika | 45 min |
| 19 | B5.3 | 7× `.karta nth=0 visible` po kliku na chip | frontend:398, 420, 422, 443, 450, 455, 461 | Čekání splní i starý stav, ale filtr je synchronní, takže to neškodí. | kosmetika | v rámci #4 |
| 20 | kosmetika | Překlep „espere“ v dokumentaci testu | frontend:112 | Překlep, jinak nic. | kosmetika | 1 min |

**B5.2 (aserce mimo test):** bez porušení. `resources.robot` má 0 aserčních
klíčových slov a pomocná klíčová slova ověřují jen své chování.

## Tag `krehky` (C3)

Pravidlo: tag jen po prokázání vnější příčiny, kterou nejde rozumně odstranit
(ARCHITEKTURA-TESTU.md, C3). Dnes ho nese 12 testů.

| Test (řádek) | Co víme o příčině | Podle pravidla |
|---|---|---|
| ★ promítne do filtru (628), ★ (667), ✓ (680), 🏛 (690) | Čekání na zápis do Apps Scriptu: 2 až 4 s, v CI přes 10 s (#17, #21, #22). U #6 až #14 jen nepřímá shoda, částečně vlastní chyba testu (pozice první karty). | ponechat, vnější příčina je doložená (CI hodnoty ověří běh 1. 11.) |
| Mapa mobil (924) | Jednou timeout `page.goto` v #17 (vnější). Dříve race v appce (v3.55, opraveno). | ponechat do ověření 1. 11. |
| Kalendář mobil (825) | Jen historie #14 až 19: race v appce a chybné selektory v testech (v3.55). Od té doby žádný pád. | odebrat |
| Mapa se vykreslí (939) | Závislost na Leaflet CDN, oprava ve v3.55. Žádný pád od té doby. | odebrat |
| Seznam míst (948) | Závislost na datech, řeší ji WARN větev. Žádný zaznamenaný pád. | odebrat |
| Klik na řádek v seznamu míst (991) | Jako 948, od v3.57 má `data-klic`. | odebrat |
| Sticky hlavička (1086) | Preventivní (BACKLOG: pixelové testy jsou „nejkřehčí kategorie“), tolerance 1 px a `Sleep 200 ms`. Žádný pád. | odebrat |
| Responzivní střední (1106), široké (1127) | Preventivní, přesně 656 px, závisí na viewportu. Žádný pád. | odebrat |

Testy s doloženými pády, které `krehky` nemají: chip testy (`0 != N`, 6 pádů v #6 až #15),
Chip typu stálého místa, Kalendář hover (#15) a Notifikace ntfy téma (#22). Příčina je
ve stavu sdíleném mezi testy, v appce nebo v testu, ne vnější, takže tag správně nemají.
Opravit je má dávka 3, 4 nebo 6 níže, ne tag.

## Plán oprav po dávkách

Dávky začnou **až po plánovaném běhu v neděli 1. 11. 2026**. Ten ověřuje změny CI
z 28. 10. (delší čekání, notifikace jen u plánovaných běhů, publikace reportu) a mění
se vždy jedna proměnná naráz, takže se do testů do té doby nezasahuje.

Pořadí podle dopadu: nejdřív dávka 1 (zastaví kaskádové pády), pak 2, 3, 5, 4 a 7.

| Dávka | Obsah | Testy | Odhad | Stav |
|---|---|---|---|---|
| 1 | Úklid sdílené stránky: suite-level Test Teardown a `[Teardown] Close Page` | 27, 86, 108, 130, 806 (+ všechny testy sdílené stránky) | 1,5 až 2 h | čeká |
| 2 | B5.6 mapa: `WARN` na `Skip If` | 948, 967, 991, 1032, 1061 | 45 min | čeká |
| 3 | B5.6 kalendář, přepnutí profilu, podkategorie | 860, 898, 302, 426 | 1 h | čeká |
| 4 | Chip testy: baseline karet, oracle místo `#status`, bez Sleep | 592, 609, 708, 549 | 1,5 h | čeká |
| 5 | Zápisové testy ★/✓/🏛: teardown a klíčová slova na `data-id` | 628, 667, 680, 690 | 1 až 1,5 h | čeká |
| 6 | Notifikace a dialogy: teardown | 217, 150, 167, 194 | 45 min | čeká |
| 7 | API třídy vstupů: datumy přes víc profilů, obsah místo echa | api 55, 82, 90, 71 | 1 až 1,5 h | čeká |
| 8 | B5.5 a textové selektory: místa u diakritiky, `data-kat`, `data-stav` (Index.html) | 59, 345, 391, 406 | 1,5 h | čeká |
| 9 | Názvy a existenční aserce | 21, 297, 340, 464, 582 | 1 h | čeká |
| 10 | Revize tagu `krehky`: odebrat u sedmi testů, u ponechaných doplnit „Příčina nestability:“ | 825, 939, 948, 991, 1086, 1106, 1127 | 30 min | čeká |

Celkem zhruba 11 až 13 h, v issue vedeno jako 12 h.

### Rozhodnutí k dávce 1

- **Suite-level Test Teardown** obnovuje výchozí stav sdílené stránky **jen při selhání
  testu** (`Run Keyword If Test Failed`). Důvod: zátěž Apps Scriptu. Obnova při každém
  testu by přidala kliky a načítání na stovky běhů, které by prošly, a prodloužila by
  týdenní běh i riziko timeoutů. Při selhání se obnova vyplatí, protože zabrání
  kaskádě pádů.
- Obnova sdílené stránky zavře cizí stránky, dialogy a popupy, vrátí kategorie na „Vše“,
  původní profil, aktuální měsíc kalendáře a scroll nahoru.
- **Testy s vlastní stránkou** (27, 86, 108, 130, 806) dostanou `[Teardown] Close Page`.
  Testy s vlastním kontextem už `Close Context CURRENT` mají.

## Co se hlídá automaticky a co jen checklistem

### Automaticky: pojistka proti nárůstu (ratchet)

Skript `.github/scripts/kontrola-architektury-testu.py` (jen `robotframework` a standardní
knihovna, soubory pouze čte) běží v CI v jobu `rf-dryrun` workflow `node-tests.yml` při
každém pushi. Spočítá porušení, porovná je s `.github/scripts/baseline-architektury-testu.json`
a **selže, jen když některý počet vzroste**. Při poklesu vypíše výzvu ke snížení baseline.

| Metrika | Pravidlo | Co se počítá | Baseline (28. 10. 2026) |
|---|---|---|---|
| `warn_v_testech` | B5.6 | `Log … level=WARN` v těle testu | 11 |
| `testy_bez_teardownu` | B5.4 | test s `New Page`, `New Context`, `Select Options By`, `Otevřít radar na mobilním viewportu` nebo tagem `zapis` bez `[Teardown]` (suite-level Test Teardown pokrývá všechny) | 9 |
| `text_selektory` | B4 | argument s `text=` ve volání klíčového slova | 11 |
| `nth_selektory` | B4 | výskyty `nth=` ve volání klíčového slova | 61 |
| `aserce_v_resources` | B5.2 | `Should*` a `Get Text` v `resources.robot` | 0 |
| `sleep_bez_povoleni` | B5.3 | `Sleep` bez komentáře `# povoleno:` na řádku | 11 |
| `regrese_bez_verze` | B4 | test s tagem `regrese` bez `vX.YY` v názvu | 6 |
| `krehky_bez_pricin` | C3 | test s tagem `krehky` bez řádku „Příčina nestability:“ v `[Documentation]` | 12 |

Postup při práci:

- **Nové porušení** způsobí chybu CI s výpisem míst. Oprav ho, baseline se nezvyšuje.
- **Oprava** sníží počet. Skript vypíše `::notice::`, pak spusť
  `python .github/scripts/kontrola-architektury-testu.py --zapsat-baseline` a
  commitni novou baseline (přepíše se jen tehdy, když nic nevzrostlo).
- Lokální spuštění z kořene repa: `python .github/scripts/kontrola-architektury-testu.py`.

Ověřeno 28. 10. 2026: dnešní stav projde (exit 0), synteticky přidané porušení všech osmi
metrik v dočasné kopii mimo repo selhalo (exit 1), pokles počtu vypsal výzvu a suite-level
Test Teardown snížil `testy_bez_teardownu` z 9 na 0.

Robocop zatím nepřidán, zůstává navržený jako levný další krok (ARCHITEKTURA-TESTU.md, C1).

### Jen checklistem

Tyhle věci automatika neodhalí a při psaní i revizi testu se kontrolují ručně
(dvě otázky jsou i ve skillu):

- **Zvolil jsem aspoň dvě třídy vstupů?** (B5.5: s diakritikou i bez, prázdné město,
  jiný profil než výchozí.) Počet tříd vstupů se ze zdrojového kódu spolehlivě nepozná.
- **Splní toto čekání i starý stav stránky?** (B5.3: čekání na „nějaký prvek“ po akci,
  která mění obsah.) Sémantika čekání se strojově nehodnotí.
- Pravdivost příčiny u tagu `krehky`: skript ověří jen přítomnost řádku „Příčina
  nestability:“, ne to, že je doložená.
- Jestli pomocné klíčové slovo opravdu patří k ověřovanému chování (B5.2) mimo
  `resources.robot`.

## Navazující práce

Sledováno v issue „Sjednocení testů s architekturou (AUDIT-SOULADU-TESTU.md)“ s kontrolním
seznamem deseti dávek. Související položka v BACKLOGu: revize tagu `krehky`
(dávka 10), nestabilní chip testy (dávka 4).

## Historie dokumentu

| Datum | Změna |
|---|---|
| 28. 10. 2026 | První verze: audit 61 testů, tabulka 20 porušení, plán 10 dávek, pojistka v CI |
