# NEXORA-067 — Controlled Uniship Carrier live authorization

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

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
The earlier2026-10-16 amendment already records the observed verify body/token-userid
contract, ignores is_verified by owner decision and approves no refresh endpoint;
these facts do not need re-confirmation. Exact live expiry/rejection confidence and
the remaining operational evidence retain their recorded status; no fixed TTL or
provider-published numerical quota is invented as a new requirement.
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

## Implementation and executed local verification

Protection is implemented in three infrastructure files only. The internal boolean
defaultsfalse in UnishipHttpClient/createCarrierRuntime and is derived from the one
parsed activation policy. The existing external target condition now requires it
alongside live opt-in and the unchanged hardfalse. No scope/lifecycle/parser/URL
classification rewrite. authorize's missing-policy return remains operational only
for nonproduction loopback. Public/source contracts and templates are unchanged.

Baseline production code was f06db70 (first docs-only plan/closure commit57b9296).
RED command: pinned build then node --test existing runtime-composition and
carrier-uniship files; final causal RED7/8 passed, only parsed-presence propagation
failed (undefined vsfalse) before source edits. An earlier unit fixture omitted the
PostgreSQL-budget test double and failed P1001; corrected before final causal RED,
not counted as product evidence. GREEN six requested targeted suites60/60; full API
303/303. Positive Carrier cases are synthetic nonproduction loopback/test doubles
with SyncOFF, not external-positive permission. Hardfalse masks the extra conjunct
in external black-box tests; constructor capture proves propagation independently,
actual denied POST/GET prove zero dispatch, and source review verifies target().
No hard-gate substitution/production test bypass was introduced.

Existing signed activation fixture adds six initial-connect cases (wrong owner/
login/optional connection, coherent wrong candidate, auth-verify incoherence and
valid SyncOFF) and missing-external-policy denied reconnect; preservation comparisons
now include schedules. The real loopback HTTP/actual restricted persistence cases
are pending required hosted signed execution; existing Worker/fences tests retained.

Local commands use Node24.19.0/pnpm10.34.6, existing installed frozen dependency
graph (no dependency/lockfile change). `pnpm --filter @nexora/api... build`, targeted
60, full API303, format/lint/contracts/docs/preflight and docs10/preflight24 PASS.
Lint initially caught a new-test bare AbortController; corrected to globalThis.
Root `pnpm typecheck` first failed missing API_INTERNAL_URL. With documented
NODE_ENV=production API_INTERNAL_URL=http://api:4000 it reached API tsc successfully
but failed Web build ENOSPC. Removed only cache generated by that failed build;
no user asset/volume touched. Root local typecheck is FAIL, never relabeled PASS.
Canonical Docker/signed integration local NOT RUN: no application/tooling images,
only PostgreSQL image and about74MiB disk. Do not use owner DB or weaken checks.
Required final-source hosted Foundation quality and Sync Targeted must supply
canonical full typecheck/integration evidence, separate from these host receipts.

| Claim                                    | Evidence                                                                                                                                                                                     | Date       | Result |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Causal RED before implementation         | API prerequisite build PASS, runtime-composition/carrier-uniship7/8 PASS; parsed policy presence absent in real constructor options (undefined vsfalse); sourcef06db70 plus docs-only57b9296 | 2026-11-28 | FAIL   |
| Targeted and API regression GREEN        | Six requested node --test files60/60; pnpm --filter @nexora/api test303/303 on implemented source; external fetch guards require zero dispatch                                               | 2026-11-28 | PASS   |
| Local static/contracts/governance        | Pinned format/lint/boundaries/contracts reproducible/docs/preflight, test:docs10/10 and test:preflight24/24; git diff --check                                                                | 2026-11-28 | PASS   |
| Local root typecheck environment failure | pnpm typecheck needs documentedAPI_INTERNAL_URL; second run with correct value failed Web webpack ENOSPC, API tsc completed; no timeout/assertion/source workaround                          | 2026-11-28 | FAIL   |
| Focused independent review               | Three-file implementation, production construction paths, RED/GREEN and signed-case source reviewed: no P1/P2/P3; hardclosed coverage boundary retained, signed execution pending            | 2026-11-28 | PASS   |

Final-source CI and final review receipts will be recorded in the new PR description
after push; do not create a commit merely to recite its own CI results. No merge,
live call, owner configuration/key/DB operation, manual FULL or backup work occurs.

## Final review delta — 2026-11-28

Reviewed source: 3cd3bcdbc27fc3e35f6e3e2cc91277d7e6d0cb71. This follow-up is
BOUNDED documentation/evidence/title correction within the unchanged v1 plan.
No security behavior, test, interface or scope changes; immutable v1 stays intact.
A gate-opening change would require a new material revision before implementation.

Focused inspection: ADR-007 Token Verification Protocol, amendments2026-10-16 and
2026-11-15; existing fixture provenance; HTTP target/verify/rejection handling;
carrier-uniship and uniship-verify tests; shared runtime composition; canonical058
Stage1 and existing068. Reuse the integration contract's confidence ledger rather
than create a second authorization mechanism or task. The risk is mistaking mock
or owner-observed evidence for live verification; retain their distinct confidence.

Plan for this delta: record the eight-contract gate review in the integration
contract; link it from configuration/testing/Stage1; correct the PR title to
`fix(uniship): enforce activation scope for live carrier transport`; preserve all
previous CI receipts and run required checks on the new candidate. No code/tests
are changed while gate-opening prerequisites remain unconfirmed. No synthetic
external-positive test or mutation may be reported as independent policy proof.

### Gate and regression outcome

The [focused gate review](../../integrations/uniship-portal-api.md#live-gate-review--nexora-067-2026-11-28)
accepts the existing verify shape/identity contract, ignored is_verified decision,
no-refresh behavior and owner account authorization without asking again. Exact
live expired/invalid-token rejection confidence, historical exposure invalidation
and explicit permission to open the hard gate are not established in the inspected
records. Stage1 runtime readiness remains separate from source-level CI acceptance;
no deployment or068 work is performed.

Hard gate remains false. External-positive matrix, approved-origin dispatch through
real admission, external lifecycle additions and missing-policy mutation are NOT
RUN, conditional on a legitimate gate opening. Constructor propagation and current
closed-gate zero-dispatch tests remain useful but do not independently prove the
activationConfigured conjunct under hardtrue. This limitation is not fixed or
waived by this documentation delta. No hard-gate substitution or new bypass.

Historical green source3cd3bcdbc27fc3e35f6e3e2cc91277d7e6d0cb71:
Preflight46137035734/job140954518072, Sync Targeted46137035738/job140954518094,
Foundation46137035766/job140954518516, all attempt1 PASS on2026-11-28. Actual merge
checkout81c908cfbfabf7ed4cc236145f89a6b34cd23a80. Foundation canonical typecheck
and steps4–10 PASS; signed Sync executed six initial-connect cases and denied
reconnect preservation. These are historical receipts, not final-candidate evidence.
New candidate receipts will be recorded in PR67 description after push.

### Follow-up local verification

Node24.19.0/pnpm10.34.6: API prerequisite build PASS; six requested targeted files
60/60 PASS; full API303/303 PASS. format:check, lint (including boundaries),
contracts:check, docs:check, preflight:check, test:docs10/10, test:preflight24/24 and
git diff --check PASS. No test changes, hence no new behavioral RED/GREEN claim.
Local root typecheck NOT RUN for this documentation delta: about76MiB available,
prior root Web build failed ENOSPC under the same constraint. Canonical hosted
Foundation must verify the new candidate; historical green does not substitute.
Local signed integration NOT RUN (missing application/tooling images and disk);
required hosted signed Sync handles the PR's matching cumulative paths. No assets,
volumes, credentials or actual runtime configuration changed to obtain a PASS.
