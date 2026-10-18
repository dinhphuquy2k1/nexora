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
  - Production TypeScript comparisons, assignments, filters, writes and metadata using persisted vocabulary must reference the canonical constants, not repeat literal values. Identity owns UserStatus/UserRole; Carrier owns ConnectionStatus/CarrierProvider/SecretType. Direct imports from pure domain leaf modules within the API are supported when acyclic; do not duplicate/move vocabulary into shared merely to avoid internal imports.
  - `nexora/no-domain-vocabulary-literals` is an error-level AST guard in `pnpm lint`, covering production Identity/Carrier TypeScript including application/infrastructure. It recognizes known status/role/provider/secretType (or secret_type) fields in comparisons, assignments, metadata and nested Prisma filters; ambiguous ERROR additionally requires explicit connection context. It accepts canonical declarations and ignores type-only declarations, tests, generated code, messages/routes and unrelated values. This is a contextual syntax guard, not a whole-program type checker: arbitrary aliases, dynamic keys and opaque raw SQL require review. Any persisted vocabulary in raw SQL must use canonical bound parameters where applicable; SQL CHECK migrations remain explicit SQL literals.
  - Keep the small lint vocabulary catalog synchronized with owning domain declarations; `pnpm test:lint` checks every current owning-domain value using the TypeScript AST and real ESLint, plus false-positive/config/CLI regression cases. New domains or new contexts require deliberate guard/test updates; ambiguous literals must not be rejected by string value alone.

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

### Owner-approved local execution alternative — 2026-10-18

When hosted runners are unavailable, full canonical Docker verification on a local Linux host is an accepted PR verification path. This changes execution location, not acceptance criteria. Require the exact review commit, clean worktree before/after, pinned frozen dependencies, genuine Prisma/PostgreSQL/browser, all five canonical scripts without skipped assertions, disposable owned resources, and safe artifacts recording SHA/environment/start/end/timezone/commands/exit codes/log checksums. Targeted tests or preflight alone are insufficient. Distinguish LOCAL verification PASS from GitHub Actions SUCCESS; never fabricate a hosted check. Checksums detect artifact changes, not independent execution attestation. User-supplied evidence must be identified separately from agent-observed execution.

Record final-head evidence in the PR description after committing necessary source/docs/scripts. Any subsequent change requires new full verification. Preserve historical FAIL/NOT RUN and production gates. Ready for review requires full accepted-path verification; COMPLETED still requires every task criterion. GitHub required checks/merge permissions remain separate: inspect read-only where authorized, never delete/bypass/fake checks, change runner criteria or merge automatically. See [Testing](../operations/testing.md#owner-approved-local-docker-verification--2026-10-18).
