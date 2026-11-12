# NEXORA-038 — Customer API status label presentation

Task ID: NEXORA-038
Classification: BOUNDED
Plan revision: rev-2026-11-10-customer-api-status-label-v1
Reviewed baseline: dccbfee75c5d024d3973504c9c004e4f939799b9
Branch: refactor/customer-api-status-label

## Scope and selected design

CustomerBadge requires Summary["status"] and Summary["statusLabel"]. Render the
response label directly, including an empty string, without fallback or mapping.
Keep status-driven tone, dot and classes. Pass both properties at all three
consumers: list row, Detail header and Detail profile. Only CustomerTable.tsx and
CustomerDetailPage.tsx change in production. No CSS, validator, backend, DTO,
OpenAPI, generated SDK, shared vocabulary, database or reconciliation changes.

## Read-only inspection and reuse audit

Searched CustomerBadge, statusLabel and CustomerStatusLabelsVi across Customer
source, tests, backend presenter and canonical docs. Found exactly three badge
consumers. Response validators already require a string and allow empty strings.
API presenter derives labels from shared metadata; dropdown/statistics retain
shared metadata. This is presentation ownership, not a new Domain feature; no
Aggregate, VO or application service is appropriate under ADR-008.

| Field                    | Decision                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Existing CustomerBadge and its three consumers                                                                                                                                                           |
| Existing implementations | CustomerTable.tsx, CustomerDetailPage.tsx, response.ts, CustomerProfileFields.tsx, CustomerStatsBar.tsx; customer-table/customer-ui-api/customer-status tests; scripts/test-helpers/render-component.mjs |
| Domain owner             | Web presentation consumes API label; Customer Domain retains code invariants; API presenter owns response label                                                                                          |
| Reuse alternatives       | Pass generated response fields versus local remapping/fallback; reuse SSR loader cache versus new harness or production injection props                                                                  |
| Selected approach        | Required typed label prop, direct text; existing SSR loader with cached read-hook dependency for actual Detail rendering; real ToastProvider and actual badges                                           |
| Rationale                | Minimal production diff; distinguish API text from canonical labels; no duplicated label logic or framework                                                                                              |
| Risks                    | Missed Detail consumer, empty label fallback, changed tone, overclaiming SSR as browser behavior                                                                                                         |
| Verification             | RED/GREEN table and both Detail badges for both codes/custom and empty labels; malformed response cases; rendered dropdown/stats; existing full regression and hosted Foundation                         |

## Test-first and verification sequence

1. Record this immutable snapshot/digest and mutable task before test/code edits.
2. Baseline targeted three suites. Add failing custom-label row and actual Detail
   render assertions. Cache only the read hook to supply accepted data; preserve
   real React, CustomerDetailPage, CustomerBadge and UI. No harness expansion.
3. Add parser regression cases for missing/null/nonstring labels and valid empty
   strings to both read helpers. Actual render shared dropdown and statistics;
   preserve status code callbacks/commands. Existing tests stay intact.
4. Execute RED, implement two-file change, execute GREEN including nine-column,
   retained-row, loading and existing mutation/drawer regressions.
5. Update customers.md and only the inaccurate registry consumer description.
   Record presenter/shared-label ownership and revision-skew release boundary.
6. Run Web tests/typecheck, format/lint/docs/contracts/full quality. Genuine
   Docker/runtime/browser and final-head hosted Preflight/Foundation are required;
   host quality is not Docker evidence. Preserve failures/resource limitations.
7. Independent review if available; commit/push focused changes to one new Draft
   PR based on main. Reconcile final-head CI in PR metadata without self-SHA docs
   loops; no automatic merge, force push or deployment.

## Documentation Impact

Documentation Impact: REQUIRED

Canonical owners: docs/domains/customers.md and the actual label-consumer facts in
docs/architecture/reusable-components.md. No new release synchronization mechanism.
ADR-009 requires recorded scope, not owner approval. PLAN ISSUES: NONE.
