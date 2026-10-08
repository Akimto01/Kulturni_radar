# Ukázky testů – jak navrhuji testy

Tři testy z Kulturního radaru, každý ukazuje jiný typ návrhového
rozhodnutí. Testy zůstávají na svém místě v sadě a běží v CI, tady je
jen jejich rozbor. Odkazy vedou na kód v repu ve stavu z 8. 10. 2026
(trvalé odkazy na konkrétní commit, řádky se proto neposunou).
U každého stejná osnova:

**co ověřuje → proč tahle úroveň → příprava dat → orákulum → čekání →
co zachytí a co ne → co bych zlepšil**

| # | Test | Soubor | Hlavní téma |
|---|---|---|---|
| 1 | [Chip typu stálého místa zúží seznam](https://github.com/Akimto01/Kulturni_radar/blob/2ac6d1ec16232487a1066d79d0167e8192ac63d2/tests/robot/frontend.robot#L475-L504) | `frontend.robot` ř. 475–504 | datová precondition, síla aserce, čekání |
| 2 | [★ Oblíbené: lze označit i odznačit (obojí ověřeno reloadem)](https://github.com/Akimto01/Kulturni_radar/blob/2ac6d1ec16232487a1066d79d0167e8192ac63d2/tests/robot/frontend.robot#L592-L603) | `frontend.robot` ř. 592–603 | zápis do produkce, úklid, ověření persistence |
| 3 | [Nasazená verze odpovídá repu](https://github.com/Akimto01/Kulturni_radar/blob/2ac6d1ec16232487a1066d79d0167e8192ac63d2/tests/robot/api.robot#L30-L53) | `api.robot` ř. 30–53 | test z reálného incidentu, volba úrovně |

---

## 1. Chip typu stálého místa zúží seznam

Test jsem upravoval ručně 7.–8. 10. 2026.

**Kód:** [`frontend.robot`, ř. 475–504](https://github.com/Akimto01/Kulturni_radar/blob/2ac6d1ec16232487a1066d79d0167e8192ac63d2/tests/robot/frontend.robot#L475-L504) · **Změna před/po:** [commit `8ca3c96`](https://github.com/Akimto01/Kulturni_radar/commit/8ca3c96)

```robotframework
    Wait For Elements State    ${FRAME} .misto-karta >> nth=0  visible
    ${pocet_chipu}=    Get Element Count    ${FRAME} \#mista-sekce .chip

    Skip If    ${pocet_chipu} < 2
        ...    Profil má aktuálně jen ${pocet_chipu} chip(y) typů míst …

    ${vsech}=    Get Element Count    ${FRAME} .misto-karta
    Click    ${FRAME} \#mista-sekce .chip >> nth=1
    Sleep    300ms
    ${filtrovanych}=    Get Element Count    ${FRAME} .misto-karta
    Should Be True    ${filtrovanych} < ${vsech}
    Should Be True    ${filtrovanych} >= 1
    …
    Click    ${FRAME} \#mista-sekce .chip >> text=Vše
    …
    Should Be Equal As Integers    ${zpet}    ${vsech}
```

| | |
|---|---|
| **Co ověřuje** | Klik na chip typu místa zúží seznam stálých míst a „Vše“ ho vrátí celý. |
| **Proč E2E** | Filtr je čistě klientský, ale chování vzniká složením: vykreslení chipů, klik, překreslení seznamu. Výpočet podkategorií je zvlášť v unit testech. |
| **Příprava dat** | Žádná, jen čte produkční data. Klik nic nezapisuje, proto je test bezpečný pro CI. |
| **Orákulum** | Struktura, ne konkrétní hodnoty: po výběru typu je karet *ostře méně* a aspoň jedna, po „Vše“ stejně jako na začátku. |
| **Datová precondition** | Chipy se vykreslí jen při 2+ typech míst. Když to data nesplní, test se **přeskočí** (`Skip If`), protože nemá co ověřit. |
| **Čekání** | Před počítáním počká na první kartu místa, sekce se načítá asynchronně. |
| **Co zachytí** | Nefunkční filtr, filtr, který nic nezúží, nevrácení seznamu po „Vše“. |
| **Co nezachytí** | Že zbylé karty jsou *správného* typu – test počítá, nekontroluje obsah. Ověřuje jen první typ, ne všechny. |

**Co se při úpravě ukázalo:**

1. Původní verze při chybějících datech zalogovala WARN a **prošla jako
   PASS**, i když nic neověřila → převedeno na `Skip If`.
2. Aserce byla `<=` – prošla by i s filtrem, který nic nedělá → `<`.
3. Po převodu se test přeskočil, přestože chipy na stránce byly: počítal
   dřív, než se sekce vykreslila. **Skip závod odhalil, WARN by ho
   navždy schoval** → `Wait For Elements State` před počítáním.
4. Dry run (`robot --dryrun`) odhalil překlep v oddělovačích argumentů
   bez jediného volání serveru.

**Co bych zlepšil:** `Sleep 300ms` nahradit asercí s opakováním
(`Get Element Count    …    <    ${vsech}`), ověřit typ zbylých karet,
případně projít všechny typy přes `Test Template`.

---

## 2. ★ Oblíbené: lze označit i odznačit (obojí ověřeno reloadem)

**Kód:** [test, ř. 592–603](https://github.com/Akimto01/Kulturni_radar/blob/2ac6d1ec16232487a1066d79d0167e8192ac63d2/tests/robot/frontend.robot#L592-L603) · [sdílený keyword `Ověřit plný cyklus označení…`, ř. 1104–1155](https://github.com/Akimto01/Kulturni_radar/blob/2ac6d1ec16232487a1066d79d0167e8192ac63d2/tests/robot/frontend.robot#L1104-L1155) · [teardown keyword `Nastavit ikonu první karty na`, ř. 1092–1102](https://github.com/Akimto01/Kulturni_radar/blob/2ac6d1ec16232487a1066d79d0167e8192ac63d2/tests/robot/frontend.robot#L1092-L1102)

```robotframework
★ Oblíbené: lze označit i odznačit (obojí ověřeno reloadem)
    [Tags]    zapis    krehky
    [Teardown]    Run Keyword And Ignore Error
    ...    Nastavit ikonu první karty na    hvezda    ${puvodni}
    ${puvodni}=    Set Variable    ${FALSE}
    ${puvodni}=    Ověřit plný cyklus označení (přidat i odebrat) s reloadem    hvezda
```

Logika je ve sdíleném keywordu, který používají i testy ✓ a 🏛:

```
zjisti výchozí stav → klik → počkej na optimistickou odezvu
→ počkej, až zmizí třída „ukladani“ (server zápis dokončen)
→ Reload → znovu přihlásit → ověř, že změna přetrvala
→ klik zpět → totéž → ověř návrat na výchozí stav
```

| | |
|---|---|
| **Co ověřuje** | Označení ★ se uloží na server, přežije reload a jde i odebrat. |
| **Proč E2E** | Riziko je v celém řetězci: UI → API → zápis do tabulky → načtení po reloadu. Logika `toggleOznaceni_` je zvlášť v unit testech (včetně izolace mezi uživateli). |
| **Příprava dat** | Vyhrazený testovací profil `rf-test`. Test funguje z **libovolného** výchozího stavu (přepne na opak a zpět), takže ověří obě operace. |
| **Úklid** | Teardown je **idempotentní**: přečte aktuální stav a klikne jen, když se liší od původního. `${puvodni}` má bezpečnou výchozí hodnotu ještě před rizikovým krokem, aby teardown nespadl na neexistující proměnnou a nezakryl skutečnou příčinu. |
| **Orákulum** | Stav ikony po **reloadu**, ne hned po kliku. Hned po kliku je vidět jen optimistická odezva UI, ne skutečný zápis. |
| **Čekání** | Na zmizení třídy `ukladani` – teprve to znamená dokončený zápis. Bez toho reload proběhl dřív než zápis a test náhodně padal (3. 8. 2026). |
| **Tagy** | `zapis` – lze vyřadit z opakovaných běhů; `krehky` – prokázaná citlivost na zátěž Apps Scriptu (21. 8. 2026). |
| **Co zachytí** | Neuložený zápis, zápis, který se po reloadu ztratí, nefunkční odznačení. |
| **Co nezachytí** | Zápis k jinému uživateli (to hlídají unit testy). Pracuje vždy s první kartou. |

**Vědomý kompromis:** `Run Keyword And Ignore Error` v teardownu
zajistí, že selhání úklidu nepřebije původní chybu testu. Cena: když
selže i úklid, data zůstanou pozměněná. Stalo se to 21. 8. pod zátěží
(zaseknutá ★ u `rf-test`), od té doby po nestandardním běhu kontroluji
i data.

**Co bych zlepšil:** tři téměř stejné testy (★, ✓, 🏛) převést na jeden
`Test Template` s tabulkou typů; ověření persistence přes API místo
reloadu UI by bylo rychlejší a méně křehké.

---

## 3. Nasazená verze odpovídá repu

**Kód:** [`api.robot`, ř. 30–53](https://github.com/Akimto01/Kulturni_radar/blob/2ac6d1ec16232487a1066d79d0167e8192ac63d2/tests/robot/api.robot#L30-L53)

```robotframework
Nasazená verze odpovídá repu
    [Tags]    smoke    regrese    api
    ${zdroj}=    Get File    ${CURDIR}/../../apps-script/kulturni_radar.gs
    ${shody}=    Get Regexp Matches    ${zdroj}    const VERZE = '([^']+)'    1
    Length Should Be    ${shody}    1
    ...    msg=V kulturni_radar.gs se nenašla konstanta VERZE – regenerovat test?
    ${verze_repo}=    Set Variable    ${shody}[0]
    TRY
        ${r}=    GET    ${BASE_URL}    params=api=meta    timeout=10
    EXCEPT    AS    ${chyba}
        Fail    Produkce nedostupná (${chyba}) – …
    END
    Status Should Be    200    ${r}
    Should Be Equal As Strings    ${r.json()}[verze]    ${verze_repo}
    ...    msg=Produkce hlásí verzi …, repo má … – zapomenutý "clasp deploy -i" po push?
```

| | |
|---|---|
| **Co ověřuje** | Produkce běží na stejné verzi backendu jako repo. |
| **Vznik** | Reálný incident 8. 8. 2026: `clasp deploy` bez `-i` nechal produkci na staré verzi, přestože kód v repu byl novější. |
| **Proč API** | Verzi hlásí endpoint `meta`. UI by nic navíc neověřilo, jen by test zpomalilo a zkřehčilo. |
| **Orákulum** | Verze se čte **přímo ze zdrojového kódu**, ne z dokumentace ani natvrdo z testu. Test tak nikdy nezastará. |
| **Pojistky** | `Length Should Be 1` – kdyby se konstanta přejmenovala, test selže srozumitelně, ne tichým porovnáním s ničím. `TRY/EXCEPT` + `timeout=10` – nedostupná produkce = jasná hláška, ne dlouhé čekání. |
| **Chybové zprávy** | Říkají rovnou **pravděpodobnou příčinu a co udělat** („zapomenutý clasp deploy -i?“). |
| **Co zachytí** | Zapomenuté nebo chybné nasazení backendu. |
| **Co nezachytí** | Verzi frontendu na Cloudflare Pages (riziko R2 v `POKRYTI.md`). Běží jen v neděli a ručně, ne hned po nasazení. |

**Co bych zlepšil:** stejnou kontrolu pro verzi frontendu a spouštět
smoke automaticky po nasazení.

---

## Co mají tyto tři testy společné

- Každý vznikl z **konkrétního rizika** (rozbitý filtr, ztracený zápis,
  špatné nasazení), ne z potřeby „mít test na všechno“.
- Úroveň je zvolená podle toho, **kde chyba vzniká**: co jde ověřit
  v unit testu, je tam; E2E jen tam, kde chyba vzniká složením.
- Orákulum ověřuje **strukturu a chování, ne konkrétní data**, protože
  produkční data se mění každý den.
- Chybové zprávy a `[Documentation]` vysvětlují **proč**, ne jen co.
- U každého vím, **co nezachytí** – a ty mezery jsou zapsané
  (`POKRYTI.md`, `BACKLOG.md`).
