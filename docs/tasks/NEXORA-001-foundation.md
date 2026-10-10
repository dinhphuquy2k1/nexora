# Task Evidence: NEXORA-001 — Bootstrap Nexora Foundation from Lyra

## 1. Provenance & Baseline
- **Task ID**: `NEXORA-001`
- **Release Version**: `v0.1.0`
- **Primary Source Repository**: `https://github.com/dinhphuquy2k1/lyza`
- **Pinned Source Commit**: `77a5d45f713e05001e45f09ce3687c4a3869698b` (Verified & clean exported)
- **Secondary Reference Repository**: `https://github.com/dinhphuquy2k1/seiza`
- **Secondary Reference Commit**: `909ecc81aac006abe3e35828369679b1e67c62f3` (Inspected; technology baseline held to Lyra without downgrading)
- **Target Working Directory**: `D:\work\nexora` (Isolated checkout, independent Git identity)
- **Isolation Principle**: Git history of Lyra was excluded; Nexora maintains its own repository identity.

---

## 2. Inventory of Changes

### 2.1 Retained Components (Technical Foundation)
- **Monorepo & Tooling**: pnpm v10.34.6 workspace, Turborepo 2.11.7, TypeScript 5.9 strict mode, Prettier 3.6.2, ESLint 9.39.
- **Backend**: NestJS 11.1 Modular Monolith (`apps/api`), structured JSON logger with request correlation IDs, central HTTP exception filter, configuration schema validation.
- **Frontend**: Next.js 16.3.8 (`apps/web`), App Router, React 19, Vanilla CSS design system, server-rendered and static routing.
- **Database & ORM**: PostgreSQL 17.11-bookworm, Prisma 7.10, single initial migration for `stored_files` catalog.
- **Storage Foundation**: Generic local file-storage adapter (`LocalStorage`), SHA-256 integrity digest computation, opaque UUID file IDs, database metadata catalog (`stored_files`).
- **OpenAPI & SDK**: NestJS-driven Swagger contract generation, deterministic committed SDK generator (`packages/sdk`).
- **Architecture Enforcement**: `scripts/boundaries.mjs` verifying strict workspace isolation, layer boundaries, and database isolation.
- **Docker Runtime**: Multi-stage `Dockerfile`, production (`compose.yml`), dev (`compose.dev.yml`), and release template (`compose.release.yml`).
- **Operations & Safety Scripts**: `scripts/init-local.sh`, `scripts/api-entrypoint.sh`, `scripts/dev-entrypoint.sh`, `scripts/backup.sh`, `scripts/restore.sh`, `scripts/runtime-smoke.sh`, `scripts/data-smoke.sh`, `scripts/dev-smoke.sh`.

### 2.2 Removed Components (Reconciliation Business Logic)
- **Packages**: `packages/reconciliation` completely removed.
- **Dependencies**: Unused `decimal.js` removed from root and API dependencies.
- **Documentation**: `docs/domains/reconciliation.md`, `docs/domains/annotations.md`, `docs/domains/decisions.md` deleted.
- **Historical Evidence**: Historical Lyra task evidence (`docs/tasks/foundation.md`) removed to prevent conflating verification.
- **Rules & Scripts**: Boundary rules and package references referring to `@lyra/reconciliation` removed.

### 2.3 Renamed Identifiers
- **Workspace Packages**:
  - `@lyra/api` → `@nexora/api`
  - `@lyra/web` → `@nexora/web`
  - `@lyra/database` → `@nexora/database`
  - `@lyra/sdk` → `@nexora/sdk`
  - `@lyra/shared` → `@nexora/shared`
  - `@lyra/ui` → `@nexora/ui`
- **Infrastructure Identifiers**:
  - Compose project name: `lyra` → `nexora`
  - Docker images: `lyra-tools` → `nexora-tools:0.1.0`, `lyra-migrate` → `nexora-migrate:0.1.0`, `lyra-api` → `nexora-api:0.1.0`, `lyra-web` → `nexora-web:0.1.0`, `lyra-dev` → `nexora-dev:0.1.0`
  - PostgreSQL Database: `lyra` → `nexora`
  - PostgreSQL User: `lyra` → `nexora`
  - Named Volumes: `lyra_postgres` → `nexora_postgres`, `lyra_credentials` → `nexora_credentials`, `lyra_uploads` → `nexora_uploads`
  - Web Host Port: `127.0.0.1:3000` → `127.0.0.1:3001` (configurable via `WEB_PORT`)
  - Storage Probe File: `lyra-ready` → `nexora-ready`
  - UI Branding: "Lyra · Đối soát cước" → "Nexora · Quản lý vận đơn"
  - SDK Client Export: `createLyraClient` → `createNexoraClient`

---

## 3. Verification & Test Evidence

### 3.1 Host & Quality Checks
| Check Category | Command Executed | Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Dependency Install** | `pnpm install --frozen-lockfile` | **PASS** | Dependencies resolved cleanly across all 6 workspace packages. |
| **Code Formatting** | `pnpm format:check` | **PASS** | 0 formatting violations found. |
| **Linting & Boundaries** | `pnpm lint` | **PASS** | ESLint passed; `scripts/boundaries.mjs` reported `Workspace boundaries PASS`. |
| **Boundary Violation Tests** | `node scripts/boundaries.mjs --test-negatives` | **PASS** | Verified detection of app-to-app imports, web-to-database imports, presentation-to-database imports, and SDK-to-app imports. |
| **Type Checking** | `pnpm typecheck` | **PASS** | Turbo ran 10/10 tasks successfully across all packages and apps. |
| **Unit Tests** | `pnpm test` | **PASS** | `apps/api/test/unit.test.cjs`: 4/4 tests passed (storage roundtrip, catalog failure rollback, readiness fail-closed, config fail-fast). |
| **OpenAPI Contract Drift** | `pnpm contracts:check` | **PASS** | Regenerated OpenAPI spec and TypeScript SDK matched committed artifacts (`Contracts reproducible PASS`). |
| **Application Build** | `pnpm build` | **PASS** | Turbo ran 6 builds successfully (`@nexora/database`, `@nexora/shared`, `@nexora/ui`, `@nexora/sdk`, `@nexora/api`, `@nexora/web`). |
| **Full Quality Suite** | `pnpm quality` | **PASS** | Entire verification pipeline completed with exit code 0. |

### 3.2 Docker Image Build
| Target Image | Build Command | Result | Image Digest / ID |
| :--- | :--- | :--- | :--- |
| `nexora-tools:0.1.0` | `docker compose build` | **PASS** | `dd7831988137` (394 MB) |
| `nexora-migrate:0.1.0` | `docker compose build` | **PASS** | `38d5e33b2b6b` (852 MB) |
| `nexora-api:0.1.0` | `docker compose build` | **PASS** | `8824ba488f58` (517 MB) |
| `nexora-web:0.1.0` | `docker compose build` | **PASS** | `075ce9aff24f` (845 MB) |
| `nexora-dev:0.1.0` | `docker compose -f compose.yml -f compose.dev.yml build` | **PASS** | `07beb9767903` (1.59 GB) |

### 3.3 Container Runtime & Persistence Smokes
| Smoke Test Suite | Command Executed | Result | Key Assertions Verified |
| :--- | :--- | :--- | :--- |
| **Runtime Smoke** | `sh scripts/runtime-smoke.sh` | **PASS** | - Disposable project `nexora-smoke-*` isolation<br>- Same-origin readiness PASS (`/api/health/ready` 200 OK)<br>- Proxy error contract PASS (`/api/missing` 404 NOT_FOUND with correlation ID)<br>- Sensitive authorization header scrubbed from logs<br>- Non-root user execution (`api` and `web` UID !== 0)<br>- DB outage separation PASS (`/live` 200 while `/ready` 503)<br>- Internal ports 4000 and 5432 unexposed to host |
| **Data & Backup Smoke** | `sh scripts/data-smoke.sh` | **PASS** | - Local file storage and `stored_files` catalog persistence across down/up<br>- Full archive backup creation with manifest checksums<br>- Backup checksum corruption detection guard PASS<br>- Restore into new isolated project `nexora-data-smoke-*-restored` PASS<br>- Catalog and blob SHA-256 integrity verification on restored data PASS<br>- Overwrite protection guard PASS |
| **Dev Environment Smoke** | `sh scripts/dev-smoke.sh` | **PASS** | - Containerized dev dependencies compilation PASS<br>- TypeScript watch polling with workspace propagation PASS<br>- Next.js development HMR verification PASS<br>- Outdated lockfile startup blocker guard PASS<br>- Postgres data preservation across dev container restart PASS |

---

## 4. Mandatory Infrastructure Isolation & Coexistence Verification (Section 6.6)

Both Lyra and Nexora were verified running concurrently on the host machine with full isolation.

### 4.1 Concurrent Execution Status
- **Lyra Project**: Started from clean pinned commit `77a5d45` (`C:\Users\wayyk\.gemini\antigravity-ide\brain\1562b612-0a1d-4600-8a2d-c050c09bd32d\scratch\lyra_source`) using `docker compose up -d`.
- **Nexora Project**: Started from workspace (`D:\work\nexora`) using `docker compose up -d`.
- **Docker PS Snapshot**:
  ```text
  CONTAINER ID   IMAGE                     STATUS                    PORTS                      NAMES
  6c8590e6c181   nexora-web:0.1.0          Up 9 seconds (healthy)    127.0.0.1:3001->3000/tcp   nexora-web-1
  d08fbc50d7c1   nexora-api:0.1.0          Up 15 seconds (healthy)                              nexora-api-1
  682172bb1189   postgres:17.11-bookworm   Up 30 seconds (healthy)   5432/tcp                   nexora-postgres-1
  2abb8dfb0275   lyra-web:0.1.0            Up 49 seconds (healthy)   127.0.0.1:3000->3000/tcp   lyra-web-1
  2afb8b162802   lyra-api:0.1.0            Up 54 seconds (healthy)                              lyra-api-1
  8de5f749a388   postgres:17.11-bookworm   Up 1 minute (healthy)     5432/tcp                   lyra-postgres-1
  ```

### 4.2 Simultaneous Health Endpoints
Both applications responded simultaneously to HTTP probes:
```bash
# Lyra (Port 3000)
curl http://127.0.0.1:3000/api/health/live  => {"status":"ok"}
curl http://127.0.0.1:3000/api/health/ready => {"status":"ok","checks":{"database":true,"storage":true}}

# Nexora (Port 3001)
curl http://127.0.0.1:3001/api/health/live  => {"status":"ok"}
curl http://127.0.0.1:3001/api/health/ready => {"status":"ok","checks":{"database":true,"storage":true}}
```

### 4.3 Isolation Criteria Verification
1. **Host Ports**: Lyra binds `127.0.0.1:3000`; Nexora binds `127.0.0.1:3001`. Zero collision.
2. **Compose Projects**: `lyra` vs `nexora`.
3. **Named Volumes**:
   - Lyra: `lyra_credentials`, `lyra_postgres`, `lyra_uploads`
   - Nexora: `nexora_credentials`, `nexora_postgres`, `nexora_uploads`
   - Zero shared volumes.
4. **Docker Images**: `lyra-*` vs `nexora-*`. Zero shared application tags.
5. **Database & Credentials**:
   - Lyra container: User `lyra`, Database `lyra`.
   - Nexora container: User `nexora`, Database `nexora`.
   - Verified via `SELECT current_user, current_database();` inside respective containers.
6. **Independence on Termination**: Nexora was shut down using `docker compose down`; Lyra remained fully healthy and its health endpoints continued returning 200 OK without degradation.
7. **Safe Teardown**: Lyra was safely brought down with `docker compose down` preserving user volumes; neither project's persistent volumes were mutated or deleted.

---

## 5. Mandatory Cleanup Audit Summary
Ripgrep search excluding build directories (`node_modules`, `.git`, `.next`, `dist`, `.turbo`, `.contracts`) for pattern `lyra`:
- Remaining matches: **4 lines**, strictly located in `docs/ai/README.md`, `docs/decisions/product-scope.md`, and `docs/decisions/technology-baseline.md`.
- Purpose of remaining matches: Explicit provenance attribution and architectural separation documentation.
- Package manifests, source code, configs, Docker tags, Compose definitions, UI labels, scripts, and SDK artifacts are **100% clean of Lyra references**.

---

## 6. Known Limitations & Deferred Decisions
1. **Shipment Business Domain**: No business tables, controllers, or customer models are created in NEXORA-001. All shipments logic is deferred to subsequent domain tasks.
2. **Logistics Provider Integration**: Out of scope. Requires official API authorization and technical review before any network communication or credential ingestion is implemented.
3. **Authentication & Identity**: Out of scope. Local session management and RBAC are deferred.
4. **Internet & Production Hosting**: Foundation is strictly configured for local single-machine execution (`127.0.0.1`). Production multi-tenant deployment remains out of scope.

---

## 7. Recommended Next Task
- **`NEXORA-002: Shipment Domain Core Models & Ingestion Contracts`**: Define the internal Prisma schema for Customers, Shipments, and Tracking Events, and establish the normalized data transfer interfaces.
