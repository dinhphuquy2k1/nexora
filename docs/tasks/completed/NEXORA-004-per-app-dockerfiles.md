# Task: NEXORA-004 — Per-App Docker Architecture Refactor

- **Task ID**: `NEXORA-004`
- **Status**: `COMPLETED`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`

---

## 1. Provenance & Starting Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `837248e58284523bfe4c42ea1d3319087c5c00e5`
- **PR #2 (NEXORA-003)**: Merged into `main` (`837248e`) prior to task execution.
- **Reference Repository**: `https://github.com/dinhphuquy2k1/seiza`
- **Pinned Reference SHA**: `0e15dd106d4fcebc4a146f28f1680ba0ea7d43a4`
- **Working Branch**: `refactor/per-app-dockerfiles`

---

## 2. Objective & Scope

Restructure Nexora's Docker architecture into an application-oriented layout inspired by Seiza while preserving dependency graph safety, frozen lockfile guarantees, BuildKit secrets/caches, non-root runtimes, and persistent volumes.

### Target Architecture

```
nexora/
├── apps/
│   ├── api/
│   │   ├── Dockerfile
│   │   └── ...
│   └── web/
│       ├── Dockerfile
│       └── ...
├── docker/
│   └── Dockerfile.tools
├── packages/
├── scripts/
├── compose.yml
├── compose.dev.yml
├── compose.release.yml
├── .dockerignore
└── ...
```

- `docker/Dockerfile.tools`: Foundational tools (`tools`, `nexora-tools:0.1.0`), dependency cache context (`dependency-cache`), single authoritative dependency foundation (`deps`, `nexora-builder:0.1.0`), and workspace development image (`dev`, `nexora-dev:0.1.0`).
- `apps/api/Dockerfile`: API build, runtime artifact packaging, NestJS runtime image (`nexora-api:0.1.0`), Prisma runtime compatibility, and Prisma migration image (`nexora-migrate:0.1.0`).
- `apps/web/Dockerfile`: Web build, Next.js runtime artifact packaging, production Web runtime image (`nexora-web:0.1.0`), preserving `API_INTERNAL_URL` build-time rewrite configuration.
- Single authoritative `.dockerignore` at repository root.
- Deterministic BuildKit dependency linkage via `additional_contexts: { base: "service:builder" }`.
- Removal of original root `Dockerfile` once all consumers are migrated.

---

## 3. Stage Inventory & Ownership Mapping

| Baseline Stage      | Source Dockerfile | Destination                                  | Destination Stage   | Consuming Services / Scripts                                       |
| :------------------ | :---------------- | :------------------------------------------- | :------------------ | :----------------------------------------------------------------- |
| `tools`             | Root `Dockerfile` | `docker/Dockerfile.tools`                    | `tools`             | `init` (`compose.yml`), `backup.sh`, `restore.sh`, `data-smoke.sh` |
| `dependency-cache`  | Root `Dockerfile` | `docker/Dockerfile.tools`                    | `dependency-cache`  | External cache injection (`pnpm-cache.tar`)                        |
| `deps`              | Root `Dockerfile` | `docker/Dockerfile.tools`                    | `deps`              | Shared builder (`service:builder`), dev foundation                 |
| `dev`               | Root `Dockerfile` | `docker/Dockerfile.tools`                    | `dev`               | `dependencies`, `api`, `web` (`compose.dev.yml`)                   |
| `build`             | Root `Dockerfile` | `apps/api/Dockerfile`, `apps/web/Dockerfile` | `build`             | App-specific artifact extraction                                   |
| `api-artifacts`     | Root `Dockerfile` | `apps/api/Dockerfile`                        | `api-artifacts`     | `api-runtime`                                                      |
| `migrate-artifacts` | Root `Dockerfile` | `apps/api/Dockerfile`                        | `migrate-artifacts` | `migrate`                                                          |
| `web-artifacts`     | Root `Dockerfile` | `apps/web/Dockerfile`                        | `web-artifacts`     | `web-runtime`                                                      |
| `migrate`           | Root `Dockerfile` | `apps/api/Dockerfile`                        | `migrate`           | `migrate` (`compose.yml`), `runtime-smoke.sh`                      |
| `api-runtime`       | Root `Dockerfile` | `apps/api/Dockerfile`                        | `api-runtime`       | `api` (`compose.yml`, `nexora-api:0.1.0`)                          |
| `web-runtime`       | Root `Dockerfile` | `apps/web/Dockerfile`                        | `web-runtime`       | `web` (`compose.yml`, `nexora-web:0.1.0`)                          |

---

## 4. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Restructure Docker architecture from monolithic root Dockerfile to per-app Dockerfiles (`apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker/Dockerfile.tools`) with BuildKit named-context dependency linkage (`additional_contexts: { base: "service:builder" }`). Single authoritative development image in `docker/Dockerfile.tools`.

### Canonical owners

- `docs/architecture/runtime.md`
- `docs/decisions/per-app-docker-architecture.md`
- `docs/operations/setup.md`

### Documentation verification

- `pnpm docs:check`

---

## 5. Evidence

| Claim                                      | Evidence                                                                                   | Date       | Result |
| :----------------------------------------- | :----------------------------------------------------------------------------------------- | :--------- | :----- |
| Baseline commit verified                   | `git rev-parse HEAD` (`837248e`)                                                           | 2026-10-10 | PASS   |
| Seiza reference commit verified            | `git -C d:\work\seiza rev-parse HEAD` (`0e15dd1`)                                          | 2026-10-10 | PASS   |
| Compose configurations valid               | `docker compose config` (release, dev, distribution)                                       | 2026-10-10 | PASS   |
| Clean no-cache build verified              | `docker compose build --no-cache` produced all 5 images                                    | 2026-10-10 | PASS   |
| Local release startup verified             | `docker compose -p nexora-rel-test up --build -d --wait`                                   | 2026-10-10 | PASS   |
| Local HTTP contract verified               | GET /, /live, /ready, /missing on published test port 3001                                 | 2026-10-10 | PASS   |
| Runtime persistence verified               | Data intact across container restart and down/up --no-build                                | 2026-10-10 | PASS   |
| Web runtime noise profile established      | 11,319 total entries in baseline A and B; 44 non-identical Next.js build-ID noise paths    | 2026-10-10 | PASS   |
| Web runtime refactor artifact parity       | 11,319 total entries matching baseline noise; 0 net file difference; 0 unintended files    | 2026-10-10 | PASS   |
| Shared builder freshness verified          | Build marker propagation via named context `base: service:builder` without stale cache     | 2026-10-10 | PASS   |
| Docker & Compose compatibility verified    | Docker 29.6.1, Compose v5.3.0, Buildx v0.35.0 (min Compose v2.22.0+ documented)            | 2026-10-10 | PASS   |
| ADR-004 introduced & ADR-003 restored      | Historical ADR-003 preserved; ADR-004 accepted for per-app Docker layout                   | 2026-10-10 | PASS   |
| Bi-directional manifest checker passed     | `node scripts/boundaries.mjs` verifying workspace packages against Dockerfile COPYs        | 2026-10-10 | PASS   |
| Line endings normalized with gitattributes | `.gitattributes` added; LF enforced for `Dockerfile*` and `*.sh`                           | 2026-10-10 | PASS   |
| Quality suite passed                       | `sh scripts/quality-docker.sh`                                                             | 2026-10-10 | PASS   |
| Runtime smoke passed                       | `sh scripts/runtime-smoke.sh`                                                              | 2026-10-10 | PASS   |
| Data integrity smoke passed                | `sh scripts/data-smoke.sh`                                                                 | 2026-10-10 | PASS   |
| Development smoke passed                   | `sh scripts/dev-smoke.sh`                                                                  | 2026-10-10 | PASS   |
| Dependency cache context verified          | `docker build --build-context dependency-cache=...`                                        | 2026-10-10 | PASS   |
| Build CA secret injection verified         | `docker build --secret id=build_ca,src=...`                                                | 2026-10-10 | PASS   |
| Runtime filesystem comparison              | Tools (3/3), Migrate (11715/11715), API (7600/7600), Web (11319/11319 identical net count) | 2026-10-10 | PASS   |
| Root Dockerfile removed                    | `git rm Dockerfile`                                                                        | 2026-10-10 | PASS   |
| Documentation check passed                 | `pnpm docs:check`                                                                          | 2026-10-10 | PASS   |

---

## 6. Review Findings Analysis & Empirical Details

### 6.1 Baseline Noise & Web Runtime Artifact Analysis

To rigorously resolve the review observation regarding the apparent "+44 files" discrepancy (Baseline: 11,275 vs Refactor: 11,319), isolated builds were conducted on the starting baseline commit (`837248e`) to establish baseline compilation noise, and then compared against the refactored image:

- **Baseline A vs Baseline B (Noise Profile)**:
  - Both builds produced exactly **11,319 total filesystem entries**.
  - **11,275 entries** were bit-for-bit identical in path and sha256 hash.
  - **3 added paths**: `.next/static/<buildId-B>/`, `_buildManifest.js`, `_ssgManifest.js`.
  - **3 removed paths**: `.next/static/<buildId-A>/`, `_buildManifest.js`, `_ssgManifest.js`.
  - **41 changed hashes**: `BUILD_ID`, `build-manifest.json`, Webpack cache binaries, and pre-rendered RSC payloads containing embedded build IDs.
  - **Net path difference**: **0 files** (11,319 vs 11,319).
- **Baseline A vs Refactor (PR Head)**:
  - Refactored Web runtime contains exactly **11,319 total filesystem entries**.
  - Exactly matches the baseline noise profile: 11,275 identical entries, 3 added/3 removed build-ID paths, and 41 changed file hashes.
  - **Net path difference**: **0 files**.
  - **Path-level conclusion**: The previously reported "+44" was an optical artifact of comparing total refactored entries (11,319) against the count of identical entries (11,275) from a single run (11,319 - 11,275 = 44 non-identical entries: 3 renamed paths + 41 changed hashes). No unauthorized or unintended files exist in the refactored image.

| Category                 | Baseline A vs B (Noise) | Baseline A vs PR Refactor | Explanation                                                   |
| :----------------------- | :---------------------- | :------------------------ | :------------------------------------------------------------ |
| Total Entries            | 11,319 vs 11,319        | 11,319 vs 11,319          | Exact match; net file count delta is 0                        |
| Identical Paths & Hashes | 11,275                  | 11,275                    | Identical core Next.js packages and dependencies              |
| Added Paths              | 3                       | 3                         | New Next.js `.next/static/<buildId>/` directory and manifests |
| Removed Paths            | 3                       | 3                         | Previous build-specific `.next/static/<buildId>/` directory   |
| Changed File Hashes      | 41                      | 41                        | Build ID, compilation manifests, and pack chunks              |
| Symlink Differences      | 0                       | 0                         | Symlink graph preserved identically                           |
| Permission Differences   | 0                       | 0                         | Preserved identical permissions across layers                 |
| Unexpected Runtime Files | 0                       | 0                         | Zero leaked source files, secrets, or dev dependencies        |

### 6.2 Shared Builder Freshness & Compose Lifecycle

- **Named Context Linkage**: Verified `additional_contexts: { base: "service:builder" }` propagates cache invalidation. A marker injected into `docker/Dockerfile.tools` (`deps` stage) successfully rebuilt the builder and propagated into `apps/api/Dockerfile` without stale layer reuse.
- **Service Lifecycle Justification**: `init: depends_on: builder: condition: service_completed_successfully` in `compose.yml` is required because `builder` is a one-shot container (`entrypoint: ["true"]`). When started via `docker compose up --wait`, an exit 0 from a service without this condition is interpreted by Compose as unexpected early termination. Preserving the dependency ensures deterministic startup ordering.

### 6.3 Build Context Security & Secret Isolation

- **Authoritative `.dockerignore`**: Repository root `.dockerignore` excludes `.env*`, `.data`, `backups`, `node_modules`, and local credentials across all Dockerfile build contexts. No per-directory ignore files weaken this exclusion.
- **Image Inspection**: Inspected `docker history --no-trunc` and `docker image inspect` on `nexora-api:0.1.0`, `nexora-web:0.1.0`, `nexora-tools:0.1.0`, and `nexora-migrate:0.1.0`. No secret values or sensitive volumes are baked into runtime images.
- **Build CA & Dependency Cache**: Build CA secret mount (`--secret id=build_ca`) is consumed via `NODE_EXTRA_CA_CERTS` in `deps` and is never copied to runtime stages. Dependency cache (`--build-context dependency-cache=...`) is unpackaged strictly in `dependency-cache` stage.

### 6.4 Verified Environment & Versions

- **Docker Engine**: 29.6.1 (API 1.53)
- **Docker Compose**: v5.3.0
- **Docker Buildx**: v0.35.0
- **Host OS**: Windows 11 (Linux Containers)
