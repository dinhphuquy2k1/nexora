# Shipment domain

## Status and first scope

**Core implemented by NEXORA-050; provider activation remains deferred**, under [ADR-011](../decisions/shipment-domain-data-ownership.md).
The schema, fenced Domain binding and three read APIs are implemented; there is no authorized production Shipment adapter or registration.
Nexora owns the domain; the approved first scope is
`shipment_kind = RETAIL_PARCEL` (kiện TMĐT/kiện lẻ) from Uniship. Bulk shipments,
import/export entrustment (Ủy thác XNK), a second carrier, manual entry and Excel
imports are later extensions. No provider data or API contract is invented here.
The current planned Uniship scope is SHIPMENT-only. Uniship Customer Sync is not
required or included; official Shipment API authorization still gates the adapter.

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

## Shipment–Customer association belongs to Nexora

`shipments.id` is internal identity, `source_identity_id` identifies the external
Shipment, and `customer_id` is the independent Nexora-owned Customer association.
A Shipment can start with customer_id NULL. Valid ingestion requires neither
Customer creation nor matching, and does not assume a Uniship Customer ID/API.
Multiple Shipments from different provider sources can reference one internal
Customer. Only an authorized future Nexora command can link an existing eligible
owner-scoped Customer; preserve current authorization, isolation and Customer
lifecycle constraints. Unlink/relink is a separate business command.

Shipment Sync only updates provider-owned fields. It never overwrites or silently
infers customer_id, even if a provider payload changes or contains a Customer-like
identifier. The linking API/commands remain outside this PR. External Customer
source mapping for a future CUSTOMER-capable provider is a different relationship,
owned by Customer Domain and persisted through the existing Sync source fields.

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

## Core schema

[Database conventions](../architecture/database.md#naming-conventions-for-new-tables)
apply prospectively: singular PascalCase models, mapped plural snake_case tables,
camelCase mapped fields, scalar VARCHAR plus CHECK and Timestamptz(3). Money is
NUMERIC, never a floating-point recalculation; API JSON money is a decimal
string per the API contract. The forward migration 20261113000000_shipment_core creates the three tables; runtime provisioning applies scoped grants.

### shipments

| Group / authority          | Columns and constraints                                                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/ownership         | id; owner_user_id; code UNIQUE, database-generated using shipment_code_seq/next_shipment_code(), SHP plus at least six digits; source_identity_id UUID UNIQUE NULL FK RESTRICT; carrier_connection_id NULL FK SET NULL; provider NULL; shipment_kind |
| Provider-owned parcel data | tracking_code (not UNIQUE); origin_warehouse; service_level; weight_kg NUMERIC(10,3); package_count; item_count                                                                                                                                      |
| Provider-owned money       | declared_value + declared_currency; total_amount + total_currency; exchange_rate NUMERIC(18,6) + exchange_rate_at                                                                                                                                    |
| Provider-owned lifecycle   | provider_status; logistics_stage; provider_claim_status; provider_updated_at; last_synced_at                                                                                                                                                         |
| Nexora-owned business data | customer_id NULL FK RESTRICT; assignee_user_id NULL; internal_note; updated_by_user_id                                                                                                                                                               |
| Database metadata          | created_at; updated_at                                                                                                                                                                                                                               |

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

The forward migration enforces:

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
   only the provider-owned set, reconciles explicitly complete charges (preserving omitted collections) and appends history for a stage
   change; an unknown code yields UNKNOWN plus warning.
4. Binding runs inside Sync's authorization/lease/version-fenced transaction.
   Domain writes, history, source outcome and bookkeeping commit together with the
   final fence. Reuse the existing ACTIVE user→epoch→connection→job order and
   scoped domain locks; never network under locks. Unique source/history keys,
   version checks and unchanged-payload no-write with the same processor preserve idempotency. No separate
   scheduler/worker or in-memory consistency substitute.
5. API reads persisted scoped projections, not provider payloads or full aggregates
   for lists. Charges are fetched for detail; history is a separate projection.

Shipment source linkage remains on shipments; no Shipment-specific column enters
Sync. Customer source cardinality is many sources → one Customer, now
[resolved by ADR-011](../decisions/shipment-domain-data-ownership.md#customer-source-cardinality--resolved).
The current Customer source FK/link_origin representation is retained as a bounded
compatibility exception; Customer owns decisions/validation and confirmed results
remain durably persisted across restarts, resync, payload change and retention.
No new table, matching algorithm or storage relocation is required for Shipment
Core. Customer physical cleanup is DEFERRED, non-blocking, with no selected
destination schema. Unused-field cleanup needs its own justified assessment.
The production capability registry remains empty; this design activates nothing.

## Read API

These authenticated routes have generated OpenAPI/SDK contracts:

| Endpoint                       | Contract                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| GET /api/shipments             | Stage filter, tracking search, pagination, scoped counts; claim semantics explicitly unavailable |
| GET /api/shipments/:id         | Owner-scoped Shipment detail including charges                                                   |
| GET /api/shipments/:id/history | Owner-scoped append-only stage history                                                           |

Every query/count includes the resolved owner and matching search scope; stable
ordering uses created_at DESC/id DESC. Use indexed bounded projections without
list N+1, full aggregate hydration or provider requests. q searches literal tracking text; stage uses the closed stage vocabulary; page/pageSize follow shared validation (default 1/20, maximum 100). Counts share owner/q, ignore page/stage and include UNKNOWN. Claim count is null, claimFilterAvailable=false; claim=open returns CLAIM_FILTER_UNAVAILABLE (503). Detail exposes decimal strings and charges ordered by lineNo; history is paginated observedAt DESC/id DESC. Existing authentication/no-store/error envelope applies.
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

1. This documentation design task (NEXORA-049), with cardinality resolved by v3.
2. Shipment backend core: aggregate, schema, fenced persistence and read API;
   test-first domain and genuine PostgreSQL status/FK/uniqueness/rollback tests.
3. [NEXORA-045](../tasks/active/NEXORA-045-pager-filter-convergence.md) in parallel;
   complete shared Pager/filter follow-ups before Shipment UI integration.
4. Connect Retail UI to real read API with exhaustive tab mapping.
5. Uniship Shipment adapter only after official documentation and the seven verifications.
6. Later: independently authorized provider Customer/Shipment capabilities and
   separately justified storage/unused-field cleanup (not prerequisites to Core);
   multi-employee data-owner access and Nexora business operations,
   manual/Excel ingestion and further shipment kinds/providers.

Customer Sync is not a prerequisite to Uniship Shipment Sync or Shipment Core.
Future providers may support CUSTOMER, SHIPMENT or both through independent
static pairs; any provider-specific coordinated ordering needs its own evaluation.
No scheduler/worker per type, implicit external Customer matching or flag-only
activation is introduced. All first-scope mappings remain PROVISIONAL until
original provider codes and official rights are verified.

## Core implementation contract — NEXORA-050

Before implementation, the normalized provider command distinguishes an absent
`charges` collection (preserve current lines), an explicit `{complete: true,
lines: [...]}` valid snapshot (reconcile every ordered position), an explicit
complete empty snapshot (clear), and partial/malformed/ambiguous data (reject the
entire source proposal; preserve current state). A later authorized adapter must
prove completeness from its official API contract; synthetic fixtures do not.
Reconcile by `line_no`: preserve unchanged row IDs, update changed position values,
insert new positions and delete absent positions only for complete snapshots.
Order changes update position contents without moving unique keys. No generic
aggregate save, bulk delete/reinsert, money conversion or total recomputation.
Amounts are decimal strings validated against precision/scale before PostgreSQL
can round. Charge labels do not establish unverified provider meanings.

The current core code convention is `SHP000001` (at least six sequence digits),
`shipment_code_seq` and `next_shipment_code()`, following the Customer pattern.
PostgreSQL generates this internal business identifier from one global sequence
per Nexora instance: 1 → SHP000001, 123 → SHP000123, 999999 → SHP999999 and
1000000 → SHP1000000. Six digits is a minimum width, not a maximum. Allocation
never resets per date, owner, carrier or account; rollback/consumption gaps are
acceptable, so numbering is not gapless. Database UNIQUE protects code identity.
Provider payloads cannot assign/mutate code. External tracking_code may repeat,
and Sync matches source_identity_id, never this internal code.
V3 supersedes v2's historical VD implementation decision; verification evidence
and immutable historical snapshots remain in the active task.

Provider-only creation takes a separate trusted owner/source/provider/connection
scope. Root ID/code remain unassigned until DB persistence. Hydration loads the
actual root and ordered Charge children under locks; provider operations cannot
set identity or Nexora-owned state. Snapshot copies preserve current omitted fees.
An explicit normalized providerChangedAt supplies a history-only stage time;
providerUpdatedAt remains the root source-update time. Omitting stage time means
NULL in history, never a fallback to source update or local observation time.

last_synced_at records the last applied provider operation, not every unchanged
fetch. An unchanged payload with the same processor is skipped by the Sync engine
and does not rewrite Shipment/charges/history merely to update this timestamp.
