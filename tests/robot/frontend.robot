*** Settings ***
Documentation     E2E testy frontendu Kulturního radaru (Browser Library / Playwright).
...
...               Příprava (jednou):  rfbrowser init chromium
...               Spuštění (výchozí cíl – statická doména, žádný iframe):
...               robot tests/robot/frontend.robot
...
...               Spuštění proti Apps Scriptu (sandboxovaný iframe, frame-piercing
...               prefix nutný – viz FRAME v resources.robot):
...               robot --variable SITE_URL:https://script.google.com/macros/s/.../exec ^
...               --variable FRAME:"id=sandboxFrame >>> id=userHtmlFrame >>>" tests/robot/frontend.robot
Library           Browser
Resource          resources.robot
Suite Setup       Otevřít radar
Suite Teardown    Close Browser

*** Variables ***
${PROBIHA_LABEL}    Probíhá / dlouhodobé

*** Test Cases ***
Hlavička a základní prvky jsou na místě
    Get Text       ${FRAME} header h1        contains    KULTURNÍ RADAR
    Get Element    ${FRAME} \#profil-select
    Get Element    ${FRAME} \#fab

Přihlašovací obrazovka nabízí dlaždice profilů k výběru
    [Documentation]    v3.14: appka startuje anonymně – login overlay se otevírá
    ...    badgem "Přihlásit se". Vlastní nezávislá stránka, aby test ověřil
    ...    počáteční stav bez ovlivnění přihlášení sdílené stránky.
    New Page    ${SITE_URL}
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    Click    ${FRAME} \#uzivatel-badge
    Wait For Elements State    ${FRAME} \#login-dlazdice .dlazdice-uzivatel >> nth=0    visible    timeout=15s
    ${pocet}=    Get Element Count    ${FRAME} \#login-dlazdice .dlazdice-uzivatel
    Should Be True    ${pocet} >= 1    Má se nabídnout aspoň jeden uživatelský profil
    ${existuje}=    Get Element Count    ${FRAME} .dlazdice-uzivatel[data-uzivatel-id="${RF_TEST_USER_ID}"]
    Should Be Equal As Integers    ${existuje}    1
    ...    msg=Testovací profil RF_TEST_USER_ID se mezi dlaždicemi nenašel – je založený v UŽIVATELÍCH?
    Close Page

Anonymní režim: appka funguje bez přihlášení a ★ vyžádá login (vlastní stránka)
    [Documentation]    v3.14: klíčový test nového chování (rozhodnutí 8. 8. 2026).
    ...    1) Appka se načte rovnou s kartami, BEZ přihlašovacího overlay.
    ...    2) Klik na ★ v anonymním stavu NEZAPÍŠE nic – místo toho otevře
    ...    login overlay s vysvětlením. Overlay jde zavřít "Pokračovat bez
    ...    přihlášení" a appka zůstává funkční.
    New Page    ${SITE_URL}
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=20s
    ${overlay_na_startu}=    Get Element Count    ${FRAME} \#login-overlay:not(.skryto)
    Should Be Equal As Integers    ${overlay_na_startu}    0
    ...    msg=Appka má startovat anonymně – login overlay NESMÍ být na startu viditelný
    Click    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.hvezda
    Wait For Elements State    ${FRAME} \#login-overlay:not(.skryto)    visible    timeout=10s
    ${duvod}=    Get Text    ${FRAME} \#login-duvod
    Should Contain    ${duvod}    přihlas    msg=Overlay má vysvětlit, PROČ se objevil (hláška s výzvou k přihlášení)
    Click    ${FRAME} \#login-pokracovat-bez
    Wait For Elements State    ${FRAME} \#login-overlay    hidden    timeout=5s
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=5s
    Close Page

Špatný PIN zobrazí chybu a nepřihlásí (vlastní stránka)
    [Documentation]    Vlastní nezávislá stránka – viz dokumentace testu výš.
    ...    Záměrně syntakticky platný PIN (splňuje pinVypadaPlatne_, 4–8 znaků,
    ...    bez mezer), jen espere nesprávný, ať se otestuje SERVEROVÁ validace,
    ...    ne jen klientská. v3.14: overlay se otevírá badgem.
    New Page    ${SITE_URL}
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    Click    ${FRAME} \#uzivatel-badge
    Wait For Elements State    ${FRAME} \#login-dlazdice .dlazdice-uzivatel >> nth=0    visible    timeout=15s
    Click    ${FRAME} .dlazdice-uzivatel[data-uzivatel-id="${RF_TEST_USER_ID}"]
    Wait For Elements State    ${FRAME} \#login-pin-sekce.zobrazit    visible    timeout=5s
    Fill Text    ${FRAME} \#login-pin    0000000
    Click    ${FRAME} \#login-potvrdit
    Wait For Elements State    ${FRAME} \#login-chyba    visible    timeout=10s
    ${chyba}=    Get Text    ${FRAME} \#login-chyba
    Should Not Be Empty    ${chyba}
    ${stale_prihlasovaci}=    Get Element Count    ${FRAME} \#login-overlay:not(.skryto)
    Should Be Equal As Integers    ${stale_prihlasovaci}    1
    ...    msg=Po špatném PINu appka NESMÍ přihlásit – overlay musí zůstat viditelný
    Close Page

Odhlášení vrátí appku do anonymního režimu (vlastní stránka)
    [Documentation]    Regresní pojistka na bug ze 7. 8. 2026 (location.reload()
    ...    v sandboxovaném iframu → prázdná stránka) + v3.14 chování: po
    ...    odhlášení se appka vrací do FUNKČNÍHO anonymního režimu (karty
    ...    viditelné, badge zpět na "Přihlásit se"), žádný vynucený login.
    New Page    ${SITE_URL}
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    Přihlásit se do radaru    ${RF_TEST_USER_ID}    ${RF_TEST_PIN}
    Click    ${FRAME} \#uzivatel-badge
    Wait For Elements State    ${FRAME} \#filtry-dialog.open    visible    timeout=5s
    Click    ${FRAME} \#filtry-odhlasit
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=15s
    ${overlay}=    Get Element Count    ${FRAME} \#login-overlay:not(.skryto)
    Should Be Equal As Integers    ${overlay}    0
    ...    msg=Po odhlášení má appka zůstat funkční anonymně, ne vynucovat login
    ${badge}=    Get Text    ${FRAME} \#uzivatel-badge
    Should Contain    ${badge}    Přihlásit    msg=Badge se má vrátit na "Přihlásit se"
    Close Page

Profil: dialog obsahuje osobní filtry a tlačítko Najít akce pro mě (bez spuštění)
    [Documentation]    Jen existence prvků a otevření/zavření dialogu – NEKLIKÁME
    ...    na "Najít akce pro mě", protože by to spustilo skutečné (placené)
    ...    AI hledání. Stejný princip jako u FABu níž.
    Click    ${FRAME} \#uzivatel-badge
    Wait For Elements State    ${FRAME} \#filtry-dialog.open    visible    timeout=5s
    Get Element    ${FRAME} \#filtry-kategorie
    Get Element    ${FRAME} \#filtry-dojezd
    Get Element    ${FRAME} \#filtry-hledat
    Click    ${FRAME} \#filtry-zavrit
    Wait For Elements State    ${FRAME} \#filtry-dialog.open    detached    timeout=5s

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
    # v3.13→oprava: .den-hlavicka se používá i pro hlavičky TYPŮ stálých míst
    # (renderMista, zobrazují se jen když má profil 2+ typů – proto test dlouho
    # procházel a spadl až s příchodem druhého typu „aquapark" v Brně).
    # :not() vyloučí hlavičky uvnitř #mista-sekce, zůstanou jen denní hlavičky akcí.
    ${hlavicky}=    Get Elements    ${FRAME} .den-hlavicka:not(#mista-sekce .den-hlavicka)
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
    # v3.13→oprava: vyloučit hlavičky typů stálých míst – viz test výš.
    ${hlavicky}=    Get Elements    ${FRAME} .den-hlavicka:not(#mista-sekce .den-hlavicka)
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
    [Documentation]    v3.10: selektor zúžen na \#kat-chips – od chipů typů
    ...    stálých míst (které mají vlastní tlačítko „Vše") jinak nastává
    ...    strict-mode kolize (dva prvky s textem „Vše" na stránce).
    ${vsech}=    Get Element Count    ${FRAME} .karta
    Click    ${FRAME} \#kat-chips .chip >> text=koncerty
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=5s
    ${filtrovanych}=    Get Element Count    ${FRAME} .karta
    Should Be True    ${filtrovanych} <= ${vsech}
    Should Be True    ${filtrovanych} >= 1    Koncerty v Brně vždycky nějaké jsou
    Click    ${FRAME} \#kat-chips .chip >> text=Vše
    ${zpet}=    Get Element Count    ${FRAME} .karta
    Should Be Equal As Integers    ${zpet}    ${vsech}

Sekce stálých míst existuje
    Wait For Elements State    ${FRAME} \#mista-sekce .misto-karta >> nth=0    visible    timeout=15s
    ${mist}=    Get Element Count    ${FRAME} .misto-karta
    Should Be True    ${mist} >= 1

Karta má odkaz Do kalendáře
    [Documentation]    v3.10: 📅 Do kalendáře je čistě klientský odkaz (Google
    ...    Calendar šablonová URL) – žádné volání serveru, bezpečné otevřít i
    ...    kliknout by bylo bezpečné, ale stačí ověřit existenci a text odkazu.
    ${text}=    Get Text    ${FRAME} .karta >> nth=0 >> .karta-akce
    Should Contain    ${text}    Do kalendáře

Karta má tlačítko Sdílet
    [Documentation]    v3.13: existence tlačítka „📤 Sdílet". NEKLIKÁME –
    ...    navigator.share/clipboard uvnitř sandboxovaného iframe se v headless
    ...    testovacím prohlížeči chová nedeterministicky (může otevřít systémový
    ...    dialog nebo tiše selhat na oprávněních); existence prvku je vše, co
    ...    tady chceme spolehlivě ověřit.
    ${text}=    Get Text    ${FRAME} .karta >> nth=0 >> .karta-akce
    Should Contain    ${text}    Sdílet

Tlačítko Sdílet výběr existuje
    [Documentation]    v3.20: existence tlačítka „📤 Sdílet výběr" vedle
    ...    ★ Oblíbené / ✓ Navštívené. NEKLIKÁME – stejný důvod jako u tlačítka
    ...    Sdílet na kartě výše (nedeterministické Web Share/clipboard chování
    ...    v headless prohlížeči).
    ${text}=    Get Text    ${FRAME} \#btn-sdilet-vyber
    Should Contain    ${text}    Sdílet výběr

Karta má odkaz Mapa
    [Documentation]    v3.13: 📍 Mapa je čistě klientský odkaz (Google Maps
    ...    URL schéma, žádný API klíč) – existence a text stačí ověřit stejně
    ...    jako u Do kalendáře.
    ${text}=    Get Text    ${FRAME} .karta >> nth=0 >> .karta-akce
    Should Contain    ${text}    Mapa

Políčko počasí se zobrazuje správně
    [Documentation]    v3.25: ověřuje, že políčko počasí u karty akce má
    ...    SPRÁVNÝ typ obsahu, ne jen že appka nespadla – buď ikona+teplota
    ...    (stav OK, případně CHYBA se zachovanou hodnotou – viz
    ...    pocasiZobrazeni_ v Index.html), nebo viditelné tlumené „N/A“
    ...    (stav NA, případně CHYBA bez hodnoty). Selektory zúžené na
    ...    \#.karta stejně jako u chipů (viz „Filtr kategorie…“ výš a
    ...    SKILL.md sekce 2 – kolize obecných tříd). Data v POČASÍ listu
    ...    jsou nedeterministická (závisí na tom, které akce má trigger
    ...    zrovna spočítané) – pokud se nenajde ani jeden ze dvou stavů,
    ...    test se přeskočí, ne padá.
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=15s
    ${ok_pocet}=    Get Element Count    ${FRAME} .karta .pocasi-ok
    ${na_pocet}=    Get Element Count    ${FRAME} .karta .pocasi-na
    Skip If    ${ok_pocet} == 0 and ${na_pocet} == 0
    ...    Žádná karta nemá viditelné políčko počasí (ani .pocasi-ok, ani .pocasi-na) – POČASÍ list nejspíš zatím nemá data pro žádnou zobrazenou akci
    IF    ${ok_pocet} > 0
        ${text}=    Get Text    ${FRAME} .karta .pocasi-ok >> nth=0
        Should Contain    ${text}    °C
        ...    msg=Stav OK: políčko počasí „${text}“ neobsahuje teplotu (°C) – formát pocasiZobrazeni_ neodpovídá
        Should Not Be Equal    ${text}    N/A
        ...    msg=Stav OK: políčko počasí zobrazuje N/A, i když má třídu pocasi-ok – neshoda mezi stavem a obsahem
    END
    IF    ${na_pocet} > 0
        ${text}=    Get Text    ${FRAME} .karta .pocasi-na >> nth=0
        Should Be Equal    ${text}    N/A
        ...    msg=Stav N/A: text políčka „${text}“ neodpovídá očekávanému „N/A“
        Get Style    ${FRAME} .karta .pocasi-na >> nth=0    key=opacity    assertion_operator=<    assertion_expected=1
        ...    message=Stav N/A: políčko nemá tlumený styl (opacity >= 1) – vizuálně by nemělo splývat s běžnou ikonou počasí
    END

Chip typu stálého místa zúží seznam (pokud profil má 2+ typů)
    [Documentation]    v3.10: chipy typů se vykreslí jen když má profil 2+
    ...    různé typy míst (viz Index.html renderMista – chip „Vše" + 1 typ by
    ...    byl k ničemu). Test je proto podmíněný na DATECH profilu, ne na
    ...    stavu aplikace – to není „Skip" ve smyslu, kterému jsme se dřív
    ...    vyhýbali (skrývání nejistoty o kódu), ale korektní chování podle
    ...    množství typů míst, které se den ze dne mění. Klik na chip je čistě
    ...    klientský filtr, bez zápisu – bezpečné pro CI.
    ${pocet_chipu}=    Get Element Count    ${FRAME} \#mista-sekce .chip
    IF    ${pocet_chipu} >= 2
        ${vsech}=    Get Element Count    ${FRAME} .misto-karta
        Click    ${FRAME} \#mista-sekce .chip >> nth=1
        Sleep    300ms
        ${filtrovanych}=    Get Element Count    ${FRAME} .misto-karta
        Should Be True    ${filtrovanych} <= ${vsech}
        Should Be True    ${filtrovanych} >= 1
        ...    msg=Vybraný typ místa by měl mít aspoň jedno místo (jinak by se chip nevykreslil)
        Click    ${FRAME} \#mista-sekce .chip >> text=Vše
        Sleep    300ms
        ${zpet}=    Get Element Count    ${FRAME} .misto-karta
        Should Be Equal As Integers    ${zpet}    ${vsech}
    ELSE
        Log    Profil má aktuálně jen ${pocet_chipu} chip(y) typů míst (0 nebo 1 typ celkem) – chipy filtru se korektně nevykreslují, test nemá co ověřit v tomto běhu.    level=WARN
    END

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

Chip Neověřeno filtruje bez zápisu do tabulky
    [Documentation]    v3.27: stejný vzor jako „Chip Oblíbené" – čistě klientský
    ...                filtr nad už načtenými daty, žádné volání apiToggle/apiRun.
    ...                Bezpečné pro CI i když profil aktuálně nemá žádnou
    ...                neověřenou akci (pak stačí prázdný stav).
    ${vsech}=    Get Element Count    ${FRAME} .karta
    Click    ${FRAME} \#chip-neoverene
    Sleep    300ms
    ${je_prazdno}=    Get Element Count    ${FRAME} \#status
    ${neoverenych}=    Get Element Count    ${FRAME} .karta
    Should Be True    ${je_prazdno} == 1 or ${neoverenych} < ${vsech}
    ...    msg=Filtr Neověřeno buď ukáže prázdný stav, nebo užší podmnožinu karet
    Click    ${FRAME} \#chip-neoverene
    Sleep    300ms
    ${zpet}=    Get Element Count    ${FRAME} .karta
    Should Be Equal As Integers    ${zpet}    ${vsech}
    ...    msg=Opětovný klik na chip vrátí plný seznam

Označení ★ se skutečně promítne do filtru „★ Oblíbené" (integrace, ne jen zápis)
    [Documentation]    Rozdíl oproti „★ Oblíbené: lze označit i odznačit": tam
    ...    jsme ověřovali jen že SE ZAPÍŠE (ikona + reload). Tady ověřujeme, že
    ...    dvě samostatně postavené funkce (toggle a chip-filtr) spolu SKUTEČNĚ
    ...    spolupracují – konkrétní akce po označení musí být vidět přesně ve
    ...    filtrovaném seznamu, ne jen mít správnou ikonu.
    ...    PÍŠE do produkčního OZNAČENÍ – [Teardown] vrací původní stav.
    [Teardown]    Run Keyword And Ignore Error
    ...    Nastavit ikonu první karty na    hvezda    ${puvodni}
    ${id_karty}=    Get Attribute    ${FRAME} .karta >> nth=0    data-id
    ${puvodni}=    Zjistit je-li ikona první karty aktivní    hvezda
    ${ocekavano}=    Evaluate    not ${puvodni}

    Click    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.hvezda
    Wait For Elements State
    ...    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.hvezda:not(.ukladani)
    ...    visible    timeout=10s

    Click    ${FRAME} \#chip-oblibene
    Sleep    300ms
    ${pritomna}=    Get Element Count    ${FRAME} .karta[data-id="${id_karty}"]
    IF    ${ocekavano}
        Should Be True    ${pritomna} >= 1
        ...    msg=Po označení by karta měla být vidět ve filtru „★ Oblíbené"
    ELSE
        Should Be Equal As Integers    ${pritomna}    0
        ...    msg=Po odznačení by karta NEMĚLA být ve filtru „★ Oblíbené"
    END

    Click    ${FRAME} \#chip-oblibene
    Sleep    300ms
    Click    ${FRAME} .karta[data-id="${id_karty}"] >> .ikona-oznaceni.hvezda
    Wait For Elements State
    ...    ${FRAME} .karta[data-id="${id_karty}"] >> .ikona-oznaceni.hvezda:not(.ukladani)
    ...    visible    timeout=10s
    Ikona první karty má být    hvezda    ${puvodni}
    ...    msg=Po návratu na „Vše" a druhém přepnutí se nepodržel původní stav

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

# ── v3.43: RF pokrytí redesignu (fáze 1–3, v3.31–v3.42) ─────────────────
# M) smoke testy, N) klíčové interakce střední úrovně. Záměrně BEZ testů
# na přesné pixelové zarovnání (bod K, sticky offsety) – viz BACKLOG.md,
# odloženo jako nejkřehčí kategorie (manuální/vizuální kontrola je pro
# tohle spolehlivější a levnější než automatizace na pixel).

Stránka se načte bez JS chyby v konzoli
    [Documentation]    M) Smoke test: appka se má načíst bez neošetřené JS
    ...    výjimky (Get Page Errors – neodchycené throw) a bez
    ...    console.error() volání (Get Console Log, filtr type=error).
    ...    Vlastní nezávislá stránka, ať se chytí i chyby ze samotného
    ...    startu (init(), inicializovatMapu_ atd.), ne jen z pozdější
    ...    interakce na sdílené stránce.
    New Page    ${SITE_URL}
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=20s
    ${chyby_stranky}=    Get Page Errors    full=True
    Should Be Empty    ${chyby_stranky}
    ...    msg=Stránka vyhodila neošetřenou JS výjimku: ${chyby_stranky}
    ${log}=    Get Console Log    full=True
    ${console_chyby}=    Evaluate    [m for m in $log if m['type'] == 'error']
    Should Be Empty    ${console_chyby}
    ...    msg=Konzole obsahuje console.error() zprávy: ${console_chyby}
    Close Page

Kalendář lze otevřít a zavřít přes #kalendar-toggle (mobil)
    [Documentation]    M) #kalendar-panel je na mobilu (<900px) skládací,
    ...    výchozí zavřeno – #kalendar-toggle v hlavičce ho otevírá/zavírá
    ...    (v3.33). Na desktopu (Suite Setup, viewport 1280×900) je
    ...    #kalendar-toggle schovaný (display:none) – proto vlastní
    ...    mobilní Context, ne sdílená stránka.
    [Teardown]    Close Context    CURRENT
    Otevřít radar na mobilním viewportu
    ${otevreno_na_startu}=    Get Element Count    ${FRAME} \#kalendar-panel.otevreno
    Should Be Equal As Integers    ${otevreno_na_startu}    0
    ...    msg=Kalendář má být na mobilu na startu zavřený
    Click    ${FRAME} \#kalendar-toggle
    Wait For Elements State    ${FRAME} \#kalendar-panel.otevreno    visible    timeout=5s
    Click    ${FRAME} \#kalendar-toggle
    Wait For Elements State    ${FRAME} \#kalendar-panel.otevreno    detached    timeout=5s

Mapa lze otevřít a zavřít přes #mapa-toggle (mobil)
    [Documentation]    M) Stejný sbalitelný vzor jako kalendář (v3.40,
    ...    test výš), nezávislý na kalendáři – vlastní třída .otevreno na
    ...    #mapa-panel.
    [Teardown]    Close Context    CURRENT
    Otevřít radar na mobilním viewportu
    ${otevreno_na_startu}=    Get Element Count    ${FRAME} \#mapa-panel.otevreno
    Should Be Equal As Integers    ${otevreno_na_startu}    0
    ...    msg=Mapa má být na mobilu na startu zavřená
    Click    ${FRAME} \#mapa-toggle
    Wait For Elements State    ${FRAME} \#mapa-panel.otevreno    visible    timeout=5s
    Click    ${FRAME} \#mapa-toggle
    Wait For Elements State    ${FRAME} \#mapa-panel.otevreno    detached    timeout=5s

Mapa se vykreslí (Leaflet)
    [Documentation]    M) #mapa je bonus prvek (inicializovatMapu_ v
    ...    Index.html je no-op, pokud se Leaflet CDN nenačte) – test čeká
    ...    na vlastní Leaflet kontejner uvnitř #mapa, ne jen na prázdný
    ...    div. Běží na desktopové sdílené stránce (Suite Setup), kde je
    ...    #mapa-panel vždy vidět (≥900px, v3.35/v3.40).
    Wait For Elements State    ${FRAME} \#mapa .leaflet-container    visible    timeout=20s

Seznam míst pod mapou obsahuje řádky, pokud existují akce se souřadnicemi
    [Documentation]    M) F) #mapa-mista (v3.41) je viditelné jen na
    ...    desktopu (≥900px) a naplňuje se JEN pokud aktuálně filtrované
    ...    akce mají platné souřadnice (viz akceProMapu_/sestavSeznamMist_
    ...    v Index.html) – nedeterministické vůči datům (ne každá akce má
    ...    hotové geokódování), proto podmíněné na existenci pinů na
    ...    mapě, stejný vzor jako „Sekce stálých míst"/„Chip typu stálého
    ...    místa" výš.
    Wait For Elements State    ${FRAME} \#mapa .leaflet-container    visible    timeout=20s
    ${pocet_pinu}=    Get Element Count    ${FRAME} \#mapa .leaflet-marker-icon
    IF    ${pocet_pinu} >= 1
        Wait For Elements State    ${FRAME} \#mapa-mista .mapa-misto >> nth=0    visible    timeout=10s
        ${pocet_mist}=    Get Element Count    ${FRAME} \#mapa-mista .mapa-misto
        Should Be True    ${pocet_mist} >= 1
    ELSE
        Log    Žádný pin na mapě (žádná zobrazená akce nemá souřadnice) – seznam míst nemá co ověřit v tomto běhu.    level=WARN
    END

Klik na titulek karty vybere pin na mapě
    [Documentation]    N) D/E) klik na .nazev-klikatelna (v3.41) přepne
    ...    výběr pinu – ověřeno přes .nazev.vybrano na titulku
    ...    (vybratPin_ sesynchronizuje vizuální stav) a existenci
    ...    .pin-vybrany ikony na mapě. Druhý klik ověřuje i opačný směr
    ...    (zrušení výběru, detached). Podmíněné na existenci
    ...    klikatelného titulku – ne všechny akce mají geokódování hotové.
    ${pocet}=    Get Element Count    ${FRAME} .nazev-klikatelna
    IF    ${pocet} == 0
        Log    Žádná viditelná karta nemá souřadnice (.nazev-klikatelna) – test nemá co ověřit v tomto běhu.    level=WARN
    ELSE
        Click    ${FRAME} .nazev-klikatelna >> nth=0
        Wait For Elements State    ${FRAME} .nazev-klikatelna.vybrano >> nth=0    visible    timeout=5s
        ${pin_vybrany}=    Get Element Count    ${FRAME} \#mapa .pin-vybrany
        Should Be True    ${pin_vybrany} >= 1
        ...    msg=Po výběru titulku by měl mít odpovídající pin na mapě třídu .pin-vybrany
        # Druhý klik na stejný titulek má výběr zrušit (toggle zpět) – Wait
        # For Elements State (Browser lib.) nepodporuje named msg=, viz
        # SKILL.md; „detached" samo o sobě selže se srozumitelnou hláškou.
        Click    ${FRAME} .nazev-klikatelna.vybrano >> nth=0
        Wait For Elements State    ${FRAME} .nazev-klikatelna.vybrano    detached    timeout=5s
    END

Klik na řádek v seznamu míst vybere pin na mapě
    [Documentation]    N) D/F) klik na .mapa-misto (v3.41/v3.43) přepne
    ...    výběr stejným sdíleným mechanismem (vybratPin_) jako titulek
    ...    karty (test výš) – ověřeno přes .mapa-misto.vybrano a
    ...    .pin-vybrany na mapě, včetně zrušení druhým klikem. Podmíněné
    ...    na existenci aspoň jednoho řádku (viz M – seznam míst).
    Wait For Elements State    ${FRAME} \#mapa .leaflet-container    visible    timeout=20s
    ${pocet}=    Get Element Count    ${FRAME} \#mapa-mista .mapa-misto
    IF    ${pocet} == 0
        Log    Seznam míst je prázdný (žádná akce se souřadnicemi) – test nemá co ověřit v tomto běhu.    level=WARN
    ELSE
        Click    ${FRAME} \#mapa-mista .mapa-misto >> nth=0
        Wait For Elements State    ${FRAME} \#mapa-mista .mapa-misto.vybrano >> nth=0    visible    timeout=5s
        ${pin_vybrany}=    Get Element Count    ${FRAME} \#mapa .pin-vybrany
        Should Be True    ${pin_vybrany} >= 1
        ...    msg=Po výběru řádku v seznamu míst by měl mít odpovídající pin na mapě třídu .pin-vybrany
        # Druhý klik na stejný řádek má výběr zrušit (toggle zpět) – viz
        # poznámka o Wait For Elements State/msg= v testu titulku karty výš.
        Click    ${FRAME} \#mapa-mista .mapa-misto.vybrano >> nth=0
        Wait For Elements State    ${FRAME} \#mapa-mista .mapa-misto.vybrano    detached    timeout=5s
    END

Header a #controls-oznaceni zůstávají viditelné po scrollu (sticky)
    [Documentation]    N) H/I) header i #controls-oznaceni mají
    ...    position: sticky (v3.42) – po scrollu stránky dolů mají zůstat
    ...    na stejné Y pozici ve viewportu (na rozdíl od běžného static
    ...    obsahu, co odjíždí pryč). Neověřuje přesné pixelové zarovnání
    ...    mezi prvky navzájem (bod K, viz dokumentace na začátku sekce
    ...    a BACKLOG.md) – jen že KAŽDÝ prvek zůstává na svém místě.
    ${header_y_pred}=    Get BoundingBox    ${FRAME} header    key=y
    ${oznaceni_y_pred}=    Get BoundingBox    ${FRAME} \#controls-oznaceni    key=y
    Scroll By    ${FRAME} body    vertical=2000
    Sleep    200ms
    ${header_y_po}=    Get BoundingBox    ${FRAME} header    key=y
    ${oznaceni_y_po}=    Get BoundingBox    ${FRAME} \#controls-oznaceni    key=y
    Scroll To    ${FRAME} body
    Should Be True    abs(${header_y_po} - ${header_y_pred}) <= 1
    ...    msg=Header (sticky) změnil Y pozici po scrollu: ${header_y_pred} → ${header_y_po}
    Should Be True    abs(${oznaceni_y_po} - ${oznaceni_y_pred}) <= 1
    ...    msg=#controls-oznaceni (sticky) změnilo Y pozici po scrollu: ${oznaceni_y_pred} → ${oznaceni_y_po}

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
    ...
    ...    v3.10 DŮLEŽITÉ: mezi kliknutím a Reloadem se čeká na vymizení třídy
    ...    „ukladani" (server round-trip dokončen) – NE jen na optimistický DOM
    ...    flip. Bez tohoto kroku Reload mohl proběhnout dřív, než apiToggle
    ...    reálně zapsal do listu OZNAČENÍ, a test by nedeterministicky padal
    ...    (přesně to se stalo 3. 8. 2026 u ikony hvezda – False != True).
    ${puvodni}=    Zjistit je-li ikona první karty aktivní    ${trida_ikony}
    ${opak}=    Evaluate    not ${puvodni}

    Click    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.${trida_ikony}
    Wait Until Keyword Succeeds    10s    500ms
    ...    Ikona první karty má být    ${trida_ikony}    ${opak}
    ...    msg=Krok 1 (přepnutí na opak): optimistická odezva se neprojevila – ${trida_ikony}
    Wait For Elements State
    ...    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.${trida_ikony}:not(.ukladani)
    ...    visible    timeout=10s
    Reload
    # v3.13→oprava: přihlášení žije jen v paměti (dle rozhodnutí 7. 8. 2026,
    # žádné localStorage), takže Reload appku vrátí na dlaždice – bez
    # opětovného přihlášení by .karta nikdy nepřišla A sdílená stránka by
    # zůstala zaseknutá na login-overlay pro VŠECHNY další testy v pořadí.
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    Přihlásit se do radaru    ${RF_TEST_USER_ID}    ${RF_TEST_PIN}
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=20s
    Ikona první karty má být    ${trida_ikony}    ${opak}
    ...    msg=Krok 1: po reloadu se přepnutí nepodrželo – zápis do OZNAČENÍ neproběhl (${trida_ikony})

    Click    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.${trida_ikony}
    Wait Until Keyword Succeeds    10s    500ms
    ...    Ikona první karty má být    ${trida_ikony}    ${puvodni}
    ...    msg=Krok 2 (návrat na původní): optimistická odezva se neprojevila – ${trida_ikony}
    Wait For Elements State
    ...    ${FRAME} .karta >> nth=0 >> .ikona-oznaceni.${trida_ikony}:not(.ukladani)
    ...    visible    timeout=10s
    Reload
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    Přihlásit se do radaru    ${RF_TEST_USER_ID}    ${RF_TEST_PIN}
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=20s
    Ikona první karty má být    ${trida_ikony}    ${puvodni}
    ...    msg=Krok 2: po reloadu se návrat na původní stav nepodržel (${trida_ikony}) – produkční data mohou zůstat pozměněná!

    RETURN    ${puvodni}

Otevřít radar
    [Documentation]    v3.14: appka startuje anonymně a login je na vyžádání.
    ...    Suite Setup se přesto přihlašuje (přes badge), protože toggle testy
    ...    ★/✓ přihlášení potřebují. Bez vyhrazeného testovacího profilu
    ...    (RF_TEST_USER_ID/RF_TEST_PIN) radši hlasitě Skip než
    ...    nedeterministické pády na "element not found" o pár řádků níž.
    Skip If    '${RF_TEST_USER_ID}' == '' or '${RF_TEST_PIN}' == ''
    ...    RF_TEST_USER_ID/RF_TEST_PIN nenastaveny – frontend suita vyžaduje vyhrazený testovací profil (viz resources.robot)
    New Browser    chromium    headless=True
    New Context    viewport={'width': 1280, 'height': 900}
    New Page       ${SITE_URL}
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
    Přihlásit se do radaru    ${RF_TEST_USER_ID}    ${RF_TEST_PIN}
    # Data přicházejí asynchronně přes google.script.run → počkat na
    # první chip (meta hotová) a první kartu (events hotové), jinak
    # county v testech běží proti prázdnému UI (race condition).
    Wait For Elements State    ${FRAME} .chip >> nth=0     visible    timeout=20s
    Wait For Elements State    ${FRAME} .karta >> nth=0    visible    timeout=20s

Přihlásit se do radaru
    [Arguments]    ${uzivatel_id}    ${pin}
    [Documentation]    v3.14: appka startuje anonymně, takže keyword NEJDŘÍV
    ...    otevře login overlay klikem na badge "Přihlásit se" (pokud už není
    ...    otevřený – např. po pokusu o ★ bez přihlášení), pak vybere profil,
    ...    vyplní PIN a počká na skrytí overlay.
    ${overlay_otevreny}=    Get Element Count    ${FRAME} \#login-overlay:not(.skryto)
    IF    ${overlay_otevreny} == 0
        Click    ${FRAME} \#uzivatel-badge
    END
    Wait For Elements State    ${FRAME} \#login-dlazdice .dlazdice-uzivatel >> nth=0    visible    timeout=15s
    Click    ${FRAME} .dlazdice-uzivatel[data-uzivatel-id="${uzivatel_id}"]
    Wait For Elements State    ${FRAME} \#login-pin-sekce.zobrazit    visible    timeout=5s
    Fill Text    ${FRAME} \#login-pin    ${pin}
    Click    ${FRAME} \#login-potvrdit
    Wait For Elements State    ${FRAME} \#login-overlay    hidden    timeout=15s

Otevřít radar na mobilním viewportu
    [Documentation]    v3.43 (M): pomocná keyword pro testy prvků
    ...    viditelných jen pod 900px (#kalendar-toggle/#mapa-toggle jsou
    ...    display:none na ≥900px, viz Index.html) – Suite Setup má pevný
    ...    desktopový Context (1280×900), viewport jde nastavit jen při
    ...    `New Context`, proto vlastní Context tady. Volající test musí
    ...    mít `[Teardown]    Close Context    CURRENT` – dokumentace
    ...    `Close Context` v Browser library: "Active context is set to
    ...    the context that was active before this one", takže se tím
    ...    zpátky obnoví desktopový Context ze Suite Setup pro další testy
    ...    v sadě, bez ruční správy ID.
    New Context    viewport={'width': 375, 'height': 800}
    New Page    ${SITE_URL}
    Wait For Elements State    ${FRAME} header h1    visible    timeout=20s
