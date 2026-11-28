# NEXORA-066 — Pre-live readiness operational safety v3

## 1. Task metadata and classification

Task ID: NEXORA-066
Classification: SIGNIFICANT
Documentation Impact: REQUIRED
Plan revision: rev-2026-11-28-pre-live-readiness-v3
Reviewed baseline: bce6ad00fc211add5ace2207134c0fc34ec76571
Base: a4ccfaf4cd54fd2a848e263e2c9551cad0c893fe
Branch: chore/uniship-pre-live-readiness; existing PR66.

## 2. Requirements and scope

Replace the unsafe Owner Execution Checklist in the active task. Document Windows
native-command fail-closed handling, private unique backup custody, an independent
owned Compose restore cluster, R1 fidelity before migration and R2 upgraded restore,
then matching Standard Runtime upgrade and actual-process/read-only acceptance.
Do not execute the checklist on owner data. No application, harness, workflow,
Compose, schema, migration, grant, dependency or live-gate changes.

## 3. Canonical owners

Reuse docs/operations/deployment.md, configuration.md, setup.md, testing.md,
docs/architecture/runtime.md and database.md; activation stages remain in
docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md.
ADR007 and ADR009 govern scope, custody and snapshot integrity.

## 4. Inspection and existing code

Read compose.yml/compose.dev.yml, scripts/init-local.sh, migration-entrypoint.sh,
api-entrypoint.sh, sync-worker-entrypoint.sh, public-https-smoke.sh,
public-persistence-fixture.cjs, database-runtime-smoke.mjs,
packages/database/scripts/provision-runtime.mjs and prisma/schema.prisma.
Inspect EnvironmentKeyring and actual MFA/public startup contracts.
The HTTPS fixture restores a second database inside its disposable test cluster;
reuse its comparison/archive techniques, never that topology on a source cluster.

## 5. Reuse audit

| Field                    | Backup and restore                                                                                                                    | Runtime acceptance                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Owner checklist only                                                                                                                  | Owner checklist only                                                                                                                                                                                 |
| Existing implementations | compose.yml; scripts/init-local.sh; scripts/public-https-smoke.sh; scripts/public-persistence-fixture.cjs                             | packages/database/scripts/provision-runtime.mjs; scripts/database-runtime-smoke.mjs; scripts/api-entrypoint.sh; scripts/sync-worker-entrypoint.sh; apps/api/src/common/crypto/environment-keyring.ts |
| Domain owner             | Operations; database custody                                                                                                          | Operations; Identity/Carrier own unchanged policies                                                                                                                                                  |
| Reuse alternatives       | Same source cluster, new framework, independent existing Compose                                                                      | Development watch probe, generic framework, fixed Standard Runtime inspection                                                                                                                        |
| Selected approach        | Unique independent project; verified labels/mounts; retained credentials before init; pg_restore --exit-on-error --no-owner --no-acl  | Read-only SQL and actual compiled Node PID checks; existing runtime roles/provisioner; owner MFA UI                                                                                                  |
| Rationale                | Separate cluster roles/resources; trusted owner owns restored objects; provisioner reapplies canonical ACL                            | Verify actual process without production changes or destructive target tests                                                                                                                         |
| Risks                    | Wrong project, shared volume, plaintext archives, omitted keys, restore errors, PowerShell native failures                            | Stale image, incomplete ACL comparison, hash mistaken for decrypt proof, host acceptance inferred from CI                                                                                            |
| Verification             | Documentation gates; synthetic/syntax checks only if available; independent read-only review; Windows execution explicitly unverified | Exact candidate hosted gates; private operator boolean receipts; no live requests                                                                                                                    |

## 6. Alternatives and trade-offs

Reject restore into a second source-cluster database: it shares roles/resources.
Reject pg_dumpall roles/bootstrap SQL: canonical role provisioning already exists.
Skip dumped ownership/ACL intentionally; restore as trusted nexora owner and run
forward migrations then canonical provisioner. Reject new backup scripts/modules.
Use a local documentation-only native-command wrapper, not a permanent framework.

## 7. Selected design and DDD

No business command or aggregate change. Source writers are stopped only by owner
with maintenance authorization. Unique protected encrypted backup and independent
key custody precede upgrade. R1 compares fresh private row/sequence/schema inventory
and uploads; R2 compares preserved business state, migrations and canonical ACL.
Init runs only after restoring all three retained credential files. Restore cleanup
requires current-session ownership, actual labels and no source/external mounts.

## 8. Security and concurrency

Never print raw ENV, keys, passwords, ciphertext, hashes or private row inventory.
Capture native output privately/in memory, check every exit code, fail on mismatch.
No source target mutation by agent. No automatic key rotation, re-enrollment,
provider request, authorization broadening, retry or timeout increase.

## 9. Compatibility

Keep 19-migration historical observations distinct from current revision's 21
migration directories. Re-inventory actual target; counts are not invariants.
Migration21 excludes older combined-loader binaries. LOCAL permits unenrolled
ADMINs to remain; PUBLIC_HTTPS gates remain unchanged. Existing v1/v2 snapshots
and historical evidence remain immutable.

## 10. Verification plan

Run git diff --check, pinned format:check, docs:check, preflight:check,
test:docs and test:preflight. Verify snapshot digests and docs-only diff against
bce6ad0. Review Windows blocks statically; if PowerShell/appropriate synthetic
Docker images unavailable, record NOT RUN, never operational PASS. Independent
read-only review before delivery; push and inspect exact candidate required CI.

## 11. Governance and materiality

Operational data-safety changes are material: new v3 snapshot, Prettier then raw
SHA256; task and five PR metadata lines bind v3. v2 CI is historical exact-source
verification, never final-v3 proof. Final CI receipt belongs in PR description,
without a commit/CI receipt loop. No new design approval gate.

## 12. PLAN ISSUES and stop conditions

Stage1 empty-policy outbound authorization remains a separate gate-opening blocker.
Unconfirmed target, historical password rotation, external review, protected backup,
actual upgrade/MFA and separate activation decision remain operational blockers.
No live gate or MANUAL_ONLY config applied. Ambiguous ownership, custody, grants,
restore comparison or native failure stops the operator procedure. Missing tooling
is an execution limitation, not a reason to operate on source data.
