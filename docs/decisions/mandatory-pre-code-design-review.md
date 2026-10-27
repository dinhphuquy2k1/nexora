# ADR-009 · Mandatory Pre-Code Design Review and Shared Validation Ownership

Status: Accepted. Date: 2026-10-21. Authority: Explicit project owner decision implemented in PR #23 (NEXORA-027). ADR-008 remains authoritative for Tactical DDD. ADR-009 governs pre-code engineering review, reuse audits, and shared technical validation ownership.

## Context

Prior to this decision, repository preflight checks verified task existence, branch cleanliness, and documentation integrity, but permitted agents to immediately write implementation code, tests, and schema migrations. In practice, this led to subtle regressions and repeated technical duplication across features:

- UUID validation regexes were independently re-implemented in four separate files across Customer, Carrier, and Identity domains.
- Lowercase 64-character hexadecimal format checks were duplicated in five places across user management, authentication, and MFA.
- Domain value objects duplicated third-party normalization logic (`libphonenumber-js`, `i18n-iso-countries`) directly inside domain files instead of consuming neutral shared primitives.
- Code review occurred only after implementation was fully written, making architectural corrections costly and contentious.

A proactive governance mechanism is necessary to enforce pre-code design evaluation and reuse analysis before any code or test modification occurs.

## The Pre-Code Gate

No agent or contributor may begin writing implementation code, test modifications, database schema changes, scaffolding, dependency additions, or CI workflow changes for any new implementation task until:

1. A **Read-Only Repository Inspection** has surveyed existing implementations, related domain models, and established patterns.
2. A structured **Reuse & Design Audit** has evaluated reuse candidates, domain ownership, and explicit non-goals.
3. A **Pre-Implementation Review** artifact matching task classification depth has been generated.
4. A versioned, reviewable implementation plan has been recorded. No owner approval/comment is required to start code.

Read-only inspection and preparing review artifacts remain unrestricted.

## Scaled Review Depth

Review depth scales deterministically with task classification:

- **BOUNDED**: Concise review covering:
  - Exact search scope and existing implementation inventory.
  - Minimal intended change.
  - Component reuse decisions.
  - Contract and interface impact.
  - Risk assessment and regression test plan.
  - Plan revision and impact reference before editing.

- **SIGNIFICANT**: Comprehensive review covering:
  - Requirements and boundary scope.
  - Repository-wide relevant reuse search matrix.
  - DDD / Domain ownership (ubiquitous language, aggregate boundaries, port interfaces).
  - Alternative designs and explicit architectural trade-offs.
  - Correctness, maintainability, and YAGNI evaluation.
  - Security, authorization, and concurrency invariants (lock order, idempotence).
  - Performance and query costs (hydration efficiency, N+1 avoidance).
  - Backward compatibility (API, OpenAPI contracts, SDK, database, historical data hydration).
  - Mitigation strategies and test-first verification plan.
  - Specific plan/review reference.

- **SPIKE**: Explicitly formulated investigation question, bounded hypothesis, and reproducible evidence procedure. A SPIKE must never be used to bypass design governance for production code.

## Plan-first execution policy (owner decision, 2026-10-27)

**No owner approval, GitHub approval review, or five-line approval comment is required to start or continue implementation.** Before code, the agent must inspect the repository, prepare and record a scoped plan/reuse audit, identify affected contracts and tests, and follow that plan. A material scope/architecture change requires an updated plan and impact review, **not another owner attestation**. Existing owner decisions remain binding unless the owner changes them; do not falsely claim an unrecorded design was approved.

PR preflight enforces task identity, plan revision, snapshot/digest integrity, reuse audit, documentation impact, and CI verification; it **must not** query GitHub comments/reviews for design approval or fail merely because an approval status/comment is absent or pending. Historical approval fields and immutable approved snapshots are preserved for provenance, not ongoing execution gates. Code review, test evidence, security controls, and owner merge decision remain separate and required where applicable.

## Historical owner-approval policy (superseded; non-normative)

Before 2026-10-27, ADR-009 also required a GitHub owner review or a five-line `NEXORA DESIGN APPROVAL` comment tied to a plan revision and its SHA-256 digest. GitHub CI authenticated the author, checked chronology and allowed revocation. This **approval attestation requirement is superseded** by the plan-first policy above. It must not be used to block implementation, CI or merge readiness. Existing approved snapshots and authenticated historical decisions remain unchanged for traceability.

## Technical Validation & Reuse Ownership

To eliminate recurring duplication while preserving tactical DDD boundaries, three distinct ownership tiers are established:

1. **Neutral API Common (`apps/api/src/common/`)**:
   - Technical, domain-agnostic validation and value objects used across multiple API features.
   - Modules:
     - `validation/uuid.ts`: Canonical `isUuid` predicate (8-4-4-4-12 hex groups, case-insensitive, no variant restriction, no trimming).
     - `validation/hex.ts`: Canonical `isLowercaseHex64` predicate (format-only check).
     - `value-objects/phone-number.ts`: Domain-neutral `PhoneNumber` VO (immutable, E.164 normalization via pinned `libphonenumber-js/max`, extension rejection, explicit country context parameter).
     - `value-objects/country-code.ts`: Domain-neutral `CountryCode` VO (immutable, ISO 3166-1 alpha-2 validation via `i18n-iso-countries`, trim/uppercase normalization, XK exclusion).
     - `http/error-messages.ts`: Canonical `GENERIC_ERROR_MESSAGE` constant (`"Không thể thực hiện yêu cầu"`).
   - Architectural Constraints:
     - Framework-independent where possible.
     - Strictly zero dependencies on Customer, Identity, Carrier, or future Shipment domains.
     - Zero imports of NestJS, Prisma, or `@nexora/database`.
     - Throws domain-neutral errors (`InvalidPhoneNumberError`, `InvalidCountryCodeError`), never domain-specific errors.
     - Free of transport DTOs and database models.

2. **Domain-Specific Business Invariants (`apps/api/src/<domain>/`)**:
   - Feature-specific business rules, entity invariants, and error mappings stay strictly within the owning domain.
   - Customer domain retains:
     - Maximum raw phone length (64 characters) and required/nullable policy.
     - Default national parsing country context (`"VN"`).
     - Recipient address fallback and per-owner phone uniqueness.
     - Translation of validation failures to `CustomerError("VALIDATION_ERROR")`.
     - Address default recipient country (`"VN"`).
   - Identity domain retains:
     - Token generation, entropy, hashing, expiration, and replay protection.
     - User status rules and last-active-admin invariants.
   - Carrier domain retains:
     - Connection lifecycle generation/epoch and provider error mappings.
   - Generic DDD frameworks, generic repositories, or cross-domain transaction managers are strictly prohibited.

3. **Cross-Package Shared Contracts (`packages/shared/`)**:
   - Reserved exclusively for real API/Web shared contracts, browser-safe values, and deployment policies.
   - Example: `CustomerStatus` (code literals) and `CustomerStatusLabelsVi` (presentation labels).
   - Backend-only code and domain logic must never leak into `@nexora/shared`.

## Intentionally Preserved Differences (Non-Goals)

Syntactic resemblance does not imply semantic equivalence. The following must remain domain-specific:

- ACTIVE user locking vs Carrier connection locking.
- Customer address default selection vs Identity session assurance.
- Individual text field length limits and allowlists.
- Feature-local HTTP error mappers.

## Skill-Assisted Governance & CI Automation

Engineering governance is sustained through:

1. **Agent Skills**:
   - `pre-implementation-review`: Enforces read-only inspection, reuse matrix preparation, and stops before code editing if approval is missing.
   - `implementation-code-review`: Audits implemented diffs against approved designs, detects duplicate patterns, and issues structured P1/P2/P3 findings.
2. **Instruction Routing**: Root `AGENTS.md`, `.github/copilot-instructions.md`, and `.github/instructions/backend.instructions.md`.
3. **Static Preflight Checker (`scripts/preflight-policy-check.mjs`)**: Verifies task references, structured design reviews, and reuse documentation on pull requests.
4. **Duplication Screening & Enforcement**:
   - **Tier 1 (Heuristic Screening)**: Fast dependency-free preflight scanner (`scripts/preflight-policy-check.mjs`) screening for known duplicate regex declarations and direct third-party imports outside canonical modules. (Explicit limitation: heuristic scanner flags known patterns; does not prove repository-wide absence of arbitrary clones).
   - **Tier 2 (Syntactic & AST Enforcement)**: Pinned TypeScript compiler and ESLint rules enforcing boundaries, domain vocabulary constants, and prohibited syntax across production code.
5. **Lightweight CI Preflight Job (`.github/workflows/preflight.yml`)**: Fast, least-privilege metadata validation without requiring database or Docker overhead.

## Consequences & Trade-offs

- **Benefits**: Early defect discovery, prevention of redundant implementations, clean DDD boundaries, consistent API contracts, auditable review decisions.
- **Costs**: Contributors must conduct explicit read-only preflights and document reuse decisions before modifying files.
- **Mitigation**: Scaled review depths prevent disproportionate overhead for bounded tasks. Templates and automated checkers guide compliance.

## Versioned plan integrity (current policy)

Plan snapshots under `docs/tasks/design-reviews/` preserve the selected architecture and implementation scope. For tasks requiring a snapshot, compute a SHA-256 digest over its **raw UTF-8 bytes**, record the same digest/path/revision in the task and PR, and verify task identity and revision against the content. A materially changed plan receives a new versioned snapshot and recomputed digest before implementing the change; **no owner attestation is required**. Never rewrite an existing approved snapshot in place, backdate decisions, or claim that a historical comment approved a new plan.

Task Reference and Design Snapshot must point to regular repository-relative Markdown files directly within their authorized `docs/tasks/active/` and `docs/tasks/design-reviews/` directories. Reject absolute paths, URL schemes, path traversal and symbolic links including intermediate components; check canonical paths. Ordinary verification logs and execution evidence belong in the mutable task/PR record and must not change the snapshot.

The former 2026-10-22 content-bound _approval attestation_ amendment has been superseded specifically with respect to authorized GitHub comments/reviews, timeline validation and owner approvals. Its file-provenance and raw-digest integrity requirements remain enforced. No alternative sign-off or approval service is introduced.
