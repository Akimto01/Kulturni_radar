#!/usr/bin/env python3
"""Kontrola správy boardu a BACKLOGu pro všechna issues (nejen bug). Jen čte, nic nemění.

Spouští se ručně (a na konci session, viz SKILL.md) i v CI (kontrola-projektu.yml, token
BOARD_READ_TOKEN; výchozí GITHUB_TOKEN uživatelský board nepřečte, viz Docs/kvalita/DEFEKTY.md):

    GH_TOKEN=$(gh auth token --user Akimto01) python .github/scripts/kontrola-boardu.py

S přepínačem --json stejné chyby a varování jako JSON (plus souhrn In Progress a termínů na týden).
S přepínačem --test ověří na vymyšlených datech, že issues se štítkem prehled (automatický přehled
projektu) se ignorují.

Dvě úrovně:
  CHYBA (exit 1)
    - otevřené issue chybí na boardu nebo nemá Status, milník nebo štítek (feature, bug, docs,
      testing, research)
    - zavřené issue nemá Status Done, otevřené ho má
    - Todo nebo In Progress bez Odhadu (h)
    - zavřené issue s neodškrtnutou položkou checklistu „- [ ]“ v těle
    - BACKLOG.md: „→ issue #N“ na neexistující issue; přeškrtnutá položka (začíná ~~) u otevřeného
      issue; nepřeškrtnutá u zavřeného. U položky s víc issues platí: přeškrtnutá jen když jsou
      všechna zavřená, nepřeškrtnutá nesmí mít všechna zavřená.
  VAROVÁNÍ (jen výpis, exit 0)
    - issue z Doporučeného pořadí ve Todo, ale ve fázi mimo FAZE_PRO_TODO
    - víc než WIP_LIMIT issues In Progress
    - In Progress bez změny déle než DNI_BEZ_ZMENY dní
    - Termín v minulosti u otevřeného issue
    - defekt po lhůtě: otevřený bug starší než lhůta jeho Priority (LHUTY_DNI), stáří od založení
      (datum změny Priority GitHub neukládá); výjimka pro Stav defektu „Ověřuje se“
"""
import datetime
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # python -I nepřidává složku skriptu
import gh_projekt  # noqa: E402  (sdílené načítání issues a boardu)

BACKLOG_MD = gh_projekt.BACKLOG_MD

STITKY = {'feature', 'bug', 'docs', 'testing', 'research'}

# Todo jen pro vybrané na nejbližší práci (SKILL.md, sekce 9): z Doporučeného pořadí fáze 1 a 2
# (ověření a zpevnění základu); issue z pozdějších fází ve Todo je varování, ne chyba.
FAZE_PRO_TODO = {1, 2}
WIP_LIMIT = gh_projekt.WIP_LIMIT                 # nejvýš tolik issues najednou In Progress
DNI_BEZ_ZMENY = 14     # In Progress bez změny déle než tolik dní
LHUTY_DNI = gh_projekt.LHUTY_DNI   # lhůta defektu podle Priority (P1 1 den, P2 3 dny, P3 14 dní)
STAV_CEKA_NA_DATA = 'Ověřuje se'   # čeká na data, ne na práci: bez varování po lhůtě


projit_backlog = gh_projekt.projit_backlog


def zkontrolovat(issues, board, backlog_text, dnes=None):
    """Čistá funkce nad načtenými daty. Vrací (chyby, varování) jako seznamy (issue, pravidlo, co)."""
    chyby, varovani = [], []
    dnes = dnes or datetime.date.today()
    issues = gh_projekt.bez_prehledu(issues)
    stav = {i['number']: i['state'] for i in issues}
    in_progress = []

    for i in sorted(issues, key=lambda x: x['number']):
        n = i['number']
        zavreno = i['state'] == 'CLOSED'
        polozka = board.get(n)
        status = (polozka or {}).get('status') or ''

        if not zavreno:
            if polozka is None:
                chyby.append((n, 'board', 'otevřené issue není na boardu'))
            elif not status:
                chyby.append((n, 'board', 'chybí Status'))
            if not i.get('milestone'):
                chyby.append((n, 'milník', 'otevřené issue nemá milník'))
            if not {l['name'] for l in i.get('labels', [])} & STITKY:
                chyby.append((n, 'štítek', 'žádný z ' + ', '.join(sorted(STITKY))))
            if status == 'Done':
                chyby.append((n, 'stavy', 'otevřené issue má Status Done'))
            if status in ('Todo', 'In Progress') and (polozka or {}).get('odhad (h)') in (None, ''):
                chyby.append((n, 'odhad', status + ' bez Odhadu (h)'))
            termin = (polozka or {}).get('termín')
            if termin:
                try:
                    if datetime.date.fromisoformat(termin[:10]) < dnes:
                        varovani.append((n, 'termín', 'Termín ' + termin[:10] + ' je v minulosti'))
                except ValueError:
                    chyby.append((n, 'termín', 'neplatné datum Termínu „' + termin + '“'))
            priorita = ((polozka or {}).get('priorita') or '').split(' ')[0]
            if ('bug' in {l['name'] for l in i.get('labels', [])} and priorita in LHUTY_DNI
                    and (polozka or {}).get('stav defektu') != STAV_CEKA_NA_DATA and i.get('createdAt')):
                stari = (dnes - datetime.date.fromisoformat(i['createdAt'][:10])).days
                if stari > LHUTY_DNI[priorita]:
                    varovani.append((n, 'po lhůtě', 'defekt %s: lhůta %d d, otevřený %d d' % (
                        priorita, LHUTY_DNI[priorita], stari)))
            if status == 'In Progress':
                in_progress.append(n)
                zmena = datetime.date.fromisoformat((i.get('updatedAt') or '')[:10]) if i.get('updatedAt') else None
                if zmena and (dnes - zmena).days > DNI_BEZ_ZMENY:
                    varovani.append((n, 'In Progress', 'bez změny %d dní (od %s)' % ((dnes - zmena).days, zmena)))
        else:
            if status != 'Done':
                chyby.append((n, 'stavy', 'zavřené issue má Status „' + status + '“, ne Done'))
            if re.search(r'^\s*[-*]\s+\[ \]', i.get('body') or '', re.M):
                chyby.append((n, 'checklist', 'zavřené issue má neodškrtnutou položku „- [ ]“ v těle'))

    if len(in_progress) > WIP_LIMIT:
        varovani.append((0, 'WIP limit', '%d issues In Progress (limit %d): %s' % (
            len(in_progress), WIP_LIMIT, ', '.join('#' + str(n) for n in in_progress))))

    faze_issue = {}
    for cislo, cisla, preskrtnuta, faze in projit_backlog(backlog_text):
        for n in cisla:
            if n not in stav:
                chyby.append((n, 'BACKLOG', 'řádek %d: „→ issue #%d“ na neexistující issue' % (cislo, n)))
            if faze is not None:
                faze_issue[n] = min(faze, faze_issue.get(n, faze))   # issue ve víc fázích: platí nejbližší
        znama = [n for n in cisla if n in stav]
        otevrena = [n for n in znama if stav[n] == 'OPEN']
        if znama and preskrtnuta and otevrena:
            chyby.append((otevrena[0], 'BACKLOG', 'řádek %d: položka je přeškrtnutá, ale %s je otevřené' % (
                cislo, ', '.join('#' + str(n) for n in otevrena))))
        if znama and not preskrtnuta and not otevrena:
            chyby.append((znama[0], 'BACKLOG', 'řádek %d: položka není přeškrtnutá, ale %s je zavřené' % (
                cislo, ', '.join('#' + str(n) for n in znama))))

    for n, faze in sorted(faze_issue.items()):
        polozka = board.get(n)
        if stav.get(n) == 'OPEN' and polozka and polozka.get('status') == 'Todo' and faze not in FAZE_PRO_TODO:
            varovani.append((n, 'Todo', 'je ve fázi %d Doporučeného pořadí, Todo patří jen vybraným na nejbližší práci' % faze))
    return chyby, varovani


def vypis(radky, uroven):
    for cislo, pravidlo, co in radky:
        print('%-7s %-12s %-9s %s' % ('#' + str(cislo) if cislo else '-', pravidlo, uroven, co))


def souhrn(issues, board, dnes=None, dnu=7):
    """Souhrn pro --json: issues In Progress a termíny v příštích `dnu` dnech (včetně dneška)."""
    dnes = dnes or datetime.date.today()
    otevrena = {i['number']: i for i in gh_projekt.bez_prehledu(issues) if i['state'] == 'OPEN'}
    in_progress = [{'issue': n, 'titulek': otevrena[n]['title']} for n in sorted(otevrena)
                   if (board.get(n) or {}).get('status') == 'In Progress']
    terminy = []
    for n in sorted(otevrena):
        t = (board.get(n) or {}).get('termín')
        if not t:
            continue
        try:
            datum = datetime.date.fromisoformat(t[:10])
        except ValueError:
            continue
        if dnes <= datum <= dnes + datetime.timedelta(days=dnu):
            terminy.append({'issue': n, 'titulek': otevrena[n]['title'], 'datum': datum.isoformat()})
    terminy.sort(key=lambda x: (x['datum'], x['issue']))
    return {'in_progress': in_progress, 'terminy_tyden': terminy}


def vlastni_test():
    """Ověří ignorování issues se štítkem prehled na vymyšlených datech (bez GitHubu)."""
    sys.stdout.reconfigure(encoding='utf-8')
    selhani = 0

    def over(ok, popis):
        nonlocal selhani
        selhani += not ok
        print('%-4s %s' % ('OK' if ok else 'CHYBA', popis))

    dnes = datetime.date(2026, 10, 29)

    def iss(n, labely, stav='OPEN'):
        return {'number': n, 'title': 'Issue %d' % n, 'state': stav, 'labels': [{'name': l} for l in labely],
                'body': '', 'createdAt': '2026-10-28T10:00:00Z', 'updatedAt': '2026-10-28T10:00:00Z'}

    over(zkontrolovat([iss(1, ['prehled'])], {}, '', dnes) == ([], []), 'otevřený prehled bez boardu, milníku a Odhadu: bez chyb')
    over(zkontrolovat([iss(1, ['prehled'], 'CLOSED')], {}, '', dnes) == ([], []), 'zavřený prehled bez Status Done: bez chyb')
    over(zkontrolovat([iss(1, ['prehled'], 'CLOSED')], {1: {'status': 'Todo'}}, '', dnes) == ([], []), 'prehled na boardu s libovolným Statusem: bez chyb')
    chyby, _ = zkontrolovat([iss(2, ['docs'])], {}, '', dnes)
    over({c[1] for c in chyby} == {'board', 'milník'}, 'běžné issue bez boardu a milníku se dál hlásí (%s)' % sorted(c[1] for c in chyby))
    chyby, _ = zkontrolovat([iss(1, ['prehled']), iss(2, ['docs'])], {}, '', dnes)
    over(all(c[0] == 2 for c in chyby) and chyby, 'vedle prehledu se hlásí jen běžné issue')
    chyby, _ = zkontrolovat([iss(3, [])], {3: {'status': 'Backlog'}}, '', dnes)
    over(any(c[1] == 'štítek' for c in chyby), 'issue bez štítku se hlásí (prehled je výjimka jen pod tímto štítkem)')
    s = souhrn([iss(1, ['prehled']), iss(2, ['docs'])], {1: {'status': 'In Progress', 'termín': '2026-10-30'},
                                                          2: {'status': 'In Progress', 'termín': '2026-10-31'}}, dnes)
    over([x['issue'] for x in s['in_progress']] == [2] and [x['issue'] for x in s['terminy_tyden']] == [2],
         'souhrn (In Progress, termíny) prehled vynechá')
    print(chr(10) + ('Test prošel.' if not selhani else 'Test selhal: %d chyb.' % selhani))
    return 1 if selhani else 0


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if '--test' in sys.argv[1:]:
        return vlastni_test()
    json_vystup = '--json' in sys.argv[1:]
    issues = gh_projekt.bez_prehledu(gh_projekt.nacist_issues())
    board = gh_projekt.nacist_board()
    with open(BACKLOG_MD, encoding='utf-8') as f:
        backlog = f.read()
    chyby, varovani = zkontrolovat(issues, board, backlog)

    otevrena = sum(1 for i in issues if i['state'] == 'OPEN')
    if json_vystup:
        # strojově čitelný výstup: stejné chyby a varování jako textová tabulka
        print(json.dumps({
            'skript': 'kontrola-boardu',
            'zkontrolovano': {'issues': len(issues), 'otevrenych': otevrena, 'polozek_boardu': len(board)},
            'chyby': [{'issue': c, 'pravidlo': p, 'co': co} for c, p, co in chyby],
            'varovani': [{'issue': c, 'pravidlo': p, 'co': co} for c, p, co in varovani],
            'souhrn': souhrn(issues, board),
        }, ensure_ascii=False, indent=2))
        return 1 if chyby else 0
    print('Zkontrolováno issues: %d (otevřených %d), položek boardu: %d' % (len(issues), otevrena, len(board)))
    if chyby or varovani:
        print('\n%-7s %-12s %-9s %s' % ('issue', 'pravidlo', 'úroveň', 'co chybí'))
        vypis(chyby, 'CHYBA')
        vypis(varovani, 'VAROVÁNÍ')
    print('\nChyb: %d, varování: %d (nic se neopravuje automaticky)' % (len(chyby), len(varovani)))
    return 1 if chyby else 0


if __name__ == '__main__':
    sys.exit(main())
