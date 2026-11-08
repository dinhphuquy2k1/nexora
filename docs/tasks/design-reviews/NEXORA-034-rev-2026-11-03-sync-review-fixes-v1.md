# NEXORA-034 — Six review corrections

## 1. Metadata

Task ID: NEXORA-034
Classification: SIGNIFICANT
Plan revision: rev-2026-11-03-sync-review-fixes-v1
Reviewed baseline: 6f0292604261b4a7dccc775da611a048842ed019
Branch: feat/sync-worker-staging-v1. Existing PR32 only.
Documentation Impact: REQUIRED. No owner approval gate under ADR-009.

## 2. Scope and immutable history

Fix only F1–F6 from the owner's review task. Preserve the original immutable
rev-2026-11-02-sync-v1 snapshot (digest d6bcf89e94380e4a81386e3e54e86efc47142455258e8e0498a4ca86021ba20b).
No new tables/roles, architecture, business modules, live Provider/Domain handler,
endpoint, broker, default quota/retry change, UI redesign or design token change.

## 3. Read-only inspection

Fetched/pulled existing branch, clean at reviewed baseline. Inspected SyncRepository
page/apply/schedule/connection, PostgreSQL ProviderBudget/Uniship adapter/transport,
provision-runtime/owned-cluster and migration harnesses, generated SDK JobDetail,
Live/Data Drawer and Inspection plus existing native component/CDP harnesses.
Confirmed unconditional identity conflict UPDATE, stale retry timestamps, active
configs before LIMIT, unrenewed30-second provider reservations, metadata UPDATE
column grants for locking, and missing Job Detail SDK/Inspection consumption.

## 4. Reuse audit

| Component           | Existing implementations                                                                | Domain owner           | Reuse alternatives                           | Selected approach                                                              | Rationale                                          | Risks                                                     | Verification                                                               |
| ------------------- | --------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| F1 identity UPSERT  | sync-job.repository.ts page; sourceKey/canonicalPayload                                 | Sync infrastructure    | ORM per-record vs bulk predicate             | Extend existing parameterized bulk conflict predicate                          | No WAL/timestamp writes for unchanged sources      | Stale/null ordering, hash collision                       | Real PG row versions/timestamps, unchanged/changed/order                   |
| F2 retries          | same page/apply; retryDelay; versioned manifests                                        | Sync infrastructure    | New states vs existing outcomes              | Reset deadline only for new versions, share ready/deadline semantics in SQL    | No stale delay or hot claim loop                   | Pending future deadlines/exhaustion                       | Real PG fresh version, future retry, terminal warning                      |
| F3 scheduling       | schedule/admit; active-lane partial unique index                                        | Sync infrastructure    | New scheduler vs filter                      | NOT EXISTS active lanes before existing LIMIT                                  | Preserve atomic final admission                    | Concurrent schedulers/manual                              | 101due lanes, WAITING/terminal/races                                       |
| F4 reservation      | postgres-provider-budget.ts; UnishipAdapter/HttpClient; ProviderBudget                  | Carrier infrastructure | Expiry padding vs renewal                    | Token CAS renewal, one renewal in flight, signal forwarded through auth+verify | Protect whole operation, no quota change           | Lost lease, late success/release, cleanup                 | Real PG >30s operation, forced loss, successor; real loopback cancellation |
| F5 metadata locks   | connection/apply; provision-runtime; signed cluster tests                               | Sync/runtime           | UPDATE grants vs shared read-lock capability | Worker-only shared authorization locks, no metadata write grants               | Shared locks block ordinary lifecycle UPDATE       | PostgreSQL row-lock privilege requirement, deadlock order | SELECT-only FOR SHARE probe, actual worker role locks/deny/races           |
| F6 issue Inspection | sync-api generated SDK, CarrierLiveSyncDrawer/DataSyncDrawer/Inspection; native TSX/CDP | Web Carrier            | New modal/page vs current overlay            | Add JobDetail read state to current Inspection lifecycle                       | Preserve parent tabs/draft/filters and safe fields | Late responses, denied scope, pagination/abort            | Native SDK/component tests, real Chromium/HTTP and regression matrix       |

## 5. Contracts and ownership

Existing five endpoints and generated SDK contracts remain unchanged. New detail
client consumes existing job/issues/issueTotal and pagination. Only Source ID,
source/processor versions, outcome and closed error code are rendered. No payload,
PII, matching/reprocess action or Review Queue. Business domain behavior unchanged.

## 6. F1–F3 implementation

Identity update only when canonical key matches and nonstale hash differs or a
nonnull source order actually advances. Keep old order on null input. No source
version bump for order-only updates; staging remains conditional/versioned.
New source/processor version resets next_retry_at; same version does not reset it.
APPLYING ready selection and available_at use the same readiness predicate; future
retry uses earliest valid deadline, terminal/exhaustion policies remain unchanged.
Scheduler excludes active QUEUED/RUNNING/WAITING lane before LIMIT, retains atomic
admit and completion scheduling. No per-source ORM loops/new scheduling system.

## 7. F4 implementation

Reserve existing30-second token; renew before expiry by id/token/unexpired CAS in
short SQL. Never overlap renewal calls. AbortController signals transport on lost
ownership; combine with each request's existing timeout. Auth and verify share the
operation signal. Recheck ownership before accepting success. Always clear timer,
await pending renewal, release only own token; do not overwrite successor state.
Keep2slots and existing provider backoff/failure reset. No Promise.race-only fake
cancellation; genuine transport is awaited/aborted and late success is rejected.
Local in-memory ProviderBudget remains compatible via optional operation signal.

## 8. F5 platform issue and bounded resolution

PLAN ISSUE: PostgreSQL may require UPDATE privilege even for FOR SHARE. Prove this
using the existing signed disposable-cluster launcher before production edits.
If SELECT-only direct shared locks work, use them and remove UPDATE grants. If the
engine rejects them, never add substitute column grants: use fixed read-and-FOR
SHARE SECURITY DEFINER functions for user/epoch/connection/Customer facts. They
perform no writes/dynamic SQL, use schema-qualified tables and pinned pg_catalog
search_path, revoke PUBLIC execution, and grant only exact signatures to worker.
A new forward-only function migration is permitted; no table/role changes. Preserve
original migration bytes. Add explicit worker authorization-lock context to the
existing repository; API keeps its existing exclusive parent-lock path and grants.
Order stays user→epoch→connection→job→sources/domain; exclusive Sync writes remain.
Direct worker generation/updated_at/Customer mutations must fail42501. Verify owner
function execution cannot become a general privileged write interface. Document
this platform clarification rather than pretending SELECT permission suffices.

## 9. UI lifecycle

Keep current Drawer mounted. Current Inspection owns selected job/page read state
through an optional existing-overlay integration, cancellation and generation guard.
Close/switch/unmount aborts;401 invokes current sticky denial/login flow;403/404
clears detail and shows safe scoped error. No detail polling. Parent schedule/tab/
history state stays intact. Reuse shared controls and current overlay/layout.

## 10. Test-first verification

Add real PG RED cases for unchanged physical row/timestamp preservation,5changed,
ordering/null/stale, fresh-source/processor retries, future deadline/no claims,
101lanes/concurrent scheduler/manual, >30s provider renewal/lost/successor safety,
SELECT-only lock capability and worker denied writes/disable barriers. Extend only
existing owned launchers; no shared role/password mutation or user volume reset.
Add native transport/component lifecycle/detail pagination/error/race tests and
actual Chromium verification. Keep all existing assertions. Run targeted first,
then canonical quality/integration/migrations/roles, final-head Preflight/targeted/
Foundation Docker/runtime/TTY/HTTPS/persistence/development with actual logs.

## 11. Documentation and execution

Update task with each finding/root cause/files/fix/regression/result; targeted
facts only in Sync ADR/database/runtime/testing. Keep binary evidence outside Git.
Reviewable commits grouped F1, F2/F3, F4, F5, F6 on existing branch. Keep Draft while
verification/blockers remain, no merge/force push/deploy. Three independent rounds:
correctness, security/concurrency, UI/runtime/regression. No new approval request.

## 12. Readiness and limits

This is a scoped correction, not a restart of Sync design. Provider/Domain live
contracts remain unavailable and are not implemented. No finding is RESOLVED
without actual regression evidence. Final-head CI evidence may be recorded in PR
metadata after completion to avoid self-SHA documentation loops.
