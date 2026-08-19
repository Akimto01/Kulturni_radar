# Kulturní radar — Email Webhook (Cloudflare Worker)

Nahrazuje dnešní jednoduché **Email Routing forward pravidlo** pro
`info@kulturniradar.cz`. Dnešní stav: Cloudflare dashboard má nastavené
"posílej na cermakvoj@gmail.com" jako čistě dashboardové pravidlo, bez
jediného řádku kódu. Tenhle Worker to pravidlo **nahrazuje** — dělá to
samé (forward na Gmail) a navíc pošle obsah mailu jako webhook appce
Kulturní radar, která ho zařadí do fronty `EMAIL_TIPY`.

Backendová část (endpoint `apiEmailTip_`, list `EMAIL_TIPY`, zpracování
fronty) je hotová v `apps-script/kulturni_radar.gs` (v3.29+). Tenhle
adresář je jediná chybějící část — a nasadit ji musíš ty, ne Claude Code
(tenhle stroj nemá Cloudflare účet/CLI nakonfigurovaný).

## Co budeš potřebovat

- Node.js (máš ho už kvůli `clasp`).
- Přístup ke Cloudflare účtu, kde běží `kulturniradar.cz`.
- Cca 15–20 minut.

## Krok 1 — instalace závislostí

```powershell
cd cloudflare-worker
npm install
```

## Krok 1b — spustit testy (doporučeno před každým nasazením)

```powershell
npm test
```

7 testů, žádný Cloudflare účet ani síť není potřeba (fake `message`/`env`/
`ctx`, stub `fetch`). Ověřují mj. konkrétní věc, na které tenhle Worker
stojí: `message.raw` se musí přečíst/rozparsovat **celý PŘED** voláním
`message.forward()` — mock `forward()` v testu tvrdě selže, pokud by byl
zavolán dřív (Cloudflare dokumentace výslovně negarantuje, že `raw`
zůstává čitelný i po forwardu, viz komentář v hlavičce `email-webhook.js`).
Pokud v budoucnu upravíš pořadí operací v `email()`, tenhle test to
spolehlivě odhalí.

## Krok 2 — přihlášení k Cloudflare (jen poprvé)

```powershell
npx wrangler login
```

Otevře se prohlížeč, přihlas se ke stejnému Cloudflare účtu, co spravuje
`kulturniradar.cz`.

## Krok 3 — vygenerovat a nastavit sdílený token

Token je sdílené heslo mezi tímhle Workerem a appkou — appka jím pozná,
že webhook je opravdu od tvého Workeru, ne od někoho cizího. **Musí být
nastavený na OBOU místech stejně:**

1. Vygeneruj náhodný token (např. v PowerShellu):
   ```powershell
   -join ((48..57)+(97..102)|Get-Random -Count 48|%{[char]$_})
   ```
   (nebo cokoli jiného dost dlouhého a náhodného — klidně z password manageru)

2. Ulož ho jako Cloudflare Worker secret:
   ```powershell
   npx wrangler secret put EMAIL_WEBHOOK_TOKEN
   ```
   Vyzve tě, ať token vložíš (vloží se skrytě, nikam se needitovatelně
   neuloží na disk).

3. **Stejnou hodnotu** vlož do Apps Scriptu: otevři projekt v Apps Script
   editoru → ⚙️ Project Settings → Script Properties → Add script
   property → název `EMAIL_WEBHOOK_TOKEN`, hodnota = ten samý token.

   Pokud se ti to hodí, řekni mi (Claude Code) tu vygenerovanou hodnotu
   a já ji rovnou nastavím do Script Properties přes `clasp` — ať to
   nemusíš přepisovat ručně na dvou místech. Jinak to zvládneš i ručně
   v editoru.

## Krok 4 — nasadit Worker

```powershell
npx wrangler deploy
```

Vypíše se URL nasazeného Workeru (něco jako
`kulturni-radar-email-webhook.<tvůj-subdomain>.workers.dev`) — tu si
nikam zapisovat nemusíš, není potřeba, Email Routing si Worker najde
podle jména v dalším kroku.

## Krok 5 — přepnout Email Routing na tenhle Worker

V Cloudflare dashboardu, doména `kulturniradar.cz`:

1. **Email** → **Email Routing** → **Routing rules**.
2. Najdi pravidlo pro `info@kulturniradar.cz` (dnes: akce "Send to an
   email" → `cermakvoj@gmail.com`).
3. Uprav akci na **"Send to a Worker"** a vyber
   `kulturni-radar-email-webhook` (jméno z `wrangler.toml`).
4. Ulož.

Od teď každý mail na `info@kulturniradar.cz` projde tímhle Workerem:
pošle se dál na Gmail (beze změny) **a navíc** se pošle appce jako tip.

## Ověření, že to funguje

1. Pošli testovací mail na `info@kulturniradar.cz` s nějakým textem
   popisujícím fiktivní akci (např. "Zítra v Brně na náměstí Svobody
   bude jarmark od 10 do 18 hodin").
2. Ověř, že ti mail normálně dorazil na Gmail (beze změny oproti dnešku).
3. Otevři Google Sheet appky → list `EMAIL_TIPY` (appka ho vytvoří
   automaticky při prvním přijatém tipu, pokud ještě neexistuje) — měl
   by tam přibýt nový řádek se stavem `nové`.
4. Pokud se tam řádek neobjeví: zkontroluj Cloudflare Worker Logs
   (dashboard → Workers & Pages → `kulturni-radar-email-webhook` →
   Logs) — tam uvidíš, jestli fetch na appku selhal a proč (špatný
   token, appka nedostupná apod.). Forward na Gmail by měl fungovat
   i tehdy, pokud webhook selže — pokud nedorazí ani mail na Gmail,
   jde o samostatný problém navíc.
5. Řádek se z `nové` na `zpracováno-ok`/`zpracováno-chyba`/
   `nelze-ověřit` přepne až při příští denní kontrole appky (ne hned).

## Aktualizace kódu

Po jakékoli úpravě `email-webhook.js` stačí znovu:

```powershell
npx wrangler deploy
```

`EXEC_URL` ve `wrangler.toml` **není tajná** (jen konfigurace, může být
v gitu) — pokud appka časem dostane novou produkční `/exec` URL (nová
Apps Script implementace), uprav ji tady a redeployni. `EMAIL_WEBHOOK_TOKEN`
zůstává jako secret nezávisle na deployi kódu, není potřeba ho nastavovat
znovu při každém `wrangler deploy`.
