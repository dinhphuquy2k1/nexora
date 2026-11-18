# NEXORA-059 — Public HTTPS network actor investigation

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Scope

Owner-requested SIGNIFICANT Phase1 evidence collection for intermittent Foundation8 and [issue44](https://github.com/dinhphuquy2k1/nexora/issues/44). Stop after15 independent labeled-PR trials and report actor/evidence or NOT VERIFIED. Phase2 not authorized yet. No merge. PR56 remains open; NEXORA057 is not closed. Branch starts at origin/main a19aa0d2532b41135a90c6e48e3b6876471ad343, not PR56.

## Design Review & Reuse Decision

Task ID: NEXORA-059
Classification: SIGNIFICANT
Plan revision: rev-2026-11-18-https-network-actor-v1
Reviewed baseline: a19aa0d2532b41135a90c6e48e3b6876471ad343
Branch: investigate/https-network-actor
Design Snapshot: docs/tasks/design-reviews/NEXORA-059-rev-2026-11-18-https-network-actor-v1.md
Design SHA-256: d0efcc3767308ca45e31b65dc25e94fb09fcf68ccdd62cffafa27c5b734744c9

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
- [ ] Draft PR and15 independent trials; per-failure interface/service/action evidence; remove label afterward.
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
