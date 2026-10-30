#!/usr/bin/env python3
"""Sestaví text notifikace (ntfy) pro workflow kontrola-projektu.yml z JSON výstupů skriptů
kontrola-boardu.py, kontrola-defektu.py a navrh-session.py (všechny s --json). Nic neodesílá
a nic neměnní, jen čte soubory a píše zprávu do souboru.

    python .github/scripts/sestav-notifikaci.py --rezim denni|pondeli \\
        --board board.json --defekty defekty.json --navrh navrh.json --vystup zprava.txt [--prehled prehled.md]
    python .github/scripts/sestav-notifikaci.py --test      # simulované vstupy, oba režimy

Na standardní výstup vypíše jeden řádek JSON {odeslat, titulek, priorita, tagy, duvody}; text
zprávy je v souboru --vystup, v pondělním režimu navíc plný přehled v Markdownu v souboru --prehled
(pro GITHUB_STEP_SUMMARY). Neplatný nebo chybějící vstupní JSON = exit 2 (workflow selže a
pošle upozornění, že kontrola selhala, např. při vypršelém tokenu).

Režimy:
  denni     notifikace jen při chybě kontroly boardu nebo defektů, defektu P1 nebo P2 po lhůtě
            nebo termínu dnes či v minulosti; jinak ticho (odeslat = false)
  pondeli   souhrn vždy, ve dvou podobách: krátká srozumitelná notifikace na jednu obrazovku
            telefonu, bez kódů (stav kontrol, rozpracováno, otevřené chyby slovy podle priority,
            termíny tento týden, „Na řadě“) a plný přehled v Markdownu (počty chyb a varování,
            defekty, milníky (Cíl N: hotovo z celkem, In Progress, odhad zbývající práce; v krátké
            notifikaci nejsou, ta má 6 řádků obsazeno), In Progress, termíny na tento týden, návrh
            práce z navrh-session.py) s odkazy
            na issues, který workflow zapíše do issue „Přehled projektu (automaticky)“; pokud by
            denní režim ten den hlásil důvody, jsou na začátku obou v sekci „Naléhavé“ (v notifikaci
            celá) a priorita se přebírá z denního režimu (chyba nebo P1 = high)

Zpráva obsahuje jen čísla a názvy issues z veřejného repa, žádné tajné hodnoty.
"""
import argparse
import datetime
import json
import os
import re
import sys

BOARD_URL = 'https://github.com/users/Akimto01/projects/1'
ISSUES_URL = 'https://github.com/Akimto01/Kulturni_radar/issues/'
MAX_BAJTU = 3500        # ntfy uřízne delší zprávu (limit 4096 B), držíme rezervu
MAX_RADKU_SEZNAMU = 8   # nejvíc tolik položek v jednom seznamu zprávy
# titulky notifikací vývoje (ASCII, jdou do HTTP hlavičky), ať se nepletou s přehledy akcí z appky
TITULEK_DENNI = 'Kulturni radar - vyvoj: kontrola hlasi nalez'
TITULEK_PONDELI = 'Kulturni radar - vyvoj: stav projektu'
MAX_NAZEV = 50          # nejvýš tolik znaků názvu issue ve zprávě (s „…“)
MAX_KRATKY_NAZEV = 30   # totéž v krátké pondělní notifikaci
DNY = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle']
# slovní priority otevřených chyb: (1, 2 až 4, 5 a víc), „chyba“ je ženského rodu
PRIORITY_SLOVY = [('P1', ('kritická', 'kritické', 'kritických')), ('P2', ('vysoká', 'vysoké', 'vysokých')),
                  ('P3', ('střední', 'střední', 'středních')), ('P4', ('nízká', 'nízké', 'nízkých')),
                  ('P5', ('ke sledování', 'ke sledování', 'ke sledování'))]
POZNAMKA_PREHLEDU = '_Automaticky přepisovaný přehled, neplánuje se. Přepisuje ho pondělní běh workflow kontrola-projektu._'
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


def nazev(titulek, limit=MAX_NAZEV):
    """Název issue bez přípon souborů, nejvýš `limit` znaků po celých slovech, s „…“ na konci."""
    t = bez_pripon(titulek)
    if len(t) <= limit:
        return t
    rez = t[:limit - 1]
    if t[limit - 1] != ' ' and ' ' in rez:    # řez uprostřed slova: slovo zahodit
        rez = rez.rsplit(' ', 1)[0]
    return rez.rstrip(' ,;:-–') + '…'


def kratky_nazev(titulek):
    """Krátký název pro notifikaci: bez předpony „Defekt: “ a verze na začátku („v3.44: “), pak
    nejvýš MAX_KRATKY_NAZEV znaků po celých slovech."""
    t = titulek
    while True:
        novy = re.sub(r'^(?:Defekt: |v\d+(?:\.\d+)*:\s*)', '', t)
        if novy == t:
            break
        t = novy
    return nazev(t or titulek, MAX_KRATKY_NAZEV)


def _cesky(n, jedna, dve_ctyri, pet):
    """Tvar slova podle počtu: 1 termín, 2 termíny, 5 termínů."""
    return jedna if n == 1 else dve_ctyri if 2 <= n <= 4 else pet


def otevrene_chyby(defekty):
    """Otevřené defekty slovy podle priority, nuly vynechané: „2 vysoké, 2 střední, 1 nízká“."""
    p = defekty['souhrn']['otevrene_podle_priority']
    casti = ['%d %s' % (p[k], _cesky(p[k], *tvary)) for k, tvary in PRIORITY_SLOVY if p.get(k)]
    if p.get('bez'):
        casti.append('%d bez priority' % p['bez'])
    return ', '.join(casti) or 'žádné'


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


def radky_milniku(board):
    """Řádky sekce „Milníky“ pro plný přehled: pro každý otevřený milník kolik issues je hotovo,
    kolik In Progress a odhad zbývající práce (součet Odhadu (h) otevřených). Starší JSON bez klíče
    `milniky` dá prázdný seznam (sekce se vynechá). Do krátké notifikace se nedává: ta má všech
    6 řádků obsazených."""
    radky = []
    for m in board['souhrn'].get('milniky', []):
        jmeno = re.match(r'Cíl \d+', m['nazev'])
        jmeno = jmeno.group(0) if jmeno else m['nazev']
        if not m['celkem']:
            radky.append('- %s: zatím žádné issues' % jmeno)
            continue
        text = '- %s: %d z %d issues hotovo, %d In Progress' % (jmeno, m['hotovo'], m['celkem'], m['in_progress'])
        if m['hotovo'] < m['celkem']:
            text += ', zbývá odhadem %s h' % _hodiny(m['odhad_h'])
            if m['bez_odhadu']:
                text += ' (u %d bez Odhadu)' % m['bez_odhadu']
        radky.append(text)
    return radky


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
    r += ['', 'Otevřené chyby: ' + otevrene_chyby(defekty)]
    radky_m = radky_milniku(board)
    if radky_m:
        r += ['', 'Milníky:'] + radky_m
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


def _hodiny(h):
    return ('%g' % round(h, 2)).replace('.', ',')


def kratka_pondeli(board, defekty, navrh, duvody):
    """Krátká pondělní notifikace na jednu obrazovku, srozumitelně a bez kódů: Naléhavé (celé, nahoře,
    pokud je) a pak 6 řádků: stav kontrol, rozpracováno, otevřené chyby, termíny tento týden, Na řadě,
    výzva k otevření přehledu."""
    chyb = len(board['chyby']) + len(defekty['chyby'])
    var = len(board['varovani'])
    if chyb or var:
        casti = (['%d %s' % (chyb, _cesky(chyb, 'chyba', 'chyby', 'chyb'))] if chyb else []) + (['%d varování' % var] if var else [])
        r = ['Kontroly: ' + ' a '.join(casti) + '.']
    else:
        r = ['Kontroly v pořádku, bez nálezů.']
    ip = board['souhrn']['in_progress']
    r.append('Rozpracováno: ' + ('; '.join('#%d %s' % (x['issue'], kratky_nazev(x['titulek'])) for x in ip) or 'nic'))
    r.append('Otevřené chyby: ' + otevrene_chyby(defekty))
    videno = set(x['issue'] for x in ip)
    t = [x for x in board['souhrn']['terminy_tyden'] if x['issue'] not in videno]
    if t:
        n = min(t, key=lambda x: (x['datum'], x['issue']))
        den = DNY[datetime.date.fromisoformat(n['datum']).weekday()]
        r.append('Tento týden %d %s, první %s %s (#%d %s)' % (len(t), _cesky(len(t), 'termín', 'termíny', 'termínů'), den,
                                                              _datum(n['datum']), n['issue'], kratky_nazev(n['titulek'])))
    else:
        r.append('Tento týden žádné termíny')
    if navrh['vybrane']:
        v = navrh['vybrane'][0]
        r.append('Na řadě: #%d %s (%s h)' % (v['n'], kratky_nazev(v['titulek']), _hodiny(v['odhad'])))
    else:
        r.append('Na řadě: nic k navržení')
    r.append('Klepni pro celý přehled')
    if duvody:
        r = ['Naléhavé:'] + duvody + [''] + r
    return r


def _escapovat_md(text):
    return re.sub(r'([\\`*_<\[\]])', r'\\\1', text)


def na_markdown(text):
    """Plný přehled (prostý text ze zprava_pondeli) jako Markdown pro job summary: nadpisy sekcí,
    odstavce oddělené prázdným řádkem, čísla issues jako odkazy, odkaz na board."""
    nadpis = re.compile(r'^(Naléhavé|Milníky|In Progress \(\d+\)|Termíny do 7 dní \(\d+\)|Návrh práce na [\d,]+ h):$')
    vystup, predchozi = [], None      # predchozi: druh posledního řádku (nadpis, polozka, odstavec)
    for i, radek in enumerate(text.split(chr(10))):
        if not radek:
            continue
        if radek.startswith('Board: '):
            druh, md = 'odstavec', '[Board](%s)' % radek[len('Board: '):]
        else:
            m = nadpis.match(radek)
            e = re.sub(r'#(\d+)', lambda x: '[#%s](%s%s)' % (x.group(1), ISSUES_URL, x.group(1)), _escapovat_md(radek))
            if i == 0:
                druh, md = 'nadpis', '## ' + e
            elif m:
                druh, md = 'nadpis', '### ' + e[:-1]
            elif radek.startswith('- '):
                # „- 1. 11. #7 …“ by se vykreslilo jako číslovaný seznam, tečku za číslem proto escapovat
                druh, md = 'polozka', re.sub(r'^- (\d+)\.', r'- \1\\.', e)
            elif radek.endswith(':'):
                druh, md = 'odstavec', '**' + e + '**'
            else:
                druh, md = 'odstavec', e
        if predchozi and not (druh == 'polozka' and predchozi == 'polozka'):
            vystup.append('')
        vystup.append(md)
        predchozi = druh
    return chr(10).join(vystup) + chr(10)


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
        meta = {'odeslat': True, 'titulek': TITULEK_DENNI,
                'priorita': 'high' if vazne else 'default', 'tagy': 'warning', 'duvody': [d for d in duvody if not d.startswith('- ')]}
        return meta, zkratit(bez_pripon(chr(10).join(text)))
    meta, kratka, _, _ = sestavit_pondeli(board, defekty, navrh, dnes)
    return meta, kratka


def sestavit_pondeli(board, defekty, navrh, dnes):
    """Vrací (meta, krátká notifikace, plný přehled jako prostý text, plný přehled jako Markdown)."""
    text = zprava_pondeli(board, defekty, navrh, dnes)
    duvody, vazne = duvody_denni(board, defekty, dnes)
    if duvody:
        # důvody, které by ten den hlásil denní režim, jdou na začátek (v notifikaci i v přehledu)
        text = text[:2] + ['Naléhavé:'] + duvody + [''] + text[2:]
    meta = {'odeslat': True, 'titulek': TITULEK_PONDELI,
            'priorita': 'high' if vazne else 'default', 'tagy': 'calendar,warning' if duvody else 'calendar',
            'duvody': [d for d in duvody if not d.startswith('- ')]}
    plny = bez_pripon(chr(10).join(text))
    kratka = zkratit(bez_pripon(chr(10).join(kratka_pondeli(board, defekty, navrh, duvody))))
    md = na_markdown(plny).split(chr(10))
    md = chr(10).join(md[:1] + ['', POZNAMKA_PREHLEDU] + md[1:])   # za nadpisem (md[1] je prázdný řádek)
    return meta, kratka, plny, md


def main():
    ap = argparse.ArgumentParser(description='Sestaví text notifikace z JSON výstupů kontrol.')
    ap.add_argument('--rezim', choices=['denni', 'pondeli'])
    ap.add_argument('--board')
    ap.add_argument('--defekty')
    ap.add_argument('--navrh')
    ap.add_argument('--vystup', help='soubor pro text zprávy')
    ap.add_argument('--prehled', help='soubor pro plný přehled v Markdownu (jen pondělní režim)')
    ap.add_argument('--dnes', help='datum RRRR-MM-DD (výchozí dnešek v UTC)')
    ap.add_argument('--test', action='store_true')
    args = ap.parse_args()
    if args.test:
        return vlastni_test()
    if not (args.rezim and args.board and args.defekty and args.navrh and args.vystup):
        ap.error('chybí --rezim, --board, --defekty, --navrh nebo --vystup')
    sys.stdout.reconfigure(encoding='utf-8')
    dnes = datetime.date.fromisoformat(args.dnes) if args.dnes else datetime.datetime.now(datetime.timezone.utc).date()
    board, defekty, navrh = nacist_json(args.board), nacist_json(args.defekty), nacist_json(args.navrh)
    if args.rezim == 'pondeli':
        meta, text, _, prehled = sestavit_pondeli(board, defekty, navrh, dnes)
        if args.prehled:
            with open(args.prehled, 'w', encoding='utf-8') as f:
                f.write(prehled)
    else:
        meta, text = sestavit(args.rezim, board, defekty, navrh, dnes)
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

    def board(chyby=(), varovani=(), terminy=(), in_progress=(), milniky=None):
        b = {'skript': 'kontrola-boardu', 'chyby': list(chyby), 'varovani': list(varovani),
             'souhrn': {'in_progress': list(in_progress), 'terminy_tyden': list(terminy)}}
        if milniky is not None:      # bez argumentu starší tvar JSON bez klíče milniky
            b['souhrn']['milniky'] = list(milniky)
        return b

    def defekty(chyby=(), p2=2):
        return {'skript': 'kontrola-defektu', 'chyby': list(chyby),
                'souhrn': {'otevrene_podle_priority': {'P1': 0, 'P2': p2, 'P3': 2, 'P4': 1, 'P5': 0, 'bez': 0}}}

    def navrh(vybrane=(), pozdeji=(), blokovano=(), ceka=()):
        return {'skript': 'navrh-session', 'cas_minut': 180, 'vybrane': list(vybrane), 'soucet_h': sum(v['odhad'] for v in vybrane),
                'zbyva_h': 3 - sum(v['odhad'] for v in vybrane), 'pozdeji': list(pozdeji), 'blokovano': list(blokovano), 'ceka': list(ceka)}

    def plny(*args):
        """Plný přehled jako prostý text (stávající pondělní testy ověřují jeho obsah)."""
        meta, _, text, _ = sestavit_pondeli(*args)
        return meta, text

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
    meta, text = plny( board(), defekty(), nic, dnes)
    over(meta['odeslat'] and 'Týdenní souhrn projektu, 02. 11. 2026' in text and 'Board: ' + BOARD_URL in text, 'pondělí: bez nálezů se souhrn přesto odešle')
    over('Návrh práce na 3 h:' in text and 'dnes není co rozumně navrhnout' in text, 'pondělí: prázdný návrh to řekne')
    meta, text = plny(
        board(chyby=[chyba], varovani=[p2], terminy=[{'issue': 7, 'titulek': 'Ověřovačka', 'datum': '2026-11-04'}],
              in_progress=[{'issue': 18, 'titulek': 'v3.44 počasí'}]),
        defekty(), navrh(vybrane=[{'n': 13, 'titulek': 'Stryker', 'odhad': 2.0}], pozdeji=[{'n': 9, 'titulek': 'x', 'datum': '2026-11-09'}],
                         blokovano=[{'n': 35, 'titulek': 'y', 'duvod': 'až po #48 (otevřené)'}], ceka=[{'n': 18, 'titulek': 'z'}]), dnes)
    over('Kontrola boardu: 1 chyb, 1 varování. Kontrola defektů: 0 nálezů.' in text, 'pondělí: počty chyb a varování')
    over('Otevřené chyby: 2 vysoké, 2 střední, 1 nízká' in text and 'P1 0' not in text, 'pondělí: otevřené chyby slovy podle priority (jako v notifikaci)')
    over('In Progress (1):' in text and '- #18 v3.44 počasí' in text, 'pondělí: In Progress')
    over('Termíny do 7 dní (1):' in text and '- 4. 11. #7 Ověřovačka' in text, 'pondělí: termíny na tento týden')
    over('- #13 Stryker (2 h)' in text and 'Součet 2 h, zbývá 1 h.' in text, 'pondělí: vybrané z návrhu')
    over('Později (1): #9 9. 11.' in text and 'Blokováno (1): #35 (až po #48)' in text and 'Čeká na data bez Termínu: #18' in text, 'pondělí: později, blokované a čeká na data')
    over(meta['titulek'].isascii() and meta['tagy'].startswith('calendar'), 'pondělí: ASCII titulek a značka')
    over('Naléhavé:' in text and text.index('Naléhavé:') < text.index('Kontrola boardu:') and meta['priorita'] == 'high',
         'pondělí: chyba kontroly dá sekci Naléhavé na začátek a vysokou prioritu')
    meta, text = plny( board(), defekty(), nic, dnes)
    over('Naléhavé' not in text and meta['priorita'] == 'default' and meta['tagy'] == 'calendar', 'pondělí: bez důvodů žádná sekce Naléhavé a běžná priorita')
    meta, text = plny( board(varovani=[p2]), defekty(), nic, dnes)
    over('Naléhavé:' in text and '#49 defekt P2' in text and meta['priorita'] == 'default', 'pondělí: P2 po lhůtě je Naléhavé, priorita zůstává běžná')
    meta, text = plny( board(varovani=[p1]), defekty(), nic, dnes)
    over('Naléhavé:' in text and meta['priorita'] == 'high', 'pondělí: P1 po lhůtě dá vysokou prioritu')
    meta, text = plny( board(terminy=[{'issue': 6, 'titulek': 'Ověřit v3.44', 'datum': iso}]), defekty(), nic, dnes)
    over('Naléhavé:' in text and '#6 Ověřit v3.44 (dnes)' in text, 'pondělí: termín dnes je Naléhavé')
    meta, text = plny( board(), defekty([{'issue': 4, 'pravidlo': 'a) board', 'co': 'x'}]), nic, dnes)
    over('Naléhavé:' in text and meta['priorita'] == 'high', 'pondělí: nález kontroly defektů je Naléhavé s vysokou prioritou')

    # pondělí: každé issue jednou (In Progress > Termíny > Později), Naléhavé smí opakovat
    ip = [{'issue': 18, 'titulek': 'v3.44 počasí'}]
    ter = [{'issue': 18, 'titulek': 'v3.44 počasí', 'datum': '2026-11-02'}, {'issue': 7, 'titulek': 'Ověřovačka', 'datum': '2026-11-04'}]
    poz = [{'n': 18, 'titulek': 'a', 'datum': '2026-11-02'}, {'n': 7, 'titulek': 'b', 'datum': '2026-11-04'}, {'n': 8, 'titulek': 'c', 'datum': '2026-11-09'}]
    meta, text = plny( board(terminy=ter, in_progress=ip), defekty(), navrh(pozdeji=poz), dnes)
    souhrn = text.split('Kontrola boardu:', 1)[1]
    naleh = text.split('Kontrola boardu:', 1)[0]
    over('- #18 v3.44 počasí (dnes)' in naleh, 'duplicity: Naléhavé issue zopakuje')
    over(souhrn.count('#18') == 1, 'duplicity: #18 je v souhrnu jen v In Progress (%d×)' % souhrn.count('#18'))
    over('Termíny do 7 dní (1):' in souhrn and '- 4. 11. #7 Ověřovačka' in souhrn, 'duplicity: Termíny bez issues z In Progress, počet sedí')
    over('Později (1): #8 9. 11.' in souhrn and souhrn.count('#7') == 1, 'duplicity: Později bez issues z In Progress a Termínů, počet sedí')
    meta, text = plny( board(terminy=ter, in_progress=ip), defekty(), navrh(pozdeji=poz[:2]), dnes)
    over('Později' not in text, 'duplicity: prázdný řádek Později se vynechá celý')
    meta, text = plny( board(terminy=ter[:1], in_progress=ip), defekty(), nic, dnes)
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
    meta, text = plny( board(in_progress=[{'issue': 123, 'titulek': dlouhy}], terminy=[{'issue': 124, 'titulek': dlouhy, 'datum': '2026-11-04'}]),
                          defekty(), navrh(vybrane=[{'n': 125, 'titulek': dlouhy, 'odhad': 1.5}]), dnes)
    over('- #123 ' + z in text and '- 4. 11. #124 ' + z in text and '- #125 ' + z + ' (1,5 h)' in text, 'název: zkrácený v In Progress, Termínech i návrhu; číslo, datum a odhad zůstanou')
    meta, text = sestavit('denni', board(terminy=[{'issue': 6, 'titulek': dlouhy, 'datum': iso}]), defekty(), nic, dnes)
    over('- #6 ' + z + ' (dnes)' in text, 'název: zkrácený i v Naléhavé (denní režim)')

    # soubory bez přípony, odkaz na board zůstane
    meta, text = plny( board(in_progress=[{'issue': 34, 'titulek': 'Sjednocení (AUDIT-SOULADU-TESTU.md, kontrola.py, ci.yml)'}]), defekty(), nic, dnes)
    over(not re.search(r'[\w-]+\.(md|py|yml|js|gs|html)\b', text) and '(AUDIT-SOULADU-TESTU, kontrola, ci)' in text, 'soubory: přípony pryč, název zůstane')
    over(text.rstrip().endswith('Board: ' + BOARD_URL), 'soubory: odkaz na board zůstane')
    meta, text = sestavit('denni', board(chyby=[{'issue': 5, 'pravidlo': 'DEFEKTY.md', 'co': 'chybí v BACKLOG.md, app.js, kod.gs, Index.html'}]), defekty(), nic, dnes)
    over('DEFEKTY' in text and 'BACKLOG, app, kod, Index' in text and not re.search(r'\.(md|js|gs|html)', text) and 'Board: ' + BOARD_URL in text, 'soubory: i v denním režimu a v textu nálezů')

    # pondělí: krátká notifikace na jednu obrazovku a plný přehled v Markdownu
    ip1 = [{'issue': 18, 'titulek': 'v3.44: počasí CHYBA a chybějící souřadnice'},
           {'issue': 49, 'titulek': 'Defekt: Sledovaná města: běh narazí na limit 6 min'}]
    ter1 = [{'issue': 7, 'titulek': 'Ověřovačka', 'datum': '2026-11-04'}, {'issue': 6, 'titulek': 'Ověřit', 'datum': '2026-11-03'},
            {'issue': 18, 'titulek': 'v3.44: počasí CHYBA a chybějící souřadnice', 'datum': '2026-11-05'}]
    nav1 = navrh(vybrane=[{'n': 13, 'titulek': 'Stryker', 'odhad': 2.0}, {'n': 14, 'titulek': 'Další', 'odhad': 1.0}],
                 pozdeji=[{'n': 8, 'titulek': 'x', 'datum': '2026-11-09'}], blokovano=[{'n': 35, 'titulek': 'y', 'duvod': 'až po #48 (otevřené)'}],
                 ceka=[{'n': 20, 'titulek': 'z'}])
    meta, kratka, _, md = sestavit_pondeli(board(in_progress=ip1, terminy=ter1), defekty(), nav1, dnes)
    radky = kratka.split(chr(10))
    over(len(radky) <= 8 and radky[-1] == 'Klepni pro celý přehled', 'krátká: nejvýš 8 řádků a poslední je výzva (%d řádků, %d B)' % (len(radky), len(kratka.encode('utf-8'))))
    over(radky == ['Kontroly v pořádku, bez nálezů.', 'Rozpracováno: #18 počasí CHYBA a chybějící…; #49 Sledovaná města: běh narazí…',
                   'Otevřené chyby: 2 vysoké, 2 střední, 1 nízká', 'Tento týden 2 termíny, první úterý 3. 11. (#6 Ověřit)',
                   'Na řadě: #13 Stryker (2 h)', 'Klepni pro celý přehled'], 'krátká: srozumitelné řádky bez kódů (%r)' % radky)
    over(not re.search(r'P[1-5]\b', kratka) and 'Termíny do 7 dní' not in kratka, 'krátká: bez kódů priorit P1 až P5')
    over('Naléhavé' not in kratka and 'Později' not in kratka and 'Blokováno' not in kratka, 'krátká: bez Naléhavé a bez podrobných sekcí, když není důvod')
    meta, kratka, _, _ = sestavit_pondeli(board(chyby=[chyba], varovani=[p2]), defekty(), nic, dnes)
    over('Kontroly: 1 chyba a 1 varování.' in kratka, 'krátká: počty chyb a varování slovy')
    meta, kratka, _, _ = sestavit_pondeli(board(chyby=[chyba, chyba], varovani=[p2, p2]), defekty([{'issue': 4, 'pravidlo': 'a', 'co': 'x'}]), nic, dnes)
    over('Kontroly: 3 chyby a 2 varování.' in kratka, 'krátká: chyby kontroly boardu a defektů se sčítají, tvar „3 chyby“')
    meta, kratka, _, _ = sestavit_pondeli(board(chyby=[chyba] * 5), defekty(), nic, dnes)
    over('Kontroly: 5 chyb.' in kratka, 'krátká: jen chyby bez varování, tvar „5 chyb“')
    meta, kratka, _, _ = sestavit_pondeli(board(varovani=[p2]), defekty(), nic, dnes)
    over('Kontroly: 1 varování.' in kratka, 'krátká: jen varování bez chyb')
    meta, kratka, _, _ = sestavit_pondeli(board(), defekty(), nic, dnes)
    over('Rozpracováno: nic' in kratka and 'Tento týden žádné termíny' in kratka and 'Na řadě: nic k navržení' in kratka, 'krátká: prázdné sekce říkají nic, žádné, nic k navržení')
    # slovní priority: nuly se vynechají, tvary podle počtu
    def pri(**k):
        d = defekty()
        d['souhrn']['otevrene_podle_priority'] = dict({'P1': 0, 'P2': 0, 'P3': 0, 'P4': 0, 'P5': 0, 'bez': 0}, **k)
        return d
    for hodnoty, ocek in [({'P1': 1, 'P2': 5, 'bez': 3}, '1 kritická, 5 vysokých, 3 bez priority'), ({'P3': 2, 'P4': 4}, '2 střední, 4 nízké'),
                          ({'P5': 1}, '1 ke sledování'), ({'P2': 21}, '21 vysokých'), ({}, 'žádné')]:
        meta, kratka, _, _ = sestavit_pondeli(board(), pri(**hodnoty), nic, dnes)
        over('Otevřené chyby: ' + ocek + chr(10) in kratka, 'krátká: priority slovy bez nul: %s' % ocek)
    # den v týdnu a tvary „termín“
    for datum, den in [('2026-11-03', 'úterý 3. 11.'), ('2026-11-04', 'středa 4. 11.'), ('2026-11-07', 'sobota 7. 11.'), ('2026-11-08', 'neděle 8. 11.')]:
        meta, kratka, _, _ = sestavit_pondeli(board(terminy=[{'issue': 7, 'titulek': 'Ověřovačka', 'datum': datum}]), defekty(), nic, dnes)
        over('Tento týden 1 termín, první ' + den + ' (#7 Ověřovačka)' in kratka, 'krátká: den v týdnu %s' % den)
    meta, kratka, _, _ = sestavit_pondeli(board(terminy=[{'issue': i, 'titulek': 'T', 'datum': '2026-11-0%d' % (3 + i % 3)} for i in range(7, 12)]), defekty(), nic, dnes)
    over('Tento týden 5 termínů, první úterý 3. 11. (#9 T)' in kratka, 'krátká: tvar „5 termínů“, první podle data')
    # krátký název
    for vstup, ocek in [('Defekt: Tichá selhání: samotest nehlídá triggery', 'Tichá selhání: samotest…'), ('v3.44: počasí', 'počasí'),
                        ('Defekt: v3.44: x', 'x'), ('Mutační testování (Stryker)', 'Mutační testování (Stryker)'),
                        ('a' * 30, 'a' * 30), ('x' * 28 + ' yyyy', 'x' * 28 + '…'), ('x' * 29 + ' yy', 'x' * 29 + '…'),
                        ('Ověřit v3.44 v datech', 'Ověřit v3.44 v datech'), ('Defekt: ', 'Defekt: '),
                        ('Test (AUDIT-SOULADU.md)', 'Test (AUDIT-SOULADU)')]:
        over(kratky_nazev(vstup) == ocek and len(kratky_nazev(vstup)) <= MAX_KRATKY_NAZEV, 'krátký název %r -> %r' % (vstup, kratky_nazev(vstup)))
    # Naléhavé: celé a nahoře, zbytek pořád nejvýš 8 řádků
    mnoho5 = [{'issue': i, 'pravidlo': 'odhad', 'co': 'In Progress bez Odhadu (h)'} for i in range(1, 6)]
    meta, kratka, _, _ = sestavit_pondeli(board(chyby=mnoho5, terminy=[{'issue': 6, 'titulek': 'Ověřit', 'datum': iso}]), defekty(), nav1, dnes)
    duv, zbytek = kratka.split(chr(10) + chr(10), 1)
    over(kratka.startswith('Naléhavé:') and all('#%d odhad: In Progress bez Odhadu (h)' % i in duv for i in range(1, 6)) and '#6 Ověřit (dnes)' in duv,
         'krátká: Naléhavé je celé a nahoře')
    over(len(zbytek.split(chr(10))) <= 8 and meta['priorita'] == 'high', 'krátká: za Naléhavé zbývá nejvýš 8 řádků (%d)' % len(zbytek.split(chr(10))))
    # plný přehled v Markdownu
    meta, _, _, md = sestavit_pondeli(board(chyby=[chyba], terminy=ter1, in_progress=ip1), defekty(), nav1, dnes)
    over(md.startswith('## Týdenní souhrn projektu, 02. 11. 2026' + chr(10) + chr(10) + POZNAMKA_PREHLEDU + chr(10) + chr(10)), 'přehled: nadpis s datem a poznámka, že je přepisovaný automaticky')
    over('### Naléhavé' in md and '### In Progress (2)' in md and
         '### Termíny do 7 dní (2)' in md and '### Návrh práce na 3 h' in md, 'přehled: nadpisy všech sekcí')
    over('Otevřené chyby: 2 vysoké, 2 střední, 1 nízká' in md and 'Později (1)' in md and 'Blokováno (1)' in md and 'Čeká na data bez Termínu' in md and 'Kontrola boardu: 1 chyb' in md,
         'přehled: obsahuje i otevřené chyby, Později, Blokováno, Čeká a stav kontroly')
    over('[#18](' + ISSUES_URL + '18)' in md and '[#13](' + ISSUES_URL + '13)' in md and '[#35](' + ISSUES_URL + '35)' in md,
         'přehled: čísla issues jsou odkazy')
    over(md.rstrip().endswith('[Board](' + BOARD_URL + ')'), 'přehled: odkaz na board na konci')
    sekce = md.split('### In Progress', 1)[1]
    over(sekce.count('[#18]') == 1 and sekce.count('[#7]') == 1, 'přehled: bez duplicit mimo Naléhavé')
    meta, _, _, md = sestavit_pondeli(board(in_progress=[{'issue': 5, 'titulek': 'a_b *c* [d] <e>'}]), defekty(), nic, dnes)
    over('a\\_b \\*c\\* \\[d\\] \\<e>' in md, 'přehled: Markdown znaky v názvech se escapují')
    # Markdown: žádná položka seznamu nezačíná „číslo. “ (vykreslila by se jako číslovaný seznam)
    meta, _, _, md = sestavit_pondeli(board(in_progress=ip1, terminy=ter1 + [{'issue': 30, 'titulek': '10. ročník', 'datum': '2026-11-10'}]), defekty(), nav1, dnes)
    polozky = [l for l in md.split(chr(10)) if l.startswith('- ')]
    over(polozky and not any(re.match(r'- \d+\. ', l) for l in polozky), 'přehled: žádná položka seznamu nezačíná vzorem „číslo. “ (%d položek)' % len(polozky))
    over(any(l.startswith('- 3\\. 11. [#6](') for l in polozky) and any(l.startswith('- 10\\. 11. [#30](') for l in polozky), 'přehled: datum v položce má escapovanou tečku („3\\. 11.“)')
    over(any('10. ročník' in l for l in polozky), 'přehled: tečka uvnitř názvu se nemění')
    meta, _, plny_text, md = sestavit_pondeli(board(), pri(), nic, dnes)
    over('Otevřené chyby: žádné' in md and 'P1' not in md, 'přehled: bez otevřených chyb řekne „žádné“')
    # milníky v plném přehledu (v krátké notifikaci nejsou: všech 6 řádků je obsazeno)
    def mil(nazev, hotovo, celkem, ip=0, odhad=0.0, bez=0):
        return {'nazev': nazev, 'hotovo': hotovo, 'celkem': celkem, 'in_progress': ip, 'odhad_h': odhad, 'bez_odhadu': bez}
    mm = [mil('Cíl 1 – Testy a kvalita kódu jako ukázka', 22, 44, 1, 33.55), mil('Cíl 2 – Otevření přátelům (design, Android)', 5, 14, 0, 3.75, 6),
          mil('Cíl 4 – Víc měst a profilů', 0, 0), mil('Cíl 5 – Hotový', 3, 3)]
    meta, text = plny(board(milniky=mm), defekty(), nic, dnes)
    sek = text.split('Milníky:', 1)[1].split(chr(10) + chr(10), 1)[0].split(chr(10))[1:]
    over(text.index('Otevřené chyby:') < text.index('Milníky:') < text.index('In Progress ('), 'milníky: sekce je za otevřenými chybami a před In Progress')
    over(sek[0] == '- Cíl 1: 22 z 44 issues hotovo, 1 In Progress, zbývá odhadem 33,55 h', 'milníky: řádek Cíl N, hotovo z celkem, In Progress, odhad (%r)' % sek[0])
    over(sek[1] == '- Cíl 2: 5 z 14 issues hotovo, 0 In Progress, zbývá odhadem 3,75 h (u 6 bez Odhadu)', 'milníky: issues bez Odhadu se přiznají (%r)' % sek[1])
    over(sek[2] == '- Cíl 4: zatím žádné issues', 'milníky: milník bez issues řekne „zatím žádné issues“, bez dělení nulou')
    over(sek[3] == '- Cíl 5: 3 z 3 issues hotovo, 0 In Progress', 'milníky: hotový milník bez odhadu zbývající práce')
    over(len(sek) == 4 and 'Cíl 1 –' not in text, 'milníky: jeden řádek na milník, dlouhý název se nepíše')
    meta, text = plny(board(milniky=[]), defekty(), nic, dnes)
    over('Milníky' not in text, 'milníky: prázdný seznam sekci vynechá')
    meta, text = plny(board(), defekty(), nic, dnes)
    over('Milníky' not in text and 'Týdenní souhrn projektu' in text, 'milníky: starší JSON bez klíče milniky se zpracuje bez pádu a bez sekce')
    meta, kratka, _, md = sestavit_pondeli(board(in_progress=ip1, terminy=ter1, milniky=mm), defekty(), nav1, dnes)
    over(len(kratka.split(chr(10))) == 6 and 'Cíl' not in kratka and 'Milník' not in kratka, 'milníky: krátká notifikace zůstává na 6 řádcích bez milníků')
    over('### Milníky' in md and '- Cíl 1: 22 z 44 issues hotovo' in md, 'milníky: v Markdownu je nadpis sekce a řádky položek')
    over(md.index('### Milníky') < md.index('### In Progress'), 'milníky: v Markdownu před In Progress')

    # titulky notifikací vývoje
    meta, _ = sestavit('denni', board(chyby=[chyba]), defekty(), nic, dnes)
    over(meta['titulek'] == 'Kulturni radar - vyvoj: kontrola hlasi nalez' and meta['titulek'].isascii(), 'titulek denní: vývoj, ASCII')
    meta, _ = sestavit('pondeli', board(), defekty(), nic, dnes)
    over(meta['titulek'] == 'Kulturni radar - vyvoj: stav projektu' and meta['titulek'].isascii(), 'titulek pondělní: vývoj, ASCII')
    # bez tajných hodnot ve všech podobách
    meta, kratka, plny_text, md = sestavit_pondeli(board(chyby=[chyba], in_progress=ip1, terminy=ter1), defekty(), nav1, dnes)
    over(not any(re.search(r'ghp_|github_pat_|radar-[0-9a-f]{16}|ntfy\.sh/', t) for t in (kratka, plny_text, md)), 'krátká i plný přehled neobsahují tokeny ani ntfy téma')
    over(meta['titulek'].isascii(), 'pondělí: titulek zůstává ASCII')
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
