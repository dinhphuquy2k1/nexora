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

### Readable control flow and error mapping

- Do not nest ternary expressions; use explicit branches or a lookup when multiple cases are involved. ESLint `no-nested-ternary: error` currently enforces this for Customer production TypeScript; extend scope deliberately without unrelated refactors.
- Keep each feature's domain-to-HTTP mapping in one feature-local application mapper, separate from business operations, following `mapIdentityError()`. Store status and safe message together in one entry per code; never maintain parallel tables or duplicate mapping branches.
- For closed domain error unions, require an exhaustive `Record<DomainError["code"], Mapping>` (or `satisfies` equivalent). Services catch only their domain errors and delegate; unexpected errors propagate to the existing global ErrorFilter. Preserve the `{code, message, requestId}` envelope and agreed statuses/security behavior.
- Reuse genuinely repeated validation or control-flow policies within their owning feature. Do not introduce a generic framework or merge checks with different authorization, transaction or validation semantics merely because their syntax resembles one another.

### Mandatory Tactical DDD for business domains

Nexora adopts Modular Monolith, Clean Architecture, Ports & Adapters and Tactical DDD for new business domains and the Customer reference migration. Before implementation, record ownership/language/context, aggregate consistency boundary, entity lifecycle, meaningful Value Objects/invariants, commands/use cases, persistence ports/adapters, cross-domain dependencies and concurrency/test strategy. Resolve ownership/boundary PLAN ISSUES before business writes. [ADR-008](../decisions/tactical-ddd.md) owns rationale and rollout.

- Business decisions belong to aggregates/domain policies; application orchestrates trusted actors/commands/ports. Infrastructure supplies locked facts and persists transitions; it retains authorization rechecks, DB constraints and technical error classification. No domain NestJS/Prisma/HTTP or outward layer imports; no application Prisma or controller adapter access.
- Encapsulate aggregates/child entities; copy snapshots including Date/collection references. No generic write bypass, mutable ownership/code setters or aggregate-as-DTO. Hydrate mutable state only under its transaction/locks; never bulk-delete/reinsert children to save an aggregate or substitute in-memory locks for PostgreSQL consistency.
- Use Value Objects for actual invariants, not all primitives. Read models may use scoped projections without aggregate hydration. Aggregate omissions for pure queries/stateless/supporting/infrastructure capabilities need explicit reviewed plan rationale. No silent exception.
- Customer is the reference; future Shipment/Tracking/Freight Fee domains must follow this preflight without being implemented by this policy. Identity/Carrier/Health/Storage remain grandfathered; substantial extensions require a scoped adoption assessment, not wholesale refactoring.
- Keep KISS/YAGNI: no generic DDD bases/repository/Unit of Work, event bus, CQRS, Event Sourcing, shared kernel, microservices or new dependencies without a concrete need and accepted decision. Boundary lint enforces domain purity/controller separation, while reviewers verify invariants, hydration and transaction semantics.

### Shared domain vocabulary and strict commands

- Canonical cross-package status codes/types live in @nexora/shared for actual consumers or explicit owner-approved contracts. API/Web must not redeclare them; feature Value Objects/transitions remain in Domain. Keep shared browser-safe, app/server-independent and acyclic. No TypeScript/Prisma/PostgreSQL enums; do not migrate Identity/Carrier vocabulary just for symmetry.
- Exhaustive shared labels are presentation metadata, never persisted values, filters or Aggregate state. Domain imports pure code leaves, not labels/root barrels that load presentation metadata. HTTP response types come from generated SDK; shared runtime values and transport schemas must agree. Document same-revision deployment assumptions and deliberate additive/breaking contract changes.
- Public Domain command operations reject unknown/mass-assignment fields, including mixed valid+forbidden fields and invalid runtime shapes. TypeScript alone is insufficient. Reuse canonical scalar/strictness policies; separate transport parsing without duplicating validation algorithms.
- Scope hydration to actual invariants. Profile-only policies may omit child loading when explicitly modeled under unchanged transaction/authorization locks; never pretend incomplete data is a complete Aggregate. Child-dependent mutations still hydrate under locks. Verify query shape and genuine concurrency separately.
- Feature-local error maps keep code/status/safe-message together and exhaustively checked. Reuse exact generic HTTP messages via common HTTP constants; preserve specific messages and unknown-error propagation. No generic Domain error hierarchy/mapper or duplicated mapping branches.

## 3. Domain & business invariants

- **Shipment domain ownership**: Nexora owns the Shipment business domain (tracking numbers, parcel dimensions/weights, fee estimates, status history).
- **Logistics provider authorization**: External logistics provider integration requires official API documentation and authorization feasibility review before implementation. Never reverse-engineer mobile apps, bypass MFA/CAPTCHA, or scrape carrier portals. If official APIs are unavailable, Nexora operates via manual entry and authorized Excel file imports.
- **Canonical domain vocabulary**:
  - Persisted domain status/type vocabulary uses `as const` TypeScript objects with derived union types, persisted as scalar strings (VARCHAR) in PostgreSQL.
  - Prohibited: new Prisma enum declarations, PostgreSQL ENUM types, and TypeScript `enum` / `const enum`.
  - Feature/domain-local values stay with the owning feature. Values move to `@nexora/shared` only when a real non-generated cross-package consumer exists or an explicit owner-approved cross-package contract requires them.
  - Production TypeScript comparisons, assignments, filters, writes and metadata using persisted vocabulary must reference the canonical constants, not repeat literal values. Identity owns UserStatus/UserRole; Carrier owns ConnectionStatus/CarrierProvider/SecretType; Shared owns CustomerStatus codes for the approved API/Web contract; Customer Domain owns CustomerStatusVO. Direct imports from pure domain leaf modules within the API are supported when acyclic; do not duplicate/move vocabulary into shared merely to avoid internal imports.
  - `nexora/no-domain-vocabulary-literals` is an error-level AST guard in `pnpm lint`, covering production Identity/Carrier/Customer TypeScript including application/infrastructure. It recognizes known status/role/provider/secretType (or secret_type) fields in comparisons, assignments, metadata and nested Prisma filters; ambiguous ERROR additionally requires explicit connection context. It accepts canonical declarations and ignores type-only declarations, tests, generated code, messages/routes and unrelated values. This is a contextual syntax guard, not a whole-program type checker: arbitrary aliases, dynamic keys and opaque raw SQL require review. Any persisted vocabulary in raw SQL must use canonical bound parameters where applicable; SQL CHECK migrations remain explicit SQL literals.
  - Keep the small lint vocabulary catalog synchronized with owning domain/shared declarations; `pnpm test:lint` checks every current owning-domain value using the TypeScript AST and real ESLint, plus false-positive/config/CLI regression cases. New domains or new contexts require deliberate guard/test updates; ambiguous literals must not be rejected by string value alone.

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
