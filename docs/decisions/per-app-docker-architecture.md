# ADR-004 · Per-application Docker architecture & shared BuildKit dependency foundation

Accepted 2026-10-10. Supersedes ADR-003 Section 2.3 item 1 (_Shared multi-stage Dockerfile_).

## 1. Context & problem statement

In Nexora's initial foundation (NEXORA-001) and engineering governance alignment (ADR-003), Nexora used a single monolithic root `Dockerfile` with multiple stages (`tools`, `deps`, `dev`, `build`, `api-runtime`, `web-runtime`, `migrate`). While functional, consolidating all application build definitions into a single root file had operational drawbacks:

1. **Coupled application build logic**: Changes to `web` or `api` build rules required modifying the root Dockerfile, obscuring service-level build boundaries.
2. **Divergence from Seiza layout**: Seiza uses per-application Dockerfiles (`apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker/Dockerfile.tools`). Adopting this layout was approved under NEXORA-004 to create an application-oriented structure.
3. **Risk of duplicated dependency resolution**: A naive per-app layout would run `pnpm install` separately inside each application Dockerfile, causing redundant network traffic, layer duplication, and risk of workspace dependency drift.

## 2. Decision: Per-application Dockerfiles with BuildKit named-context linkage

Nexora adopts an application-oriented Docker layout inspired by Seiza while engineering a deterministic, single-dependency foundation using BuildKit named contexts (`additional_contexts: { base: "service:builder" }`).

```text
nexora/
├── apps/
│   ├── api/
│   │   └── Dockerfile          # Owns API build, runtime packaging, migrate runner
│   └── web/
│       └── Dockerfile          # Owns Web build, runtime packaging
├── docker/
│   └── Dockerfile.tools        # Owns tools, dependency-cache, shared builder, dev image
├── compose.yml                 # Canonical production local Compose topology
├── compose.dev.yml             # Development mounts and watcher overrides
├── compose.release.yml         # Distribution template for prebuilt published images
└── .dockerignore               # Single authoritative ignore policy at repo root
```

### 2.1 Component & stage ownership

1. **`docker/Dockerfile.tools`**:
   - `tools`: Foundation tools image (`nexora-tools:0.1.0`) with Node 24, pnpm, OpenSSL, CA certificates, and gosu for `init` and host scripts.
   - `dependency-cache`: External named context (`scratch`) binding `/dependency-cache` to unpack `pnpm-cache.tar` when provided.
   - `deps`: Single authoritative workspace frozen dependency installation (`nexora-builder:0.1.0`), mounting optional `build_ca` secret.
   - `dev`: Workspace development image (`nexora-dev:0.1.0`), owned exclusively by `dependencies` service in `compose.dev.yml`.
2. **`apps/api/Dockerfile`**:
   - `build`: Consumes `FROM base AS build` (resolved via `base: service:builder`), builds packages and `apps/api`.
   - `api-artifacts`: Packages frozen runtime dependencies using `scripts/runtime-artifacts.mjs`.
   - `migrate-artifacts`: Packages database migration tooling and Prisma engine.
   - `migrate`: One-shot migration runner (`nexora-migrate:0.1.0`).
   - `api-runtime`: Non-root NestJS production runtime (`nexora-api:0.1.0`).
3. **`apps/web/Dockerfile`**:
   - `build`: Consumes `FROM base AS build`, builds `apps/web` with build-time `API_INTERNAL_URL` rewrite support.
   - `web-artifacts`: Packages frozen Next.js runtime dependencies using `scripts/runtime-artifacts.mjs`.
   - `web-runtime`: Non-root Next.js production runtime (`nexora-web:0.1.0`).

### 2.2 Shared builder linkage

In `compose.yml`, consuming services link the shared dependency foundation using:

```yaml
services:
  builder:
    build:
      context: .
      dockerfile: docker/Dockerfile.tools
      target: deps
    image: nexora-builder:0.1.0
    restart: "no"
    entrypoint: ["true"]
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: api-runtime
      additional_contexts:
        base: service:builder
        tools: service:init
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: web-runtime
      additional_contexts:
        base: service:builder
```

Any modification to root manifests, lockfiles, or workspace configs triggers rebuild of `builder`, which automatically invalidates downstream application builds via BuildKit's dependency graph.

### 2.3 Compose and Docker compatibility

- **Minimum requirements**: Requires Docker Engine 24+ and Docker Compose v2.22.0+ with BuildKit enabled (which introduced support for resolving service builds as named contexts via `service:<name>`).
- **One-shot builder lifecycle**: `init: depends_on: builder: condition: service_completed_successfully` guarantees that `builder` (one-shot exit 0) completes before service initialization, preventing premature termination errors during `docker compose up --wait`.

### 2.4 Monolithic root Dockerfile removal

The historical root `Dockerfile` is permanently removed; all build consumers (CI, smoke tests, quality scripts, and local Compose) target the per-app Dockerfiles via Compose.

## 3. Consequences

### Positive

- Application Dockerfiles are modular, decoupled, and cleanly scoped to their respective services.
- Zero duplicate dependency resolution; single authoritative lockfile enforcement in `docker/Dockerfile.tools`.
- Fully preserves BuildKit secrets (`--secret id=build_ca`), offline dependency cache injection, and non-root runtime security.
- Reusable `tools` and `dev` stages are isolated from application runtime layers.

### Negative / Trade-offs

- Requires Docker Compose v2.22.0+ (standalone `docker build -f apps/api/Dockerfile .` without named contexts is not supported; Compose is the canonical build interface).
- Workspace package manifest additions must be mirrored in `docker/Dockerfile.tools` (enforced via `scripts/boundaries.mjs`).
