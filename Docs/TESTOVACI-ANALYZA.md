# Testovací analýza – ukázka: přihlášení profilem s PINem

Ukázka postupu od testovací báze k testovacím případům na jedné funkci
Kulturního radaru. Doplňuje `Docs/TESTY.md` (strategie) a `Docs/POKRYTI.md`
(pokrytí celé aplikace); v terminologii ISO/IEC/IEEE 29119-3 odpovídá
Test Model a Test Case Specification pro jednu oblast.

Postup:

```
testovací báze → testovací podmínky → techniky návrhu → testovací případy
              → přiřazení úrovni (unit / API / E2E / ručně) → traceabilita a mezery
```

## 1. Testovací báze

Formální specifikace v projektu neexistuje, báze je proto
rekonstruovaná z implementace (`apiPrihlaseniUzivatele_`,
`pinVypadaPlatne_`, přihlašovací obrazovka v `Index.html`) a ze záznamů
v CHANGELOGu (v3.13, v3.20, v3.21). Na klientském projektu by bází byly
požadavky nebo user story v Jiře.

**User story:** Jako člen rodiny se chci přihlásit svým profilem a PINem,
abych viděl své filtry, označení a nastavení notifikací.

**Pravidla:**

| # | Pravidlo |
|---|---|
| P1 | Přihlašovací obrazovka nabízí dlaždice profilů, načtené ze serveru |
| P2 | PIN má 4–8 znaků bez mezer uvnitř; okolní mezery se ořežou; nemusí být jen číslice (kontrola na klientu) |
| P3 | Server odmítne požadavek bez profilu nebo PINu, neexistující profil a nesprávný PIN; vrací `ok: false` s chybou |
| P4 | Úspěšné přihlášení vrátí jméno, filtry a notifikace profilu, **nikdy hash PINu** |
| P5 | PIN se ukládá jako SHA-256 hash se solí |
| P6 | PIN se posílá v těle POST požadavku, nikdy v URL |
| P7 | Appka funguje i bez přihlášení (anonymní režim); akce vyžadující profil (★) si přihlášení vyžádají |
| P8 | Odhlášení vrátí appku do anonymního režimu |
| P9 | Chyba serveru se uživateli zobrazí jako hláška, appka nespadne |

## 2. Testovací podmínky

| ID | Co ověřit | Pravidlo |
|---|---|---|
| TP1 | Nabídka profilů se zobrazí a lze vybrat | P1 |
| TP2 | Validace formátu PINu na klientu | P2 |
| TP3 | Odpověď serveru pro všechny kombinace vstupů | P3, P4 |
| TP4 | Bezpečné uložení a přenos PINu | P4, P5, P6 |
| TP5 | Přechody mezi stavy anonymní / přihlášený | P7, P8 |
| TP6 | Chování při chybě serveru | P9 |

## 3. Techniky návrhu

**Třídy ekvivalence a hraniční hodnoty (TP2)** – pravidlo P2:

| Třída | Zástupci | Očekávání |
|---|---|---|
| platná délka | 4 znaky (dolní hranice), 8 znaků (horní hranice) | platný |
| příliš krátký | 3 znaky (těsně pod hranicí) | neplatný |
| příliš dlouhý | 9 znaků (těsně nad hranicí) | neplatný |
| mezera uvnitř | `12 34` | neplatný |
| okolní mezery | `  1234  ` | platný (ořeže se) |
| nečíselný | `abc4` | platný |
| prázdný / chybí | `''`, `null` | neplatný |

Hodnoty 5–7 znaků patří do stejné třídy jako 4 a 8, samostatný test by
nepřinesl nic nového.

**Rozhodovací tabulka (TP3)** – pravidla P3 a P4:

| | R1 | R2 | R3 | R4 | R5 |
|---|---|---|---|---|---|
| Profil zadán | ne | ano | ano | ano | ano |
| PIN zadán | – | ne | ano | ano | ano |
| Profil existuje | – | – | ne | ano | ano |
| PIN správný | – | – | – | ne | ano |
| **Výsledek** | chybí profil nebo PIN | chybí profil nebo PIN | profil nenalezen | nesprávný PIN | ok + jméno, filtry, notifikace, bez hashe |

**Stavové přechody (TP5)** – pravidla P7 a P8:

```
anonymní ──(Přihlásit se)──▶ výběr profilu ──(dlaždice)──▶ zadání PINu
   ▲                            │                            │
   │                     (Pokračovat bez)              (správný PIN)
   │                            ▼                            ▼
   └──────────(Odhlásit)─────── anonymní             přihlášený
                                                     │
   anonymní ──(klik na ★)──▶ výzva k přihlášení
   zadání PINu ──(špatný PIN)──▶ chybová hláška, zůstává zadání PINu
```

**Error guessing (TP6)** – co se v praxi pokazí: server vrátí HTTP chybu
(7.–8. 10. 2026 přerušovaně 404 od Apps Scriptu), pomalá odpověď,
poškozený JSON filtrů v uloženém profilu.

## 4. Testovací případy a jejich úroveň

| ID | Podmínka / technika | Případ | Úroveň | Test v repu |
|---|---|---|---|---|
| TC01 | TP1 | Obrazovka nabízí dlaždice profilů | E2E | „Přihlašovací obrazovka nabízí dlaždice profilů k výběru“ |
| TC02 | TP2 / BVA, EP | Všechny třídy z tabulky výše | unit (FE) | `pinVypadaPlatne_ – 4–8 znaků bez mezer…` |
| TC03 | TP3 / R1, R2 | Chybí profil nebo PIN | unit (BE) | **chybí** |
| TC04 | TP3 / R3 | Neexistující profil | unit (BE) | **částečně**: `apiPrihlaseniUzivatele_ – správný PIN…` ověřuje jen `ok: false`, ne text chyby |
| TC05 | TP3 / R4 | Nesprávný PIN | unit (BE), E2E, Bruno/SoapUI | `apiPrihlaseniUzivatele_ – správný PIN…`; „Špatný PIN zobrazí chybu a nepřihlásí“; `Login - spatny PIN` |
| TC06 | TP3 / R5 + TP4 | Správný PIN vrátí data bez hashe | unit (BE), Bruno/SoapUI | `apiPrihlaseniUzivatele_ – … nikdy pinHash`; `Login - spravny PIN` |
| TC07 | TP3 | Poškozený JSON filtrů nezpůsobí pád | unit (BE) | `apiPrihlaseniUzivatele_ – rozbité JSON filtry…` |
| TC08 | TP4 | Hash je deterministický pro stejnou sůl, různá sůl → jiný hash | unit (BE) | `hashPin_ je deterministický…` |
| TC09 | TP4 | Seznam profilů neobsahuje hashe | unit (BE) | `apiSeznamUzivatelu_ vrací jen id+jméno…` |
| TC10 | TP4 | PIN v těle POST, nikdy v URL | unit (FE) | `sestavFetchPozadavek_ – POST routy…` |
| TC11 | TP5 | Anonymní režim funguje, ★ vyžádá přihlášení | E2E | „Anonymní režim: appka funguje bez přihlášení…“ |
| TC12 | TP5 | Odhlášení vrátí anonymní režim | E2E | „Odhlášení vrátí appku do anonymního režimu“ (regrese 7. 8.) |
| TC13 | TP6 | Chyba serveru zobrazí hlášku, appka nespadne | unit (FE) nebo E2E s podvrženou odpovědí | **chybí** |

Proč tyto úrovně: pravidla bez DOM (validace, rozhodovací logika serveru,
hashování, sestavení požadavku) jsou v unit testech, kde se dají
vyčerpávajícím způsobem a rychle projít všechny třídy a kombinace. E2E
ověřuje jen to, co vzniká složením: obrazovku, přechody stavů a jeden
zástupce chyby (špatný PIN). Bruno a SoapUI v `api-tests/` pokrývají
přímý kontrakt POST routy, který RF API sada nemá.

## 5. Jak vypadá scénář zapsaný pro lidi a pro RF

Scénář ve tvaru Given / When / Then (srozumitelný i pro netechnické lidi,
v Jiře nebo Xray se tak typicky zapisují akceptační kritéria):

```gherkin
Scénář: Špatný PIN zobrazí chybu a nepřihlásí
  Pokud jsem na přihlašovací obrazovce a vybral jsem profil RF Test
  Když zadám nesprávný PIN a potvrdím
  Pak se zobrazí chybová hláška
  A zůstanu na zadání PINu, nepřihlášený
```

Stejný scénář v RF odpovídá testu „Špatný PIN zobrazí chybu a nepřihlásí“
ve `frontend.robot`. Robot Framework umí i přímý zápis s prefixy
`Given` / `When` / `Then`, které při hledání keywordu ignoruje; v radaru
se nepoužívají, testy jsou psané imperativně s českými názvy keywordů.

## 6. Co analýza odhalila

| Zjištění | Návrh |
|---|---|
| TC03: větev „chybí profil nebo PIN“ nemá unit test; TC04: neexistující profil se testuje jen přes `ok: false`, bez ověření chyby, takže test nerozliší „profil nenalezen“ od jiného selhání | doplnit test pro TC03, zpřísnit aserci u TC04 |
| TC13: zobrazení chyby serveru se netestuje, přitom se 7.–8. 10. reálně stalo | unit test frontendu s podvrženou odpovědí `fetch`, případně E2E s podvrženou odpovědí sítě |
| Server nemá omezení počtu pokusů o PIN; nejkratší PIN má 4 znaky | bezpečnostní riziko (hádání PINu). U rodinné appky vědomě přijatelné, na klientském projektu by šlo o nález k řešení (limit pokusů, zpoždění) |

Analýza tak přinesla jeden chybějící test, jednu slabou aserci a jedno bezpečnostní
zjištění, které v matici pokrytí nebyly vidět, protože matice pracuje
na úrovni oblastí, ne jednotlivých pravidel.
