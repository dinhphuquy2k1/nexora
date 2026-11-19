# NEXORA-059 — Public HTTPS network actor investigation

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Scope

Owner-requested SIGNIFICANT Phase1 evidence collection for intermittent Foundation8 and [issue44](https://github.com/dinhphuquy2k1/nexora/issues/44). V1 baseline15 trials completed; owner-authorized v2 adds E0 history, E1 PR56/harness15 trials and E2 runtime/HTTPS10 trials, then report actor/evidence or NOT VERIFIED. Phase2 not authorized yet. No PR57 merge or Phase2 repair. PR56 subsequently merged into main as9d52e7fd9a2bf4e35f33b63ae2ff51e221798fb8; merged into this branch without rebase, and NEXORA057 closed in separate commit168af39 under §1.7. Branch originally started at origin/main a19aa0d2532b41135a90c6e48e3b6876471ad343. Owner-authorized v3 adds the exact Foundation diagnostics exception, read-only preexisting-container snapshot and15 full Foundation E3 calls. Historical checkpoints below retain their original state.

## Design Review & Reuse Decision

Task ID: NEXORA-059
Classification: SIGNIFICANT
Plan revision: rev-2026-11-19-network-settle-v4
Reviewed baseline: 619175e87071667b007dd7c5560e8641a33c48f6
Branch: investigate/https-network-actor
Design Snapshot: docs/tasks/design-reviews/NEXORA-059-rev-2026-11-19-network-settle-v4.md
Design SHA-256: edf749965114bcfd83c60ece56c7d1f9414254ba4b70a533d3e63e81d3de3c2e

| Field                    | Decision                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Disposable Public HTTPS environment attribution, script reasons, per-request status and optional stress workflow                                                                                                                                                                                                                                                              |
| Existing implementations | scripts/public-https-diagnostics.mjs CDP lifecycle; bfe89e8 diagnostic-only helpers/strict projections/operator observations; scripts/browser-teardown.mjs bounded owned-child cleanup; scripts/login-readiness-diagnostics.mjs closed Script reasons; scripts/smoke-checks.mjs status assertions; public-https-smoke.sh owned Compose fixture; foundation.yml pinned actions |
| Domain owner             | Operations test harness, docs/operations/testing.md; no business-domain aggregate                                                                                                                                                                                                                                                                                             |
| Reuse alternatives       | Port only reviewed diagnostic harness changes from bfe89e8; extend existing collectors instead of new framework; raw docker/ip logs rejected; changing fixture order, browser namespace or retries before attribution rejected                                                                                                                                                |
| Selected approach        | From origin/main, reuse four diagnostic-only files from bfe89e8 (no Uniship files). Add closed interface groups, bounded Docker observer during entire step8, safe plus/minus5s correlation at failure; add request-start status reset; optional PR-label/dispatch15-job workflow. No causal correction in Phase1                                                             |
| Rationale                | Existing failures predate Uniship; time-aligned service/action and coarse interface evidence discriminates Docker from host events without exposing addresses or guessing actor                                                                                                                                                                                               |
| Risks                    | Correlation is not proof; capped rolling buffers can drop older events (counts/dropped explicit); missing observer must be UNAVAILABLE; separate hosted jobs can fail build/setup and cannot count as browser PASS; no production runtime change                                                                                                                              |
| Verification             | RED/GREEN interface samples, Docker privacy/caps/errors/deadline/cleanup, correlation boundary and stale status tests; focused/operations/full script/quality/docs/preflight/binding checks; independent review;15 independent hosted trials, artifacts7days, record all failures                                                                                             |

## Domain invariants and Tactical DDD boundaries

Technical operations harness only; no business Aggregate, domain command, persistence port, API/OpenAPI/SDK, schema, migration or application behavior changes. Domain ownership remains with existing features. Preserve all TLS/Origin/MFA/cookie/HTTP assertions and original fixture command order; no auth mutation retries. Observer metadata is bounded and strictly projected. Phase2 remains blocked on explicit owner review of Phase1 evidence.

## Plan

1. Inspect main, PR56 merge state, issue44, NEXORA048 and all routed harness/runtime/governance files. PR56 is open: do not close NEXORA057. Reserve NEXORA059 after active/completed/snapshot/open-PR inventory.
2. Freeze this SIGNIFICANT snapshot after Prettier and raw SHA; record task binding before code. Start branch from origin/main, never from PR56; merge main normally if owner merges it later.
3. Port only diagnostic harness files from bfe89e8 as reuse; no provider code. Add failing tests for interface grouping, safe bounded Docker observations and failure-window projection, new Script reasons and request status reset.
4. Add read-only observer process before first fixture Compose operation through final cleanup, bounded to step/job time. Retain at most200 Docker events and200 network events as rolling projections; only service allowlist/other, closed Type/Action, UTC/group/category. Browser logs one environment summary around failed request interval plus/minus5s; later diagnostics cannot mask original failure. Stop both observers on signal/deadline/exit, private raw buffers never persist. Existing browser-local observer remains for request correlation.
5. Reset smoke status at each Node/browser HTTP request start, preserving all assertions. Add NETWORK_CHANGED/INTERNET_DISCONNECTED reason counts. Do not change until/readiness/MFA/Origin/TLS/assertions/fixture ordering or add mutation retries.
6. New optional workflow pull_request labeled/synchronize plus workflow_dispatch, label https-stress gate; fail-fast false,15 matrix jobs on independent ubuntu24.04 runners. Build prerequisite release images only, then execute unmodified step8 fixture sequence. Upload safe diagnostic summaries per trial,7day retention; never upload raw fixture/cookies/certificates/server logs. Not required checks. Draft PR, create/apply label, await15 trials, remove label.
7. Canonical testing documentation and task evidence: exact source/merge/time/run/job/attempt/result, failures and coverage limitations. Compare all fifteen outcomes and each failure interface group with Docker service/actions within5s. If no reproduction, report0/N and propose further load/trials rather than infer repair.
8. STOP after Phase1. Actor attribution only as strong as evidence permits; issue44 remains open unless a later approved Phase2 proves its cause and correction. No merge. Phase2 requires explicit owner review of Phase1 and a new recorded design delta before causal correction.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Coarse interface groups, bounded Docker correlation and Script error reasons; request-specific status reset; optional15-run PR-label/dispatch workflow and7day safe artifacts.

### Canonical owners

- docs/operations/testing.md

### Documentation verification

- format:check, docs:check, preflight:check, test:docs

## Acceptance

- [x] Test-first safe bounded observations and cleanup; existing assertions/deadlines/order preserved.
- [x] Local checks and independent review.
- [x] V1 draft PR and15 independent baseline trials; label removed (run44276290570).
- [x] V2 E0 inventory and E1 fifteen trials; E2 ten attempted trials; evidence collected, labels removed and temporary PR58 closed/unmerged.
- [ ] Valid E2 runtime-to-HTTPS coverage: blocked before HTTPS in all10 trials; owner decision required for any new batch.
- [ ] Phase1 report to owner; no Phase2 or merge.

## Evidence

| Claim                                       | Evidence                                                                                                                                                                                                               | Date       | Result |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and conditional closure inspection | origin/main a19aa0d2532b41135a90c6e48e3b6876471ad343; PR56 bfe89e848494fe26254f3e82305c83c5be312691 open/unmerged on2026-11-18 UTC; active/completed/design/open-PR inventory reserves NEXORA059; no closure performed | 2026-11-18 | PASS   |

## Phase1 local execution

Checkpoint: working tree on origin/main a19aa0d2532b41135a90c6e48e3b6876471ad343, pinned Node24.19.0/pnpm10.34.6; all timestamps UTC. PR56 still open, no closure or Uniship changes. Ported only four diagnostic harness files from bfe89e8 as recorded reuse, then extended Phase1 observations. Production/apps/packages/Compose/Foundation workflow unchanged.

Initial RED: new behaviors absent (interface groups, Docker observer/window, Script reasons, request-start reset). First GREEN candidate33PASS/1FAIL was the ported diagnostic test expecting32 oldest LINK events; the planned rolling buffer now retained30LINK+1ADDR+1ROUTE. Updated that assertion to the intended rolling-window contract;34/34GREEN. This is a test for new reused diagnostics, not an application assertion change.

Actual owned namespace ip-monitor probe showed zero spaces after [ADDR] before index. Updated new fixtures to native no-space/deleted/peer formats:3PASS/1FAIL, parser changed only whitespace to optional, then4/4GREEN. Tests cover all six coarse interface groups. Initial lintFAIL missing timer imports in new observer CLI; fixed explicit node:timers imports. Initial qualityFAIL missing explicit domain-invariants paragraph in new task; added technical-harness/DDD-omission rationale, no snapshot/design change. All historical FAILs retained below.

Real owned observer CLI reached network STOPPED and Docker STOPPED after SIGTERM; private JSON directory removed. No host network changes except the separately owned namespace synthetic sample. Static AST comparison preserves every original assertion/checks.status call, request/CDP/launch/readiness deadlines and exact fixture Compose command sequence. Future-window diagnostic collection waits at most5300ms after the original assertion already failed, including300ms for250ms atomic snapshot flush; no auth timeout or retry changes. Independent review P1=0/P2=0/P3=0 (read-only, not test execution or owner approval); final follow-up review pending if additional findings arise.

Local full Docker/Public HTTPS NOT RUN: rootless VFS app images unavailable and about700MiB free; no global prune, user volumes or unrelated work changed. The optional hosted15-trial workflow supplies Phase1 runtime observations; no trial may be reported as browser PASS if prerequisite build/setup failed. Canonical Foundation on draft PR remains separately required evidence, not causal proof. Root actor remains NOT VERIFIED; no Phase2 implementation or merge.

| Claim                     | Evidence                                                                                                                                                                                                                                                                                                         | Date       | Result |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| task059-red               | `node --test scripts/public-https-environment.test.mjs scripts/smoke-checks.test.mjs scripts/login-readiness-diagnostics.test.mjs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:15:37.363820+00:00–2026-11-18T09:15:37.876677+00:00; exit1                                           | 2026-11-18 | FAIL   |
| task059-green             | `node --test scripts/public-https-environment.test.mjs scripts/public-https-diagnostics.test.mjs scripts/smoke-checks.test.mjs scripts/login-readiness-diagnostics.test.mjs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:16:27.491288+00:00–2026-11-18T09:16:29.016632+00:00; exit1 | 2026-11-18 | FAIL   |
| task059-green2            | `node --test scripts/public-https-environment.test.mjs scripts/public-https-diagnostics.test.mjs scripts/smoke-checks.test.mjs scripts/login-readiness-diagnostics.test.mjs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:17:33.670063+00:00–2026-11-18T09:17:34.488678+00:00; exit0 | 2026-11-18 | PASS   |
| task059-focused           | `node --test scripts/public-https-environment.test.mjs scripts/public-https-diagnostics.test.mjs scripts/smoke-checks.test.mjs scripts/login-readiness-diagnostics.test.mjs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:19:14.875364+00:00–2026-11-18T09:19:15.974559+00:00; exit0 | 2026-11-18 | PASS   |
| task059-lint              | `npx --yes pnpm@10.34.6 lint`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:19:16.040168+00:00–2026-11-18T09:19:30.276221+00:00; exit1                                                                                                                                                | 2026-11-18 | FAIL   |
| task059-static            | `node /tmp/nexora059-static.cjs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:20:02.072283+00:00–2026-11-18T09:20:02.820687+00:00; exit0                                                                                                                                             | 2026-11-18 | PASS   |
| task059-quality           | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:20:05.321333+00:00–2026-11-18T09:20:40.772798+00:00; exit1                                                                                    | 2026-11-18 | FAIL   |
| task059-native-format-red | `node --test scripts/public-https-environment.test.mjs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:20:48.507929+00:00–2026-11-18T09:20:49.041001+00:00; exit1                                                                                                                      | 2026-11-18 | FAIL   |
| task059-owned-observer    | `node /tmp/nexora059-owned-observer.mjs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:21:37.543497+00:00–2026-11-18T09:21:38.423520+00:00; exit0                                                                                                                                     | 2026-11-18 | PASS   |
| task059-final-focused     | `node --test scripts/public-https-environment.test.mjs scripts/public-https-diagnostics.test.mjs scripts/smoke-checks.test.mjs scripts/login-readiness-diagnostics.test.mjs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:22:16.877472+00:00–2026-11-18T09:22:17.627374+00:00; exit0 | 2026-11-18 | PASS   |
| task059-test-lint         | `npx --yes pnpm@10.34.6 test:lint`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:22:17.685469+00:00–2026-11-18T09:22:27.509075+00:00; exit0                                                                                                                                           | 2026-11-18 | PASS   |
| task059-operations        | `npx --yes pnpm@10.34.6 test:operations`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:22:27.574491+00:00–2026-11-18T09:22:29.963048+00:00; exit0                                                                                                                                     | 2026-11-18 | PASS   |
| task059-test-docs         | `npx --yes pnpm@10.34.6 test:docs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:22:30.021310+00:00–2026-11-18T09:22:32.665832+00:00; exit0                                                                                                                                           | 2026-11-18 | PASS   |
| task059-test-preflight    | `npx --yes pnpm@10.34.6 test:preflight`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:22:32.796511+00:00–2026-11-18T09:22:35.711897+00:00; exit0                                                                                                                                      | 2026-11-18 | PASS   |
| task059-static-final      | `node /tmp/nexora059-static.cjs`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:23:40.579451+00:00–2026-11-18T09:23:41.503003+00:00; exit0                                                                                                                                             | 2026-11-18 | PASS   |
| task059-quality-green     | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:21:08.812729+00:00–2026-11-18T09:23:59.930446+00:00; exit0                                                                                    | 2026-11-18 | PASS   |

Workflow structural verification: Python YAML BaseLoader confirms only labeled/synchronize PR and manual dispatch triggers, https-stress job gate,15 matrix entries, fail-fast false,7day artifact retention. Source/privacy checks are distinct from actual hosted outcomes, which remain pending. Frozen snapshot raw SHA-256 d0efcc3767308ca45e31b65dc25e94fb09fcf68ccdd62cffafa27c5b734744c9 unchanged.

| Claim                    | Evidence                                                                                                                                                                                                                                                                                                                                    | Date       | Result |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Final local quality      | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`; working tree on a19aa0d2532b41135a90c6e48e3b6876471ad343; 2026-11-18T09:24:27.575499+00:00–2026-11-18T09:27:07.584650+00:00; exit0; root scripts166/166PASS; format/lint/boundaries/preflight/docs/typecheck/workspace tests/contracts/buildPASS | 2026-11-18 | PASS   |
| Task snapshot binding    | validatePrTaskBinding with exact five PR metadata lines: valid true,0failures; same working tree;2026-11-18UTC                                                                                                                                                                                                                              | 2026-11-18 | PASS   |
| Final independent review | /root/shipment_list_review read-only review and final parser/flush/artifact follow-up: P1=0/P2=0/P3=0; no test-execution or owner-approval claim                                                                                                                                                                                            | 2026-11-18 | PASS   |

Fetch provenance: generic git fetch encountered a stale configured remote branch ref; explicit `git fetch origin main:refs/remotes/origin/main` PASS confirmed baseline unchanged. No Git configuration or unrelated branches modified. Label https-stress created; not yet applied.

## Owner-authorized v2 Phase1 amendment — E0/E1/E2

Baseline dcac5e5; PR56 bfe89e8 remains open/unmerged. V1 snapshot bytes/history
are unchanged. Pre-code inspection/reuse matrix, risk, scope and verification
are recorded in the linked frozen v2 snapshot. No aggregate or contract changes.
Documentation Impact remains REQUIRED. Owner authorizes only experiment
workflow/test/evidence changes, not a causal correction.

E0: fixed30day UTC Foundation inventory, all run pages and attempts; distinguish
run/attempt/step8 denominators and unknowns. E1: confirmed PR56 plus common
harness checkpoint,15 step8-only trials on temporary branch/optional draft PR.
E2: PR57 checkpoint,10 same-job runtime then HTTPS trials. Do not replace failed
trials or infer causality from branch rates alone. Final evidence push then stop.

Reviewed baseline hosted evidence: Preflight44276243246 and
Foundation44276243256 PASS on dcac5e5 (mergef1663e6); Sync Targeted NOT RUN due
to path filters. Baseline stress44276290570 attempt1 passed15/15 with downloaded
artifact digest/source/checkout/observer cleanup inspection. These are historical
baseline results, never evidence for the forthcoming workflow checkpoint.

### V2 harness checkpoint verification

| Claim                       | Evidence                                                                                                                                                                  | Date       | Result |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| Selector RED                | New public-https-stress-plan.test.mjs fails with missing selector module before implementation                                                                            | 2026-11-18 | FAIL   |
| Selector and observer GREEN | Five focused suites38/38: unarmed labels, exclusive15/10 modes, dispatch independence, closed output privacy, existing observer/redaction/status/cleanup                  | 2026-11-18 | PASS   |
| Workflow syntax             | PyYAML6.0.3 BaseLoader; bash -n every literal run block; read-only permission, fail-fast false and7day retention assertions                                               | 2026-11-18 | PASS   |
| Full quality                | API_INTERNAL_URL=http://api:4000 NODE_ENV=production pinned pnpm10.34.6 quality: format/lint/boundaries/preflight/docs/typecheck,820tests, contracts and production build | 2026-11-18 | PASS   |
| Governance and operations   | test:operations9/9, test:lint56/56, test:docs10/10, test:preflight24/24                                                                                                   | 2026-11-18 | PASS   |

Self-review against v2: only optional workflow/selector/tests and canonical
docs/task/snapshot changed; no protected production/Compose/Foundation/smoke-script
change or new dependency. No confirmed P1/P2; this is not independent approval.
Snapshotv1 raw digest unchanged; v2 formatted before hashing. Canonical local
Docker NOT RUN because the small overlay has about1.7GiB available and no matching
application images; hosted experiments/Foundation provide actual Docker evidence.
No local screenshots captured/manually reviewed.

E0 inventory began2026-11-18T09:57:49Z with fixed start2026-10-19T09:57:49Z:
498unique Foundation runs/539attempts retrieved with pagination and rerun history.
Run PR metadata plus unique branch/lifetime and git ancestry classify all attempts;
47 Public HTTPS failures require per-job log inspection. No E0 workflow triggered.
Initial gh run view log reads returned empty output despite exit0; do not treat
those files as logs. Retrieve actual job logs through the Actions API instead.

## V2 Phase1 experiment outcomes — stop checkpoint

Common source checkpoint e15f23762741fbe6ce50fdd5e31713e4edd6dc92. E1 source
26e6752cd24f7267e0468c968a9a5e10b4426e55 merges PR56 bfe89e8 and that checkpoint;
protected production/Compose identity and exact selected harness identity checked.
Mechanical conflicts only: checkpoint diagnostic extensions retained, documentation
union retains both Uniship and experiment facts; browser assert/status AST intact.
No PR56 code was merged into PR57. Temporary draft PR58 closed/unmerged after
artifact retrieval. All experiment trigger labels removed before final push.

| Claim                             | Evidence                                                                                                                                                                                                                                   | Date       | Result |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| E0 inventory                      | 498unique Foundation runs/539attempts in2026-10-19T09:57:49Z..2026-11-18T09:57:49Z; all pages/attempts,47 actual failed-step job logs; main5/26, PR56 3/6, other PR39/181 observed HTTPS failures,304 skipped and22 unavailable jobs/steps | 2026-11-18 | PASS   |
| E1 standalone HTTPS               | [run44282344066](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282344066) attempt1:15/15 reached HTTPS and PASS;15ZIP hashes/source/checkout/stage/observer cleanup checked                                                       | 2026-11-18 | PASS   |
| E2 runtime prerequisite           | [run44282193030](https://github.com/dinhphuquy2k1/nexora/actions/runs/44282193030) attempt1: build10/10PASS, runtime10/10FAIL, HTTPS10/10NOT RUN; no trial rerun/replacement                                                               | 2026-11-18 | FAIL   |
| E2 exact observations             | Trial1 BROWSER_LAUNCH/ASSERTION_FAILED; trials2..10 RETAIL_ISOLATED_FIXTURE/CHECK_FAILED;10ZIP hashes/source/checkout/stage outcomes checked, no HTTPS environment diagnostic fabricated                                                   | 2026-11-18 | PASS   |
| Evidence renderer initial attempt | Private renderer lacked baseline artifact expiry metadata and failed KeyError; fetched actual artifact API metadata then regenerated, no test/source assertion change                                                                      | 2026-11-18 | FAIL   |
| Evidence documentation            | Compact Markdown under evidence/NEXORA-059; no raw log/ZIP/fixture/media; docs:check PASS                                                                                                                                                  | 2026-11-18 | PASS   |

Evidence convention/provenance and all trial rows are in
[README](../evidence/NEXORA-059/README.md),
[E0](../evidence/NEXORA-059/foundation-30d.md),
[E1](../evidence/NEXORA-059/e1-pr56-step8.md),
[E2](../evidence/NEXORA-059/e2-runtime-then-https.md).

Final review finding P2: standalone E2 omitted existing Foundation4 host fixture
build prerequisites. Retail check requires artifacts/retail-fixture/bundle.js;
release-image builds do not generate that host bundle. This is a new harness
environment gap (A), not a production/assertion defect. However replacement trials
are explicitly forbidden, so no further batch or corrective runtime change was
executed. The original private Retail exception/errno was not retained; trial1
browser-launch cause remains unexplained and its safe startup hints were not
included in the narrow projection. Record that limitation, do not invent a cause.
The unexplained original-test failure invokes the B stop rule after collecting
unaffected E0/E1/evidence. This is not successful E2 comparison coverage.

No H1/H2/H3 chosen. E1 reproduced0/15, but E2 has0 observed HTTPS executions;
there is no valid E1-versus-E2 causal comparison. Owner should decide any
separately counted prerequisite-complete/instrumented E2 batch. Do not run it here.
Historical statistics are heterogeneous observations, not randomized causal proof.
PR56 remains OPEN/unmerged, issue44/task059 remain open/pending. No Phase2 change,
new production capability or live provider request. Final evidence commit/push
then STOP; unverified new source must not inherit an earlier green HEAD claim.

Final evidence-only verification: pinned pnpm10.34.6 format:check/docs:check/
preflight:check and focused38/38 PASS; git diff --check PASS. Host Node24.22.1
(repository24.x engine), hosted workflow Node24.19.0. All30 baseline/E1 artifacts
passed strict projected-key/interface/cap checks; all25 E1/E2 ZIP hashes verified.
Self-review retains the explicit E2 prerequisite P2 and unexplained startup limit;
no independent approval claimed. V1/v2 raw snapshot SHA values unchanged. Only
this task and four compact Markdown evidence files change in the final commit.
No new CI batch or replacement trial. Hosted checks for the evidence commit remain
PENDING at final push by the owner stop instruction; earlier green results stay
historical. No causal fix, assertion/timeout change or merge.

## Owner-authorized E3 review delta — 2026-11-19

Planv3 records the explicit Foundation exception: workflow_call/input, diagnostic
env, unique artifact suffixes and one projected HTTPS upload only. Add read-only
preexisting project/service/state/status observation before step8 fixture creation.
No cause correction, existing command/ordering/permission/timeout/assertion change.
Pre-code reuse audit/interfaces/risks/verification are in the linked v3 snapshot;
Documentation Impact REQUIRED. Main PR56 merge9d52e7f incorporated by merge700e8e3,
not rebase. Four mechanical diagnostic/testing-doc conflicts retained current
harness plus main Uniship docs; production/Compose identity against main and
harness identity against pre-merge branch PASS, focused38/38 PASS. Separate
closure168af39 closes057 with final-head hosted gates and retained attempt1FAIL.
058 unchanged against main; no source edits to058.

Owner labels E2 invalid (missing Foundation4 fixture prerequisites). Historical
trial1 BROWSER_LAUNCH/ASSERTION_FAILED is separately retained in E2 evidence;
BROWSER_STARTUP_DIAGNOSTIC was not retained by that run's narrow projection.
No startup investigation or E2 rerun in E3. Exactly15 full Foundation calls are
authorized after the ordinary new-head gate, with no replacement or extra batch.

### E3 implementation checkpoint checks

| Claim                      | Evidence                                                                                                                                                                                                                                              | Date       | Result |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| New behavior RED           | New preexisting test import fails for missing exports; foundation selector test fails before implementation                                                                                                                                           | 2026-11-19 | FAIL   |
| Focused GREEN              | Six Node suites43/43, including four-field privacy/100cap/Docker failures/CLI success and exclusive full-mode selection; old observer/status suites unchanged                                                                                         | 2026-11-19 | PASS   |
| Exact Foundation exception | PyYAML BaseLoader comparison against merged main removes only workflow_call, one env, six suffixes and exact new upload; all remaining parsed triggers/jobs/steps/commands/order/permissions/timeouts equal;15-call matrix and bash -n all run blocks | 2026-11-19 | PASS   |
| Requested local gates      | pinned pnpm10.34.6 format:check, lint/boundaries, docs:check, preflight:check PASS; test:docs10/10 and test:preflight24/24                                                                                                                            | 2026-11-19 | PASS   |
| Live read-only snapshot    | node scripts/public-https-preexisting.mjs against local Docker: OBSERVED,0rows; no mutation, no raw output retained                                                                                                                                   | 2026-11-19 | PASS   |

actionlint NOT RUN: executable is not installed; PyYAML structure/shell checks are
separate evidence, not an actionlint claim. Local canonical Docker/full browser
NOT RUN due small overlay capacity; ordinary hosted Foundation is the required
next gate. No local images captured or manually reviewed. Source review retains
only owner-approved Foundation changes and read-only diagnostics; no confirmed
new P1/P2, self-review only (no independent approval claim). Artifact-name search
found documentation/historical references; ordinary names remain unchanged, no
script downloader is broken. V1/v2 snapshots and058 bytes match merged main/
historical bytes; v3 formatted before SHA. E2 remains invalid, never promoted PASS.

### E3 collected results — 2026-11-19

[Full E3 evidence](../evidence/NEXORA-059/e3-20261119-1105.md) records source
900950ea652054e940560cfbca52df2f5b4ac693, merge checkout
95c09918aafae781855eb9833a906b2949b87d3d, run44455913317 attempt1.
Exactly15 independent Foundation calls:12PASS,3FAIL only step8 (trials3,8,13).
No other-step failures; no rerun, replacement or extra batch. Full label removed.
All15 projected HTTPS artifacts downloaded and SHA-256/schema/caps checked.
All15 preexisting snapshots OBSERVED with0containers, including0 nexora-ci running.
This observes the start instant only, not the absence of later Docker changes.

Trials8/13 retain OPERATOR_CREATE net::ERR_NETWORK_CHANGED; ADDR/ROUTE veth
coincides with those failed requests. Their plus/minus5s windows include
network/connect/other and container/start/ingress. Trial3 is CHECK_FAILED in the
same operator-setup substep, but no failed request/script is retained: Chrome
error NOT OBSERVED, do not count it as a confirmed NETWORK_CHANGED transport.
All three windows include veth ADDR/ROUTE and ingress start. Co-occurrence is
not causal proof; exact actor/address family/project attribution not retained.
No H1/H2/H3 causal fix selected or implemented; owner review required for Phase2.

Separate ordinary Foundation44454184736 attempt1 FAIL only step8, interactive
login with4SAME_ORIGIN_NEXT_SCRIPT ERR_NETWORK_CHANGED failures; safe artifact
14498295005 verified, six original unsuffixed artifact names preserved. No rerun.
Preflight44454184718 PASS; unarmed stress44454184720 PASS with batch jobs skipped.
Sync Targeted NOT RUN by path filter. This ordinary sample is excluded from15.

Final evidence-only changes: current Scope reflects mergedPR56/closed057;
historical evidence and snapshots remain unchanged. Hosted results above apply
to checkpoint900950e, not the final evidence commit. Final-head hosted gates
PENDING at push; owner explicitly requires STOP after this evidence push.
No independent approval claimed, no production/API/SDK/DB/Compose change, no058
edit, no fixture/namespace/retry/timeout/assertion change and no PR merge.

Final evidence-only verification: pinned pnpm10.34.6 format:check, docs:check,
preflight:check PASS; docs/preflight Node tests34/34 PASS; git diff --check PASS.
All15 E3 ZIP digests/keys/caps, checkout provenance and4 verbatim environment
lines (3E3 plus ordinary) checked. No IP/MAC patterns retained. V3 binding and
protected-scope comparison PASS. Code/lint/focused checks from checkpoint remain
applicable; this final delta changes only task/evidence Markdown. Self-review,
not independent approval. Final hosted gates PENDING; push then STOP.

### Ingress restart hypothesis — existing evidence only, 2026-11-19

Owner scope: read existing failures E3 trials3/8/13 plus ordinary Foundation
44454184736 attempt1; compare PASS1/2/7. No new CI, code/diagnostics change,
rerun or artifact download. Documentation Impact REQUIRED: this task and
[evidence follow-up](../evidence/NEXORA-059/ingress-restart-20261119-1140.md); immutable v3 unchanged.
Reuse existing verified ZIP projections and GitHub job logs; only safe lifecycle
and nginx lines retained. gh job log returned0bytes despite exit0; connector job
log API fallback provided the actual seven logs. No raw log archive committed.

Verdict(c) for the start near these failures: main ingress initial startup, not
an observed automatic restart. Earlier start/die/destroy is the deliberate TLS
one-off; main create/start then browser failure, followed by cleanup kill/die.
Existing allowlist DOES retain die/kill/oom/restart/health_status. No unexpected
nginx exit or reason observed. Four failure tails have only nginx -t success,
no emerg/alert/crit/error/exited/signal lines. error_log crit suppresses lower
levels; PASS server logs are private and200event buffer evicts their startup,
so do not claim globally absent errors/restarts from that missing coverage.
PASS later stop/start/restart matches explicit fixture backup/restart commands.

Only proposal (not implemented): if owner wants stronger future confirmation,
read RestartCount/State.ExitCode/State.OOMKilled of main ingress after browser
before cleanup; optional capped ingress-only event buffer for startup coverage.
No Action allowlist expansion needed. Owner must approve before diagnostics
modification/execution under this follow-up's §3. No causal repair, no new
snapshot, no runtime or workflow change. Final evidence push then STOP.

| Claim                             | Evidence                                                                                                                                                            | Date       | Result |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Ingress evidence audit            | Seven job logs and existing verified artifacts;78 retained ingress event rows represented; privacy patterns and immutable v3 SHA assertions PASS                    | 2026-11-19 | PASS   |
| Evidence comparison first attempt | Scratch assertion expected unpadded Markdown cells after Prettier; failed only on table spacing; no observation changed                                             | 2026-11-19 | FAIL   |
| Evidence comparison corrected     | Normalize table padding before comparison; all78 projected rows match; no code or CI executed                                                                       | 2026-11-19 | PASS   |
| Evidence documentation checks     | pinned pnpm10.34.6 docs:check; Prettier check of three changed Markdown files; git diff --check PASS; documentation-only self-review, no independent approval claim | 2026-11-19 | PASS   |

### Settle timing prerequisite — 2026-11-19

Documentation Impact REQUIRED; evidence-only continuation of v3. Owner permits
Phase2 only after existing16-sample timing validates FAIL overlap versus PASS
non-overlap. [Timing evidence](../evidence/NEXORA-059/settle-timing-20261119-1144.md)
computes all four failures and audits every12PASS archive. Failed early Δ1:
trial3=1983ms, trial8=1894ms, trial13=1897ms, ordinary=1208ms. Maximum1983ms
is only an observed failed-sample bound. Literal final-event Δ1 maximum12002ms
includes cleanup, not startup settle. First actual browser request NOT VERIFIED;
first retained auth/failed-script timing is listed separately.

Trials8/13 and ordinary have requests in flight at the event. Trial3 has3
successful requests intersecting ±100ms but none pending at the exact event;
its immediate CHECK_FAILED cause remains unknown. All12PASS initial network
intervals were evicted and successful transport not persisted. PASS overlap
UNKNOWN, not false. No PASS contradiction demonstrated, but prerequisite is
INCONCLUSIVE and not satisfied. No IPv6/DAD/ingress-veth ownership proof.

STOP before Phase2: no gate, new test, snapshot revision, metadata change or
new CI. No retry/timeout/assertion/Compose/runner change. Owner must decide
whether to authorize prospective measurements or an explicitly experimental
settle gate despite unavailable PASS contrast. Only task/evidence Markdown
changes; current capability/verification status remains pending/partial.

| Claim                      | Evidence                                                                                                                                                                     | Date       | Result |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Existing timing analysis   | Deterministic UTC interval calculation over16 local artifact projections;12PASS missing early/transport data; four early deltas and6 exact-overlap intervals asserted        | 2026-11-19 | PASS   |
| Evidence-only verification | pinned pnpm10.34.6 docs:check; Prettier of changed Markdown; privacy patterns, unchanged v3 SHA and git diff --check PASS; no code tests needed for documentation-only delta | 2026-11-19 | PASS   |

## Owner-authorized Phase2 intervention — 2026-11-19

Owner explicitly permits the settle experiment despite missing historical PASS controls. V4 pre-code review records existing-observer reuse, contracts, privacy/caps, placement and15-trial criteria. Prior conclusions remain historical; no proven DAD claim. No Foundation/Compose/product change. Documentation Impact REQUIRED. RED/GREEN and hosted results follow.

### Intervention implementation checkpoint

New tests RED (module absent), then GREEN: focused46/46; gate fake-clock quiet,
activity reset, timeout fixed-line/counts, UNAVAILABLE5s and late-unavailability
30s cap; browser-window caps/privacy/unknown Chrome errors/partial/pending/time
boundary; reused observer callback/group-count projection. Lint/boundaries PASS;
docs:check/preflight:check PASS; test:docs10/10 and test:preflight24/24 PASS.
Initial format check raced the newly appended observer test before its Prettier
write and failed on that one new test; formatted and final recheck below.

Gate reuses whole-step private snapshots (no new ip process), cumulative counts
by closed group survive rolling eviction. settle.json plus browser-start-window.json
are automatically inside existing uploaded directory. Window captures PASS/FAIL,
10s from Chromium launch with64events/200requests, drops/pending and CDP-enable
coverage explicit. Diagnostic-only tail wait through10s does not extend any
assertion/request deadline. Gate placement only before initial Chromium; later
fixture restarts precede Node probes, no additional Chromium launch.

V4 selected because v1/v2/v3 are immutable already; no overwrite of older v2.
No Phase2 causal conclusion before actual results. Self-review only, no
independent approval claim. Protected Foundation/Compose/apps/packages unchanged;
existing assert/status/step calls compared structurally and identical. No request
retry/timeout/assertion/namespace change. Ordinary gate and E3 still PENDING.
