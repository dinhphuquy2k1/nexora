# Task Evidence: NEXORA-002 — Development Compose Cleanup

## 1. Provenance & Baseline

- **Task ID**: `NEXORA-002`
- **Objective**: Simplify Nexora's Docker Compose development configuration (`compose.dev.yml`) without modifying its effective runtime behavior.
- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Source Commit**: `7497382 feat: bootstrap Nexora Foundation v0.1.0`
- **Branch**: `refactor/dev-compose-cleanup`
- **Initial Working-Tree Status**: Clean
- **Reference Repository**: `https://github.com/dinhphuquy2k1/seiza` (commit `909ecc81aac006abe3e35828369679b1e67c62f3`)
  - **Access Status**: **NOT VERIFIED** (Seiza is an external/private repository outside the active workspace directory `D:\work\nexora`; filesystem access restricted by system policy). Implementation and verification proceeded strictly using Nexora's actual codebase.

---

## 2. Baseline Audit

### 2.1 Compose Services Topology

When combining `compose.yml` and `compose.dev.yml`, the development composition contains 6 services:

| Service        | Source File       | Base Build Target | Dev Override Target | Base Entrypoint / Command                             | Dev Override Entrypoint / Command                                                                                 |
| :------------- | :---------------- | :---------------- | :------------------ | :---------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `init`         | `compose.yml`     | `tools`           | _(none)_            | `sh /scripts/init-local.sh`                           | _(unchanged)_                                                                                                     |
| `postgres`     | `compose.yml`     | _(image)_         | _(none)_            | Postgres default entrypoint                           | _(unchanged)_                                                                                                     |
| `migrate`      | `compose.yml`     | `migrate`         | _(none)_            | `sh /scripts/api-entrypoint.sh` / Prisma CLI deploy   | _(unchanged; depends_on augmented with `dependencies`)_                                                           |
| `dependencies` | `compose.dev.yml` | _(n/a)_           | `dev`               | _(n/a)_                                               | `sh /workspace/scripts/dev-entrypoint.sh` / `[dependencies]`                                                      |
| `api`          | both              | `api-runtime`     | `dev`               | `sh /scripts/api-entrypoint.sh` / `node dist/main.js` | `sh /workspace/scripts/dev-entrypoint.sh` / `sh /workspace/scripts/api-entrypoint.sh pnpm exec turbo run dev ...` |
| `web`          | both              | `web-runtime`     | `dev`               | Next.js default / `next start`                        | `sh /workspace/scripts/dev-entrypoint.sh` / `pnpm --filter @nexora/web dev`                                       |

### 2.2 Volume Inventory & Mount Destinations

Named volumes declared in `compose.dev.yml` (13 development volumes):

- `root_deps` -> `/workspace/node_modules`
- `pnpm_store` -> `/pnpm/store`
- `web_cache` -> `/workspace/apps/web/.next`
- `apps_api_deps` -> `/workspace/apps/api/node_modules`
- `apps_web_deps` -> `/workspace/apps/web/node_modules`
- `packages_database_deps` -> `/workspace/packages/database/node_modules`
- `packages_sdk_deps` -> `/workspace/packages/sdk/node_modules`
- `packages_shared_deps` -> `/workspace/packages/shared/node_modules`
- `packages_ui_deps` -> `/workspace/packages/ui/node_modules`
- `api_dist` -> `/workspace/apps/api/dist`
- `database_dist` -> `/workspace/packages/database/dist`
- `shared_dist` -> `/workspace/packages/shared/dist`
- `turbo_cache` -> `/workspace/.turbo`

Base volumes declared in `compose.yml` (3 persistent volumes):

- `credentials` -> `/config` (`init`), `/config:ro` (`postgres`, `migrate`, `api`)
- `postgres` -> `/var/lib/postgresql/data` (`postgres`)
- `uploads` -> `/uploads` (`init`), `/data/uploads` (`api`, `dependencies`)

### 2.3 Service Mount Analysis & Extra Mounts

- `api`: Receives base mounts (`credentials:/config:ro`, `uploads:/data/uploads`) from `compose.yml`, plus the 14 workspace mounts from `compose.dev.yml`.
- `web`: Receives the 14 workspace mounts from `compose.dev.yml` and publishes port `127.0.0.1:3001:3000`.
- `dependencies`: One-shot dev initializer. Receives the 14 workspace mounts PLUS `- uploads:/data/uploads` to adjust directory permissions for the non-root developer user before runtime services start.
- `api` and `web` have **identical** 14 development mount definitions in `compose.dev.yml`.

### 2.4 Health Checks & Dependency Ordering

- `init`: Runs to completion first.
- `postgres`: Depends on `init: service_completed_successfully`. Healthcheck: `pg_isready -U nexora -d nexora` (interval 3s, timeout 3s, retries 30).
- `dependencies`: Depends on `init: service_completed_successfully`. Runs pnpm frozen install and builds workspace dependencies.
- `migrate`: Depends on `postgres: service_healthy` AND `dependencies: service_completed_successfully`.
- `api`: Depends on `migrate: service_completed_successfully` AND `dependencies: service_completed_successfully`. Healthcheck: HTTP probe `/api/health/ready` on `127.0.0.1:4000` (interval 5s, timeout 8s, retries 20).
- `web`: Depends on `api: service_healthy` AND `dependencies: service_completed_successfully`. Healthcheck: HTTP probe `/api/health/ready` on `127.0.0.1:3000` (interval 5s, timeout 8s, retries 20).

### 2.5 Duplication Analysis

In `compose.dev.yml`, the identical 14-volume sequence was declared verbatim 3 times:

1. Lines 11–24 under `dependencies.volumes`
2. Lines 54–67 under `api.volumes`
3. Lines 80–93 under `web.volumes`

Total duplicated lines: 28 lines of verbatim YAML sequence repetition.

---

## 3. Compose Refactoring & YAML Constraints

### 3.1 YAML Limitation: Inability to Append Sequence via Alias

In standard YAML, sequence aliases cannot append elements to an existing list (e.g., `volumes: - *development-volumes - uploads:/data/uploads` creates a nested sequence `[ [...], "..." ]`, which Docker Compose rejects).
Because `dependencies` requires `uploads:/data/uploads` while `api` and `web` do not, `dependencies.volumes` retains an explicit list. This avoids invalid sequence nesting or brittle anchor merging.

### 3.2 Implemented Refactor

A top-level extension field `x-development-volumes` with YAML anchor `&development-volumes` was introduced in `compose.dev.yml`:

```yaml
x-development-volumes: &development-volumes
  - .:/workspace
  - root_deps:/workspace/node_modules
  - pnpm_store:/pnpm/store
  - web_cache:/workspace/apps/web/.next
  - apps_api_deps:/workspace/apps/api/node_modules
  - apps_web_deps:/workspace/apps/web/node_modules
  - packages_database_deps:/workspace/packages/database/node_modules
  - packages_sdk_deps:/workspace/packages/sdk/node_modules
  - packages_shared_deps:/workspace/packages/shared/node_modules
  - packages_ui_deps:/workspace/packages/ui/node_modules
  - api_dist:/workspace/apps/api/dist
  - database_dist:/workspace/packages/database/dist
  - shared_dist:/workspace/packages/shared/dist
  - turbo_cache:/workspace/.turbo
```

`api.volumes` and `web.volumes` were simplified to:

```yaml
    volumes: *development-volumes
```

`dependencies.volumes` retains the full explicit list including `uploads:/data/uploads`.

---

## 4. Compose Equivalence Verification

### 4.1 Normalized Configuration Comparison

- **Command**:
  ```powershell
  docker compose -f compose.yml -f compose.dev.yml config
  ```
- **Baseline Config SHA-256**: `5F7D4B72D91FDAB2AFB8CCD30681E574DC4881583AE37B14A4200601085E6BB8`
- **Refactored Config SHA-256**: `08B5376283D765F69C564CAA63BCBA670F4C8947F4775D778AE5069FA6AFD2DF`

### 4.2 Exact Structural & Functional Equivalence

A direct `Compare-Object` between the normalized baseline and refactored configurations confirmed:

- Zero functional differences.
- All 6 services (`init`, `postgres`, `migrate`, `dependencies`, `api`, `web`), 16 volumes, build targets, commands, entrypoints, healthchecks, network definitions, published ports, and dependencies are **100% line-for-line identical** across all 413 lines of service and volume definitions.
- The only delta in the normalized output is the standard Compose top-level extension field `x-development-volumes` emitted as metadata.

---

## 5. Regression Verification Evidence

All mandatory regression suites were executed against the refactored Compose configuration.

| Check Category                 | Command Executed                                          | Result   | Evidence / Notes                                                                                                                                                                                                                      |
| :----------------------------- | :-------------------------------------------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Compose Base Validation**    | `docker compose config`                                   | **PASS** | Validated base release Compose configuration without errors.                                                                                                                                                                          |
| **Compose Dev Validation**     | `docker compose -f compose.yml -f compose.dev.yml config` | **PASS** | Successfully normalized refactored development Compose with anchors.                                                                                                                                                                  |
| **Compose Release Validation** | `docker compose -f compose.release.yml config`            | **PASS** | Validated versioned distribution Compose template.                                                                                                                                                                                    |
| **Docker Quality Suite**       | `sh scripts/quality-docker.sh`                            | **PASS** | Full quality pipeline completed in container (`format:check`, `lint` with boundaries, `typecheck`, 4 unit tests, `contracts:check`, 6 package builds, and migrated Postgres integration test).                                        |
| **Development Smoke**          | `sh scripts/dev-smoke.sh`                                 | **PASS** | Containerized dev dependencies compilation PASS; TypeScript watch with workspace propagation PASS; Next.js HMR PASS; Outdated lockfile blocker guard PASS; Postgres data preservation PASS.                                           |
| **Runtime Smoke**              | `sh scripts/runtime-smoke.sh`                             | **PASS** | Disposable project `nexora-smoke-*` isolation PASS; Same-origin readiness PASS; Proxy 404 error contract with correlation ID PASS; Header log scrub PASS; Non-root UID PASS; DB outage isolation PASS; Internal ports unexposed PASS. |
| **Data & Backup Smoke**        | `sh scripts/data-smoke.sh`                                | **PASS** | DB catalog + file persistence across down/up PASS; Backup archive creation with checksums PASS; Corruption detection guard PASS; Restore into new project PASS; SHA-256 verification PASS; Overwrite guard PASS.                      |

---

## 6. Infrastructure Isolation Confirmation

- **Compose Project Name**: `nexora` (unchanged).
- **Default Web Host Binding**: `127.0.0.1:3001` (unchanged).
- **Database & User**: `nexora` (unchanged).
- **Image Tags**: `nexora-tools:0.1.0`, `nexora-migrate:0.1.0`, `nexora-api:0.1.0`, `nexora-web:0.1.0`, `nexora-dev:0.1.0` (unchanged).
- **Persistent Volumes**: `nexora_credentials`, `nexora_postgres`, `nexora_uploads` (unchanged).
- **Lyra / Seiza Isolation**: No shared network, port, or persistent resource between projects.

---

## 7. Deferred Architecture Backlog

### B1 — Runtime Packaging

- **Current Area**: `Dockerfile`, `scripts/runtime-artifacts.mjs`.
- **Observations**: Current multi-stage build creates pruned runtime images using `runtime-artifacts.mjs` (api: ~517 MB, web: ~845 MB).
- **Potential Evaluation**: Next.js standalone mode; `pnpm deploy` with workspace injection; separate application Dockerfiles.
- **Risks**: pnpm 10 workspace injection changes; Next.js standalone rewrite serialization with `API_INTERNAL_URL`; Prisma Client regeneration requirements.
- **Trigger**: Revisit when dependency changes break artifact packaging or build times become a measurable bottleneck.

### B2 — Backend Development Runner

- **Current Area**: `apps/api/package.json`, `apps/api/tsconfig.json`.
- **Observations**: Currently uses `tsc --watch` alongside `node --watch dist/main.js`.
- **Potential Evaluation**: tsx-based runner (as referenced in Seiza).
- **Risks**: Loss of `emitDecoratorMetadata` / legacy decorator support required by NestJS dependency injection, Swagger OpenAPI metadata, and DTO validation.
- **Trigger**: Revisit if developer restart latency or file watching reliability becomes a blocker, accompanied by explicit DI and OpenAPI parity test suites.

### B3 — CI Optimization

- **Current Area**: `.github/workflows/foundation.yml`.
- **Observations**: Single sequential job runs quality, down, runtime smoke, data smoke, and dev smoke (~45m timeout).
- **Potential Evaluation**: Split fast quality checks from expensive Docker smoke suites; cache multi-stage Docker build layers to eliminate duplicate image compilation.
- **Trigger**: Revisit when CI execution times or retry costs justify workflow restructuring.

### B4 — Documentation Governance

- **Current Area**: `docs/`.
- **Observations**: Documentation relies on manual cross-referencing and adherence to `docs/ai/rules.md`.
- **Potential Evaluation**: Lightweight documentation link and path verification script.
- **Trigger**: Revisit when repository documentation size expands across multiple domain tasks.

### B5 — Release Compose

- **Current Area**: `compose.release.yml`.
- **Observations**: Duplicates service definitions from `compose.yml` with ghcr.io registry image tags.
- **Potential Evaluation**: Use Compose profile or tag overrides to reduce duplication between local release and publication templates.
- **Trigger**: Revisit when actual image publication pipelines or public release distribution are scheduled.

---

## 8. Summary of Files Changed

1. `compose.dev.yml`: Refactored repeated volume declarations using `x-development-volumes: &development-volumes` anchor; retained explicit sequence on `dependencies`.
2. `docs/tasks/NEXORA-001-foundation.md`: Applied standard Prettier markdown table formatting to resolve format check failure.
3. `docs/tasks/NEXORA-002-foundation-improvements.md`: Created task evidence ledger and verification audit.
