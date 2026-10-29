"""Sdílené načítání dat z GitHubu pro kontrolní skripty (kontrola-defektu.py, kontrola-boardu.py).

Jen čte přes `gh` (subprocess), nic nemění. Potřebuje `gh` s přístupem k boardu, tedy
`GH_TOKEN=$(gh auth token --user Akimto01)`. Výchozí GITHUB_TOKEN board nepřečte
(uživatelský projekt), proto kontroly neběží v CI (viz Docs/kvalita/DEFEKTY.md).
"""
import json
import subprocess
import sys

OWNER = 'Akimto01'
REPO = 'Akimto01/Kulturni_radar'
PROJEKT = '1'


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
    data = gh_json(['project', 'item-list', PROJEKT, '--owner', OWNER, '--format', 'json', '-L', '1000'])
    return {i['content']['number']: i for i in data['items']
            if i.get('content', {}).get('type') == 'Issue' and i['content'].get('repository') == REPO}
