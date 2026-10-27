---
applyTo: "apps/api/src/**/*.ts"
---

# Backend TypeScript Instructions

When editing API production TypeScript files:

1. **Pre-Code Governance**: Verify that the task has a recorded pre-implementation review and reuse matrix (no owner approval required) ([ADR-009](../../docs/decisions/mandatory-pre-code-design-review.md)).
2. **Canonical Reusable Primitives**: Always reuse canonical primitives in `apps/api/src/common/` instead of duplicating validation logic:
   - UUID validation: `isUuid` from `apps/api/src/common/validation/uuid.ts`
   - Lowercase 64-char hex format: `isLowercaseHex64` from `apps/api/src/common/validation/hex.ts`
   - Phone parsing & normalization: `PhoneNumber` from `apps/api/src/common/value-objects/phone-number.ts`
   - Country code validation: `CountryCode` from `apps/api/src/common/value-objects/country-code.ts`
   - Generic safe error message: `GENERIC_ERROR_MESSAGE` from `apps/api/src/common/http/error-messages.ts`
   - Consult [`docs/architecture/reusable-components.md`](../../docs/architecture/reusable-components.md).
3. **Tactical DDD Boundaries**:
   - Domain layer must be pure: zero NestJS, Prisma, HTTP, or outward layer imports.
   - Application layer orchestrates commands and ports: zero Prisma imports.
   - Controllers delegate to application services and never access database adapters or Prisma directly.
4. **Database & Transaction Isolation**:
   - Only infrastructure adapters import `@nexora/database` and execute Prisma queries.
   - Hydrate mutable aggregates only within active transactions under explicit row locks (`SELECT ... FOR UPDATE`).
   - Never perform network I/O while holding database locks.
5. **Canonical Authority**: Do not create conflicting copies of rules. Canonical governance remains in `docs/ai/` and `docs/decisions/`.
