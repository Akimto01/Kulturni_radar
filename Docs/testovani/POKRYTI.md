# Matice pokrytí – Kulturní radar

Doplněk k `Docs/testovani/TESTY.md` (plán: **co a proč** se testuje) a k
`Docs/testovani/ARCHITEKTURA-TESTU.md` (**jak** se testy píšou a běží). Tahle matice
ukazuje, **co** je pokryté, na které úrovni a co ne.

## Jak číst matici

| Zkratka | Úroveň | Soubor |
|---|---|---|
| **BE** | Node unit – backend | `tests/unit.test.js` |
| **FE** | Node unit – frontend (čisté funkce) | `tests/frontend.test.js` |
| **W** | Node unit – worker | `cloudflare-worker/email-webhook.test.mjs` |
| **API** | RF – API kontrakt | `tests/robot/api.robot` |
| **E2E** | RF – UI v prohlížeči | `tests/robot/frontend.robot` |
| **PROV** | Provozní kontroly v produkci | `runSelfTest` (unit test čte jen jeho zdrojový text, funkci nespouští), `watchdogDailyCheck`, `auditDat_` |
| **RUČ** | Ruční ověření | reálný telefon, vizuální kontrola, spot-check LLM |

Celkové počty testů na jednotlivých úrovních jsou jen v [README](../../README.md),
tabulka „Testy v číslech“, a tady se neopakují. U Node testů jsou uvedené
hlavní testované funkce, ne přesné počty. U RF testů je v oblastech uveden
počet testů dané oblasti a tagy, přesný seznam dá
`python -m robot.testdoc tests/robot/`.

Matice vznikla podle názvů testů, od 28. 10. 2026 ji koriguje měření pokrytí řádků
backendu (Node, `--experimental-test-coverage`; hodnoty u funkcí jsou z něj).

Hodnocení pokrytí: **●** silné (více úrovní, včetně regresí) · **◐** částečné
(jedna úroveň nebo jen část chování) · **○** žádné nebo jen ruční.

## A. Pokrytí podle rizik

Rizika R1–R11 odpovídají sekci 3 v `Docs/testovani/TESTY.md` (R9 až R11 přibyly 28. 10. 2026).

| Riziko | BE / FE / W | API | E2E | PROV / RUČ | Pokrytí |
|---|---|---|---|---|---|
| **R1** Špatná data akcí | BE: `parseEvents_`, `cellText_`, sériová čísla dat (BUG v3.2), `eventToRow_`, `upsertEvents_`, `najdiDuplicity_`, `isSameName_`, `jeVycpavka_` | Events s validními českými datumy | Hlavičky dnů jsou česká data, dlouhodobé akce bez minulých hlaviček | `auditDat_`, samotest; ruční schválení duplicit (list NÁVRH DUPLICIT) | ● |
| **R2** Produkce běží na jiné verzi než repo | BE: konstanta `VERZE` souhlasí s hlavičkou | Nasazená verze backendu odpovídá repu | – (verze frontendu na Cloudflare se netestuje) | Po nasazení ruční smoke; konkrétní verze frontendu se neověřuje | ◐ |
| **R3** Ztráta nebo poškození označení | BE: `toggleOznaceni_` (izolace uživatelů), `apiToggle_` (100 % řádků od 29. 10.: neplatný typ, odznačení, neexistující akce, izolace uživatelů; k tomu E2E round-trip), `apiToggleMisto_`, sirotci v OZNAČENÍ | – | ★ / ✓ / 🏛 round-trip s reloadem, integrace ★ → filtr | Ruční kontrola dat po nestandardním běhu | ● |
| **R4** Nedoručené notifikace | BE (měření 29. 10. 2026, mutacemi ověřené): `sendNotification_`, `odeslatNotifikaci_`, `spojitPrijemce_`, `planNotifikaceUzivatele_`, `jeDueNaNotifikaci_`, `digestProUzivatele_`, `notifyFail_`, `weeklyDigest`, `weekendDigest`, `digestRange_` a `watchdogDailyCheck` 100 % řádků, `notifyOk_` 97 %, `sendUserNotifications_` 92 % (dry-run i reálné); testy ověřují obsah a předmět notifikací, rozsah dat (týdenní 7 dní, víkendový pátek až neděle včetně nejbližšího pátku pro každý den v týdnu), extra příjemce `NOTIFY_EMAIL_VIKEND` jen u víkendu a selhání s `notifyFail_` a propuštěnou výjimkou; chybí obálka triggeru `sendUserNotifications` (0 %, bez hlášení chyb) a hlídání jejího triggeru v samotestu, tedy defekt #48: právě výpadek doručování uživatelům zůstává bez ochrany | Kanál ntfy je živý | Nastavení notifikací, plný cyklus s návratem | `sendUserNotifications` (trigger, #48) | ◐ |
| **R5** Rozbití jednoho ze dvou prostředí | FE: `sestavFetchPozadavek_` (GET/POST routy) | – | Celá sada spustitelná proti statickému webu i Apps Scriptu (`FRAME`), regrese odhlášení | – | ◐ |
| **R6** Zbytečně utracený API kredit | BE: všechny placené cesty jsou nad 70 % řádků (měření 29. 10. 2026) a každá má test ochran: `runCheck_` a `dailyCheck` (100 %: zámek obsazený, chybějící klíč nebo zdroje, chyba AI nic nezapíše, model v požadavku, deduplikace), `zpracovatSledovanaMesta` (97,6 %: přeskočení dnes hotových měst, rozpočet podle délky města, obsazený zámek bez AI i počasí), `updateMista` a `callAnthropicPlaces_` (100 %: zámek, chyba AI, párování míst podle klíče, model), `apiNajdiProUzivatele_` (100 %: token před AI, zámek, filtry uživatele v dotazu), e-mailové tipy (`apiEmailTip_` s testem tokenu, `zpracovatEmailTipy_` nad 95 %), webové spuštění `spustKontroluCore_` a `menuRunNow` (100 %: token, cooldown včetně hranice, jediný trigger, nastavení `WEB_LAST_RUN`), `routePost_` odmítne špatný token před dražší operací; ochrany jsou ověřené mutacemi (bez kontroly zámku, tokenu a cooldownu, kontrola tokenu za voláním AI, zápis před voláním AI, chybný model; každá shodí test) | Spuštění kontroly s neplatným tokenem odmítnuto | Token dialog a „Najít akce pro mě“ bez spuštění | – | ● |
| **R7** Zneužití formuláře nebo webhooku | BE: `apiKontakt_` (limit, cooldown), `apiEmailTip_` (token, limit); W: webhook | Neplatný token, neznámý endpoint | Prázdná zpráva, odeslání a cooldown | – | ● |
| **R8** Rozbité rozvržení | – | – | Sticky header, dvě responzivní pásma, mobilní toggle mapy a kalendáře | Vizuální kontrola, reálný telefon | ◐ |
| **R9** Načtení akcí pro zvolené město | FE: `sestavFetchPozadavek_` (diakritika escapovaná), `api()` předá serveru čistý název města pro events i places (4 testy, v3.65), stráž pozdní odpovědi v `nactiAkce` a `nactiMista` (4 testy, v3.61), `hlaskaPrazdnehoStavuProProfil_` (3 testy) a zobrazený profil v `nactiAkce` (1 test), v3.62 | Events umí filtrovat podle profilu (jen Ostrava, slabé) | Přepnutí na město s diakritikou (jen karty akcí, ne místa), Opakované přepnutí profilu | Živá kontrola ostatních měst přes appku | ◐ |
| **R10** Únik tajných hodnot z testovací infrastruktury | – | – | PIN přes `Fill Secret`, téma ntfy bez zápisu do logu | Kontrola úniku v `rf-tests.yml` a `publikovat-report.yml` (nehledá v PNG, ty se před zveřejněním mažou), Secret scanning; ruční výměna hodnot po #33 | ◐ |
| **R11** Tiché selhání automatizace | – | – | – | Notifikace ntfy při selhání plánovaného běhu (zatím jen ruční běhy, plánovaný ověří 1. 11. 2026), veřejný report, pojistka souladu testů (`kontrola-architektury-testu.py`) | ◐ |

Hodnocení ◐ mají R2 a R5 (viz níže), R4 (po dávce 4 z #35 jsou odesílací cesty pokryté a ověřené mutacemi, ale defekt #48, tj. nehlídaný a nehlášený trigger `sendUserNotifications`, zůstává otevřený; po jeho opravě a testu se zvedne na ●) a nová R9 až R11. R6 je od 29. 10. 2026 znovu ● (po dávkách 2 až 3b z #35, viz řádek v historii).

U R2 API test porovnává `VERZE` z repa s verzí, kterou hlásí produkční
`/exec`. Tím zachytí třeba situaci z 8. 8., kdy `clasp deploy` bez `-i` nechal
produkci na staré verzi. Problém je, že běží jen v neděli nebo ručně, takže se
případný nesoulad neodhalí hned po nasazení. Zároveň hlídá jen backend. Verzi
`Index.html` nasazeného přes Cloudflare Pages dnes žádný test přímo
neověřuje.

U R5 frontend běží jako statický web na `kulturniradar.cz` i uvnitř Apps
Script iframu. RF sada umí obě varianty přes proměnnou `FRAME`, ale CI ji
spouští jen proti statickému webu. Iframe se tak ověřuje jen při ručním běhu.

Obojí je za mě zatím přijatelný kompromis. Nasazení dělám ručně a po něm
pouštím smoke. Co tomu ale chybí, je kontrola konkrétní verze frontendu a
iframe varianty v CI. Nejjednodušší další krok by proto byl přidat do smoke
kontrolu verze frontendu a spouštět smoke v CI i s `FRAME`.

## B. Pokrytí podle funkčních oblastí

| # | Oblast | BE / FE / W (hlavní funkce) | API | E2E | Pokrytí |
|---|---|---|---|---|---|
| 1 | Hledání akcí přes AI a parsování odpovědi | BE: `parseEvents_` (vč. useknuté odpovědi, `pause_turn`, konce řádků), `callAnthropic_`, rubrika skóre v promptu, `jeVycpavka_` | – | – | ◐ (obsah LLM ručně) |
| 2 | Data a datumy v Sheetu | BE: `cellText_`, `cellTextCas_`, `parseCzDate_`, `dateKey_`, `eventToRow_`, `upsertEvents_`; FE: `parseCeskeDatum`, `isoDatum_` | Validní česká data | Hlavičky dnů, dlouhodobé akce | ● |
| 3 | Detekce duplicit | BE: `najdiDuplicity_`, `isSameName_`, `normNazev_`, `nazevTokens_`, `denZeSerie_`, `ruznyDenSerie_`, `navrhniDuplicity_`, `smazatPotvrzeneDuplicity_` | – | – | ● (+ ruční schválení) |
| 4 | Viditelnost akcí (proběhlé, zrušené, označené) | BE: 7 scénářů filtru viditelnosti | – | Dlouhodobé akce | ● |
| 5 | Označení ★ / ✓ a oblíbená místa 🏛 | BE: `toggleOznaceni_`, `apiToggle_`, `apiToggleMisto_`, `oblibenaMistaSety_`, `readOznaceni_`; FE: `klicMistoUkladani_`, `filtrovatOblibenaMista_` | – | 4 zápisové (round-trip, integrace) + 3 chipy bez zápisu | ● |
| 6 | Uživatelé, přihlášení, PIN | BE: `hashPin_`, `overitPin_`, `apiPrihlaseniUzivatele_` (nikdy nevrací hash), `apiSeznamUzivatelu_`; FE: `pinVypadaPlatne_`, `sestavPrihlasenehoUzivatele_`; `apiSetFiltry_` a `nastavPin_` (od 29. 10. 100 % řádků, mutacemi ověřené: správný řádek a sloupec, neznámý uživatel, round trip s `overitPin_`, nová sůl); E2E volá `apiSetFiltry_` nepřímo při uložení dialogu profilu | – | 7 (dlaždice, testovací profil skrytý bez příznaku, anonymní režim, špatný PIN, odhlášení, přepínač, dialog profilu) | ● |
| 7 | API routování a přenos údajů | BE: `routePost_` (neznámá akce, token, login, toggle); FE: `sestavFetchPozadavek_` (PIN a token v těle, nikdy v URL) | Meta, events, places, filtr profilu, neznámý endpoint, neplatný token | – | ● |
| 8 | Cache odpovědí | BE: klíč cache, verze, invalidace, izolace uživatelů, fail-open při výpadku CacheService | – | – | ◐ (jen unit) |
| 9 | Počasí | BE: `weatherFor_` (retry, fallback Open-Meteo → met.no, cache), `vyhodnotPocasiUdalosti_`, `aktualizujPocasi_`; FE: `weathercodeEmoji_`, `pocasiZobrazeni_` | – | Políčko počasí | ● |
| 10 | Geokódování a mapa | BE: `geocodovatNominatim_`, `sestavDotazGeokodovani_`, `klicSouradnic_`, `souradniceMapy_`; FE: `akceProMapu_`, `seskupitPodleSouradnic_`, `sestavSeznamMist_`, `prepnoutVyberPinu_`, `sestavPopupDataMapy_` | Pole `lat`/`lng` | 7 (vykreslení, toggle, seznam, výběr pinu z karty i seznamu, popup, tlačítko v popupu) | ● |
| 11 | Kalendář | FE: `dnySAkcemi_`, `akceDnePodleData_`, `sestavKalendarMrizku_`, pozice tooltipu | – | 4 (toggle, navigace, skok na den, tooltip) | ● |
| 12 | Filtry, kategorie, doporučení | BE: `vypoctiPodkategorii_`, `folklorniRegion_`; FE: `filtrovatKategorii_`, `dostupnePodkategorie_`, `jeNeoverena_`, `spocitatDoporuceni_`, statistiky, uložené chipy | Filtr podle profilu | 7 filtrů + chipy kategorií | ● |
| 13 | Notifikace a přehledy | BE: `notifyOk_`, digest (text i HTML, `esc_`), `digestProUzivatele_`, validace a uložení nastavení, `novaNtfyTema_`; FE: `sestavNotifikace_`, `validovatNotifikaceKlient_` | Živost ntfy | 3 (přepínání kanálů, validace, plný cyklus) | ● |
| 14 | Sdílení a odkazy | FE: `sestavTextSdileni_`, `gcalUrl_`, `mapsUrl_`, deep linky na akci a výběr (round-trip), `sestavEventJsonLd_` | – | 4 (existence odkazů a tlačítek, bez kliku na Sdílet) | ◐ |
| 15 | Kontakt a e-mailové tipy | BE: `apiKontakt_`, `apiEmailTip_`, `zpracovatEmailTipy_`, `callAnthropicEmailTip_`; W: webhook | – | 2 (validace, odeslání s cooldownem) | ● |
| 16 | Sledovaná města | BE: `serazenaSledovanaMesta_`, `jeDnesJizZpracovano_`, `cfgProMesto_`, orchestrátor `zpracovatSledovanaMesta` (ověřeno mutací) | – | – | ◐ (jen unit) |
| 17 | Nasazení a verze | BE: `VERZE` | Nasazená verze backendu odpovídá repu | – (verze frontendu se netestuje) | ◐ |
| 18 | Rozvržení a stabilita stránky | – | – | Hlavička, JS chyby v konzoli, sticky prvky, dvě responzivní pásma | ◐ (+ ručně) |
| 19 | Diakritika, řazení, časová zóna a formáty dat | BE: `normNazev_`, `parseCzDate_`, `cellTextCas_`; FE: `sestavFetchPozadavek_`, `gcalUrl_`, `sestavOdkazNaAkci_`, `parseCeskeDatum` | – (jen Ostrava, bez diakritiky) | 1 (Přepnutí na město s diakritikou) | ◐ (řazení `cs`, časová zóna, DST a Unicode nepokryté, viz ARCHITEKTURA-TESTU A4) |

## C. Mezery, které matice ukazuje

Kromě vědomě vynechaných oblastí ze sekce 8 plánu (obsah LLM, placené
operace, klik na Sdílet, cross-browser, přístupnost, výkon):

| Mezera | Proč vznikla | Riziko |
|---|---|---|
| API sada netestuje POST routy (login, toggle, notifikace, kontakt) | Jsou pokryté unit testy `routePost_` a nepřímo přes E2E | Nízké – obě strany hranice jsou pokryté, chybí jen přímý kontrakt |
| Sledovaná města (16) a cache (8) nemají test nad nasazenou appkou | Běží na pozadí nebo nejsou zvenku vidět | Nízké až střední – selhání se projeví až chybějícími akcemi |
| Týdenní a víkendový přehled se netestují jako celek odeslání | Unit testy pokrývají sestavení obsahu, ne trigger | Nízké – watchdog hlídá, že denní běh proběhl |
| Běh přes Apps Script iframe (`FRAME`) není v CI | CI běží proti statickému webu | Střední – viz R5 |
| Verze nasazeného frontendu (`Index.html` na Cloudflare) se netestuje | API test hlídá jen backend | Střední – viz R2 |

Jako první bych řešil mezery u R2 a R5, tedy kontrolu verze frontendu ve
smoke a smoke přes `FRAME` v CI. Ani jedno není velká změna a zároveň tím
pokryju dvě věci, které přímo souvisí s tím, jak aplikaci nasazuju.

Potom bych přidal přímý API test loginu. Login už sice testuju z obou stran
přes unit a E2E, ale chybí mi přímé ověření přes skutečné API. Ostatní mezery
bych zatím nechal být. Nějaké pokrytí už mají a samostatné testy by podle mě
přidaly víc údržby než reálné jistoty.

## D. Údržba matice

- Při nové funkci nebo opravě bugu doplnit řádek v části B, případně
  riziko v části A.
- Při změně hodnocení (●/◐/○) zapsat důvod do CHANGELOGu.
- Matici projít při každé revizi `Docs/testovani/TESTY.md`.

Matice vznikla zpětně podle názvů testů a historie v `CHANGELOGu`.
Ukazuje hlavně to, že pro danou oblast nějaký test existuje a na které úrovni.
Sama o sobě ale neříká, jak důkladně konkrétní chování opravdu ověřuje.
Hodnocení ●/◐/○ proto beru spíš orientačně a při další revizi testovacího
plánu bych ho znovu prošel.

## Historie dokumentu

| Datum | Změna |
|---|---|
| 30. 9. 2026 | První verze, zpětná rekonstrukce ze stavu repa |
| 6. 10. 2026 | Doplněno hodnocení nejslabších rizik a priority mezer |
| 28. 10. 2026 | Revize po vzniku ARCHITEKTURA-TESTU.md: role dokumentů, počty testů odkazem na README, opravené počty v oblastech 6 a 10, rizika R9 až R11, oblast 19 (diakritika a lokalizace) |
| 28. 10. 2026 | Korekce podle měření pokrytí řádků backendu (82,2 %): R6 a R4 z ● na ◐, poznámka u R3 (`apiToggle_` 44 %), `apiSetFiltry_` v oblasti 6 bez jednotkového testu, upřesněný `runSelfTest` |
| 29. 10. 2026 | #35 dávka 1: `setupTriggers` a `watchdogDailyCheck` pokryté (100 % řádků), R4 zůstává ◐ (zbývají `notifyFail_` a přehledy); backend 84,6 % řádků |
| 29. 10. 2026 | #35 dávka 2: `runCheck_` a `dailyCheck` 100 % řádků; R6 zůstává ◐ (dvě ze tří zaplacených cest, `callAnthropicPlaces_` a `apiNajdiProUzivatele_`, jsou dál slabě pokryté), backend 86,8 % řádků |
| 29. 10. 2026 | #35 dávka 3: `updateMista`, `callAnthropicPlaces_` a `apiNajdiProUzivatele_` 100 % řádků; R6 zůstává ◐ (chybí `spustKontroluCore_` s cooldownem, `menuRunNow` a obsazený zámek v `zpracovatSledovanaMesta`), backend 90,1 % řádků |
| 29. 10. 2026 | #35 dávka 3b: R6 zpět z ◐ na ● (všechny placené cesty nad 70 % řádků a s testy zámku, tokenu a cooldownu ověřenými mutacemi: `runCheck_`, `dailyCheck`, `zpracovatSledovanaMesta`, `updateMista`, `apiNajdiProUzivatele_`, e-mailové tipy, `spustKontroluCore_`, `menuRunNow`); backend 90,3 % řádků |
| 29. 10. 2026 | #35 dávka 4: `apiSetFiltry_`, `apiToggle_`, `nastavPin_`, `notifyFail_`, `weeklyDigest`, `weekendDigest` 100 % řádků; R4 zůstává ◐ (otevřený defekt #48: nehlídaný trigger `sendUserNotifications` bez hlášení chyb), R3 a oblasti 5 a 6 doplněny o měření; backend 92,0 % řádků |
