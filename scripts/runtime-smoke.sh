#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
compose(){
 if [ -n "${NEXORA_COMPOSE_OVERRIDE:-}" ]; then
  docker compose -f compose.yml -f "$NEXORA_COMPOSE_OVERRIDE" "$@"
 else
  docker compose -f compose.yml "$@"
 fi
}
# Only this script's disposable project may be removed with volumes.
project="nexora-smoke-$$"
export COMPOSE_PROJECT_NAME="$project"
cleanup(){
  status=$?; if [ "$status" -ne 0 ]; then compose logs --no-color --tail 60 >&2; fi;  compose down -v --remove-orphans >/dev/null; }
trap cleanup EXIT HUP INT TERM
if [ "${NEXORA_SMOKE_NO_BUILD:-0}" = 1 ]; then compose up --no-build -d --wait --wait-timeout 180; else compose up --build -d --wait --wait-timeout 180; fi
compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async r=>{const b=await r.json();if(r.status!==200||!b.checks.database||!b.checks.storage)process.exit(1);console.log('Same-origin readiness PASS')})"
compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/missing',{headers:{authorization:'Bearer sensitive-test-marker'}}).then(async r=>{const b=await r.json();if(r.status!==404||b.code!=='NOT_FOUND'||!b.requestId||b.requestId!==r.headers.get('x-request-id'))process.exit(1);console.log('Proxy error contract PASS')})"
logs=$(compose logs --no-color api)
case "$logs" in *sensitive-test-marker*) echo 'Sensitive header leaked in logs' >&2; exit 1;; esac
compose run --rm --no-deps -T migrate
schema=$(compose exec -T postgres psql -U nexora -d nexora -Atc "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL; SELECT count(*) FROM stored_files;")
[ "$schema" = "$(printf '3\n0')" ] || { echo 'Migrated schema assertion failed' >&2; exit 1; }
compose exec -T api node -e "if(process.getuid()===0)process.exit(1)"
compose exec -T web node -e "if(process.getuid()===0)process.exit(1)"

# Fresh installation must execute the packaged CLI, never direct account inserts.
printf '%s' 'SmokeTestPass123!' | compose exec -T api sh /scripts/api-entrypoint.sh node dist/cli/user-create.js --username smoke_user --password-stdin
# Duplicate usernames are a real CLI failure, with no sensitive driver diagnostics.
if printf '%s' 'SmokeTestPass123!' | compose exec -T api sh /scripts/api-entrypoint.sh node dist/cli/user-create.js --username smoke_user --password-stdin; then
 echo 'Duplicate account incorrectly provisioned' >&2; exit 1
fi
printf '%s' 'BrowserTestPass123!' | compose exec -T api sh /scripts/api-entrypoint.sh node dist/cli/user-create.js --username browser_user --password-stdin
python3 scripts/provisioning-tty-smoke.py
node scripts/auth-runtime-smoke.mjs
# Drive the actual form through the browser-facing host port, with browser-generated Origin.
browser_port=${WEB_PORT:-127.0.0.1:3001}
browser_port=${browser_port##*:}
printf '{"baseUrl":"http://127.0.0.1:%s","username":"browser_user","password":"BrowserTestPass123!"}' "$browser_port" | node scripts/browser-login-smoke.mjs

compose stop postgres
compose exec -T web node -e "Promise.all(['/live','/ready'].map(p=>fetch('http://127.0.0.1:3000/api/health'+p))).then(async ([l,r])=>{if(l.status!==200||r.status!==503||(await r.json()).checks.database!==false)process.exit(1);console.log('DB outage/live separation PASS')})"
compose start postgres
compose up -d --wait --wait-timeout 180
ports=$(compose ps --format json)
case "$ports" in *'"PublishedPort":4000'*|*'"PublishedPort":5432'*) echo 'Internal port exposed' >&2; exit 1;; esac
echo 'Runtime smoke PASS'
