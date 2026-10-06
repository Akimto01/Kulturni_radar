# Matice pokrytí – Kulturní radar

Doplněk k `Docs/TESTY.md`. Plán popisuje, **jak** se testuje, tahle matice
ukazuje, **co** je pokryté, na které úrovni a co ne.

## Jak číst matici

| Zkratka | Úroveň | Soubor |
|---|---|---|
| **BE** | Node unit – backend | `tests/unit.test.js` (291) |
| **FE** | Node unit – frontend (čisté funkce) | `tests/frontend.test.js` (186) |
| **W** | Node unit – worker | `cloudflare-worker/email-webhook.test.mjs` (7) |
| **API** | RF – API kontrakt | `tests/robot/api.robot` (9) |
| **E2E** | RF – UI v prohlížeči | `tests/robot/frontend.robot` (50) |
| **PROV** | Provozní kontroly v produkci | `runSelfTest`, `watchdogDailyCheck`, `auditDat_` |
| **RUČ** | Ruční ověření | reálný telefon, vizuální kontrola, spot-check LLM |

U Node testů jsou uvedené hlavní testované funkce, ne přesné počty – ty se
mění s každou verzí a přesný přehled dá `node --test`. U RF testů je uveden
počet a tagy, přesný seznam dá `python -m robot.testdoc tests/robot/`.

Hodnocení pokrytí: **●** silné (více úrovní, včetně regresí) · **◐** částečné
(jedna úroveň nebo jen část chování) · **○** žádné nebo jen ruční.

## A. Pokrytí podle rizik

Rizika R1–R8 odpovídají sekci 3 v `Docs/TESTY.md`.

| Riziko | BE / FE / W | API | E2E | PROV / RUČ | Pokrytí |
|---|---|---|---|---|---|
| **R1** Špatná data akcí | BE: `parseEvents_`, `cellText_`, sériová čísla dat (BUG v3.2), `eventToRow_`, `upsertEvents_`, `najdiDuplicity_`, `isSameName_`, `jeVycpavka_` | Events s validními českými datumy | Hlavičky dnů jsou česká data, dlouhodobé akce bez minulých hlaviček | `auditDat_`, samotest; ruční schválení duplicit (list NÁVRH DUPLICIT) | ● |
| **R2** Produkce běží na jiné verzi než repo | BE: konstanta `VERZE` souhlasí s hlavičkou | Nasazená verze backendu odpovídá repu | – (verze frontendu na Cloudflare se netestuje) | Po nasazení ruční smoke; konkrétní verze frontendu se neověřuje | ◐ |
| **R3** Ztráta nebo poškození označení | BE: `toggleOznaceni_` (izolace uživatelů), `apiToggle_`, `apiToggleMisto_`, sirotci v OZNAČENÍ | – | ★ / ✓ / 🏛 round-trip s reloadem, integrace ★ → filtr | Ruční kontrola dat po nestandardním běhu | ● |
| **R4** Nedoručené notifikace | BE: `sendNotification_`, `spojitPrijemce_`, `planNotifikaceUzivatele_`, `jeDueNaNotifikaci_`, `sendUserNotifications_` (dry-run i reálné) | Kanál ntfy je živý | Nastavení notifikací, plný cyklus s návratem | `watchdogDailyCheck` | ● |
| **R5** Rozbití jednoho ze dvou prostředí | FE: `sestavFetchPozadavek_` (GET/POST routy) | – | Celá sada spustitelná proti statickému webu i Apps Scriptu (`FRAME`), regrese odhlášení | – | ◐ |
| **R6** Zbytečně utracený API kredit | BE: `routePost_` odmítne špatný token **před** dražší operací, `jeDnesJizZpracovano_`, `vyberModelProKontrolu_` | Spuštění kontroly s neplatným tokenem odmítnuto | Token dialog a „Najít akce pro mě“ bez spuštění | – | ● |
| **R7** Zneužití formuláře nebo webhooku | BE: `apiKontakt_` (limit, cooldown), `apiEmailTip_` (token, limit); W: webhook | Neplatný token, neznámý endpoint | Prázdná zpráva, odeslání a cooldown | – | ● |
| **R8** Rozbité rozvržení | – | – | Sticky header, dvě responzivní pásma, mobilní toggle mapy a kalendáře | Vizuální kontrola, reálný telefon | ◐ |

Nejslabší jsou R2 a R5, obě mají hodnocení ◐.

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
| 6 | Uživatelé, přihlášení, PIN | BE: `hashPin_`, `overitPin_`, `apiPrihlaseniUzivatele_` (nikdy nevrací hash), `apiSeznamUzivatelu_`; FE: `pinVypadaPlatne_`, `sestavPrihlasenehoUzivatele_` | – | 6 (dlaždice, anonymní režim, špatný PIN, odhlášení, přepínač, dialog profilu) | ● |
| 7 | API routování a přenos údajů | BE: `routePost_` (neznámá akce, token, login, toggle); FE: `sestavFetchPozadavek_` (PIN a token v těle, nikdy v URL) | Meta, events, places, filtr profilu, neznámý endpoint, neplatný token | – | ● |
| 8 | Cache odpovědí | BE: klíč cache, verze, invalidace, izolace uživatelů, fail-open při výpadku CacheService | – | – | ◐ (jen unit) |
| 9 | Počasí | BE: `weatherFor_` (retry, fallback Open-Meteo → met.no, cache), `vyhodnotPocasiUdalosti_`, `aktualizujPocasi_`; FE: `weathercodeEmoji_`, `pocasiZobrazeni_` | – | Políčko počasí | ● |
| 10 | Geokódování a mapa | BE: `geocodovatNominatim_`, `sestavDotazGeokodovani_`, `klicSouradnic_`, `souradniceMapy_`; FE: `akceProMapu_`, `seskupitPodleSouradnic_`, `sestavSeznamMist_`, `prepnoutVyberPinu_`, `sestavPopupDataMapy_` | Pole `lat`/`lng` | 8 (vykreslení, toggle, seznam, výběr pinu z karty i seznamu, popup) | ● |
| 11 | Kalendář | FE: `dnySAkcemi_`, `akceDnePodleData_`, `sestavKalendarMrizku_`, pozice tooltipu | – | 4 (toggle, navigace, skok na den, tooltip) | ● |
| 12 | Filtry, kategorie, doporučení | BE: `vypoctiPodkategorii_`, `folklorniRegion_`; FE: `filtrovatKategorii_`, `dostupnePodkategorie_`, `jeNeoverena_`, `spocitatDoporuceni_`, statistiky, uložené chipy | Filtr podle profilu | 7 filtrů + chipy kategorií | ● |
| 13 | Notifikace a přehledy | BE: `notifyOk_`, digest (text i HTML, `esc_`), `digestProUzivatele_`, validace a uložení nastavení, `novaNtfyTema_`; FE: `sestavNotifikace_`, `validovatNotifikaceKlient_` | Živost ntfy | 3 (přepínání kanálů, validace, plný cyklus) | ● |
| 14 | Sdílení a odkazy | FE: `sestavTextSdileni_`, `gcalUrl_`, `mapsUrl_`, deep linky na akci a výběr (round-trip), `sestavEventJsonLd_` | – | 4 (existence odkazů a tlačítek, bez kliku na Sdílet) | ◐ |
| 15 | Kontakt a e-mailové tipy | BE: `apiKontakt_`, `apiEmailTip_`, `zpracovatEmailTipy_`, `callAnthropicEmailTip_`; W: webhook | – | 2 (validace, odeslání s cooldownem) | ● |
| 16 | Sledovaná města | BE: `serazenaSledovanaMesta_`, `jeDnesJizZpracovano_`, `cfgProMesto_`, orchestrátor `zpracovatSledovanaMesta` (ověřeno mutací) | – | – | ◐ (jen unit) |
| 17 | Nasazení a verze | BE: `VERZE` | Nasazená verze backendu odpovídá repu | – (verze frontendu se netestuje) | ◐ |
| 18 | Rozvržení a stabilita stránky | – | – | Hlavička, JS chyby v konzoli, sticky prvky, dvě responzivní pásma | ◐ (+ ručně) |

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
- Matici projít při každé revizi `Docs/TESTY.md`.

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
