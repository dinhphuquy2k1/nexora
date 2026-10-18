#!/bin/sh
# Disposable HTTPS verification only. Never a production DNS/certificate/NTP claim.
set -eu
umask 077
cd "$(dirname "$0")/.."
project="nexora-https-${NEXORA_VERIFICATION_RUN_ID:-$$}"
export COMPOSE_PROJECT_NAME="$project"
python3 scripts/smoke-project.py "$project"
work=$(mktemp -d)
export PUBLIC_FQDN=nexora.example.test
https_port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
http_port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
export PUBLIC_ORIGIN="https://$PUBLIC_FQDN:$https_port"
export ALLOWED_HOSTS="$PUBLIC_FQDN:$https_port" ALLOWED_ORIGINS="$PUBLIC_ORIGIN"
IDENTITY_KEYRING_JSON=$(node -e 'console.log(JSON.stringify({1:require("node:crypto").randomBytes(32).toString("base64")}))')
export IDENTITY_KEYRING_JSON IDENTITY_ACTIVE_KEY_VERSION=1
CARRIER_KEYRING_JSON=$(node -e 'console.log(JSON.stringify({1:require("node:crypto").randomBytes(32).toString("base64")}))')
export CARRIER_KEYRING_JSON CARRIER_ACTIVE_KEY_VERSION=1
local_compose(){ docker compose -f compose.yml "$@"; }
public_compose(){ docker compose -f compose.yml -f compose.public.yml -f "$work/https.yml" "$@"; }
gate_diagnostic(){
  python3 - "$1" <<'PYCODE'
import pathlib,sys
text=pathlib.Path(sys.argv[1]).read_text(errors='replace').lower()
patterns=[('read-only file system','READ_ONLY_MOUNT'),('address already in use','ADDRESS_IN_USE'),('address is already in use','ADDRESS_IN_USE'),('invalid pool','NETWORK_POOL'),('manifest unknown','IMAGE_MISSING'),('toomanyrequests','IMAGE_PULL_LIMIT'),('pull access denied','IMAGE_PULL_DENIED'),('cannot find module','MODULE_LOAD'),('invalid runtime credential','RUNTIME_CREDENTIAL'),('startup_failed','APPLICATION_GATE')]
print('One-off diagnostic: '+next((name for pattern,name in patterns if pattern in text),'UNCLASSIFIED'))
PYCODE
}
assert_public_startup_rejected(){
  gate_log=$1; shift
  gate_status=0
  timeout 40s docker compose -f compose.yml -f compose.public.yml -f "$work/https.yml" run --rm --no-deps -T "$@" api > "$gate_log" 2>&1 || gate_status=$?
  if [ "$gate_status" -eq 0 ] || [ "$gate_status" -eq 124 ]; then echo 'Public startup gate did not reject safely within deadline' >&2; exit 1; fi
  if ! grep -q '"event":"startup_failed"' "$gate_log"; then gate_diagnostic "$gate_log"; exit 1; fi
}
cleanup(){
  status=$?
  # Fixed safe app logs only; no config/env or certificate/fixture output.
  if [ "$status" -ne 0 ]; then public_compose logs --no-color --tail 40 api web ingress >&2 || true; fi
  public_compose down -v --remove-orphans >/dev/null 2>&1 || local_compose down -v --remove-orphans >/dev/null 2>&1 || true
  python3 - "$work" <<'PY'
import pathlib,sys,shutil
p=pathlib.Path(sys.argv[1])
if p.parent==pathlib.Path('/tmp') and p.name.startswith('tmp.'):shutil.rmtree(p)
PY
  exit "$status"
}
trap cleanup EXIT HUP INT TERM
mkdir -p "$work/tls/live/$PUBLIC_FQDN"
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$work/ca.key" -out "$work/ca.crt" -sha256 -days 2 -subj '/CN=Nexora disposable HTTPS test CA' >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -keyout "$work/tls/live/$PUBLIC_FQDN/privkey.pem" -out "$work/leaf.csr" -subj "/CN=$PUBLIC_FQDN" >/dev/null 2>&1
printf 'subjectAltName=DNS:%s\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n' "$PUBLIC_FQDN" > "$work/ext"
openssl x509 -req -in "$work/leaf.csr" -CA "$work/ca.crt" -CAkey "$work/ca.key" -CAcreateserial -out "$work/leaf.crt" -days 2 -sha256 -extfile "$work/ext" >/dev/null 2>&1
cat "$work/leaf.crt" "$work/ca.crt" > "$work/tls/live/$PUBLIC_FQDN/fullchain.pem"
# Chromium exception is scoped to this disposable leaf SPKI only; Node verifies the real CA/name normally.
spki=$(openssl x509 -in "$work/leaf.crt" -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl base64 -A)
cat > "$work/https.yml" <<YAML
services:
  ingress:
    ports: !override ["127.0.0.1:$https_port:443", "127.0.0.1:$http_port:80"]
    volumes:
      - $work/tls:/etc/letsencrypt:ro
YAML
# Local CLI bootstrap is private. Same named volumes then upgrade to public profile.
local_compose up --no-build -d --wait --wait-timeout 180
printf '%s' 'BrowserTestPass123!' | local_compose exec -T api sh /scripts/api-entrypoint.sh node dist/cli/user-create.js --username browser_user --password-stdin >/dev/null
python3 scripts/mfa-enrollment-tty-smoke.py "$work/fixture.json"
printf '%s' 'GateFixturePassword!' | local_compose exec -T api sh /scripts/api-entrypoint.sh node dist/cli/user-create.js --username gate_unenrolled --password-stdin >/dev/null
local_compose exec -T api sh /scripts/api-entrypoint.sh node - seed < scripts/public-persistence-fixture.cjs
local_compose exec -T postgres sha256sum /config/postgres_password > "$work/admin-hash"
local_compose exec -T api sha256sum /runtime-config/postgres_app_password > "$work/runtime-hash"
local_compose stop api web >/dev/null
public_compose up --no-build -d --wait --wait-timeout 180 postgres
public_compose run --rm --no-deps -T migrate
public_compose run --rm --no-deps -T db-runtime
echo 'Checking public unenrolled ADMIN rejection'
assert_public_startup_rejected "$work/gate.log"
echo 'Public unenrolled ADMIN startup rejection PASS'
local_compose exec -T postgres psql -U nexora -d nexora -v ON_ERROR_STOP=1 -c "UPDATE users SET status='DISABLED' WHERE username='gate_unenrolled';" >/dev/null
echo 'Checking public Identity custody rejection'
assert_public_startup_rejected "$work/key-gate.log" -e IDENTITY_KEYRING_JSON=invalid
echo 'Public Identity custody startup rejection PASS'
echo 'Checking missing TLS custody rejection'
if public_compose run --rm --no-deps -T -e PUBLIC_FQDN=missing.example.test -e PUBLIC_ORIGIN=https://missing.example.test ingress > "$work/tls-gate.log" 2>&1; then echo 'Missing TLS custody incorrectly succeeded' >&2; exit 1; fi
if ! grep -q 'TLS certificate custody unavailable' "$work/tls-gate.log"; then gate_diagnostic "$work/tls-gate.log"; exit 1; fi
echo 'Missing TLS custody rejection PASS'
public_compose up --no-build -d --wait --wait-timeout 180 ingress
public_compose config --format json > "$work/compose.json"
public_compose ps -a --format json > "$work/containers.json"
node - "$work/fixture.json" "$work/ca.crt" "$spki" "$https_port" "$http_port" "$work/compose.json" "$work/session.json" "$work/containers.json" "$work/https.yml" <<'JS' | node scripts/public-https-browser.mjs
const fs=require('node:fs');const f=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));Object.assign(f,{caPath:process.argv[3],spki:process.argv[4],httpsPort:Number(process.argv[5]),httpPort:Number(process.argv[6]),composePath:process.argv[7],host:'nexora.example.test',sessionPath:process.argv[8],containersPath:process.argv[9],overridePath:process.argv[10]});process.stdout.write(JSON.stringify(f));
JS
public_compose logs --no-color api web ingress > "$work/server.log"
node - "$work/server.log" "$work/fixture.json" "$work/session.json" <<'JS'
const fs=require('node:fs'),logs=fs.readFileSync(process.argv[2],'utf8'),f=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),s=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
for(const value of [f.password,f.mfaSetupKey,...f.recoveryCodes,s.token,s.setupToken]) if(value && logs.includes(value)){console.error('HTTPS server secret privacy failed');process.exit(1);}
console.log('HTTPS API/Web/ingress secret-log privacy PASS');
JS
public_compose exec -T api sh /scripts/api-entrypoint.sh node - check < scripts/public-persistence-fixture.cjs
# Simulate certificate replacement and safe reload only within this disposable test CA.
openssl req -newkey rsa:2048 -nodes -keyout "$work/next-key.pem" -out "$work/next.csr" -subj "/CN=$PUBLIC_FQDN" >/dev/null 2>&1
openssl x509 -req -in "$work/next.csr" -CA "$work/ca.crt" -CAkey "$work/ca.key" -CAcreateserial -out "$work/next-leaf.crt" -days 2 -sha256 -extfile "$work/ext" >/dev/null 2>&1
cat "$work/next-leaf.crt" "$work/ca.crt" > "$work/next-chain.pem"
mv "$work/next-key.pem" "$work/tls/live/$PUBLIC_FQDN/privkey.pem"
mv "$work/next-chain.pem" "$work/tls/live/$PUBLIC_FQDN/fullchain.pem"
expected_fingerprint=$(openssl x509 -in "$work/next-leaf.crt" -noout -fingerprint -sha256 | cut -d= -f2)
public_compose exec -T ingress nginx -t
public_compose exec -T ingress nginx -s reload
node scripts/public-https-restart.mjs "$work/session.json" "$work/ca.crt" "$https_port" "$expected_fingerprint"
echo 'Disposable certificate replacement and safe Nginx reload preserve session PASS'
# Stop every application/health writer before archiving, including storage readiness probes.
public_compose stop ingress web api >/dev/null
backup_api=$(public_compose ps -aq api)
[ -n "$backup_api" ]
backup_image=$(docker inspect --format '{{.Config.Image}}' "$backup_api")
docker run --rm --network none --volumes-from "$backup_api:ro" --entrypoint tar "$backup_image" -C /data/uploads -cf - . > "$work/files.tar"
# Genuine offline backup and isolated restore: never restore into the live test database.
public_compose exec -T postgres pg_dump -U nexora nexora > "$work/backup.sql"
public_compose exec -T postgres createdb -U nexora nexora_public_restore
public_compose exec -T postgres psql -U nexora -d nexora_public_restore -v ON_ERROR_STOP=1 < "$work/backup.sql" > "$work/restore.log"
query="SELECT count(*) FROM users; SELECT count(*) FROM sessions; SELECT count(*) FROM user_mfa; SELECT count(*) FROM operator_setup_tokens; SELECT md5(string_agg(totp_secret_ciphertext,',' ORDER BY user_id)) FROM user_mfa; SELECT md5(string_agg(ciphertext,',' ORDER BY connection_id)) FROM carrier_connection_secrets; SELECT count(*) FROM stored_files;"
original=$(public_compose exec -T postgres psql -U nexora -d nexora -Atc "$query")
restored=$(public_compose exec -T postgres psql -U nexora -d nexora_public_restore -Atc "$query")
[ "$original" = "$restored" ] || { echo 'Isolated HTTPS database restore mismatch' >&2; exit 1; }
public_compose exec -T postgres dropdb -U nexora nexora_public_restore
public_compose up --no-build -d --wait --wait-timeout 180 ingress
public_compose exec -T api mkdir /tmp/nexora-https-restore
public_compose exec -T api tar -C /tmp/nexora-https-restore -xf - < "$work/files.tar"
public_compose exec -T api sh /scripts/api-entrypoint.sh node - check /tmp/nexora-https-restore < scripts/public-persistence-fixture.cjs
public_compose restart api web ingress >/dev/null
public_compose up --no-build -d --wait --wait-timeout 180 ingress
restart=$(public_compose exec -T postgres psql -U nexora -d nexora -Atc "$query")
[ "$original" = "$restart" ] || { echo 'HTTPS restart persistence mismatch' >&2; exit 1; }
public_compose exec -T api sh /scripts/api-entrypoint.sh node - check < scripts/public-persistence-fixture.cjs
public_compose exec -T postgres sha256sum /config/postgres_password > "$work/admin-hash-after"
public_compose exec -T api sha256sum /runtime-config/postgres_app_password > "$work/runtime-hash-after"
cmp "$work/admin-hash" "$work/admin-hash-after"
cmp "$work/runtime-hash" "$work/runtime-hash-after"
node scripts/public-https-restart.mjs "$work/session.json" "$work/ca.crt" "$https_port"
echo 'Disposable HTTPS MFA/onboarding/ingress, isolated backup-restore and restart PASS; production DNS/certificate/firewall/NTP NOT VERIFIED'
