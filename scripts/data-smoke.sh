#!/bin/sh
export MSYS_NO_PATHCONV=1
set -eu
cd "$(dirname "$0")/.."
project="nexora-data-smoke-$$"
restored="$project-restored"
export COMPOSE_PROJECT_NAME="$project"
work=$(mktemp -d)
work_mount=$(cd "$work" && (pwd -W 2>/dev/null || pwd))
cleanup(){
  status=$?; if [ "$status" -ne 0 ]; then docker compose logs --no-color --tail 60 >&2; fi;  docker compose -p "$project" down -v --remove-orphans >/dev/null; docker compose -p "$restored" down -v --remove-orphans >/dev/null; rm -rf "$work"; }
trap cleanup EXIT HUP INT TERM
docker compose up -d --no-build --wait --wait-timeout 180
docker compose exec -T api sh /scripts/api-entrypoint.sh node > "$work/blob.json" <<'JS'
const {DatabaseAdapter}=require('./dist/health/infrastructure/database.adapter');
const {LocalStorage}=require('./dist/storage/infrastructure/local-storage');
const {FilesService}=require('./dist/storage/application/file-storage.port');
(async()=>{const db=new DatabaseAdapter(process.env.DATABASE_URL);try{console.log(JSON.stringify(await new FilesService(new LocalStorage('/data/uploads'),db).save(Buffer.from('Nexora original source persistence smoke'))));}finally{await db.onApplicationShutdown();}})().catch(()=>process.exit(1));
JS
file_id=$(docker run --rm -v "$work_mount:/evidence:ro" nexora-tools:0.1.0 node -p "JSON.parse(require('fs').readFileSync('/evidence/blob.json')).id")
docker compose restart api web
docker compose up -d --wait --wait-timeout 180
docker compose down
docker compose up -d --no-build --wait --wait-timeout 180
verify(){
 docker compose -p "$1" run --rm --no-deps -T --entrypoint sh api /scripts/api-entrypoint.sh node - "$file_id" <<'JS'
const assert=require('node:assert/strict');const {createHash}=require('node:crypto');
const {DatabaseAdapter}=require('./dist/health/infrastructure/database.adapter');const {LocalStorage}=require('./dist/storage/infrastructure/local-storage');
(async()=>{const db=new DatabaseAdapter(process.env.DATABASE_URL);try{const id=process.argv[2];const row=await db.client.storedFile.findUniqueOrThrow({where:{id}});const bytes=await new LocalStorage('/data/uploads').read(id);assert.equal(bytes.toString(),'Nexora original source persistence smoke');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(bytes.length,row.sizeBytes);console.log('DB catalog + original file persistence PASS');}finally{await db.onApplicationShutdown();}})().catch(()=>process.exit(1));
JS
}
verify "$project"
sh scripts/backup.sh "$work/backup"
cp "$work/backup/database.dump" "$work/database.original"
printf 'corruption' >> "$work/backup/database.dump"
if docker run --rm -v "$work_mount/backup:/backup:ro" nexora-tools:0.1.0 node /scripts/backup-manifest.mjs verify > "$work/corruption.log" 2>&1; then echo 'Checksum guard failed' >&2; exit 1; fi
grep -q 'Checksum mismatch' "$work/corruption.log"
mv "$work/database.original" "$work/backup/database.dump"
sh scripts/restore.sh "$work/backup" --to-new-project "$restored"
verify "$restored"
if sh scripts/restore.sh "$work/backup" --to-new-project "$restored" > "$work/overwrite.log" 2>&1; then echo 'Overwrite guard failed' >&2; exit 1; fi
grep -q 'Refusing to overwrite' "$work/overwrite.log"
echo 'Restart/down-up/backup/restore/corruption/overwrite checks PASS'
