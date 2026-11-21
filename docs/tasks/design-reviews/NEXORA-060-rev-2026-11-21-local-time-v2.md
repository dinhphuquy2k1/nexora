# NEXORA-060 — retained Vietnam local time, owner v2 decision

Task ID: NEXORA-060
Classification: SIGNIFICANT
Plan revision: rev-2026-11-21-local-time-v2
Reviewed baseline: 52988c26ab9373f411c5049838a2e326e7042d48
Branch: feature/uniship-mapping-extension

## 1. Authority and supersession

Latest owner request retains timezone-less Uniship timestamps as Vietnam local time
(UTC+7); restore original parseUnishipLocalTimestamp without changing its calendar,
format, millisecond, fixed-offset or early-year checks. The immediately previous
request implemented UTC at8b24f69/52988c2; that interpretation is now superseded as
policy. Do not rewrite its frozen snapshot or executed CI evidence. Owner requests
snapshot v2: this separately named local-time-v2 artifact binds that new decision
without overwriting either existing frozen artifact.

## 2. Read-only inventory

Inspected current branch/remote52988c2, AI rules/workflows, task060/058, original
parser at074298d, current UTC parser/calls, mapping-v2/review-v2 units, real Sync
integration helper and Retail formatDate/model tests. Existing mapper already
implements all four numeric flags, ProductAmount/CNY, ProductNumber, single item,
COUNTING VND and both independent parcel counts. Keep those changes. Web formatter
already specifies Asia/Ho_Chi_Minh; add time-of-day/host-TZ regression without
changing rendering. No other writer/schema/API/SDK/registry change is needed.

## 3. Reuse audit

| Field                    | Decision                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Uniship wall-clock interpretation and controlled-activation verification                                                                                                                                                |
| Existing implementations | Infrastructure original parseUnishipLocalTimestamp at074298d; exact sourceCount/DecimalValue/complete services-items/scoped fees already implemented; Web formatDate and existing test loader; task058 activation gates |
| Owner                    | Uniship infrastructure owns source timezone policy; Shipment keeps UTC instants; Web owns Vietnam-time rendering;058 owns live validation/activation                                                                    |
| Alternatives             | Restore original helper vs new timezone framework: restore; reuse Web formatter vs new formatter: reuse                                                                                                                 |
| Selected approach        | Restore original helper verbatim and rename its callers back; adjust expectations and current docs; require three-parcel live comparison before schedules                                                               |
| Rationale                | Follow latest owner policy while preserving conflicting evidence and avoiding an invented semantic conclusion                                                                                                           |
| Risks                    | Policy may be wrong by7hours; no unit/CI can resolve actual provider semantics; previous normalized data cannot be corrected merely by replaying staging                                                                |
| Verification             | Test-first offset/formatting, related unit/owned PostgreSQL, required static checks, independent review and exact-head Preflight/Sync/Foundation                                                                        |

## 4. Domain and contracts

No new Domain vocabulary, field or public transport contract. Counts remain
NumberOfPack→package_count and RealNumberOfPack→actual_package_count; the Uniship
SỐ KIỆN(CHÍNH) source remains unknown. Retain all35 mapping correspondences and
existing services/items/fee/null semantics. No provider rule moves into Domain.

## 5. Time interpretation

Owner decision 2026-11-20: Vietnam local time (UTC+7). Conflicting observation kept
for review: order MD59639 API CreatedDate 2026-11-20T03:03:16 while the Uniship UI
showed 20-11-2026 10:03:16.

Restore exact original helper body; source03:03:16 becomes previous-day20:03:16Z.
Keep strict calendar/format/millisecond validation; no retry, timeout or assertion
relaxation. Existing Web Asia/Ho_Chi_Minh renders that stored instant as03:03 local;
a genuine UTC03:03 instant renders10:03 local. These are formatting/policy tests,
not proof that the conflicting provider observation is resolved.

## 6. Mandatory058 gate

After the first real controlled manual sync, before enabling automatic scheduling,
owner selects three parcels with warehouse import/export milestones and compares
Nexora displayed times with Uniship UI. Record redacted values/results. If Nexora
is offset7hours, stop/keep schedules disabled, create a correction task changing
source interpretation to UTC, then sync fresh provider observations again so
provider-owned timestamps are overwritten under existing locks/fences. Never fix
this by retry, timeout, direct DB edit or invented stage-history timestamps. No
live request or scheduling activation is authorized by this task.

## 7. Fixtures and tests

Keep source timestamp bytes, selected343558 facts, delivered COUNTING0.0 fixture
and numeric flag/product tests. Update policy-dependent ISO expectations only.
Add Web formatDate withTime/rollover regression under UTC/NewYork/Tokyo host zones;
retain existing calendar/precision rejection assertions. Real PostgreSQL verifies
UTC+7→UTC stored instants alongside unchanged services/items/CNY/counting behavior,
stable child IDs/xmin and null omission. Captured historical fixtures/digests stay.

## 8. Persistence/security

No schema/migration/grant/API/SDK/fencing/source-key/FULL changes. No automatic
historical repair, raw source retention or production enablement. PostgreSQL is
only a signed task-owned disposable container; never reset user volumes. No PII,
credentials, IP/MAC or long raw CI logs in Git evidence.

## 9. Documentation impact

REQUIRED: current Uniship time section/mapping policy, Shipment/ADR011 current time
policy, fixture README, task060/report and058 activation checklist. Historical UTC
snapshot/evidence remain immutable and explicitly superseded as current policy.
Conflicting observation remains visible; no external verification claim is added.

## 10. Verification and A/B

Related units and PostgreSQL; format:check, lint, typecheck, contracts:check,
docs:check, preflight:check, test:docs, test:preflight. Fix task-owned code/tests/
fixtures/format/environment with evidence. Stop for unrelated existing test failure,
Preflight CI failure or out-of-scope Foundation/fixture-order/browser namespace/
retry/timeout/assertion changes. No action rerun to obtain green.

## 11. Review and delivery

Independent code/docs review with P1/P2/P3, snapshot formatted before SHA and five
PR metadata fields updated through gh api. Push; await exact-head Preflight, Sync
Targeted and Foundation; add Final green HEAD only after PASS. Keep task active
until owner review/merge; no merge or live activation.

## 12. Readiness limits

Technical green validates the selected policy implementation, not the actual source
timezone. Mandatory058 three-parcel comparison is NOT RUN here and remains a live
activation blocker before automatic schedules. The uncertainty is preserved rather
than declared resolved by synthetic fixtures.
