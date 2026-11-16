# NEXORA-056 — Auto provision Sync configuration and simplify runtime flags

Task ID: NEXORA-056
Classification: SIGNIFICANT
Plan revision: rev-2026-11-16-auto-provision-sync-v1
Reviewed baseline: 58223828a733f706d4ef058fac64b193556bde70
Branch: feat/auto-provision-sync-configuration

## 1. Requirements and scope

New Uniship connection atomically stores its encrypted credentials, one enabled
SHIPMENT configuration at60 minutes with first due exactly DB-created connection
created_at+60minutes, and success audit. No job is created. Remove per-type runtime
flags and runtime config.types. Keep global SYNC_ENABLED=false default and strict
boolean validation, technical tuning bounds, static exact-pair capability resolution
and all scheduler/worker/fencing/locks/retry/performance contracts. Production
registry and Uniship external-request hard gates stay byte-identical.

## 2. Read-only inspection and canonical documents

Read AGENTS/AI entry routes, project/context/rules/task/implementation workflows,
ADR007/008/009/010, backend/database/sync-extensions/reuse/configuration/testing,
Uniship contract and both repo review skills/template. Searched get defaults,
CarrierLifecycleAdapter.create/complete/secrets/active, SyncConfig/SyncType,
loadSyncConfig/config.types, available/admissible/admit/claim/schedule/fence,
configs/configure, type flags across source/Compose/tests/docs and real PG fixtures.
Current create hardcodes the already Uniship-only connection provider and stores
secrets/audit under actor/generation transaction; no defaults exist. Metadata
select includes DB createdAt. SyncConfig has TIMESTAMPTZ(3), unique connection/type
and cascade. Registry already resolves exact supported strategy/domain version.
claim/schedule already select eligible DB provider/type pairs; remove only redundant
environment-type filtering. Generic PATCH accepts15/30/60/120/240; keep it unchanged.

PR54 merge58223828 was verified through GitHub and origin/main; first commit01f5513
closes055, retains failures and transfers non-CI prerequisites to PLANNED047/057/058.
No schema, grant or historical migration change is needed.

## 3. Reuse audit

| Field                    | Defaults/provisioning                                                                                                                                                                                                               | Runtime eligibility                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Component                | Pure provider default policy plus create transaction                                                                                                                                                                                | Existing loadSyncConfig and SyncRepository                                                                                  |
| Existing implementations | carrier/domain/carrier.ts; CarrierLifecycleAdapter.create/secrets; shared SyncType; Prisma SyncConfig                                                                                                                               | sync-policy.ts; sync-capability.registry.ts; sync-job.repository.ts; same runtime factories                                 |
| Domain owner             | Carrier owns connection onboarding default policy; Sync owns schedule execution                                                                                                                                                     | Sync owns global control and exact-pair dispatch                                                                            |
| Reuse alternatives       | Reuse immutable provider constants and existing child insert; reject generic framework, post-commit service/event, activation state and request defaults                                                                            | Reuse registry and existing eligible pair filters; reject ENV/DB handler discovery or replacement flags                     |
| Selected approach        | carrier/domain/default-sync-policy.ts imports only Carrier codes and Shared sync-status; immutable readonly defaults, unknown provider empty; adapter calls resolver with connection.provider and creates child in same transaction | Remove types from config; global enabled plus registry only; keep eligible pair SQL/row-lock/fence checks                   |
| Rationale                | No Carrier/Sync cycle, app/domain Prisma or duplicate scheduler/policy                                                                                                                                                              | One available/admissible rule shared by API and worker                                                                      |
| Risks                    | Partial commit, clock skew, resets on reconnect, accidental customer defaults                                                                                                                                                       | Unsupported claim, manual schedule coupling, stale config tests, changing tuning/bounds                                     |
| Verification             | Unit immutability/unknown/no duplicates, genuine PG exact timestamp/rollback/reconnect/delete/independent owners and GET                                                                                                            | Global/registry unit RED/GREEN, supported/unsupported PG claim/scheduling, existing lease/cancellation/capacity regressions |

## 4. Selected defaults and time contract

getDefaultSyncPolicies(provider:string):readonly DefaultSyncPolicy[] where each
entry is readonly {syncType:SyncType,enabled:boolean,intervalMinutes:number}.
A string boundary matches persisted connection.provider and supports unknown future
providers returning an empty frozen list. The Uniship entry is deeply frozen with
canonical SyncType.SHIPMENT, enabled=true,60minutes. No CUSTOMER default, dependency
or provider-specific branch in the generic provisioning call.

Use the database-returned connection.createdAt Date (TIMESTAMPTZ(3)), adding exactly
intervalMinutes\*60000 UTC milliseconds for next_run_at. Both source and destination
retain millisecond precision; tests compare with PostgreSQL interval arithmetic.
No application now(), frontend time, timezone conversion, HTTP or crypto under locks.
Nullable history/watermark fields remain SQL NULL defaults. Use INSERT, not upsert:
a duplicate policy is an error and must roll back, not hide a partial write.

## 5. Tactical DDD and consistency boundary

This is a scoped adoption assessment for grandfathered Carrier lifecycle, not a
Carrier aggregate rewrite. A pure onboarding policy owns the business default;
existing application services authenticate/seal outside locks and command the
existing port. Infrastructure retains actor->epoch/generation->connection/children
transaction, global account uniqueness, encryption persistence and success audit.
The new child config participates in that consistency boundary. Stateless policy
needs no entity/VO/generic repository. Sync schedule records stay Sync-owned;
Carrier infrastructure may create them without importing Sync application or
infrastructure. Shared SyncType is the existing approved code-only contract.

## 6. Runtime control and scheduler behavior

SyncConfig retains enabled/leaseSeconds/pollMs/maxAttempts/retentionDays only.
admissible requires global enabled and registry.resolve(provider,type). claim()
still obtains DB distinct pairs, filters by registry, then selects eligible pairs
with SKIP LOCKED; remove only sync_type ANY(config.types) and early types.length.
schedule() keeps existing ACTIVE/CONNECTED/due/enabled/no-active query, keyset
continuation and completion-based updates. No new scheduler, job-per-missed-hour,
queue ordering, retry/lock/final-fence/lease or processor-version change.

MANUAL keeps its existing admission contract without requiring an enabled/due
schedule. AUTO remains the existing scheduler's enabled/due selection and atomic
admission/idempotency path; do not redesign direct internal AUTO admission semantics.
Global false blocks admission, claim and scheduling. Empty/unsupported production
registry makes enabled persisted configs unavailable and unable to execute.

## 7. Compatibility and limits

POST connection and GET/PATCH Sync config wire shapes stay unchanged; GET observes
the new persisted row even when runtime available=false. Reconnect never invokes
the provisioning resolver or resets schedules/watermarks; hard delete uses FK
cascade. No backfill for existing connections, schema/migration/grant changes,
SDK/Shared vocabulary additions or frontend changes. Existing Uniship-only creation
provider assignment is not generalized by this task; resolver consumes actual
created connection.provider rather than a hardcoded Uniship argument.

Default60 is not a new global minimum. Keep PATCH's existing interval allowlist;
provider-specific activation/rate constraints belong to057/058 after verification.
No live Uniship access, worker credential decryption, production registration,
Customer Sync, activation field, new table or unrelated ENV changes.

## 8. Security, concurrency and performance

Existing ACTIVE actor and generation checks, unique provider/account, lifecycle
version, durable audit and safe errors remain. All defaults insert before success
audit under the same transaction; forced config failure leaves no connection,
secret, config or success audit. An independent late audit failure must also roll
back the config. API/worker globals use same resolver; eligible pair predicates
remain before worker selection. Keep worker role/grants and all source/lease/fence
rollback contracts, LIMIT100,15000ms transaction and7500ms capacity bounds.
Provisioning adds only a bounded insert per provider policy (one today).

## 9. Test-first plan

1. Commit this SIGNIFICANT plan/snapshot and digest before implementation/tests.
2. Unit RED default policy, global-only runtime config, capability admission with
   no type list and empty registry; update old type-disabled tests to exact-pair
   unavailable cases without removing assertions.
3. Genuine PG Carrier RED: create config/time/nulls/no job/GET availability;
   config-trigger rollback; late audit rollback; duplicate, reconnect snapshots,
   independent connections/owners and cascade. Use existing local mock transport.
4. Genuine PG Sync RED with global-only config: future/due/disabled/unsupported/
   overdue scheduling, single active lane, manual without enabled schedule,
   unsupported provider/type excluded before claim. Retain all existing regressions.
5. Implement policy, transactional insert and remove type flags/config types from
   source, tests, Compose/env/scripts. Keep historical tasks/snapshots unchanged.
6. GREEN targeted builds/unit/Carrier/Sync/Shipment tests, lint/test:lint, typecheck,
   contracts/docs/preflight, full tests/integration/quality; canonical Docker attempt
   and final-head Preflight/Sync Targeted/Foundation. Isolate PG/projects/volumes.
7. Apply implementation-code-review checklist, fix scoped P1/P2, record whether
   independent reviewer unavailable rather than invent approval; owner review stays.
8. Commit/push new branch and create PR bound to056/revision/snapshot/digest. Inspect
   exact final HEAD/actual CI checkout/attempt/run URLs. No merge or auto-approval.

## 10. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Onboarding transaction creates provider defaults; schedules and global switch plus
static capability registry own execution; type environment flags are retired.

### Canonical owners

- docs/architecture/backend.md
- docs/architecture/database.md
- docs/architecture/sync-extensions.md
- docs/decisions/sync-worker-staging.md (dated amendment, preserve history)
- docs/operations/configuration.md
- docs/operations/testing.md

### Verification

Pinned format/lint/test:lint/typecheck/docs/preflight/contracts, tests/integration/
quality and canonical Docker/runtime/exact-head hosted checks; command provenance
and failures in task/PR. No unexecuted assertion is PASS.

## 11. Acceptance

- [ ] Exactly one enabled SHIPMENT/60 config on new Uniship connection, first due
      DB created_at+60minutes, all history NULL; no job and no request fields added.
- [ ] Resolver uses actual provider, unknown provider empty, immutable/unique defaults.
- [ ] Config/secrets/connection/success audit atomic, real rollback tests PASS.
- [ ] Duplicate/owner/generation/audit boundaries preserved; reconnect unchanged;
      hard-delete cascade and independent schedules verified.
- [ ] Type flags/types removed from current source/config/tests; technical tuning
      unchanged; global false and exact-pair capability fail closed in both processes.
- [ ] Due scheduling/no catch-up duplication and unsupported claim verified; manual
      remains independent of schedule; original fences/leases/capacity preserved.
- [ ] No migration/backfill/grant/contract/frontend/live-gate/production-registry drift.
- [ ] Documentation, meaningful regressions, full quality and exact-head CI evidence.

## 12. Plan issues and governance

NONE unresolved. Policy placement avoids Sync->Carrier->Sync imports. Defaults are
not runtime capability declarations. API interval behavior is deliberately retained,
not silently tightened to a new provider minimum. Historical snapshots remain
immutable. Owner approval is not a pre-code gate; no live activation is authorized.
