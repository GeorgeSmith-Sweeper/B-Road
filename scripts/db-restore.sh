#!/bin/bash

# db-restore.sh
#
# Restore the B-Road PostGIS database from a compressed backup.
#
# Usage:
#   ./scripts/db-restore.sh                              # Lists available backups
#   ./scripts/db-restore.sh data/backups/curvature_*.gz  # Restore specific backup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/data/backups"
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  if ls "$BACKUP_DIR"/curvature_*.sql.gz >/dev/null 2>&1; then
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/curvature_*.sql.gz
  else
    echo "No backups found in $BACKUP_DIR"
  fi
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: $BACKUP_FILE" >&2
  exit 1
fi

# Check that the db container is running
if ! docker compose ps db --status running --format '{{.Name}}' 2>/dev/null | grep -q .; then
  echo "ERROR: Database container is not running. Start it with 'docker compose up -d db'" >&2
  exit 1
fi

# Show current state
CURRENT_ROWS=$(docker compose exec -T db psql -U "${POSTGRES_USER:-curvature}" -d curvature -t -c "SELECT COUNT(*) FROM curvature_segments;" 2>/dev/null | tr -d ' ')
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo ""
echo "WARNING: This will overwrite the current database contents."
echo "  Current curvature_segments rows: ${CURRENT_ROWS:-unknown}"
echo "  Backup file: $BACKUP_FILE ($BACKUP_SIZE)"
echo ""
read -p "Continue? [y/N] " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring database from $BACKUP_FILE..."

# Drop and recreate the database to ensure clean state
docker compose exec -T db psql -U "${POSTGRES_USER:-curvature}" -d postgres -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'curvature' AND pid <> pg_backend_pid();
" >/dev/null 2>&1

docker compose exec -T db psql -U "${POSTGRES_USER:-curvature}" -d postgres -c "DROP DATABASE IF EXISTS curvature;" >/dev/null
docker compose exec -T db psql -U "${POSTGRES_USER:-curvature}" -d postgres -c "CREATE DATABASE curvature;" >/dev/null
docker compose exec -T db psql -U "${POSTGRES_USER:-curvature}" -d curvature -c "CREATE EXTENSION IF NOT EXISTS postgis;" >/dev/null

# Restore
gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql -U "${POSTGRES_USER:-curvature}" -d curvature >/dev/null

# Verify
RESTORED_ROWS=$(docker compose exec -T db psql -U "${POSTGRES_USER:-curvature}" -d curvature -t -c "SELECT COUNT(*) FROM curvature_segments;" 2>/dev/null | tr -d ' ')
echo "Restore complete. curvature_segments rows: ${RESTORED_ROWS:-unknown}"
