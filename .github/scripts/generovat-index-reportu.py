"""Vygeneruje web/index.html (a zkopíruje report.html a log.html) z výsledků Robot Frameworku.

Použití (viz .github/workflows/publikovat-report.yml):
    python3 generovat-index-reportu.py --vysledky vysledky --meta beh.json --repo Akimto01/Kulturni_radar --vystup web

Jen standardní knihovna. Publikují se výhradně report.html a log.html obou sad,
nikdy output.xml, screenshoty ani playwright-log.txt.
"""
import argparse
import html
import json
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

SADY = [
    ('api', 'API kontrakt', 'Přímé volání API (9 testů kontraktu a živosti kanálu).'),
    ('frontend', 'Frontend E2E', 'Prohlížeč (Playwright) proti kulturniradar.cz, včetně zápisových testů profilu rf-test.'),
]
SOUBORY = ['report.html', 'log.html']

STYL = """
:root { --bg:#faf8f4; --text:#1c1b22; --muted:#5b5a66; --card:#fff; --line:#ddd8cf; --ok:#1b6e3a; --bad:#b3261e; --accent:#d4552f; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#17161b; --text:#ecebf0; --muted:#a3a2ad; --card:#201f26; --line:#34333c; --ok:#6fcf97; --bad:#ff8a80; --accent:#ff8a65; }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
main { max-width:760px; margin:0 auto; padding:32px 16px 48px; }
h1 { font-size:1.6rem; margin:0 0 4px; }
.podtitul { color:var(--muted); margin:0 0 24px; }
.karta { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px 18px; margin:0 0 16px; }
.karta h2 { font-size:1.1rem; margin:0 0 4px; }
.karta p { margin:4px 0 10px; color:var(--muted); font-size:.95rem; }
.cisla { display:flex; gap:20px; flex-wrap:wrap; margin:8px 0 12px; }
.cisla div { min-width:80px; }
.cisla b { display:block; font-size:1.5rem; }
.ok { color:var(--ok); } .bad { color:var(--bad); }
.odkazy a { margin-right:16px; }
a { color:var(--accent); }
dl { display:grid; grid-template-columns:max-content 1fr; gap:4px 16px; margin:0; }
dt { color:var(--muted); } dd { margin:0; }
.poznamka { font-size:.9rem; color:var(--muted); border-left:3px solid var(--line); padding-left:12px; margin-top:24px; }
footer { margin-top:24px; font-size:.9rem; }
"""


def e(text):
    return html.escape(str(text), quote=True)


def cesky_cas(iso):
    """'2026-10-28T13:36:03Z' -> '28. 10. 2026 14:36 (středoevropský čas)'; při chybě vrátí původní text."""
    try:
        dt = datetime.strptime(iso, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return str(iso)
    try:
        from zoneinfo import ZoneInfo
        dt = dt.astimezone(ZoneInfo('Europe/Prague'))
        zona = 'středoevropský čas'
    except Exception:
        zona = 'UTC'
    return f'{dt.day}. {dt.month}. {dt.year} {dt.hour}:{dt.minute:02d} ({zona})'


def nacti_statistiky(cesta):
    """Počty z output.xml (statistics/total/stat); None, když soubor chybí nebo je poškozený."""
    try:
        stat = ET.parse(cesta).getroot().find('statistics/total/stat')
        return {
            'prosly': int(stat.get('pass')),
            'selhalo': int(stat.get('fail')),
            'preskoceno': int(stat.get('skip', 0)),
        }
    except (OSError, ET.ParseError, AttributeError, TypeError, ValueError):
        return None


def karta_sady(klic, nazev, popis, stat, existuji):
    if stat is None:
        cisla = '<p>Pro tuto sadu nejsou k dispozici data.</p>'
    else:
        celkem = stat['prosly'] + stat['selhalo'] + stat['preskoceno']
        trida = 'bad' if stat['selhalo'] else 'ok'
        cisla = (
            '<div class="cisla">'
            f'<div><b class="ok">{stat["prosly"]}</b>prošlo</div>'
            f'<div><b class="{"bad" if stat["selhalo"] else ""}">{stat["selhalo"]}</b>selhalo</div>'
            f'<div><b>{stat["preskoceno"]}</b>přeskočeno</div>'
            f'<div><b class="{trida}">{stat["prosly"]}/{celkem}</b>celkem prošlo</div>'
            '</div>'
        )
    odkazy = ''.join(
        f'<a href="{e(klic)}/{e(s)}">{"Report" if s == "report.html" else "Log"}</a>'
        for s in SOUBORY if s in existuji
    )
    return (
        f'<section class="karta"><h2>{e(nazev)}</h2><p>{e(popis)}</p>{cisla}'
        f'<div class="odkazy">{odkazy}</div></section>'
    )


def sestav_stranku(meta, repo, sady):
    sha = str(meta.get('head_sha', ''))
    sha_ok = bool(re.fullmatch(r'[0-9a-f]{7,40}', sha))
    commit = (f'<a href="https://github.com/{e(repo)}/commit/{e(sha)}"><code>{e(sha[:7])}</code></a>'
              if sha_ok else 'neznámý')
    udalost = {'schedule': 'plánovaný týdenní běh', 'workflow_dispatch': 'ruční spuštění'}.get(
        meta.get('event'), str(meta.get('event', 'neznámá událost')))
    beh_url = str(meta.get('html_url', ''))
    beh = (f'<a href="{e(beh_url)}">běh č. {e(meta.get("run_number", "?"))} v GitHub Actions</a>'
           if beh_url.startswith(f'https://github.com/{repo}/actions/runs/') else 'neznámý')
    karty = ''.join(karta_sady(k, n, p, st, ex) for (k, n, p), (st, ex) in zip(SADY, sady))
    return f"""<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kulturní radar: výsledky E2E testů</title>
<style>{STYL}</style>
</head>
<body>
<main>
<h1>Kulturní radar: výsledky E2E testů</h1>
<p class="podtitul">Poslední běh sady Robot Framework proti ostré appce. Stránka se aktualizuje automaticky po každém týdenním běhu.</p>
<section class="karta">
<dl>
<dt>Běh testů</dt><dd>{e(cesky_cas(meta.get('created_at')))}</dd>
<dt>Spuštěno</dt><dd>{e(udalost)}</dd>
<dt>Commit</dt><dd>{commit}</dd>
<dt>Detail</dt><dd>{beh}</dd>
</dl>
</section>
{karty}
<p class="poznamka">Screenshoty pádů a ladicí log Playwrightu se záměrně nezveřejňují. Screenshot může zachytit dialog s osobním ntfy tématem a automatická kontrola úniku tajných hodnot obrázky číst neumí. Ladicí log zapisuje hodnoty přímo z DOM mimo dosah úrovně logování Robot Frameworku. Před zveřejněním se výsledky navíc prohledají na tajné hodnoty a při nálezu se nepublikují vůbec.</p>
<footer><a href="https://github.com/{e(repo)}">Zpět na repozitář {e(repo)}</a></footer>
</main>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vysledky', required=True)
    ap.add_argument('--meta', required=True)
    ap.add_argument('--repo', required=True)
    ap.add_argument('--vystup', required=True)
    a = ap.parse_args()

    vysledky, vystup = Path(a.vysledky), Path(a.vystup)
    meta = json.loads(Path(a.meta).read_text(encoding='utf-8'))
    vystup.mkdir(parents=True, exist_ok=True)

    sady = []
    for klic, _, _ in SADY:
        existuji = []
        for soubor in SOUBORY:
            zdroj = vysledky / klic / soubor
            if zdroj.is_file():
                (vystup / klic).mkdir(exist_ok=True)
                shutil.copyfile(zdroj, vystup / klic / soubor)
                existuji.append(soubor)
        sady.append((nacti_statistiky(vysledky / klic / 'output.xml'), existuji))

    (vystup / 'index.html').write_text(sestav_stranku(meta, a.repo, sady), encoding='utf-8')
    for klic, (stat, existuji) in zip((s[0] for s in SADY), sady):
        print(klic, stat, existuji)
    return 0


if __name__ == '__main__':
    sys.exit(main())
