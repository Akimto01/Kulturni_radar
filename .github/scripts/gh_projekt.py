"""Sdílené načítání dat z GitHubu pro kontrolní skripty (kontrola-defektu.py, kontrola-boardu.py).

Jen čte přes `gh` (subprocess), nic nemění. Potřebuje `gh` s přístupem k boardu, tedy
`GH_TOKEN=$(gh auth token --user Akimto01)`. Výchozí GITHUB_TOKEN board nepřečte
(uživatelský projekt), proto kontroly neběží v CI (viz Docs/kvalita/DEFEKTY.md).
"""
import json
import os
import re
import subprocess
import sys

OWNER = 'Akimto01'
REPO = 'Akimto01/Kulturni_radar'
PROJEKT = '1'
BACKLOG_MD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'Docs', 'BACKLOG.md')

# Lhůta pro kontrolu defektu podle Priority ve dnech (Docs/kvalita/DEFEKTY.md, kapitola Priorita);
# P4 a P5 bez lhůty. Po lhůtě varuje kontrola-boardu.py, polovinu lhůty bere navrh-session.py.
LHUTY_DNI = {'P1': 1, 'P2': 3, 'P3': 14}
WIP_LIMIT = 3          # nejvýš tolik issues najednou In Progress


def gh_json(args):
    r = subprocess.run(['gh'] + args, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit('gh ' + ' '.join(args[:3]) + ' selhalo: ' + r.stderr.strip())
    return json.loads(r.stdout)


def nacist_issues(stitek=None):
    """Všechna issues (otevřená i zavřená), případně jen s daným štítkem. Pole: number,
    title, state, body, milestone, labels, comments (včetně těl), updatedAt (datum poslední změny)."""
    args = ['issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '500', '--json',
            'number,title,state,body,milestone,labels,comments,createdAt,updatedAt']
    if stitek:
        args += ['--label', stitek]
    return gh_json(args)


def nacist_board():
    """Položky boardu (jen issues z tohoto repa) jako slovník číslo issue -> položka se všemi
    poli (klíče malými písmeny: status, odhad (h), termín, závažnost, priorita, jak nalezeno,
    stav defektu, milestone, labels)."""
    data = gh_json(['project', 'item-list', PROJEKT, '--owner', '@me', '--format', 'json', '-L', '1000'])
    return {i['content']['number']: i for i in data['items']
            if i.get('content', {}).get('type') == 'Issue' and i['content'].get('repository') == REPO}


def projit_backlog(text):
    """Vrátí seznam (číslo řádku, [čísla issues], přeškrtnutá, fáze) pro řádky BACKLOG.md s
    „→ issue #N“ v pořadí v souboru; fáze = číslo fáze v sekci Doporučené pořadí, jinak None."""
    vysledek = []
    sekce = ''
    faze = None
    for cislo, radek in enumerate(text.split(chr(10)), 1):
        radek = radek.rstrip(chr(13))
        if radek.startswith('## '):
            sekce = radek[3:].strip()
            faze = None
        m_faze = re.match(r'^\*\*Fáze (\d+)', radek)
        if m_faze and sekce == 'Doporučené pořadí':
            faze = int(m_faze.group(1))
        m = re.search(r'→\s*issue\s+((?:#\d+(?:\s*\([^)]*\))?(?:\s*,\s*)?)+)', radek)
        if not m:
            continue
        preskrtnuta = bool(re.match(r'^\s*(?:[-*]|\d+[a-z]?\.)\s+~~', radek))
        vysledek.append((cislo, [int(c) for c in re.findall(r'#(\d+)', m.group(1))], preskrtnuta,
                         faze if sekce == 'Doporučené pořadí' else None))
    return vysledek
