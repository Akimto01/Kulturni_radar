# Kulturní radar

Rodinný automat na hlídání kulturních akcí v okolí (Brno a další města ČR),
postavený na Google Sheets + Apps Script + Anthropic API (Claude s web searchem).

Vznikl jako náhrada za sadu naplánovaných ChatGPT úloh s hodinovou latencí —
cílem bylo okamžité spuštění kontroly zaškrtnutím políčka v tabulce a push
notifikace pro celou rodinu.

## Co umí

- **Mimořádná kontrola na povel** — zaškrtnutí checkboxu `KRITÉRIA!B11` spustí
  do pár minut hledání akcí podle aktuálních kritérií (město, dojezd, horizont,
  kategorie).
- **Denní kontrola** (~8:00) — totéž automaticky, navíc označí proběhlé akce.
- **Týdenní přehled** (pondělí ~7:00) a **víkendové tipy** (čtvrtek ~16:00) —
  čtou jen z databáze (zdarma), seskupené podle kategorií, s časy konání
  a předpovědí počasí (Open-Meteo).
- **Stálá místa** — zoo, science centra, hrady, jeskyně… s aktuální otevírací
  dobou; měsíční automatická aktualizace, sekce ve víkendových tipech.
- **Notifikace** na telefon (ntfy) i e-mail, s výčtem konkrétních akcí
  a odkazem na tabulku. Selhání se hlásí stejnými kanály — systém neumí
  selhat potichu.
- **Deduplikace** ve třech vrstvách (ID → přesný klíč → fuzzy překryv názvů),
  audit každého běhu v listu KONTROLY.

## Architektura ve zkratce

```
[Google Sheet]  ←→  [Apps Script (tento repozitář)]  →  [Anthropic API + web search]
  KRITÉRIA               triggery: onEdit, denní,          tool use: report_events /
  AKCE, MÍSTA            týdenní, víkendový, měsíční       report_places (garantovaná
  KONTROLY, …            notifikace: ntfy + e-mail          struktura výstupu)
                                                        →  [Open-Meteo] (počasí, zdarma)
```

Detailně viz `docs/ARCHITEKTURA.md`; zprovoznění a řešení potíží
viz `docs/PROVOZ.md`; historie verzí a lekce z produkčních bugů
viz `docs/CHANGELOG.md`.

## Rychlé zprovoznění

1. V tabulce: Rozšíření → Apps Script → vložit `apps-script/kulturni_radar.gs`.
2. Nastavení projektu → Vlastnosti skriptu:
   - `ANTHROPIC_API_KEY` (povinné)
   - `NTFY_TOPIC` (volitelné — push přes ntfy.sh)
   - `NOTIFY_EMAIL` (volitelné — e-mail navíc)
3. V editoru spustit jednou `setupTriggers()` a autorizovat oprávnění.
4. Na telefonu: aplikace ntfy → Subscribe to topic → název z `NTFY_TOPIC`.
5. Test: menu tabulky **Kulturní radar → Test notifikací**, pak zaškrtnout B11.

## Provozní náklady

Jeden AI běh (kontrola / aktualizace míst) ≈ jednotky centů (Claude Sonnet
+ max 5 web searchů). Přehledy a počasí jsou zdarma. Typický měsíc: < 2 USD.
