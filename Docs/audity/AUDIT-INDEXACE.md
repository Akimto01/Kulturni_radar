# Audit indexace pro Google/AI crawlery — návrh, část (a)

(BACKLOG.md „Indexace appky pro Google i AI crawlery", bod **(a) Levné a
nezávislé na velikosti appky**.)

Stav: **schváleno Vojtou 23. 8. 2026, implementováno a nasazeno** (viz
CHANGELOG.md pro finální výsledky live ověření). Vychází z
`apps-script/Index.html` ke commitu `8311581` (23. 8. 2026).

## 0. Shrnutí a nejdůležitější zjištění

Appka dnes nemá **žádnou** z požadovaných věcí — žádné meta tagy nad rámec
`charset`/`viewport`/`title`, žádný favicon, žádný `robots.txt`/`sitemap.xml`
v repu, žádná strukturovaná data. Ověřeno v kódu, ne odhadem (viz oddíl 1).

**Nejdůležitější zjištění, které mění zadání:** `kulturniradar.cz` už DNES
živě servíruje `robots.txt` — ale ne z našeho repa. Cloudflare (platforma,
na které web běží) do každé zóny automaticky vkládá vlastní „Managed
content" blok s **explicitním `Disallow: /` pro GPTBot, ClaudeBot,
Google-Extended, Bytespider, CCBot, Amazonbot, Applebot-Extended a
meta-externalagent** (ověřeno živě: `curl https://kulturniradar.cz/robots.txt`,
23. 8. 2026, plný výstup viz oddíl 3). To je přesně opačný stav, než co
BACKLOG.md popisuje jako cíl („GPTBot/ClaudeBot/PerplexityBot"). PerplexityBot
v seznamu není, ten dnes blokovaný není.

Tenhle blok je vkládaný na úrovni Cloudflare edge (ne z originu appky) —
**ověřeno přímo v oficiální Cloudflare dokumentaci** (23. 8. 2026, ne jen
odhad): Cloudflare svůj managed blok VŽDY PŘEDŘADÍ před obsah, co vrátí
origin, bez ohledu na to, jestli origin vlastní `robots.txt` má:

> „Cloudflare will prepend our managed robots.txt before your existing
> robots.txt, combining both into a single response."
> — [developers.cloudflare.com/bots/additional-configurations/managed-robots-txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)

Náš vlastní `robots.txt` v repu ho tedy **nemůže přepsat ani obejít** —
je to potvrzené, ne domněnka. Konfigurace je navíc výslovně jen přes
dashboard, žádné API/Terraform/config-as-code:

> „In the Cloudflare dashboard, go to the Security Settings page… Turn on
> 'Set your preference to block training in robots.txt.'"
> — tamtéž

Pro POVOLENÍ konkrétních botů (GPTBot/ClaudeBot) existuje granulárnější
nástroj — **AI Crawl Control** (dostupný i na Free planu), kde jde
přepnout povolení/blokaci PER CRAWLER:

> „Cloudflare's AI Crawl Control view lists activity per crawler and lets
> you override individual bots."
> — [developers.cloudflare.com/ai-crawl-control](https://developers.cloudflare.com/ai-crawl-control/)

Jestli chce Vojta GPTBot/ClaudeBot povolit, jediná cesta je Cloudflare
dashboard (zóna `kulturniradar.cz` → Security → AI Crawl Control, případně
Security Settings pro obecný přepínač) — **potvrzeno, že se to NEDÁ vyřešit
souborem v repu ani jinou konfigurací v kódu.** Viz oddíl 7, otázka 1.

Druhé důležité zjištění (architektonické, ne překvapení — BACKLOG.md bod
(b) na to už dopředu upozorňuje): appka je čistě client-side rendered
(JS fetch dat po načtení stránky). To znamená:
- **Meta tagy/favicon/robots.txt/sitemap.xml** — fungují normálně, jsou to
  statické věci nezávislé na JS.
- **Schema.org Event JSON-LD pro sdílenou akci** — dá se vložit jen
  DODATEČNĚ přes JS po načtení dat (appka neví, kterou akci ukázat, dokud
  nedostane odpověď z API). Googlebot dnes JS spouští a takhle vložený
  JSON-LD přečte, ale **klasické crawlery na link-preview (Facebook,
  Twitter/X, Slack, WhatsApp) JS nespouští** — ty uvidí jen statický obsah
  prvního HTTP requestu, tedy obecné OG tagy appky, NE konkrétní název/datum
  sdílené akce. Skutečný per-akce OG náhled (obrázek/název KONKRÉTNÍ akce
  v sociální kartě) by vyžadoval server-side rendering podle `?akce=ID` –
  přesně to, co BACKLOG.md bod (b) odkládá na budoucí přestavbu. Tahle
  část (a) tedy řeší Google/AI-crawler indexaci (JS-aware), ne pěkné
  sociální náhledy konkrétních sdílených akcí (to zůstává obecná karta
  appky pro všechny odkazy).

## 1. Inventář současného stavu

Ověřeno přímo v `apps-script/Index.html:1–11` a živě přes `curl`:

| Položka | Stav |
|---|---|
| `<meta name="description">` | **chybí** |
| Open Graph (`og:*`) | **chybí** |
| Twitter card (`twitter:*`) | **chybí** |
| `<link rel="icon">` / favicon | **chybí** — `curl -I https://kulturniradar.cz/favicon.ico` vrací 200, ale je to jen SPA fallback appky (celý `Index.html`), ne skutečná ikona. Prohlížeč dnes zobrazuje výchozí prázdnou ikonku. |
| `robots.txt` v repu | **chybí** — `kulturniradar.cz/robots.txt` dnes vrací JEN Cloudflare Managed content blok (viz oddíl 0 a 3), nic z appky. |
| `sitemap.xml` v repu | **chybí** |
| Strukturovaná data (JSON-LD) | **chybí** |
| `<link rel="canonical">` | chybí — záměrně nenavrhuji doplnit, viz oddíl 6 |

Doplňkově ověřeno: appka je servírovaná na dvou nezávislých kanálech
(stejně jako u auditu selektorů) — `kulturniradar.cz` (Cloudflare Pages) a
Apps Script `/exec` (`doGet` → `HtmlService.createHtmlOutputFromFile('Index')`,
`kulturni_radar.gs:177–186`).

**Revize k build output directory (po zpětné kontrole, NE 100% jistota —
viz otevřená otázka 5):** Původně jsem napsal, že build output je
`apps-script/`, s odůvodněním „SPA fallback funguje pro JAKOUKOLI cestu".
Při zpětné kontrole ale tohle odůvodnění neobstojí: `curl -o /dev/null -w
'%{content_type}'` na `/appsscript.json` (soubor, který v `apps-script/`
REÁLNĚ existuje, pokud by to byl build output) vrací `text/html`, ne
`application/json`. Kdyby `apps-script/` byl skutečně build output
adresář, Cloudflare Pages by reálně existující soubor servírovala s jeho
vlastním content-type, ne přes SPA fallback — SPA fallback se typicky
uplatní jen na cesty, které v build outputu REÁLNĚ neexistují. To, že
`/appsscript.json` i `/README.md` (soubor z úplně jiného místa, repo
kořene) vrací STEJNÝ fallback, ukazuje spíš na plošné pravidlo (např.
`_redirects` s `/* /index.html 200`), které by mohlo přebít i nově
přidané `robots.txt`/`sitemap.xml`/`favicon.svg`, ať je dám kamkoli.
**Tohle NEJDE ověřit jen chováním SPA fallbacku — potřeba buď nahlédnout
do Cloudflare dashboardu, nebo počkat na živé ověření po nasazení** (curl
na `/favicon.svg` apod. — pokud vrátí reálný obsah se správným
content-type, umístění bylo správně; pokud vrátí HTML fallback, budeme
to muset řešit jinak, možná přes `_redirects`/`_headers` pravidlo). Viz
otevřená otázka 5.

## 2. Návrh — meta tagy v `<head>`

Statické, obecné pro celou appku (ne per-akce — viz oddíl 0). Vkládám hned
za `<title>`:

```html
<meta name="description" content="Automatické hlídání kulturních akcí v okolí – Brno a další města ČR. Denní přehled podle kategorie, mapa, kalendář a filtrování zdarma.">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Kulturní radar">
<meta property="og:title" content="Kulturní radar">
<meta property="og:description" content="Automatické hlídání kulturních akcí v okolí – Brno a další města ČR. Denní přehled podle kategorie, mapa, kalendář a filtrování zdarma.">
<meta property="og:url" content="https://kulturniradar.cz/">
<meta property="og:locale" content="cs_CZ">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Kulturní radar">
<meta name="twitter:description" content="Automatické hlídání kulturních akcí v okolí – Brno a další města ČR. Denní přehled podle kategorie, mapa, kalendář a filtrování zdarma.">

<link rel="icon" type="image/svg+xml" href="/favicon.svg">
```

Text popisu vychází z `README.md` (řádky 1–4), jen zkrácený/upravený do
jedné věty vhodné pro meta description (ideál ~150–160 znaků, tenhle má
~140).

**`og:image`/`twitter:image` záměrně nenavrhuji** — appka nemá žádný
existující grafický asset (logo/screenshot), a ručně psát binární
PNG/JPG do repa nejde. Bez obrázku sdílené odkazy dostanou kartu s
titulkem+popisem, bez náhledu — funkční, jen míň atraktivní. Viz otevřená
otázka v oddíle 7, pokud chce Vojta obrázek doplnit později (stačí pak
přidat dva `<meta>` řádky, žádná další změna).

## 3. Návrh — `robots.txt` (`apps-script/robots.txt`, nový soubor)

```
User-agent: *
Allow: /

Sitemap: https://kulturniradar.cz/sitemap.xml
```

Záměrně minimální a NEobsahuje vlastní pravidla pro konkrétní boty
(GPTBot/ClaudeBot/…) — dvě zjištění to zdůvodňují:

1. **Cloudflare do odpovědi na `/robots.txt` vkládá vlastní blok** (ověřeno
   živě, plný obsah — zkráceno na podstatné části):
   ```
   # BEGIN Cloudflare Managed content
   User-agent: *
   Content-Signal: search=yes,ai-train=no,use=reference
   Allow: /

   User-agent: Amazonbot
   Disallow: /
   User-agent: Applebot-Extended
   Disallow: /
   User-agent: Bytespider
   Disallow: /
   User-agent: CCBot
   Disallow: /
   User-agent: ClaudeBot
   Disallow: /
   User-agent: CloudflareBrowserRenderingCrawler
   Disallow: /
   User-agent: Google-Extended
   Disallow: /
   User-agent: GPTBot
   Disallow: /
   User-agent: meta-externalagent
   Disallow: /
   # END Cloudflare Managed Content
   ```
   Za tímhle blokem následuje přímo obsah, co appka vrátí NA `/robots.txt`
   sama (dnes: SPA fallback, tedy `Index.html`) — tedy Cloudflare
   **PŘIDÁVÁ** svůj blok PŘED obsah originu, nenahrazuje ho.
2. **Potvrzeno v oficiální dokumentaci** (ne jen odhad z pozorovaného
   chování — viz citace v oddíle 0): Cloudflare tohle chování má zdokumentované
   explicitně — „Cloudflare will prepend our managed robots.txt before your
   existing robots.txt, combining both into a single response." Platí to
   VŽDY, i když origin (náš `apps-script/robots.txt`) vlastní obsah má. Kdybychom
   do vlastního souboru napsali např. `User-agent: GPTBot / Allow: /`,
   výsledná odpověď by obsahovala DVĚ skupiny pravidel pro GPTBot
   (Cloudflaří `Disallow: /` PŘED naší `Allow: /`) — spoléhat na to, že
   naše pravidlo „vyhraje", by bylo nespolehlivé (robots.txt specifikace
   duplicitní user-agent skupiny neřeší jednotně, chování se liší podle
   crawleru), takže to ani nenavrhuju zkoušet. Jediná zdokumentovaná cesta
   k přepnutí je Cloudflare dashboard (Security Settings pro obecný
   přepínač, AI Crawl Control pro povolení jednotlivých botů) — bez API/
   Terraform/config-as-code podpory podle dokumentace.

**Náš `robots.txt` tedy řeší jen to, co Cloudflare neřeší** — obecné
`Allow: /` (shoduje se s Cloudflare výchozím, neškodí) a hlavně
**`Sitemap:` řádek**, který Cloudflare nevkládá a který appka dnes vůbec
nemá.

Živé ověření po nasazení (Vojta, až schválíš a deployneš): zkontrolovat
`curl https://kulturniradar.cz/robots.txt` — očekávám Cloudflare blok +
NÁŠ obsah za ním (ne už SPA fallback na `Index.html`).

## 4. Návrh — `sitemap.xml` (`apps-script/sitemap.xml`, nový soubor)

Minimální varianta — jen domovská stránka:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://kulturniradar.cz/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

Zvažoval jsem přidat i `?profil=Město` URL pro každé sledované město (13
profilů, viz `?api=meta`) — technicky snadné, ale záměrně to nenavrhuju:
seznam profilů (`LOKALITY` list) se může měnit, sitemap by je musel ručně
sledovat, a protože appka je client-side rendered, dodatečná hodnota pro
SEO je nejistá (crawler stejně vidí prázdnou kostru bez JS). Nechávám jako
otevřenou možnost do budoucna (oddíl 7), ne dnešní součást.

## 5. Návrh — favicon (`apps-script/favicon.svg`, nový soubor)

Appka nemá žádný existující grafický asset (logo, ikona) — ověřeno,
žádný `.png`/`.svg`/`.ico` nikde v repu. Navrhuju jednoduchou vlastní SVG
ikonu (soustředné kružnice — motiv „radaru", stejná paleta jako appka:
`--ink: #1a1a2e`, `--accent: #d85a30`, viz `Index.html:16–17`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="15" fill="#1a1a2e"/>
  <circle cx="16" cy="16" r="11" fill="none" stroke="#d85a30" stroke-width="2"/>
  <circle cx="16" cy="16" r="6" fill="none" stroke="#d85a30" stroke-width="2"/>
  <circle cx="16" cy="16" r="2" fill="#d85a30"/>
</svg>
```

SVG favicon funguje v Chrome/Firefox/Edge přímo; Safari starší verze ho
neumí a potichu nezobrazí žádnou ikonu (ne chybu) — pro rodinnou appku bez
příliš striktních nároků na branding to považuju za přijatelný kompromis
bez nutnosti generovat/spravovat víc velikostí `.ico`/`.png`. Pokud by
vadilo i tohle, dá se řešit doplněním `.png` variant později (samostatný
krok, žádná další architektonická změna).

## 6. Návrh — Schema.org `Event` JSON-LD pro sdílené akce

**Kdy se vkládá:** jen když stránka běží s `?akce=ID&profil=Město` v URL
(deep link ze sdílení, `parsovatOdkazNaAkci_`) A appka danou akci skutečně
najde v načtených datech (`vsechnaAkce`) — stejná podmínka, jakou dnes má
`zvyraznitAkci_` volání v `init()` (`Index.html:1592`). Bez deep linku se
nic nevkládá (homepage nemá JEDNU konkrétní akci, ke které by JSON-LD
Event dávalo smysl).

**Nová PURE funkce `sestavEventJsonLd_(a, odkaz)`** (testovatelná v Node,
žádný DOM):

```js
function sestavEventJsonLd_(a, odkaz) {
  if (!a) return null;
  const zacatek = parseCeskeDatum(a.datumOd);
  if (!zacatek) return null;   // bez platného data nemá Event smysl
  const konec = parseCeskeDatum(a.datumDo);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: a.nazev || '',
    startDate: isoDatum_(zacatek),
    eventStatus: a.stav === 'zrušeno'
      ? 'https://schema.org/EventCancelled'
      : 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: a.misto || a.obec || '',
      address: { '@type': 'PostalAddress', addressLocality: a.obec || '', addressCountry: 'CZ' },
    },
  };
  if (konec) jsonLd.endDate = isoDatum_(konec);
  if (a.popis) jsonLd.description = a.popis;
  if (odkaz) jsonLd.url = odkaz;
  if (Number.isFinite(a.lat) && Number.isFinite(a.lng)) {
    jsonLd.location.geo = { '@type': 'GeoCoordinates', latitude: a.lat, longitude: a.lng };
  }
  return jsonLd;
}
```

**Tenký DOM wrapper `vlozitJsonLdAkce_(jsonLd)`** (stejný vzor jako
`sestavPopupDataMapy_`/`sestavPopupMapy_` z v3.56 — čistá data odděleně od
DOM zápisu):

```js
function vlozitJsonLdAkce_(jsonLd) {
  let el = document.getElementById('jsonld-akce');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'jsonld-akce';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(jsonLd);
}
```

**Zapojení do `init()`** (`Index.html:1592`, hned za existující
`zvyraznitAkci_` volání):

```js
if (odkazNaAkci) {
  zvyraznitAkci_(odkazNaAkci.id);
  const nalezenaAkce = vsechnaAkce.find(a => a.id === odkazNaAkci.id);
  if (nalezenaAkce) {
    const jsonLd = sestavEventJsonLd_(
      nalezenaAkce,
      sestavOdkazNaAkci_(nalezenaAkce.id, aktivniProfil, window.location.origin));
    if (jsonLd) vlozitJsonLdAkce_(jsonLd);
  }
}
```

**Rozhodnutí, která si zaslouží vysvětlení:**
- **`offers`/cena vynechána** — pole `cena` je volný text
  (`"zdarma"`, `"150 Kč"`, `"různé (část akcí zdarma)"`…), ne čisté číslo.
  Schema.org `Offer.price` očekává číselnou hodnotu — pokus o parsování by
  byl křehký a chybný výstup (např. špatná cena) je horší než žádný údaj,
  Google Search Console umí strukturovaná data s nesmyslnou hodnotou
  nahlásit jako chybu/varování. Bezpečnější vynechat.
- **`image` vynechán** — akce v datech nenesou URL obrázku (ověřeno ve
  struktuře `?api=events` odpovědi), není co vložit.
- **`eventStatus` pokrývá jen `zrušeno` → `EventCancelled`** — ostatní
  hodnoty `stav` (`potvrzeno`, `neověřeno`) mapuju na `EventScheduled`;
  `neověřeno` sice signalizuje nejistotu uvnitř appky, ale Schema.org
  nemá odpovídající typ „nejisté konání", takže nejbližší platná hodnota
  je `EventScheduled` (nic false neříká, spíš je optimistická).
- **Bez platného `datumOd` (`parseCeskeDatum` vrátí `null`) funkce vrací
  `null`** — dlouhodobé/probíhající akce mají někdy netradiční formát data,
  radši žádné strukturovaná data než Event bez `startDate` (Google to
  penalizuje jako chybějící povinné pole).

## 7. Otevřené otázky pro Vojtu (potřebují rozhodnutí, ne dohad)

1. **Cloudflare AI Crawl Control** (oddíl 0 a 3, potvrzeno v dokumentaci —
   viz citace) — chceš GPTBot/ClaudeBot skutečně povolit? **Musí se to řešit
   výhradně v Cloudflare dashboardu** (potvrzeno: žádné API/Terraform/
   config-as-code, žádný způsob přes repo/kód). Dva konkrétní kroky:
   - Zóna `kulturniradar.cz` → **Security → AI Crawl Control** → tam jde
     povolit/zablokovat KAŽDÝ crawler jednotlivě (GPTBot, ClaudeBot atd.).
   - Zóna → **Security Settings** → přepínač „Set your preference to block
     training in robots.txt" (obecné nastavení, které řídí, jestli se
     managed blok vůbec vkládá).
   Není urgentní, dá se doladit kdykoli nezávisle na zbytku téhle části,
   až budeš mít po ruce přístup k Cloudflare účtu (ne teď na mobilu).
2. **`og:image`/`twitter:image`** — chybí grafický asset. Chceš do
   budoucna doplnit obrázek (screenshot appky, jednoduché logo)? Není
   blokující pro tuhle část, dá se přidat později jako izolovaná změna.
3. **Sitemap s `?profil=Město` URL pro všechna sledovaná města** — zvážil
   jsem a nedoporučuju teď (oddíl 4), ale je to snadné přidat později, pokud
   se ukáže užitečné.
4. **Build output directory Cloudflare Pages** — potvrď, že je nastavené
   na `apps-script/` (odpovídá pozorovanému chování), ať nové statické
   soubory (`robots.txt`, `sitemap.xml`, `favicon.svg`) skutečně skončí na
   správném místě.
5. **NE 100% jistota u bodu 4** (přidáno po zpětné kontrole, 23. 8. 2026
   večer) — `apps-script/appsscript.json` (soubor, který by v build
   outputu reálně existoval, kdyby jím `apps-script/` byl) se servíruje
   jako `text/html` SPA fallback, ne jako `application/json`. To
   nepřímo zpochybňuje původní odůvodnění (SPA fallback samo o sobě nic
   neprokazuje o umístění build adresáře — může jít o plošné `_redirects`
   pravidlo nezávislé na tom, kam soubory dám). Soubory jsem přesto dal
   do `apps-script/` jako nejpravděpodobnější odhad, ale skutečné
   potvrzení přijde až živým ověřením po nasazení (curl na
   `/favicon.svg`/`/robots.txt`/`/sitemap.xml`) — pokud nevyjde, bude
   potřeba se podívat přímo do Cloudflare dashboardu (Pages → nastavení
   buildu → Build output directory) nebo do `_redirects`/`_headers`
   pravidel, což už je čistě na tobě.

## 8. Dopad na testy

- **4 nové Node testy** pro `sestavEventJsonLd_` (`tests/frontend.test.js`)
  — základní akce se všemi poli, bez platného data → `null`, `zrušeno` →
  `EventCancelled`/jinak `EventScheduled`, chybějící volitelná pole se
  nepropíšou do výstupu. Node testy: 437 → 441 (+4), živě ověřeno.
- **RF beze změny** — nová funkčnost je podmíněná na `?akce=` v URL, což
  žádný dnešní RF test necílí; smysluplný RF test by vyžadoval načíst
  appku se skutečným `?akce=ID` a ověřit `<script type="application/ld+json">`
  v hlavě dokumentu — necháno jako možné budoucí rozšíření, ne součást
  týhle části (a).

## 9. Co NEobsahuje tahle část

- Server-side rendering podle `?akce=ID` (skutečné per-akce OG náhledy pro
  neJS crawlery/link-preview boty) — BACKLOG.md bod (b), váže se na
  budoucí větší přestavbu appky.
- `og:image`/`twitter:image` — chybí asset, viz otevřená otázka 2.
- Vlastní pravidla pro konkrétní AI crawlery v `robots.txt` — řeší se (nebo
  neřeší) na úrovni Cloudflare dashboardu, ne v repu, viz oddíl 3 a
  otevřená otázka 1.
