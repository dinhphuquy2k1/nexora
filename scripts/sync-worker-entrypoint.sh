#!/bin/sh
set -eu
[ "$#" -gt 0 ] || { echo 'Missing worker command' >&2; exit 64; }
password=$(cat /sync-config/postgres_sync_password)
case "$password" in ''|*[!0-9a-f]*) echo 'Invalid worker custody' >&2; exit 1;; esac
[ "${#password}" -eq 64 ] || { echo 'Invalid worker custody' >&2; exit 1; }
export DATABASE_URL="postgresql://nexora_sync:$password@postgres:5432/nexora?connect_timeout=3"
unset password
exec "$@"
