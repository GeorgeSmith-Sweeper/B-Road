#!/bin/bash

# db-backup.sh
#
# Backup the B-Road PostGIS database (compressed pg_dump).
# Keeps the last N backups and deletes older ones.
#
# Usage:
#   ./scripts/db-backup.sh          # Full database backup
#   ./scripts/db-backup.sh --keep 3 # Keep only 3 most recent backups

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/data/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
KEEP=5

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    --keep) KEEP="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--keep N]"
      echo "  --keep N   Number of backups to retain (default: 5)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/curvature_${TIMESTAMP}.sql.gz"

echo "Backing up B-Road database..."

# Check that the db container is running
if ! docker compose ps db --status running --format '{{.Name}}' 2>/dev/null | grep -q .; then
  echo "ERROR: Database container is not running. Start it with 'docker compose up -d db'" >&2
  exit 1
fi

# Count rows before backup for verification
ROW_COUNT=$(docker compose exec -T db psql -U "${POSTGRES_USER:-curvature}" -d curvature -t -c "SELECT COUNT(*) FROM curvature_segments;" 2>/dev/null | tr -d ' ')
echo "curvature_segments rows: ${ROW_COUNT:-unknown}"

# Run pg_dump compressed
docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-curvature}" \
  -d curvature \
  --no-owner --no-acl \
  | gzip > "$BACKUP_FILE"

# Verify the backup file is non-empty
FILESIZE=$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)
if [ "$FILESIZE" -lt 1000 ]; then
  echo "ERROR: Backup file is suspiciously small (${FILESIZE} bytes). Database may be empty." >&2
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Prune old backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/curvature_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt "$KEEP" ]; then
  ls -t "$BACKUP_DIR"/curvature_*.sql.gz | tail -n +$((KEEP + 1)) | xargs rm -f
  PRUNED=$((BACKUP_COUNT - KEEP))
  echo "Pruned $PRUNED old backup(s), keeping $KEEP most recent."
fi

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup saved: $BACKUP_FILE ($SIZE)"
echo "Backups on disk: $(ls -1 "$BACKUP_DIR"/curvature_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
