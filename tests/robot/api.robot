*** Settings ***
Documentation     API kontrakt Kulturního radaru (doGet JSON endpointy).
...
...               Spuštění:
...               robot --variable BASE_URL:https://script.google.com/macros/s/.../exec tests/robot/api.robot
...
...               Pozn.: Apps Script odpovídá 302 přesměrováním na googleusercontent.com –
...               RequestsLibrary redirecty následuje automaticky.
Library           RequestsLibrary
Library           Collections
Library           String

*** Variables ***
${BASE_URL}       %{RADAR_URL=https://example.com/exec}
# Regex českého data „d. M. yyyy“ – regresní pojistka na bug v3.2/3.3
# (sériová čísla 46156 a Date objekty „FRI AUG 07…“ v API výstupu)
${DATUM_RE}       ^\\d{1,2}\\. \\d{1,2}\\. \\d{4}$

*** Test Cases ***
Meta vrací aktivní profil, profily a kategorie
    ${r}=    GET    ${BASE_URL}    params=api=meta
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Be True    ${j}[ok]
    Should Not Be Empty    ${j}[aktivniProfil]
    ${pocet}=    Get Length    ${j}[profily]
    Should Be True    ${pocet} >= 1    Očekávám aspoň jeden profil v LOKALITÁCH
    List Should Contain Value    ${j}[kategorie]    koncerty

Events vrací akce s validními českými datumy
    [Documentation]    Regresní test bugů v3.2–3.3: datumOd nesmí být
    ...                sériové číslo (46156) ani anglický Date string.
    ${r}=    GET    ${BASE_URL}    params=api=events
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Be True    ${j}[ok]
    ${pocet}=    Get Length    ${j}[akce]
    Should Be True    ${pocet} >= 1    Databáze nemá být prázdná
    FOR    ${akce}    IN    @{j}[akce]
        Should Not Be Empty    ${akce}[nazev]
        Should Match Regexp    ${akce}[datumOd]    ${DATUM_RE}
        ...    msg=datumOd „${akce}[datumOd]“ u „${akce}[nazev]“ není české datum
    END

Events umí filtrovat podle profilu
    ${r}=    GET    ${BASE_URL}    params=api=events&profil=Ostrava
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Be True    ${j}[ok]
    Should Be Equal    ${j}[profil]    Ostrava

Places vrací stálá místa se skóre
    ${r}=    GET    ${BASE_URL}    params=api=places
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Be True    ${j}[ok]
    ${pocet}=    Get Length    ${j}[mista]
    Should Be True    ${pocet} >= 1    MÍSTA mají být naplněná

Neznámý endpoint vrací chybu, ne pád
    ${r}=    GET    ${BASE_URL}    params=api=neexistuje
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Not Be True    ${j}[ok]

Spuštění kontroly s neplatným tokenem je odmítnuto
    [Documentation]    Testuje POUZE zamítací větev – platný token by spustil
    ...                skutečnou kontrolu (API kredit + cooldown), to do CI nepatří.
    ...                GET varianta (?api=run) – POST přes redirect ztrácí tělo
    ...                (requests mění POST→GET na 302, Apps Script echo vrací prázdno).
    ${r}=    GET    ${BASE_URL}    params=api=run&token=spatny-token
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Not Be True    ${j}[ok]
    Should Contain    ${j}[error]    token
