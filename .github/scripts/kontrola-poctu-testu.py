"""Kontrola, že počty testů v README (tabulka „Testy v číslech“) odpovídají repu.

README je jediný zdroj počtů testů (ostatní dokumenty na něj odkazují), proto
musí sedět se skutečností. Skript porovná:
  - jednotkové testy backendu a frontendu: počet volání test( na začátku řádku
    v tests/unit.test.js a tests/frontend.test.js (shoduje se s node --test),
  - RF testy: robot.api.TestSuiteBuilder nad tests/robot, rozdělení api/frontend,
  - testy Workeru: počet test( v cloudflare-worker/email-webhook.test.mjs.
Při rozdílu vypíše tabulku README vs. repo a skončí kódem 1.

Použití (z kořene repa):
    python .github/scripts/kontrola-poctu-testu.py

Potřebuje jen robotframework a standardní knihovnu. Nic nespouští proti produkci,
soubory jen čte.
"""
import re
import sys
from pathlib import Path

from robot.api import TestSuiteBuilder

KOREN = Path(__file__).resolve().parents[2]
README = KOREN / 'README.md'

TEST_RE = re.compile(r'^\s*test\(', re.M)


def pocet_node_testu(cesta):
    return len(TEST_RE.findall(cesta.read_text(encoding='utf-8')))


def pocty_rf():
    """Vrátí {'api': n, 'frontend': n, 'celkem': n} z testů v tests/robot."""
    suite = TestSuiteBuilder().build(str(KOREN / 'tests' / 'robot'))
    podle_souboru = {}
    for s in suite.suites:
        podle_souboru[Path(s.source).stem] = s.test_count
    return {'api': podle_souboru.get('api', 0),
            'frontend': podle_souboru.get('frontend', 0),
            'celkem': suite.test_count}


def skutecnost():
    return {
        'backend': pocet_node_testu(KOREN / 'tests' / 'unit.test.js'),
        'frontend (Node)': pocet_node_testu(KOREN / 'tests' / 'frontend.test.js'),
        'worker': pocet_node_testu(KOREN / 'cloudflare-worker' / 'email-webhook.test.mjs'),
        **{'RF ' + k: v for k, v in pocty_rf().items()},
    }


def cisla(bunka):
    return [int(x) for x in re.findall(r'\d+', bunka)]


def z_readme():
    """Přečte počty z tabulky „Testy v číslech“ podle začátku textu prvního sloupce."""
    text = README.read_text(encoding='utf-8')
    m = re.search(r'^## Testy v číslech\s*\n(.*?)(?=^## )', text, re.M | re.S)
    if not m:
        sys.exit('V README chybí sekce „Testy v číslech“.')
    radky = [r for r in m.group(1).splitlines() if r.startswith('|')][2:]
    out = {}
    for r in radky:
        b = [c.strip() for c in r.strip().strip('|').split('|')]
        nazev, pocet = b[0], cisla(b[2])
        if nazev.startswith('Jednotkové testy backendu'):
            out['backend'] = pocet[0]
        elif nazev.startswith('Jednotkové testy frontendu'):
            out['frontend (Node)'] = pocet[0]
        elif nazev.startswith('Kontrola syntaxe'):
            out['RF celkem'] = pocet[0]
        elif nazev.startswith('E2E testy proti produkci'):
            # formát „frontend + API“, např. 52 + 9
            out['RF frontend'], out['RF api'] = pocet[0], pocet[1]
        elif nazev.startswith('Testy e-mailového Workeru'):
            out['worker'] = pocet[0]
    return out


def main():
    readme, repo = z_readme(), skutecnost()
    klice = ['backend', 'frontend (Node)', 'RF celkem', 'RF frontend', 'RF api', 'worker']
    chybi = [k for k in klice if k not in readme]
    if chybi:
        sys.exit('V tabulce README chybí řádky: ' + ', '.join(chybi))
    rozdily = 0
    print(f'{"položka":<18}{"README":>8}{"repo":>8}')
    for k in klice:
        ok = readme[k] == repo[k]
        rozdily += not ok
        print(f'{k:<18}{readme[k]:>8}{repo[k]:>8}  {"" if ok else "<-- ROZDÍL"}')
    if rozdily:
        print(f'\n{rozdily} rozdíl(ů): oprav tabulku „Testy v číslech“ v README (jediný zdroj počtů).')
        return 1
    print('\nPočty v README odpovídají repu.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
