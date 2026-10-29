/**
 * Harness: načte apps-script/kulturni_radar.gs do Node.js sandboxu
 * se stubovanými Google API, aby šly čisté funkce testovat bez Googlu.
 *
 * Zásada: služby, které jednotkové testy nemají potřebovat (UrlFetchApp,
 * ScriptApp, LockService…), vyhazují výjimku – kdyby se jich testovaný
 * kód dotkl, test spadne nahlas, ne potichu.
 *
 * Volitelné volby (výchozí chování beze změny, služba je zakázaná, dokud si ji
 * test nevyžádá; #35):
 *  - ss:        SpreadsheetApp.getActiveSpreadsheet() vrátí předaný fakeSpreadsheet
 *  - zamek:     true/false – LockService.getScriptLock().tryLock vrátí tuto hodnotu;
 *               volání a uvolnění v ctx.__zamek ({ tryLock: [ms…], uvolneno: N })
 *  - triggery:  pole existujících triggerů (ScriptApp.getProjectTriggers); smazané a
 *               založené triggery v ctx.__triggery ({ smazane: [], vytvorene: [] })
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

/** Stub ScriptApp pro volby.triggery: builder newTrigger(...) zaznamenává každý
 *  vytvořený trigger jako { funkce, typ, udalost, den, hodina, denVMesici,
 *  kazdychDni, zaMs (after), tabulka }. */
function stubScriptApp(existujici, zaznam) {
  return {
    WeekDay: { MONDAY: 'MONDAY', TUESDAY: 'TUESDAY', WEDNESDAY: 'WEDNESDAY', THURSDAY: 'THURSDAY',
               FRIDAY: 'FRIDAY', SATURDAY: 'SATURDAY', SUNDAY: 'SUNDAY' },
    getProjectTriggers: () => existujici.slice(),
    deleteTrigger: (t) => { zaznam.smazane.push(t); },
    newTrigger: (funkce) => {
      const z = { funkce, typ: null, udalost: null, den: null, hodina: null,
                  denVMesici: null, kazdychDni: null, zaMs: null, tabulka: null };
      const b = {
        forSpreadsheet: (ss) => { z.typ = 'tabulka'; z.tabulka = ss; return b; },
        onEdit: () => { z.udalost = 'onEdit'; return b; },
        timeBased: () => { z.typ = 'cas'; return b; },
        after: (ms) => { z.zaMs = ms; return b; },
        atHour: (h) => { z.hodina = h; return b; },
        everyDays: (n) => { z.kazdychDni = n; return b; },
        onWeekDay: (d) => { z.den = d; return b; },
        onMonthDay: (n) => { z.denVMesici = n; return b; },
        create: () => { zaznam.vytvorene.push(z); return z; },
      };
      return b;
    },
  };
}

function formatujDatum(d, vzor) {
  const dd = d.getDate(), mm = d.getMonth() + 1, yyyy = d.getFullYear();
  const H = d.getHours(), M = d.getMinutes();
  const pad = n => String(n).padStart(2, '0');
  switch (vzor) {
    case 'yyyy-MM-dd': return `${yyyy}-${pad(mm)}-${pad(dd)}`;
    case 'd. M. yyyy': return `${dd}. ${mm}. ${yyyy}`;
    case 'd. M. yyyy H:mm': return `${dd}. ${mm}. ${yyyy} ${H}:${pad(M)}`;
    case 'H:mm': return `${H}:${pad(M)}`;
    default: throw new Error('Nepodporovaný vzor data ve stubu: ' + vzor);
  }
}

function zakazano(nazev) {
  return new Proxy({}, {
    get() { throw new Error(`Jednotkový test se dotkl služby ${nazev} – to nemá dělat.`); },
  });
}

/** Vytvoří čerstvý kontext se skriptem; volby umožní nastavit properties. */
function nactiRadar(volby = {}) {
  const props = Object.assign({}, volby.properties || {});
  const odeslane = [];   // zachycené MailApp.sendEmail volání
  const ctxSleepMs = []; // zachycené Utilities.sleep (retry pauzy)
  const cacheStore = {}; // v3.26: in-memory stub CacheService.getScriptCache()
  const triggeryZaznam = { smazane: [], vytvorene: [] };   // volby.triggery
  const zamekZaznam = { tryLock: [], uvolneno: 0 };        // volby.zamek
  const cacheSelze = !!volby.cacheThrows;   // simulace výpadku CacheService (fail-open testy)

  const ctx = {
    console,
    Logger: { log: () => {} },
    Session: { getScriptTimeZone: () => 'Europe/Prague' },
    Utilities: {
      formatDate: (d, tz, vzor) => formatujDatum(d, vzor),
      newBlob: (s) => ({ getBytes: () => Buffer.from(String(s), 'utf8') }),
      sleep: (ms) => { ctxSleepMs.push(ms); },   // testy nečekají, jen evidují
      // v3.20: hashování PINů. Vrací pole SIGNED bajtů (-128..127) stejně jako
      // skutečný Apps Script computeDigest – hashPin_ v .gs proto dělá (b & 0xFF).
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (alg, vstup) => {
        if (alg !== 'SHA_256') throw new Error('Stub computeDigest umí jen SHA_256, dostal: ' + alg);
        const hash = require('node:crypto').createHash('sha256').update(String(vstup), 'utf8').digest();
        return Array.from(hash, b => (b > 127 ? b - 256 : b));  // unsigned → signed jako v Apps Scriptu
      },
      // v3.20: sůl pro nastavPin_ (v testech deterministická náhoda není potřeba)
      getUuid: () => require('node:crypto').randomUUID(),
    },
    PropertiesService: {
      // v3.45: deleteProperty/getKeys (limit pokusů na PIN) + volby.propertiesThrows
      // simuluje výpadek úložiště (fail-open testy). Hodnoty se ukládají jako
      // řetězce, stejně jako ve skutečném Apps Scriptu.
      getScriptProperties: () => {
        if (volby.propertiesThrows) throw new Error('PropertiesService nedostupný (test)');
        return {
          getProperty: (k) => (k in props ? props[k] : null),
          setProperty: (k, v) => { props[k] = String(v); },
          deleteProperty: (k) => { delete props[k]; },
          getKeys: () => Object.keys(props),
        };
      },
    },
    MailApp: {
      sendEmail: (komu, predmet, telo, options) => { odeslane.push({ komu, predmet, telo, options }); },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => volby.ss || ({ getUrl: () => 'https://sheet.example/test' }),
    },
    // v3.26: stub CacheService – vždy přítomný (jako MailApp/PropertiesService),
    // ať existující testy funkcí, co teď cache i invalidují, nemusí nic navíc
    // nastavovat. volby.cacheThrows: true simuluje výpadek (fail-open testy).
    CacheService: {
      getScriptCache: () => ({
        get: (k) => {
          if (cacheSelze) throw new Error('CacheService nedostupný (test)');
          return (k in cacheStore) ? cacheStore[k] : null;
        },
        put: (k, v) => {
          if (cacheSelze) throw new Error('CacheService nedostupný (test)');
          cacheStore[k] = String(v);
        },
        remove: (k) => {
          if (cacheSelze) throw new Error('CacheService nedostupný (test)');
          delete cacheStore[k];
        },
        removeAll: (keys) => {
          if (cacheSelze) throw new Error('CacheService nedostupný (test)');
          (keys || []).forEach(k => delete cacheStore[k]);
        },
      }),
    },
    UrlFetchApp: volby.urlFetch ? { fetch: volby.urlFetch } : zakazano('UrlFetchApp'),
    ScriptApp: volby.triggery ? stubScriptApp(volby.triggery, triggeryZaznam) : zakazano('ScriptApp'),
    LockService: typeof volby.zamek === 'boolean' ? {
      getScriptLock: () => ({
        tryLock: (ms) => { zamekZaznam.tryLock.push(ms); return volby.zamek; },
        releaseLock: () => { zamekZaznam.uvolneno++; },
      }),
    } : zakazano('LockService'),
  };

  // Mutační testování (Stryker, issue #13): Stryker nezná příponu .gs, mutuje se proto kopie .js
  // a harness ji načte místo originálu, když je nastavená RADAR_ZDROJ (cesta od kořene repa).
  const cestaKGs = process.env.RADAR_ZDROJ
    ? path.join(__dirname, '..', process.env.RADAR_ZDROJ)
    : path.join(__dirname, '..', 'apps-script', 'kulturni_radar.gs');
  const kod = fs.readFileSync(cestaKGs, 'utf8');
  vm.createContext(ctx);
  // Instrumentovaný kód hledá jmenný prostor Strykeru (aktivní mutant, měření pokrytí) v globálním
  // objektu SVÉHO kontextu, tedy ve vm sandboxu, kde ho nikdo nenastavil a kam nevidí ani process.env.
  // Sdílíme proto objekt, který v testovacím procesu založil hook tap-runneru, a aktivního mutanta
  // do něj zapíšeme z proměnné prostředí (mimo vm to za Stryker dělá sám instrumentovaný kód).
  const strykerNs = global[process.env.STRYKER_NAMESPACE || '__stryker__'];
  if (strykerNs) {
    if (strykerNs.activeMutant === undefined && process.env.__STRYKER_ACTIVE_MUTANT__) {
      strykerNs.activeMutant = process.env.__STRYKER_ACTIVE_MUTANT__;
    }
    ctx[process.env.STRYKER_NAMESPACE || '__stryker__'] = strykerNs;
  }
  // filename jako file:// URL, ať node --experimental-test-coverage přiřadí
  // pokrytí ke zdrojovému souboru (holé jméno se v reportu neukáže).
  vm.runInContext(kod, ctx, { filename: pathToFileURL(cestaKGs).href });

  ctx.__odeslaneEmaily = odeslane;
  ctx.__sleepMs = ctxSleepMs;
  ctx.__cacheStore = cacheStore;
  ctx.__triggery = triggeryZaznam;
  ctx.__zamek = zamekZaznam;
  ctx.__props = props;   // v3.45: přímý pohled do Script Properties (stav zámku PINu)
  // Konstruktor Date ze sandboxu – `instanceof Date` napříč realmy nefunguje,
  // takže testy musí Date vytvářet uvnitř stejného realmu jako skript.
  ctx.__Date = vm.runInContext('Date', ctx);
  return ctx;
}

module.exports = { nactiRadar };
