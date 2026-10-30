#!/usr/bin/env python3
"""Kontrola úplnosti defektů (issues se štítkem bug). Jen čte, nic nemění.

Spouští se ručně (a na konci session, viz SKILL.md), ne v CI: board je
uživatelský projekt a výchozí GITHUB_TOKEN ho nepřečte; samostatný secret jen
kvůli kontrole nechceme (viz #33). Potřebuje `gh` s přístupem k boardu, tedy
účet Akimto01:

    GH_TOKEN=$(gh auth token --user Akimto01) python .github/scripts/kontrola-defektu.py

Pravidla:
  a) board: Závažnost, Priorita, Jak nalezeno a Stav defektu vyplněné, milník nastavený
  b) tělo: sekce formuláře defekt.yml a titulek „Defekt: “
  c) soulad stavů: zavřené issue = Uzavřený / Zamítnutý / Nereprodukovatelný + Status Done;
     otevřené = jiný stav a Status mimo Done
  d) zavřený defekt má komentář se čtyřmi sekcemi uzavírací šablony
  e) Docs/kvalita/DEFEKTY.md: řádek v tabulce klasifikace, hodnoty shodné s boardem
  f) Docs/kvalita/HISTORIE-INCIDENTU.md: uzavřený defekt (Stav defektu Uzavřený) se závažností
     S1 nebo S2 má řádek v tabulce incidentů (odkaz na issue v posledním sloupci)

Výstup: tabulka problémů (issue, pravidlo, co chybí); exit 1 při nálezu.
S přepínačem --test samotest pravidla f) na vymyšlených datech, bez sítě a bez GitHubu.
S přepínačem --json stejné nálezy jako JSON (chyby, varovani, souhrn otevřených defektů podle priority).
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # python -I nepřidává složku skriptu
import gh_projekt  # noqa: E402  (sdílené načítání issues a boardu)

DEFEKTY_MD = os.path.join(os.path.dirname(__file__), '..', '..', 'Docs', 'kvalita', 'DEFEKTY.md')
HISTORIE_MD = os.path.join(os.path.dirname(__file__), '..', '..', 'Docs', 'kvalita', 'HISTORIE-INCIDENTU.md')

# Výjimka z pravidel b) a d): issues do tohoto čísla včetně vznikly před formulářem
# defekt.yml (28. 10. 2026) a byly klasifikovány zpětně (DEFEKTY.md, „Zpětná
# klasifikace“), takže nemají sekce formuláře ani uzavírací komentář podle šablony.
# Pravidla a), c) a e) platí pro všechny.
VYJIMKA_DO_CISLA = 33

SEKCE_FORMULARE = ['Shrnutí', 'Oblast', 'Verze a prostředí', 'Kroky k reprodukci',
                   'Očekávaný výsledek', 'Skutečný výsledek']
SEKCE_UZAVRENI = ['Kořenová příčina', 'Oprava', 'Regresní test', 'Analýza úniku']
STAVY_UZAVRENE = {'Uzavřený', 'Zamítnutý', 'Nereprodukovatelný'}
POLE_BOARDU = [('závažnost', 'Závažnost'), ('priorita', 'Priorita'),
               ('jak nalezeno', 'Jak nalezeno'), ('stav defektu', 'Stav defektu')]


def nacist_defekty():
    return gh_projekt.nacist_issues('bug')


def nacist_board():
    return gh_projekt.nacist_board()


def radky_defekty_md():
    """Číslo issue -> (závažnost, priorita, jak nalezeno, stav) z tabulky klasifikace."""
    vysledek = {}
    with open(DEFEKTY_MD, encoding='utf-8') as f:
        for radek in f:
            m = re.match(r'^\|\s*\[#(\d+)\]\([^)]*\)\s*\|(.*)\|\s*$', radek.rstrip())
            if not m:
                continue
            bunky = [b.strip() for b in m.group(2).split('|')]
            if len(bunky) >= 5:
                vysledek[int(m.group(1))] = tuple(bunky[-4:])
    return vysledek


def cisla_z_historie(text):
    """Čísla issues z posledního sloupce řádků tabulky incidentů: počítá se jen odkaz
    [#N](…/issues/N); zmínka o issue v jiném sloupci nebo v textu nestačí."""
    cisla = set()
    for radek in text.splitlines():
        if not radek.startswith('|'):
            continue
        posledni = radek.rstrip().rstrip('|').split('|')[-1]
        cisla.update(int(a) for a, b in re.findall(r'\[#(\d+)\]\([^)]*/issues/(\d+)\)', posledni) if a == b)
    return cisla


def radky_historie_incidentu():
    with open(HISTORIE_MD, encoding='utf-8') as f:
        return cisla_z_historie(f.read())


def kod_stupne(hodnota):
    """„S2 Vysoká“ -> „S2“ (na boardu je celý název, v DEFEKTY.md jen kód)."""
    return str(hodnota or '').split(' ')[0]


def souhrn_defektu(defekty, board):
    """Otevřené defekty podle Priority (P1 až P5, „bez“ = Priorita nevyplněná); jen pro --json."""
    pocty = {'P1': 0, 'P2': 0, 'P3': 0, 'P4': 0, 'P5': 0, 'bez': 0}
    for d in defekty:
        if d['state'] != 'OPEN':
            continue
        kod = kod_stupne((board.get(d['number']) or {}).get('priorita'))
        pocty[kod if kod in pocty else 'bez'] += 1
    return {'otevrene_podle_priority': pocty}


def zkontrolovat(defekty=None, board=None, historie=None):
    """Vrací (počet defektů, problémy); data se bez argumentů načtou z GitHubu."""
    problemy = []   # (issue, pravidlo, co chybí)

    def pridej(cislo, pravidlo, co):
        problemy.append((cislo, pravidlo, co))

    defekty = nacist_defekty() if defekty is None else defekty
    board = nacist_board() if board is None else board
    md = radky_defekty_md()
    historie = radky_historie_incidentu() if historie is None else historie

    for d in sorted(defekty, key=lambda x: x['number']):
        n = d['number']
        zavreno = d['state'] == 'CLOSED'
        polozka = board.get(n)

        # a) board
        if polozka is None:
            pridej(n, 'a) board', 'issue není na boardu')
        else:
            for klic, nazev in POLE_BOARDU:
                if not polozka.get(klic):
                    pridej(n, 'a) board', 'prázdné pole ' + nazev)
        if not d.get('milestone'):
            pridej(n, 'a) board', 'chybí milník')

        # b) tělo a titulek
        if n > VYJIMKA_DO_CISLA:
            if not d['title'].startswith('Defekt: '):
                pridej(n, 'b) tělo', 'titulek nezačíná „Defekt: “')
            for sekce in SEKCE_FORMULARE:
                if not re.search(r'^#{2,3}\s*' + re.escape(sekce) + r'\s*$', d.get('body') or '', re.M):
                    pridej(n, 'b) tělo', 'chybí sekce „' + sekce + '“')

        # c) soulad stavů
        if polozka is not None:
            stav = polozka.get('stav defektu') or ''
            status = polozka.get('status') or ''
            if zavreno and stav not in STAVY_UZAVRENE:
                pridej(n, 'c) stavy', 'zavřené issue má Stav defektu „' + stav + '“')
            if zavreno and status != 'Done':
                pridej(n, 'c) stavy', 'zavřené issue má Status „' + status + '“, ne Done')
            if not zavreno and stav in STAVY_UZAVRENE:
                pridej(n, 'c) stavy', 'otevřené issue má Stav defektu „' + stav + '“')
            if not zavreno and status == 'Done':
                pridej(n, 'c) stavy', 'otevřené issue má Status Done')

        # d) uzavírací komentář
        if zavreno:
            texty = [c.get('body') or '' for c in d.get('comments', [])]
            if n > VYJIMKA_DO_CISLA:
                ok = any(all(s.lower() in t.lower() for s in SEKCE_UZAVRENI) for t in texty)
                if not ok:
                    pridej(n, 'd) uzavření', 'žádný komentář se sekcemi ' + ', '.join(SEKCE_UZAVRENI))
            else:
                ok = any('zpětná klasifikace' in t.lower() and 'analýza úniku' in t.lower() for t in texty)
                if not ok:
                    pridej(n, 'd) uzavření', 'chybí komentář „Zpětná klasifikace“ s analýzou úniku')

        # e) DEFEKTY.md
        if n not in md:
            pridej(n, 'e) DEFEKTY.md', 'chybí řádek v tabulce klasifikace')
        elif polozka is not None:
            sev, pri, jak, stav = md[n]
            for nazev, md_hodnota, board_hodnota in [
                    ('Závažnost', sev, kod_stupne(polozka.get('závažnost'))),
                    ('Priorita', pri, kod_stupne(polozka.get('priorita'))),
                    ('Jak nalezeno', jak, polozka.get('jak nalezeno') or ''),
                    ('Stav defektu', stav, polozka.get('stav defektu') or '')]:
                if md_hodnota != board_hodnota:
                    pridej(n, 'e) DEFEKTY.md', nazev + ': tabulka „' + md_hodnota + '“, board „' + board_hodnota + '“')

        # f) historie incidentů: uzavřený (ověřený) defekt S1 nebo S2 má řádek v tabulce
        if (zavreno and polozka is not None and (polozka.get('stav defektu') or '') == 'Uzavřený'
                and kod_stupne(polozka.get('závažnost')) in ('S1', 'S2') and n not in historie):
            pridej(n, 'f) incidenty', 'uzavřený defekt ' + kod_stupne(polozka.get('závažnost'))
                   + ' nemá řádek v HISTORIE-INCIDENTU.md')

    cisla = {d['number'] for d in defekty}
    for n in sorted(set(md) - cisla):
        pridej(n, 'e) DEFEKTY.md', 'řádek v tabulce, ale issue nemá štítek bug nebo neexistuje')
    return len(defekty), problemy


def samotest():
    """Pravidlo f) na vymyšlených datech: pozitivní i negativní zkoušky, bez sítě."""
    def defekt(n, stav='CLOSED'):
        return {'number': n, 'state': stav, 'title': 'Defekt: x', 'body': '', 'milestone': {'title': 'm'},
                'comments': []}

    def board(zavaznost, stav='Uzavřený'):
        return {'závažnost': zavaznost, 'priorita': 'P1 Okamžitá', 'jak nalezeno': 'Živá kontrola',
                'stav defektu': stav, 'status': 'Done'}

    def nalezy(zavaznost, historie, stav='Uzavřený', otevrene=False):
        d = defekt(1, 'OPEN' if otevrene else 'CLOSED')
        b = board(zavaznost, stav)
        if otevrene:
            b['status'] = 'In Progress'
        _, problemy = zkontrolovat([d], {1: b}, historie)
        return [p for p in problemy if p[1].startswith('f)')]

    text = '\n'.join([
        '| Datum | Co | Dopad | Doba | Odkaz |',
        '|---|---|---|---|---|',
        '| 1. 1. | ... viz #7 | ... | ... | [#5](https://github.com/Akimto01/Kulturni_radar/issues/5), [příběh](x.md) |',
        '| 2. 1. | ... | ... | ... | [příběh](x.md) a [#9](https://github.com/Akimto01/Kulturni_radar/issues/9) |',
    ])
    zkousky = [
        ('řádek tabulky: odkaz v posledním sloupci se počítá, zmínka v textu ne',
         cisla_z_historie(text) == {5, 9}),
        ('uzavřený S1 bez řádku je nález', len(nalezy('S1 Kritická', set())) == 1),
        ('uzavřený S2 bez řádku je nález', len(nalezy('S2 Vysoká', set())) == 1),
        ('uzavřený S2 s řádkem projde', nalezy('S2 Vysoká', {1}) == []),
        ('uzavřený S3 bez řádku projde', nalezy('S3 Střední', set()) == []),
        ('otevřený S2 bez řádku projde (zapíše se při uzavření)',
         nalezy('S2 Vysoká', set(), stav='Ověřuje se', otevrene=True) == []),
        ('zamítnutý S2 bez řádku projde (nebyl to defekt)', nalezy('S2 Vysoká', set(), stav='Zamítnutý') == []),
    ]
    selhalo = 0
    for nazev, ok in zkousky:
        print('  [%s] %s' % ('OK' if ok else 'SELHALO', nazev))
        selhalo += not ok
    print('Samotest pravidla f) %s (%d zkoušek).' % ('SELHAL' if selhalo else 'prošel', len(zkousky)))
    return 1 if selhalo else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if '--test' in sys.argv[1:]:
        return samotest()
    json_vystup = '--json' in sys.argv[1:]
    defekty = nacist_defekty()
    board = nacist_board()
    pocet, problemy = zkontrolovat(defekty, board)
    if json_vystup:
        # strojově čitelný výstup: stejné nálezy jako textová tabulka (všechny jsou chyby, varování nejsou)
        print(json.dumps({
            'skript': 'kontrola-defektu',
            'zkontrolovano': {'defektu': pocet},
            'chyby': [{'issue': c, 'pravidlo': p, 'co': co} for c, p, co in problemy],
            'varovani': [],
            'souhrn': souhrn_defektu(defekty, board),
        }, ensure_ascii=False, indent=2))
        return 1 if problemy else 0
    print('Zkontrolováno defektů (issues se štítkem bug): %d' % pocet)
    if not problemy:
        print('Bez nálezů.')
        return 0
    print('\n%-7s %-14s %s' % ('issue', 'pravidlo', 'co chybí'))
    for cislo, pravidlo, co in problemy:
        print('%-7s %-14s %s' % ('#' + str(cislo), pravidlo, co))
    print('\nNálezů: %d (nic se neopravuje automaticky)' % len(problemy))
    return 1


if __name__ == '__main__':
    sys.exit(main())
