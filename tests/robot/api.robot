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
${NTFY_TOPIC}      %{NTFY_TOPIC=}
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

Events obsahují pole lat/lng pro souřadnice (v3.14)
    [Documentation]    Schema check – lat/lng musí být v odpovědi přítomné
    ...    klíče (hodnota null, dokud se lokalita ještě negeokódovala na
    ...    pozadí po dalším běhu kontroly). Chytí regresi, kdyby pole zmizelo.
    ${r}=    GET    ${BASE_URL}    params=api=events
    ${j}=    Set Variable    ${r.json()}
    ${prvni}=    Set Variable    ${j}[akce][0]
    Dictionary Should Contain Key    ${prvni}    lat
    Dictionary Should Contain Key    ${prvni}    lng

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

Notifikační kanál ntfy je živý
    [Documentation]    Monitorovací assert (backlog): radar posílá notifikaci
    ...                minimálně 1× denně (ranní kontrola 8:00), takže pokud
    ...                za posledních 48 h na ntfy nedorazilo NIC, kanál je
    ...                nejspíš mrtvý (špatný topic, tichá chyba sendNotification_,
    ...                změna ntfy API) – a nikdo si toho jinak nevšimne,
    ...                protože mrtvý kanál nemá jak křičet.
    ...                Topic je soukromý → bez ${NTFY_TOPIC} se test přeskočí.
    Skip If    '${NTFY_TOPIC}' == ''    NTFY_TOPIC nenastaven – test přeskočen
    ${r}=    GET    https://ntfy.sh/${NTFY_TOPIC}/json    params=poll=1&since=48h
    Status Should Be    200    ${r}
    ${radky}=    Split To Lines    ${r.text}
    ${zprav}=    Set Variable    ${0}
    FOR    ${radek}    IN    @{radky}
        ${j}=    Evaluate    json.loads($radek)    modules=json
        IF    '${j}[event]' == 'message'
            ${zprav}=    Evaluate    ${zprav} + 1
        END
    END
    Should Be True    ${zprav} >= 1
    ...    Za 48 h nepřišla na ntfy žádná zpráva – notifikační kanál je nejspíš mrtvý
