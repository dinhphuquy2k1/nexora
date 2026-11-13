# NEXORA-050 — Shipment Backend Core

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-050
Classification: SIGNIFICANT
Plan revision: rev-2026-11-13-shipment-core-v2
Reviewed baseline: 055dfccb5f7feae36af41209fd6380916081f711
Branch: feat/shipment-backend-core
Design Snapshot: docs/tasks/design-reviews/NEXORA-050-rev-2026-11-13-shipment-core-v2.md
Design SHA-256: a9efc763f6c85ae1aa0d40aaea405a5c8394532261e0173c604cdc8b2395c0b4

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
- docs/ai/PROJECT_RULES.md
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

## Review delta — v2

Independent draft review found four P2 issues: actual root/charge modeling, real worker-role engine verification, physical schema oracle/mutation/FK/index and Customer association proof, and Swagger integer/null semantics. The immutable v2 records corrections before affected code. v1 remains immutable. An explicit history-only providerChangedAt prevents derivation from root update time. Final independent review and canonical gates remain open.

### V2 implementation clarification

Provider-only Aggregate creation receives a separate trusted source scope (owner,
source identity, nullable connection and provider), not payload mass assignment.
This keeps the root's source/provider/status invariant valid even before DB root
ID/code assignment. Hydration validates that immutable relationship; the existing
v2 identity/ownership design and API contract are unchanged. Database/persistence
faults during hydration occur before processor source validation and propagate.

### Reuse boundary clarification

Reuse common isUuid, Carrier's provider-length constant and shared pagination.
Keep Shipment's strict record policy local because Customer's existing helper
throws CustomerError and extraction would change an unrelated business domain.
No generic command framework is introduced. Shared Shipment code leaf receives a
strict zero-dependency boundary; vocabulary and nested-control-flow lint deliberately
extend to the new domain, including history aliases and actual ESLint tests.

### Local checkpoint — 2026-11-13T16:27Z

Working tree on 18e230d contains implementation and v2 corrections. Executed native
suite 9/9 PASS, real signed owned PostgreSQL17.11 Alpine worker suite 15/15 PASS,
native SQL role suite PASS and full script suite 137/137 PASS. The script suite's
first concurrent run was 136 PASS/1 FAIL (existing 1s temporary-TCP test fixture,
TCP_READINESS_TIMEOUT under resource load); bounded solo run passed without timeout
or assertion changes. The default launcher inventory intentionally grew from two
to four suites; selector regression expected count changed accordingly (8/8 PASS).
Prisma migration upgrade/repeat/drift passed; added final preservation comparisons
for all old Sync fixture tables still require final execution.

Worker engine RED showed PostgreSQL42501 for Prisma shipment.create: Prisma emitted
created_at despite the worker's deliberately narrow grants. Replaced only this
provider persistence operation with explicit columns/DB defaults; grants remain
restricted. The following worker run passed. Boundary initially rejected the new
shared subpath until its precise pure-code exception/negative tests were added.
Lint initially caught an unused fixture variable and missing structuredClone global
qualification; corrected without changing lint policy. V2 Aggregate and Swagger
regressions were observed RED before implementation; final fast suite passed.

Actual Docker restart initially failed the host readiness probe because Docker
changed the dynamically published port (server itself restarted successfully).
Refreshed the private fixture URL from docker port; second owned restart preserved
Shipment, ordered duplicate OTHER fees, mixed-currency exact decimals and history,
then cleaned only owned rows. This is Alpine fast-loop evidence, not canonical
Bookworm or final-head hosted evidence. No production/user volume reset.

| Claim                         | Evidence                                                                                                                                                                                                                                                                                                   | Date       | Result |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Draft independent review      | shipment_design_review read-only review: four P2 findings (root modeling, worker execution, schema oracle, Swagger); fixed under frozen v2; re-review found no remaining P1/P2/P3; no canonical/hosted success attested                                                                                    | 2026-11-13 | PASS   |
| Aggregate and Swagger RED     | Added actual-root/Charge lifecycle test failed create-is-not-a-function; integer contract test failed number versus integer; original execution start UTC not retained, observed at this checkpoint on18e230d working tree                                                                                 | 2026-11-13 | FAIL   |
| Restricted worker RED         | Signed owned-cluster engine test: 1 PASS/9 FAIL after first Prisma INSERT42501 permission denied shipments (created_at); dependent fixture failures retained; log last written 2026-11-13T16:10Z, working tree18e230d                                                                                      | 2026-11-13 | FAIL   |
| Script concurrency checkpoint | node --test "scripts/\*_/_.test.mjs": 136 PASS/1 FAIL, TCP_READINESS_TIMEOUT in temporary launcher fixture; bounded solo run 137/137 PASS without changing timeout/assertions; working tree18e230d                                                                                                         | 2026-11-13 | FAIL   |
| Restart probe first attempt   | Owned Docker PostgreSQL17.11 Alpine restarted; host probe retained old dynamic port32770 while published port became32771; bounded readiness FAIL, corrected by rediscovery only; working tree18e230d                                                                                                      | 2026-11-13 | FAIL   |
| Actual restart durability     | node /tmp/nexora050-restart.cjs checks task resource label, migrates owned base, seeds Shipment/ordered duplicate fees/mixed currencies/history, captures snapshot, docker restart, rediscovers host port and compares exact snapshot; PASS with owned row cleanup; 2026-11-13T16:21Z, working tree18e230d | 2026-11-13 | PASS   |

## Committed implementation verification

Implementation commit f1a9df82355c0847813f8b345a6c1844c72fdf35 is recorded;
canonical/hosted verification and owner review remain open. Contract generation is
committed and contracts:check passed on that exact HEAD. A newly added ADMIN/MFA
isolation fixture exceeded the existing username VARCHAR limit by its prefix;
shorten only the synthetic prefix, not production constraints or assertions.

| Claim                           | Evidence                                                                                                                                                                                                                                                                                 | Date       | Result |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Reproducible generated contract | npx --yes pnpm@10.34.6 contracts:check on f1a9df82355c0847813f8b345a6c1844c72fdf35; start2026-11-13T16:30:56.213540Z, finish2026-11-13T16:31:06.334672Z; exit0; generated files committed and byte-reproducible                                                                          | 2026-11-13 | PASS   |
| Added ADMIN fixture seed        | Signed owned-cluster Shipment suite on f1a9df82355c0847813f8b345a6c1844c72fdf35; 1 PASS/1 FAIL before engine work: synthetic shipment-admin plus UUID exceeds username VARCHAR; 2026-11-13T16:31:06.336317Z–16:31:24.562252Z, exit1. Only fixture prefix shortened; real schema retained | 2026-11-13 | FAIL   |

### Typed input contract checkpoint

The planned narrow normalized input now has an explicit ShipmentProviderInput /
ShipmentChargeInput contract. A shared feature-owned normalization algorithm feeds
both the generic-source parser and Aggregate command validation. The parser copies
validated values and preserves complete:true versus omission, without accepting
logistics_stage from payload. This completes v2's recorded input contract; no API,
schema, permission or provider activation delta is introduced. RED: the new parser
unit test failed function-not-found before implementation; GREEN: 10/10 fast tests.
Historical run start for this RED checkpoint was not retained; working tree on
a1b11ca7f3665924a6de5c197aa8d914eafe598e, observed2026-11-13T16:42Z.

### Owned worker source provenance

The signed-cluster worker suite now mounts current API, Shared and Database source
and compiler inputs read-only, so an existing tooling-image cache cannot substitute
older application code for current-HEAD verification. The image still supplies the
pinned installed dependencies; canonical quality builds it from the current lock.
No production launcher or source changes. RED: launcher regression failed the new
current read-only API-source mount assertion (7 PASS/1 FAIL); adding only worker-suite
mounts follows v2's requirement to execute the current implementation.
