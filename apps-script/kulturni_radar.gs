/**
 * KULTURNÍ RADAR – automatizace (Apps Script)
 * ============================================
 * Verze: 3.30 (21. 8. 2026) – Notifikace: datový model + backend API (kroky A–B)
 * (předchozí: 3.29 – Email tipy: fronta + webhook + AI ověření + report)
 *
 * Co skript dělá:
 *  - Mimořádná kontrola: instalovatelný onEdit trigger hlídá KRITÉRIA!B11.
 *    Po zaškrtnutí spustí hledání přes Anthropic API (web search), zapíše
 *    výsledky do AKCE, přidá řádek do KONTROL, vyplní B12, odškrtne B11
 *    a pošle notifikaci (ntfy + volitelně e-mail).
 *  - Denní kontrola: časový trigger (~8:00) provede totéž v denním režimu
 *    a navíc označí skončené akce jako "proběhlo".
 *  - Menu "Kulturní radar" v tabulce pro ruční spuštění.
 *
 * Zásady (dle dohodnutých pravidel tabulky):
 *  - Zapisuje se POUZE do sloupců A:V a Y listu AKCE. W:X (vzorce) se nedotýká.
 *  - Deduplikace: profil + datum od + název + místo (normalizovaně) + ID.
 *  - Akce jiných profilů se nemění. Akce se nemažou (jen stav proběhlo/zrušeno).
 *  - Každý běh se zaloguje do KONTROL vč. sloupce "Vykonavatel".
 *
 * NASTAVENÍ (jednorázově):
 *  1. Rozšíření → Apps Script → vložit tento soubor.
 *  2. Project Settings → Script Properties → přidat:
 *       ANTHROPIC_API_KEY  = sk-ant-...          (povinné)
 *       NTFY_TOPIC         = nazev-kanalu        (volitelné, push přes ntfy.sh)
 *       NOTIFY_EMAIL       = adresa@example.com  (volitelné, e-mail navíc)
 *       NOTIFY_EMAIL_VIKEND = dalsi@example.com  (volitelné, jen k Víkendovým tipům navíc)
 *       EMAIL_WEBHOOK_TOKEN = nahodny-token       (volitelné, viz apiEmailTip_ – sdílený
 *                              secret s Cloudflare Email Workerem, NENÍ totéž co WEB_TOKEN)
 *  3. Spustit funkci setupTriggers() (a autorizovat oprávnění).
 */

// ---------------------------------------------------------------------------
// KONSTANTY
// ---------------------------------------------------------------------------

const SHEET = {
  KRITERIA: 'KRITÉRIA',
  LOKALITY: 'LOKALITY',
  AKCE: 'AKCE',
  ZDROJE: 'ZDROJE',
  KONTROLY: 'KONTROLY',
  MISTA: 'MÍSTA',
  PREHLED: 'PŘEHLED',
  OZNACENI: 'OZNAČENÍ',
  SOURADNICE: 'SOUŘADNICE',
  SLEDOVANA_MESTA: 'SLEDOVANÁ MĚSTA',
  UZIVATELE: 'UŽIVATELÉ',
  POCASI: 'POČASÍ',
  EMAIL_TIPY: 'EMAIL_TIPY',
};

const KRIT = {           // adresy v listu KRITÉRIA
  PROFIL: 'B2',
  DOJEZD: 'B3',
  HORIZONT: 'B4',
  KATEGORIE: 'B5',
  MALE_AKCE: 'B6',
  DETSKE: 'B7',
  ZEME: 'B8',
  JAZYK: 'B9',
  CHECKBOX: 'B11',       // Spustit mimořádnou kontrolu
  POSLEDNI: 'B12',       // Poslední mimořádná kontrola
};

const AKCE_COLS = 25;    // A..Y
const AKCE_WRITE_AV = 22; // A..V
const COL_Y = 25;        // Profil lokality

const VERZE = '3.30';       // jediný zdroj pravdy – hlásí se v ?api=meta
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_MODEL_HAIKU = 'claude-haiku-4-5';  // v3.27: experiment – jen 'denní kontrola', viz callAnthropic_
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const WEB_COOLDOWN_MS = 10 * 60 * 1000;  // min. rozestup mezi web-spuštěnými kontrolami
const MAX_WEB_SEARCHES = 3;  // v3.6: úspora kreditů (bývalo 5)

const KONTAKT_EMAIL = 'info@kulturniradar.cz';
const KONTAKT_ZPRAVA_MAX = 2000;        // znaků – proti zneužití formuláře
const KONTAKT_COOLDOWN_MS = 30 * 1000;  // stejný duch jako WEB_COOLDOWN_MS, jen kratší (kontaktní formulář, ne AI dotaz)

const EMAIL_TIP_TEXT_MAX = 5000;   // v3.29: znaků – stejný duch jako KONTAKT_ZPRAVA_MAX, jen vyšší
                                    // strop (mail bývá delší než ruční zpráva – podpis, citované vlákno)

/** v3.28: Slovník podkategorií per hlavní kategorie – jediný zdroj pravdy,
 *  ze kterého se skládá jak `enum` v REPORT_TOOL, tak text instrukce pro AI
 *  (viz callAnthropic_). Frontend tenhle slovník nepotřebuje – druhou úroveň
 *  chipů skládá přímo z `podkategorie` polí už validovaných/vrácených akcí
 *  (viz readEventsApi_), ne z vlastní kopie seznamu.
 *  "folklor" je záměrně vynechaný – jeho podkategorie (folklorní region) se
 *  neurčuje přes AI, ale programově z profilu (viz folklorniRegion_). */
const PODKATEGORIE_SLOVNIK = {
  'koncerty': ['klasika', 'pop/rock', 'jazz/blues', 'dechovka/lidovka', 'elektronika/DJ'],
  'divadlo': ['činohra', 'loutky', 'muzikál/opereta', 'tanec/balet'],
  'festivaly': ['hudební', 'filmový', 'gastro', 'dětský'],
  'výstavy': ['malba/socha', 'fotografie', 'historie/technika', 'multimédia/interaktivní'],
  'historické slavnosti': ['řemesla', 'bitvy/rekonstrukce', 'noční prohlídky'],
  'vinařské/gastro kulturní akce': ['víno', 'pivo', 'farmářské trhy'],
  'jarmarky': ['vánoční/velikonoční', 'řemeslné', 'farmářské'],
  'netradiční kulturní akce': ['street art', 'experimentální', 'jiné'],
};

/** PURE: plochý seznam všech povolených podkategorií napříč PODKATEGORIE_SLOVNIK
 *  (pro `enum` v REPORT_TOOL a pro validaci při čtení – viz readEventsApi_). */
function vsechnyPodkategorie_() {
  return Object.keys(PODKATEGORIE_SLOVNIK).reduce((acc, k) => acc.concat(PODKATEGORIE_SLOVNIK[k]), []);
}

/** Nástroj, kterým model odevzdává výsledky – API garantuje validní strukturu. */
const REPORT_TOOL = {
  name: 'report_events',
  description: 'Odevzdání finálního seznamu nalezených kulturních akcí. Zavolej PRÁVĚ JEDNOU na konci hledání s kompletním seznamem (events = []; pokud nic nenalezeno).',
  input_schema: {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' }, datum_od: { type: 'string' }, datum_do: { type: 'string' },
            cas: { type: 'string' }, nazev: { type: 'string' }, misto: { type: 'string' },
            obec: { type: 'string' }, dojezd: { type: 'string' }, kategorie: { type: 'string' },
            podkategorie: { type: 'array', items: { type: 'string', enum: vsechnyPodkategorie_() } },
            cena: { type: 'string' }, popis: { type: 'string' },
            skore: { type: 'number' }, stav: { type: 'string' }, primarni_zdroj: { type: 'string' },
            url: { type: 'string' }, dalsi_zdroj: { type: 'string' }, poznamka: { type: 'string' },
          },
          required: ['id', 'datum_od', 'nazev', 'misto', 'obec', 'kategorie', 'stav'],
        },
      },
    },
    required: ['events'],
  },
};

/** Nástroj pro odevzdání stálých míst (zoo, science centra, hrady…). */
const REPORT_PLACES_TOOL = {
  name: 'report_places',
  description: 'Odevzdání seznamu stálých atrakcí. Zavolej PRÁVĚ JEDNOU na konci hledání s kompletním seznamem (places = []; pokud nic).',
  input_schema: {
    type: 'object',
    properties: {
      places: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' }, nazev: { type: 'string' }, typ: { type: 'string' },
            obec: { type: 'string' }, dojezd: { type: 'string' }, oteviraci_doba: { type: 'string' },
            sezonni_poznamka: { type: 'string' }, vstupne: { type: 'string' }, deti: { type: 'string' },
            skore: { type: 'number' }, stav: { type: 'string' }, url: { type: 'string' },
            poznamka: { type: 'string' },
          },
          required: ['id', 'nazev', 'typ', 'obec', 'stav'],
        },
      },
    },
    required: ['places'],
  },
};

// ---------------------------------------------------------------------------
// MENU + TRIGGERY
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WEB APP – doGet / doPost
// ---------------------------------------------------------------------------

/**
 * GET /exec              → HTML aplikace
 * GET /exec?api=events   → JSON akce
 * GET /exec?api=places   → JSON stálá místa
 * GET /exec?api=meta     → profily, kategorie, poslední kontroly
 */
function doGet(e) {
  const api = (e && e.parameter && e.parameter.api) || '';
  const profil = (e && e.parameter && e.parameter.profil) || '';
  const uzivatelId = (e && e.parameter && e.parameter.uzivatel) || '';

  if (!api) {
    return HtmlService
      .createHtmlOutputFromFile('Index')
      .setTitle('Kulturní radar')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  let data;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (api === 'events') data = readEventsApi_(ss, profil, (e.parameter && e.parameter.oznacene) === '1', uzivatelId);
    else if (api === 'places') data = readPlacesApi_(ss, profil);
    else if (api === 'meta') data = readMetaApi_(ss);
    else if (api === 'uzivatele') data = apiSeznamUzivatelu_(ss);   // v3.21: seznam profilů pro statický frontend (jen id+jméno, bez PINů)
    else if (api === 'run') data = spustKontroluCore_((e.parameter && e.parameter.token) || '');
    else data = { ok: false, error: 'Neznámý endpoint: ' + api };
  } catch (err) {
    data = { ok: false, error: String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** v3.21: směrování POST akcí na API funkce – vyčleněno z doPost kvůli
 *  testovatelnosti (Node testy volají routePost_ přímo se stub ss, bez
 *  ContentService). PIN a token jdou POSTem záměrně: nepatří do URL,
 *  kde by končily v prohlížečové historii a serverových lozích. */
function routePost_(body, ss) {
  const akce = (body && body.akce) || '';
  if (akce === 'run')    return spustKontroluCore_(body.token);
  if (akce === 'login')  return apiPrihlaseniUzivatele_(ss, body.uzivatelId, body.pin);
  if (akce === 'toggle') return apiToggle_(ss, body.id, body.typ, body.uzivatelId);
  if (akce === 'toggle-misto') return apiToggleMisto_(ss, body.misto, body.obec, body.uzivatelId);
  if (akce === 'filtry') return apiSetFiltry_(ss, body.uzivatelId, body.filtry);
  if (akce === 'set-notifikace') return apiSetNotifikace_(ss, body.uzivatelId, body.notifikace);
  if (akce === 'vygenerovat-ntfy-tema') return apiVygenerovatNtfyTema_(ss, body.uzivatelId);
  if (akce === 'najdi')  return apiNajdiProUzivatele_(ss, body.uzivatelId, body.token);
  if (akce === 'kontakt') return apiKontakt_(body.jmeno, body.zprava, body.email, body.uzivatelId);
  if (akce === 'email-tip') return apiEmailTip_(ss, body.token, body.from, body.subject, body.text);
  return { ok: false, error: 'Neznámá akce.' };
}

/**
 * POST /exec {akce:'run'|'login'|'toggle'|'filtry'|'najdi'|'kontakt'|
 *   'set-notifikace'|'vygenerovat-ntfy-tema', ...} → JSON.
 * v3.21: rozšířeno z původního jen-run na plné API pro statický frontend
 * (GitHub Pages) – google.script.run mimo Apps Script neexistuje.
 */
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (_) { body = {}; }

  let data;
  try {
    data = routePost_(body, SpreadsheetApp.getActiveSpreadsheet());
  } catch (err) {
    data = { ok: false, error: String(err) };
  }

  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Převod hodnoty buňky na text: Date → 'd. M. yyyy'; čas (rok 1899) → 'H:mm'. */
function cellText_(v) {
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    // Sériové číslo data (dny od 30. 12. 1899) – buňka bez datumového formátu
    const d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + Math.floor(v));
    return formatDateOnly_(d);
  }
  if (v instanceof Date) {
    if (v.getFullYear() < 1930) {  // Sheets ukládá samotný čas jako datum r. 1899
      return Utilities.formatDate(v, Session.getScriptTimeZone(), 'H:mm');
    }
    return formatDateOnly_(v);
  }
  return String(v == null ? '' : v).trim();
}

/** v3.28: PURE – folklorní region se u kategorie "folklor" neurčuje přes AI
 *  (kulturně-geografický pojem, který appka odvodí spolehlivěji z profilu
 *  než by AI odhadla), ale programově z aktivního profilu hledání. */
function folklorniRegion_(profil) {
  const p = norm_(profil);
  if (p === 'brno') return 'Slovácko/Podluží';
  if (p === 'zlín') return 'Valašsko/Luhačovicko';
  if (p === 'olomouc') return 'Haná';
  return 'jiný region';
}

/** v3.28: PURE – sestaví pole podkategorií pro jednu akci. U kategorie
 *  "folklor" ignoruje sloupec J úplně (AI ho pro folklor vůbec neřeší, viz
 *  callAnthropic_) a použije folklorniRegion_ místo něj – i pro akce
 *  kombinující folklor s jinou kategorií (vědomé zjednodušení, viz diskuze
 *  k v3.28: kombinace je řídká a AI stejně není instruovaná, aby v takovém
 *  případě vybírala podkategorie správně). Pro ostatní akce filtruje
 *  hodnoty ze sloupce J proti PODKATEGORIE_SLOVNIK – stará/nekonzistentní
 *  data (volný text bez instrukce, viz ověření 20. 8. 2026) se tiše zahodí. */
function vypoctiPodkategorii_(kategoriePole, podkategorieText, profil) {
  if ((kategoriePole || []).indexOf('folklor') !== -1) return [folklorniRegion_(profil)];
  const povolene = new Set(vsechnyPodkategorie_());
  return String(podkategorieText || '').split(';').map(s => s.trim()).filter(s => s && povolene.has(s));
}

/** PURE: rozhodne, zda akce patří do výsledku apiEvents. Normální okno = ne
 *  proběhlé, ne staré (mimo „zrušeno", které se ukazuje vždy jako info).
 *  Označené akce (oblibene/navstiveno) smí projít i mimo toto okno, ale JEN
 *  když volající o to výslovně požádal (zahrnoutOznacene) – jinak zůstávají
 *  skryté jako neoznačené staré akce (v3.9 filtr, v3.10 vytažen do funkce). */
function zahrnoutAkciDoVysledku_(stav, datumOd, dnes, zahrnoutOznacene, jeOznaceno) {
  const smiVyjimku = !!zahrnoutOznacene && !!jeOznaceno;
  if (stav === 'proběhlo' && !smiVyjimku) return false;
  if (datumOd && datumOd < dnes && stav !== 'zrušeno' && !smiVyjimku) return false;
  return true;
}

// ---------------------------------------------------------------------------
// CACHE pro apiEvents (v3.26) – krátkodobá cache přes CacheService, aby se
// při KAŽDÉM volání nečetly celé 4 listy (AKCE/OZNAČENÍ/SOUŘADNICE/POČASÍ).
// Zjištěno 8. 8. 2026 diagnostikou: apiEvents byl dominantní část 6–10s
// čekání při přihlášení (viz SKILL.md, diagnostika rychlosti). Fail-open:
// jakákoli chyba CacheService (výpadek, kvóta, moc velká položka) spadne
// zpět na normální čtení ze Sheets – cache nikdy nesmí shodit apiEvents.
// ---------------------------------------------------------------------------

const EVENTS_CACHE_TTL_S = 45;               // 30–60s – kompromis rychlost/čerstvost dat
const EVENTS_CACHE_VERZE_KLIC = 'events_cache_verze';

/** PURE: sestaví klíč cache pro apiEvents – zahrnuje verzi (invalidace při
 *  zápisu), profil i uživatele (ať se nesmíchají data různých lidí/měst) a
 *  zahrnoutOznacene (mění obsah odpovědi, viz zahrnoutAkciDoVysledku_). */
function sestavKlicCacheEventu_(verze, profil, uzivatelId, zahrnoutOznacene) {
  return 'events_v' + verze + '_' + norm_(profil) + '_' + norm_(uzivatelId) + '_' + (zahrnoutOznacene ? '1' : '0');
}

/** Aktuální "verze" cache apiEvents – součást klíče. Fail-open: chyba
 *  CacheService → '0' (chová se, jako by cache nebyla, ne pád). */
function ziskatVerziCacheEventu_() {
  try {
    return CacheService.getScriptCache().get(EVENTS_CACHE_VERZE_KLIC) || '0';
  } catch (e) {
    return '0';
  }
}

/** Posune verzi cache apiEvents – volat po KAŽDÉM zápisu, který mění data,
 *  jež apiEvents vrací (AKCE/OZNAČENÍ/SOUŘADNICE/POČASÍ). Staré položky se
 *  nemažou explicitně – s jinou verzí v klíči už nejsou dosažitelné a samy
 *  vyexpirují přes TTL. Fail-open: chyba tady nesmí shodit volající zápis. */
function invalidovatCacheEventu_() {
  try {
    CacheService.getScriptCache().put(EVENTS_CACHE_VERZE_KLIC, String(Date.now()), 6 * 60 * 60);
  } catch (e) { Logger.log('invalidovatCacheEventu_ selhalo (fail-open): ' + e); }
}

/** Načte cachovanou odpověď apiEvents, nebo null (miss i chyba CacheService
 *  – fail-open, volající pak čte normálně ze Sheets). */
function nactiZCacheEventu_(klic) {
  try {
    const hodnota = CacheService.getScriptCache().get(klic);
    return hodnota ? JSON.parse(hodnota) : null;
  } catch (e) {
    return null;
  }
}

/** Uloží odpověď apiEvents do cache s TTL. Fail-open: chyba (výpadek,
 *  překročená kvóta/velikost položky) se jen zaloguje, nikdy nevyhodí. */
function ulozitDoCacheEventu_(klic, hodnota) {
  try {
    CacheService.getScriptCache().put(klic, JSON.stringify(hodnota), EVENTS_CACHE_TTL_S);
  } catch (e) { Logger.log('ulozitDoCacheEventu_ selhalo (fail-open): ' + e); }
}

/** API: akce profilu v databázi (neprobíhající, přijde – nebo označené, viz zahrnoutOznacene).
 *  uzivatelId: ID přihlášeného uživatelského profilu – oblíbené/navštívené jsou
 *  od v3.20 osobní, takže bez přihlášení (uzivatelId = '') vyjdou vždy false/''. */
function readEventsApi_(ss, profilParam, zahrnoutOznacene, uzivatelId) {
  const krit = ss.getSheetByName(SHEET.KRITERIA);
  const aktivniProfil = krit ? String(krit.getRange(KRIT.PROFIL).getValue()).trim() : '';
  const profil = profilParam || aktivniProfil;

  const cacheKlic = sestavKlicCacheEventu_(ziskatVerziCacheEventu_(), profil, uzivatelId, zahrnoutOznacene);
  const zCache = nactiZCacheEventu_(cacheKlic);
  if (zCache) return zCache;

  const sh = ss.getSheetByName(SHEET.AKCE);
  const lastRow = sh ? sh.getLastRow() : 1;
  if (lastRow < 2) {
    const prazdnyVysledek = { ok: true, profil, akce: [] };
    ulozitDoCacheEventu_(cacheKlic, prazdnyVysledek);
    return prazdnyVysledek;
  }

  const data = sh.getRange(2, 1, lastRow - 1, AKCE_COLS).getValues();
  const dnes = new Date(); dnes.setHours(0, 0, 0, 0);
  const rowsTohotoUzivatele = uzivatelId ? readOznaceni_(ss).filter(r => r.uzivatel === uzivatelId) : [];
  const oznaceniMapa = oznaceniMapy_(rowsTohotoUzivatele);
  const mistaOblibenaSada = oblibenaMistaSety_(rowsTohotoUzivatele);   // v3.26
  const souradniceMapa = souradniceMapy_(readSouradnice_(ss));
  const pocasiMapa = pocasiMapy_(readPocasi_(ss));
  const akce = [];

  data.forEach(row => {
    if (norm_(row[24]) !== norm_(profil)) return;
    const id = String(row[0] || '');
    const oznaceni = oznaceniMapa.get(id) || { oblibene: false, navstivenoDne: null };
    const jeOznaceno = oznaceni.oblibene || !!oznaceni.navstivenoDne;
    const stav = norm_(row[13]);
    const datumOd = parseCzDate_(row[1]);
    if (!zahrnoutAkciDoVysledku_(stav, datumOd, dnes, zahrnoutOznacene, jeOznaceno)) return;
    const klicMista = klicSouradnic_(row[5], row[6]);
    const souradnice = souradniceMapa.get(klicMista) || null;
    const pocasi = pocasiMapa.get(id);
    const kategoriePole = String(row[8] || '').split(';').map(k => k.trim()).filter(Boolean);
    akce.push({
      id,
      nazev: String(row[4] || ''),
      datumOd: cellText_(row[1]),
      datumDo: cellText_(row[2]),
      cas: cellText_(row[3]),
      misto: String(row[5] || ''),
      obec: String(row[6] || ''),
      kategorie: kategoriePole,
      podkategorie: vypoctiPodkategorii_(kategoriePole, row[9], profil),   // v3.28
      cena: String(row[10] || ''),
      popis: String(row[11] || ''),
      skore: Number(row[12]) || 0,
      stav: String(row[13] || ''),
      dojezd: String(row[7] || ''),
      url: String(row[19] || ''),
      oblibene: oznaceni.oblibene,
      navstivenoDne: oznaceni.navstivenoDne || '',
      mistoOblibene: mistaOblibenaSada.has(klicMista),   // v3.26
      lat: souradnice ? souradnice.lat : null,
      lng: souradnice ? souradnice.lng : null,
      pocasi: pocasi ? { stav: pocasi.stav, kod: pocasi.kod, teplota: pocasi.teplota } : { stav: 'NA', kod: '', teplota: '' },
    });
  });

  akce.sort((a, b) => {
    const ka = dateKey_(a.datumOd), kb = dateKey_(b.datumOd);
    return ka < kb ? -1 : ka > kb ? 1 : b.skore - a.skore;
  });
  const vysledek = { ok: true, generovano: formatDate_(new Date()), profil, akce };
  ulozitDoCacheEventu_(cacheKlic, vysledek);
  return vysledek;
}

/** API: stálá místa profilu. */
function readPlacesApi_(ss, profilParam) {
  const krit = ss.getSheetByName(SHEET.KRITERIA);
  const aktivniProfil = krit ? String(krit.getRange(KRIT.PROFIL).getValue()).trim() : '';
  const profil = profilParam || aktivniProfil;
  const mista = readMista_(ss, profil);
  return { ok: true, profil, mista };
}

/** API: metadata (profily, kategorie z KRITÉRIÍ, poslední kontroly, verze). */
function readMetaApi_(ss) {
  // Profily z LOKALIT
  const lok = ss.getSheetByName(SHEET.LOKALITY);
  const profily = [];
  if (lok && lok.getLastRow() > 1) {
    lok.getRange(2, 2, lok.getLastRow() - 1, 7).getValues().forEach(row => {
      const p = String(row[0] || '').trim();
      if (p) profily.push({ profil: p, kraj: String(row[1] || ''), posledniKontrola: cellTextCas_(row[6]) });
    });
  }

  // Aktivní profil + kategorie z KRITÉRIÍ
  const krit = ss.getSheetByName(SHEET.KRITERIA);
  const aktivniProfil = krit ? String(krit.getRange(KRIT.PROFIL).getValue()).trim() : '';
  const katString = krit ? String(krit.getRange(KRIT.KATEGORIE).getValue()) : '';
  const kategorie = katString.split(';').map(k => k.trim()).filter(Boolean);

  // Poslední kontrola z KONTROL
  let posledniKontrola = '';
  const kon = ss.getSheetByName(SHEET.KONTROLY);
  if (kon && kon.getLastRow() > 1) {
    const lastVal = kon.getRange(kon.getLastRow(), 1).getValue();
    posledniKontrola = formatDate_(lastVal instanceof Date ? lastVal : new Date(lastVal));
  }

  return { ok: true, aktivniProfil, profily, kategorie, posledniKontrola, verze: VERZE };
}

// ---------------------------------------------------------------------------
// WRAPPER FUNKCE pro google.script.run (volané z Index.html)
// ---------------------------------------------------------------------------

function apiMeta()              { return readMetaApi_(SpreadsheetApp.getActiveSpreadsheet()); }
function apiEvents(profil, zahrnoutOznacene, uzivatelId) {
  return readEventsApi_(SpreadsheetApp.getActiveSpreadsheet(), profil || '', !!zahrnoutOznacene, uzivatelId || '');
}
function apiPlaces(profil)      { return readPlacesApi_(SpreadsheetApp.getActiveSpreadsheet(), profil || ''); }
function apiSpustKontrolu(tok)  { return spustKontroluCore_(tok); }
/** Přepne označení (oblíbené/navštíveno) u dané akce PRO PŘIHLÁŠENÝ uživatelský
 *  profil; vrací aktuální stav obou příznaků TOHOTO profilu. */
function apiToggle(id, typ, uzivatelId) {
  return apiToggle_(SpreadsheetApp.getActiveSpreadsheet(), id, typ, uzivatelId);
}

/** v3.26: přepne „oblíbené místo" (misto+obec, ne ID akce) PRO PŘIHLÁŠENÝ
 *  uživatelský profil. */
function apiToggleMisto(misto, obec, uzivatelId) {
  return apiToggleMisto_(SpreadsheetApp.getActiveSpreadsheet(), misto, obec, uzivatelId);
}

/** Přihlášení uživatelského profilu (ID + PIN) – volané z přihlašovací obrazovky. */
function apiPrihlaseniUzivatele(uzivatelId, pin) {
  return apiPrihlaseniUzivatele_(SpreadsheetApp.getActiveSpreadsheet(), uzivatelId, pin);
}
/** Seznam profilů (jen ID+jméno, bez PINů) pro dlaždice na přihlašovací obrazovce. */
function apiSeznamUzivatelu() {
  return apiSeznamUzivatelu_(SpreadsheetApp.getActiveSpreadsheet());
}
/** Uloží osobní filtry (kategorie/dojezd) přihlášeného uživatelského profilu. */
function apiSetFiltry(uzivatelId, filtryObj) {
  return apiSetFiltry_(SpreadsheetApp.getActiveSpreadsheet(), uzivatelId, filtryObj);
}
/** Odešle zprávu z kontaktního formuláře – dostupné i bez přihlášení. */
function apiKontakt(jmeno, zprava, email, uzivatelId) {
  return apiKontakt_(jmeno, zprava, email, uzivatelId);
}
/** Spustí AI hledání s osobními kritérii uživatelského profilu (na vyžádání, token chrání). */
function apiNajdiProUzivatele(uzivatelId, tok) {
  return apiNajdiProUzivatele_(SpreadsheetApp.getActiveSpreadsheet(), uzivatelId, tok);
}

/** Sdílené jádro spouštění z webu: token → cooldown → asynchronní trigger. */
function spustKontroluCore_(tok) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('WEB_TOKEN');
  if (!token || tok !== token) return { ok: false, error: 'Neplatný token.' };
  const posledni = Number(props.getProperty('WEB_LAST_RUN') || 0);
  if (Date.now() - posledni < WEB_COOLDOWN_MS) return { ok: false, error: 'Kontrola právě proběhla, zkus za chvíli.' };
  props.setProperty('WEB_LAST_RUN', String(Date.now()));
  ScriptApp.newTrigger('menuRunNow').timeBased().after(1000).create();
  return { ok: true, zprava: 'Kontrola spuštěna. Výsledek přijde notifikací.' };
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Kulturní radar')
    .addItem('Spustit kontrolu teď', 'menuRunNow')
    .addItem('Označit proběhlé akce', 'markPastEvents')
    .addItem('Odstranit duplicity', 'cleanupDuplicates')
    .addItem('Test notifikací', 'testNtfy')
    .addSeparator()
    .addItem('Týdenní přehled teď', 'weeklyDigest')
    .addItem('Víkendové tipy teď', 'weekendDigest')
    .addItem('Aktualizovat stálá místa', 'updateMista')
    .addItem('Doplnit souřadnice (jednorázově)', 'doplnitSouradniceZpetne')
    .addItem('Sledovaná města teď', 'zpracovatSledovanaMesta')
    .addSeparator()
    .addItem('Samotest', 'runSelfTest')
    .addSeparator()
    .addItem('Nastavit uživatelské profily (jednorázově)', 'migraceUzivatelskeProfily')
    .addItem('Přidat sloupec Notifikace do UŽIVATELÉ (jednorázově)', 'migraceNotifikaceSloupec_')
    .addToUi();
}

/** JEDNORÁZOVÁ migrace v3.20: vytvoří list UŽIVATELÉ (prázdné PINy k doplnění
 *  ručně) a VYMAŽE dosavadní sdílený obsah OZNAČENÍ (rozhodnutí 7. 8. 2026 –
 *  stará data byla bez majitele, nedala by se k nikomu spravedlivě přiřadit,
 *  takže se historie oblíbených/navštívených pro všechny profily začíná od
 *  nuly). Bezpečné spustit i opakovaně – UŽIVATELÉ se založí jen když chybí,
 *  existující řádky v UŽIVATELÍCH se nepřepisují.
 *  PIN se do sloupce PIN_hash zapisuje jako hash (viz hashPin_) – po založení
 *  řádků je potřeba každému profilu nastavit PIN ručně přes apiSetFiltry
 *  nebo přímo doplněním hashPin_('1234', Utilities.getUuid()) do buňky. */
function migraceUzivatelskeProfily() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureUzivateleSheet_(ss);
  if (sh.getLastRow() < 2) {
    const vychozi = ['vojta', 'manzelka', 'dcera', 'profil4'];
    sh.getRange(2, 1, vychozi.length, UZIVATELE_HLAVICKA.length).setValues(
      vychozi.map(id => [id, '', '', '{}', formatDateOnly_(new Date()), '{}']));
    SpreadsheetApp.getUi().alert(
      'List UŽIVATELÉ založen se 4 prázdnými řádky. Doplň prosím ručně sloupce ' +
      '"Jméno" a PIN – PIN se zapisuje jako hash, ne čitelný text (spusť v editoru ' +
      'nastavPin_("vojta", "1234") pro každý profil, viz komentář u funkce).');
  }
  zapsatOznaceni_(ss, []);
  SpreadsheetApp.getUi().alert('List OZNAČENÍ vymazán – oblíbené a navštívené jsou od teď osobní, historie začíná od nuly pro všechny profily.');
}

/** JEDNORÁZOVÁ migrace v3.30: doplní hlavičku sloupce F ("Notifikace") do
 *  existujícího listu UŽIVATELÉ, pokud tam ještě není – starší produkční
 *  řádky mají jen 5 sloupců, čtení (readUzivatele_) si s chybějícím 6.
 *  sloupcem poradí (prázdný text = notifikace vypnuté), ale samotná
 *  hlavička by bez týhle migrace zůstala prázdná. Bezpečné spustit i
 *  opakovaně – nic nepřepisuje, jen doplní chybějící hlavičku. */
function migraceNotifikaceSloupec_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureUzivateleSheet_(ss);
  if (!sh.getRange(1, 6).getValue()) {
    sh.getRange(1, 6).setValue('Notifikace')
      .setFontWeight('bold').setBackground('#4a235a').setFontColor('#ffffff');
  }
  SpreadsheetApp.getUi().alert('Sloupec "Notifikace" v UŽIVATELÍCH připraven – prázdné nastavení ' +
    'znamená notifikace vypnuté, dokud si je uživatel sám nezapne v appce.');
}

/** Pomocná funkce pro ruční nastavení/změnu PINu profilu z editoru Apps Scriptu
 *  (Spustit → nastavPin_ se zadanými argumenty, nebo zavolat z konzole). */
function nastavPin_(uzivatelId, novyPin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureUzivateleSheet_(ss);
  const data = readUzivatele_(ss);
  const idx = data.findIndex(u => u.id === uzivatelId);
  if (idx < 0) throw new Error('profil "' + uzivatelId + '" nenalezen v UŽIVATELÍCH');
  const sul = Utilities.getUuid();
  sh.getRange(idx + 2, 3).setValue(hashPin_(novyPin, sul));
  Logger.log('PIN pro "' + uzivatelId + '" nastaven.');
}

function menuRunNow() {
  runCheck_('mimořádná kontrola (menu)');
}

/** Otestuje doručení notifikací (ntfy + e-mail) bez spouštění kontroly. */
function testNtfy() {
  sendNotification_('Test notifikací – ěščřž',
    'Testovací zpráva z Apps Scriptu (' + formatDate_(new Date()) + '). Pokud ji vidíš, doručování funguje.');
}

/** Spustit JEDNOU ručně z editoru – vytvoří triggery. */
function setupTriggers() {
  // úklid starých triggerů tohoto projektu
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onEditInstallable')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  ScriptApp.newTrigger('dailyCheck')
    .timeBased()
    .atHour(8)          // ~8:00 místního času projektu
    .everyDays(1)
    .create();

  ScriptApp.newTrigger('weeklyDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7)
    .create();

  ScriptApp.newTrigger('weekendDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.THURSDAY)
    .atHour(16)
    .create();

  ScriptApp.newTrigger('updateMista')
    .timeBased()
    .onMonthDay(1)
    .atHour(6)
    .create();

  ScriptApp.newTrigger('runSelfTest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(18)
    .create();

  ScriptApp.newTrigger('watchdogDailyCheck')
    .timeBased()
    .atHour(20)
    .everyDays(1)
    .create();

  // Sledovaná města (v3.16): tiché doplnění dat na pozadí, žádná notifikace.
  // Od v3.22 stejný běh přepočítá i POČASÍ u budoucích akcí (aktualizujPocasi_).
  // Neděle večer – ať jsou data hotová PŘED pondělním týdenním přehledem (7:00).
  ScriptApp.newTrigger('zpracovatSledovanaMesta')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(20)
    .create();

  // Čtvrtek ráno – ať jsou data hotová PŘED víkendovými tipy (16:00).
  ScriptApp.newTrigger('zpracovatSledovanaMesta')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.THURSDAY)
    .atHour(10)
    .create();

  Logger.log('Triggery vytvořeny: onEdit + denní 8:00 + pondělní přehled 7:00 + čtvrteční tipy 16:00 + měsíční místa + nedělní samotest 18:00 + denní watchdog 20:00 + sledovaná města (neděle 20:00, čtvrtek 10:00).');
}

/** Instalovatelný onEdit – reaguje jen na zaškrtnutí KRITÉRIA!B11. */
function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (sh.getName() !== SHEET.KRITERIA) return;
    if (e.range.getA1Notation() !== KRIT.CHECKBOX) return;
    if (e.range.getValue() !== true) return;   // zajímá nás jen TRUE
    runCheck_('mimořádná kontrola');
  } catch (err) {
    notifyFail_('Mimořádná kontrola selhala', err);
    throw err;
  }
}

/** Denní běh (časový trigger). */
function dailyCheck() {
  try {
    markPastEvents();
    // v3.29: fronta EMAIL_TIPY se zpracuje PŘED běžnou kontrolou, ať jsou obě
    // sady výsledků (email-tipy i běžně nalezené akce) v JEDNOM denním
    // reportu (viz runCheck_/notifyOk_) – ne ve dvou samostatných e-mailech.
    const emailTipyStats = zpracovatEmailTipy_(SpreadsheetApp.getActiveSpreadsheet());
    runCheck_('denní kontrola', emailTipyStats);
  } catch (err) {
    notifyFail_('Denní kontrola selhala', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// HLAVNÍ BĚH
// ---------------------------------------------------------------------------

/** v3.29: emailTipyStats je volitelný ({celkem, ok, chyba, nelzeOverit} z
 *  zpracovatEmailTipy_) – jen dailyCheck ho předává, ostatní volání
 *  (mimořádná kontrola, sledovaná města, osobní hledání) ho vynechávají a
 *  notifyOk_ pak sekci s email-tipy do reportu vůbec nepřidá. */
function runCheck_(typKontroly, emailTipyStats) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Jiný běh právě probíhá – končím.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const krit = ss.getSheetByName(SHEET.KRITERIA);
  const isMimoradna = typKontroly.indexOf('mimořádná') === 0;

  try {
    // U mimořádné kontroly ověř, že checkbox stále platí (ochrana proti dvojkliku)
    if (isMimoradna && typKontroly === 'mimořádná kontrola' &&
        krit.getRange(KRIT.CHECKBOX).getValue() !== true) {
      return;
    }

    const cfg = readCriteria_(krit);
    const zdroje = readSources_(ss, cfg.profil);
    if (zdroje.length === 0) {
      throw new Error('Pro profil "' + cfg.profil + '" nejsou v ZDROJÍCH žádné zdroje (ani VŠECHNY).');
    }

    const events = callAnthropic_(cfg, zdroje, typKontroly);
    const stats = upsertEvents_(ss, cfg, events);
    zajistitSouradniceProAkce_(ss, events);

    logKontrola_(ss, typKontroly, cfg, stats, zdroje.length, vyberModelProKontrolu_(typKontroly));
    updateLokalita_(ss, cfg.profil, new Date());

    const now = new Date();
    if (isMimoradna) {
      krit.getRange(KRIT.POSLEDNI).setValue(formatDate_(now));
      krit.getRange(KRIT.CHECKBOX).setValue(false);
    }

    notifyOk_(typKontroly, cfg, stats, now, emailTipyStats);
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// ČTENÍ KRITÉRIÍ A ZDROJŮ
// ---------------------------------------------------------------------------

function readCriteria_(krit) {
  const val = a1 => String(krit.getRange(a1).getDisplayValue()).trim();

  const horizontTxt = val(KRIT.HORIZONT);          // např. "2 týdny"
  const weeks = parseInt(horizontTxt, 10) || 2;
  const from = new Date();
  const to = new Date(from.getTime() + weeks * 7 * 24 * 3600 * 1000);

  return {
    profil: val(KRIT.PROFIL),
    dojezd: val(KRIT.DOJEZD),                      // např. "90 min"
    horizont: horizontTxt,
    kategorie: val(KRIT.KATEGORIE),
    maleAkce: val(KRIT.MALE_AKCE),
    detske: val(KRIT.DETSKE),
    zeme: val(KRIT.ZEME),
    jazyk: val(KRIT.JAZYK) || 'čeština',
    from: from,
    to: to,
    rozsah: formatDateOnly_(from) + '–' + formatDateOnly_(to),
  };
}

function readSources_(ss, profil) {
  const sh = ss.getSheetByName(SHEET.ZDROJE);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];

  const header = data[0].map(h => String(h).toLowerCase());
  const idx = name => header.findIndex(h => h.indexOf(name) !== -1);
  const iNazev = 0;                                // 1. sloupec = název zdroje
  const iUrl = idx('url');
  const iProfil = idx('profil');
  const iPrio = idx('priorita');

  const out = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const p = String(row[iProfil] || '').trim();
    if (!p) continue;
    if (p === profil || p.toUpperCase() === 'VŠECHNY') {
      out.push({
        nazev: String(row[iNazev] || '').trim(),
        url: String(row[iUrl] || '').trim(),
        priorita: iPrio >= 0 ? String(row[iPrio] || '').trim() : '',
      });
    }
  }
  return out.filter(z => z.url);
}

// ---------------------------------------------------------------------------
// ANTHROPIC API
// ---------------------------------------------------------------------------

/** v3.27: Haiku experiment (měření kvality 20.–27. 8. 2026) – jen 'denní
 *  kontrola' (automatický ranní trigger) běží na Haiku, všechno ostatní
 *  (mimořádné běhy, osobní hledání, sledovaná města, měsíční místa) zůstává
 *  na Sonnetu. Sdílené mezi callAnthropic_ (posílá požadavek) a voláními
 *  logKontrola_ (zapisuje, který model se skutečně použil), ať se logika
 *  nerozjede na dvou místech. */
function vyberModelProKontrolu_(typKontroly) {
  return typKontroly === 'denní kontrola' ? ANTHROPIC_MODEL_HAIKU : ANTHROPIC_MODEL;
}

/** v3.29: řádky instrukce pro pole `podkategorie` – identické ve
 *  callAnthropic_ i callAnthropicEmailTip_, vytažené sem, ať se text
 *  nerozjede na dvou místech (viz PODKATEGORIE_SLOVNIK). */
function podkategorieInstrukce_() {
  return [
    'podkategorie = pole 0–3 hodnot, VÝHRADNĚ z tohoto seznamu podle hlavní kategorie akce (jinou hodnotu nepiš):',
    Object.keys(PODKATEGORIE_SLOVNIK).map(k => '  ' + k + ': ' + PODKATEGORIE_SLOVNIK[k].join(', ')).join('\n'),
    'U kategorie "folklor" podkategorii vůbec neurčuj – nech pole prázdné, appka si ji dopočítá sama.',
  ];
}

/** v3.29: sdílené jádro volání Anthropic API s web_search + report_events
 *  nástrojem – smyčka kvůli stop_reason (pause_turn/end_turn) s časovým
 *  rozpočtem (pojistka proti 6min limitu), a záchranné formátovací dovolání,
 *  když model odevzdá nerozparsovatelný text místo volání nástroje. Vytaženo
 *  z callAnthropic_ beze změny chování – sdíleno i s callAnthropicEmailTip_,
 *  ať se retry logika nerozjede na dvou místech. */
function volatAnthropicSTool_(apiKey, model, system, userMsg, maxWebSearches) {
  const basePayload = {
    model: model,
    max_tokens: 16000,
    system: system,
    tools: [
      { type: 'web_search_20250305', name: 'web_search', max_uses: maxWebSearches },
      REPORT_TOOL,
    ],
  };

  const t0 = Date.now();
  let msgs = [{ role: 'user', content: userMsg }];
  let text = '';
  let lastText = '';
  let data = null;
  for (let pokus = 0; pokus < 5; pokus++) {
    const payload = Object.assign({}, basePayload, { messages: msgs });
    const resp = UrlFetchApp.fetch(ANTHROPIC_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code !== 200) {
      throw new Error('Anthropic API vrátilo ' + code + ': ' + resp.getContentText().slice(0, 500));
    }

    data = JSON.parse(resp.getContentText());
    lastText = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
    text += lastText;

    // Model odevzdal výsledky nástrojem → struktura je garantovaně validní.
    const toolBlock = (data.content || []).find(b => b.type === 'tool_use' && b.name === 'report_events');
    if (toolBlock && toolBlock.input && Array.isArray(toolBlock.input.events)) {
      Logger.log('Výsledky převzaty z nástroje report_events: ' + toolBlock.input.events.length + ' akcí.');
      return toolBlock.input.events;
    }

    if (data.stop_reason === 'pause_turn' && (Date.now() - t0) < 180000) {
      Logger.log('pause_turn – pokračuji v běhu (' + (pokus + 1) + ').');
      msgs = msgs.concat([{ role: 'assistant', content: data.content }]);
      continue;
    }

    if (data.stop_reason === 'end_turn' && (Date.now() - t0) < 180000) {
      // Model skončil textem bez zavolání nástroje → vyžádat odevzdání.
      Logger.log('Model nezavolal nástroj – vyžaduji report_events (' + (pokus + 1) + ').');
      msgs = msgs.concat([
        { role: 'assistant', content: data.content },
        { role: 'user', content: 'Nyní odevzdej nalezené akce PRÁVĚ JEDNÍM zavoláním nástroje report_events.' },
      ]);
      continue;
    }
    break;
  }

  if (data && data.stop_reason === 'max_tokens') {
    Logger.log('POZOR: odpověď byla uříznuta limitem tokenů – pokusím se zachránit kompletní záznamy.');
  }

  // Primárně text POSLEDNÍ odpovědi (tam bývá finální pole), pak celý poskládaný text.
  let events = parseEvents_(lastText) || parseEvents_(text);
  if (!events) {
    // Druhá fáze: model komentoval nebo nedokončil pole → jedno dovolání BEZ web searche,
    // které z textu sestaví čisté JSON pole.
    Logger.log('JSON se nepodařilo naparsovat napřímo – zkouším formátovací dovolání.');
    const fixResp = UrlFetchApp.fetch(ANTHROPIC_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify({
        model: model,
        max_tokens: 16000,
        system: 'Vrať VÝHRADNĚ platné JSON pole. Žádný jiný text.',
        messages: [{ role: 'user', content:
          'Z následujícího textu sestav kompletní platné JSON pole kulturních akcí ' +
          'se stejnými klíči, jaké text obsahuje (id, datum_od, datum_do, cas, nazev, misto, obec, ' +
          'dojezd, kategorie, podkategorie, cena, popis, skore, stav, primarni_zdroj, url, dalsi_zdroj, poznamka). ' +
          'Neúplné poslední záznamy vynech. Pokud žádné akce nejsou, vrať [].\n\n' + text.slice(0, 60000) }],
      }),
      muteHttpExceptions: true,
    });
    Logger.log('Formátovací dovolání: HTTP ' + fixResp.getResponseCode());
    if (fixResp.getResponseCode() === 200) {
      const fixData = JSON.parse(fixResp.getContentText());
      const fixText = (fixData.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      events = parseEvents_(fixText);
    }
  }
  if (!events) {
    throw new Error('Odpověď API se nepodařilo naparsovat jako JSON: ' + text.slice(0, 300));
  }
  return events;
}

function callAnthropic_(cfg, zdroje, typKontroly) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Chybí Script Property ANTHROPIC_API_KEY.');
  const model = vyberModelProKontrolu_(typKontroly);

  const sourcesList = zdroje
    .map(z => '- ' + z.nazev + (z.priorita ? ' [' + z.priorita + ']' : '') + ': ' + z.url)
    .join('\n');

  const system = [
    'Jsi Kulturní radar – asistent, který vyhledává kulturní akce v ČR.',
    'Výsledky NIKDY nevypisuj jako text – po dokončení hledání je odevzdej',
    'PRÁVĚ JEDNÍM zavoláním nástroje report_events (parametr events = seznam akcí).',
    'Formáty hodnot: id = RRRR-MM-DD-slug-nazvu; datum_od/datum_do = "D. M. RRRR" (datum_do může být "");',
    'dojezd = text VŽDY s časem i vzdáleností (např. "cca 30–40 min, ~35 km"); kategorie = středníkem oddělené;',
  ].concat(podkategorieInstrukce_()).concat([
    'skore = číslo 1–10, rodinná atraktivita podle této rubriky:',
    '  9–10 = jedinečná/festivalová akce, kterou by škoda propásnout (výjimečný headliner, ojedinělý formát, silná lokální tradice);',
    '  6–8 = solidní rodinný výlet, dobrý program, ale ne zcela ojedinělý;',
    '  3–5 = průměrná akce, spíš doplňkový tip;',
    '  1–2 = drobná/rutinní akce (pravidelná menší akce bez zvláštního lákadla).',
    'stav = "potvrzeno". Piš česky.',
    'Uváděj jen akce ověřené na uvedených nebo jiných OFICIÁLNÍCH zdrojích',
    '(města, pořadatelé, instituce); agregátory jen jako doplňkové ověření.',
  ]).join('\n');

  const userMsg = [
    'Vyhledej kulturní akce podle těchto kritérií:',
    '- Profil lokality (střed hledání): ' + cfg.profil,
    '- Období: ' + cfg.rozsah,
    '- Maximální dojezd autem (1 cesta): ' + cfg.dojezd + ' z města ' + cfg.profil,
    '- Kategorie: ' + cfg.kategorie,
    '- Malé lokální akce: ' + cfg.maleAkce,
    '- Dětské akce: ' + cfg.detske,
    '- Typ běhu: ' + typKontroly,
    '',
    'Výběrový režim: koncerty/festivaly/jarmarky/slavnosti jednotlivě;',
    'výstavy jednou za celé období; divadlo hlavně mimořádné/venkovní/festivalové;',
    'hrady a zámky jen slavnosti, noční prohlídky a tematické programy;',
    'vinařské/gastro jen s výrazným kulturním programem.',
    'Vícedenní a probíhající akce uváděj JEDNOU jako celek (datum_od až datum_do),',
    'nikdy po jednotlivých dnech ani jako dílčí podprogramy; dílčí body shrň v popisu.',
    '',
    'Prioritní zdroje ke kontrole:',
    sourcesList,
    '',
    'Odevzdej max 15 nejrelevantnějších akcí zavoláním nástroje report_events.',
    'Uváděj pouze KONKRÉTNÍ pojmenované akce; nikdy obecné souhrny typu',
    '"letní kulturní akce města" nebo "víkendový program" bez vlastního názvu.',
    'Pole "popis" drž STRUČNÉ – maximálně 1–2 krátké věty. Pokud nic, odevzdej prázdný seznam.',
  ].join('\n');

  return volatAnthropicSTool_(apiKey, model, system, userMsg, MAX_WEB_SEARCHES);
}

/** v3.29: ověří JEDEN e-mailový tip (syrový text mailu) přes AI + web search
 *  – stejný nástroj report_events jako běžná kontrola, ale jiný prompt: místo
 *  hledání podle kritérií/zdrojů appka žádá AI, ať dohledá A OVĚŘÍ konkrétní
 *  vedení z textu. AI vrátí buď PRÁVĚ JEDNU ověřenou akci, nebo prázdné pole
 *  (events: []), pokud se ověřit nepovede – to je platný výsledek, ne chyba
 *  (viz zpracovatEmailTipy_, stav "nelze-ověřit"). Vždy na Sonnetu (mimo
 *  Haiku experiment, který se týká jen 'denní kontrola', viz
 *  vyberModelProKontrolu_). */
function callAnthropicEmailTip_(text) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Chybí Script Property ANTHROPIC_API_KEY.');
  const model = vyberModelProKontrolu_('email-tip');

  const kategorieSeznam = Object.keys(PODKATEGORIE_SLOVNIK).concat(['folklor']).join('; ');

  const system = [
    'Jsi Kulturní radar – asistent, který ověřuje tip na kulturní akci v ČR poslaný e-mailem.',
    'Dostaneš syrový text jednoho e-mailu (může být neúplný, nestrukturovaný, s podpisem/citovaným vláknem).',
    'Nejdřív z něj vytáhni, o jakou KONKRÉTNÍ pojmenovanou akci jde. Pak ji zkus OVĚŘIT WEBEM – najdi',
    'oficiální zdroj (web pořadatele, města, instituce), který termín/místo skutečně potvrzuje.',
    'Pokud se akci NEPODAŘÍ ověřit na důvěryhodném zdroji (nebo mail nepopisuje žádnou konkrétní akci),',
    'odevzdej PRÁZDNÝ seznam (events: []) zavoláním nástroje report_events – to je platný výsledek,',
    'NE chyba. Nikdy si nic nevymýšlej ani nedoplňuj z domněnky.',
    'Pokud se ověřit podaří, odevzdej PRÁVĚ JEDNU akci zavoláním nástroje report_events.',
    'Formáty hodnot: id = RRRR-MM-DD-slug-nazvu; datum_od/datum_do = "D. M. RRRR" (datum_do může být "");',
    'obec = přesný název obce/města, kde se akce koná (appka podle něj dohledává, kam akci zařadit);',
    'dojezd = stručný text o dostupnosti místa konání vzhledem k centru obce (u akce přímo ve městě stačí "v centru obce" nebo podobně);',
    'kategorie = středníkem oddělené, VÝHRADNĚ z tohoto seznamu: ' + kategorieSeznam + ';',
  ].concat(podkategorieInstrukce_()).concat([
    'skore = číslo 1–10, rodinná atraktivita (9–10 jedinečná akce, 6–8 solidní výlet, 3–5 průměrná, 1–2 drobná).',
    'stav = "potvrzeno". primarni_zdroj = název/URL zdroje, na kterém jsi akci ověřil. Piš česky.',
  ]).join('\n');

  const userMsg = [
    'Text e-mailového tipu:',
    '---',
    text,
    '---',
    '',
    'Ověř a odevzdej podle instrukcí v systémovém promptu.',
  ].join('\n');

  return volatAnthropicSTool_(apiKey, model, system, userMsg, MAX_WEB_SEARCHES);
}

/**
 * Pokusí se z textu vyparsovat JSON pole akcí; vrací pole nebo null.
 * Zkouší více kandidátních výřezů – model při pokračování (pause_turn) občas
 * začne pole vypisovat celé znovu, takže finální validní pole bývá až u POSLEDNÍHO '['.
 */
function parseEvents_(text) {
  const t = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const first = t.indexOf('[');
  if (first < 0) return null;
  const last = t.lastIndexOf('[');
  const end = t.lastIndexOf(']');

  const candidates = [];
  if (last > first) candidates.push(end > last ? t.slice(last, end + 1) : t.slice(last));
  candidates.push(end > first ? t.slice(first, end + 1) : t.slice(first));

  for (let i = 0; i < candidates.length; i++) {
    // Sanitizace: modely občas dají do textových hodnot skutečné konce řádků
    // (JSON je uvnitř řetězců zakazuje) nebo čárku před ]/}; obojí opravíme.
    const cand = candidates[i]
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/,\s*([\]}])/g, '$1');
    try {
      const ev = JSON.parse(cand);
      if (Array.isArray(ev)) return ev;
    } catch (e) { /* zkusit záchranu */ }
    const cut = cand.lastIndexOf('}');
    if (cut > 0) {
      try {
        const ev = JSON.parse(cand.slice(0, cut + 1) + ']');
        if (Array.isArray(ev)) {
          Logger.log('Odpověď byla neúplná; zachráněno ' + ev.length + ' kompletních záznamů.');
          return ev;
        }
      } catch (e2) { /* další kandidát */ }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// ZÁPIS DO AKCE (upsert, jen A:V a Y)
// ---------------------------------------------------------------------------

function upsertEvents_(ss, cfg, events) {
  const sh = ss.getSheetByName(SHEET.AKCE);
  const lastRow = sh.getLastRow();
  const existing = lastRow > 1
    ? sh.getRange(2, 1, lastRow - 1, AKCE_COLS).getValues()
    : [];

  // Indexy: podle ID, podle přesného klíče a podle profil+datum pro fuzzy shodu názvů
  const byId = {};
  const byKey = {};
  const byProfilDatum = {};
  existing.forEach((row, i) => {
    const id = norm_(row[0]);
    if (id) byId[id] = i;
    byKey[dedupKey_(row[24], row[1], row[4], row[5])] = i;
    const pd = norm_(row[24]) + '|' + dateKey_(row[1]);
    (byProfilDatum[pd] = byProfilDatum[pd] || []).push({ i: i, tokens: nazevTokens_(row[4]) });
  });

  const today = formatDateOnly_(new Date());
  const stats = {
    total: events.length, nove: 0, zmenene: 0, zrusene: 0, bezZmeny: 0,
    noveNazvy: [], zmeneneNazvy: [], zruseneNazvy: [], bezZmenyNazvy: [],
  };
  const polozka = ev => ({
    d: dateKey_(ev.datum_od),
    kat: String(ev.kategorie || '').split(';')[0].trim() || 'ostatní',
    t: String(ev.nazev || '') + ' (' + String(ev.datum_od || '') + ')',
  });

  events.forEach(ev => {
    const rowVals = eventToRow_(ev, today);
    const key = dedupKey_(cfg.profil, ev.datum_od, ev.nazev, ev.misto);
    const pd = norm_(cfg.profil) + '|' + dateKey_(ev.datum_od);
    const evTokens = nazevTokens_(ev.nazev);
    let idx = byId[norm_(ev.id)];
    if (idx === undefined) idx = byKey[key];
    if (idx === undefined) {
      // Fuzzy: stejný profil + stejné datum + dostatečný překryv názvů
      const hit = (byProfilDatum[pd] || []).find(c => isSameName_(c.tokens, evTokens));
      if (hit) idx = hit.i;
    }

    if (idx === undefined) {
      // NOVÁ akce → append: A:V + Y (W:X nechat vzorcům)
      const r = sh.getLastRow() + 1;
      rowVals[14] = 'ANO';                       // Novinka
      rowVals[16] = today;                       // První nález
      sh.getRange(r, 1, 1, AKCE_WRITE_AV).setValues([rowVals.slice(0, AKCE_WRITE_AV)]);
      sh.getRange(r, COL_Y).setValue(cfg.profil);
      // registrovat i do indexů, aby se duplicitní položky TÉHOŽ běhu spojily
      const ni = existing.length;
      existing.push(rowVals.concat(['', '', cfg.profil]));
      if (norm_(ev.id)) byId[norm_(ev.id)] = ni;
      byKey[key] = ni;
      (byProfilDatum[pd] = byProfilDatum[pd] || []).push({ i: ni, tokens: evTokens });
      stats.noveNazvy.push(polozka(ev));
      stats.nove++;
    } else {
      // EXISTUJÍCÍ akce → porovnat klíčová pole, aktualizovat
      const r = idx + 2;
      const old = existing[idx];
      if (norm_(old[24]) !== norm_(cfg.profil)) return;  // cizí profil neměnit

      // Změna = jen posun termínu nebo změna stavu (zrušení apod.);
      // přeformulace textů (čas/cena/popis) mezi běhy se nepočítá.
      const changed =
        dateKey_(old[1]) !== dateKey_(ev.datum_od) ||
        dateKey_(old[2]) !== dateKey_(ev.datum_do) ||
        norm_(old[13]) !== norm_(ev.stav);

      if (changed) {
        rowVals[0] = old[0];                     // ID zachovat
        rowVals[14] = old[14];                   // Novinka zachovat
        rowVals[15] = 'ANO';                     // Změna
        rowVals[16] = old[16];                   // První nález zachovat
        sh.getRange(r, 1, 1, AKCE_WRITE_AV).setValues([rowVals.slice(0, AKCE_WRITE_AV)]);
        if (norm_(ev.stav) === 'zrušeno') { stats.zrusene++; stats.zruseneNazvy.push(polozka(ev)); }
        else { stats.zmenene++; stats.zmeneneNazvy.push(polozka(ev)); }
      } else {
        sh.getRange(r, 18).setValue(today);      // jen Poslední kontrola
        stats.bezZmenyNazvy.push(polozka(ev));
        stats.bezZmeny++;
      }
    }
  });

  invalidovatCacheEventu_();   // v3.26: AKCE se změnilo – cache apiEvents by ukazovala staré akce
  return stats;
}

function eventToRow_(ev, today) {
  return [
    ev.id || '',            // A ID
    ev.datum_od || '',      // B
    ev.datum_do || '',      // C
    ev.cas || '',           // D
    ev.nazev || '',         // E
    ev.misto || '',         // F
    ev.obec || '',          // G
    ev.dojezd || '',        // H
    ev.kategorie || '',     // I
    Array.isArray(ev.podkategorie) ? ev.podkategorie.join(';') : (ev.podkategorie || ''), // J
    ev.cena || '',          // K
    ev.popis || '',         // L
    ev.skore || '',         // M
    ev.stav || 'potvrzeno', // N
    'NE',                   // O Novinka (přepíše se u nové)
    'NE',                   // P Změna
    today,                  // Q První nález (přepíše se u existující)
    today,                  // R Poslední kontrola
    ev.primarni_zdroj || '',// S
    ev.url || '',           // T
    ev.dalsi_zdroj || '',   // U
    ev.poznamka || '',      // V
  ];
}

/**
 * Jednorázový úklid: najde v AKCE duplicitní záznamy (stejný profil + datum
 * + překrývající se název), ponechá STARŠÍ řádek, u něj aktualizuje Poslední
 * kontrolu, a novější duplicitní řádky smaže. Zaloguje do KONTROL.
 */
function cleanupDuplicates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET.AKCE);
  const lastRow = sh.getLastRow();
  if (lastRow < 3) return;

  const data = sh.getRange(2, 1, lastRow - 1, AKCE_COLS).getValues();
  const toDelete = najdiDuplicity_(data);

  if (toDelete.length === 0) {
    Logger.log('Žádné duplicity nenalezeny.');
    try { ss.toast('Žádné duplicity nenalezeny.', 'Kulturní radar'); } catch (e) {}
    return;
  }

  const today = formatDateOnly_(new Date());
  // u ponechaných řádků aktualizovat Poslední kontrolu
  toDelete.forEach(d => sh.getRange(d.keptRow, 18).setValue(today));
  // mazat odspodu, aby se neposunula čísla řádků
  toDelete.sort((a, b) => b.rowNum - a.rowNum).forEach(d => sh.deleteRow(d.rowNum));

  const detail = toDelete.map(d => d.nazev + ' (ř. ' + d.rowNum + ' → ponechán ř. ' + d.keptRow + ')').join('; ');
  const ksh = ss.getSheetByName(SHEET.KONTROLY);
  ksh.appendRow([
    formatDate_(new Date()), 'úklid duplicit', 'AKCE – celý list',
    toDelete.length, 0, 0, 0, 0, 0, 0,
    'Odstraněny duplicitní řádky: ' + detail,
    'Apps Script automatizace',
  ]);
  Logger.log('Odstraněno duplicit: ' + toDelete.length + ' — ' + detail);
  try { ss.toast('Odstraněno duplicit: ' + toDelete.length, 'Kulturní radar'); } catch (e) {}
}

/** Označí akce s "Datum do" (příp. "Datum od") v minulosti jako proběhlé. */
function markPastEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET.AKCE);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const data = sh.getRange(2, 1, lastRow - 1, AKCE_COLS).getValues();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let zmeneno = 0;

  data.forEach((row, i) => {
    const stav = norm_(row[13]);
    if (stav === 'proběhlo' || stav === 'zrušeno') return;
    const end = parseCzDate_(row[2]) || parseCzDate_(row[1]);
    if (end && end < today) {
      sh.getRange(i + 2, 14).setValue('proběhlo');
      zmeneno++;
    }
  });

  if (zmeneno) invalidovatCacheEventu_();   // v3.26: AKCE se změnilo (stav proběhlo)
}

// ---------------------------------------------------------------------------
// STÁLÁ MÍSTA (zoo, science centra, hrady, jeskyně…)
// ---------------------------------------------------------------------------

const MISTA_HLAVICKA = ['ID', 'Název', 'Typ', 'Obec', 'Dojezd', 'Otevírací doba',
  'Sezónní poznámka', 'Vstupné', 'Vhodné pro děti', 'Skóre', 'Stav', 'URL',
  'Poznámka', 'Poslední aktualizace', 'Profil lokality'];

/** Založí list MÍSTA s hlavičkou, pokud neexistuje. Vrací list. */
function ensureMistaSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.MISTA);
  if (!sh) {
    sh = ss.insertSheet(SHEET.MISTA);
    sh.getRange(1, 1, 1, MISTA_HLAVICKA.length).setValues([MISTA_HLAVICKA])
      .setFontWeight('bold').setBackground('#0b5345').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** v3.20: přidán sloupec 'Uživatel' – oblíbené/navštívené jsou od v3.20 osobní
 *  (per uživatelský profil), ne sdílené za celou domácnost jako dřív. */
const OZNACENI_HLAVICKA = ['ID akce', 'Typ', 'Datum označení', 'Název', 'Místo', 'Uživatel'];

function ensureOznaceniSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.OZNACENI);
  if (!sh) {
    sh = ss.insertSheet(SHEET.OZNACENI);
    sh.getRange(1, 1, 1, OZNACENI_HLAVICKA.length).setValues([OZNACENI_HLAVICKA])
      .setFontWeight('bold').setBackground('#7a5c2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Čte list OZNAČENÍ do prostých objektů. I/O – bez logiky, snadno nahraditelné ve testech. */
function readOznaceni_(ss) {
  const sh = ss.getSheetByName(SHEET.OZNACENI);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, OZNACENI_HLAVICKA.length).getValues()
    .map(r => ({
      id: String(r[0] || ''), typ: String(r[1] || ''), datum: cellText_(r[2]),
      nazev: String(r[3] || ''), misto: String(r[4] || ''), uzivatel: String(r[5] || ''),
    }))
    .filter(r => r.id && r.typ);
}

/** Přepíše list OZNAČENÍ zadanými řádky (jednoduchý full-rewrite – dataset je malý). */
function zapsatOznaceni_(ss, rows) {
  const sh = ensureOznaceniSheet_(ss);
  const posledni = sh.getLastRow();
  if (posledni > 1) sh.getRange(2, 1, posledni - 1, OZNACENI_HLAVICKA.length).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, OZNACENI_HLAVICKA.length).setValues(
      rows.map(r => [r.id, r.typ, r.datum, r.nazev, r.misto, r.uzivatel || '']));
  }
}

/** PURE: pole řádků OZNAČENÍ (jednoho uživatele – volající musí předfiltrovat)
 *  → Map(id → {oblibene, navstivenoDne}). Bez Sheets I/O, testovatelné přímo. */
function oznaceniMapy_(rows) {
  const mapa = new Map();
  rows.forEach(r => {
    const zaznam = mapa.get(r.id) || { oblibene: false, navstivenoDne: null };
    if (r.typ === 'oblibene') zaznam.oblibene = true;
    else if (r.typ === 'navstiveno') zaznam.navstivenoDne = r.datum || zaznam.navstivenoDne;
    mapa.set(r.id, zaznam);
  });
  return mapa;
}

/** PURE (v3.26): pole řádků OZNAČENÍ (jednoho uživatele – volající musí
 *  předfiltrovat) → Set klíčů míst (`klicSouradnic_(misto, obec)`, tj.
 *  normalizovaný `misto|obec`) označených typem 'oblibene_misto'. */
function oblibenaMistaSety_(rows) {
  const sada = new Set();
  rows.forEach(r => { if (r.typ === 'oblibene_misto') sada.add(r.id); });
  return sada;
}

/** PURE: přepne typ u dané akce PRO DANÉHO UŽIVATELE v poli řádků OZNAČENÍ
 *  (přidá, nebo smaže existující řádek). Vrací { rows: novéPole, aktivni: bool }. */
function toggleOznaceni_(rows, id, typ, kdyText, nazev, misto, uzivatelId) {
  const idx = rows.findIndex(r => r.id === id && r.typ === typ && r.uzivatel === uzivatelId);
  if (idx >= 0) {
    return { rows: rows.slice(0, idx).concat(rows.slice(idx + 1)), aktivni: false };
  }
  const novy = { id, typ, datum: kdyText, nazev: nazev || '', misto: misto || '', uzivatel: uzivatelId };
  return { rows: rows.concat([novy]), aktivni: true };
}

/** PURE: řádky OZNAČENÍ, jejichž ID už neexistuje mezi platnými ID akcí. */
function sirotciOznaceni_(rows, platnaId) {
  return rows.filter(r => !platnaId.has(r.id));
}

/** Najde v listu AKCE řádek se zadaným ID; vrací {nazev, misto} nebo null. */
function najdiAkciPodleId_(ss, id) {
  const sh = ss.getSheetByName(SHEET.AKCE);
  const lastRow = sh ? sh.getLastRow() : 1;
  if (lastRow < 2) return null;
  const data = sh.getRange(2, 1, lastRow - 1, AKCE_COLS).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] || '') === id) {
      return { nazev: String(data[i][4] || ''), misto: String(data[i][5] || '') };
    }
  }
  return null;
}

/** Přepne označení (typ: 'oblibene' | 'navstiveno') u akce PRO KONKRÉTNÍHO
 *  uživatelského profilu; vrací aktuální stav obou příznaků TOHOTO uživatele. */
function apiToggle_(ss, id, typ, uzivatelId) {
  if (typ !== 'oblibene' && typ !== 'navstiveno') return { ok: false, error: 'neplatný typ označení' };
  if (!id) return { ok: false, error: 'chybí ID akce' };
  if (!uzivatelId) return { ok: false, error: 'chybí uživatelský profil – přihlas se prosím znovu' };
  const akceInfo = najdiAkciPodleId_(ss, id);
  if (!akceInfo) return { ok: false, error: 'akce s tímto ID nebyla nalezena' };

  const rows = readOznaceni_(ss);
  const vysledek = toggleOznaceni_(rows, id, typ, formatDateOnly_(new Date()), akceInfo.nazev, akceInfo.misto, uzivatelId);
  zapsatOznaceni_(ss, vysledek.rows);
  invalidovatCacheEventu_();   // v3.26: OZNAČENÍ se změnilo (★/✓) – ovlivňuje apiEvents

  const rowsTohotoUzivatele = vysledek.rows.filter(r => r.uzivatel === uzivatelId);
  const stavPoTom = oznaceniMapy_(rowsTohotoUzivatele).get(id) || { oblibene: false, navstivenoDne: null };
  return { ok: true, id, oblibene: stavPoTom.oblibene, navstivenoDne: stavPoTom.navstivenoDne || '' };
}

/** v3.26: přepne „oblíbené MÍSTO" (ne jednotlivou akci) PRO KONKRÉTNÍHO
 *  uživatelského profilu. Na rozdíl od apiToggle_ nebere ID akce (misto
 *  nemá jedno konkrétní ID akce, na kterém by šlo záznam pověsit) –
 *  identita místa se odvozuje přímo z misto+obec, stejným klíčem
 *  (`klicSouradnic_`), jaký readEventsApi_ už dnes používá pro lookup
 *  do SOUŘADNICE. Ten klíč se uloží do sloupce "ID akce" v OZNAČENÍ
 *  (přepoužití sloupce – u typu 'oblibene_misto' nedrží ID akce, ale
 *  identitu místa). Sloupec "Místo" dostane stejnou hodnotu jako
 *  "Název" (ne prázdno) – pole u tohoto typu ztrácí svůj původní
 *  význam (místo KONÁNÍ akce), takže prázdná buňka by v Sheetu
 *  vypadala jako chybějící data; duplicitní hodnota je čitelnější. */
function apiToggleMisto_(ss, misto, obec, uzivatelId) {
  if (!misto) return { ok: false, error: 'chybí místo' };
  if (!uzivatelId) return { ok: false, error: 'chybí uživatelský profil – přihlas se prosím znovu' };

  const klic = klicSouradnic_(misto, obec);
  const nazev = obec ? (misto + ' (' + obec + ')') : misto;
  const rows = readOznaceni_(ss);
  const vysledek = toggleOznaceni_(rows, klic, 'oblibene_misto', formatDateOnly_(new Date()), nazev, nazev, uzivatelId);
  zapsatOznaceni_(ss, vysledek.rows);
  invalidovatCacheEventu_();   // OZNAČENÍ se změnilo – ovlivňuje apiEvents (mistoOblibene)

  return { ok: true, misto, obec, oblibene: vysledek.aktivni };
}

// ---------------------------------------------------------------------------
// UŽIVATELSKÉ PROFILY (v3.20) – osobní oblíbené/navštívené + osobní filtry
// ---------------------------------------------------------------------------

const UZIVATELE_HLAVICKA = ['ID', 'Jméno', 'PIN_hash', 'Filtry', 'Vytvořeno', 'Notifikace'];

function ensureUzivateleSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.UZIVATELE);
  if (!sh) {
    sh = ss.insertSheet(SHEET.UZIVATELE);
    sh.getRange(1, 1, 1, UZIVATELE_HLAVICKA.length).setValues([UZIVATELE_HLAVICKA])
      .setFontWeight('bold').setBackground('#4a235a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Čte list UŽIVATELÉ do prostých objektů (bez PIN_hash navenek z apiMeta). */
function readUzivatele_(ss) {
  const sh = ss.getSheetByName(SHEET.UZIVATELE);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, UZIVATELE_HLAVICKA.length).getValues()
    .map(r => ({
      id: String(r[0] || ''), jmeno: String(r[1] || ''), pinHash: String(r[2] || ''),
      filtry: String(r[3] || ''), vytvoreno: cellText_(r[4]),
      notifikace: String(r[5] || ''),   // v3.30: JSON, viz validovatNotifikace_
    }))
    .filter(r => r.id);
}

/** PURE: SHA-256 hash PINu se solí (formát uložení: "sůl$hash"). Sůl brání
 *  tomu, aby šlo dva stejné PINy poznat podle stejného hashe v tabulce. */
function hashPin_(pin, sul) {
  const vstup = sul + ':' + String(pin);
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, vstup, Utilities.Charset.UTF_8);
  const hex = bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  return sul + '$' + hex;
}

/** PURE: ověří PIN proti uloženému "sůl$hash". */
function overitPin_(pin, ulozenyHash) {
  if (!ulozenyHash || ulozenyHash.indexOf('$') < 0) return false;
  const sul = ulozenyHash.split('$')[0];
  return hashPin_(pin, sul) === ulozenyHash;
}

/** API: přihlášení uživatelského profilu jménem/ID + PIN. Nikdy nevrací hash. */
function apiPrihlaseniUzivatele_(ss, uzivatelId, pin) {
  if (!uzivatelId || !pin) return { ok: false, error: 'chybí profil nebo PIN' };
  const uzivatel = readUzivatele_(ss).find(u => u.id === uzivatelId);
  if (!uzivatel) return { ok: false, error: 'profil nenalezen' };
  if (!overitPin_(pin, uzivatel.pinHash)) return { ok: false, error: 'nesprávný PIN' };
  let filtry = {};
  try { filtry = uzivatel.filtry ? JSON.parse(uzivatel.filtry) : {}; } catch (e) { filtry = {}; }
  let notifikace = {};
  try { notifikace = uzivatel.notifikace ? JSON.parse(uzivatel.notifikace) : {}; } catch (e) { notifikace = {}; }
  return { ok: true, id: uzivatel.id, jmeno: uzivatel.jmeno, filtry, notifikace };
}

/** API: seznam profilů k výběru na přihlašovací obrazovce (jen ID + jméno, žádné PINy). */
function apiSeznamUzivatelu_(ss) {
  return readUzivatele_(ss).map(u => ({ id: u.id, jmeno: u.jmeno }));
}

/** API: uloží osobní filtry (kategorie, dojezd, ...) uživatelského profilu jako JSON. */
function apiSetFiltry_(ss, uzivatelId, filtryObj) {
  if (!uzivatelId) return { ok: false, error: 'chybí uživatelský profil' };
  const sh = ensureUzivateleSheet_(ss);
  const data = readUzivatele_(ss);
  const idx = data.findIndex(u => u.id === uzivatelId);
  if (idx < 0) return { ok: false, error: 'profil nenalezen' };
  sh.getRange(idx + 2, 4).setValue(JSON.stringify(filtryObj || {}));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// v3.30: NOTIFIKACE – osobní nastavení doručování (kanál/frekvence/obsah),
// uložené jako JSON v novém sloupci "Notifikace" listu UŽIVATELÉ (krok A+B,
// viz BACKLOG.md; sestavení a odesílání samotných notifikací – kroky C–F –
// je samostatná budoucí práce, tenhle blok jen ukládá/čte preference).
//
// Datový model (JSON v buňce):
//   {
//     kanaly: ['email','ntfy'],   // podmnožina POVOLENE_KANALY_, [] = vypnuto
//     email: 'jmeno@example.com', // vyžadováno, pokud 'email' v kanaly
//     ntfyTema: 'radar-<hex>',    // vyžadováno, pokud 'ntfy' v kanaly – NIKDY
//                                 // nepřichází od klienta (viz apiSetNotifikace_
//                                 // níže), jen z apiVygenerovatNtfyTema_
//     frekvenceDny: 7,            // 1–90, jak často (dny mezi odesláními)
//     obsah: ['kategorie'],       // podmnožina POVOLENY_OBSAH_ (zatím jen
//                                 // 'kategorie' – 'doporuceni' vědomě odloženo,
//                                 // viz BACKLOG.md, vyžaduje port spocitatDoporuceni_
//                                 // na backend, samostatné budoucí rozhodnutí)
//     posledniOdeslano: '',       // ISO 8601 string (ne Sheets Date!), '' = nikdy;
//                                 // nastavuje jen budoucí odesílací job (krok D)
//   }
// ---------------------------------------------------------------------------

const POVOLENE_KANALY_ = ['email', 'ntfy'];
const POVOLENY_OBSAH_ = ['kategorie'];   // 'doporuceni' zatím záměrně chybí

/** PURE: validuje už NORMALIZOVANÉ (filtrované) nastavení notifikací –
 *  volající (apiSetNotifikace_) napřed ořeže kanaly/obsah na povolené
 *  hodnoty, tahle funkce jen kontroluje podmíněnou požadovanost (e-mail
 *  vyžaduje platnou adresu, ntfy vyžaduje už vygenerované téma) a rozsah
 *  frekvence. Prázdné `kanaly` (notifikace vypnuté) projdou vždy bez
 *  dalších podmínek – vypnutý stav nemá co validovat. */
function validovatNotifikace_(n) {
  const kanaly = n.kanaly || [];
  if (!kanaly.length) return { ok: true };
  if (kanaly.indexOf('email') !== -1 && !/^\S+@\S+\.\S+$/.test(n.email || '')) {
    return { ok: false, error: 'kanál e-mail vyžaduje platnou e-mailovou adresu' };
  }
  if (kanaly.indexOf('ntfy') !== -1 && !n.ntfyTema) {
    return { ok: false, error: 'kanál ntfy vyžaduje nejdřív vygenerované téma (naskenuj QR v appce)' };
  }
  const frekvence = Number(n.frekvenceDny) || 0;
  if (frekvence < 1 || frekvence > 90) {
    return { ok: false, error: 'frekvence musí být 1–90 dní' };
  }
  return { ok: true };
}

/** API: uloží osobní nastavení notifikací. `ntfyTema` a `posledniOdeslano`
 *  se VŽDY přebírají z už uloženého stavu, nikdy z klientova requestu – ntfy
 *  téma smí vzniknout jen přes apiVygenerovatNtfyTema_ (ntfy.sh nemá
 *  autentizaci, kdokoli zná téma může na něj psát i číst, takže nesmí jít
 *  nastavit na hádatelnou/klientem zvolenou hodnotu) a posledniOdeslano smí
 *  psát jen budoucí odesílací job (krok D), ne uživatel sám. */
function apiSetNotifikace_(ss, uzivatelId, nastaveniObj) {
  if (!uzivatelId) return { ok: false, error: 'chybí uživatelský profil' };
  const sh = ensureUzivateleSheet_(ss);
  const data = readUzivatele_(ss);
  const idx = data.findIndex(u => u.id === uzivatelId);
  if (idx < 0) return { ok: false, error: 'profil nenalezen' };

  let stavajici = {};
  try { stavajici = data[idx].notifikace ? JSON.parse(data[idx].notifikace) : {}; } catch (e) { stavajici = {}; }

  const n = nastaveniObj || {};
  const kandidat = {
    kanaly: (Array.isArray(n.kanaly) ? n.kanaly : []).filter(k => POVOLENE_KANALY_.indexOf(k) !== -1),
    email: String(n.email || '').trim(),
    frekvenceDny: Number(n.frekvenceDny) || 0,
    obsah: (Array.isArray(n.obsah) ? n.obsah : []).filter(o => POVOLENY_OBSAH_.indexOf(o) !== -1),
    ntfyTema: stavajici.ntfyTema || '',
    posledniOdeslano: stavajici.posledniOdeslano || '',
  };

  const validace = validovatNotifikace_(kandidat);
  if (!validace.ok) return { ok: false, error: validace.error };

  sh.getRange(idx + 2, 6).setValue(JSON.stringify(kandidat));
  return { ok: true };
}

/** Vygeneruje nehádatelné ntfy téma – prefix "radar-" jen pro čitelnost v
 *  URL/logu, zbytek je náhodný UUID bez pomlček. Vědomě NE z uživatelského
 *  vstupu (rozhodnutí 21. 8. 2026) – ntfy.sh nemá autentizaci, takže
 *  user-friendly téma jako "vojta-radar" by šlo uhodnout/zkusit. */
function novaNtfyTema_() {
  return 'radar-' + Utilities.getUuid().replace(/-/g, '');
}

/** API: vygeneruje a rovnou uloží NOVÉ ntfy téma pro daného uživatele
 *  (přepíše případné předchozí – použitelné i jako „rotace" při podezření
 *  na únik). Frontend z odpovědi postaví QR/odkaz na https://ntfy.sh/<tema>
 *  k naskenování v ntfy appce, nikdy needituje jako text (viz novaNtfyTema_). */
function apiVygenerovatNtfyTema_(ss, uzivatelId) {
  if (!uzivatelId) return { ok: false, error: 'chybí uživatelský profil' };
  const sh = ensureUzivateleSheet_(ss);
  const data = readUzivatele_(ss);
  const idx = data.findIndex(u => u.id === uzivatelId);
  if (idx < 0) return { ok: false, error: 'profil nenalezen' };

  let stavajici = {};
  try { stavajici = data[idx].notifikace ? JSON.parse(data[idx].notifikace) : {}; } catch (e) { stavajici = {}; }
  stavajici.ntfyTema = novaNtfyTema_();
  sh.getRange(idx + 2, 6).setValue(JSON.stringify(stavajici));
  return { ok: true, ntfyTema: stavajici.ntfyTema };
}

// ---------------------------------------------------------------------------
// v3.29: EMAIL_TIPY – fronta e-mailových tipů přijatých přes webhook
// z Cloudflare Email Workeru (viz cloudflare-worker/email-webhook.js).
// Appka zpracovává frontu jednou denně (zpracovatEmailTipy_, součást
// dailyCheck), ne synchronně při příjmu – viz apiEmailTip_ níže.
// ---------------------------------------------------------------------------

const EMAIL_TIPY_HLAVICKA = ['ID', 'Přijato', 'Odesílatel', 'Předmět', 'Text', 'Stav', 'ID akce', 'Zpracováno kdy', 'Poznámka'];

/** Stavy řádku EMAIL_TIPY – sdíleno mezi apiEmailTip_ (zápis) a
 *  zpracovatEmailTipy_ (čtení fronty + update po zpracování), ať se
 *  řetězcové hodnoty nerozjedou na dvou místech. */
const EMAIL_TIP_STAV = {
  NOVE: 'nové',
  OK: 'zpracováno-ok',
  CHYBA: 'zpracováno-chyba',
  NELZE_OVERIT: 'nelze-ověřit',
};

function ensureEmailTipySheet_(ss) {
  let sh = ss.getSheetByName(SHEET.EMAIL_TIPY);
  if (!sh) {
    sh = ss.insertSheet(SHEET.EMAIL_TIPY);
    sh.getRange(1, 1, 1, EMAIL_TIPY_HLAVICKA.length).setValues([EMAIL_TIPY_HLAVICKA])
      .setFontWeight('bold').setBackground('#8a2e2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** API: přijme e-mailový tip z Cloudflare Email Workeru (webhook na tomhle
 *  /exec endpointu) a zařadí ho do fronty EMAIL_TIPY ke zpracování při
 *  příští denní kontrole (zpracovatEmailTipy_). Autentizace přes VLASTNÍ
 *  sdílený token EMAIL_WEBHOOK_TOKEN (Script Property) – záměrně NE stejný
 *  jako WEB_TOKEN (ten odemyká přímé spuštění AI hledání, jiná důvěryhodnostní
 *  hranice; únik jednoho tokenu nemá odemknout obojí). Endpoint jen ZAPÍŠE
 *  do fronty a hned vrátí – žádné volání Anthropic API tady (webhook musí
 *  odpovědět rychle, a AI zpracování má běžet v denním rytmu, ne při každém
 *  příchozím mailu). */
function apiEmailTip_(ss, token, from, subject, text) {
  const props = PropertiesService.getScriptProperties();
  const ocekavanyToken = props.getProperty('EMAIL_WEBHOOK_TOKEN');
  if (!ocekavanyToken || token !== ocekavanyToken) return { ok: false, error: 'Neplatný token.' };

  const textOrez = String(text || '').trim();
  if (!textOrez) return { ok: false, error: 'Prázdný text mailu.' };
  if (textOrez.length > EMAIL_TIP_TEXT_MAX) {
    return { ok: false, error: 'Text je příliš dlouhý (max ' + EMAIL_TIP_TEXT_MAX + ' znaků).' };
  }

  const sh = ensureEmailTipySheet_(ss);
  const id = Utilities.getUuid();
  sh.appendRow([
    id,
    formatDate_(new Date()),
    String(from || '').trim(),
    String(subject || '').trim(),
    textOrez,
    EMAIL_TIP_STAV.NOVE,
    '',
    '',
    '',
  ]);
  return { ok: true, id };
}

/** PURE-ish: seznam názvů profilů z LOKALITY (sloupec B), bez prázdných
 *  řádků. Stejná data jako readMetaApi_.profily, jen zúžená na pouhé názvy
 *  – použito v zpracovatEmailTipy_ pro mapování obec→profil. */
function nazvyProfiluLokalit_(ss) {
  const sh = ss.getSheetByName(SHEET.LOKALITY);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues()
    .map(row => String(row[0] || '').trim())
    .filter(Boolean);
}

/** v3.29: zpracuje frontu EMAIL_TIPY (řádky se stavem "nové") – pro každý
 *  zavolá callAnthropicEmailTip_ (AI ověření webem), a pokud se podaří najít
 *  a ověřit konkrétní akci, zapíše ji do AKCE stejnou cestou jako běžná
 *  kontrola (upsertEvents_/zajistitSouradniceProAkce_). Volá se z dailyCheck
 *  PŘED runCheck_('denní kontrola') – viz krok C.
 *
 *  Mapování obec→profil: normalizovaný přesný match proti profilům v
 *  LOKALITY (nazvyProfiluLokalit_). Bez shody se akce NEZAPISUJE do AKCE
 *  (rozhodnutí 20. 8. 2026: raději nezapsat nespolehlivá data než riskovat
 *  matoucí výsledek, který by se nikde nezobrazil) – řádek dostane stav
 *  "nelze-ověřit" s poznámkou k ruční kontrole.
 *
 *  Časový rozpočet 2 min – dailyCheck pak ještě potřebuje čas na běžnou
 *  kontrolu (runCheck_) v rámci 6min limitu Apps Scriptu, stejný duch jako
 *  zpracovatSledovanaMesta (tam 4,5 min, protože běží samostatně).
 *
 *  Vrací { celkem, ok, chyba, nelzeOverit } pro denní report (notifyOk_). */
function zpracovatEmailTipy_(ss) {
  const stats = { celkem: 0, ok: 0, chyba: 0, nelzeOverit: 0 };
  const sh = ss.getSheetByName(SHEET.EMAIL_TIPY);
  if (!sh) return stats;   // list ještě nikdy nevznikl (žádný tip nikdy nepřišel)

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return stats;

  const data = sh.getRange(2, 1, lastRow - 1, EMAIL_TIPY_HLAVICKA.length).getValues();
  const profily = new Set(nazvyProfiluLokalit_(ss).map(p => norm_(p)));
  const dnes = formatDate_(new Date());
  const CAS_LIMIT_MS = 2 * 60 * 1000;
  const t0 = Date.now();

  for (let i = 0; i < data.length; i++) {
    if (Date.now() - t0 > CAS_LIMIT_MS) {
      Logger.log('zpracovatEmailTipy_: přerušeno kvůli časovému limitu po ' + stats.celkem + ' tipech.');
      break;
    }
    const row = data[i];
    if (String(row[5] || '') !== EMAIL_TIP_STAV.NOVE) continue;   // jen nezpracované
    stats.celkem++;
    const r = i + 2;   // 1-based řádek v listu (řádek 1 = hlavička)
    const text = String(row[4] || '');

    try {
      const events = callAnthropicEmailTip_(text);
      if (!events || events.length === 0) {
        sh.getRange(r, 6, 1, 4).setValues([[EMAIL_TIP_STAV.NELZE_OVERIT, '', dnes, 'AI nenašla/neověřila konkrétní akci.']]);
        stats.nelzeOverit++;
        continue;
      }

      const ev = events[0];
      if (!profily.has(norm_(ev.obec))) {
        sh.getRange(r, 6, 1, 4).setValues([[EMAIL_TIP_STAV.NELZE_OVERIT, '', dnes,
          'Obec "' + (ev.obec || '') + '" není mezi pokrytými profily – nutná ruční kontrola.']]);
        stats.nelzeOverit++;
        continue;
      }

      const zakladniCfg = readCriteria_(ss.getSheetByName(SHEET.KRITERIA));
      const cfg = cfgProMesto_(zakladniCfg, ev.obec);
      ev.primarni_zdroj = ev.primarni_zdroj || 'e-mailový tip';
      ev.poznamka = ['e-mailový tip'].concat(ev.poznamka ? [ev.poznamka] : []).join(' – ');

      const upsertStats = upsertEvents_(ss, cfg, [ev]);
      zajistitSouradniceProAkce_(ss, [ev]);
      logKontrola_(ss, 'email-tip', cfg, upsertStats, 0, vyberModelProKontrolu_('email-tip'));

      // Pozn.: ev.id je ID vygenerované AI pro TENHLE požadavek – pokud
      // upsertEvents_ akci spároval s JIŽ existujícím řádkem (dedup podle
      // data+názvu+místa), skutečné ID v AKCE může být jiné (starší). Pro
      // účely audit stopy v EMAIL_TIPY je to přijatelná nepřesnost, ne bug.
      sh.getRange(r, 6, 1, 4).setValues([[EMAIL_TIP_STAV.OK, ev.id || '', dnes, '']]);
      stats.ok++;
    } catch (err) {
      sh.getRange(r, 6, 1, 4).setValues([[EMAIL_TIP_STAV.CHYBA, '', dnes, String(err).slice(0, 500)]]);
      stats.chyba++;
    }
  }

  return stats;
}

/** API: kontaktní formulář ("Kontakt" vedle profilového badge) – e-mail na
 *  KONTAKT_EMAIL přes MailApp. Dostupné i bez přihlášení (anonymní rodinný
 *  tip) – uzivatelId je jen kontext do těla zprávy, ne podmínka. Jednoduchý
 *  globální cooldown proti spamu, stejný duch jako spustKontroluCore_/
 *  WEB_COOLDOWN_MS. Cooldown se nastaví, až když se e-mail skutečně podaří
 *  odeslat – neúspěšný pokus (výpadek MailApp) nemá blokovat opakování.
 *  `email` je nepovinný kontakt pro odpověď (bez validace formátu) – jde do
 *  `replyTo`, protože MailApp.sendEmail() odesílá jako vlastní Google účet
 *  provozovatele, takže by jinak nešlo poznat, komu odpovědět (ověřeno
 *  naostro 10. 8. 2026). */
function apiKontakt_(jmeno, zprava, email, uzivatelId) {
  const zpravaOrez = String(zprava || '').trim();
  if (!zpravaOrez) return { ok: false, error: 'Napiš prosím nějakou zprávu.' };
  if (zpravaOrez.length > KONTAKT_ZPRAVA_MAX) {
    return { ok: false, error: 'Zpráva je příliš dlouhá (max ' + KONTAKT_ZPRAVA_MAX + ' znaků).' };
  }

  const props = PropertiesService.getScriptProperties();
  const posledni = Number(props.getProperty('KONTAKT_LAST_SENT') || 0);
  if (Date.now() - posledni < KONTAKT_COOLDOWN_MS) {
    // Cooldown je globální (celá appka, ne jen tenhle profil) – hláška proto
    // výslovně počítá s tím, že "poslední" odeslání mohl spustit kdokoli
    // jiný z rodiny, ne nutně stejný člověk, co teď dostal odmítnutí.
    return { ok: false, error: 'Zpráva byla odeslána před chvílí (možná někým jiným z rodiny) - zkus to prosím za půl minuty.' };
  }

  const jmenoOrez = String(jmeno || '').trim();
  const emailOrez = String(email || '').trim();
  const telo = [
    'Jméno: ' + (jmenoOrez || '(neuvedeno)'),
    'Email pro odpověď: ' + (emailOrez || '(neuveden)'),
    'Uživatelský profil: ' + (uzivatelId || '(anonymní)'),
    'Odesláno: ' + formatDate_(new Date()),
    '',
    zpravaOrez,
  ].join('\n');
  const predmet = '[Kulturní radar] Zpráva od ' + (jmenoOrez || 'anonym');

  try {
    if (emailOrez) {
      MailApp.sendEmail(KONTAKT_EMAIL, predmet, telo, { replyTo: emailOrez });
    } else {
      MailApp.sendEmail(KONTAKT_EMAIL, predmet, telo);
    }
  } catch (e) {
    return { ok: false, error: 'Odeslání selhalo, zkus to prosím později.' };
  }
  props.setProperty('KONTAKT_LAST_SENT', String(Date.now()));
  return { ok: true };
}

/** Spustí AI hledání akcí NA VYŽÁDÁNÍ s osobními kritérii uživatelského profilu
 *  (kategorie/dojezd přepsané, zbytek – lokalita, horizont – z domácího profilu
 *  v KRITÉRIÍCH). Náklad na API vzniká jen při explicitním kliknutí uživatele,
 *  ne automaticky. Nalezené akce se zapíší do AKCE stejnou cestou jako běžná
 *  kontrola (upsertEvents_), takže je uvidí i ostatní profily. */
function apiNajdiProUzivatele_(ss, uzivatelId, tok) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('WEB_TOKEN');
  if (!token || tok !== token) return { ok: false, error: 'Neplatný token.' };

  const uzivatel = readUzivatele_(ss).find(u => u.id === uzivatelId);
  if (!uzivatel) return { ok: false, error: 'profil nenalezen' };
  let osobniFiltry = {};
  try { osobniFiltry = uzivatel.filtry ? JSON.parse(uzivatel.filtry) : {}; } catch (e) { osobniFiltry = {}; }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: 'Jiná kontrola právě probíhá, zkus to za chvíli.' };

  try {
    const krit = ss.getSheetByName(SHEET.KRITERIA);
    const cfg = readCriteria_(krit);
    if (osobniFiltry.kategorie) cfg.kategorie = osobniFiltry.kategorie;
    if (osobniFiltry.dojezd) cfg.dojezd = osobniFiltry.dojezd;

    const zdroje = readSources_(ss, cfg.profil);
    if (zdroje.length === 0) {
      return { ok: false, error: 'Pro profil "' + cfg.profil + '" nejsou v ZDROJÍCH žádné zdroje (ani VŠECHNY).' };
    }

    const typKontroly = 'osobní hledání (' + uzivatel.jmeno + ')';
    const events = callAnthropic_(cfg, zdroje, typKontroly);
    const stats = upsertEvents_(ss, cfg, events);
    zajistitSouradniceProAkce_(ss, events);
    logKontrola_(ss, typKontroly, cfg, stats, zdroje.length, vyberModelProKontrolu_(typKontroly));

    return { ok: true, jmeno: uzivatel.jmeno, nove: stats.nove || 0, aktualizovano: stats.aktualizovano || 0 };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// SOUŘADNICE – cache geokódovaných míst pro garantovaný pin na mapě (v3.14).
// Zdroj: Nominatim (OpenStreetMap) – zdarma, bez klíče, vyžaduje identifikační
// User-Agent a max 1 dotaz/s (zdvořilostní pravidla, stejný duch jako met.no).
// ---------------------------------------------------------------------------

const SOURADNICE_HLAVICKA = ['Klíč', 'Lat', 'Lng', 'Zdrojový text', 'Zjištěno'];
const NOMINATIM_USER_AGENT = 'KulturniRadar/' + VERZE + ' (+https://github.com/Akimto01/Kulturni_radar)';

function ensureSouradniceSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.SOURADNICE);
  if (!sh) {
    sh = ss.insertSheet(SHEET.SOURADNICE);
    sh.getRange(1, 1, 1, SOURADNICE_HLAVICKA.length).setValues([SOURADNICE_HLAVICKA])
      .setFontWeight('bold').setBackground('#2e6e5e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** PURE: klíč do cache SOUŘADNIC – normalizované misto+obec (nezávislé na
 *  velikosti písmen/diakritice, stejná lokalita = stejný klíč napříč akcemi). */
function klicSouradnic_(misto, obec) {
  return norm_(String(misto || '').trim() + '|' + String(obec || '').trim());
}

/** PURE: dotaz pro Nominatim – misto+obec (nebo jen obec), vždy s „Česko“
 *  jako nápovědou země pro přesnější/rychlejší shodu. '' když není co hledat. */
function sestavDotazGeokodovani_(misto, obec) {
  const cast = [misto, obec].map(s => String(s || '').trim()).filter(Boolean);
  if (!cast.length) return '';
  return cast.join(', ') + ', Česko';
}

/** Čte list SOUŘADNICE do prostých objektů. I/O – bez logiky. */
function readSouradnice_(ss) {
  const sh = ss.getSheetByName(SHEET.SOURADNICE);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, SOURADNICE_HLAVICKA.length).getValues()
    .map(r => ({ klic: String(r[0] || ''), lat: Number(r[1]), lng: Number(r[2]) }))
    .filter(r => r.klic && !isNaN(r.lat) && !isNaN(r.lng));
}

/** PURE: pole řádků SOUŘADNIC → Map(klíč → {lat, lng}). */
function souradniceMapy_(rows) {
  const mapa = new Map();
  rows.forEach(r => mapa.set(r.klic, { lat: r.lat, lng: r.lng }));
  return mapa;
}

/** Připíše novou souřadnici do listu (jen přidání řádku – cache se nikdy
 *  netoggluje ani nemaže, na rozdíl od OZNAČENÍ). */
function pridatSouradnici_(ss, klic, lat, lng, zdrojText) {
  const sh = ensureSouradniceSheet_(ss);
  sh.appendRow([klic, lat, lng, zdrojText, formatDateOnly_(new Date())]);
  invalidovatCacheEventu_();   // v3.26: SOUŘADNICE se změnilo – ovlivňuje lat/lng v apiEvents
}

/** Zavolá Nominatim pro daný dotaz; vrací {lat, lng} nebo null. Sama si
 *  odpočká zdvořilostní pauzu (1,1 s) – volá se JEN při cache-miss, takže
 *  jedna pauza na jednu skutečně novou lokalitu, ne na každý dotaz akce. */
function geocodovatNominatim_(dotaz) {
  if (!dotaz) return null;
  Utilities.sleep(1100);
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cz&q=' + encodeURIComponent(dotaz);
  const vysledky = fetchJson_(url, { 'User-Agent': NOMINATIM_USER_AGENT });
  if (!vysledky || !vysledky.length) return null;
  const lat = Number(vysledky[0].lat);
  const lng = Number(vysledky[0].lon);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

/** Vrátí souřadnice pro misto+obec – z cache, nebo (při cache-miss) čerstvě
 *  z Nominatim a rovnou zapíše do listu i do `cache` (aby se v rámci jednoho
 *  běhu stejná lokalita negeokódovala dvakrát). null při neúspěchu (např.
 *  nejednoznačný text „Kabinet MÚZ nebo open air lokace“ – to je v pořádku,
 *  frontend pak spadne zpět na textové vyhledávání). */
function zajistitSouradnice_(ss, misto, obec, cache) {
  const klic = klicSouradnic_(misto, obec);
  if (!klic) return null;
  if (cache.has(klic)) return cache.get(klic);
  const dotaz = sestavDotazGeokodovani_(misto, obec);
  let vysledek = null;
  try {
    vysledek = geocodovatNominatim_(dotaz);
  } catch (e) { Logger.log('geokódování selhalo pro "' + dotaz + '": ' + e); }
  if (vysledek) {
    pridatSouradnici_(ss, klic, vysledek.lat, vysledek.lng, dotaz);
  }
  cache.set(klic, vysledek);   // i null se cachuje – ať se nejednoznačný text nezkouší pořád dokola
  return vysledek;
}

/** Po každém běhu kontroly proaktivně doplní souřadnice pro lokality nově
 *  nalezených/aktualizovaných akcí – na POZADÍ (je to trigger, nikdo nečeká),
 *  takže frontend při běžném načtení stránky čte jen hotovou cache, nikdy
 *  negeokóduje synchronně za uživatele. Chyba tady nesmí shodit celou kontrolu. */
function zajistitSouradniceProAkce_(ss, events) {
  try {
    const cache = souradniceMapy_(readSouradnice_(ss));
    const zpracovano = new Set();
    events.forEach(ev => {
      const klic = klicSouradnic_(ev.misto, ev.obec);
      if (!klic || zpracovano.has(klic)) return;
      zpracovano.add(klic);
      zajistitSouradnice_(ss, ev.misto, ev.obec, cache);
    });
  } catch (e) { Logger.log('zajistitSouradniceProAkce_ selhalo: ' + e); }
}

/** Jednorázové (ruční, z menu) doplnění souřadnic pro VŠECHNY existující akce
 *  v AKCÍCH – pro lokality, které vznikly před nasazením v3.14. Respektuje
 *  6min limit běhu Apps Scriptu: přestane včas, příští ruční spuštění
 *  pokračuje tam, kde cache skončila (už hotové lokality se přeskočí). */
function doplnitSouradniceZpetne() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET.AKCE);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  const data = sh.getRange(2, 1, lastRow - 1, AKCE_COLS).getValues();
  const cache = souradniceMapy_(readSouradnice_(ss));
  const zpracovano = new Set();
  const t0 = Date.now();
  let doplneno = 0;
  for (let i = 0; i < data.length; i++) {
    if (Date.now() - t0 > 4.5 * 60 * 1000) {
      Logger.log('doplnitSouradniceZpetne: přerušeno kvůli časovému limitu, doplněno ' + doplneno + '.');
      break;
    }
    const misto = data[i][5], obec = data[i][6];
    const klic = klicSouradnic_(misto, obec);
    if (!klic || zpracovano.has(klic) || cache.has(klic)) continue;
    zpracovano.add(klic);
    const vysledek = zajistitSouradnice_(ss, misto, obec, cache);
    if (vysledek) doplneno++;
  }
  Logger.log('doplnitSouradniceZpetne: hotovo, nově doplněno ' + doplneno + ' souřadnic.');
}

// ---------------------------------------------------------------------------
// POČASÍ (v3.22) – předpověď u budoucích akcí, přepočítává se PŘI KAŽDÉM
// běhu triggeru zpracovatSledovanaMesta (neděle 20:00, čtvrtek 10:00), ne
// jen jednou při vzniku akce. Souřadnice se berou z existující cache
// SOUŘADNICE (Nominatim) – žádné druhé geokódování jen pro počasí.
// Zdroj: Open-Meteo (16denní denní předpověď), fallback met.no, stejný duch
// jako weatherFor_ výš. Oddělený list, žádný zásah do sloupců AKCE A:V.
// ---------------------------------------------------------------------------

const POCASI_HLAVICKA = ['ID akce', 'Aktualizováno', 'Stav', 'Kód počasí', 'Teplota (°C)'];
const POCASI_FORECAST_DAYS = 16;   // dosah denní předpovědi Open-Meteo

function ensurePocasiSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.POCASI);
  if (!sh) {
    sh = ss.insertSheet(SHEET.POCASI);
    sh.getRange(1, 1, 1, POCASI_HLAVICKA.length).setValues([POCASI_HLAVICKA])
      .setFontWeight('bold').setBackground('#2e5c7a').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Čte list POČASÍ do prostých objektů. I/O – bez logiky. */
function readPocasi_(ss) {
  const sh = ss.getSheetByName(SHEET.POCASI);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, POCASI_HLAVICKA.length).getValues()
    .map(r => ({
      id: String(r[0] || ''), aktualizovano: cellText_(r[1]), stav: String(r[2] || ''),
      kod: r[3] === '' ? '' : Number(r[3]), teplota: r[4] === '' ? '' : Number(r[4]),
    }))
    .filter(r => r.id);
}

/** PURE: pole řádků POČASÍ → Map(id akce → záznam). */
function pocasiMapy_(rows) {
  const mapa = new Map();
  rows.forEach(r => mapa.set(r.id, r));
  return mapa;
}

/** Přepíše list POČASÍ zadanými řádky (full-rewrite jako OZNAČENÍ – dataset je
 *  malý a vždy jen budoucí akce, staré řádky tak přirozeně odpadnou samy). */
function zapsatPocasi_(ss, rows) {
  const sh = ensurePocasiSheet_(ss);
  const posledni = sh.getLastRow();
  if (posledni > 1) sh.getRange(2, 1, posledni - 1, POCASI_HLAVICKA.length).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, POCASI_HLAVICKA.length).setValues(
      rows.map(r => [r.id, r.aktualizovano, r.stav, r.kod, r.teplota]));
  }
  invalidovatCacheEventu_();   // v3.26: POČASÍ se změnilo – ovlivňuje pole pocasi v apiEvents
}

/** PURE: převod hrubého met.no textu (metNoTextFor_) na číselný kód ve
 *  stejné škále jako WMO weathercode z Open-Meteo – aby políčko počasí u
 *  akce mělo JEDNOTNÝ číselný kód bez ohledu na zdroj (frontend mapuje jen
 *  jednou, na weathercode). */
function metNoTextNaKod_(text) {
  const mapa = {
    'jasno': 0, 'skoro jasno': 1, 'polojasno': 2, 'zataženo': 3, 'mlha': 45,
    'mrholení': 51, 'déšť': 61, 'sněžení': 71, 'přeháňky': 80,
    'sněhové přeháňky': 85, 'bouřky': 95, 'proměnlivo': 2,
  };
  return mapa.hasOwnProperty(text) ? mapa[text] : 2;
}

/** PURE: rozhodne výsledný záznam počasí pro JEDNU budoucí akci.
 *  - souradnice chybí (ještě negeokódováno) → NA.
 *  - forecast (Open-Meteo, {time,code,teplota}) obsahuje datum akce → OK.
 *  - forecast je non-null, ale datum akce v něm není → mimo 16denní dosah → NA
 *    (Open-Meteo fungovalo, prostě tak daleko nevidí – to NENÍ chyba).
 *  - forecast je null (Open-Meteo request selhal) → zkusit metNoDenni
 *    (agregovatMetNoDen_ výsledek); když i ten chybí → CHYBA, se zachováním
 *    poslední OK hodnoty ze `stary`, pokud existuje (jinak NA-like prázdno,
 *    ale stav zůstává CHYBA, ať frontend/KONTROLY vidí skutečný výpadek). */
function vyhodnotPocasiUdalosti_(iso, souradnice, forecast, metNoDenni, stary) {
  if (!souradnice) return { stav: 'NA', kod: '', teplota: '' };
  if (forecast) {
    const i = forecast.time.indexOf(iso);
    if (i >= 0) return { stav: 'OK', kod: forecast.code[i], teplota: Math.round(forecast.teplota[i]) };
    return { stav: 'NA', kod: '', teplota: '' };
  }
  if (metNoDenni) {
    return {
      stav: 'OK',
      kod: metNoTextNaKod_(metNoTextFor_(metNoDenni.symbolCode)),
      teplota: Math.round(metNoDenni.maxTeplota),
    };
  }
  if (stary && stary.kod !== '' && stary.kod != null) {
    return { stav: 'CHYBA', kod: stary.kod, teplota: stary.teplota };
  }
  return { stav: 'CHYBA', kod: '', teplota: '' };
}

/** Zavolá Open-Meteo pro dané souřadnice; vrací {time, code, teplota} (paralelní
 *  pole stejná jako v odpovědi API), nebo null při selhání requestu. */
function ziskatOpenMeteoPredpoved_(lat, lng) {
  const d = fetchJson_(
    'https://api.open-meteo.com/v1/forecast?daily=weather_code,temperature_2m_max' +
    '&timezone=Europe%2FPrague&forecast_days=' + POCASI_FORECAST_DAYS +
    '&latitude=' + lat + '&longitude=' + lng);
  if (!d || !d.daily || !d.daily.time) return null;
  return { time: d.daily.time, code: d.daily.weather_code, teplota: d.daily.temperature_2m_max };
}

/** Zaloguje do KONTROL, že se pro část akcí nepodařilo počasí získat ani ze
 *  záložního met.no – stejný vzor jako ostatní API chyby v projektu (viz
 *  runSelfTest / weatherApiDostupne_), ať je to vidět i mimo Apps Script log. */
function logKontrolaPocasi_(ss, pocetChyb) {
  try {
    const sh = ss.getSheetByName(SHEET.KONTROLY);
    if (!sh) return;
    sh.appendRow([
      formatDate_(new Date()), 'aktualizace počasí',
      'Open-Meteo (+ met.no záložně) nedostupné pro ' + pocetChyb + ' akc(i/e)',
      0, 0, 0, 0, 0, 0, 0,
      'Poslední známá hodnota zachována v listu POČASÍ (stav CHYBA).',
      'Apps Script automatizace']);
  } catch (e) { Logger.log('Log do KONTROL (počasí) selhal: ' + e); }
}

/** Hlavní běh: pro VŠECHNY budoucí akce (i mimo 16denní dosah – ty dostanou
 *  NA) přepočítá počasí a přepíše list POČASÍ. Volá se z existujícího
 *  triggeru zpracovatSledovanaMesta (žádný nový trigger). Chyba tady nesmí
 *  shodit zbytek běhu (proto vlastní try/catch, stejně jako u souřadnic). */
function aktualizujPocasi_(ss) {
  try {
    const akceSh = ss.getSheetByName(SHEET.AKCE);
    const lastRow = akceSh ? akceSh.getLastRow() : 1;
    if (lastRow < 2) return;
    const data = akceSh.getRange(2, 1, lastRow - 1, AKCE_COLS).getValues();
    const dnes = new Date(); dnes.setHours(0, 0, 0, 0);
    const dnesText = formatDateOnly_(new Date());
    const souradniceMapa = souradniceMapy_(readSouradnice_(ss));
    const staryMapa = pocasiMapy_(readPocasi_(ss));

    const udalosti = [];
    data.forEach(row => {
      const stav = norm_(row[13]);
      if (stav === 'zrušeno' || stav === 'proběhlo') return;
      const id = String(row[0] || '');
      const od = parseCzDate_(row[1]);
      if (!id || !od || od < dnes) return;
      udalosti.push({
        id,
        iso: Utilities.formatDate(od, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        klic: klicSouradnic_(row[5], row[6]),
      });
    });
    if (!udalosti.length) return;

    const forecastCache = {};   // klic souřadnic → {time,code,teplota} | null
    const metNoCache = {};      // klic souřadnic → parsovaný met.no JSON | false
    let chyby = 0;

    const nove = udalosti.map(u => {
      const souradnice = souradniceMapa.get(u.klic) || null;
      let forecast = null, metNoDenni = null;

      if (souradnice) {
        if (!(u.klic in forecastCache)) forecastCache[u.klic] = ziskatOpenMeteoPredpoved_(souradnice.lat, souradnice.lng);
        forecast = forecastCache[u.klic];

        if (!forecast) {
          if (!(u.klic in metNoCache)) {
            metNoCache[u.klic] = fetchJson_(
              'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + souradnice.lat + '&lon=' + souradnice.lng,
              { 'User-Agent': METNO_USER_AGENT }) || false;
          }
          const metNo = metNoCache[u.klic];
          if (metNo && metNo.properties && metNo.properties.timeseries) {
            metNoDenni = agregovatMetNoDen_(metNo.properties.timeseries, u.iso);
          }
        }
      }

      const stary = staryMapa.get(u.id) || null;
      const vysledek = vyhodnotPocasiUdalosti_(u.iso, souradnice, forecast, metNoDenni, stary);
      if (vysledek.stav === 'CHYBA') chyby++;
      return { id: u.id, aktualizovano: dnesText, stav: vysledek.stav, kod: vysledek.kod, teplota: vysledek.teplota };
    });

    zapsatPocasi_(ss, nove);
    if (chyby) logKontrolaPocasi_(ss, chyby);
  } catch (e) {
    Logger.log('aktualizujPocasi_ selhalo: ' + e);
  }
}

// ---------------------------------------------------------------------------
// SLEDOVANÁ MĚSTA (v3.16) – tiché doplnění dat na pozadí pro města mimo
// domácí profil. Žádná notifikace (potvrzeno) – jen se doplní AKCE/SOUŘADNICE,
// uživatel je uvidí, až si dané město sám vybere v dropdownu.
// ---------------------------------------------------------------------------

const SLEDOVANA_MESTA_HLAVICKA = ['Profil (musí přesně sedět s LOKALITY, sloupec B)'];

function ensureSledovanaMestaSheet_(ss) {
  let sh = ss.getSheetByName(SHEET.SLEDOVANA_MESTA);
  if (!sh) {
    sh = ss.insertSheet(SHEET.SLEDOVANA_MESTA);
    sh.getRange(1, 1, 1, SLEDOVANA_MESTA_HLAVICKA.length).setValues([SLEDOVANA_MESTA_HLAVICKA])
      .setFontWeight('bold').setBackground('#7a3e2e').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Čte seznam sledovaných měst (jen sloupec A, bez hlavičky). */
function readSledovanaMesta_(ss) {
  const sh = ensureSledovanaMestaSheet_(ss);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .map(r => String(r[0] || '').trim())
    .filter(Boolean);
}

/** PURE: cfg pro konkrétní sledované město – kritéria (dojezd, horizont,
 *  kategorie…) beze změny z domácího profilu, jen profil přepsaný. Testovatelné
 *  bez Sheets I/O. */
function cfgProMesto_(zakladniCfg, mesto) {
  const cfg = {};
  Object.keys(zakladniCfg).forEach(k => { cfg[k] = zakladniCfg[k]; });
  cfg.profil = mesto;
  return cfg;
}

/** PURE: text poslední kontroly z LOKALITY → je to dnešek (>= půlnoc dneška)?
 *  Používá se k tomu, aby opakované spuštění zpracovatSledovanaMesta ve
 *  stejný den PŘESKOČILO už hotová města, místo aby začínalo pořád od
 *  začátku seznamu (BUG nalezený 5. 8. 2026 – druhé ruční spuštění zpracovalo
 *  znovu ta samá první 3 města a k dalším se vůbec nedostalo). */
function jeDnesJizZpracovano_(posledniKontrolaText, dnes) {
  const d = parseCzDate_(posledniKontrolaText);
  if (!d) return false;
  const pulnocDnes = new Date(dnes.getFullYear(), dnes.getMonth(), dnes.getDate());
  return d >= pulnocDnes;
}

/** Čte poslední kontrolu všech profilů z LOKALITY (sloupec H) jako Map
 *  normalizovaný-profil → syrový text data (needitovaný, na interpretaci
 *  slouží jeDnesJizZpracovano_). */
function readPosledniKontrolyLokalit_(ss) {
  const sh = ss.getSheetByName(SHEET.LOKALITY);
  const mapa = new Map();
  if (!sh || sh.getLastRow() < 2) return mapa;
  sh.getRange(2, 2, sh.getLastRow() - 1, 7).getValues().forEach(row => {
    const profil = String(row[0] || '').trim();
    if (profil) mapa.set(norm_(profil), cellText_(row[6]));
  });
  return mapa;
}

/** Hlavní běh: projde sledovaná města, pro každé (mimo domácí profil, mimo
 *  ty už dnes zpracované) spustí hledání – stejná kritéria (dojezd/horizont/
 *  kategorie) jako domácí profil, jen jiné město. Časově rozpočtováno
 *  (~4,5 min) jako doplnitSouradniceZpetne; PŘESKAKUJE dnes už hotová města
 *  (viz jeDnesJizZpracovano_), takže opakované ruční spuštění postupně
 *  projde celý seznam, ne pořád jen jeho začátek. Bez notifikace. */
function zpracovatSledovanaMesta() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { Logger.log('zpracovatSledovanaMesta: jiný běh právě probíhá – končím.'); return; }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const krit = ss.getSheetByName(SHEET.KRITERIA);
    const zakladniCfg = readCriteria_(krit);
    const mesta = readSledovanaMesta_(ss);
    const kontroly = readPosledniKontrolyLokalit_(ss);
    const dnes = new Date();
    const t0 = Date.now();
    let zpracovano = 0, preskocenoDnes = 0;
    for (let i = 0; i < mesta.length; i++) {
      if (Date.now() - t0 > 4.5 * 60 * 1000) {
        Logger.log('zpracovatSledovanaMesta: přerušeno kvůli časovému limitu po ' + zpracovano + ' městech (zbývá ' + (mesta.length - i) + ').');
        break;
      }
      const mesto = mesta[i];
      if (norm_(mesto) === norm_(zakladniCfg.profil)) continue;   // domácí profil řeší dailyCheck
      if (jeDnesJizZpracovano_(kontroly.get(norm_(mesto)), dnes)) { preskocenoDnes++; continue; }
      try {
        const cfg = cfgProMesto_(zakladniCfg, mesto);
        const zdroje = readSources_(ss, mesto);
        const events = callAnthropic_(cfg, zdroje, 'sledované město');
        const stats = upsertEvents_(ss, cfg, events);
        zajistitSouradniceProAkce_(ss, events);
        logKontrola_(ss, 'sledované město', cfg, stats, zdroje.length, vyberModelProKontrolu_('sledované město'));
        updateLokalita_(ss, mesto, new Date());
        zpracovano++;
      } catch (e) {
        Logger.log('Sledované město "' + mesto + '" selhalo: ' + e);
      }
    }
    Logger.log('zpracovatSledovanaMesta: hotovo, zpracováno ' + zpracovano + ' z ' + mesta.length
      + ' měst (přeskočeno jako dnes už hotové: ' + preskocenoDnes + ').');

    // v3.22: počasí u akcí se přepočítává PŘI KAŽDÉM běhu tohoto triggeru
    // (neděle 20:00 + čtvrtek 10:00), ne jen jednou při vzniku akce – blíž
    // datu konání je předpověď přesnější. Vlastní try/catch uvnitř, takže
    // selhání sem nespadne.
    aktualizujPocasi_(ss);
  } finally {
    lock.releaseLock();
  }
}


function updateMista() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const cfg = readCriteria_(ss.getSheetByName(SHEET.KRITERIA));
    ensureMistaSheet_(ss);
    const places = callAnthropicPlaces_(cfg);
    const stats = upsertMista_(ss, cfg, places);
    updateLokalita_(ss, cfg.profil, new Date());
    const body = [
      cfg.profil + ' · do ' + cfg.dojezd,
      'Nalezeno míst: ' + places.length + ' | Nová: ' + stats.nove + ' | Aktualizovaná: ' + stats.aktualizovane,
      'Kompletní seznam: ' + ss.getUrl(),
    ].join('\n');
    sendNotification_('Stálá místa aktualizována', body);
    try {
      ss.getSheetByName(SHEET.KONTROLY).appendRow([
        formatDate_(new Date()), 'aktualizace stálých míst',
        cfg.profil + '; do ' + cfg.dojezd, places.length, stats.nove,
        stats.aktualizovane, 0, 0, 0, places.length,
        'Automatický běh přes Anthropic API (' + ANTHROPIC_MODEL + ').',
        'Apps Script automatizace']);
    } catch (e) { Logger.log('Log do KONTROL selhal: ' + e); }
  } catch (err) {
    notifyFail_('Aktualizace stálých míst selhala', err);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

/** Hledání stálých míst přes Anthropic API (tool use, web search). */
function callAnthropicPlaces_(cfg) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Chybí ANTHROPIC_API_KEY ve Script Properties.');

  const system = [
    'Jsi Kulturní radar – asistent, který mapuje STÁLÉ atrakce v ČR.',
    'Výsledky NIKDY nevypisuj jako text – po dokončení hledání je odevzdej',
    'PRÁVĚ JEDNÍM zavoláním nástroje report_places (parametr places).',
    'Formáty: id = slug-nazvu; typ = jedna z: zoo; botanická zahrada; science centrum;',
    'hvězdárna/planetárium; hrad/zámek; jeskyně; skanzen; technická památka; aquapark;',
    'rozhledna; zábavní park; muzeum; jiné. skore = číslo 1–10, rodinná atraktivita: 9–10 = celodenní',
    'výlet hodný cesty odjinud, 6–8 = solidní půldenní výlet, 3–5 = pěkné doplnění programu, 1–2 = drobnost.',
    'stav = "aktivní" / "sezónně zavřeno" / "zavřeno". Piš česky.',
    'Otevírací dobu uváděj AKTUÁLNÍ pro toto roční období a ověřenou na OFICIÁLNÍM webu místa.',
  ].join('\n');

  const userMsg = [
    'Najdi stálé atrakce vhodné pro rodinné výlety v okolí lokality: ' + cfg.profil + '.',
    'Maximální dojezd: ' + cfg.dojezd + ' (1 cesta autem).',
    'Zaměř se na: zoo, botanické zahrady, science centra, hvězdárny/planetária,',
    'významné hrady a zámky, jeskyně, skanzeny, technické památky, aquaparky,',
    'rozhledny a zábavní parky. U každého místa ověř AKTUÁLNÍ otevírací dobu.',
    'Odevzdej max 12 nejzajímavějších míst zavoláním nástroje report_places.',
    'Uváděj pouze KONKRÉTNÍ existující místa; žádné obecné položky.',
  ].join('\n');

  const basePayload = {
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    system: system,
    tools: [
      { type: 'web_search_20250305', name: 'web_search', max_uses: MAX_WEB_SEARCHES },
      REPORT_PLACES_TOOL,
    ],
  };

  const t0 = Date.now();
  let msgs = [{ role: 'user', content: userMsg }];
  let data = null;
  for (let pokus = 0; pokus < 5; pokus++) {
    const resp = UrlFetchApp.fetch(ANTHROPIC_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(Object.assign({}, basePayload, { messages: msgs })),
      muteHttpExceptions: true,
    });
    const code = resp.getResponseCode();
    if (code !== 200) {
      throw new Error('Anthropic API vrátilo ' + code + ': ' + resp.getContentText().slice(0, 500));
    }
    data = JSON.parse(resp.getContentText());

    const toolBlock = (data.content || []).find(b => b.type === 'tool_use' && b.name === 'report_places');
    if (toolBlock && toolBlock.input && Array.isArray(toolBlock.input.places)) {
      Logger.log('Výsledky převzaty z nástroje report_places: ' + toolBlock.input.places.length + ' míst.');
      return toolBlock.input.places;
    }
    if (data.stop_reason === 'pause_turn' && (Date.now() - t0) < 180000) {
      msgs = msgs.concat([{ role: 'assistant', content: data.content }]);
      continue;
    }
    if (data.stop_reason === 'end_turn' && (Date.now() - t0) < 180000) {
      msgs = msgs.concat([
        { role: 'assistant', content: data.content },
        { role: 'user', content: 'Nyní odevzdej nalezená místa PRÁVĚ JEDNÍM zavoláním nástroje report_places.' },
      ]);
      continue;
    }
    break;
  }
  throw new Error('Model neodevzdal stálá místa nástrojem report_places.');
}

/** Upsert stálých míst: klíč ID, jinak název+obec. Vrací statistiky. */
function upsertMista_(ss, cfg, places) {
  const sh = ensureMistaSheet_(ss);
  const stats = { nove: 0, aktualizovane: 0 };
  const lastRow = sh.getLastRow();
  const existing = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, 15).getValues() : [];
  const byId = {}, byKey = {};
  existing.forEach((row, i) => {
    if (norm_(row[14]) !== norm_(cfg.profil)) return;
    if (row[0]) byId[norm_(row[0])] = i;
    byKey[norm_(row[1]) + '|' + norm_(row[3])] = i;
  });

  const today = formatDate_(new Date());
  places.forEach(p => {
    const rowVals = [
      String(p.id || ''), String(p.nazev || ''), String(p.typ || ''), String(p.obec || ''),
      String(p.dojezd || ''), String(p.oteviraci_doba || ''), String(p.sezonni_poznamka || ''),
      String(p.vstupne || ''), String(p.deti || ''), (typeof p.skore === 'number' ? p.skore : ''),
      String(p.stav || 'aktivní'), String(p.url || ''), String(p.poznamka || ''), today, cfg.profil,
    ];
    let idx = byId[norm_(p.id)];
    if (idx === undefined) idx = byKey[norm_(p.nazev) + '|' + norm_(p.obec)];
    if (idx === undefined) {
      const r = sh.getLastRow() + 1;
      sh.getRange(r, 1, 1, 15).setValues([rowVals]);
      const ni = existing.length;
      existing.push(rowVals);
      if (p.id) byId[norm_(p.id)] = ni;
      byKey[norm_(p.nazev) + '|' + norm_(p.obec)] = ni;
      stats.nove++;
    } else {
      sh.getRange(idx + 2, 1, 1, 15).setValues([rowVals]);
      stats.aktualizovane++;
    }
  });
  return stats;
}

// ---------------------------------------------------------------------------
// SAMOTEST + WATCHDOG + DATOVÁ HYGIENA
// ---------------------------------------------------------------------------

/** Najde duplicitní řádky AKCÍ (stejná logika jako úklid, bez mazání). */
function najdiDuplicity_(data) {
  const groups = {};
  const toDelete = [];
  data.forEach((row, i) => {
    if (!norm_(row[4])) return;                       // bez názvu ignorovat
    const gk = norm_(row[24]) + '|' + dateKey_(row[1]);
    const tokens = nazevTokens_(row[4]);
    const g = (groups[gk] = groups[gk] || []);
    const dup = g.find(c => isSameName_(c.tokens, tokens));
    if (dup) {
      toDelete.push({ rowNum: i + 2, nazev: String(row[4]), keptRow: dup.rowNum });
    } else {
      g.push({ rowNum: i + 2, tokens: tokens });
    }
  });
  return toDelete;
}

/** Vycpávkový (obecný) název akce bez vlastního jména – model je má zakázané. */
function jeVycpavka_(nazev) {
  const n = norm_(nazev);
  if (!n) return false;
  return /(kulturní akce|víkendová akce|víkendové akce|víkendový program|vícedenní akce|letní akce)/.test(n);
}

/** Datová hygiena AKCÍ: duplicity (suchý běh), vycpávky, budoucí akce bez URL. */
function auditDat_(ss) {
  const out = { duplicity: [], vycpavky: [], bezUrl: 0 };
  const sh = ss.getSheetByName(SHEET.AKCE);
  if (!sh || sh.getLastRow() < 2) return out;
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, AKCE_COLS).getValues();

  najdiDuplicity_(data).forEach(d => out.duplicity.push(d.nazev));

  const dnes = new Date(); dnes.setHours(0, 0, 0, 0);
  data.forEach(row => {
    const stav = norm_(row[13]);
    if (stav === 'proběhlo' || stav === 'zrušeno') return;
    if (jeVycpavka_(row[4])) out.vycpavky.push(String(row[4]));
    const od = parseCzDate_(row[1]);
    if (od && od >= dnes && !String(row[19] || '').trim()) out.bezUrl++;
  });
  return out;
}

/** Týdenní samotest prostředí + hygiena dat; výsledek jde notifikací. */
function runSelfTest() {
  const problemy = [];
  const varovani = [];   // externí, neblokující nálezy (např. výpadek cizí služby)
  let prosle = 0;
  const ok = () => prosle++;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  [SHEET.KRITERIA, SHEET.LOKALITY, SHEET.AKCE, SHEET.ZDROJE, SHEET.KONTROLY, SHEET.MISTA]
    .forEach(n => { if (ss.getSheetByName(n)) ok(); else problemy.push('chybí list ' + n); });

  let cfg = null;
  try {
    cfg = readCriteria_(ss.getSheetByName(SHEET.KRITERIA));
    if (cfg.profil) ok(); else problemy.push('KRITÉRIA!B2: prázdný profil');
  } catch (e) { problemy.push('KRITÉRIA nečitelná: ' + e); }

  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ANTHROPIC_API_KEY')) ok(); else problemy.push('chybí ANTHROPIC_API_KEY');
  if (props.getProperty('NTFY_TOPIC') || props.getProperty('NOTIFY_EMAIL')) ok();
  else problemy.push('není nastaven žádný notifikační kanál');

  const potrebne = ['onEditInstallable', 'dailyCheck', 'weeklyDigest', 'weekendDigest',
    'updateMista', 'runSelfTest', 'watchdogDailyCheck'];
  const mame = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  potrebne.forEach(f => { if (mame.indexOf(f) >= 0) ok(); else problemy.push('chybí trigger ' + f); });

  try {
    const p = ss.getSheetByName(SHEET.PREHLED);
    if (p) {
      p.getRange('E4:E7').getDisplayValues().forEach((r, i) => {
        if (String(r[0]).charAt(0) === '#') problemy.push('PŘEHLED!E' + (4 + i) + ' = ' + r[0]);
        else ok();
      });
    }
  } catch (e) { problemy.push('kontrola PŘEHLEDU selhala: ' + e); }

  try {
    const w = weatherFor_((cfg && cfg.profil) || 'Brno', new Date(Date.now() + 86400000), {});
    if (w) ok();
    else if (weatherApiDostupne_()) problemy.push('Open-Meteo dostupné, ale předpověď pro profil se nezískala');
    else varovani.push('Open-Meteo nedostupné (externí výpadek) – počasí v digestech dočasně chybí');
  } catch (e) { problemy.push('počasí selhalo: ' + e); }

  const audit = auditDat_(ss);
  const vypis = arr => arr.slice(0, 3).join('; ') + (arr.length > 3 ? ' …' : '');
  if (audit.duplicity.length) problemy.push('duplicity v AKCÍCH (' + audit.duplicity.length + '): ' + vypis(audit.duplicity));
  else ok();
  if (audit.vycpavky.length) problemy.push('vycpávkové názvy (' + audit.vycpavky.length + '): ' + vypis(audit.vycpavky));
  else ok();
  if (audit.bezUrl) problemy.push('budoucí akce bez URL: ' + audit.bezUrl);

  try {
    const oznaceni = readOznaceni_(ss);
    if (oznaceni.length) {
      const akceSheet = ss.getSheetByName(SHEET.AKCE);
      const platnaId = new Set(
        akceSheet && akceSheet.getLastRow() > 1
          ? akceSheet.getRange(2, 1, akceSheet.getLastRow() - 1, 1).getValues().map(r => String(r[0] || ''))
          : []);
      const sirotci = sirotciOznaceni_(oznaceni, platnaId);
      if (sirotci.length) {
        problemy.push('OZNAČENÍ obsahuje ' + sirotci.length + ' záznamů k neexistujícím akcím: '
          + vypis(sirotci.map(s => s.id)));
      } else ok();

      const platniUzivatele = new Set(readUzivatele_(ss).map(u => u.id));
      const sirotciUzivatele = oznaceni.filter(r => r.uzivatel && !platniUzivatele.has(r.uzivatel));
      if (sirotciUzivatele.length) {
        problemy.push('OZNAČENÍ obsahuje ' + sirotciUzivatele.length + ' záznamů k neexistujícímu uživatelskému profilu: '
          + vypis(sirotciUzivatele.map(s => s.id + '/' + s.uzivatel)));
      } else ok();
    }
  } catch (e) { problemy.push('kontrola OZNAČENÍ selhala: ' + e); }

  const title = problemy.length
    ? 'Samotest: ' + problemy.length + ' ' + sklonuj_(problemy.length, 'problém', 'problémy', 'problémů')
    : (varovani.length ? 'Samotest: OK (' + varovani.length + ' varování)' : 'Samotest: OK');
  let body = problemy.length
    ? 'Nalezené problémy:\n' + problemy.map(p => '• ' + p).join('\n')
    : 'Všech ' + prosle + ' kontrol prošlo. Systém je zdravý.';
  if (varovani.length) {
    body += '\n\nVarování (externí, neblokující):\n' + varovani.map(p => '• ' + p).join('\n');
  }
  sendNotification_(title, body);
}

/** Denní hlídač (~20:00): ohlásí, pokud dnes neproběhla denní kontrola. */
function watchdogDailyCheck() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET.KONTROLY);
    if (!sh || sh.getLastRow() < 2) return;
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    const dnes = dateKey_(new Date());
    const probehla = data.some(r => dateKey_(r[0]) === dnes && norm_(r[1]).indexOf('denní') === 0);
    if (!probehla) {
      sendNotification_('Watchdog: denní kontrola dnes neproběhla',
        'V KONTROLÁCH chybí dnešní záznam denní kontroly.\n' +
        'Zkontroluj Spuštění v Apps Scriptu (tiché selhání nebo nevystřelený trigger).\n' +
        'Kompletní přehled: ' + ss.getUrl());
    }
  } catch (e) { Logger.log('Watchdog selhal: ' + e); }
}

// ---------------------------------------------------------------------------
// PŘEHLEDY (týdenní / víkendový) S POČASÍM
// ---------------------------------------------------------------------------

/** Pondělní přehled: akce z databáze na nejbližších 7 dní. */
function weeklyDigest() {
  try {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 6 * 24 * 3600 * 1000);
    digestRange_('Týdenní přehled', from, to);
  } catch (err) {
    notifyFail_('Týdenní přehled selhal', err);
    throw err;
  }
}

/** Čtvrteční tipy: akce nadcházejícího víkendu (pátek–neděle). Volitelný
 *  druhý příjemce jen pro tenhle digest (Script Property NOTIFY_EMAIL_VIKEND,
 *  žádný vliv na ostatní notifikace). */
function weekendDigest() {
  try {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const toFri = ((5 - now.getDay()) + 7) % 7;   // dní do nejbližšího pátku
    const from = new Date(now.getTime() + toFri * 24 * 3600 * 1000);
    const to = new Date(from.getTime() + 2 * 24 * 3600 * 1000);
    const extraEmail = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL_VIKEND');
    digestRange_('Víkendové tipy', from, to, extraEmail);
  } catch (err) {
    notifyFail_('Víkendové tipy selhaly', err);
    throw err;
  }
}

/** Sestaví a odešle přehled akcí aktivního profilu v daném okně, s počasím.
 *  v3.6: staví datový model bloků a renderuje ho dvakrát – prostý text
 *  (ntfy, záloha) a HTML s předsazenými odrážkami (e-mail, mobil). */
function digestRange_(title, from, to, extraEmail) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const profil = String(ss.getSheetByName(SHEET.KRITERIA).getRange(KRIT.PROFIL).getDisplayValue()).trim();
  const evs = readEventsInRange_(ss, profil, from, to);

  const hlavicka = profil + ' \u00b7 ' + formatDateOnly_(from) + '\u2013' + formatDateOnly_(to);
  const bloky = [];
  if (evs.length === 0) {
    bloky.push({ nadpis: 'Na toto období nejsou v databázi žádné akce.', polozky: [] });
  } else {
    const cache = {};
    const skupiny = {};
    evs.forEach(ev => {
      const k = ev.kat || 'ostatní';
      (skupiny[k] = skupiny[k] || []).push(ev);
    });
    Object.keys(skupiny).sort((a, b) => a.localeCompare(b, 'cs')).forEach(k => {
      const blok = { nadpis: k.charAt(0).toUpperCase() + k.slice(1), polozky: [] };
      skupiny[k].forEach(ev => {
        const detaily = [];
        if (ev.probihaOd) detaily.push('probíhá od ' + formatDateOnly_(ev.probihaOd));
        if (ev.cas) detaily.push('čas: ' + ev.cas);
        const w = weatherFor_(ev.obec, ev.den, cache);
        if (w) detaily.push('počasí (' + (ev.obec || profil) + '): ' + w);
        blok.polozky.push({ titulek: formatDateOnly_(ev.den) + ' \u2014 ' + ev.nazev, detaily });
      });
      bloky.push(blok);
    });
  }
  // Stálá místa – top 5 dle skóre, seskupená podle typu, počasí na sobotu v okně
  const mista = readMista_(ss, profil);
  if (mista.length) {
    let denPocasi = from;
    for (let d = new Date(from.getTime()); d <= to; d = new Date(d.getTime() + 86400000)) {
      if (d.getDay() === 6) { denPocasi = d; break; }
    }
    const cacheM = {};
    bloky.push({ nadpis: 'Stálá místa (' + formatDateOnly_(denPocasi) + ')', polozky: [] });
    const dleTypu = {};
    mista.slice(0, 5).forEach(m => {
      const t = m.typ || 'ostatní';
      (dleTypu[t] = dleTypu[t] || []).push(m);
    });
    Object.keys(dleTypu).sort((a, b) => a.localeCompare(b, 'cs')).forEach(t => {
      const blok = { nadpis: '\u00b7 ' + t.charAt(0).toUpperCase() + t.slice(1), polozky: [] };
      dleTypu[t].forEach(m => {
        const detaily = [];
        if (m.doba) detaily.push('otevřeno: ' + m.doba);
        const w = weatherFor_(m.obec, denPocasi, cacheM);
        if (w) detaily.push('počasí (' + m.obec + '): ' + w);
        blok.polozky.push({ titulek: m.nazev, detaily });
      });
      bloky.push(blok);
    });
  }
  sendNotification_(title,
    renderDigestText_(hlavicka, bloky, ss.getUrl()),
    renderDigestHtml_(hlavicka, bloky, ss.getUrl()),
    extraEmail);
}

/** Prostý text digestu (ntfy + záloha pro e-mailové klienty bez HTML). */
function renderDigestText_(hlavicka, bloky, url) {
  const lines = [hlavicka];
  bloky.forEach(b => {
    lines.push('');
    lines.push(b.nadpis + (b.polozky.length ? ':' : ''));
    b.polozky.forEach(p => {
      let line = '\u2022 ' + p.titulek;
      p.detaily.forEach(d => { line += '\n   ' + d; });
      lines.push(line);
    });
  });
  lines.push('');
  lines.push('Kompletní přehled: ' + url);
  return lines.join('\n');
}

/** HTML digestu – odrážky s předsazením, detaily menším písmem pod titulkem. */
function renderDigestHtml_(hlavicka, bloky, url) {
  let h = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a2e">';
  h += '<p style="margin:0 0 10px 0"><strong>' + esc_(hlavicka) + '</strong></p>';
  bloky.forEach(b => {
    h += '<p style="margin:12px 0 4px 0"><strong>' + esc_(b.nadpis) + '</strong></p>';
    if (b.polozky.length) {
      h += '<ul style="margin:0;padding-left:20px">';
      b.polozky.forEach(p => {
        h += '<li style="margin:0 0 6px 0">' + esc_(p.titulek);
        p.detaily.forEach(d => {
          h += '<br><span style="color:#4a4a6a;font-size:13px">' + esc_(d) + '</span>';
        });
        h += '</li>';
      });
      h += '</ul>';
    }
  });
  h += '<p style="margin:14px 0 0 0"><a href="' + esc_(url) + '">Kompletní přehled v tabulce</a></p>';
  h += '</div>';
  return h;
}

/** Escapování textu do HTML. */
function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Načte aktivní stálá místa profilu, seřazená podle skóre sestupně. */
function readMista_(ss, profil) {
  const sh = ss.getSheetByName(SHEET.MISTA);
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 15).getValues();
  const out = [];
  data.forEach(row => {
    if (norm_(row[14]) !== norm_(profil)) return;
    if (norm_(row[10]).indexOf('aktiv') !== 0) return;
    out.push({
      nazev: String(row[1] || '').trim(),
      typ: String(row[2] || '').split(';')[0].trim(),
      obec: String(row[3] || '').trim(),
      doba: String(row[5] || '').trim(),
      skore: Number(row[9]) || 0,
    });
  });
  out.sort((a, b) => b.skore - a.skore);
  return out;
}

/** Načte akce profilu zasahující do okna, seřazené podle dne v okně. */
function readEventsInRange_(ss, profil, from, to) {
  const sh = ss.getSheetByName(SHEET.AKCE);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const data = sh.getRange(2, 1, lastRow - 1, AKCE_COLS).getValues();

  const out = [];
  data.forEach(row => {
    if (norm_(row[24]) !== norm_(profil)) return;
    const stav = norm_(row[13]);
    if (stav === 'zrušeno' || stav === 'proběhlo') return;
    const od = parseCzDate_(row[1]);
    if (!od) return;
    const doD = parseCzDate_(row[2]) || od;
    if (doD < from || od > to) return;
    out.push({
      nazev: String(row[4] || '').trim(),
      den: od < from ? from : od,                 // pro vícedenní akce první den v okně
      probihaOd: od < from ? od : null,
      cas: cellText_(row[3]),
      obec: String(row[6] || '').trim(),
      kat: String(row[8] || '').split(';')[0].trim(),
    });
  });
  out.sort((a, b) => a.den - b.den);
  return out;
}

/** GET s jedním opakováním po pauze (přechodné výpadky); parsovaný JSON, nebo null. */
function fetchJson_(url, headers) {
  const volby = { muteHttpExceptions: true };
  if (headers) volby.headers = headers;
  for (let pokus = 0; pokus < 2; pokus++) {
    try {
      const r = UrlFetchApp.fetch(url, volby);
      if (r.getResponseCode() === 200) return JSON.parse(r.getContentText());
    } catch (e) { /* síťová chyba – zkusit ještě jednou */ }
    if (pokus === 0) Utilities.sleep(1500);
  }
  return null;
}

/** Sonda dostupnosti Open-Meteo (fixní souřadnice Brna) – rozliší v samotestu
 *  externí výpadek (varování) od chyby na naší straně (problém). */
function weatherApiDostupne_() {
  const d = fetchJson_(
    'https://api.open-meteo.com/v1/forecast?daily=weather_code&timezone=Europe%2FPrague' +
    '&forecast_days=1&latitude=49.19&longitude=16.61');
  return !!(d && d.daily && d.daily.time && d.daily.time.length);
}

/** met.no vyžaduje identifikační User-Agent (jinak blokuje) – oficiální zásada MET Norway. */
const METNO_USER_AGENT = 'KulturniRadar/' + VERZE + ' (+https://github.com/Akimto01/Kulturni_radar)';

/** Předpověď pro obec a den; primárně Open-Meteo, při výpadku/chybějícím dni
 *  záložně met.no (v3.10). '' při neúspěchu obou zdrojů. */
function weatherFor_(obec, den, cache) {
  try {
    if (!obec) return '';
    const key = norm_(obec);
    if (!(key in cache)) {
      const gd = fetchJson_(
        'https://geocoding-api.open-meteo.com/v1/search?count=1&language=cs&name=' + encodeURIComponent(obec));
      if (!gd || !gd.results || !gd.results.length) { cache[key] = null; return ''; }
      const loc = gd.results[0];
      const fd = fetchJson_(
        'https://api.open-meteo.com/v1/forecast?daily=weather_code,temperature_2m_max,precipitation_probability_max' +
        '&timezone=Europe%2FPrague&forecast_days=16&latitude=' + loc.latitude + '&longitude=' + loc.longitude);
      cache[key] = { lat: loc.latitude, lon: loc.longitude, openMeteo: fd ? fd.daily : null, metNo: null };
    }
    const zaznam = cache[key];
    if (!zaznam) return '';
    const iso = Utilities.formatDate(den, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // 1) primární zdroj: Open-Meteo
    const d = zaznam.openMeteo;
    if (d && d.time) {
      const i = d.time.indexOf(iso);
      if (i >= 0) {
        let w = weatherText_(d.weather_code[i]) + ', max ' + Math.round(d.temperature_2m_max[i]) + ' °C';
        if (d.precipitation_probability_max && d.precipitation_probability_max[i] != null) {
          w += ', srážky ' + d.precipitation_probability_max[i] + ' %';
        }
        return w;
      }
    }

    // 2) záložní zdroj: met.no – jen když Open-Meteo pro tento den nic nemá.
    //    Fetch proběhne nejvýš jednou na obec (cache), sentinel `false` = "zkusili jsme, nevyšlo".
    if (zaznam.metNo === null) {
      zaznam.metNo = fetchJson_(
        'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + zaznam.lat + '&lon=' + zaznam.lon,
        { 'User-Agent': METNO_USER_AGENT }) || false;
    }
    if (zaznam.metNo && zaznam.metNo.properties && zaznam.metNo.properties.timeseries) {
      const denMetNo = agregovatMetNoDen_(zaznam.metNo.properties.timeseries, iso);
      if (denMetNo) return metNoTextFor_(denMetNo.symbolCode) + ', max ' + Math.round(denMetNo.maxTeplota) + ' °C';
    }
    return '';
  } catch (e) {
    return '';
  }
}

/** PURE: z met.no timeseries vybere záznamy pro daný den (YYYY-MM-DD) a vrátí
 *  { maxTeplota, symbolCode } – teplota jako maximum, symbol z okamžiku
 *  nejblíž poledni (nejreprezentativnější pro celý den). null, když pro
 *  daný den nejsou žádné záznamy. */
function agregovatMetNoDen_(timeseries, isoDatum) {
  const zaznamyDne = timeseries.filter(t => String(t.time || '').slice(0, 10) === isoDatum);
  if (!zaznamyDne.length) return null;
  let maxTeplota = null;
  let symbolCode = null;
  let nejblizeKPoledni = Infinity;
  zaznamyDne.forEach(t => {
    const teplota = t.data && t.data.instant && t.data.instant.details
      ? t.data.instant.details.air_temperature : null;
    if (teplota != null && (maxTeplota === null || teplota > maxTeplota)) maxTeplota = teplota;
    const hodina = Number(String(t.time).slice(11, 13));
    const vzdalenost = Math.abs(hodina - 12);
    const shrnuti = (t.data && t.data.next_1_hours && t.data.next_1_hours.summary)
      || (t.data && t.data.next_6_hours && t.data.next_6_hours.summary);
    if (shrnuti && shrnuti.symbol_code && vzdalenost < nejblizeKPoledni) {
      nejblizeKPoledni = vzdalenost;
      symbolCode = shrnuti.symbol_code;
    }
  });
  if (maxTeplota === null) return null;
  return { maxTeplota, symbolCode };
}

/** Převod met.no symbol_code (např. 'partlycloudy_day') na český popis – hrubší
 *  než weatherText_ (ten čte přesný číselný WMO kód z Open-Meteo). */
function metNoTextFor_(symbolCode) {
  const s = String(symbolCode || '');
  if (!s) return 'proměnlivo';
  // substring, ne jen prefix – met.no má i složené kódy jako
  // 'heavyrainandthunder', kde 'thunder' není na začátku řetězce.
  if (s.indexOf('thunder') !== -1) return 'bouřky';
  if (s.indexOf('sleet') !== -1) return 'přeháňky';
  if (s.indexOf('snow') !== -1) return 'sněžení';
  if (s.indexOf('rain') !== -1) return 'déšť';
  if (s.indexOf('fog') !== -1) return 'mlha';
  if (s.indexOf('partlycloudy') !== -1) return 'polojasno';   // před 'cloudy' – je jeho podřetězcem
  if (s.indexOf('cloudy') !== -1) return 'zataženo';
  if (s.indexOf('fair') !== -1) return 'skoro jasno';
  if (s.indexOf('clearsky') !== -1) return 'jasno';
  return 'proměnlivo';
}

/** Převod WMO kódu počasí na český popis. */
function weatherText_(code) {
  if (code === 0) return 'jasno';
  if (code <= 2) return 'polojasno';
  if (code === 3) return 'zataženo';
  if (code === 45 || code === 48) return 'mlha';
  if (code <= 57) return 'mrholení';
  if (code <= 67) return 'déšť';
  if (code <= 77) return 'sněžení';
  if (code <= 82) return 'přeháňky';
  if (code <= 86) return 'sněhové přeháňky';
  return 'bouřky';
}

// ---------------------------------------------------------------------------
// KONTROLY + NOTIFIKACE
// ---------------------------------------------------------------------------

/** Zapíše čas kontroly profilu do LOKALITY (sloupec H) a případně posune stav mapy (G). */
function updateLokalita_(ss, profil, when) {
  try {
    const sh = ss.getSheetByName(SHEET.LOKALITY);
    if (!sh) return;
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    const profily = sh.getRange(1, 2, lastRow, 1).getValues();   // sloupec B
    for (let i = 0; i < profily.length; i++) {
      if (norm_(profily[i][0]) === norm_(profil)) {
        const row = i + 1;
        sh.getRange(row, 8).setValue(formatDate_(when));         // H: Poslední kontrola profilu
        const stav = norm_(sh.getRange(row, 7).getValue());      // G: Stav zdrojové mapy
        if (stav.indexOf('čeká') === 0) {
          sh.getRange(row, 7).setValue('základ naplněn');
        }
        return;
      }
    }
  } catch (e) { Logger.log('Aktualizace LOKALIT selhala: ' + e); }
}

function logKontrola_(ss, typ, cfg, stats, pocetZdroju, model) {
  const sh = ss.getSheetByName(SHEET.KONTROLY);

  // zajistit sloupec "Vykonavatel" (L)
  if (norm_(sh.getRange(1, 12).getValue()) !== 'vykonavatel') {
    sh.getRange(1, 12).setValue('Vykonavatel');
  }

  sh.appendRow([
    formatDate_(new Date()),
    typ,
    cfg.profil + '; ' + cfg.rozsah + '; do ' + cfg.dojezd + '; ' + cfg.horizont,
    stats.total,
    stats.nove,
    stats.zmenene,
    stats.zrusene,
    0,
    stats.bezZmeny,
    pocetZdroju,
    'Automatický běh přes Anthropic API (' + (model || ANTHROPIC_MODEL) + ').',
    'Apps Script automatizace',
  ]);
}

/** emailTipyStats: volitelné {celkem, ok, chyba, nelzeOverit} ze
 *  zpracovatEmailTipy_ (viz runCheck_) – jen dailyCheck ho posílá, jiné typy
 *  běhů sekci v reportu vůbec nemají. */
function notifyOk_(typ, cfg, stats, when, emailTipyStats) {
  const title = (typ.indexOf('mimořádná') === 0 ? 'Mimořádná kontrola dokončena' :
                 typ.indexOf('denní') === 0 ? 'Denní kontrola dokončena' :
                 'Kontrola dokončena');
  const seznam = arr => {
    const vybrane = arr.slice()
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
      .slice(0, 20);
    const map = {};
    vybrane.forEach(x => { const k = x.kat || 'ostatní'; (map[k] = map[k] || []).push(x); });
    const out = [];
    Object.keys(map).sort((a, b) => a.localeCompare(b, 'cs')).forEach(k => {
      out.push(k.charAt(0).toUpperCase() + k.slice(1));
      map[k].forEach(x => out.push('• ' + x.t));
    });
    if (arr.length > 20) out.push('… a dalších ' + (arr.length - 20));
    return out.join('\n');
  };
  const lines = [
    cfg.profil + ' · ' + cfg.rozsah + ' · do ' + cfg.dojezd,
    'Dokončeno: ' + formatDate_(when),
  ];
  if (stats.nove) lines.push('Nové (' + stats.nove + '):\n' + seznam(stats.noveNazvy));
  if (stats.zmenene) lines.push('Změněné (' + stats.zmenene + '):\n' + seznam(stats.zmeneneNazvy));
  if (stats.zrusene) lines.push('Zrušené (' + stats.zrusene + '):\n' + seznam(stats.zruseneNazvy));
  if (!stats.nove && !stats.zmenene && !stats.zrusene) lines.push('Žádné novinky.');
  if (stats.bezZmeny) lines.push('Beze změny (' + stats.bezZmeny + '):\n' + seznam(stats.bezZmenyNazvy));
  else lines.push('Beze změny: 0');
  if (emailTipyStats) {
    lines.push('E-mailové tipy: ' + emailTipyStats.celkem + ' přišlo' + (emailTipyStats.celkem
      ? ' (' + emailTipyStats.ok + ' zpracováno, ' + emailTipyStats.nelzeOverit + ' nešlo ověřit, ' + emailTipyStats.chyba + ' chyba)'
      : ''));
  }
  try {
    lines.push('Kompletní přehled: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
  } catch (e) { /* odkaz je jen bonus */ }
  sendNotification_(title, lines.join('\n'));
}

function notifyFail_(title, err) {
  sendNotification_(title, 'Chyba: ' + (err && err.message ? err.message : err));
}

/** PURE: spojí základního příjemce (NOTIFY_EMAIL) s volitelným extra
 *  příjemcem (jen pro konkrétní digest) do jednoho řetězce pro MailApp –
 *  ta bere adresy oddělené čárkou (ověřeno v dokumentaci). Prázdné/chybějící
 *  hodnoty se vynechají, duplicity se nezdvojí. */
function spojitPrijemce_(zakladni, extra) {
  const adresy = [zakladni, extra]
    .map(a => String(a || '').trim())
    .filter(Boolean);
  return [...new Set(adresy)].join(',');
}

function sendNotification_(title, body, htmlBody, extraEmail) {
  const props = PropertiesService.getScriptProperties();
  const topic = props.getProperty('NTFY_TOPIC');
  const email = spojitPrijemce_(props.getProperty('NOTIFY_EMAIL'), extraEmail);

  if (topic) {
    // ntfy.sh omezuje HTTP publikování podle IP odesílatele a sdílené IP Google
    // serverů mají kvótu trvale vyčerpanou (429). E-mailová brána ntfy-<topic>@ntfy.sh
    // jde přes Gmail infrastrukturu a limitům nepodléhá. Předmět = titulek, tělo = zpráva.
    // POZOR: těla delší než ~4 kB brána mění na přílohu .txt → dlouhé zprávy zkrátit.
    try {
      let ntfyBody = body;
      const LIMIT = 3500;  // bajtů (UTF-8), s rezervou pod 4kB limitem brány
      if (Utilities.newBlob(ntfyBody, 'text/plain').getBytes().length > LIMIT) {
        const radky = body.split('\n');
        const ponechane = [];
        let velikost = 0;
        for (let i = 0; i < radky.length; i++) {
          const b = Utilities.newBlob(radky[i] + '\n', 'text/plain').getBytes().length;
          if (velikost + b > LIMIT) break;
          ponechane.push(radky[i]);
          velikost += b;
        }
        ponechane.push('… zkráceno; kompletní verze je v e-mailu a v tabulce.');
        ntfyBody = ponechane.join('\n');
      }
      MailApp.sendEmail('ntfy-' + topic + '@ntfy.sh', title, ntfyBody);
      Logger.log('ntfy: odesláno přes e-mailovou bránu.');
    } catch (e) { Logger.log('ntfy e-mailová brána selhala: ' + e); }
  }
  if (email) {
    try {
      if (htmlBody) {
        MailApp.sendEmail(email, '[Kulturní radar] ' + title, body, { htmlBody: htmlBody });
      } else {
        MailApp.sendEmail(email, '[Kulturní radar] ' + title, body);
      }
    } catch (e) { Logger.log('e-mail selhal: ' + e); }
  }
  Logger.log(title + '\n' + body);
}

// ---------------------------------------------------------------------------
// POMOCNÉ FUNKCE
// ---------------------------------------------------------------------------

function norm_(v) {
  return String(v == null ? '' : v).trim().toLowerCase();
}

function dedupKey_(profil, datumOd, nazev, misto) {
  return [norm_(profil), dateKey_(datumOd), normNazev_(nazev), normNazev_(misto)].join('|');
}

/** Datum (Date objekt i český text) → klíč "yyyy-mm-dd"; jinak normalizovaný text. */
function dateKey_(v) {
  const d = parseCzDate_(v);
  if (!d) return norm_(v);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Normalizace názvu: malá písmena, bez diakritiky, číslic a interpunkce. */
function normNazev_(v) {
  return norm_(v)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Množina významových tokenů názvu (slova o 3+ znacích). */
function nazevTokens_(v) {
  const out = {};
  normNazev_(v).split(' ').forEach(w => { if (w.length >= 3) out[w] = true; });
  return out;
}

/** Dva názvy = tatáž akce, pokud je menší množina podmnožinou větší, nebo mají 3+ společných slov. */
function isSameName_(tokA, tokB) {
  const a = Object.keys(tokA), b = Object.keys(tokB);
  if (!a.length || !b.length) return false;
  const inter = a.filter(w => tokB[w]).length;
  return inter >= 2 && (inter === Math.min(a.length, b.length) || inter >= 3);
}

function parseCzDate_(v) {
  if (v instanceof Date) return v;
  const m = String(v || '').match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function formatDate_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'd. M. yyyy H:mm');
}

/** Jako cellText_, ale u Date s nenulovým časem zachová i čas (pro „poslední
 *  kontrola" – Sheets řetězec s časem autokonvertuje na Date a čas by se ztratil). */
function cellTextCas_(v) {
  if (v instanceof Date && (v.getHours() || v.getMinutes() || v.getSeconds())) {
    return formatDate_(v);
  }
  return cellText_(v);
}

/** České skloňování počítaných výrazů: sklonuj_(n, 'problém', 'problémy', 'problémů'). */
function sklonuj_(n, jeden, dvaAzCtyri, petAVic) {
  if (n === 1) return jeden;
  if (n >= 2 && n <= 4) return dvaAzCtyri;
  return petAVic;
}

function formatDateOnly_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'd. M. yyyy');
}
