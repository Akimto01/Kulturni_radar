# Audit selektorů v Index.html — návrh (BACKLOG.md „Audit/úklid selektorů")

Stav: body **A, B, C implementovány a nasazeny 23. 8. 2026** (Index.html v3.57,
viz CHANGELOG.md). Body D–H zůstávají jen návrhem k případnému budoucímu
schválení.
Vychází z `apps-script/Index.html` ke commitu `d81f913` (21. 8. 2026) a
`tests/robot/frontend.robot` ke stejnému stavu repa (23. 8. 2026).

## Shrnutí

Appka už dnes používá konzistentní, záměrný vzor pro stabilní selektory
opakovaných prvků — `data-*` atributy vedle CSS tříd, protože ID musí být
na stránce jednoznačné a `.karta`/`.chip`/`.dlazdice-uzivatel` apod. se
vykreslují opakovaně. Tenhle vzor je dokonce jednou přímo okomentovaný v
kódu jako záměr („stabilní selektor pro RF testy"). Audit níže **rozšiřuje
stejný vzor** na místa, kde ještě chybí — nejde o novou konvenci, jen o
důslednější aplikaci té současné.

Nejcennější 2 nálezy (obě jsou vysoká priorita) mají přímý důkaz v
`frontend.robot` — existující test/komentář si na chybějící atribut
sám stěžuje nebo se mu záměrně vyhýbá:

1. `.kalendar-den` buňky nenesou datum → test „Klik na den v kalendáři…"
   to obchází přes `Evaluate JavaScript` čtením interních JS proměnných
   appky (`kalendarRok`, `kalendarMesic`, `isoDatum_`), což komentář u
   testu sám označuje za křehké („test je tak vázaný na tyhle konkrétní
   názvy… může tiše spadnout bez souvislosti se skutečným bugem").
2. Tlačítko „Zobrazit v seznamu" v popup okně mapového pinu nenese ID
   akce, i když ho má appka po ruce → test „Tlačítko „Zobrazit v seznamu"…"
   to sám v dokumentaci přiznává: „Neověřuje KTEROU konkrétní kartu (to by
   vyžadovalo párovat konkrétní pin s konkrétní kartou)".

## 1. Inventář současného stavu

### 1a. Statické jednoznačné ID (appka „chrome" — hlavička, dialogy, ovládací lišty)

Tahle vrstva je **kompletně pokrytá** — každý statický, jednou-na-stránce
prvek (header, `#controls`, `#controls-oznaceni`, `#login-*`, `#filtry-*`,
`#token-*`, `#kontakt-*`, `#kalendar-*`, `#mapa-*`) má vlastní ID. Nic
tady neschází, žádná změna navržena.

### 1b. Existující `data-*` vzory u OPAKOVANÝCH prvků (repeated elements)

| Prvek | Atribut | Kde se nastavuje | Poznámka |
|---|---|---|---|
| `.karta` (karta akce) | `data-id`, `data-kat` | `vytvorKartu()`, řádek 1764–1765 | `data-kat` navíc řídí i CSS barvu levého okraje (řádky 321–326) |
| `.nazev` (titulek karty, klikatelný) | `data-klic` | `vytvorKartu()`, řádek 1781 | souřadnicový klíč, páruje kartu s pinem na mapě |
| `.chip` v `#kat-chips`/`#podkat-chips` | `data-kat` | sdílená `vytvorChip()`, řádek 2778 | stejná funkce pro obě sady chipů → konzistentní |
| `.dlazdice-uzivatel` (login dlaždice) | `data-uzivatel-id` | `zobrazitLogin()`, řádek 1190 | **už dnes okomentováno jako záměrný RF-test hák** („v3.13→doplněk: stabilní selektor pro RF testy") |
| `.den-hlavicka` (denní skupina v seznamu) | `id="den-YYYY-MM-DD"` | `renderAkce()`, řádek 1724 | jen když jde datum naparsovat; cíl pro skok z kalendáře |

Tohle je vzor, který audit níže následuje — ne nová konvence.

## 2. Nalezené mezery

### 🔴 Vysoká priorita — má přímý dopad na existující RF test (self-dokumentovaný)

**A. `.kalendar-den` — buňky kalendářní mřížky nenesou datum**

- Kód: `vykreslitKalendar()`, `Index.html:2033–2046` — buňka dostane jen
  `textContent` (číslo dne) a třídy `.ma-akce`/`.bez-akce`, žádné ISO datum.
- Data jsou přitom po ruce: `sestavKalendarMrizku_()` (řádek 1995) vrací
  pro každou buňku `{ den, iso, maAkce }` — `b.iso` se v `vykreslitKalendar()`
  jen zahodí.
- Dopad na test: `frontend.robot:750–773` („Klik na den v kalendáři…")
  musí datum ke konkrétní buňce dohledat přes `Evaluate JavaScript`
  voláním interní funkce `isoDatum_()` a čtením proměnných
  `kalendarRok`/`kalendarMesic` přímo — komentář testu to sám označuje
  jako křehké vůči budoucímu přejmenování.
- **Návrh:** `cell.dataset.iso = b.iso;` (jen když `b.iso` existuje,
  tj. `b.den != null`) v `vykreslitKalendar()`, řádek ~2036.
- **Zjednodušení testu:** `#kalendar-mrizka .kalendar-den[data-iso="${cil_iso}"]`
  by šlo použít přímo — ale protože `cil_iso` se dnes hledá teprve
  ITERACÍ přes buňky (protože žádná neví svoje datum), skutečný benefit je
  otočit hledání: `Get Element Count … .kalendar-den.ma-akce[data-iso]`
  a `Get Attribute` na první takové rovnou vrátí ISO bez volání
  `Evaluate JavaScript` a bez závislosti na názvech interních proměnných.

**B. `.mapa-popup-btn` („Zobrazit v seznamu" v popup okně Leaflet pinu) — nenese ID akce**

- Kód: `sestavPopupMapy_()`, `Index.html:2251–2255` — `btn` volá
  `zvyraznitAkci_(polozka.id)` v closure, ale `polozka.id` se nikam
  na element nezapíše.
- Dopad na test: `frontend.robot:915–929` (test sám v dokumentaci píše:
  „Neověřuje KTEROU konkrétní kartu (to by vyžadovalo párovat konkrétní
  pin s konkrétní kartou), jen že se zvýraznění vůbec spustí").
- **Návrh:** `btn.dataset.id = polozka.id;` v `sestavPopupMapy_()`,
  řádek ~2252.
- **Zesílení testu:** po kliknutí na `.mapa-popup-btn[data-id="X"]" by
  šlo přímo ověřit `.karta[data-id="X"].zvyrazneno` místo obecného
  „nějaká karta má `.zvyrazneno`" — přesně to, co dnešní dokumentace
  testu označuje jako chybějící.

### 🟡 Střední priorita — funkční mezera, zatím bez přímého RF dopadu (testy se jí vyhýbají přes `nth=0`/podmínky, ale fungují)

**C. `.mapa-misto` (řádek v seznamu míst pod mapou) — nenese souřadnicový klíč**

- Kód: `vykreslitSeznamMist_()`, `Index.html:2304–2325` — `radek` má jen
  třídu `mapa-misto`/`vybrano`, `m.klic` zůstává jen v closure pro
  `click`. Stejný klíč (`klicSouradnic_`) přitom appka JIŽ vystavuje na
  `.nazev[data-klic]` (bod 1b výše) — nejde o nový koncept, jen o
  dosazení na další místo, kde se používá.
- Test dnes (`frontend.robot:865–884`, „Klik na řádek v seznamu míst…")
  vždy klikne na `nth=0` a ověřuje jen obecně, že NĚJAKÝ pin dostal
  `.pin-vybrany` — funguje, ale nešlo by ověřit, že jde o SPRÁVNÝ pin.
- **Návrh:** `radek.dataset.klic = m.klic;`

**D. `.misto-karta` (karta „stálého místa" — Kavárna, Muzeum…) — bez jakéhokoli identifikátoru**

- Kód: `prekreslitMista()`, `Index.html:2751–2768` — `el` nemá ani `id`,
  ani `data-*`, jen text (`.misto-nazev`, `.misto-meta`).
- API `places` (viz `readMista_` v `kulturni_radar.gs:2959`) nevrací
  vlastní `id`, jen `nazev`/`typ`/`obec`/`doba`/`skore` — přirozený
  stabilní klíč je `nazev + obec`, stejný princip jako
  `klicMistoUkladani_()` už používá pro páry akce↔místo
  (`a.misto + '|' + a.obec + ':misto'`, `Index.html:1930`).
- **Návrh:** `el.dataset.misto = m.nazev + '|' + m.obec;`
- Dnešní test (`frontend.robot:385–388`, „Sekce stálých míst existuje")
  jen počítá karty, žádnou konkrétní nevybírá — návrh nic nerozbíjí,
  jen umožní budoucí přesnější testy.

**E. `.btn-url` odkazy/tlačítka v `.karta-akce` (Více info / Do kalendáře / Mapa / Sdílet) — rozlišitelné jen textem**

- Kód: `vytvorKartu()`, `Index.html:1882–1920` — všechny čtyři sdílí
  třídu `btn-url`, liší se jen `textContent`/emoji a (u odkazů) `href`.
- Dopad na test: `frontend.robot:390–419` dnes cíleně čte celý text
  `.karta-akce` a hledá podřetězec (`Should Contain … 'Do kalendáře'`)
  — funguje, ale je to textová (a tedy jazykově vázaná) shoda, ne
  strukturální selektor.
- **Návrh:** `link.dataset.akce = 'vice-info'` / `'kalendar'` / `'mapa'`;
  `btnSdilet.dataset.akce = 'sdilet'`. Umožnilo by např.
  `.karta[data-id="X"] .btn-url[data-akce="kalendar"]` bez nutnosti
  znát/hledat český text tlačítka.
- Riziko zaměnitelnosti: nízké — atribut se přidává vedle textu, ne
  místo něj, žádný dnešní test na `data-akce` nezávisí, takže nic
  nerozbije.

### 🟢 Nízká priorita / volitelné — kosmetická konzistence, malý/žádný testovací přínos

**F. Chipy typu „stálého místa" (`#mista-sekce` — Vše/Kavárna/Muzeum…) — nekonzistentní se zbytkem appky**

- Kód: `prekreslitMista()`, `Index.html:2724–2734` — chipy se staví
  ručně (`document.createElement('button')` + `className`), NE přes
  sdílenou `vytvorChip()` (ta se používá jen pro kat-chips/podkat-chips)
  → chybí `data-kat`/`data-typ`, ačkoliv `vytvorChip()` už přesně tenhle
  vzor řeší jinde v appce.
- Dopad na test: `frontend.robot:460–471` dnes cíleně používá
  `#mista-sekce .chip >> nth=1` (druhý chip = první konkrétní typ, ne
  „Vše") — funguje, protože „Vše" je vždy první, ale je to pozičně
  křehčí, než by muselo být.
- **Návrh:** buď `ch.dataset.typ = t;` (a `vseChip.dataset.typ = ''`),
  nebo rovnou nahradit ruční `createElement` voláním `vytvorChip(text,
  aktivni)` + set `data-typ` navíc (menší úklid kódu jako bonus,
  přesně v duchu položky BACKLOG.md „a úklid HTML").

**G. `.mapa-stat` buňky (mini statistika výběru — počet akcí/míst/kategorií)**

- Kód: `vykreslitStatistikuVyberu_()`, `Index.html:2352–2368` — 3 buňky
  vždy ve stejném pevném pořadí (akcí, míst, kategorií).
- Protože pořadí je pevné a nikdy se neliší, dnešní implicitní
  poziční přístup (`nth-child`) je fakticky stejně spolehlivý jako
  atribut — návrh je čistě kosmetický.
- **Návrh (volitelný):** `bunka.dataset.stat = 'akci' | 'mist' | 'kategorii';`
  — spíš čitelnost/konzistence než skutečná potřeba.

**H. Skupina „Probíhá / dlouhodobé" v seznamu akcí — jediná `.den-hlavicka` bez ID**

- Kód: `renderAkce()`, `Index.html:1712–1717` — na rozdíl od datovaných
  skupin (`id="den-YYYY-MM-DD"`) tahle jediná statická skupina žádné ID
  nedostává.
- Dopad: nízký — v appce existuje nejvýš jednou, dá se najít přes
  `.den-hlavicka` s textem, žádný dnešní test na ni necílí přímo.
- **Návrh (volitelný):** `h.id = 'den-probiha';` — jen kvůli symetrii
  s ostatními skupinami, ne kvůli konkrétní potřebě.

## 3. Souhrnná tabulka (seřazeno podle priority)

| # | Prvek | Návrh atributu | Priorita | Riziko regrese | RF test, který by profitoval |
|---|---|---|---|---|---|
| A | `.kalendar-den` | `data-iso="YYYY-MM-DD"` | 🔴 vysoká | velmi nízké (čistě přidání) | „Klik na den v kalendáři svolá k odpovídající sekci" |
| B | `.mapa-popup-btn` | `data-id="<id akce>"` | 🔴 vysoká | velmi nízké | „Tlačítko „Zobrazit v seznamu"…" |
| C | `.mapa-misto` | `data-klic="<souřadnicový klíč>"` | 🟡 střední | velmi nízké | „Klik na řádek v seznamu míst…" |
| D | `.misto-karta` | `data-misto="<nazev>\|<obec>"` | 🟡 střední | velmi nízké | (zatím žádný, otevírá možnost) |
| E | `.btn-url` v `.karta-akce` | `data-akce="vice-info\|kalendar\|mapa\|sdilet"` | 🟡 střední | velmi nízké | „Karta má odkaz Do kalendáře/Mapa", „Karta má tlačítko Sdílet" |
| F | `#mista-sekce .chip` (typy míst) | `data-typ="<typ>"` (+ refaktor na `vytvorChip()`) | 🟢 nízká | nízké (mění i JS strukturu, ne jen HTML) | „Chip typu stálého místa filtruje…" |
| G | `.mapa-stat` | `data-stat="akci\|mist\|kategorii"` | 🟢 nízká/volitelné | žádné | — |
| H | `.den-hlavicka` „Probíhá" | `id="den-probiha"` | 🟢 nízká/volitelné | žádné | — |

Řazeno podle poměru přínos/riziko — A a B mají nejsilnější odůvodnění
(existující test na ně přímo naráží), F je jediná položka, která mění i
JS strukturu (ne jen přidává atribut), proto je nejnižší i přes malé
absolutní riziko.

## 4. Dopad na `tests/robot/frontend.robot`

- **Nic z návrhu by nerozbilo existující testy** — všechny navržené
  změny jsou čistá PŘÍDAVKA atributů vedle toho, co appka dnes posílá
  do DOM, žádný existující `class`/`id`/text se neodstraňuje ani nemění.
- **Testy, které by šlo reálně zesílit/zjednodušit** (viz sloupec výše):
  konkrétně A a B mají už dnes v kódu vlastní komentář přiznávající
  mezeru, takže jde o nejčistší případ „návrh řeší zdokumentovaný dluh",
  ne hypotetické vylepšení.
- **Testy, které NEPOTŘEBUJÍ žádnou změnu** (pro úplnost, aby bylo jasné,
  že návrh neignoruje kontext): vzory `.karta >> nth=0 >> …` používané
  ve testech ikon (★/✓/🏛, `frontend.robot:481–482,590`) cíleně testují
  „první kartu aktivního profilu", ne konkrétní business-významnou
  kartu — tam `data-id` už dnes existuje a používá se přesně tam, kde
  je potřeba (`frontend.robot:529`, `Get Attribute … data-id`). Nejde o
  mezeru, je to záměrný a funkční vzor.
- Žádná navržená změna nevyžaduje úpravu `tests/robot/resources.robot`
  ani proměnných prostředí (`RF_TEST_USER_ID` apod.).

## 5. Co NEnavrhuji měnit

- **Statické ID appky (`#header`, `#controls`, dialogy…)** — už dnes
  kompletní, netřeba nic přidávat.
- **`.karta[data-id]`/`[data-kat]`, `.chip[data-kat]`, `.dlazdice-uzivatel[data-uzivatel-id]`,
  `.nazev[data-klic]`** — existující vzor, funguje dobře, nic k opravě.
- **`.ikona-oznaceni.hvezda/fajfka/misto`** — už dnes dostatečně
  selektovatelné kombinací `.karta[data-id="X"] .ikona-oznaceni.hvezda`
  (třída nese sémantiku typu ikony, karta nese identitu) — přidávat
  další atribut by bylo zbytečné zdvojení.
- **`.leaflet-marker-icon`/`.leaflet-popup`** — vykresluje knihovna
  Leaflet, appka do jejich struktury nezasahuje (a neměla by).

## 6. Poznámky k případné implementaci (až po schválení)

- Formát navrhovaných `data-*` hodnot drží stejnou konvenci, jakou appka
  už používá jinde: syrová textová hodnota (kategorie, ID, klíč), žádné
  JSON kódování v atributu.
- U položek B, C, D jde o hodnoty, které appka v okamžiku vykreslení
  UŽ MÁ v proměnné (closure) — návrh je jen `el.dataset.X = promenna;`
  o řádek navíc, ne nový výpočet.
- Položka F je jediná, kde má smysl uvažovat o širším refaktoru (sdílet
  `vytvorChip()` místo ruční duplicity) — to je ale úklid kódu nad
  rámec „jen přidat atribut", takže by chtělo samostatné posouzení, ne
  automaticky součást stejné dávky změn.
- Žádná položka nevyžaduje bump `VERZE`číslovaně nad rámec běžné praxe
  appky (drobná HTML/JS úprava, ne funkční změna chování).
