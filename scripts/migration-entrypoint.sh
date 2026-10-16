#!/bin/sh
set -eu
[ "$#" -gt 0 ] || { echo 'Missing migration command' >&2; exit 64; }
password=$(cat /config/postgres_password)
case "$password" in ''|*[!0-9a-f]*) echo 'Invalid administrative credential file' >&2; exit 1;; esac
[ "${#password}" -eq 64 ] || { echo 'Invalid administrative credential file' >&2; exit 1; }
export DATABASE_URL="postgresql://nexora:$password@postgres:5432/nexora?connect_timeout=3"
unset password
exec "$@"
