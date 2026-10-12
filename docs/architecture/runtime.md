# Runtime

## Local release (default)

Compose `init` generates and retains a random local DB password, repairs only dedicated credential/upload volume permissions; PostgreSQL 17.11 has no published ports. One-shot `migrate` runs after DB healthy; compiled non-root API starts after migrate success and owns uploads as UID 1000. Non-root web waits for API healthy and publishes host port `127.0.0.1:3001:3000` (configurable via `WEB_PORT`). Next.js rewrites `/api/*` internally to `http://api:4000` on the Docker bridge network; neither PostgreSQL nor API publishes host ports.
Named volumes: postgres, uploads and credentials survive down/restart. No auth/encryption key is generated without a consumer. Init is idempotent and does not rotate existing DB credentials. Host source is not mounted into release containers.

### Docker architecture layout

Nexora uses an application-oriented Dockerfile architecture inspired by Seiza:

- `docker/Dockerfile.tools`: Owns foundational tooling (`tools` -> `nexora-tools:0.1.0`), the dependency cache context (`dependency-cache`), the single authoritative dependency foundation (`deps` -> `nexora-builder:0.1.0`), and the workspace development image (`dev` -> `nexora-dev:0.1.0`).
- `apps/api/Dockerfile`: Owns API compilation, runtime artifact assembly, NestJS non-root production runtime (`nexora-api:0.1.0`), Prisma client generation, and the dedicated Prisma migration runner (`nexora-migrate:0.1.0`).
- `apps/web/Dockerfile`: Owns Web compilation, Next.js runtime artifact assembly, and non-root production runtime (`nexora-web:0.1.0`), requiring explicit build-time `API_INTERNAL_URL` build argument and container runtime environment.

### Shared builder dependency strategy

To prevent duplicated dependency installations across multiple Dockerfiles, application builds consume the shared dependency foundation using BuildKit named contexts in `compose.yml`:

```yaml
services:
  builder:
    build:
      context: .
      dockerfile: docker/Dockerfile.tools
      target: deps
    image: nexora-builder:0.1.0
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: api-runtime
      additional_contexts:
        base: service:builder
        tools: service:init
```

Consuming application Dockerfiles begin with `FROM base AS build`, inheriting the exact frozen workspace installation without re-resolving or re-installing dependencies. Freshness is guaranteed by BuildKit graph linkage; any change in the dependency foundation automatically rebuilds dependent application images.

### Tooling and development image ownership

- **Tooling (`nexora-tools:0.1.0`)**: Owned by `docker/Dockerfile.tools` (`tools` stage). It provides Node 24, pnpm, openssl, ca-certificates, and gosu for the `init` service and direct host consumers (`scripts/backup.sh`, `scripts/restore.sh`, `scripts/data-smoke.sh`).
- **Development (`nexora-dev:0.1.0`)**: Owned solely by `docker/Dockerfile.tools` (`dev` stage). In `compose.dev.yml`, the `dependencies` service builds this image, and `api`/`web` reset build definitions (`build: !reset null`) to run against the shared development tag, ensuring a single unified development dependency graph.

### Workspace manifest ownership

Manifest `COPY` declarations are centralized exclusively in `docker/Dockerfile.tools` (`deps` stage). Application Dockerfiles do not duplicate package declarations. To prevent manifest drift when adding new workspace packages, `scripts/boundaries.mjs` includes an automated check (`checkDockerManifestDeclarations`) validating that every package in `apps/` and `packages/` is declared in `docker/Dockerfile.tools`.

### BuildKit features, secrets, and caches

- **BuildKit requirement**: Requires Docker Compose v2.22.0+ / Docker 24+ with BuildKit enabled for `additional_contexts: { base: "service:builder" }` (see [ADR-004](../decisions/per-app-docker-architecture.md)).
- **Build CA secret**: All network-capable RUN instructions support an optional `--mount=type=secret,id=build_ca` secret. When present, `NODE_EXTRA_CA_CERTS=/run/secrets/build_ca` is exported without persisting the certificate or disabling TLS checks.
- **Dependency cache**: `docker/Dockerfile.tools` defines `FROM scratch AS dependency-cache` and binds `/dependency-cache` during `pnpm install`, allowing external pre-population via `pnpm-cache.tar`.

### Runtime artifact equivalence

Runtime artifacts continue to be packaged by `scripts/runtime-artifacts.mjs`. Compared against the baseline monolithic build:

- Tools (`/scripts`), Migrate (`/app`), and API (`/app`) runtime filesystem manifests are preserve the existing packaging layout; the API additionally includes its compiled provisioning CLI.
- Web (`/app`) contains identical runtime dependencies and files, with differences strictly confined to non-deterministic Next.js build IDs (`.next/BUILD_ID`) and compiler output chunk hashes.

## Development

`compose.yml` + `compose.dev.yml` binds source and overlays named volumes at root/every workspace node_modules, .next, dist and Turbo/store caches. Host dependencies cannot shadow container dependencies. A one-shot initializer frozen-installs and generates/builds Prisma before applications start; drift must fail initialization and block startup. Source edit changes require no DB reset.
Development entrypoint maps to the bind root numeric UID/GID via gosu. It changes ownership only of listed Docker-managed volumes, never the source checkout; no chmod 777. API runs tsc watch/node watch and shared/database tsc watchers; web uses webpack HMR and polling.

## Distribution

`compose.release.yml` is a versioned image template, NOT VERIFIED for end users while application images remain unpublished. Local release is a one-machine workflow, not selected public production hosting.

Release artifact preparation copies the installed frozen graph; package IDs retain each actual dependency resolution and generated Prisma output. It omits optional peer tooling from API, application source/tests, and compiled OpenAPI generator. Migration explicitly includes Prisma CLI. No deploy/install step re-resolves versions during packaging.

## Local account provisioning runtime

API compilation owns `/app/dist/cli/user-create.js` and its infrastructure provisioner; the existing `dist` artifact packaging includes both without repository-level scripts or a new service. Execute through `/scripts/api-entrypoint.sh` to read the existing credential volume and inject DATABASE_URL, as the image's non-root user. Source inspection establishes expected packaging, while executed fresh-install and pseudo-TTY smoke provide runtime evidence; see NEXORA-009 for the current verification state. No API/database host ports or production bootstrap endpoint are added. API receives WEB_PORT/ALLOWED_ORIGINS solely for the exact browser Origin policy documented in [Configuration](../operations/configuration.md).

## Restore maintenance boundary

Restore starts only new-project PostgreSQL. The existing one-shot migration service runs after dump restoration; target sessions are invalidated before API/Web startup. A one-shot non-root API command checks original-file/catalog integrity without listening on HTTP. Failures leave a partial isolated target and report failure, without launching it or altering source resources. Operator procedure is owned by [Backup and restore](../operations/backup-restore.md).
