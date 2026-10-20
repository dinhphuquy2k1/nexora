#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
compose(){
 if [ -n "${NEXORA_COMPOSE_OVERRIDE:-}" ]; then
  docker compose -f compose.yml -f compose.dev.yml -f "$NEXORA_COMPOSE_OVERRIDE" "$@"
 else
  docker compose -f compose.yml -f compose.dev.yml "$@"
 fi
}
if [ "${NEXORA_QUALITY_NO_BUILD:-0}" = 1 ]; then
 compose up --no-build -d --wait --wait-timeout 180
else
 compose up --build -d --wait --wait-timeout 180
fi
python3 scripts/database-runtime-smoke.py --development
# Stop watchers before writing their shared dist/.next output volumes.
restart(){ compose start api web >/dev/null; }
trap restart EXIT HUP INT TERM
compose stop api web
# run invokes mapped-user entrypoint; exec bypasses that mapping.
compose run --rm --no-deps -T quality sh -c 'NODE_ENV=production API_INTERNAL_URL=http://api:4000 pnpm quality && NODE_ENV=test pnpm test:integration && pnpm --filter @nexora/database test:migrations'
python3 scripts/provision-cluster-smoke.py
python3 scripts/dev-cleanup-smoke.py
