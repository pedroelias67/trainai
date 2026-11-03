#!/usr/bin/env bash
#
# Cópia de segurança completa da base de dados, cifrada.
#
# O botão na administração descarrega os dados da aplicação em JSON, sem
# credenciais, e serve para quando se quer uma cópia agora. Este script faz a
# outra metade: o pg_dump inteiro — esquema, extensões, tabelas internas do
# Supabase e as credenciais — que só é possível numa máquina com as ferramentas
# do Postgres.
#
# O resultado é cifrado porque contém tokens de atualização do Strava e chaves
# de API do Intervals.icu de outras pessoas. Um ficheiro destes numa pasta
# sincronizada, em claro, é um molho de chaves das contas delas.
#
# Uso:
#   scripts/backup-db.sh                     cópia para ~/Backups/trainai
#   scripts/backup-db.sh /outro/caminho      cópia para outro sítio
#   BACKUP_KEEP=60 scripts/backup-db.sh      guarda 60 em vez de 30
#
# Restaurar:
#   age -d -i ~/.config/trainai/backup-key.txt ficheiro.dump.age > restaurado.dump
#   pg_restore -d "postgres://..." --no-owner --no-privileges restaurado.dump

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${1:-$HOME/Backups/trainai}"
GUARDAR="${BACKUP_KEEP:-30}"

# Um par de chaves, não uma frase-passe: `age --passphrase` exige um terminal
# e esta tarefa corre de madrugada, sozinha. A chave privada fica num ficheiro
# só teu — guarda uma cópia dela noutro sítio, porque sem ela as cópias não se
# abrem.
CHAVE="${BACKUP_KEY:-$HOME/.config/trainai/backup-key.txt}"
if [[ ! -f "$CHAVE" ]]; then
  echo "Falta a chave de cifra em $CHAVE" >&2
  echo "Cria-a uma vez com:" >&2
  echo "  mkdir -p \"$(dirname "$CHAVE")\" && age-keygen -o \"$CHAVE\" && chmod 600 \"$CHAVE\"" >&2
  echo "Guarda uma cópia desse ficheiro fora do Mac. Sem ele, as cópias não abrem." >&2
  exit 1
fi
PUBLICA="$(age-keygen -y "$CHAVE")"

# DIRECT_URL, não DATABASE_URL: a ligação agrupada do Supabase não serve para
# pg_dump, que precisa da ligação direta.
if [[ ! -f "$RAIZ/.env" ]]; then
  echo "Não encontrei $RAIZ/.env" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "$RAIZ/.env"
set +a

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "DIRECT_URL não está definida em .env" >&2
  exit 1
fi

mkdir -p "$DESTINO"
DATA="$(date +%Y-%m-%d-%H%M)"
FICHEIRO="$DESTINO/trainai-$DATA.dump"

echo "A copiar a base de dados…"
pg_dump "$DIRECT_URL" --format=custom --no-owner --no-privileges -f "$FICHEIRO"

# Verificada antes de ser cifrada: um ficheiro que não se consegue ler não é uma
# cópia de segurança, e só se descobre no dia em que faz falta.
TABELAS="$(pg_restore -l "$FICHEIRO" | grep -c 'TABLE DATA' || true)"
if [[ "$TABELAS" -lt 10 ]]; then
  echo "A cópia saiu com apenas $TABELAS tabelas — algo correu mal. Ficheiro mantido para inspeção:" >&2
  echo "  $FICHEIRO" >&2
  exit 1
fi

age --recipient "$PUBLICA" --armor -o "$FICHEIRO.age" "$FICHEIRO"
rm -f "$FICHEIRO"

TAMANHO="$(du -h "$FICHEIRO.age" | cut -f1)"
echo "Guardado: $FICHEIRO.age ($TAMANHO, $TABELAS tabelas)"

# As mais velhas saem, para a pasta não crescer para sempre.
APAGADAS=0
while IFS= read -r velho; do
  rm -f "$velho"
  APAGADAS=$((APAGADAS + 1))
done < <(ls -1t "$DESTINO"/trainai-*.dump.age 2>/dev/null | tail -n +"$((GUARDAR + 1))")
[[ "$APAGADAS" -gt 0 ]] && echo "Apagadas $APAGADAS cópias antigas (guardo as últimas $GUARDAR)."

echo "Cópias nesta pasta: $(ls -1 "$DESTINO"/trainai-*.dump.age 2>/dev/null | wc -l | tr -d ' ')"
