#!/bin/sh
set -eu
# Explicit test-only service; privileged URL is assembled before dropping to checkout owner.
exec sh /workspace/scripts/migration-entrypoint.sh sh /workspace/scripts/dev-entrypoint.sh "$@"
