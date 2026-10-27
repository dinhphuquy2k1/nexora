# NEXORA-031 shared validation implementation amendment v1

Task ID: NEXORA-031
Plan revision: rev-2026-10-27-shared-validation-v1
Reviewed baseline: d9f8cbdec06fa264ecf35bf0ddae53452dc55beb
Classification: SIGNIFICANT
Documentation Impact: REQUIRED

## Scope and constraints

Reuse the existing @nexora/shared package to centralize pure BE/FE input validation without React, Next, Nest, database or phone parsing dependencies. Owner's final default pageSize is 20 on both sides, page 1, max size 100, max page and offset 2147483647. Preserve Customer business invariants, E.164 verification on the API backend, current route/filter error semantics and mutable request safety. No new date utility without consumers. No database migrations or third-party dependencies.

## Reuse and design audit (eight fields)

| Component | Existing implementations | Domain owner | Reuse alternatives | Selected approach | Rationale | Risks | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Positive decimal page/offset | apps/api/src/customer/application/customer.input.ts; apps/web/features/customers/query.ts | Shared technical | Copy; Web-only; shared | packages/shared/src/validation/pagination.ts | One canonical syntax, safe integer and overflow | Incorrect defaults and error mapping | Shared unit, Customer HTTP and UI tests |
| Trimmed bounded text | apps/api/src/customer/domain/customer.value-objects.ts; apps/web/features/customers/payload.ts | Shared technical primitive, Customer bounds owned by Customer | Duplicate; shared | packages/shared/src/validation/text.ts and customer-limits.ts | Reuse with unchanged domain policy | Raw phone whitespace and optional semantics | Boundary cases, domain and feature tests |
| Phone E.164 | apps/api/src/common/value-objects/phone-number.ts | Backend common VO | Browser phone metadata; backend authority | Keep backend VO; shared only raw input rules | No heavy browser metadata, authoritative phone normalization | FE may accept invalid phone until server response | API integration and raw input tests |
| Customer status/address rules | apps/api/src/customer/domain; apps/web/features/customers | Customer domain | Promote all; retain domain | Retain domain/feature checks | Domain ownership and invariants | Cross-layer coupling | Existing Customer domain and browser tests |

## Contracts and migration

Expose pure parsing results without transport-specific exceptions. Both application boundaries map invalid results to existing INVALID_FILTER/VALIDATION_ERROR contracts. BE defaults to pageSize 20 (unchanged), while UI changes from 10 to 20 as instructed. OpenAPI continues to describe default 20 and max 100; generated SDK response types unchanged. `CustomerInputLimits` holds Customer transport field bounds and may be imported by both boundaries. Historical NEXORA-031 Design System M2 v3 snapshot remains unchanged and applicable for UI/design decisions; this amendment changes only validation and list default.

## Verification and rollback

Execute pinned formatting, typecheck, lint, shared validation unit tests, all Customer feature/backend/integration tests, docs/contract checks, canonical Docker quality and runtime workflow. Verify 0, -1, decimals, leading zeros, overflow, duplicated keys, raw phone length before trimming, nullable/optional fields, and E.164 backend authority. Roll back this scoped validation amendment independently if tests regress. No owner approval/comment is required under Plan-first ADR-009; independent review follows testing.
