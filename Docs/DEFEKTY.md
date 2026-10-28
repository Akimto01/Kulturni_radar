# Správa defektů – Kulturní radar

Jak se v projektu hlásí, třídí a uzavírají defekty, a zpětná klasifikace
skutečných defektů z října 2026 včetně analýzy úniků: na které úrovni testů měl
být každý defekt chycen a proč nebyl.

Nový defekt se zakládá formulářem **Defekt** (Issues → New issue). Formulář
ho rovnou přidá na [board](https://github.com/users/Akimto01/projects/1), kde se
mu nastaví pole *Závažnost*, *Priorita*, *Jak nalezeno* a *Stav defektu*.
Podrobné technické záznamy oprav jsou v [CHANGELOG.md](CHANGELOG.md), tři
nejzajímavější defekty jsou rozepsané v [PRIBEHY-CHYB.md](PRIBEHY-CHYB.md).

## Závažnost (dopad chyby)

| Stupeň | Název | Definice | Příklad z projektu |
|---|---|---|---|
| **S1** | Kritická (*Blocker/Critical*) | Bezpečnost, únik nebo ztráta dat. Appka ohrožuje uživatele nebo je nepoužitelná. | Únik PINu a ntfy tématu ve veřejných reportech (#33) |
| **S2** | Vysoká (*Major*) | Hlavní funkce nefunguje nebo ukazuje chybná data a nejde to obejít. | Města s diakritikou bez akcí (#31) |
| **S3** | Střední (*Normal*) | Funkce funguje s omezením nebo s nepřesnými či neúplnými daty. | Chybějící počasí a souřadnice (#18) |
| **S4** | Nízká (*Minor*) | Zavádějící informace nebo drobná chyba, která nebrání použití. | Hláška prázdného stavu s časem jiného města (#27) |
| **S5** | Triviální (*Trivial*) | Čistě kosmetická vada: překlep, zarovnání, barva. | zatím žádný |

## Priorita (naléhavost opravy)

| Stupeň | Název | Kdy řešit | Typický případ |
|---|---|---|---|
| **P1** | Okamžitá (*Highest*) | Ihned, ostatní práce počká. | S1, nebo S2, na kterou narazí každý |
| **P2** | Vysoká (*High*) | V téže nebo nejbližší pracovní session. | S2 s omezeným dopadem, S3 postihující všechny |
| **P3** | Střední (*Medium*) | Podle plánu, zhruba do dvou týdnů. | běžná položka Doporučeného pořadí v BACKLOGu |
| **P4** | Nízká (*Low*) | Až na ni přijde řada, bez termínu. | Testovací dluh, drobnosti |
| **P5** | Sledovat (*Lowest*) | Zapsat a sledovat, opravit jen pokud se zhorší. | položky „Sledovat, bez akce“ v BACKLOGu |

**Závažnost popisuje dopad chyby, priorita pořadí její opravy.** Většinou jdou
spolu, ale ne vždy: závod pozdních odpovědí (#26) je S2, protože zobrazí chybná
data, ale běžný uživatel na něj narazí jen při velmi rychlém přepínání měst, proto
P2. Opačný případ by byl překlep v názvu appky na úvodní obrazovce: S5, ale kvůli
dojmu z appky P1. Priorita se v čase může měnit (třeba před otevřením appky
přátelům), závažnost zůstává, dokud se nezmění chování chyby.

## Životní cyklus

| Stav | Význam | Kdo a kdy ho nastaví |
|---|---|---|
| **Nový** | Nahlášeno, zatím neposouzeno. | při založení |
| **Potvrzený** | Chyba se zreprodukovala nebo je doložená, má závažnost a prioritu. | po prvním posouzení |
| **V opravě** | Probíhá diagnóza kořenové příčiny a oprava. | při zahájení práce |
| **Ověřuje se** | Oprava je nasazená, čeká se na ověření v produkci nebo v datech. | po nasazení |
| **Uzavřený** | Oprava ověřená, regresní test nebo pojistka existuje. | po ověření |
| **Zamítnutý** | Nejde o chybu (záměrné chování, duplicita). | při posouzení |
| **Nereprodukovatelný** | Chybu se nepodařilo vyvolat, zapsáno pro případ opakování. | při posouzení |

Defekt se uzavírá až po ověření v produkci, ne po nasazení: řada oprav v tomto
projektu závisí na datech, která přinese až další běh (týdenní kontrola, samotest).

## Jak nalezeno

Pole sleduje, která aktivita defekt odhalila. Hodnoty: *Automatický test
(jednotkový)*, *Automatický test (E2E nebo API)*, *Živá kontrola*, *Monitoring nebo
samotest*, *Analýza nebo review*, *Uživatel*. Živá kontrola znamená průzkumné
testování na produkci (web, API, data v tabulce), typicky při ověření po nasazení.
Počítá se aktivita, která defekt odhalila poprvé.

## Zpětná klasifikace defektů 26.–28. 10. 2026

| Issue | Defekt | Závažnost | Priorita | Jak nalezeno | Stav |
|---|---|---|---|---|---|
| [#33](https://github.com/Akimto01/Kulturni_radar/issues/33) | Únik tajných hodnot v reportech CI | S1 | P1 | Analýza nebo review | Uzavřený |
| [#31](https://github.com/Akimto01/Kulturni_radar/issues/31) | Města s diakritikou bez akcí | S2 | P1 | Živá kontrola | Uzavřený |
| [#17](https://github.com/Akimto01/Kulturni_radar/issues/17) | Proběhlé akce na webu (sériové číslo data) | S2 | P1 | Živá kontrola | Uzavřený |
| [#26](https://github.com/Akimto01/Kulturni_radar/issues/26) | Závod pozdních odpovědí při přepínání měst | S2 | P2 | Automatický test (E2E nebo API) | Uzavřený |
| [#18](https://github.com/Akimto01/Kulturni_radar/issues/18) | Počasí ve stavu CHYBA, chybějící souřadnice | S3 | P2 | Živá kontrola | Ověřuje se |
| [#23](https://github.com/Akimto01/Kulturni_radar/issues/23) | Akce s datem „neuvedeno“ | S3 | P3 | Živá kontrola | Uzavřený |
| [#21](https://github.com/Akimto01/Kulturni_radar/issues/21) | Duplicity stálých míst | S3 | P3 | Analýza nebo review | Uzavřený |
| [#27](https://github.com/Akimto01/Kulturni_radar/issues/27) | Hláška prázdného stavu s časem jiného města | S4 | P3 | Automatický test (E2E nebo API) | Uzavřený |

#18 zůstává ve stavu *Ověřuje se* a issue je proto otevřená: oprava počasí
a souřadnic čeká na ověření v datech po čtvrtečním běhu sledovaných měst (issue #6).
Duplicitu stálých míst (#21) poprvé zaznamenal rozbor dat při přípravě quality
checku (7.–8. 10. 2026), živá kontrola 26. 10. ji potvrdila.

## Analýza úniků

U každého defektu: na které úrovni testů **měl** být chycen, proč nebyl a co se
změnilo, aby se to neopakovalo.

| Issue | Měl být chycen | Proč unikl | Co se změnilo |
|---|---|---|---|
| #33 | Review testovací infrastruktury při zveřejnění repa (8. 10.) | Review před zveřejněním kontrolovalo repo a jeho historii (Secret scanning), ne obsah artefaktů CI; GitHub tajné hodnoty maskuje jen v konzoli běhu, ne v souborech, které si testy vytvoří | Automatická kontrola úniku v CI před nahráním reportů, výměna hodnot |
| #31 | E2E test | Testy jely jen s Brnem (bez diakritiky); ruční kontrola ostatních měst šla přímo přes API, ne přes appku | E2E test s dynamicky vybraným městem s diakritikou, 4 jednotkové testy |
| #17 | Jednotkový test | Testy znaly jen textové datum; řádky se sériovým číslem nejspíš vznikly jednorázovou ruční úpravou dat (podle rozboru v3.48) | 6 jednotkových testů pro sériové číslo |
| #26 | Jednotkový test nebo E2E test | E2E test čekal na „nějakou“ kartu, tedy i na staré karty, a chyba se projevila jen při pomalé odpovědi serveru | Ochrana proti pozdní odpovědi, 4 jednotkové testy, přepracovaný E2E test |
| #18 | Monitoring (podíl akcí se souřadnicemi a počasím) | Neúspěšné geokódování se nikdy nezopakovalo a nic nesledovalo úplnost dat | 13 jednotkových testů, denní dohledání souřadnic, HTTP kódy v logu |
| #23 | Validace vstupu při zápisu, samotest | Výstup AI se bral jako spolehlivě ve správném formátu | Akce bez data se nezapíše, samotest ji nahlásí, 6 jednotkových testů |
| #21 | Samotest (kontrola duplicit) | Kontrola duplicit existovala jen pro akce, ne pro stálá místa | Párování míst podle klíče názvu, 8 jednotkových testů |
| #27 | E2E test | Předchozí oprava (v3.59) se ověřovala přes URL parametr, ne přepnutím města, jak to dělá uživatel | Přepracovaný E2E test přepnutí profilu, 4 jednotkové testy |

### Co z toho plyne

- **Šest z osmi defektů neodhalily automatické testy**, ale živá kontrola
  a analýza dat. Proto jsou živé kontroly pravidelnou součástí práce (ověření po
  nasazení, průzkum webu a dat), ne náhrada automatizace: každý defekt nalezený
  ručně skončil novým automatickým testem nebo pojistkou.
- **Opakující se příčina úniků: testovací data a cesta.** Tři defekty unikly,
  protože testy pokrývaly jen jednu třídu vstupů (jen Brno, jen textové datum)
  nebo protože se ověřovalo jinou cestou, než jde uživatel (přímé API, URL
  parametr). Odtud pravidlo: ověřovat cestou uživatele a s daty z různých tříd
  ekvivalence.
- **Druhá opakující se příčina: chybějící monitoring dat.** U #18, #21 a #23 byla
  chyba vidět v datech dlouho předtím, než si jí někdo všiml. Samotest teď hlásí
  úplnost a kvalitu dat každý týden.
