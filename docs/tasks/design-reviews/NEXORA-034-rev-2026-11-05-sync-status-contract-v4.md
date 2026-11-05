# NEXORA-034 — Sync status/database contract consistency

## 1. Metadata

Task ID: NEXORA-034
Classification: SIGNIFICANT
Documentation Impact: REQUIRED
Plan revision: rev-2026-11-05-sync-status-contract-v4
Baseline: 8d451e092e114c09cd50b3a5a9e3fceff82402c3.
Branch: feat/sync-worker-staging-v1. Existing open PR32; no merge authorization.
This scoped correction preserves all earlier immutable snapshots.

## 2. Scope

Bind canonical constants in ordinary runtime status SQL; preserve the static
ON CONFLICT partial-index inference predicate. Verify constants, generated Prisma
schema/default and real PostgreSQL CHECK/default/index/behavior together. No new
status, migration, ENUM, feature, dependency, transport or lifecycle policy.

## 3. Canonical owners

ADR-009 governs plan integrity; ADR-010 owns Sync execution. PROJECT_RULES owns
as-const vocabulary and raw SQL conventions; database/testing docs own migration
and verification policy. Sync Domain owns ACTIVE_SYNC_JOBS and processing codes;
shared sync-status owns existing cross-package Job statuses/types. No relocation
of backend active-lane policy into shared merely for test access.

## 4. Read-only inventory

Searched QUEUED/RUNNING/WAITING/SUCCEEDED/FAILED/CANCELLED/PENDING/PROCESSING/APPLIED/
REJECTED_SOURCE/RETRYABLE_ERROR/NEEDS_REVIEW in apps/api/src/{sync,carrier,identity}.
Ordinary literals remain in TransactionSyncDisablement and SyncRepository admit
fallback, issues, claim, page and cleanup. schedule already uses ACTIVE_SYNC_JOBS.
Only admit's ON CONFLICT predicate needs static literals for index inference.
Migration20261102000000_sync_v1 already matches the six Job codes and three active
codes. migration.mjs currently checks only /UNIQUE.\*WHERE/. Existing Sync integration
owns a migrated UUID database and compiled Domain imports, and already runs in
both targeted and Foundation CI. Database package has no application dependency.

## 5. Reuse audit

| Field                    | Runtime status SQL                                                                    | Database contract verification                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Component                | Disablement and SyncRepository                                                        | Existing migration/Sync PG suite                                                              |
| Existing implementations | sync/domain/sync.constants.ts, shared/src/sync-status.ts; two infrastructure adapters | packages/database/test/migration.mjs; apps/api/integration/sync-integration.test.cjs          |
| Domain owner             | Sync supporting capability                                                            | API-owned test of Domain/database boundary                                                    |
| Reuse alternatives       | Existing constants vs new vocabulary/helper                                           | Existing integration fixture vs database importing application or new test framework          |
| Selected approach        | Bind existing Job/processing constants; keep static inference SQL                     | API-local fixture module invoked by existing PG suite; structural migration index assertion   |
| Rationale                | Remove duplicated values without changing predicates                                  | Actual Domain constants accessible without reverse dependency; no workflow duplication        |
| Risks                    | Job/processing confusion; index inference; missed predicate                           | False green from loose regex, FK failures or unexecuted tests                                 |
| Verification             | Real disable/remove matrix and all prior regressions                                  | Catalog shape/exact sets plus actual INSERT/unique/default/prepare and negative DDL mutations |

## 6. Alternatives

Do not generate historical migrations or adopt ENUMs. Do not move active-lane
policy into shared, make database depend on API, or add a database test framework.
Use existing native pg dependency through the database package's module resolution
inside the API test fixture only, to inspect PostgreSQL SQLSTATE and exact constraint
names. Prisma remains the runtime/participant/repository authority.

## 7. Selected design

Existing ports/signatures/DDD boundaries remain unchanged; no new domain model.
Ordinary queries bind ACTIVE_SYNC_JOBS, Job status constants and processing status
constants with the same sets as baseline. A small local issues outcome array pairs
the existing count/page predicates. Retention still excludes NEEDS_REVIEW.
The static admit predicate is documented and locked by actual prepared SQL and
repository duplicate-admission tests. No external input enters raw SQL fragments.

## 8. Security/concurrency

Preserve ACTIVE user/epoch/connection/job order, authorization, lease invalidation,
ownership predicates, generation/lifecycle, transaction boundaries and timing.
Tests use only the suite-owned migrated database; synthetic actors/lanes and native
client are cleaned in finally. DDL fault injection runs in rollback transactions.
No user volumes, live Provider, secrets or production database are involved.

## 9. Compatibility

Zero API/OpenAPI/SDK/schema changes. Historical migration hashes must remain equal.
Prisma default is checked through genuinely generated DMMF plus database metadata
and actual default INSERT. CHECK/index predicates are read from pg_get_expr,
validated as the expected status-ANY-array shape and compared as exact value sets,
not original SQL formatting. Structural index keys/uniqueness/validity also checked.
No package graph/build prerequisite change is needed.

## 10. Verification plan

First add real PG tests before runtime edits: catalog/default/CHECK acceptance and
rejection; every active-status pair uniqueness with exact23505/index identity;
different SyncTypes; terminal history plus new active job; actual prepared INSERT
inference and repository return-existing behavior; disable/remove scoped metadata.
Real rollback DDL mutations add/remove a status, bypass CHECK, drift default or
active predicate and must make contract assertions fail. Strengthen migration
index metadata assertion without duplicating Domain status lists there.
Then refactor runtime SQL, build, run Sync PG, native units, genuine migration/
repeat/drift and roles, canonical quality. Final-head hosted Preflight/targeted/
Foundation logs/steps/artifacts required; old passes never certify a new head.
Three review rounds: DRY/correctness, database consistency, final regression/CI.

## 11. Review and rollout

Pre-code inspection/reuse audit complete2026-11-05; no owner approval gate.
Record exact snapshot raw digest in task and PR before push. Reviewable commits,
normal push existing branch, no merge/deploy. Task stays active/pending where Live
Provider/Domain capability remains unavailable. Preserve historical failure evidence.

## 12. PLAN ISSUES

NONE. Full status contract lives in the existing API integration suite because
ACTIVE_SYNC_JOBS is API Domain policy; migration tests retain structural index and
preservation checks. This is the explicitly permitted appropriate-test-module
option, not a reverse application dependency or skipped database contract gate.
