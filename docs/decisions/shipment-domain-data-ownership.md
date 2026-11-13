# ADR-011 — Shipment domain and data ownership

Status: Accepted. Date: 2026-11-13. Authority: owner decision, NEXORA-049.

## Scope and supersession

Shipment is DESIGNED, not implemented. This decision supersedes the shipment-table
portion of the **Strict Exclusions** in [ADR-002](product-scope.md), originating in
the foundation v0.1.0/multi-carrier milestone, for the scope settled here:
RETAIL_PARCEL (e-commerce/retail parcels), initially Uniship. Bulk shipments,
import/export entrustment, a second carrier, manual entry and Excel ingestion
remain future capabilities. No migration, schema, adapter registration or live
traffic is authorized by this documentation task. The current planned Uniship
scope is Shipment-only; Uniship Customer Sync is not required or included. [Shipment](../domains/shipments.md)
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

## Two independent relationships

### Shipment to Nexora Customer

A Shipment's `id` is its internal stable identity; `source_identity_id` identifies
its external Shipment source; `customer_id` is a Nexora-owned association.
Shipment retains `source_identity_id UUID UNIQUE NULL`, FK RESTRICT, as its
selected one-source-per-Shipment model. This is separate from Customer source
cardinality below.

1. A Shipment may initially have `customer_id = NULL`. Ingesting a valid Shipment
   requires neither Customer creation nor Customer matching.
2. An authorized future Nexora operation can link an existing owner-scoped
   eligible Customer. Preserve existing authorization, owner isolation and
   Customer lifecycle constraints. Multiple Shipments, including different
   provider sources, may reference the same internal Customer.
3. Shipment Sync writes only provider-owned fields; it must never overwrite or
   silently infer `shipments.customer_id` from provider data. Unlink/relink is a
   separate authorized business command, never a side effect of Sync processing.
4. Do not assume Uniship supplies Customer identifiers or a Customer API. The
   current planned Uniship integration is Shipment-only, gated by official API
   authorization. The future Customer-linking API/commands are outside this PR.

### External Customer source to Nexora Customer

For a provider actually supporting CUSTOMER, reuse
`sync_source_identities.customer_id` (nullable, nonunique FK) and `link_origin`.
`Customer.syncSources` is a collection; `idx_sync_source_identities_customer` is
a nonunique partial index. Different source identities may link to one Customer,
scoped by owner/provider/external account/SyncType/stable identity and scheme.

Customer Domain/processor determines the eligible link. The existing trusted
CustomerSyncBinding validates owner and immutable target under locks, stages the
proposal and persists its result under the Sync transaction/fences. **Code owns
the mapping decision; persisted source identity owns its durable recorded result
in the current implementation.** This is not a runtime-only computed mapping.

Reuse confirmed mappings across restarts, resynchronization, payload changes and
payload retention cleanup; preserve `LINKED_EXISTING` and all provenance. Do not
rematch on every run or silently relink an identity to another Customer. Never
automatically merge Customers solely by name, phone, tracking code or unverified
external information. Decisions needing human confirmation use existing
`NEEDS_REVIEW` semantics. No new matching algorithm, Customer creation policy or
production handler is authorized here.

## Bounded Customer persistence compatibility exception

New domain linkage belongs to the owning domain, and no Shipment-specific column
is added to Sync. For **existing Customer mapping only**, retain the current
Customer-specific FK/link_origin fields in `sync_source_identities` as an explicit,
bounded compatibility exception. Customer Domain still owns decisions/validation;
Sync retains the current physical representation and generic fenced execution.
No generic mapping logic is added to Sync. The engine is not already completely
free of Customer-specific persistence fields. Other domains must not automatically
copy this exception; Shipment keeps source_identity_id on its own table.

No `customer_source_links` or other mapping table is introduced or selected now.
Physical relocation requires a separately justified and recorded future design;
it is not required for Shipment Core and has no selected destination schema.

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

## Customer source cardinality — resolved

**PLAN ISSUE — CUSTOMER_SOURCE_CARDINALITY: RESOLVED at the cardinality-decision
level.** The latest owner clarification permits multiple external Customer
sources to map to one internal Nexora Customer and explicitly selects reuse of
current durable source-identity persistence. The proposed
`customers.source_identity_id UUID UNIQUE NULL` 1:1 migration target is
**superseded and must not be implemented**. This decision does not impose
Customer Sync on Uniship or change Shipment's one-source linkage.

Historical v1/v2 snapshots and Evidence preserve the earlier 1:1 proposal and the
owner's then-deferred response, "Chưa quyết định; ghi PLAN ISSUE". The current
clarification supersedes those selected migration assumptions without rewriting
history. Cardinality is settled; storage relocation is a deferred architectural
concern, not another unresolved blocking model decision.

## Deferred physical cleanup

Customer source-link storage cleanup is **DEFERRED**, not a prerequisite to
Shipment Backend Core. No next task is required to move Customer links, drop the
current FK/link_origin/check/index or add a 1:1 field on customers. No destination
schema, new table or migration is selected here, and no existing mapping or
provenance may be deleted.

If actual requirements/data/constraints justify relocation later, that task must
record its own design decision and provide:

- Many-source-to-one Customer cardinality and owner-scope preservation.
- A lossless inventory/backfill/full mapping-origin-provenance comparison,
  retention of confirmed human links beyond payload cleanup, and no arbitrary
  source selection, silent deletion/overwrite, payload rematching or unauthorized
  duplicate Customers.
- Reviewed cutover, validation, safe abort/rollback and genuine PostgreSQL tests,
  including two source identities pointing to one Customer, restart/retention,
  owner isolation, exact constraints, repeated deployment and rollback.
- Preservation of engine hashes/checkpoints/version/order/outcome fields, job
  counters/provenance, stored_files and security_audit_events. No rewrite of
  historical migrations or unreviewed worker permission changes.

Independently justified unused-field cleanup, including
`created_by_sync_job_id`/FK/Prisma `created_sync` if separately assessed, is an
independent follow-up. It is not bundled into this PR or silently required before
Shipment development. Source inspection of an absent writer is not a production
data audit or permission to discard historical provenance.

## Independent provider capabilities

| Pair                  | Design status                                                               |
| --------------------- | --------------------------------------------------------------------------- |
| (uniship, SHIPMENT)   | Current planned scope, subject to official API authorization; not activated |
| (carrier-b, SHIPMENT) | Illustrative future pair, not a provider registration                       |
| (carrier-b, CUSTOMER) | Illustrative future pair only if officially supported; not a registration   |

A future provider may supply Shipment only, Customer only or both. Reuse
NEXORA-042's exact static capability registry and existing scheduler/worker per
pair; the common production declaration source is still empty. No provider must
support both, no global Customer-before-Shipment order or worker per type, and no
capability from flags alone. Provider Customer identifiers do not automatically
identify Nexora Customers. Each real pair must independently establish official
API rights, normalization, stable versioned keys, processing contracts and
permissions before production activation. Any coordinated type ordering is a
separately evaluated provider-specific dependency, not a global invariant.

## Alternatives rejected and consequences

| Rejected approach                                         | Reason                                                                                                                                                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace                                                 | One organization per instance; one owner resolver supplies the current account scope and allows the approved later data-owner policy                                                                                        |
| Polymorphic link table                                    | Obscures typed FK/domain ownership; a domain-owned multi-source table is justified only by actual merging                                                                                                                   |
| API configuration in DB                                   | Protocol/validation/identity changes require code review, not mutable runtime execution configuration                                                                                                                       |
| One domain column per Sync engine table                   | Couples the engine to every added domain; existing Customer storage is a bounded compatibility exception, not a precedent                                                                                                   |
| Fixed fee columns                                         | A closed charge-code collection models the selected fees without a new column per fee                                                                                                                                       |
| Store raw response then reinterpret mapping on every read | Source-to-record mapping must outlive payload retention (ADR-010), and human linking decisions such as LINKED_EXISTING cannot be recomputed from provider data; re-matching on every run risks duplicates and wrong merges. |

The cost is explicit per-domain bindings, the documented temporary Customer
persistence exception and verified provider contracts before activation. Benefits are stable ownership,
scoped writes, queryable minimal state and extensibility without a launcher,
framework, workspace or new service. [ADR-008](tactical-ddd.md) still governs
aggregate encapsulation, locked hydration and minimal persistence.
