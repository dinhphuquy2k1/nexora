# NEXORA-051 — Shipment list data

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-051
Classification: SIGNIFICANT
Plan revision: rev-2026-11-14-shipment-list-data-v2
Reviewed baseline: e8d5821a370ff1d24424eef18ee6579084e7c943
Branch: feat/shipment-list-data
Design Snapshot: docs/tasks/design-reviews/NEXORA-051-rev-2026-11-14-shipment-list-data-v2.md
Design SHA-256: a0540d2b5f0f486a508554b1b6ed938c1a90ff71fa6447a3d09a459da9b75935

## 2. Requirements and scope

Deliver D1–D5 and D7–D9 of the current owner request (D6 withdrawn): provider-reported warehouse milestones,
ordered parcel items and bounded Retail read summaries. Shipment remains the
Aggregate Root, with provider-owned Charge/Milestone/Item children (including exact per-product value/currency); stage history
remains an append-only separate observation. No columns added to shipments. No UI,
Nexora write commands, provider adapter/registration, claims feature, advanced
server filters, provider_attributes, trigram index, Customer/Carrier/Sync engine
change, new worker/framework or dependency. Production registration stays empty.

## 3. Canonical owners and read-only inspection

AGENTS/routed AI rules, TASK_WORKFLOW1.4–1.7/2, IMPLEMENTATION_WORKFLOW, ADR008/009/011,
Shipment/database/API/Sync/testing documents and all requested code/test paths were
inspected. Searches covered ShipmentProviderInput/ProviderOperation/ShipmentState,
shipmentRecord, date/text, persistShipmentProvider, grants, migration inventory,
FOR UPDATE, projections, vocabulary AST/parity and HTTP503. Baseline matches the
request: read actor lock is exclusive; current root persistence always updates
last_synced_at/updated_at for APPLIED operations, including fee-only patches.
Reuse that timestamp behavior for new child-only changes, without editing it.
NEXORA-051 is unused in task inventories and open PRs. Close merged045 first;
repair its two inbound links without touching historical Evidence/snapshots.
Canonical delta owners are ADR011, shipments.md, database.md, api-contract.md and
testing.md. Documentation Impact REQUIRED. No new ownership/authorization approval
is inferred; this task implements the owner's explicit selected storage contract.

## Reuse audit

| Field                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Shipment Milestone/Item children, provider collection operations, restricted persistence and Retail list projections                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Existing implementations | packages/shared/src/shipment/index.ts; shipment/domain/shipment.ts shipmentRecord/text/date/DecimalValue/ShipmentCharge/create/hydrate/applyProvider; shipment.mapper.ts; shipment-sync-domain.binding.ts upsert/IS DISTINCT/delete-tail; shipment-provider.persistence.ts root timestamps; shipment.adapter.ts page/count/projections and actor lock; shipment DTO/controller/error map; database schema/migration/provision-runtime/native SQL/signed worker harness; genuine Shipment/Sync tests and exact schema oracle; vocabulary lint AST catalog |
| Domain owner             | Shipment owns root/children/invariants and projection semantics; database package owns SQL/schema/grants; existing Sync engine owns authorization/version/lease transaction; Shared owns approved cross-package milestone codes; transport owns Swagger/SDK                                                                                                                                                                                                                                                                                              |
| Reuse alternatives       | root columns for carrier-specific catalogues; milestones derived from history; root fee-summary columns; per-root queries/N+1; JSONB for visible columns; new generic child/launcher/validation framework; existing feature-local patterns                                                                                                                                                                                                                                                                                                               |
| Selected approach        | Two forward child tables only; reuse strict feature parser and immutable child lifecycle, keyed provider upserts in existing fenced tx; unchanged FOR UPDATE API actor reads excluding existing FOR SHARE worker locks; exactly3 page-id batch queries; common feature projection helpers for list/detail; existing error mapper/generators and signed real-PG harness                                                                                                                                                                                   |
| Rationale                | Preserve row identity, authority and exact values; the existing read/write exclusion preserves coherent projections while worker jobs remain concurrent; bounded queries avoid N+1; closed vocabulary gives exact physical parity; no speculative infrastructure                                                                                                                                                                                                                                                                                         |
| Risks                    | partial collection writes, lost IDs, stale leases, widening grants, date inference, cross-owner reads, count inconsistency if batches escape the locked transaction, accidental worker-concurrency changes, hidden N+1, item money-pair/precision/finite validation, nullable/schema/SDK drift, repeat migration and legacy preservation, runtime migration counter                                                                                                                                                                                      |
| Verification             | Six test-first groups: Domain; genuine schema/mutation/upgrade; actual role grants; real Sync child reconciliation/rollback; separate-connection existing read/worker exclusion and concurrent-worker characterization with bounded polling; real HTTP/contract/query-count tests. Then pinned static/contracts/quality, independent SIGNIFICANT review and fresh final-head hosted gates                                                                                                                                                                |

## 5. Alternatives and trade-offs

Reject direct shipments columns for values shared by only some carriers; derived
warehouse timestamps from history; root denormalized fee-summary columns; per-root
queries; JSONB for visible column data; summing currencies/money; delete/reinsert
children; broad UPDATE grants; generic repositories/child bases or launcher
frameworks. Use the existing explicit feature patterns, preserving meaningful
identity and shared invariants. JSONB for single-carrier values neither filtered
nor column-displayed is approved as a future option only, not implemented.

## 6. Domain modeling and strict public commands

Shared ShipmentMilestoneCode declares ORIGIN_RECEIVED, ORIGIN_DISPATCHED,
DEST_RECEIVED, DEST_DISPATCHED in that canonical display order, as const with
ShipmentMilestoneCodeValue. Add milestoneCode (and snake alias) to existing lint
catalog and AST coverage. No TS/Prisma/PostgreSQL enum.

ShipmentProviderInput adds two optional authoritative snapshots. milestones has
complete:true and entries (maximum4), each with unique valid milestoneCode,
required occurredAt using the existing strict date parser, optional locationName
and providerLabel using text256 or NULL. items has complete:true and lines
(maximum32767), required nonblank-after-trim text512 name, optional nullable
integer quantity0..2147483647; lineNo is index+1. Unknown keys/runtime shapes,
invalid dates/codes/duplicates/limits/counts reject the entire proposal using the
existing VALIDATION_ERROR path. Reuse exact scalar policies inside Shipment.

Absence preserves each collection independently. Complete snapshots reconcile by
milestoneCode or lineNo, complete empty clears; invalid/partial snapshots never
partially mutate root or any child. Extend ProviderOperation, ShipmentState and
normalized typed copies; create/from/snapshot children with DB-owned UUID and
retained ID for an unchanged key, immutable outward copies. Construct all proposed
children before changing root/state. Mapper hydrates all3 collections under locks,
canonical milestone order and ascending item lineNo; no partial fake Aggregate.
No provider assignment of identity/customer/business fields, no derived reported
times, totals, rates or currencies. Existing fee/history/source behavior remains.

## 7. Forward schema, roles and persistence contracts

New migration20261114000000_shipment_milestones_items, BEGIN/COMMIT, adds only:

- shipment_milestones: DB UUID PK; shipment_id UUID NOT NULL FK shipments CASCADE
  DELETE/NO ACTION UPDATE; milestone_code VARCHAR32 NOT NULL; occurred_at
  TIMESTAMPTZ(3) NOT NULL; location_name/provider_label VARCHAR256 nullable;
  uq_shipment_milestones_code(shipment_id,milestone_code); exact validated
  chk_shipment_milestones_code with the4 canonical values.
- shipment_items: DB UUID PK; same parent FK; line_no SMALLINT NOT NULL;
  name VARCHAR512 NOT NULL; quantity INTEGER nullable; unit_value NUMERIC(18,2) and currency CHAR3 nullable as a validated nonnegative finite pair; unique parent/line;
  checks line_no>=1, length(btrim(name))>0, quantity NULL or>=0.

No indexes beyond PK/UNIQUE, which cover shipment_id lookups. Add camelCase mapped
Prisma models/relations; old migrations and shipments columns remain unchanged.
Change only runtime migration assertion14→15, retaining stored_files0 and all
other assertions. Migration harness seeds actual existing Shipment/fees/history,
applies new migration, checks exact preservation, new children, repeat and drift.

API role SELECT only on both tables. Worker SELECT/DELETE plus column INSERT of
shipment_id/key/payload; UPDATE payload only: milestone occurred_at/location_name/
provider_label, item name/quantity/unit_value/currency. No id/parent/key UPDATE, no business-column
widening. Preserve repeat column ACL revocation/regrant and existing role flags.

Binding reuses same findUniqueOrThrow with all children, and existing outer Sync
transaction/final fence (no engine edits). After charges, upsert each milestone
by parent/code and item by parent/line, UPDATE payload only WHERE IS DISTINCT FROM;
delete absent milestone codes or item tail only for explicit complete snapshots.
Never bulk delete/reinsert; unchanged rows keep id/xmin. SQL/history/final-fence
failure rolls root, all children and Sync outcome back together. Root timestamps
continue updating through unchanged persistShipmentProvider for child-only apply.

## 8. Read locking, security and concurrency

Shipment API reads lock the owner's users row FOR UPDATE. The Sync worker locks it FOR SHARE through public.sync_lock_user() in shared authorization mode, so reads and worker writes exclude each other while worker jobs may run concurrently. Page, counts and child summaries are read inside that single locked transaction. Future Nexora write commands on shipments or child tables must lock the owner's users row FOR UPDATE. A REPEATABLE READ read snapshot may replace the exclusive read lock only after measured contention, in a separate task.

D6 is withdrawn. ShipmentAdapter.transaction is preserved byte-for-byte, including
its ACTIVE recheck and FOR UPDATE query. All3 D7 child batch queries remain inside
that same transaction with page/count. No Sync engine, function, existing migration,
worker users privilege, lock upgrade or isolation-level change. No network under
locks; preserve owner resolver and ADMIN no-bypass.

Characterize the existing correct behavior in genuine PostgreSQL with separate
connections, explicit barriers and bounded pg_blocking_pids polling, no fixed
sleeps: (a) held sync_lock_user blocks a list read until commit; (b) held actual
API read blocks sync_lock_user; (c) two same-user sync_lock_user transactions do
not block each other; (d) inactive actor is rejected. These lock tests preserve
existing behavior and should PASS on baseline, not manufacture a RED by changing
the forbidden transaction function. New summary/HTTP behavior retains RED/GREEN.
Isolate cases and settle all prior transactions/waiters in finally before the next
case; lock-queue fairness must not turn a queued API UPDATE lock into a false
worker-SHARE concurrency failure.

## 9. API, projection and compatibility matrix

Keep list page/count SQL/filter/pagination/stats semantics, adding root projection
originWarehouse, weightKg exact string, packageCount/itemCount, declaredValue exact
string and declaredCurrency (nullable). Nonempty pages run exactly3 batch queries
in the same read transaction using shipment_id=ANY(bound page UUID array): charges
grouped by code/count with amount::text/currency only when count1; milestones;
items min(line_no), count and joined first name. Empty pages skip all3. Assemble
per-root Maps in TS, never per-shipment SQL. Query count is independent of page size.

chargeSummary has unitPrice/domesticShipping state NONE/SINGLE/MULTIPLE, amount
and currency nullable: zero means NONE/nulls; exactly1 means SINGLE/exact values;
multiple means MULTIPLE/nulls regardless of currencies. Flags indicate existence
of INSURANCE/COUNTING/WOOD_PACKING/BUBBLE_WRAP rows, without adding amounts.
These4 service flags are provisional fee-row projections until official API review.
Feature-local nonpersisted summary-state constants may be shared between read port
and DTO; they are not new persisted/shared Domain statuses.

milestoneSummary contains4 nullable ISO reported times, and destWarehouse solely
from DEST_RECEIVED.location_name. itemSummary contains firstName of lowest lineNo
or NULL and lineCount>=0; never sum quantity or derive provider itemCount.
Detail inherits every summary field and returns full milestones in D1 order and
items in ascending lineNo. Reuse one charge/milestone summary policy for list and
detail. Detail loads each raw child set once; charge window counts can supply the
same count-based helper as list grouped rows, without extra summary queries or
leaking helper columns in API arrays. No full Aggregate hydration for reads.

New DTOs Amount/Charge/Milestone/Item summaries and Milestone/Item views declare
exact enums, integer bounds, nullable UUID/text/date formats and decimal strings
with the existing exact-value description. CLAIM_FILTER_UNAVAILABLE alone changes
503→422 in exhaustive mapper/controller Swagger, same code/message/envelope.
Regenerate committed OpenAPI/SDK. Additive fields plus this explicit status change
require same-revision contract rollout; no existing route/auth/query shape changes.

## 10. Test-first execution and verification matrix

1. Expected RED Domain tests for valid collections/current rejection, then invalid
   shapes/codes/date/size/name/count/extra fields, absent/empty/immutable/id behavior.
   Add Shared vocabulary and implement schema/Domain/mapper as a coherent compiled
   unit; Shared/Database/API build prerequisites are genuine, no transpile-only
   substitute for verification. Keep expected RED results as FAIL history.
2. Genuine schema RED before tables; extend exact conkey/convalidated/value-set
   oracle, actual rolled-back widen/NOT VALID/wrong-column mutations, valid/invalid
   writes, unique/FK CASCADE, no extra indexes and legacy upgrade/repeat/drift.
3. Native SQL permission RED after schema but before new grants, then GREEN with
   real restricted API/worker roles and denied UPDATE keys/id/parent. Signed owned
   cluster only; no shared/production credentials/volumes or role rotation.
4. Genuine Sync creation/reconciliation RED before child persistence, then GREEN
   for changed-only writes/xmin, omitted preserve, complete empty, invalid atomicity,
   child-only root timestamps, SQL failure and expired final lease rollback.
5. Read/HTTP RED for absent summaries and503, then bounded projections/contracts
   GREEN. Preserve ShipmentAdapter.transaction exactly. Characterize four genuine
   existing-lock cases (worker SHARE blocks read UPDATE and reverse; two worker
   SHARE transactions proceed; inactive user rejected) using distinct connections,
   bounded waits/lock polling and explicit barriers without fixed sleeps. Keep all
   three page-id summary queries inside the existing locked page/count transaction.
   Verify page-size-independent query count, NONE/SINGLE/MULTIPLE, flags, nullable
   milestones,0/1/many items, detail order, ACTIVE/owner isolation and422.
6. Run Shipment units, genuine PostgreSQL integration including Shipment/Sync,
   native roles, migration harness; pinned format/lint/typecheck/contracts/docs/
   preflight/test:docs/test:preflight/test:lint, boundaries and quality where resources
   permit (otherwise honest NOT RUN reason). Full canonical integration/quality on
   hosted Foundation remains mandatory. Preserve every unexpected FAIL and stop
   per current request; expected REDs are intentional. No assertion/tolerance bypass.
7. Independent SIGNIFICANT code review per workflow8; scoped diff, immutable hashes,
   exact five-field binding, commit/push PR title as requested. Wait Preflight,
   Sync Targeted and Foundation4–10 on exact final HEAD. Unrelated6–10 failure
   permits one failed-job rerun only, retaining both; step8 scriptLoadFailures>0
   diagnostic goes to issue44; acceptance startup diagnostic is reported verbatim.
   Repeated/other failures stop; runtime migration failure rechecks D2. No merge.

## 11. Plan readiness and Documentation Impact

Read-only audit and this recorded scoped plan precede implementation; current
owner request settles D1–D5, D7–D9 and storage placement, and withdraws D6. No invented GitHub approval or
new owner attestation is required. Format snapshot with Prettier3.6.2 before raw
SHA-256; keep its bytes immutable and bind task/PR revision/path/digest. Material
changes require a superseding plan before affected code, not silent scope growth.
Execution/CI logs belong in task/PR compact Evidence, not this snapshot.

Update ADR011 exact Storage placement rule; shipments.md two-table schema,
three-collection authority, read contract,422 and preserved exclusive API read/shared worker actor protocol;
database.md schema/ACL/upgrade; api-contract.md DTO/status/lock changes;
testing.md genuine/schema/permission/concurrency/query tests. Extend Uniship's7
checks to10 (warehouse milestones/destination name, item list, services fee-vs-flags).
No official provider authorization or real code dictionaries are inferred.

## 12. PLAN ISSUES and deferred scope

No unresolved architectural ownership issue: current owner request explicitly
selects both child tables and withdraws D6, retaining the existing read/worker lock protocol. Milestones are provider
reported, never history-derived. UI, Nexora writes, Uniship registration/adapter,
claims feature, advanced filters, JSONB/trigram and Customer/Carrier/Sync engine
changes remain excluded. Source Customer cardinality/storage and prior colour/FU2
visual follow-ups are preserved. Test prerequisites/resources are availability
facts to record honestly, not permission to weaken tests or touch real deployments.

## Plan

1. Close merged045 in first commit; preserve history and fix its inbound links.
2. Record this design and immutable snapshot; synchronize selected storage docs.
3. Domain/schema/role/Sync/read+lock+HTTP test-first groups, preserving RED/GREEN.
4. Generate contracts, synchronize docs and execute all required checks.
5. Independent review, scoped diff, publish PR and verify exact final-head CI.
6. NEXORA-051 is closed by the next task after merge under §1.7; no self-merge.

## Acceptance criteria

- [x] Two forward child tables/constraints/parity/upgrade, no shipments columns.
- [x] Immutable validated children and authoritative collection reconciliation.
- [x] Restricted roles and fenced atomic Sync behavior.
- [x] Preserved API FOR UPDATE/worker FOR SHARE exclusion and bounded consistent list/detail summaries.
- [x] OpenAPI/SDK422 contract and canonical docs synchronized.
- [x] Local verification and independent review without blocking P1/P2.
- [x] Final-head hosted Preflight/Sync Targeted/Foundation.
- [x] Owner review and merge decision.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Storage placement, two child tables, authoritative snapshots, scoped grants, preserved FOR UPDATE API reads/shared worker exclusion, Retail summary/detail contracts,422 unavailable claims and verification procedures.

### Canonical owners

- docs/decisions/shipment-domain-data-ownership.md
- docs/domains/shipments.md
- docs/architecture/database.md
- docs/architecture/api-contract.md
- docs/operations/testing.md

### Documentation verification

Pinned format/docs/preflight, contracts generation/check and scoped review.

## Evidence

| Claim                 | Evidence                                                                                                                                                                                                                                                                                                      | Date       | Result |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and ID audit | origin/main e8d5821a370ff1d24424eef18ee6579084e7c943; docs/tasks inventory and open PRs have no NEXORA-051; branch feat/shipment-list-data; first commit e6685b0 closes045 and fixes its two inbound links; node scripts/docs-check.mjs exit0; read-only baseline actor lock/timestamp behavior matches D5/D6 | 2026-11-14 | PASS   |

## PLAN ISSUE — SHIPMENT_READ_WRITE_ACTOR_LOCK_MODE

Resolved by owner decision: D6 withdrawn (plan v2).

Historical stop: the baseline mismatch was found before production/test/migration
changes. The owner now requires preserving API FOR UPDATE and worker FOR SHARE,
with the consistency characterization cases described above. No Sync engine or
privilege change is authorized. Historical inspection evidence below remains intact.

The initial audit correctly identified ShipmentAdapter FOR UPDATE and unchanged
root timestamp behavior, but did not trace restricted-worker authorization locks.
Correction to that initial audit and immutable v1 section8 assumption:

- apps/api/src/worker/sync-worker.module.ts:64–68 constructs SyncRepository with
  authorizationLocks="shared" in production.
- apps/api/src/sync/infrastructure/sync-job.repository.ts:79–85 selects
  public.sync_lock_user() in that mode, even when connection() requests write mode.
- Merged migration20261103000000_sync_read_locks/migration.sql:7 implements
  sync_lock_user as SELECT users FOR SHARE, not FOR UPDATE.
- The genuine Shipment integration fixture also explicitly selects "shared" at
  lines155–166, so an exclusive/admin-only test would miss the production path.

Current Shipment reads FOR UPDATE conflict with worker FOR SHARE. The withdrawn
D6 proposal for API FOR SHARE was rejected because it permits worker writes to
overlap page/count/child reads and invalidates the promised consistency.
The requirement that all writers already hold users FOR UPDATE is false on the
reviewed baseline. Resolving that protocol needs a revised authorized design/scope;
current scope forbids Sync engine changes; the owner resolved this by withdrawing D6. Do not edit merged migrations, widen
worker users UPDATE grants or add a late lock upgrade as a workaround.

Immutable v1 bytes/digest remain preserved as the initially recorded plan; its
incorrect existing-writer assumption is explicitly superseded by this finding,
not silently rewritten. V1 is not an implementation plan for D6. Superseding v2 records the owner
resolution before affected implementation; the transaction function remains unchanged.

This is executed read-only source inspection, not a PostgreSQL concurrency test
or independent approval. Domain/schema/permission/Sync/lock/HTTP RED/GREEN, full
verification, PR binding and hosted CI are NOT RUN for NEXORA-051. Only baseline
Shared/Database/API build prerequisites passed. Status remains IN PROGRESS,
Capability PLANNED, Verification NOT VERIFIED.

| Claim                           | Evidence                                                                                                                                                                                                                                                                                                                                                                                                           | Date       | Result |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Baseline writer-lock assumption | Independent read-only reviewer shipment_list_review and parent nl/rg inspection of the4 paths above; HEAD 69db22ae1ea56f48fd9ef18310c6b72e502c57f1 (production source unchanged from e8d5821a370ff1d24424eef18ee6579084e7c943); observed2026-11-14T08:18:15.498249+00:00 UTC; expected existing writer FOR UPDATE, actual production worker FOR SHARE. Source consistency assumption FAIL; no runtime test claimed | 2026-11-14 | FAIL   |
| baseline-shared prerequisite    | npx --yes pnpm@10.34.6 --filter @nexora/shared build; HEAD 69db22ae1ea56f48fd9ef18310c6b72e502c57f1; 2026-11-14T08:13:55.177461+00:00–2026-11-14T08:13:58.894003+00:00 UTC; exit0; baseline build only, not feature verification                                                                                                                                                                                   | 2026-11-14 | PASS   |
| baseline-database prerequisite  | npx --yes pnpm@10.34.6 --filter @nexora/database build; HEAD 69db22ae1ea56f48fd9ef18310c6b72e502c57f1; 2026-11-14T08:13:58.955368+00:00–2026-11-14T08:14:06.305186+00:00 UTC; exit0; baseline build only, not feature verification                                                                                                                                                                                 | 2026-11-14 | PASS   |
| baseline-api prerequisite       | npx --yes pnpm@10.34.6 --filter @nexora/api build; HEAD 69db22ae1ea56f48fd9ef18310c6b72e502c57f1; 2026-11-14T08:14:06.345600+00:00–2026-11-14T08:14:12.606943+00:00 UTC; exit0; baseline build only, not feature verification                                                                                                                                                                                      | 2026-11-14 | PASS   |

## Owner revision — D6 withdrawn

Owner instruction resolves SHIPMENT_READ_WRITE_ACTOR_LOCK_MODE by preserving the
existing exclusive API read lock and shared worker lock, retaining all D7 queries
in that transaction. V2 is recorded and implemented; v1 bytes/digest remain immutable.
The owner supplied the complete item-value/currency contract below; v2 includes it before implementation.

### Item value/currency owner contract (v2 delta)

Item unit_value is the carrier-reported declared value of one product unit,
not shipment_charges.UNIT_PRICE (freight unit price) or shipments.declared_value
(whole parcel declared value). Never multiply by quantity, sum or reconcile them.

Add shipment_items.unit_value NUMERIC(18,2) NULL and currency CHAR(3) NULL;
chk_shipment_items_value_pair requires both NULL or both present, \_value_finite
rejects NaN, \_value_nonneg requires nonnegative, \_currency requires NULL or
^[A-Z]{3}$. Prisma unitValue Decimal? @db.Decimal(18,2) @map("unit_value") and
currency String? @db.Char(3). Worker INSERT/UPDATE payload also includes both
columns, unchanged API SELECT-only and key/id/parent denial.

items.lines allows only name,quantity,unitValue,currency. Missing/null unitValue
means NULL; present uses existing DecimalValue.parse(18,2), then rejects a leading
minus in its normalized result as weightKg does. Missing/null currency means NULL;
present uses existing currency(). Both must be NULL together or present together.
Reuse this same validation in ShipmentItem.from hydration. Provider upsert includes
name,quantity,unit_value,currency in SET and IS DISTINCT comparison. No other money
logic. List itemSummary remains firstName/lineCount without prices. Detail items
include exact unit_value::text unitValue and nullable currency; DTO/OpenAPI/SDK
reflect nullable exact strings, with the existing decimal no-arithmetic description.

Additional RED/GREEN cases cover valid/missing/null pairs, lone values, negative,
number inputs, precision/scale overflow, malformed currency; real SQL4 named
constraints, actual worker INSERT/UPDATE and API denial; Sync add/change/clear pair
and unchanged-row no-write; HTTP exact1234567890123456.78 and NULL. Schema fixture
checks exact table/column/validated CHECK definitions for these4 non-vocabulary
constraints as well as actual writes/mutation sensitivity. Uniship verification9
includes per-product value and currency when supplied.

## Worker permission verification — 2026-11-14

| Claim                                                                                                           | Evidence                                                                                                                                                                                                                    | Date       | Result |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Worker permission RED before child grants: permission denied for shipment_milestones (42501)                    | `node /tmp/nexora051-sql-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T09:29:53.448207+00:00–2026-11-14T09:29:55.891708+00:00 UTC; exit 1; local PostgreSQL 17.11 owned disposable cluster | 2026-11-14 | FAIL   |
| provision grant referenced non-existent column location (typo for location_name)                                | `node /tmp/nexora051-sql-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T09:30:08.299318+00:00–2026-11-14T09:30:09.985492+00:00 UTC; exit 1; local PostgreSQL 17.11 owned disposable cluster | 2026-11-14 | FAIL   |
| Grant corrected; worker test still references non-existent location in UPDATE (42703); unexpected FAIL, stopped | `node /tmp/nexora051-sql-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T10:40:03.811956+00:00–2026-11-14T10:40:05.732148+00:00 UTC; exit 1; local PostgreSQL 17.11 owned disposable cluster | 2026-11-14 | FAIL   |

Both new grants were checked column-by-column against the new migration. No GREEN result is claimed. The corrected run passed provisioning and milestone INSERT, then failed at the test UPDATE using `location`; further verification stopped.

## Column-name audit — 2026-11-14

Audited every modified and untracked file using the task column-name search, comparing SQL against the new migration and camelCase fields against Prisma mappings. Corrections (line numbers before formatting):

- packages/database/scripts/provision-runtime.mjs:215: milestone INSERT `location` → `location_name`; milestone UPDATE `location` → `location_name` (previous correction retained).
- packages/database/test/shipment-sql.mjs:241: milestone UPDATE `location` → `location_name`.

No other column-name mismatch found. Historical 42703 FAIL at shipment-sql.mjs:241 is retained in the Worker permission verification table above. Snapshot v2 is unchanged.

| Claim                                           | Evidence                                                                                                                                                                                                                                                            | Date       | Result |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Worker column authority after column-name audit | `node /tmp/nexora051-sql-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:14:18.601420+00:00–2026-11-14T11:14:20.645542+00:00 UTC; exit 0; real nexora_sync INSERT/UPDATE succeeds, parent UPDATE denied, API UPDATE/DELETE denied | 2026-11-14 | PASS   |

## Schema and Sync test-first evidence — 2026-11-14

| Claim                                                                                                                                                                                     | Evidence                                                                                                                                                                      | Date       | Result |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Schema and existing Shipment integration: 15 PASS / 0 FAIL                                                                                                                                | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:14:37.862002+00:00–2026-11-14T11:15:02.147693+00:00 UTC; exit 0 | 2026-11-14 | PASS   |
| New child reconciliation RED: missing persisted milestone (0 !== 1); unexpected cascade into existing tests due to new test mutating their shared root; 10 PASS / 6 FAIL including parent | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:15:28.558677+00:00–2026-11-14T11:16:04.618488+00:00 UTC; exit 1 | 2026-11-14 | FAIL   |

Stopped on unexpected failures outside column-name corrections. The new test was placed before the existing same-payload test and changed its shared root; that test then failed before establishing customer/internal-note setup, causing downstream failures. No assertion or production persistence changes were made to address this after the failing run. New test needs independent fixture state or relocation after the dependent existing tests before proceeding.

## Independent Sync child fixture

The new test now runs after the shared fixture group and owns a separate user,
Carrier connection, source key (children-UUID), repository lane and Shipment.
It reuses the file's existing owner/connection setup and makeRepo pattern; no
per-test owner helper exists. Assertions and existing tests are unchanged.

| Claim                                                  | Evidence                                                                                                                                                                                                                                                                      | Date       | Result |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| new sync test shared fixture state with existing group | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a; 2026-11-14T11:15:28.558677+00:00–11:16:04.618488+00:00 UTC; 10 PASS / 6 FAIL including parent; historical failure retained above                                                                               | 2026-11-14 | FAIL   |
| Valid isolated reconciliation RED                      | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a; 2026-11-14T11:20:32.152840+00:00–11:20:56.043196+00:00 UTC; all 14 existing child tests PASS; only new child test FAIL (milestones length 0 !== 1); aggregate parent also FAIL; total 14 PASS / 2 FAIL; exit 1 | 2026-11-14 | FAIL   |

## Binding GREEN and read-test gate

| Claim                                                                                                                                                                         | Evidence                                                                                                                                                                                    | Date       | Result |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Isolated child reconciliation and all existing Shipment tests: 16/16 PASS; key identity, exact value update/clear, unchanged child xmin and omission/empty semantics verified | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:21:17.947132+00:00–2026-11-14T11:21:45.162212+00:00 UTC; exit 0               | 2026-11-14 | PASS   |
| Claim status RED expected (503 vs 422); new batch-query fixture fails unexpectedly before query-count assertion: TypeError reading includes on undefined SQL text             | `node --test apps/api/test/shipment/read.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:21:37.730457+00:00–2026-11-14T11:21:38.161070+00:00 UTC; exit 1 | 2026-11-14 | FAIL   |

Stopped at the read-test gate: the new query fixture assumes every $queryRaw call receives a Prisma.Sql object; the unchanged transaction instead uses a tagged template (TemplateStringsArray). Thus sql.sql is undefined. This is not a valid batch-query RED and no production read/error change was made after this failure. The fixture needs to accept both existing query calling forms without changing assertions.

## Read fixture normalization and subsequent verification

The Shipment read test directory had no existing reusable dual-form query fake.
The new fake now normalizes TemplateStringsArray with Prisma.sql(strings,...values)
and accepts Prisma.Sql directly; no fake executeRaw exists. Production transaction
was not changed. Historical failure: new read test fake client handled only Prisma.Sql.

| Claim                                                                                                                                                                                        | Evidence                                                                                                                                                                                                           | Date       | Result |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| new read test fake client handled only Prisma.Sql                                                                                                                                            | `node --test apps/api/test/shipment/read.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:21:37.730457+00:00–2026-11-14T11:21:38.161070+00:00 UTC; exit 1                        | 2026-11-14 | FAIL   |
| Valid batch RED: 3 !== 6 queries; deliberate D9 service assertion also RED (503 vs 422); unchanged shutdown test PASS                                                                        | `node --test apps/api/test/shipment/read.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:30:43.481657+00:00–2026-11-14T11:30:44.227787+00:00 UTC; exit 1                        | 2026-11-14 | FAIL   |
| Build D7/D8/D9 implementation                                                                                                                                                                | `npx --yes pnpm@10.34.6 --filter @nexora/api build`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:31:39.866060+00:00–2026-11-14T11:31:47.555559+00:00 UTC; exit 0                       | 2026-11-14 | PASS   |
| Read tests GREEN 3/3                                                                                                                                                                         | `node --test apps/api/test/shipment/read.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:31:50.814592+00:00–2026-11-14T11:31:51.215285+00:00 UTC; exit 0                        | 2026-11-14 | PASS   |
| New contract RED: chargeSummary missing; existing contract test PASS                                                                                                                         | `node --test apps/api/test/shipment/contracts.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:32:07.836304+00:00–2026-11-14T11:32:08.028070+00:00 UTC; exit 1                   | 2026-11-14 | FAIL   |
| Regenerate OpenAPI/SDK                                                                                                                                                                       | `npx --yes pnpm@10.34.6 contracts:generate`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:32:34.237013+00:00–2026-11-14T11:32:42.495656+00:00 UTC; exit 0                               | 2026-11-14 | PASS   |
| Contract tests GREEN 2/2                                                                                                                                                                     | `node --test apps/api/test/shipment/contracts.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:32:54.491637+00:00–2026-11-14T11:32:54.650579+00:00 UTC; exit 0                   | 2026-11-14 | PASS   |
| Milestone vocabulary catalog RED: ORIGIN_RECEIVED not enforced; 50 PASS / 1 FAIL                                                                                                             | `node --test scripts/eslint-rules/no-domain-vocabulary-literals.test.mjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:32:59.964416+00:00–2026-11-14T11:33:05.582386+00:00 UTC; exit 1 | 2026-11-14 | FAIL   |
| Milestone vocabulary catalog GREEN 51/51                                                                                                                                                     | `node --test scripts/eslint-rules/no-domain-vocabulary-literals.test.mjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:34:06.540411+00:00–2026-11-14T11:34:15.434852+00:00 UTC; exit 0 | 2026-11-14 | PASS   |
| Genuine PostgreSQL/HTTP GREEN 17/17: exact item strings/null, isolated reconciliation, existing errors now 422, both lock directions, worker parallelism, inactive actor, query counts 6/6/3 | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:33:54.103440+00:00–2026-11-14T11:34:23.937726+00:00 UTC; exit 0                                      | 2026-11-14 | PASS   |
| Forward 14-to-15 migration preservation, repeat and schema drift PASS                                                                                                                        | `node /tmp/nexora051-migration-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:34:39.109763+00:00–2026-11-14T11:35:06.956741+00:00 UTC; exit 0                                   | 2026-11-14 | PASS   |
| Expanded schema/summary/rollback test: 15 PASS / 2 FAIL including parent; synthetic trigger exception P0001 escaped new rollback assertion                                                   | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:35:49.387013+00:00–2026-11-14T11:36:14.467917+00:00 UTC; exit 1                                      | 2026-11-14 | FAIL   |

Stopped on unexpected rollback-test failure at integration/shipment-integration.test.cjs:847: `Raw query failed. Code: P0001. Message: synthetic child rollback`. The newly added assertion awaits a FAILED status, while the existing repository apply path propagates the SQL exception. No further assertion/production changes or reruns were made after this result. Expanded CHECK mutation oracle and all old tests passed in that run, but child rollback assertions after the exception were not reached. Static/full verification and final independent review remain pending; no completion or hosted PASS is claimed.

## Rollback assertion correction

The initial FAIL `expanded-postgres-green` was a wrong expectation in the new test:
repository.apply propagates SQL failures rather than returning FAILED. Existing
shipment-integration.test.cjs:397–453 uses assert.rejects(r.apply(work)), verifies
root/charges/history unchanged and Sync item processing_outcome PENDING; it does
not require a particular SQL code or a FAILED job. The new test follows that
pattern, additionally checking Prisma P2010 with PostgreSQL P0001 and the synthetic
message, including charges in its complete persisted-root comparison and checking
PENDING. The rollback payload changes root, charges, milestones and items, so the
post-error equality covers all four stores. No production behavior was changed.

Rule A correction: rollback-corrected-green FAIL was another new-test assumption about Prisma adapter error metadata (P2010/meta.code). The existing rollback test does not depend on Prisma wrapper metadata. The new predicate now checks the observed PostgreSQL P0001 and synthetic message in the error message; no assertion about unpromised wrapper metadata remains. Persisted-state and PENDING assertions are retained.

Rule A lint correction: first lint run failed on task-added setImmediate (missing explicit node:timers import) and unused destructured \_count. Added the import and mapped only public charge fields explicitly; no contract or transaction change. Historical lint FAIL retained in executed-command evidence.

Rule A environment prerequisite: first root typecheck failed because its Web build dependency requires API_INTERNAL_URL. Exact error: `API_INTERNAL_URL is required. Configure the Web API upstream (e.g. http://api:4000 in Docker).` Subsequent root checks use API_INTERNAL_URL=http://api:4000 and NODE_ENV=production, as the canonical quality command does. No Web/source/config change.

## Current verification state

Implementation commit 17d7cbd contains D1–D5 and D7–D9, generated contracts and tests.
D6 remains withdrawn; the API transaction function is byte-identical to baseline.
All earlier STOP/NOT RUN notes above describe their historical execution points,
not the current final state. Every historical RED/FAIL remains recorded.

Independent review by shipment_list_review (read-only, IMPLEMENTATION_WORKFLOW §8)
found one P2 in the new rollback test. After correction and executed PostgreSQL
17/17 PASS, the reviewer confirmed that P2 resolved and no blocking findings.
Review is source review, not a substitute for executed test or owner approval.

Rule A corrections include test isolation, dual-form Prisma fake, rollback error
expectations, missing setImmediate import/unused variable, Web build environment,
and committing generated artifacts before contracts:check. The initial contract
check's exact error was `Uncommitted contract drift (including untracked files)`;
its before/after generator hash comparison had passed. No contract checker bypass.

Local genuine PostgreSQL suites used the task-owned disposable PostgreSQL 17.11
container with synthetic credentials; databases were created/dropped by existing
signed launchers. Shipment 17/17, Sync 53/53, actual worker/API permissions and
migration preservation/repeat/drift passed. The owned container and its unshared
image were removed only after those tests completed, freeing disk for quality.
No user volumes or shared credentials were modified. Full root test:integration
with unrelated Identity/Customer fixtures is NOT RUN locally because those require
/runtime-config credentials unavailable in this host worktree; canonical hosted
Foundation must provide the complete Docker integration/runtime evidence.

The five-field v2 PR binding simulation returned valid:true. Snapshot v1 SHA remains
433036ffae144d65209201cedde2d8e87fe4a3e9ee00ea81a7f11d9f4278a5c5; v2 SHA remains
a0540d2b5f0f486a508554b1b6ed938c1a90ff71fa6447a3d09a459da9b75935.
Final diff scope is Shipment feature/shared vocabulary, forward schema/grants,
contracts/tests/tooling, canonical docs/task/snapshots and the prior 045 closure
with its two necessary inbound-link repairs. No production provider registration.

## Executed command ledger (UTC)

Each row names the committed HEAD plus working-tree changes at execution, not a
claim that intermediate commits already contained the final implementation. Local
log paths are ephemeral execution provenance, not hosted evidence. Expected TDD
RED and unexpected failures are retained; later PASS never deletes them.
Root typecheck and later root checks use API_INTERNAL_URL=http://api:4000 and
NODE_ENV=production after the documented environment correction.

| Claim                      | Evidence                                                                                                                                                                                                                                                              | Date       | Result |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| baseline-shared            | `npx --yes pnpm@10.34.6 --filter @nexora/shared build`; working tree on 69db22ae1ea56f48fd9ef18310c6b72e502c57f1; 2026-11-14T08:13:55.177461+00:00–2026-11-14T08:13:58.894003+00:00 UTC; exit 0; local log `/tmp/nexora051-baseline-shared.log`                       | 2026-11-14 | PASS   |
| baseline-database          | `npx --yes pnpm@10.34.6 --filter @nexora/database build`; working tree on 69db22ae1ea56f48fd9ef18310c6b72e502c57f1; 2026-11-14T08:13:58.955368+00:00–2026-11-14T08:14:06.305186+00:00 UTC; exit 0; local log `/tmp/nexora051-baseline-database.log`                   | 2026-11-14 | PASS   |
| baseline-api               | `npx --yes pnpm@10.34.6 --filter @nexora/api build`; working tree on 69db22ae1ea56f48fd9ef18310c6b72e502c57f1; 2026-11-14T08:14:06.345600+00:00–2026-11-14T08:14:12.606943+00:00 UTC; exit 0; local log `/tmp/nexora051-baseline-api.log`                             | 2026-11-14 | PASS   |
| domain-red                 | `node --test apps/api/test/shipment/domain.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T09:22:53.076631+00:00–2026-11-14T09:22:53.287369+00:00 UTC; exit 1; local log `/tmp/nexora051-domain-red.log`                              | 2026-11-14 | FAIL   |
| domain-build-shared        | `npx --yes pnpm@10.34.6 --filter @nexora/shared build`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T09:24:45.293065+00:00–2026-11-14T09:24:48.944768+00:00 UTC; exit 0; local log `/tmp/nexora051-domain-build-shared.log`                   | 2026-11-14 | PASS   |
| domain-build-database      | `npx --yes pnpm@10.34.6 --filter @nexora/database build`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T09:24:48.991874+00:00–2026-11-14T09:24:59.583257+00:00 UTC; exit 0; local log `/tmp/nexora051-domain-build-database.log`               | 2026-11-14 | PASS   |
| domain-build-api           | `npx --yes pnpm@10.34.6 --filter @nexora/api build`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T09:24:59.636212+00:00–2026-11-14T09:25:07.729970+00:00 UTC; exit 0; local log `/tmp/nexora051-domain-build-api.log`                         | 2026-11-14 | PASS   |
| domain-green               | `node --test apps/api/test/shipment/domain.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T09:25:07.785311+00:00–2026-11-14T09:25:07.966149+00:00 UTC; exit 0; local log `/tmp/nexora051-domain-green.log`                            | 2026-11-14 | PASS   |
| role-red                   | `node /tmp/nexora051-sql-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T09:29:53.448207+00:00–2026-11-14T09:29:55.891708+00:00 UTC; exit 1; local log `/tmp/nexora051-role-red.log`                                                   | 2026-11-14 | FAIL   |
| role-green                 | `node /tmp/nexora051-sql-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T09:30:08.299318+00:00–2026-11-14T09:30:09.985492+00:00 UTC; exit 1; local log `/tmp/nexora051-role-green.log`                                                 | 2026-11-14 | FAIL   |
| role-green-corrected       | `node /tmp/nexora051-sql-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T10:40:03.811956+00:00–2026-11-14T10:40:05.732148+00:00 UTC; exit 1; local log `/tmp/nexora051-role-green-corrected.log`                                       | 2026-11-14 | FAIL   |
| role-green-column-audit    | `node /tmp/nexora051-sql-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:14:18.601420+00:00–2026-11-14T11:14:20.645542+00:00 UTC; exit 0; local log `/tmp/nexora051-role-green-column-audit.log`                                    | 2026-11-14 | PASS   |
| schema-worker-baseline     | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:14:37.862002+00:00–2026-11-14T11:15:02.147693+00:00 UTC; exit 0; local log `/tmp/nexora051-schema-worker-baseline.log`                                  | 2026-11-14 | PASS   |
| sync-children-red          | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:15:28.558677+00:00–2026-11-14T11:16:04.618488+00:00 UTC; exit 1; local log `/tmp/nexora051-sync-children-red.log`                                       | 2026-11-14 | FAIL   |
| sync-children-isolated-red | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:20:32.152840+00:00–2026-11-14T11:20:56.043196+00:00 UTC; exit 1; local log `/tmp/nexora051-sync-children-isolated-red.log`                              | 2026-11-14 | FAIL   |
| read-red                   | `node --test apps/api/test/shipment/read.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:21:37.730457+00:00–2026-11-14T11:21:38.161070+00:00 UTC; exit 1; local log `/tmp/nexora051-read-red.log`                                  | 2026-11-14 | FAIL   |
| sync-children-green        | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:21:17.947132+00:00–2026-11-14T11:21:45.162212+00:00 UTC; exit 0; local log `/tmp/nexora051-sync-children-green.log`                                     | 2026-11-14 | PASS   |
| read-normalized-red        | `node --test apps/api/test/shipment/read.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:30:43.481657+00:00–2026-11-14T11:30:44.227787+00:00 UTC; exit 1; local log `/tmp/nexora051-read-normalized-red.log`                       | 2026-11-14 | FAIL   |
| read-build-api             | `npx --yes pnpm@10.34.6 --filter @nexora/api build`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:31:39.866060+00:00–2026-11-14T11:31:47.555559+00:00 UTC; exit 0; local log `/tmp/nexora051-read-build-api.log`                           | 2026-11-14 | PASS   |
| read-green                 | `node --test apps/api/test/shipment/read.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:31:50.814592+00:00–2026-11-14T11:31:51.215285+00:00 UTC; exit 0; local log `/tmp/nexora051-read-green.log`                                | 2026-11-14 | PASS   |
| contracts-red              | `node --test apps/api/test/shipment/contracts.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:32:07.836304+00:00–2026-11-14T11:32:08.028070+00:00 UTC; exit 1; local log `/tmp/nexora051-contracts-red.log`                        | 2026-11-14 | FAIL   |
| contracts-generate         | `npx --yes pnpm@10.34.6 contracts:generate`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:32:34.237013+00:00–2026-11-14T11:32:42.495656+00:00 UTC; exit 0; local log `/tmp/nexora051-contracts-generate.log`                               | 2026-11-14 | PASS   |
| contracts-green            | `node --test apps/api/test/shipment/contracts.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:32:54.491637+00:00–2026-11-14T11:32:54.650579+00:00 UTC; exit 0; local log `/tmp/nexora051-contracts-green.log`                      | 2026-11-14 | PASS   |
| lint-catalog-red           | `node --test scripts/eslint-rules/no-domain-vocabulary-literals.test.mjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:32:59.964416+00:00–2026-11-14T11:33:05.582386+00:00 UTC; exit 1; local log `/tmp/nexora051-lint-catalog-red.log`   | 2026-11-14 | FAIL   |
| lint-catalog-green         | `node --test scripts/eslint-rules/no-domain-vocabulary-literals.test.mjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:34:06.540411+00:00–2026-11-14T11:34:15.434852+00:00 UTC; exit 0; local log `/tmp/nexora051-lint-catalog-green.log` | 2026-11-14 | PASS   |
| real-read-green            | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:33:54.103440+00:00–2026-11-14T11:34:23.937726+00:00 UTC; exit 0; local log `/tmp/nexora051-real-read-green.log`                                         | 2026-11-14 | PASS   |
| migration-green            | `node /tmp/nexora051-migration-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:34:39.109763+00:00–2026-11-14T11:35:06.956741+00:00 UTC; exit 0; local log `/tmp/nexora051-migration-green.log`                                      | 2026-11-14 | PASS   |
| expanded-postgres-green    | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:35:49.387013+00:00–2026-11-14T11:36:14.467917+00:00 UTC; exit 1; local log `/tmp/nexora051-expanded-postgres-green.log`                                 | 2026-11-14 | FAIL   |
| rollback-corrected-green   | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:39:12.992060+00:00–2026-11-14T11:39:41.446066+00:00 UTC; exit 1; local log `/tmp/nexora051-rollback-corrected-green.log`                                | 2026-11-14 | FAIL   |
| rollback-observed-green    | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:40:05.422971+00:00–2026-11-14T11:40:30.359990+00:00 UTC; exit 0; local log `/tmp/nexora051-rollback-observed-green.log`                                 | 2026-11-14 | PASS   |
| role-final                 | `node /tmp/nexora051-sql-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:40:34.016072+00:00–2026-11-14T11:40:35.468900+00:00 UTC; exit 0; local log `/tmp/nexora051-role-final.log`                                                 | 2026-11-14 | PASS   |
| shipment-unit              | `node --test apps/api/test/shipment/*.test.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:40:35.505219+00:00–2026-11-14T11:40:36.080713+00:00 UTC; exit 0; local log `/tmp/nexora051-shipment-unit.log`                                | 2026-11-14 | PASS   |
| format                     | `npx --yes pnpm@10.34.6 format:check`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:40:36.120712+00:00–2026-11-14T11:40:53.414092+00:00 UTC; exit 0; local log `/tmp/nexora051-format.log`                                                 | 2026-11-14 | PASS   |
| lint                       | `npx --yes pnpm@10.34.6 lint`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:40:53.588513+00:00–2026-11-14T11:41:10.391326+00:00 UTC; exit 1; local log `/tmp/nexora051-lint.log`                                                           | 2026-11-14 | FAIL   |
| lint                       | `npx --yes pnpm@10.34.6 lint`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:41:49.959665+00:00–2026-11-14T11:42:07.145221+00:00 UTC; exit 0; local log `/tmp/nexora051-lint.log`                                                           | 2026-11-14 | PASS   |
| typecheck                  | `npx --yes pnpm@10.34.6 typecheck`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:42:07.225154+00:00–2026-11-14T11:42:20.943923+00:00 UTC; exit 1; local log `/tmp/nexora051-typecheck.log`                                                 | 2026-11-14 | FAIL   |
| sync-regression            | `node /tmp/nexora051-sync-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:40:52.370890+00:00–2026-11-14T11:43:34.625616+00:00 UTC; exit 0; local log `/tmp/nexora051-sync-regression.log`                                           | 2026-11-14 | PASS   |
| typecheck                  | `npx --yes pnpm@10.34.6 typecheck`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:42:41.833537+00:00–2026-11-14T11:43:54.335479+00:00 UTC; exit 0; local log `/tmp/nexora051-typecheck-1794656561833601372.log`                             | 2026-11-14 | PASS   |
| contracts-check            | `npx --yes pnpm@10.34.6 contracts:check`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:43:54.393495+00:00–2026-11-14T11:44:07.422691+00:00 UTC; exit 1; local log `/tmp/nexora051-contracts-check.log`                                     | 2026-11-14 | FAIL   |
| postgres-final             | `node /tmp/nexora051-worker-run.cjs`; working tree on a9ebc4a3cd1b5d0286806b80b76c4945fad4d1b5; 2026-11-14T11:43:55.626140+00:00–2026-11-14T11:44:27.193278+00:00 UTC; exit 0; local log `/tmp/nexora051-postgres-final.log`                                          | 2026-11-14 | PASS   |
| contracts-check            | `npx --yes pnpm@10.34.6 contracts:check`; working tree on 17d7cbdd7f4d37a214a67370a7199d91060b0b84; 2026-11-14T11:45:07.639597+00:00–2026-11-14T11:45:16.559335+00:00 UTC; exit 0; local log `/tmp/nexora051-contracts-check-1794656707639666539.log`                 | 2026-11-14 | PASS   |
| docs                       | `npx --yes pnpm@10.34.6 docs:check`; working tree on 17d7cbdd7f4d37a214a67370a7199d91060b0b84; 2026-11-14T11:45:16.600581+00:00–2026-11-14T11:45:18.260551+00:00 UTC; exit 0; local log `/tmp/nexora051-docs.log`                                                     | 2026-11-14 | PASS   |
| preflight                  | `npx --yes pnpm@10.34.6 preflight:check`; working tree on 17d7cbdd7f4d37a214a67370a7199d91060b0b84; 2026-11-14T11:45:18.309848+00:00–2026-11-14T11:45:19.782040+00:00 UTC; exit 0; local log `/tmp/nexora051-preflight.log`                                           | 2026-11-14 | PASS   |
| test-docs                  | `npx --yes pnpm@10.34.6 test:docs`; working tree on 17d7cbdd7f4d37a214a67370a7199d91060b0b84; 2026-11-14T11:45:19.822236+00:00–2026-11-14T11:45:21.865483+00:00 UTC; exit 0; local log `/tmp/nexora051-test-docs.log`                                                 | 2026-11-14 | PASS   |
| test-preflight             | `npx --yes pnpm@10.34.6 test:preflight`; working tree on 17d7cbdd7f4d37a214a67370a7199d91060b0b84; 2026-11-14T11:45:21.908240+00:00–2026-11-14T11:45:24.004527+00:00 UTC; exit 0; local log `/tmp/nexora051-test-preflight.log`                                       | 2026-11-14 | PASS   |
| test-lint                  | `npx --yes pnpm@10.34.6 test:lint`; working tree on 17d7cbdd7f4d37a214a67370a7199d91060b0b84; 2026-11-14T11:45:24.045671+00:00–2026-11-14T11:45:31.377431+00:00 UTC; exit 0; local log `/tmp/nexora051-test-lint.log`                                                 | 2026-11-14 | PASS   |
| boundaries                 | `node scripts/boundaries.mjs`; working tree on 17d7cbdd7f4d37a214a67370a7199d91060b0b84; 2026-11-14T11:45:31.443286+00:00–2026-11-14T11:45:32.520122+00:00 UTC; exit 0; local log `/tmp/nexora051-boundaries.log`                                                     | 2026-11-14 | PASS   |
| full-tests                 | `npx --yes pnpm@10.34.6 test`; working tree on 17d7cbdd7f4d37a214a67370a7199d91060b0b84; 2026-11-14T11:45:32.566585+00:00–2026-11-14T11:47:07.017268+00:00 UTC; exit 0; local log `/tmp/nexora051-full-tests.log`                                                     | 2026-11-14 | PASS   |
| quality                    | `npx --yes pnpm@10.34.6 quality`; working tree on 17d7cbdd7f4d37a214a67370a7199d91060b0b84; 2026-11-14T11:47:19.759665+00:00–2026-11-14T11:49:37.587773+00:00 UTC; exit 0; local log `/tmp/nexora051-quality.log`                                                     | 2026-11-14 | PASS   |

Final local quality PASS: API_INTERNAL_URL=http://api:4000 NODE_ENV=production
npx --yes pnpm@10.34.6 quality (17d7cbdd7f4d37a214a67370a7199d91060b0b84 plus
canonical documentation/evidence working tree); includes format/lint/preflight/docs,
typecheck, complete test graph, contracts reproducibility and full build.
Final independent read-only review of committed implementation17d7cbdd7f4d37a214a67370a7199d91060b0b84
confirmed no blockers, including the new lease-loss test and explicit charge projection.
The full root test command passed scripts138/138 and all package suites (including
API216/216, Web266/266, UI37/37 and database6/6). Local final-head gate evidence will
be linked in the PR description after hosted runs; owner review/merge remains open.
The two remaining task checkboxes await hosted provenance/owner closure; do not infer
owner approval from local tests or the independent source review.

## Closure — NEXORA-052 §1.7

Delivered by PR #49. Final-head hosted gates passed on 3d7fc7866e497747084e5cfc54647983f5113ce8. Child snapshot size versus Sync transaction timeout is tracked by issue #50 and must be resolved before registering any Shipment sync capability. Closed in the first commit of NEXORA-052 under §1.7.

Follow-up: [Bound Shipment child snapshots and batch child writes](https://github.com/dinhphuquy2k1/nexora/issues/50). No production capability was registered. Historical FAIL rows and immutable snapshots remain unchanged.

| Claim                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Date       | Result |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Merged to main                | PR #49; merge 08da36dc3599c3af7a4656a12630d978fa7c2fb4; merged 2026-11-14T12:52:21Z; GitHub API state MERGED and origin/main merge log verified                                                                                                                                                                                                                                                                                                                                                                                    | 2026-11-14 | PASS   |
| Final-head hosted gates       | HEAD 3d7fc7866e497747084e5cfc54647983f5113ce8; tested merge 5c935c3606091c8f80c5591bf2687f8cf1cc8be6; [Preflight 43591973565](https://github.com/dinhphuquy2k1/nexora/actions/runs/43591973565), 11:51:11–11:51:25Z; [Sync Targeted 43591973474](https://github.com/dinhphuquy2k1/nexora/actions/runs/43591973474), 11:51:11–11:53:39Z; [Foundation 43591973558](https://github.com/dinhphuquy2k1/nexora/actions/runs/43591973558), 11:51:11–12:09:28Z, all steps 4–10 PASS; attempt 1, no rerun; final-green description verified | 2026-11-14 | PASS   |
| Child-size follow-up recorded | Issue #50 created from PR #49 review; realistic limits/batch writes/real Sync timeout measurement required before Shipment capability registration                                                                                                                                                                                                                                                                                                                                                                                 | 2026-11-14 | PASS   |
