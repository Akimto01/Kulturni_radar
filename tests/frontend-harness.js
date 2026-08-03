/**
 * Harness: vytáhne pojmenované funkce z <script> bloku Index.html a spustí
 * je v izolovaném vm kontextu – bez DOM, bez init(). Stejná technika jako
 * harness.js pro backend (.gs), jen zdroj je tentokrát Index.html.
 *
 * Konec funkce se hledá počítáním { } (ne pevným regexem), aby to fungovalo
 * i pro funkce s vnořenými bloky.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function nactiFrontendFunkce(nazvyFunkci) {
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'apps-script', 'Index.html'), 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  if (!scriptMatch) throw new Error('V Index.html nebyl nalezen <script> blok.');
  const js = scriptMatch[1];

  const ctx = { console, URLSearchParams };
  vm.createContext(ctx);

  nazvyFunkci.forEach(nazev => {
    const zacatekDeklarace = js.search(new RegExp('function\\s+' + nazev + '\\s*\\('));
    if (zacatekDeklarace < 0) throw new Error('Funkce "' + nazev + '" nebyla v Index.html nalezena.');
    const prvniSlozena = js.indexOf('{', zacatekDeklarace);
    if (prvniSlozena < 0) throw new Error('Funkce "' + nazev + '": nenalezena otevírací závorka.');

    let hloubka = 0, konec = -1;
    for (let i = prvniSlozena; i < js.length; i++) {
      if (js[i] === '{') hloubka++;
      else if (js[i] === '}') {
        hloubka--;
        if (hloubka === 0) { konec = i; break; }
      }
    }
    if (konec < 0) throw new Error('Funkce "' + nazev + '": nenalezen konec těla (nevyvážené závorky?).');

    const telo = js.slice(zacatekDeklarace, konec + 1);
    vm.runInContext(telo, ctx, { filename: 'Index.html#' + nazev });
  });

  return ctx;
}

module.exports = { nactiFrontendFunkce };
