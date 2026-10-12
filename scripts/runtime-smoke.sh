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

# Authentication & Security smoke tests (I1, I3, m1, M2, R3)
docker compose exec -T web node -e "const http=require('http');const req=http.request({host:'127.0.0.1',port:3000,path:'/api/health/live',headers:{host:'evil.example'}},res=>{if(res.statusCode!==400)process.exit(1);console.log('Untrusted Host rejection PASS')});req.on('error',()=>process.exit(1));req.end()"
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/auth/session').then(r=>{if(r.status!==401)process.exit(1);console.log('Unauthenticated session rejection PASS')})"
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/auth/session',{headers:{cookie:'nexora_session=%E0%A4%A'}}).then(r=>{if(r.status!==401)process.exit(1);console.log('Malformed cookie rejection PASS')})"
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'smoke_user',password:'SmokeTestPass123!'})}).then(r=>{if(r.status!==403)process.exit(1);console.log('Missing Origin rejection PASS')})"
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:'http://attacker.example'},body:JSON.stringify({username:'smoke_user',password:'SmokeTestPass123!'})}).then(r=>{if(r.status!==403)process.exit(1);console.log('Untrusted Origin rejection PASS')})"

docker compose exec -T api sh /scripts/api-entrypoint.sh node <<'JS'
const { createDatabase, hashPassword } = require('@nexora/database');
const { randomUUID } = require('node:crypto');
(async () => {
  const db = createDatabase(process.env.DATABASE_URL);
  try {
    const passwordHash = await hashPassword('SmokeTestPass123!');
    await db.localUser.create({
      data: {
        id: randomUUID(),
        username: 'smoke_user',
        passwordHash,
        isActive: true,
      },
    });
    console.log('Smoke operator provisioned');
  } finally {
    await db.$disconnect();
  }
})().catch(e => { console.error(e); process.exit(1); });
JS

docker compose exec -T web node <<'JS'
(async () => {
  // 1. Wrong credentials -> 401
  const badRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:3001' },
    body: JSON.stringify({ username: 'smoke_user', password: 'wrongpassword' }),
  });
  if (badRes.status !== 401) {
    console.error('Expected 401 on wrong password, got', badRes.status);
    process.exit(1);
  }

  // 2. Successful login -> 200 + Set-Cookie
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:3001' },
    body: JSON.stringify({ username: 'smoke_user', password: 'SmokeTestPass123!' }),
  });
  if (loginRes.status !== 200) {
    console.error('Expected 200 on login, got', loginRes.status);
    process.exit(1);
  }
  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie || !setCookie.includes('nexora_session=')) {
    console.error('Expected nexora_session cookie, got', setCookie);
    process.exit(1);
  }
  const token = setCookie.match(/nexora_session=([^;]+)/)[1];

  // 3. Valid session check -> 200
  const sessionRes = await fetch('http://127.0.0.1:3000/api/auth/session', {
    headers: { cookie: `nexora_session=${token}` },
  });
  if (sessionRes.status !== 200) {
    console.error('Expected 200 on valid session, got', sessionRes.status);
    process.exit(1);
  }
  const sessionData = await sessionRes.json();
  if (!sessionData.authenticated || sessionData.user.username !== 'smoke_user') {
    console.error('Unexpected session data', sessionData);
    process.exit(1);
  }

  // 3b. Valid session access to /login -> 307 redirect to sanitized returnUrl (F4)
  const redirectRes = await fetch('http://127.0.0.1:3000/login?from=%2Fsettings', {
    headers: { cookie: `nexora_session=${token}` },
    redirect: 'manual',
  });
  if (redirectRes.status !== 307 || redirectRes.headers.get('location') !== '/settings') {
    console.error('Expected 307 redirect to /settings on login with valid session, got', redirectRes.status, redirectRes.headers.get('location'));
    process.exit(1);
  }
  console.log('Login valid-session redirect PASS');

  // 4. Logout -> 200
  const logoutRes = await fetch('http://127.0.0.1:3000/api/auth/logout', {
    method: 'POST',
    headers: { cookie: `nexora_session=${token}`, origin: 'http://127.0.0.1:3001' },
  });
  if (logoutRes.status !== 200) {
    console.error('Expected 200 on logout, got', logoutRes.status);
    process.exit(1);
  }

  // 5. Subsequent session check -> 401
  const afterLogout = await fetch('http://127.0.0.1:3000/api/auth/session', {
    headers: { cookie: `nexora_session=${token}` },
  });
  if (afterLogout.status !== 401) {
    console.error('Expected 401 after logout revocation, got', afterLogout.status);
    process.exit(1);
  }

  console.log('Authentication smoke end-to-end PASS');
})().catch(e => { console.error(e); process.exit(1); });
JS

docker compose stop postgres
docker compose exec -T web node -e "Promise.all(['/live','/ready'].map(p=>fetch('http://127.0.0.1:3000/api/health'+p))).then(async ([l,r])=>{if(l.status!==200||r.status!==503||(await r.json()).checks.database!==false)process.exit(1);console.log('DB outage/live separation PASS')})"
docker compose start postgres
docker compose up -d --wait --wait-timeout 180
ports=$(docker compose ps --format json)
case "$ports" in *'"PublishedPort":4000'*|*'"PublishedPort":5432'*) echo 'Internal port exposed' >&2; exit 1;; esac
echo 'Runtime smoke PASS'
