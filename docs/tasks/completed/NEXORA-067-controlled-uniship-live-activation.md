# NEXORA-067 — Controlled Uniship Carrier live authorization

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

## Scope and boundaries

Owner prompt2026-11-28: protect existing Carrier connect/reconnect through the UI,
using current account-scoped activation, shared API/Worker composition and transport.
No UI/API/schema/grant/engine/lifecycle redesign. No live request, owner deployment,
ENV/key changes, manual FULL, AUTO, reconciliation or backup/restore work.
`v1` held the source live hard gate closed (`false`); `v2` opens
`UNISHIP_LIVE_CONTRACT_VERIFIED = true` per explicit 2026-11-28 ADR-007 owner
authorization while preserving opt-in and account-scoped policy protection.

## Design Review & Reuse Decision

Task ID: NEXORA-067
Classification: SIGNIFICANT
Plan revision: rev-2026-11-28-controlled-live-v2
Reviewed baseline: f06db70e9dae50d95d724ce03f03a593315876fa
Design Snapshot: docs/tasks/design-reviews/NEXORA-067-rev-2026-11-28-controlled-live-v2.md
Design SHA-256: 3716866790c1d50f72c067c612469d265524b959eed65cf6b164181174c783e2

| Field                    | Transport and scope (`v1`)                                                                                                                                                                                                                                                                                                                                                   | Controlled live gate opening & regression coverage (`v2`)                                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component                | Internal parsed activation-presence gate and existing outbound scope authority                                                                                                                                                                                                                                                                                               | Source-level `UNISHIP_LIVE_CONTRACT_VERIFIED` hard gate (`true`), HTTP `400` verify token mapping, and external Connect/Reconnect regressions                                                                                                                                  |
| Existing implementations | apps/api/src/carrier/infrastructure/uniship/uniship-http.client.ts; apps/api/src/carrier/infrastructure/carrier-runtime.ts; apps/api/src/sync/infrastructure/uniship-sync.runtime.ts; apps/api/src/sync/infrastructure/uniship-sync.config.ts; apps/api/src/carrier/infrastructure/carrier-credential-vault.ts; apps/api/integration/fixtures/uniship-runtime-activation.cjs | `apps/api/src/carrier/infrastructure/uniship/uniship-http.client.ts:147-149,437-450,515-525`, `uniship-adapter.ts:75-76`, `carrier-uniship.test.cjs`, `uniship-verify.test.cjs`, `uniship-runtime-composition.test.cjs`, `integration/fixtures/uniship-runtime-activation.cjs` |
| Domain owner             | Carrier/Sync infrastructure; existing Carrier application owns lifecycle                                                                                                                                                                                                                                                                                                     | Carrier infrastructure & test suite (`docs/decisions/multi-carrier-architecture.md`, `docs/integrations/uniship-portal-api.md`)                                                                                                                                                |
| Reuse alternatives       | New ENV/parser/URL classifier or lifecycle framework versus one derived boolean in existing composition                                                                                                                                                                                                                                                                      | Add ENV override or custom 400 error parser versus flipping single verified constant `true` and reusing existing `400/401 -> TOKEN_REJECTED` handling                                                                                                                          |
| Selected approach        | activationConfigured defaultsfalse; derive once from parsed policy; use existing target() for availability/dispatch; retain context/verified callbacks and scoped error semantics                                                                                                                                                                                            | Flip `UNISHIP_LIVE_CONTRACT_VERIFIED = true`; keep `!this.liveAuthorized`, `!this.activationConfigured`, routes, origin & `400` verify mapping intact; intercept `globalThis.fetch` at boundary with real/double admission                                                     |
| Rationale                | Fail-closed by default without Sync coupling, cycles or duplicated business logic                                                                                                                                                                                                                                                                                            | Minimal 1-constant production delta (`UNISHIP_LIVE_CONTRACT_VERIFIED = true`) backed by ADR-007 amendment without weakening runtime guards                                                                                                                                     |
| Risks                    | Vacuous hardclosed tests, stray constructor, claim/encrypt before denial, accidental external dispatch                                                                                                                                                                                                                                                                       | Weakening `!this.activationConfigured` silently or mistaking synthetic mock PASS for actual live Uniship execution                                                                                                                                                             |
| Verification             | RED constructor-option propagation, actual denied POST/GET zero-fetch; real loopback and test doubles for scope; signed PostgreSQL preservation; required hosted gates                                                                                                                                                                                                       | Test-first RED -> GREEN external transport matrix, HTTP `400 Error decoding signature.` test, Connect/Reconnect external tests, temporary `!this.activationConfigured` mutation check, full API + signed CI                                                                    |

No new Tactical DDD `Aggregate`, `Value Object`, or application port is added (`v2` preserves all domain boundaries and invariants). Transport validates permission presence; existing scope callback remains responsible for exact owner/login/optional connection/snapshot/candidate account. Reconnect precheck stays before claim and verified account stays before encryption/persistence. Sync eligibility remains independent and global OFF does not substitute for Carrier authorization.

## Plan

1. Commit 1 (`57b9296`): Close merged `NEXORA-066` and transfer existing external acceptance to `PLANNED` `NEXORA-068` / `NEXORA-046`.
2. Commits `3cd3bcd` & `697f452` (`v1`): Thread internal `activationConfigured` through shared factory, extend `target()`, preserve `hardfalse`, and record the eight-contract review.
3. (`v2`) Record Design Snapshot `rev-2026-11-28-controlled-live-v2` and bind SHA-256 (`3716866790c1d50f72c067c612469d265524b959eed65cf6b164181174c783e2`) before test/source edits.
4. Add test-first RED regressions across `carrier-uniship.test.cjs`, `uniship-verify.test.cjs`, `uniship-runtime-composition.test.cjs`, and `integration/fixtures/uniship-runtime-activation.cjs` (`globalThis.fetch` intercepted at HTTP boundary, zero live calls).
5. Flip `UNISHIP_LIVE_CONTRACT_VERIFIED = true` in `uniship-http.client.ts`, verify targeted/full API GREEN + independent `!this.activationConfigured` mutation RED -> restored GREEN, and sync ADR-007 & canonical docs (`Documentation Impact: REQUIRED`).
6. Run full local checks + independent read-only review, rename PR #67 to `feat(uniship): enable controlled live carrier connection`, push to PR #67, and verify `Preflight`, `Foundation`, and `Sync V1 targeted` PASS on exact final HEAD without merging or modifying actual owner runtime/ENV/data.

## Acceptance

- [x] Missing/blank policy, runtime opt-in and SyncOFF cannot bypass external denial; actual calls prove zero dispatch.
- [x] Wrong owner/login/optional connection/snapshot account deny before provider/claim; candidate mismatch before encryption/persistence.
- [x] API and Worker share the same parsed presence decision; loopback and existing Sync eligibility/security preserved.
- [x] (`v2`) Explicit 2026-11-28 owner decisions (1y lifetime, observed HTTP `400` invalid token, waived expired-token & test-account password-rotation pre-gates, explicit live gate authorization) synchronized across ADR-007 and canonical docs without weakening `NOT VERIFIED` / confidentiality guarantees.
- [x] (`v2`) `UNISHIP_LIVE_CONTRACT_VERIFIED = true` with untouched `!this.liveAuthorized` / `!this.activationConfigured` / scope / `UNISHIP_LIVE_AUTHORIZED=false` defaults, verified via RED->GREEN transport/composition/Connect/Reconnect/400 regressions and `!this.activationConfigured` mutation check.
- [x] Targeted/API/integration and documentation/governance gates recorded; exact final-source hosted checks (`Preflight`, `Foundation`, `Sync V1 targeted`) PASS without live HTTP traffic or PR auto-merge.

## Gate decision and existing prerequisites

Historical `v1` baseline notes (`2026-11-28` earlier review): ADR007 point6 confirms owner-scoped authorization2026-11-15; exact live expiry/rejection confidence, historical exposure invalidation, and explicit permission were then open and held `UNISHIP_LIVE_CONTRACT_VERIFIED=false`.

Updated **2026-11-28 Owner Decision (v2 — Authorized Gate Opening)**: Owner confirmed 1-year token lifetime (retaining nullable `tokenExpiry` without fixed TTL/refresh), supplied observed `POST /client/api-token-verify/` invalid-token `HTTP 400` (`{"non_field_errors":["Error decoding signature."]}`), waived exact natural expiry as a blocking pre-gate (`NOT VERIFIED`, validate post-activation), accepted historical token/cookie exposure risk solely for the approved test account, and explicitly authorized setting `UNISHIP_LIVE_CONTRACT_VERIFIED = true`. Actual owner runtime configuration, live Carrier UI connection, and manual FULL/Sync acceptance remain in [NEXORA-068](../active/NEXORA-068-uniship-owner-runtime-and-data-acceptance.md) and public host gates in [NEXORA-046](../active/NEXORA-046-production-https-acceptance.md).

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Internal external activation-presence gate (`v1`) plus 2026-11-28 owner decisions (`v2`): 1y token lifetime confirmation, observed HTTP `400` invalid-token evidence, waived pre-live expiry/password-rotation blockers for approved test account, `UNISHIP_LIVE_CONTRACT_VERIFIED = true`, external-positive mock transport/Connect/Reconnect regressions, and safe post-merge UI runtime setup placeholders.

### Canonical owners

- `docs/decisions/multi-carrier-architecture.md` (dated `NEXORA-067` amendment)
- `docs/operations/configuration.md`; `docs/operations/testing.md`
- `docs/architecture/backend.md`; `docs/architecture/sync-extensions.md`
- `docs/integrations/uniship-portal-api.md`
- `docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md`
- This task (`NEXORA-067`), immutable `v1` snapshot, `v2` snapshot, and `completed/NEXORA-066` / `PLANNED/NEXORA-068`

### Documentation verification

Pinned format/docs/preflight/test:docs/test:preflight and raw snapshot binding (`v2`).

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

## Final controlled live activation — v2 (2026-11-28)

Reviewed `v2` Design Snapshot: `docs/tasks/design-reviews/NEXORA-067-rev-2026-11-28-controlled-live-v2.md`
(`SHA-256: 3716866790c1d50f72c067c612469d265524b959eed65cf6b164181174c783e2`); immutable
`v1` snapshot preserved unchanged (`SHA-256: b3aa01d58c43bac0f6f00c1a82b79d2d79ec0fea90eeaf6932b4b0fc2f2ef3b6`).

Production source change: strictly `const UNISHIP_LIVE_CONTRACT_VERIFIED: boolean = true;`
with owner-authorization comment in `apps/api/src/carrier/infrastructure/uniship/uniship-http.client.ts:147-149`.
No change to `!this.liveAuthorized`, `!this.activationConfigured`, routes, origin
`https://kh.uniship.vn`, `UNISHIP_LIVE_AUTHORIZED=false` defaults, `UnishipSyncRuntime.authorize`,
`createCarrierRuntime`, `400/401 -> TOKEN_REJECTED` normalization, Worker custody,
OpenAPI/SDK, UI, schemas, or `NEXORA-068` runtime scope.

| Check (`v2`, host Node v24.16.0 / pnpm 10.34.6)                                        | Outcome                                                                                                                                                    | Date       |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Test-first RED (`UNISHIP_LIVE_CONTRACT_VERIFIED=false`, 3 transport/verify suites)     | `10/13` PASS, `3/13` expected external-positive FAIL (`owner-observed verify HTTP 400 Error decoding signature.` PASS)                                     | 2026-11-28 |
| Gate-open initial GREEN (6 targeted suites / `@nexora/api test`)                       | `61/61` targeted PASS; `304/304` (`51 suites`) API PASS                                                                                                    | 2026-11-28 |
| Isolated missing-policy mutation (`!this.activationConfigured` temporarily omitted)    | `9/13` PASS, `4/13` expected missing-policy FAIL across unit/verify/composition; restored cleanly                                                          | 2026-11-28 |
| Final local static, typecheck, contracts & API regressions (`globalThis.Response` fix) | `lint`, `format:check`, `typecheck` (`10/10`), `contracts:check`, `docs:check`, `preflight:check`, `git diff --check`, 6 targeted PASS, `304/304` API PASS | 2026-11-28 |
| Host Windows POSIX tests (`test:docs` / `test:preflight`)                              | `test:docs` `9/10` (`1` `.git` `EPERM`), `test:preflight` `22/24` (`2` `symlink` `EPERM`); Linux hosted `Preflight` authoritative                          | 2026-11-28 |
| Local PostgreSQL signed integration / real live HTTP                                   | Local signed `NOT RUN` (verified by hosted `Sync V1 targeted`); zero real HTTP calls to `kh.uniship.vn`                                                    | 2026-11-28 |

Execution constraints honored: zero secret/account leakage in Git/CI/logs, zero edits to
owner `.env`/DB/volumes/keyring, zero backup/restore operations, no new PR and no merge.
Hosted `Preflight`, `Nexora foundation`, and `Sync V1 targeted PostgreSQL verification`
receipts will be recorded in PR #67 description on exact final HEAD without extra commits.

## Closure by NEXORA-068 — 2026-11-28

PR #67 (`44731c3e39f1d10e463b977fa898bd685fc9b231`) merged into `main` at
`f6219f2cbcc4d78de1cdc41825c2c5fcee0715e9` on `2026-11-28T13:40:00Z` (actual PR merge
checkout `a728ea124fadc072cf1d80191831f47cf44a5f2b`). The source-level Live Gate
(`UNISHIP_LIVE_CONTRACT_VERIFIED = true`) is open and existing account-scoped activation
protection is verified. Actual owner Development runtime upgrade, live Uniship UI Connect,
Manual FULL Sync execution, and Retail/timezone data acceptance remain in
[NEXORA-068](../active/NEXORA-068-uniship-owner-runtime-and-data-acceptance.md) (never
claimed PASS in `NEXORA-067`); public host acceptance stays in
[NEXORA-046](../active/NEXORA-046-production-https-acceptance.md). Historical evidence,
FAIL rows, and immutable `v1`/`v2` design snapshots remain unchanged.

| Claim                                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Date       | Result |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| PR #67 merged and final hosted CI receipts recorded | Merged PR #67 into `main` (`f6219f2cbcc4d78de1cdc41825c2c5fcee0715e9`, `2026-11-28T13:40:00Z`, source `44731c3e39f1d10e463b977fa898bd685fc9b231`, merge checkout `a728ea124fadc072cf1d80191831f47cf44a5f2b`); hosted checks on `44731c3e` attempt 1 PASS: Preflight `46147300242`/job `140986070625`, Foundation `46147300273`/job `140986070871`, Sync Targeted `46147300312`/job `140986070811` (optional selector `46147300300`/job `140986070855` PASS); main Preflight `46150741395` PASS (`46150741263` Foundation `in_progress` at closure time); Live Gate opened and activation protection verified | 2026-11-28 | PASS   |
