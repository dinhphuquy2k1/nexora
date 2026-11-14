# NEXORA-050 — Shipment Backend Core

## 1. Task metadata and classification

Task ID: NEXORA-050
Classification: SIGNIFICANT
Plan revision: rev-2026-11-14-shipment-core-v3
Reviewed baseline: 919d69df3d5f77f891a7d8223ac178666889f1ca
Branch: feat/shipment-backend-core

## 2. Requirements and boundaries

Implement Shipment Aggregate, ordered current charges, append-only stage observations,
forward migration, trusted fenced Sync binding, three owner-scoped read APIs, shared
vocabulary, generated contracts and genuine PostgreSQL/HTTP tests. No live provider
adapter, registration, Customer matching/creation/link command, billing, fee history,
Retail UI, new scheduler or Customer source storage relocation. Production registry
stays empty. Fixtures do not establish API rights or real provider completeness.

## 3. Documentation owners

ADR-008/009/010/011 govern this work. Update docs/domains/shipments.md,
docs/architecture/database.md, backend.md, api-contract.md, sync-extensions.md,
docs/operations/testing.md and reusable-components.md for delivered facts only.

## 4. Read-only inspection and reuse search

Inspected AGENTS and the AI routed governance; Shipment/Customer docs, database,
backend/API/Sync guides and testing; Customer Aggregate/commands/adapter/controller;
Sync ports, capability registry, apply transaction and Customer binding; schema,
forward migrations, migration harness, runtime-role provisioning, integration
fixtures, shared exports and OpenAPI generator. Searched isUuid, parsePagination,
SyncDomainBinding, assertLease, source_version, grants and runtime declarations.
NEXORA-050 is unused in task inventories and open PRs. Baseline main contains PR46.

## 5. Reuse and design audit

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

## 6. Alternatives and trade-offs

Reject tracking-code identity, default currencies, floating point, inferred total,
new financial history, bulk child delete/reinsert, broad root UPDATE grants,
unverified claim predicates and production provider declarations. Charge identities
represent current ordered positions: reconcile by line_no without renumbering keys;
unchanged positions retain UUID, changed positions update fields, new positions
insert, absent positions delete only for an explicitly complete snapshot. A reorder
updates position contents, avoiding transient uniqueness collisions. This is a
specific provider operation, not an aggregate persistence framework.

## 7. Selected design and DDD preflight

Shipment is the root; Charge is a child; stage history is an append-only observation
projection outside mutable children. Internal identity, owner, code and Nexora-owned
customer/assignee/note/updater fields have no provider setter. Reads do not hydrate
an Aggregate. Decimal VO validates plain string precision/scale without rounding;
amounts NUMERIC(18,2), weight NUMERIC(10,3), rate NUMERIC(18,6). Domain rejects
overscale before PostgreSQL typmod can round. JSON decimals are strings. No currency
fallback/conversion, derived total/rate/provider time or fabricated fee semantics.
Negative reported monetary amounts are retained; weight/counts are nonnegative.
Optional provider fields missing from a patch retain stored values; creation uses
NULL for missing nullable values. Tracking and provider status remain verbatim.

Normalized provider input uses an optional charges field. Absent means preserve;
{complete:true,lines:[...]} means authoritative ordered replacement, including
empty lines meaning clear. Partial/ambiguous/malformed collections reject the whole
proposal as REJECTED_SOURCE/SOURCE_INVALID, without provider or child writes. Lines
have chargeCode, amount, currency and optional providerLabel; line numbers derive
from source order starting at 1. No fabricated mapping of provider labels.

The processor uses an injected pure verified-status mapper. Test-owned synthetic
codes are not Uniship codes. Unmapped status yields UNKNOWN and a safe fixed
warning code, never automatic NEEDS_REVIEW. History appends only a real stage
change (including initial null to stage), keyed by shipment/source/processor
version. New mapper versions can map UNKNOWN on the same source version without
inventing a source observation. Same stage alone does not append history.

Current code decision: use SHP plus at least six sequence digits (SHP000001),
shipment_code_seq and next_shipment_code(), following Customer's DB-owned code
pattern. This is an implementation design decision, not a claimed owner approval.
One new forward migration, no historical edits. UUID/code/timestamps default in DB.
All approved FK/CHECK/index contracts apply; claim partial index is deferred.

## 8. Security, concurrency and performance

Reuse engine ACTIVE user/epoch/connection/job/source locks and final assertLease.
Binding verifies frozen owner/provider/account/type/source scope and versions,
hydrates root under row lock, prepares a proposal, then commits only for APPLIED.
No proposal means no APPLIED commit. Session closes; processor version remains
stable. No network under locks. Source uniqueness serializes initial creation;
tracking can overlap across identities. Root/charges/history/source outcome roll
back together on final lease/version failure or SQL error. Unexpected DB/program
failures propagate instead of being classified as invalid source/business review.

nexora_app gets SELECT only on new tables. nexora_sync gets root SELECT plus
column INSERT/UPDATE limited to identity-on-create and provider-owned fields;
no root DELETE and no Nexora business field INSERT/UPDATE. Charges permit scoped
INSERT/UPDATE/DELETE, no identity/key UPDATE; history SELECT/INSERT only. Sequence
USAGE/function EXECUTE only where required. Existing grants remain compatible;
repeat provisioning revokes stale column ACLs. Genuine SQL worker denial tests
are mandatory, not just TypeScript allowlist tests. Read adapters reuse Customer's
ACTIVE actor transaction lock and owner predicates; all page/count/stats queries
use a consistent owner/search scope and bounded indexed SQL.

## 9. Compatibility and public contracts

Add shared shipment subpath as const kind/stage/charge vocabulary, derived unions,
no enums or presentation labels. Extend vocabulary lint/catalog deliberately.
Add three authenticated GET routes; no write endpoints. q searches tracking
literally, stage filters closed stage values, page/pageSize use shared policy.
Stable root order created_at DESC,id DESC; history observed_at DESC,id DESC.
List totals reflect current stage filter; stage counts share owner/q and ignore
page/stage, including UNKNOWN in All. Claims count is null with availability=false;
requested claim-derived filtering returns explicit CLAIM_FILTER_UNAVAILABLE (503).
No fake claim zero or provider code inference. Detail returns ordered charges and
provider totals separately from internal customerId. History paginated separately.
Domain errors map exhaustively through one feature-local application map; unexpected
errors use existing global envelope/no-store. Swagger DTOs generate OpenAPI/SDK.
Existing Customer/Sync data and source mapping representation remain unchanged.

## 10. Test-first and migration verification plan

1. RED Domain tests for strict fields, decimals, weight/kind/stage, snapshots,
   four charge states, ownership and stage/version decisions; implement GREEN.
2. RED migration/schema tests; create forward SQL and Prisma mapping. Verify
   real CHECK conkey/convalidated/exact sets/mutation sensitivity and valid/invalid
   inserts, FKs, code/UUID, nonunique tracking, money, charge/history uniqueness,
   indexes and staged/repeated migration preserving Customer/Sync fixtures.
3. RED binding tests; implement narrow session, processor and provider operations.
   Use real fenced engine and worker role for idempotency, missing/empty/invalid
   charges, repeated codes/order changes, unchanged row identity, new versions,
   simultaneous source updates, stale lease/generation, durable reconnect,
   forced fee/history SQL failure rollback and actual business-column denial.
4. RED HTTP tests; wire bounded read adapter/service/DTO/controller and regenerate
   contracts. Test authentication, invalid query/UUID, foreign/missing 404,
   owner/search/stage pagination/counts, literal search, monetary strings,
   ordered charges/history and unavailable claims.
5. Run frozen install, shared build prerequisite, targeted suites, format:check,
   docs:check, preflight:check, lint, test:lint, contracts:generate/check,
   migration tests and sh scripts/quality-docker.sh, relevant API/Sync integration
   and fresh final-head hosted Preflight/Foundation. Record every actual failure.
6. Independent final review per implementation workflow §8, resolve blocking P1/P2,
   full diff/registry/history/secret check, push scoped PR with exact metadata.
   Wait for required final-head gates; no merge or deployment.

## 11. Plan readiness

Read-only inspection and scoped reuse review precede implementation. Close merged
049 in the first commit, retain its history. Freeze this snapshot after Prettier
and raw SHA-256; keep task and eventual PR bound to this revision. Material changes
require a new immutable revision before affected implementation. Execution evidence
belongs in task, not this snapshot. No owner approval gate is required.

## 12. PLAN ISSUES and deferred dependencies

No blocking core ownership issue. Real provider codes, authorization, identity and
fee completeness, claim semantics and claim partial index remain deferred until
official provider contract review. Claim queries explicitly unavailable. No actual
Uniship contract is inferred from synthetic fixtures. Customer storage cleanup is
separate and non-blocking. Prefix decision recorded above resolves unspecified
code naming for this implementation; do not represent it as owner attestation.

## Delta from v1 — independent draft review

Four draft P2 findings require explicit corrections before further implementation:

1. Model the actual Shipment root and encapsulated Charge children, not only a
   proposal DTO. Root hydration receives the persisted identity/owner/provider and
   Nexora-owned state plus ordered current charge children under the source/root
   transaction locks. Creation requires trusted owner, with DB ID/code unassigned
   until persistence. hydrate/create, applyProvider, snapshot and operation form
   the narrow lifecycle. No identity/business setters; snapshots and children are
   copied. Provider operation still only writes the approved field set; no generic
   Aggregate save. Missing fees preserve actual hydrated children; complete fees
   reconcile current positions and retain unchanged child identities.
2. Execute the real SyncRepository/Shipment binding as authenticated nexora_sync,
   not only direct SQL permission probes. Reuse the signed disposable cluster
   launcher with an additional Shipment worker suite. It compiles existing packages
   and invokes the same genuine Shipment integration fixture using the signed
   cluster's supplied synthetic password. Only this token-verified owned-cluster
   path may provision/rotate the worker role; normal shared-cluster integration
   never guesses/rotates worker credentials. Runtime registry remains empty.
3. Strengthen schema oracle to exact table/column conkey, convalidated and closed
   membership expression, actual DDL mutation/rollback sensitivity, real FK delete
   actions/source uniqueness/indexes and valid/invalid writes. Preserve an actual
   owner Customer association under provider updates, not just NULL linkage.
4. Swagger models actual integer/default/bound semantics, closed enum/null claim
   count, and read projections; generated SDK follows. Count unavailability is
   null, never a nullable string or invented numeric zero.

Also distinguish optional normalized providerChangedAt (history-only reported
stage-change time) from providerUpdatedAt (root source update time). Never derive
one from the other or from local observation. Omitting the stage time writes NULL
in history. Existing root providerUpdatedAt remains provider-owned nullable data.
This additive normalized fixture contract does not establish real Uniship semantics.

The v1 raw digest 632298b8bbc2f3a1a12e9131141e1eb9304137dec485cb95e212115f91f4239e
is preserved. Its high-level ownership, fee semantics, roles, APIs, no-activation
boundary and acceptance strategy remain. The corrections clarify actual Aggregate
hydration, required physical verification and transport types. Canonical Docker
Bookworm remains mandatory; local PostgreSQL17.11 Alpine is explicitly separate
fast-loop evidence after host VFS ENOSPC, never a replacement canonical PASS.

## Delta from v2 — P2 internal Shipment code convention

Review5901710642 on PR47 identified an internally consistent but incorrect prefix.
The current user request selects SHP000001. V2 recorded VD000001 as an implementation
decision, explicitly not an owner approval; retain v1/v2 bytes and that historical
statement. This revision supersedes that prefix only, without retroactive approval.
Previous final-green HEAD919d69d and its CI remain historical, not verification of v3.

### Read-only impact matrix

| Path                                                                           | Inspected behavior                                                   | Exact planned change                                                                                                                                    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| packages/database/prisma/migrations/20261113000000_shipment_core/migration.sql | next_shipment_code emits VD via BIGINT sequence/lpad                 | Change only prefix literal to SHP                                                                                                                       |
| apps/api/src/shipment/domain/shipment.ts                                       | Single hydrate code policy requires VD and six digits                | Require SHP and six-or-more digits; preserve all other invariants                                                                                       |
| apps/api/test/shipment/domain.test.cjs                                         | Two VD hydration fixtures                                            | Correct fixtures; add accepted/rejected code boundaries and full-state equality                                                                         |
| apps/api/integration/fixtures/shipment-schema.cjs                              | Real migrated schema oracle expects VD                               | Require SHP; preserve physical invariants                                                                                                               |
| packages/database/test/shipment-sql.mjs                                        | Signed disposable native worker suite                                | Assert fresh first/next, cross-owner/provider global allocation, concurrent clients, UNIQUE, duplicate tracking, million boundary and restricted grants |
| apps/api/integration/shipment-integration.test.cjs                             | Real Sync ingestion and three owner GETs                             | Explicit generated code assertion and list/detail equality; history remains covered                                                                     |
| docs/domains/shipments.md; docs/architecture/database.md                       | Current authoritative VD convention                                  | SHP, global minimum-six-digit contract, gaps allowed and separate tracking/source identity                                                              |
| packages/database/prisma/schema.prisma                                         | dbgenerated next_shipment_code default                               | Inspect, no change                                                                                                                                      |
| packages/database/test/migration.mjs                                           | Forward/repeat/drift and legacy preservation                         | Re-execute unchanged harness                                                                                                                            |
| packages/database/scripts/provision-runtime.mjs                                | Worker-only sequence USAGE/function EXECUTE; business-column denials | Inspect and exercise unchanged; no widening                                                                                                             |
| Active task050 and this new snapshot                                           | v2 metadata and historical evidence                                  | Record v3 plan/digest, P2 correction and exact RED/GREEN/final-head evidence                                                                            |

Search used repository-wide rg for VD, VD000001, ^VD, SHP000001,
shipment_code_seq and next_shipment_code, excluding generated/dependency outputs.
Only the listed runtime/test/current-document paths conflict. ADR011 has no code
prefix contract and remains unchanged. V1/v2 are historical exceptions.

### Focused reuse audit

| Field                    | Decision                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Shipment internal code generation, persisted hydration and regression tests                                                                                           |
| Existing implementations | Existing next_shipment_code SQL/sequence, ShipmentAggregate.hydrate; signed shipment-sql and genuine Shipment HTTP/Sync fixtures; Customer next_customer_code pattern |
| Domain owner             | Shipment owns internal business identifier; PostgreSQL owns allocation; carrier tracking/source identity remain separate                                              |
| Reuse alternatives       | Reuse existing generator/policy/harness versus application generator, new shared validator or compatibility alias                                                     |
| Selected approach        | Two production token changes only; extend existing tests; no generator/validation framework                                                                           |
| Rationale                | Match requested prefix while retaining atomic concurrent allocation and existing Domain ownership                                                                     |
| Risks                    | Previously applied migration checksum/data incompatibility; hidden VD fixtures; over-six-digit truncation; accidental role widening                                   |
| Verification             | Unmerged safety gate; Domain RED/GREEN; real fresh/concurrent/boundary SQL plus existing worker/HTTP/migration/Sync suites; raw snapshot hashes and final-head CI     |

### Contract, alternatives and migration safety

SHP000001 is the first code; 2/123/999999/1000000 render SHP000002, SHP000123,
SHP999999 and SHP1000000. The numeric width is a minimum, not a maximum.
shipment_code_seq remains one global BIGINT NO CYCLE sequence per Nexora instance,
never reset per owner/provider/account/calendar. Rollback/consumption gaps are
acceptable; no gapless promise. PostgreSQL defaults generate codes and UNIQUE
protects them. Provider input cannot set/mutate code. Tracking may repeat and Sync
continues matching source_identity_id, never internal code.

Reject retaining VD or accepting both prefixes: they contradict the selected current
convention and mask stale fixtures. Reject application generation, scoped/reset
sequences and new columns/tables/enums: unnecessary and weaken current invariants.
Reject widening permissions or changing identity/source keys to accommodate tests.

Safety gate executed before edits: REST PR47 is open/unmerged on919d69d; origin/main
is055dfcc and git ls-tree shows no Shipment migration on main. No running local
containers or known persistent deployment of this task migration exists in this
workspace; prior test clusters were owned and removed. No production/staging/user
data is accessed. Correct only this new unmerged task-owned migration. If evidence
of an already-applied persistent deployment appears, stop and record a compatibility
PLAN ISSUE rather than alter it silently. All merged historical migrations remain
immutable. Fresh disposable migrated databases verify the corrected SQL.

### Verification matrix and execution sequence

1. Freeze this twelve-section superseding v3, format with Prettier3.6.2 before raw
   SHA-256 and bind task/PR; verify original v1/v2 digests unchanged.
2. RED Domain: accept SHP000001/SHP000123/SHP999999/SHP1000000; reject VD, short,
   suffix, empty/malformed/whitespace; snapshot equality on hydration. Add code
   mass-assignment rejection while preserving other tests.
3. RED native SQL on a signed owned disposable cluster: first insert SHP000001,
   next increasing, multiple owners/providers on one sequence, parallel distinct
   connections, duplicate tracking and UNIQUE23505, 999999/1000000 formatting.
   Boundary setval only in the suite's newly created owned database. Assert worker
   EXECUTE/USAGE versus app/PUBLIC denial and no direct code/customer mutation.
4. Change SQL prefix and the single Domain regex, then run targeted GREEN. Correct
   existing schema fixtures and explicit real HTTP list/detail generated-code
   assertions; run genuine Shipment restricted-worker integration, native SQL,
   migrations, existing Sync regression and API tests.
5. Synchronize only conflicting canonical docs; run pinned format/docs/preflight,
   lint/test:lint, contracts:check, boundaries and canonical Docker. Preserve all
   FAILs including prior ENOSPC; host Alpine proofs remain distinct from canonical
   Bookworm Docker verification. Never claim unexecuted local Docker PASS.
6. Independent review per workflow8, inspect focused diff and immutable hashes,
   commit/push without force to PR47. Bind exactly five v3 metadata fields using
   REST API. Wait fresh Preflight, Sync Targeted and Foundation on exact final HEAD;
   preserve historical runs and update final-green provenance in PR description
   without a SHA-only task commit. Follow bounded debug policy; no merge/deploy.

All original Aggregate/charges/history/decimal/version/fence/owner/auth contracts,
API route/schema/SDK shapes, source/customer mapping and least-privilege grants
remain intact. No provider length, UI, ingress, smoke deadlines, live API fetching,
production registration or activation change. Documentation Impact REQUIRED;
canonical owners for this delta are shipments.md and database.md plus task050.
