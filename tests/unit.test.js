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
  const vysledek = r.toggleOznaceni_([], '42', 'oblibene', '3. 8. 2026', 'Balkan Night', 'Špilberk', 'vojta');
  assert.equal(vysledek.aktivni, true);
  assert.equal(vysledek.rows.length, 1);
  const zaznam = vysledek.rows[0];
  assert.equal(zaznam.id, '42');
  assert.equal(zaznam.typ, 'oblibene');
  assert.equal(zaznam.datum, '3. 8. 2026');
  assert.equal(zaznam.nazev, 'Balkan Night');
  assert.equal(zaznam.misto, 'Špilberk');
  assert.equal(zaznam.uzivatel, 'vojta');
});

test('toggleOznaceni_: odebere existující záznam (aktivni: false), nesahá na jiné typy/ID', () => {
  const rows = [
    { id: '42', typ: 'oblibene', datum: '1. 8. 2026', nazev: 'A', misto: 'X', uzivatel: 'vojta' },
    { id: '42', typ: 'navstiveno', datum: '2. 8. 2026', nazev: 'A', misto: 'X', uzivatel: 'vojta' },
    { id: '7', typ: 'oblibene', datum: '', nazev: 'B', misto: 'Y', uzivatel: 'vojta' },
  ];
  const vysledek = r.toggleOznaceni_(rows, '42', 'oblibene', '3. 8. 2026', 'A', 'X', 'vojta');
  assert.equal(vysledek.aktivni, false);
  assert.equal(vysledek.rows.length, 2);
  assert.ok(vysledek.rows.some(row => row.id === '42' && row.typ === 'navstiveno'), 'navstiveno u 42 zůstává');
  assert.ok(vysledek.rows.some(row => row.id === '7'), 'jiné ID nedotčeno');
});

test('toggleOznaceni_: dvojité přepnutí je idempotentní no-op (přidat pak odebrat → prázdno)', () => {
  const prvni = r.toggleOznaceni_([], '1', 'navstiveno', '3. 8. 2026', 'X', 'Y', 'vojta');
  const druhy = r.toggleOznaceni_(prvni.rows, '1', 'navstiveno', '4. 8. 2026', 'X', 'Y', 'vojta');
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

// ---------------------------------------------------------------------------
// v3.16: Sledovaná města – tiché doplnění dat pro města mimo domácí profil
// ---------------------------------------------------------------------------

test('cfgProMesto_: přepíše jen profil, ostatní kritéria (dojezd, horizont…) beze změny', () => {
  const zaklad = { profil: 'Brno', dojezd: '90 min', horizont: '2 týdny', kategorie: 'vše', maleAkce: 'ano', detske: 'ano' };
  const cfg = r.cfgProMesto_(zaklad, 'Znojmo');
  assert.equal(cfg.profil, 'Znojmo');
  assert.equal(cfg.dojezd, '90 min');
  assert.equal(cfg.horizont, '2 týdny');
  assert.equal(cfg.maleAkce, 'ano');
});

test('cfgProMesto_: nemutuje původní zakladniCfg objekt (nový objekt pokaždé)', () => {
  const zaklad = { profil: 'Brno', dojezd: '90 min' };
  const cfg1 = r.cfgProMesto_(zaklad, 'Praha');
  const cfg2 = r.cfgProMesto_(zaklad, 'Plzeň');
  assert.equal(zaklad.profil, 'Brno', 'původní objekt zůstal nedotčený');
  assert.equal(cfg1.profil, 'Praha');
  assert.equal(cfg2.profil, 'Plzeň');
});

// ---------------------------------------------------------------------------
// v3.18: BUG oprava - zpracovatSledovanaMesta přeskakuje dnes už hotová města
// (dřív začínalo pokaždé od začátku seznamu, druhé spuštění nikdy nepokročilo)
// ---------------------------------------------------------------------------

test('jeDnesJizZpracovano_: dnešní datum → true', () => {
  const dnes = new r.__Date(2026, 7, 5, 14, 0);
  assert.equal(r.jeDnesJizZpracovano_('5. 8. 2026 18:45', dnes), true);
});

test('jeDnesJizZpracovano_: včerejší datum → false (má se zpracovat)', () => {
  const dnes = new r.__Date(2026, 7, 5, 14, 0);
  assert.equal(r.jeDnesJizZpracovano_('4. 8. 2026 20:00', dnes), false);
});

test('jeDnesJizZpracovano_: prázdné/nerozparsovatelné → false (nikdy nezpracováno)', () => {
  const dnes = new r.__Date(2026, 7, 5);
  assert.equal(r.jeDnesJizZpracovano_('', dnes), false);
  assert.equal(r.jeDnesJizZpracovano_(undefined, dnes), false);
});

test('jeDnesJizZpracovano_: přesně půlnoc dneška se počítá jako dnešek (>=, ne >)', () => {
  const dnes = new r.__Date(2026, 7, 5, 23, 0);
  assert.equal(r.jeDnesJizZpracovano_('5. 8. 2026 0:00', dnes), true);
});

// ---------------------------------------------------------------------------
// v3.19: Víkendové tipy – volitelný druhý příjemce (NOTIFY_EMAIL_VIKEND)
// ---------------------------------------------------------------------------

test('spojitPrijemce_: oba zadané → spojí čárkou', () => {
  assert.equal(r.spojitPrijemce_('vojta@example.com', 'monika@example.com'),
    'vojta@example.com,monika@example.com');
});

test('spojitPrijemce_: jen základní → vrátí jen jeho', () => {
  assert.equal(r.spojitPrijemce_('vojta@example.com', ''), 'vojta@example.com');
  assert.equal(r.spojitPrijemce_('vojta@example.com', null), 'vojta@example.com');
  assert.equal(r.spojitPrijemce_('vojta@example.com', undefined), 'vojta@example.com');
});

test('spojitPrijemce_: jen extra (základní chybí) → vrátí jen jeho', () => {
  assert.equal(r.spojitPrijemce_('', 'monika@example.com'), 'monika@example.com');
  assert.equal(r.spojitPrijemce_(null, 'monika@example.com'), 'monika@example.com');
});

test('spojitPrijemce_: oba prázdné → prázdný řetězec (žádný e-mail se neposílá)', () => {
  assert.equal(r.spojitPrijemce_('', ''), '');
  assert.equal(r.spojitPrijemce_(null, undefined), '');
});

test('spojitPrijemce_: stejná adresa dvakrát → nezdvojí se', () => {
  assert.equal(r.spojitPrijemce_('vojta@example.com', 'vojta@example.com'), 'vojta@example.com');
});

test('spojitPrijemce_: mezery kolem adres se ořežou', () => {
  assert.equal(r.spojitPrijemce_('  vojta@example.com  ', ' monika@example.com '),
    'vojta@example.com,monika@example.com');
});

test('v3.19: sendNotification_ s extraEmail pošle e-mail oběma adresám najednou', () => {
  const ctx = nactiRadar({ properties: { NOTIFY_EMAIL: 'vojta@example.com' } });
  ctx.sendNotification_('Víkendové tipy', 'telo', null, 'monika@example.com');
  const mail = ctx.__odeslaneEmaily.find(m => m.komu === 'vojta@example.com,monika@example.com');
  assert.ok(mail, 'e-mail šel na oba adresáty najednou v jednom volání MailApp');
});

test('v3.19: sendNotification_ beze extraEmail (jiné notifikace) se chová jako dřív', () => {
  const ctx = nactiRadar({ properties: { NOTIFY_EMAIL: 'vojta@example.com' } });
  ctx.sendNotification_('Denní kontrola', 'telo');
  const mail = ctx.__odeslaneEmaily.find(m => m.komu === 'vojta@example.com');
  assert.ok(mail, 'bez extraEmail jde pořád jen na základní adresu');
});

// ---------------------------------------------------------------------------
// v3.20: Uživatelské profily – osobní oblíbené/navštívené, PIN, osobní filtry
// ---------------------------------------------------------------------------

test('v3.20: toggleOznaceni_ – stejná akce+typ pro DVA uživatele = dva nezávislé záznamy', () => {
  const prvni = r.toggleOznaceni_([], '42', 'oblibene', '7. 8. 2026', 'A', 'X', 'vojta');
  const druhy = r.toggleOznaceni_(prvni.rows, '42', 'oblibene', '7. 8. 2026', 'A', 'X', 'monika');
  assert.equal(druhy.aktivni, true, 'pro Moniku je to nový záznam, ne toggle Vojtova');
  assert.equal(druhy.rows.length, 2);
});

test('v3.20: toggleOznaceni_ – odebrání jednoho uživatele nesmaže záznam druhého', () => {
  const rows = [
    { id: '42', typ: 'oblibene', datum: '1. 8. 2026', nazev: 'A', misto: 'X', uzivatel: 'vojta' },
    { id: '42', typ: 'oblibene', datum: '2. 8. 2026', nazev: 'A', misto: 'X', uzivatel: 'monika' },
  ];
  const vysledek = r.toggleOznaceni_(rows, '42', 'oblibene', '7. 8. 2026', 'A', 'X', 'vojta');
  assert.equal(vysledek.aktivni, false);
  assert.equal(vysledek.rows.length, 1);
  assert.equal(vysledek.rows[0].uzivatel, 'monika', 'Moničin záznam přežil Vojtovo odebrání');
});

test('v3.20: oznaceniMapy_ nad předfiltrovanými řádky jednoho uživatele', () => {
  const vsechny = [
    { id: '1', typ: 'oblibene', datum: '', nazev: '', misto: '', uzivatel: 'vojta' },
    { id: '1', typ: 'navstiveno', datum: '5. 8. 2026', nazev: '', misto: '', uzivatel: 'monika' },
  ];
  const mapaVojta = r.oznaceniMapy_(vsechny.filter(x => x.uzivatel === 'vojta'));
  assert.equal(mapaVojta.get('1').oblibene, true);
  assert.equal(mapaVojta.get('1').navstivenoDne, null, 'Moničino navštíveno do Vojtovy mapy neprosákne');
});

test('v3.20: hashPin_ je deterministický pro stejnou sůl, různá sůl → různý hash', () => {
  const a = r.hashPin_('1234', 'sul-a');
  assert.equal(a, r.hashPin_('1234', 'sul-a'), 'stejný PIN + stejná sůl = stejný hash');
  assert.notEqual(a, r.hashPin_('1234', 'sul-b'), 'jiná sůl = jiný hash (dva stejné PINy nejsou v tabulce poznat)');
  assert.match(a, /^sul-a\$[0-9a-f]{64}$/, 'formát "sůl$sha256hex"');
});

test('v3.20: overitPin_ přijme správný PIN, odmítne špatný i poškozený hash', () => {
  const ulozeny = r.hashPin_('1234', 'nahodna-sul');
  assert.equal(r.overitPin_('1234', ulozeny), true);
  assert.equal(r.overitPin_('9999', ulozeny), false);
  assert.equal(r.overitPin_('1234', 'hash-bez-dolaru'), false, 'poškozený formát bez $ → false, ne výjimka');
  assert.equal(r.overitPin_('1234', ''), false);
  assert.equal(r.overitPin_('1234', null), false);
});

test('v3.20: apiToggle_ bez uzivatelId vrací ok:false (přihlášení je povinné)', () => {
  const vysledek = r.apiToggle_({ getSheetByName: () => null }, '99', 'oblibene', '');
  assert.equal(vysledek.ok, false);
  assert.match(vysledek.error, /profil/);
});

test('v3.20: apiPrihlaseniUzivatele_ – správný PIN vrací jméno a filtry, nikdy pinHash', () => {
  const ctx = nactiRadar();
  const hash = ctx.hashPin_('1234', 'sul-x');
  // Stub sheetu UŽIVATELÉ: getRange().getValues() vrací jeden řádek profilu.
  const ss = { getSheetByName: (n) => n === 'UŽIVATELÉ' ? {
    getLastRow: () => 2,
    getRange: () => ({ getValues: () => [['vojta', 'Vojta', hash, '{"dojezd":"60 min"}', '7. 8. 2026']] }),
  } : null };
  const okVysledek = ctx.apiPrihlaseniUzivatele_(ss, 'vojta', '1234');
  assert.equal(okVysledek.ok, true);
  assert.equal(okVysledek.jmeno, 'Vojta');
  assert.equal(okVysledek.filtry.dojezd, '60 min');
  assert.equal('pinHash' in okVysledek, false, 'hash se NIKDY neposílá na frontend');

  const spatny = ctx.apiPrihlaseniUzivatele_(ss, 'vojta', '0000');
  assert.equal(spatny.ok, false);
  assert.match(spatny.error, /PIN/);

  const neznamy = ctx.apiPrihlaseniUzivatele_(ss, 'nikdo', '1234');
  assert.equal(neznamy.ok, false);
});

test('v3.20: apiPrihlaseniUzivatele_ – rozbité JSON filtry nezpůsobí pád, vrátí {}', () => {
  const ctx = nactiRadar();
  const hash = ctx.hashPin_('1234', 's');
  const ss = { getSheetByName: (n) => n === 'UŽIVATELÉ' ? {
    getLastRow: () => 2,
    getRange: () => ({ getValues: () => [['vojta', 'Vojta', hash, '{rozbite json', '']] }),
  } : null };
  const vysledek = ctx.apiPrihlaseniUzivatele_(ss, 'vojta', '1234');
  assert.equal(vysledek.ok, true);
  assert.equal(Object.keys(vysledek.filtry).length, 0);
});

test('v3.20: apiSeznamUzivatelu_ vrací jen id+jméno, žádné PIN hashe', () => {
  const ctx = nactiRadar();
  const ss = { getSheetByName: (n) => n === 'UŽIVATELÉ' ? {
    getLastRow: () => 3,
    getRange: () => ({ getValues: () => [
      ['vojta', 'Vojta', 'sul$hash1', '{}', ''],
      ['monika', 'Monika', 'sul$hash2', '{}', ''],
    ] }),
  } : null };
  const seznam = ctx.apiSeznamUzivatelu_(ss);
  assert.equal(seznam.length, 2);
  assert.equal(seznam[0].id, 'vojta');
  assert.equal(seznam[0].jmeno, 'Vojta');
  assert.equal('pinHash' in seznam[0], false);
  assert.equal('filtry' in seznam[0], false, 'ani filtry se v přihlašovacím seznamu neexponují');
});

test('v3.20: sirotci s neexistujícím uživatelem – filtr nad řádky OZNAČENÍ', () => {
  // Logika ze samotestu: záznam s uzivatel mimo platnou množinu je sirotek;
  // prázdný uzivatel (historický formát) se za sirotka nepovažuje.
  const rows = [
    { id: '1', typ: 'oblibene', uzivatel: 'vojta' },
    { id: '2', typ: 'oblibene', uzivatel: 'smazany-profil' },
    { id: '3', typ: 'oblibene', uzivatel: '' },
  ];
  const platni = new Set(['vojta', 'monika']);
  const sirotci = rows.filter(x => x.uzivatel && !platni.has(x.uzivatel));
  assert.equal(sirotci.length, 1);
  assert.equal(sirotci[0].id, '2');
});

// ---------------------------------------------------------------------------
// v3.21: routePost_ – HTTP směrování pro statický frontend (GitHub Pages)
// ---------------------------------------------------------------------------

test('v3.21: routePost_ – neznámá/chybějící akce vrací ok:false, žádný pád', () => {
  assert.equal(r.routePost_({}, null).ok, false);
  assert.equal(r.routePost_({ akce: 'neexistuje' }, null).ok, false);
  assert.equal(r.routePost_(null, null).ok, false, 'null body nesmí shodit doPost');
});

test('v3.21: routePost_ run – špatný token je odmítnut (WEB_TOKEN nenastaven → vždy odmítne)', () => {
  const vysledek = r.routePost_({ akce: 'run', token: 'cokoli' }, null);
  assert.equal(vysledek.ok, false);
  assert.match(vysledek.error, /token/i);
});

test('v3.21: routePost_ login – správný PIN projde přes POST routu (stejná logika jako gsr cesta)', () => {
  const ctx = nactiRadar();
  const hash = ctx.hashPin_('1234', 'sul-r');
  const ss = { getSheetByName: (n) => n === 'UŽIVATELÉ' ? {
    getLastRow: () => 2,
    getRange: () => ({ getValues: () => [['vojta', 'Vojta', hash, '{}', '']] }),
  } : null };
  const okVysledek = ctx.routePost_({ akce: 'login', uzivatelId: 'vojta', pin: '1234' }, ss);
  assert.equal(okVysledek.ok, true);
  assert.equal(okVysledek.jmeno, 'Vojta');
  const spatny = ctx.routePost_({ akce: 'login', uzivatelId: 'vojta', pin: '9999' }, ss);
  assert.equal(spatny.ok, false);
});

test('v3.21: routePost_ toggle – bez uzivatelId vrací ok:false (přihlášení povinné i přes HTTP)', () => {
  const vysledek = r.routePost_({ akce: 'toggle', id: '42', typ: 'oblibene', uzivatelId: '' },
    { getSheetByName: () => null });
  assert.equal(vysledek.ok, false);
  assert.match(vysledek.error, /profil/);
});

test('v3.21: routePost_ najdi – špatný token odmítnut PŘED jakoukoli dražší operací', () => {
  const vysledek = r.routePost_({ akce: 'najdi', uzivatelId: 'vojta', token: 'spatny' }, null);
  assert.equal(vysledek.ok, false);
  assert.match(vysledek.error, /token/i);
});

// ---------------------------------------------------------------------------
// v3.22: POČASÍ u akce – metNoTextNaKod_, vyhodnotPocasiUdalosti_ (čistá logika)
// ---------------------------------------------------------------------------

test('v3.22: metNoTextNaKod_ – zná hlavní kategorie z metNoTextFor_', () => {
  assert.equal(r.metNoTextNaKod_('jasno'), 0);
  assert.equal(r.metNoTextNaKod_('zataženo'), 3);
  assert.equal(r.metNoTextNaKod_('déšť'), 61);
  assert.equal(r.metNoTextNaKod_('bouřky'), 95);
});

test('v3.22: metNoTextNaKod_ – neznámý text nespadne, vrátí rozumný výchozí kód', () => {
  assert.equal(r.metNoTextNaKod_('nesmysl'), 2);
});

test('v3.22: vyhodnotPocasiUdalosti_ – chybějící souřadnice (ještě negeokódováno) → NA', () => {
  const v = r.vyhodnotPocasiUdalosti_('2026-08-09', null, { time: ['2026-08-09'], code: [1], teplota: [20] }, null, null);
  assert.equal(v.stav, 'NA');
  assert.equal(v.kod, '');
  assert.equal(v.teplota, '');
});

test('v3.22: vyhodnotPocasiUdalosti_ – datum je ve vrácené předpovědi → OK, teplota zaokrouhlená', () => {
  const forecast = { time: ['2026-08-08', '2026-08-09'], code: [3, 61], teplota: [18.6, 15.2] };
  const v = r.vyhodnotPocasiUdalosti_('2026-08-09', { lat: 49.1, lng: 16.6 }, forecast, null, null);
  assert.equal(v.stav, 'OK');
  assert.equal(v.kod, 61);
  assert.equal(v.teplota, 15);
});

test('v3.22: vyhodnotPocasiUdalosti_ – Open-Meteo odpověděl, ale datum mimo ~16denní dosah → NA (ne chyba)', () => {
  const forecast = { time: ['2026-08-08', '2026-08-09'], code: [3, 61], teplota: [18.6, 15.2] };
  const v = r.vyhodnotPocasiUdalosti_('2026-09-20', { lat: 49.1, lng: 16.6 }, forecast, null, null);
  assert.equal(v.stav, 'NA');
  assert.equal(v.kod, '');
  assert.equal(v.teplota, '');
});

test('v3.22: vyhodnotPocasiUdalosti_ – Open-Meteo selhal, met.no zachránil → OK přes metNoTextNaKod_', () => {
  const metNoDenni = { maxTeplota: 22.7, symbolCode: 'rain' };
  const v = r.vyhodnotPocasiUdalosti_('2026-08-09', { lat: 49.1, lng: 16.6 }, null, metNoDenni, null);
  assert.equal(v.stav, 'OK');
  assert.equal(v.kod, r.metNoTextNaKod_('déšť'));
  assert.equal(v.teplota, 23);
});

test('v3.22: vyhodnotPocasiUdalosti_ – oba zdroje selhaly, dřív existovala hodnota → CHYBA se zachovanou hodnotou', () => {
  const stary = { stav: 'OK', kod: 3, teplota: 19 };
  const v = r.vyhodnotPocasiUdalosti_('2026-08-09', { lat: 49.1, lng: 16.6 }, null, null, stary);
  assert.equal(v.stav, 'CHYBA');
  assert.equal(v.kod, 3);
  assert.equal(v.teplota, 19);
});

test('v3.22: vyhodnotPocasiUdalosti_ – oba zdroje selhaly a žádná předchozí hodnota → CHYBA prázdná (ne NA)', () => {
  const v = r.vyhodnotPocasiUdalosti_('2026-08-09', { lat: 49.1, lng: 16.6 }, null, null, null);
  assert.equal(v.stav, 'CHYBA');
  assert.equal(v.kod, '');
  assert.equal(v.teplota, '');
});

// ---------------------------------------------------------------------------
// v3.22: aktualizujPocasi_ – end-to-end přes fake Sheets + urlFetch stub
// (mock Sheets: minimální in-memory Range/Sheet, stejná technika jako
// fake ss v testech routePost_/apiPrihlaseniUzivatele_ výš, jen s podporou
// zápisu potřebnou pro POČASÍ full-rewrite).
// ---------------------------------------------------------------------------

class MemSheet {
  constructor(rows = []) { this.rows = rows.map(r => r.slice()); }
  getLastRow() { return this.rows.length; }
  getRange(row, col, numRows = 1, numCols = 1) {
    const self = this;
    return {
      getValues() {
        const out = [];
        for (let r = 0; r < numRows; r++) {
          const rowArr = self.rows[row - 1 + r] || [];
          const line = [];
          for (let c = 0; c < numCols; c++) line.push(rowArr[col - 1 + c] === undefined ? '' : rowArr[col - 1 + c]);
          out.push(line);
        }
        return out;
      },
      setValues(vals) {
        vals.forEach((line, r) => {
          const rowIdx = row - 1 + r;
          while (self.rows.length <= rowIdx) self.rows.push([]);
          line.forEach((v, c) => { self.rows[rowIdx][col - 1 + c] = v; });
        });
        return this;
      },
      clearContent() {
        for (let r = 0; r < numRows; r++) {
          const rowIdx = row - 1 + r;
          if (self.rows[rowIdx]) self.rows[rowIdx] = [];
        }
      },
      setFontWeight() { return this; },
      setBackground() { return this; },
      setFontColor() { return this; },
    };
  }
  appendRow(vals) { this.rows.push(vals.slice()); }
  setFrozenRows() {}
}

function fakeSpreadsheet(pocatecni) {
  const sheets = {};
  Object.keys(pocatecni || {}).forEach(n => {
    const hodnota = pocatecni[n];
    // v3.26: umožní předat i už sestavený (např. počítající) sheet objekt,
    // ne jen syrová data – zpětně kompatibilní s dřívějším voláním.
    sheets[n] = (hodnota instanceof MemSheet) ? hodnota : new MemSheet(hodnota);
  });
  return {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => { const sh = new MemSheet(); sheets[n] = sh; return sh; },
    getUrl: () => 'https://sheet.example/test',
    __sheets: sheets,
  };
}

function pridatDny_(zaklad, n) { const d = new Date(zaklad); d.setDate(d.getDate() + n); return d; }
function czDatum_(d) { return d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear(); }
function isoDatum_(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

test('v3.22: aktualizujPocasi_ – tři budoucí akce → OK / NA (mimo dosah) / CHYBA (výpadek obou zdrojů)', () => {
  const dnes = new Date(); dnes.setHours(0, 0, 0, 0);
  const zitra = pridatDny_(dnes, 1);          // v dosahu 16 dní
  const zaHranici = pridatDny_(dnes, 40);     // daleko mimo dosah
  const poslezitri = pridatDny_(dnes, 2);     // v dosahu, ale API selže

  const AKCE_ROWS = [
    [],   // hlavička (obsah nepodstatný, čte se od řádku 2)
    ['ev-a', czDatum_(zitra), '', '', 'Akce A', 'Místo A', 'Obec A', '', '', '', '', '', '', ''],
    ['ev-b', czDatum_(zaHranici), '', '', 'Akce B', 'Místo B', 'Obec B', '', '', '', '', '', '', ''],
    ['ev-c', czDatum_(poslezitri), '', '', 'Akce C', 'Místo C', 'Obec C', '', '', '', '', '', '', ''],
  ];
  const klicA = r.klicSouradnic_('Místo A', 'Obec A');
  const klicB = r.klicSouradnic_('Místo B', 'Obec B');
  const klicC = r.klicSouradnic_('Místo C', 'Obec C');
  const SOURADNICE_ROWS = [
    [],
    [klicA, 49.1, 16.6, '', ''],
    [klicB, 49.2, 16.7, '', ''],
    [klicC, 49.3, 16.8, '', ''],
  ];

  const FORECAST_A = { code: 200, body: { daily: {
    time: [isoDatum_(zitra)], weather_code: [3], temperature_2m_max: [18.6],
  } } };
  // Odpověď B je „úspěšná“, ale neobsahuje datum akce B (ta je 40 dní napřed,
  // mimo 16denní dosah Open-Meteo) – proto z toho musí vyjít NA, ne CHYBA.
  const FORECAST_B = { code: 200, body: { daily: {
    time: [isoDatum_(dnes)], weather_code: [1], temperature_2m_max: [22.0],
  } } };

  const volane = [];
  const ctx = nactiRadar({ urlFetch: frontaFetchu([
    FORECAST_A,             // A: Open-Meteo uspěje napoprvé
    FORECAST_B,             // B: Open-Meteo uspěje, ale bez hledaného data
    'throw', 'throw',       // C: Open-Meteo selže (2 pokusy)
    'throw', 'throw',       // C: záložní met.no selže taky (2 pokusy)
  ], volane) });

  const ss = fakeSpreadsheet({
    AKCE: AKCE_ROWS,
    SOUŘADNICE: SOURADNICE_ROWS,
    KONTROLY: [[]],
  });

  ctx.aktualizujPocasi_(ss);

  const pocasi = ctx.readPocasi_(ss);
  const mapa = new Map(pocasi.map(p => [p.id, p]));

  assert.equal(mapa.get('ev-a').stav, 'OK');
  assert.equal(mapa.get('ev-a').kod, 3);
  assert.equal(mapa.get('ev-a').teplota, 19);

  assert.equal(mapa.get('ev-b').stav, 'NA');
  assert.equal(mapa.get('ev-b').kod, '');
  assert.equal(mapa.get('ev-b').teplota, '');

  assert.equal(mapa.get('ev-c').stav, 'CHYBA');
  assert.equal(mapa.get('ev-c').kod, '');
  assert.equal(mapa.get('ev-c').teplota, '');

  // CHYBA se zaloguje do KONTROL, stejně jako jiné API chyby v projektu.
  const kontroly = ss.getSheetByName('KONTROLY');
  assert.equal(kontroly.getLastRow(), 2, 'přibyl jeden řádek s chybou počasí');
  assert.match(kontroly.rows[1][1], /počasí/);
});

test('v3.22: aktualizujPocasi_ – při CHYBA se zachová poslední známá hodnota z předchozího běhu', () => {
  const dnes = new Date(); dnes.setHours(0, 0, 0, 0);
  const zitra = pridatDny_(dnes, 1);
  const klic = r.klicSouradnic_('Místo D', 'Obec D');

  const AKCE_ROWS = [[], ['ev-d', czDatum_(zitra), '', '', 'Akce D', 'Místo D', 'Obec D', '', '', '', '', '', '', '']];
  const SOURADNICE_ROWS = [[], [klic, 49.1, 16.6, '', '']];
  const POCASI_ROWS = [[], ['ev-d', '1. 8. 2026', 'OK', 61, 14]];

  const ctx = nactiRadar({ urlFetch: frontaFetchu(['throw', 'throw', 'throw', 'throw']) });
  const ss = fakeSpreadsheet({
    AKCE: AKCE_ROWS, SOUŘADNICE: SOURADNICE_ROWS, POČASÍ: POCASI_ROWS, KONTROLY: [[]],
  });

  ctx.aktualizujPocasi_(ss);

  const zaznam = ctx.readPocasi_(ss).find(p => p.id === 'ev-d');
  assert.equal(zaznam.stav, 'CHYBA');
  assert.equal(zaznam.kod, 61, 'poslední známý kód zůstal zachovaný, ne smazaný');
  assert.equal(zaznam.teplota, 14);
});

test('v3.22: aktualizujPocasi_ – zrušené/proběhlé a minulé akce se nezpracovávají', () => {
  const dnes = new Date(); dnes.setHours(0, 0, 0, 0);
  const vcera = pridatDny_(dnes, -1);
  const zitra = pridatDny_(dnes, 1);
  const AKCE_ROWS = [
    [],
    ['ev-e', czDatum_(zitra), '', '', 'Zrušená', 'Místo E', 'Obec E', '', '', '', '', '', '', 'zrušeno'],
    ['ev-f', czDatum_(vcera), '', '', 'Minulá', 'Místo F', 'Obec F', '', '', '', '', '', '', ''],
  ];
  const ctx = nactiRadar({ urlFetch: frontaFetchu([], []) });   // fronta by spadla na prázdno, kdyby se volalo
  const ss = fakeSpreadsheet({ AKCE: AKCE_ROWS, SOUŘADNICE: [[]], KONTROLY: [[]] });

  ctx.aktualizujPocasi_(ss);

  assert.equal(ctx.readPocasi_(ss).length, 0, 'žádná akce nesplňuje podmínku budoucí+neproběhlá/nezrušená');
});

// ---------------------------------------------------------------------------
// v3.26: Cache apiEvents – sestavKlicCacheEventu_, fail-open, cache-hit/miss
// ---------------------------------------------------------------------------

test('v3.26: sestavKlicCacheEventu_ – stejné vstupy dají stejný klíč', () => {
  const a = r.sestavKlicCacheEventu_('42', 'Brno', 'vojta', true);
  const b = r.sestavKlicCacheEventu_('42', 'Brno', 'vojta', true);
  assert.equal(a, b);
});

test('v3.26: sestavKlicCacheEventu_ – různý profil/uživatel/verze/zahrnoutOznacene dá různý klíč', () => {
  const zaklad = r.sestavKlicCacheEventu_('1', 'Brno', 'vojta', true);
  assert.notEqual(zaklad, r.sestavKlicCacheEventu_('2', 'Brno', 'vojta', true), 'jiná verze');
  assert.notEqual(zaklad, r.sestavKlicCacheEventu_('1', 'Praha', 'vojta', true), 'jiný profil');
  assert.notEqual(zaklad, r.sestavKlicCacheEventu_('1', 'Brno', 'monika', true), 'jiný uživatel');
  assert.notEqual(zaklad, r.sestavKlicCacheEventu_('1', 'Brno', 'vojta', false), 'jiné zahrnoutOznacene');
});

test('v3.26: sestavKlicCacheEventu_ – profil/uživatel se normalizují (case-insensitive)', () => {
  assert.equal(
    r.sestavKlicCacheEventu_('1', 'Brno', 'Vojta', true),
    r.sestavKlicCacheEventu_('1', 'BRNO', 'vojta', true));
});

test('v3.26: ziskatVerziCacheEventu_ – bez předchozí invalidace vrátí "0"', () => {
  const ctx = nactiRadar();
  assert.equal(ctx.ziskatVerziCacheEventu_(), '0');
});

test('v3.26: invalidovatCacheEventu_ posune verzi – další ziskatVerziCacheEventu_ ji vidí', () => {
  const ctx = nactiRadar();
  const puvodni = ctx.ziskatVerziCacheEventu_();
  ctx.invalidovatCacheEventu_();
  const nova = ctx.ziskatVerziCacheEventu_();
  assert.notEqual(nova, puvodni);
});

test('v3.26: ziskatVerziCacheEventu_ – fail-open (CacheService nedostupný) vrátí "0", nespadne', () => {
  const ctx = nactiRadar({ cacheThrows: true });
  assert.equal(ctx.ziskatVerziCacheEventu_(), '0');
});

test('v3.26: invalidovatCacheEventu_ – fail-open (CacheService nedostupný) nevyhodí výjimku', () => {
  const ctx = nactiRadar({ cacheThrows: true });
  assert.doesNotThrow(() => ctx.invalidovatCacheEventu_());
});

test('v3.26: nactiZCacheEventu_/ulozitDoCacheEventu_ – round-trip uloží a přečte stejný objekt', () => {
  const ctx = nactiRadar();
  const klic = ctx.sestavKlicCacheEventu_('0', 'Brno', '', false);
  assert.equal(ctx.nactiZCacheEventu_(klic), null, 'zatím nic uloženo – miss');
  const data = { ok: true, profil: 'Brno', akce: [{ id: 'x' }] };
  ctx.ulozitDoCacheEventu_(klic, data);
  // Cross-realm past (viz SKILL.md): `data` je z realmu testu, přečtená
  // hodnota prošla JSON.parse uvnitř vm sandboxu → jiný Object.prototype,
  // deepStrictEqual by padlo i při identickém obsahu. Porovnat přes JSON.
  assert.equal(JSON.stringify(ctx.nactiZCacheEventu_(klic)), JSON.stringify(data));
});

test('v3.26: nactiZCacheEventu_ – fail-open (CacheService nedostupný) vrátí null, nespadne', () => {
  const ctx = nactiRadar({ cacheThrows: true });
  assert.equal(ctx.nactiZCacheEventu_('cokoli'), null);
});

test('v3.26: ulozitDoCacheEventu_ – fail-open (CacheService nedostupný) nevyhodí výjimku', () => {
  const ctx = nactiRadar({ cacheThrows: true });
  assert.doesNotThrow(() => ctx.ulozitDoCacheEventu_('cokoli', { a: 1 }));
});

/** Sheet, co si počítá, kolikrát se na něj zavolalo getRange – aby šlo
 *  přímo dokázat, že cache-hit AKCE vůbec nečte (a invalidace ji donutí
 *  přečíst znovu), ne jen že vrací "nějaká" data. */
class PocitaciMemSheet extends MemSheet {
  constructor(rows) { super(rows); this.pocetGetRange = 0; }
  getRange(...args) { this.pocetGetRange++; return super.getRange(...args); }
}

test('v3.26: readEventsApi_ – cache hit nečte AKCE znovu; invalidace vynutí nové čtení', () => {
  const zitra = pridatDny_(new Date(), 1);
  const akceSheet = new PocitaciMemSheet([
    [],
    ['ev-1', czDatum_(zitra), '', '', 'Akce', 'Místo', 'Brno', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Brno'],
  ]);
  const ctx = nactiRadar();
  const ss = fakeSpreadsheet({ AKCE: akceSheet });

  const prvni = ctx.readEventsApi_(ss, 'Brno', false, '');
  assert.equal(prvni.akce.length, 1);
  assert.equal(akceSheet.pocetGetRange, 1, 'první volání musí přečíst AKCE');

  const druhy = ctx.readEventsApi_(ss, 'Brno', false, '');
  assert.deepEqual(druhy, prvni, 'z cache musí přijít identická odpověď');
  assert.equal(akceSheet.pocetGetRange, 1, 'druhé volání (cache hit) AKCE znovu nečte');

  ctx.invalidovatCacheEventu_();   // simulace zápisu jinde (upsertEvents_/apiToggle_/…)
  const treti = ctx.readEventsApi_(ss, 'Brno', false, '');
  assert.equal(treti.akce.length, 1);
  assert.equal(akceSheet.pocetGetRange, 2, 'po invalidaci se musí AKCE přečíst znovu');
});

test('v3.26: readEventsApi_ – různí uživatelé nedostanou data z cache toho druhého', () => {
  const zitra = pridatDny_(new Date(), 1);
  const akceSheet = new PocitaciMemSheet([
    [],
    ['ev-1', czDatum_(zitra), '', '', 'Akce', 'Místo', 'Brno', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Brno'],
  ]);
  const ctx = nactiRadar();
  const ss = fakeSpreadsheet({ AKCE: akceSheet });

  ctx.readEventsApi_(ss, 'Brno', true, 'vojta');
  assert.equal(akceSheet.pocetGetRange, 1);
  ctx.readEventsApi_(ss, 'Brno', true, 'monika');
  assert.equal(akceSheet.pocetGetRange, 2, 'jiný uzivatelId = jiný cache klíč = znovu čte AKCE');
});

test('v3.26: readEventsApi_ – funguje i s nedostupným CacheService (fail-open, žádný pád)', () => {
  const zitra = pridatDny_(new Date(), 1);
  const akceSheet = new PocitaciMemSheet([
    [],
    ['ev-1', czDatum_(zitra), '', '', 'Akce', 'Místo', 'Brno', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Brno'],
  ]);
  const ctx = nactiRadar({ cacheThrows: true });
  const ss = fakeSpreadsheet({ AKCE: akceSheet });

  const prvni = ctx.readEventsApi_(ss, 'Brno', false, '');
  assert.equal(prvni.akce.length, 1);
  const druhy = ctx.readEventsApi_(ss, 'Brno', false, '');
  assert.equal(druhy.akce.length, 1);
  assert.equal(akceSheet.pocetGetRange, 2, 'bez funkční cache se AKCE čte při každém volání znovu – správně, ne pád');
});
