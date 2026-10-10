# Project Rules

## 1. Engineering priorities

1. **Hierarchy**: Correctness, maintainability, extensibility, simplicity, then performance.
2. **KISS / YAGNI / SRP**: Avoid speculative complexity. No Redis, Kafka, queues, background workers, vector databases, search clusters, or microservices without an accepted, evidenced ADR.
3. **Repository & runtime discipline**:
   - Inspect existing files, history, and status before proposing changes.
   - Preserve unrelated work; stage and commit only task-owned files.
   - Docker is canonical for services and runtime execution; host Node.js tooling is supported for fast local workflows.
   - Pin exact dependency versions in `package.json`; use frozen installs (`pnpm install --frozen-lockfile`).
   - Never reset user volumes for tests.

## 2. Architectural boundaries

- **Application isolation**: Applications must not import one another. `apps/web` must never import `apps/api` or access `@nexora/database`.
- **Database isolation**: Domain, application, and presentation layers are strictly Prisma-free.
- **Infrastructure access**: Only API infrastructure boundaries consume database functionality, and only through `@nexora/database`.
- **Controllers**: Controllers delegate directly to application services; controllers must never access database adapters or Prisma directly.
- **Architectural linting**: Boundary rules are strictly enforced by `scripts/boundaries.mjs`.

See [Architecture overview](../architecture/overview.md), [Backend](../architecture/backend.md), and [Database](../architecture/database.md).

## 3. Domain & business invariants

- **Shipment domain ownership**: Nexora owns the Shipment business domain (tracking numbers, parcel dimensions/weights, fee estimates, status history).
- **Logistics provider authorization**: External logistics provider integration requires official API documentation and authorization feasibility review before implementation. Never reverse-engineer mobile apps, bypass MFA/CAPTCHA, or scrape carrier portals. If official APIs are unavailable, Nexora operates via manual entry and authorized Excel file imports.
- **Canonical domain vocabulary**:
  - Persisted domain status/type vocabulary uses `as const` TypeScript objects with derived union types, persisted as scalar strings (VARCHAR) in PostgreSQL.
  - Prohibited: new Prisma enum declarations, PostgreSQL ENUM types, and TypeScript `enum` / `const enum`.
  - Feature/domain-local values stay with the owning feature. Values move to `@nexora/shared` only when a real non-generated cross-package consumer exists.

See [Product scope ADR](../decisions/product-scope.md) and [Shipments domain](../domains/shipments.md).

## 4. Documentation synchronization

Every engineering change must assess Documentation Impact before implementation:

- Every PR and task record must declare `Documentation Impact: REQUIRED` or `Documentation Impact: NONE`.
- For `REQUIRED`: identify changed canonical facts, update their document owners in the same PR, and verify.
- For `NONE`: provide an explicit, non-empty reason why no canonical fact changes.
- The [canonical ownership map](../README.md#canonical-ownership-map) in `docs/README.md` is the single source of truth for document ownership.

A task classified as `REQUIRED` cannot be completed while its canonical documentation is stale or documentation validation checks fail.

## 5. Evidence & verification rule

- Never claim workflow or verification success from a YAML file, open port, process ID, or source inspection alone.
- Verification requires executed command output, runtime HTTP probes, or test results recorded with exact timestamps and PASS/FAIL outcomes.
