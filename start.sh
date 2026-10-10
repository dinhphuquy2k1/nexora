#!/bin/sh
set -eu
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo 'Cần cài Docker Desktop/Engine.' >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Hãy mở Docker Desktop/Engine.' >&2; exit 1; }
docker compose version >/dev/null
case "${1:-}" in
 '') docker compose up --build -d --wait --wait-timeout 180 ;;
 --prebuilt) docker compose -f compose.release.yml up -d --wait --wait-timeout 180 ;;
 *) echo 'Usage: ./start.sh [--prebuilt]' >&2; exit 1 ;;
esac
echo 'Nexora đã sẵn sàng tại http://localhost:3001'
if command -v xdg-open >/dev/null; then xdg-open http://localhost:3001 >/dev/null 2>&1 || true
elif command -v open >/dev/null; then open http://localhost:3001; fi
