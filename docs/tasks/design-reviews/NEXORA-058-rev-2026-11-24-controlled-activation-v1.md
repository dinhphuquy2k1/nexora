# NEXORA-058 — controlled Uniship technical readiness v1

## 1. Identity and baseline

Task ID: NEXORA-058
Classification: SIGNIFICANT
Plan revision: rev-2026-11-24-controlled-activation-v1
Reviewed baseline: 5edbcfe1609562f9eb5b6c156cf5cec68b5b71fa
Branch: feature/uniship-controlled-activation
Documentation Impact: REQUIRED

PR61 merged at this exact main revision2026-11-24T09:48:23Z. Its source fefb596
and actual CI merge35926ac have green Preflight45363231656,Sync45363231695,
Foundation45363231555 attempt1. First task commit closes062 and records this plan
before source/tests. Frozen062v1–v3 remain immutable.058 stays active for external
activation gates, even after its technical-readiness PR merges.

## 2. Scope and explicit exclusions

Implement one shared API/Worker composition, existing Carrier recovery/vault with
scoped Worker authority, cancellation, cross-process per-connection HTTP pacing,
account-scoped manual/AUTO eligibility and optional strict reconciliation config.
Use existing Sync Engine/queue/worker, FULL query100/uniship-parcel-v1, processor1
and reconciliation1. No Mapping V2/timezone/visibility algorithm change, live calls,
production activation, production thresholds, new provider, UI or public DTO/SDK.
The fixed live-contract false gate remains false; no ENV can bypass it.

## 3. Inspection and canonical ownership

Read AI entry/governance/router, ADR007/008/009/011 and task062/v3/evidence; inspect
Sync extension/backend/runtime/database/API/reuse docs, Shipment/Uniship contract,
configuration/deployment/testing and existing058 external gates. Source inventory:
Carrier lifecycle service/ports/adapter/vault/audit; Uniship adapter/HTTP/acquisition
budget; Shipment provider/processor/binding/reconciliation; Sync registry/repository/
executor; AppModule/SyncWorkerModule/entrypoint, Compose, provision-runtime, fixed
sync_lock functions and migration fixtures. Query symbols: createSyncRuntimeCapabilities,
withToken/recover/claim/complete/load, fence/assertLease/admit/schedule/claim/wait,
UNISHIP_LIVE_CONTRACT_VERIFIED, ProviderBudget, SECURITY DEFINER/runtime ACLs.

Current production registry empty. API has full Carrier composition; Worker has
only restricted SyncRepository and no secret/key dependencies. Lifecycle active()
locks users FOR UPDATE and upserts epoch; locked() reads all sealed secrets, so
normal adapter cannot run on Worker credentials. Recovery increments connection
version at claim and completion, invalidating admitted job provenance. HTTP auth
and verify use acquisition budget; data GETs have no per-connection spacing. Default
onboarding enabled60-minute schedules and Manual independence must be preserved.

## 4. Mandatory eight-field reuse audit

| Component            | Existing Implementations                                                                                                                   | Domain Owner                                                     | Reuse Alternatives                                                | Selected Approach                                                                                      | Rationale                                                                 | Risks                                                                     | Verification                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Composition          | sync-runtime-capabilities.ts; app.module.ts; worker/sync-worker.module.ts                                                                  | Sync declaration; Carrier construction                           | Shared helper versus copied module or second registry             | One explicit dependency factory and one registration source; separate process/role instances           | Existing contracts and shutdown ownership                                 | Accidental API boot in Worker; inconsistent snapshots                     | Actual Nest API/Worker local mock and OFF contracts                    |
| Recovery/custody     | CarrierConnectionLifecycleService; CarrierCredentialVault; CarrierLifecycleAdapter; PostgresSecurityAudit; SecretCipher/EnvironmentKeyring | Carrier business orchestration; infrastructure SQL/crypto        | Broad ACLs versus scoped fixed functions                          | Reuse orchestration/vault/AAD/audit; Worker port calls only fixed job-scoped persistence               | Preserve recovery budgets/CAS without secret-table SELECT or users UPDATE | Scope forgery, reconnect/disable, recovery claim proof and audit ordering | Real nexora_sync positive/negative grants, failure injection and races |
| Pacing               | PostgresProviderBudget; ProviderBudget; UnishipHttpClient GET/POST                                                                         | Carrier/Uniship infrastructure                                   | Reuse provider slots incorrectly versus separate compact state    | Keep acquisition budget; add shared connection/pending permit at actual dispatch                       | Different concurrency and spacing responsibilities                        | Abandoned lease, stale release/cooldown, DB failure                       | Mock server arrival times across processes, takeover/abort/429/5xx     |
| Activation/admission | SyncRepository admit/schedule/claim/fence; existing immutable config                                                                       | Carrier rollout authorization; Sync generic eligibility boundary | Registry account lookup versus explicit trusted runtime predicate | Inject scoped immutable eligibility, filter SQL before candidate selection, recheck under normal fence | No Uniship branch in generic executor; no AUTO starvation                 | Old AUTO lane blocks manual, API/Worker disagreement                      | Existing due/new schedules/direct AUTO/old jobs/cursor tests           |
| Reconciliation       | reconciliationPolicy(); createShipmentSyncBinding()                                                                                        | Shipment domain; runtime parsing boundary                        | Duplicate validator versus reuse                                  | One optional JSON parser delegates strict policy validation and freezes                                | Keep v3 semantics; absent means no hide or restore                        | Malformed silently defaults; heterogeneous deployment                     | Boundaries/unknown keys/absence, existing real reconciliation suite    |
| Validation/testing   | isUuid; strict source guards; Node test runner; owned signed PG fixtures                                                                   | Common technical + existing test ownership                       | New libraries/framework versus existing primitives                | Reuse canonical validation and approved owned launchers; task storage readiness                        | No dependency or synthetic proof inflation                                | Missed discovery/prerequisite; privilege self-certification               | Actual discovery, signed roles/mock runtime, quality and exact-head CI |

## 5. Domain and concurrency model

Carrier owns verified credential identity/recovery and rollout authorization; Sync
owns job admission/leases/provenance/terminal states; Shipment retains aggregate and
reconciliation ownership. No new business aggregate, generic framework, event bus
or queue. Set-based infrastructure capabilities deliberately omit aggregate hydration:
they lock only authorization/CAS facts and apply narrow existing Carrier mutations.
Pure policies remain outside Prisma/HTTP. Application ports may gain optional typed
execution cancellation/context; no public transport change. Existing scalar codes
remain canonical, new policy modes are internal config vocabulary, never DB enums.

Preserve user→epoch→connection→job/operation lock order. Network, pacing wait and
crypto occur after short DB transactions. Worker uses fixed read/share user/epoch
capabilities; no UPDATE users grant. API mutation retains its current authorization.

## 6. Worker credential capability design

Use a role-specific infrastructure implementation of existing CarrierLifecyclePort
and AuthorizedCredentialReader. It shares one process Prisma client and uses fixed
SECURITY DEFINER operations with typed parameters, qualified identifiers,
search_path=pg_catalog, PUBLIC revoked, narrowly granted EXECUTE. Each operation
validates owned RUNNING job/worker/lease/unexpired lease, user/owner/provider/account,
generation and relevant expected connection lifecycle. The wrapper binds trusted
job context within the fetch execution, never an arbitrary public connection UUID.

Recovery requires proof after its own claim changes lifecycle. A small private
connection-keyed recovery authorization row records job/worker/lease version,
expected generation/claimed connection version and an unguessable operation token.
Without it a manual reconnect's version increment cannot be distinguished from the
Worker's own claim. This is a scoped persistence capability lease, not a child job,
second recovery engine, baseline or queue. No runtime table SELECT/UPDATE grant;
functions create/validate/delete it under existing locks/CAS. Connection/job FK
cleanup and replacement on a new valid claim bound retained state; no cleanup service.
After recovery completes, the original job still has its original version and
cannot stage/apply/finalize. Next job uses the verified replacement token.

Reuse PostgresSecurityAudit with only append INSERT and SELECT(id) where needed;
no UPDATE/DELETE/history rights or arbitrary JSON audit payload. PASSWORD_DECRYPT
append commits independently before reader revalidation and decrypt; replacement
and recovery-success audit remain atomic. SQL performs fixed scoped persistence,
not duplicated retry/identity/business policy. A compromised trusted Worker remains
within a documented privileged custody boundary; functions are not RLS or absolute
protection from arbitrary trusted-process misuse. API/Identity master keys stay apart.

## 7. Cancellation and stale jobs

Propagate optional execution signal through lifecycle wait/vault/provider acquisition,
rate admission, auth/verify and GETs; recheck before dispatch. Preserve one password
attempt/one operation retry/three rechecks and singleflight. Shared recovery owns
its controller with participating waiters; cancelling one waiter must not cancel
another's shared recovery; no participants can abort safe remaining work. Keep
cross-process CAS, not an in-memory authorization substitute.

Do not rewrite sync_jobs.lifecycle_version or relax fence. Reuse/extract narrowly
conditional stale cancellation: only same RUNNING worker/lease, exact scope and
proven lifecycle/generation invalidation under normal lock order; successor untouched.
Executor can request that cancellation on SYNC_STALE; otherwise reclaim remains.
Manual user retries after terminalization; AUTO follows normal due/eligible scheduler.
No transfer of incomplete seen pages/baseline to a new job. Existing cancelled seen
cleanup remains the owner. No new status, retry, timeout or lease increase.

## 8. Per-dispatch HTTP permit

Forward migration adds a compact rate-state table keyed by provider/owner and either
validated connection or stable owner pending acquisition bucket. No token/username/
password/request log in key or diagnostics. Auth+verify of new acquisition share the
same pending bucket; persisted reconnect/recovery/warehouse/shipment share connection
bucket, derived server-side. API and Worker use same PostgreSQL time and permit
implementation; Worker access is scoped through fixed capabilities rather than broad
rate/secret mutation grants. Existing acquisition provider slots stay independent.

Reserve exclusive permit in short row-locked transaction, release locks, recheck
signal/lease before fetch, then conditionally finish with unique token. Completion
sets at least1s before next request; bounded lease expiry permits reclaim without
stale holder clearing successor/cooldown. Request timeout remains5s, page20s, lease60s;
permit lifetime must exceed bounded HTTP plus bookkeeping margin. Await normal
one-second gaps with cancellation; long cooldown yields retry/backoff, not minute
sleeps or normal pacing retry storms.429 honors capped Retry-After,5xx/network uses
existing bounded backoff, conditional completion never clears newer cooldown.
No absolute guarantee claimed for unobservable already-dispatched requests across
process/network failure. Database unavailable or production missing typed context
fails closed. Existing loopback fixtures may use explicit test seams; production
composition always supplies the real limiter. Enforce common target validation:
allowed four routes, reviewed HTTPS kh.uniship.vn origin for future external use,
no URL credentials/redirect/TLS bypass; live gate still false.

## 9. Scoped activation and reconciliation configuration

A single narrow activation-policy JSON input declares ownerUserId,
externalAccountId,loginIdentifier, mode MANUAL_ONLY/AUTOMATIC and optional specific
connectionId. Absent is OFF; malformed nonempty fails safely, no raw input logging.
Actual operational/live/contract gates remain separate. Verified account must match
before credential persistence or Shipment fetch; pre-verification acquisition checks
approved owner/login. Shared declaration/processor/scan/policy snapshots across API
and Worker, no account-specific registry resolution. Default schedules stay enabled60
and persisted15/30 intent is not rewritten. AUTO requires AUTOMATIC plus enabled/due
and interval>=60; Manual remains independent of schedule enabled/due. Generic Sync
eligibility injection supports trusted SQL filtering before claim/schedule plus
under-lock admission/fence recheck, not a Uniship branch in executor.

Old blocked AUTO candidates cannot starve eligible work. Owner-authorized Manual
admission may cancel its own blocked AUTO lane under existing owner/connection/job
locks and lease-version invalidation before creating a Manual job; preserve running
successor/fencing checks and verify races. Ineligible foreign jobs stay untouched.
No schedule-intent reset or global interval validation/API/UI change.

UNISHIP_RECONCILIATION_POLICY_JSON absent/empty yields undefined. Nonempty parse
must delegate reconciliationPolicy(), throw safe config error if undefined, preserve
strict three-field int32/BPS limits and freeze. No default values in env example.
No per-job policy snapshot or hot reload. Operator drains/stops, deploys homogeneous
API/Worker config/revision and restarts before resuming. OFF disables hide and restore;
skipped scans never establish a trusted baseline. Production values remain owner gate.

## 10. Migration, permissions and rollback

One forward migration after existing19 supplies required fixed worker credential
functions, private recovery proof and shared HTTP rate state/operations. Preserve all
old data/checksums, no speculative indexes beyond keys/necessary FK access. Provision
EXECUTE and narrow audit append only to relevant roles, explicitly remove obsolete
excessive ACLs on repeated provisioning; no secrets broad SELECT, connection DELETE,
Identity/MFA/user updates/admin rights. Migrate before re-provision/runtime startup.
Verify physical CHECKs/functions/ACLs and native positive/negative writes under real
role passwords, baseline19→new upgrade/repeat/drift and runtime count expectations.
Rollback stops admission/drains Worker, disables live authorization and runs previous
compatible binaries with new additive schema; no destructive down migration, key
rotation, volume reset or timestamp repair. Keep old referenced key versions.

## 11. Verification and documentation

RED first: config/eligibility/composition/cancellation/HTTP-pacing tests; genuine
PostgreSQL real runtime roles, SQL ACL/parity, auth/verify/mock receive timing,
reconnect/disable/delete/lease takeover/stale worker cancellation, real Nest API+Worker
mock FULL with absent/configured synthetic reconciliation. Test own namespaces,
STORAGE_ROOT/config/Sync/origins/keys/signed DB/readiness before execution. Discovery
must include new tests in normal/targeted/canonical suites. Existing Carrier/Sync/
Shipment/reconciliation/API/Identity/MFA regressions unchanged. Run pinned quality,
contracts/docs/preflight and available canonical Docker; concrete NOT RUN blockers,
not substitute PASS. No retry-until-green on unrelated failures.

Update canonical Sync/backend/runtime/database/configuration/deployment/testing,
Uniship/Shipment only for changed facts, dated ADR007 custody/rollout amendment,
active058/evidence and external evidence matrix. Runbook stages safe deployment,
manual-only activation after external gates, first FULL, three-parcel timezone check,
explicit threshold policy activation, approved AUTO>=60 and incident stop/recovery.
Existing owner-confirmed facts retained; unknowns never promoted by fixtures.
Independent read-only security/code review, final-head Preflight/Sync/Foundation
source+actual merge/run/job/attempt/steps/counts in PR description, no self merge.

## 12. Alternatives, readiness and remaining gates

Rejected broad worker ACLs/admin URL, copied lifecycle orchestration, API RPC/HTTP
proxy, second registry/engine, process-only pacing, connection UUID in provider slot,
rewritten job provenance, longer timeouts, default thresholds, global disabled
onboarding schedules or mock gate promoted to live proof. Scoped operations and
private claim proof are necessary to preserve current fences/custody with existing
worker role. No unresolved ownership PLAN ISSUE; exact grant/performance/race behavior
must be proven before acceptance. Material discoveries require a new snapshot before
changing design, not new owner approval. Technical readiness does not close official
contract/ID stability/page consistency/claim/OldStatus/null-complete/maxima/timezone,
host/TLS/NTP/custody/password-rotation/live/manual/AUTO gates. Owner alone activates.
