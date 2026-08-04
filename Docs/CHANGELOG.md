# Changelog

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
