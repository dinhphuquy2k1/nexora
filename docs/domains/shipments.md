# Shipment domain

## Status and first scope

**DESIGNED, not implemented**, under [ADR-011](../decisions/shipment-domain-data-ownership.md).
There is no Shipment schema, migration, production adapter or read API yet.
Nexora owns the domain; the approved first scope is
`shipment_kind = RETAIL_PARCEL` (kiện TMĐT/kiện lẻ) from Uniship. Bulk shipments,
import/export entrustment (Ủy thác XNK), a second carrier, manual entry and Excel
imports are later extensions. No provider data or API contract is invented here.

## Ubiquitous language and aggregate

| Term            | Meaning                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| Shipment        | Nexora's parcel record, independent of provider DTOs                              |
| Source          | Stable scoped provider identity, linked through source_identity_id                |
| Provider status | Original carrier status code, retained verbatim                                   |
| Logistics stage | Nexora's mapped physical stage, separate from claim state                         |
| Claim           | Carrier-reported claim status, distinct from future internal claim cases          |
| Charge          | A monetary line reported by the carrier with currency and optional original label |
| Stage history   | Append-only observation of a stage transition and its source version              |

**Shipment is the aggregate root; charges are children within its consistency
boundary.** Stage history is append-only, not a mutable aggregate child. Lists,
search and tab counts are read-model projections and do not hydrate aggregates.
Domain owns transitions/value invariants and immutable copies; Application
orchestrates strict use cases/ports; Infrastructure owns locked hydration and
scoped persistence under [ADR-008](../decisions/tactical-ddd.md). No generic full
aggregate save, shared-domain framework or cross-domain repository writer.

## Owner and column authority

The owner is the account that connected and synchronized the carrier, resolved
for **every query and command through resolveShipmentOwner**. Use the Customer
resolver pattern; do not spread `owner = actor` assignments. ADMIN has no implicit
cross-owner bypass. A dedicated company connector account is recommended.
[ADR-011](../decisions/shipment-domain-data-ownership.md) records the approved later
single-instance `users.is_data_owner` direction and ADMIN/OPERATOR permission
matrix; neither is implemented now. Workspace is excluded.

Provider-owned fields can only be updated by Sync. Nexora-owned customer
assignment, internal notes, labels/assignment and later business operations are
never overwritten by Sync. The binding allowlists carrier fields, not the full
payload/record. All customer/assignee references must obey the resolved ownership
and authorization boundary; an FK alone is not permission. Nexora write commands
are a later task, separate from ingestion.

## Three independent status layers

1. `provider_status`: original provider code, not a UI label or inferred enum.
2. `logistics_stage`: closed vocabulary `TO_ORIGIN_WAREHOUSE`,
   `AT_ORIGIN_WAREHOUSE`, `TO_DEST_WAREHOUSE`, `AT_DEST_WAREHOUSE`, `DELIVERED`,
   `UNKNOWN`.
3. `provider_claim_status`: original provider claim state, separate from physical
   movement. Internal claim dossiers belong in a later separate table.

Unknown original codes are retained, mapped to UNKNOWN and accompanied by a
warning for mapping work. Do not use NEEDS_REVIEW merely for an unknown code;
that outcome requires a human business decision. No invented status, cancellation
or return mapping, money, exchange rate or provider timestamp fallback.

### Uniship mapping — PROVISIONAL

This is based on the interface labels only. **Original codes are not verified**;
the table does not establish an authorized adapter or a source code dictionary.

| Observed UI label | Planned logistics_stage |
| ----------------- | ----------------------- |
| Đang đến kho gửi  | TO_ORIGIN_WAREHOUSE     |
| Đã về kho gửi     | AT_ORIGIN_WAREHOUSE     |
| Đang về kho nhận  | TO_DEST_WAREHOUSE       |
| Đã về kho nhận    | AT_DEST_WAREHOUSE       |
| Đã giao hàng      | DELIVERED               |

### Retail tabs are presentation state

The existing Retail fixture types have six statuses plus `all`; these are not
persisted Shipment status codes. Plan a distinct `RetailTabKey` with an exhaustive
typed mapping function using stage **and claim** inputs. The following maps the
current UI keys without changing them in this task:

| UI key               | Filter meaning                                      |
| -------------------- | --------------------------------------------------- |
| to_origin            | TO_ORIGIN_WAREHOUSE                                 |
| at_origin            | AT_ORIGIN_WAREHOUSE                                 |
| in_transit           | TO_DEST_WAREHOUSE                                   |
| at_dest              | AT_DEST_WAREHOUSE                                   |
| delivered            | DELIVERED                                           |
| disputed (Khiếu nại) | Open claim, regardless of logistics stage           |
| all (Tất cả)         | All records; UNKNOWN is visible here with a warning |

The five stage tabs follow logistics_stage. The claim tab overlaps physical stages
and is not a sixth logistics stage. UNKNOWN appears only in Tất cả with a warning.
A provider-specific definition of an open claim must be verified, not invented.
Counts come from the server's scoped filters, not sums of a page or sums of
possibly overlapping tabs. Missing/unavailable data is not fabricated as zero.

## Schema draft — not a migration

[Database conventions](../architecture/database.md#naming-conventions-for-new-tables)
apply prospectively: singular PascalCase models, mapped plural snake_case tables,
camelCase mapped fields, scalar VARCHAR plus CHECK and Timestamptz(3). Money is
NUMERIC, never a floating-point recalculation; future JSON money is a decimal
string per the API contract. This draft creates no table or grant.

### shipments

| Group / authority          | Planned columns and constraints                                                                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/ownership         | id; owner_user_id; code UNIQUE, database-generated using the Customer sequence/function pattern (no chosen prefix or client counter); source_identity_id UUID UNIQUE NULL FK RESTRICT; carrier_connection_id NULL FK SET NULL; provider NULL; shipment_kind |
| Provider-owned parcel data | tracking_code (not UNIQUE); origin_warehouse; service_level; weight_kg NUMERIC(10,3); package_count; item_count                                                                                                                                             |
| Provider-owned money       | declared_value + declared_currency; total_amount + total_currency; exchange_rate NUMERIC(18,6) + exchange_rate_at                                                                                                                                           |
| Provider-owned lifecycle   | provider_status; logistics_stage; provider_claim_status; provider_updated_at; last_synced_at                                                                                                                                                                |
| Nexora-owned business data | customer_id NULL FK RESTRICT; assignee_user_id NULL; internal_note; updated_by_user_id                                                                                                                                                                      |
| Database metadata          | created_at; updated_at                                                                                                                                                                                                                                      |

`provider` uses Carrier's provider contract, including its current length source;
Shipment vocabulary lives in the new domain shared leaf, not repeated literals.
A source is scoped by owner/provider/account/type/versioned key scheme.
`carrier_connection_id` can become NULL after a hard connection deletion without
losing source identity or Shipment. A tracking code is not a stable unique key.
Retain amounts, currency, rate and rate time as reported; do not derive missing
values, recompute fees/totals or assume CNY/VND merely from a fixture.

Required checks:

- `CHECK ((source_identity_id IS NULL) = (provider IS NULL))`.
- `CHECK (provider_status IS NULL OR provider IS NOT NULL)`.
- Closed stored vocabularies (shipment kind and logistics stage) use VARCHAR plus
  exact CHECK/parity tests, not TypeScript/Prisma/PostgreSQL enums.

Planned indexes:

- `(owner_user_id, logistics_stage, created_at DESC, id DESC)`.
- `(owner_user_id, created_at DESC, id DESC)`.
- `(owner_user_id, tracking_code)`.
- Partial index for open claims (predicate to follow verified provider claim
  semantics; no unverified original codes).
- Partial index where `customer_id IS NOT NULL`.

### shipment_charges

`id`, `shipment_id FK CASCADE`, `line_no SMALLINT NOT NULL`, `charge_code`, `amount NUMERIC(18,2)`,
`currency CHAR(3)`, `provider_label`.

`charge_code` is the closed set UNIT_PRICE, DOMESTIC_SHIPPING, INSURANCE, COUNTING,
WOOD_PACKING, BUBBLE_WRAP, OTHER. `line_no` preserves the provider's fee-line order,
starting at 1. `UNIQUE (shipment_id, line_no)` identifies a line; `charge_code` is
not unique. A parcel may have multiple lines with the same charge_code, for
example several OTHER lines or several domestic shipping legs. Do not merge
lines. Sync replaces the complete charge set in source order within the same
transaction as one explicit provider-owned aggregate operation, not a generic
full-aggregate save. No fixed per-fee Shipment columns.

### shipment_stage_history

`id`, `shipment_id UUID NOT NULL FK CASCADE`, `from_stage NULL`, `to_stage`, `provider_status`,
`provider_changed_at NULL`, `observed_at`, `sync_job_id NULL FK SET NULL`,
`source_version INTEGER NOT NULL`, `processor_version INTEGER NOT NULL`.

`UNIQUE (shipment_id, source_version, processor_version)` makes transition observations idempotent;
index `(shipment_id, observed_at)` supports history reads. History is append-only
and written when the stage changes. Original provider time may be absent; observed
local time does not pretend to be provider_changed_at. No mutable history child or
invented transition event. Reprocessing the same source_version with a new
processor_version (for example after mapping a previously UNKNOWN provider code)
can append the transition UNKNOWN → the mapped stage. Repeating the same data
with the same processor still cannot create duplicate history. A processor change
alone never inserts history when the stage does not change. Source version tracks
the observed payload version; processor version tracks processing/mapping semantics,
so a processor upgrade does not manufacture a new source version. These meanings
follow the existing Sync version contract.

Future SQL design fragment only (not a migration or schema change in this PR):

```sql
shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
source_version INTEGER NOT NULL,
processor_version INTEGER NOT NULL,
UNIQUE (shipment_id, source_version, processor_version)
```

All three fields are NOT NULL because PostgreSQL UNIQUE permits repeated NULLs.
This single history identity supports append-only actual stage changes and
idempotent retries; there is no second history key scheme.

### Later tables

`shipment_tags`, `shipment_claim_cases`, `shipment_reconciliations` are deferred.
The internal claim case is independent of provider_claim_status.

## Sync ingestion and read flow

`sync_configs → sync_jobs → adapter (code) → sync_source_identities + provider_source_records → processor → Shipment domain binding → read API`.

1. Adapter code owns URL/auth/pagination/key extraction/response validation;
   identity schemes are versioned (for example uniship-parcel-v1). Changing a key
   requires a new scheme and data-transition plan. DB configuration holds only
   schedules/enabled flags/watermarks and encrypted secrets, alongside unchanged
   operational engine state.
2. Normalize only necessary authorized fields and minimize personal data;
   do not retain a raw response to reinterpret it on every read.
3. Processor uses the existing narrow session. Binding finds the Shipment by
   source_identity_id within the immutable source scope, creates it or updates
   only the provider-owned set, replaces charges and appends history for a stage
   change; an unknown code yields UNKNOWN plus warning.
4. Binding runs inside Sync's authorization/lease/version-fenced transaction.
   Domain writes, history, source outcome and bookkeeping commit together with the
   final fence. Reuse the existing ACTIVE user→epoch→connection→job order and
   scoped domain locks; never network under locks. Unique source/history keys,
   version checks and unchanged-payload no-write with the same processor preserve idempotency. No separate
   scheduler/worker or in-memory consistency substitute.
5. API reads persisted scoped projections, not provider payloads or full aggregates
   for lists. Charges are fetched for detail; history is a separate projection.

Source linkage belongs to its domain, not new Sync engine columns. Shipment keeps
its selected unique nullable source_identity_id; Customer currently permits
multiple source identities per Customer. Customer cleanup is **blocked** by
[ADR-011's open cardinality issue](../decisions/shipment-domain-data-ownership.md#customer-source-cardinality--open-plan-issue).
The original future Customer 1:1 target is an intentional restriction, not current
behavior. The Customer-owned link-table alternative is not accepted automatically;
the owner left the choice open. Preserve all mappings/origins/provenance, explicitly
assess two sources sharing one Customer, and do not remove old linkage until a
settled, lossless transition passes genuine PostgreSQL migration tests. Safe abort
alone does not settle that model. Cleanup of unused created_by_sync_job_id remains
planned subject to provenance validation. No migration or registration is added;
the production registry remains empty.

## Planned read API

These are design targets, **not registered routes or generated SDK contracts**:

| Endpoint                       | Planned contract                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| GET /api/shipments             | Stage/claim filters, tracking_code search, server-side pagination and counts per tab |
| GET /api/shipments/:id         | Owner-scoped Shipment detail including charges                                       |
| GET /api/shipments/:id/history | Owner-scoped append-only stage history                                               |

Every query/count includes the resolved owner and matching search scope; stable
ordering uses created_at DESC/id DESC. Use indexed bounded projections without
list N+1, full aggregate hydration or provider requests. Exact transport DTOs,
filter parameter names/bounds, error mapping and generated SDK changes are a
separate backend task under the existing authentication/no-store/error contract.
Nexora business write commands are later work.

## Seven Uniship verifications before an adapter

1. Full original status-code catalog and exact mappings.
2. Whether claims are a status or an independent flag, including open semantics.
3. Stable source identity key and its uniqueness scope.
4. Incremental sync support (updated_at/cursor) and ordering contract.
5. Fee detail, currencies, exchange rates and rate timestamps.
6. Official API access permission and allowed use/storage scope.
7. Cancellation, return and exceptional flows.

Until verified, mappings remain PROVISIONAL and production capabilities remain
unregistered. UI fixtures and passing synthetic tests do not supply API rights.

## Implementation roadmap

1. This documentation design task (NEXORA-049).
2. Settle CUSTOMER_SOURCE_CARDINALITY with the owner before Customer Sync cleanup;
   then perform the authorized lossless forward migration, grants, two-source
   PostgreSQL migration tests and docs, including unused provenance-FK cleanup.
   No implementation while the issue remains open.
3. Shipment backend core: aggregate, schema, fenced persistence and read API;
   test-first domain and genuine PostgreSQL status/FK/uniqueness/rollback tests.
4. [NEXORA-045](../tasks/active/NEXORA-045-pager-filter-convergence.md) in parallel;
   complete shared Pager/filter follow-ups before Shipment UI integration.
5. Connect Retail UI to real read API with exhaustive tab mapping.
6. Uniship adapter only after official documentation and the seven verifications.
7. Later: multi-employee data-owner access and Nexora business operations,
   manual/Excel ingestion and further shipment kinds/providers.
