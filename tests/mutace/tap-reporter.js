/**
 * Minimální TAP reporter pro Stryker (tap-runner čte TAP ze standardního výstupu).
 * Vestavěný reporter `--test-reporter=tap` spadne s „RangeError: Invalid time value“, když
 * selhaná aserce obsahuje neplatný Date (mutant vrátí Invalid Date), proces skončí dřív, než
 * hook zapíše výsledek, a Stryker mutant vyhodnotí jako RuntimeError místo Killed.
 * Tenhle reporter vypisuje jen „ok/not ok“ pro testy nejvyšší úrovně, bez serializace hodnot.
 */
module.exports = async function* (source) {
  let n = 0;
  yield 'TAP version 13\n';
  for await (const udalost of source) {
    if ((udalost.type === 'test:pass' || udalost.type === 'test:fail') && udalost.data.nesting === 0) {
      yield (udalost.type === 'test:pass' ? 'ok ' : 'not ok ') + (++n) + ' - ' + String(udalost.data.name).replace(/[\r\n#]+/g, ' ') + '\n';
    }
  }
  yield '1..' + n + '\n';
};
