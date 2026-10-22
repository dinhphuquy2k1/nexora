---
name: implementation-code-review
description: Conducts post-implementation code review, auditing git diffs against approved designs, detecting duplicate patterns, checking boundary compliance, and issuing structured P1/P2/P3 findings.
---

# Implementation Code Review Skill

## Purpose & Scope

This skill performs rigorous post-implementation code review for Nexora, ensuring pull requests comply with approved designs, maintain tactical DDD boundaries, avoid unintended duplication, and preserve database transaction integrity per [ADR-008](../../../docs/decisions/tactical-ddd.md) and [ADR-009](../../../docs/decisions/mandatory-pre-code-design-review.md).

## Review Checklist

### 1. Approved Design Compliance

- Compare the active git diff (`git diff HEAD~1` or working tree) directly against the approved design review artifact.
- Flag any out-of-scope modifications or scope creep.
- Verify that intentionally preserved differences (non-goals) remained separate.

### 2. Duplication & Reuse Verification

- Check for newly introduced duplicate logic, especially:
  - Custom UUID regexes outside `apps/api/src/common/validation/uuid.ts`.
  - Custom lowercase hex64 regexes outside `apps/api/src/common/validation/hex.ts`.
  - Direct telephone parsing outside `apps/api/src/common/value-objects/phone-number.ts`.
  - Direct country code validation outside `apps/api/src/common/value-objects/country-code.ts`.
  - Hardcoded generic error strings outside `apps/api/src/common/http/error-messages.ts`.
- Consult [Reusable Components Registry](../../../docs/architecture/reusable-components.md).

### 3. Boundary & Layer Purity

- Verify dependency direction: Presentation → Application → Domain.
- Confirm Domain layer imports NO NestJS, Prisma, HTTP, or outward layers.
- Confirm Application layer imports NO Prisma or `@nexora/database`.
- Confirm Presentation controllers delegate to application ports/services and never touch database adapters directly.
- Verify that `packages/shared` contains only browser-safe, contract-level values without backend domain logic.

### 4. Transactions, Concurrency & Security

- Confirm that mutable state changes execute within an explicit PostgreSQL transaction.
- Check lock ordering: actor lock → parent/owner lock → child entities.
- Verify that no external network I/O or slow operations occur while holding database locks.
- Ensure all queries use parameterized inputs; no raw string interpolation in SQL.

### 5. Contract Drift & Schema Checks

- Run `pnpm contracts:check` to ensure OpenAPI specs and SDK clients match backend handlers.
- Verify that database schema changes include explicit Prisma migrations in `packages/database`.

### 6. Executed Evidence & Findings Classification

Evaluate verification evidence and report findings using strict priority levels:

- **P1 (Blocker)**: Invariant violation, security hazard, transaction deadlock risk, unhandled error regression, missing migration, or duplicate algorithm bypassing canonical common modules. Blocks merge.
- **P2 (Important)**: Incomplete error mapping, suboptimal query hydration, missing unit test edge cases, or documentation inconsistency. Must be resolved before task completion.
- **P3 (Advisory)**: Minor naming clarity or non-blocking simplification. Does not block merge.

Distinguish actual defects from stylistic preferences. Recommend merge readiness based solely on executed command evidence, never on static file presence.
