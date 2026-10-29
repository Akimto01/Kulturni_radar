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

Výstup: tabulka problémů (issue, pravidlo, co chybí); exit 1 při nálezu.
"""
import json
import os
import re
import subprocess
import sys

OWNER = 'Akimto01'
REPO = 'Akimto01/Kulturni_radar'
PROJEKT = '1'
DEFEKTY_MD = os.path.join(os.path.dirname(__file__), '..', '..', 'Docs', 'kvalita', 'DEFEKTY.md')

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


def gh_json(args):
    r = subprocess.run(['gh'] + args, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit('gh ' + ' '.join(args[:3]) + ' selhalo: ' + r.stderr.strip())
    return json.loads(r.stdout)


def nacist_defekty():
    return gh_json(['issue', 'list', '--repo', REPO, '--label', 'bug', '--state', 'all',
                    '--limit', '300', '--json', 'number,title,state,body,milestone,comments'])


def nacist_board():
    data = gh_json(['project', 'item-list', PROJEKT, '--owner', OWNER, '--format', 'json', '-L', '500'])
    return {i['content']['number']: i for i in data['items']
            if i.get('content', {}).get('type') == 'Issue' and i['content'].get('repository') == REPO}


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


def kod_stupne(hodnota):
    """„S2 Vysoká“ -> „S2“ (na boardu je celý název, v DEFEKTY.md jen kód)."""
    return str(hodnota or '').split(' ')[0]


def zkontrolovat():
    problemy = []   # (issue, pravidlo, co chybí)

    def pridej(cislo, pravidlo, co):
        problemy.append((cislo, pravidlo, co))

    defekty = nacist_defekty()
    board = nacist_board()
    md = radky_defekty_md()

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

    cisla = {d['number'] for d in defekty}
    for n in sorted(set(md) - cisla):
        pridej(n, 'e) DEFEKTY.md', 'řádek v tabulce, ale issue nemá štítek bug nebo neexistuje')
    return len(defekty), problemy


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    pocet, problemy = zkontrolovat()
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
