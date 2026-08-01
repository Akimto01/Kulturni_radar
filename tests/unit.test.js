/**
 * Regresní jednotkové testy Kulturního radaru.
 * Spuštění:  node --test tests/
 *
 * Fixtures vycházejí ze SKUTEČNÝCH poruch zachycených při nočním ladění
 * 31. 7. – 1. 8. 2026 (viz Docs/CHANGELOG.md) – každý opravený bug tu má
 * svůj test, aby se nevrátil.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { nactiRadar } = require('./harness');

const r = nactiRadar();

// ---------------------------------------------------------------------------
// parseEvents_ – záložní textový parser (primární cesta je tool use)
// ---------------------------------------------------------------------------

const UDALOST = (id, extra = '') =>
  `{"id":"${id}","datum_od":"3. 8. 2026","nazev":"Akce ${id}","misto":"Brno"${extra}}`;

test('parseEvents_: čisté pole projde', () => {
  const ev = r.parseEvents_(`[${UDALOST('a')},${UDALOST('b')}]`);
  assert.equal(ev.length, 2);
});

test('parseEvents_: markdown ohrada ```json se odstraní', () => {
  const ev = r.parseEvents_('```json\n[' + UDALOST('a') + ']\n```');
  assert.equal(ev.length, 1);
});

test('parseEvents_: prázdné pole → []', () => {
  const ev = r.parseEvents_('[]');
  assert.ok(Array.isArray(ev));
  assert.equal(ev.length, 0);
});

test('BUG v1.7: useknutá odpověď → záchrana kompletních záznamů', () => {
  const text = 'Na základě dat sestavuji pole:\n```json\n[' +
    UDALOST('a') + ',' + UDALOST('b') + ',{"id":"c","datum_od":"5. 8';
  const ev = r.parseEvents_(text);
  assert.equal(ev.length, 2, 'zachrání právě 2 kompletní záznamy');
});

test('BUG v1.9→2.0: samotný komentář bez pole → null (spustí další vrstvu)', () => {
  assert.equal(r.parseEvents_('Štetl Fest začíná 26. 8. – mimo rozsah.'), null);
});

test('BUG v1.8: restartované pole při pause_turn → parsuje se to POSLEDNÍ', () => {
  const text = '[' + UDALOST('stare') + ',{"id":"utrz\n' +
    'Pokračuji znovu:\n[' + UDALOST('a') + ',' + UDALOST('b') + ']';
  const ev = r.parseEvents_(text);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].id, 'a');
});

test('BUG v1.9: skutečný konec řádku uvnitř řetězce → sanitizace', () => {
  const text = '[{"id":"x","datum_od":"3. 8. 2026","nazev":"Prague\nPride","misto":"Praha"}]';
  const ev = r.parseEvents_(text);
  assert.equal(ev.length, 1);
  assert.match(ev[0].nazev, /Prague Pride/);
});

test('parseEvents_: čárka navíc před ] neshodí parsování', () => {
  const ev = r.parseEvents_('[' + UDALOST('a') + ',]');
  assert.equal(ev.length, 1);
});

// ---------------------------------------------------------------------------
// Deduplikace – fuzzy shoda názvů (reálné dvojice z nočních běhů)
// ---------------------------------------------------------------------------

const shoda = (a, b) => r.isSameName_(r.nazevTokens_(a), r.nazevTokens_(b));

test('BUG v1.2: Hradozámecká noc – dvě pojmenování téže akce → shoda', () => {
  assert.equal(shoda(
    'Hradozámecká noc – hrad Veveří 2026',
    'Hradozámecká noc 2026 – Veveří (NPÚ)'), true);
});

test('BUG v1.2: fragmenty Festivalu planet → shoda (3+ společná slova)', () => {
  assert.equal(shoda(
    'Festival planet Brno 2026 – srpnový běh (Gigalón – Jupiter)',
    'Festival planet Brno 2026 – zahájení srpnového běhu'), true);
});

test('deduplikace: podmnožina názvu → shoda (ŠTETL FEST)', () => {
  assert.equal(shoda('ŠTETL FEST 2026 – Návraty', 'ŠTETL FEST 2026'), true);
});

test('deduplikace: různé akce se NEslepí', () => {
  assert.equal(shoda('Pop Messe 2026', 'Maraton hudby Brno 2026'), false);
});

// ---------------------------------------------------------------------------
// Datumy
// ---------------------------------------------------------------------------

test('dateKey_: český zápis i Date dávají stejný klíč', () => {
  assert.equal(r.dateKey_('3. 8. 2026'), '2026-08-03');
  // Date je nutné vytvořit v realmu skriptu (viz poznámka v harness.js)
  assert.equal(r.dateKey_(new r.__Date(2026, 7, 3)), '2026-08-03');
});

test('parseCzDate_: neplatný vstup → null', () => {
  assert.equal(r.parseCzDate_('různé (dle programu)'), null);
});

// ---------------------------------------------------------------------------
// Počasí – převod WMO kódů
// ---------------------------------------------------------------------------

test('weatherText_: reprezentativní kódy', () => {
  assert.equal(r.weatherText_(0), 'jasno');
  assert.equal(r.weatherText_(3), 'zataženo');
  assert.equal(r.weatherText_(63), 'déšť');
  assert.equal(r.weatherText_(81), 'přeháňky');
  assert.equal(r.weatherText_(95), 'bouřky');
});

// ---------------------------------------------------------------------------
// Notifikace – zkracování pro ntfy (BUG v2.6) a seskupení (v2.8)
// ---------------------------------------------------------------------------

test('BUG v2.6: dlouhé tělo se pro ntfy zkrátí, e-mail dostane plnou verzi', () => {
  const ctx = nactiRadar({ properties: {
    NTFY_TOPIC: 'testovaci-kanal', NOTIFY_EMAIL: 'test@example.com' } });
  const dlouhe = Array.from({ length: 300 }, (_, i) => `• Řádek číslo ${i} s diakritikou ěščřž`).join('\n');
  ctx.sendNotification_('Titulek', dlouhe);

  const maily = ctx.__odeslaneEmaily;
  assert.equal(maily.length, 2);
  const ntfy = maily.find(m => m.komu === 'ntfy-testovaci-kanal@ntfy.sh');
  const email = maily.find(m => m.komu === 'test@example.com');

  assert.ok(Buffer.byteLength(ntfy.telo, 'utf8') < 3700, 'ntfy pod limitem brány');
  assert.match(ntfy.telo, /zkráceno/, 'ntfy obsahuje dovětek o zkrácení');
  assert.equal(email.telo, dlouhe, 'e-mail nese plnou verzi');
  assert.match(email.predmet, /^\[Kulturní radar\] /);
});

test('sendNotification_: krátké tělo jde do ntfy beze změny', () => {
  const ctx = nactiRadar({ properties: { NTFY_TOPIC: 'k' } });
  ctx.sendNotification_('T', 'Krátká zpráva.');
  assert.equal(ctx.__odeslaneEmaily[0].telo, 'Krátká zpráva.');
});

test('v2.8: notifyOk_ seskupuje podle kategorií (česky abecedně) + odkaz', () => {
  const ctx = nactiRadar({ properties: { NOTIFY_EMAIL: 'test@example.com' } });
  const stats = {
    total: 3, nove: 2, zmenene: 0, zrusene: 0, bezZmeny: 1,
    noveNazvy: [
      { d: '2026-08-08', kat: 'koncerty', t: 'Balkan Night (8. 8. 2026)' },
      { d: '2026-08-07', kat: 'festivaly', t: 'Pop Messe (7. 8. 2026)' },
    ],
    zmeneneNazvy: [], zruseneNazvy: [],
    bezZmenyNazvy: [{ d: '2026-08-07', kat: 'výstavy', t: 'Mucha (7. 8. 2026)' }],
  };
  ctx.notifyOk_('mimořádná kontrola',
    { profil: 'Brno', rozsah: '7. 8.–9. 8. 2026', dojezd: '90 min', horizont: '2 týdny' },
    stats, new Date(2026, 7, 1, 21, 30));

  const telo = ctx.__odeslaneEmaily[0].telo;
  assert.match(telo, /Nové \(2\):/);
  assert.ok(telo.indexOf('Festivaly') < telo.indexOf('Koncerty'), 'kategorie česky abecedně');
  assert.ok(telo.indexOf('Festivaly') < telo.indexOf('• Pop Messe'), 'položka pod svým nadpisem');
  assert.match(telo, /Beze změny \(1\):/);
  assert.match(telo, /Kompletní přehled: https:\/\/sheet\.example\/test/);
});

// ---------------------------------------------------------------------------
// v2.9: detektor vycpávkových názvů (datová hygiena)
// ---------------------------------------------------------------------------

test('jeVycpavka_: obecné souhrny z nočního běhu Ostravy → true', () => {
  assert.equal(r.jeVycpavka_('Letní kulturní akce Ostrava – 11. srpna'), true);
  assert.equal(r.jeVycpavka_('Festivalová víkendová akce Ostrava 14.–15. srpna'), true);
  assert.equal(r.jeVycpavka_('Letní vícedenní akce Ostrava 17.–21. srpna'), true);
});

test('jeVycpavka_: skutečné akce → false', () => {
  assert.equal(r.jeVycpavka_('Pop Messe 2026'), false);
  assert.equal(r.jeVycpavka_('Letní kino pod hvězdami – Poslední viking'), false);
  assert.equal(r.jeVycpavka_('Hradozámecká noc – hrad Veveří 2026'), false);
  assert.equal(r.jeVycpavka_(''), false);
});
