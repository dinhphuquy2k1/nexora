# NEXORA-055 — Shipment Services foundation

Status: PLANNED
Capability: PLANNED
Verification: NOT VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-055
Classification: SIGNIFICANT
Plan revision: rev-2026-11-15-shipment-services-v1
Reviewed baseline: 64758b93b64261f866ea3cee810f305ef21682ed
Branch: feat/shipment-services
Design Snapshot: docs/tasks/design-reviews/NEXORA-055-rev-2026-11-15-shipment-services-v1.md
Design SHA-256: a524cc5842a4a59831be7322aac0ba580968a998c3f70d4bbd387fdfae75e1a4

## 1. Requirements and settled decisions

Implement the owner's separate shipment_services table, never root flags or fee
state. Presence(enabled true/false) means a known fact; missing row means unknown.
No charge-derived backfill, fee/service fallback, adapter, live calls, capability,
new worker/scheduler, framework/dependency or historical migration/capture change.
Close merged054 in the first commit, then this plan, then test-first code.

## 2. Read-only inventory and reuse search

Read AGENTS/AI routes and PROJECT_CONTEXT/RULES/TASK_WORKFLOW/IMPLEMENTATION_WORKFLOW,
ADR008/009/011/007, Shipment/Uniship contracts, backend/API/database/reuse/testing and
both repository review skills. Inspected Domain shipment.ts normalization/entities/
aggregate, mapper, Sync binding/provider persistence/processor, read adapter/port/DTO,
Prisma model/migrations/grants, schema oracle, migration/worker/SQL harnesses, genuine
Shipment/Sync child-batch fixtures, read/domain/contract tests and Retail guards/
row/table/fixtures. Search ShipmentCharge/ShipmentChargeCode/chargeSummary/hasInsurance/
hasCounting/hasWoodPacking/hasBubbleWrap/parseShipmentProviderInput/ShipmentAggregate/
SyncRepository.apply/SYNC_GRANTS/RUNTIME_GRANTS. Results: fees currently supply four
legacy booleans; Retail row.ts consumes them as service ticks; full binding hydration
loads charges/milestones/items; list batches exactly3 child queries in the actor
FOR UPDATE transaction; worker actor FOR SHARE and existing engine fences stay.
No055 task or open PR exists. Main/PR53 merge verified64758b9, actual merge time
2026-11-15T07:18:59Z. Docker daemon29.9.2 available; no cached images at inspection.

## Reuse audit

| Field                    | Decision                                                                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Shipment service entity/authoritative collection, scoped batch persistence, read projection and compatibility consumers                                                                                                                                                      |
| Existing implementations | Domain shipmentRecord/normalizeProviderPatch/child classes; mapper/include; Sync binding conditional unnest upsert/delete; read groupByShipment and actor lock; provision-runtime column grants; schema oracle, migration harness and child-batch fixture; Retail SDK guards |
| Domain owner             | Shipment Aggregate Root owns service children/invariants; Infrastructure owns transaction/SQL/DB identities; Shared owns four cross-package persisted codes; API owns DTO and Web owns presentation                                                                          |
| Reuse alternatives       | Extend existing child/operation/transaction/query patterns; reject ChargeCode reuse, fee inference/backfill, root columns, is_known, separate aggregate/worker, generic save/launcher/persistence or provider parser                                                         |
| Selected approach        | Four-code boolean child facts, complete authoritative snapshot, stable-key conditional batch upsert/delete, additive tri-state summary/detail entries, unchanged deprecated fee flags and minimal truthful Retail reads                                                      |
| Rationale                | Preserve unknown versus explicit false, immutable identities, exact monetary independence, same fenced transaction and page-scoped reads without N+1                                                                                                                         |
| Risks                    | Missing-to-false conversion, hidden fee fallback, fragile/wood and foam/bubble equivalence, schema/grant parity, row identity/xmin regressions, source rollback and page capacity, old DTO fixtures/guards                                                                   |
| Verification             | Domain RED/GREEN; genuine PG vocabulary/mutation/upgrade/FK/privileges; isolated Sync scenarios/rollback/fence and100x50/500/4 plus4-services capacity; read owner/query contracts; SDK/guard/UI tests, canonical Docker/quality and exact-head CI                           |

## 3. Tactical DDD ownership and aggregate boundary

Shipment remains the Aggregate Root. Service is an encapsulated child entity with
DB-generated UUID and stable natural key(shipment_id,service_code); a draft ID is
null. Domain validates closed codes, exact boolean, strict own properties, catalogue
bound and duplicates, copies all snapshots/operations, and reconciles child IDs by
code before mutating state. Hydration under existing locks loads all four child
collections; legacy stored shipments have services=[] naturally. No Prisma/Nest/
HTTP/Carrier payload in Domain. Existing charge/money/stage policies are unchanged;
service-only operation must not append history when physical stage is unchanged.

## 4. Canonical vocabulary and meanings

Shared ShipmentServiceCode (as const plus ShipmentServiceCodeValue) is separate
from ShipmentChargeCode. Exact order/codes: INSURANCE, COUNTING, FRAGILE_GOODS, FOAM.
They represent independent reported insurance/counting/fragile-goods/foam facts;
they do not certify how Uniship wire values translate. FRAGILE_GOODS is not
WOOD_PACKING; FOAM is not BUBBLE_WRAP. No provider-specific fields or speculative
extra codes. Incoming bound is Object.values(ShipmentServiceCode).length. Extend
persisted-vocabulary lint/catalog/parity deliberately for serviceCode/service_code.

## 5. Schema, migration and grants

New forward migration20261115000000_shipment_services creates id UUID DB default
PK, shipment_id UUID NOT NULL, service_code VARCHAR(32) NOT NULL, enabled BOOLEAN
NOT NULL with no default. FK fk_shipment_services_shipment -> shipments(id), DELETE
CASCADE/UPDATE NO ACTION; uq_shipment_services_code(shipment_id,service_code);
validated chk_shipment_services_code exact four values. No additional index, no
root/charge DDL, no backfill. Prisma ShipmentService and Shipment.services mirror
it. Existing rows/data and historical migrations stay byte-identical. API role
SELECT only; worker SELECT/DELETE plus column INSERT(shipment_id,service_code,enabled)
and UPDATE(enabled), never identity/code/parent updates. Keep every other grant.

## 6. Normalized operations and persistence

services?: { complete:true; entries:readonly {serviceCode,enabled}[] }.
Absent preserves; complete empty clears; complete present reconciles and missing
codes become unknown, never false; explicit false is retained. Null/partial/extra
keys, unknown codes, non-boolean or duplicates reject the entire source. Domain
parser and aggregate reuse one validation policy. ProviderOperation adds services.
Locked Prisma include/mapper hydrates services. Existing Sync binding persists
only present collections with parameterized bounded unnest(text[],boolean[]),
ON CONFLICT(shipment_id,service_code) UPDATE enabled WHERE enabled IS DISTINCT FROM
EXCLUDED.enabled, then deletes only excluded codes. UUIDs/xmin unchanged for equal
facts. No charge edits from service updates or service edits from charge updates.
Keep source/processor versions, source snapshots, lease/final fence,100/15000ms and
error propagation; only Shipment VALIDATION_ERROR becomes REJECTED_SOURCE.

## 7. Additive API/SDK and read cost

Required serviceSummary on list/detail: {insurance:boolean|null,counting:boolean|null,
fragileGoods:boolean|null,foam:boolean|null}. Null means no stored row; false stays
false. Detail additionally services:[{id:uuid,serviceCode:canonical,enabled:boolean}]
in canonical order. Preserve charges and all chargeSummary fields/meaning. Mark four
chargeSummary.has\* properties deprecated legacy fee-row projections, not service
facts. No provider names in DTO. Regenerate OpenAPI/SDK through contracts:generate,
never manual generated edits. List adds one bounded service query by page IDs in
the same existing actor FOR UPDATE transaction; empty page skips all child queries.
Detail authorizes owner/root before services. No N+1/full list hydration or lock/
isolation change. HTTP auth/error/pagination routes remain unchanged.

## 8. Minimal consumer compatibility and named follow-up

Retail currently interprets legacy fee flags as service ticks, a materially false
result. Update strict SDK-derived response guards and test DTOs for the additive
shape. Retail row insurance/counting read serviceSummary only; use nullable view
flags and truthful unknown accessible labels. Existing wood-packing/bubble-wrap
columns have no equivalent approved service codes: show unknown, never map
FRAGILE_GOODS/FOAM to those labels. Keep all column IDs/order/width/layout/CSS and
fee rendering. Named future prerequisite RETAIL_SERVICE_CATALOG_PRESENTATION owns
any approved label/column/detail redesign; no new services section is silently
claimed. Synthetic service facts must be explicit, not computed from charge rows;
reference-oracle changes are limited to these intentional semantic corrections.

## 9. Security, concurrency and performance

Keep API SELECT-only child grants, owner resolver and actor->source/root->children
locks. No network under DB locks, live request/registration, DB mutation API or
Nexora-owned fields from provider. Service updates are inside existing fenced Sync
transaction; real forced DB error/final-fence rollback must preserve all roots,
children/source/outcomes. Reuse existing child batch harness: four service entries
per100 shipments alongside50 charges/500 items/4 milestones. Preserve first apply
<=7500ms and transaction15000ms, capture first/changed/identical timings, SQL counts,
PG/machine provenance; no timeout/bound relaxation. Upserts/deletes <=2/table/root.

## 10. Test-first implementation plan

1. Completed054 closure commit7b39aed first; retain historical failures and named
   external prerequisites, never certify provider semantics.
2. Record this SIGNIFICANT plan/snapshot, format then raw hash and commit before tests.
3. Domain RED invalid/duplicate/extra/nonboolean, absent/empty/false/unknown, hydration,
   immutable snapshots/IDs, charge independence and service-only stage behavior; GREEN.
4. PG schema/upgrade/grant RED then migration/Prisma/grants GREEN. Extend exact oracle
   conkey/validated/vocabulary/FK/unique/mutation checks and historical-data retention.
5. Sync real PG RED/GREEN for first snapshots/toggles/removal/empty/absent/equal IDs/
   xmin, changed root/equal children, independent charges, mixed invalid siblings,
   SQL/final-fence rollback and unchanged versions. Extend existing isolated helper
   and representative100-shipment capacity without changing7500/15000 bounds.
6. Read/contract RED/GREEN for four page-scoped child queries, empty skip, stable detail
   order, known true/false/unknown, fee-only and service-only facts, owner/404/errors.
7. Generate contracts; update strict Web guards/minimal consumer and DTO fixtures with
   targeted RED/GREEN, preserve layout and current browser/Pager acceptance.
8. Update canonical docs and all required tests/checks, contracts generation/check,
   production-env quality and canonical quality-docker on an owned disposable project.
9. Independent read-only code review, resolve confirmed P1/P2, inspect full diff/allowlist,
   hashes/immutable migrations/captures and task evidence. Commit grouped changes.
10. Push one PR titled feat(shipment): introduce independent shipment services, bind
    five metadata lines, wait final-head Preflight/Sync Targeted/Foundation. Preserve
    FAILs; record final hosted evidence in PR without an evidence-only SHA loop. No merge.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Independent child schema/codes/grants/authoritative snapshots, additive tri-state
reads and deprecated fee projections, minimal Retail truthfulness, genuine service
verification/capacity and future adapter/UI prerequisites.

### Canonical owners

- docs/domains/shipments.md
- docs/architecture/api-contract.md
- docs/architecture/backend.md
- docs/architecture/database.md
- docs/operations/testing.md
- docs/integrations/uniship-portal-api.md (future boundary only)
- docs/architecture/frontend.md (minimal service-consumer truthfulness)

### Documentation verification

- Pinned docs:check, preflight:check, format:check, test:docs, test:preflight;
  code/SDK/PG regression and exact-head hosted evidence.

## 12. Compatibility, open prerequisites and acceptance

No unresolved architecture issue: separate table is final and no is_known is needed.
UNISHIP_LIVE_ACTIVATION, UNISHIP_CLAIM_LIFECYCLE_CAPTURE and
UNISHIP_FIELD_SEMANTICS_VERIFICATION remain named NOT VERIFIED prerequisites linked
from completed054 and its canonical portal/ADR ledger. This foundation does not
resolve provider-specific meanings. Migration/API semantics are selected above;
material contradictions require a precise PLAN ISSUE before changing the plan.
Task055 stays active until a later PR closes it under§1.7; no automatic merge.

- [ ] Domain/service code and immutable aggregate semantics.
- [ ] Migration, exact PG oracle/upgrade/data preservation and least privileges.
- [ ] Fenced Sync reconciliation, error/rollback/isolation and bounded capacity.
- [ ] Additive read API/SDK and strict/minimal compatible consumers.
- [ ] Canonical docs, required local/Docker checks and independent review.
- [ ] Exact final-head Preflight, Sync Targeted and Foundation4–10.
- [ ] Owner review/merge decision.

## Evidence

| Claim                                | Evidence                                                                                                                                                                                          | Date       | Result |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Read-only baseline and task identity | main64758b93b64261f866ea3cee810f305ef21682ed, PR53 merged2026-11-15T07:18:59Z; no055 task/open PR; new feat/shipment-services worktree; existing worktrees preserved                              | 2026-11-15 | PASS   |
| Predecessor closure                  | first commit7b39aed closes054 under§1.7 with merge/final-head hosted provenance, historical FAILs/frozen snapshot retained and named external prerequisites NOT VERIFIED; pinned docs:check exit0 | 2026-11-15 | PASS   |
