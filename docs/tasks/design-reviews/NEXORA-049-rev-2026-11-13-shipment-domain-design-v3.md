# NEXORA-049 — Shipment and Customer Sync architecture

## Task metadata and classification

Task ID: NEXORA-049
Classification: SIGNIFICANT
Plan revision: rev-2026-11-13-shipment-domain-design-v3
Reviewed baseline: 8cc0feb742808ea26c5f74ed245b87d7c740764b
Branch: docs/shipment-domain-design

## Reuse & design audit

| Field                    | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Shipment/Customer relationship and provider capability design; documentation-only v3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Existing implementations | schema.prisma has nullable nonunique sync_source_identities.customer_id, link_origin, Customer.syncSources collection and nonunique partial index20261104000000_sync_fk_indexes; customer-sync-domain.binding.ts locks/checks owner and immutable source target, stages proposals and commits LINKED_EXISTING under engine fencing; CustomerSyncSession exposes existingCustomerId/linkExistingCustomer; sync-runtime-capabilities.ts production declarations are empty; Sync integration tests cover distinct links, retention, processor upgrades and immutable targets |
| Domain owner             | Shipment owns provider state and internal user-managed customer association; Customer owns matching/link validation; Sync owns durable source representation, versions/checkpoints and fenced execution                                                                                                                                                                                                                                                                                                                                                                   |
| Reuse alternatives       | Reuse existing Customer mapping and exact provider/type registry; reject Customer 1:1 restriction, new customer_source_links/other mapping tables now, runtime-only/rematched decisions, provider-wide mandatory CUSTOMER+SHIPMENT support or per-type workers                                                                                                                                                                                                                                                                                                            |
| Selected approach        | Preserve many-source-to-one Customer mapping in existing source identity fields as a bounded compatibility exception; current planned Uniship is SHIPMENT-only; independent future provider capabilities; no storage relocation prerequisite to Shipment Core                                                                                                                                                                                                                                                                                                             |
| Rationale                | Existing persistence/binding already satisfies durable multi-source Customer links; the business needs internal Shipment linking, not invented Uniship Customer Sync or new mapping infrastructure                                                                                                                                                                                                                                                                                                                                                                        |
| Risks                    | Confusing two relationships, Sync overwriting user customer assignment, discarding LINKED_EXISTING/provenance after retention, propagating the Customer-specific storage exception to new domains, implying planned capability is active                                                                                                                                                                                                                                                                                                                                  |
| Verification             | Five local checks; v1/v2 immutable bytes/digests, v3 raw digest and exact PR binding; cross-document scan/independent review; docs-only diff; fresh hosted Preflight/Foundation. Future genuine domain/PostgreSQL tests belong to implementation tasks, not this PR                                                                                                                                                                                                                                                                                                       |

## Delta, owner decision and provenance

The latest owner clarification supersedes the original Customer 1:1 migration
target and v2's unresolved choice. **CUSTOMER_SOURCE_CARDINALITY is RESOLVED at
the cardinality-decision level:** multiple external Customer source identities
may map to one internal Nexora Customer. Reuse current durable mapping storage;
no new table, no mandatory next-task relocation, no cleanup prerequisite to
Shipment Core. Physical storage cleanup is DEFERRED, non-blocking and has no
selected destination schema. This does not change Shipment's one-source model.

V1 and v2 remain immutable historical plans, including the owner's earlier
"Chưa quyết định; ghi PLAN ISSUE" response and the v2 unresolved verdict:

- NEXORA-049-rev-2026-11-13-shipment-domain-design-v1.md, raw SHA-256
  015be8d1a5f4d614ddcf1e6916c5780f0408b6ad38b3c20e2075a9f674a14533.
- NEXORA-049-rev-2026-11-13-shipment-domain-design-v2.md, raw SHA-256
  0fee82c1254c51c0afb7a90f79133fa7c0b82e4320cfabae154bed00a71a9984.

## Scope and read-only inspection

NEXORA-049 remains SIGNIFICANT, documentation/design only, on existing PR #46.
Read the AGENTS/AI entry route, ADR-008/010/011, Customer/Shipment and database/
Sync guides, task and immutable snapshots; inspect schema, index migration,
Customer binding/session, empty production registry and current integration
fixtures. The nullable nonunique FK and per-source binding already support the
required cardinality. Existing code is reused conceptually, never changed here.
No implementation, migration, new table, API/SDK, grant, test, dependency,
provider registration, live call, deployment, branch/PR creation or merge.

## Two independent relationships

### Shipment to internal Nexora Customer

Shipment id is internal stable identity; source_identity_id identifies the
external Shipment source; customer_id is Nexora-owned assignment. It may start
NULL. Multiple Shipments, including different provider sources, may reference
one owner-scoped Customer. An authorized future Nexora command can link an
existing eligible Customer; unlink/relink is a separate authorized business
command. Preserve owner isolation, authorization and Customer lifecycle rules.
Shipment Sync writes only provider-owned fields and never overwrites or silently
infers customer_id. Ingesting a valid Shipment needs neither Customer creation
nor matching. Do not assume Uniship supplies a Customer ID/API. Linking API and
commands remain outside this PR.

### External Customer source to internal Nexora Customer

For a provider actually supporting CUSTOMER, reuse
sync_source_identities.customer_id/link_origin. Different identities can map to
one Customer, scoped by owner/provider/account/SyncType/stable identity and its
scheme. Customer Domain/processor owns eligibility, matching and linking decisions;
its trusted binding validates and commits the durable result under locks/fences.
Code owns the decision; current persisted source identity owns the recorded
result. Reuse confirmed mappings across restart, resync, payload changes and
retention; preserve LINKED_EXISTING. A source must not silently change its target.
Never automatically merge by name, phone, tracking code or unverified provider
information; genuine human decisions retain NEEDS_REVIEW. No new matching algorithm
or Customer create/update handler is selected or implemented.

## Bounded persistence exception and alternatives

Customer Domain retains decision/validation ownership while Sync retains the
existing Customer-specific FK/link_origin representation. The engine is not
already completely free of Customer fields. This is a specific compatibility
exception for existing Customer storage, not new generic Sync mapping logic or
a precedent for other domains. Add no Shipment-specific Sync column.

Rejected now: customer_source_links or another mapping table (unneeded physical
change for the clarified scope); Customer 1:1 field (narrows supported behavior,
explicitly superseded); runtime-only links/payload rematching (cannot durably
reproduce human decisions); polymorphic mappings; mandatory Customer-before-
Shipment/provider-wide capability bundles or worker per type.

Future physical relocation needs a separately recorded, justified design based on
actual requirements/data/constraints. No destination schema is selected. Preserve
many-source-to-one cardinality, owner scope, every mapping/origin/provenance,
engine hash/checkpoint/version fields and job provenance. Require lossless
backfill/comparison, safe abort/rollback and genuine PostgreSQL tests including
two sources to one Customer, retention/restart and owner isolation before removing
anything. No existing mapping or provenance is deleted here. Unused field cleanup
(including created_by_sync_job_id/FK/created_sync if independently justified)
requires its own assessment and is not bundled here or required before Shipment.

## Independent provider capabilities

Current planned Uniship integration supplies SHIPMENT only, subject to official
API authorization. CUSTOMER Sync is not its prerequisite or current scope.
Illustrative future carrier-b can support SHIPMENT, CUSTOMER or both through
independent exact pairs. It is not a real provider declaration/registration.
Preserve NEXORA-042 static capability resolution and one empty production source
for API/worker; reuse scheduler/worker without changes per pair. No capability
from flags alone, implicit Customer identity inference, global type ordering or
worker per type. Each real pair independently verifies official API rights,
normalization, stable versioned keys, processing contract and permissions.
Provider-specific coordinated ordering, if needed, gets a separate evaluation.

## Preserved Shipment modeling and contracts

RETAIL_PARCEL first, Nexora-owned Shipment Aggregate Root with charge children;
append-only history is not an editable child, lists/counts are read projections.
Shipment keeps source_identity_id UUID UNIQUE NULL FK RESTRICT. Provider status,
logistics stage and provider claim status remain distinct; unknown original codes
stay verbatim, stage UNKNOWN with warning, not automatically NEEDS_REVIEW.
Uniship UI-derived mappings stay PROVISIONAL. No inferred amounts/currencies/rates.
Charge line_no SMALLINT NOT NULL starts at 1; UNIQUE (shipment_id, line_no),
repeated charge_code lines stay separate and ordered, replaced transactionally.
History has shipment_id UUID NOT NULL FK CASCADE, source_version INTEGER NOT NULL,
processor_version INTEGER NOT NULL and only
UNIQUE (shipment_id, source_version, processor_version). New processor can remap
UNKNOWN on the same source version, retries cannot duplicate history, and an
unchanged mapped stage never appends history. Current Shipment API/UI remain
PLANNED; no runtime feature or provider authorization evidence is fabricated.

## Security, concurrency and query cost

Retain resolveShipmentOwner and existing owner/ACTIVE-session/Customer lifecycle
rules; no ADMIN cross-owner bypass or Workspace. Reuse canonical Sync transaction,
lease/generation/processor fences and Customer locked scoped validation. No
network under locks or generic cross-domain writer. Persist only necessary
provider fields; do not mass-assign Nexora-owned customer_id. Unchanged payload
with the same processor causes no write. Lists use indexed owner/filter/order
projections without aggregate hydration/N+1; detail charges and history remain
separate scoped queries. No new query/index/cache or performance claim here.

## Compatibility and future test-first plan

This decision preserves current physical Customer relationships, constraints,
roles/grants, binding and registry; no current data migration is necessary.
Existing Customer profile/address lifecycle and immutable source-target behavior
stay unchanged. Future Shipment Core tests first cover valid customer-less ingest,
provider updates retaining assigned customer_id, owner/lifecycle isolation,
separate authorized linking, exact source identity, ordered repeated fees and
processor-aware history/rollback/retries. Future provider-specific Customer tests
cover multi-source confirmed decisions surviving restarts, payload changes and
retention, no silent relink/automatic merge and NEEDS_REVIEW. Future storage work,
only if justified, separately supplies lossless PostgreSQL migration tests.
No new tests/code are written in this documentation PR. Official API/processing/
permissions and final activation gates remain prerequisites to actual adapters,
not a demand for Uniship Customer Sync before Shipment Core.

## Plan readiness

The new owner instruction resolves the former cardinality P2; physical storage
relocation is a non-blocking deferred concern, not another open model choice.
Existing authorized-provider prerequisites remain future implementation gates.
Independent review must check all canonical docs for stale 1:1/mandatory-cleanup
instructions and false durable/runtime claims. No new architectural conflict is
known at plan time; record any real new issue instead of inventing approval.

## Plan

1. Verify current PR/branch/baseline, current binding/registry and v1/v2 raw bytes.
2. Record this v3 plan/task before canonical edits, format then hash raw bytes;
   do not change v1/v2 or v3 after hashing.
3. Resolve Customer cardinality in ADR-011 using the latest owner decision;
   document the two relationships and bounded existing-storage exception.
4. Synchronize Shipment dependencies/roadmap, Sync capability guide, database
   future guidance and directly conflicting ADR-010 cleanup note only.
5. Verify unchanged accepted fees/history, source/provider rules, all historical
   evidence, old/new digests, exact metadata, docs-only scope and five local checks;
   obtain independent design review and record real results.
6. Synchronize five PR metadata fields before normal push to existing PR #46,
   wait for fresh Preflight/Foundation, inspect and retain failure/attempt evidence
   under bounded rerun policy; no extra SHA-only task commit.
7. Report actual merge readiness from executed checks/review; never merge, deploy,
   enable auto-merge or implement migration/Sync. Close task only under §1.7 later.
