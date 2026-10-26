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

### Neutral API Common validation and reuse ownership

- Shared technical validation and value objects used across multiple API domains live in neutral common modules (`apps/api/src/common/`):
  - `validation/uuid.ts`: Canonical `isUuid` predicate (8-4-4-4-12 hex groups, case-insensitive, no variant/version restrictions, no implicit trimming).
  - `validation/hex.ts`: Canonical `isLowercaseHex64` format predicate.
  - `value-objects/phone-number.ts`: Domain-neutral `PhoneNumber` VO (immutable E.164 normalization via pinned `libphonenumber-js/max`, extension rejection, explicit country context).
  - `value-objects/country-code.ts`: Domain-neutral `CountryCode` VO (immutable ISO 3166-1 alpha-2 validation via `i18n-iso-countries`, XK exclusion).
  - `http/error-messages.ts`: Canonical generic safe HTTP error message constant (`"Không thể thực hiện yêu cầu"`).
- Common modules must:
  - Be framework-independent where possible.
  - Have zero dependencies on Customer, Identity, Carrier, or future Shipment domains.
  - Never import NestJS, Prisma, or `@nexora/database`.
  - Never throw domain-specific errors (`CustomerError`, `CarrierError`, `IdentityError`); throw domain-neutral errors (`InvalidPhoneNumberError`, `InvalidCountryCodeError`).
  - Contain no transport DTOs or database models.
- Business domains remain responsible for their business invariants (e.g. Customer maximum raw length 64, default national context `"VN"`, address fallback, per-owner phone uniqueness, and translation to domain errors).
- Syntactic similarity is not semantic identity: do not consolidate authorization, locking, transaction boundaries, or different field-length policies across domains.

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

## 6. Mandatory Pre-Code Design Review & Reuse Governance

No agent or contributor may begin writing implementation code, test-code modifications, database schema changes, scaffolding, dependency additions, or CI workflow changes for any new implementation task until a design review and reuse audit have been completed and explicit approval has been obtained. Read-only repository inspection and preparing the review artifact remain permitted. See [ADR-009](../decisions/mandatory-pre-code-design-review.md).

- **Scaled Review Depth**:
  - **BOUNDED**: Concise review covering existing implementation search, minimal intended change, reuse decisions, contract impact, risk assessment, and approval reference before editing.
  - **SIGNIFICANT**: Comprehensive review covering scope, existing implementation inventory, repository-wide reuse search matrix, DDD/domain ownership, alternative designs and trade-offs, feasibility, correctness, security/concurrency invariants, performance/query costs, maintainability/YAGNI, compatibility (API/DB/SDK), risk mitigations, verification plan, and approval reference.
  - **SPIKE**: Formulate an approved investigation question, bounded hypothesis, and evidence procedure. Never disguise a production implementation as a SPIKE.
- **Approval Separation**:
  - Design approval is strictly separate from the 4-stage Task Lifecycle (`PLANNED → IN PROGRESS → VERIFICATION PENDING → COMPLETED`), Code Review, Test PASS, and Merge Readiness.
  - Do not create a `DESIGN_APPROVED` task lifecycle status. Record design approval in the task's design review decision record.
  - An agent must never approve its own design on behalf of the owner. Approval must reference an identifiable decision, PR review, or instruction revision.
  - On pull requests, PR metadata (`Task ID`, `Task Reference`, `Plan revision`, `Design Snapshot`, `Design SHA-256`) must match the active task, filename, and plan revision exactly; traversal paths and URLs fail closed. GitHub CI independently verifies approval provenance from authorized logins (`dinhphuquy2k1`) via an `APPROVED` review or owner comment with mandatory header `NEXORA DESIGN APPROVAL`. In PR CI mode, missing tokens, malformed payloads, or unverified approvals fail closed. Local and push-to-main static runs validate structural conformance without claiming authenticated GitHub approval.
- **Mandatory Reuse Audit Matrix**:
  - Every review artifact must include a structured component reuse matrix documenting: Component, Existing Implementations, Domain Owner, Reuse Alternatives, Selected Approach, Rationale, Risks, and Verification. Blank or unevidenced "no reusable code found" claims are rejected.

Design approval integrity follows [ADR-009](../decisions/mandatory-pre-code-design-review.md) and [Task Workflow](TASK_WORKFLOW.md): immutable raw-byte snapshot digest, strict standalone authenticated decision, physical regular-file provenance with no symlinks, and separate static/implementation enforcement. Material designs require new revision/snapshot approval; routine execution evidence does not. Never self-attest or backdate approval.

## Test discovery and infrastructure conventions

Use native Node Test Runner suffix discovery under the established ordinary roots; put external-service API tests under apps/api/integration and helpers/fixtures under non-test-suffixed paths. New nested ordinary tests must need no package filename-list edits. Preserve nonempty discovery checks and before/after baseline membership; never let unmatched globs silently pass with zero tests. Double-quote package-script globs for Windows CMD and Node expansion. Turbo owns existing build prerequisites; environment-safe assertions do not waive genuine builds. Root tooling tests join pnpm test and quality must not duplicate those runs.

Prefer Node built-ins for test orchestration; preserve exact ownership, timeout/signal/failure cleanup and redaction contracts. The two existing Python standard-library PTY harnesses are a justified exception until equivalent real terminal behavior is independently proven without new native dependencies. Do not replace PTY with stdin mocks or broaden ordinary tests to destructive/shared database harnesses. Canonical commands and category details belong in [Testing](../operations/testing.md).

## 7. Mandatory UI Design System & Component Reuse Rule

### NEXORA UI TOKEN & COMPONENT REUSE RULE

- **Reuse semantic CSS tokens**: Reuse an existing semantic CSS token instead of replacing it with an equivalent hardcoded value.
- **Central definition**: Public theme tokens are defined centrally in `apps/web/styles/tokens.css`. Private component mappings may be declared only by the owning shared UI module and must resolve to public tokens; they are not feature override points.
- **Semantic correctness**: Tokens must be used strictly for their intended semantic role (text tokens for text, surface tokens for backgrounds, border tokens for borders, elevation tokens for shadows, focus tokens for focus rings). Never reuse tokens across roles purely based on identical values.
- **Avoid unnecessary fallbacks**: In `apps/web`, mandatory tokens are guaranteed by the root theme; do not write unnecessary fallbacks in `var()`. In `packages/ui`, direct token consumption is standard; standalone fallbacks are permitted only under an explicit standalone consumer contract, without nested fallback chains or duplicating default raw values.
- **Canonical state and sizing contract**: Compatible shared controls use default32px/medium40px/large48px and their typed size API, including Login/MFA. Public --control-size-default/medium/large, --control-radius and --control-font-size replace retired --control-height; Textarea stays multiline and Checkbox indicator/target remain separate. Before any frontend modification, inspect [Design System](../architecture/design-system.md) and [Reusable Components](../architecture/reusable-components.md), reuse their contracts, and justify/approve material exceptions. Shared default changes require consumer-impact and regression checks.
- **Shared primitive reuse**: Feature components must reuse shared primitives from `packages/ui` rather than duplicate their styling or render raw HTML form controls.
- **Layout vs defaults**: Feature-specific CSS may control layout and genuine exceptions (e.g. inner icon padding, layout width) but must not redefine shared control defaults or use `!important`.
- **CSS Modules scoping**: Component styling must remain in CSS Modules; avoid broad global selectors.
- **Mandatory contract-based tests**: Frontend tests must enforce Token Contracts (presence, resolution, acyclicity, semantic ownership), Component Consistency (shared variables across controls), dynamic WCAG AA contrast, and Runtime Overrides (dynamic updates via computed styles).
- **Mandatory testing of actual interactive states**: Interactive states (such as `:hover`, `:focus`, `:focus-visible`) must be verified on actual rendered UI primitives using real user/pointer interaction (e.g. Chromium CDP `Input.dispatchMouseEvent` with `mouseMoved`), confirming genuine pseudo-class matches (`matches(':hover')`), awaiting CSS transition completion, and accounting for alpha/opacity compositing. Tests must never simulate interactive states by directly assigning expected styles to dummy elements or hardcoding theme RGB values, and must include negative regression cases proving that inaccessible styles fail closed.
- **Disallow tests duplicating configurable token constants**: Tests must never lock implementation defaults (such as hardcoding 44px, 12px, or exact RGB arrays) merely to match default token values. Tests must remain resilient to token reconfigurations, and exact-value assertions are permitted only where an absolute dimension is an explicit, justified acceptance invariant.
- **Comprehensive CSS policy discovery**: CSS policy validation must scan all production CSS across `apps/web`, `packages/ui`, and future `apps/web/features/**` CSS modules.
- **Literal-color prohibition & scanner enforcement**: Production CSS must not contain raw color literals (`#hex`, `rgb/rgba`, `hsl/hsla`, named colors) in color, background, border, outline, or shadow properties. Canonical palette colors belong solely in `tokens.css`. Allowed exceptions are strictly limited to documented contextual constants, local geometric coordinates, component-specific micro-shadows, and standalone `packages/ui` fallbacks inside `var()`.
- **Documented exceptions**: Any intentional visual exception must document its reason, scope, and compatibility impact per [Frontend Architecture](../architecture/frontend.md).
- **Demonstrated need**: Do not create unused generic components or introduce new UI frameworks without demonstrated need.

### Visual Fidelity Rule for Reference Migrations

When implementing a UI from a supplied design/source reference, the agent must preserve the reference's approved visual intent. Shared components and design tokens must serve that intent, not silently replace it. All differences must be traced to source, explained, and verified. Unrequested visible features must not be introduced.

Canonical ownership:

- [Engineering Policy](PROJECT_RULES.md#7-mandatory-ui-design-system--component-reuse-rule): Mandatory engineering policy and governance.
- [Frontend Architecture](../architecture/frontend.md): Canonical Styling Policy, token hierarchy, semantic ownership, fallback rules, and form control contract.
- [Reusable Components Registry](../architecture/reusable-components.md): Canonical shared control registry and component ownership.
- [Design System](../architecture/design-system.md): Canonical visual fidelity matrix, token contracts, and reference migration guidelines.
