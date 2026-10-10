#!/bin/sh
export MSYS_NO_PATHCONV=1
set -eu
cd "$(dirname "$0")/.."
[ "$#" -eq 3 ] && [ "$2" = --to-new-project ] || { echo 'Usage: sh scripts/restore.sh BACKUP_DIRECTORY --to-new-project UNIQUE_PROJECT' >&2; exit 1; }
backup_dir=$(cd "$1" && (pwd -W 2>/dev/null || pwd))
project=$3
case "$project" in ''|*[!a-z0-9_-]*|nexora) echo 'Choose a new lowercase project name, not nexora.' >&2; exit 1;; esac
for volume in postgres uploads credentials; do
 if docker volume inspect "${project}_${volume}" >/dev/null 2>&1; then echo 'Refusing to overwrite existing project volumes.' >&2; exit 1; fi
done
if [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$project")" ]; then echo 'Project already exists.' >&2; exit 1; fi
docker run --rm -v "$backup_dir:/backup:ro" nexora-tools:0.1.0 node /scripts/backup-manifest.mjs verify
# Never modify original project volumes. Restored project initially has no writers.
docker compose -p "$project" up -d --wait --wait-timeout 120 postgres
docker compose -p "$project" exec -T postgres pg_restore -U nexora -d nexora --exit-on-error --no-owner --no-acl < "$backup_dir/database.dump"
docker compose -p "$project" run --rm --no-deps -T --entrypoint tar init -xzf - -C /uploads < "$backup_dir/uploads.tar.gz"
docker compose -p "$project" run --rm --no-deps -T --entrypoint sh init -c 'chown 1000:1000 /uploads /uploads/* 2>/dev/null || chown 1000:1000 /uploads'
echo "Restored to isolated project $project; original data untouched."
echo "Stop the original web before running: docker compose -p $project up -d --wait --wait-timeout 180"
