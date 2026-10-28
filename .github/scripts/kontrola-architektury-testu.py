"""Pojistka proti nárůstu porušení pravidel z Docs/testovani/ARCHITEKTURA-TESTU.md (ratchet).

Spočítá porušení pravidel, která jdou hlídat automaticky, porovná je s baseline
v baseline-architektury-testu.json a selže, jen když některý počet VZROSTE.
Při poklesu vypíše výzvu ke snížení baseline (--zapsat-baseline ho přepíše).

Použití (z kořene repa):
    python .github/scripts/kontrola-architektury-testu.py
    python .github/scripts/kontrola-architektury-testu.py --zapsat-baseline

Potřebuje jen robotframework a standardní knihovnu. Nic nespouští proti produkci,
soubory jen čte. Pravidla a plán oprav: Docs/audity/AUDIT-SOULADU-TESTU.md.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from robot.api.parsing import ModelVisitor, Token, get_model

KOREN = Path(__file__).resolve().parents[2]
BASELINE = Path(__file__).resolve().with_name('baseline-architektury-testu.json')

# Klíčová slova, po kterých test mění sdílený stav prohlížeče a má se po sobě uklidit.
RIZIKOVA = {'newpage', 'newcontext', 'selectoptionsby', 'otevritradarnamobilnimviewportu'}

# Metrika -> (pravidlo, popis); pořadí = pořadí výpisu.
METRIKY = {
    'warn_v_testech': ('B5.6', 'Log level=WARN v těle testu místo Skip If'),
    'testy_bez_teardownu': ('B5.4', 'test s New Page/New Context/Select Options By/tagem zapis bez Teardownu'),
    'text_selektory': ('B4', 'selektor podle textu (text=)'),
    'nth_selektory': ('B4', 'poziční selektor (nth=)'),
    'aserce_v_resources': ('B5.2', 'aserce v resources.robot'),
    'sleep_bez_povoleni': ('B5.3', 'Sleep bez komentáře "# povoleno:"'),
    'regrese_bez_verze': ('B4', 'test s tagem regrese bez verze v názvu'),
    'krehky_bez_pricin': ('C3', 'test s tagem krehky bez řádku "Příčina nestability:" v dokumentaci'),
}


def norm(jmeno):
    """Jméno klíčového slova jako v RF: bez knihovny před tečkou, mezer a podtržítek, malými písmeny."""
    return re.sub(r'[\s_]', '', (jmeno or '').rsplit('.', 1)[-1]).lower()


class Sber(ModelVisitor):
    def __init__(self, soubor):
        self.soubor = soubor
        self.nalezy = {k: [] for k in METRIKY}
        self.suite_test_teardown = False   # Test Teardown v nastavení sady pokrývá všechny testy
        self.test = None
        self.testy = []

    def misto(self, radek, popis=''):
        return f'{self.soubor.name}:{radek} {popis}'.strip()

    def visit_TestTeardown(self, node):
        self.suite_test_teardown = True

    def visit_TestCase(self, node):
        self.test = dict(nazev=node.name, radek=node.lineno, tagy=set(), doc='', teardown=False, rizikovy=False)
        self.generic_visit(node)
        self.testy.append(self.test)
        self.test = None

    def visit_Tags(self, node):
        if self.test is not None:
            self.test['tagy'] |= {t.lower() for t in node.values}

    def visit_Documentation(self, node):
        if self.test is not None:
            self.test['doc'] = node.value or ''

    def visit_Teardown(self, node):
        if self.test is not None:
            self.test['teardown'] = True

    def visit_KeywordCall(self, node):
        jmeno = norm(node.keyword)
        args = list(node.args)
        if self.test is not None and jmeno in RIZIKOVA:
            self.test['rizikovy'] = True
        if self.test is not None and jmeno == 'log' and any(a.replace(' ', '').lower().startswith('level=warn') for a in args):
            self.nalezy['warn_v_testech'].append(self.misto(node.lineno, f"({self.test['nazev'][:60]})"))
        if jmeno == 'sleep' and 'povoleno:' not in ' '.join(t.value for t in node.get_tokens(Token.COMMENT)):
            self.nalezy['sleep_bez_povoleni'].append(self.misto(node.lineno))
        for a in args:
            if re.search(r'(?:^|\s)text=', a):
                self.nalezy['text_selektory'].append(self.misto(node.lineno))
            self.nalezy['nth_selektory'] += [self.misto(node.lineno)] * len(re.findall(r'nth=', a))
        if self.soubor.name == 'resources.robot' and (jmeno.startswith('should') or jmeno == 'gettext'):
            self.nalezy['aserce_v_resources'].append(self.misto(node.lineno, node.keyword))
        self.generic_visit(node)

    def dokonci(self):
        for t in self.testy:
            popis = f"({t['nazev'][:60]})"
            if (t['rizikovy'] or 'zapis' in t['tagy']) and not t['teardown'] and not self.suite_test_teardown:
                self.nalezy['testy_bez_teardownu'].append(self.misto(t['radek'], popis))
            if 'regrese' in t['tagy'] and not re.search(r'v\d+\.\d+', t['nazev']):
                self.nalezy['regrese_bez_verze'].append(self.misto(t['radek'], popis))
            if 'krehky' in t['tagy'] and 'Příčina nestability:' not in t['doc']:
                self.nalezy['krehky_bez_pricin'].append(self.misto(t['radek'], popis))


def spocitej(slozka):
    celkem = {k: [] for k in METRIKY}
    soubory = sorted(Path(slozka).glob('*.robot'))
    if not soubory:
        raise SystemExit(f'V {slozka} nejsou žádné .robot soubory')
    for soubor in soubory:
        sber = Sber(soubor)
        sber.visit(get_model(str(soubor)))
        sber.dokonci()
        for k, v in sber.nalezy.items():
            celkem[k] += v
    return celkem


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--testy', default=str(KOREN / 'tests' / 'robot'), help='složka s .robot soubory')
    ap.add_argument('--baseline', default=str(BASELINE), help='soubor s baseline')
    ap.add_argument('--zapsat-baseline', action='store_true',
                    help='přepsat baseline aktuálními počty (jen když nic nevzrostlo)')
    a = ap.parse_args()
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    nalezy = spocitej(a.testy)
    pocty = {k: len(v) for k, v in nalezy.items()}
    cesta = Path(a.baseline)
    baseline = json.loads(cesta.read_text(encoding='utf-8')).get('pocty', {}) if cesta.exists() else {}

    vzrost, pokles = [], []
    print(f"{'metrika':<22}{'pravidlo':<9}{'baseline':>9}{'nyní':>6}  popis")
    for k, (pravidlo, popis) in METRIKY.items():
        b = baseline.get(k)
        print(f"{k:<22}{pravidlo:<9}{str(b if b is not None else '-'):>9}{pocty[k]:>6}  {popis}")
        if b is None or pocty[k] > b:
            vzrost.append(k)
        elif pocty[k] < b:
            pokles.append(k)

    if a.zapsat_baseline:
        if vzrost and cesta.exists():
            print('\nBaseline nepřepisuji: některý počet vzrostl nebo chybí v baseline.')
        else:   # snížení, nebo první vytvoření (soubor ještě neexistuje)
            cesta.write_text(json.dumps({
                'poznamka': 'Pojistka proti nárůstu porušení, viz Docs/audity/AUDIT-SOULADU-TESTU.md. Baseline se jen snižuje.',
                'pocty': pocty}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            print(f'\nBaseline přepsána: {cesta}')
            return 0

    for k in vzrost:
        b = baseline.get(k)
        zprava = 'chybí v baseline' if b is None else f'vzrostl z {b} na {pocty[k]}'
        print(f'::error::Pravidlo {METRIKY[k][0]}, metrika {k} ({METRIKY[k][1]}): {zprava}. '
              'Oprav nové porušení (viz Docs/testovani/ARCHITEKTURA-TESTU.md).')
        for misto in nalezy[k]:
            print(f'    {misto}')
    for k in pokles:
        print(f'::notice::Metrika {k} klesla z {baseline[k]} na {pocty[k]}: sniž baseline '
              '(python .github/scripts/kontrola-architektury-testu.py --zapsat-baseline).')
    if vzrost:
        return 1
    print('\nŽádné porušení nepřibylo.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
