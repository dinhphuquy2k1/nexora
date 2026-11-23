# NEXORA-062 — FULL Missing Reconciliation & Shipment Visibility

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

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
- [ ] AC23–25 regressions/docs/governance/CI and production hard-close (local gates PASS; hosted final-HEAD CI pending).

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
