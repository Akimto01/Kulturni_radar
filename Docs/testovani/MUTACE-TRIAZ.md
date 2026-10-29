# Triáž přeživších mutantů kritické sady

Podklad k issue #13. Zdroj: běh `node tests/mutace/spustit.js --kriticke` z 29. 10. 2026 (Stryker 10.0.0, backend v3.51, 10 funkcí z [POKRYTI.md](POKRYTI.md)):
448 mutantů, 349 zabito, 1 timeout, **84 přežilo, 14 bez pokrytí** (NoCoverage), mutační skóre 78,1 %. Postup a výklad stavů: [MUTACNI-TESTOVANI.md](MUTACNI-TESTOVANI.md).
Čísla mutantů (`#N`) platí jen pro tento běh a tuto verzi backendu; při změně kódu se mění.

Každý z 98 mutantů je zařazen do jedné kategorie:

- **(a) skutečná mezera v testu:** změna chování, kterou test měl chytit. Doplní se test.
- **(b) ekvivalentní mutant:** změna nemění pozorovatelné chování, žádný test ho zabít nemůže. Zdůvodnění je v tabulce níže.
- **(c) mezera v kódu, kterou testem neopravíš:** nedosažitelná obrana nebo chyba v kódu; nejdřív se musí změnit kód.

## Souhrn po funkcích (výchozí stav před dávkou 1)

| Funkce | Mutantů | Zabito | Přežilo | NoCoverage | (a) test | (b) ekviv. | (c) kód |
|---|---|---|---|---|---|---|---|
| `upsertEvents_` | 146 | 93 | 43 | 10 | 46 | 4 | 3 |
| `digestRange_` | 53 | 32 | 17 | 4 | 21 | 0 | 0 |
| `runCheck_` | 40 | 31 | 9 | 0 | 8 | 1 | 0 |
| `apiNajdiProUzivatele_` | 56 | 48 | 8 | 0 | 4 | 1 | 3 |
| `apiToggle_` | 49 | 46 | 3 | 0 | 3 | 0 | 0 |
| `parseCzDate_` | 23 | 20 | 3 | 0 | 2 | 1 | 0 |
| `apiSetFiltry_` | 24 | 23 | 1 | 0 | 1 | 0 | 0 |
| `spustKontroluCore_` | 28 | 28 | 0 | 0 | 0 | 0 | 0 |
| `weekendDigest` | 18 | 18 | 0 | 0 | 0 | 0 | 0 |
| `smiZacitDalsiMesto_` | 11 | 11 | 0 | 0 | 0 | 0 | 0 |
| **Celkem** | **448** | **350** | **84** | **14** | **85** | **7** | **6** |

Kdyby se všech 85 mutantů kategorie (a) zabilo, skóre by bylo 435 z 448 = 97.1 %; bez ekvivalentních (b) ve jmenovateli 435 z 441 = 98.6 %. Zbývá (c): 6 mutantů, které opraví až změna kódu.

Tři čtvrtiny přeživších jsou v `upsertEvents_` (53 z 98) a `digestRange_` (21 z 98). Jsou to funkce s nejmenším ověřením výsledku: testy kontrolují zápis do listu nebo že funkce doběhla, ale ne seznamy názvů ve statistikách, nadpisy bloků ani sloučení duplicit v rámci jednoho běhu.

## (b) Ekvivalentní mutanty (7)

| # | Funkce, řádek | Mutace | Proč je ekvivalentní |
|---|---|---|---|
| #153 | `upsertEvents_`, ř. 1256 | `rowVals.slice(0, AKCE_WRITE_AV)` → `rowVals` | `eventToRow_` vrací přesně 22 prvků a `AKCE_WRITE_AV` je 22, takže `slice(0, 22)` nic neořízne. (Ochrana pro případné rozšíření řádku; dnes žádný efekt.) |
| #157 | `upsertEvents_`, ř. 1260 | `''` → `"Stryker was here!"` | Prázdný řetězec ve sloupci W v řádku registrovaném do indexů po vložení nové akce. Sloupce W a X jsou maticové vzorce tabulky, kód je nikdy nečte (`POLE_PRO_FUZZY_LOG_` je neobsahuje). |
| #158 | `upsertEvents_`, ř. 1260 | `''` → `"Stryker was here!"` | Stejný důvod jako #157 (sloupec X). |
| #199 | `upsertEvents_`, ř. 1299 | `rowVals.slice(0, AKCE_WRITE_AV)` → `rowVals` | Stejný důvod jako #153 (větev změny existující akce). |
| #36 | `runCheck_`, ř. 772 | `'Jiný běh právě probíhá – končím.'` → `""` | Jen text ladicího záznamu `Logger.log`; chování, návratová hodnota ani zápis se nemění a nikdo ho nečte. |
| #323 | `apiNajdiProUzivatele_`, ř. 2395 | `{ osobniFiltry = {}; }` → `{}` | Pokud `JSON.parse` vyhodí výjimku, přiřazení do `osobniFiltry` se nikdy neprovede, proměnná zůstává `{}` z deklarace. Přiřazení `{}` v `catch` je zbytečné. |
| #458 | `parseCzDate_`, ř. 4270 | `''` → `"Stryker was here!"` | Pro nepravdivé `v` dá původní kód `''`, mutant `'Stryker was here!'`; ani jeden řetězec neobsahuje datum, regulární výraz nenajde nic a funkce vrátí `null` v obou případech. |

## (c) Mezery v kódu (6)

| # | Funkce, řádek | Nález | Co s tím |
|---|---|---|---|
| #352, #353, #354 | `apiNajdiProUzivatele_`, ř. 2417 | Odpověď čte `stats.aktualizovano`, ale `upsertEvents_` takové pole nevrací (má `zmenene`), takže `aktualizovano` je vždy `0`. Pole nikdo nepoužívá (frontend ho nečte). Test by mohl jen potvrdit nesprávnou hodnotu `0`. | Změna kódu (po neděli, backend se do té doby nemění): buď `stats.zmenene`, nebo pole odstranit; teprve potom test. Zapsáno v těle [#48](https://github.com/Akimto01/Kulturni_radar/issues/48) jako bod k opravě po neděli, nové issue se nezakládá. |
| #119 | `upsertEvents_`, ř. 1233 | `String(ev.datum_od \|\| '')`: náhradu `''` nelze vyvolat, protože akce bez rozpoznatelného data se vyřadí o pár řádků výš (`sDatem`, v3.48). | Obrana je nedosažitelná; při úpravě kódu ji lze odstranit. |
| #207, #211 | `upsertEvents_`, ř. 1301 | `String(old[4] \|\| '')` a `String(ev.nazev \|\| '')` v záznamu fuzzy sloučení: do téhle větve se dostane jen shoda názvů s aspoň dvěma společnými slovy (`isSameName_` vrací `false` pro prázdné tokeny), takže oba názvy jsou neprázdné. | Nedosažitelná obrana, stejně jako #119. |

## (a) Skutečné mezery v testech (85)

Seskupeno podle toho, co má doplněný test ověřit. Pořadí odpovídá plánu dávek: nejmenší funkce první.

| Funkce | Mutanty | Co test musí ověřit |
|---|---|---|
| `parseCzDate_` | #461, #465 | datum bez mezery za tečkou (`1.5.2026`) a se dvěma mezerami (`1.  5.  2026`); regex s `\s*` místo `\s` musí obojí přijmout |
| `apiSetFiltry_` | #292 | neznámý profil vrací `ok: false` (test dnes kontroluje jen text chyby) |
| `apiToggle_` | #244, #256, #259 | `ok: false` u chybějícího ID a u neexistující akce; po přepnutí se zneplatní cache `apiEvents` (přes `__cacheStore`) |
| `runCheck_` | #37, #40, #45, #46, #47, #64 | mimořádná kontrola s vypnutým zaškrtávátkem nic nespustí; denní kontrola s vypnutým zaškrtávátkem naopak proběhne a nepřepíše buňky POSLEDNÍ a CHECKBOX v KRITÉRIÍCH (u mimořádné se přepíšou) |
| `runCheck_` | #59, #61 | text chyby „Pro profil … nejsou v ZDROJÍCH žádné zdroje“; po hledání se doplní souřadnice (`zajistitSouradniceProAkce_` zavolána) |
| `apiNajdiProUzivatele_` | #320, #331, #341, #345 | neznámý profil `ok: false`; osobní filtry bez `kategorie` nepřepíšou kategorii z KRITÉRIÍ; text chyby; doplnění souřadnic |
| `digestRange_` | #390, #393, #397 | profil s mezerami kolem názvu se ořízne (hlavička); bez stálých míst se blok „Stálá místa“ nepřidá; okno od neděle do soboty (`weeklyDigest` spuštěný v neděli) hledá sobotu včetně posledního dne |
| `digestRange_` | #413 až #416, #421, #423 až #425, #428 až #432, #436, #437, #442, #444, #445 | blok stálých míst: seskupení podle typu, chybějící typ = „ostatní“, abecední řazení podle češtiny (`chrám` až za `hrad`), nadpis „· Hrad“ (velké první písmeno, zbytek beze změny), seznam detailů přesně (otevírací doba jen když je, počasí jen když je a s obcí), počet položek bez přebytečných |
| `upsertEvents_` | #74, #76, #78, #79 | prázdný list (jen hlavička) a list s jedním řádkem; dvě shodné akce v jednom běhu se spojí do jednoho řádku a zapíšou se na správný řádek (index nového řádku). **#74 a #76 vyžadují zpřísnit `MemSheet`:** `getRange` s 0 řádky musí házet jako skutečné Sheets, dnes vrací prázdné pole |
| `upsertEvents_` | #82, #83, #125, #159, #160 | shoda přes ID i při změněném názvu; akce bez ID se nespáruje s cizím řádkem bez ID; po vložení nové akce se její ID zaindexuje |
| `upsertEvents_` | #137, #139, #165 až #170 | dvě různé akce téhož dne a profilu zůstanou oddělené; podobné názvy v jednom běhu se sloučí (fuzzy index nových řádků), akce bez názvu |
| `upsertEvents_` | #156 | nová akce vložená v běhu má v indexu profil, další shodná akce téhož běhu se spojí (ne „cizí profil“) |
| `upsertEvents_` | #176, #187, #191, #196 | shoda s řádkem cizího profilu ho nezmění; změna data začátku a stavu se pozná a označí sloupec Změna `ANO` |
| `upsertEvents_` | #213, #215, #216, #217, #218 | zrušená akce se počítá jako zrušená, ne jako změněná, a zapíše se do `zruseneNazvy` (dnes nepokryto žádným testem) |
| `upsertEvents_` | #94 až #97, #101 až #110, #114, #221, #223, #224 | seznamy názvů ve statistikách (`noveNazvy`, `zmeneneNazvy`, `zruseneNazvy`, `bezZmenyNazvy`): obsah, první kategorie ořezaná, `ostatní` při chybějící kategorii; po aktualizaci bez změny se zapíše jen Poslední kontrola |
| `upsertEvents_` | #226 | po zápisu se zneplatní cache `apiEvents` (hotovo v dávce 1) |

Pozn.: kategorie (a) obsahuje i mutanty, jejichž oprava je kosmetická (text chybové hlášky, akce bez názvu). Zabírají málo úsilí a v souhrnu je nelze vynechat, jen mají nižší prioritu než chování se zápisem do listu.

## Stav dávky 1 (29. 10. 2026)

Hotovo. Po dávce 1: **369 zabito, 65 přežilo, 14 bez pokrytí, skóre 82,4 %** (před: 350 včetně jednoho timeoutu, 84, 14, 78,1 %).

- **Zabito všech 18 mutantů dávky 1:** `parseCzDate_` #461, #465; `apiSetFiltry_` #292; `apiToggle_` #244, #256, #259; `runCheck_` #37, #40, #45, #46, #47, #59, #61, #64; `apiNajdiProUzivatele_` #320, #331, #341, #345. `serioveCisloNaDatum_` (mimo kritickou sadu) má 19 z 19 zabito, hranice 30000 a 80000 zabily oba přeživší.
- **Bonus:** #226 (`upsertEvents_`, zneplatnění cache po zápisu) zabil test zneplatnění cache v `runCheck_`; je odškrtnutý z dávky 3 (zbývá 45 mutantů). Jeden dřívější timeout (#252, `apiToggle_`) je teď zabitý; timeouty závisí na zátěži stroje.
- **Žádné zhoršení:** žádný dříve zabitý mutant nepřežil.
- **8 nových testů** (backend 413 na 421), každý zabíjí aspoň jeden mutant: `parseCzDate_` bez mezer za tečkou (#461, #465), `apiToggle_` zneplatnění cache (#259), `runCheck_` zaškrtávátko a čas v KRITÉRIÍCH (#37, #40, #45, #46, #47, #64), `runCheck_` souřadnice po zápisu (#61), `runCheck_` zneplatnění cache (#226), `apiNajdiProUzivatele_` filtr bez kategorie (#331), souřadnice po zápisu (#345), hranice `serioveCisloNaDatum_` (#12, #15). Zbylé mutanty dávky (#292, #244, #256, #59, #320, #341) zabily doplněné aserce v existujících testech (`ok: false`, přesný text chyby).

## Plán dávek testů

| Dávka | Funkce | Mutantů (a) | Stav |
|---|---|---|---|
| 1 | `parseCzDate_`, `serioveCisloNaDatum_` (hranice 30000 a 80000, mimo kritickou sadu), `apiSetFiltry_`, `apiToggle_`, `runCheck_`, `apiNajdiProUzivatele_` | 18 (+2 u `serioveCisloNaDatum_`) | hotovo, všech 18 (+2) zabito |
| 2 | `digestRange_` | 21 | čeká |
| 3 | `upsertEvents_` (včetně zpřísnění `MemSheet`) | 45 (z 46, #226 zabila dávka 1) | čeká |

