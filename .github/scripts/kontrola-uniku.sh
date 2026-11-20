#!/usr/bin/env bash
# Kontrola úniku tajných hodnot v reportech RF (issue #46, incident #33).
# Sdílí ji rf-tests.yml (před nahráním artefaktu) a publikovat-report.yml (před
# publikací na Pages). Repo je veřejné, artefakty si může stáhnout kdokoli
# přihlášený. Při nálezu se vypíše jen název souboru a secretu, nikdy hodnota.
#
# Použití:
#   RF_TEST_PIN=… NTFY_TOPIC=… .github/scripts/kontrola-uniku.sh [adresář]   # výchozí vysledky
#   .github/scripts/kontrola-uniku.sh --test                                 # samotest na dočasných souborech
#
# Hledá se ve všech textových souborech adresáře. Část řetězců v log.html a
# report.html je komprimovaná, ale RF je generuje z output.xml, takže únik v nich
# by byl vždy i v output.xml, kde je text prostý.
# PIN má mít 8 znaků, takže stačí prosté hledání. Kratší PIN by dával falešné
# shody (kód knihovny v HTML, zlomky časů, čísla): v tom případě se ohlásí
# ::warning:: a hledá se jen v uvozovkách nebo jako celý text prvku.
# playwright-log.txt je ladicí log Browser Library: zapisuje i hodnoty vrácené
# z DOM a úroveň logování RF ho neovlivní. Do reportů nepatří, proto se maže.
# Návratový kód: 0 bez nálezu, 1 při nálezu.
set -uo pipefail

zkontrolovat() {
  local adresar="$1"
  local nalez=0 soubor
  find "$adresar" -name playwright-log.txt -delete 2>/dev/null || true
  # Ntfy témata uživatelských profilů (radar- + 32 hex, apiVygenerovatNtfyTema_)
  # se nesmí objevit v žádném reportu, ať jde o kohokoli.
  while IFS= read -r soubor; do
    echo "::error::Únik ntfy tématu uživatelského profilu (radar-…) v souboru $soubor"
    nalez=1
  done < <(grep -rlE -- 'radar-[0-9a-f]{32}' "$adresar" || true)
  if [ -n "${NTFY_TOPIC:-}" ]; then
    while IFS= read -r soubor; do
      echo "::error::Únik tajné hodnoty NTFY_TOPIC v souboru $soubor"
      nalez=1
    done < <(grep -rlF -- "$NTFY_TOPIC" "$adresar" || true)
  fi
  if [ -n "${RF_TEST_PIN:-}" ]; then
    local hledani
    if [ "${#RF_TEST_PIN}" -ge 8 ]; then
      hledani=(-e "$RF_TEST_PIN")
    else
      echo "::warning::RF_TEST_PIN má méně než 8 znaků, kontrola úniku PINu je jen přibližná (hledá se v uvozovkách a jako celý text prvku)"
      hledani=(-e "'$RF_TEST_PIN'" -e "\"$RF_TEST_PIN\"" -e ">$RF_TEST_PIN<")
    fi
    while IFS= read -r soubor; do
      echo "::error::Únik tajné hodnoty RF_TEST_PIN v souboru $soubor"
      nalez=1
    done < <(grep -rlF "${hledani[@]}" -- "$adresar" || true)
  fi
  return $nalez
}

samotest() {
  local tmp chyby=0
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN
  over() {   # over <popis> <očekávaný kód> <příkaz...>
    local popis="$1" ocek="$2"; shift 2
    "$@" > "$tmp/vystup.txt" 2>&1; local kod=$?
    if [ "$kod" -eq "$ocek" ]; then echo "OK    $popis"; else echo "CHYBA $popis (kód $kod, čekáno $ocek)"; chyby=$((chyby+1)); fi
  }
  mkdir -p "$tmp/cisto" "$tmp/tema" "$tmp/ntfy" "$tmp/pin8" "$tmp/pin4" "$tmp/log"
  echo '<msg>vse v poradku</msg>' > "$tmp/cisto/output.xml"
  echo '<msg>radar-0123456789abcdef0123456789abcdef</msg>' > "$tmp/tema/output.xml"
  echo '<msg>moje-tajne-tema</msg>' > "$tmp/ntfy/output.xml"
  echo '<arg>pin 12345678 tady</arg>' > "$tmp/pin8/output.xml"
  echo '<arg>4711</arg> cas 0.4711 s' > "$tmp/pin4/output.xml"
  echo 'hodnota 12345678' > "$tmp/log/playwright-log.txt"
  over 'čistý adresář → 0' 0 env -u NTFY_TOPIC -u RF_TEST_PIN bash -c "$(declare -f zkontrolovat); zkontrolovat '$tmp/cisto'"
  over 'ntfy téma profilu (radar- + 32 hex) → 1' 1 env -u NTFY_TOPIC -u RF_TEST_PIN bash -c "$(declare -f zkontrolovat); zkontrolovat '$tmp/tema'"
  over 'NTFY_TOPIC v reportu → 1' 1 env NTFY_TOPIC=moje-tajne-tema bash -c "$(declare -f zkontrolovat); zkontrolovat '$tmp/ntfy'"
  over 'PIN s 8 znaky prostým hledáním → 1' 1 env RF_TEST_PIN=12345678 bash -c "$(declare -f zkontrolovat); zkontrolovat '$tmp/pin8'"
  over 'krátký PIN jako celý text prvku → 1' 1 env RF_TEST_PIN=4711 bash -c "$(declare -f zkontrolovat); zkontrolovat '$tmp/pin4'"
  echo '<arg>x</arg> cas 0.4711 s' > "$tmp/pin4/output.xml"
  over 'krátký PIN jen jako zlomek času → 0 (bez falešné shody)' 0 env RF_TEST_PIN=4711 bash -c "$(declare -f zkontrolovat); zkontrolovat '$tmp/pin4'"
  over 'playwright-log.txt se smaže a nehlásí → 0' 0 env RF_TEST_PIN=12345678 bash -c "$(declare -f zkontrolovat); zkontrolovat '$tmp/log'"
  [ ! -e "$tmp/log/playwright-log.txt" ] && echo "OK    playwright-log.txt odstraněn" || { echo "CHYBA playwright-log.txt zůstal"; chyby=$((chyby+1)); }
  if [ "$chyby" -eq 0 ]; then echo "Samotest prošel."; return 0; fi
  echo "Samotest selhal: $chyby chyb."; return 1
}

if [ "${1:-}" = "--test" ]; then
  samotest; exit $?
fi
zkontrolovat "${1:-vysledky}"
exit $?
