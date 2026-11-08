# NEXORA-034 — Final review corrections F7–F9

## 1. Metadata

Task ID: NEXORA-034
Classification: SIGNIFICANT
Plan revision: rev-2026-11-03-sync-final-review-v2
Reviewed baseline: cf1353a276b1d45f94b6788f559488b715dd4022
Branch: feat/sync-worker-staging-v1; existing Draft PR32 only.
Documentation Impact: REQUIRED. ADR-009 requires a recorded plan, no owner approval.

## 2. Scope

Implement only owner-requested F7 ordering, F8 persisted Next Run and F9 history
presentation. Preserve F1–F6, queue/worker/fencing/outcomes/retries/watermarks,
Carrier hard delete, Auth/MFA and business rules. No migration/table/endpoint,
Provider/Domain implementation, dependency, UI layout/CSS/token change or framework.
Original and six-correction snapshots remain immutable historical evidence.

## 3. Read-only inspection

Clean branch fetch/ff-only pull and GitHub PR confirm baseline above. Inspected
SyncRepository.page duplicate normalization/locked identity facts/bulk writes and
PG fixtures; sourceOrder is an optional safe nonnegative number, missing maps to
SQL NULL. Inspected SyncSchedulePanel, displayTime, initialSchedule/scheduleDirty,
syncPresentation, HistoryTypeIcon/filter and canonical shared SyncType; existing
native component/hook/CDP harnesses. Queries searched sourceOrder/last_source_order,
nextRun/autoInterval/displayTime, HistoryTypeIcon/dataType and SyncType consumers.

## 4. Reuse audit

| Component   | Existing implementations                                                                 | Domain owner        | Alternatives                                  | Selected approach                                                                                                          | Rationale                                   | Risks                                                                 | Verification                                                        |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| F7 ordering | sync-job.repository.ts page; sync.port.ts NormalizedSource; sync-policy.ts               | Sync infrastructure | New ordering framework vs local checks        | Validate locked prior/incoming order before differs/bulk writes; retain maximum nonnull duplicate order for identical hash | Existing transaction rollback and bulk path | Ambiguous/equal/missing order, partial checkpoint, F1 physical writes | Real PG decision matrix, tuple snapshots, mixed batch and watermark |
| F8 Next Run | CarrierSyncPanels.tsx; presentation.ts displayTime; sync-presentation.ts initialSchedule | Carrier Web         | New state/timer vs saved projection           | Display existing nextRun only while saved enabled and row draft matches saved enabled/interval                             | Smallest truthful saved/draft distinction   | Invalid dates, partial saves/Cancel                                   | Actual panel render and Drawer/live closures, browser               |
| F9 history  | same panel; shared SyncType; sync-response.ts raw dataType                               | Carrier Web         | Shared registry vs local presentation mapping | Local canonical code/icon/label lookup; preserve legacy preview aliases only in presentation                               | No API/filter rewrite                       | Unknown types, preview and server pagination                          | Raw code/legacy/unknown icon-label, filter callbacks, page count    |

## 5. F7 policy

Unordered prior/incoming NULL continues Full Fetch + Hash Comparison. For a prior
nonnull order, a lower incoming order is stale and ignored. A different hash with
missing or equal incoming order is ambiguous: throw existing SOURCE_CONFLICT before
any page writes, with transaction rollback and unchanged checkpoint/watermark.
Equal/missing order plus same hash stays physically unchanged. Greater order with
same hash only advances metadata; greater order with changed hash advances payload
version. This rejects ambiguity even for coarse timestamps; it does not assert
that a provider timestamp uniquely identifies revisions. No production provider
contract is invented. Same-page differing hashes remain conflict; identical-hash
duplicates cannot discard the greatest observed nonnull order. Existing optional
number interface remains; adapters omit unavailable order, not a new null API.

## 6. F8/F9 presentation

Use existing Vietnam-time displayTime invalid-date fallback. Show dash when the row
draft differs from saved settings; never calculate a schedule from interval. A
confirmed reload/Cancel uses existing parent baseline reconciliation. Keep disabled
layout/controls and other drafts/tabs. F9 uses shared codes, Vietnamese labels and
Package/User icons; unknown retains Layers/raw text. Legacy Shipment/Customer
preview values remain presentation-compatible, never new transport values.

## 7. Ownership and contracts

Pure technical ordering correction, no new aggregate/domain write. Web stays
Prisma-free. No schema, generated OpenAPI/SDK, API status/error-envelope or new
record/job enum. SOURCE_CONFLICT uses current error/rollback/executor policy.

## 8. Security/concurrency/performance

Keep user→epoch→connection→job→source locks and lease/generation checks unchanged.
All page checks complete before existing parameterized bulk SQL; no per-record ORM
writes, external I/O, new locks or checkpoint bypass. Rejecting one ambiguous row
rejects the batch. Preserve source key/mapping/provenance and retention semantics.

## 9. Test-first

Add RED genuine PG cases for missing/equal changed hash, stale, valid newer,
unordered, same-hash tuples and mixed-batch rollback/checkpoint/watermark. Update
F1 changed fixture to use valid newer order only for its five changed rows while
preserving its exact physical-write assertions. Add RED native saved/draft/invalid
Next Run and canonical/legacy/unknown icon-label/filter/page tests. Extend current
lifecycle/CDP tests only; no new Python or second browser infrastructure.

## 10. Verification

Targeted PG plus all Sync regressions including F1/F2; requested existing Web
suites and new focused cases; canonical quality, genuine Docker integration and
final-head hosted Preflight/Sync targeted/Foundation with actual logs and checkout
lineage. No shared databases/user-volume reset, fake client or historical PASS.

## 11. Review and documentation

Three independent rounds: backend correctness; frontend/API integration; regression,
CI and scope. Fix related findings and retest. Update task, concise ADR ordering
clarification and testing facts; preserve FAIL history. Store no binary/raw logs in
Git. Commit grouped fixes and push existing branch without force/merge/deploy.

## 12. Handoff

F7/F8/F9 require actual regression evidence. Original task remains verification
pending while Live Provider/Domain is unavailable. Final self-referential head/CI
results may be reconciled in PR metadata after workflow completion.
