#!/usr/bin/env python3
"""Kontrola odkazů a úplnosti rozcestníku dokumentace (issue #56).

Pravidlo: odkazy v dokumentaci musí vést na existující soubor a Docs/README.md (rozcestník)
musí obsahovat každý dokument a všech 11 rolí. Jen čte, nic nemění, stačí standardní knihovna.

Kontroly:
  1. Relativní odkazy v README.md, AGENTS.md, CLAUDE.md a Docs/** (mimo VYNECHAT_ZDROJE) vedou na
     existující soubor nebo složku (rozlišuje se velikost písmen jako na Linuxu v CI). U kotev
     (#…) v souborech .md musí existovat nadpis, ze kterého GitHub kotvu vyrobí (malá písmena,
     mezery na pomlčky, interpunkce pryč, diakritika zůstává, opakovaný nadpis dostane -1, -2).
     Odkazy v blocích kódu a v `inline kódu` se nekontrolují, externí (https, mailto) také ne.
  2. Každý .md v Docs/ je v Docs/README.md (odkazem na soubor nebo na jeho složku) a tabulka
     „Podle rolí“ má řádek pro každou z ROLE.
  3. „plánováno [#N]“ v tabulce rolí ukazuje na otevřené issue; zavřené je jen varování. Stav čte
     `gh`, jen když je token (GH_TOKEN nebo GITHUB_TOKEN), jinak se bod přeskočí s výpisem.

Chyba = exit 1 (červená CI), varování jen výpis.

    python .github/scripts/kontrola-dokumentace.py          # ostrá kontrola repa
    python .github/scripts/kontrola-dokumentace.py --test   # samotest vč. negativních zkoušek
"""
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path
from urllib.parse import unquote

KOREN = Path(__file__).resolve().parents[2]

# Zdroje, jejichž odkazy se nekontrolují. Archiv i CHANGELOG popisují stav k datu zápisu, odkazy
# na dnes přesunuté nebo přejmenované soubory v nich jsou historicky správně a opravovat je by
# přepisovalo historii. Odkazy NA tyto soubory z ostatních dokumentů se kontrolují normálně.
VYNECHAT_ZDROJE = ('Docs/archiv/', 'Docs/CHANGELOG.md')

ROZCESTNIK = 'Docs/README.md'
SEKCE_ROLI = 'Podle rolí'
ROLE = ['PM', 'CEO', 'Partner', 'QA lead', 'Hodnotitel', 'Vývojář a AI agent', 'Bezpečnost',
        'Provoz', 'AI specialista', 'Právník', 'UX']

PRUNE = {'node_modules', '.git', '.wrangler', '__pycache__', '.stryker-tmp', '.stryker-src'}
ODKAZ = re.compile(r'!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)')
NADPIS = re.compile(r'^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$')
OPLOT = re.compile(r'^\s{0,3}(```|~~~)')


def _rel(cesta, koren):
    return Path(cesta).relative_to(koren).as_posix()


def _soubory_md(koren):
    """Kontrolované zdroje: README.md, AGENTS.md, CLAUDE.md a Docs/**/*.md (bez VYNECHAT_ZDROJE)."""
    vysledek = []
    for nazev in ('README.md', 'AGENTS.md', 'CLAUDE.md'):
        if (koren / nazev).is_file():
            vysledek.append(koren / nazev)
    docs = koren / 'Docs'
    for adresar, podslozky, soubory in os.walk(docs):
        podslozky[:] = sorted(d for d in podslozky if d not in PRUNE)
        for s in sorted(soubory):
            if s.endswith('.md'):
                cesta = Path(adresar) / s
                rel = _rel(cesta, koren)
                if not any(rel == v or rel.startswith(v) for v in VYNECHAT_ZDROJE):
                    vysledek.append(cesta)
    return vysledek


def _radky_mimo_kod(text):
    """(číslo řádku, řádek) bez bloků kódu."""
    v_bloku = False
    for i, radek in enumerate(text.splitlines(), 1):
        if OPLOT.match(radek):
            v_bloku = not v_bloku
            continue
        if not v_bloku:
            yield i, radek


def kotva_z_nadpisu(nadpis):
    """Kotva, kterou z nadpisu vyrobí GitHub: bez značek, malá písmena, mezery na pomlčky,
    interpunkce pryč (zůstávají písmena včetně diakritiky, číslice, pomlčka a podtržítko)."""
    t = re.sub(r'!?\[([^\]]*)\]\([^)]*\)', r'\1', nadpis)   # odkaz -> jeho text
    t = re.sub(r'<[^>]+>', '', t)                           # HTML značky
    t = t.replace('`', '')
    vystup = []
    for znak in t.lower():
        if znak == ' ':
            vystup.append('-')
        elif znak.isalnum() or znak in '-_' or unicodedata.category(znak).startswith('M'):
            vystup.append(znak)
    return ''.join(vystup)


def kotvy_souboru(cesta, cache):
    if cesta not in cache:
        kotvy, pocty = set(), {}
        for _, radek in _radky_mimo_kod(Path(cesta).read_text(encoding='utf-8')):
            m = NADPIS.match(radek)
            if not m:
                continue
            zaklad = kotva_z_nadpisu(m.group(1))
            n = pocty.get(zaklad, 0)
            kotvy.add(zaklad if n == 0 else f'{zaklad}-{n}')
            pocty[zaklad] = n + 1
        cache[cesta] = kotvy
    return cache[cesta]


def existuje_presne(cesta, koren):
    """Existence s rozlišením velikosti písmen (Windows ji ignoruje, Linux v CI ne). Velikost se
    ověřuje od kořene repa dolů (kořen samotný se neověřuje, na Windows může mít krátký název)."""
    if not os.path.exists(cesta):
        return False
    rel = os.path.relpath(cesta, koren)
    if rel == '.' or rel.startswith('..'):
        return True
    aktualni = str(koren)
    for cast in Path(rel).parts:
        if cast not in os.listdir(aktualni):
            return False
        aktualni = os.path.join(aktualni, cast)
    return True


def odkazy_v_souboru(cesta):
    """(řádek, cíl odkazu) bez bloků kódu a inline kódu."""
    for i, radek in _radky_mimo_kod(Path(cesta).read_text(encoding='utf-8')):
        radek = re.sub(r'`[^`]*`', '', radek)
        for m in ODKAZ.finditer(radek):
            yield i, m.group(1)


def zkontroluj_odkazy(koren):
    chyby, cache = [], {}
    for zdroj in _soubory_md(koren):
        for radek, cil in odkazy_v_souboru(zdroj):
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', cil) or cil.startswith('/'):
                continue                                        # https:, mailto:, absolutní
            cesta_cast, _, kotva = cil.partition('#')
            cesta_cast, kotva = unquote(cesta_cast), unquote(kotva)
            cil_cesta = zdroj if not cesta_cast else (zdroj.parent / cesta_cast)
            misto = f'{_rel(zdroj, koren)}:{radek}'
            if not existuje_presne(os.path.normpath(cil_cesta), koren):
                chyby.append(f'{misto}  odkaz vede na neexistující soubor: {cil}')
                continue
            if kotva and Path(cil_cesta).is_file() and str(cil_cesta).endswith('.md'):
                if kotva.lower() not in kotvy_souboru(os.path.normpath(cil_cesta), cache):
                    chyby.append(f'{misto}  odkaz na neexistující kotvu (nadpis): {cil}')
    return chyby


def _sekce(text, nadpis):
    """Řádky sekce „## nadpis“ až do dalšího nadpisu druhé úrovně."""
    radky, uvnitr, vysledek = text.splitlines(), False, []
    for radek in radky:
        if re.match(r'^##\s+', radek):
            uvnitr = radek.strip() == f'## {nadpis}'
            continue
        if uvnitr:
            vysledek.append(radek)
    return vysledek


def zkontroluj_rozcestnik(koren):
    chyby = []
    cesta = koren / ROZCESTNIK
    if not cesta.is_file():
        return [f'{ROZCESTNIK}  rozcestník neexistuje']
    pokryte = set()
    for _, cil in odkazy_v_souboru(cesta):
        if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', cil):
            continue
        p = os.path.normpath(cesta.parent / unquote(cil.partition('#')[0])) if cil.partition('#')[0] else None
        if p:
            pokryte.add(Path(p).resolve())
    for adresar, podslozky, soubory in os.walk(koren / 'Docs'):
        podslozky[:] = sorted(d for d in podslozky if d not in PRUNE)
        for s in sorted(soubory):
            md = (Path(adresar) / s).resolve()
            if not s.endswith('.md') or md == cesta.resolve():
                continue
            if not any(md == p or p in md.parents for p in pokryte):
                chyby.append(f'{ROZCESTNIK}  dokument není v rozcestníku: {_rel(Path(adresar) / s, koren)}')
    prvni_sloupec = set()
    for radek in _sekce(cesta.read_text(encoding='utf-8'), SEKCE_ROLI):
        if radek.startswith('|'):
            bunky = [b.strip() for b in radek.strip().strip('|').split('|')]
            if bunky:
                prvni_sloupec.add(bunky[0].lower())
    if not prvni_sloupec:
        chyby.append(f'{ROZCESTNIK}  chybí sekce „{SEKCE_ROLI}“ s tabulkou')
    else:
        for role in ROLE:
            if role.lower() not in prvni_sloupec:
                chyby.append(f'{ROZCESTNIK}  v tabulce „{SEKCE_ROLI}“ chybí role: {role}')
    return chyby


def planovana_issues(koren):
    """Čísla issues z buněk tabulky rolí po slově „plánováno“."""
    cesta = koren / ROZCESTNIK
    cisla = {}
    if not cesta.is_file():
        return cisla
    for radek in _sekce(cesta.read_text(encoding='utf-8'), SEKCE_ROLI):
        if not radek.startswith('|'):
            continue
        for bunka in radek.strip().strip('|').split('|'):
            i = bunka.find('plánováno')
            if i >= 0:
                for n in re.findall(r'#(\d+)', bunka[i:]):
                    cisla[int(n)] = radek.strip().strip('|').split('|')[0].strip()
    return cisla


def stav_issue_gh(cislo):
    """'OPEN' / 'CLOSED' přes gh, None při chybě."""
    try:
        p = subprocess.run(['gh', 'issue', 'view', str(cislo), '--json', 'state', '-q', '.state'],
                           capture_output=True, text=True, timeout=60, encoding='utf-8')
    except (OSError, subprocess.SubprocessError):
        return None
    return p.stdout.strip() if p.returncode == 0 and p.stdout.strip() else None


def zkontroluj_planovano(koren, stav_issue):
    chyby, varovani = [], []
    for cislo, role in sorted(planovana_issues(koren).items()):
        stav = stav_issue(cislo)
        if stav is None:
            varovani.append(f'{ROZCESTNIK}  stav issue #{cislo} (role {role}) se nepodařilo zjistit')
        elif stav != 'OPEN':
            varovani.append(f'{ROZCESTNIK}  „plánováno #{cislo}“ (role {role}) ukazuje na zavřené issue, přepsat stav')
    return chyby, varovani


def zkontroluj(koren, stav_issue=None):
    """(chyby, varování, přeskočeno) pro daný kořen repa."""
    chyby = zkontroluj_odkazy(koren) + zkontroluj_rozcestnik(koren)
    if stav_issue is None:
        return chyby, [], True
    c, v = zkontroluj_planovano(koren, stav_issue)
    return chyby + c, v, False


# ---------------------------------------------------------------- samotest

def _zapis(koren, soubory):
    for rel, obsah in soubory.items():
        p = koren / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(obsah, encoding='utf-8')


def _rozcestnik(role=None, extra=''):
    radky = [f'| {r} | co | [README](../README.md) | máme |' for r in (role or ROLE)]
    radky[0] = '| ' + (role or ROLE)[0] + ' | co | [README](../README.md) | základ, plánováno [#7](https://x/7) |'
    return ('# Dokumentace\n\n## Podle rolí\n\n| Role | Co | Kam | Stav |\n|---|---|---|---|\n'
            + '\n'.join(radky) + '\n\n## Projekt\n\n[BACKLOG](BACKLOG.md)\n[CHANGELOG](CHANGELOG.md)\n[Archiv](archiv/)\n' + extra)


ZAKLAD = {
    'README.md': '# Projekt\n\n## Podle rolí\n\nOdkaz [rozcestník](Docs/README.md#podle-rolí) a [kód](`neexistuje.md`).\n',
    'AGENTS.md': '# Agenti\n\n[Mapa](Docs/README.md)\n',
    'CLAUDE.md': '# Claude\n\n[Agenti](AGENTS.md)\n',
    'Docs/BACKLOG.md': '# Backlog\n\n## 1. Úkol: A, B\n\nOdkaz [sem](#1-úkol-a-b) a [opakovaný](#kroky-1).\n\n## Kroky\n\n## Kroky\n',
    'Docs/archiv/stary/README.md': '# Archiv\n\n[starý odkaz](uz-neexistuje.md)\n',
    'Docs/CHANGELOG.md': '# Changelog\n\n[starý odkaz](Docs/smazano.md)\n',
}


def _pripad(nazev, uprava, ocekavana_chyba, stav=None):
    """Čisté repo se změnou: musí nahlásit chybu obsahující ocekavana_chyba (None = projde čistě)."""
    with tempfile.TemporaryDirectory() as tmp:
        koren = Path(tmp)
        soubory = dict(ZAKLAD)
        soubory[ROZCESTNIK] = _rozcestnik()
        uprava(soubory)
        _zapis(koren, soubory)
        chyby, varovani, _ = zkontroluj(koren, stav or (lambda n: 'OPEN'))
    ok = (not chyby) if ocekavana_chyba is None else any(ocekavana_chyba in c for c in chyby)
    print(f'  [{"OK" if ok else "SELHALO"}] {nazev}' + ('' if ok else f'  chyby={chyby}'))
    return ok, varovani


def samotest():
    vysledky = []

    def over(nazev, uprava, chyba):
        ok, _ = _pripad(nazev, uprava, chyba)
        vysledky.append(ok)

    print('Pozitivní zkouška:')
    over('čistá data projdou (kotva s diakritikou, interpunkcí a opakovaným nadpisem, '
         'odkaz v kódu, archiv a CHANGELOG mimo kontrolu)', lambda s: None, None)

    print('Negativní zkoušky (každá musí skončit chybou):')
    over('rozbitý odkaz', lambda s: s.__setitem__('AGENTS.md', '# A\n\n[x](Docs/nic.md)\n'),
         'neexistující soubor')
    over('neexistující kotva', lambda s: s.__setitem__('AGENTS.md', '# A\n\n[x](Docs/README.md#neni-tu)\n'),
         'neexistující kotvu')
    over('odkaz s jinou velikostí písmen (v CI na Linuxu by selhal)',
         lambda s: s.__setitem__('AGENTS.md', '# A\n\n[x](docs/README.md)\n'), 'neexistující soubor')
    over('nezařazený dokument', lambda s: s.__setitem__('Docs/NOVY.md', '# Nový\n'),
         'není v rozcestníku: Docs/NOVY.md')
    over('chybějící role', lambda s: s.__setitem__(ROZCESTNIK, _rozcestnik(ROLE[:-1])),
         'chybí role: UX')

    print('„plánováno #N“:')
    ok, varovani = _pripad('zavřené issue je jen varování, ne chyba', lambda s: None, None,
                           stav=lambda n: 'CLOSED')
    vysledky.append(ok and any('zavřené issue' in v for v in varovani))
    print(f'  [{"OK" if vysledky[-1] else "SELHALO"}] varování o zavřeném issue vypsáno')
    ok, varovani = _pripad('neznámý stav issue je jen varování', lambda s: None, None, stav=lambda n: None)
    vysledky.append(ok and bool(varovani))
    print(f'  [{"OK" if vysledky[-1] else "SELHALO"}] varování o nezjištěném stavu vypsáno')

    print('Kotvy (shoda s pravidly GitHubu):')
    pripady = {'Podle rolí': 'podle-rolí', '1. Města s diakritikou bez akcí': '1-města-s-diakritikou-bez-akcí',
               'CI: kontrola `odkazů` (#56)': 'ci-kontrola-odkazů-56', 'Stálá místa – přehled': 'stálá-místa--přehled',
               '[Odkaz](x.md) a text': 'odkaz-a-text'}
    for nadpis, cekano in pripady.items():
        ok = kotva_z_nadpisu(nadpis) == cekano
        vysledky.append(ok)
        print(f'  [{"OK" if ok else "SELHALO"}] „{nadpis}“ -> #{cekano}' + ('' if ok else f'  (je {kotva_z_nadpisu(nadpis)})'))

    if not all(vysledky):
        print('Samotest SELHAL.')
        return 1
    print(f'Samotest prošel ({len(vysledky)} zkoušek).')
    return 0


# ---------------------------------------------------------------- ostrý běh

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if '--test' in sys.argv:
        return samotest()
    stav = None
    if os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN'):
        stav = stav_issue_gh
    chyby, varovani, preskoceno = zkontroluj(KOREN, stav)
    pocet = len(_soubory_md(KOREN))
    print(f'Zkontrolováno souborů: {pocet}')
    if preskoceno:
        print('Přeskočeno: stav issues „plánováno #N“ (bez GH_TOKEN nebo GITHUB_TOKEN).')
    for v in varovani:
        print(f'VAROVÁNÍ  {v}')
    for c in chyby:
        print(f'CHYBA     {c}')
    print(f'\nChyb: {len(chyby)}, varování: {len(varovani)}')
    return 1 if chyby else 0


if __name__ == '__main__':
    sys.exit(main())
