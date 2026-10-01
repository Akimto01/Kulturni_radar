# Akce `Normalizace` pro přijímací tok – výrazy (30. 9. 2026)

Doplňuje `zoho-mapovani-navrh-30-9.md`. Připraveno bez přístupu k toku, proto **před vložením ověřit bod 0**.

## 0. Nejdřív ověřit: jsou klíče vnořené, nebo ploché?

Zobrazení výstupů spouštěče v historii běhu ukazuje pole jako `employee.email`. Tak ale Power Automate zobrazuje i **vnořené** objekty (`{"employee": {"email": …}}`). Rozhodne až **Zobrazit nezpracované výstupy** u spouštěče `manual` v běhu TR1030 (`08584114494427440151966129756CU05`).

Výrazy níže proto čtou obě varianty přes `coalesce(...)`. Jakmile bude tvar jasný, druhou variantu je lepší smazat, ať výrazy nejsou zbytečně dlouhé.

## 1. Obsah akce *Napsat* `Normalizace`

Vložit do pole **Vstupy** jako JSON. Řetězce `@{...}` designer převede na výrazy.

```json
{
  "TravelID": "@{trim(string(coalesce(triggerBody()?['TravelID'], '')))}",
  "ApprovalStatus": "@{trim(string(coalesce(triggerBody()?['ApprovalStatus'], '')))}",
  "EmployeeEmail": "@{toLower(trim(string(coalesce(triggerBody()?['employee']?['email'], triggerBody()?['employee.email'], ''))))}",
  "EmployeeIdRaw": "@{trim(string(coalesce(triggerBody()?['EmployeeID'], '')))}",
  "Destination": "@{trim(string(coalesce(triggerBody()?['PlaceOfVisit'], '')))}",
  "Client": "@{trim(string(coalesce(triggerBody()?['client_name'], '')))}",
  "Purpose": "@{trim(string(coalesce(triggerBody()?['PurposeOfVisit'], '')))}",
  "DepartureLocation": "@{trim(string(coalesce(triggerBody()?['Journey_from_Location'], '')))}",
  "DepartingRaw": "@{trim(string(coalesce(triggerBody()?['Departing_when'], '')))}",
  "ReturningRaw": "@{trim(string(coalesce(triggerBody()?['Returning_When'], '')))}",
  "TravelTypeRaw": "@{toLower(trim(string(coalesce(triggerBody()?['travel_type'], ''))))}",
  "TransportRaw": "@{toLower(trim(string(coalesce(triggerBody()?['Transport'], ''))))}"
}
```

Druhá akce *Napsat* `Odvozene` (až za `Normalizace`, aby výrazy nebyly dvojnásobně dlouhé):

```json
{
  "EmployeeName": "@{if(isInt(last(split(outputs('Normalizace')?['EmployeeIdRaw'], ' '))), join(take(split(outputs('Normalizace')?['EmployeeIdRaw'], ' '), sub(length(split(outputs('Normalizace')?['EmployeeIdRaw'], ' ')), 1)), ' '), outputs('Normalizace')?['EmployeeIdRaw'])}",
  "EmployeeNumber": "@{if(isInt(last(split(outputs('Normalizace')?['EmployeeIdRaw'], ' '))), last(split(outputs('Normalizace')?['EmployeeIdRaw'], ' ')), '')}",
  "DateFrom": "@{formatDateTime(parseDateTime(outputs('Normalizace')?['DepartingRaw'], 'en-GB', 'dd/MM/yyyy HH:mm:ss'), 'yyyy-MM-dd')}",
  "DateTo": "@{formatDateTime(parseDateTime(outputs('Normalizace')?['ReturningRaw'], 'en-GB', 'dd/MM/yyyy HH:mm:ss'), 'yyyy-MM-dd')}",
  "PlannedDepartureUtc": "@{convertToUtc(formatDateTime(parseDateTime(outputs('Normalizace')?['DepartingRaw'], 'en-GB', 'dd/MM/yyyy HH:mm:ss'), 'yyyy-MM-ddTHH:mm:ss'), 'Central Europe Standard Time')}",
  "PlannedReturnUtc": "@{convertToUtc(formatDateTime(parseDateTime(outputs('Normalizace')?['ReturningRaw'], 'en-GB', 'dd/MM/yyyy HH:mm:ss'), 'yyyy-MM-ddTHH:mm:ss'), 'Central Europe Standard Time')}",
  "TravelType": "@{if(equals(outputs('Normalizace')?['TravelTypeRaw'], 'foreign'), 'foreign', if(equals(outputs('Normalizace')?['TravelTypeRaw'], 'domestic'), 'domestic', ''))}",
  "TransportType": "@{if(equals(outputs('Normalizace')?['TransportRaw'], 'train'), 'R', if(equals(outputs('Normalizace')?['TransportRaw'], 'bus'), 'A', if(equals(outputs('Normalizace')?['TransportRaw'], 'flight'), 'L', if(equals(outputs('Normalizace')?['TransportRaw'], 'car'), 'AUV', ''))))}"
}
```

Poznámky:
- `DateFrom`/`DateTo` jsou jen datum, takže převod pásma neřeší. Plánované časy (`Planned…Utc`) jsou pro pozdější předvyplnění formuláře, zatím je nikam nezapisovat.
- Pozor: výrazy `parseDateTime` spadnou, když `DepartingRaw`/`ReturningRaw` chybí. Proto musí kontrola povinných polí (kap. 2) proběhnout **před** akcí `Odvozene`.
- `TransportType` s prázdnou hodnotou: Choice sloupec v SharePointu může prázdný řetězec odmítnout. **[OVĚŘIT V TOKU]**, jak to řeší dnešní akce *Vytvořit položku* (pravděpodobně podmínkou nebo `null`).
- `EmployeeName` a `EmployeeNumber` předpokládají tvar „jméno příjmení číslo“. Bez čísla na konci se vezme celé `EmployeeID` jako jméno.

## 2. Kontrola povinných polí s výčtem chybějících

Akce *Filtrovat pole* `ChybejiciPole`:
- **Od:**
  ```
  @createArray(
    if(empty(outputs('Normalizace')?['TravelID']), 'TravelID', ''),
    if(empty(outputs('Normalizace')?['ApprovalStatus']), 'ApprovalStatus', ''),
    if(empty(outputs('Normalizace')?['EmployeeEmail']), 'employee.email', ''),
    if(empty(outputs('Normalizace')?['DepartingRaw']), 'Departing_when', ''),
    if(empty(outputs('Normalizace')?['ReturningRaw']), 'Returning_When', ''),
    if(empty(outputs('Normalizace')?['TravelTypeRaw']), 'travel_type', '')
  )
  ```
- **Podmínka filtru:** `@not(empty(item()))`

Pak *Podmínka* `@greater(length(body('ChybejiciPole')), 0)`:
- **Ano:** *Odpověď* 400, tělo `{"error": "Missing required field(s)", "fields": @{body('ChybejiciPole')}}`, a konec.
- **Ne:** pokračovat. Dále podmínka `ApprovalStatus` ≠ `Approved` → *Odpověď* 200 `{"status": "ignored", "reason": "not approved"}` a konec.

Výhoda proti dnešnímu stavu: odpověď říká, **které** pole chybí, takže se příští nesoulad ukáže hned v historii běhů.

## 3. Testovací požadavek ve tvaru Zoho (pro Postman a pozdější smoke test v GitHub Actions)

Vymyšlená data, žádná skutečná osoba. Hlavička `X-Webhook-Secret` podle Postman prostředí.

```json
{
  "TravelID": "TEST-ZOHO-001",
  "ApprovalStatus": "Approved",
  "ApprovalTime": "30/09/2026 10:00:00",
  "employee": { "email": "vojtech.cermak@tesena.com" },
  "EmployeeID": "Testovací Zaměstnanec 999",
  "PlaceOfVisit": "Plzeň",
  "Journey_from_Location": "Praha",
  "Departing_when": "01/10/2026 07:00:00",
  "Returning_When": "01/10/2026 17:30:00",
  "travel_type": "Domestic",
  "Transport": "Car",
  "client_name": "Test klient",
  "PurposeOfVisit": "Smoke test přijímacího toku"
}
```

**[OVĚŘIT]** po bodě 0, jestli `employee` posílat vnořeně (jako výše), nebo jako plochý klíč `"employee.email"`. Tvar musí odpovídat tomu, co skutečně posílá Zoho.

Očekávaný výsledek: záznam TEST-ZOHO-001 v Travel Claims (`TravelType` domestic, `TransportType` AUV, `DateFrom`/`DateTo` 2026-10-01, `Destination` Plzeň, `Client` Test klient). Po testu záznam smazat, případně i Vyúčtování za 2026-10, pokud ho tok založil.

Negativní testy:
1. Bez `Departing_when` → 400, `fields: ["Departing_when"]`.
2. `ApprovalStatus: "Pending"` → 200 `ignored`, žádný záznam.
3. Stejný `TravelID` podruhé → podle dnešní kontroly duplicit (**[OVĚŘIT V TOKU]**), žádný druhý záznam.
