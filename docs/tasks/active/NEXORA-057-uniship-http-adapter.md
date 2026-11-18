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

## BOUNDED P3 follow-up plan — 2026-11-17

Reviewed source/PR56 HEAD: f13aea8c00a100f6a5feb80a7750e03deddd4dd4; branch
feat/uniship-http-adapter, clean worktree, PR open/unmerged. This localized CI
verification correction retains SIGNIFICANT task classification, frozen v1 snapshot
and SHA-256 d29e0d0f818c6b4a954d39e90a1b0eb84d896499d9b4804fcf86c262416e7032.
Documentation Impact remains REQUIRED; no application/domain/API/schema/auth changes.

Baseline P3: sync-targeted.yml has implementation triggers but misses Uniship unit,
helper, captured-fixture and integration paths. Existing commands are exactly
`node --test "apps/api/test/sync/**/*.test.cjs"` and, in apps/api,
`node --test integration/sync-integration.test.cjs`. Historical run43907110578 passed
27 units and61 PostgreSQL tests only; it does not prove targeted Uniship execution.
Foundation43907110482 independently passed full178 integration tests including Uniship.
Historical outcomes remain unchanged and are not final-head substitutes.

| Field                    | P3 targeted coverage correction                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Existing Sync Targeted workflow trigger/execution and test-only credential fixture                                                                                                                                                                                                                                                                                                                                                             |
| Existing implementations | .github/workflows/sync-targeted.yml pinned build/PostgreSQL17.11; foundation.yml and scripts/quality-docker.sh full integration; apps/api/test/uniship/{normalizer,provider}.test.cjs and helpers/uniship-fixture.cjs; apps/api/test/fixtures/uniship; integration/{sync,uniship-shipment}-integration.test.cjs; packages/database/scripts/provision-runtime.mjs; scripts/provision-cluster-smoke.mjs owned-cluster marker and cleanup pattern |
| Domain owner             | CI verification only; existing Carrier/Shipment/Sync own runtime behavior                                                                                                                                                                                                                                                                                                                                                                      |
| Reuse alternatives       | Extend existing job with sequential explicitly named Uniship steps and Node built-ins; reject workflow duplication, new dependencies/framework, skipped tests or changed assertions                                                                                                                                                                                                                                                            |
| Selected approach        | Add four Uniship test/helper/fixture/integration paths plus directly used Shipment processor/domain and shared Shipment vocabulary; preserve every old trigger/command; add explicit two-file unit command and separate genuine integration command                                                                                                                                                                                            |
| Rationale                | Trigger and actually execute owned regression suites while retaining narrow unrelated-UI exclusion, prerequisite build and established role provisioning                                                                                                                                                                                                                                                                                       |
| Risks                    | Missing emitted JS/Prisma/admin/password prerequisites, privilege-check bypass, credential leakage, cleanup on failure, unintended workflow changes or15-minute budget overrun                                                                                                                                                                                                                                                                 |
| Verification             | Parse YAML and compare baseline invariants; representative positive/negative paths; execute exact commands and fixture cleanup success/failure; pinned format/docs/preflight/lint/test:lint and tooling tests; independent review; three exact-final-head hosted workflows and log counts/merge checkout                                                                                                                                       |

### Execution plan and prerequisites

1. Add filters for apps/api/test/uniship/**, apps/api/test/helpers/uniship-fixture.cjs,
   apps/api/test/fixtures/uniship/** and apps/api/integration/uniship-shipment-integration.test.cjs.
   Also add shipment/application/shipment-sync.processor.ts, shipment/domain/shipment.ts
   and packages/shared/src/shipment/\*\*: the adapter delegates parsing/stage policy to
   these exact owners. No repository-wide catch-all or unrelated UI trigger.
2. Reuse Node24.19.0, pnpm10.34.6 frozen install and existing API prerequisite build.
   Add a named Uniship unit step invoking normalizer.test.cjs and provider.test.cjs
   explicitly; keep existing Sync unit command unchanged.
3. After unchanged Sync PostgreSQL step, add a named Uniship PostgreSQL step using
   only existing disposable service admin URL. mktemp creates a runner-owned directory
   below RUNNER_TEMP; Node crypto.randomBytes(32).toString("hex") writes an exclusive
   mode0600 file referenced only by API_TEST_RUNTIME_PASSWORD_FILE. Never print value
   or archive directory. Shell EXIT trap removes file/directory on success or failure;
   HUP/INT/TERM exit through that cleanup. No production secrets/env/Compose changes.
4. Reuse existing signed-owned-cluster fixture protocol: a run/attempt-scoped nonsecret
   token is written as a database comment using pg format quoting, with matching
   DISPOSABLE_CLUSTER_ADMIN_URL/TOKEN for the Uniship step only. This ensures the
   existing test provisions and checks nexora_sync rather than silently using admin
   for worker assertions; real nexora_app vault/auth provisioning also runs. The test
   migrates/drops its UUID database in finally; service teardown removes test roles.
5. Update testing.md; execute static/YAML/trigger checks, prerequisite build, explicit
   units, sequential genuine Sync/Uniship PostgreSQL commands where supported, pinned
   five checks and applicable tooling tests. Preserve timeout15/service/OS/versions/
   permissions/artifact behavior. Record failures honestly; no weakened tests.
6. Independent implementation-code-review, commit only workflow/testing/task, push
   existing PR56, verify actual final source and merge checkout with all three hosted
   gates. Hosted evidence is appended to PR without an evidence-only source commit.
   Keep task VERIFICATION PENDING/PARTIALLY VERIFIED; no merge or live activation.

### P3 follow-up execution evidence

All local checks below used the P3 working tree on source HEAD f13aea8c00a100f6a5feb80a7750e03deddd4dd4, Node24.19.0 and pnpm10.34.6. Timestamps are UTC. No unavailable hosted gate is claimed PASS.

| Claim              | Evidence                                                                                                                                                                                                                                                     | Date       | Result |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| P3 prettier        | `npx --yes prettier@3.6.2 --write .github/workflows/sync-targeted.yml docs/operations/testing.md docs/tasks/active/NEXORA-057-uniship-http-adapter.md`; exit0; 2026-11-17T04:17:58.098944+00:00 to 2026-11-17T04:18:01.014115+00:00; working tree on f13aea8 | 2026-11-17 | PASS   |
| P3 build           | `npx --yes pnpm@10.34.6 --filter @nexora/api... build`; exit0; 2026-11-17T04:18:21.577177+00:00 to 2026-11-17T04:18:36.505273+00:00; working tree on f13aea8                                                                                                 | 2026-11-17 | PASS   |
| P3 static          | `python3 /tmp/nexora057-p3-static.py`; exit0; 2026-11-17T04:18:51.717279+00:00 to 2026-11-17T04:18:51.799756+00:00; working tree on f13aea8                                                                                                                  | 2026-11-17 | PASS   |
| P3 pg-setup        | `python3 /tmp/nexora057-pg.py`; exit0; 2026-11-17T04:18:56.571130+00:00 to 2026-11-17T04:18:58.547746+00:00; working tree on f13aea8                                                                                                                         | 2026-11-17 | PASS   |
| P3 sync-unit       | `node --test apps/api/test/sync/**/*.test.cjs`; exit0; 2026-11-17T04:19:20.227029+00:00 to 2026-11-17T04:19:24.058482+00:00; working tree on f13aea8                                                                                                         | 2026-11-17 | PASS   |
| P3 uniship-unit    | `node --test apps/api/test/uniship/normalizer.test.cjs apps/api/test/uniship/provider.test.cjs`; exit0; 2026-11-17T04:19:24.222301+00:00 to 2026-11-17T04:19:25.529188+00:00; working tree on f13aea8                                                        | 2026-11-17 | PASS   |
| P3 format          | `npx --yes pnpm@10.34.6 format:check`; exit0; 2026-11-17T04:19:20.258987+00:00 to 2026-11-17T04:19:41.854767+00:00; working tree on f13aea8                                                                                                                  | 2026-11-17 | PASS   |
| P3 docs            | `npx --yes pnpm@10.34.6 docs:check`; exit0; 2026-11-17T04:19:41.909836+00:00 to 2026-11-17T04:19:43.714948+00:00; working tree on f13aea8                                                                                                                    | 2026-11-17 | PASS   |
| P3 preflight       | `npx --yes pnpm@10.34.6 preflight:check`; exit0; 2026-11-17T04:19:43.762404+00:00 to 2026-11-17T04:19:45.464594+00:00; working tree on f13aea8                                                                                                               | 2026-11-17 | PASS   |
| P3 lint            | `npx --yes pnpm@10.34.6 lint`; exit0; 2026-11-17T04:19:45.515114+00:00 to 2026-11-17T04:20:00.498351+00:00; working tree on f13aea8                                                                                                                          | 2026-11-17 | PASS   |
| P3 test-lint       | `npx --yes pnpm@10.34.6 test:lint`; exit0; 2026-11-17T04:20:00.559352+00:00 to 2026-11-17T04:20:13.027486+00:00; working tree on f13aea8                                                                                                                     | 2026-11-17 | PASS   |
| P3 test-docs       | `npx --yes pnpm@10.34.6 test:docs`; exit0; 2026-11-17T04:20:13.101117+00:00 to 2026-11-17T04:20:16.221923+00:00; working tree on f13aea8                                                                                                                     | 2026-11-17 | PASS   |
| P3 fixture-failure | `python3 /tmp/nexora057-p3-ci-run.py failure`; exit0; 2026-11-17T04:20:17.101387+00:00 to 2026-11-17T04:20:17.778470+00:00; working tree on f13aea8                                                                                                          | 2026-11-17 | PASS   |
| P3 test-preflight  | `npx --yes pnpm@10.34.6 test:preflight`; exit0; 2026-11-17T04:20:16.273181+00:00 to 2026-11-17T04:20:21.737903+00:00; working tree on f13aea8                                                                                                                | 2026-11-17 | PASS   |
| P3 uniship-pg      | `python3 /tmp/nexora057-p3-ci-run.py success`; exit0; 2026-11-17T04:20:17.843271+00:00 to 2026-11-17T04:20:28.732264+00:00; working tree on f13aea8                                                                                                          | 2026-11-17 | PASS   |

Assertions: YAML parsed successfully; all prior job settings/steps/permissions and15-minute timeout compare equal after excluding the two new steps; exactly7 justified paths added;11 representative positive paths and2 unrelated UI negative paths pass. Shell syntax is valid. Sync units27/27 and Uniship units9/9, zero failures/skips. Uniship genuine PostgreSQL12/12 passes using the exact workflow shell script against an owned TCP PostgreSQL17.11 cluster; restricted worker and real encrypted Carrier lifecycle remain active. Synthetic password mode0600 and lowercasehex64 are asserted without printing the value. An intentional exit37 fixture probe preserves that exit and removes the file/directory; success also leaves runner temp empty. The fixture-only probe is an expected failure-path assertion, not a failed production/test command.

Independent implementation-code-review by /root/shipment_list_review: P1=0/P2=0/P3=0; read-only source/plan/security review, not represented as test execution or owner approval. No application/test/assertion/schema/registry/snapshot changed. Canonical testing.md documents targeted commands, owned-cluster role setup and cleanup. Final source HEAD, merge checkout SHA, run IDs/UTC times and exact-head counts will be recorded in PR56 after push, without an evidence-only follow-up commit. Historical results remain historical. External captures/live activation stay NOT VERIFIED in058.

| Claim                                                 | Evidence                                                                                                                                                                                                                                                   | Date       | Result |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Existing Sync genuine PostgreSQL regression unchanged | `node --test integration/sync-integration.test.cjs` from apps/api, owned PostgreSQL17.11;61/61 PASS,0FAIL/0SKIP; exit0; working tree on f13aea8c00a100f6a5feb80a7750e03deddd4dd4; 2026-11-17T04:19:57.956409+00:00 to 2026-11-17T04:22:21.978908+00:00 UTC | 2026-11-17 | PASS   |

## BOUNDED route centralization follow-up — 2026-11-18

Reviewed baseline/PR56 source: 3411a02a699b52145c1be35c2b49034e055d6448;
feat/uniship-http-adapter, clean worktree, PR open/unmerged. Source matches the
selected owner specification: eight endpoint literal occurrences across HTTP client
(auth/verify, GET type and runtime list) and Shipment provider GET calls. External
contract still has exactly four endpoints. This internal refactor keeps the frozen
v1 snapshot/revision/digest and all historical evidence unchanged.
Documentation Impact remains REQUIRED: testing.md and this task own changed test/CI
facts; no change to integration contract, ADR007,058 or any application contract.

| Field                    | Route centralization                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Pure Carrier infrastructure Uniship route declarations and read-route guard                                                                                                                                                                                                                                                                          |
| Existing implementations | apps/api/src/carrier/infrastructure/uniship/uniship-http.client.ts authenticate/verify/getShipment/post; apps/api/src/shipment/infrastructure/uniship/uniship-shipment.provider.ts ordered GET calls; apps/api/test/uniship/provider.test.cjs; carrier-uniship/uniship-verify literal wire tests; sync-targeted.yml narrow owned paths               |
| Domain owner             | Carrier provider infrastructure; Shipment infrastructure imports the existing provider contract, no Domain/Sync abstraction                                                                                                                                                                                                                          |
| Reuse alternatives       | Apply owner-selected four-entry as-const module and private two-read tuple; retain existing transport/auth methods and Node test runner, no alternative routing design or dependency                                                                                                                                                                 |
| Selected approach        | UNISHIP_ROUTES AUTH/VERIFY/SHIPMENTS/WAREHOUSES; derived distinct UnishipAuthRoute and UnishipReadRoute; isUnishipReadRoute unknown-input guard; client/provider consume constants; private post parameter narrows only its type                                                                                                                     |
| Rationale                | One authoritative declaration per unchanged endpoint while preserving compile-time method separation and runtime GET enforcement; smallest scoped refactor                                                                                                                                                                                           |
| Risks                    | GET accidentally permits auth endpoints, circular mock expectations, endpoint/method/payload changes, lost security/abort/error contracts or route-only CI omission                                                                                                                                                                                  |
| Verification             | RED/GREEN exact route object/guard and auth-path no-fetch checks; independent literal wire assertions; emitted JS unit and real PostgreSQL suites; virtual TypeScript negative compile probes; source literal audit; exactly one CI path added with all steps unchanged; pinned checks/quality, independent review and exact-final-head hosted gates |

### Selected implementation and verification sequence

1. Add the focused route-contract regression to existing provider.test.cjs before
   production edits; run it against current emitted JS to record a genuine RED.
   Preserve old unauthorized-path and literal mock wire expectations, extend runtime
   auth-path rejection under fetch spy so no HTTP request may occur.
2. Create only carrier/infrastructure/uniship/uniship-routes.ts using the exact four
   strings, as-const object, private read tuple, derived auth/read types and some()
   guard. Client replaces route literals/type/list and narrows private post type;
   target(path:string), body/auth/gates/status/timeouts/cancellation remain unchanged.
   Provider replaces only two literal arguments and adds the infrastructure import.
3. Add exactly the new routes.ts path to Sync Targeted, preserving existing paths,
   job/commands, random runtime-password fixture, cleanup, versions and15-minute timeout.
   Add concise testing.md description. Do not edit captured fixtures or snapshot.
4. Build API prerequisites; GREEN carrier-uniship/uniship-verify/provider/normalizer
   tests. Compile virtual positive and @ts-expect-error negative route examples;
   audit source: four literal declarations in new module only. Run real PostgreSQL
   carrier-lifecycle and Uniship suites on owned disposable cluster where supported.
5. Pinned pnpm10.34.6 format/lint/test:lint/docs/preflight/contracts/quality; local
   canonical Docker only if supported, otherwise explicit NOT RUN and actual hosted
   Foundation required. Independent implementation-code-review against exact seven
   owned files; retain FAIL history, task status VERIFICATION PENDING and verification
   PARTIALLY VERIFIED. Commit/push existing PR56, check actual source/merge checkout
   for Preflight, Sync Targeted (both Sync/Uniship) and Foundation4–10. Record final
   evidence in PR without unnecessary evidence-only commit. No merge or live calls.

### Route follow-up execution evidence

Local source checkpoint: route-refactor working tree on3411a02a699b52145c1be35c2b49034e055d6448; Node24.19.0/pnpm10.34.6. All timestamps below are UTC. Immutable snapshot remains d29e0d0f818c6b4a954d39e90a1b0eb84d896499d9b4804fcf86c262416e7032. Historical rows are retained.

| Claim                     | Evidence                                                                                                                                                                                                                                                                          | Date       | Result |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Route red                 | `node --test apps/api/test/uniship/provider.test.cjs`; exit1; 2026-11-18T02:43:23.708624+00:00 to 2026-11-18T02:43:25.273252+00:00; working tree on3411a02                                                                                                                        | 2026-11-18 | FAIL   |
| Route build               | `npx --yes pnpm@10.34.6 --filter @nexora/api... build`; exit0; 2026-11-18T02:44:10.639765+00:00 to 2026-11-18T02:44:27.440803+00:00; working tree on3411a02                                                                                                                       | 2026-11-18 | PASS   |
| Route unit-green          | `node --test apps/api/test/carrier-uniship.test.cjs apps/api/test/uniship-verify.test.cjs apps/api/test/uniship/provider.test.cjs apps/api/test/uniship/normalizer.test.cjs`; exit0; 2026-11-18T02:44:27.501395+00:00 to 2026-11-18T02:44:29.609919+00:00; working tree on3411a02 | 2026-11-18 | PASS   |
| Route types               | `node /tmp/nexora057-routes-types.cjs`; exit0; 2026-11-18T02:44:48.831725+00:00 to 2026-11-18T02:44:55.730309+00:00; working tree on3411a02                                                                                                                                       | 2026-11-18 | PASS   |
| Route source-static       | `node /tmp/nexora057-routes-static.cjs`; exit1; 2026-11-18T02:45:34.519863+00:00 to 2026-11-18T02:45:35.139617+00:00; working tree on3411a02                                                                                                                                      | 2026-11-18 | FAIL   |
| Route source-static-green | `node /tmp/nexora057-routes-static.cjs`; exit0; 2026-11-18T02:46:03.718670+00:00 to 2026-11-18T02:46:04.340447+00:00; working tree on3411a02                                                                                                                                      | 2026-11-18 | PASS   |
| Route ci-static           | `python3 /tmp/nexora057-routes-ci-static.py`; exit0; 2026-11-18T02:46:04.391404+00:00 to 2026-11-18T02:46:04.467233+00:00; working tree on3411a02                                                                                                                                 | 2026-11-18 | PASS   |
| Route pg-setup            | `python3 /tmp/nexora057-pg.py`; exit0; 2026-11-18T02:46:04.515736+00:00 to 2026-11-18T02:46:06.401052+00:00; working tree on3411a02                                                                                                                                               | 2026-11-18 | PASS   |
| Route carrier-pg          | `python3 /tmp/nexora057-pg-run.py node --test integration/carrier-lifecycle-integration.test.cjs`; exit0; 2026-11-18T02:46:40.328281+00:00 to 2026-11-18T02:47:04.934484+00:00; working tree on3411a02                                                                            | 2026-11-18 | PASS   |
| Route format              | `npx --yes pnpm@10.34.6 format:check`; exit0; 2026-11-18T02:46:40.349005+00:00 to 2026-11-18T02:47:09.098128+00:00; working tree on3411a02                                                                                                                                        | 2026-11-18 | PASS   |
| Route uniship-pg          | `python3 /tmp/nexora057-pg-run.py node --test integration/uniship-shipment-integration.test.cjs`; exit0; 2026-11-18T02:47:04.997273+00:00 to 2026-11-18T02:47:19.452187+00:00; working tree on3411a02                                                                             | 2026-11-18 | PASS   |
| Route lint                | `npx --yes pnpm@10.34.6 lint`; exit0; 2026-11-18T02:47:09.194670+00:00 to 2026-11-18T02:47:26.028609+00:00; working tree on3411a02                                                                                                                                                | 2026-11-18 | PASS   |
| Route test-lint           | `npx --yes pnpm@10.34.6 test:lint`; exit0; 2026-11-18T02:47:26.082313+00:00 to 2026-11-18T02:47:34.405553+00:00; working tree on3411a02                                                                                                                                           | 2026-11-18 | PASS   |
| Route docs                | `npx --yes pnpm@10.34.6 docs:check`; exit0; 2026-11-18T02:47:34.460427+00:00 to 2026-11-18T02:47:36.418158+00:00; working tree on3411a02                                                                                                                                          | 2026-11-18 | PASS   |
| Route preflight           | `npx --yes pnpm@10.34.6 preflight:check`; exit0; 2026-11-18T02:47:36.468092+00:00 to 2026-11-18T02:47:38.308859+00:00; working tree on3411a02                                                                                                                                     | 2026-11-18 | PASS   |
| Route contracts           | `npx --yes pnpm@10.34.6 contracts:check`; exit0; 2026-11-18T02:47:38.404158+00:00 to 2026-11-18T02:47:47.728697+00:00; working tree on3411a02                                                                                                                                     | 2026-11-18 | PASS   |
| Route quality             | `API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`; exit0; 2026-11-18T02:47:47.809203+00:00 to 2026-11-18T02:50:51.777489+00:00; working tree on3411a02                                                                                        | 2026-11-18 | PASS   |

RED: provider suite4PASS/1FAIL because the new canonical route module did not yet exist (MODULE_NOT_FOUND); all four old tests, including added auth-route no-fetch characterization, passed. GREEN after minimal refactor/build: requested four-file unit command15/15 PASS,0FAIL/0SKIP. Assertions independently check all four literal endpoint values, approved reads only and rejection of POST/unknown/malformed/absolute/non-string routes; auth-as-GET fetch-spy count remains0. Existing mock URL/method/payload literals were not replaced by constants.

The first temporary source-audit script compared TypeScript printer output, which preserves trailing-comma/newline trivia, and falsely failed on formatting only. No production change was made to address it. Replaced only that untracked temporary checker with recursive AST kind/literal/identifier comparison (ignoring trivia); GREEN proves the client equals exactly permitted import/constants/type/guard substitutions and provider body equals two route substitutions. This retains the real original FAIL without suggesting an application defect.

Full API virtual no-emit compile passes valid read/auth assignments and guard narrowing plus six independent @ts-expect-error negative cases: GET refuses AUTH/VERIFY/unknown routes, read type refuses arbitrary string, auth type refuses both read routes. AST confirms private post first parameter is UnishipAuthRoute. Probe creates no repository file. Production source search now finds exactly four endpoint literals, one each solely in uniship-routes.ts (baseline eight occurrences in client/provider).

Genuine owned PostgreSQL17.11: carrier-lifecycle22/22 PASS and Uniship12/12 PASS,0FAIL/0SKIP, sequential unchanged suites with actual encrypted Carrier recovery/audit and restricted nexora_sync provisioning; no assertion bypass. Native cluster/private password config removed only after marker ownership verification. Unit tests never contact a live provider.

YAML parsed; exactly one new routes.ts path added; a route-only change matches and unrelated UI does not. Every previous path and the complete jobs/steps object compare equal to baseline, including existing credential cleanup, Node/pnpm/PostgreSQL, permissions, artifacts and15-minute timeout. Snapshot, captured fixtures, external contract,058 and empty production registry unchanged. Independent implementation-code-review by /root/shipment_list_review: P1=0/P2=0/P3=0; read-only review, not execution or owner approval.

Canonical local `sh scripts/quality-docker.sh`: NOT RUN. Rootless VFS has only nginx:1.30.6-alpine cached and approximately714MiB free; prerequisite application images are absent. No shared/development volume reset or global prune was attempted. Native quality/PG do not substitute for Docker: actual final-head hosted Foundation4–10 remains required. Final source SHA, CI merge checkout, run IDs/timestamps/results are recorded in PR56 after push without an unnecessary evidence-only commit. Task remains VERIFICATION PENDING/IMPLEMENTED/PARTIALLY VERIFIED; external authorization and activation remain058 prerequisites, no merge.

## BOUNDED response-size naming follow-up — 2026-11-18

Reviewed source/PR56 HEAD9096468999bc0d49df6eae7fe40825ffac8987aa;
feat/uniship-http-adapter, clean worktree, PR open/unmerged. Exact inspection of
uniship-http.client.ts confirms getShipment passes8*1024*1024 and private post
passes65536 to the shared streaming readText. Existing readText uses size>maxBytes,
checks abort and cancels/releases its reader in finally; it must remain unchanged.

| Field                    | File-local response ceiling names                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Two private constants and their existing HTTP client readText call sites                                                                                                                                                                              |
| Existing implementations | apps/api/src/carrier/infrastructure/uniship/uniship-http.client.ts getShipment/post/readText; existing carrier-uniship/uniship-verify/provider/normalizer units; provider.test.cjs existing loopback fixture                                          |
| Domain owner             | Carrier HTTP transport, not route declarations, configuration or Shipment domain                                                                                                                                                                      |
| Reuse alternatives       | Reuse unchanged readText and existing tests/fixture; selected owner-directed file-local constants, no config/export/new file/dependency or unrelated numeric extraction                                                                               |
| Selected approach        | UNISHIP_AUTH_MAX_RESPONSE_BYTES=64*1024 and UNISHIP_DATA_MAX_RESPONSE_BYTES=8*1024\*1024 after imports, with owner-specified comments; replace only two arguments                                                                                     |
| Rationale                | Name transport policies without altering their exact values or any reader/auth/read behavior                                                                                                                                                          |
| Risks                    | Wrong call-site assignment, widened/tightened ceiling, accidental >= comparison, character instead of byte accounting or unrelated refactor                                                                                                           |
| Verification             | Baseline/after existing unit command; one minimal exact-max/max+1 public HTTP behavior test; AST comparison of only constants/two substitutions and byte-identical readText; pinned build/format/lint/docs/preflight/quality and exact-head hosted CI |

Plan before edits: existing verify oversize70000 and GET8MiB+1 cases prove rejection,
but no exact64KiB/8MiB acceptance or64KiB+1 case exists. Add only one behavior test
in existing apps/api/test/uniship/provider.test.cjs, using its loopback helper and
independent numeric limits. Cover auth/verify and both GET paths with valid JSON
including a multibyte UTF-8 character, padded to exactly the ceiling or one extra
byte; exact values accept, +1 rejects. Preserve all old assertions. This is baseline
characterization of unchanged behavior, not a fabricated RED or private-name test.
Build and execute before production edits, then apply only selected constants/usages
and rerun. No mutation of readText, routes, Provider/Processor/Normalizer/Sync or
snapshots. Expected source scope: HTTP client, smallest boundary test and this task.

Documentation assessment: no additional canonical API/endpoint/schema/architecture
fact changes; no unrelated canonical document needs editing. Keep the task's existing
Documentation Impact REQUIRED declaration and historical evidence intact; this delta
updates only scoped plan/verification evidence. Existing SIGNIFICANT classification,
v1 snapshot/revision/SHA and VERIFICATION PENDING/IMPLEMENTED/PARTIALLY VERIFIED
remain unchanged. Commit/push same PR56; final source/merge/run provenance in PR,
no unnecessary evidence-only commit, live activation or merge.

### Response-size naming execution evidence

Local checkpoint: response-limit working tree on9096468999bc0d49df6eae7fe40825ffac8987aa, Node24.19.0 and pnpm10.34.6; timestamps UTC. No existing evidence or immutable snapshot was rewritten.

| Claim                           | Evidence                                                                                                                                                                                                                                                                          | Date       | Result |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Response ceiling baseline-build | `npx --yes pnpm@10.34.6 --filter @nexora/api... build`; exit0; 2026-11-18T03:17:32.241075+00:00 to 2026-11-18T03:17:48.375698+00:00; working tree on9096468                                                                                                                       | 2026-11-18 | PASS   |
| Response ceiling baseline-unit  | `node --test apps/api/test/carrier-uniship.test.cjs apps/api/test/uniship-verify.test.cjs apps/api/test/uniship/provider.test.cjs apps/api/test/uniship/normalizer.test.cjs`; exit0; 2026-11-18T03:17:48.458731+00:00 to 2026-11-18T03:17:50.576086+00:00; working tree on9096468 | 2026-11-18 | PASS   |
| Response ceiling build          | `npx --yes pnpm@10.34.6 --filter @nexora/api... build`; exit0; 2026-11-18T03:18:29.659188+00:00 to 2026-11-18T03:18:44.982377+00:00; working tree on9096468                                                                                                                       | 2026-11-18 | PASS   |
| Response ceiling unit           | `node --test apps/api/test/carrier-uniship.test.cjs apps/api/test/uniship-verify.test.cjs apps/api/test/uniship/provider.test.cjs apps/api/test/uniship/normalizer.test.cjs`; exit0; 2026-11-18T03:18:45.041994+00:00 to 2026-11-18T03:18:47.125404+00:00; working tree on9096468 | 2026-11-18 | PASS   |
| Response ceiling static         | `node /tmp/nexora057-limits-static.cjs`; exit0; 2026-11-18T03:19:03.147654+00:00 to 2026-11-18T03:19:03.849741+00:00; working tree on9096468                                                                                                                                      | 2026-11-18 | PASS   |
| Response ceiling format         | `npx --yes pnpm@10.34.6 format:check`; exit0; 2026-11-18T03:18:47.171298+00:00 to 2026-11-18T03:19:06.315721+00:00; working tree on9096468                                                                                                                                        | 2026-11-18 | PASS   |
| Response ceiling lint           | `npx --yes pnpm@10.34.6 lint`; exit0; 2026-11-18T03:19:06.360654+00:00 to 2026-11-18T03:19:18.780307+00:00; working tree on9096468                                                                                                                                                | 2026-11-18 | PASS   |
| Response ceiling docs           | `npx --yes pnpm@10.34.6 docs:check`; exit0; 2026-11-18T03:19:18.829848+00:00 to 2026-11-18T03:19:20.619289+00:00; working tree on9096468                                                                                                                                          | 2026-11-18 | PASS   |
| Response ceiling preflight      | `npx --yes pnpm@10.34.6 preflight:check`; exit0; 2026-11-18T03:19:20.668031+00:00 to 2026-11-18T03:19:22.421287+00:00; working tree on9096468                                                                                                                                     | 2026-11-18 | PASS   |
| Response ceiling quality        | `API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`; exit0; 2026-11-18T03:19:22.471534+00:00 to 2026-11-18T03:22:14.955282+00:00; working tree on9096468                                                                                        | 2026-11-18 | PASS   |

Before/after characterization: requested four-file unit group16/16 PASS before production refactor and16/16 PASS after build,0FAIL/0SKIP. One added behavior test covers eight loopback HTTP requests: exactly65536 and65537 bytes on auth/verify, exactly8388608 and8388609 bytes on both GET endpoints. Bodies contain valid JSON with a multibyte UTF-8 character and padding, so an oversized auth rejection cannot be explained only by invalid JSON, and byte/character accounting is distinguished. At the ceiling, auth identity/token parsing and GET byte length are asserted; one byte over rejects through existing errors. No private-name assertion or old test weakening; baseline GREEN is intentional for this behavior-preserving change, not a claimed RED.

Static audit PASS: two file-local const declarations exactly65536/8388608 with requested comments and no exports. Full production AST equals baseline plus only the two declarations and two argument substitutions. readText source text is byte-identical, including size>maxBytes, streaming, cancellation, cancel/release and UTF-8 conversion; routes/auth/GET/status/retry/constructor behavior untouched. Exactly three changed files: HTTP client, smallest necessary existing-file boundary test and task record. Frozen v1 SHA remains d29e0d0f818c6b4a954d39e90a1b0eb84d896499d9b4804fcf86c262416e7032.

Independent read-only review by /root/shipment_list_review: P1=0/P2=0/P3=0; no tests/edits/provider access by reviewer. The parent Documentation Impact REQUIRED declaration is retained; this naming-only delta changes no canonical API/endpoint/schema/architecture fact and updates only task plan/evidence, no unrelated documentation.

Canonical local Docker execution: NOT RUN; required application images absent (only nginx:1.30.6-alpine cached), rootless VFS and approximately708MiB free at inspection. No user-volume reset or global prune attempted. Native quality is not substituted for Docker: exact-final-head hosted Preflight/Sync Targeted/Foundation4–10 required. Final source/merge SHA, UTC run results and links are recorded in PR56 after push without an unnecessary evidence-only commit. Task remains VERIFICATION PENDING/IMPLEMENTED/PARTIALLY VERIFIED; no live activation or merge.
