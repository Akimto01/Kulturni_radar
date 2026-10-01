# Zoho → Travel Claims: návrh mapování (30. 9. 2026)

Podklad pro opravu toku `Cestovni-prikazy-Zoho-prijem` (ID `050a7eba-e8f8-4f44-8efb-8b06b78f33a8`). Vychází ze skutečných požadavků ze Zoho (`User-Agent: Deluge`, 12 odmítnutých cest, viz `zoho-odmitnute-cesty-29-9.md`) a ze sloupců Travel Claims ve fixtuře `calc-api/tests/fixtures/sharepoint-vstup-realny-beh-2.json`.

**Stav podkladů:** definici toku jsem ještě nečetl (prohlížeč nebyl k dispozici). Místa, která na ni závisí, jsou označená **[OVĚŘIT V TOKU]**.

## 1. Doporučený způsob opravy

Nepřepisovat celý tok. Hned za ověření `X-Webhook-Secret` přidat jednu akci **Napsat (Compose) `Normalizace`**, která ze surových dat Zoho sestaví objekt ve tvaru, s jakým tok počítá dnes (kontrakt `data.travelId`, `data.employee.email` …). Zbytek toku pak čte z `outputs('Normalizace')` místo z `triggerBody()`.

Výhody:
- změna je na jednom místě a jde zkontrolovat proti kontraktu,
- kontrola povinných polí, zakládání Vyúčtování a zápis do Travel Claims zůstávají beze změny,
- Postman testy ve tvaru kontraktu jdou zachovat, pokud `Normalizace` přijme oba tvary (`coalesce(kontrakt, zoho)`).

**[OVĚŘIT V TOKU]** kolik výrazů dnes čte z `triggerBody()`. Všechny je potřeba přepnout na `outputs('Normalizace')`.

## 2. Mapování polí

Formát data a času ze Zoho: `dd/MM/yyyy HH:mm:ss`, **místní čas bez časového pásma** (např. `23/09/2026 07:00:00`). SharePoint ukládá UTC, proto vždy převést z `Central Europe Standard Time`.

| Zoho (skutečné pole) | Příklad | → Travel Claims | Výraz / pravidlo |
|---|---|---|---|
| `TravelID` | `TR1030` | `TravelID` | beze změny; klíč pro kontrolu duplicit |
| `ApprovalStatus` | `Approved` / `Pending` | – | zpracovat **jen `Approved`**; jinak odpovědět 200 a nic nezakládat |
| `ApprovalTime` | `23/09/2026 11:56:48` | (žádný sloupec) | jen do logu běhu; **[OVĚŘIT V TOKU]** jestli ho kontrakt někam ukládá |
| `employee.email` | `lucie.trlifajova@tesena.com` | `EmployeeEmail` | `toLower(...)` |
| `EmployeeID` | `Lucie Trlifajová 666` | `EmployeeName` | jméno = vše před posledním slovem; **viz bod 4a** |
| `PlaceOfVisit` | `Mladá Boleslav DQ` | `Destination` | beze změny |
| `client_name` | `Digiteq Automotive s.r.o.` | `Client` | beze změny |
| `PurposeOfVisit` | `Testing on HIL` | **[OVĚŘIT V TOKU]** | sloupec pro účel zatím nevidím; viz bod 4c |
| `Journey_from_Location` | `Praha` | **nový sloupec?** | viz bod 4b |
| `Departing_when` | `23/09/2026 07:00:00` | `DateFrom` | datum: `formatDateTime(parseDateTime(x,'cs-CZ','dd/MM/yyyy HH:mm:ss'),'yyyy-MM-dd')` |
| `Returning_When` | `23/09/2026 16:00:00` | `DateTo` | stejně |
| `travel_type` | `Domestic` / `Foreign` | `TravelType` | `Domestic` → `domestic`, `Foreign` → `foreign` |
| `Transport` | `Car`, `Bus`, `Train`, `Flight`, `None` | `TransportType` | podle kontraktu v1.8: `Train`→`R`, `Bus`→`A`, `Flight`→`L`, `Car`→`AUV`, `None`→prázdné |
| – | – | `Status` | `AwaitingDocs` (jako dnes) |
| – | – | `ApproverEmail` | **[OVĚŘIT]** – v datech ze Zoho jsem pole schvalovatele zatím nenašel |
| `Accomodation_Type`, `insurance_required`, `Date_of_Request` | – | nemapovat | výpočet je nepotřebuje |

Plánovaný čas odjezdu/příjezdu ze Zoho **nepřepisovat** do `ActualDepartureDateTime`/`ActualArrivalDateTime` – ty vyplňuje zaměstnanec ve formuláři po návratu. [ODVOZENO] – zvážit předvyplnění jako výchozí hodnoty formuláře (méně psaní pro zaměstnance), ale až po pilotu.

## 3. Ověření povinných polí (náhrada za dnešní kontrolu s chybou 400)

Povinná ze Zoho: `TravelID`, `ApprovalStatus`, `employee.email`, `Departing_when`, `Returning_When`, `travel_type`. Chybí-li některé, odpovědět **400 s výčtem chybějících polí** (dnešní „Missing required field(s) in data“ neříká, které – proto se chyba tři týdny neprojevila).

Nepovinná: `PlaceOfVisit`, `client_name`, `Transport`, `Journey_from_Location`, `PurposeOfVisit`.

## 4. Dvě dobré zprávy a jedna otázka

**a) Osobní číslo zaměstnance je v datech.** `EmployeeID` ze Zoho má tvar „jméno + číslo“ (`Lucie Trlifajová 666`, `Petra Durková …`). Šablona cesťáku dnes hlásí „Chybí osobní číslo pracovníka“ – číslo by šlo brát odsud. Ověřit s Martinou, že jde o osobní číslo (ne jen interní ID Zoho), a pak přidat sloupec `EmployeeNumber` do Travel Claims. [ČEKÁ NA ROZHODNUTÍ]

**b) Místo odjezdu je v datech.** `Journey_from_Location` (`Praha`) je přesně to, co v cesťáku dnes chybí („chybí místo odjezdu – doplněno —“, otevřená otázka na Martinu z 25. 9.). Navrhuji nový sloupec `DepartureLocation` v Travel Claims a v calc-api ho použít pro `mistoOdjezdu` i `mistoPrijezdu` (návrat do místa odjezdu, viz kap. 4 `stav-k-25-9.md`). [ODVOZENO]

**c) Účel cesty.** `PurposeOfVisit` (`Testing on HIL`) je přesnější „účel“ než dnešní `Destination` + `Client`. Rozhodnout, jestli se tiskne do sloupce „Účel cesty / místo jednání“ jako „Mladá Boleslav, Digiteq – Testing on HIL“, nebo zůstat u současného formátu. [ČEKÁ NA ROZHODNUTÍ]

## 5. Duplicity a obnova ztracených cest

- Kontrola duplicit podle `TravelID` musí zůstat (Zoho může poslat stejné schválení znovu). **[OVĚŘIT V TOKU]**, jestli ji tok má; pokud ne, doplnit.
- Obnova 12 cest: po opravě a uložení toku **Znovu odeslat** původní běhy (ID v `zoho-odmitnute-cesty-29-9.md`). Ověřit na jednom běhu (TR1030), že se zpracuje **aktuální** verzí toku, teprve pak zbytek.
- **TR1022 je zahraniční** – po obnově vznikne záznam, ale zahraniční cesťák zatím nemá tok. Nevadí, jen ho zatím nezahrnovat do měsíčního tuzemského vyúčtování (tok to dnes hlídá podle `TravelType`, **[OVĚŘIT V TOKU]**).

## 6. Pořadí práce

1. Přečíst definici toku (podmínky, výrazy s `triggerBody()`, zápis do Travel Claims, Vyúčtování).
2. Doplnit akci `Normalizace` a přepnout výrazy; povinná pole podle kap. 3.
3. Uložit, ověřit na jednom obnoveném běhu (TR1030) → záznam v Travel Claims.
4. Obnovit zbylých 11 běhů, zkontrolovat Travel Claims a Vyúčtování.
5. Export toku do `flows/`, přepsat `specs/webhook-kontrakt-zoho-pa.md` podle skutečného tvaru dat.
6. Body 4a–4c (osobní číslo, místo odjezdu, účel) až po obnově cest – nejsou na kritické cestě.
