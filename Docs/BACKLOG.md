# Backlog — Kulturní radar

Poslední aktualizace: 21. 8. 2026. Neplánované nápady a rozpracované položky —
na rozdíl od CHANGELOG.md, který dokumentuje hotové změny.

## Doporučené pořadí
Zohledňuje závislosti mezi položkami a paralelizaci čekacích dob
(Google Play schvalování běží mimo aktivní práci), stanoveno 8. 8. 2026:

1. **Design večer s dcerou** (rozvržení, ikony/branding appky; CSS
   tokeny v `:root`) — odemyká Android submission a snižuje riziko
   předělávek u kalendářního pohledu. Rodina appku už aktivně
   používá (4 profily vyzkoušené 7.–8. 8.), takže na designu záleží
   i mimo původní účel
   - Aktualizace 18.–19. 8. 2026: dcera má několik dní prázdniny,
     není jasné, jestli bude včas k dispozici. Záložní varianta:
     Vojta + Claude společně, s omezením — Claude umí navrhnout
     koncept (barevné varianty, styl ikony, návrhy layoutu, mockupy
     v chatu), ale finální produkčně použitelnou grafiku pro Google
     Play (adaptive icon ve více vrstvách/rozlišeních přesných
     rozměrů, feature graphic, screenshoty) je lepší dělat ve
     specializovaném nástroji (Figma/Illustrator) člověkem se
     zkušeností — dcera, nebo Vojta sám s podobným nástrojem. Claude
     může připravit koncept a přesné specifikace (rozměry, formáty)
     k exportu v libovolném nástroji.
2. **Android appka — start submission** (~3–4 h aktivní práce) —
   spustit hned po designu, schvalovací proces v Google Play trvá
   dny a běží na pozadí, ať se nečeká zbytečně
3. ~~**API credit optimalizace**~~ — **HOTOVO, OVĚŘENO 21. 8. 2026**
   (viz Větší témata níže)
4. ~~**Filtr žánrů/podkategorie**~~ — **HOTOVO 20. 8. 2026** (backend
   v3.28 + Index.html v3.50, viz CHANGELOG.md), čeká na nasazení/commit
5. ~~**Roční přehled** + **Doporučení podle historie**~~ — **KOMPLETNĚ
   HOTOVO 21. 8. 2026** (Index.html v3.52 + v3.53, viz CHANGELOG.md)
6. ~~**Notifikace o akcích**~~ — **KROKY A–F HOTOVO 21. 8. 2026** (backend
   v3.30–v3.33 + Index.html v3.54, viz CHANGELOG.md); zbývá jen živě
   spustit RF sadu po nasazení. G (obsah „doporučení") vědomě odloženo,
   viz Větší témata
7. **Mapa akcí** — vědomě odložená budoucí varianta (viz Větší
   témata), ne aktivně plánovaná v tomhle pořadí; jednotlivá akce
   je už pokrytá hotovým odkazem „📍 Mapa" na kartě
8. **Kalendářní pohled** (~4–6 h) — po designu, největší UI zásah
9. ~~**Email zpracování návrhů**~~ — **KOMPLETNĚ HOTOVO 20. 8. 2026**
   (backend v3.29 + Cloudflare Worker nasazen a ověřen testovacím
   mailem — dorazil na Gmail i propsal se do EMAIL_TIPY), viz
   CHANGELOG.md
10. **Cesta B zrychlení přihlášení** (~1–2 h) — volitelné, nejvyšší
    riziko regrese, nejnižší priorita

Poznámka: pořadí není striktní závazek, jen doporučení podle
závislostí a efektivity — aktualizuj tuto sekci při každé větší
změně BACKLOGu.

## K ověření
- iPad: ověřit, jestli window.open() (v3.7 Index.html) vyřešil otevírání „Více info"/„Do kalendáře" v nové záložce — dcera se ještě nevrátila s iPadem. (Dojezd v km u nově nalezených akcí ověřen 7. 8. jako OK, položka odstraněna.)
- ~~„Festival Špilberk" (ID `2026-08-17-festival-spilberk`, profil Brno)~~ — **VYŘEŠENO, OVĚŘENO 21. 8. 2026**: akce se mezitím sama doověřila při jedné z pravidelných kontrol (Poslední kontrola: 20. 8. 2026) — v listu AKCE má teď Stav „potvrzeno" (ne „neověřeno"), Primární zdroj i URL vyplněné (filharmonie-brno.cz). Žádný ruční zásah nebyl potřeba, systém to vyřešil sám.

## Zpětná vazba syna — 5. 8. 2026
### Design/rozvržení (patří do dceřina designového večera, ne bodová oprava)
- Příliš mnoho textu bez struktury — zvážit boční osnovu/navigaci stránky
- Obsah zbytečně úzký uprostřed, nevyužitý prostor po stranách na širších obrazovkách
- Chipy „★ Oblíbené"/„✓ Navštívené" vizuálně sjednotit s výškou filtrů vlevo
- Barevné rozlišení mezi položkami/kategoriemi (budoucí potřeba, ne akutní)

### Chybí/neúplné (vysvětleno, není to bug)
- Dojezd v km a piny na mapě u starších akcí — čeká na doběhnutí zpětného geokódování/přegenerování dat, není potřeba nic opravovat
- Rozdíl v počtu akcí mezi městy (Praha 7, Brno 30+, jiná 0) — dané tím, že automatika běží jen pro aktivní profil; ostatní mají data jen z jednorázových ručních kontrol, nebo žádná

### Nové funkce k prozkoumání
- Kalendářní pohled s proklikem na akce v daném termínu (~4–6 h, odhad nejistý bez detailního rozvržení)
- UX: rozlišit „0 akcí, nikdy neprohledáno" od „0 akcí, prohledáno, nic nenalezeno" (jasnější stav pro neaktivní profily v dropdownu)

## Ke kontrole

## Testovací dluh
- **RF pokrytí obsahu podkategorie-chipů** (nápad, 20. 8. 2026) — dnešní RF test pro `#podkat-chips` (v3.50) ověřuje jen strukturální chování (prázdný kontejner bez výběru hlavní kategorie), ne konkrétní obsah po výběru kategorie, protože produkční data v tuhle chvíli nemají žádnou platnou podkategorii (čekají na re-kontrolu AI s novým promptem, viz CHANGELOG.md). Až proběhne dost kontrol s novým promptem a produkční data budou mít reálné podkategorie, zvážit rozšíření testu o ověření, že klik na konkrétní podkategorie-chip skutečně zúží seznam karet.
- RF test na opakované přepnutí profilu v dropdownu — regresní pojistka na bug v3.12 (#status mizel z DOM).
- RF test na opakované spuštění zpracovatSledovanaMesta — regresní pojistka na bug v3.18 (chybějící skip logika).
- ~~Automatizovaný výkonnostní test~~ — UZAVŘENO 19. 8. 2026: ruční ověření (viz CHANGELOG.md) potvrdilo, že anomálie z 17.–18. 8. (4,3–6,5 s) byla dočasná zátěž z opakovaných nasazení, ne regrese. Baseline ~1,4–2,9 s/request je daná Apps Script platformou samotnou (i cachovaná data trvají podobně) — pevný práh pro automatizovaný test by při týhle přirozené variabilitě (±50 %) spíš generoval falešné poplachy, proto se automatizace nezavádí. Případná budoucí optimalizace: zvážit paralelizaci/sloučení tří startovních requestů (meta+events+places) — jediná reálná páka, kterou měření ukázalo.
- **Rozšíření testovací sady po redesignu** (nápad, 17. 8. 2026, rozsah rozšířen 18. 8. 2026; odhad neurčen, závisí na rozsahu revize a počtu nově přidaných testů) — redesign UI (fáze 1–3, 17.–18. 8. 2026: barvy, responzivní sidebar/mřížka, kalendářní pohled, vestavěná mapa) i dřívější funkce (kontaktní formulář v3.24/v3.29, chip „❓ Neověřeno" v3.27) mají Node testy pro čistou logiku, ale chybí/je neúplné RF (E2E) pokrytí pro: responzivní chování (kategorie v sidebaru na širokých obrazovkách, mřížka karet, breakpointy 900px/1600px); kalendářní pohled (toggle na mobilu, klik na den → scroll, navigace mezi měsíci); kontaktní formulář (odeslání, validace v prohlížeči, ne jen backend logika); **nově (18. 8. 2026)**: tooltip v kalendáři (`#kalendar-tooltip`, hover na desktopu), seskupené piny na mapě (klik na pin s víc akcemi, tlačítka v popupu), a plánované dvouvrstvé sticky hlavičky (viz K ověření výše) — až budou implementované. Úkol: projít aktuální RF a Node testovací sadu vcelku, zkontrolovat pokrytí vůči všem funkcím přidaným za posledních několik session, rozšířit regresní sadu o chybějící scénáře, a zvážit, jestli by neměly přibýt i jiné druhy testů (např. vizuální regresní testy/screenshot diffing pro CSS změny, přístupnost/a11y kontrola, zátěžové testy). Nejde o jeden konkrétní test, ale o systematickou revizi testovacího pokrytí.
- **Podrobné RF/E2E pokrytí přesného pixelového zarovnání redesignu** (sticky offsety, zarovnání mapy k liště `#controls-oznaceni`, bod K) — záměrně odloženo z v3.43 (18. 8. 2026): tyhle testy jsou nejkřehčí kategorie (závisí na přesných souřadnicích/breakpointech), vizuální/manuální kontrola je spolehlivější a levnější než automatizace na pixel. Zvážit jen pokud se pixelové zarovnání v budoucnu rozbije opakovaně.
- Sledovat: ojedinělý HTTP 404 při přihlášení (19. 8. 2026 večer) — Vojta nahlásil chybu "Server vrátil HTTP 404" po zadání PINu, ruční ověření (claude-in-chrome, bez reálného PINu) neprokázalo problém (17/17 requestů 200, validace PINu funguje správně), o pár minut později se Vojta úspěšně přihlásil normálně. Nejpravděpodobnější příčina: přechodný hiccup Apps Script platformy (souvisí možná se zvýšenou latencí zdokumentovanou týž den, viz CHANGELOG.md) nebo stará cache prohlížeče. Bez akce teď — pokud se 404 při přihlášení zopakuje, prošetřit důkladněji (síťový log, konzole přesně v moment chyby).
- ~~Zjistit, proč Claude Code nenachází skill kulturni-radar-workflow automaticky~~ — VYŘEŠENO 19. 8. 2026: příčina potvrzena — Claude Code hledá skilly v `.claude/skills/<jméno>/SKILL.md`, ne v `Docs/`. Skill fyzicky existoval jen na `Docs/kulturni-radar-workflow/SKILL.md` (odkud ho čte Claude v hlavním chatu), proto ho Claude Code nenašel automaticky. Řešení: `SKILL.md` zkopírován (ne přesunut) do `.claude/skills/kulturni-radar-workflow/SKILL.md`. Zvažován symlink místo kopie (aby se do budoucna nerozjely dvě nezávislé verze), ale ověřeno, že `ln -s` v tomhle Windows prostředí bez zvýšených oprávnění tiše spadne zpět na plnou kopii adresáře (jiné inode, žádný `ReparsePoint` atribut) — spolehlivý symlink tu tedy není k dispozici, zůstává prostá kopie. **Důsledek: `Docs/…/SKILL.md` je zdroj pravdy, `.claude/skills/…/SKILL.md` je jeho ruční kopie — při každé budoucí úpravě SKILL.md aktualizovat OBĚ kopie, jinak se rozjedou.**

## Probíhající měření
- **Haiku vs. Sonnet na denní kontrole** — SPUŠTĚNO 20. 8. 2026 (backend v3.27, viz CHANGELOG.md): denní automatická kontrola (`dailyCheck` → typ `'denní kontrola'`) běží na `claude-haiku-4-5`, všechny ostatní běhy (mimořádné z menu/webu, osobní hledání, sledovaná města, měsíční kontrola stálých míst) zůstávají na Sonnetu (`vyberModelProKontrolu_`). List KONTROLY (sloupec K) teď zaznamenává skutečně použitý model pro každý běh, ne jen globální konstantu — díky tomu jde řádky zpětně rozlišit podle modelu. **Vyhodnocení a rozhodnutí: 27. 8. 2026** — porovnat kvalitu úlovků denní kontroly (Haiku) proti ostatním běhům (Sonnet) v listu KONTROLY a rozhodnout, jestli Haiku pro denní běh trvale stačí, nebo se vrátit k Sonnetu.
  PŘIPOMÍNKA: vyhodnotit 27. 8. 2026 — zkontrolovat sloupec K v listu KONTROLY (filtrovat řádky typu 'denní kontrola' za 20.–27. 8. 2026, porovnat kvalitu/počet nalezených akcí s předchozími Sonnet běhy), rozhodnout, jestli Haiku pro denní kontrolu zůstává natrvalo, nebo se vrací na Sonnet.

## Větší témata
- ~~Plnohodnotná interaktivní mapa akcí (víc pinů najednou)~~ — **HOTOVO 17.–18. 8. 2026** (fáze 3 redesignu, Index.html v3.35–v3.38, viz CHANGELOG.md): vestavěná Leaflet mapa se všemi piny najednou, akce na stejném místě seskupené do jednoho pinu, popup s odkazem zpět do seznamu. Odkaz „📍 Mapa" na kartě (v3.10, jedna akce, garantovaný pin díky souřadnicím z Nominatim) zůstává beze změny vedle ní — dvě různé věci.
- ~~Klik na akci → přidat na mapu jako „vybranou"~~ — **HOTOVO 18. 8. 2026** (Index.html v3.41, viz CHANGELOG.md): klik na titulek akce v seznamu i řádek nového seznamu míst pod mapou přepíná výběr pinu (sdílený mechanismus `vybranePiny_`/`prepnoutVyberPinu_`), vybraný pin dostane odlišnou ikonu a mapa se na něj přiblíží. Otevřená otázka z nápadu (nahradí auto-zobrazení, nebo poběží vedle něj) vyřešena: běží vedle něj – výběr je čistě vizuální zvýraznění nad existujícím auto-zobrazením podle filtru, nefiltruje piny.
- Strukturované časy `cas_od`/`cas_do` — přesnější „Do kalendáře" (dnes celodenní), řazení akcí v rámci dne.
- Případná Android aplikace (výukový projekt) — cesta: PWA → Trusted Web Activity → Google Play. Frontendový večer (podmínka vlastní domény) hotov 8. 8. 2026.
- ~~**API credit optimalizace**~~ — **HOTOVO, OVĚŘENO 21. 8. 2026** přímo v konzoli Anthropic (Billing): Monthly spend limit $15 (nastaveno), e-mailové notifikace při spend $10 (nastaveno), auto-reload s prahem $5 → dobíjí na $15 (nastaveno). Všechny tři dříve navržené kroky byly už v konzoli aktivní (nejspíš nastaveno v dřívější session, jen nezapsáno do BACKLOG.md) — žádná další akce potřeba. (`MAX_WEB_SEARCHES` už dřív sníženo na 3 ve v3.6; Haiku experiment pro denní kontrolu spuštěn 20. 8. 2026, viz „Probíhající měření" výše.)
- ~~**Email zpracování návrhů**~~ — **KOMPLETNĚ HOTOVO 20. 8. 2026** (v3.29, viz CHANGELOG.md): fronta `EMAIL_TIPY`, webhook příjem (`apiEmailTip_`), AI ověření webem (`callAnthropicEmailTip_`/`zpracovatEmailTipy_`), propojení do `dailyCheck` + denní report. Cloudflare Email Worker (`cloudflare-worker/`) nasazen (`wrangler deploy`, `EMAIL_WEBHOOK_TOKEN` nastavený na obou stranách, Email Routing pravidlo pro `info@kulturniradar.cz` přepnuté na "Send to a Worker") a ověřen živým testovacím mailem — dorazil na Gmail beze změny a zároveň se propsal do listu `EMAIL_TIPY`. Zpracování fronty (AI ověření + zápis do AKCE) proběhne při příští `dailyCheck`.
- **Cesta B zrychlení přihlášení — ZVÁŽIT JEN PODMÍNĚNĚ** (průzkum 19. 8. 2026): omezit `apiEvents` čtení jen na relevantní profil místo plných čtení celých listů (AKCE/OZNAČENÍ/SOUŘADNICE/POČASÍ). Průzkum ukázal, že (1) cache (v3.23, TTL 45s) už řeší přesně ten scénář, kde by tohle pomohlo nejvíc, (2) měření výkonu z 19. 8. 2026 (viz CHANGELOG.md) ukázalo, že i cache-hit odpovědi jsou pomalé kvůli Apps Script platformní režii mimo náš kód, ne kvůli čtení Sheets — Cesta B by tedy cílila na latenci, která podle vlastních dat není tam, kde se předpokládalo, (3) technicky nejde číst „jen relevantní řádky" bez buď dalšího síťového round-tripu (riziko zpomalení místo zrychlení), nebo zásadnějšího přepracování schématu SOUŘADNICE/POČASÍ, které dnes nejsou profilově klíčované. Riziko regrese (posun filtrovací logiky, mapování souřadnic/počasí) je konkrétní, přínos pravděpodobně malý až žádný. ZVÁŽIT ZNOVU JEN POKUD: budoucí měření ukáže, že konkrétně čtení AKCE (ne platformní overhead) je měřitelná část latence — např. až AKCE naroste na řádově tisíce řádků.
- **Mini předpověď počasí (P, v3.45) — zvážit Cestu B** (~2–3 h, volitelné): dnešní implementace běží Cestou A (frontend volá Open-Meteo přímo, `fetch`, cache jen v paměti běhu stránky, žádný backend zásah) — záměrně nejmenší možný zásah. Pokud by se v budoucnu ukázalo, že tohle zatěžuje Open-Meteo rate limit, je pomalé, nebo bychom chtěli víc než 3 dny/přesnější souřadnice města (dnes odvozené jen z první geokódované akce ve výběru, ne ze skutečného středu města), zvážit migraci na Cestu B: nový backend endpoint `apiPocasiMesto` s `CacheService` cachováním, viz rozsah v diskuzi 18. 8. 2026 (CHANGELOG.md v3.45).
  AKTUALIZACE 20. 8. 2026 (ověření Cesty A): živé měření z produkce potvrdilo, že Cesta A funguje dobře - přímé volání Open-Meteo z prohlížeče trvalo 41 ms, HTTP 200, žádná chyba. Pro srovnání, appka samotná (?api=meta, Apps Script) běžně trvá 1,4–2,9 s - Open-Meteo je tedy řádově rychlejší, ne úzké hrdlo. Rate limit nebyl testován zátěžově, ale Open-Meteo je veřejné API navržené pro přímé volání z frontendu (limit 10 000 volání/den na neautentizovaný přístup), pro rodinnou appku s pár uživateli dostatečné. Žádný reálný problém s Cestou A se nepotvrdil - migrace na Cestu B by teď řešila neexistující problém. ROZHODNUTÍ: ponechat Cestu A beze změny. Průběžně sledovat (např. při budoucích diagnostikách výkonu appky) - pokud by se v budoucnu objevil skutečný problém (rate limit chyby, nespolehlivost, potřeba delší předpovědi/přesnějších souřadnic než dnešní odvození z první akce ve výběru), Cesta B zůstává k dispozici jako připravené řešení.
- **Notifikace o akcích — rozšířený rozsah, ROZPRACOVÁNO** (nápad 10. 8. 2026, rozsah upřesněn a rozdělen na kroky 21. 8. 2026): oproti původnímu nápadu (jen pevný týdenní/víkendový souhrn) rozhodnuto 21. 8. 2026, že uživatel volí VŠECHNY TŘI parametry sám — kanál (email/ntfy/oba), frekvenci (vlastní volba, ne jen pevná), obsah (podle kategorií, nebo „doporučujeme pro vás", nebo oba). To je plnohodnotný systém uživatelských preferencí, rozdělený na kroky A–G:
  - ~~**A) Datový model**~~ — **HOTOVO 21. 8. 2026** (backend v3.30, viz CHANGELOG.md): nový sloupec `Notifikace` (JSON) v listu UŽIVATELÉ.
  - ~~**B) Backend API**~~ — **HOTOVO 21. 8. 2026** (backend v3.30, viz CHANGELOG.md): `apiSetNotifikace_`/`apiVygenerovatNtfyTema_`/`validovatNotifikace_`, routované přes `set-notifikace`/`vygenerovat-ntfy-tema`. ntfy téma je vždy server-generované (nikdy z klienta — ntfy.sh nemá autentizaci), `posledniOdeslano` jako ISO 8601 string, kanál↔kontakt validace (e-mail vyžaduje adresu, ntfy vyžaduje už vygenerované téma).
  - ~~**C) Obsah „podle kategorií"**~~ — **HOTOVO 21. 8. 2026** (backend v3.31, viz CHANGELOG.md): `digestProUzivatele_` sestavuje digest podle `filtry.kategorie` konkrétního uživatele, jen čte `readEventsInRange_` (žádné volání Anthropic API), sdílí formátovací bloky s `digestRange_` přes novou `sestavBlokyAkci_`. Vynechává „Stálá místa" (vědomě, není kategorie-related).
    - **ZNÁMÉ OMEZENÍ** (existující limitace celého systému, ne něco, co krok C zavádí nově): `readEventsInRange_`/`digestProUzivatele_` berou jen JEDNO aktivní město z KRITÉRIÍ pro celou domácnost — pokud by uživatel chtěl sledovat jiné město, než je dnes aktivní, jeho osobní digest to nezohlední. Řešitelné až budoucí per-user volbou sledovaného města (mimo rozsah kroku C).
  - ~~**D) Trigger + odesílací smyčka**~~ — **HOTOVO 21. 8. 2026** (backend v3.32, viz CHANGELOG.md): nový denní trigger `sendUserNotifications` (9:00, po `dailyCheck` 8:00), `odeslatNotifikaci_` extrahováno ze `sendNotification_` (adresuje explicitní topic/e-mail, sdíleno mezi family-wide a per-user posíláním), čistá logika `jeDueNaNotifikaci_`/`planNotifikaceUzivatele_` oddělená od odesílacího orchestrátoru `sendUserNotifications_(dryRun)`. Dry-run: `Logger.log` + návratové pole + menu „Notifikace: suchý běh (test)" s `SpreadsheetApp.getUi().alert(...)` shrnutím. Vedlejší rozhodnutí: rozsah `frekvenceDny` snížen z 1–90 na **1–30** ve `validovatNotifikace_` (okno obsahu nikdy nepokryje víc než ~30 dní, delší frekvence by tiše nechávala mezery).
    - **Drobná poznámka pro budoucnost, neblokující** (21. 8. 2026): `sendUserNotifications_` volá `readUzivatele_(ss)` znovu pro každého odesílaného uživatele (kvůli nalezení indexu řádku pro zápis `posledniOdeslano`) — pro ~4 rodinné profily zanedbatelné, ale stálo by za zvážení cachovat/index sestavit jednou, kdyby uživatelů výrazně přibylo.
  - ~~**E) Frontend UI**~~ — **HOTOVO 21. 8. 2026** (backend v3.33 + Index.html v3.54, viz CHANGELOG.md): nová sekce „Notifikace" v `#filtry-dialog` (rozšíření „Můj profil", ne nový modal) — dva checkboxy kanálu (e-mail/ntfy, každý s vlastní podmíněně viditelnou oblastí), `<select>` frekvence s presety 1/3/7/14/30, statický popisek obsahu (`obsah:['kategorie']` posílá handler implicitně, žádný checkbox). ntfy téma jen jako odkaz na `https://ntfy.sh/<tema>` + tlačítko rotace — NIKDY needitovatelné pole, žádná QR knihovna (vědomě, MVP). Jedno sjednocené tlačítko „Uložit" (volá `apiSetFiltry` pak `apiSetNotifikace` sekvenčně). Cestou dořešeny 3 chybějící propojení (gaps) objevené při návrhu: no-underscore wrappery `apiSetNotifikace`/`apiVygenerovatNtfyTema` v `.gs`, odpovídající case větve v `sestavFetchPozadavek_`, a rozšíření login handleru (`sestavPrihlasenehoUzivatele_`) — všechny tři kryté Node testy, ne jen RF na chování UI.
  - **F) Testy + nasazení + dokumentace** — z větší části hotovo průběžně (Node testy pro C+D+E, RF testy pro E napsané, CHANGELOG/BACKLOG update a clasp deploy proběhly 21. 8. 2026 spolu s krokem E). **Zbývá jen:** živě spustit RF sadu (`tests/robot/frontend.robot`) proti nasazenému `?exec` a potvrdit, že nové testy pro sekci Notifikace skutečně procházejí — RF testy nejdou spustit z vývojového prostředí bez prohlížeče/živého nasazení, takže zůstávají neověřené až do prvního běhu po tomhle nasazení.
  - **G) Obsah „doporučení" — VĚDOMĚ ODLOŽENO** (rozhodnutí 21. 8. 2026, ne zapomenuto): `spocitatDoporuceni_` (Roční přehled Část 2, Index.html v3.53) běží na FRONTENDU — notifikace ale vznikají na BACKENDU (e-mail/ntfy se posílá ze serveru, uživatel nemusí mít appku otevřenou), takže heuristika by se musela portovat/duplikovat i do `.gs`. Port je technicky snadný (`readEventsApi_` už počítá kategorie/podkategorie/mistoOblibene per uživatel, stejná data jaká heuristika potřebuje), ale je to ~20 řádků logiky BEZ sdíleného modulu mezi Index.html a .gs (projekt záměrně nemá build/bundler krok) — reálné riziko je drift mezi dvěma kopiemi při budoucím ladění, ne implementace samotná. Rozhodnuto počkat, až heuristika projde reálným použitím v Ročním přehledu a ustálí se, než se zdvojuje. Zvážit znovu až rodina potvrdí, že „doporučení" jako typ obsahu opravdu chce.
  - Odhad zbytku: ~10–15 min (jen živé spuštění RF sady po nasazení, viz krok F výše). Kroky A–F kompletně hotové.
- ~~**Oblíbená místa + filtr podle nich**~~ — HOTOVO 19. 8. 2026, kompletně A–I (backend v3.26 + Index.html v3.46–v3.49 + RF testy, viz CHANGELOG.md). Možnost označit MÍSTO konání (ne jednotlivou akci) jako oblíbené: ikona 🏛 na kartě akce, backend `apiToggleMisto_`/`oblibenaMistaSety_`, pole `mistoOblibene` v `apiEvents`, filtr chip `#chip-oblibena-mista` (kombinovatelný s ★/✓/❓/kategoriemi, promítá se i do mapy/`#mapa-mista`), sync stavu napříč všemi kartami se stejným místem po kliknutí (`akceSeStejnymMistem_`, G), Node testy pro testovatelné pure funkce (H), RF testy pro plný cyklus + filtr (I). Klíč místa je backendový `klicSouradnic_(misto, obec)` (normalizovaný `misto|obec` text, NE frontendový lat/lng klíč z v3.41 — ten by nefungoval pro akce bez souřadnic). Vědomě mimo rozsah, ne plánováno automaticky: piny na mapě nemají vlastní vizuální indikátor `mistoOblibene` (na rozdíl od karet); RF-level test pro G napříč více kartami (nespolehlivá scrapovaná testovací data, chybí `data-misto` atribut).
- **Rozšíření zdrojů pro objevování akcí — ověřit pokrytí a zvážit nápovědu pro AI web search** (nápad, 20. 8. 2026): Průzkum ukázal, že časopisy KAM v Brně / WHERE in Brno a Food Drink Brno (vydavatelství Pocket media, dnes na Issuu.com jako flipbook) NEJDOU strojově číst — Issuu renderuje obsah jako obrázky stránek v JS vieweru, žádný extrahovatelný text. OCR by bylo pracné, křehké a autorskoprávně sporné (placený redakční obsah).
  Stejné vydavatelství ale provozuje objevbrno.cz — moderní web s kalendářem akcí (/cs/udalosti, /cs/akce-brno, /cs/akce-zdarma, /cs/festivaly-udalosti aj.). Samotné seznamy akcí bohužel taky nejdou vytáhnout (Next.js app, obsah se dotahuje přes client-side JS, fetch vidí jen prázdnou navigační kostru) — ALE měsíční redakční články (např. /cs/article/top-akce-srpen-brno, "TOP akce [měsíc] v Brně") jsou staticky vykreslené a plně čitelné, s konkrétními akcemi, popisy a někdy odkazy na zdroje.
  Tyhle články pravděpodobně appka už dnes nachází přirozeně přes AI web search (je to veřejně indexovaný, dobře kurátorovaný obsah, ne schovaný za JS jako kalendář) — nejde tedy o unikátní zdroj vyžadující vlastní scraper. Navrhované kroky k ověření/rozšíření:
  1. Ověřit, jestli aktualizujAkce_ (AI web search pipeline) objevbrno.cz měsíční články už zachytává — pokud ne, zvážit přidání 'objevbrno.cz' jako doporučeného zdroje do promptu pro AI (nápověda k prohledání, ne pevný scraper).
  2. Stejný princip zkusit i pro DALŠÍ sledovaná města (SLEDOVANÁ MĚSTA sheet) — najít, jestli mají podobné lokální kulturní magazíny/weby (analogie ke Kam v Brně) s obdobně čitelnými redakčními přehledovými články, a případně je taky přidat jako nápovědu do AI promptu.
  3. Obecnější poznámka k budoucímu zvážení: při hledání nových zdrojů preferovat běžné HTML weby s articles/redakčním obsahem před PDF/flipbook/JS-heavy kalendáři — ty první jsou pro AI web search spolehlivě dostupné, ty druhé prakticky ne.
  AKTUALIZACE 20. 8. 2026: krok 1 dokončen — objevbrno.cz přidán jako řádek do listu ZDROJE (typ: agregátor, priorita: střední, profil: Brno, URL: https://www.objevbrno.cz/cs/udalosti), ruční úprava přímo v Google Sheetu (Claude v hlavním chatu, claude-in-chrome). Projeví se při příští kontrole akcí. Krok 2 (stejný princip pro další sledovaná města) zůstává otevřený.
  AKTUALIZACE 20. 8. 2026 (krok 2, rychlý web průzkum): pro zbývající sledovaná města bez vlastního zdroje v ZDROJE listu (Olomouc, Plzeň, Třinec, Zlín) nalezeno:
  - Plzeň: Žurnál Plzeň (zurnalmag.cz/program) — dobrá analogie ke Kam v Brně, pravidelný týdenní program. Kandidát k přidání do ZDROJE (typ: agregátor, priorita: střední, profil: Plzeň).
  - Zlín: Živý Zlín (kulturazlin.cz/akce) — kulturní centrum provozované přímo městem, aktuální kalendář. Kandidát k přidání (typ: oficiální kulturní organizace nebo agregátor, priorita: střední/vysoká, profil: Zlín).
  - Olomouc: žádný specifický magazín nalezen, jen oficiální městský kalendář (olomouc.eu/portal/kalendar) — případně přidat jako standardní 'oficiální městský kalendář' typ, ne jako doplňkový agregátor.
  - Třinec: nic výrazně lepšího než obecné agregátory (KulturniMapa.cz, GoOut) — nenalezen žádný silný kandidát, zůstává otevřené.

  Přidání řádků do ZDROJE (Sheet) zatím NEPROVEDENO — jen průzkum, čekalo se na čas. Až bude čas, přidat Žurnál Plzeň a Živý Zlín stejným postupem jako objevbrno.cz (ruční zápis do Sheetu).
  AKTUALIZACE 20. 8. 2026 (dokončení kroku 2 pro Plzeň a Zlín): Žurnál Plzeň (zurnalmag.cz/program, agregátor, střední, profil Plzeň) a Živý Zlín (kulturazlin.cz/akce, oficiální kulturní organizace, střední, profil Zlín) přidány jako řádky do listu ZDROJE, ruční úprava přímo v Sheetu. Projeví se při příští kontrole akcí daných profilů. Zbývá otevřené: Olomouc (jen oficiální městský kalendář, bez specifického magazínu) a Třinec (žádný silný kandidát nenalezen).
  AKTUALIZACE 20. 8. 2026 (krok 2 KOMPLETNĚ UZAVŘEN): Olomoucká Drbna (olomouckadrbna.cz, agregátor, střední, profil Olomouc) přidána jako řádek do ZDROJE — regionální zpravodajský portál s vlastní sekcí kultura/akce. Pro Třinec žádný specifický magazín/agregátor nenalezen ani po druhém pokusu — přidán tedy alespoň oficiální městský kalendář (trinecko.cz/kulturni-akce, oficiální městský kalendář, vysoká, profil Třinec). Tímto mají VŠECHNA sledovaná města (Brno, Praha, Znojmo, Plzeň, Zlín, Olomouc, Třinec) pokrytí v ZDROJE listu a krok 2 je kompletně uzavřen.

## Plán rozvoje — schváleno 4. 8. 2026, aktualizováno 8. 8. 2026
1. ~~**Rodinné profily**~~ — **HOTOVO 7.–8. 8. 2026** (backend v3.20, frontend
   v3.13), viz CHANGELOG.md. Realizováno s PINem (ne bez hesla, jak původně
   plánováno) a s podporou osobních vyhledávacích filtrů navíc oproti
   původnímu rozsahu. Realita: 4 rodinné profily + 1 vyhrazený `rf-test`
   pro CI, prostor pro další.
2. ~~**Frontendový večer**~~ — **HOTOVO 8. 8. 2026**: `Index.html` migrován
   na Cloudflare Pages (ne GitHub Pages, jak se plánovalo — jinak beze
   změny záměru), doména kulturniradar.cz aktivní se SSL, Email Routing
   pro info@ ověřeno doručením, RF sada 22/22 na nové doméně. Viz
   CHANGELOG.md.
3. ~~**Sdílení celého výběru/filtrovaného seznamu**~~ — **HOTOVO 8. 8. 2026**
   (frontend v3.20): tlačítko „📤 Sdílet výběr" vedle ★ Oblíbené/✓ Navštívené
   sdílí aktuální město + zvolené kategorie jako deep link
   (`?profil=Město&kategorie=a,b`), odlišný formát od jedno-akcového
   `?akce=ID&profil=Město` (v3.17). Příjemce otevře odkaz a appka je rovnou
   předfiltrovaná. Viz CHANGELOG.md.
4. **Android appka** (~3–4 h práce + dny čekání na schválení Play Store) —
   vyžaduje krok 2 hotový (PWA potřebuje vlastní doménu).
5. **Multi-tenant systém** — řádově týdny, viz vize níže.

## Dlouhodobá vize — multi-tenant platforma (jiný produkt, ne rozšíření)
Nápad z 4. 8. 2026: plnohodnotné přihlašování s heslem + sdílení plánů mezi
cizími rodinami (ne jen v rámci jedné domácnosti). Vyžaduje kategoricky
jinou architekturu, ne přírůstek k dnešní appce:
- Sheets → skutečná multi-tenant databáze (Firestore/Postgres)
- Apps Script → hostovaný backend (Cloud Run / Firebase Functions)
- „Token v URL" → skutečné přihlašování (doporučeno: Google Sign-In/Firebase Auth, ne vlastní hesla)
- Nutná moderace veřejně sdíleného obsahu
- GDPR vrstva: zásady ochrany osobních údajů, právo na výmaz, souhlas
- Reálné provozní náklady a odpovědnost (dnes běží zdarma na Google infra)

Přenositelné beze změny: AI vyhledávací logika (`callAnthropic_`,
`report_events` schéma), UX vzorce (karty, chipy, Oblíbené/Navštívené),
doména kulturniradar.cz, veškerá logika datové hygieny (deduplikace,
parsování datumů, detekce vycpávek).

Doporučený postupný krok (ne najednou):
1. ~~Osobní profily v rámci jedné rodiny~~ — hotovo 7.–8. 8. 2026, viz plán výše.
2. ~~Frontendový večer (doména)~~ — hotovo 8. 8. 2026 (Cloudflare Pages,
   ne GitHub Pages, viz plán výše)
3. ~~Sdílení celého výběru/filtrovaného seznamu~~ — hotovo 8. 8. 2026, viz plán výše.
4. Plnohodnotný multi-tenant systém – dlouhodobý horizont, ne blízký plán

Odhad rozsahu: řádově týdny soustředěné práce, ne jedna session.

## Trvalá pravidla (ne úkoly, ale konvence)
- Při každém „Nová verze" v Apps Scriptu vyplnit pole Popis podle aktuální `VERZE`.
- Formalizováno jako Claude skill kulturni-radar-workflow (4. 8. 2026) — viz Docs/kulturni-radar-workflow/.
