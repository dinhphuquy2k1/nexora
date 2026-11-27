# NEXORA-058 — runtime security and configuration hardening v3

## 1. Task metadata and classification

Task ID: NEXORA-058
Classification: SIGNIFICANT
Documentation Impact: REQUIRED
Plan revision: rev-2026-11-27-controlled-activation-v3
Branch: feature/uniship-controlled-activation
PR: #64
Reviewed baseline: 02c2d05a5695ff292cdc2be5a7235170bac39580
Reviewed main: 2b31e7e6ba5891fb148e54b9cec5c1d0ae54c4be
Review date: 2026-11-27

Clean worktree and fetched PR/main match these revisions. No merged ENV/MFA
implementation was found in active tasks or recent PR history. v1/v2 remain
immutable; this revision supersedes their prospective hardening design only.

## 2. Requirements and boundaries

Keep Trusted Worker authority, including sync_jobs SELECT/INSERT/UPDATE. Separate
credential reads by purpose, require recovery proof for Worker password access,
authorize reconnect before mutation with generation/version CAS, align Compose
and strict Turbo propagation, and prove actual development process environment.
No live calls, production activation, new dependencies, public API/SDK changes,
business schema/enum changes, Identity/MFA/Origin changes, Sync algorithm changes,
Mapping/timezone/reconciliation changes, timeout/retry increases or new engine.
UNISHIP_LIVE_CONTRACT_VERIFIED remains false. No merge is authorized.

## 3. Canonical documentation and ownership

Read governance through docs/ai/README.md, task workflow, implementation workflow,
router and pre-code template; ADR007/008/009/010/011, backend/database/runtime/
sync-extensions/reuse architecture, configuration/setup/testing/deployment,
Shipment and Uniship contracts, task058 v2 and its verification/runbook. Carrier
owns credentials and lifecycle; Sync owns immutable jobs and leases; infrastructure
owns role capabilities, configuration and process composition. No new aggregate.

## 4. Inspection, findings and call-site scope

Search scope: apps/api/src/carrier, sync, worker; apps/api/test and integration;
packages/database migration/provision/test; turbo.json, compose\*.yml, scripts,
.env.example and canonical docs. Queries: AuthorizedCredentialReader, load,
locked, claim, acquireStored, performReconnect, sync*carrier_load, passThroughEnv,
SYNC*, CARRIER*, UNISHIP*, migration count and signed suite discovery.

Root causes: Vault.useToken uses combined reader.load; API locked selects all
secrets for metadata and snapshots; Worker combined SQL permits password without
recovery proof when ordinary lifecycle matches. Reconnect claims/increments before
outbound activation authorization. Generic Turbo dev drops task-specific runtime
variables. Compose API/Worker expose different Sync settings. Existing docs retain
API-only Carrier facts superseded by shared runtime.

Affected callers include CarrierLifecycleService, API adapter, Worker store,
Vault, lifecycle/vault tests, signed uniship runtime/security fixtures and direct
SQL capability tests. Existing separate uniship-runtime signed suite and 180000ms
budget remain intact.

## 5. Eight-field reuse audit

| Component       | Existing implementations                                                           | Domain owner                              | Reuse alternatives                                                               | Selected approach                                                                                                                  | Rationale                                                           | Risks                                                  | Verification                                                                                      |
| --------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Purpose readers | carrier-credential-vault.ts; carrier-lifecycle.adapter.ts; worker-carrier-store.ts | Carrier infrastructure                    | Generic selector, separate framework, narrow existing port                       | authorizeRecovery, loadToken, loadRecoveryPassword; shared private metadata authorization                                          | Least credential hydration without new orchestration                | Audit race, accidental token/password query            | Spy reader and native Prisma/role assertions; committed audit race                                |
| Worker SQL      | migration 20261124000000_uniship_controlled_runtime; provision-runtime.mjs         | Carrier persistence                       | Duplicate validators, broad grants, reuse scoped context                         | Metadata-only shared \_sync_carrier_context; private token helper and exact-proof recovery helper; three fixed public capabilities | Existing lock order and bounded store transactions                  | Legacy bypass, proof mismatch, migration compatibility | Restricted role matrix, proof negatives, 19/20 upgrades, repeat/drift/ACL                         |
| Reconnect       | carrier-lifecycle.service.ts; CarrierCredentialPort; uniship-sync.runtime.ts       | Carrier application and rollout authority | Duplicate policy, use recovery claim, narrow precheck plus explicit manual claim | authorizeReconnect delegates existing outbound authority; claimReconnect CAS generation/version allows REAUTH_REQUIRED             | No policy copy or manual/recovery semantic regression               | Race before claim, stale snapshot or disabled owner    | Denials leave version/credentials/jobs unchanged; valid manual statuses; concurrent changes       |
| Environment     | turbo.json; compose.yml; compose.release.yml; loadSyncConfig                       | Runtime infrastructure                    | Global env, loose mode, direct Node, task-scoped pass-through                    | API dev exact allowlist; shared/database watch-only; shared Compose anchors                                                        | Strict isolation and homogeneous settings without changing defaults | Key exposure to Web/build; empty values                | Resolved Turbo/Compose with synthetic env, parser errors, actual PID probe                        |
| Process proof   | scripts/dev-smoke.sh; existing signed Nest runtime fixture                         | Testing infrastructure                    | Container env only, debug endpoint, existing smoke plus proc probe               | Inspect actual HTTP server and Worker /proc environments; output only boolean assertions                                           | Proves process propagation while preserving canonical smoke         | Wrong PID, secret output, dev prerequisites            | Canonical smoke retains enrollment/login/HMR/drift/persistence/cleanup; loopback capability suite |

## 6. Alternatives and trade-offs

Reject broker/RLS/per-worker redesign: outside Trusted Worker decision. Reject
combined optional-secret loader: permits over-read. Reject duplicated scope SQL:
security drift. Reject passing expectedVersion into recovery claim for manual
reconnect: rejects legitimate REAUTH_REQUIRED. Reject global ENV/loose mode:
credential propagation outside API dev. Reject release image builds: unpublished
template is verified by resolved Compose only. No new dependency is needed.

## 7. Selected design and interfaces

AuthorizedCredentialReader exposes authorizeRecovery(): Promise<void>,
loadToken(): Promise<{token?: EncryptedSecret}>, loadRecoveryPassword():
Promise<{loginIdentifier: string|null; password?: EncryptedSecret}>.
useToken loads only token. acquireStored authorizes without secrets, independently
commits PASSWORD_DECRYPT, rechecks authorization loading only password, then decrypts
and uses existing acquisition. Audit failure blocks all password load/decrypt/HTTP.

API locked helper hydrates metadata only, purpose queries stay inside its current
transaction. read/claim obtain token revision only; complete obtains no secrets.
CarrierCredentialPort.authorizeReconnect reuses outbound.context without HTTP.
CarrierLifecyclePort.claimReconnect takes initial generation/version; API checks
both under existing locks, permits manual ERROR/REAUTH_REQUIRED; Worker rejects
manual operation. Recovery claim semantics are unchanged.

Forward migration21 replaces shared context with metadata-only validation. Snapshot
and claim explicitly add token-only projection. Private recovery helper requires
all connection/job/worker/lease/generation/version/operation/expiry facts, even
when ordinary job lifecycle matches. Fixed public token/auth/password capabilities
reuse these helpers; password path never calls token helper. Drop legacy combined
function, revoke PUBLIC/private helpers, grant only exact runtime functions.

## 8. Security, concurrency and performance

Preserve user→epoch→connection→job/proof lock order, transaction boundaries,
250ms lock/1000ms statement/2000ms store transaction bounds, ALS frozen identity,
operation token, process client ownership and shutdown. No HTTP, wait or crypto
under locks. Preserve active owner/provider/account/job strategy and expiry fences.
No direct secrets/proof/budget grants, users UPDATE, audit mutation, Identity keys,
admin credentials, DDL or private helper EXECUTE for Worker. A compromised trusted
runtime is not isolated absolutely; SQL proof does not itself prove audit commit.
Keep encryption/AAD, token revision, cancellation, acquisition/pacing/retry budgets.

## 9. Compatibility and migration strategy

No public API/OpenAPI/SDK/domain schema change. Migration21 changes functions/ACL
only and preserves records. Check 19→20→21 and 20→21, repeat deploy, drift and repeat
provision. Update real migration-count assertions. Old binary02c2d05 calls removed
combined capability: drain/stop API and Worker, migrate, provision, deploy matching
revision, restart. Rollback must retain compatible capability callers; never run
old binaries against removed loader or restore permissive loader to mask failure.
Keep volumes, credentials, key versions and historical migration bytes unchanged.

## 10. Verification-first plan

1. Record causal baseline A at02c2d05 with same behavioral assertions: token flow
   reads combined secret; no-claim legacy password succeeds; denied reconnect
   mutates; strict Turbo loses ENV; resolved Compose lacks parity. Missing new
   symbols/functions alone are not RED. Build, signed roles, storage and synthetic
   config must be correct; record harness revision.
2. Candidate tests: reader ordering/cancellation/audit failure and post-audit stale
   race; native restricted-role exact-proof positive/negative matrix, token-only
   API projections, immutable job and stale lease/recovery regressions.
3. Reconnect precheck denials, valid ERROR/REAUTH_REQUIRED, generation/version/delete
   races and zero HTTP/mutation; retain existing recovery singleflight/budgets.
4. Resolve Compose standard/dev/release/public via CLI with isolated synthetic env;
   verify defaults/empty/nondefault/invalid forwarding and parser rejection. Resolve
   Turbo strict dev tasks without logging full dry JSON. Actual API HTTP-server
   and Worker PID environments in existing dev-smoke with boolean output only.
5. Targeted units, genuine signed PostgreSQL, upgrade/repeat/drift, original suites,
   format/lint/test:lint/docs/test:docs/preflight/test:preflight/typecheck/contracts/
   quality, canonical Docker gates, independent read-only review, exact new source
   and merge checkout CI Preflight/Sync/Foundation. Preserve 180000ms suite budgets.
   Bound unrelated investigation to three attempts; then PLAN ISSUE, not retries.

## 11. Readiness and evidence governance

Plan recorded before source/tests; no owner approval gate. Keep canonical task
Result column PASS/FAIL only; unexecuted gates are adjacent limitations, never
claims. Record source/harness/merge SHA, exact command/time/environment, expected
and actual behavior, run/job/attempt and sanitized assertions. Baseline green CI
is historical, never candidate proof. Preserve existing FAILs and immutable plans.
After implementation request independent read-only review; do not equate self-review
with approval. Task remains VERIFICATION PENDING for external authorization and
production acceptance. No live requests or merge.

## 12. Unresolved plan issues

NONE in selected scope. Local Docker currently has only PostgreSQL image and about
1.3GiB free; unavailable canonical local gates must be recorded as limitations,
with hosted exact-HEAD evidence reported separately. No release image pull/build.
