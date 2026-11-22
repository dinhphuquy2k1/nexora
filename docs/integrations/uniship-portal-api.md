# Uniship customer-portal API contract

Contract record: NEXORA-054,2026-11-15. Scope is the owner's own account on
https://kh.uniship.vn, read-only Shipment integration. This documents owner-reported
DevTools observations and selected future adapter behavior; it implements no
adapter, production registration, schema or live calls. The external Carrier gate
remains hard-closed. [ADR-007](../decisions/multi-carrier-architecture.md#owner-authorization-for-uniship-customer-portal-access--2026-11-15-nexora-054)
owns authorization; [backend auth/verify](../architecture/backend.md#independent-uniship-transport)
owns the existing token/custody boundary. Nexora Identity remains independent.

## Evidence and confidence

**XÁC NHẬN** means observed/reported by the owner, not independently fetched by
Nexora or a provider-published specification. **GIẢ ĐỊNH** is a selected hypothesis
requiring verification before it can drive normalized data. **CHƯA BIẾT** must not
be silently guessed. A confirmed wire shape does not confirm a field's business
meaning, source stability, currency or timezone.

Owner-supplied redacted captures from2026-11-15 (03:49–04:07UTC) are retained in
[fixture provenance](../../apps/api/test/fixtures/uniship/README.md):
transition-page.json has one Status1 row/page1/rowsPerPage15; china-stores.json has
24 warehouse rows with five retained fields. Captured bytes, key order, JSON types,
raw0.0 spellings and warehouse whitespace remain unchanged. Status2–5/13/0/99
fixture cases are explicitly derived, not captured observations. The owner reports
successful status-tab filters and request sizes50 and100 separately; raw captures
for every such request are not included, and are not fabricated here.

## Endpoints and authorization

Base URL: `https://kh.uniship.vn`. Accept: `application/json`. Use the verified
Bearer token from the existing Carrier auth/verify flow, never a Nexora session.
Allowed endpoints for the owner's account:

- `POST /client/api-token-auth/`: existing password login.
- `POST /client/api-token-verify/`: existing candidate-token verification.
- `GET /client/api/transition/`: retail/e-commerce parcels.
- `GET /client/api/chinaStores/`: warehouse lookup.

Do not call `/client/api/customers/{id}`: it exposes the account owner's personal
data and is not required by Shipment. No writes, broader portal scraping or live
CI access are authorized. Existing encrypted passwords stay within
carrier_connection_secrets and the audited Carrier recovery boundary.

The agreed local policy for a future activated integration is at most1 request/s
per connection, default sync interval not below60 minutes and backoff for429/5xx.
Uniship has not communicated a numerical rate/concurrency quota; these are Nexora
limits, not a claimed provider SLA. Existing production acquisition budgets remain
unchanged by this documentation. Provider stop request or contract drift (invalid
envelopes, widespread unfamiliar status codes) requires capability disablement.
All production capabilities remain unregistered now. Exposed historical tokens or
cookies must be invalidated by changing the Uniship account password; this task
does not perform or claim completion of that account operation.

## Parcel list, filtering and pagination

```text
GET /client/api/transition/?ecommerce=true&filter=<base64>&page=<n>&rowsPerPage=100&q=
```

`filter` is base64-encoded JSON with the following shape (then URL-encode the query
value; base64 is transport encoding, not encryption):

```json
{
  "filter": [{ "column": "IsEcommerce", "value": 1, "condition": "equal" }]
}
```

A status tab additionally supplies
`{"column":"Status","value":<numeric code>,"condition":"equal"}` in the same
filter array. Page numbers start at1. The owner confirmed rowsPerPage50 and100;
future Shipment sync uses100. The captured file remains the real15-row-size request
with one result, not a rewritten100-row capture. Empty q is the documented list
request; no unverified search semantics are assumed.

Envelope:

```text
{ status, message, data[], total, offset, rowsPerPage,
  summary: { TotalStatusAll, TotalStatus0, TotalStatus1, TotalStatus2,
             TotalStatus3, TotalStatus4, TotalStatus5, TotalStatus13 } }
```

The capture has status200/message Success, numeric total/offset/rowsPerPage and
numeric summary counts. Check the HTTP result and envelope independently; exact
paging, duplicates/identity and malformed-record rules require fixture-backed
adapter tests. Summary describes provider status counts, not a proof that a page
contains every shipment. Do not sum overlapping/claim counts into logistics-stage
counts or substitute current-page length for total.

Strategy: **FULL**. Support for any filter condition other than equal, especially
ModifiedDate greater-than, is unconfirmed. INCREMENTAL and ordering/watermark
semantics remain deferred until evidence exists; ModifiedDate presence alone is
not an incremental contract. Keep existing engine LIMIT100/timeout15000/fences and
Shipment incoming50-charge/500-item/4-milestone bounds.

## Warehouse list and namespace separation

`GET /client/api/chinaStores/` uses an envelope with status/message/data/total/
offset/rowsPerPage/summary. The capture has total24, offset0,
rowsPerPage10000000 and summary null; these metadata are preserved as received,
not a request-size recommendation. Each retained row contains:

| Field       | Observed shape and meaning                                          |
| ----------- | ------------------------------------------------------------------- |
| ID          | Numeric warehouse lookup key                                        |
| Name        | String; empty names and a trailing space occur and are retained     |
| StoreType   | Numeric1 = China warehouse,2 = Vietnam warehouse (owner-confirmed)  |
| CountryCode | Provider strings C/V in this capture, not ISO country-code evidence |
| IsHidden    | Numeric0.0/1.0 or null, not a proven boolean-only field             |

Resolve a parcel's ChinaStoreID to origin_warehouse using this list: the sample
ID19 resolves to its named China store. ReceivePlaceID belongs to a different
identifier namespace; use the parcel's ReceivePlaceName directly for destination
warehouse. Even a coinciding numeric ID is not a valid join: sample ReceivePlaceID1
has name Kho Hà Nội, whereas chinaStores ID1 names a different store. Do not infer
warehouse identity from a display name or silently fabricate a missing lookup.
For Mapping V2, only stage originWarehouseId when the same ChinaStoreID resolves
successfully to a valid originWarehouse name in the current chinaStores lookup.
On an unresolved ID, warn and omit both fields; a subsequent partial sync must
preserve the last consistent ID/name pair instead of combining a new unknown ID
with an old name. This intentionally defers an unresolved ID until a valid lookup.
Contact/address/audio and other omitted warehouse fields are outside scope; the
fixture README records exactly what was removed.

## Confirmed Uniship status mapping

This table supersedes the earlier interface-label-only PROVISIONAL dictionary for
Uniship codes. Evidence is the owner's reported filters for each tab; only Status1
is present in the retained real parcel capture. This is an approved contract, not
an implemented production mapper or live-gate opening.

| Status | Provider label                      | logistics_stage / handling                         |
| ------ | ----------------------------------- | -------------------------------------------------- |
| 1      | Đang đến kho gửi                    | TO_ORIGIN_WAREHOUSE                                |
| 2      | Đã về kho gửi                       | AT_ORIGIN_WAREHOUSE                                |
| 3      | Đang về kho nhận                    | TO_DEST_WAREHOUSE                                  |
| 4      | Đã về kho nhận                      | AT_DEST_WAREHOUSE                                  |
| 5      | Đã giao hàng                        | DELIVERED                                          |
| 13     | Khiếu nại                           | Claim handling below; never a sixth physical stage |
| 0      | No observed tab; present in summary | UNKNOWN; business meaning unverified               |
| Other  | Unrecognized                        | UNKNOWN plus a fixed safe warning                  |

For Status13, set provider_claim_status to the exact string `"13"` and choose the
physical stage in this order:

1. If OldStatus is one of1..5, use its stage from the table.
2. Otherwise retain the shipment's previously stored Nexora logistics_stage.
3. For a new shipment without that previous stage, use UNKNOWN.

For Status other than13, provider_claim_status is null. The derived13/OldStatus4
case therefore expects AT_DEST_WAREHOUSE under the selected Nexora policy.
The Status1–5/13 labels are owner-reported observations; the OldStatus-first
priority is a Nexora handling choice, not confirmation of OldStatus chronology
or claim completion. OldStatus's actual business semantics and how a claim ends
remain unverified. Unknown status must warn, not fabricate a physical
stage. Widespread unknown codes additionally trigger capability disablement.
Current Nexora claim filtering/count availability is unchanged in this task.

### Claim policy examples and verification prerequisites

These examples describe the selected future adapter policy, not additional real
captures, an implemented mapper or executed lifecycle tests. Keep the order above:
a recognized newly reported OldStatus wins over the stored Nexora stage even
when they differ. It is not proven to be newer, monotonic or the last physical
stage before a claim.

| Case                                                       | Selected future Nexora handling                                        | Evidence boundary                                                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Status13, OldStatus4                                       | Claim string13 and AT_DEST_WAREHOUSE                                   | Existing derived case only; not a captured claim                                            |
| Status13, OldStatus null                                   | Keep stored stage; UNKNOWN if none                                     | Fallback policy, not a verified provider null meaning                                       |
| Status13, unrecognized OldStatus                           | Keep stored stage; UNKNOWN if none                                     | No invented stage from an unfamiliar value                                                  |
| Claim opened on an existing shipment                       | Apply known OldStatus first, else preserve that shipment's stage       | Actual opening sequence/OldStatus behavior needs captures                                   |
| Provider returns to Status1–5 after a claim                | Map the returned physical code and clear provider_claim_status to null | Selected policy; not proof this sequence means claim resolution                             |
| Stored DELIVERED versus newly reported Status13/OldStatus4 | AT_DEST_WAREHOUSE wins under the existing priority                     | Possible regression illustrates the unverified chronology; do not silently reverse priority |

Before production relies on OldStatus/claim-end semantics, obtain owner-redacted
real lifecycle captures for claim opening, subsequent claim updates and return to
normal status, preserving sequence/context under the existing privacy policy.
Verify what OldStatus means and whether/how claim completion is represented.
The future adapter must add corresponding fixture-backed tests for those captures,
plus explicitly derived policy tests for recognized/null/unknown OldStatus,
new/existing shipments and conflicting prior stages. Mark derived edge cases as
synthetic; they cannot establish provider behavior. Missing lifecycle evidence
remains an activation prerequisite, not an assumption converted into PASS.
Current claim filtering/counts and the production hard-close remain unchanged.

## Parcel-to-Nexora field mapping

The capture has113 parcel keys. Status labels below distinguish observed form
from unverified normalization; null never supplies evidence of a nonnull currency,
unit or meaning. Assumptions are not permission to populate misleading values.

| Provider field(s)                                 | Nexora target / rule                                                                                       | Confidence                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| ID                                                | Source-key scheme uniship-parcel-v1 with the provider ID; never tracking-code identity                     | XÁC NHẬN numeric form; GIẢ ĐỊNH stability/uniqueness across resync/account scope                         |
| TransactionCode                                   | tracking_code                                                                                              | XÁC NHẬN owner mapping and string form                                                                   |
| Status / OldStatus                                | provider_status, logistics_stage, provider_claim_status under the ordered rule above                       | Status labels XÁC NHẬN; OldStatus handling is Nexora policy; lifecycle CHƯA BIẾT                         |
| Weight                                            | weight_kg using the raw JSON numeric lexeme and Domain decimal validation                                  | XÁC NHẬN numeric wire type; no floating-point calculation                                                |
| RealNumberOfPack                                  | actual_package_count; NumberOfPack → package_count (declared)                                              | XÁC NHẬN owner Mapping V2, 2026-11-20; exact integral numeric lexeme                                     |
| ProductNumber                                     | item_count; aggregate count, never per-item quantity                                                       | XÁC NHẬN owner2026-11-20:23 ↔ SỐ SẢN PHẨM23; strict nonnegative integer                                 |
| ProductName                                       | Nonblank scalar name → complete single item; null/blank omits items                                        | XÁC NHẬN owner2026-11-20, parcel343558 nameA; no invented quantity/value                                 |
| ProductAmount                                     | declared_value, CNY                                                                                        | XÁC NHẬN owner2026-11-20:1000 ↔ GIÁ TRỊ(¥)1,000; exact nonnegative decimal                              |
| PriceAmount / ListedPriceAmount / FeeWeightAmount | PriceAmount → typed VND/kg freight price; FeeWeightAmount → WEIGHT_FREIGHT VND; ListedPriceAmount deferred | XÁC NHẬN selected fields by owner, 2026-11-20; ListedPriceAmount CHƯA BIẾT                               |
| FeeShip / FeeShipVN                               | DOMESTIC_SHIPPING; unsuffixed candidate CNY and suffixed candidate VND                                     | GIẢ ĐỊNH; verify units and avoid double-counting two representations                                     |
| IsGuarantee + GuaranteeAmount/GuaranteeAmountVND  | INSURANCE service from numeric1/0; selected VND insurance fee independent                                  | XÁC NHẬN owner2026-11-20: Bảo hiểm chính ngạch đường bộ; null omitted/unknown, unsuffixed alias deferred |
| IsCheck + CheckFee/CheckFeeVND                    | COUNTING service from numeric1/0; CheckFeeVND → COUNTING VND, zero retained                                | XÁC NHẬN owner2026-11-20: Kiểm đếm gói A; null omitted/unknown, unsuffixed alias deferred                |
| IsFragileGoods + FragileFee/FragileFeeVND         | FRAGILE_GOODS service from numeric1/0; selected WOOD_PACKING VND independent                               | XÁC NHẬN owner2026-11-20: Dịch vụ đóng gỗ; null omitted/unknown, unsuffixed alias deferred               |
| IsFoam + FoamFee/FoamFeeVND                       | FOAM service from numeric1/0; selected BUBBLE_WRAP VND independent                                         | XÁC NHẬN owner2026-11-20: Dịch vụ bọt khí; null omitted/unknown, unsuffixed alias deferred               |
| FeeOther + FeeOtherNote                           | OTHER, providerLabel = FeeOtherNote                                                                        | GIẢ ĐỊNH; currency still unverified                                                                      |
| StoreCNImportDate                                 | ORIGIN_RECEIVED occurred_at                                                                                | XÁC NHẬN owner 2026-11-20, Vietnam local time (UTC+7; retained owner policy)                             |
| StoreCNExportDate / StoreCNExDate                 | ExportDate → ORIGIN_DISPATCHED; ExDate is consistency guard only                                           | XÁC NHẬN selected ExportDate; warn/omit dispatch on conflict, no ExDate fallback                         |
| StoreVNImportDate                                 | DEST_RECEIVED occurred_at, location_name = ReceivePlaceName                                                | XÁC NHẬN owner 2026-11-20, Vietnam local time (UTC+7; retained owner policy)                             |
| StoreVNExportDate                                 | DEST_DISPATCHED occurred_at                                                                                | XÁC NHẬN owner 2026-11-20, Vietnam local time (UTC+7; retained owner policy)                             |
| ChinaStoreID                                      | origin_warehouse lookup by chinaStores ID                                                                  | XÁC NHẬN lookup shape and owner mapping                                                                  |
| ReceivePlaceName                                  | Destination warehouse name; not a ReceivePlaceID join to chinaStores                                       | XÁC NHẬN string/owner mapping                                                                            |
| ExchangeRate                                      | exchange_rate (source-reported value, no conversion); exchange_rate_at remains null                        | XÁC NHẬN rate value; effective-rate timestamp NOT PROVIDED                                               |
| TotalAmount                                       | total_amount, VND                                                                                          | XÁC NHẬN owner 2026-11-20, VND; paid/remain stored separately                                            |
| ModifiedDate                                      | provider_updated_at after explicit timezone conversion                                                     | XÁC NHẬN owner Vietnam local time (UTC+7; retained owner policy), 2026-11-20; not incremental ordering   |

The provider's service flags are separate from fees. Nexora's independent
shipment_services foundation accepts only canonical normalized boolean facts from
the fixture-backed adapter. Owner confirmed numeric1/0/null semantics on2026-11-20;
null/missing never becomes false, and booleans/strings/other numbers are invalid. Owner
confirmed directly on Uniship on 2026-11-15: IsFragileGoods maps to service
FRAGILE_GOODS = "Đóng gỗ"; IsFoam maps to service FOAM = "Bọt khí". Service codes
remain unchanged and do not derive facts from WOOD_PACKING/BUBBLE_WRAP fee rows. Legacy
chargeSummary flags remain fee-presence indicators, not service evidence. A null
fee does not prove disabled service; a flag never creates a fee. Reported totals
and rates are not recalculated or converted. No live adapter/capability is enabled.

### Unused captured fields — exhaustive inventory

Every remaining captured key is unused for this integration stage. Names below
are exact, including provider spelling; no aliases or hidden extra fields are
silently mapped. Some keys are retained as null only in the owner-redacted fixture,
not authorized as personal data for future normalized payloads.

| Reason / group                                                       | Exact unused provider keys                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private account, contact, staff and print metadata                   | `UID`, `Username`, `CreatedBy`, `ModifiedBy`, `StoreStaffID`, `StoreStaffRate`, `FakePrintDate`, `FakeCustomerName`, `FakeCustomerAddress`, `FakeCustomerPhone`, `TranferBy`                                                                               |
| Provider workflow, order, package and internal warehouse identifiers | `OrderCodeID`, `PackageType`, `VbiCode`, `State`, `StoreUID`, `CsID`, `StoreOrderID`, `OrderID`, `BigPackageID`, `ProductType`, `ExportReceiptID`, `KennelID`, `StoreVNState`, `ReceiptState`, `StoreCNImportID`, `StoreVNImportID`, `StoreReceivePlaceID` |
| Unverified measurements, package detail and count alternatives       | `Length`, `Width`, `Height`, `Density`, `Volume`, `WeightByVolume`, `MissingPackage`, `Packages`                                                                                                                                                           |
| Unverified pricing, fee selectors and commissions                    | `FeeFragileGoods`, `GuaranteeType`, `GuaranteeRate`, `CheckFeeType`, `FixPriceAmount`, `FeeWeightCommission`, `FixFeeWeightCommission`, `WarningFeeWeightCommission`, `PriceType`                                                                          |
| Payment, balances and deposits outside Shipment scope                | `DepositCode`                                                                                                                                                                                                                                              |
| Free text, images, warehouse notes and transfer annotations          | `ProductImage`, `OrderNote`, `StoreCNNote`, `StoreVNNote`, `PublicNote`, `TranferNote`                                                                                                                                                                     |
| Internal routing, transport and delivery workflow                    | `TransportName`, `ShippingInfo`, `Routing`, `IgnoreRouting`, `IsUpdateRouting`, `WarningStatus`, `ReceivePlaceID`, `TranferStoreID`, `TranferStoreName`, `TranferDate`, `Deliverable`                                                                      |
| Provider creation, archive/delete and first-order lifecycle          | `SoftDeleted`, `SoftDeleteDate`, `IsFirstOrder`, `FirstOrderDate`, `IsArchived`                                                                                                                                                                            |
| List scope only; not a Shipment value                                | `IsEcommerce`                                                                                                                                                                                                                                              |

Density2147483647 is a special sentinel, not a usable density measurement. The
additional FeeFragileGoods field is not silently treated as FragileFee. CreatedDate
never replaces Nexora-created timestamps; it is a separate providerCreatedAt reference.
Paid/remain values are separate provider-reported VND facts. Internal notes/contact data do not enter Shipment normalization.

## Exact numbers and timestamps

Provider numbers are JSON numeric tokens, not decimal strings: examples include
0.0 and3980. The adapter preserves the source digits from the JSON text
using Node24 JSON.parse reviver `context.source` for numeric primitive fields,
then validate the resulting decimal text through the existing Domain DecimalValue.
Do not reconstruct digits from the already-parsed Number, multiply/divide/round
with floating-point arithmetic, normalize through toFixed or infer currencies.
Do not rewrite captured fixtures with JSON.parse/stringify: that loses raw0.0
spelling even though the JSON value remains numeric. IDs/counts additionally need
their own validated integer/source-key contracts; density's sentinel is unused.

Observed timestamps are strings without a timezone, for example
`2026-10-18T15:35:48.000`.

Owner decision 2026-11-20: Vietnam local time (UTC+7). Conflicting observation kept for review: order MD59639 API CreatedDate 2026-11-20T03:03:16 while the Uniship UI showed 20-11-2026 10:03:16.

Retain the original parseUnishipLocalTimestamp: validate calendar/format/milliseconds,
then convert UTC+7 to UTC for storage. Web renders Asia/Ho_Chi_Minh. The observation
is conflicting evidence, not a resolved UTC conclusion. The intervening UTC-only
interpretation is superseded by this latest retained-policy decision. Before
automatic scheduling, NEXORA-058 requires first-real-sync comparison of warehouse
milestones for three parcels;7-hour discrepancy stops/keeps schedules disabled,
requires a separate UTC correction task and fresh sync of provider-owned times.
No host-local parsing, invented rate effective time or live activation is authorized.

## Errors, drift and stop behavior

Future Shipment reads classify401/403 through the existing Carrier re-auth/
REAUTH_REQUIRED lifecycle;429/5xx are retryable with backoff. Preserve identity
coherence, fail-closed audit-before-password-decrypt, generation/version fencing
and existing budgets. This policy does not change the current auth client's exact
HTTP error mappings or assert live error captures; dedicated fixture-backed
adapter verification is required before implementation/activation.

Malformed envelope is a page error: do not checkpoint a guessed empty result.
A malformed individual shipment with a valid stable source identity resolves
REJECTED_SOURCE while valid siblings can apply under the existing Sync contract.
Missing/invalid identity follows the existing safe page-ingestion failure policy;
never invent an ID merely to record a rejection. Distinguish transient transport faults
from deterministic source validation, never classifying programming/DB errors as
business rejection to advance progress.

Unfamiliar status, missing required fields and changed field types must produce
the selected fixed safe diagnostic identifiers UNISHIP_STATUS_UNKNOWN,
UNISHIP_REQUIRED_FIELD_MISSING, UNISHIP_FIELD_TYPE_CHANGED and
UNISHIP_ENVELOPE_INVALID. Do not include raw payloads, tokens or personal data in
warnings. These are the future adapter's documented diagnostic identifiers; this task adds
no runtime diagnostics or public API error codes. An unknown individual status maps UNKNOWN with warning; widespread unknown
statuses or envelope/type drift requires disabling the capability for review.
A provider request to stop also disables it. No silent dropping or live probing.

## Unknowns and the consequence of guessing

| Unknown                                                 | Consequence of an unjustified guess                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Status0 meaning                                         | Wrong stage/counts or loss of exceptional parcels                                   |
| OldStatus semantics and claim completion                | Regressed physical stage or incorrectly cleared/open claim                          |
| Unselected ListedPriceAmount meaning                    | ProductAmount is now confirmed CNY; ListedPriceAmount still unverified              |
| Unselected fee aliases and rate effective timestamp     | Selected VND fields confirmed; do not infer unsuffixed currencies or effective time |
| ProductNumber/per-item quantity correspondence          | Invented per-item quantities                                                        |
| Full semantics of StoreCNExDate                         | ExportDate selected; ExDate consistency-only, not fallback                          |
| Non-equal filter operators / incremental ordering       | Missing shipments or invalid watermark advancement                                  |
| Cancelled/returned parcels and exceptional status codes | False delivery/stage or silent loss                                                 |
| ID stability/uniqueness across resync and account scope | Duplicate or incorrectly linked shipments                                           |
| Actual maximum charge/item lines per parcel             | Rejected valid provider records or unsafe capacity assumptions                      |
| Per-item quantity/value correspondence                  | Aggregate count/value do not establish individual item quantities or prices         |

No live gate opens from these documents. A later fixture-backed adapter task must
resolve required semantics; actual live-environment enablement is a separate task
with remaining ADR007 gates, operational custody and explicit activation evidence.

## Fixture-backed adapter implementation — NEXORA-057 (2026-11-16)

The preceding NEXORA-054 capture/selected-policy record remains historical evidence.
NEXORA-057 implements the following mock/fixture-backed subset, not live-provider
verification. Production capability declarations remain empty and the existing
external-request hard-close remains enforced, including with runtime opt-in.
NEXORA-058 owns controlled activation and its remaining evidence/custody gates.

### Transport and FULL pages

Shipment infrastructure composes existing CarrierConnectionLifecycleService.withToken
and UnishipHttpClient.getShipment; there is no second password/token mechanism.
The existing client reuses its URL/live/HTTPS gate, timeout and bounded stream
reader; authentication keeps64KiB, data reads have an8MiB Nexora bound. Only the two
approved GET paths are accepted. Redirects are rejected; caller abort propagates,
401/403 goes through existing bounded token recovery,429/5xx remain retryable.
Owner/account/generation/lifecycle facts are checked before fetching; existing Sync
fences reject stale work after network completion. No HTTP or crypto under DB locks.

Each fetch reads the complete chinaStores response and one100-row parcel page;
warehouses/tokens are not cached across accounts/jobs. The filter/query is exactly
the approved ecommerce/equal filter, page>=1, rowsPerPage100 and empty q. Validate
status/message/data/summary/count metadata, expected offset and final-page length
before returning SyncPage. Invalid envelopes/identities fail the page without
advancing its checkpoint; a malformed valid-ID row retains only a fixed invalid
marker for REJECTED_SOURCE. Unknown valid status is not rejection or human review.
Within-page duplicate IDs fail; existing stable source identity/idempotence handles
repeat observations across pages and FULL jobs. No snapshot-isolation/ordering/
watermark or automatic deletion-from-absence guarantee is claimed.

### Implemented normalized field policy

| Observation                            | Implemented normalized fact                                                                                  | Evidence and limits                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| ID                                     | uniship-parcel-v1 sourceKey with the exact canonical positive integer lexeme                                 | Numeric form captured; resync/account stability remains externally NOT VERIFIED; tracking code is never identity |
| TransactionCode                        | trackingCode unchanged                                                                                       | Required nonempty Domain-valid string, no silent trimming                                                        |
| Status                                 | providerStatus numeric string; approved1–5 stage mapping                                                     | Owner-reported mapping; captured1, other status tests derived                                                    |
| Status13 / OldStatus                   | claim string13; known OldStatus1–5 wins, else locked existing stage, else UNKNOWN                            | Selected Nexora policy, not real claim chronology/completion proof                                               |
| Status other than13                    | providerClaimStatus null; unknown physical codes UNKNOWN with safe warning                                   | Synthetic0/99 regressions, no invented labels                                                                    |
| Weight                                 | exact source lexeme through DecimalValue(10,3), nonnegative                                                  | Node24 JSON.parse context.source; no float reconstruction or rounding; missing/null omitted                      |
| ChinaStoreID                           | originWarehouse only from matching chinaStores ID with StoreType1 and valid nonempty Name                    | Names/whitespace preserved, not identity; missing lookup omitted with fixed warning                              |
| ReceivePlaceName                       | destinationWarehouse                                                                                         | Owner Mapping V2; never a ReceivePlaceID join                                                                    |
| Service flags                          | services complete snapshot of supplied numeric1/0 facts; null no row, all-null omit collection               | Owner confirmed four labels and flag1/0/null semantics2026-11-20; no fee inference                               |
| Selected fees, money, rates and counts | Mapped under the V2 table below                                                                              | Owner 2026-11-20; unselected fields remain omitted                                                               |
| ProductName/line details               | complete single item for nonblank name; ProductNumber itemCount, ProductAmount declaredValue CNY             | Owner confirmed; item quantity/unitValue remain null, no splitting/inference                                     |
| Provider times                         | Vietnam local time (UTC+7; retained owner policy) explicit conversion for selected times and four milestones | providerChangedAt/exchangeRateAt are not inferred                                                                |

Missing optional collections preserve existing services/charges/items/milestones.
Selected chargePatch/milestonePatch enrich only supplied facts; only a separately
verified complete:true snapshot may clear an entire collection. Tests of complete true/false/empty inputs verify Nexora's existing contract,
not Uniship wire completeness. No fee-derived service and no null-to-false behavior.
Normalized source records retain only validated shipment facts and the minimal
OldStatus decision context, or {invalid:true}; no account/contact/notes/raw record.
Existing canonicalPayload/payloadHash/sourceVersion and processorVersion are reused.

### Claim/session/version boundary

ShipmentSyncSession now exposes readonly existingLogisticsStage from the root already
locked/hydrated by ShipmentSyncBinding. The Uniship-specific processor receives only
validated status/OldStatus and that trusted stage; generic ShipmentAggregate contains
no Uniship dictionary. The composition delegates proposal validation/application to
ShipmentSyncProcessor. First Uniship mapper version is1, configured in test-only
registration; existing generic processor behavior/versions remain unchanged.
New roots have an initial history row; later rows occur only on actual physical
stage change. Claim-only/service-only/same-stage observations do not invent history.
A recognized OldStatus may regress DELIVERED under the chosen priority; this does
not prove chronology. DB/programming failures propagate and roll back, never become
REJECTED_SOURCE. No transaction/fencing/permission contract is relaxed.

### Verification still required before activation

UNISHIP_FIELD_SEMANTICS_VERIFICATION and UNISHIP_CLAIM_LIFECYCLE_CAPTURE remain
NOT VERIFIED externally. The captured raw15-row-size response and both hashes are
unchanged;100-row mock envelopes and extra status/claim scenarios are synthetic.
No new provider/account capture, credential publication or live endpoint call occurs.
Still require real redacted claim-opening/update/ending evidence, ID stability and
pagination consistency, unselected money/unit/currency meanings,
actual child maxima and the remaining ADR007/operational gates.
The future activation must also enforce the agreed1request/s per connection and
its provider stop/contract-drift disablement procedure; this mock-only adapter does
not assert those live operational controls are verified.

## Owner Mapping V2 — 2026-11-20

This extends the minimal processor1 mapping baseline. Owner decision2026-11-22
supersedes the earlier development processor2 choice: the default remains1.
Mapping V2 identifies the mapping scope, not a processor version. Richer new
observations under processor1 advance source versions; stored minimal payloads
cannot reconstruct absent provider facts.
Owner-discussion sample341827 is not a new live capture. All four milestone dates,
CreatedDate, ModifiedDate and PaymentDate are Vietnam local time (UTC+7; retained owner policy); dates are validated rather than
host-parsed. NumberOfPack is declared count, RealNumberOfPack actual count.

| Source                                                                        | Implemented target                                        | Basis                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| PriceAmount                                                                   | typed freightUnitPrice VND/kg                             | Owner confirmed23500                                    |
| FeeWeightAmount                                                               | WEIGHT_FREIGHT charge, VND                                | Owner confirmed940                                      |
| TotalAmount                                                                   | totalAmount/totalCurrency VND                             | Reported total, not sum                                 |
| TotalPaidAmount / TotalRemainAmount / PaymentDate                             | Separate paid/remaining/payment-time core facts           | Owner confirmed940/0/local payment time                 |
| NumberOfPack / RealNumberOfPack                                               | packageCount / actualPackageCount                         | Independent integral counts, 1.0 accepted               |
| ChinaStoreID                                                                  | typed originWarehouseProviderId plus existing lookup name | Provider ID not Nexora warehouse FK                     |
| CreatedDate / ShippingMethod                                                  | typed providerCreatedAt / lastMileMethod                  | Reference attributes, no raw response                   |
| GuaranteeAmountVND / FragileFeeVND / FoamFeeVND                               | INSURANCE / WOOD_PACKING / BUBBLE_WRAP charges, VND       | Zero retained; never implies service enabled            |
| StoreCNImportDate / StoreCNExportDate / StoreVNImportDate / StoreVNExportDate | Four canonical warehouse milestones                       | Owner supplied exact dates, no delivered-time inference |

Null/missing source facts omit patches and preserve prior data. Invalid nonnull
selected facts produce the existing safe rejected-source marker. Conflicting
StoreCNExDate emits UNISHIP_ORIGIN_DISPATCH_CONFLICT and omits only dispatch; it
is never a fallback. FeeShip/FeeShipVN/FeeOther and unsuffixed fee aliases remain
unmapped. Four numeric flags now map independent services; CheckFeeVND maps COUNTING VND. Fee currency
confirmation applies only to the selected VND fields, not their unsuffixed aliases.
ListedPriceAmount and unselected fields remain deferred; ProductAmount is confirmed CNY. ExchangeRate
has no supplied effective timestamp and never performs currency conversion.

Storage, bounds and scoped merge semantics are canonical in ADR-011 and the Shipment
domain document. New observations enrich the same source identity; reprocessing
minimal old staging cannot recover absent data. FULL scanning, hard-close and all
NEXORA-058 live prerequisites remain unchanged.

## NEXORA-060 review v2 — owner evidence2026-11-20

Vietnam local time (UTC+7; retained owner policy). The intervening UTC-only interpretation is superseded as current policy; the conflicting observation remains open for review.
OrderMD59639 CreatedDate2026-11-20T03:03:16 displayed20-11-2026 10:03:16; browser
session began03:02:35UTC. Parcel343558 ModifiedDate03:19:58 preceded capture03:20:50UTC.
parseUnishipLocalTimestamp validates source calendar/format/milliseconds and subtracts7hours to store UTC. The original helper body is retained. UI
Vietnam-time rendering stays unchanged; no automatic repair of previously normalized
shifted timestamps or live backfill is claimed. Immutable snapshotv1/evidence remain
historical and are not current timestamp-correctness proof.

Owner saw numeric1 labels in all four columns: Bảo hiểm chính ngạch đường bộ,
Kiểm đếm gói A, Dịch vụ đóng gỗ, Dịch vụ bọt khí. Map IsGuarantee→INSURANCE,
IsCheck→COUNTING, IsFragileGoods→FRAGILE_GOODS, IsFoam→FOAM; numeric0 is false,
null/missing creates no row (unknown), other values raise VALIDATION_ERROR through
the existing safe source rejection path. Existing complete:true services snapshot
contains supplied numeric flags only; if all missing/null, omit services. Omitted
entries inside a supplied complete snapshot become unknown per existing semantics.
Fees never imply service state. CheckFeeVND is COUNTING VND, including0.0.

ProductAmount1000 corresponds to GIÁ TRỊ(¥)1,000: exact nonnegative declaredValue
with CNY. ProductNumber23 corresponds to SỐ SẢN PHẨM23: strict aggregate itemCount.
Nonblank ProductName becomes one complete item {name}; null/trim-empty omits items.
No inferred item quantity/unit value. FeeShip/FeeShipVN/FeeOther/unsuffixed fees remain
deferred because no nonnull owner sample establishes their semantics. No migration,
grant, API/SDK contract change, source identity/FULL/fence change or production enablement.

Owner decision 2026-11-20: package_count holds NumberOfPack (declared count). The Uniship UI column 'SỐ KIỆN (CHÍNH)' showed 0 while NumberOfPack was 1 on all weighed samples; its source is unknown, so Nexora's value may differ from that column.

## Latest retained-time policy — owner request2026-11-21

Owner decision 2026-11-20: Vietnam local time (UTC+7). Conflicting observation kept for review: order MD59639 API CreatedDate 2026-11-20T03:03:16 while the Uniship UI showed 20-11-2026 10:03:16.

The policy remains UTC+7→UTC with the original parseUnishipLocalTimestamp body.
The preceding UTC-only decision/synthetic test expectations are now historical,
not current policy or proof resolving this conflict. All selected service/product/
COUNTING mappings and both count sources stay unchanged. Web explicitly renders
Shipment milestones in Asia/Ho_Chi_Minh, independently of host timezone.

NEXORA-058 must, after first controlled real sync and before enabling automatic
schedules, compare warehouse import/export times of three parcels between Nexora
and Uniship UI. Record redacted observations. If Nexora is7hours off, stop/keep
automatic schedules disabled, implement a separate task switching interpretation
to UTC, then sync fresh observations again to overwrite provider-owned timestamps
under existing source/version/transaction fences. Stage history is not fabricated.
This task performs no live sync and does not open production.
