# NEXORA-057 — Fixture-backed Uniship Shipment HTTP adapter

Task ID: NEXORA-057
Classification: SIGNIFICANT
Plan revision: rev-2026-11-16-uniship-http-adapter-v1
Reviewed baseline: fa28b4997358c32a6e7862d57f2577229d21a7bd
Branch: feat/uniship-http-adapter

## 1. Requirements and boundary

Implement only mock/fixture-backed FULL (uniship, SHIPMENT) using existing Sync,
Carrier token lifecycle and Shipment aggregate/binding. No production registration,
live network, CUSTOMER/INCREMENTAL, scheduler/queue/worker/UI, migration/schema/DTO/
SDK, custody/security/Origin/MFA/TLS or existing engine/fence/retry-policy changes.
First commit closes merged056 under §1.7 and preserves UNKNOWN HTTPS cause in058.
Latest main a19aa0d2532b41135a90c6e48e3b6876471ad343 verified before new branch.

## 2. Read-only inventory and reuse audit

Read AGENTS/AI routes, PROJECT_CONTEXT/RULES/TASK_WORKFLOW/IMPLEMENTATION_WORKFLOW,
ADR007/008/009/011, backend/database/runtime/configuration/testing/sync-extensions,
Uniship contract/fixture README,055/056/057/058 records and both review skills.
Inspected actual Carrier HTTP client/adapter/lifecycle/credential vault/budgets,
Sync ports/capability registry/runtime declarations/repository/executor/policies,
Shipment domain/processor/session/binding/persistence/mapper and existing unit/PG
integration/child-batch fixtures. Searched sourceKey/canonicalPayload/payloadHash,
withToken, stageChanged, services complete, originWarehouse/destinationWarehouse,
Origin diagnostics and existing test discovery/environment launchers.

| Field                    | HTTP and pagination                                                                                                                                 | Normalization and identity                                                                                                                                                    | Shipment application and persistence                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Existing Carrier UnishipHttpClient plus Shipment SyncProvider                                                                                       | Provider-specific numeric/envelope/warehouse normalizer                                                                                                                       | Provider-specific processor composed with existing ShipmentSyncProcessor/binding                                                                                                |
| Existing implementations | carrier/infrastructure/uniship/uniship-http.client.ts; CarrierConnectionLifecycleService.withToken/read; SyncProvider/SyncPage                      | sync/domain/sync-policy.ts sourceKey/canonicalPayload/payloadHash; shipment.ts DecimalValue/parseShipmentProviderInput; owner fixture README and JSON                         | shipment-sync.port.ts, shipment-sync.processor.ts, shipment-sync-domain.binding.ts; aggregate children/history; shipment-integration and child-batch fixtures                   |
| Domain owner             | Carrier owns authenticated transport/custody; Shipment infrastructure owns provider protocol                                                        | Uniship integration owns wire-to-normalized policy, Sync owns stable versioned staging                                                                                        | Shipment aggregate owns generic state/children, locked binding supplies trusted existing facts                                                                                  |
| Reuse alternatives       | Reuse HTTP URL/live gate/body/status/timeout primitives and withToken; reject second auth client or raw credential access                           | Reuse identity/hash/decimal validators; reject float conversion, raw provider payload staging or new generic parsing framework                                                | Reuse processor via composition and narrow immutable existing stage; reject Prisma in processor, network under locks or arbitrary callback/SQL escape hatch                     |
| Selected approach        | Add narrow allowlisted GET reader to existing client, preserving auth behavior; provider validates job scope, loads warehouses then one100-row page | Node24 reviver numeric lexeme objects, strict metadata/ID validation, minimal payload wrapper with validated Shipment patch and OldStatus string/null or fixed invalid marker | New UnishipShipmentProcessor resolves claim from validated primitive facts then delegates to existing generic processor; one readonly session stage field from locked hydration |
| Rationale                | Preserve one security/auth boundary and page checkpoint mechanism                                                                                   | Prevent precision loss, private-data staging and guessed money/time semantics                                                                                                 | Keep provider vocabulary outside generic aggregate; preserve transaction/version/fence/history contracts                                                                        |
| Risks                    | Redirect/live leakage, abort/oversize/invalid envelope, stale account, checkpoint on bad pages                                                      | Identity collision, repeated pages, non-isolated FULL data, partial children and unverified timestamps                                                                        | Claim overwrites stage, false service facts, swallowed DB error, version drift or broken old test bindings                                                                      |
| Verification             | Loopback HTTP tests, gate-before-fetch, cancellation/status/byte bounds, page1/2/final/empty/malformed; actual Sync ingestion                       | Preserved fixture hashes, exact lexemes/ID, unknown/type warnings, warehouse namespace/privacy and omissions                                                                  | Synthetic status/claim matrix, actual PG history/children/rollback/isolation/fences, existing regression suites/capacity, independent review and final-head CI                  |

## 3. Architecture and modeling

No new aggregate: this is a stateless provider adapter. ShipmentAggregate remains
the single consistency owner for carrier root fields, services/charges/items/
milestones and stage changes. Carrier owns encrypted credentials, token verification,
audit-before-password-decrypt and bounded recovery. Sync owns queue/source identity,
payload hash/sourceVersion, processorVersion, lease/generation/final fencing,
checkpoints, retries and job outcomes. Infrastructure may compose owning application
ports; no app imports app, domain HTTP/Prisma/Nest, new shared kernel or repository.

Files selected: Carrier existing HTTP client (narrow GET and shared private URL/
response primitives only); new shipment/infrastructure/uniship normalizer/provider/
processor; one session field/binding projection; unit and own PG fixture/tests;
canonical integration/sync-extension/testing docs and active057. Existing production
sync-runtime-capabilities.ts must stay byte-identical/empty. Test-only registry
composes provider and createShipmentSyncBinding(new UnishipShipmentProcessor(1)).

## 4. PLAN ISSUE A — resolved design

Add readonly existingLogisticsStage: LogisticsStageCode|null to ShipmentSyncSession,
populated from the already locked/hydrated root; new source null. Frozen session
and scope, no DB callback/transaction/payload capability added. Existing generic
ShipmentSyncProcessor behavior/constructor and test-only mappings stay unchanged.

Uniship normalized payload is a strict integration-owned wrapper containing only
shipment (validated ShipmentProviderInput) and oldStatus (canonical numeric string
or null). A malformed record with valid identity stages only {invalid:true}; the
specific processor resolves it REJECTED_SOURCE/SOURCE_INVALID. No raw record/PII.
The Uniship processor passes only providerStatus, oldStatus and trusted previous
stage to its pure claim decision; it composes existing ShipmentSyncProcessor with
an explicit mapping, adding status13's resolved stage for that application only.
No unrestricted callback or change to aggregate status dictionaries.

Status1..5 map to the five approved physical stages. Status13 sets claim string13:
recognized OldStatus1..5 wins (even conflicting DELIVERED→OldStatus4); otherwise
preserve existing stage, else UNKNOWN. Other structurally valid codes map UNKNOWN
and fixed UNISHIP_STATUS_UNKNOWN warning. Non13 explicitly clears claim to null.
History follows existing stageChanged: new root creates initial row; changed
physical stage appends; unchanged stage/service-only/claim-only change does not.
No assumption of claim chronology/completion. All additional claim cases synthetic.

First Uniship-specific processor version1; no prior production mapper exists.
Generic test processor versions remain unchanged. Payload/sourceVersion, processor
upgrades/reprocessing and final mismatch rejection remain existing engine semantics.

## 5. PLAN ISSUE B — resolved safe completeness policy

Absent optional collection preserves; complete:true collection is authoritative,
including empty clears. Never emit a partial or guessed empty collection. Current
captured service flags are all null, and nonnull/null/false wire semantics are
NOT VERIFIED. Therefore this adapter emits no services collection, including on
synthetic true/false/fee observations; it cannot certify a complete upstream service
snapshot yet. No fee-derived flags or null→false. Existing normalized complete
service snapshots (explicit false/true/empty) remain supported and are exercised
through the existing binding before/after omitted Uniship observations in PG.

Charges: omit (amount meaning/currency unresolved). Items: omit (ProductName scalar
and complete line/quantity/value correspondence unverified). Milestones: omit (no
verified timezone and competing origin-export fields). Omission preserves all four
stored collections and their identities/xmin; existing complete reconciliation is
verified independently, not falsely described as observed provider completeness.
No new partial-update mechanism. 058 requires evidence before those fields activate.

## 6. Exact field policy and confidence

CONFIRMED wire mapping: positive canonical JSON integer ID lexeme→sourceKey scheme
uniship-parcel-v1, fields[ID], scoped by existing owner/provider/account/type. Reject
string/zero/negative/fraction/exponent/over128-digit identities; never trim/Number
round or use tracking code. Node24 JSON.parse context.source captures every numeric
primitive into private lexeme objects, not reconstructed floating-point strings.
Number conversion is only for bounded safe-integer paging metadata/counts.

TransactionCode nonempty string→trackingCode unchanged; Status numeric integer
lexeme→providerStatus; claim patch as above. Weight numeric lexeme→DecimalValue(10,3),
nonnegative; missing/null omitted (no zero invention). ChinaStoreID resolves only
against complete chinaStores entries with StoreType1; preserve nonempty Name bytes
including whitespace, no name identity matching or hidden-flag inference. Missing/
unknown/ineligible lookup omits originWarehouse and fixed missing-field warning.

Additional contract gap: current Shipment patch/schema has no destinationWarehouse.
ReceivePlaceName is NOT mapped to unrelated serviceLevel or ReceivePlaceID joined
to chinaStores. Omit it for this task rather than changing schema/API. This is a
candidate mapping deferred until an owning contract exists, not a fabricated field.

Omit package/item counts, declared value/currency, all money/fees/totals/rates,
provider/changed/rate timestamps and child collections until their semantic/unit/
timezone/completeness prerequisites are verified. No toFixed/arithmetic, timezone
appendZ/host conversion, fabricated data, Customer linking or additional provider
personal/contact/address fields in normalized payloads. Preserve captured bytes/hashes.

ASSUMED/UNKNOWN ledger remains explicit: provider ID stability, FULL cross-page
consistency, actual child maxima, money alternatives/currencies, quantities/counts,
OldStatus lifecycle/claim ending, service null/false and timezone are not confirmed
by synthetic tests. UNISHIP_FIELD_SEMANTICS_VERIFICATION and
UNISHIP_CLAIM_LIFECYCLE_CAPTURE remain NOT VERIFIED externally, transferred to058
as activation prerequisites after safe fixture-backed implementation.

## 7. HTTP, scope and pagination contracts

Reuse configured existing client live hard-close, production HTTPS, forbidden URL
credentials/query/fragment, redirect:error and timeout5s/caller AbortSignal. Narrow
GET paths only /client/api/chinaStores/ and /client/api/transition/, Accept JSON and
Bearer token provided only inside existing withToken callback. Reuse bounded
stream reader (auth64KiB unchanged; GET8MiB). Oversized/malformed data has fixed
safe envelope error; no response/body/URL/token in exceptions. 401/403 uses existing
TOKEN_REJECTED recovery boundary;429 bounded Retry-After;5xx/network retryable.
Existing authenticate/verify statuses and semantics unchanged. Test mocks only.

Before HTTP validate FULL/uniship/SHIPMENT, connection present, integer page>=1,
no cursor/watermark. Read existing Carrier snapshot and compare owner connection/
provider/external-account/generation/lifecycle before withToken; existing service
and final engine fences handle concurrent disable/delete/recovery. No network
inside any transaction. No caching plaintext tokens or warehouse/account state.

Query order ecommerce=true,filter=base64(JSON equal IsEcommerce1),page=n,
rowsPerPage=100,q= via URLSearchParams. No extra filter/operator/watermark. Capture
size15 stays unchanged; synthetic mock envelopes for100 are labelled derived.
Validate HTTP and envelope independently: status200/message, data array, safe total/
offset/page-size, required summary shape/counts, expected offset=(page-1)\*100,
count=min(100,total-offset), bounded page and safe successor. Empty valid page1/
total0 is done. chinaStores must be one complete offset0 collection; namespace and
duplicate IDs checked. No invalid envelope advances checkpoint.

Reject within-page duplicate IDs before returning SyncPage. Across pages/resync,
reuse engine stable identity/hash/item idempotence; do not add unbounded per-job
in-memory seen caches or claim provider snapshot isolation. Changing duplicate
observations retain existing observed-source version semantics, not monotonic
provider chronology. Transport failure leaves next_page unchanged; retries reuse
same identity. No sourceOrder inferred from unstable FULL offsets.

## 8. Error and security contracts

Only fixed warnings UNISHIP_STATUS_UNKNOWN/UNISHIP_REQUIRED_FIELD_MISSING/
UNISHIP_FIELD_TYPE_CHANGED/UNISHIP_ENVELOPE_INVALID, no account/ID/path/raw data.
Invalid identity/envelope fails page (SOURCE_INVALID); malformed valid-ID row
stages fixed rejected marker, valid siblings proceed. Unexpected programming/DB
errors propagate; never broaden catch to REJECTED_SOURCE. Known transport/lifecycle
failures map existing Sync retry/unavailable/stale codes; bounded callbacks receive
only validated primitives. Existing key custody, budgets, auth, restricted grants,
source lock order/final fence and query/capacity bounds remain unchanged.

## 9. Test-first and verification plan

1. Frozen install and existing prerequisite shared/database/API builds.
2. RED pure fixture contract/number/identity/envelope/warehouses/omissions/status
   tests and narrow HTTP mock tests before implementation. Verify source hashes.
3. GREEN minimal reader/provider/normalizer/processor and session stage projection;
   rerun existing Carrier/Shipment/Sync units and type/boundary/vocabulary checks.
4. RED genuine isolated PostgreSQL adapter→Sync staging→Shipment integration first,
   then GREEN: first/repeat/changed FULL, source ID/hash/version, all synthetic claim
   states/history, previous conflicting stage, no partial children deletion,
   complete true/false/empty semantics, rejected siblings/invalid envelope no progress,
   rollback, account/owner and stale version/lease/generation/cancel/failure boundaries.
   Reuse existing own-database setup/role provisioning and existing full Sync/Shipment
   suites for fences/retry/capacity/performance, no assertion weakening/shared reset.
5. Pinned pnpm10.34.6 format/docs/preflight/lint/test:lint/quality/contracts; canonical
   quality-docker and actual PostgreSQL. If Docker image storage unavailable, record
   NOT RUN and exact-hosted canonical execution; native PG tests are genuine but
   separately identified. Stop/reassess after three unresolved attempts.
6. Independent implementation-code-review, fix blocking findings, update canonical
   docs/evidence, commit scoped changes, push one new PR bound to this snapshot/
   actual digest, wait exact final-head Preflight/SyncTargeted/Foundation4–10.
   Keep historical failures and no unnecessary evidence-only commits. No merge.

## 10. Documentation Impact

Documentation Impact: REQUIRED

Canonical owners: docs/integrations/uniship-portal-api.md (implemented field policy/
confidence/claim/omission), docs/architecture/sync-extensions.md (provider/session/
composition boundary), docs/operations/testing.md (fixture/mock/real-PG commands),
active057 (execution evidence); closure056/058 retain external prerequisites.
No API/SDK/schema/migration or actual activation fact changes. Verify docs:check.

## 11. Acceptance and remaining issues

- [ ] Mandatory plan/snapshot/digest recorded before implementation.
- [ ] Safe FULL mock HTTP pagination/identity/envelope/abort/status contracts.
- [ ] Minimal exact numeric normalizer with preserved fixture provenance/no PII.
- [ ] Status1..5/13/unknown and trusted old-stage preservation/history verified.
- [ ] Missing/partial collections cannot delete existing child facts.
- [ ] Actual PostgreSQL integration and existing fences/capacity regressions PASS.
- [ ] Empty production registry/live hard-close, auth/grants/contracts unchanged.
- [ ] Canonical docs, independent review, local quality and exact-head CI PASS.

PLAN ISSUE A/B resolved by the selected narrow session/composition and omission
policies above. Destination mapping has no current target and is explicitly omitted;
it is not permission for schema expansion. No unresolved blocking design issue.
External evidence gaps remain activation prerequisites for058, never synthetic PASS.
