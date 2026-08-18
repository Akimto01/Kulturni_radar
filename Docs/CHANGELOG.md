# Changelog

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
