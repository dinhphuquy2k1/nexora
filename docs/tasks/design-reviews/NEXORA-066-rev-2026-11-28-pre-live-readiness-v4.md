# NEXORA-066 — Mandatory no-backup policy and reduced readiness v4

## 1. Task metadata

Task ID: NEXORA-066
Classification: SIGNIFICANT
Documentation Impact: REQUIRED
Plan revision: rev-2026-11-28-pre-live-readiness-v4
Reviewed baseline: 0f39dc821143a5c2ffdd33dc5a01ba75962ceaa4
Branch: chore/uniship-pre-live-readiness; PR66, base a4ccfaf.

## 2. Owner decision and scope

Owner2026-11-28 prohibits backup/restore by default across all environments/assets.
Only an explicit owner request permits the exact named assets/operations. Missing
backups cannot block work, verification, merge, deployment or production acceptance.
No backup automation, substitute export/clone/snapshot, DR drill, task or follow-up.
Remove existing active requirements and shrink066 to Uniship runtime readiness.
No operational action, application/schema/grant/Compose/harness/workflow change.

## 3. Canonical owners

PROJECT_RULES owns the policy; AGENTS routes future agents there. Operations
deployment/setup/configuration/testing, runtime architecture, relevant ADRs,
active046/066 and canonical058 activation runbook must agree. README links policy.

## 4. Inspection and search scope

Search backup/back up/disaster recovery/volume snapshot/database restore across
AGENTS, README and docs. Separate active requirements from completed task evidence,
immutable design records, existing test descriptions and unrelated business recovery.
Inspect ADR006, ADR007 and reference-architecture policy plus operations documents.

## 5. Reuse audit

| Field                    | Governance and readiness                                                                                                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component                | Canonical policy and reduced owner checklist                                                                                                                                                                                                                                                     |
| Existing implementations | docs/ai/PROJECT_RULES.md; AGENTS.md; docs/operations/deployment.md; docs/operations/setup.md; docs/operations/configuration.md; docs/operations/testing.md; docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md; docs/tasks/active/NEXORA-066-uniship-external-controlled-acceptance.md |
| Domain owner             | Project governance and operations documentation                                                                                                                                                                                                                                                  |
| Reuse alternatives       | Per-task exception, substitute backup mechanisms, global explicit-owner policy                                                                                                                                                                                                                   |
| Selected approach        | One canonical mandatory policy, dated ADR amendments, remove active gates and backup checklist; retain concise existing runtime safety sequence                                                                                                                                                  |
| Rationale                | Owner scope is authoritative; no duplicate runbook/framework or implied authorization                                                                                                                                                                                                            |
| Risks                    | Stale requirements, history rewritten, security custody confused with copying keys, business recovery misclassified                                                                                                                                                                              |
| Verification             | Global focused text audit; unchanged historical evidence/snapshot bytes; docs-only diff; pinned docs gates; independent read-only review; final-head hosted CI                                                                                                                                   |

## 6. Alternatives and trade-offs

Reject a temporary066 exception: applies to the project lifetime. Reject deferred
backup tasks, exports/clones or renaming backup as custody. Reject modifying fixture
tests: owner expressly retains existing tests. No new backup work is authorized.

## 7. Selected design and DDD

Documentation only; no aggregate/use-case change. Retain named volumes, database
persistence, forward migrations, original credentials/key material, runtime-role
isolation and all application security. Preserve Shipment hide/restore, token/Worker
recovery and MFA recovery-code contracts. Design snapshots are governance records,
not operational backup copies; old snapshots remain immutable and superseded.

## 8. Security and operational boundaries

No backup, restore, export, snapshot or data clone performed to verify this policy.
No real-account identifiers/secrets committed. Existing custody means preserving
current material and restricted access, not permission to create backup copies.
No live gate, external Uniship request, threshold/AUTO or owner-runtime operation.

## 9. Compatibility and history

Date the owner policy supersession of older mandatory gates/ADR language. Preserve
historical PASS/FAIL rows and existing CI fixes/regressions. Keep known Foundation
step10 failure on0f39dc8 historical; do not claim this policy fixes its unknown cause.

## 10. Verification plan

Run diff check, pinned format/docs/preflight and test:docs/test:preflight. Audit
active occurrences and classify historical/test/business-recovery occurrences.
Verify existing snapshots/evidence unchanged, independent review, commit/push then
inspect exact-source Preflight/Foundation. No retry/harness edit to force success.

## 11. Materiality and metadata

This is a material owner-policy and scope revision: record v4 before editing,
Prettier then raw SHA256, bind task and five PR metadata lines. Preserve v1/v2/v3.
Final hosted receipts remain in PR description without a commit/CI loop.

## 12. Open gates and stop conditions

Target selection, exposure handling, actual upgrade/MFA, external authorization,
empty-policy Stage1 fix and separate live activation decision remain. Backup absence
is never a gate. No new backup acceptance/follow-up. Stop on unrelated technical
failure per workflow; report uncertainty rather than broaden scope or alter tests.
