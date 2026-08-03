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
// v3.7: cellTextCas_ – meta „poslední kontrola" nesmí ztratit čas
// ---------------------------------------------------------------------------

test('BUG v3.7: cellTextCas_ zachová čas u Date, ostatní typy jako cellText_', () => {
  const d = new r.__Date(2026, 7, 3, 18, 30);
  assert.equal(r.cellTextCas_(d), '3. 8. 2026 18:30');
  assert.equal(r.cellText_(d), '3. 8. 2026', 'cellText_ beze změny – čas záměrně ignoruje');
  assert.equal(r.cellTextCas_(new r.__Date(2026, 7, 3, 0, 0, 0)), '3. 8. 2026', 'půlnoc bez času');
  assert.equal(r.cellTextCas_(46156), '14. 5. 2026');
  assert.equal(r.cellTextCas_(null), '');
  assert.equal(r.cellTextCas_('  3. 8. 2026 '), '3. 8. 2026');
});
