#!/usr/bin/env python3
"""Práh pokrytí řádků backendu v CI (ratchet), issue #38.

Spustí jednotkové testy backendu s měřením pokrytí (`node --test --experimental-test-coverage`, jen soubor
apps-script/kulturni_radar.gs), přečte pokrytí řádků a větví a porovná pokrytí řádků s uloženou hodnotou
v .github/scripts/baseline-pokryti.json. CI selže, když pokrytí řádků klesne pod baseline. Po zlepšení
o 0,1 procentního bodu a víc vyzve ke zvýšení baseline (stejný princip jako kontrola-lintu.py
a kontrola-architektury-testu.py). Pokrytí větví se jen vypisuje.

    python .github/scripts/kontrola-pokryti.py                    # exit 1 při poklesu, 2 při chybě měření
    python .github/scripts/kontrola-pokryti.py --zapsat-baseline  # přepíše baseline aktuální hodnotou
    python .github/scripts/kontrola-pokryti.py --test             # samotest na vymyšlených výstupech, bez Node

Baseline se nikdy nesnižuje ručně kvůli projití CI: pokles znamená doplnit testy, nebo vědomé rozhodnutí
zdůvodnit v CHANGELOGu.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

KOREN = Path(__file__).resolve().parents[2]
BASELINE = Path(__file__).resolve().parent / 'baseline-pokryti.json'
POPIS = ('Pokrytí řádků apps-script/kulturni_radar.gs jednotkovými testy (kontrola-pokryti.py, issue #38). '
         'CI selže při poklesu pod hodnotu `radky`; po zlepšení zvýšit přes --zapsat-baseline.')
PRIKAZ = ['node', '--test', '--experimental-test-coverage', '--test-coverage-include=**/kulturni_radar.gs',
          'tests/unit.test.js']
RADEK = re.compile(r'kulturni_radar\.gs\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|')
VYZVA_ZVYSIT = 0.1


class ChybaMereni(Exception):
    """Testy selhaly nebo výstup neobsahuje řádek pokrytí (exit 2), ne pokles."""


def precti_pokryti(vystup):
    """Z výstupu `node --test --experimental-test-coverage` vrátí (řádky %, větve %) pro kulturni_radar.gs."""
    m = RADEK.search(vystup)
    if not m:
        raise ChybaMereni('ve výstupu testů chybí řádek pokrytí kulturni_radar.gs')
    return float(m.group(1)), float(m.group(2))


def porovnej(radky, baseline):
    """Vrátí (kód, zpráva): 1 při poklesu pod baseline, jinak 0 (s výzvou při zlepšení)."""
    if round(radky, 2) < round(baseline, 2):
        return 1, ('POKLES: pokrytí řádků %.2f %% je pod baseline %.2f %%. Doplň testy, nebo vědomé '
                   'snížení zdůvodni v CHANGELOGu a přepiš baseline (--zapsat-baseline).' % (radky, baseline))
    if radky - baseline >= VYZVA_ZVYSIT:
        return 0, ('Pokrytí řádků %.2f %% je nad baseline %.2f %%: zvyš baseline '
                   '(python .github/scripts/kontrola-pokryti.py --zapsat-baseline).' % (radky, baseline))
    return 0, 'Pokrytí řádků %.2f %% (baseline %.2f %%), bez poklesu.' % (radky, baseline)


def zmer():
    """Spustí testy s měřením pokrytí a vrátí (řádky %, větve %)."""
    env = dict(os.environ, TZ='Europe/Prague', NO_COLOR='1')
    try:
        r = subprocess.run(PRIKAZ, capture_output=True, text=True, encoding='utf-8', errors='replace',
                           cwd=str(KOREN), env=env)
    except OSError as e:
        raise ChybaMereni('Node se nepodařilo spustit: %s' % e) from e
    if r.returncode != 0:
        raise ChybaMereni('testy skončily s kódem %d, pokrytí se nevyhodnocuje' % r.returncode)
    return precti_pokryti(r.stdout + r.stderr)


def samotest():
    """Negativní a pozitivní zkoušky na vymyšlených výstupech (bez Node)."""
    vystup_tap = '# all files |  92.17 |  86.27 |\n#   kulturni_radar.gs   |  92.10 |    86.08 |   91.52 | 197-225\n'
    vystup_spec = 'ℹ  kulturni_radar.gs   |  88 |    80.5 |   91.52 | 1-2\n'
    chyby = []

    def ocekavej(podminka, popis):
        if not podminka:
            chyby.append(popis)

    ocekavej(precti_pokryti(vystup_tap) == (92.10, 86.08), 'čtení výstupu TAP')
    ocekavej(precti_pokryti(vystup_spec) == (88.0, 80.5), 'čtení výstupu spec a celých čísel')
    try:
        precti_pokryti('# all files | 90.00 | 80.00 |\n')
        chyby.append('chybějící řádek kulturni_radar.gs musí být chyba měření')
    except ChybaMereni:
        pass
    ocekavej(porovnej(92.09, 92.10)[0] == 1, 'pokles o 0,01 musí selhat')
    ocekavej(porovnej(92.10, 92.10)[0] == 0, 'stejná hodnota projde')
    ocekavej(porovnej(92.15, 92.10) == (0, porovnej(92.15, 92.10)[1]) and 'zvyš' not in porovnej(92.15, 92.10)[1],
             'malé zlepšení projde bez výzvy')
    ocekavej(porovnej(92.30, 92.10)[0] == 0 and 'zvyš' in porovnej(92.30, 92.10)[1], 'zlepšení o 0,2 vyzve ke zvýšení')
    if chyby:
        for c in chyby:
            print('SAMOTEST SELHAL: %s' % c)
        return 1
    print('Samotest kontroly pokrytí: 7 zkoušek prošlo.')
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('--zapsat-baseline', action='store_true', help='přepíše baseline aktuálním pokrytím')
    p.add_argument('--test', action='store_true', help='samotest na vymyšlených výstupech')
    a = p.parse_args()
    if a.test:
        return samotest()
    try:
        radky, vetve = zmer()
    except ChybaMereni as e:
        print('CHYBA MĚŘENÍ: %s' % e)
        return 2
    print('kulturni_radar.gs: řádky %.2f %%, větve %.2f %% (větve se jen vypisují).' % (radky, vetve))
    if a.zapsat_baseline:
        BASELINE.write_text(json.dumps({'_popis': POPIS, 'radky': round(radky, 2)}, ensure_ascii=False, indent=2) + '\n',
                            encoding='utf-8')
        print('Baseline přepsána: %.2f %%.' % radky)
        return 0
    baseline = json.loads(BASELINE.read_text(encoding='utf-8'))['radky']
    kod, zprava = porovnej(radky, baseline)
    print(zprava)
    return kod


if __name__ == '__main__':
    sys.exit(main())
