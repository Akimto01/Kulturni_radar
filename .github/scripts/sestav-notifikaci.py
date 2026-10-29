#!/usr/bin/env python3
"""Sestaví text notifikace (ntfy) pro workflow kontrola-projektu.yml z JSON výstupů skriptů
kontrola-boardu.py, kontrola-defektu.py a navrh-session.py (všechny s --json). Nic neodesílá
a nic neměnní, jen čte soubory a píše zprávu do souboru.

    python .github/scripts/sestav-notifikaci.py --rezim denni|pondeli \\
        --board board.json --defekty defekty.json --navrh navrh.json --vystup zprava.txt
    python .github/scripts/sestav-notifikaci.py --test      # simulované vstupy, oba režimy

Na standardní výstup vypíše jeden řádek JSON {odeslat, titulek, priorita, tagy, duvody}; text
zprávy je v souboru --vystup. Neplatný nebo chybějící vstupní JSON = exit 2 (workflow selže a
pošle upozornění, že kontrola selhala, např. při vypršelém tokenu).

Režimy:
  denni     notifikace jen při chybě kontroly boardu nebo defektů, defektu P1 nebo P2 po lhůtě
            nebo termínu dnes či v minulosti; jinak ticho (odeslat = false)
  pondeli   souhrn vždy: počty chyb a varování, otevřené defekty podle priority, In Progress,
            termíny na tento týden a návrh práce z navrh-session.py (vybrané, později, blokované);
            pokud by denní režim ten den hlásil důvody, jsou na začátku v sekci „Naléhavé“
            a priorita se přebírá z denního režimu (chyba nebo P1 = high)

Zpráva obsahuje jen čísla a názvy issues z veřejného repa, žádné tajné hodnoty.
"""
import argparse
import datetime
import json
import os
import re
import sys

BOARD_URL = 'https://github.com/users/Akimto01/projects/1'
MAX_BAJTU = 3500        # ntfy uřízne delší zprávu (limit 4096 B), držíme rezervu
MAX_RADKU_SEZNAMU = 8   # nejvíc tolik položek v jednom seznamu zprávy
MAX_NAZEV = 50          # nejvýš tolik znaků názvu issue ve zprávě (s „…“)
# název souboru s příponou ntfy zobrazí jako odkaz (AUDIT.md bere jako doménu), proto bez přípony
SOUBOR = re.compile(r'\b([\w-]+)\.(?:md|py|yml|js|gs|html)\b')


def nacist_json(cesta):
    try:
        with open(cesta, encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError) as e:
        raise SystemExit('Vstup %s není platný JSON (%s); skript pravděpodobně selhal, např. kvůli tokenu.' % (cesta, e))
    if not isinstance(data, dict) or 'skript' not in data:
        raise SystemExit('Vstup %s nemá očekávaný tvar (chybí klíč skript).' % cesta)
    return data


def _issue(n):
    return '#%s' % n if n else '-'


def bez_pripon(text):
    """Názvy souborů bez přípony, aby z nich ntfy nedělal odkazy."""
    return SOUBOR.sub(r'\1', text)


def nazev(titulek):
    """Název issue bez přípon souborů, nejvýš MAX_NAZEV znaků po celých slovech, s „…“ na konci."""
    t = bez_pripon(titulek)
    if len(t) <= MAX_NAZEV:
        return t
    rez = t[:MAX_NAZEV - 1]
    if t[MAX_NAZEV - 1] != ' ' and ' ' in rez:    # řez uprostřed slova: slovo zahodit
        rez = rez.rsplit(' ', 1)[0]
    return rez.rstrip(' ,;:-–') + '…'


def _datum(iso):
    d = datetime.date.fromisoformat(iso)
    return '%d. %d.' % (d.day, d.month)


def _seznam(polozky, popis):
    """Seznam řádků zprávy, zkrácený na MAX_RADKU_SEZNAMU položek."""
    radky = ['- ' + popis(p) for p in polozky[:MAX_RADKU_SEZNAMU]]
    if len(polozky) > MAX_RADKU_SEZNAMU:
        radky.append('- … a dalších %d' % (len(polozky) - MAX_RADKU_SEZNAMU))
    return radky


def duvody_denni(board, defekty, dnes):
    """Důvody k denní notifikaci (prázdný seznam = ticho) a příznak, zda je to vážné (vysoká priorita):
    chyba kontroly nebo defekt P1 po lhůtě."""
    duvody = []
    if board['chyby']:
        duvody.append('Kontrola boardu hlásí %d chyb:' % len(board['chyby']))
        duvody += _seznam(board['chyby'], lambda x: '%s %s: %s' % (_issue(x['issue']), x['pravidlo'], x['co']))
    if defekty['chyby']:
        duvody.append('Kontrola defektů hlásí %d nálezů:' % len(defekty['chyby']))
        duvody += _seznam(defekty['chyby'], lambda x: '%s %s: %s' % (_issue(x['issue']), x['pravidlo'], x['co']))
    po_lhute = [v for v in board['varovani'] if v['pravidlo'] == 'po lhůtě' and re.match(r'defekt P[12]\b', v['co'])]
    vazne = bool(board['chyby'] or defekty['chyby'] or any(v['co'].startswith('defekt P1') for v in po_lhute))
    if po_lhute:
        duvody.append('Defekt P1 nebo P2 po lhůtě:')
        duvody += _seznam(po_lhute, lambda x: '%s %s' % (_issue(x['issue']), x['co']))
    minule = [v for v in board['varovani'] if v['pravidlo'] == 'termín']
    dnes_iso = dnes.isoformat()
    dnesni = [t for t in board['souhrn']['terminy_tyden'] if t['datum'] == dnes_iso]
    if minule or dnesni:
        duvody.append('Termín dnes nebo v minulosti:')
        videno = set()
        for t in dnesni:
            videno.add(t['issue'])
            duvody.append('- #%d %s (dnes)' % (t['issue'], nazev(t['titulek'])))
        for v in minule:
            if v['issue'] not in videno:
                duvody.append('- %s %s' % (_issue(v['issue']), v['co']))
    return duvody, vazne


def zprava_pondeli(board, defekty, navrh, dnes):
    """Text týdenního souhrnu (pondělí)."""
    r = ['Týdenní souhrn projektu, %s' % dnes.strftime('%d. %m. %Y'), '']
    r.append('Kontrola boardu: %d chyb, %d varování. Kontrola defektů: %d nálezů.' % (
        len(board['chyby']), len(board['varovani']), len(defekty['chyby'])))
    for x in board['chyby'] + board['varovani']:
        r.append('- %s %s: %s' % (_issue(x['issue']), x['pravidlo'], x['co']))
        if len(r) > 30:
            break
    for x in defekty['chyby']:
        r.append('- %s %s: %s' % (_issue(x['issue']), x['pravidlo'], x['co']))
    p = defekty['souhrn']['otevrene_podle_priority']
    r += ['', 'Otevřené defekty: ' + ', '.join('%s %d' % (k, p[k]) for k in ('P1', 'P2', 'P3', 'P4', 'P5')) +
          (', bez priority %d' % p['bez'] if p.get('bez') else '')]
    # každé issue jednou: In Progress má přednost, pak Termíny, v Později už jen zbytek
    ip = board['souhrn']['in_progress']
    videno = set(x['issue'] for x in ip)
    r += ['', 'In Progress (%d):' % len(ip)] + (_seznam(ip, lambda x: '#%d %s' % (x['issue'], nazev(x['titulek']))) or ['- nic'])
    t = [x for x in board['souhrn']['terminy_tyden'] if x['issue'] not in videno]
    videno |= set(x['issue'] for x in t)
    r += ['', 'Termíny do 7 dní (%d):' % len(t)] + (_seznam(t, lambda x: '%s #%d %s' % (_datum(x['datum']), x['issue'], nazev(x['titulek']))) or ['- žádné'])
    r += ['', 'Návrh práce na %s h:' % ('%g' % (navrh['cas_minut'] / 60.0)).replace('.', ',')]
    if navrh['vybrane']:
        r += _seznam(navrh['vybrane'], lambda x: '#%d %s (%s h)' % (x['n'], nazev(x['titulek']), ('%g' % round(x['odhad'], 2)).replace('.', ',')))
        r.append('Součet %s h, zbývá %s h.' % (('%g' % round(navrh['soucet_h'], 2)).replace('.', ','), ('%g' % round(navrh['zbyva_h'], 2)).replace('.', ',')))
    else:
        r.append('- dnes není co rozumně navrhnout')
    pozdeji = [x for x in navrh['pozdeji'] if x['n'] not in videno]
    if pozdeji:
        r.append('Později (%d): ' % len(pozdeji) + ', '.join('#%d %s' % (x['n'], _datum(x['datum'])) for x in pozdeji[:MAX_RADKU_SEZNAMU]) +
                 (', … a dalších %d' % (len(pozdeji) - MAX_RADKU_SEZNAMU) if len(pozdeji) > MAX_RADKU_SEZNAMU else ''))
    if navrh['blokovano']:
        r.append('Blokováno (%d): ' % len(navrh['blokovano']) + ', '.join('#%d (%s)' % (x['n'], x['duvod'].replace(' (otevřené)', '')) for x in navrh['blokovano'][:MAX_RADKU_SEZNAMU]))
    if navrh['ceka']:
        r.append('Čeká na data bez Termínu: ' + ', '.join('#%d' % x['n'] for x in navrh['ceka']))
    r += ['', 'Board: ' + BOARD_URL]
    return r


def zkratit(text):
    """Zkrátí zprávu na MAX_BAJTU (UTF-8) po celých řádcích."""
    if len(text.encode('utf-8')) <= MAX_BAJTU:
        return text
    radky, velikost = [], 0
    for radek in text.split(chr(10)):
        b = len((radek + chr(10)).encode('utf-8'))
        if velikost + b > MAX_BAJTU - 60:
            break
        radky.append(radek)
        velikost += b
    radky.append('… zkráceno; úplný výstup je v logu běhu workflow.')
    return chr(10).join(radky)


def sestavit(rezim, board, defekty, navrh, dnes):
    """Vrací (meta, text). meta: odeslat, titulek (ASCII, jde do HTTP hlavičky), priorita, tagy, duvody."""
    if rezim == 'denni':
        duvody, vazne = duvody_denni(board, defekty, dnes)
        if not duvody:
            return {'odeslat': False, 'titulek': '', 'priorita': 'default', 'tagy': '', 'duvody': []}, ''
        text = ['Denní kontrola projektu, %s' % dnes.strftime('%d. %m. %Y'), ''] + duvody + ['', 'Board: ' + BOARD_URL]
        meta = {'odeslat': True, 'titulek': 'Kulturni radar: kontrola projektu hlasi nalez',
                'priorita': 'high' if vazne else 'default', 'tagy': 'warning', 'duvody': [d for d in duvody if not d.startswith('- ')]}
        return meta, zkratit(bez_pripon(chr(10).join(text)))
    text = zprava_pondeli(board, defekty, navrh, dnes)
    duvody, vazne = duvody_denni(board, defekty, dnes)
    if duvody:
        # důvody, které by ten den hlásil denní režim, jdou na začátek souhrnu
        text = text[:2] + ['Naléhavé:'] + duvody + [''] + text[2:]
    meta = {'odeslat': True, 'titulek': 'Kulturni radar: tydenni souhrn projektu',
            'priorita': 'high' if vazne else 'default', 'tagy': 'calendar,warning' if duvody else 'calendar',
            'duvody': [d for d in duvody if not d.startswith('- ')]}
    return meta, zkratit(bez_pripon(chr(10).join(text)))


def main():
    ap = argparse.ArgumentParser(description='Sestaví text notifikace z JSON výstupů kontrol.')
    ap.add_argument('--rezim', choices=['denni', 'pondeli'])
    ap.add_argument('--board')
    ap.add_argument('--defekty')
    ap.add_argument('--navrh')
    ap.add_argument('--vystup', help='soubor pro text zprávy')
    ap.add_argument('--dnes', help='datum RRRR-MM-DD (výchozí dnešek v UTC)')
    ap.add_argument('--test', action='store_true')
    args = ap.parse_args()
    if args.test:
        return vlastni_test()
    if not (args.rezim and args.board and args.defekty and args.navrh and args.vystup):
        ap.error('chybí --rezim, --board, --defekty, --navrh nebo --vystup')
    sys.stdout.reconfigure(encoding='utf-8')
    dnes = datetime.date.fromisoformat(args.dnes) if args.dnes else datetime.datetime.now(datetime.timezone.utc).date()
    meta, text = sestavit(args.rezim, nacist_json(args.board), nacist_json(args.defekty), nacist_json(args.navrh), dnes)
    with open(args.vystup, 'w', encoding='utf-8') as f:
        f.write(text)
    print(json.dumps(meta, ensure_ascii=False))
    return 0


def vlastni_test():
    """Simulované JSON vstupy pro oba režimy, bez odeslání."""
    sys.stdout.reconfigure(encoding='utf-8')
    selhani = 0

    def over(ok, popis):
        nonlocal selhani
        selhani += not ok
        print('%-4s %s' % ('OK' if ok else 'CHYBA', popis))

    dnes = datetime.date(2026, 11, 2)
    iso = dnes.isoformat()

    def board(chyby=(), varovani=(), terminy=(), in_progress=()):
        return {'skript': 'kontrola-boardu', 'chyby': list(chyby), 'varovani': list(varovani),
                'souhrn': {'in_progress': list(in_progress), 'terminy_tyden': list(terminy)}}

    def defekty(chyby=(), p2=2):
        return {'skript': 'kontrola-defektu', 'chyby': list(chyby),
                'souhrn': {'otevrene_podle_priority': {'P1': 0, 'P2': p2, 'P3': 2, 'P4': 1, 'P5': 0, 'bez': 0}}}

    def navrh(vybrane=(), pozdeji=(), blokovano=(), ceka=()):
        return {'skript': 'navrh-session', 'cas_minut': 180, 'vybrane': list(vybrane), 'soucet_h': sum(v['odhad'] for v in vybrane),
                'zbyva_h': 3 - sum(v['odhad'] for v in vybrane), 'pozdeji': list(pozdeji), 'blokovano': list(blokovano), 'ceka': list(ceka)}

    chyba = {'issue': 18, 'pravidlo': 'odhad', 'co': 'In Progress bez Odhadu (h)'}
    nic = navrh()

    # denní režim: ticho
    meta, text = sestavit('denni', board(), defekty(), nic, dnes)
    over(meta['odeslat'] is False and text == '', 'denní: bez nálezů je ticho')
    p3 = {'issue': 50, 'pravidlo': 'po lhůtě', 'co': 'defekt P3: lhůta 14 d, otevřený 20 d'}
    meta, _ = sestavit('denni', board(varovani=[p3, {'issue': 8, 'pravidlo': 'WIP limit', 'co': '4 issues In Progress'}]), defekty(), nic, dnes)
    over(meta['odeslat'] is False, 'denní: P3 po lhůtě a jiná varování samy neruší ticho')
    meta, _ = sestavit('denni', board(terminy=[{'issue': 7, 'titulek': 'X', 'datum': '2026-11-03'}]), defekty(), nic, dnes)
    over(meta['odeslat'] is False, 'denní: termín zítra neruší ticho')
    # denní režim: spouštěče
    meta, text = sestavit('denni', board(chyby=[chyba]), defekty(), nic, dnes)
    over(meta['odeslat'] and meta['priorita'] == 'high' and '#18 odhad: In Progress bez Odhadu (h)' in text, 'denní: chyba kontroly boardu odešle s vysokou prioritou')
    meta, text = sestavit('denni', board(), defekty([{'issue': 4, 'pravidlo': 'a) board', 'co': 'prázdné pole Priorita'}]), nic, dnes)
    over(meta['odeslat'] and '#4 a) board' in text, 'denní: nález kontroly defektů odešle')
    p2 = {'issue': 49, 'pravidlo': 'po lhůtě', 'co': 'defekt P2: lhůta 3 d, otevřený 5 d'}
    meta, text = sestavit('denni', board(varovani=[p2]), defekty(), nic, dnes)
    over(meta['odeslat'] and '#49 defekt P2: lhůta 3 d' in text and meta['priorita'] == 'default', 'denní: defekt P2 po lhůtě odešle s běžnou prioritou')
    p1 = {'issue': 51, 'pravidlo': 'po lhůtě', 'co': 'defekt P1: lhůta 1 d, otevřený 2 d'}
    meta, text = sestavit('denni', board(varovani=[p1]), defekty(), nic, dnes)
    over(meta['odeslat'] and meta['priorita'] == 'high' and '#51 defekt P1' in text, 'denní: defekt P1 po lhůtě odešle s vysokou prioritou')
    meta, text = sestavit('denni', board(terminy=[{'issue': 6, 'titulek': 'Ověřit v3.44', 'datum': iso}]), defekty(), nic, dnes)
    over(meta['odeslat'] and '#6 Ověřit v3.44 (dnes)' in text, 'denní: termín dnes odešle')
    meta, text = sestavit('denni', board(varovani=[{'issue': 12, 'pravidlo': 'termín', 'co': 'Termín 2026-10-01 je v minulosti'}]), defekty(), nic, dnes)
    over(meta['odeslat'] and '#12 Termín 2026-10-01 je v minulosti' in text, 'denní: termín v minulosti odešle')
    over(all(ord(c) < 128 for c in meta['titulek']), 'denní: titulek je ASCII (jde do HTTP hlavičky)')

    # kontrakt s ostrým formátem varování z kontrola-boardu.py (zpráva „po lhůtě“ musí začínat „defekt P1/P2“)
    import importlib.util
    spec = importlib.util.spec_from_file_location('kb', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kontrola-boardu.py'))
    kb = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(kb)
    iss = [{'number': 1, 'state': 'OPEN', 'title': 't', 'body': '', 'milestone': {'title': 'M'}, 'labels': [{'name': 'bug'}],
            'updatedAt': '2026-10-01T10:00:00Z', 'createdAt': '2026-10-01T10:00:00Z'}]
    brd = {1: {'status': 'Backlog', 'odhad (h)': 1, 'priorita': 'P2 Vysoká', 'stav defektu': 'Potvrzený'}}
    _, var = kb.zkontrolovat(iss, brd, '', dnes)
    over(var and re.match(r'defekt P[12]\b', var[0][2]) is not None, 'kontrakt: skutečná zpráva „po lhůtě“ je rozpoznatelná: %r' % (var[0][2] if var else None))

    # pondělní režim: vždy
    meta, text = sestavit('pondeli', board(), defekty(), nic, dnes)
    over(meta['odeslat'] and 'Týdenní souhrn projektu, 02. 11. 2026' in text and 'Board: ' + BOARD_URL in text, 'pondělí: bez nálezů se souhrn přesto odešle')
    over('Návrh práce na 3 h:' in text and 'dnes není co rozumně navrhnout' in text, 'pondělí: prázdný návrh to řekne')
    meta, text = sestavit('pondeli',
        board(chyby=[chyba], varovani=[p2], terminy=[{'issue': 7, 'titulek': 'Ověřovačka', 'datum': '2026-11-04'}],
              in_progress=[{'issue': 18, 'titulek': 'v3.44 počasí'}]),
        defekty(), navrh(vybrane=[{'n': 13, 'titulek': 'Stryker', 'odhad': 2.0}], pozdeji=[{'n': 9, 'titulek': 'x', 'datum': '2026-11-09'}],
                         blokovano=[{'n': 35, 'titulek': 'y', 'duvod': 'až po #48 (otevřené)'}], ceka=[{'n': 18, 'titulek': 'z'}]), dnes)
    over('Kontrola boardu: 1 chyb, 1 varování. Kontrola defektů: 0 nálezů.' in text, 'pondělí: počty chyb a varování')
    over('Otevřené defekty: P1 0, P2 2, P3 2, P4 1, P5 0' in text, 'pondělí: otevřené defekty podle priority')
    over('In Progress (1):' in text and '- #18 v3.44 počasí' in text, 'pondělí: In Progress')
    over('Termíny do 7 dní (1):' in text and '- 4. 11. #7 Ověřovačka' in text, 'pondělí: termíny na tento týden')
    over('- #13 Stryker (2 h)' in text and 'Součet 2 h, zbývá 1 h.' in text, 'pondělí: vybrané z návrhu')
    over('Později (1): #9 9. 11.' in text and 'Blokováno (1): #35 (až po #48)' in text and 'Čeká na data bez Termínu: #18' in text, 'pondělí: později, blokované a čeká na data')
    over(meta['titulek'].isascii() and meta['tagy'].startswith('calendar'), 'pondělí: ASCII titulek a značka')
    over('Naléhavé:' in text and text.index('Naléhavé:') < text.index('Kontrola boardu:') and meta['priorita'] == 'high',
         'pondělí: chyba kontroly dá sekci Naléhavé na začátek a vysokou prioritu')
    meta, text = sestavit('pondeli', board(), defekty(), nic, dnes)
    over('Naléhavé' not in text and meta['priorita'] == 'default' and meta['tagy'] == 'calendar', 'pondělí: bez důvodů žádná sekce Naléhavé a běžná priorita')
    meta, text = sestavit('pondeli', board(varovani=[p2]), defekty(), nic, dnes)
    over('Naléhavé:' in text and '#49 defekt P2' in text and meta['priorita'] == 'default', 'pondělí: P2 po lhůtě je Naléhavé, priorita zůstává běžná')
    meta, text = sestavit('pondeli', board(varovani=[p1]), defekty(), nic, dnes)
    over('Naléhavé:' in text and meta['priorita'] == 'high', 'pondělí: P1 po lhůtě dá vysokou prioritu')
    meta, text = sestavit('pondeli', board(terminy=[{'issue': 6, 'titulek': 'Ověřit v3.44', 'datum': iso}]), defekty(), nic, dnes)
    over('Naléhavé:' in text and '#6 Ověřit v3.44 (dnes)' in text, 'pondělí: termín dnes je Naléhavé')
    meta, text = sestavit('pondeli', board(), defekty([{'issue': 4, 'pravidlo': 'a) board', 'co': 'x'}]), nic, dnes)
    over('Naléhavé:' in text and meta['priorita'] == 'high', 'pondělí: nález kontroly defektů je Naléhavé s vysokou prioritou')

    # pondělí: každé issue jednou (In Progress > Termíny > Později), Naléhavé smí opakovat
    ip = [{'issue': 18, 'titulek': 'v3.44 počasí'}]
    ter = [{'issue': 18, 'titulek': 'v3.44 počasí', 'datum': '2026-11-02'}, {'issue': 7, 'titulek': 'Ověřovačka', 'datum': '2026-11-04'}]
    poz = [{'n': 18, 'titulek': 'a', 'datum': '2026-11-02'}, {'n': 7, 'titulek': 'b', 'datum': '2026-11-04'}, {'n': 8, 'titulek': 'c', 'datum': '2026-11-09'}]
    meta, text = sestavit('pondeli', board(terminy=ter, in_progress=ip), defekty(), navrh(pozdeji=poz), dnes)
    souhrn = text.split('Kontrola boardu:', 1)[1]
    naleh = text.split('Kontrola boardu:', 1)[0]
    over('- #18 v3.44 počasí (dnes)' in naleh, 'duplicity: Naléhavé issue zopakuje')
    over(souhrn.count('#18') == 1, 'duplicity: #18 je v souhrnu jen v In Progress (%d×)' % souhrn.count('#18'))
    over('Termíny do 7 dní (1):' in souhrn and '- 4. 11. #7 Ověřovačka' in souhrn, 'duplicity: Termíny bez issues z In Progress, počet sedí')
    over('Později (1): #8 9. 11.' in souhrn and souhrn.count('#7') == 1, 'duplicity: Později bez issues z In Progress a Termínů, počet sedí')
    meta, text = sestavit('pondeli', board(terminy=ter, in_progress=ip), defekty(), navrh(pozdeji=poz[:2]), dnes)
    over('Později' not in text, 'duplicity: prázdný řádek Později se vynechá celý')
    meta, text = sestavit('pondeli', board(terminy=ter[:1], in_progress=ip), defekty(), nic, dnes)
    over('Termíny do 7 dní (0):\n- žádné' in text, 'duplicity: všechny termíny v In Progress dají prázdné Termíny')

    # zkracování názvů
    over(nazev('Krátký název') == 'Krátký název', 'název: krátký beze změny')
    n50 = 'a' * 10 + (' ' + 'b' * 9) * 4                      # přesně 50 znaků
    over(len(n50) == 50 and nazev(n50) == n50, 'název: přesně 50 znaků beze změny')
    dlouhy = 'Tichá selhání: samotest nehlídá triggery sendUserNotifications a zpracovatSledovanaMesta'
    z = nazev(dlouhy)
    over(len(z) <= 50 and z.endswith('…') and dlouhy.startswith(z[:-1]), 'název: dlouhý se zkrátí na ≤ 50 s „…“ (%r)' % z)
    over(nazev('x' * 45 + ' ' + 'yyyyyyyyy') == 'x' * 45 + '…', 'název: řez ve slově zahodí celé slovo')
    over(nazev('x' * 48 + ' ' + 'yyyy') == 'x' * 48 + '…', 'název: slovo končící těsně před hranicí zůstane celé')
    over(nazev('z' * 70) == 'z' * 49 + '…', 'název: jediné dlouhé slovo se řízne natvrdo')
    over(nazev('a, ' + 'b' * 60).startswith('a…') or nazev('a, ' + 'b' * 60) == 'a, ' + 'b' * 46 + '…', 'název: čárka před „…“ se nenechá visět')
    meta, text = sestavit('pondeli', board(in_progress=[{'issue': 123, 'titulek': dlouhy}], terminy=[{'issue': 124, 'titulek': dlouhy, 'datum': '2026-11-04'}]),
                          defekty(), navrh(vybrane=[{'n': 125, 'titulek': dlouhy, 'odhad': 1.5}]), dnes)
    over('- #123 ' + z in text and '- 4. 11. #124 ' + z in text and '- #125 ' + z + ' (1,5 h)' in text, 'název: zkrácený v In Progress, Termínech i návrhu; číslo, datum a odhad zůstanou')
    meta, text = sestavit('denni', board(terminy=[{'issue': 6, 'titulek': dlouhy, 'datum': iso}]), defekty(), nic, dnes)
    over('- #6 ' + z + ' (dnes)' in text, 'název: zkrácený i v Naléhavé (denní režim)')

    # soubory bez přípony, odkaz na board zůstane
    meta, text = sestavit('pondeli', board(in_progress=[{'issue': 34, 'titulek': 'Sjednocení (AUDIT-SOULADU-TESTU.md, kontrola.py, ci.yml)'}]), defekty(), nic, dnes)
    over(not re.search(r'[\w-]+\.(md|py|yml|js|gs|html)\b', text) and '(AUDIT-SOULADU-TESTU, kontrola, ci)' in text, 'soubory: přípony pryč, název zůstane')
    over(text.rstrip().endswith('Board: ' + BOARD_URL), 'soubory: odkaz na board zůstane')
    meta, text = sestavit('denni', board(chyby=[{'issue': 5, 'pravidlo': 'DEFEKTY.md', 'co': 'chybí v BACKLOG.md, app.js, kod.gs, Index.html'}]), defekty(), nic, dnes)
    over('DEFEKTY' in text and 'BACKLOG, app, kod, Index' in text and not re.search(r'\.(md|js|gs|html)', text) and 'Board: ' + BOARD_URL in text, 'soubory: i v denním režimu a v textu nálezů')
    # délka a bezpečnost
    mnoho = [{'issue': i, 'pravidlo': 'štítek', 'co': 'žádný z bug, docs, feature, research, testing ' * 3} for i in range(1, 80)]
    meta, text = sestavit('denni', board(chyby=mnoho), defekty(), nic, dnes)
    over(len(text.encode('utf-8')) <= MAX_BAJTU and '… a dalších' in text, 'dlouhý seznam se zkrátí (%d B)' % len(text.encode('utf-8')))
    over(not re.search(r'ghp_|github_pat_|radar-[0-9a-f]{16}|ntfy\.sh/', text), 'text neobsahuje tokeny ani ntfy téma')
    # neplatný vstup
    try:
        import tempfile
        with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
            f.write('')
        nacist_json(f.name)
        over(False, 'prázdný JSON by měl skončit chybou')
    except SystemExit as e:
        over('není platný JSON' in str(e), 'prázdný vstup (skript selhal) končí srozumitelnou chybou')
    finally:
        os.unlink(f.name)
    print(chr(10) + ('Test prošel.' if not selhani else 'Test selhal: %d chyb.' % selhani))
    return 1 if selhani else 0


if __name__ == '__main__':
    sys.exit(main())
