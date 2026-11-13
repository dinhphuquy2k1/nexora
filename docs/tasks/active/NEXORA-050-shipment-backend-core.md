# NEXORA-050 — Shipment Backend Core

Status: IN PROGRESS
Capability: NOT IMPLEMENTED
Verification: NOT VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-050
Classification: SIGNIFICANT
Plan revision: rev-2026-11-13-shipment-core-v1
Reviewed baseline: 055dfccb5f7feae36af41209fd6380916081f711
Branch: feat/shipment-backend-core
Design Snapshot: docs/tasks/design-reviews/NEXORA-050-rev-2026-11-13-shipment-core-v1.md
Design SHA-256: 632298b8bbc2f3a1a12e9131141e1eb9304137dec485cb95e212115f91f4239e

The immutable snapshot records the complete read-only inspection, eight-field reuse
audit, twelve-section SIGNIFICANT design, DDD contracts, alternatives, security,
compatibility and test-first plan. No live provider or production registration.

## Reuse audit

| Field                    | Domain and validation                                                                                                                 | Sync and persistence                                                                                                                                                         | API and tests                                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Shipment Aggregate, decimal VO, strict provider command                                                                               | Shipment binding and SQL reconciliation                                                                                                                                      | Owner-scoped GET projections and contracts                                                                                                                                                            |
| Existing implementations | apps/api/src/customer/domain/customer.aggregate.ts, customer-command.ts; common/validation/uuid.ts; packages/shared/src/validation.ts | sync/infrastructure/sync-domain.binding.ts, sync-job.repository.ts; customer/infrastructure/customer-sync-domain.binding.ts; packages/database/scripts/provision-runtime.mjs | customer/application/customer-owner.ts, customer-error.ts; customer.adapter.ts/controller/DTOs; apps/api/src/openapi.ts; integration/customer-integration.test.cjs; fixtures/sync-status-contract.cjs |
| Domain owner             | Shipment owns business invariants; Common owns UUID; Shared owns cross-package codes                                                  | Shipment owns provider field authority; Sync owns source/version/outcome/fence                                                                                               | Shipment queries; existing Identity auth and global HTTP policy                                                                                                                                       |
| Reuse alternatives       | Reuse neutral primitives; separate decimal/Shipment rules rather than copy Customer rules or add generic bases                        | Reuse typed proposal/commit binding and outer transaction; reject new worker/framework or generic Aggregate save                                                             | Reuse pagination, auth, errors, Swagger/SDK generation and genuine disposable-DB fixture patterns                                                                                                     |
| Selected approach        | Pure immutable Shipment with strict normalized provider patch, canonical shared shipment code leaf, exact string decimal validation   | Source-scoped locked hydration; provider-only column operations, per-line reconciliation, append-only history, final outer fence                                             | Bounded scoped SQL projections; exhaustive feature error map; real PG/HTTP tests and generated SDK                                                                                                    |
| Rationale                | Preserve ownership and exact values without float arithmetic or mutable outward references                                            | Existing engine already atomically fences source outcomes and domain writes; minimal new seam                                                                                | Avoid N+1, unbounded hydration, invented claim semantics or duplicated infrastructure                                                                                                                 |
| Risks                    | Input ambiguity, precision/scale, unknown mappings, mass assignment                                                                   | Stale lease/generation, scope collision, permission escalation, partial fee writes, version drift                                                                            | Owner leakage, inconsistent counts, unsafe errors, SDK drift, role-global test interference                                                                                                           |
| Verification             | RED/GREEN Domain tests, invalid shapes/money, immutable snapshots and all four fee states                                             | Migration catalog/behavior/parity, worker SQL denial, concurrency/rollback/version tests in real PG                                                                          | Auth/owner/search/counts/fees/history HTTP tests; lint/boundaries/contracts and canonical Docker/final-head CI                                                                                        |

## Plan

1. Close merged NEXORA-049 under §1.7 in first commit.
2. Freeze design and canonical four-state fee semantics before implementation.
3. Domain RED/GREEN; forward migration/schema RED/GREEN and exact DB contracts.
4. Fenced binding/least-privilege grants with real PostgreSQL transaction tests.
5. Owner-scoped read API, HTTP tests and generated OpenAPI/SDK.
6. Synchronize docs; canonical Docker and local verification; independent review.
7. Push scoped PR and wait for final-head hosted evidence; no merge/deploy.

## Acceptance criteria

- [ ] Domain invariants, immutable snapshots and provider authority.
- [ ] Forward schema, constraints/parity, historical data and repeat migrations.
- [ ] Four fee states, ordered duplicates, exact money and transactional reconciliation.
- [ ] Sync idempotency, version/lease/generation fencing and rollback.
- [ ] Worker SQL permissions and unchanged Nexora-owned fields.
- [ ] Three scoped GET APIs and generated contract parity.
- [ ] Canonical local and Docker verification.
- [ ] Independent review: no unresolved blocking P1/P2.
- [ ] Final-head hosted Preflight and Foundation.
- [ ] Owner review and merge decision.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Shipment core schema/domain, four fee states, worker column grants, read contract
and verification commands. Provider authorization and activation remain deferred.

### Canonical owners

- docs/domains/shipments.md
- docs/architecture/database.md
- docs/architecture/backend.md
- docs/architecture/api-contract.md
- docs/architecture/sync-extensions.md
- docs/architecture/reusable-components.md
- docs/operations/testing.md

### Documentation verification

format:check, docs:check, preflight:check, generated contract check and scoped review.

## Evidence

| Claim                    | Evidence                                                                                                                                                                           | Date       | Result |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and predecessor | main 055dfccb5f7feae36af41209fd6380916081f711; first commit 8595f26 closes049 after REST merge and final-head hosted provenance; node scripts/docs-check.mjs exit0; 2026-11-13 UTC | 2026-11-13 | PASS   |

## Troubleshooting checkpoint — 2026-11-13T15:57Z

Native SQL permission suite reached three unsuccessful attempts: seed lacked user
id; seed then lacked updated_at; next the INSERT test incorrectly expected denial
for source_identity_id, which is explicitly allowed on creation. Stopped editing,
compared SQL catalog/defaults and recorded grant contract, and replanned fixture:
supply all mandatory seed columns; distinguish create-only identity fields from
Nexora-owned fields (deny UPDATE for both, deny INSERT only for forbidden columns).
No production permission relaxation is selected. This is fixture correction within
v1, not a new domain contract or removal of security expectations.

Host setup also hit missing /runtime-config (EACCES), sudo unavailable, and Docker
VFS ENOSPC when creating a second container. No user data/volume was removed.
Replan host fixture to read an explicit test-only password-file path (canonical
Docker default remains /runtime-config/postgres_app_password); canonical Docker
execution still required, not claimed PASS. Reversible npm cache may be cleared.

| Claim                             | Evidence                                                                                                                                                                                                                                  | Date       | Result |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Domain RED                        | node --test apps/api/test/shipment/domain.test.cjs on working tree8595f26: MODULE_NOT_FOUND before implementation, exit1; 2026-11-13 UTC                                                                                                  | 2026-11-13 | FAIL   |
| Domain GREEN                      | shared/database builds and API compilation followed by domain suite: 5/5 PASS, 0 skipped; working tree8595f26, 2026-11-13 UTC                                                                                                             | 2026-11-13 | PASS   |
| Schema RED/GREEN                  | Real owned PostgreSQL: verifyShipmentSchema initially fails chk_shipments_kind before migration; after migrate deploy, UUID/code, tracking duplicates, closed CHECK sets and behavior, decimal and history keys pass; working tree8595f26 | 2026-11-13 | PASS   |
| Processor/read RED                | Native node tests for missing shipment-sync.processor and shipment.service modules each exit1 before implementation; working tree8595f26, 2026-11-13 UTC                                                                                  | 2026-11-13 | FAIL   |
| Initial compile corrections       | API tsc initially reports implicit proposal parameter types, then inferred Prisma getter declaration portability; explicit types corrected and tsc exit0; working tree8595f26                                                             | 2026-11-13 | FAIL   |
| Native SQL fixture attempts 1–3   | node --test packages/database/test/shipment-sql.mjs against signed task-owned PostgreSQL: missing user id, missing updated_at, then wrong INSERT-denial expectation for allowed-on-create source identity; replanned above                | 2026-11-13 | FAIL   |
| First genuine binding integration | node --test integration/shipment-integration.test.cjs: nine subtests PASS including final-fence and SQL rollback, outer test FAIL due one extra parent segment in provision-runtime import; working tree8595f26                           | 2026-11-13 | FAIL   |
| Host runtime preparation          | Missing /runtime-config EACCES; sudo unavailable; second Docker container creation fails no space left on device; no HTTP PASS claim                                                                                                      | 2026-11-13 | FAIL   |
