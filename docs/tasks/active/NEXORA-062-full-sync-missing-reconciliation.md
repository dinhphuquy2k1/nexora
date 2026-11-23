# NEXORA-062 — FULL Missing Reconciliation & Shipment Visibility

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Scope

Atomic domain-bound missing/restore on qualified FULL scans, baseline bootstrap,
explicit mass-hide configuration, internal job summary and consistent API/UI reads.
Production registrations remain empty; no live activation/scheduling/hard deletion.

## Design Review & Reuse Decision

Task ID: NEXORA-062
Classification: SIGNIFICANT
Plan revision: rev-2026-11-23-reconciliation-v1
Reviewed baseline: 561d48762556ea2220b86fd83a843f6129b5e33d
Branch: feature/full-sync-missing-reconciliation
Design Snapshot: docs/tasks/design-reviews/NEXORA-062-rev-2026-11-23-reconciliation-v1.md
Design SHA-256: 39181f37d24732b327c319f9f5596ffcc3cce306cb3c7636d981e1caf112a63d

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

### Documentation verification

- pnpm docs:check/preflight:check; actual raw snapshot SHA and PR binding.

## Acceptance

- [ ] AC01–02 migration preservation/constraints.
- [ ] AC03–08 first/repeated missing, restore unchanged/rejected seen, no hard delete.
- [ ] AC09–14 technical skips, baseline/safety/zero anomaly/scope/reconnect.
- [ ] AC15–17 crash/reclaim/exactly-once/cleanup.
- [ ] AC18–20 list/search/stats/paging/detail/history and local data preservation.
- [ ] AC21–22 actual roles and1k/10k/100k query/atomicity evidence.
- [ ] AC23–25 regressions/docs/governance/CI and production hard-close.

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
