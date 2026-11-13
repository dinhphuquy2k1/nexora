# NEXORA-042 — Sync Provider & Domain Extension Architecture

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-042
Classification: SIGNIFICANT
Plan revision: rev-2026-11-12-sync-extension-v2
Design Snapshot: docs/tasks/design-reviews/NEXORA-042-rev-2026-11-12-sync-extension-v2.md
Design SHA-256: a1174be3bf5dc965220c5fe904341a9b24c43de0048bcf818d9960c5ef0c5de7
Reviewed baseline: 6a52c2ff90a1173a25053caf6fb7061b82f6b8dd
Branch: feat/sync-extension-architecture

PR32 merged as baseline above; GitHub merged=true, fresh origin/main ancestry and clean working tree verified2026-11-08. No prior branch reused. Historical local creation audit considered NEXORA-035 unused; the later PR35 collision is corrected by the NEXORA-042 audit below. Selected interfaces, full eight-field reuse audit, scope/alternatives/security/compatibility and test-first plan are in the versioned snapshot. ADR-009 does not require owner approval.

### Reuse audit summary

| Field                    | Selected Phase A implementation                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Component                | Exact-pair resolver and fenced Domain invocation                                                                        |
| Existing implementations | SyncProvider/SyncDomainProcessor ports; SyncRepository; SyncJobExecutor; existing Customer link and lock capabilities   |
| Domain owner             | Sync technical orchestration, Customer-owned link persistence, runtime composition roots                                |
| Reuse alternatives       | Existing composite ports, static registry, dynamic plugins or public transaction callback                               |
| Selected approach        | Small static registry, shared empty production factory, trusted deferred domain binding; preserve queue/policies/schema |
| Rationale                | Explicit dispatch/version consistency and neutral APPLIED without invented business writes                              |
| Risks                    | Wrong pair/version, fake APPLIED, scope leakage, rollback and retained-session lifetime                                 |
| Verification             | Unit RED/GREEN, genuine two-capability PostgreSQL persistence/fencing, all existing regressions and final-head CI       |

## Milestones

- [x] A1 audit, scoped plan, snapshot and preflight.
- [x] A2 static exact-pair capability resolution and shared composition.
- [x] A3 provider contract regressions.
- [x] A4 neutral Domain invocation and Customer-owned link boundary.
- [x] A5 API/Worker wiring, empty production capabilities.
- [x] A6 compatibility and developer extension guide.
- [x] A7 captured-strategy implementation verified on c4caffe; final documentation-publication gates must also pass before handoff (final green SHA in PR description).
- [x] Three independent technical review rounds and follow-up source assessment; final publication evidence is checked before handoff, not owner approval.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Static capability composition, neutral fenced Domain invocation and extension procedure; corrected task identity NEXORA-042, the narrow infrastructure type dependency, and Customer mapping-only versus Sync applied-job provenance ownership.

### Canonical owners

- docs/architecture/backend.md
- docs/architecture/runtime.md
- docs/architecture/database.md (unchanged schema/grants, Domain mapping ownership)
- docs/operations/testing.md
- docs/decisions/sync-worker-staging.md (additive Phase A clarification)
- New developer guide under docs/architecture/ linked from canonical backend.

### Documentation verification

pnpm docs:check, pnpm preflight:check, pnpm format:check.

## Evidence

| Claim                                               | Evidence                                                                                                                                    | Date       | Result |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Initial structural preflight                        | Missing inline eight-field task audit; corrected before implementation and recheck PASS                                                     | 2026-11-08 | FAIL   |
| Baseline build before engine cache                  | Genuine Prisma checksum download denied403; no checksum/TLS bypass                                                                          | 2026-11-08 | FAIL   |
| Genuine prerequisite recovery                       | Verified public CI artifact SHA256 and pinned schema-engine version, then complete API dependency build PASS                                | 2026-11-08 | PASS   |
| Static capability/application/worker unit contracts | node --test apps/api/test/sync/\*.test.cjs20/20PASS,0skip; resolver module absent RED before implementation                                 | 2026-11-08 | PASS   |
| Independent source reviews                          | Round1 correctness9/9unit PASS; Round2 security11/11unit PASS, no confirmed P1/P2; actual PG/hosted acceptance still required               | 2026-11-08 | PASS   |
| Fresh merged baseline and new branch                | PR32 merged=true; origin/main6a52c2ff90a1173a25053caf6fb7061b82f6b8dd; merge-base ancestry PASS; clean new feat/sync-extension-architecture | 2026-11-08 | PASS   |
| Frozen prerequisites                                | pnpm10.34.6 install --frozen-lockfile on Node24.19.0; 427 locked dependencies, no lockfile change                                           | 2026-11-08 | PASS   |

## PLAN ISSUES

PRODUCTION_DOMAIN_WRITE_CONTRACT remains a pre-Live B/C gate: no authorized production write/provider/grant is invented. Controlled test-owned transactional persistence must prove the Phase A boundary. If it cannot, retain AC7/AC8 BLOCKED and do not weaken invariants. Issue33 remains deferred.

## Verification re-evaluation — fixture isolation

Before further fixture edits, three actual PostgreSQL attempts were reviewed:
initial launcher FAIL57P03 because its default socket readiness observed temporary
bootstrap; changed only the external owned launcher to TCP plus SELECT1. Next run
52tests/45PASS/7FAIL: six new cases and parent failed because configure schedules
in the future, not immediately; make only the owned AUTO fixture due and clean each
case on failure. Third run52tests/46PASS/6FAIL demonstrated neutral APPLIED/cursor
restart and other new contracts, but lease fixture SELECT pg_sleep exposed Prisma's
unsupported void decoding, and leftover fixture rows invalidated unchanged legacy
10005-source/99-retention assertions (with subsequent cascading failures).

Re-plan within the same architecture: keep real lease expiry but select a supported
scalar from pg_sleep; remove only extension-owned table/items/payloads/identities/
jobs/connections after the fixture, including deliberately substituted source IDs.
Use canonical payload hashes for valid isolation controls. Keep every existing
assertion and production algorithm/timeout unchanged. Re-run the complete suite;
these historical failures are not PASS or evidence of a production-policy change.
No immutable snapshot or owner approval gate changes. Genuine engine recovery used
public artifact13602882132 from target42443725029, ZIP SHA256
bd9b99bc82e7018ec740d41425901026fb7f80832f20e02178ebc583f282057a,
matching pinned Prisma0edf323efd1d98336f3f0a68684b56f689b900d3; no checksum/TLS bypass.

## Implementation checkpoint and executed verification

Implementation is in place on the new branch; new PR/final-head hosted verification
and independent Round3 are pending. Production capabilities remain unavailable.

- Full host quality before final factory test:598/598,0skip (132root/194API/234Web/32UI/6database), contracts reproducible and4/4builds PASS.
- Latest Sync ordinary units22/22PASS include actual Nest API and Worker composition factories with flags true and no added secrets.
- Actual migrated Docker PostgreSQL extension + all prior Sync tests52/52PASS,0skip; owned database and container cleanup PASS.
- Signed disposable provisioning/worker privilege/secret-domain denial script PASS; genuine Prisma legacy/staged/repeat/drift migration script PASS separately; owned cleanup PASS. The standalone provisioning suite's native SQL setup is not claimed as Prisma migration execution.
- Token audit against base6a52c2ff: schedule/claim/heartbeat/wait/cleanup/page method bodies unchanged modulo whitespace/comments. Only registry selection/admission, exact identity/source fencing and Domain invocation boundary changed.
- API/OpenAPI/SDK/shared vocabulary/schema/migrations/grants and NEXORA-034 snapshots/task have zero diff.
- Round1 correctness and Round2 security/architecture independently found no confirmed P1/P2; each ran relevant units. Future arbitrary adapters still require their actual Domain contract tests; trusted binding commit is not a general sandbox or automatic proof.

Historical local build/lint prerequisites initially failed implicit contextual
types/Node-global lint names; corrected annotations/globalThis without suppressions.
Standalone role launcher first used48hex characters for the runtime secret, correctly rejected by the
existing64hex custody guard; external fixture corrected to32 random bytes, policy
unchanged. No false PASS or assertion weakening. Full logs stay outside Git.

Local complete Docker release/dev image builds are NOT RUN at this checkpoint:
the managed executor has about3GiB free versus the documented20GiB build minimum.
Actual local PostgreSQL uses Docker; this is distinct from full Docker/runtime
acceptance. Final-head hosted Foundation must execute canonical Docker quality,
roles/migrations, LOCAL/TTY/browser, HTTPS, persistence, dev and cleanup; only
actual logs can close that verification. Exact final SHA/run/merge/review evidence
is reconciled in new PR metadata after completion to avoid SHA-only doc loops.

## Async processor-version regression

An additional unit first failed with Missing expected rejection when a mutable
processor version changed after asynchronous binding initialization or during its
decision. Customer binding now checks the captured version/support before and
after decision and around commit; a post-write mismatch throws within the same
transaction. Focused Sync units22/22PASS,0skip. Independent security re-review ran
10/10capability tests PASS and found no confirmed P1/P2. Real PostgreSQL and full
quality are re-executed for this source change; earlier52/52 is not substituted.
Final-source PostgreSQL rerun52/52PASS,0skip (197114ms), with owned migrated
database/container cleanup PASS. Full host quality remains running at this checkpoint;
final-head results will be reconciled in PR metadata.

A subsequent host quality invocation without API_INTERNAL_URL failed the existing
Web build configuration gate. Re-run with the documented local upstream variable;
no Web/production configuration code or assertion changed.

## A7 verification clarification — real browser synchronization

Before changing the browser harness, hosted head eea7287cb85536b0309ec2ba63da561bfe543fef
Preflight42469166797 and targeted42469166904 passed. Foundation42469166660
Docker quality600ordinary tests,133integration tests, genuine migration/role
checks and both real PTY harnesses passed, but runtime browser failed CHECK_FAILED
at CARRIER_V2_SOURCE_BACKED_SIX_VIEWPORT_MATRIX. Retained artifact13612643217
(raw ZIP SHA256 c863fe2e479c71b7fd62fdbd419aae72c21be9d170f3cbb63a5cabd0c86f0d38)
records87captures, last admin filter768x1024. Account upload subsequently failed
for missing evidence; HTTPS/data/dev skipped and are not PASS.

Read-only diagnosis: Carrier harness and all production Web/UI files have zero
diff from main. The existing navigate helper waits a root present in the previous
document and does not settle fonts before immediate geometry comparisons. A real
Chromium fixture-only run of unchanged compiled TSX independently failed the
status/environment badge-width equality (100.453125 versus104.1875). This is a
separate reproduced readiness defect; it does not establish the exact original
CI timeout's cause. No blind rerun or assertion weakening.

Bounded A7 plan before harness edits: reuse the existing navigate/until/evaluate
path; mark the previous document, require a fresh complete document/root and
settled font/two-frame layout before interactions. Re-run the actual full fixture
and hosted Foundation. Do not alter UI, selectors, assertions, geometry tolerances,
timeouts, credentials or production behavior. This changes test synchronization,
not the immutable approved architecture or capability model.

A7 bounded implementation re-review found no confirmed P1/P2. Full actual local
Chromium Carrier fixture now PASS, including status/environment equality, all six
viewport surfaces, keyboard/history and Sync issues, with owned browser/profile
cleanup PASS. AST assertion inventory remains106before/106after; original
assertions, tolerance values and polling budgets are unchanged. Full host quality
rerun and new-head hosted verification remain pending at this source checkpoint.
The first hosted browser failure remains unattributed, not retroactively PASS.

## Task identity correction and v2 plan — 2026-11-12

Historical NEXORA-035-rev-2026-11-08-sync-extension-v1.md belongs to this Sync
task before renaming; original bytes/digest fd6b4419022e7c5cbdc82344883ceef54dc8f85652495c692b0fdb8a2747f29d
remain unchanged. PR35 independently owns NEXORA-035 centralized authentication.
ID NEXORA-042 checked unused in origin/main active/completed/design-review trees
and all5 open PR trees (39,34,22,21,14), plus gh pr list/connector metadata.
Historical assertions about pre-creation uniqueness describe the old local audit,
not a guarantee against the later collision.

New immutable v2 records merge-main conflict strategy, P3 corrections and test-first
verification before implementation. Documentation Impact remains REQUIRED: task
identity, narrow infrastructure type dependency and binding/provenance ownership.
Current reviewed HEAD13658fb; origin/main3906f82; no rebase. Preserve historical
FAIL rows and keep A7/review unchecked until new executed evidence closes them.

PLAN ISSUE PROVIDER_LENGTH_SINGLE_SOURCE: API/shared/Carrier/common search found
no shared TS provider-column limit; schema/migrations declare VarChar32 and registry
has a local32 guard. Per explicit instruction no duplicate constant is introduced;
P3(d) remains deferred for a deliberate ownership decision. Other requested bounded
corrections proceed under v2. Production registrations remain empty.

## Main merge conflict resolution — 2026-11-12

Merged origin/main3906f8243347fb7c697bf5f6949389c3a784a13d (no rebase).
Carrier navigate combines PR fresh-document marker/exact URL/navigation-error/
settleLayout with main dialogGate in the same until expression, bypassing only
for syncIssues; original assertions/tolerances/timeouts unchanged. Testing doc
keeps both Sync Phase A extension verification and M5 Pager/filter acceptance.
Backend auto-merge inspected: exactly one Phase A section for NEXORA-042 and one
Carrier Reconnect policy section still attributed to PR35/NEXORA-035; neither
lost/duplicated. Main API/Auth/UI changes are inherited, not new Sync scope.

## P3 test-first implementation checkpoint — 2026-11-12

Against merged HEAD02e0c58, actual capability tests RED10PASS/2FAIL before
production edits: mapping-only assertion saw extra last_applied_sync_job_id, and
admit strategy count was3 rather than1. Both failures directly exercise actual
compiled methods. Tests then guide removal of duplicate provenance write and
reuse of one validated strategy captured by registry resolution. The application
resolver port stays unchanged; only infrastructure BoundSyncCapability adds the
captured strategy. available semantics and protected repository method bodies stay
unchanged. Added real PG assertion requires99 applied existing-Customer sources
to reference the applied job. Obsolete unavailable adapter has no production
consumer; only its dedicated test assertions are removed, while empty factory/
unsupported capability regressions remain. P3(d) stays an explicit PLAN ISSUE.

## Merged-result verification checkpoint — 2026-11-12

Execution source: merge02e0c58 plus scoped P3 working delta, Node v24.22.1,
pinned pnpm10.34.6. Detailed logs/captures remain in execution scratch, not Git.

| Claim                            | Evidence                                                                                                                                                                                                                                                                                                                                                         | Date       | Result |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Test-first P3 RED                | node --test apps/api/test/sync/capability.test.cjs before production edits:10PASS/2FAIL; binding extra provenance column and strategy3 versus1;0skip                                                                                                                                                                                                             | 2026-11-12 | FAIL   |
| Initial P3 build                 | pnpm --filter @nexora/api... build rejected SyncStrategy used as type (TS2749); corrected to owning const-derived union, no compiler suppression                                                                                                                                                                                                                 | 2026-11-12 | FAIL   |
| Prerequisite build GREEN         | npx --yes pnpm@10.34.6 --filter @nexora/api... build: genuine Prisma generation and API/shared/database builds PASS                                                                                                                                                                                                                                              | 2026-11-12 | PASS   |
| Sync units GREEN                 | node --test apps/api/test/sync/\*.test.cjs:24/24PASS,0fail/skip, includes both new tests                                                                                                                                                                                                                                                                         | 2026-11-12 | PASS   |
| Lint regression                  | npx --yes pnpm@10.34.6 test:lint:52/52PASS,0skip                                                                                                                                                                                                                                                                                                                 | 2026-11-12 | PASS   |
| Docs and governance              | npx --yes pnpm@10.34.6 docs:check and preflight:check:PASS; v2 digest/binding retained                                                                                                                                                                                                                                                                           | 2026-11-12 | PASS   |
| Formatting and boundaries        | npx --yes pnpm@10.34.6 format:check and node scripts/boundaries.mjs:PASS                                                                                                                                                                                                                                                                                         | 2026-11-12 | PASS   |
| Independent round3 source review | Separate read-only reviewer at02e0c58+P3 delta,2026-11-12T14:30:51Z–14:32:04Z: no confirmed P1/P2/new P3 defect; independently24/24units,tsc --noEmit,boundaries,docs,preflight,snapshot formatting,diff checks PASS. Protected six methods token-identical vs main and13658fb; Carrier106assertions unchanged; integration214→215 with one provenance assertion | 2026-11-12 | PASS   |

Round3 source assessment is independent technical review, not owner approval.
Full local PostgreSQL integration and complete Carrier fixture are running against
owned disposable resources; do not call partial progress PASS. Full quality and
new-head hosted gates remain pending. Existing eea7287 Foundation FAIL and all
other historical FAILs remain unchanged. A7 remains unchecked until every required
hosted gate passes on the final pushed head. No merge or production activation.

## Exact pushed-head local and hosted evidence — 2026-11-12

Pushed HEAD7d96b86ae4fe3dccd9b191dab50e647e6d85207e; actual hosted merge
c69d17a3ccdcc3f2cae4142deed8293e254358f9 into
3906f8243347fb7c697bf5f6949389c3a784a13d (main), attempt1. Times UTC.
Full host quality ran on the clean committed head with Node24.22.1/pnpm10.34.6.
Local Carrier fixture and PG execution started on the P3 delta before its commit;
source bytes are unchanged in7d96b86. Carrier manifest sourceCommit is null, so
its SHA is integrity/provenance for retained bytes, not an embedded HEAD claim.

| Claim                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                | Date       | Result |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Full host quality                          | API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality on7d96b86,14:33–14:38Z: exit0;638/638 tests0fail/skip (132root/198API/266Web/36UI/6DB), format/lint/preflight/docs/boundaries/typecheck/contracts/build PASS; unchanged prerequisites may use Turbo cache, tests executed                                                           | 2026-11-12 | PASS   |
| Complete Carrier fixture                   | Compiled actual carrier-entry.tsx with node scripts/build-retail-fixture.mjs, then scratch CDP launcher invoked actual verifyCarrierBrowser fixtureOnly with merged navigate. PASS14:33:45.666Z:124captures, six viewport matrices, status/environment, menu/keyboard/history and Sync Issues; owned Chromium/profile cleanup PASS. All106 harness assertions unchanged | 2026-11-12 | PASS   |
| Carrier retained integrity                 | Independent reviewer checked124/124 PNG hashes against fixture.json; manifest SHA256 a2c2523ac4a78b85651ef762f3ab5c3e14bd67b7fae2f9284d411fa68898cba8. No manual visual review claimed; captures/logs stay outside Git                                                                                                                                                  | 2026-11-12 | PASS   |
| Local full PostgreSQL attempt              | npx --yes pnpm@10.34.6 test:integration against owned PG17.11,14:31:06Z–14:35:05Z:69tests61PASS/8FAIL,0skip. Existing suites lacked /runtime-config/postgres_app_password and migrated base tables. Sync suite itself52PASS; full suite NOT PASS. Owned container/volume cleanup PASS                                                                                   | 2026-11-12 | FAIL   |
| Prepared local runner prerequisite         | Attempt to prepare canonical base migration/runtime-secret mount stopped before readiness while official node24.19.0-bookworm image preparation failed ENOSPC on8GB filesystem. No assertions executed in this attempt. Owned container/network/secret cleanup PASS; no prune/user-volume reset, no third local attempt or source/assertion relaxation                  | 2026-11-12 | FAIL   |
| Preflight Policy & Design Governance       | [Run43238505170](https://github.com/dinhphuquy2k1/nexora/actions/runs/43238505170), exact head/merge above; SUCCESS14:34:09Z,24/24policy tests0skip and current v2 metadata binding                                                                                                                                                                                     | 2026-11-12 | PASS   |
| Sync V1 targeted PostgreSQL verification   | [Run43238505313](https://github.com/dinhphuquy2k1/nexora/actions/runs/43238505313), job131252238367 completed14:36:28Z: SUCCESS, actual genuine generation/build,24unit+52realPG tests0fail/skip, all cleanup steps PASS                                                                                                                                                | 2026-11-12 | PASS   |
| Foundation Docker quality/full integration | [Run43238505205 job131252238495](https://github.com/dinhphuquy2k1/nexora/actions/runs/43238505205/job/131252238495), exact head/merge above; step4 SUCCESS14:41:16Z.638ordinary+133full realPG integration+1cluster suite,0skip; actual role/migration/security/fixture gates passed. This supplies canonical full integration evidence; it does not rewrite local FAIL | 2026-11-12 | PASS   |
| Foundation full workflow                   | Same run/head, job completed14:41:50Z FAILURE. Step5 M5 browser launcher failed AssertionError: Chromium startup at14:41:34Z before UI assertions. Steps6–10 runtime/TTY/browser,HTTPS,persistence,dev SKIPPED. Missing downstream artifacts are consequences, not separate confirmed UI regressions. No full Foundation PASS                                           | 2026-11-12 | FAIL   |

Re-evaluation: local integration requires canonical fixture prerequisites and more
image capacity; do not change tests or use an unmigrated/shared cluster. The
exact-head hosted full133/133 integration above verifies the required genuine
PostgreSQL behavior despite local preparation failures. M5 runner has zero diff
from main. Its existing launcher discards child stderr, so available log proves
startup readiness failure, not a root cause or flakiness. No timeout/assertion/
production registration changes or blind manual rerun is made.

This evidence-publication checkpoint must preserve the new Foundation FAIL and
all earlier FAILs, including eea7287. Publishing it creates a documentation-only
head, which requires fresh Preflight, Sync Targeted and full Foundation gates;
none may be inferred from7d96b86. Keep A7 unchecked until those final-head gates
all succeed. Status VERIFICATION PENDING; provider-length PLAN ISSUE remains.

## Final publication-head checkpoint — 2026-11-12

Final pushed HEAD: af61ba76311ec6bd788b130b9686b53d045b3802.
Actual completed Preflight/Targeted checkout merge:
d1953127eab8fbdc9d4ce737bc7257857b0428ce into
3906f8243347fb7c697bf5f6949389c3a784a13d. Independent reviewer decoded
both checkout logs; only this task differs from the prior source commit7d96b86.
This post-CI evidence update remains local/uncommitted to preserve the final pushed
HEAD and avoid a self-referential SHA-only publication loop. PR metadata retains
NEXORA-042/v2/a1174be3bf5dc965220c5fe904341a9b24c43de0048bcf818d9960c5ef0c5de7.

| Claim                                        | Evidence                                                                                                                                                                                                                                                                                                                                                           | Date       | Result |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Final-head local quality                     | API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality on exact af61ba7,14:44–14:47Z: FAIL at root130/132tests,0skip. Unchanged dev-cleanup-smoke.test.mjs reported DDL_AND_FIXTURES and signal fixture not ready; package tests/contracts/build were not reached in this invocation. Earlier source-head638PASS is separate evidence | 2026-11-12 | FAIL   |
| Focused readiness diagnostic                 | NODE_ENV=production node --test scripts/dev-cleanup-smoke.test.mjs on af61ba7:3/3PASS,0skip at14:47–14:48Z, no source/assertion/timeout change. Does not replace failed full local quality or establish root cause                                                                                                                                                 | 2026-11-12 | PASS   |
| Final-head independent source/binding review | Reviewer confirms af61ba7 task-only delta, original failures preserved, v1/v2 hashes unchanged, PR metadata matching, protected source/test/harness bytes unchanged and no confirmed new P1/P2/P3 defect. Source PASS is not owner approval or a missing hosted gate waiver                                                                                        | 2026-11-12 | PASS   |

Final Preflight43240342956 and Sync Targeted43240342764 are SUCCESS on this
head; independent decoded logs show24policy,24Syncunit and52realPG tests all
0fail/skip with owned cleanup. Full Foundation43240342931 remains running at
this checkpoint; its Docker quality/integration and M5 steps report SUCCESS, but
A7 remains unchecked until runtime/HTTPS/persistence/dev also finish successfully.
No historical FAIL is deleted.

### Final-head hosted closure and independent round3 — 2026-11-12

Final HEAD/merge/base are af61ba76311ec6bd788b130b9686b53d045b3802 /
d1953127eab8fbdc9d4ce737bc7257857b0428ce /
3906f8243347fb7c697bf5f6949389c3a784a13d, confirmed in all three actual
checkout logs by root and the independent reviewer. Times below are UTC.
The local-af61ba7 full quality FAIL above remains FAIL; canonical Docker quality
below is a distinct executed PASS on the same final head, not a rewritten result.

| Claim                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                        | Date       | Result |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Final Preflight Policy & Design Governance        | [Run43240342956](https://github.com/dinhphuquy2k1/nexora/actions/runs/43240342956), final head/merge above, SUCCESS2026-11-12T14:44:47Z; metadata binding and24/24 tests0skip                                                                                                                                                                                                   | 2026-11-12 | PASS   |
| Final Sync V1 targeted PostgreSQL verification    | [Run43240342764](https://github.com/dinhphuquy2k1/nexora/actions/runs/43240342764), final head/merge above, completed SUCCESS14:46:56Z; genuine Prisma generation/build,24units+52realPG0fail/skip; owned cleanup PASS                                                                                                                                                          | 2026-11-12 | PASS   |
| Final Nexora foundation                           | [Run43240342931 job131258730813](https://github.com/dinhphuquy2k1/nexora/actions/runs/43240342931/job/131258730813), final head/merge above, SUCCESS2026-11-12T15:04:10Z; every mandatory step ran and passed, only failure-only Diagnostics SKIPPED                                                                                                                            | 2026-11-12 | PASS   |
| Canonical final-head quality and full integration | Same Foundation, step4 PASS14:51:44Z; actual pnpm quality638/638ordinary, pnpm test:integration133/133realPG and disposable-cluster1/1, all0fail/skip. Contracts reproducible, migrations/repeat/drift, restricted worker-role/custody and owned cleanup PASS                                                                                                                   | 2026-11-12 | PASS   |
| Final M5/browser and runtime gates                | Same Foundation: M5 step5 PASS14:52:35Z with16captures; runtime/provisioning/TTY/browser step7 PASS14:59:02Z; HTTPS/onboarding/ingress/restore step8 PASS15:00:30Z; persistence step9 PASS15:01:30Z; dev HMR/drift step10 PASS15:03:52Z; CI-owned cleanup PASS15:04:08Z                                                                                                         | 2026-11-12 | PASS   |
| Independent Round3 closure                        | Separate read-only reviewer decoded all final-head job logs, exact HEAD/merge/base, counts and step outcomes; source/evidence review PASS, no confirmed blocking P1/P2 or new P3 code defect. Six browser artifacts present/unexpired and bound to final HEAD; archives not downloaded/hash-verified/manually viewed. Local Carrier124PNG hashes independently verified earlier | 2026-11-12 | PASS   |

A7 checked only after final Foundation completed SUCCESS15:04:10Z. Independent
round3 is technical review, not owner approval/merge authority. Keep Status
VERIFICATION PENDING and Verification PARTIALLY VERIFIED: provider-length ownership
PLAN ISSUE remains explicitly deferred, production Domain/provider authorization
and registration remain unavailable. No production activation, automatic task
closure, merge or deployment. No startup-cause fix/flakiness claim is inferred
from the successful documentation-head run. Historical eea7287/7d96b86 failures,
local PG/prerequisite failures and local final-quality failure remain preserved.

Final evidence/checkbox updates in this working task are intentionally uncommitted;
all production/test/harness/canonical-doc changes, identity rename and v2 snapshot
are pushed at af61ba7. PR34 is updated with final results; avoid another SHA-only
commit/CI loop. Only this task differs locally from the exact verified pushed head.

## Captured strategy and shared admissibility delta — 2026-11-12

Step1 READ-ONLY completed before edits at2026-11-12T15:14Z: gh run list
--branch feat/sync-extension-architecture and gh run view43240342931 --log-failed
plus connector jobs confirm af61ba76311ec6bd788b130b9686b53d045b3802
Preflight43240342956, SyncTargeted43240342764, Foundation43240342931 all
SUCCESS. Actual merge d1953127eab8fbdc9d4ce737bc7257857b0428ce into main3906f82;
all Foundation steps4–10 succeeded. Existing exact UTC/run evidence above retained.
No manual rerun was required or made. Conditional Step2 launcher PR is unnecessary;
do not change m5-browser-checks.mjs or create a launcher task/branch.

Read-only inspection: executor currently calls provider.strategy after registry
resolution; repository repeats flags in available/admit. Reuse captured strategy,
current closed SyncProvider.strategy return type, existing registry and native
capability/application tests. Selected correction: expose the already validated
readonly strategy on the application SyncCapability interface, derived as
NonNullable<ReturnType<SyncProvider["strategy"]>>, inherit it in BoundSyncCapability
and use job.fetch_strategy versus capability.strategy in executor. This does
change the internal application metadata type: it explicitly supersedes v2's
earlier "application resolver port unchanged" detail, without changing capture,
public HTTP/SDK contracts or importing infrastructure into Application.

Repository private admissible(provider,type):BoundSyncCapability|null combines
existing config.enabled/types.includes/resolve short circuit. available returns
admissible!==null; admit invokes admissible once after existing connection lock.
Keep SYNC_UNAVAILABLE, SQL/fences/flags behavior and six protected method bodies
schedule/claim/heartbeat/wait/cleanup/page unchanged. No schema/migration/grant/
vocabulary/API/OpenAPI/SDK change; production registration stays empty and
PROVIDER_LENGTH_SINGLE_SOURCE remains open.

Independent reviewer assessed this exact scope before edits: bounded refactor
within existing SIGNIFICANT v2 task, no material new architecture/behavior requiring
v3. Preserve v1/v2 bytes, revision/digest/PR binding. Delta canonical documentation
impact NONE: existing capture/availability policy is unchanged; mutable task holds
internal type/refactor and verification detail, while overall task Documentation
Impact remains REQUIRED for PhaseA. No new dependency/helper framework.

Test-first: add actual-registry executor cases changing provider strategy AFTER
resolve, asserting captured match fetches and captured mismatch waits without
fetch/checkpoint. Observe both RED before production edits, then GREEN. Retain
existing available/admit disabled/unknown/type-disabled/single-resolve cases; no
implementation-mirroring private-method test. Update one existing fake resolver
fixture to supply the same captured metadata required by the application port.
Run requested Sync units, test:lint/docs/preflight/format/fullquality/boundaries,
push one scoped source delta, await all3 final-head hosted gates including
Foundation4–10. Publish actual evidence in task; any documentation-only commit
also requires its own green gates. Do not reuse af61ba7/7d96b86 for a new HEAD.
A7/review stay unchecked until the new final head passes; Status remains
VERIFICATION PENDING. Preserve every historical FAIL.

Previously local-only af61ba7 evidence above is now carried into this authorized
publication; its earlier local/uncommitted wording describes that old checkpoint,
not a continuing exemption from publishing the current task evidence.

### Captured-strategy delta local execution — 2026-11-12

Actual git HEAD for local working-diff checks: af61ba76311ec6bd788b130b9686b53d045b3802
plus the six source/test files above and this task. Source/test manifest digest
6b9bd3420367e9631e72faf67130503c9b2ef9442a11c6623fcc565e004df23a. Node24.22.1, pinned pnpm10.34.6.
Observed completion 2026-11-12T15:21:04Z.
This is working-diff evidence, not a claim that old af61ba7 verified changed code.

| Claim                               | Evidence                                                                                                                                                                                                                                                                                                                                          | Date       | Result |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Strategy mutation RED               | node --test apps/api/test/sync/capability.test.cjs before production edits:14tests12PASS/2FAIL,0skip; real registry captures FULL then provider changes to INCREMENTAL; FULL job got0fetches instead of1, INCREMENTAL job got1instead of0                                                                                                         | 2026-11-12 | FAIL   |
| Build and targeted GREEN            | npx --yes pnpm@10.34.6 --filter @nexora/api... build then node --test apps/api/test/sync/\*.test.cjs:26/26PASS,0skip. Captured match fetches/checkpoints, captured mismatch waits SYNC_UNAVAILABLE without fetch/checkpoint; strategy reads counted once in each resolver test                                                                    | 2026-11-12 | PASS   |
| Lint regression                     | npx --yes pnpm@10.34.6 test:lint:52/52PASS,0skip                                                                                                                                                                                                                                                                                                  | 2026-11-12 | PASS   |
| Docs/preflight/format/boundaries    | npx --yes pnpm@10.34.6 docs:check, preflight:check, format:check and node scripts/boundaries.mjs:PASS                                                                                                                                                                                                                                             | 2026-11-12 | PASS   |
| Full local quality on delta         | API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality:exit0;640/640tests0fail/skip (132root/200API/266Web/36UI/6DB); format/lint/preflight/docs/typecheck/contracts/build PASS. Turbo reused unchanged prerequisites; tests executed                                                                                | 2026-11-12 | PASS   |
| Independent follow-up source review | Separate read-only reviewer: no confirmed P1/P2/P3, no v3 needed; independently26/26Syncunits, APItsc--noEmit, boundaries and diff checks PASS. Six protected method tokens equal af61ba7; no external contract/schema/grant/vocabulary/M5/harness change. Internal application metadata type exposure explicitly reviewed, not claimed unchanged | 2026-11-12 | PASS   |

Next source and documentation-publication heads each require all3 fresh hosted
gates. Final acceptance and PR description must name the last green publication
SHA. No manual AF rerun, no launcher PR, no ignored failure or premature A7 check.

## Captured-strategy hosted closure and documentation publication

Source HEAD: c4caffe33768b14445863ba31d153e441633c8f8.
Actual checkout merge: 4682dd9f47d81a55a515be44ebca19a1afb8828d into
main 3906f8243347fb7c697bf5f6949389c3a784a13d, attempt1.
All three job logs bind this source head; timestamps below are UTC on 2026-11-12.
No failed-job rerun was needed. Step1 af61ba7 was already fully green, so Step2
launcher diagnosis/PR was not selected and M5 source remains untouched.

| Claim                                 | Evidence                                                                                                                                                                                                                                                                              | Date       | Result |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Captured-strategy Preflight           | [Run43246873412](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873412), source HEAD/merge below; SUCCESS 2026-11-12T15:21:33Z, policy binding and 24/24 tests, 0 skipped.                                                                                                 | 2026-11-12 | PASS   |
| Captured-strategy Sync Targeted       | [Run43246873613 job131281781423](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873613/job/131281781423), source HEAD/merge below; SUCCESS 2026-11-12T15:23:38Z. Actual generation/build, 26 units and 52 real PostgreSQL tests, 0 failures/skips; all cleanup steps PASS. | 2026-11-12 | PASS   |
| Captured-strategy full Foundation     | [Run43246873727 job131281781892](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873727/job/131281781892), source HEAD/merge below; SUCCESS 2026-11-12T15:37:46Z. Every mandatory step 4-10 executed and passed; only failure-only Diagnostics skipped.                     | 2026-11-12 | PASS   |
| Canonical quality and full PostgreSQL | Same Foundation, step4 PASS 15:26:54Z: 640 ordinary tests, 133 real integration tests and 1 disposable-cluster test, all 0 failure/skip; contracts, migrations/repeat/drift and restricted-role/custody checks PASS.                                                                  | 2026-11-12 | PASS   |
| M5 and runtime gates                  | Same Foundation: M5 step5 PASS 15:27:34Z (16 captures); runtime/provisioning/TTY/browser step7 PASS 15:33:06Z; HTTPS/ingress/onboarding/restore step8 PASS 15:34:26Z; persistence step9 PASS 15:35:22Z; development step10 PASS 15:37:24Z; owned cleanup PASS 15:37:44Z.              | 2026-11-12 | PASS   |

Independent follow-up source review found no P1/P2/P3 defect and no material
scope change needing snapshot v3. The internal application metadata field change
is explicitly documented in the delta; it is not claimed to leave that type
unchanged. Existing admission flags/null/type-disabled/single-resolution tests and
all six protected repository bodies remain unchanged in behavior. Production
registration is empty; PROVIDER_LENGTH_SINGLE_SOURCE remains open. Status stays
VERIFICATION PENDING, Capability IMPLEMENTED, Verification PARTIALLY VERIFIED.

The prior local-only af61ba7 evidence is now committed in c4caffe; all historical
FAIL entries remain, including eea7287, 7d96b86 Chromium startup, local integration
prerequisites/ENOSPC and af61ba7 host-quality failure. Current green runs do not
establish their causes or rewrite them as PASS. No owner approval, merge or
production activation is performed.

This task-only evidence publication requires its OWN fresh Preflight, Sync
Targeted and full Foundation steps4-10. At this checkpoint c4caffe is the verified
implementation head; the new documentation head has not yet been certified.
The final green documentation SHA, actual merge, run URLs and outcomes are
recorded in PR34 description after execution, per testing.md, rather than a
self-referential SHA-only documentation loop. Handoff is blocked until those
documentation-head gates also pass.

The selected local execution environment became unavailable after source-head CI
completed. This evidence commit is published using the GitHub connector; no local
commands on its new SHA are claimed. All local commands in the previous table
ran before that loss of availability. New-head full quality, PostgreSQL and
browser/runtime verification are performed by the actual canonical hosted jobs.
No snapshot, formatter ignore, source, test, workflow or launcher change is
included in this publication.

## Closure — 2026-11-12

Delivered by PR #34. Hosted Preflight, Sync Targeted and full Foundation passed on source head c4caffe (runs 43246873412, 43246873613, 43246873727); later commits before merge changed only the task file. PLAN ISSUE PROVIDER_LENGTH_SINGLE_SOURCE moves to NEXORA-044. PLAN ISSUE PRODUCTION_DOMAIN_WRITE_CONTRACT remains a Phase B/C prerequisite documented in docs/architecture/sync-extensions.md.

| Claim                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                           | Date       | Result |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Merged to main           | PR #34, merge 010b6ec944f224f829eb0e663c70eca46e186379, 2026-11-12                                                                                                                                                                                                                                                                                                                                                 | 2026-11-12 | PASS   |
| Source-head hosted gates | Preflight [43246873412](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873412), Sync Targeted [43246873613](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873613), Foundation [43246873727](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873727) on c4caffe33768b14445863ba31d153e441633c8f8 (merge 4682dd9f47d81a55a515be44ebca19a1afb8828d): all PASS, Foundation steps 4–10 | 2026-11-12 | PASS   |

Follow-up: [NEXORA-044](../active/NEXORA-044-provider-length-single-source.md).

PRODUCTION_DOMAIN_WRITE_CONTRACT remains a Phase B/C prerequisite in
[Sync extensions](../../architecture/sync-extensions.md).
