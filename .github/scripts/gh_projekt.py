"""Sdílené načítání dat z GitHubu pro kontrolní skripty (kontrola-defektu.py, kontrola-boardu.py).

Jen čte přes `gh` (subprocess), nic nemění. Potřebuje `gh` s přístupem k boardu, tedy
`GH_TOKEN=$(gh auth token --user Akimto01)`. Výchozí GITHUB_TOKEN board nepřečte
(uživatelský projekt), v CI proto jde secret BOARD_READ_TOKEN (viz Docs/kvalita/DEFEKTY.md).
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
STITEK_PREHLED = 'prehled'   # issue s automaticky přepisovaným přehledem (kontrola-projektu.yml), není úkol
LHUTY_DNI = {'P1': 1, 'P2': 3, 'P3': 14}
WIP_LIMIT = 3          # nejvýš tolik issues najednou In Progress


def gh_json(args):
    r = subprocess.run(['gh'] + args, capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        sys.exit('gh ' + ' '.join(args[:3]) + ' selhalo: ' + r.stderr.strip())
    return json.loads(r.stdout)


def bez_prehledu(issues):
    """Issues bez těch se štítkem `prehled` (automatický přehled projektu, není úkol)."""
    return [i for i in issues if STITEK_PREHLED not in {l['name'] for l in i.get('labels', [])}]


def nacist_issues(stitek=None):
    """Všechna issues (otevřená i zavřená), případně jen s daným štítkem. Pole: number,
    title, state, body, milestone, labels, comments (včetně těl), updatedAt (datum poslední změny)."""
    args = ['issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '500', '--json',
            'number,title,state,body,milestone,labels,comments,createdAt,updatedAt']
    if stitek:
        args += ['--label', stitek]
    return gh_json(args)


# Board se čte přes GraphQL (gh api graphql), ne přes `gh project item-list`: ten i pro osobní
# board vyžaduje scopy read:org a read:discussion, token má mít jen read:project.
BOARD_DOTAZ = """
query($login: String!, $cislo: Int!, $kurzor: String) {
  user(login: $login) { projectV2(number: $cislo) { items(first: 100, after: $kurzor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      content { __typename ... on Issue {
        number title body url
        repository { nameWithOwner url }
        labels(first: 50) { nodes { name } }
        milestone { title description dueOn }
      } }
      fieldValues(first: 50) { nodes {
        __typename
        ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } }
        ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { name } } }
        ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { name } } }
      } }
    }
  } } }
}
"""


def _polozka_boardu(uzel):
    """Uzel GraphQL -> položka ve tvaru dřívějšího `gh project item-list` (klíče malými písmeny)."""
    c = uzel['content']
    polozka = {
        'id': uzel['id'],
        'content': {'type': c['__typename'], 'number': c['number'], 'title': c['title'], 'body': c['body'],
                    'url': c['url'], 'repository': c['repository']['nameWithOwner']},
        'title': c['title'],
        'repository': c['repository']['url'],
        'labels': [l['name'] for l in c['labels']['nodes']],
    }
    if c['milestone']:
        polozka['milestone'] = c['milestone']
    for v in uzel['fieldValues']['nodes']:
        pole = (v.get('field') or {}).get('name')
        if not pole:
            continue
        # hodnota podle typu pole: single select (name), číslo (number), datum (date)
        hodnota = v.get('name', v.get('number', v.get('date')))
        if hodnota is not None:
            polozka[pole.lower()] = hodnota
    return polozka


def nacist_board():
    """Položky boardu (jen issues z tohoto repa) jako slovník číslo issue -> položka se všemi
    poli (klíče malými písmeny: status, odhad (h), termín, závažnost, priorita, jak nalezeno,
    stav defektu, milestone, labels). Pole se berou podle názvu, ne podle pevných ID."""
    polozky = {}
    kurzor = None
    while True:
        args = ['api', 'graphql', '-f', 'query=' + BOARD_DOTAZ, '-F', 'login=' + OWNER, '-F', 'cislo=' + PROJEKT]
        if kurzor:
            args += ['-F', 'kurzor=' + kurzor]
        data = gh_json(args)
        if data.get('errors') or not (data.get('data') or {}).get('user'):
            sys.exit('gh api graphql (board) selhalo: ' + json.dumps(data.get('errors') or 'uživatel nenalezen', ensure_ascii=False)[:300])
        stranka = data['data']['user']['projectV2']['items']
        for uzel in stranka['nodes']:
            c = uzel['content']
            if c and c['__typename'] == 'Issue' and c['repository']['nameWithOwner'] == REPO:
                polozky[c['number']] = _polozka_boardu(uzel)
        if not stranka['pageInfo']['hasNextPage']:
            return polozky
        kurzor = stranka['pageInfo']['endCursor']


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
