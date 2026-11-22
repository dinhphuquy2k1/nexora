# How to add a new Sync Provider / Data Type

Phase A (NEXORA-042) extends the existing ADR-010 engine. It does not implement
live Uniship fetching, Shipment persistence or Customer business matching. The
production registry is intentionally empty; flags and API URLs cannot create a
capability or authorize traffic. Existing Sync V1 scheduling, queue and worker
remain the execution path.

## Current extension boundary

`sync/application/sync-capability.port.ts` defines exact provider+SyncType lookup.
`sync/infrastructure/sync-capability.registry.ts` binds each pair to a SyncProvider
and a trusted infrastructure Domain binding. Duplicate pairs and invalid versions
fail startup; unsupported pairs/strategies/processors resolve unavailable. A
captured processor version must agree throughout staging/application. Registries
have no runtime mutation API, plugin loader or database-configured code.
Registration rejects provider names longer than `CARRIER_PROVIDER_MAX_LENGTH` (Carrier domain).

API and worker both call `createSyncRuntimeCapabilities()` from the same
`sync-runtime-capabilities.ts` declaration source. They have independent instances,
not shared memory, credentials or clients. Repository availability also requires
only the global SYNC_ENABLED switch in addition to the registry. Executor uses its queue's resolver and cannot
receive an unrelated fetcher/processor pair; repository resolves the matching
Domain binding again inside its fenced transaction.

SyncSource contains only id/sourceVersion/processorVersion/payload. The neutral
session has immutable owner/connection/source/provider/account/type scope. The
Customer-owned session separately exposes existingCustomerId/linkExistingCustomer;
only its infrastructure binding reads/locks Customer and persists the existing
owner-scoped FK/link_origin. Sync alone writes applied-job provenance. A non-Customer binding need not fabricate that link.

## Extension procedure

1. **Select provider and existing SyncType.** Check current Carrier registration,
   account/lifecycle and ownership contracts as well as Sync vocabulary. Phase A
   accepts only SHIPMENT/CUSTOMER, even for fixtures. Carrier currently supports
   Uniship; adding a real carrier also needs its separately reviewed Carrier work.
2. **Establish official API authorization and data permission.** Obtain documented
   endpoints/schema, allowed payload fields/retention and account identity. Do not
   scrape or infer an API. Review credential custody, acquisition budget, grants
   and live authorization before wiring any external implementation.
3. **Implement the existing SyncProvider port.** `strategy(provider,type)` is a
   synchronous capability declaration, not network I/O. `fetch(job,signal)` returns
   bounded normalized pages and respects cancellation, existing FULL/INCREMENTAL
   meaning, nextPage/nextCursor and watermark. Keep network/crypto outside DB locks.
4. **Normalize identity and payload.** Reuse sourceKey/canonicalPayload/payloadHash.
   Provider normalization defines field semantics; do not trim/NFC identifiers in
   the generic engine. Keep stable key scheme/full-key comparison, owner/provider/
   account/type separation, ordering, size limits and minimal authorized payload.
5. **Declare the pair once.** Edit the static declarations in
   `sync-runtime-capabilities.ts` only after a real approved implementation exists.
   Pair the provider with the correct Domain binding/processor version. Do not add
   a second list in app.module or worker module, environment-driven handlers,
   test fixture imports or implicit enabled registrations.
6. **Reuse or implement the Domain processor and its narrow capability.** Domain
   decisions retain their owning aggregate/commands and validation. A trusted
   infrastructure binding constructs typed capabilities inside the existing fenced
   transaction, after current owner/source/version checks. Processor never receives
   Prisma, SQL, a transaction callback or a markApplied success flag.
7. **Prove persistence and version compatibility.** Binding decide stages validated
   proposals; it performs no Domain writes. Engine invokes commit only for valid
   APPLIED. Commit must reject missing proposals, perform the legitimate scoped
   operation and verify its persistence result. All other outcomes discard work.
   Close revokes retained capabilities; exceptions/final lease loss roll back all
   Domain, source/item/outcome/counter writes. Future production operations need
   their actual reviewed Domain contracts and deliberately authorized grants.
8. **Run contract tests.** Cover supported/unknown/duplicate pairs, wrong version,
   exact dispatch, flags, FULL/INCREMENTAL/checkpoints, abort/failures, four outcomes,
   missing/invalid proposals, invalid source, owner/account/provider/type isolation,
   atomic rollback, lease loss, session revocation, retries and restart. Follow the
   existing ordinary/integration discovery; PostgreSQL cases must be genuine and
   isolated. Test-owned tables/handlers never enter production declarations.
9. **Verify security and compatibility.** Preserve ACTIVE owner checks, canonical
   lock order, lease/generation/lifecycle fences and the restricted worker role.
   Check unchanged public OpenAPI/SDK, schema and history; execute quality, role/
   migration/runtime regressions and final-head hosted gates with actual evidence.
10. **Activate only the verified authorized implementation.** Production registration,
    official authorization, Domain conformance, key/grant custody, capacity gates
    (including deferred issue33) and runtime flags are separate prerequisites.
    A passing synthetic fixture or enabled flag is not live authorization.

## New types and multiple sources

A new provider for an existing type adds a static pair and its authorized adapters;
no new scheduler/queue/worker is needed. A provider may compose additional authorized
endpoints for the same type while retaining one deterministic page/cursor contract
and disjoint identity schemes. There is one current lane/config per connection/type:
independently scheduled sources under the same pair are not introduced by Phase A
and would require a separately assessed source discriminator/contract change.

A new business SyncType requires its canonical as-const vocabulary, Domain contracts,
coordinated API/SDK/UI assessment where applicable and a forward-only migration for
physical CHECK/schema contracts. Never remove CHECKs, rewrite migrations, use a
Prisma/PostgreSQL ENUM or turn the type into arbitrary runtime text.

NEXORA-050 supplies Shipment core schema, normalized processor/binding and least-privilege grants. Phase B/C still own actual authorized provider transports/payload contracts, production registration and deployment/activation.
Phase A's registry and invocation seam do not supply those missing capabilities.

## Domain linkage and bounded Customer persistence exception — ADR-011

Shipment keeps source_identity_id on its own table; no Shipment-specific column
is added to Sync. Existing Customer mapping is an explicit bounded compatibility
exception: retain sync_source_identities.customer_id/link_origin, the nullable
nonunique Customer FK, collection relationship and nonunique index. Multiple
Customer sources may map to one Nexora Customer. Customer Domain/processor owns
matching/eligibility decisions and scoped immutable-target validation; Sync keeps
the existing durable storage representation under current transaction/fences.
Code decides; persisted source identity records the result. The engine is not
completely free of Customer-specific fields, and new domains must not automatically
copy this exception or add generic Sync matching logic.

Confirmed links, especially LINKED_EXISTING, survive restart/resync/payload change
and payload retention. Reuse them instead of rematching provider payload on every
run; do not silently relink a source, automatically merge by name/phone/tracking
code/unverified data, or bypass owner/lifecycle checks. Human confirmation retains
NEEDS_REVIEW. No new matching algorithm or production Customer handler is added.

[ADR-011](../decisions/shipment-domain-data-ownership.md#customer-source-cardinality--resolved)
resolves CUSTOMER_SOURCE_CARDINALITY through the latest owner decision. The former
Customer 1:1 migration target is superseded and must not be implemented. Do not
create customer_source_links or another mapping table now. Physical relocation is
DEFERRED, with no selected destination, and is not a Shipment Core prerequisite.
Any justified future move needs a separate design, lossless mapping/origin/owner/
provenance preservation, safe rollback and genuine PostgreSQL tests including
two sources to one Customer; preserve engine versions/hashes/checkpoints and job
provenance. Independently justified unused-field cleanup is a separate follow-up,
not bundled or required before Shipment.

Shipment's customer_id is a different Nexora-owned association: initially NULL is
valid, and authorized future user commands link/unlink/relink an eligible existing
owner-scoped Customer. Multiple Shipments can share one Customer. Shipment Sync
never creates/matches a Customer as an ingestion prerequisite or overwrites or
infers that association; no Uniship Customer identifier/API is assumed.

## Provider/type independence

| Pair                  | Meaning                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| (uniship, SHIPMENT)   | Current planned Shipment-only scope, official authorization required          |
| (carrier-b, SHIPMENT) | Illustrative future capability, not registered                                |
| (carrier-b, CUSTOMER) | Separate illustrative capability only if officially supported, not registered |

A provider can support only Shipment, only Customer or both. Use the existing
exact-pair registry and shared empty production declarations; no scheduler/worker
change per provider/type pair, provider-wide implicit capability, global
Customer-before-Shipment ordering or separate worker per type. A flag cannot
activate missing code or authorize traffic. Uniship Customer Sync is outside
current scope and is not required before Shipment integration. Each actual pair
independently verifies official API access, normalization, stable versioned identity,
processing contracts and permissions. Provider-specific coordinated ordering, if
needed, is separately evaluated, never assumed globally.

## Shipment normalized binding — NEXORA-050

ShipmentSyncSession carries frozen scope, existingProviderStatus, readonly
existingLogisticsStage from locked root hydration, and propose(input,
stage); no raw SQL, Prisma or transaction handle crosses the boundary. Binding uses
the engine-supplied source/version/final-lease transaction, locks source then root
by canonical source identity/owner, rejects stale processor versions and APPLIED
without a prepared Domain operation, copies proposed data and revokes the session.
Only provider columns, explicit ordered fee reconciliation and actual stage changes
persist. Same payload/processor is skipped by the existing engine; processor upgrades
can remap the same source observation. Any late fence or SQL failure rolls back
Shipment/fees/history and source outcome together. No network under locks.

Missing charges preserve rows; complete valid collection reconciles positions;
complete empty clears; malformed/partial/ambiguous rejects the whole proposal.
Mapping is injected/versioned; the generic processor has no Uniship dictionary.
The NEXORA-057 fixture-backed composition is described below. Test-only
registrations establish correctness, not real provider API access/completeness.
Production capability declarations remain empty. Unknown source status yields a
fixed SHIPMENT_STATUS_UNMAPPED warning without payload/credentials and maps UNKNOWN,
not automatic NEEDS_REVIEW. Worker grants are documented in database.md.

ShipmentProviderInput is the feature-owned typed normalized patch contract. Its
optional charges property is an explicit complete:true collection; omission and
complete empty are distinct. The Domain parser validates generic Sync JSON into a
copied typed value, retaining the complete marker; Aggregate commands reuse the
same validator and do not rely on TypeScript alone. Logistics stage is supplied by
the injected mapper, never accepted as a provider payload field.

## Onboarding intent and runtime eligibility — NEXORA-056

Carrier's pure default-sync-policy uses canonical Carrier provider and Shared
SyncType codes without importing Sync application/infrastructure. The existing
Carrier create transaction inserts the policy for the actual created provider.
This persisted schedule is intent only; it neither registers a capability nor
creates a job. Uniship defaults to enabled SHIPMENT/60minutes at DB-created time
plus60minutes. No CUSTOMER default, legacy backfill or reconnect reset occurs.

Runtime configuration carries no ENV-derived type list. Repository admission,
claim, schedule and execution fences share global enabled plus exact registry
resolution. claim retains its registry-filtered DB provider/type eligibility before
SKIP LOCKED selection; scheduler retains its same enabled/due/authorization and
active-lane checks, completion-based timing and keyset continuation. API and worker
use the same production declarations, still empty. Removing per-type flags never
opens live HTTP or bypasses owner/lifecycle/processor/lease fences. Manual admission
continues independently of whether an automatic schedule is enabled/due.

## Fixture-backed Uniship Shipment composition — NEXORA-057

The provider implements only FULL(uniship,SHIPMENT), reads one validated100-row
page after the complete China warehouse lookup and returns existing NormalizedSource/
SyncPage. Existing Carrier lifecycle/credential vault supplies authenticated token
callbacks; the existing HTTP client owns HTTPS/live/redirect/timeout/byte bounds.
No network inside Sync's transaction and no duplicate auth client or plaintext cache.

The normalized payload is a strict integration-owned wrapper: a minimal validated
Shipment patch plus canonical OldStatus string/null, or a fixed invalid marker for
stable-ID rejection. Numeric primitives use Node24 source lexemes; existing sourceKey,
canonicalPayload/payloadHash and versioned staging remain authoritative. Bad identity/
envelope fails the page; bad valid-ID source rejects deterministically; DB/program
errors retain failure/rollback semantics. Provider-specific safe warnings contain
only fixed codes. See the Uniship contract for the exact implemented/omitted fields.

UnishipShipmentProcessor(version1) composes ShipmentSyncProcessor. It resolves13's
stage using recognized OldStatus first, otherwise readonly existingLogisticsStage,
otherwise UNKNOWN, and keeps provider-specific facts outside the generic aggregate.
The new session field is obtained from existing locked/hydrated data, not a query
from the processor, arbitrary callback or external fetch. Existing generic processors
and immutable sessions remain compatible; engine source/processor/final fences and
actual-stage-only history behavior are unchanged.

This adapter omits all four child collections until actual upstream completeness/
semantics are verified. Existing complete:true normalized collections still reconcile;
missing preserves, complete empty clears, explicit false is known rather than unknown.
No partial-service deletion, fee inference, unknown currency/timezone conversion,
Customer matching or destination-schema addition. Production registrations remain
empty and external HTTP hard-closed; SYNC_ENABLED alone cannot activate this code.
Only tests compose a static capability. NEXORA-058 owns activation after external
contract/claim evidence and operational safeguards are satisfied.

## NEXORA-060 scoped Shipment enrichment

Owner decision2026-11-22: Uniship development processor defaults to version1.
Mapping V2 is a mapping name, not processor2. A richer new observation advances
sourceVersion1→2 under processor1; an identical repeat stays2. Generic explicit
processor upgrades, mismatch checks and final fences remain supported unchanged.
The mapping enriches the same uniship-parcel-v1 identity;
tracking code is not identity and ModifiedDate is not an incremental cursor.
Existing FULL auth/transport/production close are unchanged. Old normalized staging
remains processable but does not contain new facts; processor reprocessing is not
a backfill. A new source observation produces a changed canonical hash/version.

Shipment input adds bounded chargePatch, milestonePatch and providerAttributesPatch.
Infrastructure maps wire fields into neutral Domain types. The aggregate resolves
patches against its locked persisted children; existing transaction/final fences
atomically persist the resulting full state through conditional upserts. Omitted
codes/null source values preserve, zero writes zero, duplicate target fee codes
return NEEDS_REVIEW/SOURCE_CONFLICT. No adapter-side fee selection, new repository,
generic engine branch or network call under lock. Complete child contracts are
unchanged; a simultaneous complete/partial collection is invalid.
