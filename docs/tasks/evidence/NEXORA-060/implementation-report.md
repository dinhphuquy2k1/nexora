# NEXORA-060 — Mapping V2 implementation and acceptance

Date: 2026-11-20 (Asia/Ho_Chi_Minh). Baseline ef0cf4e. Evidence applies to this
branch implementation; exact final HEAD and hosted workflow results are recorded
separately in the PR. No merge, production enablement or live Uniship request.

## A. Field Storage Decision Matrix

27 selected correspondences; this denominator includes existing source/status/lookup
facts as well as newly enriched fields. Alias validation and exclusions are separate,
not extra accepted mappings. Test names refer to the new two unit files and genuine
Shipment/Uniship PostgreSQL integration suites, not live provider captures.

| Uniship Field      | Canonical Meaning                       | Chosen Storage      | Validation                                 | API Exposure                                             | Tests                                  | Rationale                                                       |
| ------------------ | --------------------------------------- | ------------------- | ------------------------------------------ | -------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| ID                 | Scoped source identity                  | EXISTING CORE       | Strict text/source identity                | uniship-parcel-v1 unchanged                              | mapping-v2 / partial-mapping / real PG | Current read need; Source key per provider/account              |
| TransactionCode    | Tracking text                           | EXISTING CORE       | Strict text/source identity                | trackingCode                                             | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| Status             | Original status and physical stage      | EXISTING CORE       | Strict text/source identity                | providerStatus/logisticsStage                            | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| OldStatus          | Claim context                           | EXISTING CORE       | Strict text/source identity                | Same status/claim behavior                               | mapping-v2 / partial-mapping / real PG | Current read need; Provider mapping only                        |
| Weight             | Reported kg                             | EXISTING CORE       | Exact decimal/zero/null                    | weightKg                                                 | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| NumberOfPack       | Package count                           | EXISTING CORE       | Exact integer0..2147483647, no rounding    | packageCount                                             | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| RealNumberOfPack   | Actual package count                    | NEW CORE            | Exact integer0..2147483647, no rounding    | actualPackageCount summary/detail                        | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| PriceAmount        | Source freight unit price/currency/unit | PROVIDER ATTRIBUTES | Exact decimal/zero/null                    | typed freightUnitPrice summary/detail                    | mapping-v2 / partial-mapping / real PG | Current read need; Current reported source pricing basis        |
| FeeWeightAmount    | Weight freight charge                   | CHILD TABLE         | Exact decimal/zero/null                    | WEIGHT_FREIGHT VND                                       | mapping-v2 / partial-mapping / real PG | Current read need; Shared charge vocabulary                     |
| TotalAmount        | Reported total                          | EXISTING CORE       | Exact decimal/zero/null                    | totalAmount/totalCurrency VND                            | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| TotalPaidAmount    | Provider-reported paid amount           | NEW CORE            | Exact decimal/zero/null                    | providerPaidAmount                                       | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| TotalRemainAmount  | Provider-reported remaining amount      | NEW CORE            | Exact decimal/zero/null                    | providerRemainingAmount                                  | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| PaymentDate        | Provider payment timestamp              | NEW CORE            | Calendar-valid UTC+7 → UTC, null preserves | providerPaidAt                                           | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| ExchangeRate       | Reported rate                           | EXISTING CORE       | Exact decimal/zero/null                    | exchangeRate; exchangeRateAt null without effective time | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| CreatedDate        | Source-created reference time           | PROVIDER ATTRIBUTES | Calendar-valid UTC+7 → UTC, null preserves | typed providerCreatedAt detail                           | mapping-v2 / partial-mapping / real PG | Current read need; Reference fact, not Nexora createdAt         |
| ModifiedDate       | Provider update time                    | EXISTING CORE       | Calendar-valid UTC+7 → UTC, null preserves | providerUpdatedAt, never stage time/watermark            | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| ChinaStoreID       | Source warehouse identifier             | PROVIDER ATTRIBUTES | Strict text/source identity                | typed originWarehouseProviderId detail                   | mapping-v2 / partial-mapping / real PG | Current read need; Opaque provider key, not global warehouse FK |
| chinaStores.Name   | Origin name                             | EXISTING CORE       | Strict text/source identity                | originWarehouse                                          | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| ReceivePlaceName   | Destination warehouse name              | NEW CORE            | Strict text/source identity                | destinationWarehouse                                     | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| ShippingMethod     | Source-reported delivery method text    | PROVIDER ATTRIBUTES | Strict text/source identity                | typed lastMileMethod detail                              | mapping-v2 / partial-mapping / real PG | Current read need; Not a verified cross-carrier method taxonomy |
| GuaranteeAmountVND | Insurance fee                           | CHILD TABLE         | Exact decimal/zero/null                    | INSURANCE VND,0 retained                                 | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| FragileFeeVND      | Wood packing fee                        | CHILD TABLE         | Exact decimal/zero/null                    | WOOD_PACKING VND,0 retained                              | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| FoamFeeVND         | Bubble wrap fee                         | CHILD TABLE         | Exact decimal/zero/null                    | BUBBLE_WRAP VND,0 retained                               | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreCNImportDate  | Origin receipt                          | CHILD TABLE         | Calendar-valid UTC+7 → UTC, null preserves | ORIGIN_RECEIVED                                          | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreCNExportDate  | Origin dispatch                         | CHILD TABLE         | Calendar-valid UTC+7 → UTC, null preserves | ORIGIN_DISPATCHED                                        | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreVNImportDate  | Destination receipt                     | CHILD TABLE         | Calendar-valid UTC+7 → UTC, null preserves | DEST_RECEIVED, supplied destination location             | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreVNExportDate  | Destination dispatch                    | CHILD TABLE         | Calendar-valid UTC+7 → UTC, null preserves | DEST_DISPATCHED, not delivered time                      | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |

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
- Uniship infrastructure: exact numeric lexemes, strict UTC+7, selected fields,
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

| Command / execution                                                                                   | Result     | Evidence                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial two new unit files, pre-implementation                                                        | FAIL (RED) | 7 missing behaviors; subsequent byte-size test corrected because emoji fixture was below1024 bytes                                                                                                                      |
| node --test apps/api/test/shipment/partial-mapping.test.cjs apps/api/test/uniship/mapping-v2.test.cjs | PASS       | 9/9 after independent-review fixes; count exponent, date leap/year/TZ, privacy and merge                                                                                                                                |
| node --test apps/web/test/retail-\*.test.mjs                                                          | PASS       | 141/141, including typedVND/kg, zero, legacyCNY, actual count/destination                                                                                                                                               |
| packages/database/test/shipment-sql.mjs on owned PG                                                   | PASS       | New worker six-column allow / API-deny, numeric/JSON constraints, WEIGHT_FREIGHT; old deny assertions kept                                                                                                              |
| packages/database/test/migration.mjs on owned PG                                                      | PASS       | Legacy preservation, NULL new fields, repeat and schema drift                                                                                                                                                           |
| integration/shipment-integration.test.cjs on owned PG                                                 | PASS       | 22/22, new genuine mapping Sync/API subtest and existing capacity/fence/rollback/read tests                                                                                                                             |
| integration/uniship-shipment-integration.test.cjs on owned PG                                         | PASS       | 12/12, existing hash/claim/complete-child semantics                                                                                                                                                                     |
| integration/sync-integration.test.cjs on owned PG                                                     | PASS       | 61/61, existing execution/identity/version/lease/fence/concurrency regressions                                                                                                                                          |
| contracts:generate                                                                                    | PASS       | DTO→OpenAPI→SDK generated; contract check in quality                                                                                                                                                                    |
| pnpm typecheck with canonical API_INTERNAL_URL/NODE_ENV                                               | PASS       | 10 tasks; initial missing API_INTERNAL_URL failed then environment supplied                                                                                                                                             |
| pnpm quality                                                                                          | PENDING    | Final invocation running; earlier lint fixture exports/unused values and new fixture privacy scanner failures corrected; contracts:check also correctly rejected uncommitted generated files before commit              |
| docs/preflight unit suites                                                                            | PENDING    | Explicit executions before final commit                                                                                                                                                                                 |
| Retail fixture build                                                                                  | PASS       | Actual TSX/CSS bundle                                                                                                                                                                                                   |
| Retail Chromium checks                                                                                | FAIL       | Column-picker search background expected white, actual surface-muted at retail-column-picker-checks.mjs:83. Reproduced identically on unchanged ef0cf4e baseline; six-viewport geometry passed. No assertion/CSS change |
| sh scripts/quality-docker.sh                                                                          | NOT RUN    | Full Compose services/tooling unavailable in this host-only workspace;636MB free after builds, no safe isolated full-stack override. No shared stack/volume mutation to obtain a green result                           |
| exact-final-HEAD hosted gates                                                                         | PENDING    | Required before final readiness; PR description carries SHA/run IDs                                                                                                                                                     |

Test harness corrections are recorded, not erased: private runtime secret initially
48hex failed policy (regenerated64hex); first integration invocation used wrong cwd;
historical migration Prisma create needed select:id before new columns existed;
old charge oracle fixed hardcoded8/9 positions for the added catalog code; old
Uniship omission fixture stopped mutating now-confirmed dates. Existing assertions
were retained. First local Chromium teardown masked its original failure; temporary
runner now uses repository teardown utilities. Baseline browser comparison reproduces
the same pre-existing focus/background failure; it is not counted as a pass. No CI/assertion/timeout bypass.

## G. Security/privacy and independent review

No ShippingInfo, FakeCustomer\*, account/contact/staff/raw JSON or service-flag inference
is staged/stored/exposed. New discussion fixture uses synthetic tracking code
MAPPING-V2-REDACTED; exact selected source facts remain, historical captures/digests
unchanged. No credentials logged. Root trusted namespace matches attributes; unknown
keys/version/depth/oversize fail closed. API exposes only typed values. Production
registry/transport, identity and worker Nexora-owned privilege restrictions unchanged.

Independent reviewer inspected working tree vs ef0cf4e and independently ran9/9 tests.
Three P2 closed: leading-zero scientific-count overflow check, required leap/TZ
coverage, canonical mapping confidence wording. No open P1/P2/P3 in reviewed scope.
Reviewer verified frozen snapshot SHA and unchanged captured/reference fixtures.
This is independent code review, not approval of future exact-final-HEAD CI.

## H. Báo cáo PM (bảy câu hỏi)

1. **Đủ yêu cầu chưa?**27/27 correspondences đã được triển khai; không dùng tỷ lệ này
   thay cho nghiệm thu live. Unit và PostgreSQL chính đã PASS; quality/hosted/browser
   cuối còn cần chốt bằng bằng chứng dưới mụcF.
2. **Blocker?** Chưa phát hiện blocker mapping sau review; kiểm thử cuối/release còn
   pending. Production bị hard-close bởi NEXORA-058, độc lập với mapping.
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
6. **Tiếp theo?** Agent chốt quality/browser/final-headCI; owner review PR, không auto-merge.
   Owner/nhóm NEXORA-058 xác minh provider/live/operational prerequisites; chỉ sau đó
   mới cân nhắc activation. Không backfill hàng loạt trong task này.
7. **Khi nào production?** Chưa có ngày có căn cứ. Mapping hoàn thiện mã không đồng
   nghĩa đủ production;058 còn authorization/custody/live contract/claim/identity/
   pagination/operational gates và owner-controlled enablement.

## I. Remaining scope

FeeShip/FeeShipVN/CheckFeeVND, unsuffixed fee aliases, ProductAmount/quantity-value,
all four Is\* flags, raw private fields and other unselected fields remain omitted.
ExDate is guard only. Exchange-rate effective time is absent; no conversion.
No incremental watermark, inferred service enablement, claim lifecycle proof,
provider ID stability or live activation/backfill is claimed. NEXORA-058 remains active.

## J. Merge readiness

VERIFICATION INCOMPLETE — pending final quality, browser and exact-final-HEAD hosted
evidence. No merge or production activation is authorized by this report.
