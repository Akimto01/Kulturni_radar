*** Settings ***
Documentation     Sdílené proměnné pro RF sadu Kulturního radaru (v3.20/v3.13).
...               Importuje se přes `Resource    resources.robot` v api.robot i
...               frontend.robot, ať se BASE_URL a DATUM_RE neduplikují na dvou
...               místech s rizikem, že se časem rozjedou (přesně to se stalo –
...               api.robot a frontend.robot měly do 7. 8. 2026 mírně odlišný
...               DATUM_RE regex, viz git historie).

*** Variables ***
${BASE_URL}       %{RADAR_URL=https://example.com/exec}
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
