# NEXORA-043 — Merged task closure

## 1. Task metadata and classification

Task ID: NEXORA-043
Classification: BOUNDED
Plan revision: rev-2026-11-12-task-closure-v1
Reviewed baseline: 010b6ec944f224f829eb0e663c70eca46e186379
Branch: docs/task-closure

## 2. Reuse & design audit

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

## 3. Plan

1. Record the fixed triage and new closure workflow.
2. Create follow-ups NEXORA-044–047 without starting their implementation.
3. Update only task status/verification, requested implementation metadata and appended closure evidence; git mv 24 records to completed.
4. Update named canonical links and Customer M2 statement; preserve checkboxes, historical Evidence/FAIL rows and snapshots.
5. Execute requested documentation checks, review the diff, publish a documentation-only PR and wait for hosted gates. Do not merge.
6. Move three preflight binding tests (#9, #10, #24) to a temporary fixture root copied from the closed NEXORA-027 record; assertions unchanged.

## 4. Task triage

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
