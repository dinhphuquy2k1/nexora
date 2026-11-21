# Mapping V2 owner-discussion fixture

Source: owner supplied selected values for Uniship341827/MAPPING-V2-REDACTED in the
implementation prompt and conversation on2026-11-20. Milestone dates and matching
StoreCNExDate were separately supplied in the same conversation; all interpreted as UTC under the owner correction2026-11-20.
This newly assembled/redacted fixture is NOT a new live capture, NOT a complete
raw response, and does not replace historical captured bytes or their digests.
Only selected nonpersonal fields and synthetic envelope/summary metadata retained.
NumberOfPack1.0 is intentionally preserved as a source numeric spelling.

TransactionCode is replaced with MAPPING-V2-REDACTED for privacy; source ID and
selected numeric/time facts retain the owner-discussion values.

## Review v2 provenance and supersession

UTC (owner evidence2026-11-20: API03:03:16 ↔ UI10:03:16). Prior UTC+7 confirmation
is superseded; source timestamp strings are unchanged, normalization now keeps UTC.
MD59639 and343558 clock evidence was supplied by owner, not fetched live by this task.
owner-parcel-343558.json contains owner-selected ID343558, four numeric flags1,
ProductNameA, ProductAmount1000, ProductNumber23 and ModifiedDate2026-11-20T03:19:58.
Tracking code, required Status4 and envelope/summary are synthetic/redacted test
scaffolding, not an assertion of the parcel's actual status or complete response.
derived-delivered-counting-zero.json models the owner-reported delivered/CheckFeeVND0.0
case with synthetic ID900060/tracking/envelope; no raw capture is claimed.
owner-discussion-sample.json adds null placeholders for unknown product/flag/counting
facts only; they are not claimed observed341827 values. Do not alter historical
captured fixtures/digests. Numeric variants/invalid cases in tests are derived.
