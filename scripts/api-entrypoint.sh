#!/bin/sh
set -eu
[ "$#" -gt 0 ] || { echo "Missing service command" >&2; exit 64; }
if [ -z "${DATABASE_URL:-}" ]; then
 password=$(cat /config/postgres_password)
 export DATABASE_URL="postgresql://nexora:$password@postgres:5432/nexora?connect_timeout=3"
fi
exec "$@"
