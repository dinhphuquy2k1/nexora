#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ "${1:-}" = --prebuilt ]; then docker compose -f compose.release.yml down; else docker compose down; fi
echo 'Đã dừng Nexora. Dữ liệu và file vẫn được giữ trong volumes.'
