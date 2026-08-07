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
  'filtrovatNavstivenaPodleObdobi_', 'sestavTextSdileni_', 'mapsUrl_',
  'sestavFiltry_', 'pinVypadaPlatne_',
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

// ---------------------------------------------------------------------------
// sestavTextSdileni_ – text pro sdílení akce (WhatsApp/SMS/e-mail)
// ---------------------------------------------------------------------------

test('sestavTextSdileni_: kompletní akce – název, datum+místo, odkaz na třech řádcích', () => {
  const text = f.sestavTextSdileni_({
    nazev: 'Balkan Night', datumOd: '7. 8. 2026', misto: 'Špilberk', url: 'https://example.com',
  });
  assert.equal(text, 'Balkan Night\n7. 8. 2026 · Špilberk\nhttps://example.com');
});

test('sestavTextSdileni_: chybějící misto – druhý řádek jen datum, bez osamocené odrážky', () => {
  const text = f.sestavTextSdileni_({ nazev: 'X', datumOd: '7. 8. 2026', misto: '', url: '' });
  assert.equal(text, 'X\n7. 8. 2026');
});

test('sestavTextSdileni_: chybějící datum i misto – jen název (žádný prázdný druhý řádek)', () => {
  const text = f.sestavTextSdileni_({ nazev: 'X', datumOd: '', misto: '', url: '' });
  assert.equal(text, 'X');
});

test('sestavTextSdileni_: bez url se poslední řádek s odkazem vynechá', () => {
  const text = f.sestavTextSdileni_({ nazev: 'X', datumOd: '1. 1. 2026', misto: 'Y', url: '' });
  assert.equal(text, 'X\n1. 1. 2026 · Y');
});

test('sestavTextSdileni_: chybějící nazev nepadá (prázdný první řádek)', () => {
  const text = f.sestavTextSdileni_({ datumOd: '1. 1. 2026' });
  assert.equal(text, '\n1. 1. 2026');
});

// ---------------------------------------------------------------------------
// mapsUrl_ – odkaz „📍 Mapa“ (Google Maps URL schéma, bez API klíče)
// ---------------------------------------------------------------------------

test('mapsUrl_: se souřadnicemi (v3.14) vygeneruje odkaz přímo z lat,lng – garantovaný pin', () => {
  const url = f.mapsUrl_({ misto: 'Zelný trh', obec: 'Brno', lat: 49.1925, lng: 16.6087 });
  assert.equal(url, 'https://www.google.com/maps/search/?api=1&query=49.1925,16.6087');
});

test('mapsUrl_: bez souřadnic (ještě negeokódováno) spadá zpět na textové vyhledávání', () => {
  const url = f.mapsUrl_({ misto: 'Zelný trh', obec: 'Brno', lat: null, lng: null });
  assert.ok(url.includes(encodeURIComponent('Zelný trh, Brno')));
  assert.ok(!url.includes('49.'));
});

test('mapsUrl_: misto i obec – spojené čárkou, escapované, žádný api klíč v URL', () => {
  const url = f.mapsUrl_({ misto: 'Špilberk', obec: 'Brno' });
  assert.ok(url.startsWith('https://www.google.com/maps/search/?api=1&query='));
  assert.ok(url.includes(encodeURIComponent('Špilberk, Brno')));
  assert.ok(!url.toLowerCase().includes('key='));
});

test('mapsUrl_: jen obec (misto chybí) – funguje i tak', () => {
  const url = f.mapsUrl_({ misto: '', obec: 'Brno' });
  assert.ok(url.includes(encodeURIComponent('Brno')));
});

test('mapsUrl_: chybí misto i obec → null (žádný odkaz)', () => {
  assert.equal(f.mapsUrl_({ misto: '', obec: '' }), null);
  assert.equal(f.mapsUrl_({}), null);
});

// ---------------------------------------------------------------------------
// v3.13: Uživatelské profily – čisté funkce přihlášení a osobních filtrů
// ---------------------------------------------------------------------------

test('v3.13: sestavFiltry_ – vyplněné hodnoty se přenesou, mezery okolo se ořežou', () => {
  const filtry = f.sestavFiltry_('  koncerty; festivaly ', ' 60 min ');
  assert.equal(filtry.kategorie, 'koncerty; festivaly');
  assert.equal(filtry.dojezd, '60 min');
});

test('v3.13: sestavFiltry_ – prázdné/null hodnoty se VYNECHAJÍ (= použije se výchozí z KRITÉRIÍ)', () => {
  assert.equal(Object.keys(f.sestavFiltry_('', '')).length, 0);
  assert.equal(Object.keys(f.sestavFiltry_(null, undefined)).length, 0);
  const jenDojezd = f.sestavFiltry_('', '90 min');
  assert.equal('kategorie' in jenDojezd, false, 'prázdná kategorie se do filtrů vůbec nezapíše');
  assert.equal(jenDojezd.dojezd, '90 min');
});

test('v3.13: pinVypadaPlatne_ – 4–8 znaků bez mezer uvnitř, okolní mezery se ořežou', () => {
  assert.equal(f.pinVypadaPlatne_('1234'), true);
  assert.equal(f.pinVypadaPlatne_('12345678'), true);
  assert.equal(f.pinVypadaPlatne_('abc4'), true, 'PIN nemusí být jen číslice');
  assert.equal(f.pinVypadaPlatne_('123'), false, 'moc krátký');
  assert.equal(f.pinVypadaPlatne_('123456789'), false, 'moc dlouhý');
  assert.equal(f.pinVypadaPlatne_('12 34'), false, 'mezera uvnitř');
  assert.equal(f.pinVypadaPlatne_(''), false);
  assert.equal(f.pinVypadaPlatne_(null), false);
  assert.equal(f.pinVypadaPlatne_('  1234  '), true, 'mezery okolo se před kontrolou ořežou');
});
