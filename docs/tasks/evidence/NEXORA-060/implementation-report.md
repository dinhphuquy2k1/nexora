# NEXORA-060 — Mapping V2 implementation and acceptance

Date: 2026-11-20 (Asia/Ho_Chi_Minh). Baseline ef0cf4e. Evidence applies to this
branch implementation; exact final HEAD and hosted workflow results are recorded
separately in the PR. No merge, production enablement or live Uniship request.

## A. Field Storage Decision Matrix

35 selected correspondences; this denominator includes existing source/status/lookup
facts as well as newly enriched fields. Alias validation and exclusions are separate,
not extra accepted mappings. Test names refer to the new two unit files and genuine
Shipment/Uniship PostgreSQL integration suites, not live provider captures.

| Uniship Field      | Canonical Meaning                       | Chosen Storage      | Validation                                                                      | API Exposure                                             | Tests                                  | Rationale                                                       |
| ------------------ | --------------------------------------- | ------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| ID                 | Scoped source identity                  | EXISTING CORE       | Exact positive integer lexeme; scoped uniship-parcel-v1 identity                | uniship-parcel-v1 unchanged                              | mapping-v2 / partial-mapping / real PG | Current read need; Source key per provider/account              |
| TransactionCode    | Tracking text                           | EXISTING CORE       | Required nonempty Domain-bounded text; no silent trimming                       | trackingCode                                             | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| Status             | Original status and physical stage      | EXISTING CORE       | Exact numeric status; known stage mapping, safe UNKNOWN warning                 | providerStatus/logisticsStage                            | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| OldStatus          | Claim context                           | EXISTING CORE       | Optional numeric claim context; known1–5, else locked prior stage/UNKNOWN       | Same status/claim behavior                               | mapping-v2 / partial-mapping / real PG | Current read need; Provider mapping only                        |
| Weight             | Reported kg                             | EXISTING CORE       | DecimalValue(10,3), nonnegative, raw numeric lexeme                             | weightKg                                                 | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| NumberOfPack       | Package count                           | EXISTING CORE       | Exact integer0..2147483647, no rounding                                         | packageCount                                             | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| RealNumberOfPack   | Actual package count                    | NEW CORE            | Exact integer0..2147483647, no rounding                                         | actualPackageCount summary/detail                        | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| PriceAmount        | Source freight unit price/currency/unit | PROVIDER ATTRIBUTES | DecimalValue(18,2), nonnegative; VND/kg; zero retained                          | typed freightUnitPrice summary/detail                    | mapping-v2 / partial-mapping / real PG | Current read need; Current reported source pricing basis        |
| FeeWeightAmount    | Weight freight charge                   | CHILD TABLE         | DecimalValue(18,2), nonnegative; VND; zero retained                             | WEIGHT_FREIGHT VND                                       | mapping-v2 / partial-mapping / real PG | Current read need; Shared charge vocabulary                     |
| TotalAmount        | Reported total                          | EXISTING CORE       | DecimalValue(18,2), nonnegative; VND; zero retained                             | totalAmount/totalCurrency VND                            | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| TotalPaidAmount    | Provider-reported paid amount           | NEW CORE            | DecimalValue(18,2), nonnegative; VND; zero retained                             | providerPaidAmount                                       | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| TotalRemainAmount  | Provider-reported remaining amount      | NEW CORE            | DecimalValue(18,2), nonnegative; VND; zero retained                             | providerRemainingAmount                                  | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| PaymentDate        | Provider payment timestamp              | NEW CORE            | Calendar-valid Vietnam local(UTC+7) → UTC;058 live gate pending, null preserves | providerPaidAt                                           | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| ExchangeRate       | Reported rate                           | EXISTING CORE       | DecimalValue(18,6), nonnegative; no conversion/effective time                   | exchangeRate; exchangeRateAt null without effective time | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| CreatedDate        | Source-created reference time           | PROVIDER ATTRIBUTES | Calendar-valid Vietnam local(UTC+7) → UTC;058 live gate pending, null preserves | typed providerCreatedAt detail                           | mapping-v2 / partial-mapping / real PG | Current read need; Reference fact, not Nexora createdAt         |
| ModifiedDate       | Provider update time                    | EXISTING CORE       | Calendar-valid Vietnam local(UTC+7) → UTC;058 live gate pending, null preserves | providerUpdatedAt, never stage time/watermark            | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| ChinaStoreID       | Source warehouse identifier             | PROVIDER ATTRIBUTES | Exact provider ID as bounded string, trusted namespace; no Nexora FK            | typed originWarehouseProviderId detail                   | mapping-v2 / partial-mapping / real PG | Current read need; Opaque provider key, not global warehouse FK |
| chinaStores.Name   | Origin name                             | EXISTING CORE       | Matching ID/StoreType1, valid nonempty name; missing lookup warns               | originWarehouse                                          | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| ReceivePlaceName   | Destination warehouse name              | NEW CORE            | Nullable text <=256; omission preserves                                         | destinationWarehouse                                     | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| ShippingMethod     | Source-reported delivery method text    | PROVIDER ATTRIBUTES | Nullable text <=128 in closed attributes schema                                 | typed lastMileMethod detail                              | mapping-v2 / partial-mapping / real PG | Current read need; Not a verified cross-carrier method taxonomy |
| GuaranteeAmountVND | Insurance fee                           | CHILD TABLE         | DecimalValue(18,2), nonnegative; VND; zero retained                             | INSURANCE VND,0 retained                                 | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| FragileFeeVND      | Wood packing fee                        | CHILD TABLE         | DecimalValue(18,2), nonnegative; VND; zero retained                             | WOOD_PACKING VND,0 retained                              | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| FoamFeeVND         | Bubble wrap fee                         | CHILD TABLE         | DecimalValue(18,2), nonnegative; VND; zero retained                             | BUBBLE_WRAP VND,0 retained                               | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreCNImportDate  | Origin receipt                          | CHILD TABLE         | Calendar-valid Vietnam local(UTC+7) → UTC;058 live gate pending, null preserves | ORIGIN_RECEIVED                                          | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreCNExportDate  | Origin dispatch                         | CHILD TABLE         | Calendar-valid Vietnam local(UTC+7) → UTC;058 live gate pending, null preserves | ORIGIN_DISPATCHED                                        | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreVNImportDate  | Destination receipt                     | CHILD TABLE         | Calendar-valid Vietnam local(UTC+7) → UTC;058 live gate pending, null preserves | DEST_RECEIVED, supplied destination location             | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreVNExportDate  | Destination dispatch                    | CHILD TABLE         | Calendar-valid Vietnam local(UTC+7) → UTC;058 live gate pending, null preserves | DEST_DISPATCHED, not delivered time                      | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| IsGuarantee        | Insurance service                       | CHILD TABLE         | Numeric1/0 only; null omitted                                                   | serviceSummary.insurance                                 | review-v2 unit / real PG               | Owner confirmed2026-11-20; existing contract reused             |
| IsCheck            | Counting service                        | CHILD TABLE         | Numeric1/0 only; null omitted                                                   | serviceSummary.counting                                  | review-v2 unit / real PG               | Owner confirmed2026-11-20; existing contract reused             |
| IsFragileGoods     | Wood packing service                    | CHILD TABLE         | Numeric1/0 only; null omitted                                                   | serviceSummary.fragileGoods                              | review-v2 unit / real PG               | Owner confirmed2026-11-20; existing contract reused             |
| IsFoam             | Bubble wrap service                     | CHILD TABLE         | Numeric1/0 only; null omitted                                                   | serviceSummary.foam                                      | review-v2 unit / real PG               | Owner confirmed2026-11-20; existing contract reused             |
| ProductAmount      | Declared CNY value                      | EXISTING CORE       | Exact nonnegative Decimal18,2; null omission                                    | declaredValue/declaredCurrency                           | review-v2 unit / real PG               | Owner confirmed2026-11-20; existing contract reused             |
| ProductNumber      | Aggregate item count                    | EXISTING CORE       | Exact integral0..2147483647; no inferred line quantity                          | itemCount                                                | review-v2 unit / real PG               | Owner confirmed2026-11-20; existing contract reused             |
| ProductName        | Single product name                     | CHILD TABLE         | Nonblank string <=512; null/blank omits snapshot                                | items/itemSummary                                        | review-v2 unit / real PG               | Owner confirmed2026-11-20; existing contract reused             |
| CheckFeeVND        | Counting fee                            | CHILD TABLE         | Exact nonnegative Decimal18,2; zero retained                                    | COUNTING VND charge                                      | review-v2 unit / real PG               | Owner confirmed2026-11-20; existing contract reused             |

## B. Architecture decision

Canonical + Hybrid implements five shared nullable root fields, four selected typed
reference attributes and existing repeating children. ADR-011 has an explicit dated
exception for current reconciliation/read needs without a new filter. Four reference
facts do not justify speculative columns/provider tables. Closed version1 JSONB
is compact <=1024 UTF-8 bytes with known depth/keys and trusted provider namespace;
merged state and hydration are validated. SQL baseline shape cap2048 includes JSONB
rendering overhead. No raw response, EAV, generic framework or new index. Another
provider maps into the same neutral contracts; new schema fields require review.

## C. Implementation diff

- Domain/parser: bounded canonical fields, strict attributes patch and scoped charge/
  milestone commands; generic processor maps ambiguous charge conflict to review.
- Uniship infrastructure: exact numeric lexemes, retained Vietnam local(UTC+7) policy, selected fields,
  consistency-only dispatch alias; default processor2, same source identity.
- SQL/Prisma/grants/persistence/read adapter: additive migration and typed projections.
- DTO/OpenAPI/SDK: additive nullable fields, internal JSON envelope never exposed.
- Retail: neutral freight price key, actual currency/unit, separate actual count,
  destination fallback and reported financial/reference detail. Historical reference
  fixture unchanged.
- Tests/docs: new owner-discussion fixture, Domain/normalizer/real Sync/API/SQL coverage,
  current-contract fixture/oracle updates and canonical documentation.

## D. Database migration

20261120000000_shipment_mapping_attributes adds actual_package_count INTEGER,
provider_paid_amount/provider_remaining_amount NUMERIC(18,2), provider_paid_at
TIMESTAMPTZ(3), destination_warehouse VARCHAR(256), provider_attributes JSONB.
All nullable; legacy data preserved with NULL new columns. No backfill or historical
migration rewrite. Finite/nonnegative checks and WEIGHT_FREIGHT closed-code update.
Only six new provider-owned worker INSERT/UPDATE grants; API SELECT-only and original
Nexora-owned deny assertions retained. Real migrated PostgreSQL role/constraint tests
PASS; forward preservation/repeat/drift PASS. No user volume reset.

## E. Safe synchronization

Partial charges match one existing code, retain ID/line/label and conditional xmin,
append missing lines only within50, reject ambiguity atomically as SOURCE_CONFLICT.
Milestones merge by code; omitted/null facts and other milestones survive. Complete
snapshot semantics remain unchanged, and complete+patch on the same collection is
invalid. Existing locked binding/final fences and one transaction persist the merged
state. Real Sync tests prove unrelated charge/ID/Nexora note/assignee preservation,
idempotent child xmin, SQL-triggered rollback, duplicate review and foreign-owner404.
Source scheme uniship-parcel-v1 and FULL semantics are unchanged. Version2 can process
old minimal version1 staging but cannot backfill never-staged fields. Enrichment needs
a new observation, not a processor-version claim.

## F. Executed regression evidence

Local PostgreSQL17.11 ran in a task-owned Docker container with tmpfs data and signed
disposable-cluster identity; host Node24 tooling connected only to that cluster.
This is genuine PostgreSQL integration, distinct from the complete Compose quality job.
Logs are summarized here rather than uploading credentials, connection URLs or raw logs.

| Command / execution                                                                                   | Result     | Evidence                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial two new unit files, pre-implementation                                                        | FAIL (RED) | 7 missing behaviors; subsequent byte-size test corrected because emoji fixture was below1024 bytes                                                                                                                   |
| node --test apps/api/test/shipment/partial-mapping.test.cjs apps/api/test/uniship/mapping-v2.test.cjs | PASS       | 10/10 after independent-review fixes and legacy51 coverage; count exponent, date leap/year/TZ, privacy and merge                                                                                                     |
| node --test apps/web/test/retail-\*.test.mjs                                                          | PASS       | 142/142, including typedVND/kg, zero, legacyCNY, actual count/destination                                                                                                                                            |
| packages/database/test/shipment-sql.mjs on owned PG                                                   | PASS       | New worker six-column allow / API-deny, numeric/JSON constraints, WEIGHT_FREIGHT; old deny assertions kept                                                                                                           |
| packages/database/test/migration.mjs on owned PG                                                      | PASS       | Legacy preservation, NULL new fields, repeat and schema drift                                                                                                                                                        |
| integration/shipment-integration.test.cjs on owned PG                                                 | PASS       | 22/22, new genuine mapping Sync/API subtest and existing capacity/fence/rollback/read tests                                                                                                                          |
| integration/uniship-shipment-integration.test.cjs on owned PG                                         | PASS       | 12/12, existing hash/claim/complete-child semantics                                                                                                                                                                  |
| integration/sync-integration.test.cjs on owned PG                                                     | PASS       | 61/61, existing execution/identity/version/lease/fence/concurrency regressions                                                                                                                                       |
| packages/database/test/shipment-worker.mjs                                                            | PASS       | Canonical wrapper rebuild and real integration; pinned pnpm PATH supplied after host fallback version mismatch                                                                                                       |
| `node --test "integration/**/*.test.cjs"` on owned PG                                                 | PASS       | 179/179 after preparing migrated base DB, STORAGE_ROOT and expected legacy role; first invocation FAIL104/112 due missing Compose prerequisites, no product code change                                              |
| contracts:generate                                                                                    | PASS       | DTO→OpenAPI→SDK generated; contract check in quality                                                                                                                                                                 |
| pnpm typecheck with canonical API_INTERNAL_URL/NODE_ENV                                               | PASS       | 10 tasks; initial missing API_INTERNAL_URL failed then environment supplied                                                                                                                                          |
| pnpm quality                                                                                          | PASS       | Committed38cce9b: scripts182, API264, Web366, UI37, database6 tests; typecheck/contracts/build PASS. Earlier lint/privacy errors corrected; initial contracts:check rejected uncommitted generated files as intended |
| test:docs / test:preflight / test:lint                                                                | PASS       | 10/10,24/24,56/56 respectively                                                                                                                                                                                       |
| Retail fixture build                                                                                  | PASS       | Actual TSX/CSS bundle                                                                                                                                                                                                |
| Retail Chromium checks                                                                                | PASS       | Real compiled TSX/CSS isolated fixture including all six viewports and native detail/create dialog; temporary runner now includes canonical Page.bringToFront. Earlier unfocused failures remain recorded below      |
| sh scripts/quality-docker.sh                                                                          | NOT RUN    | Full Compose services/tooling unavailable in this host-only workspace;636MB free after builds, no safe isolated full-stack override. No shared stack/volume mutation to obtain a green result                        |
| Hosted code HEAD73d984b                                                                               | PASS       | Preflight44699768005, Sync Targeted44699767860, Foundation44699767849/job136165016539, all attempt1. Exact evidence-only final HEAD recorded in PR description after its checks                                      |

Test harness corrections are recorded, not erased: private runtime secret initially
48hex failed policy (regenerated64hex); first integration invocation used wrong cwd;
historical migration Prisma create needed select:id before new columns existed;
old charge oracle fixed hardcoded8/9 positions for the added catalog code; old
Uniship omission fixture stopped mutating now-confirmed dates. Existing assertions
were retained. The first full integration invocation lacked migrated base DB and
legacy nexora role; those canonical Compose prerequisites were added only to the
signed task-owned cluster before179/179 PASS. First local Chromium teardown masked its original failure; temporary
runner now uses repository teardown utilities. Baseline browser comparison reproduces
the same pre-existing focus/background failure; it is not counted as a pass. No CI/assertion/timeout bypass.

## G. Security/privacy and independent review

No ShippingInfo, FakeCustomer\*, account/contact/staff/raw JSON or service-flag inference
is staged/stored/exposed. New discussion fixture uses synthetic tracking code
MAPPING-V2-REDACTED; exact selected source facts remain, historical captures/digests
unchanged. No credentials logged. Root trusted namespace matches attributes; unknown
keys/version/depth/oversize fail closed. API exposes only typed values. Production
registry/transport, identity and worker Nexora-owned privilege restrictions unchanged.

Independent reviewer inspected working tree vs ef0cf4e and independently ran27/27 tests across four files on38cce9b.
See [independent RED/GREEN record](review-and-red-green.md). Three P2 closed: leading-zero scientific-count overflow check, required leap/TZ
coverage, canonical mapping confidence wording. No open P1/P2/P3 in reviewed scope.
Reviewer verified frozen snapshot SHA and unchanged captured/reference fixtures.
This is independent code review, not approval of future exact-final-HEAD CI.

## H. Báo cáo PM (bảy câu hỏi)

1. **Đủ yêu cầu chưa?**35 mapping correspondences giữ nguyên, helper local-time
   được khôi phục đúng bản gốc. Related72/72, Retail143/143, PostgreSQL22/22 và12/12,
   các lệnh local và hosted b6bb4c0 PASS. Đây là kiểm chứng triển khai UTC+7, không
   chứng minh múi giờ thực;058 vẫn phải so3kiện trước lịch tự động.
2. **Blocker?** Không còn finding kỹ thuật mở sau review/CI. Release chờ exact-HEAD
   commit evidence cuối; production/automatic schedules vẫn bị chặn bởi gate058.
3. **Mất dữ liệu/sai tiền?** Không cộng trùng phí hay suy tổng. Decimal chính xác,
   null giữ dữ liệu,0 ghi0, nhiều phí cùng mã chuyển review; test chứng minh giữ ID,
   child xmin và rollback. Dữ liệu lịch sử chưa staged không tự được phục hồi.
4. **Giải pháp hợp lý?** Thêm tất cả cột gây phình core; bảng riêng mỗi hãng tạo thêm
   mô hình trùng; raw payload mở rộng privacy và không có contract. Hybrid giữ5facts
   chung ở core, dữ liệu lặp ở children,4facts tham chiếu trong typedJSON giới hạn.
   Đổi lại cần validation/versioning và amendment ADR-011 rõ ràng.
5. **Ảnh hưởng cũ?** Migration additive nullable, source identity/FULL/fences giữ nguyên;
   API/SDK additive và Web strict guard cần deploy cùng revision. Sáu grant provider-owned
   mới không mở quyền ghi API/Nexora fields. Batch read giữ nguyên, không N+1; không
   tuyên bố cải thiện hiệu năng khi chưa benchmark riêng.
6. **Tiếp theo?** Agent chốt CI của commit evidence cuối và giữ lịch sử kiểm thử đã ghi; owner review PR, không auto-merge.
   Owner/nhóm NEXORA-058 xác minh provider/live/operational prerequisites; chỉ sau đó
   mới cân nhắc activation. Không backfill hàng loạt trong task này.
7. **Khi nào production?** Chưa có ngày có căn cứ. Mapping hoàn thiện mã không đồng
   nghĩa đủ production;058 còn authorization/custody/live contract/claim/identity/
   pagination/operational gates và owner-controlled enablement.

## I. Remaining scope

FeeShip/FeeShipVN/FeeOther, unsuffixed fee aliases, per-item quantity/value, raw
private fields and other unselected fields remain omitted. Four numeric flags,
ProductAmount/CNY, ProductNumber, ProductName and CheckFeeVND are now confirmed.
ExDate is guard only. Exchange-rate effective time is absent; no conversion.
No incremental watermark, inferred service enablement, claim lifecycle proof,
provider ID stability or live activation/backfill is claimed. NEXORA-058 remains active.

## Current PR review follow-up — verification pending

The historical review and green implementation-head evidence below remain valid
for the cited SHAs, but **are not an exact-final-HEAD approval** after the later
warehouse-consistency and UI-copy fixes. HEAD
`e1e4357547d54b5dae7e65356955ce6dc39d7f54` had Preflight and Sync
targeted PASS, while Foundation run `44707220283` failed at
`pnpm format:check` (unformatted assertion in the new Uniship test); its later
runtime/browser checks were NOT RUN. The subsequent formatting correction and this
evidence clarification require fresh exact-HEAD CI. **Current readiness:
VERIFICATION INCOMPLETE / NOT READY TO MERGE** until that CI passes.
NEXORA-058 production activation is still out of scope.

## J. Merge readiness

READY FOR OWNER REVIEW — technical retained-local-time policy and mapping code
b6bb4c0 passed local/hosted checks. Final evidence-only HEAD is checked separately
and recorded in PR59. The conflicting observation is unresolved; live058 gate
is NOT RUN and blocks automatic schedules. No merge or activation.

## Hosted first-head delta — 38cce9b

Preflight44698351386 PASS and Sync Targeted44698351380 PASS, attempt1.
Foundation44698351390/job136160428827 attempt1: Docker quality/migrated integration
and shared Pager/filter browser acceptance PASS; runtime step7 FAIL before browser
with `Migrated schema assertion failed`. The migration deploy log states
`17 migrations found in prisma/migrations` and `No pending migrations to apply.`
scripts/runtime-smoke.sh:30 still expected16; this task adds migration17. The oracle
now expects17 while retaining stored_files=0 and all migration/runtime assertions.
This is a task-caused migration-catalog fixture correction, not an unrelated flaky
failure, relaxed assertion, retry or workflow change. Step8 and later were NOT RUN.
Missing browser artifacts are downstream because the runtime stopped before browser.
No failed action run was rerun. A subsequent commit triggers fresh exact-HEAD CI.
Source38cce9b, base5e96199d8e83b058d6871942ca8becb2fbb30ac2; PR merge checkout reported
by GitHub API830868bc335a457d373975d104bba5264fc85fc0. No raw logs/IPs/credentials copied.

## Local browser focus prerequisite delta

The temporary isolated Chromium runner originally omitted Page.bringToFront, which
the canonical scripts/browser-login-smoke.mjs:284 calls. With that same prerequisite
added only to the temporary runner, verifyRetailBrowser completed PASS, including
RETAIL_DETAIL_AND_CREATE_NATIVE_DIALOG and RETAIL_API_ERROR_EMPTY_AND_ABORT.
Same bundle/assertions/timeout/CSS; no product/harness source change. Earlier current
and baseline failures remain historical observations, not proof of a product defect.
The original temporary cleanup ENOTEMPTY was also corrected by reusing canonical
browser teardown. Final local runner exited0 and removed its own profile.

## Hosted GREEN code-head evidence — 73d984b

Source73d984b4e6fdd3694369de2cc5dcd3a9335b3aad;
base5e96199d8e83b058d6871942ca8becb2fbb30ac2;
GitHub PR merge checkout58439f3d8c77979a7a5331c073e5a1e8ae10423e.
All attempt1: Preflight44699768005 PASS; Sync Targeted44699767860 PASS;
Foundation44699767849/job136165016539 PASS. Docker quality/migrated integration,
shared Pager/filter browser acceptance, runtime/provisioning/TTY/browser, public
HTTPS/onboarding, DB/storage persistence and HMR/dependency drift all PASS.
Retail browser artifact14613836264, name retail-m3-browser-evidence,10739754 bytes.
Earlier source38cce9b Foundation FAIL remains above; no action rerun or exemption.
Local full Compose command remains NOT RUN locally; hosted Foundation executes it
and passes. Final documentation-only HEAD/run IDs are recorded by gh api in PR59
description after its exact-HEAD gates complete, avoiding a self-referential commit
SHA claim. No merge, issue closure or Uniship production enablement.

## Review v2 supersession (owner2026-11-20, remediation2026-11-21)

Earlier timestamp acceptance used an owner interpretation now superseded: source
timestamp strings mean UTC, not the prior UTC+7 interpretation. Earlier PASS rows
remain executed historical evidence, not proof of v2 timestamp/business semantics.
Current v2 mapping adds the four numeric flags, CNY declared value, aggregate product
count, complete single item and COUNTING VND fee. New results are in the dedicated
review-v2 evidence; no production activation/backfill, schema or public contract change.

## Final v2 verification addendum

See [review-v2](review-v2.md): source8b24f69482b6275b298f091d0db6b913a251b7b7,
actual merge checkout413b2a8f9b77c472ac533865c5441845bb244185, all attempt1:
Preflight44908003499 PASS; Sync44908003491 PASS;
Foundation44908003476/job136857611753 PASS, steps4–10.
Earlier current-review-pending paragraphs are retained as chronological records;
this executed v2 addendum supersedes them. Exact evidence-only final HEAD is in PR59.

## Latest decision supersession — retained UTC+7

The latest request retains the original parseUnishipLocalTimestamp and UTC+7→UTC
policy. Earlier UTC-only code/CI rows in this report are historical executions,
not current policy or evidence resolving MD59639's conflicting API/UI observation.
All35 fields remain; mandatory058 first-real-sync comparison of3parcels is NOT RUN
here and blocks automatic scheduling. See review-local-time-v2 evidence for current
implementation/tests and exact-HEAD CI; no live activation/backfill is performed.

## Retained-policy hosted addendum

[Current local-time-v2 evidence](review-local-time-v2.md): source
b6bb4c02d63365f27d62f30aadc7427542835efc, actual checkout
4cf06cc818ca15b8de383a0483be2e587a1cd05c; all attempt1:
Preflight44918310509 PASS; Sync44918310211 PASS;
Foundation44918310218/job136888597383 PASS, steps4–10.
This supersedes the earlier UTC-only policy/readiness as current behavior while
retaining its historical outcomes. Exact final evidence-only HEAD is in PR59.
The actual058 three-parcel gate remains NOT RUN, not satisfied by these fixtures/CI.

## Latest development refactor —2026-11-22

[Shared numeric v3 evidence](shared-numeric-v3.md) supersedes the earlier default
processor2 statement: default development processor is1, Mapping V2 is a mapping name.
Shared numeric algorithms and canonical Shipment kilogram vocabulary now have real
API/Web consumers with baseline parity; current source identity, UTC+7 and wire contracts
remain unchanged. Same-version new observations, not fabricated historical reprocessing,
prove enrichment. Earlier version2 execution rows remain chronological evidence.
