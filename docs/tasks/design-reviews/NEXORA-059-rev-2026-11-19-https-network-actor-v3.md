# NEXORA-059 — Phase1 E3 full Foundation observations

Task ID: NEXORA-059
Classification: SIGNIFICANT
Plan revision: rev-2026-11-19-https-network-actor-v3
Reviewed baseline: 168af39006dbb7db3c902e6a047ca7864177782d

## 1. Context

Owner authorizes the explicit Foundation evidence exception and15 complete E3 trials, not a causal repair. E0 observed cross-branch HTTPS failures; standalone baseline/E1 passed30/30. E2 is invalid because Foundation4 fixture prerequisites were missing. The actor behind observed ERR_NETWORK_CHANGED remains unverified. Main includes PR56 merge9d52e7f; merge main without rebasing, close057 separately and leave058 unchanged.

## 2. Scope and goals

Persist projected HTTPS diagnostics on ordinary Foundation failures and all E3 calls. Observe up to100 preexisting containers before constructing the step8 fixture. Run the unchanged full Foundation via15 independent reusable-workflow calls; preserve success and failed-step observations with exact run/job/source/checkout/artifact provenance.

## 3. Non-goals

No production/API/DTO/SDK/schema/migration/grant/Compose/provider change. No fixture reordering, browser namespace change, retry, inner timeout or assertion change. No modification to existing Foundation commands, step order, permissions, COMPOSE_PROJECT_NAME or existing push/main and pull_request triggers. No Phase2, new required check, extra batch or merge of PR57.

## 4. Inspection and reuse audit

Read AGENTS, routed AI/runtime/testing/task/evidence records, both review skills, Foundation/stress workflows and existing smoke/environment/network/Docker collectors. Search six artifact names across the repository: references are historical/canonical documentation, no dependent downloader that requires an E3 unsuffixed name. Ordinary names stay unchanged. Existing composeServices allowlist and child/diagnostic privacy patterns are reused.

| Field                    | Decision                                                                                                                                                                                                              |
| :----------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Foundation evidence exception, E3 caller and preexisting-container projection                                                                                                                                         |
| Existing implementations | .github/workflows/foundation.yml; .github/workflows/https-stress.yml; scripts/public-https-stress-plan.mjs; scripts/public-https-diagnostics.mjs; scripts/public-https-smoke.sh; scripts/public-https-environment.mjs |
| Domain owner             | Operations harness, no business aggregate                                                                                                                                                                             |
| Reuse alternatives       | Reuse full Foundation versus duplicate its steps; raw Docker ps dump rejected                                                                                                                                         |
| Selected approach        | Local reusable Foundation with optional artifact_suffix; bounded pure four-field projection plus small read-only CLI; existing selector adds foundation mode                                                          |
| Rationale                | Runs real4–10 prerequisite chain with unchanged acceptance and captures candidate actors safely                                                                                                                       |
| Risks                    | Artifact collisions, secret labels/status, missing observers or rolling coverage, failures outside8 and causal overstatement                                                                                          |
| Verification             | RED/GREEN projector/command failure/cap/privacy and mode tests; YAML structural exception-envelope comparison, shell, exact requested checks; ordinary hosted gate then15 E3 trials                                   |

## 5. Owner-approved Foundation exception

Only add workflow_call input artifact_suffix (string, optional, empty default); job env PUBLIC_HTTPS_DIAGNOSTICS_DIR=artifacts/public-https; suffix six existing artifact names; and one upload immediately after Pager preservation. New upload uses exact owner if failure() or nonempty suffix, pinned upload action, ignore absent files, retention7days. All other parsed Foundation job/step/trigger/permission values must equal baseline. Existing artifact retention remains14days.

## 6. Diagnostic interface and privacy

Before fixture construction, run docker ps -a --format '{{json .}}' through a bounded read-only helper when the diagnostics directory is set. Persist preexisting-containers.json. Success wrapper contains status and at most100 container rows, each exactly com.docker.compose.project, com.docker.compose.service, State, Status. Missing compose labels are null. Only known Nexora project names/patterns and existing service vocabulary escape; other values become other. Docker-derived lifecycle states and human status grammar are allowlisted/bounded; unknowns become other. Never retain IDs, full names, image/port/network/mount/env or arbitrary labels. Raw output stays private in memory. Command/parse failure emits status UNAVAILABLE; diagnostic failure cannot fail step8.

## 7. Security and concurrency

Keep contents:read, action pins, Node24.19.0 and existing45minute Foundation timeout. Fifteen independent ubuntu24.04 callees use suffix -e3-N for all seven artifacts, avoiding collisions. New read-only command has its own bounded buffer/deadline, not changed test deadlines. No live provider authorization changes. Trigger labels are absent before pushes, removed after the batch; no replacement/rerun of trials. Raw logs, fixture/session data, credentials and network identities never enter committed evidence.

## 8. Compatibility and domain invariants

Main merge preserves main production source and current Phase1 harness. Separate closure commit records057 final-head hosted PASS and historical Foundation FAIL;058 stays byte-identical to merged main. Ordinary Foundation retains six artifact names and uploads HTTPS diagnostics only on failure; E3 always retains projected HTTPS diagnostics when present. Existing E1/E2 modes remain available and exclusive of full Foundation mode. No Domain aggregate, persistence or business behavior changes.

## 9. Verification-first

Tests precede new projection and foundation selector behavior. Verify exact four row keys,100cap, hostile/raw field omission, status grammar and command errors. Compare parsed Foundation against baseline after stripping only approved additions/suffixes. Run format/lint/docs/preflight/test:docs/test:preflight, focused tests and actionlint if installed; otherwise record actionlint NOT RUN. Self-review is not independent approval. Hosted ordinary Foundation is the canonical gate, followed by exactly15 full calls.

## 10. Execution plan

1. Merge main9d52e7f without rebase, resolve mechanical diagnostic/doc conflicts; close057 in a separate docs: close NEXORA-057 commit and fix only broken links.
2. Freeze v3 after Prettier3.6.2 and bind raw SHA in task/PR before pushing implementation. Record merged-main/closure provenance and owner exception.
3. Add tests, minimal collector/CLI, exact Foundation exception and full-mode caller; update testing and mark E2 invalid while retaining all historical data/startup observation.
4. Execute local checks and structural/command/privacy review. Push with no experiment labels; await ordinary Foundation. PASS requires unchanged six names and no HTTPS artifact; step8 FAIL requires HTTPS artifact and is retained without rerun; other-step failure stops.
5. Arm https-stress-full, collect all15 calls, remove label. Download projected artifacts, verify source/checkout/IDs/digests, copy fixed diagnostic lines verbatim and summarize preexisting project/service/state for both PASS and failure.
6. Write compact e3-dated Markdown, task summary and README references. No extra batch if no step8 failures. Commit/push evidence then stop, marking new-head hosted status honestly.

## 11. Documentation Impact

Documentation Impact: REQUIRED. docs/operations/testing.md owns Foundation diagnostics artifact content/name/retention and E3 activation. Task059 records review delta/execution; evidence README marks E2 invalid. Per-trial compact evidence retains exact HEAD/merge/run/attempt/job/UTC/results, fixed diagnostic lines and safe four-field summaries. Detailed logs/archives/images remain outside Git. Snapshotv1/v2 and all FAIL history stay unchanged.

## 12. Interpretation and stop rules

Capture actor observations, do not repair cause. Compare ADDR/ROUTE coarse groups and Docker Type/Action/service within failed interval±5s, accounting for unavailable/dropped data. Preexisting nexora-ci presence is an observation, never assumed from a global env value. If all15 avoid step8 failure, report not reproduced and stop.

A permits new script/test/workflow mistakes, typo/format/lint/docs/preflight issues caused by the task and missing environment prerequisites, with evidence. B stops for any Foundation change outside the explicit exception, fixture/namespace/retry/timeout/assertion change, unexplained original-test failure, ordinary new-head Foundation failure outside8 or unexplained Preflight failure. E3 other-step failures are recorded without investigation; no rerun or substitution. Owner review is required before any Phase2 change. No merge.
