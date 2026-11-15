# NEXORA-053 — Shipment child snapshot bounds and batched writes

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-053
Classification: SIGNIFICANT
Plan revision: rev-2026-11-15-shipment-child-batch-limits-v1
Reviewed baseline: a18b19b5e9ea6ed528381293c8d9b53403304e69
Branch: fix/shipment-child-batch-limits
Design Snapshot: docs/tasks/design-reviews/NEXORA-053-rev-2026-11-15-shipment-child-batch-limits-v1.md
Design SHA-256: 62a213adf09f33fa7851ccfcde9b6e59e213400b4911afdc8f4755501876ba85

## Origin and requirements

Origin: issue #50, PR #49 review, prerequisite before any Shipment sync capability.
Implement owner-set D1–D6 only. Limit provider input to50 charges, initially500
items (approved measured fallback250 then100), and4 milestones. Validation remains
VALIDATION_ERROR→REJECTED_SOURCE. Hydrated lineNo representation remains32767.
Batch each nonempty present child snapshot with one parameterized INSERT SELECT
FROM unnest and existing conditional upsert, followed by existing excess deletion.
Empty clears; absent preserves. Preserve root/history/version-check ordering.

No API/DTO/SDK/UI, schema/migration/grants, Sync engine (LIMIT100, timeout15000,
lease/fence/retry), capability declarations or Uniship adapter changes.

## Read-only inspection and reuse audit

Read root AGENTS and routed AI rules/workflow, ADR009/010/011, shipments,
sync-extensions, database and testing. Inspect Shipment normalize/hydrate,
processor, binding, provider persistence, SyncRepository apply and policy,
Shipment unit/integration tests and Sync integration/extension fixtures. Searches:
32767, normalize, lineNo, IS DISTINCT FROM, unnest, xmin, rollback, LIMIT100,
timeout15000, query extensions and canonicalPayload. Existing Sync payload64KiB
limit remains independent and unchanged; timing payloads use compact valid fields.

| Field                    | Decision                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Provider snapshot validation and Shipment child persistence                                                                                                                                                                                               |
| Existing implementations | shipment.ts normalizers and hydrate value classes; shipment-sync.processor.ts validation mapping; shipment-sync-domain.binding.ts conditional per-row upserts; sync-job.repository.ts transaction/final fence; existing shipment/sync integration helpers |
| Domain owner             | Shipment Domain owns incoming limits; Shipment infrastructure owns SQL; Sync owns transaction/lifecycle                                                                                                                                                   |
| Reuse alternatives       | Reuse current conditional upsert/delete and supplied transaction; reject batch-only32767, delete/reinsert, engine timeout/LIMIT changes or a separate child transaction                                                                                   |
| Selected approach        | Named Domain constants only in provider normalization; three typed parallel-array unnest statements with current IS DISTINCT FROM payload columns and cleanup                                                                                             |
| Rationale                | Fixed child SQL count, stable row identity/no-op writes, unchanged atomicity and legacy hydration                                                                                                                                                         |
| Risks                    | Nullable array elements/types, numeric/timestamp casts, mixed-page rejection, unchanged-row writes, query growth and machine-dependent transaction latency                                                                                                |
| Verification             | RED/GREEN domain boundary/legacy hydration, real PostgreSQL fixed-query/row identity/xmin/null/empty/absent/rollback/mixed outcomes, full100-record first/changed/identical timing, pinned quality and final-head hosted gates                            |

## Domain modeling, interfaces and compatibility

Shipment remains Aggregate Root; charges/items/milestones are provider-owned
children under one aggregate transaction. Stable positional lineNo and milestone
code keys, DB UUID identity and exact numeric/date value validation remain.
Provider normalize and Aggregate commands reuse one validator. Hydration accepts
historical SMALLINT line numbers above incoming limits. No new commands/ports,
persistence schema or public response fields. Processor remains pure and maps
only deterministic validation to REJECTED_SOURCE; no new error code.

## Concurrency, security and query costs

Retain engine canonical owner/connection/job/source locks, final lease fencing,
processor-version checks and root lock. No HTTP under locks, no credential/PII
logging, no new grants. Each present nonempty collection costs2 write statements
(upsert+delete) independent of row count; empty costs1 delete; absent costs0.
Unchanged row payloads skip UPDATE via IS DISTINCT FROM, retaining ID and xmin.
Root timestamps and source outcome bookkeeping keep existing semantics.

## Test-first plan and acceptance

1. First commit closes052 under §1.7 with preserved failure/snapshot history.
2. Record this plan and immutable formatted snapshot before code/test changes.
3. RED domain exact/one-over bounds for all three collections and legacy
   high-lineNo hydration; processor deterministic rejection.
4. RED binding fixed write-query count; genuine PostgreSQL unchanged ID/xmin,
   one-middle-row update, typed nullable fields, empty/absent, mixed invalid/valid
   page and existing forced rollback regressions. Reuse test-owned isolated owner,
   connection and sources; shared fixture runs from Shipment and Sync integration,
   so existing Sync Targeted path and full Foundation execute these assertions.
5. Implement minimal constants and batch SQL; GREEN targeted unit/integration.
6. Time real SyncRepository.apply for one full page of100 shipments at exact50
   charge/500 item/4 milestone limits, first creation then all values changed and
   identical payload. Log SHIPMENT_CHILD_BATCH_TIMING JSON with durations/counts,
   PostgreSQL version and machine. Assert first apply≤7500ms; if above, reduce item
   limit500→250→100 and remeasure, retaining all failures. At100 failure STOP B.
   Identical input must cause no physical child writes. This approved ladder is
   part of v1; it does not require a replacement snapshot.
7. Update shipments/testing canonical docs, Uniship checklist point9 and issue50
   prerequisite resolution. Run requested unit/real integration/pinned checks,
   contracts/boundaries/quality and validatePrTaskBinding. Review full diff and
   execute the implementation-code-review checklist. Independent reviewer is
   unavailable in this thread; report that limitation and retain owner review.
8. Push PR with canonical five metadata fields and Closes #50, wait exact-head
   Preflight/Sync Targeted/Foundation4–10. Final green HEAD via gh api. No merge.

## Governance and error handling

Owner Rule A: repair task-added/modified tests/fixtures/helpers (including mistaken
assertions), task typos/type/lint/format, missing environment prerequisites and D4
fallback without stopping; retain each FAIL/correction. Unrelated Foundation5–10
failure permits one failed-job rerun only. Rule B: stop and ask for schema/API/DTO/
SDK/engine or snapshot changes outside D1–D6, failure at lowest item limit,
unexplained untouched existing test failure, repeated CI failure, Foundation4,
Preflight or Sync Targeted failure. State exact error, options and recommendation.
No merge or production activation. No unresolved PLAN ISSUE at this checkpoint.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Incoming child bounds, fixed-query batching and measured capacity prerequisite.

### Canonical owners

- docs/domains/shipments.md
- docs/operations/testing.md

### Documentation verification

- docs:check, preflight:check, test:docs and test:preflight.

## Evidence

| Claim                      | Evidence                                                                                                                                                                                                       | Date       | Result |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Initial task-doc structure | docs:check FAIL: missing Canonical owners/Documentation verification headings and duplicate Verification key in prose. Rule A correction adds prescribed headings in mutable task only; snapshot stays frozen. | 2026-11-15 | FAIL   |
