# Příběhy chyb – Kulturní radar

Tři skutečné chyby z října 2026, každá popsaná od prvního příznaku po pojistku,
která zabrání jejímu návratu. Nejsou vybrané proto, že by byly technicky složité,
ale proto, že každá ukazuje jinou stránku práce testera: proč testy chybu
nechytily, jak se hledala příčina a co se změnilo, aby se to neopakovalo.

| Příběh | Typ chyby | Jak dlouho žila | Kdo ji našel |
|---|---|---|---|
| [1. Města s diakritikou bez akcí](#1-města-s-diakritikou-bez-akcí) | funkční chyba v produkci | od 8. 8. (podle kódu možná od 2. 8.) do 27. 10. 2026 | ruční ověření v prohlížeči při jiné změně |
| [2. CI deset týdnů červená a nikdo to neviděl](#2-ci-deset-týdnů-červená-a-nikdo-to-neviděl) | souhra chyby v appce, slabého testu a chybějícího upozornění | od 23. 8. do 28. 10. 2026 | odznak v README |
| [3. Únik tajných hodnot v reportech testů](#3-únik-tajných-hodnot-v-reportech-testů) | bezpečnostní chyba v testovací infrastruktuře | od 2. 8. do 28. 10. 2026 | příprava veřejného reportu, pak automatická pojistka |

Podrobné technické záznamy včetně commitů jsou v [CHANGELOG.md](CHANGELOG.md),
průběh práce na [boardu](https://github.com/users/Akimto01/projects/1).

---

## 1. Města s diakritikou bez akcí

**Příznak.** Při ověřování drobné úpravy frontendu (audit selektorů, Index.html v3.64)
jsem v prohlížeči procházel další města. Plzeň a Zlín ukazovaly prázdný seznam:
0 akcí, 0 stálých míst. API přitom pro obě města akce vracelo (Plzeň 18).

**Diagnóza.** První sonda dávala nesmysl: všechna města hlásila 17 akcí. Ukázalo se,
že sonda po přepnutí města čekala jen na „nějakou“ kartu a změřila ještě karty
předchozího města. Stejnou chybu jsem necelé dvě hodiny předtím opravoval v E2E testu,
takže jsem ji poznal rychle. Po opravě sondy byl obraz čistý: problém měla jen města
s diakritikou. Odposlech síťových požadavků v prohlížeči ukázal, že server dostává
název města zakódovaný **dvakrát** (`Zl%C3%ADn` místo `Zlín`), takže hledá město,
které neexistuje.

**Kořenová příčina.** Funkce, které načítají akce a místa, předávaly název města už
zakódovaný přes `encodeURIComponent`, a vrstva sestavující HTTP požadavek ho
zakódovala znovu. Na webu kulturniradar.cz chyba existovala od jeho spuštění
8. 8. 2026; podle kódu pravděpodobně už od 2. 8. v původním režimu přes Apps Script
(to jsem živě neověřoval). Týkala se jen měst s diakritikou, a s tím, jak přibývala
sledovaná města, jich postihovala čím dál víc.

**Proč ji testy nechytily.** E2E testy běží s profilem Brno a Brno diakritiku nemá.
A můj vlastní den starý průzkum ostatních měst šel přímým voláním API, ne přes appku,
takže chybu ve frontendu nemohl vidět.

**Oprava a pojistka.** Jeden řádek: dekódování názvu před předáním dál. Čtyři
jednotkové testy (bez opravy tři spadnou, čtvrtý hlídá, že se nic nerozbilo pro Brno)
a nový E2E test, který si dynamicky vybere město s diakritikou a ověří, že se jeho
akce opravdu načtou. Živě: Plzeň 0 → 18 akcí, Zlín 0 → 9.

**Poučení.** Testovací data musí pokrýt třídy ekvivalence vstupů, ne jen jeden
„šťastný“ případ: název bez diakritiky a s diakritikou jsou dvě různé třídy.
A ověřovat se má cesta, kterou jde skutečný uživatel, ne zkratka kolem ní.

Záznam: Index.html v3.65, issue [#31](https://github.com/Akimto01/Kulturni_radar/issues/31).

---

## 2. CI deset týdnů červená a nikdo to neviděl

**Příznak.** Při přepisu README se v něm objevil odznak týdenního běhu E2E testů
a byl červený. Historie ukázala, že plánovaný nedělní běh proti produkci selhal
**deset týdnů za sebou** (23. 8. až 25. 10. 2026). Lokálně se problém neprojevoval
soustavně: ojedinělé pády zmizely při izolovaném opakování.

**Proč si toho nikdo nevšiml.** Selhání plánovaného běhu nevyvolalo žádné
upozornění. Ověřil jsem to i v poště: e-maily o selhání chodily jen u ručně
spuštěných běhů, nikdy u plánovaných, a starší upozornění z jiného workflow končila
přes filtr mimo doručenou poštu. Test bez upozornění není kontrola, jen archiv.

**Diagnóza.** Z logů všech deseti běhů vznikla tabulka pádů. Opakoval se vzorec:
tři testy označování akcí (★/✓) padaly devět týdnů po sobě a několik testů filtrů
hlásilo `0 != N`. První hypotéza (zápis na řádek s poškozeným datem selhává na
serveru) se pokusem vyvrátila: server zápis přijal stejně jako jinde. Zlom přinesla
jedna chybová zpráva: test „karty mají ikony“ hlásil `0 != 1`. Ikony se ale
vykreslují bez podmínky (ověřeno i ve starém kódu), takže to neznamenalo chybějící
ikonu, ale **žádnou kartu na stránce**.

**Kořenová příčina (pravděpodobná).** Test opakovaného přepínání měst přibyl
21. 8. a první červený běh byl 23. 8. Test rychle přepínal přes první tři města
v abecedním seznamu (dnes Brno a dvě dosud neprohledaná města bez akcí; obsah seznamu v srpnu z historie ověřit nejde) a po každém
přepnutí čekal jen na to, až bude vidět nějaká karta. To splnily ještě karty
předchozího města, takže test nečekal na načtení a nechával běžet překrývající se
požadavky. Appka přitom neměla ochranu proti pozdní odpovědi: zpožděná odpověď pro
prázdné město dokázala přepsat Brno (ověřeno fault injection, tedy uměle
zpožděnou odpovědí v prohlížeči). Následující testy pak mohly běžet nad prázdným
seznamem. V CI odpovídá server pomaleji, a proto se to tam
dělo skoro každý týden. Jde o silnou nepřímou shodu (datum, příznak i oprava sedí),
ne o přímý důkaz.

**Oprava a pojistka.** Tři vrstvy:

- **appka:** zpracuje se jen odpověď na poslední požadavek,
- **test:** po přepnutí čeká na skutečnou změnu obsahu, ne na staré karty,
- **CI:** notifikace na telefon při selhání (funkčnost ověřena 28. 10., od té doby jen
  u plánovaných běhů), připnuté verze nástrojů a delší čekání na server jen v CI.
  Ostré ověření celé sady úprav přinese plánovaný běh 1. 11. 2026.

**Poučení.** Slabý test může rozbít jiné testy, ne jen sebe. Čekání na „nějaký
prvek“ projde i nad starým stavem stránky. A automatizace má hodnotu jen tehdy,
když se její výsledek dostane k člověku.

Záznamy: Index.html v3.61 a v3.62, „CI: týdenní RF běh byl 10 týdnů červený“
v CHANGELOGu, issues [#26](https://github.com/Akimto01/Kulturni_radar/issues/26)
a [#27](https://github.com/Akimto01/Kulturni_radar/issues/27).

---

## 3. Únik tajných hodnot v reportech testů

**Příznak.** Před zveřejněním reportů testů na webu jsem si položil otázku, co
přesně v nich je. Logy Robot Frameworku zapisují argumenty klíčových slov a repo
je veřejné, takže podezření stačilo ověřit.

**Diagnóza.** Rozbor stažených reportů (jen počty výskytů, hodnoty se nikdy
nevypisovaly) potvrdil dva úniky: PIN testovacího profilu (klíčové slovo pro psaní
textu zapsalo hodnotu do logu) a téma ntfy, přes které appka posílá notifikace
(celá URL v logu HTTP požadavku). Navíc se v reportech objevovalo ntfy téma, které si
testovací profil generuje v testu notifikací (méně citlivé, týká se jen testovacího
profilu, ale na veřejný web nepatří). GitHub tajné hodnoty maskuje v konzoli, ale ne
v souborech, které si testy vytvoří samy. A reporty byly ke stažení jako artefakty
CI. Při opravě se našla třetí cesta: Robot Framework v dokumentaci testu rozvinul
proměnnou, takže hodnota skončila i v souhrnném reportu.

**Oprava a pojistka.** Oprava tří známých míst nestačí, když nevím, kde jsou další.
Proto vznikla **automatická kontrola** v CI: před nahráním reportů je prohledá na
tajné hodnoty a při nálezu report nenahraje a selže. Hned v dalším běhu
**zachytila čtvrtou cestu**, o které nikdo nevěděl: hodnoty proměnné cyklu se do
výstupu zapisují i při vypnutém logování. Report se díky tomu ven nedostal. Dále:

- uniklé hodnoty se vyměnily (nový PIN, nové téma, přihlášení telefonu k novému
  tématu), staré reporty se smazaly,
- téma testovacího profilu se v testu notifikací zpracuje bez zápisu do logu a kontrola
  hlídá témata všech uživatelských profilů obecným vzorem, ne jen testovací profil,
- na veřejném webu se nezveřejňují screenshoty (kontrola obrázky neumí číst)
  ani ladicí log prohlížeče.

Starý PIN byl mimochodem shodný s testovací hodnotou ve veřejných jednotkových
testech, takže byl uhodnutelný i bez úniku.

**Poučení.** U bezpečnosti nestačí opravit, co jsem našel: potřebuju pojistku na
to, co jsem nenašel, a ta se vyplatila hned napoprvé. Uniklé tajemství se má
vyměnit, ne jen skrýt. A hledá se počítáním výskytů, ne vypisováním hodnot.

Záznam: „Bezpečnost: únik tajných hodnot v artefaktech CI“ v CHANGELOGu, issue
[#33](https://github.com/Akimto01/Kulturni_radar/issues/33). Veřejný report:
[akimto01.github.io/Kulturni_radar](https://akimto01.github.io/Kulturni_radar/).
