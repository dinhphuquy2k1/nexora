# NEXORA-050 — Shipment Backend Core

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-050
Classification: SIGNIFICANT
Plan revision: rev-2026-11-14-shipment-core-v3
Reviewed baseline: 919d69df3d5f77f891a7d8223ac178666889f1ca
Branch: feat/shipment-backend-core
Design Snapshot: docs/tasks/design-reviews/NEXORA-050-rev-2026-11-14-shipment-core-v3.md
Design SHA-256: 7af6fa100910a7f028750afebb64208b36353a9a154f92d1b15492c581772078

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

- [x] Domain invariants, immutable snapshots and provider authority.
- [x] Forward schema, constraints/parity, historical data and repeat migrations.
- [x] Four fee states, ordered duplicates, exact money and transactional reconciliation.
- [x] Sync idempotency, version/lease/generation fencing and rollback.
- [x] Worker SQL permissions and unchanged Nexora-owned fields.
- [x] Three scoped GET APIs and generated contract parity.
- [x] Canonical v3 verification (host quality and final-head hosted Docker PASS; historical local ENOSPC retained).
- [x] Independent review: v3 prefix P2 corrected; no unresolved P1/P2/P3 in independent review.
- [x] Final-head hosted Preflight and Foundation for v3 (final PR #47 evidence below).
- [x] Owner review and merge decision (owner merged PR #47).

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

### Adapter lifecycle correction

Reuse Customer/Sync adapter onApplicationShutdown convention for the Shipment read
pool. A real Nest application-context test observed zero disconnect calls before
implementation (expected one); the hook delegates to existing lazy close, without
opening an unused adapter. No database/API/Domain contract or snapshot change.
This is a feature-owned lifecycle bug fix, not a generic adapter framework.

Workspace pnpm test on42a8bcd stopped in the pre-existing 1s mocked TCP readiness
fixture (136 PASS/1 FAIL before workspace package suites). Launcher alone remains
8/8 PASS. Preserve the FAIL; resource-isolated host execution will be reported
separately, without changing deadlines/assertions or repository test configuration.

## Final implementation checkpoint — 2026-11-14

Production source is frozen at 4678aae8e41b618fef14140c9a2544c0a8febcb3.
The final independent reviews cover a0f250d, current-source orchestration42a8bcd
and lifecycle4678aae: no P1/P2/P3 findings. Reviewer independently ran 10/10 native
tests before the lifecycle addition and 8/8 launcher regressions; lifecycle review
was read-only while the main test suite ran. No existing OpenAPI paths/schemas
changed semantically against main. No owner approval or merge is claimed.

All final-targeted PostgreSQL execution below used the explicitly separate owned
PostgreSQL17.11 Alpine fast-loop cluster. Its private resources were label-checked,
then removed with their own anonymous volume after completion. No user volume was
reset. Canonical Bookworm Docker quality was attempted in a new unique Compose
project and failed while extracting an image: VFS no space left on device, before
application tests. Keep the FAIL. Hosted canonical execution remains required.

The workspace pnpm test command passed with taskset CPU affinity0 after preserving
two earlier 1s fixture timeouts under parallel scheduling. This changes only the
execution process affinity, not repository configuration, timeout or assertions.
Fresh suites: scripts137, API211, Web266, UI36 and Database6; eight Turbo tasks
succeeded, two cached build tasks (Shared/Web), no cached test results.

| Claim                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                         | Date       | Result |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| contracts-check                     | npx --yes pnpm@10.34.6 contracts:check; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; 2026-11-14T03:24:18.585763+00:00–2026-11-14T03:24:30.351098+00:00; exit0; reproducible committed OpenAPI/SDK                                                                                                                                                                                              | 2026-11-14 | PASS   |
| shipment-worker                     | node /tmp/nexora050-worker-run.cjs; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; 2026-11-14T03:24:30.352072+00:00–2026-11-14T03:25:09.144512+00:00; exit0; signed owned-cluster wrapper builds Shared/Database/API and executes real SyncRepository as nexora_sync plus real Nest HTTP; 15/15 PASS                                                                                             | 2026-11-14 | PASS   |
| shipment-sql                        | node /tmp/nexora050-sql-run.cjs; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; 2026-11-14T03:25:09.145432+00:00–2026-11-14T03:25:12.441363+00:00; exit0; actual nexora_sync/nexora_app SQL grant/denial and repeat provisioning; 1/1 PASS                                                                                                                                                       | 2026-11-14 | PASS   |
| migration                           | npx --yes pnpm@10.34.6 --filter @nexora/database test:migrations; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; 2026-11-14T03:25:12.445500+00:00–2026-11-14T03:25:47.923875+00:00; exit0; real Prisma legacy upgrade, existing Customer/all Sync row preservation, repeat deploy and zero drift                                                                                                 | 2026-11-14 | PASS   |
| shipment-fast                       | node --test apps/api/test/shipment/binding.test.cjs apps/api/test/shipment/contracts.test.cjs apps/api/test/shipment/domain.test.cjs apps/api/test/shipment/read.test.cjs; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; 2026-11-14T03:25:47.924450+00:00–2026-11-14T03:25:48.706703+00:00; exit0; Domain, typed input, actual Nest lifecycle, service/error and generated contract; 11/11 PASS | 2026-11-14 | PASS   |
| format:check                        | npx --yes pnpm@10.34.6 format:check; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; start2026-11-14T03:24:30.965558+00:00; exit0; executed canonical command                                                                                                                                                                                                                                     | 2026-11-14 | PASS   |
| docs:check                          | npx --yes pnpm@10.34.6 docs:check; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; start2026-11-14T03:24:57.888372+00:00; exit0; executed canonical command                                                                                                                                                                                                                                       | 2026-11-14 | PASS   |
| preflight:check                     | npx --yes pnpm@10.34.6 preflight:check; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; start2026-11-14T03:25:00.191864+00:00; exit0; executed canonical command                                                                                                                                                                                                                                  | 2026-11-14 | PASS   |
| lint                                | npx --yes pnpm@10.34.6 lint; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; start2026-11-14T03:25:02.009621+00:00; exit0; executed canonical command                                                                                                                                                                                                                                             | 2026-11-14 | PASS   |
| test:lint                           | npx --yes pnpm@10.34.6 test:lint; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; start2026-11-14T03:25:20.578511+00:00; exit0; 54/54 lint regressions                                                                                                                                                                                                                                            | 2026-11-14 | PASS   |
| Local canonical Docker              | COMPOSE_PROJECT_NAME=nexora050-93283761 sh scripts/quality-docker.sh; HEAD 4678aae8e41b618fef14140c9a2544c0a8febcb3; 2026-11-14T03:26:00.250133+00:00–2026-11-14T03:26:25.741328+00:00; exit1; failed to register layer, mkdir ossl-modules: no space left on device; application tests NOT RUN                                                                                                  | 2026-11-14 | FAIL   |
| Workspace tests                     | taskset -c 0 env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 test; HEAD4678aae; 8/8 tasks, script137/API211/Web266/UI36/Database6 PASS, 0 FAIL; two build-cache hits only; 2026-11-13 UTC historical execution (exact start not retained)                                                                                                                        | 2026-11-13 | PASS   |
| Workspace tests normal scheduling   | API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 test on42a8bcd; scripts136 PASS/1 FAIL at mocked TCP1s deadline before Turbo suites; no timeout/assertion changes                                                                                                                                                                                                    | 2026-11-13 | FAIL   |
| Root typecheck missing prerequisite | npx --yes pnpm@10.34.6 typecheck: Web build requires API_INTERNAL_URL; exit1 before configured rerun; working tree on a1b11ca                                                                                                                                                                                                                                                                    | 2026-11-13 | FAIL   |
| Configured root typecheck           | API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 typecheck; working tree on a1b11ca with typed-input delta; 10/10 tasks PASS; 1 cached build; original start UTC not retained                                                                                                                                                                                         | 2026-11-13 | PASS   |
| Existing genuine Sync regression    | npx --yes pnpm@10.34.6 --filter @nexora/api exec node --test integration/sync-integration.test.cjs; working tree on a1b11ca with typed-input delta; 2026-11-13T16:37:09.596156Z–16:39:52.991866Z; 53/53 PASS including actual six-table provider-length parity, customer mapping, retention, concurrency and fences                                                                              | 2026-11-13 | PASS   |
| Lifecycle RED                       | Actual Nest context test expected one pool disconnect, observed zero before adding onApplicationShutdown; test on42a8bcd working tree; subsequently 11/11 fast suite PASS on4678aae                                                                                                                                                                                                              | 2026-11-13 | FAIL   |
| Source mount RED/GREEN              | Launcher regression expected current read-only API source mount: 7 PASS/1 FAIL before change; after worker-only source/compiler mounts 8/8 PASS; independent review also8/8 PASS; source42a8bcd                                                                                                                                                                                                  | 2026-11-13 | FAIL   |

## Changed-file inventory

Full scope relative to main055dfccb5f7feae36af41209fd6380916081f711:

```text
M apps/api/integration/fixtures/provider-length-contract.cjs
A apps/api/integration/fixtures/shipment-schema.cjs
A apps/api/integration/shipment-integration.test.cjs
M apps/api/openapi/openapi.json
M apps/api/src/app.module.ts
M apps/api/src/openapi.ts
A apps/api/src/shipment/application/shipment-error.ts
A apps/api/src/shipment/application/shipment-owner.ts
A apps/api/src/shipment/application/shipment-read.port.ts
A apps/api/src/shipment/application/shipment-sync.port.ts
A apps/api/src/shipment/application/shipment-sync.processor.ts
A apps/api/src/shipment/application/shipment.input.ts
A apps/api/src/shipment/application/shipment.service.ts
A apps/api/src/shipment/domain/shipment.ts
A apps/api/src/shipment/infrastructure/shipment-provider.persistence.ts
A apps/api/src/shipment/infrastructure/shipment-sync-domain.binding.ts
A apps/api/src/shipment/infrastructure/shipment.adapter.ts
A apps/api/src/shipment/infrastructure/shipment.mapper.ts
A apps/api/src/shipment/presentation/shipment.controller.ts
A apps/api/src/shipment/presentation/shipment.dto.ts
A apps/api/test/shipment/binding.test.cjs
A apps/api/test/shipment/contracts.test.cjs
A apps/api/test/shipment/domain.test.cjs
A apps/api/test/shipment/read.test.cjs
M docs/ai/PROJECT_RULES.md
M docs/architecture/api-contract.md
M docs/architecture/backend.md
M docs/architecture/database.md
M docs/architecture/reusable-components.md
M docs/architecture/sync-extensions.md
M docs/domains/shipments.md
M docs/operations/testing.md
R094 docs/tasks/active/NEXORA-049-shipment-domain-design.md docs/tasks/completed/NEXORA-049-shipment-domain-design.md
A docs/tasks/active/NEXORA-050-shipment-backend-core.md
A docs/tasks/design-reviews/NEXORA-050-rev-2026-11-13-shipment-core-v1.md
A docs/tasks/design-reviews/NEXORA-050-rev-2026-11-13-shipment-core-v2.md
A docs/tasks/design-reviews/NEXORA-050-rev-2026-11-14-shipment-core-v3.md
M eslint.config.mjs
A packages/database/prisma/migrations/20261113000000_shipment_core/migration.sql
M packages/database/prisma/schema.prisma
M packages/database/scripts/provision-runtime.mjs
M packages/database/test/migration.mjs
A packages/database/test/shipment-sql.mjs
A packages/database/test/shipment-worker.mjs
M packages/sdk/src/generated/api.ts
M packages/shared/package.json
A packages/shared/src/shipment/index.ts
M scripts/boundaries.mjs
M scripts/eslint-rules/no-domain-vocabulary-literals.mjs
M scripts/eslint-rules/no-domain-vocabulary-literals.test.mjs
M scripts/eslint-rules/no-nested-ternary.test.mjs
M scripts/provision-cluster-smoke.mjs
M scripts/provision-cluster-smoke.test.mjs
M scripts/runtime-smoke.sh
```

Production capability declarations, existing migrations, old immutable snapshots,
Customer source mapping storage, provider length implementation, Web/ingress,
manual creation/linking, real provider transports and production activation are
unchanged. Official provider authorization/completeness/mapping/claim semantics,
Retail UI and Nexora business commands remain the documented deferred scope.

## Hosted checkpoint and runtime migration-count correction — 2026-11-14

HEAD a32258626bd7cb7d2901a94b491615b182bca1dc, tested PR merge
a783511b6831ec0ba968a45515bf5f98d01af80d on main055dfcc. Foundation step7
failed because runtime-smoke.sh still expects thirteen migrations; the approved
Shipment forward migration makes fourteen. Read-only search found this sole
hardcoded count. Before correction, record this delta: change only13→14 in the
exact schema assertion; preserve the stored_files zero check, all other assertions
and all deadlines. This implements the existing v2 forward-migration verification
plan, without a Domain/schema/API design change or new snapshot. Hosted failure is
RED evidence; require fresh hosted verification on the corrected HEAD, not a rerun
of unchanged code. Do not claim later steps were executed on the failed run.

| Claim                          | Evidence                                                                                                                                                                                                                                                                                                                                                | Date       | Result |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Hosted Preflight               | https://github.com/dinhphuquy2k1/nexora/actions/runs/43552008923 attempt1; HEAD a32258626bd7cb7d2901a94b491615b182bca1dc; merge a783511b6831ec0ba968a45515bf5f98d01af80d; governance and24/24 tests PASS at2026-11-14T03:30:57Z                                                                                                                         | 2026-11-14 | PASS   |
| Hosted Sync Targeted           | https://github.com/dinhphuquy2k1/nexora/actions/runs/43552008901 attempt1; same HEAD/merge; 53/53 real PostgreSQL tests, explicit provider columns match CARRIER_PROVIDER_MAX_LENGTH PASS, completed2026-11-14T03:33:12Z                                                                                                                                | 2026-11-14 | PASS   |
| Hosted canonical Docker and M5 | Foundation https://github.com/dinhphuquy2k1/nexora/actions/runs/43552008908 attempt1, job132316380456; same HEAD/merge; steps4–6 PASS (canonical Docker quality/migrated integration, M5 acceptance, stop development), observed2026-11-14T03:37:42Z; no manual screenshot review claimed                                                               | 2026-11-14 | PASS   |
| Foundation runtime RED         | Same run43552008908 attempt1/head/merge; step7 FAIL at2026-11-14T03:38:44.7469357Z: Migrated schema assertion failed. CLI log reports14 migrations and no pending migrations; smoke asserts13 and stored_files0. Steps8–10 SKIPPED; later missing Retail/Account/Carrier artifacts are consequences, not completed assertions. Historical FAIL retained | 2026-11-14 | FAIL   |

## Bounded same-head M5 startup classification — 2026-11-14

Foundation43552959636 attempt1 on82d17dc783941055c892524d96bacf394b901bcd
passed canonical Docker step4, then step5 failed at2026-11-14T03:48:08.1138129Z:
AssertionError [ERR_ASSERTION]: Chromium startup (m5-browser-checks.mjs:121).
Steps6–10 were SKIPPED. The preceding head a322586 passed this same M5 gate;
git diff a322586..82d17dc for m5-browser-checks.mjs, packages/ui and apps/web is
empty. Record one deliberate failed-job rerun on the exact same82d17dc, no code
change, to classify transient startup. Do not change launcher/assertions/deadlines.
This evidence remains uncommitted until the bounded result is known so the rerun
checks the original HEAD; both attempt results must be preserved.

| Claim                          | Evidence                                                                                                                                                                                                                                                            | Date       | Result |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Foundation M5 startup attempt1 | https://github.com/dinhphuquy2k1/nexora/actions/runs/43552959636 attempt1, HEAD82d17dc783941055c892524d96bacf394b901bcd; step4 PASS, step5 Chromium startup ASSERTION_FAILED at2026-11-14T03:48:08.1138129Z, steps6–10 SKIPPED; same M5 source passed previous head | 2026-11-14 | FAIL   |

| Foundation bounded attempt2 | https://github.com/dinhphuquy2k1/nexora/actions/runs/43552959636 attempt2, job132321706101; HEAD82d17dc783941055c892524d96bacf394b901bcd; tested mergeabfe9a2fafacc10de8c534d2ada6776dc5c0e4a8 (actions/checkout git log; parents main055dfcc and HEAD82d17dc); 2026-11-14T03:51:08Z–04:12:22Z UTC; steps4–10 all PASS, including canonical Docker, M5, runtime, public HTTPS, persistence and HMR; one deliberate same-head failed-job rerun, no code change | 2026-11-14 | PASS |
| Hosted corrected-head governance and Sync | Preflight https://github.com/dinhphuquy2k1/nexora/actions/runs/43552959524 completed2026-11-14T03:42:19Z; Sync Targeted https://github.com/dinhphuquy2k1/nexora/actions/runs/43552959499 completed2026-11-14T03:44:16Z; same82d17dc HEAD | 2026-11-14 | PASS |

This final evidence-only commit requires fresh hosted gates on its own HEAD. Their exact SHA, run IDs and conclusions are maintained in PR #47 without another SHA-only documentation commit. Owner review/merge remains pending; no merge or production activation is authorized here.

## Review delta v3 — internal Shipment code prefix

Review https://github.com/dinhphuquy2k1/nexora/pull/47#pullrequestreview-5901710642
confirmed one P2: the internally consistent VD implementation differs from the
currently requested SHP000001 convention. V2 explicitly recorded VD as an
implementation decision, not an owner approval. Preserve that historical statement
and immutable v1/v2 bytes. V3 supersedes only the prefix; previous final-green
919d69d and its runs remain historical evidence. No new task/PR or approval claim.

The pre-code impact matrix, exact paths, eight-field reuse audit, migration safety
gate and RED/GREEN/concurrency/role/HTTP verification matrix are recorded in v3.
The migration is new/unmerged (PR open; absent from origin/main055dfcc). Only owned
disposable test databases may apply it or manipulate their sequence. Stop if any
persistent applied deployment is discovered. No production data or user volumes.

Current plan delta before implementation: add SHP format/hydration regressions and
real sequence allocation/permission/HTTP assertions; demonstrate RED; change only
the generator prefix and hydration regex; correct conflicting current shipments.md
and database.md; execute targeted/canonical tests, independent review, push and
require fresh final-head hosted gates. Keep sequence/function/default, UNIQUE,
source matching, fees/history, grants, API/schema/SDK and production registry intact.

Documentation Impact remains REQUIRED. Changed facts for v3: SHP internal codes,
minimum-six-digit global PostgreSQL allocation with allowed gaps; tracking/source
identities remain independent. Canonical delta owners: docs/domains/shipments.md
and docs/architecture/database.md. No ADR011 architectural change.

## V3 verification checkpoint — 2026-11-14

All local rows below execute against working tree on
919d69df3d5f77f891a7d8223ac178666889f1ca with the recorded v3 prefix correction,
not the unchanged v2 source. Times are UTC. Host PostgreSQL17.11 Alpine is a
fast-loop proof, separate from canonical Bookworm Docker. Private synthetic
credentials/token were supplied only to label/ID-verified owned disposable
infrastructure; source suites create/migrate/drop their own databases. No user
volume, shared credential or real deployment was modified. Container/anonymous
volume and unused task-pulled image were removed after all DB suites completed.

| Claim                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                     | Date       | Result |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Domain prefix RED                       | node --test apps/api/test/shipment/domain.test.cjs before production change; 8 tests,5 PASS/3 FAIL: valid SHP hydration rejected by VD regex; log last-write UTC 2026-11-14T04:51:24.204331+00:00 (original command start not retained)                                                                                                                                                                                                      | 2026-11-14 | FAIL   |
| Database prefix RED                     | node /tmp/nexora050-sql-run.cjs; native node --test packages/database/test/shipment-sql.mjs before generator change;1 FAIL: actual VD000001, expected SHP000001; log last-write UTC 2026-11-14T04:52:12.846275+00:00 (original command start not retained)                                                                                                                                                                                   | 2026-11-14 | FAIL   |
| shipment-sql                            | node /tmp/nexora050-sql-run.cjs; 2026-11-14T04:53:12.131556+00:00–2026-11-14T04:53:41.822090+00:00; exit0; Native SQL1/1 PASS; fresh SHP000001, next000002/000003, eight distinct concurrent nexora_sync clients/codes across owners/providers, duplicate tracking allowed, UNIQUE23505,999999/1000000 boundary; worker-only sequence/function and actual42501 business/code denials; repeat grants                                          | 2026-11-14 | PASS   |
| shipment-worker                         | node /tmp/nexora050-worker-run.cjs; 2026-11-14T04:53:41.825794+00:00–2026-11-14T04:54:12.937393+00:00; exit0; Genuine Sync engine as authenticated nexora_sync plus real Nest HTTP15/15 PASS; list/detail generated SHP equality, owner isolation, source/version/fence/fee/history/rollback intact                                                                                                                                          | 2026-11-14 | PASS   |
| migrations                              | npx --yes pnpm@10.34.6 --filter @nexora/database test:migrations; 2026-11-14T04:54:12.938698+00:00–2026-11-14T04:55:05.884256+00:00; exit0; Forward deploy/repeat/zero drift and legacy Customer/Sync preservation PASS, unchanged harness                                                                                                                                                                                                   | 2026-11-14 | PASS   |
| sync-integration                        | npx --yes pnpm@10.34.6 --filter @nexora/api exec node --test integration/sync-integration.test.cjs; 2026-11-14T04:55:05.886861+00:00–2026-11-14T04:57:42.755611+00:00; exit0; Existing genuine Sync53/53 PASS, including six-table provider-length parity and concurrency/lease/retention/HTTP                                                                                                                                               | 2026-11-14 | PASS   |
| shipment-fast                           | node --test apps/api/test/shipment/binding.test.cjs apps/api/test/shipment/contracts.test.cjs apps/api/test/shipment/domain.test.cjs apps/api/test/shipment/read.test.cjs; 2026-11-14T04:57:42.758568+00:00–2026-11-14T04:57:43.475466+00:00; exit0; Shipment unit/read/contracts/lifecycle12/12 PASS; new Domain8/8 includes full-state hydration, exact code bounds, VD/malformed/whitespace rejection and provider-code mass assignment   | 2026-11-14 | PASS   |
| contracts-check                         | npx --yes pnpm@10.34.6 contracts:check; 2026-11-14T04:57:43.475869+00:00–2026-11-14T04:57:52.771498+00:00; exit0; Generated OpenAPI/SDK reproducibility PASS; no generated contract change                                                                                                                                                                                                                                                   | 2026-11-14 | PASS   |
| format:check                            | npx --yes pnpm@10.34.6 format:check; 2026-11-14T04:53:57.974603+00:00–2026-11-14T04:54:24.796665+00:00; exit0                                                                                                                                                                                                                                                                                                                                | 2026-11-14 | PASS   |
| docs:check                              | npx --yes pnpm@10.34.6 docs:check; 2026-11-14T04:54:24.799214+00:00–2026-11-14T04:54:27.525050+00:00; exit0                                                                                                                                                                                                                                                                                                                                  | 2026-11-14 | PASS   |
| preflight:check                         | npx --yes pnpm@10.34.6 preflight:check; 2026-11-14T04:54:27.528622+00:00–2026-11-14T04:54:30.783942+00:00; exit0                                                                                                                                                                                                                                                                                                                             | 2026-11-14 | PASS   |
| lint                                    | npx --yes pnpm@10.34.6 lint; 2026-11-14T04:54:30.788028+00:00–2026-11-14T04:54:54.987455+00:00; exit0                                                                                                                                                                                                                                                                                                                                        | 2026-11-14 | PASS   |
| test:lint                               | npx --yes pnpm@10.34.6 test:lint; 2026-11-14T04:54:54.990992+00:00–2026-11-14T04:55:07.755456+00:00; exit0                                                                                                                                                                                                                                                                                                                                   | 2026-11-14 | PASS   |
| test:docs                               | npx --yes pnpm@10.34.6 test:docs; 2026-11-14T04:55:07.756040+00:00–2026-11-14T04:55:11.072016+00:00; exit0                                                                                                                                                                                                                                                                                                                                   | 2026-11-14 | PASS   |
| test:preflight                          | npx --yes pnpm@10.34.6 test:preflight; 2026-11-14T04:55:11.073244+00:00–2026-11-14T04:55:13.989411+00:00; exit0                                                                                                                                                                                                                                                                                                                              | 2026-11-14 | PASS   |
| boundaries                              | node scripts/boundaries.mjs; 2026-11-14T04:55:13.992002+00:00–2026-11-14T04:55:15.154393+00:00; exit0                                                                                                                                                                                                                                                                                                                                        | 2026-11-14 | PASS   |
| Canonical local Docker environment FAIL | COMPOSE_PROJECT_NAME=nexora050-prefix-c40d059c sh scripts/quality-docker.sh; 2026-11-14T04:57:59.329026+00:00–2026-11-14T04:58:44.217953+00:00; exit1: failed to register layer: mkdir /usr/share/perl/5.36.0/ExtUtils/MakeMaker: no space left on device (rootless VFS7.9GB); image extraction failed, application assertions NOT RUN; no retry or timeout/assertion change                                                                 | 2026-11-14 | FAIL   |
| Independent v3 code review              | Read-only independent agent shipment_prefix_review, observed2026-11-14T04:54:10Z:0 confirmed P1/P2/P3; independently node --test apps/api/test/shipment/domain.test.cjs8/8 PASS and git diff --check PASS; checked only two production literal changes, unmodified schema/grants/API/fences and original snapshot bytes; hosted readiness still pending                                                                                      | 2026-11-14 | PASS   |
| Snapshot integrity and binding          | sha256sum: v1 632298b8bbc2f3a1a12e9131141e1eb9304137dec485cb95e212115f91f4239e; v2 a9efc763f6c85ae1aa0d40aaea405a5c8394532261e0173c604cdc8b2395c0b4; v3 7af6fa100910a7f028750afebb64208b36353a9a154f92d1b15492c581772078; v3 formatted before raw hashing; validatePrTaskBinding with five v3 fields valid:true, failures:[], observed2026-11-14T05:02:50.603656+00:00                                                                       | 2026-11-14 | PASS   |
| Host repository quality                 | taskset -c 0 env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality; 2026-11-14T04:59:04.469877+00:00–2026-11-14T05:03:06.848642+00:00; exit0; scripts137/API212/Web266/UI36/Database6 tests PASS (tests executed, no cached tests); typecheck10/10, test pipeline8/8, build4/4, contracts PASS; cached build/typecheck tasks explicitly distinct from executed tests; no repository runner/deadline change | 2026-11-14 | PASS   |

Fresh final-head v3 hosted gates are pending at this pre-push task checkpoint.
The exact final SHA, checkout merge SHA, workflow IDs/attempts/UTC conclusions
will be recorded in PR47 after execution, without another SHA-only task commit.
Unchecked hosted/canonical markers above reflect this checkpoint; the PR's final
provenance is authoritative for subsequent final-head CI availability. Owner review
and merge remain pending; no approval, merge, deploy or capability activation.

## Closure — 2026-11-14

Delivered by PR #47. Final-head hosted gates passed on 6707efb9c599322c7579421149f8c522963b714a. Owner confirmed Customer source cardinality is many-to-one (multiple carriers may share one Customer), as recorded in ADR-011; sync_source_identities.customer_id remains until a separate cleanup task using a Customer-owned link table. Operationally, all carrier connections should use the same company account. Closed in the first commit of NEXORA-045 under §1.7.

| Claim                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Date       | Result |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Merged to main          | PR #47 https://github.com/dinhphuquy2k1/nexora/pull/47; REST merged=true; merge SHA ad7a7967414f6fe0cb2ccb1a71a4550583c78b05; merged_at2026-11-14T06:48:44Z; git log origin/main --merges confirms merge                                                                                                                                                                                                                                                                           | 2026-11-14 | PASS   |
| Final-head hosted gates | PR #47 Final green HEAD6707efb9c599322c7579421149f8c522963b714a; Preflight https://github.com/dinhphuquy2k1/nexora/actions/runs/43559745440 PASS; Sync Targeted https://github.com/dinhphuquy2k1/nexora/actions/runs/43559745508 PASS; Foundation https://github.com/dinhphuquy2k1/nexora/actions/runs/43559745438 attempt1/job132340547817 PASS steps4–10, completed2026-11-14T05:21:00Z; tested checkout merge d7626815e54640207b65cf75e06016b20fcad803; original FAILs retained | 2026-11-14 | PASS   |
