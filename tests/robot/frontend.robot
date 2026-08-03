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

Karty mají ikony pro Oblíbené a Navštívené
    [Documentation]    v3.9: jen existence prvků – NEKLIKÁME na ikony (☆/○), protože
    ...                klik zapisuje do produkčního listu OZNAČENÍ. Bezpečné pro
    ...                automatický nedělní běh, protože nic nemutuje.
    ${hvezdy}=    Get Element Count    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.hvezda
    ${fajfky}=    Get Element Count    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.fajfka
    Should Be Equal As Integers    ${hvezdy}    1
    Should Be Equal As Integers    ${fajfky}    1

Chip Oblíbené filtruje bez zápisu do tabulky
    [Documentation]    Klik na CHIP (ne na ikonu karty!) je čistě klientský filtr –
    ...                nevolá apiToggle, nic nezapisuje. Bezpečné pro CI.
    ${vsech}=    Get Element Count    ${FRAME} .karta
    Click    ${FRAME} \#chip-oblibene
    Sleep    300ms   # čisté prekreslení, žádný síťový požadavek
    ${je_prazdno}=    Get Element Count    ${FRAME} \#status
    ${oblibenych}=    Get Element Count    ${FRAME} .karta
    Should Be True    ${je_prazdno} == 1 or ${oblibenych} < ${vsech}
    ...    msg=Filtr Oblíbené buď ukáže prázdný stav, nebo užší podmnožinu karet
    Click    ${FRAME} \#chip-oblibene
    Sleep    300ms
    ${zpet}=    Get Element Count    ${FRAME} .karta
    Should Be Equal As Integers    ${zpet}    ${vsech}
    ...    msg=Opětovný klik na chip vrátí plný seznam

★ Oblíbené: lze označit i odznačit (obojí ověřeno reloadem)
    [Documentation]    Plný cyklus pro ikonu ★/☆ – viz sdílený keyword níže.
    ...                ${puvodni} má bezpečnou výchozí hodnotu ještě PŘED rizikovým
    ...                voláním – kdyby hlavní keyword spadl hned na prvním kroku
    ...                (např. element vůbec neexistuje – špatně nasazený frontend),
    ...                teardown nespadne na "Variable not found", ale poctivě
    ...                nahlásí SKUTEČNOU příčinu (chybějící element).
    [Teardown]    Run Keyword And Ignore Error
    ...    Nastavit ikonu první karty na    hvezda    ${puvodni}
    ${puvodni}=    Set Variable    ${FALSE}
    ${puvodni}=    Ověřit plný cyklus označení (přidat i odebrat) s reloadem    hvezda

✓ Navštívené: lze označit i odznačit (obojí ověřeno reloadem)
    [Documentation]    Stejný scénář jako u hvězdičky, jen pro ikonu ✓/○ (typ 'navstiveno').
    ...                Nezávislý sloupec v OZNAČENÍ – ověřuje, že apiToggle funguje
    ...                stejně spolehlivě pro oba typy, ne jen pro ten testovaný dřív.
    [Teardown]    Run Keyword And Ignore Error
    ...    Nastavit ikonu první karty na    fajfka    ${puvodni}
    ${puvodni}=    Set Variable    ${FALSE}
    ${puvodni}=    Ověřit plný cyklus označení (přidat i odebrat) s reloadem    fajfka

Tlačítko Spustit kontrolu otevře token dialog (bez spuštění)
    [Documentation]    Jen UI tok – dialog se otevře a Zrušit ho zavře.
    ...                Skutečné spuštění (validní token) do E2E nepatří.
    Click    ${FRAME} \#fab
    Wait For Elements State    ${FRAME} \#token-dialog.open    visible    timeout=5s
    Click    ${FRAME} \#token-cancel
    Wait For Elements State    ${FRAME} \#token-dialog.open    detached    timeout=5s

*** Keywords ***
Zjistit je-li ikona první karty aktivní
    [Arguments]    ${trida_ikony}
    ${trida}=    Get Attribute    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.${trida_ikony}    class
    ${aktivni}=    Run Keyword And Return Status    Should Contain    ${trida}    aktivni
    RETURN    ${aktivni}

Ikona první karty má být
    [Arguments]    ${trida_ikony}    ${ocekavano}    ${msg}=${NONE}
    ${je}=    Zjistit je-li ikona první karty aktivní    ${trida_ikony}
    IF    $msg is None
        Should Be Equal    ${je}    ${ocekavano}
    ELSE
        Should Be Equal    ${je}    ${ocekavano}    msg=${msg}
    END

Nastavit ikonu první karty na
    [Arguments]    ${trida_ikony}    ${ma_byt_aktivni}
    [Documentation]    Idempotentní „set to X": přečte AKTUÁLNÍ stav a klikne jen
    ...    tehdy, když se liší od požadovaného. Použito jako [Teardown] – funguje
    ...    správně bez ohledu na to, v jakém kroku test případně spadl.
    ${je}=    Zjistit je-li ikona první karty aktivní    ${trida_ikony}
    IF    ${je} != ${ma_byt_aktivni}
        Click    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.${trida_ikony}
        Wait Until Keyword Succeeds    10s    500ms
        ...    Ikona první karty má být    ${trida_ikony}    ${ma_byt_aktivni}
    END

Ověřit plný cyklus označení (přidat i odebrat) s reloadem
    [Arguments]    ${trida_ikony}
    [Documentation]    Nezávisle na výchozím stavu otestuje OBĚ operace:
    ...    1) přepne na OPAK výchozího stavu → Reload → ověří, že persistuje
    ...       (tj. „přidat označení" NEBO „odebrat označení" – podle výchozí hodnoty),
    ...    2) přepne ZPĚT na výchozí stav → Reload → ověří, že i tohle persistuje
    ...       (tedy ten opačný scénář oproti kroku 1 – takže dohromady jsou
    ...       ověřené OBĚ operace: označit i odznačit).
    ...    Na konci je stav vždy shodný s tím, co bylo na začátku. Vrací původní
    ...    stav, aby ho volající test mohl předat [Teardown] jako pojistku.
    ${puvodni}=    Zjistit je-li ikona první karty aktivní    ${trida_ikony}
    ${opak}=    Evaluate    not ${puvodni}

    Click    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.${trida_ikony}
    Wait Until Keyword Succeeds    10s    500ms
    ...    Ikona první karty má být    ${trida_ikony}    ${opak}
    ...    msg=Krok 1 (přepnutí na opak): optimistická odezva se neprojevila – ${trida_ikony}
    Reload
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=20s
    Ikona první karty má být    ${trida_ikony}    ${opak}
    ...    msg=Krok 1: po reloadu se přepnutí nepodrželo – zápis do OZNAČENÍ neproběhl (${trida_ikony})

    Click    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.${trida_ikony}
    Wait Until Keyword Succeeds    10s    500ms
    ...    Ikona první karty má být    ${trida_ikony}    ${puvodni}
    ...    msg=Krok 2 (návrat na původní): optimistická odezva se neprojevila – ${trida_ikony}
    Reload
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=20s
    Ikona první karty má být    ${trida_ikony}    ${puvodni}
    ...    msg=Krok 2: po reloadu se návrat na původní stav nepodržel (${trida_ikony}) – produkční data mohou zůstat pozměněná!

    RETURN    ${puvodni}

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
