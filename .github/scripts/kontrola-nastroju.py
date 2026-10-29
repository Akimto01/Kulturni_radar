#!/usr/bin/env python3
"""Kontrola, že README (sekce „Nástroje a technologie“) uvádí každý nástroj, který repo používá.

Pravidlo: nový nástroj nebo závislost = řádek v README ve stejném commitu (SKILL.md, sekce 4).
Skript ze zdrojů pravdy v repu sestaví seznam nástrojů a ověří, že každý má v tabulkách té sekce
řádek. Hledá se podle IDENTIFIKÁTORU v prvním sloupci (text v zpětných apostrofech, bez ohledu
na velikost písmen), ne podle volného textu: zmínka v jiném sloupci ani mimo tabulku nestačí.
Jen čte, nic nespouští a nic nemění.

Zdroje pravdy a identifikátor, který z nich vznikne:
  - package.json (dependencies a devDependencies)       název balíčku (postal-mime, wrangler)
  - requirements*.txt                                    název balíčku (robotframework-browser)
  - Library v tests/robot/*.robot                        název balíčku podle KNIHOVNA_NA_BALIK,
                                                         neznámá knihovna = její vlastní název
  - uses: ve .github/workflows/*.yml mimo actions/*      název akce (owner/repo)
  - unpkg.com/<balíček>@verze v apps-script/*.html       název balíčku (leaflet)
  - .clasp.json                                          clasp
  - wrangler.toml / wrangler.json(c)                     wrangler
  - podsložky api-tests/ (soapui, bruno, jmeter)         název složky

Výjimky (nehlídají se, důvod u konstant níže): STANDARDNI_KNIHOVNY_RF, OFICIALNI_AKCE_PREFIX.

    python .github/scripts/kontrola-nastroju.py          # exit 1 a výpis chybějících, když něco chybí
    python .github/scripts/kontrola-nastroju.py --test   # simulované repo, vč. negativních zkoušek
"""
import json
import os
import re
import sys
import tempfile
from pathlib import Path

KOREN = Path(__file__).resolve().parents[2]
README_SEKCE = 'Nástroje a technologie'

# Standardní knihovny Robot Frameworku jsou součástí balíčku robotframework, který v README
# má vlastní řádek; samostatný řádek pro ně není potřeba.
STANDARDNI_KNIHOVNY_RF = {'BuiltIn', 'Collections', 'DateTime', 'Dialogs', 'OperatingSystem', 'Process',
                          'Screenshot', 'String', 'Telnet', 'XML'}
# Knihovna Robot Frameworku -> balíček z requirements.txt (ten je v README pod názvem balíčku).
KNIHOVNA_NA_BALIK = {'Browser': 'robotframework-browser', 'RequestsLibrary': 'robotframework-requests'}
# Oficiální akce GitHubu (actions/checkout, setup-node, …) jsou jeden druh nástroje, který v README
# pokrývá řádek github-actions; kontrolují se jen akce třetích stran.
OFICIALNI_AKCE_PREFIX = 'actions/'

# .stryker-tmp a .stryker-src: pracovní kopie mutačního testování (obsahují kopie package.json a zdrojů)
PRUNE = {'node_modules', '.git', '.wrangler', '__pycache__', '.stryker-tmp', '.stryker-src', 'reports'}


def _soubory(koren, maska):
    """Soubory podle regulárního výrazu na názvu (bez složek node_modules a .git)."""
    for adresar, podsložky, soubory in os.walk(koren):
        podsložky[:] = [d for d in podsložky if d not in PRUNE]
        for s in sorted(soubory):
            if re.fullmatch(maska, s):
                yield Path(adresar) / s


def _rel(cesta, koren):
    return Path(cesta).relative_to(koren).as_posix()


def balicky_package_json(text):
    data = json.loads(text)
    return [n for k in ('dependencies', 'devDependencies') for n in (data.get(k) or {})]


def balicky_requirements(text):
    nazvy = []
    for radek in text.splitlines():
        radek = radek.split('#', 1)[0].strip()
        m = re.match(r'^([A-Za-z0-9][A-Za-z0-9._-]*)', radek)
        if m and not radek.startswith('-'):
            nazvy.append(m.group(1).replace('_', '-'))
    return nazvy


def knihovny_robot(text):
    """Názvy knihoven z řádků Library v .robot (cesty k vlastním souborům se přeskočí)."""
    nazvy = []
    for m in re.finditer(r'^Library[ \t]+(\S+)', text, re.M):
        n = m.group(1)
        if '/' in n or n.endswith(('.py', '.resource')):
            continue
        nazvy.append(n)
    return nazvy


def akce_workflow(text):
    """Akce třetích stran z uses: (bez actions/* a lokálních ./)."""
    nazvy = []
    for m in re.finditer(r'^\s*-?\s*uses:\s*([^@\s]+)@', text, re.M):
        n = m.group(1)
        if not n.startswith(OFICIALNI_AKCE_PREFIX) and not n.startswith('.'):
            nazvy.append(n)
    return nazvy


def knihovny_unpkg(text):
    return re.findall(r'unpkg\.com/(@?[^@/"\'\s]+)@', text)


def sebrat_nastroje(koren):
    """Slovník {identifikátor (malými písmeny): zdroj v repu} ze všech zdrojů pravdy."""
    koren = Path(koren)
    n = {}

    def pridat(ident, zdroj):
        n.setdefault(ident.lower(), zdroj)

    for p in _soubory(koren, r'package\.json'):
        for b in balicky_package_json(p.read_text(encoding='utf-8')):
            pridat(b, _rel(p, koren))
    for p in _soubory(koren, r'requirements[\w.-]*\.txt'):
        for b in balicky_requirements(p.read_text(encoding='utf-8')):
            pridat(b, _rel(p, koren))
    for p in _soubory(koren / 'tests', r'.*\.robot') if (koren / 'tests').is_dir() else []:
        for k in knihovny_robot(p.read_text(encoding='utf-8')):
            if k not in STANDARDNI_KNIHOVNY_RF:
                pridat(KNIHOVNA_NA_BALIK.get(k, k), _rel(p, koren))
    wf = koren / '.github' / 'workflows'
    for p in sorted(wf.glob('*.y*ml')) if wf.is_dir() else []:
        for a in akce_workflow(p.read_text(encoding='utf-8')):
            pridat(a, _rel(p, koren))
    for p in _soubory(koren / 'apps-script', r'.*\.html') if (koren / 'apps-script').is_dir() else []:
        for b in knihovny_unpkg(p.read_text(encoding='utf-8')):
            pridat(b, _rel(p, koren))
    if (koren / '.clasp.json').is_file():
        pridat('clasp', '.clasp.json')
    for p in _soubory(koren, r'wrangler\.(toml|jsonc?)'):
        pridat('wrangler', _rel(p, koren))
    api = koren / 'api-tests'
    for d in sorted(api.iterdir()) if api.is_dir() else []:
        if d.is_dir():
            pridat(d.name, 'api-tests/' + d.name + '/')
    return n


def identifikatory_readme(text):
    """Množina identifikátorů z prvního sloupce tabulek v sekci README; None, když sekce chybí."""
    radky = text.splitlines()
    try:
        zacatek = next(i for i, r in enumerate(radky) if re.match(r'^##\s+' + re.escape(README_SEKCE) + r'\s*$', r))
    except StopIteration:
        return None
    ids = set()
    for r in radky[zacatek + 1:]:
        if re.match(r'^##\s', r):
            break
        if not r.lstrip().startswith('|'):
            continue
        bunka = r.strip().strip('|').split('|', 1)[0]
        ids.update(i.strip().lower() for i in re.findall(r'`([^`]+)`', bunka))
    return ids


def chybejici(nastroje, ids):
    return sorted((i, z) for i, z in nastroje.items() if i not in ids)


def zkontrolovat(koren, readme_text):
    """Vrací (nástroje, chybějící) nebo (nástroje, None), když v README chybí celá sekce."""
    nastroje = sebrat_nastroje(koren)
    ids = identifikatory_readme(readme_text)
    return nastroje, (None if ids is None else chybejici(nastroje, ids))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if '--test' in sys.argv[1:]:
        return vlastni_test()
    readme = (KOREN / 'README.md').read_text(encoding='utf-8')
    nastroje, chybi = zkontrolovat(KOREN, readme)
    if chybi is None:
        print('V README chybí sekce „%s“.' % README_SEKCE)
        return 1
    print('Nástrojů a závislostí ze zdrojů v repu: %d, v README zapsáno: %d identifikátorů.'
          % (len(nastroje), len(identifikatory_readme(readme))))
    if chybi:
        print('\nV README (sekce „%s“) chybí řádek s identifikátorem v prvním sloupci pro:' % README_SEKCE)
        for ident, zdroj in chybi:
            print('  %-32s (zdroj: %s)' % (ident, zdroj))
        print('\nPřidej řádek do README ve stejném commitu, ve kterém nástroj přibyl (identifikátor v zpětných apostrofech).')
        return 1
    print('Každý nástroj má v README řádek.')
    return 0


def vlastni_test():
    """Simulované repo v dočasné složce: shoda, negativní zkoušky pro každý zdroj, tvar tabulky."""
    selhani = 0

    def over(ok, popis):
        nonlocal selhani
        selhani += not ok
        print('%-4s %s' % ('OK' if ok else 'CHYBA', popis))

    def zapsat(koren, cesta, text):
        p = Path(koren) / cesta
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding='utf-8')

    def repo(koren):
        zapsat(koren, 'cloudflare-worker/package.json', json.dumps({'dependencies': {'postal-mime': '^3.0.0'}, 'devDependencies': {'wrangler': '^4.0.0'}}))
        zapsat(koren, 'cloudflare-worker/wrangler.toml', 'name = "x"\n')
        zapsat(koren, 'cloudflare-worker/node_modules/zbytecny/package.json', json.dumps({'dependencies': {'nemelo-se-cist': '1'}}))
        zapsat(koren, '.stryker-tmp/sandbox-x/package.json', json.dumps({'dependencies': {'kopie-ze-sandboxu': '1'}}))
        zapsat(koren, 'tests/robot/requirements.txt', 'robotframework==7.5  # test\nrobotframework-browser==20.6.0\nrobotframework-requests==0.9.7\n')
        zapsat(koren, 'tests/robot/api.robot', '*** Settings ***\nLibrary           RequestsLibrary\nLibrary    Collections\nLibrary\tString\nResource          resources.robot\n')
        zapsat(koren, 'tests/robot/frontend.robot', '*** Settings ***\nLibrary           Browser\nLibrary           moje.py\n')
        zapsat(koren, '.github/workflows/ci.yml', 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v5\n      - uses: actions/setup-node@v6\n')
        zapsat(koren, 'apps-script/Index.html', '<link href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">\n<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>\n')
        zapsat(koren, '.clasp.json', '{}')
        for d in ('soapui', 'bruno', 'jmeter'):
            zapsat(koren, 'api-tests/%s/x.txt' % d, '')
        zapsat(koren, 'api-tests/README.md', 'soubor, ne složka')

    def readme(*ids, jiny_sloupec=()):
        radky = ['# Projekt', '', '## Něco jiného', '', '| A | B |', '|---|---|', '| `mimo-sekci` | x |', '', '## ' + README_SEKCE, '',
                 '| Nástroj | K čemu | Kde |', '|---|---|---|']
        radky += ['| Něco (`%s`) | k čemu | kde |' % i for i in ids]
        radky += ['| Ruční řádek | používá `%s` | kde |' % i for i in jiny_sloupec]
        radky += ['', '## Další sekce', '', '| `po-sekci` | x |']
        return chr(10).join(radky)

    VSE = ('postal-mime', 'wrangler', 'robotframework', 'robotframework-browser', 'robotframework-requests', 'clasp',
           'soapui', 'bruno', 'jmeter', 'leaflet')

    with tempfile.TemporaryDirectory() as tmp:
        repo(tmp)
        nastroje, chybi = zkontrolovat(tmp, readme(*VSE))
        over(set(nastroje) == set(VSE), 'zdroje: sebrané nástroje %s' % sorted(nastroje))
        over('nemelo-se-cist' not in nastroje and 'kopie-ze-sandboxu' not in nastroje, 'zdroje: node_modules a .stryker-tmp se nečtou')
        over('collections' not in nastroje and 'string' not in nastroje and 'actions/checkout' not in nastroje, 'výjimky: standardní knihovny RF a actions/* se nevyžadují')
        over(chybi == [], 'úplná tabulka: kontrola projde (chybí %s)' % chybi)

        # shoda nezávisí na velikosti písmen a nedbá na části sekce mimo tabulku
        over(zkontrolovat(tmp, readme(*[i.upper() for i in VSE]))[1] == [], 'identifikátor v README bez ohledu na velikost písmen')
        # každý jednotlivý nástroj, kterého v README chybí, je nalezen
        for ident in sorted(nastroje):
            _, chybi = zkontrolovat(tmp, readme(*[i for i in VSE if i != ident]))
            over([c[0] for c in chybi] == [ident], 'negativní zkouška: chybí řádek pro %s -> selže jen kvůli němu' % ident)
        # zmínka mimo první sloupec nebo mimo sekci nestačí
        _, chybi = zkontrolovat(tmp, readme(*[i for i in VSE if i != 'wrangler'], jiny_sloupec=('wrangler',)))
        over([c[0] for c in chybi] == ['wrangler'], 'identifikátor jen v jiném sloupci nestačí')
        _, chybi = zkontrolovat(tmp, readme(*[i for i in VSE if i != 'clasp']) + chr(10) + chr(10) + '| `clasp` | po sekci |')
        over([c[0] for c in chybi] == ['clasp'], 'řádek mimo sekci (za dalším nadpisem) nestačí')
        over(zkontrolovat(tmp, '# Projekt\n\n## Jiná sekce\n')[1] is None, 'README bez sekce „%s“ je chyba' % README_SEKCE)

    # simulovaná nová závislost bez řádku v README musí selhat (po jedné ve čtyřech zdrojích)
    nove = [
        ('cloudflare-worker/package.json', json.dumps({'dependencies': {'postal-mime': '1', 'left-pad': '^1.3.0'}, 'devDependencies': {'wrangler': '1'}}), 'left-pad', 'nová závislost v package.json'),
        ('tests/robot/requirements.txt', 'robotframework==7.5\nrobotframework-databaselibrary==2.0\n', 'robotframework-databaselibrary', 'nový balíček v requirements.txt'),
        ('tests/robot/api.robot', '*** Settings ***\nLibrary    DatabaseLibrary\n', 'databaselibrary', 'nová knihovna Robot Frameworku'),
        ('.github/workflows/ci.yml', 'steps:\n  - uses: softprops/action-gh-release@v2\n', 'softprops/action-gh-release', 'nová akce třetí strany'),
        ('apps-script/Index.html', '<script src="https://unpkg.com/chart.js@4.4.0/dist/chart.umd.js"></script>', 'chart.js', 'nová knihovna z unpkg'),
        ('api-tests/postman/x.json', '{}', 'postman', 'nová složka v api-tests'),
    ]
    for cesta, obsah, ident, popis in nove:
        with tempfile.TemporaryDirectory() as tmp:
            repo(tmp)
            zapsat(tmp, cesta, obsah)
            _, chybi = zkontrolovat(tmp, readme(*VSE))
            over(ident in [c[0] for c in chybi], 'negativní zkouška: %s (%s) bez řádku v README selže' % (popis, ident))
            _, chybi = zkontrolovat(tmp, readme(*VSE, ident))
            over(chybi == [], 'po doplnění řádku s identifikátorem %s kontrola projde' % ident)

    # rozbor jednotlivých zdrojů
    over(balicky_requirements('# komentář\n-r jiny.txt\nPyYAML>=6  # x\nfoo_bar[extra]==1\n\n') == ['PyYAML', 'foo-bar'], 'requirements: komentáře, -r a rozšíření')
    over(akce_workflow('- uses: ./.github/actions/x\n- uses: actions/cache@v4\n- uses: a/b@sha\n    uses: c/d@v1') == ['a/b', 'c/d'], 'uses: bez lokálních a actions/*')
    over(knihovny_robot('Library    ../lib/x.py\nLibrary  Browser  timeout=5\n  Library    Neco') == ['Browser'], 'Library: cesty se přeskočí, argumenty ne')
    print(chr(10) + ('Test prošel.' if not selhani else 'Test selhal: %d chyb.' % selhani))
    return 1 if selhani else 0


if __name__ == '__main__':
    sys.exit(main())
