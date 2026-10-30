#!/usr/bin/env python3
"""Varování „kód změněn, dokument ne“ (issue #62). Jen čte git, nic nemění, jen varování (exit 0).

Dokumenty zastarávají tiše: kód se změní, text zůstane. Mapování kód -> dokument je v datovém souboru
.github/scripts/mapa-kod-dokumentace.json (cesta nebo vzor, volitelně funkce z apps-script, dokument,
důvod). V období (výchozí posledních 7 dní, nebo --od) se projdou commity a varuje se, když se změnil
kód z mapy a příslušný dokument se v celém období vůbec nezměnil. Změněné řádky z `git show -U0` se
mapují na funkce podle řádků `function nazev(` ve verzi souboru v daném commitu. Commit se značkou
[bez-dokumentace] ve zprávě se nepočítá (vědomé rozhodnutí). Změna dokumentu v jakémkoli commitu
období (i takovém se značkou) dokument „obnovuje“.

    python .github/scripts/kontrola-dokumentace-kodu.py                  # posledních 7 dní
    python .github/scripts/kontrola-dokumentace-kodu.py --od 2026-10-23  # od data
    python .github/scripts/kontrola-dokumentace-kodu.py --od abc1234     # od commitu (bez něj samotného)
    python .github/scripts/kontrola-dokumentace-kodu.py --json           # souhrn pro pondělní přehled
    python .github/scripts/kontrola-dokumentace-kodu.py --test           # samotest na dočasném repu

Chyba skriptu (exit 2): mapa odkazuje na neexistující dokument nebo funkci, nebo selhal git (např.
mělký clone bez historie). Mapa se nesmí potichu rozpadnout.
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

KOREN = Path(__file__).resolve().parents[2]
MAPA = Path(__file__).resolve().parent / 'mapa-kod-dokumentace.json'
ZNACKA = '[bez-dokumentace]'
VYCHOZI_DNI = 7
FUNKCE = re.compile(r'^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(', re.M)
HUNK = re.compile(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@', re.M)
DATUM = re.compile(r'\d{4}-\d{2}-\d{2}')


class ChybaSkriptu(Exception):
    """Mapa nebo git nejsou v pořádku (exit 2), ne varování."""


def git(koren, *args, check=True):
    r = subprocess.run(['git', '-C', str(koren), '-c', 'core.quotepath=off', *args],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0 and check:
        raise ChybaSkriptu('git %s selhalo: %s' % (' '.join(args[:2]), r.stderr.strip()[:200]))
    return r.stdout if r.returncode == 0 else ''


def vzor_na_regex(vzor):
    """** = i podsložky, * = bez lomítka."""
    vystup, i = '', 0
    while i < len(vzor):
        if vzor.startswith('**', i):
            vystup += '.*'
            i += 2
        elif vzor[i] == '*':
            vystup += '[^/]*'
            i += 1
        else:
            vystup += re.escape(vzor[i])
            i += 1
    return re.compile('^' + vystup + '$')


def nacist_mapu(koren, cesta):
    """Mapa z JSON a její kontrola: dokument musí existovat, funkce musí být v aktuálním souboru."""
    try:
        data = json.loads(Path(cesta).read_text(encoding='utf-8'))
        mapa = data['mapa']
    except (OSError, ValueError, KeyError) as e:
        raise ChybaSkriptu('mapa %s se nedá načíst: %s' % (cesta, e)) from e
    for i, p in enumerate(mapa, 1):
        misto = 'položka %d mapy' % i
        if not p.get('dokument') or not p.get('duvod'):
            raise ChybaSkriptu('%s: chybí dokument nebo důvod' % misto)
        if not (Path(koren) / p['dokument']).is_file():
            raise ChybaSkriptu('%s: dokument %s neexistuje' % (misto, p['dokument']))
        if p.get('typ') == 'nova-slozka-v-koreni':
            continue
        if not p.get('kod'):
            raise ChybaSkriptu('%s: chybí kod' % misto)
        if p.get('funkce'):
            soubor = Path(koren) / p['kod']
            if not soubor.is_file():
                raise ChybaSkriptu('%s: soubor %s s funkcemi neexistuje' % (misto, p['kod']))
            existuji = set(FUNKCE.findall(soubor.read_text(encoding='utf-8', errors='replace')))
            for f in p['funkce']:
                if f not in existuji:
                    raise ChybaSkriptu('%s: funkce %s v %s neexistuje (přejmenovaná?)' % (misto, f, p['kod']))
    return mapa


def commity(koren, od):
    """(popis období, shay od nejstaršího) bez merge commitů. `od` je datum RRRR-MM-DD nebo git ref."""
    if od is None:
        od = (datetime.date.today() - datetime.timedelta(days=VYCHOZI_DNI)).isoformat()
    if DATUM.fullmatch(od):
        vystup = git(koren, 'log', '--no-merges', '--since=%s 00:00' % od, '--format=%H')
        popis = 'od %s' % od
    else:
        git(koren, 'rev-parse', '--verify', od + '^{commit}')
        vystup = git(koren, 'rev-list', '--no-merges', od + '..HEAD')
        popis = 'po %s' % od
    return popis, list(reversed(vystup.split()))


def soubory_commitu(koren, sha):
    """{cesta: stav (A, M, D)} změněných souborů commitu."""
    vysledek = {}
    for radek in git(koren, 'show', '--no-renames', '--name-status', '--format=', sha).splitlines():
        stav, _, cesta = radek.partition('\t')
        if cesta:
            vysledek[cesta] = stav[:1]
    return vysledek


def zmenene_funkce(koren, sha, cesta):
    """Názvy funkcí, do kterých zasahují změněné řádky souboru v commitu; hranice funkcí podle řádků
    `function nazev(` ve verzi souboru v tom commitu (funkce končí před další funkcí)."""
    zdroj = git(koren, 'show', '%s:%s' % (sha, cesta), check=False)
    if not zdroj:
        return set()
    zacatky = [(zdroj.count(chr(10), 0, m.start()) + 1, m.group(1)) for m in FUNKCE.finditer(zdroj)]
    nazvy = set()
    for h in HUNK.finditer(git(koren, 'show', '-U0', '--no-renames', '--format=', sha, '--', cesta)):
        prvni, pocet = int(h.group(1)), int(h.group(2) if h.group(2) is not None else 1)
        for radek in range(max(prvni, 1), prvni + max(pocet, 1)):
            nazev = [n for r, n in zacatky if r <= radek]
            if nazev:
                nazvy.add(nazev[-1])
    return nazvy


def nove_slozky(koren, sha, soubory):
    """Složky v kořeni repa, do kterých commit přidal soubor a které v rodiči neexistovaly."""
    kandidati = {c.split('/')[0] for c, s in soubory.items() if s == 'A' and '/' in c}
    if not kandidati:
        return []
    rodic = git(koren, 'ls-tree', '--name-only', sha + '^', check=False).split()
    return sorted(k for k in kandidati if rodic and k not in rodic)


def zkontroluj(koren, mapa, od=None):
    """Vrací slovník: obdobi, commitu, bez_dokumentace, varovani (seznam slovníků kod, funkce, dokument,
    duvod, commity). Varování: změněný kód z mapy a dokument v celém období beze změny."""
    popis, shay = commity(koren, od)
    zmenene_dokumenty, zasahy, bez = set(), {}, 0
    regexy = [vzor_na_regex(p['kod']) if p.get('kod') and not p.get('funkce') else None for p in mapa]
    for sha in shay:
        soubory = soubory_commitu(koren, sha)
        zmenene_dokumenty |= set(soubory)
        zprava = git(koren, 'log', '-1', '--format=%B', sha)
        if ZNACKA in zprava:
            bez += 1
            continue
        predmet = zprava.strip().splitlines()[0] if zprava.strip() else ''
        zaznam = (sha[:7], predmet)
        for i, p in enumerate(mapa):
            if p.get('typ') == 'nova-slozka-v-koreni':
                for slozka in nove_slozky(koren, sha, soubory):
                    zasahy.setdefault((i, slozka + '/', None), []).append(zaznam)
            elif p.get('funkce'):
                if p['kod'] in soubory:
                    for f in sorted(zmenene_funkce(koren, sha, p['kod']) & set(p['funkce'])):
                        zasahy.setdefault((i, p['kod'], f), []).append(zaznam)
            else:
                for c in sorted(c for c in soubory if regexy[i].match(c)):
                    zasahy.setdefault((i, c, None), []).append(zaznam)
    varovani = []
    for (i, kod, funkce), zaznamy in zasahy.items():
        if mapa[i]['dokument'] in zmenene_dokumenty:
            continue
        varovani.append({'kod': kod, 'funkce': funkce, 'dokument': mapa[i]['dokument'], 'duvod': mapa[i]['duvod'],
                         'commity': [{'sha': s, 'predmet': t} for s, t in zaznamy]})
    varovani.sort(key=lambda v: (v['dokument'], v['kod'], v['funkce'] or ''))
    return {'obdobi': popis, 'commitu': len(shay), 'bez_dokumentace': bez, 'polozek_mapy': len(mapa), 'varovani': varovani}


def vypsat(vysledek):
    v = vysledek['varovani']
    print('Kód změněn, dokument ne: období %s, commitů %d (se značkou %s: %d), položek mapy %d' % (
        vysledek['obdobi'], vysledek['commitu'], ZNACKA, vysledek['bez_dokumentace'], vysledek['polozek_mapy']))
    if not v:
        print('Žádná varování.')
        return
    print('Varování: %d (jen upozornění, exit 0)' % len(v))
    for x in v:
        print('- %s: změněno %s%s, dokument v období beze změny (%s)' % (
            x['dokument'], x['kod'], ' (' + x['funkce'] + ')' if x['funkce'] else '', x['duvod']))
        print('    commity: ' + '; '.join('%s %s' % (c['sha'], c['predmet']) for c in x['commity']))


# ---------------------------------------------------------------- samotest

def _git_test(koren, *args):
    subprocess.run(['git', '-C', str(koren), '-c', 'user.name=Test', '-c', 'user.email=t@example.com',
                    '-c', 'commit.gpgsign=false', *args], check=True, capture_output=True)


def _commit(koren, soubory, zprava, datum=None):
    for cesta, obsah in soubory.items():
        p = Path(koren) / cesta
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(obsah, encoding='utf-8', newline='\n')
    _git_test(koren, 'add', '-A')
    env = dict(os.environ, GIT_AUTHOR_DATE=datum, GIT_COMMITTER_DATE=datum) if datum else None
    subprocess.run(['git', '-C', str(koren), '-c', 'user.name=Test', '-c', 'user.email=t@example.com',
                    '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', zprava], check=True, capture_output=True, env=env)
    return git(koren, 'rev-parse', 'HEAD').strip()


GS = ('function setupTriggers() {\n  var a = 1;\n}\n\nfunction pomocna_() {\n  var b = 1;\n}\n\n'
      'function doGet(e) {\n  return 1;\n}\n')
ZAKLAD = {'apps-script/kulturni_radar.gs': GS, 'Docs/aplikace/PROVOZ.md': '# Provoz\n',
          'Docs/aplikace/ARCHITEKTURA-APLIKACE.md': '# Architektura\n', 'Docs/testovani/ARCHITEKTURA-TESTU.md': '# Testy\n',
          'AGENTS.md': '# Agenti\n', '.github/workflows/a.yml': 'name: a\n'}
MAPA_TEST = [
    {'kod': 'apps-script/kulturni_radar.gs', 'funkce': ['setupTriggers'], 'dokument': 'Docs/aplikace/PROVOZ.md', 'duvod': 'triggery'},
    {'kod': 'apps-script/kulturni_radar.gs', 'funkce': ['doGet'], 'dokument': 'Docs/aplikace/ARCHITEKTURA-APLIKACE.md', 'duvod': 'API'},
    {'kod': '.github/workflows/*.yml', 'dokument': 'Docs/testovani/ARCHITEKTURA-TESTU.md', 'duvod': 'CI'},
    {'typ': 'nova-slozka-v-koreni', 'dokument': 'AGENTS.md', 'duvod': 'struktura repa'}]


def _scenar(kroky, mapa=None, od='zaklad', pred=None):
    """Dočasné git repo: základní commit, volitelně commit `pred` (před obdobím), pak `kroky`
    [(soubory, zpráva)]. Období začíná po základním commitu (nebo po `pred`)."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        koren = Path(tmp) / 'repo'
        koren.mkdir()
        _git_test(koren, 'init', '-q')
        zaklad = _commit(koren, ZAKLAD, 'základ', datum='2000-01-01T12:00:00')
        if pred:
            zaklad = _commit(koren, pred, 'před obdobím')
        for soubory, zprava in kroky:
            _commit(koren, soubory, zprava)
        mapa_cesta = Path(tmp) / 'mapa.json'
        mapa_cesta.write_text(json.dumps({'mapa': mapa or MAPA_TEST}), encoding='utf-8')
        return zkontroluj(koren, nacist_mapu(koren, mapa_cesta), zaklad if od == 'zaklad' else od)


def samotest():
    selhani = 0

    def over(ok, popis):
        nonlocal selhani
        selhani += not ok
        print('%-4s %s' % ('OK' if ok else 'CHYBA', popis))

    zmena_trigger = GS.replace('var a = 1;', 'var a = 2;')
    zmena_pomocna = GS.replace('var b = 1;', 'var b = 2;')
    zmena_doget = GS.replace('return 1;', 'return 2;')

    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_trigger}, 'Triggery')])['varovani']
    over(len(v) == 1 and v[0]['funkce'] == 'setupTriggers' and v[0]['dokument'] == 'Docs/aplikace/PROVOZ.md'
         and v[0]['commity'][0]['predmet'] == 'Triggery', 'kód změněn bez dokumentu = varování (funkce, dokument, commit)')
    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_trigger}, 'Triggery'), ({'Docs/aplikace/PROVOZ.md': '# Provoz\nnový řádek\n'}, 'Dokument')])['varovani']
    over(v == [], 'kód změněn a dokument změněn v období = nic')
    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_pomocna}, 'Pomocná')])['varovani']
    over(v == [], 'změna mimo mapované funkce (pomocna_) = nic')
    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_trigger}, 'Triggery [bez-dokumentace]')])
    over(v['varovani'] == [] and v['bez_dokumentace'] == 1, 'značka [bez-dokumentace] = nic a spočítá se')
    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_doget}, 'API')])['varovani']
    over(len(v) == 1 and v[0]['funkce'] == 'doGet' and v[0]['dokument'] == 'Docs/aplikace/ARCHITEKTURA-APLIKACE.md', 'změna doGet varuje jen u ARCHITEKTURA-APLIKACE (ne u PROVOZ)')
    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_trigger}, 'Triggery')], pred={'Docs/aplikace/PROVOZ.md': '# Provoz\nstarý zásah\n'})['varovani']
    over(len(v) == 1, 'dokument změněný PŘED obdobím nestačí, varování zůstane')
    v = _scenar([({'.github/workflows/a.yml': 'name: b\n'}, 'CI')])['varovani']
    over(len(v) == 1 and v[0]['dokument'] == 'Docs/testovani/ARCHITEKTURA-TESTU.md' and v[0]['funkce'] is None, 'změna workflow (vzor *.yml) bez ARCHITEKTURA-TESTU = varování')
    v = _scenar([({'.github/workflows/a.yml': 'name: b\n', 'Docs/testovani/ARCHITEKTURA-TESTU.md': '# Testy\nC1\n'}, 'CI a dokument')])['varovani']
    over(v == [], 'workflow a ARCHITEKTURA-TESTU ve stejném commitu = nic')
    v = _scenar([({'novaslozka/x.txt': 'x'}, 'Nová složka')])['varovani']
    over(len(v) == 1 and v[0]['kod'] == 'novaslozka/' and v[0]['dokument'] == 'AGENTS.md', 'nová složka v kořeni bez AGENTS.md = varování')
    v = _scenar([({'Docs/nove.md': '# nové\n'}, 'Nový soubor ve stávající složce')])['varovani']
    over(v == [], 'nový soubor ve stávající složce kořene = nic')
    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_trigger}, 'Triggery')], od='2001-01-01')
    over(len(v['varovani']) == 1 and v['commitu'] == 1, 'období od data: starý základní commit (rok 2000) mimo, nový se projde (%d)' % v['commitu'])
    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_trigger}, 'Triggery')], od='1999-01-01')
    over(v['varovani'] == [] and v['commitu'] == 2, 'období od data zahrnuje základní commit: ten dokumenty vytvořil, takže nic (%d commitů)' % v['commitu'])
    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_trigger}, 'Triggery')], od=(datetime.date.today() + datetime.timedelta(days=365)).isoformat())
    over(v['commitu'] == 0 and v['varovani'] == [], 'období od budoucího data (za rok): žádné commity, žádná varování')
    v = _scenar([({'apps-script/kulturni_radar.gs': zmena_trigger.replace('var a = 2;', 'var a = 2;\n  var c = 3;')}, 'Víc řádků')])['varovani']
    over(len(v) == 1 and v[0]['funkce'] == 'setupTriggers', 'přidané řádky uvnitř funkce se přiřadí k funkci')
    # mapa se nesmí rozpadnout
    for popis, mapa in [('neexistující dokument v mapě', [{'kod': 'a.yml', 'dokument': 'Docs/neexistuje.md', 'duvod': 'x'}]),
                        ('neexistující funkce v mapě', [{'kod': 'apps-script/kulturni_radar.gs', 'funkce': ['neexistuje_'], 'dokument': 'AGENTS.md', 'duvod': 'x'}]),
                        ('položka mapy bez důvodu', [{'kod': 'a.yml', 'dokument': 'AGENTS.md'}])]:
        try:
            _scenar([], mapa=mapa)
            over(False, popis + ' má skončit chybou skriptu')
        except ChybaSkriptu as e:
            over(True, popis + ' = chyba skriptu (%s)' % str(e)[:60])
    # mapa v repu je v pořádku (dokumenty a funkce existují)
    try:
        mapa = nacist_mapu(KOREN, MAPA)
        over(len(mapa) >= 5, 'skutečná mapa v repu se načte a projde kontrolou (%d položek)' % len(mapa))
    except ChybaSkriptu as e:
        over(False, 'skutečná mapa v repu: %s' % e)
    print(chr(10) + ('Test prošel.' if not selhani else 'Test selhal: %d chyb.' % selhani))
    return 1 if selhani else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description='Varování „kód změněn, dokument ne“.')
    ap.add_argument('--od', help='datum RRRR-MM-DD nebo git ref (výchozí posledních %d dní)' % VYCHOZI_DNI)
    ap.add_argument('--json', action='store_true', help='strojově čitelný výstup pro pondělní přehled')
    ap.add_argument('--test', action='store_true')
    ap.add_argument('--koren', default=str(KOREN), help=argparse.SUPPRESS)
    ap.add_argument('--mapa', default=str(MAPA), help=argparse.SUPPRESS)
    args = ap.parse_args()
    if args.test:
        return samotest()
    try:
        vysledek = zkontroluj(args.koren, nacist_mapu(args.koren, args.mapa), args.od)
    except ChybaSkriptu as e:
        if args.json:
            print(json.dumps({'skript': 'kontrola-dokumentace-kodu', 'chyba': str(e), 'varovani': []}, ensure_ascii=False))
        else:
            print('CHYBA SKRIPTU: %s' % e, file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(dict(vysledek, skript='kontrola-dokumentace-kodu'), ensure_ascii=False, indent=2))
    else:
        vypsat(vysledek)
    return 0


if __name__ == '__main__':
    sys.exit(main())
