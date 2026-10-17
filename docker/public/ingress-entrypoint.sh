#!/bin/sh
set -eu
# These are operator inputs, never request headers. Keep template substitution bounded.
case "${PUBLIC_FQDN:-}" in ''|*[!a-zA-Z0-9.-]*) echo 'Invalid public FQDN' >&2; exit 1;; esac
PUBLIC_AUTHORITY=${PUBLIC_ORIGIN#https://}
[ "$PUBLIC_AUTHORITY" != "$PUBLIC_ORIGIN" ] || exit 1
case "$PUBLIC_AUTHORITY" in "$PUBLIC_FQDN") PUBLIC_AUTHORITY_ALT_DIRECTIVE="\"$PUBLIC_FQDN:443\" 1;";; "$PUBLIC_FQDN":[0-9]*) PUBLIC_AUTHORITY_ALT_DIRECTIVE="";; *) exit 1;; esac
case "$PUBLIC_AUTHORITY" in *[!a-zA-Z0-9.:-]*) exit 1;; esac
export PUBLIC_AUTHORITY PUBLIC_AUTHORITY_ALT_DIRECTIVE
[ -s "/etc/letsencrypt/live/$PUBLIC_FQDN/fullchain.pem" ] && [ -s "/etc/letsencrypt/live/$PUBLIC_FQDN/privkey.pem" ] || { echo 'TLS certificate custody unavailable' >&2; exit 1; }
envsubst '${PUBLIC_FQDN} ${PUBLIC_AUTHORITY} ${PUBLIC_AUTHORITY_ALT_DIRECTIVE} ${PUBLIC_ORIGIN}' < /nexora/nginx.conf.template > /etc/nginx/nginx.conf
nginx -t
exec nginx -g 'daemon off;'
