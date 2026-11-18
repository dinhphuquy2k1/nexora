# NEXORA-059 — Public HTTPS network actor investigation

## 1. Task metadata and classification

Task ID: NEXORA-059
Classification: SIGNIFICANT
Plan revision: rev-2026-11-18-https-network-actor-v1
Reviewed baseline: a19aa0d2532b41135a90c6e48e3b6876471ad343
Branch: investigate/https-network-actor

## 2. Requirements and scope

Phase1 evidence only. Identify actor behind intermittent step8 browser transport failures across PR42/43/56 and combine issue44 script loading investigation. Chromium network-change cancellation is the working mechanism supplied by owner; host actor remains unknown and observations alone are not causal proof. No fixture reordering until Phase2 owner decision. PR56 is not merged; no closure commit is currently applicable.

## 3. Canonical owners and inspection

Read AGENTS, AI README routed context/rules/task/implementation/router; runtime/testing, reusable-components registry, ADR009, both repository review skills; scripts/public-https-smoke.sh/public-https-browser.mjs/public-https-diagnostics.mjs/login-readiness-diagnostics.mjs/smoke-checks.mjs and tests; compose.yml/public.yml; foundation.yml; completed NEXORA048; GitHub issue44. Search scope scripts/.github/workflows/docs/tasks, symbols startPublicNetworkObserver, Network.loadingFailed, createSmokeChecks, status, compose, spawn/terminate. Existing main has CDP LOGIN diagnostics but lacks PR56 operator/network helpers. Reuse only those harness changes, not Uniship.

## 4. Reuse and design audit

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

## 5. Alternatives

Do not log raw Docker JSON, IDs, arbitrary labels, network addresses, interface names, routes or secrets. Do not suppress netlink notifications, widen timeouts/assertions or automatically retry non-idempotent requests. Do not assume issue44 and all past failures share a cause. Isolated namespace synthetic address experiment did not reproduce the hosted error; do not present it as repair. Optional label-triggered PR workflow is chosen over requiring workflow to exist on main first.

## 6. Selected interfaces and DDD assessment

Technical harness only: no business aggregate, domain commands, database persistence or cross-domain port changes. Network events add interfaceGroup in lo/eth/docker0/bridge/veth/other. Docker events project Type, Action, service, atUTC only. Service labels are an explicit repository service allowlist or other. Failure summary includes failed request endpoint/timing and bounded events within its interval plus/minus5s; never URI/ID/header/body. If no tracked failed auth request, use latest failed same-origin Script time; otherwise failure timestamp fallback is explicit. Observer status, dropped counts and cleanup are retained separately.

## 7. Security and concurrency

Read-only ip monitor and docker events in host harness only, minimal necessary environment (Docker context variables preserved privately if required); no Docker socket mounted to apps. Own child processes and private temporary directory cleaned. No requests replayed; strict CA/name/SPKI/MFA/origin/cookie/assertion policy unchanged.15 independent hosted machines, unique fixture project per process; no shared-user volumes reset. Observer errors must not change assertion outcome.

## 8. Compatibility

API/OpenAPI/SDK/database/schema/migrations/provider behavior untouched. Production Compose and Nginx template unchanged. Public fixture command ordering unchanged. Diagnostic shape is additive except accurate NOT_OBSERVED status before response. Frozen older snapshots unchanged.

## 9. Verification-first and RED/GREEN

Tests precede behavior: all six interface groups across LINK/ADDR/ROUTE and malformed/deleted/peer formats; Docker allowlist/unsafe payloads/partialoversize lines/time windows/200cap/startup-exit/deadline/idempotent cleanup; script reason counters and secret redaction; stale201 then headerlessfailure must NOT_OBSERVED; per-request integration through tagged browser/Node requests. Focused tests, test:operations, test:lint, format:check, lint, docs:check, preflight:check, test:docs, test:preflight, full scripts and quality. Static assertion/deadline/fixture-order comparison. Snapshot binding valid. Local canonical unavailable is NOT RUN, hosted trials supply runtime evidence. Independent review after implementation.

## 10. Plan

1. Inspect main, PR56 merge state, issue44, NEXORA048 and all routed harness/runtime/governance files. PR56 is open: do not close NEXORA057. Reserve NEXORA059 after active/completed/snapshot/open-PR inventory.
2. Freeze this SIGNIFICANT snapshot after Prettier and raw SHA; record task binding before code. Start branch from origin/main, never from PR56; merge main normally if owner merges it later.
3. Port only diagnostic harness files from bfe89e8 as reuse; no provider code. Add failing tests for interface grouping, safe bounded Docker observations and failure-window projection, new Script reasons and request status reset.
4. Add read-only observer process before first fixture Compose operation through final cleanup, bounded to step/job time. Retain at most200 Docker events and200 network events as rolling projections; only service allowlist/other, closed Type/Action, UTC/group/category. Browser logs one environment summary around failed request interval plus/minus5s; later diagnostics cannot mask original failure. Stop both observers on signal/deadline/exit, private raw buffers never persist. Existing browser-local observer remains for request correlation.
5. Reset smoke status at each Node/browser HTTP request start, preserving all assertions. Add NETWORK_CHANGED/INTERNET_DISCONNECTED reason counts. Do not change until/readiness/MFA/Origin/TLS/assertions/fixture ordering or add mutation retries.
6. New optional workflow pull_request labeled/synchronize plus workflow_dispatch, label https-stress gate; fail-fast false,15 matrix jobs on independent ubuntu24.04 runners. Build prerequisite release images only, then execute unmodified step8 fixture sequence. Upload safe diagnostic summaries per trial,7day retention; never upload raw fixture/cookies/certificates/server logs. Not required checks. Draft PR, create/apply label, await15 trials, remove label.
7. Canonical testing documentation and task evidence: exact source/merge/time/run/job/attempt/result, failures and coverage limitations. Compare all fifteen outcomes and each failure interface group with Docker service/actions within5s. If no reproduction, report0/N and propose further load/trials rather than infer repair.
8. STOP after Phase1. Actor attribution only as strong as evidence permits; issue44 remains open unless a later approved Phase2 proves its cause and correction. No merge. Phase2 requires explicit owner review of Phase1 and a new recorded design delta before causal correction.

## 11. Documentation Impact

Documentation Impact: REQUIRED

Changed facts: coarse interface and Docker correlation diagnostics, per-request status semantics, new script reason codes, optional stress workflow and artifact retention. Canonical owner docs/operations/testing.md. Documentation verification format/docs/preflight/test:docs. No production runtime fact changes.

## 12. Plan issues and stop conditions

No unresolved design issue for Phase1. Phase2 is explicitly NOT AUTHORIZED before owner reviews collected evidence. Self-correct new test/fixture doubles/typos/environment/format issues with evidence; stop for unexpected existing-test regressions, design/contract/production changes, repeated CI failures beyond bounded policy. Stress15 trials are a preplanned independent experiment, not fifteen reruns of a failed job; no automatic trial reruns. Retain every failure. PR56 closure only if merged and applicable §1.7 evidence is available. Final Phase1 state remains VERIFICATION PENDING for full causal task.
