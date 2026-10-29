/**
 * Pokrytí řádků frontendu (Index.html) jednotkovými testy.
 *
 * Tabulka z `node --test --experimental-test-coverage` je pro Index.html
 * zavádějící: každá vykrojená funkce se spouští s „předponou“ z mezer (kvůli
 * správným číslům řádků), takže se předpona počítá jako pokrytá a výsledné
 * procento je nadsazené. Tenhle skript proto vezme syrová data V8
 * (NODE_V8_COVERAGE) a počítá jen řádky uvnitř vykrojených funkcí.
 *
 * Spuštění (z kořene repa): node tests/pokryti-frontendu.js
 *
 * Výstup: pokrytí vůči vykrojeným funkcím a vůči celému <script> bloku.
 * Řádek se bere jako spustitelný, pokud po odříznutí komentáře něco obsahuje;
 * je pokrytý, pokud první znak kódu na řádku má počet spuštění > 0.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const koren = path.join(__dirname, '..');
const cestaKHtml = path.join(koren, 'apps-script', 'Index.html');
const html = fs.readFileSync(cestaKHtml, 'utf8');

const adresar = fs.mkdtempSync(path.join(os.tmpdir(), 'v8cov-'));
const beh = spawnSync(process.execPath, ['--test', path.join(koren, 'tests', 'frontend.test.js')],
  { env: { ...process.env, NODE_V8_COVERAGE: adresar }, encoding: 'utf8' });
if (beh.status !== 0) { console.error(beh.stdout + beh.stderr); process.exit(1); }

// Offsety začátků řádků a první znak kódu na řádku (po odříznutí komentáře).
const radky = html.split('\n');
const zacatekRadku = [];
let pozice = 0;
radky.forEach(r => { zacatekRadku.push(pozice); pozice += r.length + 1; });
function prvniKod(i) {
  const r = radky[i].replace(/\r$/, '');
  const m = r.match(/\S/);
  if (!m) return -1;
  const t = r.slice(m.index);
  if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return -1;
  return zacatekRadku[i] + m.index;
}
function radekOdOffsetu(off) {
  let lo = 0, hi = zacatekRadku.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (zacatekRadku[mid] <= off) lo = mid; else hi = mid - 1; }
  return lo;
}

const scriptStart = html.indexOf('<script>') + '<script>'.length;
const scriptKonec = html.indexOf('</script>', scriptStart);
const radekScriptOd = radekOdOffsetu(scriptStart);
const radekScriptDo = radekOdOffsetu(scriptKonec);

// Pro každou vykrojenou funkci: rozsah a (sjednocené přes všechny skripty) pokryté řádky.
const funkce = new Map();   // název -> { od, do, pokryte:Set }
for (const soubor of fs.readdirSync(adresar)) {
  const data = JSON.parse(fs.readFileSync(path.join(adresar, soubor), 'utf8'));
  for (const skript of data.result.filter(s => s.url.startsWith('Index.html#'))) {
    const nazvana = skript.functions.filter(f => f.functionName && f.ranges[0].startOffset > 0);
    // vykrojená funkce = nejširší pojmenovaná funkce skriptu (obal s názvem '' se přeskočí)
    const hlavni = nazvana.reduce((a, b) => (b.ranges[0].endOffset - b.ranges[0].startOffset >
      a.ranges[0].endOffset - a.ranges[0].startOffset ? b : a));
    const od = hlavni.ranges[0].startOffset, doo = hlavni.ranges[0].endOffset;
    const rozsahy = skript.functions.filter(f => f.ranges[0].startOffset > 0 || f === hlavni)
      .flatMap(f => f.ranges).filter(r => r.startOffset >= od && r.endOffset <= doo)
      .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
    const zaznam = funkce.get(hlavni.functionName) || { od, do: doo, pokryte: new Set() };
    for (let i = radekOdOffsetu(od); i <= radekOdOffsetu(doo); i++) {
      const k = prvniKod(i);
      if (k < od || k >= doo) continue;
      let pocet = 0;
      for (const r of rozsahy) if (r.startOffset <= k && k < r.endOffset) pocet = r.count;
      if (pocet > 0) zaznam.pokryte.add(i);
    }
    funkce.set(hlavni.functionName, zaznam);
  }
}

let spustitelneFunkce = 0, pokrytoFunkce = 0;
const nepokryte = {};
for (const [nazev, z] of funkce) {
  const r0 = radekOdOffsetu(z.od), r1 = radekOdOffsetu(z.do);
  const vse = [];
  for (let i = r0; i <= r1; i++) { const k = prvniKod(i); if (k >= z.od && k < z.do) vse.push(i); }
  spustitelneFunkce += vse.length;
  pokrytoFunkce += vse.filter(i => z.pokryte.has(i)).length;
  nepokryte[nazev] = vse.filter(i => !z.pokryte.has(i)).map(i => i + 1);   // čísla řádků v Index.html od 1
}
let spustitelneScript = 0;
for (let i = radekScriptOd; i <= radekScriptDo; i++) if (prvniKod(i) >= scriptStart) spustitelneScript++;

const pct = (a, b) => (100 * a / b).toFixed(1).replace('.', ',') + ' %';
console.log(`Vykrojených funkcí: ${funkce.size}`);
console.log(`Pokrytí vůči vykrojeným funkcím: ${pct(pokrytoFunkce, spustitelneFunkce)} (${pokrytoFunkce} z ${spustitelneFunkce} řádků)`);
console.log(`Pokrytí vůči celému <script> bloku: ${pct(pokrytoFunkce, spustitelneScript)} (${pokrytoFunkce} z ${spustitelneScript} řádků)`);
if (process.argv.includes('--nepokryte')) {
  for (const [n, r] of Object.entries(nepokryte)) if (r.length) console.log(`${n}: ${r.join(',')}`);
}
fs.rmSync(adresar, { recursive: true, force: true });
