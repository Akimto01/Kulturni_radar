/**
 * Testy pro cloudflare-worker/email-webhook.js. Samostatné od hlavní
 * `tests/` sady (jiný runtime – ESM Cloudflare Worker, ne Apps Script
 * sandbox) – spouštět zvlášť:
 *
 *   cd cloudflare-worker
 *   npm install
 *   node --test email-webhook.test.mjs
 *
 * Klíčový test (test 1) ověřuje konkrétní rozhodnutí z 20. 8. 2026:
 * message.raw se musí přečíst/rozparsovat CELÝ PŘED voláním
 * message.forward() – viz komentář v hlavičce email-webhook.js. Mock
 * message.raw je SKUTEČNÝ jednorázově čitelný ReadableStream (ne jen
 * string), a mock forward() tvrdě selže, pokud by byl zavolán dřív, než
 * je stream úplně vyčerpaný – takže regrese v pořadí operací tenhle
 * test spolehlivě odhalí, ne jen shodu syntaxe.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './email-webhook.js';

const RAW_EMAIL = [
  'From: pratele@example.com',
  'Subject: Tip na akci',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Zitra je v parku jarmark od 10 do 18 hodin.',
].join('\r\n');

/** Skutečný jednorázově čitelný ReadableStream – přesně ten typ objektu,
 *  jaký Cloudflare popisuje pro message.raw. Sleduje, kolikrát byl
 *  "zamčený" (getReader()) a kdy je úplně vyčerpaný. */
function makeRawStream(text, log) {
  const bytes = new TextEncoder().encode(text);
  let readerCount = 0;
  let consumed = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const originalGetReader = stream.getReader.bind(stream);
  stream.getReader = (...args) => {
    readerCount++;
    log.push('raw-getReader#' + readerCount);
    const reader = originalGetReader(...args);
    const originalRead = reader.read.bind(reader);
    reader.read = async (...a) => {
      const r = await originalRead(...a);
      if (r.done) { consumed = true; log.push('raw-fully-consumed'); }
      return r;
    };
    return reader;
  };
  return { stream, getReaderCount: () => readerCount, isConsumed: () => consumed };
}

function makeMessage({ rawText = RAW_EMAIL, from = 'pratele@example.com', forwardThrows = false, log }) {
  const rawInfo = makeRawStream(rawText, log);
  const calls = { forwarded: [] };
  return {
    from,
    raw: rawInfo.stream,
    __rawInfo: rawInfo,
    __calls: calls,
    async forward(to) {
      log.push('forward-called');
      // Klíčová kontrola pořadí, viz dokumentační komentář v hlavičce souboru.
      if (!rawInfo.isConsumed()) {
        throw new Error('ORDER BUG: forward() zavolán dřív, než byl message.raw úplně přečtený/rozparsovaný');
      }
      if (forwardThrows) throw new Error('forward selhal (simulace)');
      calls.forwarded.push(to);
    },
  };
}

function makeCtx() {
  const waited = [];
  return { waitUntil(p) { waited.push(p); }, __waited: waited };
}

test('email(): raw se přečte CELÝ před forwardem (skutečný jednorázový stream), přesně 1x getReader(), správné tělo webhooku', async () => {
  let fetchCalled = null;
  globalThis.fetch = async (url, opts) => { fetchCalled = { url, opts }; return { ok: true, json: async () => ({ ok: true, id: 'x' }) }; };
  const log = [];
  const message = makeMessage({ log });
  const ctx = makeCtx();
  const env = { EMAIL_WEBHOOK_TOKEN: 'tajny-token', EXEC_URL: 'https://example.com/exec' };

  await worker.email(message, env, ctx);

  const idxConsumed = log.indexOf('raw-fully-consumed');
  const idxForward = log.indexOf('forward-called');
  assert.ok(idxConsumed >= 0, 'raw se mělo přečíst');
  assert.ok(idxForward >= 0, 'forward se měl zavolat');
  assert.ok(idxConsumed < idxForward, 'raw MUSÍ být plně přečtený PŘED forwardem (pořadí: ' + log.join(', ') + ')');
  assert.equal(message.__rawInfo.getReaderCount(), 1, 'raw se má číst jen JEDNOU');
  assert.deepEqual(message.__calls.forwarded, ['cermakvoj@gmail.com']);

  assert.equal(ctx.__waited.length, 1);
  await ctx.__waited[0];
  assert.ok(fetchCalled, 'fetch se měl zavolat');
  const body = JSON.parse(fetchCalled.opts.body);
  assert.equal(body.akce, 'email-tip');
  assert.equal(body.token, 'tajny-token');
  assert.equal(body.from, 'pratele@example.com');
  assert.equal(body.subject, 'Tip na akci');
  assert.match(body.text, /jarmark/);
});

test('email(): prázdný/nepoužitelný mail – forward proběhne, webhook se přeskočí', async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({ ok: true }) }; };
  const log = [];
  const message = makeMessage({ rawText: '', log });
  const ctx = makeCtx();
  const env = { EMAIL_WEBHOOK_TOKEN: 'tok', EXEC_URL: 'https://example.com/exec' };

  await worker.email(message, env, ctx);
  assert.deepEqual(message.__calls.forwarded, ['cermakvoj@gmail.com']);
  assert.equal(ctx.__waited.length, 0, 'bez tipu se webhook vůbec nemá spouštět');
  assert.equal(fetchCalled, false);
});

test('email(): forward selže – email() nespadne, webhook se přesto zkusí', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  const log = [];
  const message = makeMessage({ forwardThrows: true, log });
  const ctx = makeCtx();
  const env = { EMAIL_WEBHOOK_TOKEN: 'tok', EXEC_URL: 'https://example.com/exec' };

  await worker.email(message, env, ctx);
  assert.deepEqual(message.__calls.forwarded, []);
  assert.equal(ctx.__waited.length, 1, 'webhook se má přesto zkusit, i když forward selhal');
});

test('email(): fetch selže – email() nespadne (waitUntil pohltí chybu), forward už proběhl', async () => {
  globalThis.fetch = async () => { throw new Error('síť nedostupná (simulace)'); };
  const log = [];
  const message = makeMessage({ log });
  const ctx = makeCtx();
  const env = { EMAIL_WEBHOOK_TOKEN: 'tok', EXEC_URL: 'https://example.com/exec' };

  await worker.email(message, env, ctx);
  assert.deepEqual(message.__calls.forwarded, ['cermakvoj@gmail.com']);
  await assert.doesNotReject(ctx.__waited[0]);
});

test('email(): chybí EMAIL_WEBHOOK_TOKEN – forward proběhne, fetch se vůbec nezavolá', async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({ ok: true }) }; };
  const log = [];
  const message = makeMessage({ log });
  const ctx = makeCtx();
  const env = { EXEC_URL: 'https://example.com/exec' };

  await worker.email(message, env, ctx);
  assert.deepEqual(message.__calls.forwarded, ['cermakvoj@gmail.com']);
  await ctx.__waited[0];
  assert.equal(fetchCalled, false);
});

test('email(): čistě HTML mail (bez text/plain) se přes stripHtml_ fallback přesto pošle', async () => {
  const rawHtml = [
    'From: a@b.cz',
    'Subject: HTML tip',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<html><body><p>Zitra <b>koncert</b> na namesti.</p></body></html>',
  ].join('\r\n');
  let fetchCalled = null;
  globalThis.fetch = async (url, opts) => { fetchCalled = opts; return { ok: true, json: async () => ({ ok: true }) }; };
  const log = [];
  const message = makeMessage({ rawText: rawHtml, log });
  const ctx = makeCtx();
  const env = { EMAIL_WEBHOOK_TOKEN: 'tok', EXEC_URL: 'https://example.com/exec' };

  await worker.email(message, env, ctx);
  await ctx.__waited[0];
  assert.ok(fetchCalled);
  const body = JSON.parse(fetchCalled.body);
  assert.match(body.text, /koncert/);
  assert.doesNotMatch(body.text, /<b>/);
});

test('email(): text nad limit (5000 znaků) se ořízne před odesláním', async () => {
  const rawDlouhy = [
    'From: a@b.cz',
    'Subject: Dlouhy tip',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'a'.repeat(6000),
  ].join('\r\n');
  let fetchCalled = null;
  globalThis.fetch = async (url, opts) => { fetchCalled = opts; return { ok: true, json: async () => ({ ok: true }) }; };
  const log = [];
  const message = makeMessage({ rawText: rawDlouhy, log });
  const ctx = makeCtx();
  const env = { EMAIL_WEBHOOK_TOKEN: 'tok', EXEC_URL: 'https://example.com/exec' };

  await worker.email(message, env, ctx);
  await ctx.__waited[0];
  const body = JSON.parse(fetchCalled.body);
  assert.equal(body.text.length, 5000);
});
