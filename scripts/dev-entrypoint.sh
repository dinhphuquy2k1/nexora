#!/bin/sh
set -eu
workspace_uid=$(stat -c '%u' /workspace)
workspace_gid=$(stat -c '%g' /workspace)
run_owner() { exec gosu "$workspace_uid:$workspace_gid" "$@"; }
if [ "${1:-}" != dependencies ]; then run_owner "$@"; fi
if [ -d /data/uploads ]; then
 chown "$workspace_uid:$workspace_gid" /data/uploads
 find /data/uploads -maxdepth 1 -type f -exec chown "$workspace_uid:$workspace_gid" {} +
fi
# Strictly named volumes only. Source ownership never changes.
for p in /workspace/node_modules /workspace/apps/api/node_modules /workspace/apps/web/node_modules /workspace/packages/*/node_modules /workspace/apps/web/.next /workspace/apps/api/dist /workspace/packages/database/dist /workspace/packages/shared/dist /workspace/.turbo /pnpm/store; do
 mkdir -p "$p"
 chown -R "$workspace_uid:$workspace_gid" "$p"
done
gosu "$workspace_uid:$workspace_gid" env CI=true pnpm install --frozen-lockfile --store-dir /pnpm/store
gosu "$workspace_uid:$workspace_gid" pnpm --filter @nexora/api... build
