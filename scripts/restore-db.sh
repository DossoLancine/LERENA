#!/usr/bin/env bash
# Restauration d'une sauvegarde dans une base VIDE (jamais directement sur la production en service).
# Usage : TARGET_URL="postgresql://...base-de-test..." ./scripts/restore-db.sh backups/lerena-AAAAMMJJ-HHMMSS.dump
set -euo pipefail

: "${TARGET_URL:?Définissez TARGET_URL (base de destination, vide)}"
FILE="${1:?Indiquez le fichier .dump à restaurer}"

case "$TARGET_URL" in
  *"${PRODUCTION_DB_REF:-__aucune__}"*) echo "Refusé : la cible ressemble à la base de production." >&2; exit 1 ;;
esac

pg_restore --no-owner --no-privileges --schema=public --dbname "$TARGET_URL" "$FILE"
echo "Restauration terminée. Contrôle rapide :"
psql "$TARGET_URL" -c 'SELECT (SELECT count(*) FROM "Organization") AS etablissements, (SELECT count(*) FROM "User") AS comptes, (SELECT count(*) FROM "Ticket") AS tickets;'
