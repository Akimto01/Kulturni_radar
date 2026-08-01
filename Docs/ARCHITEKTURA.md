# Architektura

## Listy tabulky

| List | Role |
|---|---|
| KRITÉRIA | vstup uživatele: profil (B2), dojezd (B3), horizont (B4), kategorie (B5), malé lokální (B6), checkbox mimořádné kontroly (B11), čas poslední mimořádné (B12) |
| LOKALITY | číselník měst: B profil, G stav zdrojové mapy, H poslední kontrola profilu (plní skript) |
| ZDROJE | doporučené weby na profil (vstup do promptu) |
| AKCE | databáze akcí, 25 sloupců A–Y; **skript zapisuje jen A:V a Y**, W:X jsou maticové vzorce tabulky |
| MÍSTA | stálé atrakce (15 sloupců, list si skript založí sám) |
| PŘEHLED / VÝBĚR | vzorcové pohledy pro čtenáře (skript se jich nedotýká) |
| KONTROLY | audit: každý běh jeden řádek vč. sloupce Vykonavatel |

## Tok mimořádné/denní kontroly

```
trigger → readCriteria_ → readSources_ → callAnthropic_ → upsertEvents_
        → logKontrola_ → updateLokalita_ → notifyOk_/notifyFail_
```

### callAnthropic_ (jádro)

- Claude Sonnet + server tool `web_search` (max 5) + klientský nástroj
  **`report_events`** s pevným `input_schema`; instrukce: výsledky odevzdat
  výhradně voláním nástroje → **API garantuje validní strukturu**.
- Smyčka stavů: `tool_use` → hotovo; `pause_turn` → pokračovat (rozpočet 3 min);
  `end_turn` bez nástroje → vyžádat odevzdání.
- Zálohy pro atypické odpovědi: parsování textu (kandidáti od posledního
  i prvního `[`, sanitizace, záchrana useknutého konce) a „formátovací
  dovolání“ bez web searche. V praxi se od v2.0 nepoužívají.

### Deduplikace (upsertEvents_)

1. `id` (normalizované) →
2. přesný klíč profil|datum|název|místo →
3. fuzzy: stejný profil+datum a překryv názvů (podmnožina, nebo ≥3 společná
   slova po normalizaci bez diakritiky a čísel).
Nové řádky se registrují do indexů průběžně (dedup i uvnitř jedné dávky).
„Změna“ = jen posun termínu nebo stavu; přeformulace textů se ignoruje.

## Přehledy (digesty)

`digestRange_` čte AKCE (bez API): akce profilu zasahující do okna, mimo
proběhlé/zrušené; seskupení podle kategorie (abecedně), uvnitř chronologicky;
u položek čas konání. Sekce **Stálá místa**: top 5 z MÍST podle skóre,
otevírací doba.

**Počasí:** Open-Meteo (zdarma, bez klíče) — geokódování obce → denní
předpověď (WMO kód, max teplota, pravděpodobnost srážek), 16 dní dopředu,
cache per obec v rámci běhu; selhání počasí nikdy neshodí přehled.

## Stálá místa

`updateMista` = stejný vzor jako kontrola, s nástrojem **`report_places`**
(id, název, typ, obec, otevírací doba, sezónní poznámka, vstupné, děti,
skóre, stav, URL). Upsert podle id → název+obec. Měsíční trigger.

## Notifikace (sendNotification_)

- ntfy přes SMTP bránu `ntfy-<topic>@ntfy.sh` (viz PROVOZ.md — proč ne HTTP);
  těla nad ~3,5 kB zkrácena po řádcích s dovětkem.
- e-mail přes MailApp; oba kanály dostávají i chybová hlášení.

## Zásady

- Skript nikdy nemaže akce (jen stav proběhlo/zrušeno) a nesahá na cizí profily.
- Vše auditované v KONTROLÁCH; žádné tiché selhání (notifyFail_ všude).
- Blokující UI (alert) zakázáno — jen toast.
