/**
 * Harness: načte apps-script/kulturni_radar.gs do Node.js sandboxu
 * se stubovanými Google API, aby šly čisté funkce testovat bez Googlu.
 *
 * Zásada: služby, které jednotkové testy nemají potřebovat (UrlFetchApp,
 * ScriptApp, LockService…), vyhazují výjimku – kdyby se jich testovaný
 * kód dotkl, test spadne nahlas, ne potichu.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = v; },
      }),
    },
    MailApp: {
      sendEmail: (komu, predmet, telo, options) => { odeslane.push({ komu, predmet, telo, options }); },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getUrl: () => 'https://sheet.example/test' }),
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
    ScriptApp: zakazano('ScriptApp'),
    LockService: zakazano('LockService'),
  };

  const kod = fs.readFileSync(
    path.join(__dirname, '..', 'apps-script', 'kulturni_radar.gs'), 'utf8');
  vm.createContext(ctx);
  vm.runInContext(kod, ctx, { filename: 'kulturni_radar.gs' });

  ctx.__odeslaneEmaily = odeslane;
  ctx.__sleepMs = ctxSleepMs;
  ctx.__cacheStore = cacheStore;
  // Konstruktor Date ze sandboxu – `instanceof Date` napříč realmy nefunguje,
  // takže testy musí Date vytvářet uvnitř stejného realmu jako skript.
  ctx.__Date = vm.runInContext('Date', ctx);
  return ctx;
}

module.exports = { nactiRadar };
