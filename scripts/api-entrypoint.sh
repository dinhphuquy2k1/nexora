#!/bin/sh
set -eu
[ "$#" -gt 0 ] || { echo "Missing service command" >&2; exit 64; }
# Deliberately no admin file fallback, including when DATABASE_URL was inherited.
password=$(cat /runtime-config/postgres_app_password)
case "$password" in ''|*[!0-9a-f]*) echo 'Invalid runtime credential file' >&2; exit 1;; esac
[ "${#password}" -eq 64 ] || { echo 'Invalid runtime credential file' >&2; exit 1; }
export DATABASE_URL="postgresql://nexora_app:$password@postgres:5432/nexora?connect_timeout=3"
unset password
exec "$@"
