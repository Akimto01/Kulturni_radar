# AGENTS.md

Pokyny pro AI agenty a nové vývojáře: co je projekt, kde co leží, jak ho ověřit a která pravidla se nesmí porušit. Detaily jsou ve skillu a v Docs, tady jsou jen odkazy.

## Co je projekt

Kulturní radar je rodinná appka, která pomocí AI s webovým vyhledáváním hlídá kulturní akce v Brně a dalších městech ČR (běží na kulturniradar.cz). Backend je Google Apps Script nad Google Sheets, frontend jeden soubor `Index.html`. Repo je zároveň ukázka práce testera automatizace, proto má testy na více úrovních, CI a dokumentovaný proces od nalezení chyby po ověření v produkci.

## Struktura repa

| Cesta | Obsah |
|---|---|
| `apps-script/` | backend `kulturni_radar.gs` a frontend `Index.html` (každý má vlastní číslo verze) |
| `tests/` | Node testy a harness, `tests/robot/` E2E a API testy v Robot Frameworku, `tests/mutace/` mutační testy |
| `cloudflare-worker/` | Worker pro e-mailové tipy a jeho testy |
| `api-tests/` | cvičné API testy (SoapUI, Bruno, JMeter) |
| `Docs/` | dokumentace, CHANGELOG, BACKLOG |
| `.github/workflows/`, `.github/scripts/` | CI a kontrolní skripty |

## Hlavní příkazy

```bash
# jednotkové testy backendu a frontendu (vždy vyjmenovat soubory, ne celý adresář)
node --test tests/unit.test.js tests/frontend.test.js

# rychlá kontrola produkce po nasazení (adresa API viz poznámka pod příkazy)
robot --variable BASE_URL:<adresa /exec> --include smoke --outputdir vysledky tests/robot/

# mutační testy kritické sady (práh 95 %)
node tests/mutace/spustit.js --kriticke

# kontroly repa (jen čtou)
python .github/scripts/kontrola-poctu-testu.py
python .github/scripts/kontrola-nastroju.py
python .github/scripts/kontrola-architektury-testu.py
python .github/scripts/kontrola-dokumentace.py
python .github/scripts/kontrola-dokumentace-kodu.py   # varování: kód změněn, dokument ne (jen upozornění)
```

Adresa `/exec` je veřejná adresa API (volá ji frontend v prohlížeči), není tajná. Výchozí hodnotu má `tests/robot/resources.robot`, proto jde `--variable BASE_URL` vynechat (CI ji předává ze Secretu `RADAR_URL`). Pozor: prázdná proměnná `$URL` výchozí hodnotu přepíše prázdným řetězcem.

Kontroly boardu a defektů (`kontrola-boardu.py`, `kontrola-defektu.py`) a návrh práce (`navrh-session.py`) potřebují token GitHubu, postup je ve skillu. Spouštění Robot Frameworku, diagnostika pádů a tagy testů: skill, sekce 2. Počty testů jsou jen v README, tabulka „Testy v číslech“.

## Pravidla

- **Nikdy nenasazovat s červenou CI.** Každý commit musí projít CI, ne jen poslední v dávce.
- **Tajné hodnoty (PIN, klíče, tokeny) nikdy do repa ani do logu.** V reportech testů se nic tajného nevypisuje, pravidla jsou ve skillu (sekce o incidentu #33).
- **Nové testy = aktualizovat počty v README ve stejném commitu.** Hlídá je `kontrola-poctu-testu.py`.
- **Nový nástroj nebo závislost = řádek v README** (sekce „Nástroje a technologie“) ve stejném commitu. Hlídá `kontrola-nastroju.py`.
- **Změna kritické funkce backendu = počkat na mutační CI** (`mutacni-testy.yml`). Při pádu pod práh doplnit testy, práh nesnižovat.
- **Každá změna kódu zvyšuje verzi** (backend na dvou místech v `kulturni_radar.gs`, `Index.html` má vlastní číslo) a zapisuje se do CHANGELOGu.
- **Dva nezávislé nasazovací kanály:** backend přes `clasp` (Apps Script), frontend i přes `git push` (Cloudflare Pages). Při změně `Index.html` nasadit oba.
- **Před commitem celá sada jednotkových testů** (příkaz výše).
- **Změna dokumentace ve stejném commitu jako kód, který popisuje.**
- **Pořadí při zavírání issue:** issue s přeškrtnutím v BACKLOGu zavřít hned po pushi a CI; kontroly (`kontrola-boardu.py`, `kontrola-defektu.py`) i ruční běh `kontrola-projektu.yml` spouštět až po zavření, jinak hlásí falešný nález.
- **Defekty se zakládají formulářem `defekt.yml`, práce se plánuje přes board** (Backlog → In Progress → Done, WIP limit 3); při zavření issue odškrtnout checklist. Pravidla jsou ve skillu.

## Kam dál

- [Docs/README.md](Docs/README.md): mapa dokumentace.
- [README.md](README.md): přehled projektu, počty testů, soupis nástrojů.
- [Docs/testovani/ARCHITEKTURA-TESTU.md](Docs/testovani/ARCHITEKTURA-TESTU.md): jak jsou testy postavené a pravidla test designu.
- [Docs/kulturni-radar-workflow/SKILL.md](Docs/kulturni-radar-workflow/SKILL.md): skill `kulturni-radar-workflow` s postupy nasazení, ladění testů, správy boardu a dokumentace (nainstalovaná kopie je v `.claude/skills/`).
