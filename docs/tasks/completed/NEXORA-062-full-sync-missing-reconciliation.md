# NEXORA-062 — FULL Missing Reconciliation & Shipment Visibility

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

## Scope

Atomic domain-bound missing/restore on qualified FULL scans, baseline bootstrap,
explicit mass-hide configuration, internal job summary and consistent API/UI reads.
Production registrations remain empty; no live activation/scheduling/hard deletion.

## Design Review & Reuse Decision

Task ID: NEXORA-062
Classification: SIGNIFICANT
Plan revision: rev-2026-11-23-reconciliation-v3
Reviewed baseline: 561d48762556ea2220b86fd83a843f6129b5e33d
Branch: feature/full-sync-missing-reconciliation
Design Snapshot: docs/tasks/design-reviews/NEXORA-062-rev-2026-11-23-reconciliation-v3.md
Design SHA-256: 00d2cbf3f02c5d7285be9f78dce08189dc9fd1c6ac70be2a23ba262a7e428b4f

Frozen snapshot records the12-section scoped inspection, eight-field reuse matrix,
DDD/ownership preflight, atomic/resumable alternatives, eligibility/baseline/safety,
locks/retry, schema/grants/API/UI and RED/GREEN/real-PG/performance strategy.
Implementation reuses Sync's existing fenced transaction and optional domain binding,
Shipment pure policy/set-based persistence and current reads/refresh; no second engine.

| Field                    | Decision                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Domain-bound atomic reconciliation, visibility reads and durable job outcome                                                                        |
| Existing implementations | SyncRepository.apply/fence/assertLease, SyncDomainBinding, scanScopeFingerprint, Shipment binding/adapter, provision-runtime and signed PG fixtures |
| Domain owner             | Shipment owns lifecycle/safety; Sync owns fenced orchestration; infrastructure owns scoped SQL                                                      |
| Reuse alternatives       | Existing transaction hook versus parallel engine/resumable state machine; set-based policy versus full aggregate hydration                          |
| Selected approach        | Optional domain finalizer, pure Shipment policy, existing scoped source identities/seen arrays, shared read base                                    |
| Rationale                | Atomic exactly-once completion, no N+1/partial visibility, preserved domain/local data                                                              |
| Risks                    | Lease expiry/rollback, baseline poisoning, scope transition, mass-hide/overflow, stale UI cache and grants                                          |
| Verification             | RED/GREEN, signed genuine PG/migrations/parity/races/API/UI,1k/10k/100k plans, quality and final-HEAD CI                                            |

## BOUNDED final-review correction plan —2026-11-24

Recorded before corrective source/tests; reviewed HEAD aa743e2d9d5cc8649a5859b705a1b609dc01b1ea,
PR61 OPEN, branch feature/full-sync-missing-reconciliation. Overall classification
SIGNIFICANT remains; these corrections are BOUNDED within v3 section9 minimal
existing refresh plumbing/read contract. No material design change or new snapshot;
v1–v3 bytes/digests remain immutable. Owner accepts initial eventual consistency;
all v3 reconciliation/safety/thresholds stay unchanged.058 prerequisites remain.

Read-only inspection: RetailPackageListPage toolbar disabled despite error retry
refresh/detailRevision; RetailPagination can render81–78; useRetailQuery boolean
means reset, object replace uses replaceState. useShipmentRead binds ready data to
query/API/session; unsupported query is idle. Search draft/debounce must gate recovery.
Search scope: these components, useShipmentRead/useRetailQuery/query/presentation,
Retail hook tests, retail-entry/createRetailFixtureApi, existing CDP/loading checks,
AI governance/ADR009, Web AGENTS/Next local navigation guides, Shipment/Sync/Testing,
058/062 and frozen v3/evidence. No unresolved PLAN ISSUE.

| Field                    | Refresh                                                                                                       | Pagination and verification                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Toolbar/retry local handler                                                                                   | Current-response page recovery and safe range                                                                                                     |
| Existing implementations | apps/web/features/retail-packages/RetailPackageListPage.tsx detailRevision; useShipmentRead.ts refresh/fences | useRetailQuery.ts change object replace; RetailPagination.tsx Pager; scripts/retail-browser-checks.mjs; apps/web/test/fixtures/retail-entry.tsx   |
| Domain owner             | Retail presentation; Shipment remains read-only                                                               | Retail presentation and test-owned synthetic fixture                                                                                              |
| Reuse alternatives       | Existing handler versus reload/new cache                                                                      | Existing change/Pager/CDP versus global hook/framework                                                                                            |
| Selected approach        | Shared callback calls refresh and increments detailRevision; valid nonloading toolbar                         | Ready current response totalPages only; skip uncommitted search; replace page while preserving query; unavailable range while out-of-range        |
| Rationale                | Smallest correction, existing lifecycle and drawer key                                                        | Correct rows/navigation without fake page range or global abstraction                                                                             |
| Risks                    | Same-key stale retention, session/API replacement, unsupported query                                          | Stale totals, navigation loop, debounce and history regression                                                                                    |
| Verification             | Real toolbar click/keyboard, rows/stats/total/detail404/retry plus existing hook fencing                      | RED/GREEN5→4/1/empty, valid/loading/error/stale states, replace/preserve/back/forward/debounce in existing browser harness; quality/exact-HEAD CI |

Order: add behavioral regressions and run RED; wire shared refresh; add guarded
recovery/safe range; run GREEN/browser acceptance; update Shipment/Testing/task/evidence;
quality and available owned integration/Docker; independent review; commit/push PR61,
inspect exact final HEAD checks and update five metadata fields via gh API. No merge,
provider SyncJob/live requests/backend/schema/grants/contracts/dependency/workflow edits.

## Plan

1. Verify main/PR60/taskID and close061 in first commit; freeze formatted plan/SHA.
2. RED pure policy and schema/visibility/finalization tests; add forward migration,
   minimum summary constants, scoped runtime grants and optional domain finalizer.
3. Shipment decision/projection/anti-join/restore and atomic finalization/summary/
   final lease/SUCCEEDED/cleanup. No changes on skipped/failed/cancelled jobs.
4. Default read visibility,404 detail/history, Retail cache/revalidation regressions.
5. Real PG migration/parity/roles/failure/races/isolation/preservation/API tests,
   actual1k/10k/100k plans/duration/zero-write invariant before accepting atomic model.
6. Canonical docs, quality/available Docker/signed suites, independent review,
   PR five metadata fields and exact-final-HEAD hosted gates; no merge/live.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Shipment hidden/streak lifecycle, baseline/safety/scope and job summary.
- Atomic finalization ordering, scoped column grants and default read visibility.
- UI revalidation contract, migrated/role/concurrency/performance verification.
- Final review: enabled toolbar/retry list/stats/open-detail refresh, current-response
  pagination recovery using replace and safe transient range; regression/CI provenance.

### Canonical owners

- docs/architecture/database.md
- docs/architecture/sync-extensions.md
- docs/domains/shipments.md
- docs/integrations/uniship-portal-api.md
- docs/operations/testing.md
- docs/decisions/shipment-domain-data-ownership.md
- docs/decisions/sync-worker-staging.md

### Documentation verification

- pnpm docs:check/preflight:check; actual raw snapshot SHA and PR binding.

## Acceptance

- [x] AC01–02 migration preservation/constraints.
- [x] AC03–08 first/repeated missing, restore unchanged/rejected seen, no hard delete.
- [x] AC09–14 technical skips, baseline/safety/zero anomaly/scope/reconnect.
- [x] AC15–17 crash/reclaim/exactly-once/cleanup.
- [x] AC18–20 list/search/stats/paging/detail/history and local data preservation.
- [x] AC21–22 actual roles and1k/10k/100k query/atomicity evidence.
- [x] AC23–25 regressions/docs/governance/CI and production hard-close; verified hosted source fefb596, with external activation retained by058.

## PLAN ISSUES

Production thresholds and real upstream guarantees remain unverified under058;
missing config fails POLICY_NOT_CONFIGURED. Scope transition with hidden candidates
fails SCOPE_MISMATCH pending explicit future migration policy. These are fail-closed
operational limits, not permission to enable production or fabricate thresholds.
Atomic100k within15s needs executed evidence; revise snapshot before any material
fallback design. No blocking owner decision prevents the fixture-backed implementation.

## Evidence

| Claim                   | Evidence                                                                                                                                                                                                                                                                        | Date       | Result |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and plan-first | Clean workspace7fd33e9; git fetch main561d48762556ea2220b86fd83a843f6129b5e33d; gh API PR60 merged at2026-11-23T01:19:42Z;062 absent. Recorded scoped snapshot formatted then raw SHA39181f37d24732b327c319f9f5596ffcc3cce306cb3c7636d981e1caf112a63d before code/tests/schema. | 2026-11-23 | PASS   |

## Review delta v2 — admitted capability provenance

Independent P2 confirmed:061 in-flight jobs with retained arrays can enter the new
finalizer and bootstrap unless their admission is distinguished. Frozen formatted
v2 adds nullable positive reconciliation_version (no historical backfill), declared
finalizationVersion separate from processor version, admission stamping, exact
eligibility/baseline match and CAPABILITY_NOT_ADMITTED skip. This closes the gap
without a per-Shipment provenance field or operational threshold assumption.

## Review delta v3 — query membership provenance

Independent P2 repro: wide3→narrow2 with hidden0 bootstraps then falsely hides the
third row. Source account/scheme does not prove membership in a changed query.
Freeze v3 before fixing: ANY changed admitted fingerprint skips SCOPE_MISMATCH until
an explicit separately designed migration/repair policy, even with hidden0. Preserve
baseline and visibility through repeated narrow/wide scans. No automatic reset.
Benchmark adds99999 missing/100000 restore under synthetic permissive configuration,
with unchanged15s transaction limit. V1/v2 remain immutable historical designs.

## Implementation and local verification checkpoint

[Executed evidence and curated SQL plans](../evidence/NEXORA-062/implementation-verification.md).
Pure policy2/2 and Retail148/148 PASS. Signed dedicated PG47/47 and existing
Shipment HTTP/Uniship/Sync96/96 PASS; actual roles, all-child/local preservation,
source-scope and admission safeguards, rollback/races and29 performance scenarios.
Atomic99999 hide/100000 restore pass under unchanged15s timeout; no new index or
resumable state machine. Migration legacy061→062/default/null/repeat/drift PASS
following old-schema seed adaptation confirmed byP2022 diagnostic. Quality877/877,
contracts/typecheck/build/governance PASS. Full API and exact-final-HEAD hosted gates
are separate pending checks, not inferred from targeted or earlier task runs.

| Claim                                                   | Evidence                                                                                                                                                                                              | Date       | Result |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Genuine safety/read/security/performance targeted gates | Dedicated signed PG47/47, existing HTTP/Uniship/Sync96/96, policy2/2, Retail148/148 PASS;29 measured scenarios incl99999 hide/100000 restore and actual API lock wait; curated evidence linked above. | 2026-11-23 | PASS   |
| Quality and staged migration                            | pnpm10.34.6 quality877/877 and contracts/typecheck/build PASS; test:docs10/test:preflight24/test:lint56; full legacy→061→062 preserve/default/null/repeat/drift PASS after old-schema raw seed fix.   | 2026-11-23 | PASS   |

## Full local acceptance checkpoint

Final working-tree genuine signed full API integration227/227 PASS,0 skipped,
258149.10042ms. Quality877/877 and migration preservation/repeat/drift PASS. P3 reason
precedence now matches v3 for changed scope plus empty result, with unit and genuine
PG regressions included in this full run. All safety-critical local AC verified;
independent final review and new-HEAD hosted Preflight/Sync/Foundation remain separate
delivery gates. Local canonical Docker is NOT RUN (VFS/missing image/524MiB), with
canonical hosted execution required. No merge/live activation/user-volume reset.

| Claim                           | Evidence                                                                                                                                                                                            | Date       | Result |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Full local final implementation | Signed task-owned PostgreSQL pnpm test:integration227/227,0 skipped258149.10042ms; quality877/877 including final UI/manual refresh and scope+empty tests; staged/repeat/drift and governance PASS. | 2026-11-23 | PASS   |

## Hosted fixture correction checkpoint

Code30547d4 /mergee5bae815: Preflight45101495037 and signed Sync45101495036 PASS;
Foundation45101495093 attempt1 FAIL in new unsigned benchmark at step4. Ambient DB
URL targeted base DB rather than owned UUID fixture DB, so absent owner correctly
returned UNAUTHORIZED. Independent diagnosis confirmed; unsigned local RED→GREEN
45/45 after required owned readUrl; signed recheck follows. No product assertion,
timeout, authorization or Foundation step is weakened. Extend targeted paths/units
for future policy-only edits; local/independent34/34 and YAML/format PASS. Preserve
original FAIL and require fresh-head canonical CI before readiness.

| Claim                                      | Evidence                                                                                                                                                                                                           | Date       | Result |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Initial hosted unsigned fixture failure    | Source30547d40ac58c6fadb8804849390f68df014a834; mergee5bae81515c309c615cd7d10458e528e6fcabdef; Foundation45101495093/job137453148278 attempt1 step4 new concurrent-read benchmark UNAUTHORIZED; steps5–10 not run. | 2026-11-23 | FAIL   |
| Owned DB correction and context separation | Unsigned local RED45/43PASS/2FAIL, required owned readUrl fix GREEN45/45,0 skipped78894.977609ms. Existing assertions unchanged, restricted-role evidence remains signed-only; independent review confirms cause.  | 2026-11-23 | PASS   |

Corrected fixture acceptance: unsigned45/45 and signed47/47 PASS,0 skipped,
78894.977609/85498.858689ms. Production source/schema/grants unchanged from30547d4;
only verification-context plumbing/workflow paths and curated evidence change.
The first FAIL remains historical. Fresh new-HEAD Preflight/Sync/Foundation required.

## Final review correction checkpoint —2026-11-24

FIX01/02 implemented in uncommitted working tree; FIX03 canonical Shipment/Testing,
correction plan and evidence updated. Shared refresh callback, current-ready
pagination.totalPages replacement, safe transient range; no reconciliation changes.
Immutable v3 and earlier hashes match. Independent code review no P1/P2/P3 findings.

| Claim                                | Evidence                                                                                                                                                                                                                                                                         | Date       | Result |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Bounded correction verification      | [Implementation evidence](../evidence/NEXORA-062/implementation-verification.md#bounded-final-review-correction-2026-11-24-stop-b): actual RED/GREEN,891 quality tests, docs10/preflight24/lint56 and full Retail Chromium PASS; source aa743e2 plus uncommitted correction tree | 2026-11-24 | PASS   |
| Existing integration failure —STOP B | Signed owned PostgreSQL pnpm test:integration226/227 PASS, existing identity-concurrency.test.cjs FAIL; cause unknown, no rerun/fix/commit/push/new CI or PR metadata update. Task-owned container/private state cleaned; owner decision required before continuing              | 2026-11-24 | FAIL   |

Status remains VERIFICATION PENDING / PARTIALLY VERIFIED; no task closure or merge.
Reviewed-head historical three workflows PASS; they do not verify new corrections.

## Bounded investigation checkpoint —2026-11-24

Owner-authorized one targeted execution and one clean-baseline comparison consumed.
Working tree targeted FAIL3948.909012ms; separately built aa743e2 baseline FAIL
3215.93201ms, same generic signature. Full subsequent suite NOT RUN per decision
branch. Confirmed local prerequisite omission: STORAGE_ROOT absent and read-only
loadConfig validation rejects it. This was missed in initial readiness checks;
exact observed failure stage/direct cause remains UNKNOWN. No environment-corrected
retry or Identity fix is claimed. [Evidence](../evidence/NEXORA-062/implementation-verification.md#owner-authorized-bounded-integration-investigation-2026-11-24)
retains command/source/build isolation/resource/cleanup details and historical FAILs.

| Claim                                     | Evidence                                                                                                                                                                                                                                     | Date       | Result |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Targeted and clean baseline investigation | Existing signed owned PostgreSQL wrapper, unchanged tests/limits; each1test0PASS1FAIL0skip,exit1; failure observed outside corrective Web diff, root cause UNKNOWN, required local STORAGE_ROOT missing                                      | 2026-11-24 | FAIL   |
| Scope and infrastructure preservation     | Three Retail fixes retained; Identity/test assertions/reconciliation/schema/grants/contracts/dependencies/workflows unchanged; only task PostgreSQL/private state and separate baseline cleaned. No new commit/push/CI/live activation/merge | 2026-11-24 | PASS   |

Status remains VERIFICATION PENDING / PARTIALLY VERIFIED. Delivery NOT READY;
owner decision required to authorize any further environment-corrected execution.

## Controlled verification supersedes STOP checkpoint —2026-11-24

Owner granted one additional targeted run with complete task-owned STORAGE_ROOT,
then one full signed suite only after targeted PASS. Both now PASS: Identity1/1,
full integration227/227,0 skipped, unchanged assertions/timeouts/backend. API/Sync
configuration and actual disposable storage readiness validated before test.
[Controlled evidence](../evidence/NEXORA-062/implementation-verification.md#storage-root-controlled-verification-2026-11-24-delivery-resumed)
retains exact commands/durations/environment/timestamps and all historical FAILs.
Missing prerequisite is confirmed; subsequent PASS supports the hypothesis without
claiming absolute causal proof or an Identity implementation fix. Owned cleanup done.

| Claim                              | Evidence                                                                                                                                                                    | Date       | Result |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Controlled Identity and full suite | Targeted1/1 PASS,3224.174957ms total, then full signed227/227 PASS,260642.545202ms,0 skipped; source aa743e2 plus preserved bounded corrective diff,2026-11-24T09:05–09:10Z | 2026-11-24 | PASS   |

Delivery resumes within existing three-FIX scope. Final quality/local documentation
checks and exact-final-HEAD Preflight/Sync/Foundation remain gates. Final hosted CI
provenance is appended to PR description, avoiding evidence-only commit loops.
Task stays active VERIFICATION PENDING / PARTIALLY VERIFIED at this pre-publication
checkpoint; final CI results belong to PR61's exact-source checkpoint. No merge/live.

### Final local quality checkpoint —2026-11-24

| Claim                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                               | Date       | Result |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Final corrected source/docs quality | API_INTERNAL_URL=http://127.0.0.1:4000 pnpm quality exit0 after controlled integration evidence update: format/lint/boundaries/preflight/docs/typecheck/contracts/build and891 tests,0 skipped (scripts182/API278/Web386/shared2/UI37/database6). pnpm test:docs10/10,test:preflight24/24,test:lint56/56 PASS. Source aa743e2 plus bounded correction working tree; final CI provenance will bind published commit in PR61 description | 2026-11-24 | PASS   |

This evidence-only checkpoint addition receives final formatting/docs/preflight checks
before commit; no source or test change follows the successful quality run.

## Post-merge closure —NEXORA-058 first commit

Closed under TASK_WORKFLOW §1.7 after PR61 merged2026-11-24T09:48:23Z
(16:48:23 Asia/Ho_Chi_Minh), merge SHA5edbcfe1609562f9eb5b6c156cf5cec68b5b71fa.
Verified source fefb596510d667e58e8abbc09721188aa9f8c2c5, CI merge checkout
35926ac1fe9e6a68a9f2f65ff07e6624f04d3b3b. Actual final-head Preflight45363231656
job138338284968,Sync45363231695 job138338284555,Foundation45363231555
job138338284771 all attempt1 PASS; Foundation steps4–10/upload11–16/cleanup19
PASS, failure-only diagnostics17/18 SKIPPED. Local controlled Identity1/1 and signed
integration227/227,quality891 tests PASS; historical failures remain untouched.
External authorization/custody/live consistency/timezone/thresholds/host gates remain
NOT RUN under active058, not silently closed by technical fixture verification.

| Claim              | Evidence                                                                                                                                                                  | Date       | Result |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Post-merge closure | PR61 merged5edbcfe at2026-11-24T09:48:23Z; exact source/merge/run/job/attempt above and PR61 Final green HEAD verified by gh API; remaining external gates retained in058 | 2026-11-24 | PASS   |
