# NEXORA-051 — Shipment list data

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-051
Classification: SIGNIFICANT
Plan revision: rev-2026-11-14-shipment-list-data-v1
Reviewed baseline: e8d5821a370ff1d24424eef18ee6579084e7c943
Branch: feat/shipment-list-data
Design Snapshot: docs/tasks/design-reviews/NEXORA-051-rev-2026-11-14-shipment-list-data-v1.md
Design SHA-256: 433036ffae144d65209201cedde2d8e87fe4a3e9ee00ea81a7f11d9f4278a5c5

## 2. Requirements and scope

Deliver D1–D9 of the current owner request: provider-reported warehouse milestones,
ordered parcel items and bounded Retail read summaries. Shipment remains the
Aggregate Root, with provider-owned Charge/Milestone/Item children; stage history
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
| Selected approach        | Two forward child tables only; reuse strict feature parser and immutable child lifecycle, keyed provider upserts in existing fenced tx; FOR SHARE actor reads and unchanged actor FOR UPDATE writers; exactly3 page-id batch queries; common feature projection helpers for list/detail; existing error mapper/generators and signed real-PG harness                                                                                                                                                                                                     |
| Rationale                | Preserve row identity, authority and exact values; compatible read locks improve concurrent reads while excluding writes; bounded queries avoid N+1; closed vocabulary gives exact physical parity; no speculative infrastructure                                                                                                                                                                                                                                                                                                                        |
| Risks                    | partial collection writes, lost IDs, stale leases, widening grants, date inference, cross-owner reads, count inconsistency, hidden N+1, nullable/schema/SDK drift, repeat migration and legacy preservation, runtime migration counter                                                                                                                                                                                                                                                                                                                   |
| Verification             | Six test-first groups: Domain; genuine schema/mutation/upgrade; actual role grants; real Sync child reconciliation/rollback; separate-connection actor-lock barriers with bounded polling; real HTTP/contract/query-count tests. Then pinned static/contracts/quality, independent SIGNIFICANT review and fresh final-head hosted gates                                                                                                                                                                                                                  |

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
  name VARCHAR512 NOT NULL; quantity INTEGER nullable; unique parent/line;
  checks line_no>=1, length(btrim(name))>0, quantity NULL or>=0.

No indexes beyond PK/UNIQUE, which cover shipment_id lookups. Add camelCase mapped
Prisma models/relations; old migrations and shipments columns remain unchanged.
Change only runtime migration assertion14→15, retaining stored_files0 and all
other assertions. Migration harness seeds actual existing Shipment/fees/history,
applies new migration, checks exact preservation, new children, repeat and drift.

API role SELECT only on both tables. Worker SELECT/DELETE plus column INSERT of
shipment_id/key/payload; UPDATE payload only: milestone occurred_at/location_name/
provider_label, item name/quantity. No id/parent/key UPDATE, no business-column
widening. Preserve repeat column ACL revocation/regrant and existing role flags.

Binding reuses same findUniqueOrThrow with all children, and existing outer Sync
transaction/final fence (no engine edits). After charges, upsert each milestone
by parent/code and item by parent/line, UPDATE payload only WHERE IS DISTINCT FROM;
delete absent milestone codes or item tail only for explicit complete snapshots.
Never bulk delete/reinsert; unchanged rows keep id/xmin. SQL/history/final-fence
failure rolls root, all children and Sync outcome back together. Root timestamps
continue updating through unchanged persistShipmentProvider for child-only apply.

## 8. Read locking, security and concurrency

Every application write to shipments or its child tables first locks the owner's
users row FOR UPDATE (existing Sync engine already does so). Shipment reads take
FOR SHARE with ACTIVE recheck; preserve actor→source→root/children write ordering,
owner resolver and ADMIN no-bypass. Replace only ShipmentAdapter transaction lock,
with the requested shared actor-read comment. No network I/O under locks.

This protocol stabilizes all page/count/batch statements in one READ COMMITTED
read transaction while allowing same-owner reads concurrently. Prove with actual
separate connections: two readers do not block; exclusive writer blocks reader,
reader blocks exclusive writer; release barriers explicitly. Observe pg_blocking_pids
with bounded deadline/async polling, never fixed sleeps. Disabled actor is rejected.
No isolation-level or Customer lock change. Privileged fixture setup/catalog
mutation is owned disposable test infrastructure, not a production write path.

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
5. Read/HTTP/lock RED against current exclusive lock, absent summaries and503;
   implement shared lock and bounded projections/contracts. Real two-connection
   barriers/lock polling; query counting or exact3-batch structural proof; HTTP
   NONE/SINGLE/MULTIPLE, flags, null/reported milestones,0/1/many items, detail order,
   ACTIVE/owner isolation and422. Existing tests remain except deliberate D9 status.
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
owner request settles D1–D9 and storage placement. No invented GitHub approval or
new owner attestation is required. Format snapshot with Prettier3.6.2 before raw
SHA-256; keep its bytes immutable and bind task/PR revision/path/digest. Material
changes require a superseding plan before affected code, not silent scope growth.
Execution/CI logs belong in task/PR compact Evidence, not this snapshot.

Update ADR011 exact Storage placement rule; shipments.md two-table schema,
three-collection authority, read contract,422 and shared/exclusive actor protocol;
database.md schema/ACL/upgrade; api-contract.md DTO/status/lock changes;
testing.md genuine/schema/permission/concurrency/query tests. Extend Uniship's7
checks to10 (warehouse milestones/destination name, item list, services fee-vs-flags).
No official provider authorization or real code dictionaries are inferred.

## 12. PLAN ISSUES and deferred scope

No unresolved architectural ownership issue: current owner request explicitly
selects both child tables and shared read-lock protocol. Milestones are provider
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

- [ ] Two forward child tables/constraints/parity/upgrade, no shipments columns.
- [ ] Immutable validated children and authoritative collection reconciliation.
- [ ] Restricted roles and fenced atomic Sync behavior.
- [ ] Shared actor read locks and bounded consistent list/detail summaries.
- [ ] OpenAPI/SDK422 contract and canonical docs synchronized.
- [ ] Local verification and independent review without blocking P1/P2.
- [ ] Final-head hosted Preflight/Sync Targeted/Foundation.
- [ ] Owner review and merge decision.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Storage placement, two child tables, authoritative snapshots, scoped grants, shared actor-read locks, Retail summary/detail contracts,422 unavailable claims and verification procedures.

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
