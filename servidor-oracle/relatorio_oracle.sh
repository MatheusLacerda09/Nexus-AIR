#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$SCRIPT_DIR/sql"
BACKUP_BASES="${BACKUP_BASES:-/u01/backup /backup}"
SQL_TIMEOUT="${SQL_TIMEOUT:-120}"
TODAS="2,4,5,6,7,8,9,10,11,12,14,15,16"
SECOES="$TODAS"
INSTANCIA=""
USAR_CRED=0

while getopts "i:s:C" opt; do
  case "$opt" in
    i) INSTANCIA="$OPTARG" ;;
    s) SECOES="$OPTARG" ;;
    C) USAR_CRED=1 ;;
    *) exit 2 ;;
  esac
done

[[ "$INSTANCIA" =~ ^[A-Za-z][A-Za-z0-9_]{0,29}$ ]] || { echo "Instância inválida." >&2; exit 2; }
[[ "$SECOES" =~ ^[0-9]+(,[0-9]+)*$ ]]              || { echo "Seções inválidas." >&2; exit 2; }

DB_USER=""; DB_PASS=""
if [ "$USAR_CRED" -eq 1 ]; then
  IFS= read -r _cred_b64
  _cred="$(printf %s "$_cred_b64" | base64 -d 2>/dev/null)"
  DB_USER="${_cred%%$'\n'*}"
  DB_PASS="${_cred#*$'\n'}"
  unset _cred _cred_b64
  [[ "$DB_USER" =~ ^[A-Za-z][A-Za-z0-9_$#]{0,29}$ ]] || { echo "Usuário do banco inválido." >&2; exit 2; }
  [ -n "$DB_PASS" ] && [[ "$DB_PASS" != *\"* ]] || { echo "Senha do banco inválida." >&2; exit 2; }
fi

export ORACLE_SID="$INSTANCIA"
export NLS_LANG="AMERICAN_AMERICA.AL32UTF8"
if grep -q "^${INSTANCIA}:" /etc/oratab 2>/dev/null && [ -x /usr/local/bin/oraenv ]; then
  export ORAENV_ASK=NO
  . /usr/local/bin/oraenv >/dev/null 2>&1 </dev/null
fi
if [ -z "${ORACLE_HOME:-}" ]; then
  _casa="$(getent passwd "$(id -un)" | cut -d: -f6)"
  for _perfil in "$_casa/.bash_profile" "$_casa/.profile"; do
    [ -f "$_perfil" ] && { . "$_perfil" >/dev/null 2>&1 </dev/null; break; }
  done
  export ORACLE_SID="$INSTANCIA"
fi
[ -n "${ORACLE_HOME:-}" ] && export PATH="$ORACLE_HOME/bin:$PATH"
ADR_BASE="${ORACLE_BASE:-/u01/app/oracle}"

titulo() {
  case "$1" in
    2)  echo "Espaço livre em disco" ;;
    4)  echo "Tamanho das databases" ;;
    5)  echo "Maiores tabelas" ;;
    6)  echo "Tablespaces" ;;
    7)  echo "Datafiles" ;;
    8)  echo "Estatísticas do banco" ;;
    9)  echo "Eventos de lock" ;;
    10) echo "Eventos de espera" ;;
    11) echo "Status do backup físico" ;;
    12) echo "Log do backup físico" ;;
    14) echo "Log do backup lógico" ;;
    15) echo "Erros nos logs do banco (últimas 24h)" ;;
    16) echo "Cargas de processamento" ;;
  esac
}

sql() {
  if ! command -v sqlplus >/dev/null 2>&1; then
    echo "sqlplus não encontrado no PATH (ORACLE_HOME=${ORACLE_HOME:-não definido})."; return
  fi
  local rc
  if [ "$USAR_CRED" -eq 1 ]; then
    local papel=""; [ "${DB_USER^^}" = "SYS" ] && papel=" as sysdba"
    { printf 'connect %s/"%s"%s\n' "$DB_USER" "$DB_PASS" "$papel"; printf '@%s\n' "$SQL_DIR/$1"; } \
      | timeout "$SQL_TIMEOUT" sqlplus -S -L /nolog 2>&1
    rc=${PIPESTATUS[1]}
  else
    timeout "$SQL_TIMEOUT" sqlplus -S -L "/ as sysdba" @"$SQL_DIR/$1" </dev/null 2>&1
    rc=$?
  fi
  [ "$rc" -eq 124 ] && echo "Tempo limite (${SQL_TIMEOUT}s) excedido nesta seção."
}

testar_login() {
  command -v sqlplus >/dev/null 2>&1 || return 0
  local papel="" saida; [ "${DB_USER^^}" = "SYS" ] && papel=" as sysdba"
  saida="$({ printf 'connect %s/"%s"%s\n' "$DB_USER" "$DB_PASS" "$papel"; printf 'select 1 from dual;\n'; } \
    | timeout 30 sqlplus -S -L /nolog 2>&1)"
  if printf '%s' "$saida" | grep -qE 'ORA-|SP2-|TNS-'; then
    echo "Não foi possível conectar ao banco $INSTANCIA com o usuário $DB_USER: $(printf '%s' "$saida" | grep -m1 -E 'ORA-|SP2-|TNS-')" >&2
    exit 3
  fi
}

backup_logico() {
  local achou=0 base dir ultimo
  for base in $BACKUP_BASES; do
    dir="$base/expdp/$INSTANCIA/logico"
    [ -d "$dir" ] || continue
    ultimo="$(ls -t "$dir"/*.log 2>/dev/null | head -n 1)"
    [ -n "$ultimo" ] || continue
    achou=1
    echo "Arquivo: $ultimo"
    echo "Modificado em: $(date -r "$ultimo" '+%d/%m/%Y %H:%M:%S')"
    echo "----------------------------------------------------------------"
    tail -n 30 "$ultimo"
    break
  done
  [ $achou -eq 1 ] || echo "Nenhum log encontrado em: $(for b in $BACKUP_BASES; do printf '%s ' "$b/expdp/$INSTANCIA/logico"; done)"
}

erros_alert() {
  local dir log ontem n
  dir="$(ls -d "$ADR_BASE"/diag/rdbms/*/"$INSTANCIA"/trace 2>/dev/null | head -n 1)"
  [ -n "$dir" ] || { echo "Pasta trace não encontrada em $ADR_BASE/diag/rdbms/*/$INSTANCIA/trace"; return; }
  log="$dir/alert_${INSTANCIA}.log"
  [ -f "$log" ] || log="$dir/alert.log"
  [ -f "$log" ] || { echo "alert log não encontrado em $dir"; return; }
  echo "Arquivo: $log"
  echo "----------------------------------------------------------------"
  ontem="$(date -d '1 day ago' +%Y-%m-%d)"
  if tail -n 5000 "$log" | grep -qE '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'; then
    n="$(tail -n 200000 "$log" | awk -v d="$ontem" '
        /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T/ { ts = substr($0,1,19) }
        ts != "" && substr(ts,1,10) >= d && /ORA-|TNS-|ERROR/ { print ts "  " $0 }' | tail -n 80)"
  else
    n="$(tail -n 5000 "$log" | grep -E 'ORA-|TNS-' | tail -n 50)"
  fi
  [ -n "$n" ] && echo "$n" || echo "Nenhum erro ORA-/TNS- encontrado nas últimas 24h."
}

sar_bloco() {
  echo "* $1:"
  local out
  out="$(sar "$2" 2>&1)"
  echo "$out" | head -n 5
  echo "   [...]"
  echo "$out" | tail -n 10
  echo
}

carga() {
  if ! command -v sar >/dev/null 2>&1; then
    echo "Comando sar não encontrado (instale o pacote sysstat)."; return
  fi
  sar_bloco "CPU"  "-u"
  sar_bloco "MEM"  "-r"
  sar_bloco "SWAP" "-S"
  sar_bloco "I/O"  "-d"
  sar_bloco "LOAD" "-q"
}

executar() {
  case "$1" in
    2)  df -h ;;
    4)  sql 04_tamanho_databases.sql ;;
    5)  sql 05_maiores_tabelas.sql ;;
    6)  sql 06_tablespaces.sql ;;
    7)  sql 07_datafiles.sql ;;
    8)  sql 08_estatisticas.sql ;;
    9)  sql 09_eventos_lock.sql ;;
    10) sql 10_eventos_espera.sql ;;
    11) sql 11_backup_fisico_status.sql ;;
    12) sql 12_backup_fisico_log.sql ;;
    14) backup_logico ;;
    15) erros_alert ;;
    16) carga ;;
  esac
}

[ "$USAR_CRED" -eq 1 ] && testar_login
echo "@@META|$(hostname)|$(date '+%d/%m/%Y %H:%M:%S')|$INSTANCIA@@"

IFS=',' read -ra LISTA <<< "$SECOES"
for id in "${LISTA[@]}"; do
  t="$(titulo "$id")"
  [ -n "$t" ] || continue
  echo "@@SECAO|$id|$t@@"
  executar "$id" 2>&1
  echo
done

echo "@@FIM@@"

