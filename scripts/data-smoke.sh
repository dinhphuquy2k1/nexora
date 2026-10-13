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
for volume in postgres uploads credentials; do
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
verify "$project"
echo 'Restart/down-up persistence checks PASS'
