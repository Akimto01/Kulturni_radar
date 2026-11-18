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
Library           OperatingSystem
Resource          resources.robot

*** Variables ***
${NTFY_TOPIC}      %{NTFY_TOPIC=}
# #78: ntfy.sh drží zprávy jen 12 h, takže prázdné okno je selhání jen v plánovaném
# běhu (neděle večer, samotest v 18:53 je v okně). rf-tests.yml nastaví true pro schedule.
${NTFY_VYZADOVAT_ZPRAVU}    false

*** Test Cases ***
Meta vrací aktivní profil, profily a kategorie
    [Tags]    smoke    api
    ${r}=    GET    ${BASE_URL}    params=api=meta
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Be True    ${j}[ok]
    Should Not Be Empty    ${j}[aktivniProfil]
    ${pocet}=    Get Length    ${j}[profily]
    Should Be True    ${pocet} >= 1    Očekávám aspoň jeden profil v LOKALITÁCH
    List Should Contain Value    ${j}[kategorie]    koncerty

Nasazená verze odpovídá repu
    [Tags]    smoke    regrese    api
    [Documentation]    Zachycuje scénář z 8. 8. 2026 (viz SKILL.md sekce 6):
    ...    `clasp deploy` spuštěný BEZ `-i <deploymentId>` nechá produkci
    ...    běžet na staré verzi, i když repo i lokální Apps Script editor
    ...    už mají novější kód. Čte VERZE přímo ze zdroje (ne z dokumentace
    ...    ani z paměti), aby test nezávisel na tom, jestli se repo a
    ...    produkce zrovna rozešly. Krátký timeout + TRY/EXCEPT: bez
    ...    připojení na produkci má test selhat srozumitelnou hláškou,
    ...    ne viset na výchozím (dlouhém) timeoutu RequestsLibrary.
    ${zdroj}=    Get File    ${CURDIR}/../../apps-script/kulturni_radar.gs
    ${shody}=    Get Regexp Matches    ${zdroj}    const VERZE = '([^']+)'    1
    Length Should Be    ${shody}    1
    ...    msg=V kulturni_radar.gs se nenašla konstanta VERZE – regenerovat test?
    ${verze_repo}=    Set Variable    ${shody}[0]
    TRY
        ${r}=    GET    ${BASE_URL}    params=api=meta    timeout=10
    EXCEPT    AS    ${chyba}
        Fail    Produkce nedostupná (${chyba}) – test vyžaduje připojení na BASE_URL (aktuální produkční /exec URL, viz resources.robot)
    END
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Be Equal As Strings    ${j}[verze]    ${verze_repo}
    ...    msg=Produkce hlásí verzi „${j}[verze]“, repo má „${verze_repo}“ – zapomenutý "clasp deploy -i" po push? (viz SKILL.md sekce 6)

Events vrací akce s validními českými datumy
    [Tags]    smoke    regrese    api
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
    [Tags]    mapa    api
    [Documentation]    Schema check – lat/lng musí být v odpovědi přítomné
    ...    klíče (hodnota null, dokud se lokalita ještě negeokódovala na
    ...    pozadí po dalším běhu kontroly). Chytí regresi, kdyby pole zmizelo.
    ${r}=    GET    ${BASE_URL}    params=api=events
    ${j}=    Set Variable    ${r.json()}
    ${prvni}=    Set Variable    ${j}[akce][0]
    Dictionary Should Contain Key    ${prvni}    lat
    Dictionary Should Contain Key    ${prvni}    lng

Events umí filtrovat podle profilu
    [Tags]    api
    ${r}=    GET    ${BASE_URL}    params=api=events&profil=Ostrava
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Be True    ${j}[ok]
    Should Be Equal    ${j}[profil]    Ostrava

Places vrací stálá místa se skóre
    [Tags]    api
    ${r}=    GET    ${BASE_URL}    params=api=places
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Be True    ${j}[ok]
    ${pocet}=    Get Length    ${j}[mista]
    Should Be True    ${pocet} >= 1    MÍSTA mají být naplněná

Neznámý endpoint vrací chybu, ne pád
    [Tags]    api
    ${r}=    GET    ${BASE_URL}    params=api=neexistuje
    Status Should Be    200    ${r}
    ${j}=    Set Variable    ${r.json()}
    Should Not Be True    ${j}[ok]

Spuštění kontroly s neplatným tokenem je odmítnuto
    [Tags]    api
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
    [Tags]    api
    [Documentation]    Monitorovací assert (backlog): radar posílá notifikaci
    ...                minimálně 1× denně (ranní kontrola 8:00), takže pokud
    ...                za posledních 48 h na ntfy nedorazilo NIC, kanál je
    ...                nejspíš mrtvý (špatný topic, tichá chyba sendNotification_,
    ...                změna ntfy API) – a nikdo si toho jinak nevšimne,
    ...                protože mrtvý kanál nemá jak křičet.
    ...                Issue 78: veřejný server ntfy.sh drží zprávy jen 12 h, proto okno
    ...                12 h (dřív 48 h, ve skutečnosti ale stejně jen 12 h). Prázdné
    ...                okno je selhání jen v plánovaném běhu (neděle večer, samotest
    ...                v 18:53 je v okně, \${NTFY_VYZADOVAT_ZPRAVU} nastaví rf-tests.yml);
    ...                v ručním běhu večer po 20:14 by bylo prázdné i u živého kanálu,
    ...                proto se test přeskočí (13. 11. 2026 falešný pád ve 20:44).
    ...                Topic je soukromý → bez \${NTFY_TOPIC} se test přeskočí
    ...                (zpětné lomítko je nutné: RF v dokumentaci rozvíjí proměnné
    ...                a hodnota by skončila v log.html, output.xml i report.html).
    ...                Topic je tajný a repo je veřejné, reporty z CI jsou ke stažení:
    ...                URL i odpověď (události ntfy obsahují "topic") se proto
    ...                zpracují při Log Level NONE a stav se kontroluje až po jeho
    ...                obnovení (zpráva Status Should Be by URL vypsala).
    ...                Řádky odpovědi se nesmí procházet cyklem FOR: RF zapisuje hodnoty
    ...                iterační proměnné do output.xml i při Log Level NONE (ověřeno
    ...                v CI 28. 10. 2026), proto se počítají jedním Evaluate.
    Skip If    '${NTFY_TOPIC}' == ''    NTFY_TOPIC nenastaven – test přeskočen
    ${puvodni_uroven}=    Set Log Level    NONE
    TRY
        ${r}=    GET    https://ntfy.sh/${NTFY_TOPIC}/json    params=poll=1&since=12h    expected_status=any
        ${stav}=    Set Variable    ${r.status_code}
        ${zprav}=    Set Variable    ${0}
        IF    ${stav} == 200
            ${zprav}=    Evaluate    sum(1 for l in $r.text.splitlines() if l.strip() and json.loads(l).get('event') == 'message')    modules=json
        END
    FINALLY
        Set Log Level    ${puvodni_uroven}
    END
    Should Be Equal As Integers    ${stav}    200    ntfy vrátilo jiný stav než 200 (URL se kvůli tajnému tématu nezapisuje)
    Skip If    ${zprav} == 0 and '${NTFY_VYZADOVAT_ZPRAVU}'.lower() != 'true'
    ...    Za 12 h žádná zpráva na ntfy, ruční běh: ntfy.sh drží zprávy jen 12 h, živost nelze ověřit
    Should Be True    ${zprav} >= 1
    ...    Za 12 h nepřišla na ntfy žádná zpráva – notifikační kanál je nejspíš mrtvý

Přihlášení přes API: špatný PIN je odmítnut
    [Tags]    api
    [Documentation]    Negativní případ: nesprávný PIN vrátí ok=false a chybu, ne data profilu.
    ...    Jeden chybný pokus je hluboko pod limitem 5 pokusů; následující test s platným PINem
    ...    počítadlo vynuluje. Opakované spouštění samotného testu zamyká profil (SKILL.md sekce 2).
    Skip If    '${RF_TEST_USER_ID}' == '' or '${RF_TEST_PIN}' == ''
    ...    RF_TEST_USER_ID/RF_TEST_PIN nenastaveny – test přeskočen
    ${j}=    Poslat login POST    ${RF_TEST_USER_ID}    ${TRUE}
    Should Not Be True    ${j}[ok]
    Should Contain    ${j}[error]    PIN
    Dictionary Should Not Contain Key    ${j}    jmeno

Přihlášení přes API: neexistující profil je odmítnut
    [Tags]    api
    [Documentation]    Neznámý profil se nezapisuje do počítadla pokusů (nic se nezamyká),
    ...    takže test je bezpečný pro opakování. Nepotřebuje tajnou hodnotu.
    ${j}=    Poslat login POST    neexistujici-profil-rf    ${TRUE}
    Should Not Be True    ${j}[ok]
    Should Contain    ${j}[error]    profil

Přihlášení přes API: správný PIN testovacího profilu
    [Tags]    api    regrese
    [Documentation]    Přímý kontrakt POST `akce: login` (mezera z části C POKRYTI.md).
    ...    PIN se čte z \${RF_TEST_PIN}, volání běží při Log Level NONE (viz klíčové slovo
    ...    „Poslat login POST“) a aserce nevypisují hodnoty. Úspěch vynuluje počítadlo
    ...    chybných PINů, proto test běží až po negativních případech.
    Skip If    '${RF_TEST_USER_ID}' == '' or '${RF_TEST_PIN}' == ''
    ...    RF_TEST_USER_ID/RF_TEST_PIN nenastaveny – test přeskočen
    ${j}=    Poslat login POST    ${RF_TEST_USER_ID}    ${FALSE}
    Should Be True    ${j}[ok]    Přihlášení správným PINem selhalo (zamčený profil? viz SKILL.md sekce 2)
    Should Be Equal    ${j}[id]    ${RF_TEST_USER_ID}
    Should Not Be Empty    ${j}[jmeno]
    Dictionary Should Not Contain Key    ${j}    pinHash
    Dictionary Should Not Contain Key    ${j}    pin


*** Keywords ***
Poslat login POST
    [Documentation]    POST `akce: login` na \${BASE_URL} a vrátí slovník ok/error/id/jmeno.
    ...    Apps Script na POST odpoví 302 na dočasnou „echo“ adresu a výsledek je až v GET na ni.
    ...    Automatické následování redirectu v requests POST změní na GET bez těla, proto se
    ...    redirect řeší ručně: POST s allow_redirects=False a pak GET na hlavičku Location.
    ...    Tělo jde jako text/plain (stejně jako ve frontendu, bez CORS preflightu).
    ...    Argumenty nejsou tajné (PIN se bere z \${RF_TEST_PIN} uvnitř), proto smí být
    ...    zapsané v logu; vše s PINem a Location běží při Log Level NONE bez FOR.
    [Arguments]    ${uzivatel_id}    ${spatny_pin}
    ${puvodni_uroven}=    Set Log Level    NONE
    TRY
        VAR    ${pin}=    spatny-pin-rf-test
        IF    not ${spatny_pin}    VAR    ${pin}=    ${RF_TEST_PIN}
        ${telo_json}=    Evaluate    json.dumps({'akce': 'login', 'uzivatelId': $uzivatel_id, 'pin': $pin})    modules=json
        ${r}=    POST    ${BASE_URL}    data=${telo_json}    headers=${{{'Content-Type': 'text/plain;charset=utf-8'}}}
        ...    allow_redirects=${FALSE}    expected_status=any    timeout=30
        ${r}=    Dokončit redirect    ${r}
        ${j}=    Evaluate    $r.json() if $r.status_code == 200 else {}
    FINALLY
        Set Log Level    ${puvodni_uroven}
    END
    Should Be Equal As Integers    ${r.status_code}    200
    ...    Přihlášení přes API: konečný stav ${r.status_code}, adresa se kvůli echo klíči nevypisuje
    RETURN    ${j}

Dokončit redirect
    [Documentation]    Když odpověď je přesměrování, přečte výsledek GET na `Location`
    ...    (echo adresa obsahuje klíč, proto se volá jen při Log Level NONE).
    [Arguments]    ${odpoved}
    IF    $odpoved.status_code in (301, 302, 303, 307, 308)
        ${odpoved}=    GET    ${odpoved.headers}[Location]    expected_status=any    timeout=30
    END
    RETURN    ${odpoved}
