# Runtime

## Local release (default)

Compose `init` generates and retains a random local DB password, repairs only dedicated credential/upload volume permissions; PostgreSQL 17.11 has no published ports. One-shot `migrate` runs after DB healthy; compiled non-root API starts after migrate success and owns uploads as UID 1000. Non-root web waits for API healthy and publishes host port `127.0.0.1:3001:3000` (configurable via `WEB_PORT`).
Named volumes: postgres, uploads and credentials survive down/restart. No auth/encryption key is generated without a consumer. Init is idempotent and does not rotate existing DB credentials. Host source is not mounted into release containers.
Images share deps/build tooling; API/web runtime use pruned production deployment artifacts. API contains compiled application, production dependencies and compatible generated Prisma client. Migration target contains Prisma CLI/schema/migrations/client with tooling dependencies. No tests are shipped in API runtime. Next runs next start with complete `.next` output; no standalone strategy is mixed in.

## Development

`compose.yml` + `compose.dev.yml` binds source and overlays named volumes at root/every workspace node_modules, .next, dist and Turbo/store caches. Host dependencies cannot shadow container dependencies. A one-shot initializer frozen-installs and generates/builds Prisma before applications start; drift must fail initialization and block startup. Source edit changes require no DB reset.
Development entrypoint maps to the bind root numeric UID/GID via gosu. It changes ownership only of listed Docker-managed volumes, never the source checkout; no chmod 777. API runs tsc watch/node watch and shared/database tsc watchers; web uses webpack HMR and polling.

## Distribution

`compose.release.yml` is a versioned image template, NOT VERIFIED for end users while application images remain unpublished. Local release is a one-machine workflow, not selected public production hosting.

Release artifact preparation copies the installed frozen graph; package IDs retain each actual dependency resolution and generated Prisma output. It omits optional peer tooling from API, application source/tests, and compiled OpenAPI generator. Migration explicitly includes Prisma CLI. No deploy/install step re-resolves versions during packaging.
