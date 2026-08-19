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
  'filtrovatNavstivenaPodleObdobi_', 'jeNeoverena_', 'jeNeoverenaBezUrl_', 'sestavTextSdileni_', 'mapsUrl_',
  'klicMistoUkladani_', 'akceSeStejnymMistem_',
  'sestavFiltry_', 'pinVypadaPlatne_', 'sestavFetchPozadavek_',
  'klicUlozenychChipu_', 'serializovatKategorie_', 'deserializovatKategorie_',
  'sestavOdkazNaAkci_', 'parsovatOdkazNaAkci_',
  'sestavOdkazNaVyber_', 'parsovatOdkazNaVyber_',
  'weathercodeEmoji_', 'pocasiZobrazeni_',
  'isoDatum_', 'dnySAkcemi_', 'sestavKalendarMrizku_',
  'jeViditelnaVSeznamu_', 'filtrovatKategorii_', 'filtrovatOblibenaMista_', 'akceProMapu_',
  'dostupnePodkategorie_', 'filtrovatPodkategorii_',
  'akceDnePodleData_', 'seskupitPodleSouradnic_',
  'vypocitejPoziciTooltipuKalendare_',
  'klicSouradnic_', 'sestavSeznamMist_', 'prepnoutVyberPinu_',
  'spocitejStatistikuVyberu_', 'vycistitVyberPinu_',
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
// jeNeoverena_ – vizuální štítek "❓ Neověřeno" na kartě (9. 8. 2026),
// bez ohledu na datum (na rozdíl od jeNeoverenaBezUrl_ níže).
// ---------------------------------------------------------------------------

test('jeNeoverena_: stav neověřeno + prázdné URL → true', () => {
  assert.equal(f.jeNeoverena_({ stav: 'neověřeno', url: '' }), true);
});

test('jeNeoverena_: stav neověřeno + vyplněné URL → false', () => {
  assert.equal(f.jeNeoverena_({ stav: 'neověřeno', url: 'https://example.com' }), false);
});

test('jeNeoverena_: stav potvrzeno + prázdné URL → false', () => {
  assert.equal(f.jeNeoverena_({ stav: 'potvrzeno', url: '' }), false);
});

test('jeNeoverena_: dávno proběhlá neověřená akce bez URL → true (na rozdíl od jeNeoverenaBezUrl_, datum se tu neřeší)', () => {
  assert.equal(f.jeNeoverena_({ stav: 'neověřeno', url: '', datumOd: '1. 1. 2020' }), true);
});

// ---------------------------------------------------------------------------
// jeNeoverenaBezUrl_ – chip „❓ Neověřeno" (rozhodnutí 9. 8. 2026)
// TED = 3. 8. 2026 (viz výše u filtrovatNavstivenaPodleObdobi_)
// ---------------------------------------------------------------------------

test('jeNeoverenaBezUrl_: stav neověřeno + prázdné URL + budoucí datum → true', () => {
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'neověřeno', url: '', datumOd: '10. 8. 2026' }, TED), true);
});

test('jeNeoverenaBezUrl_: stav neověřeno + jen bílé znaky v URL + budoucí datum → true', () => {
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'neověřeno', url: '   ', datumOd: '10. 8. 2026' }, TED), true);
});

test('jeNeoverenaBezUrl_: datum přesně „dnes" (TED) se ještě počítá (>=)', () => {
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'neověřeno', url: '', datumOd: '3. 8. 2026' }, TED), true);
});

test('jeNeoverenaBezUrl_: stav neověřeno, ale URL vyplněné → false', () => {
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'neověřeno', url: 'https://example.com', datumOd: '10. 8. 2026' }, TED), false);
});

test('jeNeoverenaBezUrl_: stav potvrzeno + prázdné URL → false (jiný stav se neskrývá)', () => {
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'potvrzeno', url: '', datumOd: '10. 8. 2026' }, TED), false);
});

test('jeNeoverenaBezUrl_: stav zrušeno + prázdné URL → false', () => {
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'zrušeno', url: '', datumOd: '10. 8. 2026' }, TED), false);
});

test('jeNeoverenaBezUrl_: chybějící pole url (undefined) + budoucí datum → true', () => {
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'neověřeno', datumOd: '10. 8. 2026' }, TED), true);
});

test('jeNeoverenaBezUrl_: dávno proběhlá neověřená akce bez URL → false (nesmí se vloudit z ★/✓ výjimky)', () => {
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'neověřeno', url: '', datumOd: '1. 1. 2026' }, TED), false);
});

test('jeNeoverenaBezUrl_: neparsovatelné/chybějící datumOd → false (bezpečný default, ne pád)', () => {
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'neověřeno', url: '' }, TED), false);
  assert.equal(f.jeNeoverenaBezUrl_({ stav: 'neověřeno', url: '', datumOd: 'Probíhá / dlouhodobé' }, TED), false);
});

// ---------------------------------------------------------------------------
// sestavTextSdileni_ – text pro sdílení akce (WhatsApp/SMS/e-mail)
// ---------------------------------------------------------------------------

test('sestavTextSdileni_: kompletní akce – název, odrážka s datem+místem, odrážka s odkazem, podpis appky na konci', () => {
  const text = f.sestavTextSdileni_({
    nazev: 'Balkan Night', datumOd: '7. 8. 2026', misto: 'Špilberk', url: 'https://example.com',
  });
  assert.equal(text, 'Balkan Night\n• 7. 8. 2026 · Špilberk\n• Odkaz: https://example.com\n\n— Kulturní radar');
});

test('sestavTextSdileni_: chybějící misto – odrážka jen s datem, žádná osamocená čárka', () => {
  const text = f.sestavTextSdileni_({ nazev: 'X', datumOd: '7. 8. 2026', misto: '', url: '' });
  assert.equal(text, 'X\n• 7. 8. 2026\n\n— Kulturní radar');
});

test('sestavTextSdileni_: chybějící datum i misto – žádná odrážka s datem, jen název + podpis', () => {
  const text = f.sestavTextSdileni_({ nazev: 'X', datumOd: '', misto: '', url: '' });
  assert.equal(text, 'X\n\n— Kulturní radar');
});

test('sestavTextSdileni_: bez url se odrážka s odkazem vynechá', () => {
  const text = f.sestavTextSdileni_({ nazev: 'X', datumOd: '1. 1. 2026', misto: 'Y', url: '' });
  assert.equal(text, 'X\n• 1. 1. 2026 · Y\n\n— Kulturní radar');
});

test('sestavTextSdileni_: chybějící nazev nepadá (prázdný první řádek)', () => {
  const text = f.sestavTextSdileni_({ datumOd: '1. 1. 2026' });
  assert.equal(text, '\n• 1. 1. 2026\n\n— Kulturní radar');
});

test('v3.24: sestavTextSdileni_ – vždy končí viditelným podpisem appky (odolné proti ořezání whitespace)', () => {
  const varianty = [
    { nazev: 'A', datumOd: 'd', misto: 'm', url: 'u' },
    { nazev: 'A', datumOd: '', misto: '', url: '' },
    { nazev: '', datumOd: '', misto: '', url: '' },
  ];
  varianty.forEach(a => {
    const text = f.sestavTextSdileni_(a);
    assert.ok(text.endsWith('— Kulturní radar'), 'text má končit podpisem appky: ' + JSON.stringify(text));
  });
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
// klicMistoUkladani_ (H, v3.48) – klíč do Setu probihaUkladani pro 🏛,
// sdílený mezi render karty (btnMisto) a prepniOznaceniMista
// ---------------------------------------------------------------------------

test('klicMistoUkladani_: skládá misto|obec:misto', () => {
  assert.equal(f.klicMistoUkladani_({ misto: 'Špilberk', obec: 'Brno' }), 'Špilberk|Brno:misto');
});

test('klicMistoUkladani_: dvě různá místa ve stejné obci dávají různé klíče', () => {
  const a = f.klicMistoUkladani_({ misto: 'Špilberk', obec: 'Brno' });
  const b = f.klicMistoUkladani_({ misto: 'Zelný trh', obec: 'Brno' });
  assert.notEqual(a, b);
});

test('klicMistoUkladani_: stejné misto ve dvou obcích dává různé klíče', () => {
  const a = f.klicMistoUkladani_({ misto: 'Zámek', obec: 'Brno' });
  const b = f.klicMistoUkladani_({ misto: 'Zámek', obec: 'Olomouc' });
  assert.notEqual(a, b);
});

// ---------------------------------------------------------------------------
// akceSeStejnymMistem_ (G, v3.49) – sync ikony 🏛 napříč kartami se stejným
// místem po přepnutí v prepniOznaceniMista
// ---------------------------------------------------------------------------

test('akceSeStejnymMistem_: najde všechny akce se stejným misto+obec, včetně vstupní', () => {
  const spilberk1 = { id: '1', misto: 'Špilberk', obec: 'Brno' };
  const spilberk2 = { id: '2', misto: 'Špilberk', obec: 'Brno' };
  const jine = { id: '3', misto: 'Zelný trh', obec: 'Brno' };
  const vysledek = f.akceSeStejnymMistem_([spilberk1, spilberk2, jine], spilberk1);
  assert.deepEqual(vysledek.map(x => x.id).sort(), ['1', '2']);
});

test('akceSeStejnymMistem_: stejné misto v jiné obci se nepočítá', () => {
  const a = { id: '1', misto: 'Zámek', obec: 'Brno' };
  const b = { id: '2', misto: 'Zámek', obec: 'Olomouc' };
  assert.deepEqual(f.akceSeStejnymMistem_([a, b], a).map(x => x.id), ['1']);
});

test('akceSeStejnymMistem_: žádná shoda kromě vstupní akce samotné', () => {
  const a = { id: '1', misto: 'Špilberk', obec: 'Brno' };
  const jine = { id: '2', misto: 'Zelný trh', obec: 'Brno' };
  assert.deepEqual(f.akceSeStejnymMistem_([a, jine], a).map(x => x.id), ['1']);
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

/** Cross-realm porovnání: objekty z vm sandboxu nejsou referenčně shodné
 *  s objekty testu (viz harness.js pozn. o Date) – porovnáváme přes JSON. */
function shodneNapricRealmy(skutecne, ocekavane, zprava) {
  assert.equal(JSON.stringify(skutecne), JSON.stringify(ocekavane), zprava);
}

// ---------------------------------------------------------------------------
// v3.15: sestavFetchPozadavek_ – překlad gsr volání na HTTP pro statický hosting
// ---------------------------------------------------------------------------

const EXEC = 'https://example.com/exec';

test('v3.15: sestavFetchPozadavek_ – GET routy (meta, events, places, uzivatele)', () => {
  shodneNapricRealmy(f.sestavFetchPozadavek_('apiMeta', [], EXEC),
    { metoda: 'GET', url: EXEC + '?api=meta' });
  const events = f.sestavFetchPozadavek_('apiEvents', ['Brno', true, 'rf-test'], EXEC);
  assert.equal(events.metoda, 'GET');
  assert.ok(events.url.includes('api=events'));
  assert.ok(events.url.includes('profil=Brno'));
  assert.ok(events.url.includes('oznacene=1'));
  assert.ok(events.url.includes('uzivatel=rf-test'));
  const eventsBez = f.sestavFetchPozadavek_('apiEvents', ['', false, ''], EXEC);
  assert.ok(!eventsBez.url.includes('oznacene'), 'bez oznacene=1 když false');
  shodneNapricRealmy(f.sestavFetchPozadavek_('apiSeznamUzivatelu', [], EXEC),
    { metoda: 'GET', url: EXEC + '?api=uzivatele' });
});

test('v3.15: sestavFetchPozadavek_ – diakritika v profilu se URL-escapuje', () => {
  const poz = f.sestavFetchPozadavek_('apiPlaces', ['Plzeň'], EXEC);
  assert.ok(poz.url.includes(encodeURIComponent('Plzeň')));
  assert.ok(!poz.url.includes('Plzeň'), 'surová diakritika nemá být v URL');
});

test('v3.15: sestavFetchPozadavek_ – POST routy: PIN a token jdou v TĚLE, nikdy v URL', () => {
  const login = f.sestavFetchPozadavek_('apiPrihlaseniUzivatele', ['vojta', '1234'], EXEC);
  assert.equal(login.metoda, 'POST');
  assert.equal(login.url, EXEC, 'POST URL bez query parametrů');
  shodneNapricRealmy(login.telo, { akce: 'login', uzivatelId: 'vojta', pin: '1234' });
  assert.ok(!login.url.includes('1234'), 'PIN nesmí být v URL');

  const toggle = f.sestavFetchPozadavek_('apiToggle', ['42', 'oblibene', 'vojta'], EXEC);
  shodneNapricRealmy(toggle.telo, { akce: 'toggle', id: '42', typ: 'oblibene', uzivatelId: 'vojta' });

  const filtry = f.sestavFetchPozadavek_('apiSetFiltry', ['vojta', { dojezd: '60 min' }], EXEC);
  shodneNapricRealmy(filtry.telo, { akce: 'filtry', uzivatelId: 'vojta', filtry: { dojezd: '60 min' } });

  const najdi = f.sestavFetchPozadavek_('apiNajdiProUzivatele', ['vojta', 'tok-x'], EXEC);
  shodneNapricRealmy(najdi.telo, { akce: 'najdi', uzivatelId: 'vojta', token: 'tok-x' });
  assert.ok(!najdi.url.includes('tok-x'), 'token nesmí být v URL');

  const run = f.sestavFetchPozadavek_('apiSpustKontrolu', ['tok-y'], EXEC);
  shodneNapricRealmy(run.telo, { akce: 'run', token: 'tok-y' });
});

test('v3.15: sestavFetchPozadavek_ – neznámá funkce vrací null (gsr vyhodí srozumitelnou chybu)', () => {
  assert.equal(f.sestavFetchPozadavek_('apiNeexistuje', [], EXEC), null);
});

// ---------------------------------------------------------------------------
// v3.16: zapamatování kategorie-chipů per uživatelský profil (localStorage)
// ---------------------------------------------------------------------------

test('v3.16: klicUlozenychChipu_ – stabilní klíč per profil, různí uživatelé nekolidují', () => {
  assert.equal(f.klicUlozenychChipu_('vojta'), 'radar_chipy:vojta');
  assert.notEqual(f.klicUlozenychChipu_('vojta'), f.klicUlozenychChipu_('monika'));
});

test('v3.16: serializovatKategorie_ – Set → JSON pole, prázdný Set → "[]"', () => {
  assert.equal(f.serializovatKategorie_(new Set(['koncerty', 'festivaly'])),
    JSON.stringify(['koncerty', 'festivaly']));
  assert.equal(f.serializovatKategorie_(new Set()), '[]');
});

test('v3.16: deserializovatKategorie_ – validní JSON pole se vrátí beze změny', () => {
  shodneNapricRealmy(f.deserializovatKategorie_('["koncerty","festivaly"]'), ['koncerty', 'festivaly']);
  shodneNapricRealmy(f.deserializovatKategorie_('[]'), []);
});

test('v3.16: deserializovatKategorie_ – chybějící/rozbitá/nepolová data → bezpečně [] (appka nespadne)', () => {
  shodneNapricRealmy(f.deserializovatKategorie_(null), []);
  shodneNapricRealmy(f.deserializovatKategorie_(''), []);
  shodneNapricRealmy(f.deserializovatKategorie_('{rozbite json'), []);
  shodneNapricRealmy(f.deserializovatKategorie_('"jen retezec, ne pole"'), []);
  shodneNapricRealmy(f.deserializovatKategorie_('{"a":1}'), []);
});

test('v3.16: deserializovatKategorie_ – nečistá data v poli (čísla/null) se vyfiltrují, ne pád', () => {
  shodneNapricRealmy(f.deserializovatKategorie_('["koncerty", 42, null, "folklor"]'), ['koncerty', 'folklor']);
});

test('v3.16: round-trip serializace/deserializace zachová obsah', () => {
  const puvodni = new Set(['koncerty', 'divadlo', 'folklor']);
  const obnovene = f.deserializovatKategorie_(f.serializovatKategorie_(puvodni));
  shodneNapricRealmy([...obnovene].sort(), [...puvodni].sort());
});

// ---------------------------------------------------------------------------
// v3.17: Lehčí sdílení – deep link zpátky do appky (?akce=ID&profil=Město)
// ---------------------------------------------------------------------------

test('v3.17: sestavOdkazNaAkci_ – sestaví URL s id a profilem, diakritika escapovaná', () => {
  const url = f.sestavOdkazNaAkci_('2026-05-14-leto-na-zelnaku', 'Brno', 'https://kulturniradar.cz');
  assert.equal(url, 'https://kulturniradar.cz/?akce=2026-05-14-leto-na-zelnaku&profil=Brno');

  const sPlzni = f.sestavOdkazNaAkci_('x', 'Plzeň', 'https://kulturniradar.cz');
  assert.ok(sPlzni.includes(encodeURIComponent('Plzeň')));
  assert.ok(!sPlzni.includes('Plzeň'), 'surová diakritika nemá být v URL');
});

test('v3.17: sestavOdkazNaAkci_ – koncové lomítko v baseUrl se nezdvojí', () => {
  const url = f.sestavOdkazNaAkci_('x', 'Brno', 'https://kulturniradar.cz/');
  assert.equal(url, 'https://kulturniradar.cz/?akce=x&profil=Brno');
});

test('v3.17: sestavOdkazNaAkci_ – chybějící id/profil nepadá, jen prázdná hodnota v URL', () => {
  const url = f.sestavOdkazNaAkci_('', '', 'https://kulturniradar.cz');
  assert.equal(url, 'https://kulturniradar.cz/?akce=&profil=');
});

test('v3.17: parsovatOdkazNaAkci_ – validní query string se rozparsuje', () => {
  const vysledek = f.parsovatOdkazNaAkci_('?akce=2026-05-14-leto-na-zelnaku&profil=Brno');
  assert.equal(vysledek.id, '2026-05-14-leto-na-zelnaku');
  assert.equal(vysledek.profil, 'Brno');
});

test('v3.17: parsovatOdkazNaAkci_ – chybějící parametr akce → null (žádný deep link)', () => {
  assert.equal(f.parsovatOdkazNaAkci_(''), null);
  assert.equal(f.parsovatOdkazNaAkci_('?profil=Brno'), null);
  assert.equal(f.parsovatOdkazNaAkci_(null), null);
});

test('v3.17: parsovatOdkazNaAkci_ – chybějící profil je prázdný řetězec, ne pád', () => {
  const vysledek = f.parsovatOdkazNaAkci_('?akce=x');
  assert.equal(vysledek.id, 'x');
  assert.equal(vysledek.profil, '');
});

test('v3.17: round-trip sestavení → parsování zachová id i profil', () => {
  const url = f.sestavOdkazNaAkci_('nejaka-akce', 'Znojmo', 'https://kulturniradar.cz');
  const query = url.slice(url.indexOf('?'));
  const zpet = f.parsovatOdkazNaAkci_(query);
  assert.equal(zpet.id, 'nejaka-akce');
  assert.equal(zpet.profil, 'Znojmo');
});

// ---------------------------------------------------------------------------
// v3.20: Lehčí sdílení – celý výběr (?profil=Město&kategorie=a,b,c)
// ---------------------------------------------------------------------------

test('v3.20: sestavOdkazNaVyber_ – jen profil, žádná kategorie (== "Vše")', () => {
  const url = f.sestavOdkazNaVyber_('Brno', new Set(), 'https://kulturniradar.cz');
  assert.equal(url, 'https://kulturniradar.cz/?profil=Brno');
});

test('v3.20: sestavOdkazNaVyber_ – profil i kategorie, spojené čárkou', () => {
  const url = f.sestavOdkazNaVyber_('Brno', new Set(['koncerty', 'folklor']), 'https://kulturniradar.cz');
  assert.equal(url, 'https://kulturniradar.cz/?profil=Brno&kategorie=koncerty%2Cfolklor');
});

test('v3.20: sestavOdkazNaVyber_ – koncové lomítko v baseUrl se nezdvojí', () => {
  const url = f.sestavOdkazNaVyber_('Brno', new Set(), 'https://kulturniradar.cz/');
  assert.equal(url, 'https://kulturniradar.cz/?profil=Brno');
});

test('v3.20: sestavOdkazNaVyber_ – bez profilu i kategorií vrátí jen kořen domény', () => {
  const url = f.sestavOdkazNaVyber_('', new Set(), 'https://kulturniradar.cz');
  assert.equal(url, 'https://kulturniradar.cz/');
});

test('v3.20: parsovatOdkazNaVyber_ – profil i kategorie se rozparsují', () => {
  const vysledek = f.parsovatOdkazNaVyber_('?profil=Brno&kategorie=koncerty,folklor');
  assert.equal(vysledek.profil, 'Brno');
  shodneNapricRealmy(vysledek.kategorie, ['koncerty', 'folklor']);
});

test('v3.20: parsovatOdkazNaVyber_ – jen profil, bez kategorie → prázdné pole, ne pád', () => {
  const vysledek = f.parsovatOdkazNaVyber_('?profil=Brno');
  assert.equal(vysledek.profil, 'Brno');
  shodneNapricRealmy(vysledek.kategorie, []);
});

test('v3.20: parsovatOdkazNaVyber_ – ani profil ani kategorie → null (žádný deep link)', () => {
  assert.equal(f.parsovatOdkazNaVyber_(''), null);
  assert.equal(f.parsovatOdkazNaVyber_(null), null);
  assert.equal(f.parsovatOdkazNaVyber_('?akce=x'), null);
});

test('v3.20: parsovatOdkazNaVyber_ – prázdné položky a mezery v kategoriích se vyčistí', () => {
  const vysledek = f.parsovatOdkazNaVyber_('?kategorie=koncerty, ,folklor,');
  shodneNapricRealmy(vysledek.kategorie, ['koncerty', 'folklor']);
});

test('v3.20: round-trip sestavení → parsování zachová profil i kategorie', () => {
  const url = f.sestavOdkazNaVyber_('Znojmo', new Set(['divadlo', 'jarmarky']), 'https://kulturniradar.cz');
  const query = url.slice(url.indexOf('?'));
  const zpet = f.parsovatOdkazNaVyber_(query);
  assert.equal(zpet.profil, 'Znojmo');
  shodneNapricRealmy([...zpet.kategorie].sort(), ['divadlo', 'jarmarky'].sort());
});

// ---------------------------------------------------------------------------
// v3.25: Počasí u akce – weathercodeEmoji_, pocasiZobrazeni_
// ---------------------------------------------------------------------------

test('v3.25: weathercodeEmoji_ – reprezentativní kódy stejného bucketingu jako weatherText_ v .gs', () => {
  assert.equal(f.weathercodeEmoji_(0), '☀️');
  assert.equal(f.weathercodeEmoji_(2), '🌤️');
  assert.equal(f.weathercodeEmoji_(3), '☁️');
  assert.equal(f.weathercodeEmoji_(45), '🌫️');
  assert.equal(f.weathercodeEmoji_(63), '🌧️');
  assert.equal(f.weathercodeEmoji_(71), '❄️');
  assert.equal(f.weathercodeEmoji_(95), '⛈️');
});

test('v3.25: weathercodeEmoji_ – nečíselný/chybějící kód nespadne, vrátí placeholder', () => {
  assert.equal(f.weathercodeEmoji_(''), '❓');
  assert.equal(f.weathercodeEmoji_(null), '❓');
  assert.equal(f.weathercodeEmoji_(undefined), '❓');
});

test('v3.25: pocasiZobrazeni_ – stav OK: ikona + zaokrouhlená teplota, normální třída', () => {
  const v = f.pocasiZobrazeni_({ stav: 'OK', kod: 61, teplota: 14.6 });
  assert.equal(v.text, '🌧️ 15°C');
  assert.equal(v.trida, 'pocasi-ok');
});

test('v3.25: pocasiZobrazeni_ – stav NA (mimo dosah) → tlumené "N/A", ne chybová hláška', () => {
  const v = f.pocasiZobrazeni_({ stav: 'NA', kod: '', teplota: '' });
  assert.equal(v.text, 'N/A');
  assert.equal(v.trida, 'pocasi-na');
});

test('v3.25: pocasiZobrazeni_ – stav CHYBA se zachovanou hodnotou se zobrazí jako běžné počasí, ne jako chyba', () => {
  const v = f.pocasiZobrazeni_({ stav: 'CHYBA', kod: 3, teplota: 19 });
  assert.equal(v.text, '☁️ 19°C');
  assert.equal(v.trida, 'pocasi-ok');
});

test('v3.25: pocasiZobrazeni_ – stav CHYBA bez jakékoli předchozí hodnoty → taky N/A', () => {
  const v = f.pocasiZobrazeni_({ stav: 'CHYBA', kod: '', teplota: '' });
  assert.equal(v.text, 'N/A');
  assert.equal(v.trida, 'pocasi-na');
});

test('v3.25: pocasiZobrazeni_ – chybějící pocasi objekt (akce ještě nezpracována triggerem) → N/A', () => {
  assert.equal(f.pocasiZobrazeni_(undefined).text, 'N/A');
  assert.equal(f.pocasiZobrazeni_(null).text, 'N/A');
});

// ---------------------------------------------------------------------------
// v3.33: Kalendářní pohled (redesign fáze 2) – isoDatum_, dnySAkcemi_,
// sestavKalendarMrizku_. Referenční data ověřena přímo přes new Date().getDay()
// (ne odhadem): 1. 8. 2026 = sobota, 1. 2. 2026 = neděle, 1. 9. 2026 = úterý.
// ---------------------------------------------------------------------------

test('isoDatum_: formátuje datum na YYYY-MM-DD s nulami zleva', () => {
  assert.equal(f.isoDatum_(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(f.isoDatum_(new Date(2026, 10, 23)), '2026-11-23');
});

test('sestavKalendarMrizku_: srpen 2026 (1. 8. = sobota) – 5 prázdných buněk, pak 1.–31.', () => {
  const bunky = f.sestavKalendarMrizku_(2026, 7, new Set());
  assert.equal(bunky.length, 36);   // 5 prázdných + 31 dní
  for (let i = 0; i < 5; i++) assert.equal(bunky[i].den, null);
  assert.equal(bunky[5].den, 1);
  assert.equal(bunky[5].iso, '2026-08-01');
  assert.equal(bunky[bunky.length - 1].den, 31);
  assert.equal(bunky[bunky.length - 1].iso, '2026-08-31');
});

test('sestavKalendarMrizku_: únor 2026 (1. 2. = neděle, 28 dní) – 6 prázdných buněk', () => {
  const bunky = f.sestavKalendarMrizku_(2026, 1, new Set());
  assert.equal(bunky.length, 34);   // 6 prázdných + 28 dní
  for (let i = 0; i < 6; i++) assert.equal(bunky[i].den, null);
  assert.equal(bunky[6].den, 1);
  assert.equal(bunky[bunky.length - 1].den, 28);
});

test('sestavKalendarMrizku_: září 2026 (1. 9. = úterý) – jen 1 prázdná buňka na začátku', () => {
  const bunky = f.sestavKalendarMrizku_(2026, 8, new Set());
  assert.equal(bunky[0].den, null);
  assert.equal(bunky[1].den, 1);
  assert.equal(bunky[1].iso, '2026-09-01');
});

test('sestavKalendarMrizku_: maAkce se nastaví přesně podle předané množiny, jinak false', () => {
  const bunky = f.sestavKalendarMrizku_(2026, 7, new Set(['2026-08-15', '2026-08-01']));
  const podleDne = {};
  bunky.forEach(b => { if (b.den != null) podleDne[b.den] = b.maAkce; });
  assert.equal(podleDne[1], true);
  assert.equal(podleDne[15], true);
  assert.equal(podleDne[2], false);
  assert.equal(podleDne[31], false);
});

const KAL_DNES = new Date(2026, 7, 10);   // „dnes" pro dnySAkcemi_ testy, injektované

test('dnySAkcemi_: platná budoucí akce se propíše do množiny jako YYYY-MM-DD', () => {
  const dny = f.dnySAkcemi_([{ stav: 'potvrzeno', datumOd: '15. 8. 2026', url: '' }], KAL_DNES);
  assert.equal(dny.has('2026-08-15'), true);
  assert.equal(dny.size, 1);
});

test('dnySAkcemi_: dvě akce stejný den → jeden záznam v množině (Set dedup)', () => {
  const dny = f.dnySAkcemi_([
    { stav: 'potvrzeno', datumOd: '15. 8. 2026', url: '' },
    { stav: 'potvrzeno', datumOd: '15. 8. 2026', url: '' },
  ], KAL_DNES);
  assert.equal(dny.size, 1);
});

test('dnySAkcemi_: stav "proběhlo" se vynechá, i když má platné datum (stejný filtr jako seznam "Vše")', () => {
  const dny = f.dnySAkcemi_([{ stav: 'proběhlo', datumOd: '15. 8. 2026', url: '' }], KAL_DNES);
  assert.equal(dny.size, 0);
});

test('dnySAkcemi_: neověřená akce bez URL a datum v budoucnu se vynechá (nemá .den-hlavicka v seznamu "Vše")', () => {
  const dny = f.dnySAkcemi_([{ stav: 'neověřeno', datumOd: '20. 8. 2026', url: '' }], KAL_DNES);
  assert.equal(dny.size, 0);
});

test('dnySAkcemi_: neověřená akce bez URL, ale datum v minulosti, se NEVYNECHÁ (jeNeoverenaBezUrl_ platí jen pro budoucí)', () => {
  const dny = f.dnySAkcemi_([{ stav: 'neověřeno', datumOd: '1. 8. 2026', url: '' }], KAL_DNES);
  assert.equal(dny.has('2026-08-01'), true);
});

test('dnySAkcemi_: neověřená akce S URL se nevynechává (jeNeoverena_ vyžaduje prázdné URL)', () => {
  const dny = f.dnySAkcemi_([{ stav: 'neověřeno', datumOd: '20. 8. 2026', url: 'https://example.com' }], KAL_DNES);
  assert.equal(dny.has('2026-08-20'), true);
});

test('dnySAkcemi_: nevalidní/chybějící datumOd se přeskočí bez pádu', () => {
  const dny = f.dnySAkcemi_([
    { stav: 'potvrzeno', datumOd: '', url: '' },
    { stav: 'potvrzeno', datumOd: 'Probíhá / dlouhodobé', url: '' },
  ], KAL_DNES);
  assert.equal(dny.size, 0);
});

test('dnySAkcemi_: prázdné/chybějící pole akcí nespadne, vrátí prázdnou množinu', () => {
  assert.equal(f.dnySAkcemi_([], KAL_DNES).size, 0);
  assert.equal(f.dnySAkcemi_(undefined, KAL_DNES).size, 0);
});

// ---------------------------------------------------------------------------
// v3.35: Redesign fáze 3 – jeViditelnaVSeznamu_, filtrovatKategorii_,
// akceProMapu_ (mapa + oprava fázování kalendáře, aby respektovalo
// kategorie-chip stejně jako seznam „Vše").
// ---------------------------------------------------------------------------

test('jeViditelnaVSeznamu_: potvrzená budoucí akce je viditelná', () => {
  assert.equal(f.jeViditelnaVSeznamu_({ stav: 'potvrzeno', datumOd: '15. 8. 2026', url: '' }, KAL_DNES), true);
});

test('jeViditelnaVSeznamu_: stav "proběhlo" není viditelný', () => {
  assert.equal(f.jeViditelnaVSeznamu_({ stav: 'proběhlo', datumOd: '15. 8. 2026', url: '' }, KAL_DNES), false);
});

test('jeViditelnaVSeznamu_: neověřená bez URL a budoucí datum není viditelná', () => {
  assert.equal(f.jeViditelnaVSeznamu_({ stav: 'neověřeno', datumOd: '20. 8. 2026', url: '' }, KAL_DNES), false);
});

test('jeViditelnaVSeznamu_: neověřená bez URL, ale minulé datum, JE viditelná', () => {
  assert.equal(f.jeViditelnaVSeznamu_({ stav: 'neověřeno', datumOd: '1. 8. 2026', url: '' }, KAL_DNES), true);
});

test('jeViditelnaVSeznamu_: neověřená S URL je viditelná i v budoucnu', () => {
  assert.equal(f.jeViditelnaVSeznamu_({ stav: 'neověřeno', datumOd: '20. 8. 2026', url: 'https://example.com' }, KAL_DNES), true);
});

function akceKat(kategorie) { return { kategorie }; }

test('filtrovatKategorii_: prázdná/chybějící množina vrátí pole beze změny', () => {
  const akce = [akceKat(['koncerty']), akceKat(['divadlo'])];
  assert.equal(f.filtrovatKategorii_(akce, new Set()), akce);
  assert.equal(f.filtrovatKategorii_(akce, null), akce);
});

test('filtrovatKategorii_: neprázdná množina ponechá jen akce s průnikem', () => {
  const akce = [akceKat(['koncerty']), akceKat(['divadlo']), akceKat(['koncerty', 'festivaly'])];
  const vysledek = f.filtrovatKategorii_(akce, new Set(['koncerty']));
  assert.equal(vysledek.length, 2);
});

test('filtrovatKategorii_: žádná akce nesedí → prázdné pole', () => {
  const akce = [akceKat(['divadlo'])];
  assert.equal(f.filtrovatKategorii_(akce, new Set(['koncerty'])).length, 0);
});

function akceMistoOblibene_(mistoOblibene) { return { mistoOblibene }; }

test('filtrovatOblibenaMista_: neaktivní filtr vrátí pole beze změny', () => {
  const akce = [akceMistoOblibene_(true), akceMistoOblibene_(false), akceMistoOblibene_(undefined)];
  assert.equal(f.filtrovatOblibenaMista_(akce, false), akce);
  assert.equal(f.filtrovatOblibenaMista_(akce, undefined), akce);
});

test('filtrovatOblibenaMista_: aktivní filtr ponechá jen akce s mistoOblibene === true', () => {
  const akce = [akceMistoOblibene_(true), akceMistoOblibene_(false), akceMistoOblibene_(undefined)];
  const vysledek = f.filtrovatOblibenaMista_(akce, true);
  assert.equal(vysledek.length, 1);
  assert.equal(vysledek[0].mistoOblibene, true);
});

test('filtrovatOblibenaMista_: aktivní filtr, žádná akce nesedí → prázdné pole', () => {
  const akce = [akceMistoOblibene_(false), akceMistoOblibene_(undefined)];
  assert.equal(f.filtrovatOblibenaMista_(akce, true).length, 0);
});

function akceMapa(over) {
  return Object.assign({ stav: 'potvrzeno', datumOd: '15. 8. 2026', url: '', kategorie: ['koncerty'], lat: 49.2, lng: 16.6 }, over);
}

test('akceProMapu_: akce bez souřadnic se vynechá, i když je jinak v pořádku', () => {
  const vysledek = f.akceProMapu_([akceMapa({ lat: undefined, lng: undefined })], new Set(), KAL_DNES);
  assert.equal(vysledek.length, 0);
});

test('akceProMapu_: proběhlá akce se souřadnicemi se vynechá (stejný filtr jako seznam)', () => {
  const vysledek = f.akceProMapu_([akceMapa({ stav: 'proběhlo' })], new Set(), KAL_DNES);
  assert.equal(vysledek.length, 0);
});

test('akceProMapu_: aktivní kategorie-filtr akci bez shody vynechá', () => {
  const vysledek = f.akceProMapu_([akceMapa({ kategorie: ['divadlo'] })], new Set(['koncerty']), KAL_DNES);
  assert.equal(vysledek.length, 0);
});

test('akceProMapu_: akce, co projde vším, se vrátí beze změny', () => {
  const a = akceMapa({});
  const vysledek = f.akceProMapu_([a], new Set(), KAL_DNES);
  assert.equal(vysledek.length, 1);
  assert.equal(vysledek[0], a);
});

test('akceProMapu_: prázdné/chybějící pole akcí nespadne', () => {
  assert.equal(f.akceProMapu_([], new Set(), KAL_DNES).length, 0);
  assert.equal(f.akceProMapu_(undefined, new Set(), KAL_DNES).length, 0);
});

test('akceProMapu_: chybějící 4. argument (filtr oblíbených míst) = beze změny, jako dřív', () => {
  const a = akceMapa({ mistoOblibene: false });
  assert.equal(f.akceProMapu_([a], new Set(), KAL_DNES).length, 1);
});

test('akceProMapu_: aktivní filtr oblíbených míst akci bez mistoOblibene vynechá', () => {
  const vysledek = f.akceProMapu_([akceMapa({ mistoOblibene: false })], new Set(), KAL_DNES, true);
  assert.equal(vysledek.length, 0);
});

test('akceProMapu_: aktivní filtr oblíbených míst + kategorie-filtr se kombinují', () => {
  const akce = [
    akceMapa({ mistoOblibene: true, kategorie: ['koncerty'] }),
    akceMapa({ mistoOblibene: true, kategorie: ['divadlo'] }),
    akceMapa({ mistoOblibene: false, kategorie: ['koncerty'] }),
  ];
  const vysledek = f.akceProMapu_(akce, new Set(['koncerty']), KAL_DNES, true);
  assert.equal(vysledek.length, 1);
  assert.equal(vysledek[0].mistoOblibene, true);
});

// ---------------------------------------------------------------------------
// v3.50: druhá úroveň filtru – dostupnePodkategorie_, filtrovatPodkategorii_
// ---------------------------------------------------------------------------

function akceKatPodkat(kategorie, podkategorie) { return { kategorie, podkategorie }; }

test('dostupnePodkategorie_: prázdný výběr hlavní kategorie ("Vše") → []', () => {
  const akce = [akceKatPodkat(['koncerty'], ['jazz/blues'])];
  shodneNapricRealmy(f.dostupnePodkategorie_(akce, new Set()), []);
  shodneNapricRealmy(f.dostupnePodkategorie_(akce, null), []);
});

test('dostupnePodkategorie_: sjednotí podkategorie jen z akcí patřících do vybrané hlavní kategorie', () => {
  const akce = [
    akceKatPodkat(['koncerty'], ['jazz/blues']),
    akceKatPodkat(['koncerty'], ['klasika', 'jazz/blues']),
    akceKatPodkat(['divadlo'], ['činohra']),
  ];
  const vysledek = f.dostupnePodkategorie_(akce, new Set(['koncerty']));
  shodneNapricRealmy(vysledek, ['jazz/blues', 'klasika']);   // unikátní, řazené
});

test('dostupnePodkategorie_: akce bez pole podkategorie nespadne (chybějící = žádný příspěvek)', () => {
  const akce = [{ kategorie: ['koncerty'] }];
  shodneNapricRealmy(f.dostupnePodkategorie_(akce, new Set(['koncerty'])), []);
});

test('dostupnePodkategorie_: v3.51 – folklorní region kombinované akce (folklor+koncerty) se nenabídne pod jinou kategorií, jen pod folklorem', () => {
  const akce = [akceKatPodkat(['koncerty', 'folklor'], ['Slovácko/Podluží'])];
  shodneNapricRealmy(f.dostupnePodkategorie_(akce, new Set(['koncerty'])), []);
  shodneNapricRealmy(f.dostupnePodkategorie_(akce, new Set(['folklor'])), ['Slovácko/Podluží']);
});

test('dostupnePodkategorie_: prázdné/chybějící pole akcí nespadne', () => {
  shodneNapricRealmy(f.dostupnePodkategorie_([], new Set(['koncerty'])), []);
  shodneNapricRealmy(f.dostupnePodkategorie_(undefined, new Set(['koncerty'])), []);
});

test('filtrovatPodkategorii_: prázdná/chybějící množina vrátí pole beze změny', () => {
  const akce = [akceKatPodkat(['koncerty'], ['jazz/blues'])];
  assert.equal(f.filtrovatPodkategorii_(akce, new Set()), akce);
  assert.equal(f.filtrovatPodkategorii_(akce, null), akce);
});

test('filtrovatPodkategorii_: neprázdná množina ponechá jen akce s průnikem', () => {
  const akce = [
    akceKatPodkat(['koncerty'], ['jazz/blues']),
    akceKatPodkat(['koncerty'], ['klasika']),
  ];
  const vysledek = f.filtrovatPodkategorii_(akce, new Set(['jazz/blues']));
  assert.equal(vysledek.length, 1);
});

test('akceProMapu_: chybějící 5. argument (podkategorie-filtr) = beze změny, jako dřív', () => {
  const a = akceMapa({ podkategorie: ['jazz/blues'] });
  assert.equal(f.akceProMapu_([a], new Set(), KAL_DNES, false).length, 1);
});

test('akceProMapu_: aktivní podkategorie-filtr akci bez shody vynechá', () => {
  const vysledek = f.akceProMapu_(
    [akceMapa({ podkategorie: ['klasika'] })], new Set(), KAL_DNES, false, new Set(['jazz/blues']));
  assert.equal(vysledek.length, 0);
});

// ---------------------------------------------------------------------------
// v3.38: akceDnePodleData_ (tooltip v kalendáři) a seskupitPodleSouradnic_
// (seskupené piny na mapě).
// ---------------------------------------------------------------------------

test('akceDnePodleData_: jedna akce → mapa s jedním dnem a jedním názvem', () => {
  const m = f.akceDnePodleData_([{ stav: 'potvrzeno', datumOd: '15. 8. 2026', url: '', nazev: 'Koncert' }], KAL_DNES);
  shodneNapricRealmy([...m.keys()], ['2026-08-15']);
  shodneNapricRealmy(m.get('2026-08-15'), ['Koncert']);
});

test('akceDnePodleData_: víc akcí stejný den → pole víc názvů, pořadí podle vstupu', () => {
  const m = f.akceDnePodleData_([
    { stav: 'potvrzeno', datumOd: '15. 8. 2026', url: '', nazev: 'Koncert' },
    { stav: 'potvrzeno', datumOd: '15. 8. 2026', url: '', nazev: 'Festival' },
  ], KAL_DNES);
  shodneNapricRealmy(m.get('2026-08-15'), ['Koncert', 'Festival']);
});

test('akceDnePodleData_: stav "proběhlo" se vynechá (stejný filtr jako dnySAkcemi_)', () => {
  const m = f.akceDnePodleData_([{ stav: 'proběhlo', datumOd: '15. 8. 2026', url: '', nazev: 'X' }], KAL_DNES);
  assert.equal(m.size, 0);
});

test('akceDnePodleData_: neověřená bez URL a budoucí datum se vynechá', () => {
  const m = f.akceDnePodleData_([{ stav: 'neověřeno', datumOd: '20. 8. 2026', url: '', nazev: 'X' }], KAL_DNES);
  assert.equal(m.size, 0);
});

test('akceDnePodleData_: nevalidní/chybějící datumOd se přeskočí bez pádu', () => {
  const m = f.akceDnePodleData_([{ stav: 'potvrzeno', datumOd: '', url: '', nazev: 'X' }], KAL_DNES);
  assert.equal(m.size, 0);
});

test('akceDnePodleData_: prázdné/chybějící pole akcí nespadne', () => {
  assert.equal(f.akceDnePodleData_([], KAL_DNES).size, 0);
  assert.equal(f.akceDnePodleData_(undefined, KAL_DNES).size, 0);
});

test('dnySAkcemi_ a akceDnePodleData_ dávají konzistentní dny (odvozeno v3.38)', () => {
  const akce = [
    { stav: 'potvrzeno', datumOd: '15. 8. 2026', url: '', nazev: 'A' },
    { stav: 'proběhlo', datumOd: '10. 8. 2026', url: '', nazev: 'B' },
  ];
  const dny = f.dnySAkcemi_(akce, KAL_DNES);
  const podleDne = f.akceDnePodleData_(akce, KAL_DNES);
  shodneNapricRealmy([...dny], [...podleDne.keys()]);
});

// ---------------------------------------------------------------------------
// v3.40: vypocitejPoziciTooltipuKalendare_ (tooltip v hranicích #kat-sidebar)
// ---------------------------------------------------------------------------

test('vypocitejPoziciTooltipuKalendare_: dost místa vpravo → left = levý okraj buňky', () => {
  const cellRect = { left: 20, bottom: 100 };
  const sidebarRect = { left: 0, right: 300 };
  const pozice = f.vypocitejPoziciTooltipuKalendare_(cellRect, sidebarRect, 240);
  assert.equal(pozice.left, 20);
  assert.equal(pozice.top, 104);
});

test('vypocitejPoziciTooltipuKalendare_: buňka u pravého okraje sidebaru → zarovná se k pravému okraji sidebaru (žádný přesah)', () => {
  const cellRect = { left: 280, bottom: 200 };
  const sidebarRect = { left: 0, right: 300 };
  const pozice = f.vypocitejPoziciTooltipuKalendare_(cellRect, sidebarRect, 240);
  assert.equal(pozice.left, 300 - 240);
  assert.ok(pozice.left + 240 <= sidebarRect.right);
});

test('vypocitejPoziciTooltipuKalendare_: sidebar užší než tooltip → left nikdy pod levý okraj sidebaru', () => {
  const cellRect = { left: 10, bottom: 50 };
  const sidebarRect = { left: 0, right: 168 };   // typický ≥900px sidebar (200px - padding)
  const pozice = f.vypocitejPoziciTooltipuKalendare_(cellRect, sidebarRect, 240);
  assert.equal(pozice.left, 0);
});

function akceMisto(over) {
  return Object.assign({ id: 'a', nazev: 'Akce', lat: 49.2, lng: 16.6 }, over);
}

test('seskupitPodleSouradnic_: dvě akce na identických souřadnicích → jedna skupina, 2 akce', () => {
  const skupiny = f.seskupitPodleSouradnic_([akceMisto({ id: 'a' }), akceMisto({ id: 'b' })]);
  assert.equal(skupiny.length, 1);
  assert.equal(skupiny[0].akce.length, 2);
});

test('seskupitPodleSouradnic_: rozdíl na 4. desetinném místě (~11m) → dvě skupiny', () => {
  const skupiny = f.seskupitPodleSouradnic_([
    akceMisto({ id: 'a', lat: 49.1000, lng: 16.6000 }),
    akceMisto({ id: 'b', lat: 49.1001, lng: 16.6000 }),
  ]);
  assert.equal(skupiny.length, 2);
});

test('seskupitPodleSouradnic_: rozdíl jen za 5. desetinným místem → stejná skupina (zaokrouhlení ~1m)', () => {
  const skupiny = f.seskupitPodleSouradnic_([
    akceMisto({ id: 'a', lat: 49.123451, lng: 16.654321 }),
    akceMisto({ id: 'b', lat: 49.123454, lng: 16.654324 }),
  ]);
  assert.equal(skupiny.length, 1);
  assert.equal(skupiny[0].akce.length, 2);
});

test('seskupitPodleSouradnic_: jedna akce → jedna skupina s polem o délce 1', () => {
  const skupiny = f.seskupitPodleSouradnic_([akceMisto({})]);
  assert.equal(skupiny.length, 1);
  assert.equal(skupiny[0].akce.length, 1);
  assert.equal(skupiny[0].lat, 49.2);
  assert.equal(skupiny[0].lng, 16.6);
});

test('seskupitPodleSouradnic_: prázdné/chybějící pole akcí nespadne', () => {
  assert.equal(f.seskupitPodleSouradnic_([]).length, 0);
  assert.equal(f.seskupitPodleSouradnic_(undefined).length, 0);
});

test('seskupitPodleSouradnic_: klíč skupiny odpovídá klicSouradnic_ (v3.41 – sdílený s výběrem pinů)', () => {
  const skupiny = f.seskupitPodleSouradnic_([akceMisto({})]);
  assert.equal(skupiny[0].klic, f.klicSouradnic_(49.2, 16.6));
});

// ---------------------------------------------------------------------------
// v3.41: sestavSeznamMist_ (F – seznam míst pod mapou)
// ---------------------------------------------------------------------------

test('sestavSeznamMist_: víc akcí na stejném místě → jeden řádek, pocet = počet akcí', () => {
  const mista = f.sestavSeznamMist_([
    akceMisto({ id: 'a', misto: 'Stadion' }),
    akceMisto({ id: 'b', misto: 'Stadion' }),
  ]);
  assert.equal(mista.length, 1);
  assert.equal(mista[0].nazev, 'Stadion');
  assert.equal(mista[0].pocet, 2);
  assert.equal(mista[0].klic, f.klicSouradnic_(49.2, 16.6));
});

test('sestavSeznamMist_: různá místa → víc řádků, seřazeno podle počtu akcí sestupně', () => {
  const mista = f.sestavSeznamMist_([
    akceMisto({ id: 'a', lat: 49.10, lng: 16.60, misto: 'Málo akcí' }),
    akceMisto({ id: 'b', lat: 49.20, lng: 16.70, misto: 'Hodně akcí' }),
    akceMisto({ id: 'c', lat: 49.20, lng: 16.70, misto: 'Hodně akcí' }),
  ]);
  assert.equal(mista.length, 2);
  assert.equal(mista[0].nazev, 'Hodně akcí');
  assert.equal(mista[0].pocet, 2);
  assert.equal(mista[1].nazev, 'Málo akcí');
  assert.equal(mista[1].pocet, 1);
});

test('sestavSeznamMist_: chybějící a.misto → pojmenováno "Neznámé místo"', () => {
  const mista = f.sestavSeznamMist_([akceMisto({ misto: undefined })]);
  assert.equal(mista[0].nazev, 'Neznámé místo');
});

test('sestavSeznamMist_: prázdné/chybějící pole akcí nespadne', () => {
  assert.equal(f.sestavSeznamMist_([]).length, 0);
  assert.equal(f.sestavSeznamMist_(undefined).length, 0);
});

// ---------------------------------------------------------------------------
// v3.41: prepnoutVyberPinu_ (D – sdílený mechanismus "vybrané piny")
// ---------------------------------------------------------------------------

test('prepnoutVyberPinu_: klíč není v sadě → přidá ho, vrátí true', () => {
  const sada = new Set();
  const vysledek = f.prepnoutVyberPinu_(sada, 'a,b');
  assert.equal(vysledek, true);
  assert.equal(sada.has('a,b'), true);
});

test('prepnoutVyberPinu_: klíč už v sadě je → odebere ho, vrátí false', () => {
  const sada = new Set(['a,b']);
  const vysledek = f.prepnoutVyberPinu_(sada, 'a,b');
  assert.equal(vysledek, false);
  assert.equal(sada.has('a,b'), false);
});

test('prepnoutVyberPinu_: opakovaný toggle stejného klíče se chová konzistentně (select/deselect/select)', () => {
  const sada = new Set();
  assert.equal(f.prepnoutVyberPinu_(sada, 'x'), true);
  assert.equal(f.prepnoutVyberPinu_(sada, 'x'), false);
  assert.equal(f.prepnoutVyberPinu_(sada, 'x'), true);
  assert.equal(sada.size, 1);
});

test('prepnoutVyberPinu_: ostatní klíče v sadě zůstanou nedotčené', () => {
  const sada = new Set(['jiny-klic']);
  f.prepnoutVyberPinu_(sada, 'novy-klic');
  assert.equal(sada.has('jiny-klic'), true);
  assert.equal(sada.has('novy-klic'), true);
});

// ---------------------------------------------------------------------------
// v3.44: spocitejStatistikuVyberu_ (O – mini statistika pod mapou)
// ---------------------------------------------------------------------------

test('spocitejStatistikuVyberu_: jedna akce → 1 akce, 1 místo, počet kategorií podle pole', () => {
  const s = f.spocitejStatistikuVyberu_([akceMisto({ kategorie: ['koncerty', 'festivaly'] })]);
  assert.equal(s.pocetAkci, 1);
  assert.equal(s.pocetMist, 1);
  assert.equal(s.pocetKategorii, 2);
});

test('spocitejStatistikuVyberu_: víc akcí na stejném místě → pocetMist počítá unikátně (stejný klíč jako sestavSeznamMist_)', () => {
  const s = f.spocitejStatistikuVyberu_([
    akceMisto({ id: 'a', kategorie: ['koncerty'] }),
    akceMisto({ id: 'b', kategorie: ['divadlo'] }),
  ]);
  assert.equal(s.pocetAkci, 2);
  assert.equal(s.pocetMist, 1);
});

test('spocitejStatistikuVyberu_: kategorie se deduplikují napříč akcemi', () => {
  const s = f.spocitejStatistikuVyberu_([
    akceMisto({ id: 'a', lat: 49.10, lng: 16.60, kategorie: ['koncerty', 'festivaly'] }),
    akceMisto({ id: 'b', lat: 49.20, lng: 16.70, kategorie: ['festivaly'] }),
  ]);
  assert.equal(s.pocetMist, 2);
  assert.equal(s.pocetKategorii, 2);
});

test('spocitejStatistikuVyberu_: chybějící/prázdné pole kategorie nespadne', () => {
  const s = f.spocitejStatistikuVyberu_([akceMisto({ kategorie: undefined }), akceMisto({ id: 'b', kategorie: [] })]);
  assert.equal(s.pocetKategorii, 0);
});

test('spocitejStatistikuVyberu_: prázdné/chybějící pole akcí nespadne', () => {
  const prazdne = f.spocitejStatistikuVyberu_([]);
  assert.equal(prazdne.pocetAkci, 0);
  assert.equal(prazdne.pocetMist, 0);
  assert.equal(prazdne.pocetKategorii, 0);
  const chybejici = f.spocitejStatistikuVyberu_(undefined);
  assert.equal(chybejici.pocetAkci, 0);
});

// ---------------------------------------------------------------------------
// v3.44: vycistitVyberPinu_ (Q – reset výběru pinů)
// ---------------------------------------------------------------------------

test('vycistitVyberPinu_: vyprázdní neprázdnou sadu', () => {
  const sada = new Set(['a', 'b', 'c']);
  f.vycistitVyberPinu_(sada);
  assert.equal(sada.size, 0);
});

test('vycistitVyberPinu_: na prázdné sadě je no-op, nespadne', () => {
  const sada = new Set();
  f.vycistitVyberPinu_(sada);
  assert.equal(sada.size, 0);
});
