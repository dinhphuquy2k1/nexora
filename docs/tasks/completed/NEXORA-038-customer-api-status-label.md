# NEXORA-038 — Customer API status label presentation

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

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

- [x] Required generated status/statusLabel props and direct response text.
- [x] Three consumers updated; status tone/dot/classes and nine columns unchanged.
- [x] Custom and empty API labels rendered in table and both Detail badges.
- [x] Both response helpers retain required-string validation, including empty.
- [x] Actual dropdown/statistics shared labels and codes unchanged.
- [x] Only two production files change; no CSS/backend/contracts/SDK/DB changes.
- [x] Canonical docs synchronized; targeted/full quality and independent review.
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

## Implementation checkpoint — 2026-11-10

Implementation commit: 6c475b63edc5b11c0184f293d6a234472e102770.
Final documentation commit and hosted merge-ref outcomes will be reconciled in PR
metadata without a self-referential SHA-only documentation commit loop.

| Claim                             | Evidence                                                                                                                                                                                                                                                              | Date       | Result |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Initial structural preflight      | pnpm preflight:check rejected missing inline reuse matrix; matrix added to mutable task, snapshot unchanged                                                                                                                                                           | 2026-11-10 | FAIL   |
| Corrected structural preflight    | pnpm preflight:check passed after inline matrix added                                                                                                                                                                                                                 | 2026-11-10 | PASS   |
| Test-first RED                    | Four targeted suites before production edits: 16 PASS / 5 FAIL, exactly table and four Detail API-label render assertions                                                                                                                                             | 2026-11-10 | FAIL   |
| Targeted GREEN                    | node --test apps/web/test/customer-table.test.mjs apps/web/test/customer-detail-status.test.mjs apps/web/test/customer-ui-api.test.mjs apps/web/test/customer-status.test.mjs: 21/21 PASS, 0 skip                                                                     | 2026-11-10 | PASS   |
| Frozen installation               | pnpm10.34.6 install --frozen-lockfile on Node24.19.0                                                                                                                                                                                                                  | 2026-11-10 | PASS   |
| Lint policy tests                 | pnpm test:lint: 52/52 PASS, 0 skip                                                                                                                                                                                                                                    | 2026-11-10 | PASS   |
| Full host quality                 | API_INTERNAL_URL=http://127.0.0.1:4000 pnpm quality: format/lint/boundaries/preflight/docs/typecheck/contracts/build PASS; 617/617 tests, 0 skip (132 root/186 API/261 Web/32 UI/6 DB); Turbo reports cached unchanged prerequisites, fresh Web build/typecheck/tests | 2026-11-10 | PASS   |
| Independent implementation review | Read-only reviewer inspected full diff and independently executed targeted suites: 21/21 PASS; no P1/P2/P3                                                                                                                                                            | 2026-11-10 | PASS   |
| Scope and snapshot integrity      | git diff --check; exactly two production TSX files; snapshot SHA256 unchanged b19e81f9…; no backend/validator/CSS/SDK/DB diff                                                                                                                                         | 2026-11-10 | PASS   |

Both actual Detail badges render through real React SSR, actual UI/ToastProvider,
mutation hook and CustomerBadge, with only accepted read data supplied through a
fresh existing loader cache per render. No helper expansion or dependencies.
SSR does not certify browser geometry, computed CSS or lifecycle behavior.

Local canonical Docker verification: NOT RUN; this host has about3GiB free against
the documented20GiB requirement. Hosted final-head Foundation must establish
fresh Docker/integration/runtime/TTY/browser/public HTTPS/data/development checks.
No public deployment or shared/production database is touched. Full host quality passed;
final-head hosted CI remains pending at this checkpoint. Detailed logs/captures stay
outside Git; no historical CI is reused and no screenshots were manually reviewed.

Execution checkpoint: 2026-11-10T07:31:34Z UTC; exact CI head/merge/run provenance
will be recorded in the PR once the runs finish.

## Closure — 2026-11-12

Delivered by PR #38. Remaining final-head hosted verification is covered by a descendant hosted run.

| Claim                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Date       | Result |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Merged to main         | PR #38, merge aea1c1abcacf0b05164a27bbf490cb67b99c471f, 2026-11-11                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-11-12 | PASS   |
| Descendant hosted gate | Foundation run [43246873727](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873727), job 131281781892, checkout merge 4682dd9f47d81a55a515be44ebca19a1afb8828d (main 3906f8243347fb7c697bf5f6949389c3a784a13d + c4caffe33768b14445863ba31d153e441633c8f8), which includes this task's merge: steps 4–10 PASS (Docker quality 640 ordinary + 133 PostgreSQL integration, M5, runtime/TTY/browser incl. Carrier six-viewport matrix, HTTPS/ingress/onboarding/restore, persistence, development) | 2026-11-12 | PASS   |
