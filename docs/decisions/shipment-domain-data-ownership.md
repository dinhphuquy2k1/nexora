# ADR-011 — Shipment domain and data ownership

Status: Accepted. Date: 2026-11-13. Authority: owner decision, NEXORA-049.

## Scope and supersession

Shipment is DESIGNED, not implemented. This decision supersedes the shipment-table
portion of the **Strict Exclusions** in [ADR-002](product-scope.md), originating in
the foundation v0.1.0/multi-carrier milestone, for the scope settled here:
RETAIL_PARCEL (e-commerce/retail parcels), initially Uniship. Bulk shipments,
import/export entrustment, a second carrier, manual entry and Excel ingestion
remain future capabilities. No migration, schema, adapter registration or live
traffic is authorized by this documentation task. [Shipment](../domains/shipments.md)
owns the schema draft, stage mapping and read-contract design.

## Organization, owner and authorization

Each instance is one organization. In this phase a Shipment belongs to the account
that connected and synchronized with the carrier. Every query and command obtains
its owner through **one function, resolveShipmentOwner**; do not scatter
`owner = actor` decisions across use cases. This follows the Customer owner-resolver
pattern without copying Customer business rules or adding ADMIN cross-owner access.
The connecting account should operationally be a dedicated company account.
Workspace is rejected.

The approved future direction, **not implemented in this phase**, is a single data
owner account for the instance (`users.is_data_owner`) and OPERATOR access to that
data through the following permission matrix. It is not a current grant or a way
to bypass existing Carrier ownership, ADMIN MFA or ACTIVE-session checks.

| Future operation                                 | ADMIN   | OPERATOR |
| ------------------------------------------------ | ------- | -------- |
| View shipments                                   | Allowed | Allowed  |
| Link customer, internal note, labels, assignment | Allowed | Allowed  |
| Create/edit customers                            | Allowed | Allowed  |
| Create/update internal claim cases               | Allowed | Allowed  |
| Connect carriers and configure sync              | Allowed | Denied   |
| Finalize reconciliation                          | Allowed | Denied   |

## Column write ownership

Carrier-owned columns are written only through Sync. Nexora-owned columns are
never overwritten by Sync. The Shipment domain binding creates the record or
updates exactly the allowed carrier-column set, not the full record from an
external payload. Nexora customer assignment, assignee and internal notes remain
independent of carrier status/fees. Identity/owner/code are domain/database
metadata, not provider-assigned mutable fields. Charge replacement is an explicit
provider-owned aggregate operation; append-only history records stage changes.

## Source linkage belongs to the domain

Sync engine tables must not contain columns belonging to any business domain.
Shipment retains the selected `source_identity_id UUID UNIQUE NULL` on its own
table, FK to `sync_source_identities` with `ON DELETE RESTRICT`: one source per
Shipment, with NULL reserved for future records without a provider source. This
Shipment design does not describe the current Customer relationship.

Current `sync_source_identities.customer_id` is a nullable, **nonunique** FK;
`Customer.syncSources` is a collection. The nonunique partial index
`idx_sync_source_identities_customer` and source-scoped Customer binding permit
multiple source identities to link to one owner-scoped Customer. The original
Customer 1:1 target below would intentionally restrict that supported cardinality.
A separate Customer-domain-owned link table is the compatibility-preserving
alternative for multiple sources. Neither a polymorphic cross-domain link table
nor adding more domain columns to Sync is allowed. Customer transition remains
blocked by the open cardinality issue below; no current schema is changed.

## Adapter configuration and source identity

API URL, authentication protocol, pagination, identity keys and response validation
belong in adapter code and change through PR review. The database keeps only
scheduling, enabled/disabled configuration, watermarks and encrypted secrets for
this configuration purpose; existing operational engine state remains intact.
There is no DB-configured API execution framework.

Identity keys use a versioned scheme, for example `uniship-parcel-v1`. A key change
requires a new scheme and an explicit data-transition plan; never silently change
the meaning of an existing key or infer uniqueness from a tracking code.

## No inferred status or money

Preserve an unknown provider status verbatim, map `logistics_stage = UNKNOWN`, and
warn so a verified mapping can be added. Unknown technical vocabulary alone is
not `NEEDS_REVIEW`: that outcome is reserved for a genuine human business decision.
Deterministic invalid source and transient faults retain ADR-010 classification.
Store the amounts exactly as the carrier reports, with currency, exchange rate
and rate timestamp when supplied. Do not recalculate totals, fees or currency
conversion, assume a rate, or invent values for missing fields. Mapping from UI
labels is PROVISIONAL until official original status codes are verified.

## Next-task Sync cleanup (not implemented here)

Customer mapping migration is blocked by **PLAN ISSUE — CUSTOMER_SOURCE_CARDINALITY**.
The original owner-approved target below is retained as a future intentional
cardinality restriction, not as the present schema or an unconditionally executable
migration. On 2026-11-13 the owner explicitly answered: "Chưa quyết định; ghi PLAN ISSUE".
Only after the choice and a lossless transition are settled may a later task
implement the corresponding forward migration:

- Remove `sync_source_identities.customer_id`, `link_origin`, their CHECK and
  `idx_sync_source_identities_customer`.
- Remove `created_by_sync_job_id`, its FK and Prisma `created_sync` relation. No
  current application code writes it; it remains NULL on current application
  paths. This is a source-inspection finding, not an audit of arbitrary external
  production writes.
- Add `customers.source_identity_id UUID UNIQUE NULL`, FK `ON DELETE RESTRICT`,
  and `customers.link_origin` with CHECK membership
  `CREATED_BY_SYNC | LINKED_EXISTING` and
  `CHECK ((source_identity_id IS NULL) = (link_origin IS NULL))`.
  This original target makes Customer–source one-to-one; it is not the current
  many-source-to-one relationship and remains subject to the open issue below.
- Preserve engine internal state: `last_*_hash`, `resolved_*`, `applied_*`,
  `observed_source_version`, `last_source_order`, `resolved_version` and
  `applied_version`; preserve `sync_jobs` counters, `stored_files` and
  `security_audit_events`.

Implementation scope is a **new migration**, schema.prisma,
`customer-sync-domain.binding.ts`,
`packages/database/scripts/provision-runtime.mjs` (worker permissions on customers),
Sync and migration tests, and synchronized documentation. Do not rewrite historical
migrations. Assess/backfill actual existing links only under the settled model and
validate the complete mapping/origin/provenance sets before removing old columns.
Safe-abort checks protect data; they do not resolve the business-model mismatch. Customer creation/address invariants,
engine fencing and least-privilege grants still apply; no generic cross-domain
writer is introduced. This task neither edits that code nor grants worker writes.

## Customer source cardinality — open plan issue

**PLAN ISSUE — CUSTOMER_SOURCE_CARDINALITY: OPEN.** P2-1 is not resolved by green
CI or a migration preflight. The owner's original 1:1 target conflicts with a
relationship permitted by the implementation; the owner has not chosen how to
reconcile them. These are alternatives, not two accepted architectures:

| Alternative requiring owner decision                                                                  | Consequence                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve many-source-to-one Customer linkage in a Customer-domain-owned `customer_source_links` table | `source_identity_id UUID NOT NULL UNIQUE`; `customer_id UUID NOT NULL`, indexed but nonunique; per-link `link_origin` keeps CREATED_BY_SYNC/LINKED_EXISTING membership, appropriate FKs/delete restrictions and source/Customer owner checks. Every existing source link and human decision can be preserved without payload rematching. This table is provisional, not selected or created here. |
| Retain the original `customers.source_identity_id UUID UNIQUE NULL` target                            | Intentional future 1:1 restriction with paired nullable link_origin and existing membership/NULL-pair CHECKs. It cannot represent several source identities on one Customer. The owner must authorize a lossless operational reconciliation/remediation policy for those mappings before migration; arbitrary dropping, choosing one or duplicating Customers is not authorized.                  |

The required owner decision is whether multiple sources per Customer remain
supported, and, if restricting to 1:1, how every existing link/provenance record
will survive an explicitly authorized reconciliation. Until then, retain the
current relationship and do not implement either alternative. Shipment's selected
one-source linkage remains distinct and unchanged.

### Required lossless future migration contract

1. Read-only assessment of **all** existing source-to-Customer mappings, including
   unlinked rows, per-link origin and available provenance. Detect Customers with
   two or more source identities and verify source/Customer owner consistency.
   Source inspection here is not an audit of actual production data.
2. Preserve every link and human LINKED_EXISTING decision beyond payload retention
   (ADR-010). No silent deletion/overwrite, arbitrary first/canonical source,
   provider-payload rematching, cross-owner transfer, or duplicate Customer creation
   without an authorized business decision. Retain historical linking/provenance
   data until transition validation completes.
3. After model/remediation approval, use a reviewed consistent transactional or
   coordinated cutover, backfill, and compare complete before/after mapping,
   owner, origin and provenance sets. Validate exact FK/cardinality/CHECK behavior.
   Do not remove the old relationship unless the transition is demonstrably lossless.
4. Abort/roll back safely while any incompatible mappings remain unresolved.
   An abort condition prevents damage but is not a business-policy resolution.
   No data is silently discarded and historical migrations stay immutable.
5. Genuine PostgreSQL migration tests must include **two distinct sources pointing
   to the same Customer**. A many-source design preserves both; a 1:1 transition
   without authorized remediation must refuse/roll back and leave both intact.
   Also test owner mismatch, NULL links, LINKED_EXISTING durability after retention,
   FK/delete/index/CHECK behavior, rollback and repeat deployment.

Current integration coverage includes distinct Customer links, retention/processor
upgrades, immutable source targets and non-APPLIED proposal rollback; migration
coverage preserves staged rows and index shape. Inspection found no dedicated
future two-source-to-one-Customer migration regression. Those tests and the actual
migration belong to a subsequent implementation task after the decision, not this PR.

## Alternatives rejected and consequences

| Rejected approach                                         | Reason                                                                                                                                                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace                                                 | One organization per instance; one owner resolver supplies the current account scope and allows the approved later data-owner policy                                                                                        |
| Polymorphic link table                                    | Obscures typed FK/domain ownership; a domain-owned multi-source table is justified only by actual merging                                                                                                                   |
| API configuration in DB                                   | Protocol/validation/identity changes require code review, not mutable runtime execution configuration                                                                                                                       |
| One domain column per Sync engine table                   | Couples the neutral engine to every added domain; linkage belongs to the domain                                                                                                                                             |
| Fixed fee columns                                         | A closed charge-code collection models the selected fees without a new column per fee                                                                                                                                       |
| Store raw response then reinterpret mapping on every read | Source-to-record mapping must outlive payload retention (ADR-010), and human linking decisions such as LINKED_EXISTING cannot be recomputed from provider data; re-matching on every run risks duplicates and wrong merges. |

The cost is explicit per-domain bindings, a separate Customer linkage migration
and verified provider contracts before activation. Benefits are stable ownership,
scoped writes, queryable minimal state and extensibility without a launcher,
framework, workspace or new service. [ADR-008](tactical-ddd.md) still governs
aggregate encapsulation, locked hydration and minimal persistence.
