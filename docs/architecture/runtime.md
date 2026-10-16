# Runtime

## Local release (default)

Compose `init` generates and retains separate random admin and runtime DB passwords, repairs only dedicated credential/upload volume permissions; PostgreSQL 17.11 has no published ports. One-shot `migrate` runs after DB healthy; trusted one-shot `db-runtime` provisions restricted `nexora_app` after migrate success; compiled non-root API starts after provisioning success and owns uploads as UID 1000. Non-root web waits for API healthy and publishes host port `127.0.0.1:3001:3000` (configurable via `WEB_PORT`). Next.js rewrites `/api/*` internally to `http://api:4000` on the Docker bridge network; neither PostgreSQL nor API publishes host ports.
Named volumes: postgres, uploads, credentials and runtime_credentials survive down/restart. No auth/encryption key is generated without a consumer. Init is idempotent and does not rotate existing DB credentials. Host source is not mounted into release containers.

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

- **Tooling (`nexora-tools:0.1.0`)**: Owned by `docker/Dockerfile.tools` (`tools` stage). It provides Node 24, pnpm, openssl, ca-certificates, and gosu for the `init` service and direct host consumers (`scripts/data-smoke.sh`).
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

API compilation owns `/app/dist/cli/user-create.js` and its infrastructure provisioner; the existing `dist` artifact packaging includes both without repository-level scripts or a new service. Execute through `/scripts/api-entrypoint.sh` to read only runtime_credentials:/runtime-config/postgres_app_password and inject the nexora_app DATABASE_URL, as the image's non-root user. Source inspection establishes expected packaging, while executed fresh-install and pseudo-TTY smoke provide runtime evidence; see NEXORA-009 for the current verification state. No API/database host ports or production bootstrap endpoint are added. API receives WEB_PORT/ALLOWED_ORIGINS solely for the exact browser Origin policy documented in [Configuration](../operations/configuration.md).

## Public HTTPS Profile & MFA Release Gate (PR 7 Target)

Under [ADR-007](../decisions/multi-carrier-architecture.md), public deployment requires strict runtime release gates:

1. **Mandatory PR 6 Dependency**: The public profile runtime requires ADMIN TOTP MFA. At startup under the public profile, the API container performs an assertion check and **refuses to start** if MFA enforcement is disabled.
2. **Cookie Security**: In public deployment, cookies enforce `Secure: true`. `nexora_session` uses `SameSite: Lax`, while pending MFA challenge tokens (`nexora_mfa_token`) enforce `SameSite: Strict`.
3. **NTP Host Clock Synchronization**: Containerized TOTP calculation relies on the host clock. Deployment runbooks mandate host NTP synchronization (`chrony` or `systemd-timesyncd`), verified before enabling public ingress.
4. **Origin & Host Enforcement**: Ingress proxies must forward exact Host and Origin headers validated against server-side configuration; `X-Forwarded-*` headers are accepted only from explicit, trusted proxy subnets.

## Local identity boundary (Logical PR 2)

Both roles use Nexora password sessions, independent of external carrier availability. ADMIN onboarding/status mutations require trusted Origin and a database-backed ACTIVE ADMIN session. Setup uses a client-only fragment secret; Web serves `/setup` with no-store/no-referrer and proxies only the setup JSON body. Carrier persistence is implemented in PR3; connect/reconnect, MFA persistence and public HTTPS remain deferred; no new runtime service is introduced.

## Carrier key runtime — Logical PR 3

Compose forwards CARRIER_KEYRING_JSON and CARRIER_ACTIVE_KEY_VERSION only into API server environment; neither is passed to Web, SDK, build arguments or migration services. Operators supply keys securely; init does not generate or rotate Carrier keys. API startup and all local identity/metadata functionality remain available without valid Carrier keys. EnvironmentKeyring snapshots configuration; restart the API to activate a new version. No new service, volume, worker or network integration is introduced. See [configuration](../operations/configuration.md) for custody and safe staged rotation.

## PR4 backend lifecycle runtime

Apply forward migration20261016000000_carrier_lifecycle before starting API; there are eight migrations. No worker, cron, Redis or new service is added. Connect/reconnect use loopback mocks in automated tests; external Uniship remains hard-closed even with UNISHIP_LIVE_AUTHORIZED=true until official authorization evidence is verified. Nexora login/session checks never call the provider or require Carrier crypto keys. Missing/wrong keys fail the Carrier operation safely and do not downgrade it to manual reauthentication.

Internal withToken performs lazy recovery only when a real Carrier operation needs a token: known expiry/missing token or one typed provider rejection. It commits durable password-decrypt audit, decrypts inside authorized infrastructure, logs in and verifies, then atomically persists encrypted password/token under ACTIVE-user epoch/version checks. No public lazy-recovery endpoint or refresh API exists. Singleflight and local budgets are per API instance; DB uniqueness/row locking and version fences provide shared persistence protection, without a distributed recovery-lock framework. No token/password persists in global maps.

## PostgreSQL authority separation — NEXORA-019

Admin role nexora retains existing database/object ownership and credentials:/config/postgres_password; PostgreSQL and migrate mount that volume read-only. API has only runtime_credentials:/runtime-config read-only, containing postgres_app_password, and cannot read or mount the admin volume. Web has neither secret. Only trusted init (write) and one-shot db-runtime (read-only, root to handle development UID mapping) receive both. API never falls back to admin or an inherited URL. Development init stats a read-only checkout to assign runtime-file ownership; it does not chown source. Release API remains UID1000.

Startup is init → healthy PostgreSQL → genuine Prisma migrate deploy → transactional role provisioning → API → Web. Both fresh and retained-volume upgrades follow this order. New secrets use CSPRNG 32-byte hex, mode0600; existing files are never rotated, and empty/corrupt files fail closed. db-runtime repeats grants/password from the same retained runtime file without changing data. Profile test's quality service is a separate trusted fixture runner, reading admin credentials before dropping to the mapped checkout user; production API never receives its authority. See Database for exact grants and Setup for upgrade/recovery.
