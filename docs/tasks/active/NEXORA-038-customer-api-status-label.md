# NEXORA-038 — Customer API status label presentation

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-038
Classification: BOUNDED
Plan revision: rev-2026-11-10-customer-api-status-label-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-038-rev-2026-11-10-customer-api-status-label-v1.md
Design SHA-256: b19e81f9b804b1014059c384fb5e5b695ba4ff5cd9d40e165562d4f7540c72e8
Reviewed baseline: dccbfee75c5d024d3973504c9c004e4f939799b9
Branch: refactor/customer-api-status-label

Read-only audit and the eight-field reuse matrix are recorded in the snapshot.
Fresh origin/main was fast-forwarded before creating the unused branch; task ID
was absent. Existing SSR dependency cache permits actual Detail rendering with
controlled accepted read data, without modifying the harness or production hook.
No owner approval gate. See snapshot for scope, risks and test-first sequence.

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

## Acceptance

- [ ] Required generated status/statusLabel props and direct response text.
- [ ] Three consumers updated; status tone/dot/classes and nine columns unchanged.
- [ ] Custom and empty API labels rendered in table and both Detail badges.
- [ ] Both response helpers retain required-string validation, including empty.
- [ ] Actual dropdown/statistics shared labels and codes unchanged.
- [ ] Only two production files change; no CSS/backend/contracts/SDK/DB changes.
- [ ] Canonical docs synchronized; targeted/full quality and independent review.
- [ ] Final-head hosted Preflight/Foundation, separate PR; no merge/deploy.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Badges display API statusLabel, while dropdown/statistics use shared labels. API
presenter still derives statusLabel from shared metadata; coordinated API/Web
revision deployment remains release responsibility outside this refactor.

### Canonical owners

- docs/domains/customers.md
- docs/architecture/reusable-components.md (actual consumer description only)

### Documentation verification

pnpm format:check, pnpm docs:check, pnpm preflight:check.

## Evidence

| Claim                         | Evidence                                                                                                                                                       | Date       | Result |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Fresh baseline targeted tests | node --test apps/web/test/customer-table.test.mjs apps/web/test/customer-ui-api.test.mjs apps/web/test/customer-status.test.mjs on dccbfee: 14/14 PASS, 0 skip | 2026-11-10 | PASS   |

Implementation, RED/GREEN, review and final-head CI evidence remain pending.
Detailed logs and any captures stay outside Git; no historical CI is reused.
