#!/bin/sh
export MSYS_NO_PATHCONV=1
set -eu
umask 077
cd "$(dirname "$0")/.."
project="nexora-data-smoke-$$"
# This is exclusively this script's disposable project.
export ALLOWED_ORIGINS=
export COMPOSE_PROJECT_NAME="$project"
compose(){
 if [ -n "${NEXORA_COMPOSE_OVERRIDE:-}" ]; then
  docker compose -f compose.yml -f "$NEXORA_COMPOSE_OVERRIDE" "$@"
 else
  docker compose -f compose.yml "$@"
 fi
}
# Refuse existing namespace before installing a destructive cleanup trap.
if [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$project")" ]; then
 echo 'Disposable smoke project already exists; refusing reuse or cleanup.' >&2; exit 1
fi
for volume in postgres uploads credentials runtime_credentials; do
 if docker volume inspect "${project}_${volume}" >/dev/null 2>&1; then
  echo 'Disposable smoke volume already exists; refusing reuse or cleanup.' >&2; exit 1
 fi
done
work=$(mktemp -d)
work_mount=$(cd "$work" && (pwd -W 2>/dev/null || pwd))
cleanup(){
  status=$?; if [ "$status" -ne 0 ]; then compose logs --no-color --tail 60 >&2; fi; compose -p "$project" down -v --remove-orphans >/dev/null; rm -rf "$work"; }
trap cleanup EXIT HUP INT TERM
compose up -d --no-build --wait --wait-timeout 180
compose exec -T api sh /scripts/api-entrypoint.sh node > "$work/blob.json" <<'JS'
const {DatabaseAdapter}=require('./dist/health/infrastructure/database.adapter');
const {LocalStorage}=require('./dist/storage/infrastructure/local-storage');
const {FilesService}=require('./dist/storage/application/file-storage.port');
(async()=>{const db=new DatabaseAdapter(process.env.DATABASE_URL);try{console.log(JSON.stringify(await new FilesService(new LocalStorage('/data/uploads'),db).save(Buffer.from('Nexora original source persistence smoke'))));}finally{await db.onApplicationShutdown();}})().catch(()=>process.exit(1));
JS
file_id=$(docker run --rm -v "$work_mount:/evidence:ro" nexora-tools:0.1.0 node -p "JSON.parse(require('fs').readFileSync('/evidence/blob.json')).id")
# Owned persistence fixtures only: no usable login/password or provider credentials.
compose exec -T postgres psql -U nexora -d nexora -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
WITH u AS (INSERT INTO users(id,username,role,status,updated_at) VALUES(gen_random_uuid(),'persistence-fixture','ADMIN','ACTIVE',now()) RETURNING id),
c AS (INSERT INTO carrier_connections(user_id,provider,external_account_id,login_identifier,display_name,status) SELECT id,'uniship','persistence-fixture','fixture','Fixture','CONNECTED' FROM u RETURNING id,user_id),
cred AS (INSERT INTO user_credentials SELECT id,'non-authenticating persistence fixture' FROM u),
s AS (INSERT INTO sessions(id,token_hash,user_id,expires_at) SELECT gen_random_uuid(),md5(random()::text)||md5(random()::text),id,now()+interval '1 day' FROM u),
t AS (INSERT INTO operator_setup_tokens(user_id,issued_by,token_hash,expires_at) SELECT id,id,md5(random()::text)||md5(random()::text),now()+interval '1 day' FROM u),
e AS (INSERT INTO carrier_user_states SELECT id,1 FROM u),
a AS (INSERT INTO security_audit_events(event_type,outcome,reason,user_id,connection_id,provider,correlation_id) SELECT 'CONNECT','SUCCESS','VERIFIED',user_id,id,'uniship',gen_random_uuid() FROM c)
INSERT INTO carrier_connection_secrets(connection_id,secret_type,ciphertext,nonce,auth_tag,key_version) SELECT id,'PASSWORD','opaque-persistence-fixture','opaque-nonce','opaque-tag',1 FROM c;
SQL
snapshot(){
 for table in users user_credentials sessions operator_setup_tokens stored_files carrier_connections carrier_connection_secrets carrier_user_states security_audit_events; do
  compose exec -T postgres psql -U nexora -d nexora -Atc "SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM $table t;"
 done
 compose exec -T postgres sha256sum /config/postgres_password
 compose exec -T api sha256sum /runtime-config/postgres_app_password
}
snapshot > "$work/before"
compose run --rm --no-deps -T db-runtime
compose restart api web
compose up -d --wait --wait-timeout 180
compose down
compose up -d --no-build --wait --wait-timeout 180
verify(){
 compose -p "$1" run --rm --no-deps -T --entrypoint sh api /scripts/api-entrypoint.sh node - "$file_id" <<'JS'
const assert=require('node:assert/strict');const {createHash}=require('node:crypto');
const {DatabaseAdapter}=require('./dist/health/infrastructure/database.adapter');const {LocalStorage}=require('./dist/storage/infrastructure/local-storage');
(async()=>{const db=new DatabaseAdapter(process.env.DATABASE_URL);try{const id=process.argv[2];const row=await db.client.storedFile.findUniqueOrThrow({where:{id}});const bytes=await new LocalStorage('/data/uploads').read(id);assert.equal(bytes.toString(),'Nexora original source persistence smoke');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(bytes.length,row.sizeBytes);console.log('DB catalog + original file persistence PASS');}finally{await db.onApplicationShutdown();}})().catch(()=>process.exit(1));
JS
}
snapshot > "$work/after"
cmp -s "$work/before" "$work/after" || { echo 'Database rows or credential custody changed across restart/down-up' >&2; exit 1; }
echo 'Identity, sessions, Carrier ciphertext, audit and both credential files preserved PASS'
verify "$project"
echo 'Restart/down-up persistence checks PASS'
