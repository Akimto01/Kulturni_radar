# Mutační testování (Stryker)

Odpovídá na otázku, kterou pokrytí řádků nezodpoví: **zachytí testy změnu chování?** Stryker v kódu
udělá drobnou změnu (mutaci, např. `>` na `>=`, podmínka na `true`, prázdné tělo funkce), pustí testy
a sleduje, jestli aspoň jeden spadne. Jde o issue #13. Metrika „mutační skóre kritických funkcí“ je
v [ARCHITEKTURA-TESTU.md](ARCHITEKTURA-TESTU.md), D3, řádek v C1.

## Spuštění

Z kořene repa (Node 22 nebo novější). Nástroje jsou v `tests/mutace/` s vlastním `package.json`, aby
kořen repa žádný neměl (Cloudflare Pages by ho při `git push` mohl instalovat).

```
cd tests/mutace && npm ci && cd ../..         # jednou: instalace (pevné verze z package-lock.json)
node tests/mutace/spustit.js --kriticke       # 10 kritických funkcí z POKRYTI.md, 448 mutantů, ~3 min
node tests/mutace/spustit.js --funkce parseCzDate_,apiToggle_
node tests/mutace/spustit.js --rozsah 273-277 # řádky v kulturni_radar.gs
node tests/mutace/spustit.js --vse            # celý backend, 5 378 mutantů, ~40 min
node tests/mutace/spustit.js --vse --prah 0   # bez prahu pádu (týdenní běh v CI)
```

`--prah N` přepíše `thresholds.break` z konfigurace (0 = bez prahu; Stryker nemá argument pro práh, skript proto zapíše přepsanou kopii konfigurace do `.stryker-src/`). Další argumenty se předají Strykeru (např. `--concurrency 2`). Zdrojem pravdy zůstává
`apps-script/kulturni_radar.gs`, skript ho jen zkopíruje, nic nemění. Výstupy: tabulka v konzoli,
`tests/mutace/reports/mutation.json` (v `.gitignore`).

Dobu běhu určuje hlavně start procesů, ne počet jader: kritická sada trvá ~3 min 40 s při 4 procesech
i ~3 min 10 s při 8 (Windows, k 29. 10. 2026), tedy ~0,45 s na mutant.

## Jak je to zapojené

- **Kopie `.js`:** Stryker nezná příponu `.gs`. `spustit.js` zkopíruje backend bajt po bajtu do
  `.stryker-src/kulturni_radar.js` (čísla řádků sedí) a nastaví `RADAR_ZDROJ`.
- **Harness:** `tests/harness.js` při nastavené `RADAR_ZDROJ` načte instrumentovanou kopii. Instrumentovaný
  kód běží ve `vm` a svůj jmenný prostor Strykeru hledá v globálu vm kontextu, ne testovacího procesu, proto
  harness předá do kontextu objekt z hooku Strykeru a zapíše do něj aktivního mutanta. Bez toho jsou všechny
  mutanty `NoCoverage`. Bez `RADAR_ZDROJ` a mimo Stryker se chování harnessu nemění.
- **Pevné locale `en-US`:** výsledek nesmí záviset na stroji. Výchozí locale určuje ICU podle systému a na
  Windows ho `LANG`/`LC_ALL` neovlivní (ověřeno 29. 10. 2026: `cs-CZ` i s nastaveným `LC_ALL`). `spustit.js`
  proto nastaví `LANG`, `LC_ALL` (pro POSIX) a `RADAR_LOCALE=en-US`; `tests/harness.js` podle ní obalí
  `String.prototype.localeCompare` ve vm kontextu tak, že volání bez locale dostane `en-US`. Důvod: mutant
  `localeCompare(b, 'cs')` → `localeCompare(b, "")` (#425) přežíval jen proto, že V8 po prvním volání bez locale
  bere prázdný locale jako výchozí collator stroje; s pevným locale je zabitý a nezávisí na pořadí testů.
  Ověřeno srovnáním kritické sady před a po: změnil se jen #425. Mimo Stryker (bez `RADAR_LOCALE`) se nic nemění.
- **Runner:** `@stryker-mutator/tap-runner` nad `tests/unit.test.js` (447 testů, ~1 s na mutant) s měřením
  pokrytí: mutant, který žádný test nespustí, se vůbec neprovádí (`NoCoverage`).
- **Vlastní TAP reporter** `tests/mutace/tap-reporter.js`: vestavěný reporter Node padá na neplatném `Date`
  v selhané aserci (`RangeError: Invalid time value`), proces skončí dřív, než hook zapíše výsledek, a Stryker
  by zabitého mutanta označil jako `RuntimeError`.
- **Rozsah:** mutuje se jen tělo pojmenované funkce, ne pomocné funkce, které volá (např. `apiToggle_` bez
  `toggleOznaceni_`). Skóre jedné funkce proto neříká vše o tom, co deleguje.

## Jak číst výsledek

| Stav | Význam | Co s tím |
|---|---|---|
| **Killed** (zabitý) | aspoň jeden test s mutací spadl | v pořádku, test chytá tuto změnu chování |
| **Survived** (přeživší) | všechny testy prošly i s mutací | vyžaduje triáž (viz níže) |
| **Timeout** | mutace způsobila zacyklení nebo extrémní zpomalení, běh byl přerušen | počítá se jako zabitý; závisí na zátěži stroje, může při opakování přejít na Killed |
| **NoCoverage** | žádný test kód s mutací vůbec nespustil | mezera v testech (nebo kód, který jde spustit jen v Googlu) |
| **RuntimeError** | mutant rozbil samotný běh testů | po zavedení vlastního reporteru by se neměl objevovat; jinak hlásit |

**Mutační skóre** = (zabité + timeout) / všechny mutanty; mutanty bez pokrytí jsou ve jmenovateli, takže skóre
je přísnější než „skóre pokrytých“, které Stryker vypíše vedle.

**Ekvivalentní mutant** mění kód, ale ne pozorovatelné chování (např. `i < n` na `i <= n` u smyčky, jejíž
poslední průchod nic nemění, nebo změna textu logu, který nikdo nečte). Žádný test ho zabít nemůže, a proto
ho nemá smysl zabíjet. Ekvivalentní mutanty se při triáži odečtou od jmenovatele a zapíšou s důvodem.

## Triáž přeživších

Každý přeživší a každý `NoCoverage` mutant se zařadí do jedné ze tří kategorií:

- **(a) skutečná mezera v testu:** změna chování, kterou test měl chytit. Doplní se test a mutant se ověří.
- **(b) ekvivalentní mutant:** změna neovlivní chování. Zdůvodní se jednou větou.
- **(c) mezera v kódu, kterou testem neopravíš:** mrtvý nebo nedosažitelný kód, obrana, kterou nejde vyvolat
  (např. jen ve skutečném Googlu). Zapíše se; případně se kód zjednoduší.

Před doplněním testu se ověří, že přeživší není artefaktem nastavení: mutace se ručně aplikuje na kopii
(`RADAR_ZDROJ=… node --test tests/unit.test.js`) a testy musí opravdu projít. Rozpis kritické sady (98 mutantů) je v [MUTACE-TRIAZ.md](MUTACE-TRIAZ.md).

## CI, práh a týdenní běh (od 29. 10. 2026)

Workflow `.github/workflows/mutacni-testy.yml`:

- **Kritická sada s prahem:** při `push` a `pull_request` se změnou `apps-script/kulturni_radar.gs`, `tests/unit.test.js`,
  `tests/harness.js`, `tests/mutace/**` (nebo samotného workflow) běží `node tests/mutace/spustit.js --kriticke` s prahem
  `thresholds.break` **95** z `tests/mutace/stryker.config.json` (`high` 97, `low` 95). Pod prahem Stryker skončí kódem 1 a job spadne.
  Na Linuxu trvá běh 1 min 41 s až 2 min 42 s (naměřeno 29. 10. 2026, třikrát), celý job s instalací ~2 až 3 min.
- **Celý backend týdně a ručně:** sobota 3:40 UTC (a `workflow_dispatch` s volbou `kriticke` nebo `vse`), `--vse --prah 0`, bez prahu,
  `timeout-minutes: 90`. Naměřeno 29. 10. 2026: 41 min 22 s, **skóre 62,8 %** (5 378 mutantů: 3 373 zabito, 2 timeout, 1 327 přežilo,
  676 bez pokrytí). Je to první měření, výchozí bod pro případné zlepšování; brána to není. Selže-li plánovaný běh, ntfy do
  `NTFY_TOPIC_DEV` (fallback `NTFY_TOPIC`), stejně jako u týdenních RF testů.
- **Report:** artefakty `mutacni-report-kriticka-sada` a `mutacni-report-cely-backend` (`mutation.json`, `mutation.html`), 14 dní.
  Žádné secrets kromě ntfy v kroku upozornění; `permissions: contents: read`.

**Proč práh 95:** kritická sada má 96,9 % (434 z 448) a 14 mutantů, které žádný test nezabije (8 ekvivalentních a 6 mezer v kódu, viz
[MUTACE-TRIAZ.md](MUTACE-TRIAZ.md)). Práh 95 dává rezervu ~8 mutantů proti náhodnému kolísání (timeouty závisí na zátěži stroje),
ale odstranění testů celé podskupiny pod něj spadne (ověřeno: bez testů dávky 3b-3 klesl `upsertEvents_` z 94,5 % na 90,4 %).
Vyšší práh by padal kvůli mutantům, které testem opravit nejde; `high` 97 je jen hranice „zelené“ v reportu. Po opravě #48 (mutanty
#352 až #354) a odstranění nedosažitelných obran se práh může zvednout; snižovat se nesmí. Pod prahem se doplňují testy.

Pozor: ne každý odstraněný test skóre sníží. Test 3b-1 (zrušená akce) po doplnění 3b-5 nezabíjí nic, co by nezabil i 3b-5; skóre drží
souhrn testů, ne jednotlivý test.

## Co zatím neplatí

Mutuje se jen backend a jen proti `tests/unit.test.js`; frontend (`Index.html`) a E2E testy ne. Celý backend má 62,8 %: nejvíc přeživších
je v `vsechnyPodkategorie_` (103), `volatAnthropicSTool_` (79), `readEventsApi_` (61), `upsertMista_` (52), `callAnthropicPlaces_` (46),
`callAnthropic_` (41), `aktualizujPocasi_` (41), `notifyOk_` (40), `smazatPotvrzeneDuplicity_` (32) a `upsertEvents_` (30).
Rozdělení podle řádku funkce: konstanty za funkcí se počítají k ní. Práh pro celý backend ani triáž jeho mutantů neexistují.
