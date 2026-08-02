*** Settings ***
Documentation     E2E testy frontendu Kulturního radaru (Browser Library / Playwright).
...
...               Příprava (jednou):  rfbrowser init chromium
...               Spuštění:  robot --variable BASE_URL:https://script.google.com/macros/s/.../exec tests/robot/frontend.robot
...
...               DŮLEŽITÉ – Apps Script sandbox: web app balí uživatelské HTML
...               do dvou vnořených iframe (#sandboxFrame > #userHtmlFrame).
...               Selector Prefix s frame-piercing syntaxí „>>>“ zajistí,
...               že všechny selektory míří dovnitř aplikace.
Library           Browser
Suite Setup       Otevřít radar
Suite Teardown    Close Browser

*** Variables ***
${BASE_URL}       %{RADAR_URL=https://example.com/exec}
${FRAME}          id=sandboxFrame >>> id=userHtmlFrame >>>
${DATUM_RE}       ^\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?\\d{4}$
${PROBIHA_LABEL}    Probíhá / dlouhodobé

*** Test Cases ***
Hlavička a základní prvky jsou na místě
    Get Text       ${FRAME} header h1        contains    KULTURNÍ RADAR
    Get Element    ${FRAME} \#profil-select
    Get Element    ${FRAME} \#fab

Přepínač profilů je naplněn z meta API
    ${pocet}=    Get Element Count    ${FRAME} \#profil-select option
    Should Be True    ${pocet} >= 1    Select má mít aspoň jeden profil

Chipy kategorií se vykreslily
    ${pocet}=    Get Element Count    ${FRAME} .chip
    Should Be True    ${pocet} >= 4    Vše + aspoň 3 kategorie z KRITÉRIÍ

Karty akcí se načetly a hlavičky dnů jsou česká data
    [Documentation]    Regresní test bugu v3.2–3.3 přímo v UI:
    ...                den-hlavicka nesmí být „46156“ ani „FRI AUG 07…“.
    ...                Od v3.3 frontendu je povolena i jediná nedatumová
    ...                hlavička: sekce „Probíhá / dlouhodobé“.
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=15s
    ${karty}=    Get Element Count    ${FRAME} .karta
    Should Be True    ${karty} >= 1
    ${hlavicky}=    Get Elements    ${FRAME} .den-hlavicka
    FOR    ${h}    IN    @{hlavicky}
        ${text}=    Get Text    ${h}
        # Get Text vrací text po CSS text-transform (uppercase) → srovnávat necitlivě
        IF    $text.upper().strip() == $PROBIHA_LABEL.upper()
            CONTINUE
        END
        Should Match Regexp    ${text}    ${DATUM_RE}
        ...    msg=Hlavička dne „${text}“ není české datum
    END

Dlouhodobé akce nevytvářejí hlavičky s minulým datem
    [Documentation]    Regrese v3.3 frontendu: akce začínající v minulosti
    ...                (např. celoléto běžící série) se řadí do sekce
    ...                „Probíhá / dlouhodobé“, která je vždy úplně první —
    ...                žádná datumová hlavička nesmí být starší než dnešek.
    ${hlavicky}=    Get Elements    ${FRAME} .den-hlavicka
    ${i}=    Set Variable    ${0}
    FOR    ${h}    IN    @{hlavicky}
        ${text}=    Get Text    ${h}
        IF    $text.upper().strip() == $PROBIHA_LABEL.upper()
            Should Be Equal As Integers    ${i}    0
            ...    msg=Sekce „Probíhá / dlouhodobé“ musí být první hlavička
        ELSE
            Should Be True
            ...    datetime.datetime.strptime($text.replace(' ', ''), '%d.%m.%Y').date() >= datetime.date.today()
            ...    msg=Denní hlavička „${text}“ je v minulosti
        END
        ${i}=    Evaluate    ${i} + 1
    END

Filtr kategorie omezí karty a Vše je vrátí
    ${vsech}=    Get Element Count    ${FRAME} .karta
    Click    ${FRAME} .chip >> text=koncerty
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=5s
    ${filtrovanych}=    Get Element Count    ${FRAME} .karta
    Should Be True    ${filtrovanych} <= ${vsech}
    Should Be True    ${filtrovanych} >= 1    Koncerty v Brně vždycky nějaké jsou
    Click    ${FRAME} .chip >> text=Vše
    ${zpet}=    Get Element Count    ${FRAME} .karta
    Should Be Equal As Integers    ${zpet}    ${vsech}

Sekce stálých míst existuje
    Wait For Elements State    ${FRAME} \#mista-sekce .misto-karta >> nth=0    visible    timeout=15s
    ${mist}=    Get Element Count    ${FRAME} .misto-karta
    Should Be True    ${mist} >= 1

Tlačítko Spustit kontrolu otevře token dialog (bez spuštění)
    [Documentation]    Jen UI tok – dialog se otevře a Zrušit ho zavře.
    ...                Skutečné spuštění (validní token) do E2E nepatří.
    Click    ${FRAME} \#fab
    Wait For Elements State    ${FRAME} \#token-dialog.open    visible    timeout=5s
    Click    ${FRAME} \#token-cancel
    Wait For Elements State    ${FRAME} \#token-dialog.open    detached    timeout=5s

*** Keywords ***
Otevřít radar
    New Browser    chromium    headless=True
    New Context    viewport={'width': 1280, 'height': 900}
    New Page       ${BASE_URL}
    # Apps Script shell → počkat na vnitřní aplikaci
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    # Data přicházejí asynchronně přes google.script.run → počkat na
    # první chip (meta hotová) a první kartu (events hotové), jinak
    # county v testech běží proti prázdnému UI (race condition).
    Wait For Elements State    ${FRAME} .chip >> nth=0     visible    timeout=20s
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=20s
