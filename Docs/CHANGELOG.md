# Changelog

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
