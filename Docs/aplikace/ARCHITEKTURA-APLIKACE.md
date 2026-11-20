# Architektura aplikace

## Komponenty

```
[Google Sheet]  ←→  [kulturni_radar.gs (Apps Script)]  →  [Anthropic API + web search]
                              ↑        │                →  [Open-Meteo / met.no] (počasí)
                              │        └→  [Index.html]     →  [Nominatim] (geokódování)
                    [cloudflare-worker/email-webhook.js]
                     (mail → EMAIL_TIPY fronta)
```

- **`kulturni_radar.gs`** — jediný backend. Běží jako Apps Script webová appka
  (`/exec`) i jako čistě JSON API pro statický frontend (viz níže). Vlastní
  data v Google Sheetu, triggery, AI volání, notifikace.
- **`Index.html`** — jeden soubor, dvě prostředí. Nasazuje se beze změny jak
  do Apps Scriptu (kde `doGet` bez parametru `api` vrátí přímo tuhle stránku),
  tak jako statický web na **`kulturniradar.cz`** (Cloudflare Pages, napojené
  na privátní GitHub repo). Most mezi nimi je funkce `gsr()`: uvnitř Apps
  Scriptu volá nativní `google.script.run`, mimo něj (`JE_V_APPS_SCRIPTU ===
  false`) přeloží stejné volání na `fetch()` proti pevné `EXEC_URL`
  (`sestavFetchPozadavek_`) — POST pro vše, co nese PIN/token (nepatří do
  URL), GET pro čtení. Appka tedy má **dva nezávislé nasazovací kanály**:
  `git push` aktualizuje statický `kulturniradar.cz`, `clasp deploy`
  (nebo ruční „Nová verze“) aktualizuje `/exec` — je snadné nasadit jen
  jeden a zapomenout na druhý.
- **`cloudflare-worker/email-webhook.js`** — samostatně nasazovaný Cloudflare
  Worker (`npx wrangler deploy`, mimo `clasp`/Apps Script). Nahrazuje prosté
  Email Routing přeposílání pro `info@kulturniradar.cz`: mail forwarduje dál
  na Gmail beze změny a navíc jeho obsah pošle jako webhook appce
  (`apiEmailTip_`), autentizovaný vlastním `EMAIL_WEBHOOK_TOKEN` (jiná
  důvěryhodnostní hranice než `WEB_TOKEN` pro spuštění kontroly).
- **`api-tests/`** — cvičný projekt (příprava na pracovní pohovor), testuje
  produkční `doGet`/`doPost` přes SoapUI/ReadyAPI, Bruno a JMeter. Není
  součástí appky ani jejího verzování/nasazení.
- **`tests/`** — Node jednotkové testy (`tests/unit.test.js`,
  `tests/frontend.test.js`) a Robot Framework sada (`tests/robot/`); viz
  `Docs/testovani/TESTY.md` pro strategii, `Docs/aplikace/PROVOZ.md` pro provoz/triggery.

## Listy tabulky

| List | Role |
|---|---|
| KRITÉRIA | vstup uživatele: profil (B2), dojezd (B3), horizont (B4), kategorie (B5), malé lokální (B6), checkbox mimořádné kontroly (B11), čas poslední mimořádné (B12) |
| LOKALITY | číselník měst: B profil, G stav zdrojové mapy, H poslední kontrola profilu (plní skript) |
| ZDROJE | doporučené weby na profil (vstup do promptu) |
| AKCE | databáze akcí, 25 sloupců A–Y; **skript zapisuje jen A:V a Y**, W:X jsou maticové vzorce tabulky |
| MÍSTA | stálá atrakce (15 sloupců, list si skript založí sám) |
| PŘEHLED / VÝBĚR | vzorcové pohledy pro čtenáře (skript se jich nedotýká) |
| KONTROLY | audit: každý běh jeden řádek vč. sloupce Vykonavatel |
| OZNAČENÍ | *(v3.20)* osobní ★ oblíbené / ✓ navštívené / oblíbená MÍSTA, per uživatelský profil (sloupec Uživatel) — jednoduchý full-rewrite, list si skript založí sám |
| UŽIVATELÉ | *(v3.20)* profily domácnosti: ID, jméno, `PIN_hash` (sůl+SHA-256, nikdy surový PIN), osobní Filtry (JSON), osobní Notifikace (JSON, v3.30) |
| SOUŘADNICE | *(v3.14)* cache geokódovaných míst (Nominatim/OpenStreetMap) klíčovaná `misto|obec` — jen se přidává, nikdy nemaže/netogluje |
| POČASÍ | *(v3.22)* předpověď pro budoucí AKCE (id akce → stav/kód/teplota), přepočítává se 2× týdně (viz níže), oddělený list bez zásahu do AKCE |
| ALIASY | *(v3.66)* aliasy velkých akcí pod více názvy: A klíčová slova (např. `vánoce brn*`, `*` = začátek slova), B jednotný název, C profil (prázdné = všechny), D poznámka. Vyplňuje ručně správce, chybějící list = žádné aliasy |
| SLEDOVANÁ MĚSTA | *(v3.16)* seznam profilů (musí přesně sedět s LOKALITY, sloupec B) k tichému doplňování dat na pozadí, bez notifikace |
| EMAIL_TIPY | *(v3.29)* fronta tipů z e-mailového webhooku (Cloudflare Worker) – stav nové → zpracováno-ok/zpracováno-chyba/nelze-ověřit/test-ignorováno |

## Hlavní datový tok (mimořádná/denní kontrola)

```
trigger → readCriteria_ → readSources_ → callAnthropic_ → upsertEvents_
        → zajistitSouradniceProAkce_ → logKontrola_ → updateLokalita_ → notifyOk_/notifyFail_
```

Denní kontrola (`dailyCheck`) navíc PŘED `runCheck_` zpracuje frontu
`EMAIL_TIPY` (`zpracovatEmailTipy_`), aby oba zdroje nových akcí (AI hledání
i ověřené e-mailové tipy) skončily v jednom denním reportu.

### callAnthropic_ (jádro)

- Claude Sonnet + server tool `web_search` (max 5) + klientský nástroj
  **`report_events`** s pevným `input_schema`; instrukce: výsledky odevzdat
  výhradně voláním nástroje → **API garantuje validní strukturu**.
- Smyčka stavů: `tool_use` → hotovo; `pause_turn` → pokračovat (rozpočet 3 min);
  `end_turn` bez nástroje → vyžádat odevzdání.
- Zálohy pro atypické odpovědi: parsování textu (kandidáti od posledního
  i prvního `[`, sanitizace, záchrana useknutého konce) a „formátovací
  dovolání“ bez web searche. V praxi se od v2.0 nepoužívají.

### Deduplikace (upsertEvents_)

1. `id` (normalizované), jen když názvy sdílí aspoň jedno slovo (v3.58) →
2. přesný klíč profil|datum|název|místo →
3. fuzzy: stejný profil+datum a překryv názvů (podmnožina, nebo ≥3 společná
   slova po normalizaci bez diakritiky a čísel), prakticky shodný název (v3.58),
   nebo shodný základ názvu bez závorek při stejném začátku i konci (v3.62) →
4. vícedenní akce se stejným koncem a podmnožinou názvu (v3.57).
Ve fuzzy krocích se nepáruje jiný den denní série ani akce v sérii se sérií
(„X (Série)“, „Akce – Série“; `jeAkceVSerii_`, v3.62).
Před všemi kroky (v3.66): název, jehož hlavní část (bez závorek a textu za
pomlčkou) obsahuje klíčová slova aliasu z listu ALIASY, se přejmenuje na jednotný
název a páruje podle profilu a tohoto názvu bez ohledu na data. Termín řádku se
pak nepřepisuje, změnou je jen stav, a starší řádek dostane jednotný název.
Nové řádky se registrují do indexů průběžně (dedup i uvnitř jedné dávky).
„Změna“ = jen posun termínu nebo stavu, od v3.62 i u nejisté fuzzy shody;
přeformulace textů se ignoruje. Log sloučení (sloupec Z) jen u nejisté shody,
která akci opravdu přepisuje.

### Souřadnice (mapa)

Po každém běhu kontroly appka na pozadí doplní chybějící souřadnice pro
nově nalezené/aktualizované lokality (`zajistitSouradniceProAkce_` →
`zajistitSouradnice_`): cache-hit ze SOUŘADNIC, cache-miss → dotaz na
Nominatim (OpenStreetMap, zdarma, zdvořilostní pauza 1,1 s, jen na
skutečně novou lokalitu) a zápis do listu. Frontend tak vždy čte jen
hotovou cache, nikdy negeokóduje synchronně za uživatele — bez záznamu
prostě spadne zpět na textové vyhledávání v mapě. Jednorázové doplnění
zpětně pro starší akce: `doplnitSouradniceZpetne` (ruční, z menu,
časově rozpočtované jako sledovaná města níže).

## Přehledy (digesty)

`digestRange_` čte AKCE (bez API): akce profilu zasahující do okna, mimo
proběhlé/zrušené; seskupení podle kategorie (abecedně), uvnitř chronologicky;
u položek čas konání. Sekce **Stálá místa**: top 5 z MÍST podle skóre,
otevírací doba, a **živé** počasí (od v3.64 met.no se souřadnicemi obce ze SOUŘADNIC, přes `weatherFor_`) na
nejbližší sobotu v okně — nezávislé na cache POČASÍ níže (jiný účel: tady
jde o pár měst v e-mailu/notifikaci, ne o desítky konkrétních akcí ve
frontendu). Selhání počasí nikdy neshodí přehled.

`digestProUzivatele_` (v3.31) je analogický osobní přehled pro jednoho
uživatele — stejná data z AKCE, ale filtrovaná podle jeho osobních
kategorií (`UŽIVATELÉ.Filtry`); prázdné filtry = bez omezení. Neřeší
odeslání, jen sestaví obsah (viz Notifikace níže).

**Počasí u jednotlivých AKCÍ (list POČASÍ, v3.22):** oddělené od přehledů
výše. `aktualizujPocasi_` běží od v3.59 ve vlastním triggeru `prepocitatPocasi`
(neděle 22:00, čtvrtek 11:00, #81; dřív v běhu sledovaných měst) a pro každou budoucí akci
dopočítá/aktualizuje stav (souřadnice z cache SOUŘADNICE → od v3.60 jen met.no,
~9 dní dopředu, dál NA; Open-Meteo z Apps Scriptu trvale vracelo 429, #81) — výsledek pak `readEventsApi_` připojí
ke každé akci pro frontend (mapa/karty), bez dalšího volání za běhu.

## Stálá místa

`updateMista` = stejný vzor jako kontrola, s nástrojem **`report_places`**
(id, název, typ, obec, otevírací doba, sezónní poznámka, vstupné, děti,
skóre, stav, URL). Upsert podle id → název+obec. Měsíční trigger.

Od v3.54 (#72) dostane prompt seznam už známých míst profilu s ID
(`znamaMista_`, `textZnamychMist_`, nejvýš 20): model je má obnovit pod stejným
ID, takže aktualizace přepíše všechna známá místa, ne jen část (limit 20 místo 12).
Otevírací doba starší než 35 dní (`MISTA_DOBA_PLATNOST_DNI`, sloupec Poslední
aktualizace) se v `readMista_` nahradí výzvou „ověřte na webu místa (údaj z <datum>)“
(`oteviraciDobaProPrehled_`), na webu i v přehledech; řádek bez data zůstane beze změny.
Od v3.55 má aktualizace stálých míst vlastní limit 12 webových vyhledávání
(`MAX_WEB_SEARCHES_MISTA`, ostatní hledání 3), aby stihla ověřit otevírací dobu
všech známých míst; „sezónně zavřeno“ jen tehdy, když to potvrzuje oficiální web místa.

## Sledovaná města

Tiché doplnění dat na pozadí pro profily mimo domácí (`zpracovatSledovanaMesta`,
list SLEDOVANÁ MĚSTA) — stejná kritéria (dojezd/horizont/kategorie) jako
domácí profil, jen jiné město, **žádná notifikace**. Uživatel výsledky
uvidí, až si dané město sám vybere v dropdownu. Časově rozpočtováno (~4,5 min)
a přeskakuje dnes už zpracovaná města (`jeDnesJizZpracovano_`), takže
opakované spuštění postupně projde celý seznam. Spouští se v neděli 20:00
(před pondělním přehledem) a ve čtvrtek 10:00 (před čtvrtečními tipy).
POČASÍ od v3.59 přepočítává samostatný trigger `prepocitatPocasi` (viz výš),
takže celý rozpočet běhu zbývá na města (#81).

## Uživatelské profily (list UŽIVATELÉ, v3.20+)

Přihlášení je jméno/ID + PIN (`apiPrihlaseniUzivatele_`), PIN se nikdy
neukládá ani nevrací surový — jen `sůl$SHA-256` hash (`hashPin_`/`overitPin_`).
Od zavedení profilů jsou **osobní, ne sdílené za celou domácnost**:

- **★ Oblíbené / ✓ Navštívené / oblíbená MÍSTA** — list OZNAČENÍ,
  vždy vázané na `uzivatelId` (`apiToggle_`, `apiToggleMisto_`).
- **Osobní filtry** (kategorie, dojezd, …) — JSON ve sloupci Filtry
  (`apiSetFiltry_`), čte je i osobní přehled (`digestProUzivatele_`).
- **Osobní notifikace** (v3.30+, sloupec Notifikace, JSON) — kanály
  (e-mail/ntfy), frekvence (1–30 dní), obsah (zatím jen „kategorie“).
  ntfy téma appka **sama generuje** jako nehádatelný UUID
  (`apiVygenerovatNtfyTema_`) — nikdy z uživatelského vstupu, protože
  ntfy.sh nemá autentizaci a uhodnutelné téma by šlo zneužít.
  Denní odesílací trigger `sendUserNotifications` (9:00, po `dailyCheck`)
  pro každého „due“ uživatele sestaví osobní digest (`digestProUzivatele_`)
  a pošle na jeho kanál; suchý běh bez odeslání jde spustit z menu Sheets.

Zápisy do OZNAČENÍ/SOUŘADNICE/POČASÍ invalidují krátkodobou cache
`apiEvents` (`invalidovatCacheEventu_`, CacheService, TTL 45 s, fail-open) —
appka jinak při každém načtení stránky nečte znovu všechny 4 listy.

## E-mailové tipy (list EMAIL_TIPY, v3.29)

Vstupní bod je Cloudflare Worker `cloudflare-worker/email-webhook.js`, ne
appka samotná: přijímá poštu pro `info@kulturniradar.cz`, forwarduje ji
beze změny na Gmail a navíc pošle její obsah přes autentizovaný webhook
appce (`apiEmailTip_`). Endpoint jen zapíše řádek do fronty a hned
odpoví — žádné volání Anthropic API synchronně při příchodu mailu.
Frontu zpracovává `zpracovatEmailTipy_` jednou denně (součást `dailyCheck`,
před běžnou kontrolou, časově rozpočtováno 2 min): AI ověří obsah webem
(`callAnthropicEmailTip_`), obec se mapuje na profil přesnou shodou proti
LOKALITY; bez shody se akce nezapíše (raději nic než nespolehlivá data) a
řádek dostane stav „nelze-ověřit“ k ruční kontrole. Zpráva z testovacího
profilu (řádek „Uživatelský profil: rf-…“, posílá ji RF test kontaktního
formuláře) dostane od v3.53 stav „test-ignorováno“ bez AI ověření a nezapočítá
se do denní notifikace, aby každý běh RF nestál jedno AI volání a nedělal šum (#79).

## Notifikace (sendNotification_)

- ntfy přes SMTP bránu `ntfy-<topic>@ntfy.sh` (viz PROVOZ.md — proč ne HTTP);
  těla nad ~3,5 kB zkrácena po řádcích s dovětkem.
- e-mail přes MailApp; oba kanály dostávají i chybová hlášení.
- Sdíleno mezi rodinnými přehledy (`digestRange_`) i osobními notifikacemi
  (`sendUserNotifications_` výš) — stejná funkce, jiný obsah a příjemce.

## Indexace pro crawlery a sdílení (Index.html, v3.57–3.58)

Statické SEO/sdílecí meta tagy (description, Open Graph, Twitter Card),
favicon, `robots.txt`/`sitemap.xml` v repu a per-akce Schema.org Event
JSON-LD při sdílení konkrétní akce — návrh a zjištění viz
`Docs/audity/AUDIT-INDEXACE.md` (mj. že Cloudflare do každé zóny vkládá vlastní
„Managed robots.txt“ blok s `Disallow` pro AI crawlery, který soubor
v repu nemůže přebít — řešitelné jen přes Cloudflare dashboard). Stejná
session zavedla i konzistentnější `data-*` selektory pro opakované prvky
UI (karty/chipy/dlaždice) – viz `Docs/audity/AUDIT-SELEKTORU.md`.

## PWA (Index.html v3.67)

Na `kulturniradar.cz` jde appku nainstalovat na plochu (Android, Chrome): manifest
`/manifest.webmanifest` (standalone, start a scope `/`, barvy appky) a ikony 192, 512,
maskable 512 a `apple-touch-icon` 180 leží v `apps-script/pwa/` a do kořene webu je
kopíruje build příkaz Cloudflare Pages (viz PROVOZ.md). Ikony jsou dočasné, vygenerované
z konceptu C (`Docs/aplikace/design/ikona-varianta-C.svg`), do finálního designu.
`<meta name="theme-color">` je statický; odkazy na manifest a apple-touch-icon vkládá
čistá funkce `pwaOdkazy_` **jen mimo Apps Script** (v `/exec` by se cesty nenačetly).
**Bez service workeru záměrně:** Chrome na Androidu ho pro instalaci z menu od verze 108
nevyžaduje a cache by mohla držet starou verzi appky. Další kroky (TWA, Google Play) v BACKLOGu, Cíl 2.

## Zásady

- Skript nikdy nemaže akce (jen stav proběhlo/zrušeno) a nesahá na cizí profily.
- Vše auditované v KONTROLÁCH; žádné tiché selhání (notifyFail_ všude).
- Blokující UI (alert) zakázáno — jen toast.
- Cache (`apiEvents`, 45 s) je vždy fail-open: chyba CacheService se nikdy
  nesmí projevit jako pád, jen jako čtení bez cache.
