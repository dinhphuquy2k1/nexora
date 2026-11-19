# NEXORA-059 — HTTPS network actor Phase1 E0/E1/E2

Task ID: NEXORA-059
Classification: SIGNIFICANT
Plan revision: rev-2026-11-18-https-network-actor-v2
Reviewed baseline: dcac5e5ccad2f737778bd1d621a5d1567e01db77

## 1. Context

Owner keeps PR56 open/unmerged. Baseline PR57 step8-only run44276290570 passed15/15; that does not exclude a PR56-specific effect. Historical v1 snapshot remains immutable. Owner authorizes these three Phase1 experiments and this v2 snapshot, not a causal repair or merge.

## 2. Scope and goals

E0 inventories Foundation runs/attempts for a fixed30day UTC window without triggering CI. E1 runs15 independent step8-only trials on a temporary merge of PR56 HEAD and the PR57 harness checkpoint. E2 runs10 independent jobs on PR57, each executing the exact Foundation runtime-smoke command then public-https-smoke command. Persist compact safe per-trial evidence and stop after final evidence push.

## 3. Non-goals

No production, Compose, adapter, worker, API/DTO/SDK/schema/migration/grant changes. No fixture reordering, transport retries, security bypass, inner timeout or assertion weakening. No Phase2 fix, automatic replacement trials, main update or PR merge. PR56 never enters the PR57 branch.

## 4. Inspection and reuse audit

Inspected AGENTS, routed AI/runtime/testing documents, task059/v1, both review skills, Foundation/stress workflows, runtime-smoke/public-https-smoke scripts and existing diagnostic observers/tests. Queries included workflow selectors, evidence retention and observer caps. Existing Foundation step7 is `sh scripts/runtime-smoke.sh`; step8 is `sh scripts/public-https-smoke.sh`.

| Field                    | Decision                                                                                                                                                                                                  |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Optional experiment selection, matrix and safe trial orchestration                                                                                                                                        |
| Existing implementations | .github/workflows/https-stress.yml; .github/workflows/foundation.yml; scripts/public-https-smoke.sh; scripts/public-https-diagnostics.mjs; scripts/public-https-environment.mjs; scripts/runtime-smoke.sh |
| Domain owner             | Operations test harness; no business aggregate                                                                                                                                                            |
| Reuse alternatives       | Extend existing workflow; duplicate workflow; causal changes rejected                                                                                                                                     |
| Selected approach        | One selector and one matrix workflow; reuse exact existing smoke scripts and projections                                                                                                                  |
| Rationale                | Common harness checkpoint isolates branch/runtime sequence without changing acceptance                                                                                                                    |
| Risks                    | Accidental extra runs, censored trials, lost rerun history, secret leakage and overstated causality                                                                                                       |
| Verification             | Selection/matrix/status projection tests, existing observer suite, operation/governance/full quality, exact-head hosted trial/artifact inspection                                                         |

## 5. Alternatives and decisions

Keep step8-only15 versus runtime-then-https10, fail-fast false, independent ubuntu24.04 jobs. Dispatch input selects mode; PR labels require https-stress and use https-stress-runtime to select the runtime variant exclusively. No sleeps or cleanup inserted between script invocations. Job budget may cover the longer experiment; existing script limits remain. E0 reads all pages and attempts, with explicit unknown buckets.

## 6. Interfaces and ownership

Selector returns only closed mode and trial numbers. Workflow records mode, trial, source/checkout SHA and separate build/runtime/HTTPS outcomes. Reuse strict existing environment/failure JSON projections; persist only compact Markdown summaries and permitted diagnostic lines in docs/tasks/evidence/NEXORA-059/. No generic runner/framework or dependency is introduced.

## 7. Security and concurrency

Workflow permissions contents:read, pinned actions/Node/pnpm and7day artifacts remain. Raw logs stay private and temporary; no fixture/session JSON, tokens, certificates or arbitrary Docker/network data in artifacts/Git. Preserve observer caps/deadlines/cleanup. Each matrix job has an independent runner. Remove trigger labels before source pushes and after trials. No automatic rerun of E1/E2, including expected HTTPS failures.

## 8. Compatibility and domain invariants

Technical harness only, no Domain model or business persistence change. TLS/Origin/MFA/cookies/auth deadlines, existing commands/assertions/fixture ordering and live-provider gates are unchanged. E1 temporary merge must preserve PR56 production source; only mechanical conflicts may be resolved. E2 step8 is NOT RUN if runtime fails; it is never a successful browser trial.

## 9. Verification-first

Add selection/matrix/status tests before implementation, execute RED/GREEN and existing privacy/observer/status tests. Verify YAML/shell, pinned quality, operations/lint/docs/preflight tests and snapshot binding. Compare protected source/commands and review complete diff. Record actual failures, missing logs and environment limitations. Self-review is not independent approval.

## 10. Execution plan

1. Confirm PR56/57 HEADs/status/labels and preserve unrelated work. Update P3 baseline PR metadata.
2. Record fixed E0 window; paginate all Foundation runs/attempts, read step results and failing logs, group main/PR56/other/unknown and retain denominators.
3. Freeze v2 after Prettier3.6.2, update task/PR binding; implement/test selector and common optional workflow. Push one checkpoint with trigger labels absent.
4. E1 temporary branch starts at confirmed PR56 HEAD; merge exact checkpoint, verify parents/production identity. Dispatch if available, else temporary draft PR with task059 metadata and https-stress label. Collect15 trials; unlabel and close temporary PR without merge.
5. E2 executes runtime-then-https10 on PR57 checkpoint via dispatch or both labels. No intermediate corrective operation. Collect all outcomes; remove labels.
6. Download logs/artifacts, verify provenance/digests and write four Markdown evidence documents with baseline/E0/E1/E2 and unavailable coverage.
7. Update task/testing and PR metadata honestly. Final evidence commit/push on PR57 only, then stop. Do not create an evidence/CI loop or claim unverified new HEAD green.

## 11. Documentation Impact

Documentation Impact: REQUIRED. Canonical owner docs/operations/testing.md documents two modes/counting. Task059 records execution; evidence README/foundation-30d/e1-pr56-step8/e2-runtime-then-https retain compact summaries, exact run/attempt/HEAD/UTC and permitted verbatim environment diagnostics. Raw artifacts/logs remain outside Git.

## 12. Interpretation and stop conditions

E1-only excess failures suggest branch association, not proof of a specific change. E2 failures are correlated with coarse interface and Docker events: veth plus container events H1; bridge/docker0 plus network events H2; eth with sufficient observer coverage and no Docker event H3. Both/no failures or conflicting coverage retain uncertainty; combine E0 rates without inventing causality.

A permits new fixture/test/helper mistakes, typo/type/lint/format/environment fixes, and at most one unrelated Foundation5–10 job rerun with history. B stops for unapproved design/production/contract/schema/grant changes, unexplained original-test failure, Preflight/SyncTargeted/Foundation4 failure, repeated ordinary CI failure or inadequate API/log/artifact access. Expected matrix HTTPS failures are observations: let all scheduled trials finish, do not rerun/replace them. Phase2 requires owner review. Keep PR56 open; no merge or issue/task closure.
