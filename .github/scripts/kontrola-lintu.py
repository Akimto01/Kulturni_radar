#!/usr/bin/env python3
"""Lint s baseline (ratchet): Robocop nad tests/robot/ a ruff nad .github/scripts/ (issue #58).

Spustí oba nástroje, spočítá nálezy podle pravidla a porovná je s .github/scripts/baseline-lint.json.
CI selže jen při NÁRŮSTU počtu u některého pravidla (včetně nového pravidla, které v baseline není);
pokles vypíše a vyzve ke snížení baseline (stejný princip jako kontrola-architektury-testu.py).
Pravidla, která odporují konvencím projektu, jsou vypnutá v konfiguraci se zdůvodněním
(.github/robocop.toml, .github/ruff.toml), ne v baseline: baseline drží jen skutečné nálezy.

Nástroje jsou v samostatném .github/requirements-lint.txt (ne v tests/robot/requirements.txt, ten instaluje
týdenní běh rf-tests.yml). Skript sám používá jen standardní knihovnu a nástroje volá přes `python -m`.

    pip install -r .github/requirements-lint.txt -c tests/robot/requirements.txt
    python .github/scripts/kontrola-lintu.py                      # exit 1 při nárůstu, 2 při chybě nástroje
    python .github/scripts/kontrola-lintu.py --zapsat-baseline    # přepíše baseline aktuálními počty
    python .github/scripts/kontrola-lintu.py --test               # negativní zkouška na dočasných souborech

Změna verze nástroje může přidat nová pravidla: po ní přepočítat baseline (--zapsat-baseline) a změnu
zdůvodnit v CHANGELOGu.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

KOREN = Path(__file__).resolve().parents[2]
BASELINE = Path(__file__).resolve().parent / 'baseline-lint.json'
KONFIG = {'robocop': KOREN / '.github' / 'robocop.toml', 'ruff': KOREN / '.github' / 'ruff.toml'}
CILE = {'robocop': KOREN / 'tests' / 'robot', 'ruff': KOREN / '.github' / 'scripts'}
POPIS = ('Počty nálezů lintu podle nástroje a pravidla (kontrola-lintu.py, issue #58). CI selže jen při nárůstu; '
         'po poklesu snížit přes --zapsat-baseline. Pravidla odporující konvencím projektu jsou vypnutá v '
         '.github/robocop.toml a .github/ruff.toml, ne tady.')


class ChybaNastroje(Exception):
    """Nástroj není nainstalovaný nebo selhal (exit 2), ne nález."""


def _spust(prikaz, cwd):
    env = dict(os.environ, NO_COLOR='1', PYTHONIOENCODING='utf-8', COLUMNS='200')
    try:
        return subprocess.run(prikaz, capture_output=True, text=True, encoding='utf-8', errors='replace', cwd=str(cwd), env=env)
    except OSError as e:
        raise ChybaNastroje('nástroj se nepodařilo spustit: %s' % e) from e


def verze(nastroj):
    """Nainstalovaná verze nástroje (z `python -m nastroj --version`) nebo None."""
    r = _spust([sys.executable, '-m', nastroj, '--version'], KOREN)
    m = re.search(r'(\d+\.\d+\.\d+\S*)', r.stdout)
    return m.group(1) if r.returncode == 0 and m else None


def pocty_robocop(cesta, konfig=None):
    """Počty nálezů Robocopu podle id pravidla (např. LEN04) pro soubory .robot a .resource v `cesta`."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        report = Path(tmp) / 'robocop.json'
        r = _spust([sys.executable, '-m', 'robocop', 'check', str(cesta), '--no-cache', '--config', str(konfig or KONFIG['robocop']),
                    '--reports', 'json_report', '-c', 'json_report.output_path=' + report.as_posix()], KOREN)
        if r.returncode not in (0, 1):
            raise ChybaNastroje('Robocop skončil kódem %d: %s' % (r.returncode, (r.stdout + r.stderr).strip()[-300:]))
        if not report.is_file():
            if r.returncode == 0:
                return Counter()
            raise ChybaNastroje('Robocop nevytvořil JSON report: %s' % (r.stdout + r.stderr).strip()[-300:])
        return Counter(i['rule_id'] for i in json.loads(report.read_text(encoding='utf-8')))


def pocty_ruff(cesta, konfig=None):
    """Počty nálezů ruffu podle kódu pravidla (např. E741) pro soubory .py v `cesta`."""
    r = _spust([sys.executable, '-m', 'ruff', 'check', str(cesta), '--config', str(konfig or KONFIG['ruff']), '--no-cache',
                '--output-format', 'json'], KOREN)
    if r.returncode not in (0, 1):
        raise ChybaNastroje('ruff skončil kódem %d: %s' % (r.returncode, (r.stdout + r.stderr).strip()[-300:]))
    try:
        return Counter((i.get('code') or 'syntaxe') for i in json.loads(r.stdout or '[]'))
    except ValueError as e:
        raise ChybaNastroje('ruff nevrátil platný JSON: %s' % e) from e


ZJISTIT = {'robocop': pocty_robocop, 'ruff': pocty_ruff}


def porovnat(aktualni, baseline):
    """(nárůst, pokles): seznamy (pravidlo, baseline, aktuálně). Nové pravidlo mimo baseline = nárůst od 0."""
    narust, pokles = [], []
    for pravidlo in sorted(set(aktualni) | set(baseline)):
        bylo, je = baseline.get(pravidlo, 0), aktualni.get(pravidlo, 0)
        if je > bylo:
            narust.append((pravidlo, bylo, je))
        elif je < bylo:
            pokles.append((pravidlo, bylo, je))
    return narust, pokles


def zkontroluj(cile, baseline, vypis=print, konfig=None):
    """Spustí nástroje nad `cile` {nástroj: cesta} a porovná s baseline {nástroj: {pravidlo: počet}}.
    Vrací (kód, aktuální počty): 0 beze změny nebo pokles, 1 nárůst."""
    narust_celkem, pokles_celkem, aktualni = [], [], {}
    for nastroj, cesta in cile.items():
        aktualni[nastroj] = dict(ZJISTIT[nastroj](cesta, (konfig or {}).get(nastroj)))
        narust, pokles = porovnat(aktualni[nastroj], baseline.get(nastroj, {}))
        vypis('%s: %d nálezů v %d pravidlech (baseline %d)' % (nastroj, sum(aktualni[nastroj].values()), len(aktualni[nastroj]),
                                                              sum(baseline.get(nastroj, {}).values())))
        narust_celkem += [(nastroj,) + x for x in narust]
        pokles_celkem += [(nastroj,) + x for x in pokles]
    for nastroj, pravidlo, bylo, je in narust_celkem:
        vypis('NÁRŮST   %s %s: %d -> %d' % (nastroj, pravidlo, bylo, je))
    for nastroj, pravidlo, bylo, je in pokles_celkem:
        vypis('pokles   %s %s: %d -> %d' % (nastroj, pravidlo, bylo, je))
    if pokles_celkem and not narust_celkem:
        vypis('Nálezů ubylo: snižte baseline (python .github/scripts/kontrola-lintu.py --zapsat-baseline) a commitněte ji.')
    if narust_celkem:
        vypis('Přibyly nálezy lintu. Opravte je, nebo (jen vědomě, se zdůvodněním v CHANGELOGu) přepište baseline.')
        return 1, aktualni
    return 0, aktualni


def nacist_baseline(cesta=BASELINE):
    try:
        data = json.loads(Path(cesta).read_text(encoding='utf-8'))
    except (OSError, ValueError) as e:
        raise ChybaNastroje('baseline %s se nedá načíst: %s' % (cesta, e)) from e
    return {n: data.get(n, {}) for n in CILE}


def zapsat_baseline(aktualni, cesta=BASELINE):
    data = {'_popis': POPIS, 'verze': {n: verze(n) for n in CILE}}
    for nastroj in CILE:
        data[nastroj] = dict(sorted(aktualni[nastroj].items()))
    Path(cesta).write_text(json.dumps(data, ensure_ascii=False, indent=2) + chr(10), encoding='utf-8')


# ---------------------------------------------------------------- negativní zkouška

def samotest():
    selhani = 0

    def over(ok, popis):
        nonlocal selhani
        selhani += not ok
        print('%-4s %s' % ('OK' if ok else 'CHYBA', popis))

    # porovnání počtů
    over(porovnat({'A': 2}, {'A': 2}) == ([], []), 'porovnání: beze změny = žádný nárůst ani pokles')
    over(porovnat({'A': 3}, {'A': 2}) == ([('A', 2, 3)], []), 'porovnání: vyšší počet u pravidla = nárůst')
    over(porovnat({'B': 1}, {}) == ([('B', 0, 1)], []), 'porovnání: nové pravidlo mimo baseline = nárůst od 0')
    over(porovnat({'A': 1}, {'A': 2}) == ([], [('A', 2, 1)]), 'porovnání: nižší počet = pokles')
    over(porovnat({}, {'A': 2}) == ([], [('A', 2, 0)]), 'porovnání: pravidlo beze nálezů = pokles na 0')
    over(porovnat({'A': 3, 'B': 0}, {'A': 2, 'B': 1}) == ([('A', 2, 3)], [('B', 1, 0)]), 'porovnání: nárůst u jednoho a pokles u druhého se nevyruší')
    # nástroje na dočasných souborech (instalují se z .github/requirements-lint.txt)
    for nastroj in CILE:
        v = verze(nastroj)
        over(v is not None, 'nástroj %s je nainstalovaný (%s)' % (nastroj, v))
        if v is None:
            print('Nainstalujte: pip install -r .github/requirements-lint.txt -c tests/robot/requirements.txt')
            return 2
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        robot, py = Path(tmp) / 'robot', Path(tmp) / 'py'
        robot.mkdir()
        py.mkdir()
        (robot / 'a.robot').write_text('*** Test Cases ***\nPrvni test\n    Log    ahoj\n', encoding='utf-8')
        (py / 'a.py').write_text('import os\n', encoding='utf-8')
        cile = {'robocop': robot, 'ruff': py}
        zacatek = {n: dict(ZJISTIT[n](c)) for n, c in cile.items()}
        over(sum(zacatek['robocop'].values()) > 0 and zacatek['ruff'] == {'F401': 1}, 'dočasné soubory mají nálezy (Robocop %d, ruff %s)' % (
            sum(zacatek['robocop'].values()), zacatek['ruff']))
        zpravy = []
        kod, _ = zkontroluj(cile, zacatek, zpravy.append)
        over(kod == 0 and not any(z.startswith('NÁRŮST') for z in zpravy), 'beze změny = úspěch (exit 0)')
        # nový nález ruffu
        (py / 'b.py').write_text('import sys\n', encoding='utf-8')
        zpravy = []
        kod, _ = zkontroluj(cile, zacatek, zpravy.append)
        over(kod == 1 and 'NÁRŮST   ruff F401: 1 -> 2' in zpravy, 'nový nález ruffu (nepoužitý import) = selhání (exit 1)')
        (py / 'b.py').unlink()
        # nový nález Robocopu: další test beze dokumentace a s mezerami na konci řádku
        (robot / 'b.robot').write_text('*** Test Cases ***\nDruhy test\n    Log    ahoj   \n', encoding='utf-8')
        zpravy = []
        kod, _ = zkontroluj(cile, zacatek, zpravy.append)
        over(kod == 1 and any(z.startswith('NÁRŮST   robocop') for z in zpravy), 'nový nález Robocopu v dočasném souboru = selhání (exit 1)')
        (robot / 'b.robot').unlink()
        # pokles: baseline vyšší než skutečnost
        vyssi = {n: {p: c + 1 for p, c in zacatek[n].items()} for n in zacatek}
        zpravy = []
        kod, _ = zkontroluj(cile, vyssi, zpravy.append)
        over(kod == 0 and any(z.startswith('pokles') for z in zpravy) and any('snižte baseline' in z for z in zpravy),
             'pokles = úspěch, vypíše pokles a vyzve ke snížení baseline')
        # baseline z aktuálního stavu se zapíše a znovu načte
        soubor = Path(tmp) / 'baseline.json'
        zapsat_baseline(zacatek, soubor)
        nactena = nacist_baseline(soubor)
        over(nactena['ruff'] == {'F401': 1} and nactena['robocop'] == zacatek['robocop'], 'zapsaná baseline se načte beze změny')
    # skutečná baseline v repu je platná
    try:
        b = nacist_baseline()
        over(all(isinstance(b[n], dict) for n in CILE), 'baseline v repu se načte (%s)' % ', '.join('%s %d' % (n, sum(b[n].values())) for n in CILE))
    except ChybaNastroje as e:
        over(False, 'baseline v repu: %s' % e)
    print(chr(10) + ('Test prošel.' if not selhani else 'Test selhal: %d chyb.' % selhani))
    return 1 if selhani else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description='Lint s baseline (Robocop, ruff).')
    ap.add_argument('--zapsat-baseline', action='store_true', help='přepíše baseline-lint.json aktuálními počty')
    ap.add_argument('--test', action='store_true')
    args = ap.parse_args()
    try:
        if args.test:
            return samotest()
        if args.zapsat_baseline:
            aktualni = {n: dict(ZJISTIT[n](c)) for n, c in CILE.items()}
            zapsat_baseline(aktualni)
            print('Baseline zapsána: ' + ', '.join('%s %d nálezů' % (n, sum(aktualni[n].values())) for n in CILE))
            return 0
        kod, _ = zkontroluj(CILE, nacist_baseline())
        return kod
    except ChybaNastroje as e:
        print('CHYBA NÁSTROJE: %s' % e, file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
