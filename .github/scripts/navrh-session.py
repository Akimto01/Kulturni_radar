#!/usr/bin/env python3
"""Návrh obsahu pracovní session z boardu podle času, který je k dispozici. Jen čte, nic nemění.

    GH_TOKEN=$(gh auth token --user Akimto01) python .github/scripts/navrh-session.py --cas 60
    GH_TOKEN=$(gh auth token --user Akimto01) python .github/scripts/navrh-session.py --cas "cca 3h"
    python .github/scripts/navrh-session.py --cas 3h --json   # stejný návrh jako JSON
    python .github/scripts/navrh-session.py --test      # ověří převod času a výběr (bez GitHubu)

Kandidáti v tomto pořadí (každé issue jen jednou, u každého důvod a Odhad v hodinách):
  1. otevřená issues s Termínem dnes nebo v minulosti
  2. defekty P1 a P2 (bez Stavu defektu „Ověřuje se“: ten čeká na data, ne na práci)
  3. issues In Progress (dokončit před novou prací, WIP limit)
  4. defekty P3 po polovině lhůty
  5. Todo v pořadí Doporučeného pořadí v BACKLOG.md
  6. položky Backlogu z nejbližší další fáze Doporučeného pořadí

Co se nenavrhuje, ale vypíše se zvlášť:
  - Naplánováno na později: otevřené issue s Termínem po dnešku (typicky ověřovačky čekající na běh)
  - Blokováno: v řádku BACKLOG.md nebo v těle issue je „až po #N“ (i „(až po #N)“, „až po dokončení [#N]“)
    a #N je otevřené (konvence popsaná v SKILL.md, sekce 9)
  - Čeká na data: Stav defektu „Ověřuje se“ bez Termínu (nenavrhuje se, doplnit Termín)

Issue s neodškrtnutým checklistem se navrhuje po částech: je-li v první neodškrtnuté položce odhad
v textu (např. „(1,5 h)“, „(1,5 až 2 h)“, „(45 min)“), navrhne se jen ona, s horní mezí odhadu.
Jinak se nabídne celé issue podle Odhadu na boardu.

Vybere tolik položek, kolik se vejde do času; položka bez Odhadu se nabídne zvlášť a do času se
nezapočítá. Na konci součet, zbývající čas a nálezy kontroly boardu. Skript nezná dočasná omezení
(např. „do neděle neměnit RF testy“), ta zohlední člověk nebo Claude při plánu.
"""
import argparse
import datetime
import importlib.util
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # python -I nepřidává složku skriptu
import gh_projekt  # noqa: E402  (sdílené načítání issues a boardu)

PRIKLADY_CASU = '„60“ (minuty), „90m“, „90 min“, „1h“, „3 h“, „1,5h“, „1.5 h“, „2:30“, „1h30“, „cca 3h“, „~45 min“'
STAV_CEKA_NA_DATA = 'Ověřuje se'
MAX_MINUT = 24 * 60
CISLO = r'(\d+(?:[.,]\d+)?)'
JEDNOTKA = r'(h|hod\w*|min\w*)'
RE_ZAVISLOST = re.compile(r'až\s+po\s+(?:dokončení\s+)?(?:issue\s+)?\[?#(\d+)', re.I)
RE_ODHAD_ROZSAH = re.compile(r'\(\s*(?:cca\s*|~\s*)?' + CISLO + r'\s*(?:až|-|–)\s*' + CISLO + r'\s*' + JEDNOTKA + r'\s*\)', re.I)
RE_ODHAD_JEDEN = re.compile(r'\(\s*(?:cca\s*|~\s*)?' + CISLO + r'\s*' + JEDNOTKA + r'\s*\)', re.I)
RE_POLOZKA = re.compile(r'^\s*[-*]\s+\[( |x|X)\]\s+(.*)$')


def prevest_cas(text):
    """Převede zadaný čas na minuty (celé číslo). Bez jednotky jsou minuty. Při neplatném vstupu
    vyhodí ValueError se srozumitelnou zprávou a příklady."""
    puvodni = text
    t = str(text if text is not None else '').strip().lower()
    t = re.sub(r'^(?:cca|asi|okolo|~)\s*', '', t).strip()
    minuty = None
    m = re.fullmatch(r'(\d{1,2}):([0-5]\d)', t)
    if m:
        minuty = int(m.group(1)) * 60 + int(m.group(2))
    if minuty is None:
        m = re.fullmatch(r'(\d+)\s*h(?:od(?:in[ayu]?|ina)?)?\s*(\d+)\s*(?:m(?:in(?:ut[ay]?)?)?)?', t)
        if m:
            minuty = int(m.group(1)) * 60 + int(m.group(2))
    if minuty is None:
        m = re.fullmatch(r'(\d+(?:[.,]\d+)?)\s*(m|min|minut|minuty|minuta|h|hod|hodin|hodiny|hodina)?', t)
        if m:
            cislo = float(m.group(1).replace(',', '.'))
            jednotka = m.group(2) or 'm'
            minuty = int(round(cislo * (60 if jednotka.startswith('h') else 1)))
    if minuty is None or minuty <= 0 or minuty > MAX_MINUT:
        raise ValueError('Neplatný čas „%s“. Příklady platných tvarů: %s (nejvýš 24 h).' % (puvodni, PRIKLADY_CASU))
    return minuty


def fmt_h(hodiny):
    return ('%g' % round(hodiny, 2)).replace('.', ',')


def _cislo(text):
    return float(text.replace(',', '.'))


def odhad_v_textu(text):
    """Odhad z textu položky checklistu: „(1,5 h)“, „(1,5 až 2 h)“, „(45 min)“. Vrací (hodiny, popis)
    s horní mezí rozsahu, nebo None, když odhad v textu není."""
    m = RE_ODHAD_ROZSAH.search(text)
    if m:
        horni, jednotka = _cislo(m.group(2)), m.group(3).lower()
    else:
        m = RE_ODHAD_JEDEN.search(text)
        if not m:
            return None
        horni, jednotka = _cislo(m.group(1)), m.group(2).lower()
    if jednotka.startswith('min'):
        return horni / 60.0, '%d min' % round(horni)
    return horni, fmt_h(horni) + ' h'


def prvni_neodskrtnuta_polozka(body):
    """První neodškrtnutá položka checklistu v těle issue jako text, nebo None."""
    for radek in (body or '').split(chr(10)):
        m = RE_POLOZKA.match(radek.rstrip(chr(13)))
        if m and m.group(1) == ' ':
            return m.group(2)
    return None


def nazev_polozky(text):
    """Z „**1. Úklid sdílené stránky** (1,5 až 2 h): …“ udělá „dávka 1: Úklid sdílené stránky“;
    bez tučného čísla vezme začátek textu před závorkou odhadu."""
    m = re.match(r'\*\*(\d+)\.\s*(.+?)\*\*', text)
    if m:
        return 'dávka %s: %s' % (m.group(1), m.group(2).strip())
    return re.split(r'\s*\(', text.replace('**', ''), 1)[0].strip()[:60]


def _hodnota_odhadu(polozka):
    o = (polozka or {}).get('odhad (h)')
    return float(o) if o not in (None, '') else None


def zavislosti(issues, backlog_text):
    """Slovník číslo issue -> množina čísel, na která čeká („až po #N“): z řádků BACKLOG.md
    s „→ issue #N“ a z těla issue. Vlastní číslo issue se ignoruje."""
    vysledek = {}
    for radek in backlog_text.split(chr(10)):
        m = re.search(r'→\s*issue\s+((?:#\d+(?:\s*\([^)]*\))?(?:\s*,\s*)?)+)', radek)
        if not m:
            continue
        cekaji = {int(c) for c in RE_ZAVISLOST.findall(radek)}
        if cekaji:
            for c in re.findall(r'#(\d+)', m.group(1)):
                vysledek.setdefault(int(c), set()).update(cekaji)
    for i in issues:
        cekaji = {int(c) for c in RE_ZAVISLOST.findall(i.get('body') or '')}
        if cekaji:
            vysledek.setdefault(i['number'], set()).update(cekaji)
    for n in vysledek:
        vysledek[n].discard(n)
    return vysledek


def sestavit_kandidaty(issues, board, backlog_text, dnes, lhuty=None):
    """Vrátí slovník: kandidati (seznam {n, titulek, duvod, odhad}), pozdeji (Naplánováno na později),
    blokovano (Blokováno) a ceka (Čeká na data)."""
    lhuty = lhuty or gh_projekt.LHUTY_DNI
    issues = gh_projekt.bez_prehledu(issues)
    otevrena = {i['number']: i for i in issues if i['state'] == 'OPEN'}
    stav = {i['number']: i['state'] for i in issues}
    zaznamy = gh_projekt.projit_backlog(backlog_text)

    def termin(n):
        t = (board.get(n) or {}).get('termín')
        if not t:
            return None
        try:
            return datetime.date.fromisoformat(t[:10])
        except ValueError:
            return None

    def ceka_na_data(n):
        return (board.get(n) or {}).get('stav defektu') == STAV_CEKA_NA_DATA

    # co se nenavrhuje: budoucí Termín, blokace, čeká na data bez Termínu
    pozdeji, blokovano, ceka = [], [], []
    vynechana = set()
    zavisle = zavislosti(issues, backlog_text)
    for n in sorted(otevrena):
        t = termin(n)
        if t and t > dnes:
            pozdeji.append({'n': n, 'titulek': otevrena[n]['title'], 'datum': t,
                            'poznamka': 'Ověřuje se' if ceka_na_data(n) else ''})
            vynechana.add(n)
            continue
        otevrene_zavislosti = sorted(c for c in zavisle.get(n, ()) if stav.get(c) == 'OPEN')
        if otevrene_zavislosti:
            blokovano.append({'n': n, 'titulek': otevrena[n]['title'],
                              'duvod': 'až po ' + ', '.join('#' + str(c) for c in otevrene_zavislosti) + ' (otevřené)'})
            vynechana.add(n)
            continue
        if ceka_na_data(n) and not (t and t <= dnes):
            ceka.append({'n': n, 'titulek': otevrena[n]['title']})
            vynechana.add(n)
    pozdeji.sort(key=lambda x: (x['datum'], x['n']))

    kandidati, videno = [], set(vynechana)

    def pridej(n, duvod, kategorie):
        if n in videno or n not in otevrena:
            return
        videno.add(n)
        odhad = _hodnota_odhadu(board.get(n))
        titulek = otevrena[n]['title']
        polozka = prvni_neodskrtnuta_polozka(otevrena[n].get('body'))
        if polozka is not None:
            o = odhad_v_textu(polozka)
            if o:
                odhad = o[0]
                titulek = '%s (%s)' % (nazev_polozky(polozka), o[1])
                duvod += '; první neodškrtnutá položka checklistu'
        kandidati.append({'n': n, 'titulek': titulek, 'duvod': duvod, 'odhad': odhad, 'kategorie': kategorie})

    def je_bug(n):
        return 'bug' in {l['name'] for l in otevrena[n].get('labels', [])}

    def priorita(n):
        return ((board.get(n) or {}).get('priorita') or '').split(' ')[0]

    # 1. Termín dnes nebo v minulosti
    for n in sorted(otevrena):
        t = termin(n)
        if t and t <= dnes:
            pridej(n, 'Termín %d. %d. (%s)' % (t.day, t.month, 'dnes' if t == dnes else 'po termínu'), 'termin')
    # 2. defekty P1 a P2
    for n in sorted(otevrena):
        if je_bug(n) and priorita(n) in ('P1', 'P2'):
            pridej(n, 'defekt %s' % priorita(n), 'defekt_p1_p2')
    # 3. In Progress
    for n in sorted(otevrena):
        if (board.get(n) or {}).get('status') == 'In Progress':
            pridej(n, 'rozpracované (In Progress), dokončit před novou prací', 'in_progress')
    # 4. defekty P3 po polovině lhůty
    for n in sorted(otevrena):
        if je_bug(n) and priorita(n) == 'P3' and otevrena[n].get('createdAt'):
            stari = (dnes - datetime.date.fromisoformat(otevrena[n]['createdAt'][:10])).days
            if stari >= lhuty['P3'] / 2:
                pridej(n, 'defekt P3, otevřený %d dní z lhůty %d' % (stari, lhuty['P3']), 'defekt_p3')
    # 5. Todo v pořadí Doporučeného pořadí (pak ostatní Todo)
    poradi = [n for _, cisla, _, _ in zaznamy for n in cisla]
    for n in poradi + sorted(otevrena):
        if (board.get(n) or {}).get('status') == 'Todo':
            pridej(n, 'Todo (Doporučené pořadí)' if n in poradi else 'Todo', 'todo')
    # 6. první položky Backlogu z nejbližší další fáze; když v ní není nic navrhnutelného (vše
    #    blokované, naplánované na později nebo bez Odhadu), pokračuje se další fází, dokud se
    #    navrhnutelná položka nenajde nebo fáze nedojdou
    faze_backlogu = {}
    for _, cisla, _, faze in zaznamy:
        for n in cisla:
            if faze is not None and (board.get(n) or {}).get('status') == 'Backlog' and n in otevrena and n not in vynechana:
                faze_backlogu[n] = min(faze, faze_backlogu.get(n, faze))
    for faze in sorted(set(faze_backlogu.values())):
        polozky = [n for n in dict.fromkeys(poradi) if faze_backlogu.get(n) == faze]
        navrhnutelna = [n for n in polozky if _hodnota_odhadu(board.get(n)) is not None]
        for n in polozky:
            pridej(n, 'Backlog, fáze %d Doporučeného pořadí' % faze, 'backlog')   # i bez Odhadu: vypíše se zvlášť
        if navrhnutelna:
            break
    return {'kandidati': kandidati, 'pozdeji': pozdeji, 'blokovano': blokovano, 'ceka': ceka}


def vybrat(kandidati, minuty):
    """Greedy podle pořadí: vybere, co se vejde do času. Vrací (vybrane, bez_odhadu, nevesly, zbyva_h)."""
    zbyva = minuty / 60.0
    vybrane, bez_odhadu, nevesly = [], [], []
    for k in kandidati:
        if k['odhad'] is None:
            bez_odhadu.append(k)
        elif k['odhad'] <= zbyva + 1e-9:
            vybrane.append(k)
            zbyva -= k['odhad']
        else:
            nevesly.append(k)
    return vybrane, bez_odhadu, nevesly, zbyva


def _kontrola_boardu():
    spec = importlib.util.spec_from_file_location(
        'kontrola_boardu', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kontrola-boardu.py'))
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


def vypis_tabulku(radky, hlavicka):
    print('  %-6s %-52s %-7s %s' % hlavicka)
    for k in radky:
        print('  %-6s %-52s %-7s %s' % ('#' + str(k['n']), k['titulek'][:52],
                                       fmt_h(k['odhad']) if k['odhad'] is not None else '-', k['duvod']))


def sestavit_navrh(minuty, dnes=None):
    """Celý návrh session jako slovník (zdroj pro textový i JSON výstup, takže si odpovídají)."""
    dnes = dnes or datetime.date.today()
    issues = gh_projekt.bez_prehledu(gh_projekt.nacist_issues())
    board = gh_projekt.nacist_board()
    with open(gh_projekt.BACKLOG_MD, encoding='utf-8') as f:
        backlog = f.read()

    data = sestavit_kandidaty(issues, board, backlog, dnes)
    kandidati = data['kandidati']
    vybrane, bez_odhadu, nevesly, zbyva = vybrat(kandidati, minuty)
    chyby, varovani = _kontrola_boardu().zkontrolovat(issues, board, backlog, dnes)
    return {
        'skript': 'navrh-session',
        'cas_minut': minuty,
        'datum': dnes.isoformat(),
        'otevrenych_issues': sum(1 for i in issues if i['state'] == 'OPEN'),
        'kandidati': kandidati,
        'vybrane': vybrane,
        'soucet_h': sum(k['odhad'] for k in vybrane),
        'zbyva_h': zbyva,
        'bez_odhadu': bez_odhadu,
        'nevesly': nevesly,
        'pozdeji': [dict(p, datum=p['datum'].isoformat()) for p in data['pozdeji']],
        'blokovano': data['blokovano'],
        'ceka': data['ceka'],
        'kontrola_boardu': {
            'chyby': [{'issue': c, 'pravidlo': p, 'co': co} for c, p, co in chyby],
            'varovani': [{'issue': c, 'pravidlo': p, 'co': co} for c, p, co in varovani],
        },
    }


def vypis_navrh(n):
    """Textový výstup návrhu z jeho slovníku."""
    minuty = n['cas_minut']
    datum = datetime.date.fromisoformat(n['datum'])
    print('Návrh session na %d min (%s h), %s' % (minuty, fmt_h(minuty / 60.0), datum.strftime('%d. %m. %Y')))
    print('Kandidátů: %d (otevřených issues: %d)\n' % (len(n['kandidati']), n['otevrenych_issues']))
    hlavicka = ('issue', 'titulek', 'Odhad h', 'důvod')
    print('Vybráno podle Odhadu:')
    if n['vybrane']:
        vypis_tabulku(n['vybrane'], hlavicka)
        print('\nSoučet Odhadů: %s h, zbývá %s h (%d min)' % (fmt_h(n['soucet_h']), fmt_h(n['zbyva_h']), round(n['zbyva_h'] * 60)))
    else:
        print('  Dnes není co rozumně navrhnout: nic z kandidátů se nevejde do času nebo nic nečeká na práci.')
        print('  (zbývá celých %s h; viz seznamy níže)' % fmt_h(n['zbyva_h']))
    if n['bez_odhadu']:
        print('\nBez Odhadu (nezapočítáno, doplnit Odhad nebo rozhodnout ručně):')
        vypis_tabulku(n['bez_odhadu'], hlavicka)
    if n['nevesly']:
        print('\nNevešlo se do času (Odhad větší než zbývající čas):')
        vypis_tabulku(n['nevesly'][:8], hlavicka)
        if len(n['nevesly']) > 8:
            print('  … a dalších %d' % (len(n['nevesly']) - 8))
    if n['pozdeji']:
        print('\nNaplánováno na později (Termín po dnešku, nenavrhuje se):')
        for p in n['pozdeji']:
            d = datetime.date.fromisoformat(p['datum'])
            print('  %-6s %-52s %-11s %s' % ('#' + str(p['n']), p['titulek'][:52], '%d. %d.' % (d.day, d.month), p['poznamka']))
    if n['blokovano']:
        print('\nBlokováno (čeká na otevřené issue, nenavrhuje se):')
        for b in n['blokovano']:
            print('  %-6s %-52s %s' % ('#' + str(b['n']), b['titulek'][:52], b['duvod']))
    if n['ceka']:
        print('\nČeká na data (Stav defektu Ověřuje se bez Termínu, nenavrhuje se; doplnit Termín):')
        for c in n['ceka']:
            print('  %-6s %s' % ('#' + str(c['n']), c['titulek'][:70]))

    chyby, varovani = n['kontrola_boardu']['chyby'], n['kontrola_boardu']['varovani']
    print('\nKontrola boardu: %d chyb, %d varování' % (len(chyby), len(varovani)))
    for x in chyby:
        print('  CHYBA     %-7s %-12s %s' % ('#' + str(x['issue']) if x['issue'] else '-', x['pravidlo'], x['co']))
    for x in varovani:
        print('  VAROVÁNÍ  %-7s %-12s %s' % ('#' + str(x['issue']) if x['issue'] else '-', x['pravidlo'], x['co']))
    print('\nPozn.: skript nezná dočasná omezení (např. „do neděle neměnit RF testy“), ta zohlední plán.')


def navrh(minuty, json_vystup=False):
    sys.stdout.reconfigure(encoding='utf-8')
    n = sestavit_navrh(minuty)
    if json_vystup:
        print(json.dumps(n, ensure_ascii=False, indent=2))
    else:
        vypis_navrh(n)


def vlastni_test():
    """Ověří převod času, odhady v checklistu a výběr kandidátů na vymyšlených datech (bez GitHubu)."""
    sys.stdout.reconfigure(encoding='utf-8')
    selhani = 0

    def over(ok, popis):
        nonlocal selhani
        selhani += not ok
        print('%-4s %s' % ('OK' if ok else 'CHYBA', popis))

    platne = [('60', 60), ('90m', 90), ('90 min', 90), ('1h', 60), ('3 h', 180), ('1,5h', 90), ('1.5 h', 90),
              ('2:30', 150), ('cca 3h', 180), ('~45 min', 45), ('~ 45', 45), ('Cca 2 H', 120), (' 120 ', 120),
              ('1h30', 90), ('1 h 30 min', 90), ('0:45', 45), ('2 hod', 120), ('15', 15)]
    neplatne = ['', 'abc', 'h', '0', '-5', '25:99', '1:5', '3 dny', '2:30h', '1,5,5h', '0h', '999h', None, 'cca']
    for vstup, ocek in platne:
        try:
            v = prevest_cas(vstup)
        except ValueError as e:
            v = 'ValueError: ' + str(e)
        over(v == ocek, '%-14r -> %s' % (vstup, v))
    for vstup in neplatne:
        try:
            vysl, ok = 'přijato jako %s' % prevest_cas(vstup), False
        except ValueError as e:
            ok = 'Příklady platných tvarů' in str(e)
            vysl = 'odmítnuto se zprávou s příklady' if ok else 'špatná zpráva: ' + str(e)
        over(ok, '%-14r -> %s' % (vstup, vysl))

    # odhady v textu položky checklistu (horní mez rozsahu)
    odhady = [('**1. X** (1,5 h): a', 1.5, '1,5 h'), ('**1. X** (1,5 až 2 h): a', 2.0, '2 h'), ('(45 min) b', 0.75, '45 min'),
              ('**1. X** (1 až 1,5 h)', 1.5, '1,5 h'), ('(cca 2 h)', 2.0, '2 h'), ('(2 h)', 2.0, '2 h'),
              ('(30 až 45 min)', 0.75, '45 min'), ('bez odhadu', None, None), ('(testy 27, 86)', None, None)]
    for text, h, popis in odhady:
        o = odhad_v_textu(text)
        over((o is None and h is None) or (o is not None and abs(o[0] - h) < 1e-9 and o[1] == popis),
             'odhad v textu %-28r -> %s' % (text, o))

    dnes = datetime.date(2026, 10, 29)

    def iss(n, titulek, labely=('testing',), vytvoreno='2026-10-28T10:00:00Z', stav='OPEN', body=''):
        return {'number': n, 'title': titulek, 'state': stav, 'labels': [{'name': l} for l in labely],
                'createdAt': vytvoreno, 'updatedAt': vytvoreno, 'milestone': {'title': 'M'}, 'body': body}

    # --- základní výběr a pořadí
    issues = [iss(1, 'Po termínu'), iss(2, 'Defekt P2', ('bug',)), iss(3, 'Defekt P2 ověřuje se, Termín dnes', ('bug',)),
              iss(4, 'Rozpracované'), iss(5, 'Defekt P3 starý', ('bug',), '2026-10-20T10:00:00Z'),
              iss(6, 'Todo druhé'), iss(7, 'Todo první'), iss(8, 'Backlog fáze 4'), iss(9, 'Backlog fáze 3'),
              iss(10, 'Todo bez odhadu')]
    board = {1: {'status': 'Todo', 'odhad (h)': 0.5, 'termín': '2026-10-28'},
             2: {'status': 'Backlog', 'odhad (h)': 1, 'priorita': 'P2 Vysoká', 'stav defektu': 'Potvrzený'},
             3: {'status': 'Backlog', 'odhad (h)': 1, 'priorita': 'P2 Vysoká', 'stav defektu': 'Ověřuje se', 'termín': '2026-10-29'},
             4: {'status': 'In Progress', 'odhad (h)': 2},
             5: {'status': 'Backlog', 'odhad (h)': 1, 'priorita': 'P3 Střední', 'stav defektu': 'Potvrzený'},
             6: {'status': 'Todo', 'odhad (h)': 1.5}, 7: {'status': 'Todo', 'odhad (h)': 1},
             8: {'status': 'Backlog', 'odhad (h)': 1}, 9: {'status': 'Backlog', 'odhad (h)': 1},
             10: {'status': 'Todo', 'odhad (h)': None}}
    backlog = chr(10).join(['## Doporučené pořadí', '**Fáze 1 – x:**', '1. a → issue #7', '2. b → issue #6',
                            '**Fáze 3 – y:**', '3. c → issue #9', '**Fáze 4 – z:**', '4. d → issue #8'])
    d = sestavit_kandidaty(issues, board, backlog, dnes)
    poradi = [k['n'] for k in d['kandidati']]
    over(poradi == [1, 3, 2, 4, 5, 7, 6, 10, 9], 'pořadí kandidátů %s (Termín dnes a v minulosti první, i u „Ověřuje se“; pak P2, In Progress, P3, Todo, Backlog)' % poradi)
    vyb, bez, nev, zbyva = vybrat(d['kandidati'], 150)   # 2,5 h: #1 0,5, #3 1, #2 1 -> zbývá 0
    over([k['n'] for k in vyb] == [1, 3, 2] and [k['n'] for k in bez] == [10] and abs(zbyva) < 1e-9,
         'výběr na 150 min: vybráno %s, bez odhadu %s, zbývá %s h' % ([k['n'] for k in vyb], [k['n'] for k in bez], fmt_h(zbyva)))

    # --- Termín zítra a „Ověřuje se“ s budoucím Termínem, „Ověřuje se“ bez Termínu
    issues = [iss(1, 'Termín zítra'), iss(2, 'Ověřuje se, Termín za týden', ('bug',)), iss(3, 'Ověřuje se bez Termínu', ('bug',)),
              iss(4, 'Termín dnes'), iss(5, 'Termín včera'), iss(6, 'Obyčejné Todo')]
    board = {1: {'status': 'Todo', 'odhad (h)': 1, 'termín': '2026-10-30'},
             2: {'status': 'In Progress', 'odhad (h)': 1, 'termín': '2026-11-05', 'priorita': 'P2 Vysoká', 'stav defektu': 'Ověřuje se'},
             3: {'status': 'In Progress', 'odhad (h)': 1, 'priorita': 'P2 Vysoká', 'stav defektu': 'Ověřuje se'},
             4: {'status': 'Todo', 'odhad (h)': 1, 'termín': '2026-10-29'},
             5: {'status': 'Todo', 'odhad (h)': 1, 'termín': '2026-10-28'}, 6: {'status': 'Todo', 'odhad (h)': 1}}
    d = sestavit_kandidaty(issues, board, '', dnes)
    over([k['n'] for k in d['kandidati']] == [4, 5, 6], 'kandidáti s Termínem: dnes a včera ano, zítra a Ověřuje se ne: %s' % [k['n'] for k in d['kandidati']])
    over([(p['n'], p['datum'].isoformat(), p['poznamka']) for p in d['pozdeji']] == [(1, '2026-10-30', ''), (2, '2026-11-05', 'Ověřuje se')],
         'Naplánováno na později (zítra, Ověřuje se s Termínem): %s' % [(p['n'], p['datum'].isoformat()) for p in d['pozdeji']])
    over([c['n'] for c in d['ceka']] == [3], 'Čeká na data (Ověřuje se bez Termínu): %s' % [c['n'] for c in d['ceka']])

    # --- závislosti „až po #N“: otevřené blokuje, zavřené ne; z řádku BACKLOGu i z těla issue
    issues = [iss(1, 'Blokováno v BACKLOGu'), iss(2, 'Závislost zavřená'), iss(3, 'Blokováno tělem', body='Až po dokončení [#9](https://x/9).'),
              iss(4, 'Závorka v těle', body='text (až po #9) text'), iss(5, 'Bez závislosti'),
              iss(8, 'Zavřená závislost', stav='CLOSED'), iss(9, 'Otevřená závislost')]
    board = {n: {'status': 'Todo', 'odhad (h)': 1} for n in (1, 2, 3, 4, 5, 9)}
    backlog = chr(10).join(['## Doporučené pořadí', '**Fáze 1 – x:**', '1. a (~30 min, až po #9). → issue #1',
                            '2. b (až po #8) → issue #2'])
    d = sestavit_kandidaty(issues, board, backlog, dnes)
    over(sorted(b['n'] for b in d['blokovano']) == [1, 3, 4], 'blokované otevřeným #9 (řádek BACKLOGu, tělo, závorka v těle): %s' % sorted(b['n'] for b in d['blokovano']))
    over(sorted(k['n'] for k in d['kandidati']) == [2, 5, 9], 'neblokované (zavřená závislost, bez závislosti, sama závislost): %s' % sorted(k['n'] for k in d['kandidati']))
    over(all('#9' in b['duvod'] for b in d['blokovano']), 'důvod blokace uvádí #9')

    # --- krok 6: nejbližší fáze Backlogu bez navrhnutelné položky -> další fáze
    issues = [iss(20, 'Fáze 3 blokovaná'), iss(21, 'Fáze 3 naplánovaná později'), iss(22, 'Fáze 3 bez odhadu'),
              iss(23, 'Fáze 3 čeká na #29'), iss(24, 'Fáze 4 navrhnutelná'), iss(25, 'Fáze 4 druhá'),
              iss(26, 'Fáze 5 už ne'), iss(29, 'Otevřená závislost')]
    board = {20: {'status': 'Backlog', 'odhad (h)': 1}, 21: {'status': 'Backlog', 'odhad (h)': 1, 'termín': '2026-11-02'},
             22: {'status': 'Backlog', 'odhad (h)': None}, 23: {'status': 'Backlog', 'odhad (h)': 1},
             24: {'status': 'Backlog', 'odhad (h)': 2}, 25: {'status': 'Backlog', 'odhad (h)': 1},
             26: {'status': 'Backlog', 'odhad (h)': 1}, 29: {'status': 'In Progress', 'odhad (h)': 1}}
    backlog = chr(10).join(['## Doporučené pořadí', '**Fáze 3 – x:**', '1. a (až po #29) → issue #20', '2. b → issue #21',
                            '3. c → issue #22', '4. d (až po #29) → issue #23', '**Fáze 4 – y:**', '5. e → issue #24',
                            '6. f → issue #25', '**Fáze 5 – z:**', '7. g → issue #26'])
    d = sestavit_kandidaty(issues, board, backlog, dnes)
    k6 = [(k['n'], k['odhad']) for k in d['kandidati'] if k['n'] != 29]
    over(k6 == [(22, None), (24, 2.0), (25, 1.0)],
         'krok 6: fáze 3 bez navrhnutelné (blokované, později, bez Odhadu) -> pokračuje fází 4, fáze 5 už ne: %s' % k6)
    # když fáze 3 navrhnutelnou položku má, fáze 4 se nenabízí
    board[20]['odhad (h)'] = 1
    backlog = backlog.replace('1. a (až po #29) → issue #20', '1. a → issue #20')
    d = sestavit_kandidaty(issues, board, backlog, dnes)
    k6 = [k['n'] for k in d['kandidati'] if k['n'] != 29]
    over(k6 == [20, 22], 'krok 6: fáze 3 má navrhnutelnou položku (#20) -> fáze 4 se nenabízí: %s' % k6)
    # žádná fáze nemá navrhnutelnou položku -> prázdný výsledek bez chyby
    d = sestavit_kandidaty([iss(30, 'Jediná')], {30: {'status': 'Backlog', 'odhad (h)': None}}, '## Doporučené pořadí' + chr(10) + '**Fáze 3 – x:**' + chr(10) + '1. a → issue #30', dnes)
    over([k['n'] for k in d['kandidati']] == [30] and d['kandidati'][0]['odhad'] is None, 'krok 6: jen položka bez Odhadu -> nabídne se zvlášť, bez chyby')

    # --- checklist s odhady v různých tvarech
    body = chr(10).join(['Úvod', '## Dávky', '',
                         '- [x] **1. Hotová** (3 h): a',
                         '- [ ] **2. Úklid sdílené stránky** (1,5 až 2 h): suite-level teardown',
                         '- [ ] **3. Další** (45 min)'])
    issues = [iss(34, 'Sjednocení testů', body=body),
              iss(35, 'První bez odhadu', body='- [ ] bez odhadu v textu' + chr(10) + '- [ ] druhá (1 h)'),
              iss(36, 'Minuty', body='- [ ] **1. Krátká** (45 min): x'),
              iss(37, 'Rozsah s jednotkou jen na konci', body='- [ ] **1. Rozsah** (1 až 1,5 h): x'),
              iss(38, 'Bez checklistu')]
    board = {n: {'status': 'Todo', 'odhad (h)': 12} for n in (34, 35, 36, 37, 38)}
    d = sestavit_kandidaty(issues, board, '', dnes)
    k = {x['n']: x for x in d['kandidati']}
    over(k[34]['titulek'] == 'dávka 2: Úklid sdílené stránky (2 h)' and abs(k[34]['odhad'] - 2.0) < 1e-9,
         'checklist: přeskočí odškrtnuté, horní mez rozsahu: %r %s h' % (k[34]['titulek'], k[34]['odhad']))
    over(abs(k[35]['odhad'] - 12) < 1e-9 and k[35]['titulek'] == 'První bez odhadu',
         'první neodškrtnutá položka bez odhadu: nabídne se celé issue (%s h)' % k[35]['odhad'])
    over(abs(k[36]['odhad'] - 0.75) < 1e-9 and '45 min' in k[36]['titulek'], 'checklist s minutami: %r' % k[36]['titulek'])
    over(abs(k[37]['odhad'] - 1.5) < 1e-9, 'rozsah „1 až 1,5 h“: horní mez %s h' % k[37]['odhad'])
    over(abs(k[38]['odhad'] - 12) < 1e-9, 'issue bez checklistu: Odhad z boardu')

    # --- issue se štítkem prehled (automatický přehled projektu) není úkol
    p = iss(60, 'Přehled projektu (automaticky)', ('prehled',))
    d = sestavit_kandidaty([p, iss(61, 'Běžné')], {60: {'status': 'Todo', 'odhad (h)': 1, 'termín': '2026-10-29'},
                                                    61: {'status': 'Todo', 'odhad (h)': 1}}, '', dnes)
    cisla = [x['n'] for x in d['kandidati']] + [x['n'] for x in d['pozdeji'] + d['blokovano'] + d['ceka']]
    over(61 in cisla and 60 not in cisla, 'issue se štítkem prehled se nenavrhne ani v seznamech později, blokováno, čeká (%s)' % cisla)
    d = sestavit_kandidaty([p], {60: {'status': 'In Progress', 'odhad (h)': 1}}, '', dnes)
    over(not d['kandidati'], 'prehled ve stavu In Progress s termínem dnes nevytvoří kandidáta')

    print(chr(10) + ('Test prošel.' if not selhani else 'Test selhal: %d chyb.' % selhani))
    return 1 if selhani else 0


def main():
    ap = argparse.ArgumentParser(description='Návrh session z boardu podle času (jen čte).')
    ap.add_argument('--cas', help='k dispozici je tolik času, např. 60, 90m, 1,5h, 2:30, "cca 3h"')
    ap.add_argument('--test', action='store_true', help='ověří převod času, odhady a výběr a skončí')
    ap.add_argument('--json', action='store_true', help='stejný návrh jako JSON (strojově čitelný výstup)')
    args = ap.parse_args()
    if args.test:
        return vlastni_test()
    if args.cas is None:
        ap.error('chybí --cas (příklady: %s)' % PRIKLADY_CASU)
    try:
        minuty = prevest_cas(args.cas)
    except ValueError as e:
        print(str(e), file=sys.stderr)
        return 2
    navrh(minuty, args.json)
    return 0


if __name__ == '__main__':
    sys.exit(main())
