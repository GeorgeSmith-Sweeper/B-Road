#!/bin/sh
# Sync node_modules when package.json changes.
# Compares a checksum of the mounted package.json against the last installed version.

CHECKSUM_FILE="/app/node_modules/.package-lock-checksum"
CURRENT_CHECKSUM=$(md5sum /app/package-lock.json 2>/dev/null | cut -d' ' -f1)

if [ ! -f "$CHECKSUM_FILE" ] || [ "$(cat "$CHECKSUM_FILE")" != "$CURRENT_CHECKSUM" ]; then
  echo "[entrypoint] package-lock.json changed — running npm ci..."
  npm ci
  echo "$CURRENT_CHECKSUM" > "$CHECKSUM_FILE"
  echo "[entrypoint] node_modules synced."
else
  echo "[entrypoint] node_modules up to date."
fi

exec "$@"
