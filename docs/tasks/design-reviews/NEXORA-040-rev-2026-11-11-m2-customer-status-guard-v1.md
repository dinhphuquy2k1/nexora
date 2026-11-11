# NEXORA-040 — M2 Customer status guard design

Task ID: NEXORA-040
Classification: BOUNDED
Plan revision: rev-2026-11-11-m2-customer-status-guard-v1
Reviewed baseline: aea1c1abcacf0b05164a27bbf490cb67b99c471f
Branch: fix/m2-customer-status-guard

## Requirements and inspection

Centralize runtime Customer response status membership without changing codes,
transport, labels or UI behavior. Fresh clone has a clean tree; updated main equals
origin/main. M2 remains unimplemented at that baseline, including merged PR38.

Read AGENTS.md, apps/web/AGENTS.md, mandatory docs/ai entry-point route and
pre-implementation-review skill/template; ADR-008/009, architecture overview,
backend/frontend, API contract, design system, reusable registry, Customer domain,
testing/setup and active NEXORA-027/031/038 context. Search scope: apps and packages;
queries: CustomerStatus, CustomerStatusCode, isCustomerStatus, Object.values and
response validators. No existing shared predicate. Existing VO is domain-specific;
query/payload checks and other status vocabularies remain separate in this task.

## Reuse and ownership

| Field                    | Decision                                                                                                                                                                                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | isCustomerStatus runtime type guard and Customer response parsing                                                                                                                                                                                                                                                    |
| Existing implementations | packages/shared/src/customer-status.ts defines codes/type; index.ts exports them. apps/web/features/customers/response.ts explicitly compares codes. apps/api/src/customer/domain/customer-status.vo.ts validates through Object.values and throws CustomerError. Web query.ts/payload.ts validate their own inputs. |
| Domain owner             | Shared Customer code vocabulary; Web response boundary consumes it. API Domain retains VO and transition policy.                                                                                                                                                                                                     |
| Reuse alternatives       | Reuse Domain VO (rejected: app coupling and throwing behavior); keep comparisons (duplicates vocabulary); add shared pure membership guard (selected).                                                                                                                                                               |
| Selected approach        | Derive private ReadonlySet from Object.values(CustomerStatus), unknown-to-CustomerStatusCode predicate; export from existing root; replace only response.ts comparisons. Reuse Web node:test status suite for shared contract tests.                                                                                 |
| Rationale                | One allowed-value source, no dependencies, constant-time lookup, minimal behavior-preserving scope.                                                                                                                                                                                                                  |
| Risks                    | Export or narrowing regression, accidental coercion, lost statusLabel validation. No concurrency, schema or authorization changes.                                                                                                                                                                                   |
| Verification             | Ten required input cases, public ESM/CommonJS/browser exports, TypeScript narrowing, both parser paths and malformed field regression; existing table/Detail SSR tests, lint/typecheck/contracts/quality and canonical Docker quality.                                                                               |

## Compatibility and non-goals

Additive shared export only. Existing ACTIVE/INACTIVE codes/type, OpenAPI/SDK,
statusLabel required-string acceptance (including empty), API DTOs and badge
classes remain unchanged. No API imports into Web, infrastructure into shared,
new dependencies, enum, domain transition or generic UI helper. No database,
migration, Shipment, HTTPS, Pager/filter or unrelated UI work. No aggregate
modeling needed for this bounded stateless contract predicate. Membership does
not trim, coerce or normalize inputs; Set stays private.

## Test-first implementation and acceptance

1. Record plan/task and validate metadata before code/tests; lifecycle PLANNED.
2. IN PROGRESS: extend existing Web shared-status suite with guard cases through
   public root, CommonJS and browser contract; add narrowing to existing TS
   contract fixture. Add list/detail acceptance/rejection regressions preserving
   labels and remaining parser requirements. Run tests before guard (RED).
3. Add guard and root export; replace response comparisons only; rebuild shared
   and run targeted tests (GREEN), then existing Customer presentation tests.
4. Update reusable-components registry for new export/consumer. Run test:lint,
   quality and scripts/quality-docker.sh, record commands/results and limitations.
5. Review full diff against plan using implementation-code-review skill. Request
   independent review in new PR; never claim self-review as independent approval.
6. VERIFICATION PENDING until outstanding canonical/hosted gates and review are
   resolved; commit intended files, push fresh branch, create exactly one PR to
   main. Do not merge. COMPLETE only with mandatory evidence.

## Documentation impact and readiness

Documentation Impact: REQUIRED. Canonical owner:
docs/architecture/reusable-components.md (new guard export and response consumer).
Verification: pnpm docs:check, preflight:check and format:check. No other durable
architecture or business fact changes. Plan review completed 2026-11-11 before
code/tests; no owner approval required. PLAN ISSUES: NONE.
