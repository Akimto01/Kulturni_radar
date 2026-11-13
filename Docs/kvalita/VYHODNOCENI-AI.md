# Vyhodnocení AI: Sonnet 5.5 v denní kontrole

Vyhodnocení k issue [#8](https://github.com/Akimto01/Kulturni_radar/issues/8). Dokument je k datu: čísla se nepřepisují, při revizi vzniká nová sekce.

## Shrnutí a rozhodnutí (13. 11. 2026)

Denní kontrola zůstává denně na Sonnetu 5.5, strop 15 akcí na běh se nemění. Sonnet 5.5 cíl splnil s rezervou (2,44 nové akce na běh, žádný běh bez nálezu) a celá aplikace stojí ~6–7 USD měsíčně; přechod na 3× týdně by ušetřil jen ~2,5 USD měsíčně.

## Zdroje dat

- List KONTROLY (export 13. 11. 2026): běhy typu „denní kontrola“, model ze sloupce Poznámka, tokeny a vyhledávání ze sloupců M–O (zapisuje backend od v3.47).
- List AKCE: sloupce „První nález“ a „Datum od“ pro předstih.
- Konzole Anthropic, stránka Cost, posledních 30 dní (stav 13. 11. 2026 18:41 UTC).
- Týdenní report kvality v samotestu (1. a 8. 11.).

## Nové akce na běh (denní kontrola, Brno)

| Období | Model | Běhů | Nové ø | Běhy bez nové akce | Běhy bez jakéhokoli nálezu |
|---|---|---|---|---|---|
| Srpen 1.–19. | Sonnet 4.6 | 19 | 1,21 | 12 | – |
| Říjen 1.–26. | Haiku 4.5 | 26 | 1,04 | 15 | 10 |
| 27. 10.–13. 11. | Sonnet 5.5 | 18 | 2,44 (medián 2) | 3 | 0 |

Poznámka: výchozí hodnota „10 z 26 nulových“ v BACKLOGu počítala běhy bez jakéhokoli nálezu.

Podle dne v týdnu (Sonnet 5.5): po 0,5, út 3,3, st 1,0, čt 2,3, pá 3,7, so 1,5, ne 4,5 nových na běh; jen 2–3 běhy na den, statisticky nevypovídající.

## Cena

- Z tokenů v KONTROLÁCH: ø 37 137 vstupních a 4 059 výstupních tokenů a 3 vyhledávání na běh; při 2/10 USD za milion tokenů a 0,01 USD za vyhledávání ~0,115 USD za tokeny a ~0,145 USD celkem za běh. Měsíčně ~4,4 USD při 7× týdně, ~1,9 USD při 3× týdně.
- Konzole: dny jen s denní kontrolou 0,10–0,13 USD za tokeny (souhlasí s odhadem). Celkem za 30 dní 7,22 USD (tokeny 5,69, vyhledávání 1,53) za všechny typy běhů; Sonnet 5.5 od 27. 10. ~3,06 USD za tokeny za 18 dní. Dražší dny jsou se sledovanými městy nebo mimořádnými běhy (29. 10. 0,59, 1. 11. 0,34).

## Předstih nalezených akcí

109 akcí s prvním nálezem 27. 10.–13. 11.: medián předstihu 10 dní, 68 akcí víc než 7 dní předem, 14 akcí 1–3 dny, 10 akcí s datem před nálezem (běžící vícedenní akce). Simulace běhu jen po, st, pá: 96 % akcí s nezáporným předstihem by se našlo před začátkem konání.

## Rozhodnutí podle kritérií z #8

(a) úspora 3× týdně ~2,5 USD měsíčně: nevýznamná → nesplněno; (b) ztráta nových akcí: neprokazatelná (malý vzorek po dnech); (c) předstih: 96 % → splněno. Protože (a) neplatí, denní kontrola zůstává denně. Strop 15 akcí denní kontrolu neomezuje (maximum nalezených za běh 13); strop u velkých sledovaných měst řeší #49 část 2.

## Omezení

- „První nález“ v AKCE nerozlišuje typ běhu, který akci našel (denní kontrola, sledovaná města, mimořádné, e-mailové tipy).
- Sonnet 5.5 má zatím jen 18 běhů; po dnech v týdnu 2–3 běhy.
- Konzole nerozlišuje typy běhů, porovnání je přes dny, kdy běžela jen denní kontrola.
- 13. 11. bylo vypnuté automatické dobíjení kreditu kvůli selhání platby (zůstatek 2,61 USD); opraveno týž den (auto-reload na 15 USD pod 5 USD). Kandidát na hlídání v samotestu nebo #64.

## Revize

Znovu po změně modelu, promptu nebo frekvence; podklad pro #64 (náklady AI v týdenním reportu), #55 a #57.
