# NEXORA-048 — Public HTTPS script load diagnostics

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Origin

[GitHub issue #44](https://github.com/dinhphuquy2k1/nexora/issues/44) and
[NEXORA-044 closure](../completed/NEXORA-044-provider-length-single-source.md#closure--2026-11-13).

## Scope

First commit closes NEXORA-043/044 and aligns TASK_WORKFLOW section1.7 with active-task PR binding. Then add only closed-vocabulary Script loadingFailed reasons and a separate canceled count to the existing pre-auth diagnostic snapshot. No nginx, Compose, Web, browser harness, authentication assertions, readiness or timeout changes. No inference of the asset-loading cause from aggregate counts alone. No merge.

## Design Review & Reuse Decision

Task ID: NEXORA-048
Classification: BOUNDED
Plan revision: rev-2026-11-13-script-load-diagnostics-v1
Reviewed baseline: a66f548968819cd8b700d82956bdc658ab95d313
Branch: fix/https-script-load-diagnostics
Design Snapshot: docs/tasks/design-reviews/NEXORA-048-rev-2026-11-13-script-load-diagnostics-v1.md
Design SHA-256: c97050ed7c3c39c4220639b4365c0a966126b07ebcd50ae37775993569f91201

| Field                    | Decision                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component                | Public HTTPS pre-auth script load failure classification; post-merge closure rule                                                                                                                                                                |
| Existing implementations | scripts/login-readiness-diagnostics.mjs counts Script loadingFailed and certificate errorText only; public-https-browser.mjs prints the full snapshot on readiness failure; TASK_WORKFLOW §1.7 closure text conflicts with validatePrTaskBinding |
| Domain owner             | operations test harness (docs/operations/testing.md); engineering workflow (docs/ai/TASK_WORKFLOW.md)                                                                                                                                            |
| Reuse alternatives       | change nginx/Next config without data; raise nginx error_log level; log raw errorText/URLs; classify Chromium net error codes into a closed vocabulary inside the existing diagnostics                                                           |
| Selected approach        | closed-vocabulary failure reasons plus canceled count in the existing snapshot; no harness, ingress or Web change; closure rule aligned with Preflight                                                                                           |
| Rationale                | two script failures without HTTP or certificate errors cannot be attributed without the failure reason; Chromium net error codes are a fixed vocabulary and carry no user data                                                                   |
| Risks                    | reasons outside the list collapse into OTHER; benign aborts may be mistaken for ingress faults (mitigated by separate ABORTED and canceled counts); snapshot shape change updates one exact-shape test                                           |
| Verification             | diagnostics unit tests RED/GREEN; test:operations; full script tests; hosted Preflight and Foundation                                                                                                                                            |

## Plan

1. Close merged tasks and align the post-merge closure rule in the first commit (Part A).
2. Record and format the snapshot before hashing its raw bytes.
3. Add the exact-shape and closed-reason tests; execute RED before implementation.
4. Implement bounded reason counters and canceled count in the existing diagnostics only.
5. Synchronize testing documentation.
6. Run targeted, operations, formatting, lint, docs, preflight, complete script tests and actual task/snapshot binding; inspect active inventory and bounded diff.
7. Publish the PR and wait for final-head hosted gates. No rerun; a step8 script-loading failure is recorded as the owner-directed exception, then stop for the owner.
8. Update GitHub issue #44 with the PR, new fields and any actual failure diagnostic.
9. NEXORA-048 is closed by the next task's PR.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Section1.7 closure timing; NEXORA-043/044 closed; readiness diagnostics report closed-vocabulary script failure reasons and canceled count.

### Canonical owners

- docs/ai/TASK_WORKFLOW.md
- docs/operations/testing.md
- docs/tasks/completed/NEXORA-042-sync-extension-architecture.md

### Documentation verification

pnpm docs:check, preflight:check, format:check.

## Evidence

| Claim                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                             | Date       | Result |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Baseline and reserved task ID         | origin/main a66f548968819cd8b700d82956bdc658ab95d313; docs/tasks inventory and gh pr list --state open confirm NEXORA-048 unused; fresh fix/https-script-load-diagnostics branch                                                                                                                                                                                                     | 2026-11-13 | PASS   |
| Closure link checkpoint before repair | pnpm10.34.6 docs:check after git mv: expected A5 unresolved ../active/NEXORA-044-provider-length-single-source.md from completed042; exit1                                                                                                                                                                                                                                           | 2026-11-13 | FAIL   |
| Closure documentation GREEN           | Same docs:check after the A5 relative-link repair exits0; all seven section1.7 numbered steps and historical task Evidence/FAIL rows preserved                                                                                                                                                                                                                                       | 2026-11-13 | PASS   |
| First closure commit                  | 7e4e78cd0baa4623249432857a26fa45dbfdc561 closes043/044, appends042 resolution, and changes only section1.7 introduction; IMPLEMENTATION_WORKFLOW link unchanged. PR42 merge f32101e6bda74e1e13dc195fbbad3823974dcdde and PR43 merge a66f548968819cd8b700d82956bdc658ab95d313 both dated2026-11-13; PR43 description confirms final green86e0238, so044 VERIFIED (no merge exception) | 2026-11-13 | PASS   |
| Test-first diagnostics RED            | node --test scripts/login-readiness-diagnostics.test.mjs on fc00942 working tree with requested new shape/test: 2 PASS / 2 FAIL, exit1; first test lacks scriptFailureReasons/scriptFailuresCanceled, new mapping test reads undefined ABORTED; unchanged historical assertions retained                                                                                             | 2026-11-13 | FAIL   |
