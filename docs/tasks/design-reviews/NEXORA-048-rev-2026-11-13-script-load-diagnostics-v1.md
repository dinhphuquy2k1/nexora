# NEXORA-048 — Public HTTPS script load diagnostics

## 1. Task metadata and classification

Task ID: NEXORA-048
Classification: BOUNDED
Plan revision: rev-2026-11-13-script-load-diagnostics-v1
Reviewed baseline: a66f548968819cd8b700d82956bdc658ab95d313
Branch: fix/https-script-load-diagnostics

## 2. Reuse & design audit

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

## 3. Plan

1. Close merged tasks and align the post-merge closure rule in the first commit (Part A).
2. Record and format the snapshot before hashing its raw bytes.
3. Add the exact-shape and closed-reason tests; execute RED before implementation.
4. Implement bounded reason counters and canceled count in the existing diagnostics only.
5. Synchronize testing documentation.
6. Run targeted, operations, formatting, lint, docs, preflight, complete script tests and actual task/snapshot binding; inspect active inventory and bounded diff.
7. Publish the PR and wait for final-head hosted gates. No rerun; a step8 script-loading failure is recorded as the owner-directed exception, then stop for the owner.
8. Update GitHub issue #44 with the PR, new fields and any actual failure diagnostic.
9. NEXORA-048 is closed by the next task's PR.
