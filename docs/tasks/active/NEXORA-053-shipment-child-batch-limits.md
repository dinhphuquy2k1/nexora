# NEXORA-053 — Shipment child snapshot bounds and batched writes

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

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

| Claim                              | Evidence                                                                                                                                                                                                                                                                     | Date       | Result |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Initial task-doc structure         | docs:check FAIL: missing Canonical owners/Documentation verification headings and duplicate Verification key in prose. Rule A correction adds prescribed headings in mutable task only; snapshot stays frozen.                                                               | 2026-11-15 | FAIL   |
| Domain verification                | `node --test "apps/api/test/shipment/*.test.cjs"`:18/18 PASS on the implementation working tree; full ledger below.                                                                                                                                                          | 2026-11-15 | PASS   |
| Final docs evidence-section repair | docs:check initially FAIL after setting PARTIALLY VERIFIED because its first Evidence section had only the initial FAIL row and later PASS tables were under other headings. Added this actual Domain PASS to the canonical Evidence section; no verification claim changed. | 2026-11-15 | FAIL   |

## Implementation and local verification ledger

All working-tree evidence below is based on plan commit0bc251a and main baseline
a18b19b5e9ea6ed528381293c8d9b53403304e69; UTC2026-11-15. First closure commit58b7837
closes052; merge PR51 SHAa18b19b5e9ea6ed528381293c8d9b53403304e69, final green
HEADc5152a6b7c02bb1e4a1970a494b62cc0730ba817. Snapshot raw SHA-256 remains
62a213adf09f33fa7851ccfcde9b6e59e213400b4911afdc8f4755501876ba85.

Limits selected:50 charges,500 items,4 milestones. The approved fallback ladder
was not needed. Hydrate value classes and existing aggregate sequence validation
remain unchanged. Production diff is only shipment.ts input bounds and the three
conditional unnest upserts in shipment-sync-domain.binding.ts. Root/history/check
ordering, cleanup, Sync engine, public contracts and capability declarations stay
unchanged. D4 owns a separate synthetic owner/connection/source namespace from
functional checks, with an independently migrated test-owned database for the Sync invocation to
avoid claiming unrelated jobs. Carrier fixture provider remains uniship under the
existing DB CHECK; all registrations are test-only.
The shared fixture runs at the end of Sync integration after legacy global-count
assertions and before cleanup; Shipment integration also exercises it, including
the canonical restricted-worker suite. No production fixture registration.

| Claim                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                           | Date       | Result |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Domain/processor RED              | `node --test "apps/api/test/shipment/*.test.cjs"`:16 PASS/2 FAIL. Missing named bounds; oversized child input was APPLIED instead of REJECTED_SOURCE.                                                                                                                                                                                                                                                                                              | 2026-11-15 | FAIL   |
| PostgreSQL RED                    | Original per-row binding: fixed-query assertion got5 milestone writes instead of2; oversized-page rejected_count0 instead of1;100-record50/500/4 apply expired at15001ms against unchanged15000ms transaction timeout.                                                                                                                                                                                                                             | 2026-11-15 | FAIL   |
| Task-owned fixture corrections    | Rule A: wrong shell working directory/path corrected; initial legacy hydration test used a gap (lineNo32767 with one row), corrected to contiguous stored collections above incoming bounds. SyncJobItem uses job_id/processing_outcome, not guessed camelCase; identical payloads stage0 job items rather than100 APPLIED; new test assertions corrected without changing engine behavior. Prior failures retained in ignored artifacts/053 logs. | 2026-11-15 | FAIL   |
| Sync fixture isolation correction | Added fixture initially preceded existing all-database counts/catalog probes and left103 synthetic sources; an existing assertion observed202 rather than99. Task-added helper moved after all original assertions and uses an isolated database/independent timing owner+connection; no original assertions weakened.                                                                                                                             | 2026-11-15 | FAIL   |
| Domain GREEN                      | `node --test "apps/api/test/shipment/*.test.cjs"`:18/18 PASS; exact/one-over bounds and legacy high-lineNo hydration, processor rejection, existing Domain/read contracts.                                                                                                                                                                                                                                                                         | 2026-11-15 | PASS   |
| Shipment PostgreSQL GREEN         | `node --test integration/shipment-integration.test.cjs` from apps/api with private owned PostgreSQL17.11:20/20 PASS, including fixed child write counts, typed nulls, unchanged IDs/xmin, one-middle-line changes, absent/empty, mixed-page outcomes, full-page timing, existing SQL/lease rollback and authenticated reads/concurrency.                                                                                                           | 2026-11-15 | PASS   |

Timing provenance: PostgreSQL17.11 Debian17.11-1.pgdg12+2, Linux x64 Docker-backed
owned cluster on host3f9bf359ae0b,3 visible CPUs, AMD EPYC9V74. Initial batch
measurement first2359.270ms / all-values-changed2835.522ms / identical7.485ms,
600/600/0 child writes. A subsequent measure2050.409/2432.968/7.320ms also passed
the7500ms capacity bound; that run still failed a task-owned outcome assertion,
so it is measurement evidence only, not overall GREEN. Exact final GREEN timing
and command ledger follow below. No credentials or raw provider payloads recorded.

Rule A lint checkpoint: pinned lint initially FAIL because the new fixture used
structuredClone without an ESLint global declaration. Use globalThis.structuredClone;
no runtime/expectation changes. Recheck below retains this failure.

Rule A second isolation checkpoint: the attempted distinct synthetic provider
violated existing chk_carrier_connections_provider (23514). Keep the valid uniship
fixture value; isolate the Sync invocation in its own generated migrated database
with explicit owned cleanup, preserving all CHECKs and engine claim semantics.
All52 original Sync assertions PASS before this task-added fixture setup failure.

## Final local GREEN and review checkpoint

| Claim                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Date       | Result |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Sync PostgreSQL GREEN      | `node --test integration/sync-integration.test.cjs` from apps/api, owned PostgreSQL17.11;56/56 PASS. All52 original assertions plus three added child-batch subtests and parent PASS. Existing tests remain unchanged; new fixture owns/cleans its separate migrated database.                                                                                                                                                                                | 2026-11-15 | PASS   |
| Final D4 measurement       | SHIPMENT_CHILD_BATCH_TIMING:100 shipments ×50 charges/500 items/4 milestones. Sync GREEN first2037.342ms / changed2611.487ms / identical7.414ms;600/600/0 child writes. Independent Shipment GREEN first2117.648ms / changed3336.579ms / identical9.838ms. PostgreSQL17.11 Debian, Linux x64 host3f9bf359ae0b,3 visible AMD EPYC9V74 CPUs. First apply target7500ms met at500; no fallback. Whole apply transaction timed; staging/snapshot queries excluded. | 2026-11-15 | PASS   |
| Full host quality          | `API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`, UTC03:01:16–03:03:13Z exit0. Scripts141, Web289, API218, UI37, database6 all PASS; format/lint/docs/preflight/typecheck/contracts and production build PASS. Host evidence is distinct from pending canonical hosted Docker/runtime acceptance.                                                                                                                        | 2026-11-15 | PASS   |
| Boundaries and scope audit | `node scripts/boundaries.mjs` PASS; `git diff origin/main --stat` has no schema/migration/DTO/SDK/Web changes. Production changes confined to Shipment Domain input bounds and infrastructure batch SQL; Sync engine/runtime declarations unchanged.                                                                                                                                                                                                          | 2026-11-15 | PASS   |
| PR metadata simulation     | validatePrTaskBinding over the planned five metadata lines returned valid:true and failures:[]; raw snapshot digest62a213adf09f33fa7851ccfcde9b6e59e213400b4911afdc8f4755501876ba85 unchanged.                                                                                                                                                                                                                                                                | 2026-11-15 | PASS   |

| Claim                  | Evidence                                                                                                                                                                     | Date       | Result |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Pinned format:check    | `npx --yes pnpm@10.34.6 format:check`; UTC2026-11-15T02:59:37.332089+00:00–2026-11-15T02:59:49.090070+00:00; exit0. API_INTERNAL_URL=http://api:4000 NODE_ENV=production.    | 2026-11-15 | PASS   |
| Pinned lint            | `npx --yes pnpm@10.34.6 lint`; UTC2026-11-15T02:59:49.090494+00:00–2026-11-15T02:59:56.826119+00:00; exit1. API_INTERNAL_URL=http://api:4000 NODE_ENV=production.            | 2026-11-15 | FAIL   |
| Pinned lint            | `npx --yes pnpm@10.34.6 lint`; UTC2026-11-15T03:00:23.748093+00:00–2026-11-15T03:00:31.191221+00:00; exit0. API_INTERNAL_URL=http://api:4000 NODE_ENV=production.            | 2026-11-15 | PASS   |
| Pinned typecheck       | `npx --yes pnpm@10.34.6 typecheck`; UTC2026-11-15T03:00:31.191448+00:00–2026-11-15T03:01:05.580160+00:00; exit0. API_INTERNAL_URL=http://api:4000 NODE_ENV=production.       | 2026-11-15 | PASS   |
| Pinned contracts:check | `npx --yes pnpm@10.34.6 contracts:check`; UTC2026-11-15T03:01:05.580395+00:00–2026-11-15T03:01:11.036304+00:00; exit0. API_INTERNAL_URL=http://api:4000 NODE_ENV=production. | 2026-11-15 | PASS   |
| Pinned docs:check      | `npx --yes pnpm@10.34.6 docs:check`; UTC2026-11-15T03:01:11.036520+00:00–2026-11-15T03:01:12.122691+00:00; exit0. API_INTERNAL_URL=http://api:4000 NODE_ENV=production.      | 2026-11-15 | PASS   |
| Pinned preflight:check | `npx --yes pnpm@10.34.6 preflight:check`; UTC2026-11-15T03:01:12.122909+00:00–2026-11-15T03:01:13.464619+00:00; exit0. API_INTERNAL_URL=http://api:4000 NODE_ENV=production. | 2026-11-15 | PASS   |
| Pinned test:docs       | `npx --yes pnpm@10.34.6 test:docs`; UTC2026-11-15T03:01:13.464848+00:00–2026-11-15T03:01:14.890184+00:00; exit0. API_INTERNAL_URL=http://api:4000 NODE_ENV=production.       | 2026-11-15 | PASS   |
| Pinned test:preflight  | `npx --yes pnpm@10.34.6 test:preflight`; UTC2026-11-15T03:01:14.890588+00:00–2026-11-15T03:01:16.559537+00:00; exit0. API_INTERNAL_URL=http://api:4000 NODE_ENV=production.  | 2026-11-15 | PASS   |
| Pinned quality         | `npx --yes pnpm@10.34.6 quality`; UTC2026-11-15T03:01:16.559782+00:00–2026-11-15T03:03:13.703642+00:00; exit0. API_INTERNAL_URL=http://api:4000 NODE_ENV=production.         | 2026-11-15 | PASS   |

Implementation-code-review skill applied to complete diff: all D1–D6 covered,
original conditional upsert payload columns/IS DISTINCT FROM and cleanup retained,
nullable typed arrays verified against PostgreSQL, no deletes/reinserts or
contract/engine/registration drift. No concrete remaining P1/P2 in self-review.
Independent reviewer unavailable in this thread; self-review is not independent
approval and owner review remains. Exact-head hosted results will be recorded in
PR description via gh api without an evidence-only commit/CI SHA loop. No merge.
