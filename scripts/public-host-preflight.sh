#!/bin/sh
# Execute on the actual deployment host. CI parsing fixtures cannot establish host readiness.
set -eu
status=$(LC_ALL=C timedatectl status) || { echo 'Public host NTP gate NOT VERIFIED' >&2; exit 1; }
printf '%s\n' "$status"
printf '%s\n' "$status" | grep -Eq 'System clock synchronized:[[:space:]]+yes' && printf '%s\n' "$status" | grep -Eq 'NTP service:[[:space:]]+active' || { echo 'Public host NTP gate FAILED' >&2; exit 1; }
echo 'Actual host NTP preflight PASS; DNS/TLS/firewall and application gates still required'
