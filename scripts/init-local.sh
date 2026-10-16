#!/bin/sh
set -eu
umask 077
# Never replace an existing credential, including an empty/corrupt one.
create_secret() {
 if [ ! -e "$1" ]; then openssl rand -hex 32 > "$1.tmp"; mv "$1.tmp" "$1"; fi
 [ -s "$1" ] || { echo 'Existing credential is empty; restore custody without resetting data' >&2; exit 1; }
 chmod 600 "$1"
}
create_secret /config/postgres_password
create_secret /runtime-config/postgres_app_password
chown 1000:1000 /config/postgres_password /uploads
runtime_uid=1000
runtime_gid=1000
# Development's read-only checkout mount is used only to determine the runtime UID.
if [ -d /checkout ]; then runtime_uid=$(stat -c '%u' /checkout); runtime_gid=$(stat -c '%g' /checkout); fi
chown "$runtime_uid:$runtime_gid" /runtime-config/postgres_app_password
find /uploads -maxdepth 1 -type f -exec chown 1000:1000 {} +
chmod 700 /uploads
