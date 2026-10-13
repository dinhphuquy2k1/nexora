# ADR-001 · Technology baseline & provenance

Accepted 2026-10-09. Nexora Foundation v0.1.0 bootstraps an independent shipment management application by reusing Lyra's technical foundation at exact source commit `77a5d45f713e05001e45f09ce3687c4a3869698b` from `https://github.com/dinhphuquy2k1/lyza`. Secondary reference `https://github.com/dinhphuquy2k1/seiza` (commit `909ecc81aac006abe3e35828369679b1e67c62f3`) was confirmed; dependency versions are preserved from Lyra's accepted baseline without downgrading to Seiza.

| Tool                      | Exact selection               |
| ------------------------- | ----------------------------- |
| Node                      | 24.19.0, bookworm-slim images |
| pnpm                      | 10.34.6                       |
| TypeScript                | 5.9.3                         |
| Turbo                     | 2.11.7                        |
| Next / React              | 16.3.8 / 19.3.0               |
| Nest core/common/platform | 11.2.7                        |
| Swagger                   | 11.4.7                        |
| Prisma/client             | 7.10.0                        |
| PostgreSQL                | 17.11-bookworm                |

## Provenance and component treatment

- **Source repository**: `https://github.com/dinhphuquy2k1/lyza`
- **Source commit**: `77a5d45f713e05001e45f09ce3687c4a3869698b`
- **Retained components**:
  - pnpm / Turbo monorepo workspace structure
  - NestJS API modular monolith architecture (`apps/api`)
  - Next.js web application (`apps/web`)
  - PostgreSQL 17.11 and Prisma 7.10 database layer (`packages/database`)
  - Generic local file storage adapter and stored file catalog (`stored_files`)
  - OpenAPI deterministic SDK generation and typed client (`packages/sdk`)
  - Reusable UI tokens and components (`packages/ui`)
  - Shared package constants (`packages/shared`)
  - Docker multi-stage build and compose topologies (`compose.yml`, `compose.dev.yml`, `compose.release.yml`)
  - Architecture boundary linting (`scripts/boundaries.mjs`)
  - OpenAPI/SDK contract drift verification (`scripts/contracts-check.mjs`)
  - Backup and restore verification scripts (`scripts/backup.sh`, `scripts/restore.sh`, `scripts/backup-manifest.mjs`; retired under [ADR-006](scope-reduction-backup-restore.md))
- **Removed components**:
  - `packages/reconciliation` (freight reconciliation business package)
  - Unused dependency `decimal.js`
  - Freight reconciliation domain documentation (`docs/domains/reconciliation.md`, `annotations.md`, `decisions.md`)
  - Historical Lyra task evidence (`docs/tasks/foundation.md`)
  - Reconciliation volume definitions and dev overrides in Compose
- **Modified components**:
  - Workspace package naming: `@lyra/*` → `@nexora/*`
  - Root project identity: `lyra` → `nexora`
  - Docker Compose project: `name: nexora`
  - Docker image tags: `nexora-tools:0.1.0`, `nexora-migrate:0.1.0`, `nexora-api:0.1.0`, `nexora-web:0.1.0`, `nexora-dev:0.1.0`
  - PostgreSQL database and user: `nexora`
  - Default host web port: `127.0.0.1:3001` (configurable via `WEB_PORT`) to eliminate collisions with Lyra (`127.0.0.1:3000`)
  - Application branding and UI text adapted to Nexora shipment management
  - Boundary script updated with `@nexora/*` rules and negative test assertions
- **Technology deviations**:
  - Zero package version deviations; identical engine and package versions preserved from Lyra.
