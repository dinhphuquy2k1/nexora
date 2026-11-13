# NEXORA-049 — Shipment domain design

## Task metadata and classification

Task ID: NEXORA-049
Classification: SIGNIFICANT
Plan revision: rev-2026-11-13-shipment-domain-design-v2
Reviewed baseline: ea7b0f58d27257a1e9664044da168de362771f20
Branch: docs/shipment-domain-design

## Reuse & design audit

| Field                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Documentation correction of Customer source cardinality and processor-aware Shipment history; existing PR/task, no implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Existing implementations | schema.prisma Customer.syncSources is a collection and SyncSourceIdentity.customer_id a nullable nonunique FK; 20261102000000_sync_v1 defines the FK/link-origin check; 20261104000000_sync_fk_indexes adds a nonunique partial customer index; customer-sync-domain.binding.ts validates owner/immutable target per source, not global Customer uniqueness; sync-integration.test.cjs covers 99 distinct Customer links plus one review, retention/processor versions, non-APPLIED proposals and immutable targets; database/test/migration.mjs preserves staged rows and checks indexes |
| Domain owner             | Customer owns Customer linking decisions/cardinality; Shipment keeps its separately selected one-source model; Sync owns source/version/fence/provenance state                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Reuse alternatives       | Customer-owned customer_source_links preserves many-source-to-one cardinality; original customer source_identity_id column intentionally restricts it to 1:1; no polymorphic table, payload rematching, duplicate Customers or arbitrary canonical-source selection                                                                                                                                                                                                                                                                                                                       |
| Selected approach        | PLAN ISSUE — CUSTOMER_SOURCE_CARDINALITY remains OPEN by owner response; document both alternatives and block Customer mapping migration pending a business decision; retain Shipment source linkage and ordered charge rows; history uses one processor-aware NOT NULL key                                                                                                                                                                                                                                                                                                               |
| Rationale                | Current constraints/binding permit many sources per Customer; safe-abort checks prevent loss but cannot decide which business model is intended; explicit unresolved design is truthful and preserves owner authority                                                                                                                                                                                                                                                                                                                                                                     |
| Risks                    | Loss of valid many-source links, human LINKED_EXISTING provenance or owner scope; mistaking CI green for an accepted design; obsolete snapshot history key or nullable composite-key fields allowing duplicate retries                                                                                                                                                                                                                                                                                                                                                                    |
| Verification             | Five local checks, exact PR/task/v2 binding, unchanged v1 raw bytes, docs-only scope, independent review; future genuine PostgreSQL migration tests with two sources to one Customer and history processor/remapping/idempotency cases, not new tests here                                                                                                                                                                                                                                                                                                                                |

## Requirements and boundary scope

Record only the owner's accepted Shipment design and the concrete implementation roadmap. No production code, migration, schema edit, new test, adapter registration, provider API invention or activation. Close merged NEXORA-048 first. ADR-011 supersedes only ADR-002's shipment-table exclusion for the selected scope; manual/Excel remain future capabilities.

## Delta and provenance from v1

Supersedes v1 selected Customer transition guidance and obsolete history constraint;
all other settled Shipment scope stays intact. Immutable v1 remains at
NEXORA-049-rev-2026-11-13-shipment-domain-design-v1.md with raw SHA-256
015be8d1a5f4d614ddcf1e6916c5780f0408b6ad38b3c20e2075a9f674a14533.
The owner answered on 2026-11-13: "Chưa quyết định; ghi PLAN ISSUE". No cardinality
alternative is newly accepted by this revision. CI cannot settle the open P2.

## Relevant documentation and inspection

Read AGENTS.md and docs/ai/README.md routes, ADR-002/008/009/010, shipments.md/customers.md, database.md/backend.md/sync-extensions.md/api-contract.md, schema.prisma, Retail types and task048. Searched resolveCustomerOwner, customer_id, link_origin, created_by_sync_job_id and created_sync across API, scripts, schema and migrations. Customer infrastructure owns the present existing-link binding; created_by_sync_job_id has a schema/migration declaration but no application writer. No claim of a production data audit. Reusable Components and the pre-implementation template guide boundaries; no generic framework is introduced.

## Ubiquitous language and bounded context

Shipment is Nexora's parcel record; source is its stable provider identity; provider status is the original carrier code; logistics stage is Nexora's mapped physical stage; claim distinguishes carrier claim status from future internal claim cases; charge is an attributed monetary line; stage history is an append-only transition observation. First scope is RETAIL_PARCEL from Uniship, not bulk shipments or import/export entrustment.

## Aggregate boundaries, invariants and interfaces

Shipment is the root, charges its children. History is append-only, not an editable aggregate child. Lists/search/counts use scoped projections without hydration. Meaningful value policies validate money/currency, weight and closed stage membership without copying Customer phone rules. Domain holds transitions and returns immutable copies; DB generates UUID/code/timestamps. Application resolves owner through resolveShipmentOwner and orchestrates ports; trusted infrastructure binding normalizes and applies only provider fields in a fenced transaction. Future read ports serve list/detail/history, and future Nexora commands remain separate from provider updates. No NestJS/Prisma/HTTP in Domain and no generic save-all/Unit of Work. Charge replacement is an explicit provider-owned operation, not a generic full-aggregate save.

## Alternatives and trade-offs

Workspace is rejected: each instance is one organization and current ownership is the connecting account. Polymorphic link tables lose explicit domain/FK ownership; a dedicated table is reserved for actual multiple-source merging. DB-configured API URLs/auth/paging/keys/validation bypass code review, so adapters own these in code. Fixed fee columns obstruct extensibility; use charge rows. One domain column per Sync table couples the neutral engine to every domain; move linkage onto each domain. Retained raw responses reinterpreted on every read obscure ownership/privacy and query cost; persist only needed normalized fields. Trade-off: explicit per-domain bindings, a later Customer linkage migration and provider verification are required.

## Security and authorization

Current Shipment owner is the connected/synchronizing account, resolved in one function for every query and command; no scattered owner = actor or ADMIN cross-owner bypass. A dedicated company connector account is recommended. Approved future users.is_data_owner and ADMIN/OPERATOR permission matrix is design only, not an authorization change. Both future roles view/link customers/note/tag/assign/manage customers and claim cases; only ADMIN configures connections/sync and finalizes reconciliation. Encrypted secrets remain server-side; minimal authorized payload, no credentials/PII in logs. Official API authorization and the seven Uniship questions block an adapter.

## Concurrency and idempotency

Reuse Sync ACTIVE user→Carrier epoch→connection→job authorization/lease/version fences; scoped Shipment lock/hydration and provider-only writes, charge operation, history, outcome and final fence commit atomically. No network under locks or in-memory consistency substitute. Shipment source_identity_id stays UNIQUE and nullable as selected. Append-only history has a required shipment_id FK and INTEGER NOT NULL source_version/processor_version, with UNIQUE (shipment_id, source_version, processor_version). The source version identifies the observed payload version and processor version the processing/mapping semantics; changing a processor does not invent a new source version. A new processor may reprocess an unchanged source and append UNKNOWN → mapped stage only if the stage changes. Same-source/same-processor retries cannot duplicate history; a stage that remains unchanged inserts no history even with a new processor. Unchanged payload with the same processor performs no write. Preserve engine hashes/versions/order/counters and current retry/outcome contracts. Unknown provider code is preserved with UNKNOWN and a warning, not automatically NEEDS_REVIEW.

## Query cost

Owner/stage/created/id and owner/created/id indexes support stable paginated projections; owner/tracking index supports lookup without assuming tracking uniqueness. Partial open-claim and nonnull-customer indexes are planned. List/count predicates share owner/search scope; tab counts are server results, never page sums or invented zeros. Fetch charges for detail only and page history independently; no list aggregate hydration/N+1 or framework/cache. Exact open-claim predicate depends on verified carrier claim semantics; no fabricated codes.

## Backward compatibility and migration

No production, schema, SQL migration, grant, SDK/API, test, dependency or adapter
changes here. Current Customer links are many sources → one Customer, not 1:1;
source inspection does not certify actual production mappings. The original
owner-approved Customer 1:1 target is an intentional future cardinality restriction,
not a representation of the implementation. The owner has left its reconciliation
unresolved. Shipment's selected source_identity_id UUID UNIQUE NULL FK RESTRICT
is distinct and remains unchanged. Customer linkage must leave the Sync engine
only after the following decision and lossless transition are validated.

### PLAN ISSUE — CUSTOMER_SOURCE_CARDINALITY

Status OPEN. Owner explicitly deferred the decision in this session. Required
choice and consequences:

- Preserve supported many-source-to-one behavior with a Customer-domain-owned
  customer_source_links table: source_identity_id UUID NOT NULL UNIQUE;
  customer_id UUID NOT NULL, indexed but not unique; per-link origin with existing
  CREATED_BY_SYNC/LINKED_EXISTING vocabulary; FKs/delete restrictions and owner
  checks. It can preserve every existing link and human linking decision without
  rematching from provider data. This is an unaccepted alternative, not selected SQL.
- Retain the original 1:1 target: customers.source_identity_id UUID UNIQUE NULL
  FK RESTRICT, paired nullable link_origin with existing membership and NULL-pair
  checks. This narrows a currently permitted relationship. An owner-authorized,
  lossless operational reconciliation policy for Customers with multiple sources
  is still required; uniqueness or an abort check does not supply that policy.

Do not implement either alternative or claim the design merge-ready while this
issue is open. No polymorphic cross-domain mapping table and no change to the
Shipment linkage decision.

### Required future migration safety contract

1. Read-only inventory of every existing source-to-Customer mapping, including
   NULL/unlinked sources, per-link origin and available provenance; detect
   Customers referenced by two or more source identities and verify owner scope.
2. Preserve all links, origins and provenance beyond payload retention. No silent
   deletion/overwrite, arbitrary first-source selection, payload rematching,
   cross-owner merge/transfer or duplicate Customer creation without an authorized
   business decision. Retain historical link/provenance data through validation.
3. After the owner settles the model, backfill and compare the complete before/
   after relationship sets and owner/origin/provenance, validate FK/cardinality
   and checks under a reviewed consistent transaction/cutover strategy. No old
   relationship may be removed until the transition is demonstrably lossless.
4. Abort safely/roll back if incompatible mappings remain unresolved; an abort
   protects data but does not resolve the business-model mismatch. No actual
   migration/data audit is performed here. New forward migrations only.
5. Genuine PostgreSQL migration tests must include two distinct sources linked to
   the same Customer: preserve both under the many-source model, or refuse the
   1:1 transition without loss until an authorized remediation is supplied. Also
   cover owner mismatch, NULL links, LINKED_EXISTING durability after retention,
   exact FK/index/CHECK behavior, rollback and repeated deployment.

The eventual scoped implementation includes schema, Customer binding, explicit
worker grants and Sync/migration tests; engine hashes/order/version/outcome state,
job counters, stored_files and security_audit_events stay intact. Cleanup of
unused created_by_sync_job_id/FK/created_sync remains planned, with available
historical provenance preserved/assessed before removal. No schema, grant,
relationship or migration is changed here. New-domain shared subpaths remain
prospective and existing Customer/Sync files do not move.

### Future Shipment history SQL example

Only this one identity contract is selected; this is a design fragment, not DDL
to execute in this PR:

```sql
shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
source_version INTEGER NOT NULL,
processor_version INTEGER NOT NULL,
UNIQUE (shipment_id, source_version, processor_version)
```

NOT NULL closes PostgreSQL UNIQUE's NULL loophole. Append only on a genuine stage
change, permit new-processor UNKNOWN remapping, and retain same-processor retry
idempotency. No history row is added merely because a processor version changes.
Charge order remains line_no SMALLINT NOT NULL from 1 and
UNIQUE (shipment_id, line_no); repeated charge_code values remain separate.

## Test-first plan for later implementation

1. After CUSTOMER_SOURCE_CARDINALITY is settled: RED migration/catalog/backfill tests including two sources sharing a Customer, owner mismatch, retention/provenance and safe rollback; only then forward migration/schema/binding/worker grants and genuine PostgreSQL preservation/role tests.
2. Shipment core: RED domain ownership/strict commands, provider-field allowlist, Nexora-field preservation, money/weight, UNKNOWN mapping, immutable copies, charge replacement and transition history; implement minimal aggregate/policies/ports.
3. Genuine migrated PostgreSQL: UUID/code/FK/delete behavior, exact CHECK membership through conkey/convalidated, mutation sensitivity and valid/invalid inserts following sync-status-contract.cjs; source/history uniqueness, lease loss, concurrency/rollback, same-processor unchanged-payload no-write, new-processor remapping/no-stage-change behavior, NOT NULL key enforcement and cross-owner isolation.
4. Read API/UI: RED owner/filter/search/pagination/tab-count mapping and unavailable states, generated contract parity and NEXORA-045 reuse before Retail API integration. Adapter only after seven provider verifications and official rights; no new tests in this design task.

## Plan readiness and unresolved prerequisites

PLAN ISSUE — CUSTOMER_SOURCE_CARDINALITY is an open blocking business-model
choice. The owner explicitly requested it remain open. Provider API/status/claim/
key/cursor/money/permissions/exceptions are still future adapter prerequisites.
Documentation and CI can be verified while the design remains unresolved;
VERDICT: NEEDS DESIGN DECISION. Independent review must not represent this as
full design approval or waive the migration blocker.

## Plan

1. Close NEXORA-048 under §1.7 in the first commit.
2. Preserve v1 bytes/digest and record this superseding v2 with raw SHA-256 before canonical corrections.
3. Accept ADR-011 and add ADR-010/011 to the decisions index.
4. Rewrite shipments.md with the settled first scope, aggregate, ownership, schema draft, sync/read contracts and roadmap.
5. Record vocabulary, database naming and new-domain shared subpath rules.
6. Synchronize ADR-011, Shipment dependencies/history, Sync guide, database future guidance, ADR-010 cleanup note and task with the open cardinality issue; do not rewrite unrelated policy.
7. Execute requested governance/document checks, binding, docs-only scope/inventory and consistency review.
8. Synchronize five metadata fields in existing PR #46 before push, wait for new-head Preflight/Foundation and follow bounded rerun policy; retain failures and report NEEDS DESIGN DECISION even if CI passes; never merge.
9. Close this task in the first commit of the next task's PR after merge.
