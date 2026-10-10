#!/bin/sh
set -eu
# Dedicated local-only credential volume. Never log the generated password.
umask 077
if [ ! -s /config/postgres_password ]; then openssl rand -hex 32 > /config/postgres_password.tmp; mv /config/postgres_password.tmp /config/postgres_password; fi
# Only managed volume directories are repaired, never the source checkout.
chown 1000:1000 /config/postgres_password /uploads
chmod 600 /config/postgres_password
find /uploads -maxdepth 1 -type f -exec chown 1000:1000 {} +
chmod 700 /uploads
