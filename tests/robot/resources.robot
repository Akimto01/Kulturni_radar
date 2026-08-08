*** Settings ***
Documentation     Sdílené proměnné pro RF sadu Kulturního radaru (v3.20/v3.13).
...               Importuje se přes `Resource    resources.robot` v api.robot i
...               frontend.robot, ať se BASE_URL a DATUM_RE neduplikují na dvou
...               místech s rizikem, že se časem rozjedou (přesně to se stalo –
...               api.robot a frontend.robot měly do 7. 8. 2026 mírně odlišný
...               DATUM_RE regex, viz git historie).

*** Variables ***
# BASE_URL: Apps Script /exec – přímé HTTP API testy (api.robot). Appka na
# statické doméně (kulturniradar.cz) žádné vlastní API endpointy nemá, jen
# volá fetch() na tuhle stejnou URL – proto BASE_URL zůstává Apps Script.
${BASE_URL}       %{RADAR_URL=https://script.google.com/macros/s/AKfycbwwLACExWtRUULK5XX1bMD8SJiC6cBqAY-q99Flp3SLAEr4ejB4VnekFNH9yYnlOuJvRQ/exec}
# SITE_URL: co se otevírá v prohlížeči (frontend.robot). Výchozí = statická
# doména, žádný iframe (FRAME prázdné). Pro test proti Apps Scriptu (starý
# sandboxovaný vstup) přepiš oba:
#   robot --variable SITE_URL:https://script.google.com/macros/s/.../exec ^
#         --variable FRAME:"id=sandboxFrame >>> id=userHtmlFrame >>>" tests/robot/frontend.robot
${SITE_URL}       %{RADAR_SITE_URL=https://kulturniradar.cz}
${FRAME}          %{RF_FRAME=}
# Regex českého data „d. M. yyyy“ – regresní pojistka na bug v3.2/3.3
# (sériová čísla 46156 a Date objekty „FRI AUG 07…“ v API výstupu).
# Mezera po tečce je nepovinná (\s?) – frontend i API ji občas vrací bez mezery.
${DATUM_RE}       ^\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?\\d{4}$

# v3.13: přihlašovací údaje VYHRAZENÉHO testovacího uživatelského profilu
# ("RF Test") – NIKDY reálný rodinný profil. CI běží ★/✓ toggle testy, které
# zapisují do OZNAČENÍ; díky vlastnímu profilu se nedotknou rodinné historie.
# Bez proměnných nastavených v prostředí frontend.robot celou suitu přeskočí
# (Suite Setup to detekuje a zavolá Skip, viz frontend.robot).
${RF_TEST_USER_ID}    %{RF_TEST_USER_ID=}
${RF_TEST_PIN}         %{RF_TEST_PIN=}
