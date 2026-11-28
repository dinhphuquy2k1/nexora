# NEXORA-067 — Controlled Uniship Carrier authorization

## 1. Task metadata

Task ID: NEXORA-067
Classification: SIGNIFICANT
Documentation Impact: REQUIRED
Plan revision: rev-2026-11-28-controlled-live-v1
Reviewed baseline: f06db70e9dae50d95d724ce03f03a593315876fa
Branch: feat/uniship-controlled-live-activation

## 2. Scope and requirements

Protect interactive Carrier connect/reconnect and Worker shared transport against
missing external account scope, independently of SYNC_ENABLED. Reuse parser and
lifecycle; no new ENV, endpoint, table, grant, runtime service, framework or UI.
No live request, owner configuration/deployment, manual FULL, AUTO or reconciliation.
Open hard gate only with recorded canonical prerequisites and explicit operational
authorization. Current evidence does not establish those facts: keep false.

## 3. Canonical owners and current gates

ADR007 point6 is owner-confirmed2026-11-15, not independent provider evidence.
Points1–5 retain their confidence; exact expired-token/is_verified/TTL observations,
historical exposure invalidation and separate gate-opening permission are not
established by this implementation request. Preserve original facts and no-backup
policy. Configuration/backend/sync-extensions/testing/integration contract and
canonical058 staged runbook own changed runtime facts.

## 4. Read-only inspection

Search new UnishipHttpClient, createCarrierRuntime and new UnishipSyncRuntime.
Production has one client construction in Carrier runtime, called by shared Sync
composition used in app.module.ts and worker/sync-worker.module.ts. Read all listed
Carrier lifecycle/vault/store/adapter/routes and existing runtime tests. target()
already owns origin/route/HTTPS/live/hard checks for availability and POST/GET
admission/dispatch. authorizeReconnect runs before claim; verified callback runs
before encryption/persistence. Preserve both orderings.

## 5. Reuse audit

| Field                    | Transport composition                                                                                                                                                                | Scoped lifecycle and verification                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Parsed activation-presence gate                                                                                                                                                      | Existing outbound authorization callbacks/tests                                                                                                                                                                                                                  |
| Existing implementations | apps/api/src/carrier/infrastructure/uniship/uniship-http.client.ts; apps/api/src/carrier/infrastructure/carrier-runtime.ts; apps/api/src/sync/infrastructure/uniship-sync.runtime.ts | apps/api/src/sync/infrastructure/uniship-sync.config.ts; apps/api/src/carrier/application/carrier-connection-lifecycle.service.ts; apps/api/src/carrier/infrastructure/carrier-credential-vault.ts; apps/api/integration/fixtures/uniship-runtime-activation.cjs |
| Domain owner             | Carrier/Sync infrastructure composition                                                                                                                                              | Existing Carrier application; tests own synthetic fixtures                                                                                                                                                                                                       |
| Reuse alternatives       | New ENV/parser, duplicated URL classification, one derived constructor boolean                                                                                                       | New lifecycle framework, move checks after persistence, existing context/verified hooks                                                                                                                                                                          |
| Selected approach        | activationConfigured defaults false; derive settings.activation!==undefined once; pass boolean through Carrier factory; enforce same target() gate                                   | Preserve owner/login/optional connection/snapshot/candidate checks; existing loopback fixtures test positive scope; extend existing unit/integration suites                                                                                                      |
| Rationale                | Default-deny transport without cycles or repeated configuration                                                                                                                      | Correct pre-provider/pre-claim/pre-encrypt order without state mutation                                                                                                                                                                                          |
| Risks                    | Vacuous hard-closed tests; stray direct constructor; accidental Sync coupling                                                                                                        | Scope denial claims lifecycle; candidate persistence; dispatch in external tests                                                                                                                                                                                 |
| Verification             | RED composition constructor-option contract; denied actual POST/GET with fetch fail-on-dispatch; production construction search                                                      | Synthetic connect/reconnect and signed PostgreSQL fixture state comparisons; unchanged security/fencing suites; no real account/network                                                                                                                          |

## 6. Alternatives

Reject SYNC_ENABLED as Carrier permission: interactive Carrier must remain independent.
Reject new URL regex/allowlist, environment bypass, gate override, parser or copied
lifecycle. Internal boolean conveys parsed policy presence only, not scope success.
Do not flip a compiled hard-gate constant in tests or invent production permission.

## 7. Design and DDD boundaries

Add internal activationConfigured?:boolean to HTTP options, defaultfalse. Thread
one boolean (factory defaultfalse) from the shared parsed settings. Extend the
existing external condition inside target(); no second URL validator. Availability
and actual request gate continue sharing target(). Existing operational check makes
policy-absent return valid only for nonproduction loopback. Clarify that invariant.
This is infrastructure authorization, no new aggregate/use-case/port/domain feature.
Keep scope/mismatch errors sanitized and unchanged. Preserve all lifecycle/vault,
Worker custody/audit/fences, SQL locks, budgets and rate/backoff behavior.

## 8. Security and concurrency

No external request is authorized during development/CI. External tests stub fetch
and prove zero dispatch; only real loopback fixture providers may respond. Use
synthetic IDs/passwords/tokens. No raw credentials/ENV/payload output. Connect denies
scope before provider; reconnect before claim; verified account before encryption.
No DB transaction/network reordering or Worker grant changes. Retain all data/keys;
no backup/restore/clone/drill or new related work.

## 9. Compatibility and closure

Blank parser stays undefined; nonproduction loopback remains available, production
loopback composition unavailable. Existing Sync eligibility/manual/AUTO intent
unchanged. API/SDK/schema/UI/default templates unchanged. First commit closes066
with source/merge/hosted receipts, transfers existing host gates to046 and remaining
external/runtime/data acceptance to PLANNED068;067 owns existing empty-policy issue.
These are required closure transfers, not new acceptance or backup work.

## 10. Test-first verification

Extend existing runtime composition and transport tests, build and capture RED
before source edits. Test internal constructor-presence propagation separately
from external availability: hardfalse still denies even valid policy. This proves
safe closure, not authorized external-positive behavior; use actual loopback plus
synthetic doubles to exercise scoped connect/reconnect with SyncOFF. Do not call
provider or claim the closed gate opened. Extend existing signed activation fixture
for connect/account denial and preservation; keep Worker/fencing regressions.
Run requested six targeted suites, full API tests, format/lint/typecheck/contracts/
docs/preflight/docs-tests/preflight-tests, available signed integration. Hosted
Preflight/Foundation/SyncTargeted on final source. No optional stress or blind rerun.

## 11. Governance and evidence

Record formatted v1 raw SHA in task and five PR metadata lines before code/tests.
Preserve066 historical FAIL/PASS and immutable snapshots. Separate local host,
canonical Docker, hosted source/merge/run/job/attempt and actual live evidence.
Local Docker images/disk may prevent integration; record NOT RUN and use required
hosted signed checks, never owner DB. Independent read-only review before delivery.

## 12. PLAN ISSUES and stop conditions

Hard gate remains false pending canonical live evidence/exposure invalidation and
explicit gate-opening authorization. Protection can ship independently; never call
it completed live activation. No new prerequisite beyond canonical contract.
Stop/replan after three unresolved attempts or out-of-scope technical failure;
no harness/timeout/retry/workflow changes to force green. No merge.
