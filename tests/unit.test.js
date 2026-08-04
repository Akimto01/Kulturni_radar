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

// ---------------------------------------------------------------------------
// v3.5: cellText_ – tři podoby buňky (regrese bugů z 2. 8. 2026)
// ---------------------------------------------------------------------------

test('cellText_: Date objekt → "d. M. yyyy"', () => {
  assert.equal(r.cellText_(new r.__Date(2026, 7, 2)), '2. 8. 2026');
});

test('BUG v3.2: sériové číslo 46156 → "14. 5. 2026", ne surové číslo', () => {
  assert.equal(r.cellText_(46156), '14. 5. 2026');
});

test('BUG v3.2: čas uložený jako datum r. 1899 → "H:mm"', () => {
  assert.equal(r.cellText_(new r.__Date(1899, 11, 30, 18, 30)), '18:30');
});

test('cellText_: string projde beze změny (oříznutý)', () => {
  assert.equal(r.cellText_('  3. 8. 2026 '), '3. 8. 2026');
  assert.equal(r.cellText_('čtvrtky a soboty 18:00–22:00'), 'čtvrtky a soboty 18:00–22:00');
});

test('cellText_: null/undefined → prázdný řetězec; malé číslo zůstane textem', () => {
  assert.equal(r.cellText_(null), '');
  assert.equal(r.cellText_(undefined), '');
  assert.equal(r.cellText_(7), '7');
});

// ---------------------------------------------------------------------------
// v3.5: sklonuj_ – konec „Samotest: 1 problémů"
// ---------------------------------------------------------------------------

test('sklonuj_: 1 problém / 2–4 problémy / 0 a 5+ problémů', () => {
  const s = n => n + ' ' + r.sklonuj_(n, 'problém', 'problémy', 'problémů');
  assert.equal(s(1), '1 problém');
  assert.equal(s(2), '2 problémy');
  assert.equal(s(4), '4 problémy');
  assert.equal(s(5), '5 problémů');
  assert.equal(s(11), '11 problémů');
  assert.equal(s(0), '0 problémů');
});

// ---------------------------------------------------------------------------
// v3.5: fetchJson_ / weatherFor_ – odolnost vůči výpadku Open-Meteo
// ---------------------------------------------------------------------------

/** Stub UrlFetchApp.fetch: odbavuje frontu odpovědí; 'throw' simuluje síťovou chybu. */
function frontaFetchu(fronta, volane = []) {
  return (url) => {
    volane.push(url);
    const dalsi = fronta.shift();
    if (dalsi === undefined) throw new Error('Stub: fronta odpovědí je prázdná');
    if (dalsi === 'throw') throw new Error('síť spadla');
    return { getResponseCode: () => dalsi.code, getContentText: () => JSON.stringify(dalsi.body) };
  };
}

const GEO_BRNO = { code: 200, body: { results: [{ latitude: 49.19, longitude: 16.61 }] } };
const FORECAST = {
  code: 200,
  body: { daily: { time: ['2026-08-03'], weather_code: [1], temperature_2m_max: [27.4], precipitation_probability_max: [10] } },
};

test('v3.5: weatherFor_ přežije jeden výpadek předpovědi (retry)', () => {
  const ctx = nactiRadar({ urlFetch: frontaFetchu([GEO_BRNO, { code: 500, body: {} }, FORECAST]) });
  const w = ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 3), {});
  assert.equal(w, 'polojasno, max 27 °C, srážky 10 %');
  assert.equal(ctx.__sleepMs.length, 1, 'mezi pokusy je právě jedna pauza');
});

test('v3.5: weatherFor_ přežije síťovou výjimku při geokódování (retry)', () => {
  const ctx = nactiRadar({ urlFetch: frontaFetchu(['throw', GEO_BRNO, FORECAST]) });
  const w = ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 3), {});
  assert.equal(w, 'polojasno, max 27 °C, srážky 10 %');
});

test('v3.5: úplný výpadek → prázdný řetězec, žádný pád, výsledek se cachuje', () => {
  const volane = [];
  const ctx = nactiRadar({ urlFetch: frontaFetchu(['throw', 'throw'], volane) });
  const cache = {};
  assert.equal(ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 3), cache), '');
  assert.equal(ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 3), cache), '', 'druhé volání jde z cache');
  assert.equal(volane.length, 2, 'jen 2 pokusy geokódování, cache brání dalším');
});

test('v3.5: weatherApiDostupne_ – true při 200, false při výpadku', () => {
  const ok = nactiRadar({ urlFetch: frontaFetchu([FORECAST]) });
  assert.equal(ok.weatherApiDostupne_(), true);
  const down = nactiRadar({ urlFetch: frontaFetchu([{ code: 503, body: {} }, 'throw']) });
  assert.equal(down.weatherApiDostupne_(), false);
});

// ---------------------------------------------------------------------------
// v3.5: číslo verze má jediný zdroj pravdy (regrese: meta hlásila 3.4 u kódu 3.5)
// ---------------------------------------------------------------------------

test('BUG v3.5: konstanta VERZE souhlasí s hlavičkou souboru a meta ji používá', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const zdroj = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'kulturni_radar.gs'), 'utf8');
  const hlavicka = zdroj.match(/\* Verze: (\d+\.\d+)/);
  const konstanta = zdroj.match(/const VERZE = '([^']+)'/);
  assert.ok(hlavicka, 'hlavička obsahuje číslo verze');
  assert.ok(konstanta, 'existuje const VERZE');
  assert.equal(konstanta[1], hlavicka[1], 'const VERZE == verze v hlavičce');
  assert.ok(zdroj.includes('verze: VERZE'), 'meta API bere verzi z konstanty, ne z literálu');
  assert.ok(!/verze:\s*'\d/.test(zdroj), 'žádný natvrdo zapsaný literál verze v API');
});

// ---------------------------------------------------------------------------
// v3.6: renderery digestu – text (ntfy) a HTML (e-mail)
// ---------------------------------------------------------------------------

const BLOKY = [
  { nadpis: 'Divadlo', polozky: [
    { titulek: '3. 8. 2026 — Léto s operou 2026 – Špilberk', detaily: ['probíhá od 31. 7. 2026', 'čas: průběžně'] },
  ]},
  { nadpis: 'Stálá místa (8. 8. 2026)', polozky: [] },
  { nadpis: '· Zoo', polozky: [
    { titulek: 'Zoo Brno', detaily: ['otevřeno: 9:00–18:00', 'počasí (Brno): polojasno, max 27 °C'] },
  ]},
];

test('v3.6: renderDigestText_ – probíhá od má vlastní odsazený řádek', () => {
  const t = r.renderDigestText_('Brno · 3. 8.–9. 8.', BLOKY, 'https://tab.example');
  assert.ok(t.includes('• 3. 8. 2026 — Léto s operou 2026 – Špilberk\n   probíhá od 31. 7. 2026\n   čas: průběžně'));
  assert.ok(t.includes('Stálá místa (8. 8. 2026)\n'), 'hlavička míst bez dvojtečky, vlastní řádek');
  assert.ok(t.includes('· Zoo:'), 'typová podskupina míst');
  assert.ok(t.endsWith('Kompletní přehled: https://tab.example'));
});

test('v3.6: renderDigestHtml_ – odrážky s předsazením, detaily pod titulkem', () => {
  const h = r.renderDigestHtml_('Brno · 3. 8.–9. 8.', BLOKY, 'https://tab.example');
  assert.ok(h.includes('<ul style="margin:0;padding-left:20px">'));
  assert.ok(h.includes('<li style="margin:0 0 6px 0">3. 8. 2026 — Léto s operou 2026 – Špilberk<br>'));
  assert.ok(h.includes('>probíhá od 31. 7. 2026</span>'));
  assert.ok(h.includes('<strong>· Zoo</strong>'));
  assert.ok(h.includes('href="https://tab.example"'));
  assert.ok(!h.includes('undefined'));
});

test('v3.6: esc_ – HTML se v datech neinterpretuje', () => {
  assert.equal(r.esc_('Kino <Art> & "Scala"'), 'Kino &lt;Art&gt; &amp; &quot;Scala&quot;');
  assert.equal(r.esc_(null), '');
  const h = r.renderDigestHtml_('X', [{ nadpis: 'A<b>', polozky: [{ titulek: '1 < 2', detaily: [] }] }], 'u');
  assert.ok(h.includes('A&lt;b&gt;') && h.includes('1 &lt; 2'));
});

test('v3.6: sendNotification_ s HTML – e-mail dostane htmlBody, ntfy čistý text', () => {
  const ctx = nactiRadar({ properties: { NTFY_TOPIC: 'kanal', NOTIFY_EMAIL: 'ja@example.com' } });
  ctx.sendNotification_('Test', 'telo', '<b>telo</b>');
  const maily = ctx.__odeslaneEmaily;
  assert.equal(maily.length, 2);
  const ntfy = maily.find(m => m.komu.indexOf("ntfy-") === 0);
  const mail = maily.find(m => m.komu === "ja@example.com");
  assert.ok(ntfy && !ntfy.options, 'ntfy brána bez HTML');
  assert.ok(mail && mail.options && mail.options.htmlBody === '<b>telo</b>');
});

// ---------------------------------------------------------------------------
// v3.7: BUG „Brno bez času" – poslední kontrola profilu ztrácela čas
// ---------------------------------------------------------------------------

test('BUG v3.7: cellTextCas_ – Date s časem si čas nechá, půlnoc a stringy beze změny', () => {
  assert.equal(r.cellTextCas_(new r.__Date(2026, 7, 2, 8, 31)), '2. 8. 2026 8:31');
  assert.equal(r.cellTextCas_(new r.__Date(2026, 7, 2)), '2. 8. 2026');
  assert.equal(r.cellTextCas_('29. 7. 2026 22:49'), '29. 7. 2026 22:49');
  assert.equal(r.cellTextCas_(''), '');
});

// ---------------------------------------------------------------------------
// v3.8: BUG „Sat Dec 30 1899…" – readEventsInRange_ nepoužívala cellText_ pro čas
// ---------------------------------------------------------------------------

test('BUG v3.8: digest čte čas akce přes cellText_, ne přes syrové String(Date)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const zdroj = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'kulturni_radar.gs'), 'utf8');
  // readEventsInRange_ krmí digesty; readEventsApi_ krmí web – obě čtou čas ze
  // sloupce D (row[3]) a obě musí projít cellText_, jinak se u buňky typu
  // "jen čas" (Sheets ji interně ukládá jako Date epochy 30. 12. 1899) vypíše
  // syrové Date.toString() – přesně bug z 3. 8. 2026 v Balkan Night digestu.
  const start = zdroj.indexOf('function readEventsInRange_');
  assert.ok(start > -1, 'readEventsInRange_ existuje');
  const end = zdroj.indexOf('\n}', start);
  const telo = zdroj.slice(start, end);
  assert.ok(telo.includes('cas: cellText_(row[3])'), 'čas se čte přes cellText_');
  assert.ok(!/cas:\s*String\(row\[3\]/.test(telo), 'žádná regrese na syrové String(row[3])');
});

// ---------------------------------------------------------------------------
// v3.9: ⭐ Oblíbené + ✓ Navštívené – pure funkce nad OZNAČENÍM
// ---------------------------------------------------------------------------

test('oznaceniMapy_: sloučí oblíbené i navštívené pro stejné ID, ignoruje jiné ID', () => {
  const mapa = r.oznaceniMapy_([
    { id: '1', typ: 'oblibene', datum: '', nazev: '', misto: '' },
    { id: '1', typ: 'navstiveno', datum: '3. 8. 2026', nazev: '', misto: '' },
    { id: '2', typ: 'oblibene', datum: '', nazev: '', misto: '' },
  ]);
  // Objekty vznikají uvnitř vm sandboxu (jiný realm) – porovnávat po vlastnostech,
  // ne přes deepEqual/deepStrictEqual, který na cizí Object.prototype padá.
  assert.equal(mapa.get('1').oblibene, true);
  assert.equal(mapa.get('1').navstivenoDne, '3. 8. 2026');
  assert.equal(mapa.get('2').oblibene, true);
  assert.equal(mapa.get('2').navstivenoDne, null);
  assert.equal(mapa.get('3'), undefined);
});

test('toggleOznaceni_: přidá záznam, když ještě neexistuje (aktivni: true)', () => {
  const vysledek = r.toggleOznaceni_([], '42', 'oblibene', '3. 8. 2026', 'Balkan Night', 'Špilberk');
  assert.equal(vysledek.aktivni, true);
  assert.equal(vysledek.rows.length, 1);
  const zaznam = vysledek.rows[0];
  assert.equal(zaznam.id, '42');
  assert.equal(zaznam.typ, 'oblibene');
  assert.equal(zaznam.datum, '3. 8. 2026');
  assert.equal(zaznam.nazev, 'Balkan Night');
  assert.equal(zaznam.misto, 'Špilberk');
});

test('toggleOznaceni_: odebere existující záznam (aktivni: false), nesahá na jiné typy/ID', () => {
  const rows = [
    { id: '42', typ: 'oblibene', datum: '1. 8. 2026', nazev: 'A', misto: 'X' },
    { id: '42', typ: 'navstiveno', datum: '2. 8. 2026', nazev: 'A', misto: 'X' },
    { id: '7', typ: 'oblibene', datum: '', nazev: 'B', misto: 'Y' },
  ];
  const vysledek = r.toggleOznaceni_(rows, '42', 'oblibene', '3. 8. 2026', 'A', 'X');
  assert.equal(vysledek.aktivni, false);
  assert.equal(vysledek.rows.length, 2);
  assert.ok(vysledek.rows.some(row => row.id === '42' && row.typ === 'navstiveno'), 'navstiveno u 42 zůstává');
  assert.ok(vysledek.rows.some(row => row.id === '7'), 'jiné ID nedotčeno');
});

test('toggleOznaceni_: dvojité přepnutí je idempotentní no-op (přidat pak odebrat → prázdno)', () => {
  const prvni = r.toggleOznaceni_([], '1', 'navstiveno', '3. 8. 2026', 'X', 'Y');
  const druhy = r.toggleOznaceni_(prvni.rows, '1', 'navstiveno', '4. 8. 2026', 'X', 'Y');
  assert.equal(druhy.aktivni, false);
  assert.equal(druhy.rows.length, 0);
});

test('sirotciOznaceni_: najde jen záznamy s ID mimo platnou množinu', () => {
  const rows = [
    { id: '1', typ: 'oblibene' }, { id: '2', typ: 'navstiveno' }, { id: '3', typ: 'oblibene' },
  ];
  const sirotci = r.sirotciOznaceni_(rows, new Set(['1', '3']));
  assert.equal(sirotci.length, 1);
  assert.equal(sirotci[0].id, '2');
});

test('sirotciOznaceni_: prázdné OZNAČENÍ → žádní sirotci', () => {
  assert.equal(r.sirotciOznaceni_([], new Set(['1'])).length, 0);
});

test('v3.9: apiToggle_ typová validace – neplatný typ i neexistující ID vrací ok:false', () => {
  // I/O (Sheets) záměrně nestubujeme (viz harness) – ověřuje se živě přes runSelfTest
  // a ruční klik ve webové aplikaci. Zde jen validace vstupu, která I/O nepotřebuje.
  const ctx = nactiRadar();
  const vysledekTyp = ctx.apiToggle_({ getSheetByName: () => null }, '99', 'neplatny-typ');
  assert.equal(vysledekTyp.ok, false);
  assert.match(vysledekTyp.error, /typ/);
});

// ---------------------------------------------------------------------------
// v3.10: met.no jako záložní zdroj počasí (Open-Meteo je ze sdílených IP
// přerušovaně nedostupné – viz diagnóza z 3. 8. 2026)
// ---------------------------------------------------------------------------

test('metNoTextFor_: mapování symbol_code na český popis, prázdné → proměnlivo', () => {
  assert.equal(r.metNoTextFor_('clearsky_day'), 'jasno');
  assert.equal(r.metNoTextFor_('fair_night'), 'skoro jasno');
  assert.equal(r.metNoTextFor_('partlycloudy_day'), 'polojasno');
  assert.equal(r.metNoTextFor_('cloudy'), 'zataženo');
  assert.equal(r.metNoTextFor_('rainshowers_day'), 'déšť');
  assert.equal(r.metNoTextFor_('heavyrainandthunder'), 'bouřky');
  assert.equal(r.metNoTextFor_('sleetshowers_day'), 'přeháňky');
  assert.equal(r.metNoTextFor_('snow'), 'sněžení');
  assert.equal(r.metNoTextFor_('fog'), 'mlha');
  assert.equal(r.metNoTextFor_(''), 'proměnlivo');
  assert.equal(r.metNoTextFor_(null), 'proměnlivo');
  assert.equal(r.metNoTextFor_('neznamy_kod'), 'proměnlivo');
});

const METNO_TIMESERIES = [
  { time: '2026-08-08T06:00:00Z', data: { instant: { details: { air_temperature: 18.2 } },
    next_1_hours: { summary: { symbol_code: 'fair_day' } } } },
  { time: '2026-08-08T12:00:00Z', data: { instant: { details: { air_temperature: 27.4 } },
    next_1_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
  { time: '2026-08-08T18:00:00Z', data: { instant: { details: { air_temperature: 23.0 } },
    next_6_hours: { summary: { symbol_code: 'cloudy' } } } },
  { time: '2026-08-09T06:00:00Z', data: { instant: { details: { air_temperature: 15.0 } },
    next_1_hours: { summary: { symbol_code: 'rain' } } } },
];

test('agregovatMetNoDen_: max teplota dne + symbol z okamžiku nejblíž poledni', () => {
  const den = r.agregovatMetNoDen_(METNO_TIMESERIES, '2026-08-08');
  assert.equal(den.maxTeplota, 27.4);          // ne 18.2 ani 23.0
  assert.equal(den.symbolCode, 'partlycloudy_day');  // 12:00 je nejblíž poledni, ne 06:00/18:00
});

test('agregovatMetNoDen_: jiný den ve stejné timeseries se nesmíchá', () => {
  const den = r.agregovatMetNoDen_(METNO_TIMESERIES, '2026-08-09');
  assert.equal(den.maxTeplota, 15.0);
  assert.equal(den.symbolCode, 'rain');
});

test('agregovatMetNoDen_: den mimo rozsah timeseries → null', () => {
  assert.equal(r.agregovatMetNoDen_(METNO_TIMESERIES, '2026-08-20'), null);
});

const METNO_FIXTURE = { code: 200, body: { properties: { timeseries: METNO_TIMESERIES } } };

test('v3.10: Open-Meteo selže úplně → weatherFor_ použije met.no jako fallback', () => {
  const ctx = nactiRadar({ urlFetch: frontaFetchu([GEO_BRNO, 'throw', 'throw', METNO_FIXTURE]) });
  const w = ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 8), {});
  assert.equal(w, 'polojasno, max 27 °C');   // met.no formát nemá „srážky %“
});

test('v3.10: Open-Meteo odpoví, ale bez dat pro konkrétní den → fallback na met.no', () => {
  const FORECAST_JINY_DEN = {
    code: 200,
    body: { daily: { time: ['2099-01-01'], weather_code: [1], temperature_2m_max: [10], precipitation_probability_max: [5] } },
  };
  const ctx = nactiRadar({ urlFetch: frontaFetchu([GEO_BRNO, FORECAST_JINY_DEN, METNO_FIXTURE]) });
  const w = ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 8), {});
  assert.equal(w, 'polojasno, max 27 °C');
});

test('v3.10: Open-Meteo funguje → met.no se vůbec nevolá (fronta by jinak spadla na prázdno)', () => {
  const ctx = nactiRadar({ urlFetch: frontaFetchu([GEO_BRNO, FORECAST]) });  // jen 2 položky, žádný met.no
  const w = ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 3), {});
  assert.equal(w, 'polojasno, max 27 °C, srážky 10 %');  // formát Open-Meteo, se srážkami
});

test('v3.10: oba zdroje selžou → prázdný řetězec, žádný pád', () => {
  const ctx = nactiRadar({ urlFetch: frontaFetchu(['throw', 'throw', 'throw', 'throw', 'throw']) });
  assert.equal(ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 8), {}), '');
});

test('v3.10: met.no fallback se cachuje – druhé volání pro stejnou obec nic dalšího nestahuje', () => {
  const volane = [];
  const ctx = nactiRadar({ urlFetch: frontaFetchu([GEO_BRNO, 'throw', 'throw', METNO_FIXTURE], volane) });
  const cache = {};
  const prvni = ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 8), cache);
  const druhy = ctx.weatherFor_('Brno', new ctx.__Date(2026, 7, 9), cache);   // jiný den, stejná obec
  assert.equal(prvni, 'polojasno, max 27 °C');
  assert.equal(druhy, 'déšť, max 15 °C');
  assert.equal(volane.length, 4, 'geocode + 2× Open-Meteo retry + 1× met.no – a víc nic, i pro druhé volání');
});

// ---------------------------------------------------------------------------
// v3.10: zahrnoutAkciDoVysledku_ – filtr apiEvents vytažen z readEventsApi_
// (dřív testováno jen nepřímo přes RF proti produkci; teď přímo, všechny
// kombinace stav × datum × zahrnoutOznacene × jeOznaceno)
// ---------------------------------------------------------------------------

test('proběhlá + neoznačená → skrytá, ať už zahrnoutOznacene je cokoli', () => {
  const dnes = new r.__Date(2026, 7, 3);
  assert.equal(r.zahrnoutAkciDoVysledku_('proběhlo', null, dnes, false, false), false);
  assert.equal(r.zahrnoutAkciDoVysledku_('proběhlo', null, dnes, true, false), false,
    'BUG-past-guard: zahrnoutOznacene samo o sobě nestačí – akce musí být SKUTEČNĚ označená');
});

test('proběhlá + označená: zobrazí se JEN když volající výslovně požádal (zahrnoutOznacene)', () => {
  const dnes = new r.__Date(2026, 7, 3);
  assert.equal(r.zahrnoutAkciDoVysledku_('proběhlo', null, dnes, true, true), true);
  assert.equal(r.zahrnoutAkciDoVysledku_('proběhlo', null, dnes, false, true), false,
    'bez zahrnoutOznacene zůstává proběhlá akce skrytá i když je označená (běžný web ji nechce)');
});

test('stará (datumOd < dnes), aktivní stav, neoznačená → skrytá', () => {
  const dnes = new r.__Date(2026, 7, 3);
  const stare = new r.__Date(2026, 6, 1);
  assert.equal(r.zahrnoutAkciDoVysledku_('', stare, dnes, false, false), false);
});

test('stará + označená + zahrnoutOznacene → zobrazí se jako inspirace', () => {
  const dnes = new r.__Date(2026, 7, 3);
  const stare = new r.__Date(2026, 6, 1);
  assert.equal(r.zahrnoutAkciDoVysledku_('', stare, dnes, true, true), true);
});

test('stará + stav „zrušeno" → zobrazí se VŽDY, i bez označení (info pro uživatele)', () => {
  const dnes = new r.__Date(2026, 7, 3);
  const stare = new r.__Date(2026, 6, 1);
  assert.equal(r.zahrnoutAkciDoVysledku_('zrušeno', stare, dnes, false, false), true);
});

test('budoucí nebo dnešní datum + aktivní stav → vždy zobrazí, bez ohledu na označení', () => {
  const dnes = new r.__Date(2026, 7, 3);
  const budouci = new r.__Date(2026, 7, 10);
  assert.equal(r.zahrnoutAkciDoVysledku_('', budouci, dnes, false, false), true);
  assert.equal(r.zahrnoutAkciDoVysledku_('', dnes, dnes, false, false), true, 'dnešek se počítá jako "ne starý"');
});

test('nerozparsovatelné datum (null) + aktivní stav → zobrazí se (chová se jako "ne staré")', () => {
  const dnes = new r.__Date(2026, 7, 3);
  assert.equal(r.zahrnoutAkciDoVysledku_('', null, dnes, false, false), true);
});

// ---------------------------------------------------------------------------
// jeVycpavka_ / normNazev_ / nazevTokens_ / isSameName_ / najdiDuplicity_
// (jádro dedupikace a hygieny dat – existující čisté funkce, dosud bez testů)
// ---------------------------------------------------------------------------

test('jeVycpavka_: rozpozná obecné „vycpávkové" názvy bez vlastního jména', () => {
  assert.equal(r.jeVycpavka_('Kulturní akce'), true);
  assert.equal(r.jeVycpavka_('Víkendová akce'), true);
  assert.equal(r.jeVycpavka_('Letní akce'), true);
  assert.equal(r.jeVycpavka_('Vícedenní akce'), true);
});

test('jeVycpavka_: konkrétní název akce (má vlastní jméno) není vycpávka', () => {
  assert.equal(r.jeVycpavka_('Balkan Night: Fanfare Ciocărlia'), false);
  assert.equal(r.jeVycpavka_('35. Mezinárodní kytarový festival Brno'), false);
});

test('jeVycpavka_: prázdný/null název → false, nepadá', () => {
  assert.equal(r.jeVycpavka_(''), false);
  assert.equal(r.jeVycpavka_(null), false);
  assert.equal(r.jeVycpavka_(undefined), false);
});

test('normNazev_: odstraní diakritiku, čísla i interpunkci, sjednotí mezery', () => {
  assert.equal(r.normNazev_('35. Mezinárodní kytarový festival!'), 'mezinarodni kytarovy festival');
  assert.equal(r.normNazev_('Šlechta na cestách'), 'slechta na cestach');
  assert.equal(r.normNazev_('  Hodně   mezer  '), 'hodne mezer');
});

test('nazevTokens_: jen slova od 3 znaků, jako množina (klíče objektu)', () => {
  const t = r.nazevTokens_('Já a Ty na Hradě');
  assert.deepEqual(Object.keys(t), ['hrade']);   // „já/a/ty/na“ mají všechna < 3 znaky
});

test('isSameName_: podmnožina tokenů = stejná akce (zkrácený název)', () => {
  const a = r.nazevTokens_('Balkan Night Maraton hudby');
  const b = r.nazevTokens_('Balkan Night');
  assert.equal(r.isSameName_(a, b), true);
});

test('isSameName_: 3+ společných slov = stejná akce, i když žádná není podmnožinou druhé', () => {
  const a = r.nazevTokens_('Letní shakespearovské slavnosti Špilberk Brno');
  const b = r.nazevTokens_('Shakespearovské slavnosti Špilberk zahradní verze');
  assert.equal(r.isSameName_(a, b), true);
});

test('isSameName_: jen 1 společné slovo (a není podmnožina) = různé akce', () => {
  const a = r.nazevTokens_('Festival Uprostřed léto');
  const b = r.nazevTokens_('Festival planet Brno');
  assert.equal(r.isSameName_(a, b), false);
});

test('isSameName_: prázdné tokeny (žádné slovo 3+ znaky) nikdy neshodují', () => {
  assert.equal(r.isSameName_({}, r.nazevTokens_('Cokoli')), false);
});

/** Minimální řádek AKCE pro najdiDuplicity_: jen sloupce, které funkce čte. */
function akceRadek({ nazev = '', profil = 'Brno', datumOd = '3. 8. 2026' } = {}) {
  const row = new Array(25).fill('');
  row[1] = datumOd; row[4] = nazev; row[24] = profil;
  return row;
}

test('najdiDuplicity_: druhý výskyt téhož názvu (stejný profil+den) je duplicita', () => {
  const data = [
    akceRadek({ nazev: 'Balkan Night' }),
    akceRadek({ nazev: 'Balkan Night' }),
  ];
  const dup = r.najdiDuplicity_(data);
  assert.equal(dup.length, 1);
  assert.equal(dup[0].keptRow, 2);   // první výskyt = řádek 2 (index 0 + 2)
  assert.equal(dup[0].rowNum, 3);    // druhý výskyt = řádek 3
});

test('najdiDuplicity_: stejný název, ale jiný profil → NENÍ duplicita', () => {
  const data = [
    akceRadek({ nazev: 'Balkan Night', profil: 'Brno' }),
    akceRadek({ nazev: 'Balkan Night', profil: 'Ostrava' }),
  ];
  assert.equal(r.najdiDuplicity_(data).length, 0);
});

test('najdiDuplicity_: stejný název, ale jiný den → NENÍ duplicita', () => {
  const data = [
    akceRadek({ nazev: 'Balkan Night', datumOd: '3. 8. 2026' }),
    akceRadek({ nazev: 'Balkan Night', datumOd: '10. 8. 2026' }),
  ];
  assert.equal(r.najdiDuplicity_(data).length, 0);
});

test('najdiDuplicity_: mírně odlišné znění stejné akce se chytí (fuzzy shoda přes tokeny)', () => {
  const data = [
    akceRadek({ nazev: 'Balkan Night: Fanfare Ciocărlia + Džambo Aguševi Orchestra' }),
    akceRadek({ nazev: 'Balkan Night na Špilberku – Fanfare Ciocărlia' }),
  ];
  assert.equal(r.najdiDuplicity_(data).length, 1);
});

test('najdiDuplicity_: řádek bez názvu se ignoruje (nepadá, není falešná duplicita)', () => {
  const data = [akceRadek({ nazev: '' }), akceRadek({ nazev: '' })];
  assert.equal(r.najdiDuplicity_(data).length, 0);
});

test('najdiDuplicity_: tři různé akce ve stejný den = žádná duplicita', () => {
  const data = [
    akceRadek({ nazev: 'Festival planet Brno' }),
    akceRadek({ nazev: 'Léto na Zelňáku' }),
    akceRadek({ nazev: 'Výstava Fotografie' }),
  ];
  assert.equal(r.najdiDuplicity_(data).length, 0);
});

// ---------------------------------------------------------------------------
// v3.12: BUG „Tue Aug 04 2026 00:00:00 GMT…" – readOznaceni_ nepoužívala
// cellText_ pro sloupec Datum označení (stejný vzorec jako bug v3.8)
// ---------------------------------------------------------------------------

test('BUG v3.12: readOznaceni_ čte datum přes cellText_, ne přes syrové String(Date)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const zdroj = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'kulturni_radar.gs'), 'utf8');
  const start = zdroj.indexOf('function readOznaceni_');
  const end = zdroj.indexOf('\n}', start);
  const telo = zdroj.slice(start, end);
  assert.ok(telo.includes('datum: cellText_(r[2])'), 'datum se čte přes cellText_');
  assert.ok(!/datum:\s*String\(r\[2\]/.test(telo), 'žádná regrese na syrové String(r[2])');
});

// ---------------------------------------------------------------------------
// parseEvents_ – záchranný parser textové odpovědi modelu (fallback, když
// model navzdory instrukcím nezavolá nástroj report_events strukturovaně).
// V provozu se spouští zřídka, ale právě proto je důležité mít ho testovaný –
// je to jediné místo, které chytá skutečně pokažené/nedokončené odpovědi AI.
// ---------------------------------------------------------------------------

const AKCE_MINI = '{"id":"2026-08-06-test","datum_od":"6. 8. 2026","nazev":"Test akce","misto":"Sál","obec":"Brno","kategorie":"koncerty","stav":"potvrzeno"}';

test('parseEvents_: čisté validní JSON pole se naparsuje přímo', () => {
  const text = '[' + AKCE_MINI + ']';
  const ev = r.parseEvents_(text);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].nazev, 'Test akce');
});

test('parseEvents_: prázdné pole [] je platný výsledek (0 akcí), ne selhání', () => {
  const ev = r.parseEvents_('[]');
  assert.ok(Array.isArray(ev));
  assert.equal(ev.length, 0);
});

test('parseEvents_: markdown ```json ohraničení se odstraní', () => {
  const text = '```json\n[' + AKCE_MINI + ']\n```';
  const ev = r.parseEvents_(text);
  assert.equal(ev.length, 1);
});

test('parseEvents_: komentář modelu před i za polem se ignoruje', () => {
  const text = 'Zde jsou nalezené akce:\n[' + AKCE_MINI + ']\nDoufám, že to pomůže!';
  const ev = r.parseEvents_(text);
  assert.equal(ev.length, 1);
});

test('parseEvents_: čárka navíc před ] nebo } se opraví (běžná chyba modelů)', () => {
  const text = '[' + AKCE_MINI.slice(0, -1) + ',},]';   // čárka před } i před ]
  const ev = r.parseEvents_(text);
  assert.equal(ev.length, 1);
});

test('parseEvents_: syrové konce řádků uvnitř textové hodnoty se sanitizují', () => {
  const rozbite = '[{"id":"x","datum_od":"6. 8. 2026","nazev":"Akce s\nnovým řádkem",' +
    '"misto":"Sál","obec":"Brno","kategorie":"koncerty","stav":"potvrzeno"}]';
  const ev = r.parseEvents_(rozbite);
  assert.equal(ev.length, 1);
  assert.ok(ev[0].nazev.includes('Akce s'));
});

test('parseEvents_: pause_turn restart – model vypíše pole dvakrát, vyhraje POSLEDNÍ kompletní', () => {
  const nedokoncene = '[{"id":"stary","nazev":"Neúplný pokus","datum_od":"';   // uťaté uprostřed
  const kompletni = '[' + AKCE_MINI + ']';
  const text = nedokoncene + '\n\n' + kompletni;
  const ev = r.parseEvents_(text);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].nazev, 'Test akce');   // ne "Neúplný pokus"
});

test('parseEvents_: useknutá odpověď (max_tokens) – zachrání kompletní záznamy, zahodí rozbitý poslední', () => {
  const druhaAkce = '{"id":"2026-08-07-x","datum_od":"7. 8. 2026","nazev":"Druhá akce",' +
    '"misto":"Y","obec":"Brno","kategorie":"divadlo","stav":"potvrzeno"}';
  const utata = '{"id":"2026-08-08-y","datum_od":"8. 8. 2026","nazev":"Uťatá tře';   // konec chybí
  const text = '[' + AKCE_MINI + ',' + druhaAkce + ',' + utata;   // bez uzavírací ] i }
  const ev = r.parseEvents_(text);
  assert.equal(ev.length, 2, 'zachrání jen 2 kompletní záznamy, uťatý třetí zahodí');
  assert.equal(ev[1].nazev, 'Druhá akce');
});

test('parseEvents_: žádná otevírací [ v textu → null (ne pád)', () => {
  assert.equal(r.parseEvents_('Omlouvám se, nic jsem nenašel.'), null);
});

test('parseEvents_: prázdný/undefined vstup → null', () => {
  assert.equal(r.parseEvents_(''), null);
  assert.equal(r.parseEvents_(undefined), null);
  assert.equal(r.parseEvents_(null), null);
});

test('parseEvents_: zcela nezáchranný text (jen otevírací [, nic rozumného za ní) → null', () => {
  assert.equal(r.parseEvents_('text [ dalsi text bez zavorky nebo objektu'), null);
});

test('parseEvents_: víc akcí v poli se zachová v pořadí', () => {
  const b = '{"id":"b","datum_od":"7. 8. 2026","nazev":"B","misto":"X","obec":"Brno","kategorie":"divadlo","stav":"potvrzeno"}';
  const ev = r.parseEvents_('[' + AKCE_MINI + ',' + b + ']');
  assert.equal(ev.length, 2);
  assert.equal(ev[0].nazev, 'Test akce');
  assert.equal(ev[1].nazev, 'B');
});

// ---------------------------------------------------------------------------
// eventToRow_ – mapování akce z API na řádek tabulky AKCE (sloupce A–V)
// ---------------------------------------------------------------------------

test('eventToRow_: kompletní akce se namapuje na 22 sloupců ve správném pořadí', () => {
  const ev = {
    id: 'x', datum_od: '6. 8. 2026', datum_do: '', cas: '20:00', nazev: 'Test',
    misto: 'Sál', obec: 'Brno', dojezd: '10 min', kategorie: 'koncerty',
    podkategorie: '', cena: 'zdarma', popis: 'Popis', skore: 8, stav: 'potvrzeno',
    primarni_zdroj: 'web', url: 'https://x.cz', dalsi_zdroj: '', poznamka: '',
  };
  const row = r.eventToRow_(ev, '4. 8. 2026');
  assert.equal(row.length, 22);
  assert.equal(row[0], 'x');
  assert.equal(row[4], 'Test');
  assert.equal(row[13], 'potvrzeno');
  assert.equal(row[16], '4. 8. 2026');   // Q: První nález = injektované "today"
  assert.equal(row[17], '4. 8. 2026');   // R: Poslední kontrola
});

test('eventToRow_: chybějící stav dostane výchozí "potvrzeno"; chybějící pole prázdný řetězec', () => {
  const row = r.eventToRow_({ id: 'x', nazev: 'Test' }, '4. 8. 2026');
  assert.equal(row[13], 'potvrzeno');
  assert.equal(row[1], '');    // datum_od chybí → ''
  assert.equal(row[7], '');    // dojezd chybí → ''
});

test('eventToRow_: nová akce vždy start "NE"/"NE" pro Novinka/Změna (upsert je pak přepíše)', () => {
  const row = r.eventToRow_({ id: 'x' }, '4. 8. 2026');
  assert.equal(row[14], 'NE');
  assert.equal(row[15], 'NE');
});

// ---------------------------------------------------------------------------
// v3.14: Souřadnice akcí (Nominatim) – cache + geokódování na pozadí
// ---------------------------------------------------------------------------

test('klicSouradnic_: stejné misto+obec dá stejný klíč bez ohledu na velikost písmen', () => {
  assert.equal(r.klicSouradnic_('Zelný trh', 'Brno'), r.klicSouradnic_('zelný trh', 'BRNO'));
});

test('klicSouradnic_: různá místa dají různý klíč; klíč je vždy neprázdný řetězec', () => {
  assert.notEqual(r.klicSouradnic_('Zelný trh', 'Brno'), r.klicSouradnic_('Špilberk', 'Brno'));
  assert.equal(typeof r.klicSouradnic_('', ''), 'string');
});

test('sestavDotazGeokodovani_: misto+obec spojené čárkou, vždy s „Česko“', () => {
  assert.equal(r.sestavDotazGeokodovani_('Zelný trh', 'Brno'), 'Zelný trh, Brno, Česko');
});

test('sestavDotazGeokodovani_: jen obec (misto chybí) funguje taky', () => {
  assert.equal(r.sestavDotazGeokodovani_('', 'Brno'), 'Brno, Česko');
});

test('sestavDotazGeokodovani_: oboje prázdné → prázdný dotaz (nevolat Nominatim)', () => {
  assert.equal(r.sestavDotazGeokodovani_('', ''), '');
});

test('souradniceMapy_: pole řádků → Map podle klíče', () => {
  const mapa = r.souradniceMapy_([
    { klic: 'brno|zelny trh', lat: 49.19, lng: 16.61 },
    { klic: 'brno|spilberk', lat: 49.195, lng: 16.6 },
  ]);
  assert.equal(mapa.get('brno|zelny trh').lat, 49.19);
  assert.equal(mapa.size, 2);
});

const NOMINATIM_HIT = { code: 200, body: [{ lat: '49.1925', lon: '16.6087', display_name: 'Zelný trh, Brno' }] };
const NOMINATIM_PRAZDNO = { code: 200, body: [] };

test('geocodovatNominatim_: úspěšná shoda vrátí {lat, lng} jako čísla', () => {
  const ctx = nactiRadar({ urlFetch: frontaFetchu([NOMINATIM_HIT]) });
  const v = ctx.geocodovatNominatim_('Zelný trh, Brno, Česko');
  assert.equal(v.lat, 49.1925);
  assert.equal(v.lng, 16.6087);
});

test('geocodovatNominatim_: prázdný výsledek (nejednoznačný/nenalezený text) → null, ne pád', () => {
  const ctx = nactiRadar({ urlFetch: frontaFetchu([NOMINATIM_PRAZDNO]) });
  assert.equal(ctx.geocodovatNominatim_('nesmysl xyz, Česko'), null);
});

test('geocodovatNominatim_: prázdný dotaz → null bez síťového volání', () => {
  const volane = [];
  const ctx = nactiRadar({ urlFetch: frontaFetchu([], volane) });
  assert.equal(ctx.geocodovatNominatim_(''), null);
  assert.equal(volane.length, 0);
});

test('geocodovatNominatim_: výpadek Nominatim (retry z fetchJson_ vyčerpán) → null, ne pád', () => {
  const ctx = nactiRadar({ urlFetch: frontaFetchu(['throw', 'throw']) });
  assert.equal(ctx.geocodovatNominatim_('cokoli, Česko'), null);
});

test('geocodovatNominatim_: v URL je countrycodes=cz a dotaz je escapovaný', () => {
  const volane = [];
  const ctx = nactiRadar({ urlFetch: frontaFetchu([NOMINATIM_HIT], volane) });
  ctx.geocodovatNominatim_('Zelný trh, Brno, Česko');
  assert.ok(volane[0].includes('countrycodes=cz'));
  assert.ok(volane[0].includes(encodeURIComponent('Zelný trh, Brno, Česko')));
});

// ---------------------------------------------------------------------------
// v3.15: explicitní rubrika pro AI skóre (dřív jen "číslo 1–10" bez kritérií –
// viz zpětná vazba/rozhovor 4. 8. 2026 o významu čísla u hvězdičky)
// ---------------------------------------------------------------------------

test('BUG-vylepseni v3.15: prompt pro akce obsahuje konkrétní rubriku skóre, ne jen "číslo 1–10"', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const zdroj = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'kulturni_radar.gs'), 'utf8');
  const start = zdroj.indexOf('function callAnthropic_');
  const end = zdroj.indexOf('\nfunction ', start + 10);
  const telo = zdroj.slice(start, end);
  assert.ok(telo.includes('9–10'), 'rubrika definuje horní pásmo (9–10)');
  assert.ok(telo.includes('1–2'), 'rubrika definuje dolní pásmo (1–2)');
  assert.ok(!/skore = číslo 1–10;/.test(telo), 'starý holý popis bez rubriky už tam nesmí zůstat');
});

test('v3.15: prompt pro místa má taky rubriku skóre, ne jen "(atraktivita pro rodinu)"', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const zdroj = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'kulturni_radar.gs'), 'utf8');
  const start = zdroj.indexOf('function callAnthropicPlaces_');
  const end = zdroj.indexOf('\nfunction ', start + 10);
  const telo = zdroj.slice(start, end);
  assert.ok(telo.includes('9–10'));
  assert.ok(telo.includes('1–2'));
});

// ---------------------------------------------------------------------------
// callAnthropic_ – retry smyčka (pause_turn, end_turn, max_tokens), záchranné
// dovolání, chybové stavy. Dosud netestováno (jediné skutečné síťové jádro),
// teď otestovatelné díky stejnému UrlFetchApp stubu jako weatherFor_/Nominatim.
// ---------------------------------------------------------------------------

const CFG_TEST = { profil: 'Brno', rozsah: '3.–9. 8. 2026', dojezd: '90 min', kategorie: 'vše', maleAkce: 'ano', detske: 'ano' };
const ZDROJE_TEST = [{ nazev: 'Web města', priorita: 'vysoká', url: 'https://brno.cz' }];

function anthropicResp(data, code = 200) { return { code, body: data }; }

const AKCE_REPORT = { id: 'x', datum_od: '6. 8. 2026', nazev: 'Test', misto: 'Sál', obec: 'Brno', kategorie: 'koncerty', stav: 'potvrzeno' };

test('callAnthropic_: chybí ANTHROPIC_API_KEY → chyba hned, žádný síťový dotaz', () => {
  const volane = [];
  const ctx = nactiRadar({ properties: {}, urlFetch: frontaFetchu([], volane) });
  assert.throws(() => ctx.callAnthropic_(CFG_TEST, ZDROJE_TEST, 'denní kontrola'), /ANTHROPIC_API_KEY/);
  assert.equal(volane.length, 0);
});

test('callAnthropic_: model rovnou zavolá report_events → akce se vrátí přímo, 1 dotaz', () => {
  const volane = [];
  const resp = anthropicResp({
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: 'report_events', input: { events: [AKCE_REPORT] } }],
  });
  const ctx = nactiRadar({ properties: { ANTHROPIC_API_KEY: 'test-key' }, urlFetch: frontaFetchu([resp], volane) });
  const events = ctx.callAnthropic_(CFG_TEST, ZDROJE_TEST, 'denní kontrola');
  assert.equal(events.length, 1);
  assert.equal(events[0].nazev, 'Test');
  assert.equal(volane.length, 1);
});

test('callAnthropic_: pause_turn pokračuje druhým dotazem, report_events přijde až tam', () => {
  const pauza = anthropicResp({ stop_reason: 'pause_turn', content: [{ type: 'text', text: 'hledám dál…' }] });
  const finale = anthropicResp({
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: 'report_events', input: { events: [AKCE_REPORT] } }],
  });
  const volane = [];
  const ctx = nactiRadar({ properties: { ANTHROPIC_API_KEY: 'k' }, urlFetch: frontaFetchu([pauza, finale], volane) });
  const events = ctx.callAnthropic_(CFG_TEST, ZDROJE_TEST, 'denní kontrola');
  assert.equal(events.length, 1);
  assert.equal(volane.length, 2, 'dva dotazy – pauza + pokračování');
});

test('callAnthropic_: end_turn bez nástroje vyžádá odevzdání, uspěje na druhý pokus', () => {
  const bezNastroje = anthropicResp({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Tady jsou akce…' }] });
  const finale = anthropicResp({
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: 'report_events', input: { events: [AKCE_REPORT] } }],
  });
  const ctx = nactiRadar({ properties: { ANTHROPIC_API_KEY: 'k' }, urlFetch: frontaFetchu([bezNastroje, finale]) });
  const events = ctx.callAnthropic_(CFG_TEST, ZDROJE_TEST, 'denní kontrola');
  assert.equal(events.length, 1);
});

test('callAnthropic_: max_tokens useknutí – bez nástroje, ale text obsahuje platné JSON pole → zachráněno parseEvents_', () => {
  const utata = anthropicResp({
    stop_reason: 'max_tokens',
    content: [{ type: 'text', text: 'Nalezené akce:\n[' + JSON.stringify(AKCE_REPORT) + ']' }],
  });
  const volane = [];
  const ctx = nactiRadar({ properties: { ANTHROPIC_API_KEY: 'k' }, urlFetch: frontaFetchu([utata], volane) });
  const events = ctx.callAnthropic_(CFG_TEST, ZDROJE_TEST, 'denní kontrola');
  assert.equal(events.length, 1);
  assert.equal(volane.length, 1, 'zachráněno z první odpovědi, žádné další dovolání netřeba');
});

test('callAnthropic_: nerozparsovatelný text → druhé (formátovací) dovolání zachrání JSON', () => {
  const nesrozumitelne = anthropicResp({
    stop_reason: 'stop_sequence',
    content: [{ type: 'text', text: 'Omlouvám se, mám technické potíže s formátem odpovědi.' }],
  });
  const formatovaci = anthropicResp({
    content: [{ type: 'text', text: '[' + JSON.stringify(AKCE_REPORT) + ']' }],
  });
  const volane = [];
  const ctx = nactiRadar({ properties: { ANTHROPIC_API_KEY: 'k' }, urlFetch: frontaFetchu([nesrozumitelne, formatovaci], volane) });
  const events = ctx.callAnthropic_(CFG_TEST, ZDROJE_TEST, 'denní kontrola');
  assert.equal(events.length, 1);
  assert.equal(volane.length, 2, 'hlavní dotaz + formátovací záchrana');
});

test('callAnthropic_: selže i formátovací dovolání → vyhodí chybu, ne pád na undefined', () => {
  const nesrozumitelne = anthropicResp({ stop_reason: 'stop_sequence', content: [{ type: 'text', text: 'nic použitelného' }] });
  const formatovaciTakySelze = anthropicResp({ content: [{ type: 'text', text: 'pořád nic' }] });
  const ctx = nactiRadar({ properties: { ANTHROPIC_API_KEY: 'k' }, urlFetch: frontaFetchu([nesrozumitelne, formatovaciTakySelze]) });
  assert.throws(() => ctx.callAnthropic_(CFG_TEST, ZDROJE_TEST, 'denní kontrola'), /nepodařilo naparsovat/);
});

test('callAnthropic_: HTTP chyba (ne 200) vyhodí čitelnou chybu hned, bez další smyčky', () => {
  const chyba = anthropicResp({ error: { message: 'overloaded' } }, 529);
  const volane = [];
  const ctx = nactiRadar({ properties: { ANTHROPIC_API_KEY: 'k' }, urlFetch: frontaFetchu([chyba], volane) });
  assert.throws(() => ctx.callAnthropic_(CFG_TEST, ZDROJE_TEST, 'denní kontrola'), /529/);
  assert.equal(volane.length, 1, 'na HTTP chybu se nezkouší další pokus');
});

test('callAnthropic_: prázdný seznam akcí ([]) je platný výsledek, ne chyba', () => {
  const prazdne = anthropicResp({
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: 'report_events', input: { events: [] } }],
  });
  const ctx = nactiRadar({ properties: { ANTHROPIC_API_KEY: 'k' }, urlFetch: frontaFetchu([prazdne]) });
  const events = ctx.callAnthropic_(CFG_TEST, ZDROJE_TEST, 'denní kontrola');
  assert.ok(Array.isArray(events));
  assert.equal(events.length, 0);
});
