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
  'sestavFiltry_', 'pinVypadaPlatne_', 'sestavFetchPozadavek_',
  'klicUlozenychChipu_', 'serializovatKategorie_', 'deserializovatKategorie_',
  'sestavOdkazNaAkci_', 'parsovatOdkazNaAkci_',
  'sestavOdkazNaVyber_', 'parsovatOdkazNaVyber_',
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

test('sestavTextSdileni_: kompletní akce – název, odrážka s datem+místem, odrážka s odkazem, 1 prázdný řádek na konci', () => {
  const text = f.sestavTextSdileni_({
    nazev: 'Balkan Night', datumOd: '7. 8. 2026', misto: 'Špilberk', url: 'https://example.com',
  });
  assert.equal(text, 'Balkan Night\n• 7. 8. 2026 · Špilberk\n• Odkaz: https://example.com\n');
});

test('sestavTextSdileni_: chybějící misto – odrážka jen s datem, žádná osamocená čárka', () => {
  const text = f.sestavTextSdileni_({ nazev: 'X', datumOd: '7. 8. 2026', misto: '', url: '' });
  assert.equal(text, 'X\n• 7. 8. 2026\n');
});

test('sestavTextSdileni_: chybějící datum i misto – žádná odrážka s datem, jen název + prázdný řádek', () => {
  const text = f.sestavTextSdileni_({ nazev: 'X', datumOd: '', misto: '', url: '' });
  assert.equal(text, 'X\n');
});

test('sestavTextSdileni_: bez url se odrážka s odkazem vynechá', () => {
  const text = f.sestavTextSdileni_({ nazev: 'X', datumOd: '1. 1. 2026', misto: 'Y', url: '' });
  assert.equal(text, 'X\n• 1. 1. 2026 · Y\n');
});

test('sestavTextSdileni_: chybějící nazev nepadá (prázdný první řádek)', () => {
  const text = f.sestavTextSdileni_({ datumOd: '1. 1. 2026' });
  assert.equal(text, '\n• 1. 1. 2026\n');
});

test('v3.22: sestavTextSdileni_ – vždy končí přesně JEDNÍM prázdným řádkem, ne víc', () => {
  const varianty = [
    { nazev: 'A', datumOd: 'd', misto: 'm', url: 'u' },
    { nazev: 'A', datumOd: '', misto: '', url: '' },
    { nazev: '', datumOd: '', misto: '', url: '' },
  ];
  varianty.forEach(a => {
    const text = f.sestavTextSdileni_(a);
    assert.ok(text.endsWith('\n'), 'text má končit jedním \\n: ' + JSON.stringify(text));
    assert.ok(!text.endsWith('\n\n'), 'text NESMÍ končit dvěma a víc \\n: ' + JSON.stringify(text));
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
