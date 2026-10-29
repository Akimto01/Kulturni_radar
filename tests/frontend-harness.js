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
  const cestaKHtml = path.join(__dirname, '..', 'apps-script', 'Index.html');
  const html = fs.readFileSync(cestaKHtml, 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  if (!scriptMatch) throw new Error('V Index.html nebyl nalezen <script> blok.');
  const js = scriptMatch[1];
  // Pozice <script> bloku v souboru (pro předponu, viz níže).
  const posunScriptu = scriptMatch.index + scriptMatch[0].indexOf(js);

  const ctx = { console, URLSearchParams };
  vm.createContext(ctx);

  nazvyFunkci.forEach(nazev => {
    let zacatekDeklarace = js.search(new RegExp('function\\s+' + nazev + '\\s*\\('));
    if (zacatekDeklarace < 0) throw new Error('Funkce "' + nazev + '" nebyla v Index.html nalezena.');
    // v3.61: u `async function` vzít i klíčové slovo async, jinak by tělo
    // s `await` nešlo spustit (SyntaxError).
    if (js.slice(Math.max(0, zacatekDeklarace - 6), zacatekDeklarace) === 'async ') zacatekDeklarace -= 6;
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
    // Předpona ze mezer a původních zalomení řádků má stejnou délku a stejné
    // řádky jako text před funkcí v Index.html, takže offsety V8 sedí na
    // skutečný soubor a coverage přiřadí pokrytí správným řádkům i sloupcům.
    const predpona = html.slice(0, posunScriptu + zacatekDeklarace).replace(/[^\r\n]/g, ' ');
    // filename zůstává „Index.html#název“, ne file:// URL: tabulka z
    // node --experimental-test-coverage nesloučí víc skriptů téhož souboru a
    // řádek Index.html by ukázal nesmyslné procento. Skutečné pokrytí počítá
    // tests/pokryti-frontendu.js ze syrových dat V8.
    vm.runInContext(predpona + telo, ctx, { filename: 'Index.html#' + nazev });
  });

  return ctx;
}

module.exports = { nactiFrontendFunkce };
