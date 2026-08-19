/**
 * Kulturní radar – Cloudflare Email Worker (v3.29, 20. 8. 2026)
 * ================================================================
 * Nahrazuje dnešní jednoduché Email Routing "forward" pravidlo pro
 * info@kulturniradar.cz. Dělá DVĚ věci pro každý příchozí mail:
 *
 *   1. Přepošle mail beze změny na Gmail (cermakvoj@gmail.com) –
 *      přesně to, co dělá dnešní forward pravidlo. Tohle MUSÍ proběhnout
 *      vždy, i kdyby appka byla nedostupná nebo webhook selhal.
 *   2. Navíc pošle obsah mailu jako webhook na appku (POST /exec,
 *      akce: 'email-tip') – appka ho zařadí do fronty EMAIL_TIPY a
 *      zpracuje při příští denní kontrole (viz kulturni_radar.gs,
 *      apiEmailTip_/zpracovatEmailTipy_).
 *
 * Selhání kroku 2 (appka nedostupná, timeout, špatný token…) se jen
 * zaloguje (Cloudflare Worker Logs) – NIKDY nesmí ovlivnit krok 1.
 *
 * POŘADÍ OPERACÍ (důležité, ověřeno 20. 8. 2026): `message.raw` se
 * kompletně přečte/rozparsuje PŘED voláním `message.forward()`, ne po
 * něm. Cloudflare dokumentace nikde výslovně nepotvrzuje, že `raw`
 * zůstává čitelný i PO forwardu (žádný oficiální příklad obojí
 * nekombinuje) – jde jen o nepřímé důkazy (funkční cizí Worker dělá
 * opak, žádný nahlášený bug). Tímhle pořadím se otázce úplně vyhneme:
 * `raw` se po forwardu už nikdy nedotýkáme, takže nezáleží na tom, jak
 * se to uvnitř runtime doopravdy chová.
 *
 * Návod k nasazení: viz README.md v tomhle adresáři.
 */

import PostalMime from 'postal-mime';

// Adresa, kam appka dnes přeposílá – beze změny oproti současnému
// forward pravidlu.
const FORWARD_TO = 'cermakvoj@gmail.com';

// Nouzová záloha, pokud by chyběla proměnná EXEC_URL ve wrangler.toml
// ([vars] sekce) – drzi stejnou hodnotu, jakou appka realne pouziva
// (viz .clasp.json / poslední `clasp deploy -i …` v repu).
const DEFAULT_EXEC_URL =
  'https://script.google.com/macros/s/AKfycbwwLACExWtRUULK5XX1bMD8SJiC6cBqAY-q99Flp3SLAEr4ejB4VnekFNH9yYnlOuJvRQ/exec';

// Text delší než tohle appka stejně odmítne (EMAIL_TIP_TEXT_MAX v
// kulturni_radar.gs) – oříznout už tady, ať se zbytečně neposílá.
const TEXT_MAX = 5000;

export default {
  async email(message, env, ctx) {
    // 1) Nejdřív KOMPLETNĚ přečíst a rozparsovat message.raw – viz pořadí
    //    operací v hlavičce souboru. Vlastní try/catch: selhání parsování
    //    (poškozený mail, PostalMime chyba…) nesmí zabránit forwardu níž.
    let tip = null;
    try {
      tip = await pripravitTip_(message);
    } catch (err) {
      console.error('email-webhook: parsování mailu selhalo:', err);
    }

    // 2) Forward na Gmail – VŽDY, nezávisle na tom, jestli se parsování
    //    povedlo. Až TEĎ, po kroku 1 (ne před ním).
    try {
      await message.forward(FORWARD_TO);
    } catch (err) {
      console.error('email-webhook: forward na Gmail selhal:', err);
    }

    // 3) Webhook do appky – NEBLOKUJE doručení mailu (ctx.waitUntil nechá
    //    Cloudflare dokončit úlohu na pozadí i po skončení email()
    //    handleru), a jeho selhání appku ani mail nijak neovlivní – jen
    //    se zaloguje. Pracuje jen s už připraveným `tip` (obyčejný objekt),
    //    message.raw se tu znovu vůbec nedotýká.
    if (tip) {
      ctx.waitUntil(posliWebhook_(tip, message.from, env));
    } else {
      console.log('email-webhook: mail bez použitelného textového obsahu, webhook přeskočen.');
    }
  },
};

/** Rozparsuje mail a vrátí { subject, text }, nebo null, když mail nemá
 *  žádný čitelný text. Jediné místo, které čte message.raw. */
async function pripravitTip_(message) {
  const email = await PostalMime.parse(message.raw);
  const text = (email.text || stripHtml_(email.html) || '').trim().slice(0, TEXT_MAX);
  if (!text) return null;
  return { subject: email.subject || '', text };
}

/** Pošle už připravený tip (viz pripravitTip_) na apiEmailTip_ appky.
 *  Všechny chyby (chybí token, síť, appka odmítla) se jen zalogují –
 *  návratová hodnota se nikde nevyhodnocuje, protože už jsme mimo hlavní
 *  tok (waitUntil). */
async function posliWebhook_(tip, from, env) {
  try {
    const token = env.EMAIL_WEBHOOK_TOKEN;
    if (!token) {
      console.error('email-webhook: chybí EMAIL_WEBHOOK_TOKEN secret – webhook přeskočen.');
      return;
    }

    const execUrl = env.EXEC_URL || DEFAULT_EXEC_URL;
    const resp = await fetch(execUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        akce: 'email-tip',
        token,
        from: from || '',
        subject: tip.subject,
        text: tip.text,
      }),
    });

    if (!resp.ok) {
      console.error('email-webhook: appka odpověděla HTTP ' + resp.status);
      return;
    }
    const data = await resp.json();
    if (!data.ok) {
      console.error('email-webhook: appka tip odmítla: ' + data.error);
    }
  } catch (err) {
    console.error('email-webhook: odeslání webhooku selhalo:', err);
  }
}

/** Hrubá nouzová záchrana pro čistě HTML maily bez text/plain části.
 *  Není to plnohodnotný HTML→text převodník – jen odstraní tagy a pár
 *  nejběžnějších entit, ať appka dostane aspoň čitelný text k ověření.
 *  PostalMime dřív u drtivé většiny mailů vrátí `email.text` přímo,
 *  tohle je jen záložní cesta. */
function stripHtml_(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
