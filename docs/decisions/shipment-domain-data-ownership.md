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
Each domain table holds `source_identity_id UUID UNIQUE NULL` with an FK to
`sync_source_identities` and `ON DELETE RESTRICT`. NULL permits a future record
without a provider source; uniqueness models the current one-to-one linkage.
Only a domain that actually permits several sources to merge into one record uses
a separate, domain-owned link table. Do not introduce a polymorphic link table.
The current `sync_source_identities.customer_id/link_origin` is the old approach,
retained in the present schema until the next cleanup task.

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

The next task must implement and verify this forward migration:

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
  The Customer–source relationship is one-to-one.
- Preserve engine internal state: `last_*_hash`, `resolved_*`, `applied_*`,
  `observed_source_version`, `last_source_order`, `resolved_version` and
  `applied_version`; preserve `sync_jobs` counters, `stored_files` and
  `security_audit_events`.

Implementation scope is a **new migration**, schema.prisma,
`customer-sync-domain.binding.ts`,
`packages/database/scripts/provision-runtime.mjs` (worker permissions on customers),
Sync and migration tests, and synchronized documentation. Do not rewrite historical
migrations. Assess/backfill actual existing links before dropping the old columns;
validate owner scope, one-to-one cardinality and paired checks, stopping on
incompatible data instead of discarding it. Customer creation/address invariants,
engine fencing and least-privilege grants still apply; no generic cross-domain
writer is introduced. This task neither edits that code nor grants worker writes.

## Alternatives rejected and consequences

| Rejected approach                                         | Reason                                                                                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Workspace                                                 | One organization per instance; one owner resolver supplies the current account scope and allows the approved later data-owner policy |
| Polymorphic link table                                    | Obscures typed FK/domain ownership; a domain-owned multi-source table is justified only by actual merging                            |
| API configuration in DB                                   | Protocol/validation/identity changes require code review, not mutable runtime execution configuration                                |
| One domain column per Sync engine table                   | Couples the neutral engine to every added domain; linkage belongs to the domain                                                      |
| Fixed fee columns                                         | A closed charge-code collection models the selected fees without a new column per fee                                                |
| Store raw response then reinterpret mapping on every read | Retains unnecessary data and pushes normalization/ownership/query cost into read paths                                               |

The cost is explicit per-domain bindings, a separate Customer linkage migration
and verified provider contracts before activation. Benefits are stable ownership,
scoped writes, queryable minimal state and extensibility without a launcher,
framework, workspace or new service. [ADR-008](tactical-ddd.md) still governs
aggregate encapsulation, locked hydration and minimal persistence.
