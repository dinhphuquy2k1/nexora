# NEXORA-063 — Raw SQL Readability & Lint Enforcement

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Scope

Owner decision (2026-11-26): reduce PR #62 (`refactor/database-access-prisma-orm`) to its sole intended purpose of making production Raw SQL readable for review without changing the actual SQL sent to PostgreSQL.

- **Kept in scope**:
  - Multiline formatting of all production Raw SQL (`apps/api/src`) with uppercase SQL keywords, one `SELECT` column / `WHERE` condition / `SET` assignment per line, separated `WITH` / `RETURNING` blocks, and lines at most 120 characters.
  - Conditional extraction of long (> ~15 formatted lines) or reused SQL builders into pure module-local `queries/*.queries.ts` functions returning `Prisma.Sql` from explicit SQL parameters.
  - One-line "why" invariant comments on locks (`FOR UPDATE` / `FOR SHARE` / `SKIP LOCKED` / `pg_advisory_xact_lock` / `sync_lock_*`), lease fencing (`lease_version`, `worker_id`, `lease_expires_at`), `clock_timestamp()`, and lock ordering.
  - ESLint rules `nexora/no-unsafe-raw-sql` and `nexora/readable-raw-sql` with RED/GREEN tests (`pnpm test:lint`).
  - Normalized SQL parity verification against `origin/main` (`5edbcfe1609562f9eb5b6c156cf5cec68b5b71fa`).
- **Removed from scope (compared to historical HEAD `8a7b7e444756c4eec91f9781ece7a3b5bc17aefe`)**:
  - All Raw SQL → Prisma ORM conversions (`shipment.adapter.ts`, `sync-job.repository.ts`, `shipment-reconciliation.ts`, `customer-sync-domain.binding.ts`, `sync-scan-observation.ts`).
  - `shipment-read.mapper.ts`, `sync-job.mapper.ts`, `shipment-reconciliation.persistence.ts`, `job-mapper.test.cjs`, and ORM-only test/benchmark/fixture changes (`read.test.cjs`, `services-read.test.cjs`, `reconciliation.test.cjs`, `capability.test.cjs`, `sql-instrumentation.cjs`, F03/F04 ORM parity probes).
  - Column-list rewrites of `SELECT *` and any `ORM-first` documentation claims.

## Design Review & Reuse Decision

Task ID: NEXORA-063
Classification: SIGNIFICANT
Plan revision: rev-2026-11-26-raw-sql-readability-v2
Reviewed baseline: 5edbcfe1609562f9eb5b6c156cf5cec68b5b71fa
Branch: refactor/database-access-prisma-orm
Design Snapshot: docs/tasks/design-reviews/NEXORA-063-rev-2026-11-26-raw-sql-readability-v2.md
Design SHA-256: c2e20ec50af0d9fcaf95e5f9fa889e7f60cd7ec289613a9fab6e8931195e559f

| Field                        | Raw SQL Presentation & Guardrails                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Component**                | Multiline Raw SQL formatting, `queries/*.queries.ts` builders, invariant comments, `nexora/no-unsafe-raw-sql`, `nexora/readable-raw-sql`                                             |
| **Existing implementations** | `shipmentReconciliationQueries` (`shipment-reconciliation.ts`), `scanIdentityResolutionQuery` (`sync-scan-observation.ts`), `scripts/eslint-rules/no-domain-vocabulary-literals.mjs` |
| **Domain owner**             | Owning module infrastructure (`shipment/infrastructure/queries/`, `sync/infrastructure/queries/`); ESLint rules in `scripts/eslint-rules/`                                           |
| **Reuse alternatives**       | Alternatives rejected: Prisma ORM conversion (alters generated SQL and adds mapper/parity risk), external SQL formatter plugin, generic query repository                             |
| **Selected approach**        | Pure multiline formatting + conditional extraction to `queries/*.queries.ts` + invariant comments + local AST/layout ESLint rules                                                    |
| **Rationale**                | Zero SQL semantic drift, zero new runtime dependencies, automated prevention of future single-line or unsafe raw SQL                                                                 |
| **Risks**                    | Accidental SQL token/cast/whitespace-sensitive drift during formatting                                                                                                               |
| **Verification**             | Automated normalized SQL parity script (`docs/tasks/evidence/NEXORA-063/`), `pnpm test:lint`, `pnpm quality`, genuine PostgreSQL CI                                                  |

### Domain Invariants & Tactical DDD Boundaries

All Tactical DDD boundaries (`Presentation -> Application -> Domain`, `Infrastructure -> Domain`), aggregate encapsulation, and domain invariants (lock ordering, lease fencing, `clock_timestamp()`, partial-index `ON CONFLICT`, and restricted DB roles) are preserved unchanged; only infrastructure Raw SQL formatting, pure `queries/*.queries.ts` builders, and invariant comments are added.

## Plan

1. Rebuild branch `refactor/database-access-prisma-orm` from `origin/main` (`5edbcfe1609562f9eb5b6c156cf5cec68b5b71fa`) and close `NEXORA-062` per §1.7.
2. Format all production Raw SQL as multiline parameterized template literals, extract long/reused builders into `queries/*.queries.ts`, and add one-line invariant comments.
3. Add ESLint rules `nexora/no-unsafe-raw-sql` and `nexora/readable-raw-sql` with RED/GREEN tests (`pnpm test:lint`).
4. Update canonical docs (`PROJECT_RULES.md`, `database.md`, `backend.md`, `testing.md`), Snapshot v2, and this task record.
5. Verify 100% normalized SQL parity against `origin/main` and record evidence under `docs/tasks/evidence/NEXORA-063/`.
6. Run host quality gates, push with `--force-with-lease`, and verify hosted CI.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- `docs/ai/PROJECT_RULES.md`: Raw SQL multiline formatting convention, conditional `queries/*.queries.ts` extraction, invariant comments, prohibition of `*Unsafe`, and ESLint rule enforcement.
- `docs/architecture/database.md`: Raw SQL readability & safety standards (`NEXORA-063`).
- `docs/architecture/backend.md`: Conditional pure query-builder separation without generic repository abstractions.
- `docs/operations/testing.md`: `pnpm test:lint` coverage for `no-unsafe-raw-sql` / `readable-raw-sql` and SQL parity verification.

### Canonical owners

- docs/ai/PROJECT_RULES.md
- docs/architecture/database.md
- docs/architecture/backend.md
- docs/operations/testing.md

### Documentation verification

- `pnpm docs:check`
- `pnpm preflight:check`

## Acceptance

- [x] Branch rebuilt cleanly from `origin/main` (`5edbcfe1609562f9eb5b6c156cf5cec68b5b71fa`); `NEXORA-062` closed per §1.7.
- [x] All production Raw SQL formatted multiline; long/reused queries extracted to `queries/*.queries.ts` with invariant comments; zero ORM conversions or mapper additions.
- [x] ESLint rules `nexora/no-unsafe-raw-sql` and `nexora/readable-raw-sql` added with passing `pnpm test:lint` and `pnpm lint`.
- [ ] Normalized SQL parity evidence recorded and all host/CI checks PASS on final HEAD.

## Evidence

| Claim                                                                                                            | Evidence                                                                                                                                                                                                                                                                                                                                                             | Date       | Result |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Historical v1 baseline & host checks (superseded by scope reduction)                                             | `pnpm format:check && pnpm lint && pnpm preflight:check && pnpm docs:check && pnpm typecheck && pnpm --filter @nexora/api test` (278/278 -> 281/281) on `5edbcfe` and `b7cde51` / `d992c24` (superseded by scope reduction)                                                                                                                                          | 2026-11-25 | PASS   |
| Historical v1 hosted CI on `b7cde51`, `d992c24`, `2abaf2c`, `919bf50`, `8a7b7e4` (superseded by scope reduction) | Runs `45637408081`, `45645823041` (FAIL), `45649825431`, `45745436117` (FAIL), `45745436075` (superseded by scope reduction)                                                                                                                                                                                                                                         | 2026-11-26 | PASS   |
| ESLint Raw SQL rules (`no-unsafe-raw-sql`, `readable-raw-sql`)                                                   | `pnpm test:lint` (70/70 PASS) and `pnpm lint` (Workspace boundaries PASS + `eslint .` 0 errors)                                                                                                                                                                                                                                                                      | 2026-11-26 | PASS   |
| Normalized SQL parity against `origin/main`                                                                      | AST extraction & normalization across 17 base files + 8 `queries/*.queries.ts` modules: 148/148 matched pairs, 0 added, 0 removed (`docs/tasks/evidence/NEXORA-063/sql-parity-20261126-1913.md`)                                                                                                                                                                     | 2026-11-26 | PASS   |
| Host verification & Rule A test-double fix                                                                       | Updated 2 test doubles in `apps/api/test/sync/capability.test.cjs` (whitespace normalization + `Prisma.Sql` support for `buildAdmitSyncJobQuery`); `format:check`, `lint`, `test:lint` (70/70), `typecheck`, `contracts:check`, `docs:check`, `preflight:check`, `@nexora/api test` (278/278), `build`: PASS                                                         | 2026-11-26 | PASS   |
| Host `pnpm quality` Linux-only root script tests                                                                 | `docs-check.test.mjs`, `preflight-policy-check.test.mjs`, `provision-cluster-smoke.test.mjs`, `public-authority.test.mjs` failed on Windows host due to `EPERM` symlink / POSIX `SIGKILL` / `bash` (runs in Linux Docker CI)                                                                                                                                         | 2026-11-26 | FAIL   |
| Hosted CI on `2e28d33` & Rule A `shipment-child-batch.cjs` fix                                                   | `45819094752` (Preflight FAIL: PR body still referenced old task path during push event before REST PATCH), `45819094777` (Sync PG FAIL: `shipment-child-batch.cjs` `$executeRaw` proxy expected array `.join` on `Prisma.Sql` from `shipment-children.queries.ts`). Updated `shipment-child-batch.cjs` to accept `Prisma.Sql` and multiline `INSERT INTO <table> (` | 2026-11-26 | FAIL   |
