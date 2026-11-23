# NEXORA-062 — implementation and executed verification

Date2026-11-23 (Asia/Ho_Chi_Minh). Original workspace7fd33e98a156cbb17fc5e8fb843470701261d25b
was clean. Fetch main/gh API confirms PR60 merged2026-11-23T01:19:42Z at
561d48762556ea2220b86fd83a843f6129b5e33d, still main HEAD at task start.062 unused.
Branch feature/full-sync-missing-reconciliation; first commit36e160f closes061 and
records the scoped plan before code/tests. Local results execute the062 working
tree based on36e160f, not old061 code. Hosted committed head/merge/run/attempt will
be recorded at delivery. Production registry stays empty;058 external gates NOT RUN.

## Frozen design and independent review deltas

- V1 raw SHA39181f37d24732b327c319f9f5596ffcc3cce306cb3c7636d981e1caf112a63d,
  comprehensive12-section reuse/DDD/locks/schema/verification plan before code.
- V2 SHA c9670201d299a1a5ab447dabd61fe39af0f099d5532135df82f18a08609ab1c7:
  reviewer P2 found in-flight061 FETCHING/APPLYING jobs could bootstrap after deploy.
  Add nullable admitted capability version, no backfill; exact current-version and
  baseline checks, CAPABILITY_NOT_ADMITTED skip. Reviewer closed this P2 after
  genuine signed43/43 including both legacy phases. Separate from processor1.
- V3 SHA00d2cbf3f02c5d7285be9f78dce08189dc9fd1c6ac70be2a23ba262a7e428b4f:
  reviewer repro wide3→narrow2 with hidden0 bootstraps then falsely hides third row.
  All fingerprint transitions now SCOPE_MISMATCH until explicit migration policy,
  including wide/narrow with no hidden; no automatic baseline replacement/reset.
  Both revisions formatted/hashed/pinned before their implementation changes;
  earlier snapshots remain immutable. No owner approval or production threshold
  attestation is invented. Independent final review/hosted gates remain required.

## Ownership and implementation

Pure Shipment policy governs baseline, explicit safety configuration, missing/restore
and overflow. Optional domain finalizer receives only trusted technical facts from
Sync; no ShipmentAggregate/Uniship implementation import into generic repository.
Versioned admission distinguishes new capability jobs. Source UUID/account/scheme
scope and root owner/provider govern candidates; manual/foreign/incompatible roots
excluded, NULL old connection permitted, conflicting nonnull connection skips.

Existing15s fenced transaction runs source→root locks, aggregate facts, pure decision,
set-based UPDATE only missing or hidden rows, summary, post-domain lease check,
SUCCEEDED and seen DELETE. Rollback retains arrays and old visibility. No new engine,
worker, checkpointed visibility publication, per-row driver UPDATE or speculative
index. updated_at/last_synced_at/stage/history/local data/children are not visibility
writes. API list/search/stats/paging share visible base; detail/history404. Private
summary/version never enters DTO/SDK. Retail keeps manual refresh/query/auth fencing,
clears404 despite sibling transport failure and rekeys detail after parent refresh.
No immediate push refresh/completion signal is claimed.

## Executed RED/GREEN and corrections

- Initial policy module absent: unit RED; implemented pure policy2/2 GREEN.
- Independent admission P2 unit RED: APPLIED versus expected SKIPPED for old job;
  stamp/version guards GREEN, genuine legacy FETCHING/APPLYING remain skipped.
- Independent scope P2 RED: BASELINE_ESTABLISHED versus expected SKIPPED for changed
  fingerprint with hidden0; corrected unconditional mismatch guard GREEN.
- Two real-hook sibling404 regressions RED retained cached detail; fail-fast404
  guard GREEN, plus session epoch replacement. Retail full suite148/148 PASS after the added manual-refresh regression.
- V1 genuine core39/39 PASS; v2 signed43/43 PASS; actual29-scenario benchmark/full
  scope suite45/45 PASS. Final expanded suite47/47 PASS,0 skipped (counts include
  Node's enclosing test). Actual role/schema checks execute in signed context.
- First local Preflight required the reuse matrix inside the active task as well
  as snapshot; added it. First private commit accidentally staged only git mv;
  amended that unpublished commit before implementation to include closure+plan.
- Own v2 build caught a missing admitted argument at the optional hook boundary;
  fixed before acceptance. Old intermediate tests consequently skipped writes and
  failed expected mutation assertions; corrected signed43/43 passed. A scope-guard
  text replacement also left the old hidden condition; direct fix then GREEN.
- Own benchmark fixture initially cast other owners' nonnumeric synthetic keys to
  int because SQL predicate order is not guaranteed. Guard fixture-only casts by
  exact scope CASE; production never parses source keys during reconciliation.
  Concurrent API fixture uses real API credentials, not worker actor-lock rights;
  expected counts include intentionally visible foreign-scheme/account noise.
- New fixture lint unused import/argument removed; lint/boundaries PASS. No existing
  business assertion, lease timeout, provider retry or permission gate weakened.

## Genuine targeted evidence

Final observation/reconciliation/schema/roles/benchmark suite47/47,0 skipped.
Genuine Shipment HTTP + Uniship + existing Sync fencing/replay96/96,0 skipped.
Cases exercise first/repeated missing, unchanged/rejected restore, all local and
child preservation, disabled/zero/mass/overflow, untrusted/incomplete/failed/cancelled,
manual and multi-owner/account/scheme exclusion, reconnect/conflict, old admission,
wide/narrow repeated skips, failures at summary/terminal/cleanup/lease, stale takeover
and concurrent finalizers. API list/search/counts/paging/detail/history hide/restore
runs through real Nest authentication; raw adapter reads also assert visibility.

Actual nexora_sync/nexora_app passwords verify narrow new-column writes, no broad
UPDATE, denied customer/assignee/note/owner/source/code/DELETE and denied API provider/
visibility updates. Deliberately over-granted worker table/API column ACLs are removed
by repeat provisioning. Physical CHECK conkey/convalidated, exact code sets, rollback
DDL EXTRA mutation sensitivity and native valid/invalid writes execute. No self-
review or admin-only assertion is presented as independent/restricted-role approval.

## Atomic performance decision

**Keep atomic finalization; no new index or resumable state machine required by these
measurements.** Synthetic policies explicitly permit extreme cases for testing only;
production has no thresholds/registration. Owned disposable PostgreSQL17.11, Node24.22.1,
Linux x64, AMD EPYC9V74,2 available CPUs. No other local quality/integration suite ran
during this dedicated benchmark. Tables warm from actual baseline finalization;
EXPLAIN mutation rolls back before actual apply. One observation per scenario, not a
production SLA/cold-cache capacity claim. Both actual execution and instrumented SQL
plans retained; don't subtract them to claim driver latency.

Each dataset has9 scenarios;100k adds99999-missing and100000-restore. Both pass with
unchanged15s transaction timeout. All-ACTIVE/all-seen100k writes0 rows and xmin group
snapshot remains identical. Real finalization makes20 raw driver statements (19 when
guard blocks), independent of population; internal index probes aren't N+1 calls.
Controlled concurrent API read observes pg_stat_activity lock waiting and sees only
committed counts. Its deliberate test barrier is included/labeled in API wait time.
Mutation EXPLAIN for a blocked case is hypothetical rolled-back work; actual guard
executes0 visibility writes. No raw predicates/keys/UUIDs/URLs/credentials exported.

Measurement UTC window: 2026-11-23T02:19:18.913Z through 2026-11-23T02:20:17.716Z. PostgreSQL 17.11 (Debian 17.11-1.pgdg12+2).

| Target | Scenario           | New / restore / still missing | Full finalize ms | Cleanup ms | SQL driver calls | Candidates / anti-join / restore / UPDATE SQL ms | UPDATE shared hit/read | Failed retry ms    | Controlled API wait ms |
| ------ | ------------------ | ----------------------------- | ---------------- | ---------- | ---------------- | ------------------------------------------------ | ---------------------- | ------------------ | ---------------------- |
| 1000   | none               | 0 / 0 / 0                     | 17.145           | 0.534      | 20               | 2.792 / 1.600 / 0.295 / 1.724                    | 272 / 0                | n/a                | n/a                    |
| 1000   | one                | 1 / 0 / 0                     | 19.282           | 0.591      | 20               | 2.708 / 1.508 / 0.237 / 1.816                    | 361 / 0                | n/a                | n/a                    |
| 1000   | one-percent        | 10 / 0 / 0                    | 22.250           | 0.487      | 20               | 2.665 / 1.476 / 0.243 / 1.991                    | 469 / 0                | n/a                | n/a                    |
| 1000   | still-missing      | 0 / 0 / 10                    | 17.197           | 0.427      | 20               | 2.572 / 1.432 / 1.087 / 1.699                    | 354 / 0                | n/a                | n/a                    |
| 1000   | restore-many       | 0 / 100 / 0                   | 20.482           | 0.526      | 20               | 2.485 / 1.391 / 1.215 / 3.643                    | 2474 / 0               | n/a                | n/a                    |
| 1000   | mass-blocked       | 0 / 0 / 0                     | 18.424           | 0.578      | 19               | 3.127 / 1.398 / 1.217 / 3.776                    | 2532 / 0               | n/a                | n/a                    |
| 1000   | mixed-scope        | 0 / 0 / 0                     | 19.560           | 0.474      | 20               | 4.039 / 2.463 / 0.565 / 2.487                    | 443 / 0                | n/a                | n/a                    |
| 1000   | crash-retry        | 1 / 0 / 0                     | 23.129           | 0.358      | 20               | 4.076 / 2.295 / 0.498 / 2.390                    | 451 / 0                | 18.360920999999507 | n/a                    |
| 1000   | concurrent-api     | 1 / 0 / 0                     | 53.305           | 0.529      | 20               | 4.193 / 2.186 / 0.542 / 2.552                    | 518 / 0                | n/a                | 46.78787800000282      |
| 10000  | none               | 0 / 0 / 0                     | 59.247           | 0.559      | 20               | 25.460 / 13.844 / 1.742 / 14.893                 | 1014 / 0               | n/a                | n/a                    |
| 10000  | one                | 1 / 0 / 0                     | 57.508           | 0.625      | 20               | 26.003 / 14.190 / 1.796 / 15.410                 | 1127 / 0               | n/a                | n/a                    |
| 10000  | one-percent        | 100 / 0 / 0                   | 59.952           | 0.656      | 20               | 26.820 / 13.669 / 1.627 / 18.969                 | 3342 / 0               | n/a                | n/a                    |
| 10000  | still-missing      | 0 / 0 / 100                   | 71.551           | 0.527      | 20               | 32.024 / 15.628 / 11.094 / 26.364                | 3183 / 0               | n/a                | n/a                    |
| 10000  | restore-many       | 0 / 1000 / 0                  | 94.057           | 0.605      | 20               | 57.978 / 20.212 / 24.298 / 45.530                | 26963 / 0              | n/a                | n/a                    |
| 10000  | mass-blocked       | 0 / 0 / 0                     | 80.861           | 0.760      | 19               | 38.087 / 18.127 / 30.736 / 43.773                | 29951 / 0              | n/a                | n/a                    |
| 10000  | mixed-scope        | 0 / 0 / 0                     | 79.816           | 0.630      | 20               | 36.989 / 17.152 / 23.866 / 21.360                | 1243 / 0               | n/a                | n/a                    |
| 10000  | crash-retry        | 1 / 0 / 0                     | 64.221           | 0.483      | 20               | 27.442 / 15.421 / 21.486 / 16.780                | 1249 / 0               | 65.22418900000048  | n/a                    |
| 10000  | concurrent-api     | 1 / 0 / 0                     | 106.311          | 0.512      | 20               | 33.129 / 15.192 / 21.548 / 17.113                | 1313 / 0               | n/a                | 98.71359799999846      |
| 100000 | none               | 0 / 0 / 0                     | 637.118          | 1.231      | 20               | 361.182 / 197.190 / 293.516 / 209.592            | 6665 / 0               | n/a                | n/a                    |
| 100000 | one                | 1 / 0 / 0                     | 599.382          | 1.386      | 20               | 373.640 / 180.591 / 294.892 / 197.559            | 7001 / 8               | n/a                | n/a                    |
| 100000 | one-percent        | 1000 / 0 / 0                  | 598.301          | 1.990      | 20               | 338.099 / 173.961 / 281.741 / 237.434            | 36001 / 259            | n/a                | n/a                    |
| 100000 | still-missing      | 0 / 0 / 1000                  | 618.352          | 2.062      | 20               | 382.017 / 188.932 / 326.666 / 220.922            | 40724 / 0              | n/a                | n/a                    |
| 100000 | restore-many       | 0 / 10000 / 0                 | 990.813          | 2.780      | 20               | 404.346 / 187.578 / 334.450 / 552.603            | 319416 / 0             | n/a                | n/a                    |
| 100000 | mass-blocked       | 0 / 0 / 0                     | 423.422          | 2.081      | 19               | 378.510 / 175.505 / 323.817 / 545.831            | 363243 / 0             | n/a                | n/a                    |
| 100000 | near-total-missing | 99999 / 0 / 0                 | 4282.400         | 0.525      | 20               | 236.491 / 97.382 / 0.071 / 3456.893              | 2822651 / 268          | n/a                | n/a                    |
| 100000 | restore-all        | 0 / 100000 / 0                | 4809.086         | 1.856      | 20               | 503.297 / 120.050 / 741.571 / 4020.211           | 3269279 / 21740        | n/a                | n/a                    |
| 100000 | mixed-scope        | 0 / 0 / 0                     | 755.327          | 1.224      | 20               | 453.483 / 140.481 / 496.094 / 230.001            | 13573 / 6739           | n/a                | n/a                    |
| 100000 | crash-retry        | 1 / 0 / 0                     | 704.408          | 1.284      | 20               | 422.958 / 169.887 / 331.154 / 220.728            | 13793 / 6551           | 728.2217439999949  | n/a                    |
| 100000 | concurrent-api     | 1 / 0 / 0                     | 751.618          | 1.135      | 20               | 496.132 / 272.483 / 415.925 / 235.344            | 14227 / 6157           | n/a                | 741.7985500000068      |

### Representative actual plans and index decision

Source scoped unique index and uq_shipments_source already exist. Plans also use
Shipment/source PK or owner/stage/created indexes when cheaper; small/global scans
may hash/sequence scan. Exact observed nodes/indexes below, not a forced-index claim.
Shared buffers at parent include child work; do not sum them. Rows are per-loop.
Large materialized seen sets/row locking and high-write rollback EXPLAIN can cause
cache/bloat effects; measured times are not guaranteed production latency.

| Target / scenario           | Query      | Plan / execution ms | Node / index                                                                                                                                                                                         | Estimated / actual rows                                                                                                            | Loops | Node ms  | Shared hit/read | Removed filter |
| --------------------------- | ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- | --------------- | -------------- |
| 1000 / none                 | candidates | 0.362 / 2.792       | Aggregate; Nested Loop; Seq Scan; Function Scan; LockRows; Sort; Hash Join; Hash; CTE Scan                                                                                                           | Seq Scan:10/10x1; LockRows:115/1000x1; Seq Scan:999/1000x1; Seq Scan:339/1000x1                                                    | 1     | 2.735    | 1272 / 0        | 0              |
| 1000 / none                 | antiJoin   | 0.263 / 1.600       | Hash Join; Aggregate; Nested Loop; Seq Scan; Function Scan; Hash; CTE Scan                                                                                                                           | Seq Scan:10/10x1; Seq Scan:999/1000x1; Seq Scan:339/1000x1                                                                         | 1     | 1.571    | 272 / 0         | 0              |
| 1000 / none                 | restore    | 0.215 / 0.295       | Nested Loop; Aggregate; Seq Scan; Function Scan; Hash Join; Hash; CTE Scan; Index Scan / sync_source_identities_pkey                                                                                 | Seq Scan:10/0x0; Seq Scan:4/0x1; Index Scan:1/0x0                                                                                  | 1     | 0.269    | 60 / 0          | 0              |
| 1000 / none                 | update     | 0.316 / 1.724       | Aggregate; Nested Loop; Seq Scan; Function Scan; Hash Join; Hash; CTE Scan; ModifyTable; Index Scan / shipments_pkey                                                                                 | Seq Scan:10/10x1; Seq Scan:999/1000x1; Seq Scan:339/1000x1; ModifyTable:1/0x1; Index Scan:1/0x0                                    | 1     | 1.655    | 272 / 0         | 0              |
| 10000 / none                | candidates | 0.437 / 25.460      | Aggregate; Nested Loop; Seq Scan; Function Scan; LockRows; Sort; Hash Join; Hash; CTE Scan                                                                                                           | Seq Scan:100/100x1; LockRows:3683/10000x1; Seq Scan:9998/10000x1; Seq Scan:5876/10000x1                                            | 1     | 25.292   | 11014 / 0       | 0              |
| 10000 / none                | antiJoin   | 0.315 / 13.844      | Hash Join; Aggregate; Nested Loop; Seq Scan; Function Scan; Hash; CTE Scan                                                                                                                           | Seq Scan:100/100x1; Seq Scan:9998/10000x1; Seq Scan:5876/10000x1                                                                   | 1     | 13.790   | 1014 / 0        | 0              |
| 10000 / none                | restore    | 0.311 / 1.742       | Nested Loop; Aggregate; Seq Scan; Function Scan; Hash Join; Hash; CTE Scan; Index Scan / sync_source_identities_pkey                                                                                 | Seq Scan:100/0x0; Seq Scan:8/0x1; Index Scan:1/0x0                                                                                 | 1     | 1.709    | 350 / 0         | 0              |
| 10000 / none                | update     | 0.332 / 14.893      | Aggregate; Nested Loop; Seq Scan; Function Scan; Hash Join; Hash; CTE Scan; ModifyTable; Index Scan / shipments_pkey                                                                                 | Seq Scan:100/100x1; Seq Scan:9998/10000x1; Seq Scan:5876/10000x1; ModifyTable:21/0x1; Index Scan:1/0x0                             | 1     | 14.795   | 1014 / 0        | 0              |
| 100000 / none               | candidates | 0.580 / 361.182     | Aggregate; Nested Loop; Seq Scan; Function Scan; LockRows; Sort; Hash Join; Hash; CTE Scan                                                                                                           | Seq Scan:1000/1000x1; LockRows:69574/100000x1; Seq Scan:100150/100000x1; Seq Scan:82636/100000x1                                   | 1     | 360.290  | 106665 / 0      | 0              |
| 100000 / none               | antiJoin   | 0.413 / 197.190     | Hash Join; Aggregate; Nested Loop; Seq Scan; Function Scan; Hash; CTE Scan                                                                                                                           | Seq Scan:1000/1000x1; Seq Scan:100150/100000x1; Seq Scan:82636/100000x1                                                            | 1     | 196.896  | 6665 / 0        | 0              |
| 100000 / none               | restore    | 0.493 / 293.516     | Nested Loop; Aggregate; Seq Scan; Function Scan; CTE Scan; Memoize; Index Scan / uq_shipments_source; Index Scan / sync_source_identities_pkey                                                       | Seq Scan:1000/1000x1; Index Scan:1/0x100000; Index Scan:1/0x0                                                                      | 1     | 292.644  | 400500 / 0      | 0              |
| 100000 / none               | update     | 0.448 / 209.592     | Aggregate; Nested Loop; Seq Scan; Function Scan; Hash Join; Hash; CTE Scan; ModifyTable; Index Scan / shipments_pkey                                                                                 | Seq Scan:1000/1000x1; Seq Scan:100150/100000x1; Seq Scan:82636/100000x1; ModifyTable:350/0x1; Index Scan:1/0x0                     | 1     | 209.271  | 6665 / 0        | 0              |
| 100000 / near-total-missing | candidates | 0.364 / 236.491     | Aggregate; Unique; Sort; Nested Loop; Index Scan / sync_job_seen_pages_pkey; Function Scan; LockRows; Hash Join; Seq Scan; Hash; CTE Scan                                                            | Index Scan:1/1x1; LockRows:106568/100000x1; Seq Scan:153401/100000x1; Seq Scan:82636/100000x1                                      | 1     | 235.823  | 107560 / 0      | 0              |
| 100000 / near-total-missing | antiJoin   | 0.309 / 97.382      | Hash Join; Unique; Sort; Nested Loop; Index Scan / sync_job_seen_pages_pkey; Function Scan; Seq Scan; Hash; CTE Scan                                                                                 | Index Scan:1/1x1; Seq Scan:153401/100000x1; Seq Scan:82636/100000x1                                                                | 1     | 94.131   | 7560 / 0        | 0              |
| 100000 / near-total-missing | restore    | 0.459 / 0.071       | Nested Loop; Unique; Sort; Index Scan / sync_job_seen_pages_pkey; Function Scan; Aggregate; CTE Scan; Index Scan / sync_source_identities_pkey; Index Scan / uq_shipments_source                     | Index Scan:1/1x1; Index Scan:1/1x1; Index Scan:1/0x1                                                                               | 1     | 0.039    | 13 / 0          | 0              |
| 100000 / near-total-missing | update     | 0.285 / 3456.893    | Aggregate; Unique; Sort; Nested Loop; Index Scan / sync_job_seen_pages_pkey; Function Scan; Hash Join; Seq Scan; Hash; CTE Scan; ModifyTable; Index Scan / shipments_pkey                            | Index Scan:1/1x1; Seq Scan:153401/100000x1; Seq Scan:82636/100000x1; ModifyTable:536/99999x1; Index Scan:1/1x99999                 | 1     | 3456.628 | 2822651 / 268   | 0              |
| 100000 / restore-all        | candidates | 0.426 / 503.297     | Aggregate; Nested Loop; Bitmap Heap Scan; Bitmap Index Scan / sync_job_seen_pages_pkey; Function Scan; LockRows; Sort; Hash Join; Seq Scan; Hash; CTE Scan                                           | Bitmap Index Scan:1000/1000x1; LockRows:327861/100000x1; Seq Scan:471946/100000x1; Seq Scan:82636/100000x1                         | 1     | 501.791  | 104248 / 11897  | 0              |
| 100000 / restore-all        | antiJoin   | 0.394 / 120.050     | Hash Join; Aggregate; Nested Loop; Bitmap Heap Scan; Bitmap Index Scan / sync_job_seen_pages_pkey; Function Scan; Seq Scan; Hash; CTE Scan                                                           | Bitmap Index Scan:1000/1000x1; Seq Scan:471946/1x1; Seq Scan:82636/100000x1                                                        | 1     | 119.801  | 2976 / 857      | 0              |
| 100000 / restore-all        | restore    | 0.351 / 741.571     | Nested Loop; Aggregate; Bitmap Heap Scan; Bitmap Index Scan / sync_job_seen_pages_pkey; Function Scan; CTE Scan; Memoize; Index Scan / uq_shipments_source; Index Scan / sync_source_identities_pkey | Bitmap Index Scan:1000/1000x1; Index Scan:1/1x100000; Index Scan:1/1x100000                                                        | 1     | 736.350  | 991646 / 4299   | 0              |
| 100000 / restore-all        | update     | 0.425 / 4020.211    | Aggregate; Nested Loop; Bitmap Heap Scan; Bitmap Index Scan / sync_job_seen_pages_pkey; Function Scan; Hash Join; Seq Scan; Hash; CTE Scan; ModifyTable; Index Scan / shipments_pkey                 | Bitmap Index Scan:1000/1000x1; Seq Scan:471946/100000x1; Seq Scan:82636/100000x1; ModifyTable:1650/100000x1; Index Scan:1/1x100000 | 1     | 4019.151 | 3269279 / 21740 | 0              |

## Verification status before broad gates

| Command/context                                                        | Result  | Evidence                                                                                                       |
| ---------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| Policy units                                                           | PASS    | 2/2, including admission/scope RED→GREEN and int32/config boundaries                                           |
| Retail tests                                                           | PASS    | 148/148; real hook scheduling,404/sibling/session fencing, manual-refresh replacement and prior UI regressions |
| Dedicated signed observation/reconciliation                            | PASS    | 47/47,0 skipped; schema/native role/rollback/races/29 benchmark cases                                          |
| Genuine Shipment HTTP/Uniship/Sync targeted                            | PASS    | 96/96,0 skipped; actual authenticated reads and prior fencing/replay                                           |
| lint/boundaries                                                        | PASS    | Corrected own unused fixture import/argument                                                                   |
| Full integration/migrations/quality/final independent review/hosted CI | NOT RUN | Broad verification in progress at evidence-writing time; no old061 CI substituted                              |

Local canonical Docker/native launcher availability is assessed separately. No user
volumes reset, shared DB benchmark, production credentials, live activation or merge.

## Migration and final review follow-up

Dedicated migration first failed at SHIPMENT_CHILDREN_FORWARD. Safe diagnostic
confirmed P2022/missingVisibilityColumn=true: latest generated Prisma client sends
missing_streak default while the fixture intentionally runs the older schema. Seed
that legacy Shipment using an explicit old-column INSERT, preserving all original
assertions. Full legacy→061→062 preservation, ACTIVE defaults, historicalNULL,
repeat/drift then PASS. No historical migration bytes are changed.

Reviewer closed both P2 safety findings after v3/code/genuine47-case review. One P3
reason-precedence edge remained: changed scope plus zero result reported ZERO_RESULT
instead of controlling SCOPE_MISMATCH. Move known baseline mismatch before zero guard
and add unit/genuine repeated scope+empty regressions; actual first-bootstrap zero
anomaly still fails ZERO_RESULT_ANOMALY. Safety was already fail-closed. Broad
verification will execute this final change; no new design decision is required.

## Broad local gates

pnpm10.34.6 quality PASS: format/lint/boundaries/preflight/docs/typecheck/test/
contracts/build.877 tests (scripts182/API278/Web372/shared2/UI37/database6), no
contract/SDK/shared/lockfile drift. Dedicated test:docs10/10, test:preflight24/24,
test:lint56/56 PASS. Full genuine signed API integration runs separately to keep
performance measurements isolated; its result remains pending at this checkpoint.

Local canonical quality-docker/native launcher NOT RUN: Docker VFS, only PostgreSQL
image, absent tooling image,524MiB free. No user image/volume cleanup or signed
protocol bypass. Hosted Foundation must execute canonical Docker and approved
native suites on the new HEAD before readiness. No earlier061 green is substituted.

## Full local implementation verification

Final working-tree pnpm test:integration with genuine signed task-owned PostgreSQL
PASS227/227,0 skipped,258149.10042ms. This executes the final scope+empty precedence
regression, updated authenticated HTTP stage/search/paging/private-field assertions,
actual roles/parity/repeat ACL cleanup, failure/race/retention and all prior suites.
Quality PASS877/877, Retail148/148, policy2/2 and migration preservation/repeat/drift
PASS. test:docs10/10, test:preflight24/24, test:lint56/56 PASS. The earlier intermediate
NOT RUN/pending checkpoints are historical, not current local state. Canonical local
Docker remains NOT RUN with the recorded VFS/image/disk blocker; new-HEAD hosted
Foundation and independent final review remain delivery gates, never inferred from061.

| Command                                                                                                | Result  | Evidence                                                                 |
| ------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------ |
| pnpm --filter @nexora/database test:migrations                                                         | PASS    | Full legacy→061→062 preservation/default/NULL/repeat/drift               |
| pnpm test:integration                                                                                  | PASS    | Genuine signed227/227,0 skipped,258149.10042ms                           |
| pnpm format:check / lint / typecheck / test / contracts:check / docs:check / preflight:check / quality | PASS    | Executed through quality,877 tests and build/contracts reproducible      |
| pnpm test:docs / test:preflight / test:lint                                                            | PASS    | 10/10,24/24,56/56                                                        |
| Local quality-docker / approved native launcher                                                        | NOT RUN | VFS, absent tooling image,524MiB free; no unsafe cleanup/protocol bypass |
| Hosted new-HEAD Preflight / Sync Targeted / Foundation                                                 | NOT RUN | Awaiting corrective task PR push; older061 results not substituted       |

## First hosted run — signed coverage PASS, unsigned fixture FAIL

Code30547d40ac58c6fadb8804849390f68df014a834, actual merge checkout
e5bae81515c309c615cd7d10458e528e6fcabdef confirmed in all three logs. Attempt1:

| Workflow      | Run / job                 | Result | Evidence                                                                                                                                                                                                         |
| ------------- | ------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preflight     | 45101495037               | PASS   | Correct task/v3 snapshot/PR binding                                                                                                                                                                              |
| Sync Targeted | 45101495036               | PASS   | 32 Sync units,11 adapter units,61 Sync PG and59 signed Uniship/observation/reconciliation                                                                                                                        |
| Foundation    | 45101495093 /137453148278 | FAIL   | Step4 new benchmark concurrent API read throws UNAUTHORIZED in ordinary unsigned integration; steps5–10 not executed. Missing later browser artifacts are secondary failures, not independent product diagnoses. |

The benchmark used apiUrl or process.env.DATABASE_URL. In unsigned mode apiUrl is
absent and the latter points to the base DB, while the owner fixture lives in an
owned UUID DB. Actor authorization correctly rejects that absent owner. Signed
contexts use the correct owned API URL, explaining signed local/Sync PASS. Independent
reviewer confirms this code-based cause. No production authorization failure inferred.

Reproduced unsigned local RED45 cases/43 PASS/2 FAIL (leaf plus enclosing test),
UNAUTHORIZED at ShipmentAdapter actor check. Fix passes a required owned readUrl
from the suite; it never falls back to an ambient base DB. A separate diagnostic
context distinguishes restricted-api from unsigned-privileged; unsigned execution
never certifies restricted-role ACLs. Corrected unsigned GREEN45/45,0 skipped,
78894.977609ms. Same assertions, real actor lock-wait, datasets and15s timeout.
Signed re-verification pending at this checkpoint. No gh run rerun or Foundation
workflow-step change is used; a new task commit will trigger fresh exact-head gates.

### Targeted workflow coverage follow-up

Add exact new Shipment policy/infrastructure/test paths to Sync Targeted (the old
filters missed standalone future edits), and extend its existing Sync unit command
with reconciliation policy tests. Local/independent34/34 PASS. Permission/pins/
timeout/Foundation remain unchanged. YAML parse and Prettier PASS; actionlint
NOT RUN (not installed). This verification-only delta joins the fixture correction.

### Context correction acceptance before fresh CI

Corrected signed re-verification47/47 PASS,0 skipped,85498.858689ms. Corrected
unsigned45/45 PASS,0 skipped,78894.977609ms. Both retain full datasets/extreme UPDATEs,
lock observation, rollback/retry and all functional assertions. Diagnostic read
context is explicit; actual ACL certification remains in signed cases. Production
source/schema/grants are byte-identical to30547d4. Final targeted command34/34 and
independent workflow review PASS; new hosted checks required on the fixture-fix HEAD.
