# NEXORA-067 — Controlled Uniship Carrier live authorization

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Scope and boundaries

Owner prompt2026-11-28: protect existing Carrier connect/reconnect through the UI,
using current account-scoped activation, shared API/Worker composition and transport.
No UI/API/schema/grant/engine/lifecycle redesign. No live request, owner deployment,
ENV/key changes, manual FULL, AUTO, reconciliation or backup/restore work.
Hard gate stays false until canonical prerequisites and explicit operational
permission are recorded; code implementation is not permission to open the gate.

## Design Review & Reuse Decision

Task ID: NEXORA-067
Classification: SIGNIFICANT
Plan revision: rev-2026-11-28-controlled-live-v1
Reviewed baseline: f06db70e9dae50d95d724ce03f03a593315876fa
Design Snapshot: docs/tasks/design-reviews/NEXORA-067-rev-2026-11-28-controlled-live-v1.md
Design SHA-256: b3aa01d58c43bac0f6f00c1a82b79d2d79ec0fea90eeaf6932b4b0fc2f2ef3b6

| Field                    | Transport and scope                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Internal parsed activation-presence gate and existing outbound scope authority                                                                                                                                                                                                                                                                                               |
| Existing implementations | apps/api/src/carrier/infrastructure/uniship/uniship-http.client.ts; apps/api/src/carrier/infrastructure/carrier-runtime.ts; apps/api/src/sync/infrastructure/uniship-sync.runtime.ts; apps/api/src/sync/infrastructure/uniship-sync.config.ts; apps/api/src/carrier/infrastructure/carrier-credential-vault.ts; apps/api/integration/fixtures/uniship-runtime-activation.cjs |
| Domain owner             | Carrier/Sync infrastructure; existing Carrier application owns lifecycle                                                                                                                                                                                                                                                                                                     |
| Reuse alternatives       | New ENV/parser/URL classifier or lifecycle framework versus one derived boolean in existing composition                                                                                                                                                                                                                                                                      |
| Selected approach        | activationConfigured defaultsfalse; derive once from parsed policy; use existing target() for availability/dispatch; retain context/verified callbacks and scoped error semantics                                                                                                                                                                                            |
| Rationale                | Fail-closed by default without Sync coupling, cycles or duplicated business logic                                                                                                                                                                                                                                                                                            |
| Risks                    | Vacuous hardclosed tests, stray constructor, claim/encrypt before denial, accidental external dispatch                                                                                                                                                                                                                                                                       |
| Verification             | RED constructor-option propagation, actual denied POST/GET zero-fetch; real loopback and test doubles for scope; signed PostgreSQL preservation; required hosted gates                                                                                                                                                                                                       |

No new Aggregate/Value Object/application port. Transport validates permission
presence; existing scope callback remains responsible for exact owner/login/optional
connection/snapshot/candidate account. Reconnect precheck stays before claim and
verified account stays before encryption/persistence. Sync eligibility remains
independent and globalOFF does not substitute for Carrier authorization.

## Plan

1. First commit closes merged066 and transfers only existing external acceptance to
   PLANNED068/046; link its empty-policy issue here and freeze this plan before tests.
2. Extend existing tests, build and capture RED before minimal source edits.
3. Thread one internal boolean through shared factory and extend existing target
   condition; clarify missing-policy loopback invariant, no new URL validator.
4. GREEN targeted/full API and signed integration; synchronize changed canonical docs.
5. Independent read-only review; new PR with pinned metadata, push and exact-source
   Preflight/Foundation/SyncTargeted. No merge or optional stress/rerun.

## Acceptance

- [ ] Missing/blank policy, runtime opt-in and SyncOFF cannot bypass external denial; actual calls prove zero dispatch.
- [ ] Wrong owner/login/optional connection/snapshot account deny before provider/claim; candidate mismatch before encryption/persistence.
- [ ] API and Worker share the same parsed presence decision; loopback and existing Sync eligibility/security preserved.
- [ ] Targeted/API/integration and documentation/governance gates recorded; exact final-source hosted checks.
- [ ] Hard gate state and unmet canonical conditions reported separately; no live call or account data committed.

## Gate decision and existing prerequisites

ADR007 point6 confirms owner-scoped authorization2026-11-15. It does not promote
points1–5 (verify identity/error/is_verified/TTL evidence), establish exposed-token/
cookie invalidation or supply explicit permission to flip the hard gate now.
Current repository evidence does not establish all of those conditions. Keep
UNISHIP_LIVE_CONTRACT_VERIFIED=false; no production bypass/test gate override.
No account identifiers need re-confirmation and none is committed. Actual remaining
runtime/data acceptance belongs to [068](NEXORA-068-uniship-owner-runtime-and-data-acceptance.md)
and public host gates remain [046](NEXORA-046-production-https-acceptance.md).

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Internal external activation-presence gate and shared composition, scoped test
coverage, closed live-gate decision and066 closure/remaining acceptance ownership.

### Canonical owners

- docs/operations/configuration.md; docs/operations/testing.md
- docs/architecture/backend.md; docs/architecture/sync-extensions.md
- docs/integrations/uniship-portal-api.md
- docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md
- This task, immutable067 snapshot and completed066/PLANNED068

### Documentation verification

Pinned format/docs/preflight/test:docs/test:preflight and raw snapshot binding.

## Evidence

| Claim                                | Evidence                                                                                                                                                                                                                   | Date       | Result |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and task identity inspected | Clean latest mainf06db70; PR66 merged37981a1 at2026-11-28T10:27:57Z; registry067/068 unused, no open overlapping PR; production client constructor exists only in shared Carrier factory called by API/Worker Sync runtime | 2026-11-28 | PASS   |

## Execution limitations

Local host toolchain/dependencies exist; Docker has only PostgreSQL image and about
74MiB free, below documented canonical prerequisites. Do not run owner DB fixtures
or mutate user volumes to obtain integration PASS. Host commands and available
hosted signed tests will be labeled separately. No live-positive test/operation is
claimed while hard gate remains closed.
