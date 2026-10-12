# Testing

`sh scripts/quality-docker.sh` starts development mode, then runs frozen-installed formatting, architectural lint, typecheck, meaningful unit tests, contract drift, build and migrated PostgreSQL integration inside Docker. It pauses API/web watchers while build outputs are rewritten, restarts them on exit and does not delete volumes. Use the `run` mapped-user entrypoint for commands writing generated outputs rather than bypassing it with exec.

```sh
docker compose -f compose.yml -f compose.dev.yml run --rm --no-deps -T api sh /workspace/scripts/api-entrypoint.sh sh -c 'NODE_ENV=production API_INTERNAL_URL=http://api:4000 pnpm quality && NODE_ENV=test pnpm test:integration'
sh scripts/runtime-smoke.sh
sh scripts/data-smoke.sh
sh scripts/dev-smoke.sh
```

Runtime smoke creates its own disposable project and checks real proxy health/errors, non-root runtime, DB outage, repeated migration, and the complete authentication lifecycle (Host header filtering, untrusted Origin rejection, unauthenticated route rejection, safe malformed cookie parsing, login credential verification, session cookie issuance, session validation, and post-logout revocation). Data smoke stores a real catalog row + file, verifies down/up and backup/restore in distinct disposable volumes, then removes ONLY those volumes. Dev smoke verifies HMR/shared propagation and frozen dependency failure without resetting DB. Stop unrelated web occupying port 3001 first.
Host `pnpm quality` is optional and needs working engine downloads; it is not a substitute for Docker runtime verification. Contracts can generate without DB or engine; built web consumes existing generated output.
CI `.github/workflows/foundation.yml` runs Docker quality/runtime/data/dev smoke on Linux. A created workflow is NOT VERIFIED until a hosted run exists. See the task ledger for actual commands, counts and limitations.

Cloud-only overrides may be supplied as `NEXORA_COMPOSE_OVERRIDE=/absolute/path/platform.yml`. Set `NEXORA_QUALITY_NO_BUILD=1` only when matching dev/migration images were already built and verified; the default builds images. Neither option skips quality or integration checks.
