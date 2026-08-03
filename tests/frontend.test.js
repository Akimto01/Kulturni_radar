/**
 * Jednotkové testy čisté JS logiky frontendu (Index.html), spuštěné mimo
 * prohlížeč přes frontend-harness.js. Doplňuje RF testy (které pokrývají DOM
 * a interakci), ne nahrazuje je – tady testujeme jen výpočty bez DOM/serveru.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { nactiFrontendFunkce } = require('./frontend-harness');

const f = nactiFrontendFunkce([
  'parseCeskeDatum', 'dateKeyBezpecne_', 'pad2_', 'gcalUrl_',
  'filtrovatNavstivenaPodleObdobi_',
]);

// ---------------------------------------------------------------------------
// parseCeskeDatum / dateKeyBezpecne_
// ---------------------------------------------------------------------------

test('parseCeskeDatum: běžný formát i s mezerami kolem teček', () => {
  const d = f.parseCeskeDatum('3. 8. 2026');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 7);
  assert.equal(d.getDate(), 3);
});

test('parseCeskeDatum: nevalidní vstup (sériové číslo, prázdno, „Probíhá…“) → null', () => {
  assert.equal(f.parseCeskeDatum('46156'), null);
  assert.equal(f.parseCeskeDatum(''), null);
  assert.equal(f.parseCeskeDatum('Probíhá / dlouhodobé'), null);
  assert.equal(f.parseCeskeDatum(undefined), null);
});

test('dateKeyBezpecne_: neparsovatelné datum jde na konec řazení (MAX_SAFE_INTEGER)', () => {
  const a = f.dateKeyBezpecne_('3. 8. 2026');
  const b = f.dateKeyBezpecne_('neplatne');
  assert.ok(a < b);
  assert.equal(b, Number.MAX_SAFE_INTEGER);
});

// ---------------------------------------------------------------------------
// gcalUrl_ – odkaz „Do kalendáře“
// ---------------------------------------------------------------------------

test('gcalUrl_: jednodenní akce – exkluzivní konec o den později, diakritika escapovaná', () => {
  const url = f.gcalUrl_({ nazev: 'Balkan Night', datumOd: '7. 8. 2026', datumDo: '', misto: 'Špilberk', popis: '', url: '' });
  assert.ok(url.includes('dates=20260807%2F20260808'));
  assert.ok(url.includes('location=%C5%A0pilberk'));
});

test('gcalUrl_: vícedenní akce – konec je datumDo + 1 den', () => {
  const url = f.gcalUrl_({ nazev: 'Festival', datumOd: '3. 8. 2026', datumDo: '9. 8. 2026' });
  assert.ok(url.includes('dates=20260803%2F20260810'));
});

test('gcalUrl_: nevalidní/chybějící datumOd → null (žádný odkaz)', () => {
  assert.equal(f.gcalUrl_({ nazev: 'X', datumOd: '' }), null);
  assert.equal(f.gcalUrl_({ nazev: 'X', datumOd: 'Probíhá / dlouhodobé' }), null);
});

test('gcalUrl_: popis i URL akce jdou do details, oddělené novým řádkem', () => {
  const url = f.gcalUrl_({ nazev: 'X', datumOd: '1. 1. 2026', popis: 'Skvělé', url: 'https://example.com' });
  const params = new URLSearchParams(url.split('?')[1]);
  assert.equal(params.get('details'), 'Skvělé\nhttps://example.com');
});

// ---------------------------------------------------------------------------
// filtrovatNavstivenaPodleObdobi_ – retrospektiva „✓ Navštívené“
// (tvůj původní požadavek z večera – dřív netestováno vůbec)
// ---------------------------------------------------------------------------

const TED = new Date(2026, 7, 3);   // „dnes“ pro účely testu, injektované

function akce(navstivenoDne) { return { navstivenoDne }; }

test('filtrovatNavstivenaPodleObdobi_: nenavštívené akce (bez data) se vynechají vždy', () => {
  const vysledek = f.filtrovatNavstivenaPodleObdobi_(
    [akce(''), { /* navstivenoDne chybí úplně */ }], 'vse', TED);
  assert.equal(vysledek.length, 0);
});

test('filtrovatNavstivenaPodleObdobi_: „vse“ nefiltruje podle data vůbec', () => {
  const vysledek = f.filtrovatNavstivenaPodleObdobi_(
    [akce('1. 1. 2020'), akce('3. 8. 2026')], 'vse', TED);
  assert.equal(vysledek.length, 2);
});

test('filtrovatNavstivenaPodleObdobi_: přesně na hranici (30 dní) se ještě počítá (>=)', () => {
  const presnaHranice = new Date(TED.getTime() - 30 * 86400000);
  const den = presnaHranice.getDate() + '. ' + (presnaHranice.getMonth() + 1) + '. ' + presnaHranice.getFullYear();
  const vysledek = f.filtrovatNavstivenaPodleObdobi_([akce(den)], '30', TED);
  assert.equal(vysledek.length, 1, 'návštěva přesně 30 dní zpět patří do "posledního měsíce"');
});

test('filtrovatNavstivenaPodleObdobi_: den za hranicí (31 dní) se do 30denního okna nevejde', () => {
  const zaHranici = new Date(TED.getTime() - 31 * 86400000);
  const den = zaHranici.getDate() + '. ' + (zaHranici.getMonth() + 1) + '. ' + zaHranici.getFullYear();
  const vysledek = f.filtrovatNavstivenaPodleObdobi_([akce(den)], '30', TED);
  assert.equal(vysledek.length, 0);
});

test('filtrovatNavstivenaPodleObdobi_: „dnes“ (0 dní) patří do každého období', () => {
  const dnesText = TED.getDate() + '. ' + (TED.getMonth() + 1) + '. ' + TED.getFullYear();
  ['30', '90', '180', '365', 'vse'].forEach(obdobi => {
    const vysledek = f.filtrovatNavstivenaPodleObdobi_([akce(dnesText)], obdobi, TED);
    assert.equal(vysledek.length, 1, 'období ' + obdobi + ' by mělo zahrnout dnešní návštěvu');
  });
});

test('filtrovatNavstivenaPodleObdobi_: 90 vs 365 dní – různá okna vrátí různý počet', () => {
  const pred100dny = new Date(TED.getTime() - 100 * 86400000);
  const den = pred100dny.getDate() + '. ' + (pred100dny.getMonth() + 1) + '. ' + pred100dny.getFullYear();
  const v90 = f.filtrovatNavstivenaPodleObdobi_([akce(den)], '90', TED);
  const v365 = f.filtrovatNavstivenaPodleObdobi_([akce(den)], '365', TED);
  assert.equal(v90.length, 0, '100 dní staré nepatří do 90denního okna');
  assert.equal(v365.length, 1, '100 dní staré patří do ročního okna');
});

test('filtrovatNavstivenaPodleObdobi_: řadí od nejnovější návštěvy', () => {
  const vysledek = f.filtrovatNavstivenaPodleObdobi_(
    [akce('1. 8. 2026'), akce('3. 8. 2026'), akce('2. 8. 2026')], 'vse', TED);
  assert.deepEqual(vysledek.map(a => a.navstivenoDne), ['3. 8. 2026', '2. 8. 2026', '1. 8. 2026']);
});
