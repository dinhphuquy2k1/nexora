#!/bin/sh
set -eu
# These are operator inputs, never request headers.
. /nexora/public-authority.sh
configure_public_authority || { echo 'Invalid public authority' >&2; exit 1; }
[ -s "/etc/letsencrypt/live/$PUBLIC_FQDN/fullchain.pem" ] && [ -s "/etc/letsencrypt/live/$PUBLIC_FQDN/privkey.pem" ] || { echo 'TLS certificate custody unavailable' >&2; exit 1; }
envsubst '${PUBLIC_FQDN} ${PUBLIC_AUTHORITY} ${PUBLIC_AUTHORITY_ALT_DIRECTIVE} ${PUBLIC_ORIGIN}' < /nexora/nginx.conf.template > /etc/nginx/nginx.conf
nginx -t
exec nginx -g 'daemon off;'
