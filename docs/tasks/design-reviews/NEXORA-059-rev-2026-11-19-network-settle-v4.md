# NEXORA-059 — network settle intervention

Task ID: NEXORA-059
Classification: SIGNIFICANT
Plan revision: rev-2026-11-19-network-settle-v4
Reviewed baseline: 619175e87071667b007dd7c5560e8641a33c48f6

## Context and question

Owner authorizes Phase2 as an intervention experiment despite missing historical PASS controls. Early failed-sample veth events occur1.208–1.983s after initial ingress start. This is correlation, not verified IPv6 DAD or exact interface ownership. Historical CHECK_FAILED trial3 may differ.

## Scope and contracts

Reuse existing whole-step observer, poll its private atomic snapshot for a5s ADDR/ROUTE quiet period, deadline30s. UNAVAILABLE falls back to a recorded5s wait. Add cumulative closed-group counters to existing observer so rolling eviction cannot hide gate activity. settle.json records ingress event time, gate start/end/wait/group counts/status. Timeout emits PUBLIC_HTTPS_NETWORK_SETTLE_TIMEOUT and fails before browser, never retries requests.

## Reuse audit

| Field                    | Decision                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Settle gate and first10s browser controls                                                                                                                                                               |
| Existing implementations | scripts/public-https-diagnostics.mjs network/Docker observer; scripts/public-https-environment.mjs atomic private snapshots; public-https-browser.mjs CDP event handler; smoke cleanup artifact copying |
| Domain owner             | Operations harness; no business aggregate or domain change                                                                                                                                              |
| Reuse alternatives       | Existing observer snapshot versus new observer: reuse snapshot; raw logs rejected                                                                                                                       |
| Selected approach        | Pure injected-clock gate plus CLI; optional projected-event callback for bounded browser window                                                                                                         |
| Rationale                | No duplicate ip process for gate; counter differences survive rolling-buffer eviction; bounded typed projections protect secrets                                                                        |
| Risks                    | Snapshot staleness/unavailable, event storms, partial10s capture, capped requests, mistaken causal claims                                                                                               |
| Verification             | Fake-clock RED/GREEN, privacy/caps/schema tests, existing observer suites, requested local gates, ordinary Foundation and15E3 jobs                                                                      |

## Browser control interface

browser-start-window.json records launch/capture timestamps, projected ADDR/ROUTE group/time up to64 and first200 CDP requests: closed resource type, start/end, ok/closed Chrome error or pending. No URLs, headers, body, cookies, tokens, raw interface/container identities. Dropped counts and incomplete capture explicit. Use existing browser network observer with optional callback; no new observer. Persist on PASS and FAIL in existing diagnostics directory; existing Foundation upload paths unchanged.

## Placement

Only smoke's initial up ingress immediately precedes Chromium browser. Later stop/up/restart operations precede Node HTTPS continuity probes (public-https-restart.mjs), not Chromium; do not add gates there. No production Compose/healthcheck/sysctl change.

## Invariants and exclusions

No request retry, auth mutation retry, existing timeout/assertion change, browser namespace change, fixture reordering, Foundation workflow change or product/API/SDK/DB behavior change. The sole new readiness gate is owner-authorized. Existing v1/v2/v3 snapshots immutable; use next available v4 rather than overwrite v2.

## Failure behavior

Quiet deadline fails with fixed diagnostic and bounded counts. Observer unavailable fallback is explicit, not hidden success evidence. Diagnostic collection cannot mask original browser failure. Preserve existing owned-process cleanup. Missing/partial data cannot satisfy causal verification.

## Documentation Impact

Documentation Impact: REQUIRED. Owners: docs/operations/testing.md, active task059, experiment evidence. Update five PR metadata fields to v4 binding before source push.

## Verification plan

Fake observer/clock tests for quiet/reset/deadline/unavailable; window limits/privacy/results/time boundaries. format:check, lint, docs:check, preflight:check, test:docs, test:preflight and focused Node suites. Ordinary new-head Foundation first: fail8 retained without rerun, fail elsewhere STOP B. Then exact15full Foundation calls, remove label, download all projected artifacts and hashes.

## Decision criteria

Owner criterion:0/15step8failures and no ADDR/ROUTE in postgate browser windows supports intervention confirmation and proposal to close issue44; record coverage/UNAVAILABLE/drops limitations. Any step8failure: classify postgate events/Chrome errors/CHECK_FAILED, no additional run. Any other-step result recorded separately. Historical trial3 is a possible second mechanism. Do not close issue44 or merge automatically.

## Evidence and handoff

Per-job source/checkout/run/attempt/artifact/wait/group counts/10s events/NETWORK_CHANGED counts. Record ordinary run separately. Final evidence commit/push STOP; Final green HEAD only if final-head hosted gates actually green. No inherited green claim.

## Review

Pre-code read-only inspection and reuse review complete at619175e; implementation self-review required after tests, no independent approval claim. No migration, rollback or domain modeling needed for disposable harness; revert intervention source to restore earlier behavior while preserving evidence.
