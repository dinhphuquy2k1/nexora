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

| Provider field(s)                                 | Nexora target / rule                                                                                   | Confidence                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| ID                                                | Source-key scheme uniship-parcel-v1 with the provider ID; never tracking-code identity                 | XÁC NHẬN numeric form; GIẢ ĐỊNH stability/uniqueness across resync/account scope                                      |
| TransactionCode                                   | tracking_code                                                                                          | XÁC NHẬN owner mapping and string form                                                                                |
| Status / OldStatus                                | provider_status, logistics_stage, provider_claim_status under the ordered rule above                   | Status labels XÁC NHẬN; OldStatus handling is Nexora policy; lifecycle CHƯA BIẾT                                      |
| Weight                                            | weight_kg using the raw JSON numeric lexeme and Domain decimal validation                              | XÁC NHẬN numeric wire type; no floating-point calculation                                                             |
| RealNumberOfPack                                  | package_count; NumberOfPack is a separate unresolved field                                             | GIẢ ĐỊNH business meaning; numeric1 observed                                                                          |
| ProductNumber                                     | item_count; do not infer per-item quantity from an aggregate count                                     | GIẢ ĐỊNH; captured value null                                                                                         |
| ProductName                                       | One shipment_items name line when a nonempty nonnull string is supplied; no invented product splitting | XÁC NHẬN owner-reported scalar string shape; retained capture is null, quantity/value correspondence unverified       |
| ProductAmount                                     | declared_value, CNY                                                                                    | GIẢ ĐỊNH amount meaning and currency                                                                                  |
| PriceAmount / ListedPriceAmount / FeeWeightAmount | Competing candidates for ĐƠN GIÁ; none selected                                                        | CHƯA BIẾT                                                                                                             |
| FeeShip / FeeShipVN                               | DOMESTIC_SHIPPING; unsuffixed candidate CNY and suffixed candidate VND                                 | GIẢ ĐỊNH; verify units and avoid double-counting two representations                                                  |
| IsGuarantee + GuaranteeAmount/GuaranteeAmountVND  | Independent insurance service flag and candidate INSURANCE fee                                         | XÁC NHẬN separate flag model; GIẢ ĐỊNH fee meaning/currency and null/false semantics                                  |
| IsCheck + CheckFee/CheckFeeVND                    | Independent checking service flag and candidate COUNTING fee                                           | XÁC NHẬN separate flag model; GIẢ ĐỊNH fee meaning/currency and null/false semantics                                  |
| IsFragileGoods + FragileFee/FragileFeeVND         | FRAGILE_GOODS service = "Đóng gỗ"; candidate WOOD_PACKING fee                                          | XÁC NHẬN service label: owner verified on Uniship, 2026-11-15; fee/currency and null/false semantics unverified       |
| IsFoam + FoamFee/FoamFeeVND                       | FOAM service = "Bọt khí"; candidate BUBBLE_WRAP fee                                                    | XÁC NHẬN service label: owner verified on Uniship, 2026-11-15; GIẢ ĐỊNH fee meaning/currency and null/false semantics |
| FeeOther + FeeOtherNote                           | OTHER, providerLabel = FeeOtherNote                                                                    | GIẢ ĐỊNH; currency still unverified                                                                                   |
| StoreCNImportDate                                 | ORIGIN_RECEIVED occurred_at                                                                            | XÁC NHẬN selected source correspondence; nonnull timestamp/timezone semantics need evidence                           |
| StoreCNExportDate / StoreCNExDate                 | ORIGIN_DISPATCHED occurred_at candidates                                                               | CHƯA BIẾT difference/precedence; never silently choose conflicting values                                             |
| StoreVNImportDate                                 | DEST_RECEIVED occurred_at, location_name = ReceivePlaceName                                            | XÁC NHẬN selected source correspondence; timezone GIẢ ĐỊNH                                                            |
| StoreVNExportDate                                 | DEST_DISPATCHED occurred_at                                                                            | XÁC NHẬN selected source correspondence; timezone GIẢ ĐỊNH                                                            |
| ChinaStoreID                                      | origin_warehouse lookup by chinaStores ID                                                              | XÁC NHẬN lookup shape and owner mapping                                                                               |
| ReceivePlaceName                                  | Destination warehouse name; not a ReceivePlaceID join to chinaStores                                   | XÁC NHẬN string/owner mapping                                                                                         |
| ExchangeRate                                      | exchange_rate; exchange_rate_at candidate ModifiedDate                                                 | GIẢ ĐỊNH units and effective-rate timestamp                                                                           |
| TotalAmount                                       | total_amount, VND                                                                                      | GIẢ ĐỊNH currency/meaning; TotalPaidAmount/TotalRemainAmount unused                                                   |
| ModifiedDate                                      | provider_updated_at after explicit timezone conversion                                                 | XÁC NHẬN timestamp string shape; timezone and update-order semantics unverified                                       |

The provider's service flags are separate from fees. Nexora's independent
shipment_services foundation accepts only canonical normalized boolean facts from
a future authorized adapter. Source null/missing/false semantics must be verified
before claiming a complete snapshot; they are never automatically false. Owner
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
| Unverified measurements, package detail and count alternatives       | `Length`, `Width`, `Height`, `Density`, `Volume`, `WeightByVolume`, `NumberOfPack`, `MissingPackage`, `Packages`                                                                                                                                           |
| Unverified pricing, fee selectors and commissions                    | `FeeFragileGoods`, `GuaranteeType`, `GuaranteeRate`, `CheckFeeType`, `FixPriceAmount`, `FeeWeightCommission`, `FixFeeWeightCommission`, `WarningFeeWeightCommission`, `PriceType`                                                                          |
| Payment, balances and deposits outside Shipment scope                | `TotalPaidAmount`, `TotalRemainAmount`, `PaymentDate`, `DepositCode`                                                                                                                                                                                       |
| Free text, images, warehouse notes and transfer annotations          | `ProductImage`, `OrderNote`, `StoreCNNote`, `StoreVNNote`, `PublicNote`, `TranferNote`                                                                                                                                                                     |
| Internal routing, transport and delivery workflow                    | `TransportName`, `ShippingInfo`, `ShippingMethod`, `Routing`, `IgnoreRouting`, `IsUpdateRouting`, `WarningStatus`, `ReceivePlaceID`, `TranferStoreID`, `TranferStoreName`, `TranferDate`, `Deliverable`                                                    |
| Provider creation, archive/delete and first-order lifecycle          | `CreatedDate`, `SoftDeleted`, `SoftDeleteDate`, `IsFirstOrder`, `FirstOrderDate`, `IsArchived`                                                                                                                                                             |
| List scope only; not a Shipment value                                | `IsEcommerce`                                                                                                                                                                                                                                              |

Density2147483647 is a special sentinel, not a usable density measurement. The
additional FeeFragileGoods field is not silently treated as FragileFee. CreatedDate
never replaces Nexora-created timestamps; paid/remain fields are not current
Shipment amounts. Internal notes/contact data do not enter Shipment normalization.

## Exact numbers and timestamps

Provider numbers are JSON numeric tokens, not decimal strings: examples include
0.0 and3980. A future adapter must preserve the source digits from the JSON text
using Node24 JSON.parse reviver `context.source` for numeric primitive fields,
then validate the resulting decimal text through the existing Domain DecimalValue.
Do not reconstruct digits from the already-parsed Number, multiply/divide/round
with floating-point arithmetic, normalize through toFixed or infer currencies.
Do not rewrite captured fixtures with JSON.parse/stringify: that loses raw0.0
spelling even though the JSON value remains numeric. IDs/counts additionally need
their own validated integer/source-key contracts; density's sentinel is unused.

Observed timestamps are strings without a timezone, for example
`2026-10-18T15:35:48.000`. **GIẢ ĐỊNH: Vietnam local time, UTC+7; CHƯA XÁC MINH.**
A future adapter must apply an explicitly verified zone before conversion to
TIMESTAMPTZ and Domain validation. Never let the execution host's timezone decide
or append Z while pretending the wall time was UTC. Timestamp ordering and rate
effective time remain separate questions; no runtime conversion is implemented.

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

| Unknown                                                                  | Consequence of an unjustified guess                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Status0 meaning                                                          | Wrong stage/counts or loss of exceptional parcels                           |
| OldStatus semantics and claim completion                                 | Regressed physical stage or incorrectly cleared/open claim                  |
| Which field is ĐƠN GIÁ / GIÁ TRỊ (¥)                                     | Misreported price/value; ProductAmount→declared_value remains an assumption |
| Currency/units of each fee, total and rate                               | Wrong amounts or duplicate converted fee rows                               |
| NumberOfPack versus RealNumberOfPack                                     | Incorrect package count                                                     |
| StoreCNExDate versus StoreCNExportDate                                   | Wrong origin-dispatch milestone                                             |
| Timezone of provider timestamps                                          | Shifted milestone/update times and ordering                                 |
| Non-equal filter operators / incremental ordering                        | Missing shipments or invalid watermark advancement                          |
| Cancelled/returned parcels and exceptional status codes                  | False delivery/stage or silent loss                                         |
| ID stability/uniqueness across resync and account scope                  | Duplicate or incorrectly linked shipments                                   |
| Actual maximum charge/item lines per parcel                              | Rejected valid provider records or unsafe capacity assumptions              |
| Service-flag null/false values and product quantity/value correspondence | Invented disabled services or item amounts/quantities                       |

No live gate opens from these documents. A later fixture-backed adapter task must
resolve required semantics; actual live-environment enablement is a separate task
with remaining ADR007 gates, operational custody and explicit activation evidence.
