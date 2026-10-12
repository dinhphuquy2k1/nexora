#!/bin/sh
export MSYS_NO_PATHCONV=1
set -eu
umask 077
cd "$(dirname "$0")/.."
[ "$#" -eq 3 ] && [ "$2" = --to-new-project ] || { echo 'Usage: sh scripts/restore.sh BACKUP_DIRECTORY --to-new-project UNIQUE_PROJECT' >&2; exit 1; }
backup_dir=$(cd "$1" && (pwd -W 2>/dev/null || pwd))
project=$3
case "$project" in ''|*[!a-z0-9_-]*|nexora) echo 'Choose a new lowercase project name, not nexora.' >&2; exit 1;; esac
for volume in postgres uploads credentials; do
 if docker volume inspect "${project}_${volume}" >/dev/null 2>&1; then echo 'Refusing to overwrite existing project volumes.' >&2; exit 1; fi
done
if [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$project")" ]; then echo 'Project already exists.' >&2; exit 1; fi
compose(){
 if [ -n "${NEXORA_COMPOSE_OVERRIDE:-}" ]; then
  docker compose -f compose.yml -f "$NEXORA_COMPOSE_OVERRIDE" -p "$project" "$@"
 else
  docker compose -f compose.yml -p "$project" "$@"
 fi
}
failed(){ echo "Restore failed at $1; restored application remains stopped and original data is untouched." >&2; exit 1; }
docker run --rm -v "$backup_dir:/backup:ro" nexora-tools:0.1.0 node /scripts/backup-manifest.mjs verify
# Never start restored API/Web writers before migration and session invalidation.
compose up -d --wait --wait-timeout 120 postgres || failed POSTGRES_START
compose exec -T postgres pg_restore -U nexora -d nexora --exit-on-error --no-owner --no-acl < "$backup_dir/database.dump" >/dev/null 2>&1 || failed DATABASE_RESTORE
# pg_restore owns historical migration metadata; deploy only missing committed migrations.
compose run --rm --no-deps -T migrate >/dev/null 2>&1 || failed MIGRATIONS
# The auth migration creates this mapped table even for genuine pre-authentication dumps.
compose exec -T postgres psql -U nexora -d nexora -v ON_ERROR_STOP=1 -c 'DELETE FROM public.sessions;' >/dev/null 2>&1 || failed SESSION_INVALIDATION
compose run --rm --no-deps -T --entrypoint tar init -xzf - -C /uploads < "$backup_dir/uploads.tar.gz" || failed UPLOAD_RESTORE
compose run --rm --no-deps -T --entrypoint sh init -c 'chown 1000:1000 /uploads /uploads/* 2>/dev/null || chown 1000:1000 /uploads' || failed UPLOAD_PERMISSIONS
# One-shot non-root runtime only: verify every cataloged original without listening on HTTP.
compose run --rm --no-deps -T api sh /scripts/api-entrypoint.sh node <<'JS' || failed DATA_INTEGRITY
const { createDatabase } = require('@nexora/database');
const { LocalStorage } = require('./dist/storage/infrastructure/local-storage');
const { createHash } = require('node:crypto');
(async () => {
 const db = createDatabase(process.env.DATABASE_URL);
 try {
  const storage = new LocalStorage('/data/uploads');
  for (const row of await db.storedFile.findMany()) {
   const bytes = await storage.read(row.id);
   if (bytes.length !== row.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new Error('Restored catalog integrity failure');
  }
  if (await db.session.count() !== 0) throw new Error('Restored sessions were not invalidated');
  console.log('Restored catalog/source integrity and empty session set PASS');
 } finally { await db.$disconnect(); }
})().catch(() => { console.error('Restored data verification failed; details withheld.'); process.exitCode = 1; });
JS
echo "Restored to isolated project $project; original data untouched. All operators must log in again."
echo "Start only this verified target with the same Web binding/override used for restore: docker compose -p $project up -d --wait --wait-timeout 180"
