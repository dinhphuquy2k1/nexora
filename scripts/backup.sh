#!/bin/sh
export MSYS_NO_PATHCONV=1
set -eu
umask 077
cd "$(dirname "$0")/.."
[ "$#" -eq 1 ] || { echo 'Usage: sh scripts/backup.sh NEW_DIRECTORY' >&2; exit 1; }
[ ! -e "$1" ] || { echo 'Backup destination already exists.' >&2; exit 1; }
mkdir -p "$1"
backup_dir=$(cd "$1" && (pwd -W 2>/dev/null || pwd))
compose(){
 if [ -n "${NEXORA_COMPOSE_OVERRIDE:-}" ]; then
  docker compose -f compose.yml -f "$NEXORA_COMPOSE_OVERRIDE" "$@"
 else
  docker compose -f compose.yml "$@"
 fi
}
# Remember only running writers. PostgreSQL remains online for pg_dump.
writers=$(compose ps --services --status running | sed -n '/^api$/p; /^web$/p')
restart() { if [ -n "$writers" ]; then compose start $writers >/dev/null; fi; }
trap restart EXIT HUP INT TERM
if [ -n "$writers" ]; then compose stop $writers; fi
compose exec -T postgres pg_dump -U nexora -d nexora -Fc > "$backup_dir/database.dump"
compose run --rm --no-deps -T --entrypoint tar init -czf - -C /uploads . > "$backup_dir/uploads.tar.gz"
docker run --rm -u "$(id -u):$(id -g)" -v "$backup_dir:/backup" nexora-tools:0.1.0 node /scripts/backup-manifest.mjs create
docker run --rm -v "$backup_dir:/backup:ro" nexora-tools:0.1.0 node /scripts/backup-manifest.mjs verify
echo "Backup completed: $backup_dir"
