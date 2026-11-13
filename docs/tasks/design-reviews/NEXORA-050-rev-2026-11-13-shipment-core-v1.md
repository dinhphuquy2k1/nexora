# NEXORA-050 — Shipment Backend Core

## 1. Task metadata and classification

Task ID: NEXORA-050
Classification: SIGNIFICANT
Plan revision: rev-2026-11-13-shipment-core-v1
Reviewed baseline: 055dfccb5f7feae36af41209fd6380916081f711
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

Recorded code decision: use VD plus at least six sequence digits (VD000001),
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
