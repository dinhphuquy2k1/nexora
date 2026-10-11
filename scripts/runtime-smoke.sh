#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Only this script's disposable project may be removed with volumes.
project="nexora-smoke-$$"
export COMPOSE_PROJECT_NAME="$project"
cleanup(){
  status=$?; if [ "$status" -ne 0 ]; then docker compose logs --no-color --tail 60 >&2; fi;  docker compose down -v --remove-orphans >/dev/null; }
trap cleanup EXIT HUP INT TERM
if [ "${NEXORA_SMOKE_NO_BUILD:-0}" = 1 ]; then docker compose up --no-build -d --wait --wait-timeout 180; else docker compose up --build -d --wait --wait-timeout 180; fi
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async r=>{const b=await r.json();if(r.status!==200||!b.checks.database||!b.checks.storage)process.exit(1);console.log('Same-origin readiness PASS')})"
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/missing',{headers:{authorization:'Bearer sensitive-test-marker'}}).then(async r=>{const b=await r.json();if(r.status!==404||b.code!=='NOT_FOUND'||!b.requestId||b.requestId!==r.headers.get('x-request-id'))process.exit(1);console.log('Proxy error contract PASS')})"
logs=$(docker compose logs --no-color api)
case "$logs" in *sensitive-test-marker*) echo 'Sensitive header leaked in logs' >&2; exit 1;; esac
docker compose run --rm --no-deps -T migrate
schema=$(docker compose exec -T postgres psql -U nexora -d nexora -Atc "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL; SELECT count(*) FROM stored_files;")
[ "$schema" = "$(printf '2\n0')" ] || { echo 'Migrated schema assertion failed' >&2; exit 1; }
docker compose exec -T api node -e "if(process.getuid()===0)process.exit(1)"
docker compose exec -T web node -e "if(process.getuid()===0)process.exit(1)"
docker compose stop postgres
docker compose exec -T web node -e "Promise.all(['/live','/ready'].map(p=>fetch('http://127.0.0.1:3000/api/health'+p))).then(async ([l,r])=>{if(l.status!==200||r.status!==503||(await r.json()).checks.database!==false)process.exit(1);console.log('DB outage/live separation PASS')})"
docker compose start postgres
docker compose up -d --wait --wait-timeout 180
ports=$(docker compose ps --format json)
case "$ports" in *'"PublishedPort":4000'*|*'"PublishedPort":5432'*) echo 'Internal port exposed' >&2; exit 1;; esac
echo 'Runtime smoke PASS'
