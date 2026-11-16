# NEXORA-057 — Uniship HTTP Adapter

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-057
Classification: SIGNIFICANT
Plan revision: rev-2026-11-16-uniship-http-adapter-v1
Reviewed baseline: fa28b4997358c32a6e7862d57f2577229d21a7bd
Branch: feat/uniship-http-adapter
Design Snapshot: docs/tasks/design-reviews/NEXORA-057-rev-2026-11-16-uniship-http-adapter-v1.md
Design SHA-256: d29e0d0f818c6b4a954d39e90a1b0eb84d896499d9b4804fcf86c262416e7032

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

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Fixture-backed FULL transport, exact numeric/identity/normalization policy,
claim fallback from trusted current stage, complete snapshot omission semantics,
mock/PG verification and continued production hard-close.

### Canonical owners

- docs/integrations/uniship-portal-api.md
- docs/architecture/sync-extensions.md
- docs/operations/testing.md
- docs/tasks/active/NEXORA-057-uniship-http-adapter.md

### Documentation verification

Pinned pnpm docs:check, preflight:check, format:check and test:docs; preserve
owner-captured fixture bytes/provenance and frozen snapshots.

## 11. Acceptance and remaining issues

- [x] Mandatory plan/snapshot/digest recorded before implementation.
- [x] Safe FULL mock HTTP pagination/identity/envelope/abort/status contracts.
- [x] Minimal exact numeric normalizer with preserved fixture provenance/no PII.
- [x] Status1..5/13/unknown and trusted old-stage preservation/history verified.
- [x] Missing/partial collections cannot delete existing child facts.
- [x] Actual PostgreSQL integration and existing fences/capacity regressions PASS.
- [x] Empty production registry/live hard-close, auth/grants/contracts unchanged.
- [ ] Canonical docs, independent review, local quality and exact-head CI PASS.

PLAN ISSUE A/B resolved by the selected narrow session/composition and omission
policies above. Destination mapping has no current target and is explicitly omitted;
it is not permission for schema expansion. No unresolved blocking design issue.
External evidence gaps remain activation prerequisites for058, never synthetic PASS.

## Evidence

| Claim                         | Evidence                                                                                                                                                                                                                                                                             | Date       | Result |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Follow-up scope retained      | Original stub from NEXORA-056 and closed055; provider semantics/real claim lifecycle remain NOT VERIFIED; no live activation                                                                                                                                                         | 2026-11-16 | PASS   |
| Main and closure prerequisite | GitHub PR55 merged2026-11-16T15:14:41Z at a19aa0d2532b41135a90c6e48e3b6876471ad343; fetched main, own clean branch; first commit fa28b49 closes056 under §1.7, preserves FAIL/NOT RUN/UNKNOWN and transfers operational prerequisites to058                                          | 2026-11-16 | PASS   |
| Closure docs check            | node scripts/docs-check.mjs on a19aa0d working tree;2026-11-16T15:33:42Z–15:33:43Z, exit0                                                                                                                                                                                            | 2026-11-16 | PASS   |
| Frozen dependency install     | npx --yes pnpm@10.34.6 install --frozen-lockfile;2026-11-16T15:33:54Z–15:34:03Z, exit0; dependency bytes unchanged; execution recorded temporary local closure d4e0cbef842d88fbe5ec8d452583ae5ed4d8ddfc before closure staging was corrected/amended to fa28b49, not hosted evidence | 2026-11-16 | PASS   |

| Initial plan docs validation | node scripts/docs-check.mjs; fa28b4997358c32a6e7862d57f2577229d21a7bd working tree;2026-11-16T15:37:45Z; exit1, task Documentation Impact lacked required Changed facts/Documentation verification subsections; corrected task structure only, snapshot unchanged | 2026-11-16 | FAIL |

## Verification re-evaluation — new PostgreSQL fixture (2026-11-16)

Initial pipeline invocation used the wrong patch cwd and ran only the earlier
stage test (2PASS); this is not full pipeline evidence. First actual expanded run
failed in new fixture relation names (Shipment.source, ProviderSourceRecord.identity),
retry column (SyncJob.available_at), an overlong synthetic username and cascading
unfinished fixture jobs. Corrected only new fixtures and per-case cleanup. Next
run:8PASS/3FAIL (nested parent counts), only rollback predicate failed: Prisma7
emits P0001 in its message, not meta.code. Another patch failed before writing,
so a redundant run retained the same failure; keep its FAIL label even though it
was named green. No production change was justified by these test faults.

Re-plan after consecutive failed attempts under Implementation Workflow§7: inspect
the exact current file/schema and existing rollback test before another mutation.
Reference shipment-integration.test.cjs:1063–1070 and shipment-child-batch.cjs:355–360:
assert code P0001 and synthetic exception message, then unchanged persisted state.
Apply that same predicate to the new test, retaining all rollback/data assertions;
add the already-planned actual same-ID/different-owner-account case. Re-run once
with confirmed applied patch. Snapshot/design unchanged; no engine alteration.

## Implementation and executed verification delta

Carrier HTTP security/auth remains single-source: narrow GET shares the existing
URL/live gate, timeout/redirect policy, stream reader and Retry-After parsing;
auth bound64KiB unchanged, GET8MiB. No separate authentication system. New Uniship
normalizer/provider/processor and one readonly locked session stage implement the
frozen plan; production registrations remain byte-identical/empty. Captured fixture
hashes unchanged. Public API/SDK/schema/migrations/grants/security are unchanged.
Canonical integration/sync-extension/testing docs updated; external semantics and
real claim lifecycle remain NOT VERIFIED prerequisites in058, never synthetic PASS.

Genuine PostgreSQL17.11 owned-cluster tests: session-stage RED undefined!=DELIVERED
then GREEN; complete adapter pipeline12/12 PASS with actual encrypted Carrier vault/
audit/lifecycle, scoped credentials,101-record HTTP pagination/retry, status/claim/
history, child IDs/xmin, rejected siblings/no-progress, rollback and all fences.
Synthetic claim/complete collection inputs are not real provider captures.

First native full integration command:174PASS/4FAIL of178, no skip. Three old tests
require a migrated parent DATABASE_URL (confirmed parent lacked migration history/
stored_files/users); identity-concurrency also requires STORAGE_ROOT. Native helper
had provided only own cluster credentials. Applied existing migrations to that owned
parent DB and created private storage, then unchanged failed subset4/4 PASS. Do not
claim the initial full command passed. All other old suites passed in that run,
including real Sync10000-source/retry/reservation/fence tests and Shipment100x50fees/
500items/4milestones/4services capacity. Sync capacity first5078.664ms,
changed5328.651ms, identical10.383ms (below7500ms apply guard); source timing log
is temporary, compact counts retained here. Canonical full Docker remains hosted.

Local Docker: NOT RUN. Actual driver vfs; only nginx:1.30.6-alpine cached and about
610MiB free on7.9GiB overlay; matching application/dev images absent. Prior owned
image attempts in056 exhausted VFS space. Do not prune shared images/volumes or
pretend native PG proves Docker. Required exact-head hosted Foundation must execute
canonical quality/integration and all smoke4–10 before readiness.

Independent read-only implementation review:0P1/0P2/0P3 against frozen plan and
all tracked/untracked files; no tests, edits or provider calls by reviewer. Final
docs/quality/CI are separate executed gates. No screenshots or visual acceptance
claimed. Logs are temporary/ignored, not committed raw provider/artifact data.

### Command evidence (working tree based on plan commit)

All following rows use the working tree on exact
94f9931d092aaaf5e253982c407a7e97e49fb3b0 unless noted by their HEAD, Node24.19.0,
pnpm10.34.6, owned native PostgreSQL17.11. Local commands have no CI merge ref;
final-head hosted provenance will be recorded on the PR without evidence-only commits.
Rows preserve test/setup/environment failures; labels containing green do not imply
PASS when the exit code is nonzero. The early pipeline-first run only executed the
stage case due its patch cwd error; it is not evidence of the expanded pipeline.

| Claim                                 | Evidence                                                                                                                                                                                                                                                                                                                                                        | Date       | Result |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| task057-prerequisite-build            | `npx --yes pnpm@10.34.6 --filter @nexora/api... build`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:38:13.301836+00:00–2026-11-16T15:38:32.514192+00:00; exit 0                                                                                                                                                               | 2026-11-16 | PASS   |
| task057-normalizer-red                | `node --test apps/api/test/uniship/normalizer.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:39:49.057080+00:00–2026-11-16T15:39:49.276141+00:00; exit 1                                                                                                                                                              | 2026-11-16 | FAIL   |
| task057-http-red                      | `node --test apps/api/test/uniship/provider.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:40:52.859433+00:00–2026-11-16T15:40:54.112302+00:00; exit 1                                                                                                                                                                | 2026-11-16 | FAIL   |
| task057-pg-start                      | `python3 /tmp/nexora057-pg.py`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:42:28.926732+00:00–2026-11-16T15:42:31.450123+00:00; exit 0                                                                                                                                                                                       | 2026-11-16 | PASS   |
| task057-stage-pg-red                  | `python3 /tmp/nexora057-pg-run.py node --test integration/uniship-shipment-integration.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:42:37.116831+00:00–2026-11-16T15:42:41.954367+00:00; exit 1                                                                                                                     | 2026-11-16 | FAIL   |
| task057-api-build-green               | `npx --yes pnpm@10.34.6 --filter @nexora/api build`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:46:01.125130+00:00–2026-11-16T15:46:12.513860+00:00; exit 0                                                                                                                                                                  | 2026-11-16 | PASS   |
| task057-unit-green                    | `node --test apps/api/test/uniship/normalizer.test.cjs apps/api/test/uniship/provider.test.cjs apps/api/test/carrier-uniship.test.cjs apps/api/test/uniship-verify.test.cjs apps/api/test/shipment/binding.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:46:26.794625+00:00–2026-11-16T15:46:34.309513+00:00; exit 0 | 2026-11-16 | PASS   |
| task057-stage-pg-green                | `python3 /tmp/nexora057-pg-run.py node --test integration/uniship-shipment-integration.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:46:26.771668+00:00–2026-11-16T15:46:36.347096+00:00; exit 0                                                                                                                     | 2026-11-16 | PASS   |
| task057-pipeline-pg-first             | `python3 /tmp/nexora057-pg-run.py node --test integration/uniship-shipment-integration.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:50:29.556660+00:00–2026-11-16T15:50:34.777218+00:00; exit 0                                                                                                                     | 2026-11-16 | PASS   |
| task057-pipeline-pg                   | `python3 /tmp/nexora057-pg-run.py node --test integration/uniship-shipment-integration.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:50:45.786365+00:00–2026-11-16T15:50:55.290566+00:00; exit 1                                                                                                                     | 2026-11-16 | FAIL   |
| task057-pipeline-pg-fixture-corrected | `python3 /tmp/nexora057-pg-run.py node --test integration/uniship-shipment-integration.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:51:59.734574+00:00–2026-11-16T15:52:26.760362+00:00; exit 1                                                                                                                     | 2026-11-16 | FAIL   |
| task057-pipeline-pg-green             | `python3 /tmp/nexora057-pg-run.py node --test integration/uniship-shipment-integration.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:53:36.127498+00:00–2026-11-16T15:53:47.390232+00:00; exit 1                                                                                                                     | 2026-11-16 | FAIL   |
| task057-pipeline-pg-confirmed-green   | `python3 /tmp/nexora057-pg-run.py node --test integration/uniship-shipment-integration.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:54:34.655903+00:00–2026-11-16T15:54:50.221554+00:00; exit 0                                                                                                                     | 2026-11-16 | PASS   |
| task057-lint                          | `npx --yes pnpm@10.34.6 lint`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:56:12.712498+00:00–2026-11-16T15:56:47.050050+00:00; exit 1                                                                                                                                                                                        | 2026-11-16 | FAIL   |
| task057-lint-green                    | `npx --yes pnpm@10.34.6 lint`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:58:38.116404+00:00–2026-11-16T15:59:00.951652+00:00; exit 0                                                                                                                                                                                        | 2026-11-16 | PASS   |
| task057-parent-migrations             | `python3 /tmp/nexora057-pg-run.py npx --yes pnpm@10.34.6 --filter @nexora/database exec prisma migrate deploy --config prisma.config.ts`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:59:50.491971+00:00–2026-11-16T15:59:55.513345+00:00; exit 0                                                                             | 2026-11-16 | PASS   |
| task057-test-lint                     | `npx --yes pnpm@10.34.6 test:lint`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T16:00:26.673528+00:00–2026-11-16T16:00:41.192422+00:00; exit 0                                                                                                                                                                                   | 2026-11-16 | PASS   |
| task057-full-pg-integration           | `python3 /tmp/nexora057-pg-run.py node --test integration/**/*.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T15:56:11.194685+00:00–2026-11-16T16:01:42.066876+00:00; exit 1                                                                                                                                             | 2026-11-16 | FAIL   |
| task057-parent-prerequisites-green    | `python3 /tmp/nexora057-pg-run.py node --test integration/identity-concurrency.test.cjs integration/integration.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T16:02:22.853636+00:00–2026-11-16T16:02:39.278869+00:00; exit 0                                                                                            | 2026-11-16 | PASS   |
| task057-migration-regression          | `python3 /tmp/nexora057-pg-run.py node test/migration.mjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T16:02:24.590542+00:00–2026-11-16T16:03:14.646196+00:00; exit 0                                                                                                                                                           | 2026-11-16 | PASS   |

### Full native regression confirmation and final source review

After the documented owned-parent migrations/private STORAGE_ROOT prerequisite,
repeated the complete unchanged integration glob:178/178PASS,0FAIL/0SKIP,
2026-11-16T16:06:54Z–16:11:36Z. This is a genuine full-suite native PASS, separate
from the retained initial174PASS/4FAIL and targeted4/4 recovery. The extra cross-page
same-ID observation also resolves to one existing source/Shipment; no seen cache or
snapshot-isolation claim. Warehouse duplicate test now holds metadata consistent to
exercise duplicate-ID rejection itself. GET positive tests reuse the client's real
5000ms default; the explicit30ms timeout/abort regression remains. No production
source changed after the earlier source review.

Final independent read-only review of docs/tests/diff:0P1/0P2/0P3; frozen snapshot
hash matches, external semantics/claim/custody/rate/stop gates remain in058. No
independent execution/merge approval is invented. Full quality/hosted gates remain
separate from source review. Final source CI evidence belongs on the PR.

| Claim                               | Evidence                                                                                                                                                                                                                                                                                                                                                        | Date       | Result |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| task057-closure-docs                | `node scripts/docs-check.mjs`; HEAD a19aa0d2532b41135a90c6e48e3b6876471ad343 working tree; UTC 2026-11-16T15:33:42.657064+00:00–2026-11-16T15:33:43.914519+00:00; exit 0                                                                                                                                                                                        | 2026-11-16 | PASS   |
| task057-install                     | `npx --yes pnpm@10.34.6 install --frozen-lockfile`; HEAD d4e0cbef842d88fbe5ec8d452583ae5ed4d8ddfc working tree; UTC 2026-11-16T15:33:54.036219+00:00–2026-11-16T15:34:03.254049+00:00; exit 0                                                                                                                                                                   | 2026-11-16 | PASS   |
| task057-plan-docs                   | `node scripts/docs-check.mjs`; HEAD fa28b4997358c32a6e7862d57f2577229d21a7bd working tree; UTC 2026-11-16T15:37:45.525712+00:00–2026-11-16T15:37:45.976935+00:00; exit 1                                                                                                                                                                                        | 2026-11-16 | FAIL   |
| task057-plan-preflight              | `node scripts/preflight-policy-check.mjs`; HEAD fa28b4997358c32a6e7862d57f2577229d21a7bd working tree; UTC 2026-11-16T15:37:46.026647+00:00–2026-11-16T15:37:46.172826+00:00; exit 0                                                                                                                                                                            | 2026-11-16 | PASS   |
| task057-plan-docs-green             | `node scripts/docs-check.mjs`; HEAD fa28b4997358c32a6e7862d57f2577229d21a7bd working tree; UTC 2026-11-16T15:38:01.441108+00:00–2026-11-16T15:38:01.652642+00:00; exit 0                                                                                                                                                                                        | 2026-11-16 | PASS   |
| task057-docs-check                  | `npx --yes pnpm@10.34.6 docs:check`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T16:04:15.387761+00:00–2026-11-16T16:04:19.973640+00:00; exit 0                                                                                                                                                                                  | 2026-11-16 | PASS   |
| task057-preflight-check             | `npx --yes pnpm@10.34.6 preflight:check`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T16:04:20.076791+00:00–2026-11-16T16:04:23.600829+00:00; exit 0                                                                                                                                                                             | 2026-11-16 | PASS   |
| task057-final-targeted              | `node --test apps/api/test/uniship/normalizer.test.cjs apps/api/test/uniship/provider.test.cjs apps/api/test/carrier-uniship.test.cjs apps/api/test/uniship-verify.test.cjs apps/api/test/shipment/binding.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T16:06:13.246680+00:00–2026-11-16T16:06:19.021567+00:00; exit 0 | 2026-11-16 | PASS   |
| task057-pipeline-duplicate-pg-green | `python3 /tmp/nexora057-pg-run.py node --test integration/uniship-shipment-integration.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T16:06:12.037498+00:00–2026-11-16T16:06:25.411059+00:00; exit 0                                                                                                                     | 2026-11-16 | PASS   |
| task057-full-pg-integration-green   | `python3 /tmp/nexora057-pg-run.py node --test integration/**/*.test.cjs`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T16:06:54.969248+00:00–2026-11-16T16:11:36.594378+00:00; exit 0                                                                                                                                             | 2026-11-16 | PASS   |

### Final local quality and handoff to hosted verification

Full quality PASS2026-11-16T16:12:19Z–16:15:47Z with
API_INTERNAL_URL=http://api:4000 NODE_ENV=production and pinned pnpm10.34.6.
This executed formatting, boundaries/ESLint, preflight/docs, typecheck, complete
unit/tooling tests, deterministic OpenAPI/SDK contract check and builds. No API/
SDK drift. Separate test:lint56/56, native full integration178/178, migration/drift
regression and targeted16/16/adapterPG12/12 PASS. All historical failures remain.

| Claim           | Evidence                                                                                                                                                                                                                             | Date       | Result |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| task057-quality | `env API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`; HEAD 94f9931d092aaaf5e253982c407a7e97e49fb3b0 working tree; UTC 2026-11-16T16:12:19.430301+00:00–2026-11-16T16:15:47.265127+00:00; exit 0 | 2026-11-16 | PASS   |

Final hosted verification/owner review remain on the PR after push; Status stays
VERIFICATION PENDING, Verification PARTIALLY VERIFIED, external field/claim/live
prerequisites stay NOT VERIFIED in058. No final-head gate is inferred from a
previous HEAD. No evidence-only commit is needed after hosted results arrive.

## BOUNDED verification-routing delta — 2026-11-16

Source ab800ba0705a49aa1686093172fd6230067594f0 was pushed as PR56. Actual
Sync Targeted pull_request paths cover engine/Customer/schema but not the new
Shipment extension or existing Carrier HTTP client. It has no workflow_dispatch;
no separate Sync run exists on ab800ba and none is claimed PASS. Preflight43906212098
PASS, Foundation43906212048 started on that superseded source.

Before CI edit, inspect .github/workflows/sync-targeted.yml: selected correction is
only adding the exact Shipment Sync port/binding, Uniship adapter subtree and
Carrier HTTP client path filters to the existing workflow. This makes the frozen
plan's final-head Sync regression gate execute for this extension and future relevant
source changes. No workflow job, command, service, permissions, timeout or security
policy changes; no new workflow, rerun/skip, runtime flag or production registration.
This is execution routing for the already-selected verification strategy, not a
material architecture/contract revision; frozen v1 snapshot/digest stays unchanged.

| Field                    | Verification routing                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component                | Existing Sync Targeted changed-file routing                                                                                                      |
| Existing implementations | .github/workflows/sync-targeted.yml pull_request.paths and unchanged sync-postgres job; Foundation already runs full API unit/integration globs  |
| Domain owner             | Repository CI verification only                                                                                                                  |
| Reuse alternatives       | Extend existing path list; reject dummy engine edits, fabricated checks, previous-head substitution or a new workflow/dispatch mechanism         |
| Selected approach        | Four exact source path additions for actual Sync extension components; job remains byte-identical                                                |
| Rationale                | Run the selected engine compatibility gate on the final extension source without unrelated production edits                                      |
| Risks                    | Unexpected extra CI or hidden job changes; inspect YAML diff and final-head run/jobs; superseded run cancellation, if used, is recorded honestly |
| Verification             | Diff limited to path list; pinned format/docs/preflight, independent read-only recheck and all three exact-head hosted gates                     |
