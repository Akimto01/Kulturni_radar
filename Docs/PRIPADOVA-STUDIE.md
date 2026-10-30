# Případová studie: Kulturní radar na jedné stránce

*In short (EN): a family app that uses an AI agent with web search to track cultural events in Czech cities, built and tested by one person with an AI assistant. This one-page case study shows how tests, CI safeguards and defect analysis grew in layers, each one answering a real incident, and what I would do differently. Written in Czech, about three minutes to read.*

Pro hodnotitele a manažery, kteří mají tři minuty. Aktuální stav (počty testů, pokrytí, skóre) tu záměrně není: je v [README](../README.md#testy-v-číslech) a v [metrikách automatizace](testovani/ARCHITEKTURA-TESTU.md#d3-metriky-automatizace). Čísla níže mají datum a jsou historickými fakty.

## Výchozí situace

Rodinná appka [kulturniradar.cz](https://kulturniradar.cz) hlídá kulturní akce v Brně a dalších městech. Akce hledá AI s webovým vyhledáváním, data jsou v Google Sheets a backend je Google Apps Script. Ten má jedno produkční nasazení bez stagingového prostředí, takže E2E testy běží proti produkci. Appku vyvíjí jeden člověk s AI agentem a repo je zároveň ukázka mé práce testera automatizace. První verze v repu (1. 8. 2026) neměla žádné automatické testy.

## Výzvy

- **Nedeterministický výstup AI.** Formát ani obsah nejde zaručit, proto se výstup bere jako nedůvěryhodný vstup: akce bez rozpoznatelného data se nezapíše a týdenní samotest hlídá kvalitu hledání.
- **Platby za běh.** Jedno hledání na modelu Claude Sonnet 5.5 stojí zhruba 0,12 USD plus webová vyhledávání (měřeno 26.–27. 10. 2026), takže se placené akce v testech nespouštějí.
- **Limity Apps Scriptu.** Běh skončí na 6 minutách a limit nejde zachytit (29. 10. 2026 skončil běh sledovaných měst po 361 s); pod opakovanou zátěží platforma zpomaluje a zápisové E2E testy bývají křehké.
- **Veřejné repo a tajné hodnoty.** Repo je veřejné od 8. 10. 2026, ale GitHub maskuje tajné hodnoty jen v konzoli, ne v souborech, které si testy vytvoří.

## Přístup

- **Testování podle rizik.** Jedenáct rizik v [testovacím plánu](testovani/TESTY.md); automatizuje se to, co mělo doložený incident nebo vysoký dopad, a co se neautomatizuje, je zapsáno s důvody.
- **Pyramida.** Co jde vytáhnout do čisté funkce, testuje se jednotkově v Node; E2E testy (Robot Framework, Playwright) ověřují jen napojení. Týdně běží proti produkci, po nasazení smoke.
- **CI s pojistkami.** Při každém pushi jednotkové testy, dry run E2E sady a kontroly počtů testů, soupisu nástrojů, odkazů v dokumentaci a souladu testů s architekturou. Selhání plánovaného běhu přijde na telefon, reporty se před nahráním prohledají na tajné hodnoty.
- **Správa defektů.** Formulář, stupnice závažnosti a priority, životní cyklus a u každého defektu analýza úniku: na které úrovni testů měl být chycen a proč nebyl. Incidenty jsou v [přehledu](kvalita/HISTORIE-INCIDENTU.md).
- **Mutační testování.** Stryker na deseti kritických funkcích backendu, v CI s prahem 95 %.
- **Automatické kontroly projektu.** Denně kontrola boardu a defektů, která se ozve jen při nálezu, v pondělí týdenní souhrn.

## Výsledky

- **Testy:** 2. 8. 2026 prvních 20 jednotkových testů, 29. 10. 2026 jich bylo 656 (backend a frontend).
- **Síla testů:** mutační skóre kritických funkcí 78,1 → 96,9 % (29. 10. 2026), pokrytí řádků backendu 82,2 → 92,0 % (28.–29. 10. 2026).
- **Rychlá sada:** 231 z 232 běhů zelených (28. 10. 2026), jednotkové testy do jedné sekundy.
- **Pojistka funguje:** kontrola úniku tajných hodnot zachytila hned v dalším běhu čtvrtou cestu úniku, o které nikdo nevěděl.
- **Slabá místa:** týdenní E2E regrese byla ke 28. 10. 2026 zelená v 7 z 22 běhů a automatické testy odhalily jen 2 z 8 říjnových defektů; ostatní našla živá kontrola a analýza dat. Nízká spolehlivost vedla k notifikacím a delšímu čekání v CI, nízký podíl odhalených defektů k auditu souladu testů a pravidlu o třídách vstupů.

## Co bych příště udělal jinak

1. **Notifikace o selhání CI od prvního plánovaného běhu.** Týdenní běh byl červený deset týdnů, 66 dní (23. 8. až 28. 10. 2026), a nikdo o tom nevěděl. Test, o kterém se nikdo nedozví, že selhal, je jen archiv.
2. **Testovací data z více tříd ekvivalence od začátku.** E2E testy jely jen s Brnem, které nemá diakritiku, a chyba dvojího kódování měst s diakritikou žila na webu 80 dní (#31).
3. **Hledat tajné hodnoty v artefaktech CI před zveřejněním repa, ne po něm.** Kontrola před zveřejněním prověřila repo a jeho historii, ne obsah artefaktů, a únik (#33) se našel až 20 dní po zveřejnění.

## Kam dál

- [Příběhy chyb](kvalita/PRIBEHY-CHYB.md): tři skutečné chyby od příznaku po pojistku.
- [Historie incidentů](kvalita/HISTORIE-INCIDENTU.md): co se stalo, dopad a doba.
- [Architektura testů](testovani/ARCHITEKTURA-TESTU.md): jak jsou testy postavené a metriky.
- [Board](https://github.com/users/Akimto01/projects/1): plán, průběh a hotová práce.
- [README](../README.md): přehled projektu a aktuální čísla.
