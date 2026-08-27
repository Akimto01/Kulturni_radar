# API testovací nástroje

Kulturní radar – cvičný projekt `api-tests/`

## 1. K čemu tyto nástroje v projektu používáme

Projekt Kulturní radar má samostatnou složku `api-tests/`, která slouží
jako cvičný prostor pro přípravu na pracovní pohovor – cílem je
prakticky si osahat tři běžně používané nástroje pro testování API na
reálném, běžícím produkčním backendu (Google Apps Script `/exec`
endpoint), ne na uměle vytvořeném cvičném API.

Všechny tři nástroje testují stejnou sadu 8 scénářů (`GET meta`,
přihlášení se správným/špatným PINem, přepnutí oblíbené položky pro
platného/neplatného uživatele, přijetí e-mailového tipu s platným/
chybějícím tokenem a negativní test na neznámou akci) – stejné testy,
tři různé nástroje, aby šlo srovnat jejich přístup, syntaxi a chování.

### SoapUI

Použit pro deklarativní i skriptované funkční testy nad REST API.
Cvičná sada obsahuje 8 test cases; kvůli způsobu, jakým SoapUI (přes
Apache HttpClient) zpracovává HTTP přesměrování, muselo být 7 z 8
kroků přepsáno z běžného REST Test Requestu na Groovy skript s ručním
zpracováním přesměrování – což je samo o sobě cenná ukázka reálného
problému, na jaký lze při testování API narazit.

### Bruno

Lehčí, git-friendly alternativa k Postmanu – stejná sada requestů,
ale bez potřeby speciálního řešení přesměrování (Bruno metodu při 302
mění na GET stejně jako běžný prohlížeč). Ukazuje, jak stejný problém
řeší jiný nástroj úplně jinak, jen díky odlišné výchozí implementaci
HTTP klienta.

### JMeter

Použit na zátěžové testování – simuluje víc souběžných požadavků na
dva klíčové endpointy (`?api=meta` a `?api=events`) a měří odezvu,
chybovost a propustnost. Výsledky (0 % chybovost, ale velký rozptyl
mezi min/max latencí) potvrdily už dříve zdokumentované chování Apps
Scriptu – pomalý „studený start" u prvního požadavku v každém vlákně,
rychlejší odezva u dalších.

## 2. Charakteristika nástrojů – přehled a rozdíly

| | SoapUI | Bruno | JMeter |
|---|---|---|---|
| Účel | Funkční testování API (jednotlivé požadavky + asserty) | Funkční testování API (interaktivní klient) | Zátěžové / výkonnostní testování |
| Typ nástroje | Desktopová Java aplikace, GUI + CLI runner | Desktopová aplikace (Electron), GUI | Desktopová Java aplikace, GUI + CLI runner |
| Formát projektu | XML (`.xml`) | Textové `.bru` soubory (git-friendly) | XML (`.jmx`) |
| Přesměrování (302) | Ve výchozím nastavení zachovává metodu (POST zůstává POST) – vyžadovalo ruční Groovy řešení | Standardně mění POST na GET podle běžné praxe prohlížečů – funguje bez úprav | Řeší se v konfiguraci requestu, mimo scope tohoto projektu |
| Skriptování | Groovy (plnohodnotný jazyk, velká síla i složitost) | JavaScript (pre/post-request skripty) | Groovy / BeanShell (pro pokročilé scénáře) |
| Typický výstup | PASS/FAIL na test case, log řádky | Odpověď přímo v UI (JSON, hlavičky, status) | Souhrnné statistiky (průměr, min/max, chybovost, throughput) |

### Obecné shrnutí

**SoapUI** – nejstarší a nejkomplexnější ze tří, tradičně silný hlavně
v SOAP/XML světě (odtud název), dnes plně podporuje i REST. Vhodný
pro komplexní testovací sady s podrobnými asserty a workflow mezi
kroky. Groovy skriptování dává velkou sílu, ale i vyšší nároky na
znalost jazyka.

**Bruno** – moderní, jednoduchý nástroj zaměřený na rychlé, přehledné
testování a spolupráci v týmu (kolekce jsou obyčejné textové soubory,
takže se dobře verzují v gitu, na rozdíl od Postmanu). Ideální pro
každodenní ruční i automatizované ověřování API během vývoje.

**JMeter** – standardní open-source nástroj pro zátěžové a
výkonnostní testování, umí simulovat stovky až tisíce souběžných
uživatelů. Není určen pro běžné funkční testování jednoho požadavku,
ale pro odpověď na otázku „jak se systém chová pod zátěží".

---
Vytvořeno jako doprovodný materiál k přípravě na pracovní pohovor,
27. 8. 2026.
