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
- `docs/decisions/reference-architecture-policy.md`

### Documentation verification

- `pnpm docs:check`

---

## 5. Evidence

| Claim                              | Evidence                                                                                                                                              | Date       | Result |
| :--------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Baseline commit verified           | `git rev-parse HEAD` (`837248e`)                                                                                                                      | 2026-10-10 | PASS   |
| Seiza reference commit verified    | `git -C d:\work\seiza rev-parse HEAD` (`0e15dd1`)                                                                                                     | 2026-10-10 | PASS   |
| Compose configurations valid       | `docker compose config` (release, dev, distribution)                                                                                                  | 2026-10-10 | PASS   |
| Refactored production build        | `docker compose build`                                                                                                                                | 2026-10-10 | PASS   |
| Refactored development build       | `docker compose -f compose.yml -f compose.dev.yml build`                                                                                              | 2026-10-10 | PASS   |
| Quality suite passed               | `sh scripts/quality-docker.sh`                                                                                                                        | 2026-10-10 | PASS   |
| Runtime smoke passed               | `sh scripts/runtime-smoke.sh`                                                                                                                         | 2026-10-10 | PASS   |
| Data integrity smoke passed        | `sh scripts/data-smoke.sh`                                                                                                                            | 2026-10-10 | PASS   |
| Development smoke passed           | `sh scripts/dev-smoke.sh`                                                                                                                             | 2026-10-10 | PASS   |
| BuildKit named context linkage     | `docker compose build api` automatically rebuilds `builder`                                                                                           | 2026-10-10 | PASS   |
| Dependency cache context verified  | `docker build --build-context dependency-cache=...`                                                                                                   | 2026-10-10 | PASS   |
| Build CA secret injection verified | `docker build --secret id=build_ca,src=...`                                                                                                           | 2026-10-10 | PASS   |
| Manifest declaration check         | `node scripts/boundaries.mjs`                                                                                                                         | 2026-10-10 | PASS   |
| Runtime filesystem comparison      | Tools (3/3 identical), Migrate (11715/11715 identical), API (7600/7600 identical), Web (11275/11319 identical, delta in Next.js build IDs/cache only) | 2026-10-10 | PASS   |
| Root Dockerfile removed            | `git rm Dockerfile`                                                                                                                                   | 2026-10-10 | PASS   |
| Documentation check passed         | `pnpm docs:check`                                                                                                                                     | 2026-10-10 | PASS   |
