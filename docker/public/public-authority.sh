# Pure operator-input normalization, shared by the real ingress entrypoint and tests.
configure_public_authority() {
  case "${PUBLIC_FQDN:-}" in ''|*[!a-zA-Z0-9.-]*) return 1;; esac
  PUBLIC_FQDN=$(printf '%s' "$PUBLIC_FQDN" | LC_ALL=C tr '[:upper:]' '[:lower:]')
  PUBLIC_ORIGIN=$(printf '%s' "${PUBLIC_ORIGIN:-}" | LC_ALL=C tr '[:upper:]' '[:lower:]')
  PUBLIC_AUTHORITY=${PUBLIC_ORIGIN#https://}
  [ "$PUBLIC_AUTHORITY" != "$PUBLIC_ORIGIN" ] || return 1
  case "$PUBLIC_AUTHORITY" in
    "$PUBLIC_FQDN") ;;
    "$PUBLIC_FQDN":*)
      public_port=${PUBLIC_AUTHORITY#"$PUBLIC_FQDN":}
      case "$public_port" in ''|*[!0-9]*|0*) return 1;; esac
      [ "${#public_port}" -le 5 ] && [ "$public_port" -le 65535 ] || return 1
      if [ "$public_port" = 443 ]; then
        PUBLIC_AUTHORITY=$PUBLIC_FQDN
        PUBLIC_ORIGIN="https://$PUBLIC_FQDN"
      fi
      ;;
    *) return 1;;
  esac
  case "$PUBLIC_AUTHORITY" in
    "$PUBLIC_FQDN") PUBLIC_AUTHORITY_ALT_DIRECTIVE="\"$PUBLIC_FQDN:443\" 1;";;
    *) PUBLIC_AUTHORITY_ALT_DIRECTIVE="";;
  esac
  export PUBLIC_FQDN PUBLIC_ORIGIN PUBLIC_AUTHORITY PUBLIC_AUTHORITY_ALT_DIRECTIVE
}
