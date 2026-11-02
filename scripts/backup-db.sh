#!/usr/bin/env bash
# Sauvegarde manuelle de la base (en plus des sauvegardes automatiques de Supabase).
# Usage : DIRECT_URL="postgresql://..." ./scripts/backup-db.sh [dossier]
# Produit un fichier compressé daté, restaurable avec scripts/restore-db.sh sur une base VIDE.
set -euo pipefail

: "${DIRECT_URL:?Définissez DIRECT_URL (connexion directe Postgres, port 5432)}"
OUT_DIR="${1:-backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/lerena-$(date -u +%Y%m%d-%H%M%S).dump"

pg_dump --format=custom --no-owner --no-privileges --schema=public "$DIRECT_URL" --file "$FILE"
echo "Sauvegarde : $FILE ($(du -h "$FILE" | cut -f1))"
echo "Vérification du contenu :"
pg_restore --list "$FILE" | grep -c "TABLE DATA" | xargs echo "  tables sauvegardées :"
