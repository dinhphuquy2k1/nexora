# NEXORA-062 — FULL missing reconciliation and Shipment visibility

## 1. Metadata and classification

Task ID: NEXORA-062
Classification: SIGNIFICANT
Plan revision: rev-2026-11-23-reconciliation-v3
Reviewed baseline: 561d48762556ea2220b86fd83a843f6129b5e33d
Branch: feature/full-sync-missing-reconciliation
Documentation Impact: REQUIRED

Original workspace7fd33e9 was clean. PR60 merged2026-11-23T01:19:42Z at baseline;
origin/main verified before branching,062 unused. First commit closes061 under §1.7,
retains immutable evidence/snapshots and058 PLANNED live/authorization gates.

## 2. Requirements and explicit boundaries

Qualified FULL scans bootstrap a baseline, then atomically hide absent sources and
restore seen sources, including unchanged/rejected business payloads. Hidden state
is independent of logistics stage/provider status/SoftDeleted. No hard deletion,
child replacement, source deletion, local ownership change, provider HTTP/mapping/
processor1/timezone change, generic engine rewrite, new worker, live registration,
production thresholds, schedules or merge. Existing observation integrity remains
technical consistency only, not upstream snapshot isolation/deletion proof.

## 3. Canonical owners and inspection

Read AGENTS→AI routed context/rules/task/workflow/router, ADR008/009/010/011/007,
Backend/Database/Sync/Shipment/Uniship/Testing and UI design/reuse rules;058/060/061
records and061 immutable snapshots. Searches: finalize, apply, fullScan, fence,
assertLease, seenPages, summary, retention, source_identity_id, shipment grants,
list base/get/history, refresh, denied/notFound, query/session epoch. Inspected
actual repository/binding/registry/port/executor, aggregate/persistence/read adapter,
service/controller, schema/provisioner, Retail read hooks/dialog and native fixtures.
Existing apply owns15s transaction; reads lock actor exclusively, worker uses shared
actor→epoch→connection→job then source/root facts. No completion signal exists in
Retail: retain manual refresh and explicit detail revalidation, no invented push.

## 4. Reuse audit

| Field                    | Technical finalization                                                                                     | Shipment visibility                                                                                                                               | API/UI and verification                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Component                | Optional domain binding finalizer and scalar job outcome                                                   | Pure Shipment policy and scoped set-based persistence                                                                                             | Existing read predicates and revalidation                                                                 |
| Existing implementations | sync-domain.binding.ts; sync-job.repository.ts apply/fence/assertLease; sync-scan-observation.ts; registry | shipment-sync-domain.binding.ts; ShipmentAggregate ownership; shipment-provider.persistence.ts; source identity unique index, uq_shipments_source | shipment.adapter.ts list base/get/history; useShipmentRead.ts; migration.mjs; signed role/schema fixtures |
| Owner                    | Sync owns lifecycle, trusted technical facts and job summary                                               | Shipment owns visibility/safety; infrastructure owns SQL/locks                                                                                    | Shipment read adapter, Retail hook and existing runners                                                   |
| Alternatives             | Existing transaction hook vs new engine/resumable workflow                                                 | Set-based projection/policy vs hydrate100k aggregates                                                                                             | Shared base predicate and existing hooks vs new endpoints/polling/cache                                   |
| Selected                 | Optional infrastructure-only finalize hook before SUCCEEDED/cleanup                                        | Domain pure decision; count scoped facts then targeted UPDATEs only                                                                               | Default hidden exclusion, retained data cleared on NOT_FOUND, existing refresh                            |
| Rationale                | Exactly-once transaction and no extra state machine                                                        | Preserve identity/children; no N+1 or unnecessary ACTIVE writes                                                                                   | Existing contracts/error/authorization/DS remain                                                          |
| Risks                    | Lease loss after hook, rollback, cleanup ordering                                                          | Scope transition, baseline poisoning, anomaly/overflow, row locks                                                                                 | Cached detail/stats leakage, restricted credentials, missing discovery                                    |
| Verification             | Failure injection, takeover/replay/concurrent finalizers                                                   | Synthetic policies, scope isolation/reconnect/unchanged/rejected,1k/10k/100k plans                                                                | Genuine migrated API/roles, UI revalidation, approved signed suites, final-HEAD CI                        |

## 5. Alternatives and performance decision

Prefer atomic set-based finalization within the existing15s transaction. Compare
checkpointed/resumable finalization: it adds persistent state, publication barriers
and crash cleanup; simple batches exposing partial visibility are rejected. Benchmark
actual candidates/anti-join/restore/UPDATE/finalization and concurrent API reads at
1k/10k/100k before acceptance. If atomic correctness or latency cannot be verified,
keep policy disabled, record blocker and revise snapshot before architecture change;
never silently raise timeout or publish partial state. No speculative index.

## 6. Domain model and authority

Shipment owns derived ACTIVE(hidden NULL,streak0), SUSPECTED(hidden,1), CONFIRMED
(hidden,>=2). A pure Shipment visibility/safety policy governs transitions and overflow.
Set-based operation explicitly omits full aggregate hydration: only two visibility
columns participate, no child/local/provider facts are written. Existing aggregate
operations preserve these columns, and synchronization never accepts them from wire.
Timestamp of first missing stays stable; streak increments once per qualified job,
restores reset both. At int32 maximum skip the whole reconciliation with
STREAK_LIMIT_REACHED rather than overflow or falsely increment. Leave updated_at
and last_synced_at unchanged: dedicated hidden timestamp records visibility event,
no provider observation/stage/history is fabricated. No new generic deleted_at.

## 7. Eligibility, baseline and safety

Sync supplies current fenced final APPLYING job with terminal items, scan contract,
VALIDATED status and fingerprint compatibility. Optional domain hook returns durable
APPLIED/BASELINE_ESTABLISHED/SKIPPED with nullable reason and nonnegative counts;
no applicable hook leaves legacy summary NULL. Shipment additionally requires exact
Uniship/SHIPMENT/FULL, a declared100-row uniship-parcel-v1 scan and explicit immutable
policy configuration. Missing/invalid configuration is POLICY_NOT_CONFIGURED, never
production defaults. Test configuration is synthetic, not owner-approved production.

Baseline is latest SUCCEEDED job for owner/provider/account/type with reconciliation
BASELINE_ESTABLISHED or APPLIED and VALIDATED scan. Exclude legacy061 NULL outcomes,
skips/failed/cancelled and current job. Use latest successful reconciliation across
scopes first: if fingerprint changes, do not reuse an older matching baseline.
If any candidate is hidden across that transition, skip SCOPE_MISMATCH; no reset or
cross-scope streak/restore. With no baseline and hidden candidates, skip
BASELINE_UNAVAILABLE; otherwise bootstrap without visibility changes. Empty scan
with existing candidates always skips ZERO_RESULT_ANOMALY, including bootstrap;
empty scan with zero candidates may establish an empty baseline. No retrospective
reconstruction from061 arrays. Baseline evidence is durable job scalars, not a new table.

Explicit policy contains maxNewlyMissing, maxMissingRatioBps and
maxObservedDropRatioBps; validate safe integers and0..10000 ratios, copy/freeze.
Require absolute and percentage limits and decline versus latest trusted observed
count; handle small populations explicitly with those same configured limits.
Missing ratio uses newly missing/current visible; count already-hidden missing and
restorable separately. Any rejection skips ALL hide/streak/restore writes, ingestion
still succeeds, no baseline replacement. Reasons minimally: SCAN_NOT_VALIDATED,
SCOPE_MISMATCH,BASELINE_UNAVAILABLE,POLICY_NOT_CONFIGURED,
MASS_HIDE_THRESHOLD_EXCEEDED,ZERO_RESULT_ANOMALY,SOURCE_SCOPE_CONFLICT,
STREAK_LIMIT_REACHED. Codes remain backend-local as const/VARCHAR/CHECK with parity.

## 8. Persistence, isolation and lock order

Candidates join shipments.source_identity_id to stable identities with exact source
owner/provider/account/SHIPMENT/scheme plus root owner/provider. Exclude manual,
other scopes/schemes and NULL source. NULL connection after deletion is allowed;
any different nonnull root connection is a conservative scoped conflict, never
reassigned. Read conflicting connection facts without acquiring reverse parent locks.
No tracking-code identity and no SoftDeleted filter. Current job's distinct seen UUIDs
come from unnest seen-pages, not items/applied outcomes.

Reuse actor→epoch→connection→job fence; source facts locked before roots, stable UUID
ordering for bulk facts. Return aggregate counts instead of100k hydrated rows. Actor
shared worker lock conflicts with API's exclusive actor read lock: API sees before
or committed after, never half-visible state. Reconcile under same connection/job
locks, then persist summary, assert lease AFTER domain work, mark SUCCEEDED and
DELETE seen-pages. Any failure/expiry rolls back visibility/summary/status/cleanup;
retry/replay uses existing checkpoint/lease, not last_missing_job_id. No network or
credential crypto under locks. Existing failed/cancelled cleanup never reconciles.

## 9. Schema, grants and contracts

Forward migration adds mapped Shipment syncHiddenAt Timestamptz3 and missingStreak
Int default0 with coherent NULL/streak CHECK. Existing rows ACTIVE, IDs/children/
associations/history untouched. Add nullable job reconciliation status/reason and
three counts with exact coherent constraints, no historical backfill. Summary lives
with job retention; job deletion removes baseline evidence and forces safe bootstrap.
No new index without plans. Runtime worker gets only new column UPDATE in addition
to existing provider column rights; no full-table UPDATE, local/root identity writes
or DELETE. API remains SELECT-only. Repeat provisioning must revoke obsolete ACLs.

No public DTO/SDK fields for hidden/summary. Read list/search/stats/pagination share
hidden NULL base predicate; get/history require same visibility and normal404.
Retail manual refresh uses existing query/generation/AbortController/session epoch.
On detail/history revalidation, any NOT_FOUND or denial clears retained detail,
including when the sibling request fails earlier. No new polling or layout change;
minimal existing refresh plumbing only if needed, documented without real-time claim.

## 10. Test-first and genuine regression strategy

RED policy/transition/baseline/safety and real visibility/schema/read tests, then GREEN.
Cover task casesA–O, int32 boundaries, scope transition/history baseline exclusion,
bootstrap empty anomaly, mass guard whole-operation skip, stable reconnect identity,
unchanged/rejected seen restore, local metadata/children/history preservation.
Actual worker/API credentials test allowed new columns and denied local/identity/
full-table mutation, repeat ACL cleanup, exact CHECK parity via conkey/convalidated,
mutation sensitivity and native valid/invalid INSERTs. Migration staged061→062,
repeat/drift plus fresh deploy. Failure injection after visibility/before summary/
SUCCEEDED/DELETE and expiring lease; independent repos takeover/replay/races.
Genuine API owner/search/stats/paging/detail/history and UI cache/refresh/error tests.

## 11. Delivery and documentation

Update Database/Sync/Shipment/Uniship/Testing canonical owners, active task/evidence;
retain immutable historical plans, captures and FAIL results. Host targeted tests,
full integration/migrations/contracts/quality, available canonical Docker and approved
signed launcher. NOT RUN requires a concrete blocker, never bypass/reset user volumes.
Independent real reviewer checks code/locks/grants/plans/cache and evidence, final
PR metadata binds frozen raw SHA, exact-final-HEAD Preflight/Sync/Foundation required.
Create/push same feature PR, no merge/live activation. Vietnamese A–K delivery report.

## 12. PLAN ISSUES and readiness

Ready for implementation; no owner approval needed. Production safety thresholds
and upstream guarantees remain unverified external/operational prerequisites under
058: policy absent and production registration empty fail closed. Scope transition
with hidden records requires a future explicit migration/repair policy; this revision
skips it rather than guessing. Atomic100k finalization/performance remains an execution
gate, not an assumed success. Any unsafe result blocks readiness and triggers a revised
plan before material changes. Independent review is read-only, not coding delegation.

## Revision v2 — admission provenance for deployed capability

Independent pre-delivery review identifies P2: excluding old SUCCEEDED summaries
alone does not exclude061 in-flight FETCHING/APPLYING jobs whose temporary arrays
survive deployment. They must not bootstrap a062 baseline retroactively. This
revision is frozen before changing implementation/schema/tests for that issue.

Add nullable reconciliation_version Int to sync_jobs, CHECK positive when present,
no default/backfill. Domain binding declares readonly finalizationVersion1 separately
from processor1. Registry validates declared hook/version and admission stamps that
version in the existing fenced INSERT. Legacy admission without a hook leavesNULL.
Finalizer receives admitted=true only if current job's stamp equals current declared
capability version; otherwise SKIPPED/CAPABILITY_NOT_ADMITTED, with no baseline/
visibility change. Existing ingestion/terminal cleanup remains. Baseline query must
require that same nonnull admitted version, not just outcome/scan validity. No
per-Shipment last_missing_job_id or new state machine is introduced.

Tests: pure old-version decision RED→GREEN; genuine old FETCHING and APPLYING jobs
with retained VALIDATED arrays and configured new policy never bootstrap/hide/restore;
first newly admitted job establishes baseline, subsequent qualified job may apply.
Check native positive/invalid version constraints and migrationNULL history. v1 stays
immutable and represents the initial inspected plan; v2 supersedes only this
provenance gap and adds one skip reason. No production thresholds/registration change.

## Revision v3 — fail closed on all admitted scope transitions

Independent review reproduces a second P2: wide3→narrow2 with no hidden rows can
bootstrap a new fingerprint, then the next narrow scan hides the third Shipment
although it may merely lie outside the new filter. Root identity scope does not
retain per-query membership provenance. This v3 is frozen before changing policy.

Supersede v1/v2 permission to auto-bootstrap a changed fingerprint when hidden=0:
ANY mismatch between current fingerprint and latest trusted admitted baseline skips
SCOPE_MISMATCH, with no hide/restore/streak/reset or baseline replacement, including
both narrowed and widened queries. Repeated jobs remain skipped until a separately
designed explicit migration/repair policy. A genuinely absent admitted baseline can
still bootstrap under the existing nonempty/empty-anomaly and no-hidden rules.
No per-root provenance is invented. New tests cover repeated narrowed/widened scopes
and unchanged visibility/baseline; pure repro RED→GREEN and genuine PG path.

Expand the already-planned atomic performance verification with two extreme100k
cases:99999 missing (one seen, avoiding the zero-result anomaly) and100000 restored.
Use explicit synthetic permissive limits only. Measure actual fenced completion,
rollback EXPLAIN and physical zero-write invariants, retaining15s transaction timeout.
Any failure/timeout blocks acceptance; no automatic threshold/timeout/index change.
