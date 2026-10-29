/**
 * Mutační testování backendu (StrykerJS, issue #13). Jen čte repo a píše do .stryker-src/,
 * .stryker-tmp/ a tests/mutace/reports/ (vše v .gitignore). Spouští se z kořene repa, závislosti
 * jsou v tests/mutace/ (vlastní package.json, aby kořen repa žádný neměl: Cloudflare Pages by ho
 * při git push mohl instalovat). Instalace: `cd tests/mutace && npm ci`.
 *
 *   node tests/mutace/spustit.js --funkce serioveCisloNaDatum_,jeTestovaciProfil_
 *   node tests/mutace/spustit.js --rozsah 273-277
 *   node tests/mutace/spustit.js --kriticke     (10 kritických funkcí z POKRYTI.md, ~3 min)
 *   node tests/mutace/spustit.js --vse          (celý backend, ~40 min)
 *   další argumenty se předají Strykeru (např. --concurrency 2)
 *
 * Proč kopie: Stryker nezná příponu .gs. Skript zkopíruje apps-script/kulturni_radar.gs
 * (bajt po bajtu, takže čísla řádků sedí) do .stryker-src/kulturni_radar.js, nastaví
 * RADAR_ZDROJ, podle které tests/harness.js načte instrumentovanou kopii místo originálu,
 * a spustí Stryker s tap-runnerem nad tests/unit.test.js.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const koren = path.join(__dirname, '..', '..');
const zdroj = path.join(koren, 'apps-script', 'kulturni_radar.gs');
const kopieRel = '.stryker-src/kulturni_radar.js';
// kritické funkce podle Docs/testovani/POKRYTI.md (metrika „mutační skóre kritických funkcí“)
const KRITICKE = ['runCheck_', 'upsertEvents_', 'parseCzDate_', 'apiToggle_', 'apiSetFiltry_', 'spustKontroluCore_',
  'apiNajdiProUzivatele_', 'digestRange_', 'weekendDigest', 'smiZacitDalsiMesto_'];

/** Rozsah řádků funkce nejvyšší úrovně: od `function nazev(` po první řádek, který je jen `}`. */
function rozsahFunkce(radky, nazev) {
  const zacatek = radky.findIndex(r => new RegExp('^(async\\s+)?function\\s+' + nazev + '\\s*\\(').test(r));
  if (zacatek < 0) throw new Error('Funkce ' + nazev + ' nenalezena v kulturni_radar.gs');
  const konec = radky.findIndex((r, i) => i > zacatek && r.replace(/\r$/, '') === '}');
  if (konec < 0) throw new Error('Konec funkce ' + nazev + ' nenalezen');
  return (zacatek + 1) + '-' + (konec + 1);
}

function main(argv) {
  const text = fs.readFileSync(zdroj, 'utf8');
  const radky = text.split('\n');
  const mutate = [];
  const predat = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--funkce') {
      for (const f of argv[++i].split(',')) mutate.push(kopieRel + ':' + rozsahFunkce(radky, f.trim()));
    } else if (argv[i] === '--rozsah') {
      mutate.push(kopieRel + ':' + argv[++i]);
    } else if (argv[i] === '--kriticke') {
      for (const f of KRITICKE) mutate.push(kopieRel + ':' + rozsahFunkce(radky, f));
    } else if (argv[i] === '--vse') {
      mutate.push(kopieRel);
    } else {
      predat.push(argv[i]);
    }
  }
  if (!mutate.length) throw new Error('Zadej --funkce, --rozsah, --kriticke nebo --vse');

  const cil = path.join(koren, kopieRel);
  fs.mkdirSync(path.dirname(cil), { recursive: true });
  fs.copyFileSync(zdroj, cil);

  const nm = path.join(__dirname, 'node_modules', '@stryker-mutator');
  const stryker = path.join(nm, 'core', 'bin', 'stryker.js');
  if (!fs.existsSync(stryker)) throw new Error('Stryker není nainstalovaný: cd tests/mutace && npm ci');
  // plugin se hledá od pracovní složky (kořen repa), proto absolutní cesta do tests/mutace/node_modules
  const plugin = path.join(nm, 'tap-runner', 'dist', 'src', 'index.js');
  const r = spawnSync(process.execPath, [stryker, 'run', 'tests/mutace/stryker.config.json',
    '--plugins', plugin, '--mutate', mutate.join(','), ...predat], {
    cwd: koren, stdio: 'inherit', env: { ...process.env, RADAR_ZDROJ: kopieRel, RADAR_LOCALE: 'en-US', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
  });
  return r.status === null ? 1 : r.status;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
