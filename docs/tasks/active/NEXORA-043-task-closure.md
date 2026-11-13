# NEXORA-043 — Merged task closure

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-043
Classification: BOUNDED
Plan revision: rev-2026-11-12-task-closure-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-043-rev-2026-11-12-task-closure-v1.md
Design SHA-256: d8cc16a3e0d1cc18d207cd0cbf0d0a8a00771218705833c618dd75e837ad8163
Reviewed baseline: 010b6ec944f224f829eb0e663c70eca46e186379
Branch: docs/task-closure

Documentation-only execution of the owner's fixed triage; no reclassification,
old-task verification reruns, production changes or immutable snapshot edits.

| Field                    | Decision                                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Post-merge task closure policy and task records                                                                                                                                                                        |
| Existing implementations | docs/ai/TASK_WORKFLOW.md sections 1.1–1.6 and evidence schema; docs/tasks/completed/NEXORA-021-superseded-lazy-recovery.md closure precedent; docs/tasks/active/NEXORA-041-shared-pager-filter-shell.md task structure |
| Domain owner             | Contributor governance and canonical documentation owners below                                                                                                                                                        |
| Reuse alternatives       | Reuse task/evidence formats and git mv; no new tooling or lifecycle; decouple three preflight tests from the live NEXORA-027 task by reusing the existing integrityFixture temp-root pattern                           |
| Selected approach        | Add section 1.7, close the owner's 24 tasks, create four planning stubs, update named links; decouple three preflight tests from the live NEXORA-027 task by reusing the existing integrityFixture temp-root pattern   |
| Rationale                | Preserve immutable plans, historical failures and owner-decided deferrals while making closure explicit                                                                                                                |
| Risks                    | Broken links or accidental historical edits; unexpected file/SHA/check errors require stopping and reporting; tests coupled to live task files                                                                         |
| Verification             | Confirm available IDs and merge ancestry; format:check, docs:check, preflight:check, test:docs, test:preflight; fresh hosted Preflight and Foundation on PR HEAD                                                       |

## Plan

1. Record the fixed triage and new closure workflow.
2. Create follow-ups NEXORA-044–047 without starting their implementation.
3. Update only task status/verification, requested implementation metadata and appended closure evidence; git mv 24 records to completed.
4. Update named canonical links and Customer M2 statement; preserve checkboxes, historical Evidence/FAIL rows and snapshots.
5. Execute requested documentation checks, review the diff, publish a documentation-only PR and wait for hosted gates. Do not merge.
6. Move three preflight binding tests (#9, #10, #24) to a temporary fixture root copied from the closed NEXORA-027 record; assertions unchanged.

NEXORA-043 is closed under §1.7 together with the next task closure after PR #42 merges.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Add post-merge task closure procedure (TASK_WORKFLOW section 1.7), close 24 merged
tasks and create four follow-up planning tasks.
Preflight binding tests no longer depend on a live active task record.

### Canonical owners

- docs/ai/TASK_WORKFLOW.md
- docs/ai/IMPLEMENTATION_WORKFLOW.md
- docs/architecture/frontend.md
- docs/architecture/design-system.md
- docs/architecture/database.md
- docs/domains/customers.md
- docs/operations/testing.md
- docs/tasks/evidence/NEXORA-032/README.md

### Documentation verification

npx --yes pnpm@10.34.6 format:check, docs:check, preflight:check, test:docs,
test:preflight; fresh hosted Preflight and Foundation.

## Task triage

| Task       | PR            | Merge                     | Decision                             | Follow-up        |
| ---------- | ------------- | ------------------------- | ------------------------------------ | ---------------- |
| NEXORA-003 | #2            | 837248e (2026-10-10)      | CLOSE                                | –                |
| NEXORA-006 | #5            | 7cfb01a (2026-10-11)      | CLOSE                                | –                |
| NEXORA-007 | #5            | 7cfb01a (2026-10-11)      | CLOSE                                | –                |
| NEXORA-008 | #5            | 7cfb01a (2026-10-11)      | CLOSE                                | –                |
| NEXORA-009 | #7            | ad01e74 (2026-10-12)      | CLOSE                                | –                |
| NEXORA-012 | #10           | b1ec046 (2026-10-13)      | CLOSE                                | –                |
| NEXORA-013 | #13           | e18bef4 (2026-10-13)      | CLOSE                                | –                |
| NEXORA-015 | #15           | cc43981 (2026-10-15)      | CLOSE                                | –                |
| NEXORA-024 | #20           | ea0fce6 (2026-10-17)      | CLOSE + follow-up                    | NEXORA-046       |
| NEXORA-027 | #23           | 99a2886 (2026-10-22)      | CLOSE                                | –                |
| NEXORA-028 | #24           | c14dada (2026-10-22)      | CLOSE                                | –                |
| NEXORA-029 | #25           | b9d02f0 (2026-10-23)      | CLOSE (superseded by NEXORA-031/033) | –                |
| NEXORA-030 | #26           | ee83912 (2026-10-23)      | CLOSE                                | –                |
| NEXORA-031 | #27, #28, #29 | 55e3c15, 837e823, 845c7e6 | CLOSE + follow-up                    | NEXORA-047       |
| NEXORA-032 | #30           | 1a4fe7b (2026-11-01)      | CLOSE                                | –                |
| NEXORA-033 | #31           | 156a324 (2026-11-02)      | CLOSE + follow-up                    | NEXORA-047       |
| NEXORA-034 | #32           | 6a52c2f (2026-11-08)      | CLOSE                                | GitHub issue #33 |
| NEXORA-035 | #35           | 8a427da (2026-11-09)      | CLOSE                                | –                |
| NEXORA-036 | #36           | 606e101 (2026-11-09)      | CLOSE                                | –                |
| NEXORA-037 | #37           | dccbfee (2026-11-10)      | CLOSE                                | –                |
| NEXORA-038 | #38           | aea1c1a (2026-11-11)      | CLOSE                                | –                |
| NEXORA-040 | #40           | a3fd104 (2026-11-11)      | CLOSE                                | –                |
| NEXORA-041 | #41           | 3906f82 (2026-11-12)      | CLOSE + follow-up                    | NEXORA-045       |
| NEXORA-042 | #34           | 010b6ec (2026-11-12)      | CLOSE + follow-up                    | NEXORA-044       |

## Evidence

| Claim                                                                                                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Date       | Result |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and task inventory                                                                                                          | Branch docs/task-closure from origin/main 010b6ec944f224f829eb0e663c70eca46e186379; gh pr list --state open and docs/tasks inventory show IDs 043–047 unused; git rev-parse and merge-base --is-ancestor confirm all supplied merges on main, matching PR/date                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-11-12 | PASS   |
| Formatting                                                                                                                           | npx --yes pnpm@10.34.6 format:check; working tree on 4d219f9 (4d219f93a1cd3d5b48366394c1d6778cc848edab), 2026-11-13 UTC; exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2026-11-13 | PASS   |
| Documentation validation                                                                                                             | npx --yes pnpm@10.34.6 docs:check; working tree on 4d219f9 (4d219f93a1cd3d5b48366394c1d6778cc848edab), 2026-11-13 UTC; exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2026-11-13 | PASS   |
| Structural governance                                                                                                                | npx --yes pnpm@10.34.6 preflight:check; working tree on 4d219f9 (4d219f93a1cd3d5b48366394c1d6778cc848edab), 2026-11-13 UTC; exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 2026-11-13 | PASS   |
| Documentation regressions (10/10)                                                                                                    | npx --yes pnpm@10.34.6 test:docs; working tree on 4d219f9 (4d219f93a1cd3d5b48366394c1d6778cc848edab), 2026-11-13 UTC; exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-11-13 | PASS   |
| Preflight regressions (24/24)                                                                                                        | npx --yes pnpm@10.34.6 test:preflight; working tree on 4d219f9 (4d219f93a1cd3d5b48366394c1d6778cc848edab), 2026-11-13 UTC; exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 2026-11-13 | PASS   |
| test:preflight before decoupling: 21 PASS / 3 FAIL (#9, #10, #24)                                                                    | npx --yes pnpm@10.34.6 test:preflight; working tree on 4d219f9; previous executed checkpoint, exit 1; missing active NEXORA-027 record                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 2026-11-13 | FAIL   |
| test:preflight with docs-only fixture: 22 PASS / 2 FAIL (#10, #24 missing repo scan roots)                                           | node --test scripts/preflight-policy-check.test.mjs; working tree on 4d219f9; previous executed checkpoint, exit 1; missing apps/api/src, backend.instructions.md and .github/skills in temporary root                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 2026-11-13 | FAIL   |
| Repository-fixture GREEN and preservation                                                                                            | node --test scripts/preflight-policy-check.test.mjs: 24/24 PASS, exit 0; git status and test diff confirm only seven scoped files (plus pre-existing node_modules symlink), no production/assertion/expected-value/PR-body changes; liveRepoFixture owns real governed directories and copied task/snapshot, excludes .git                                                                                                                                                                                                                                                                                                                                                          | 2026-11-13 | PASS   |
| Cross-platform fixture links: directories use junction on Windows and symlink elsewhere; files copied                                | node --test scripts/preflight-policy-check.test.mjs: 24/24 PASS, exit 0 on Linux; working tree on HEAD 9137bd664feea391b4f45d272559431fd5bf02dc; git status confirms only scoped test changes and pre-existing node_modules symlink, node_modules content retained                                                                                                                                                                                                                                                                                                                                                                                                                  | 2026-11-13 | PASS   |
| Foundation 43343649011 attempt 1 on 240a01c: step 8 CANONICAL_HTTPS_REMOTE_OPERATOR_SETUP CHECK_FAILED; steps 4–7 PASS, 9–10 SKIPPED | [Nexora foundation attempt 1](https://github.com/dinhphuquy2k1/nexora/actions/runs/43343649011/attempts/1), job 131617671216; HEAD 240a01cd7da488668edddf67f451033daf10fbeb, checkout merge 6d0fa18a25c1ff439b78176933c7db02b8371443 into main 010b6ec944f224f829eb0e663c70eca46e186379; completed 2026-11-13T01:29:06Z; expected HTTP 201, actual HTTP 201, Category CHECK_FAILED; diagnostics and owned cleanup PASS                                                                                                                                                                                                                                                              | 2026-11-13 | FAIL   |
| Foundation 43343649011 attempt 2 (bounded same-head rerun, no code change)                                                           | [Nexora foundation attempt 2](https://github.com/dinhphuquy2k1/nexora/actions/runs/43343649011/attempts/2), job 131624041857; gh run rerun 43343649011 --failed executed exactly once by owner directive; unchanged HEAD 240a01cd7da488668edddf67f451033daf10fbeb, checkout merge 6d0fa18a25c1ff439b78176933c7db02b8371443 into main 010b6ec944f224f829eb0e663c70eca46e186379; completed 2026-11-13T01:51:47Z; steps 4 Docker quality/integration, 5 M5, 6 stop development, 7 runtime/TTY/browser, 8 HTTPS/ingress/onboarding/restore, 9 DB/storage persistence, 10 development HMR/drift all PASS; artifact preservation and owned cleanup PASS, failure-only Diagnostics SKIPPED | 2026-11-13 | PASS   |

Windows execution NOT RUN: no Windows machine is available in this session; no Windows runtime success is claimed.

The bounded rerun records a later same-head PASS without explaining or erasing the
earlier FAIL. No code, smoke assertion or timeout changed. This evidence-only
publication requires fresh hosted Preflight and Foundation on its new HEAD; the
final green SHA and run IDs are recorded in PR #42 after they execute, without
an additional task-file commit. Status remains VERIFICATION PENDING and
Verification remains PARTIALLY VERIFIED.
