# NEXORA-060 — Mapping V2 implementation and acceptance

Date: 2026-11-20 (Asia/Ho_Chi_Minh). Baseline ef0cf4e. Evidence applies to this
branch implementation; exact final HEAD and hosted workflow results are recorded
separately in the PR. No merge, production enablement or live Uniship request.

## A. Field Storage Decision Matrix

27 selected correspondences; this denominator includes existing source/status/lookup
facts as well as newly enriched fields. Alias validation and exclusions are separate,
not extra accepted mappings. Test names refer to the new two unit files and genuine
Shipment/Uniship PostgreSQL integration suites, not live provider captures.

| Uniship Field      | Canonical Meaning                       | Chosen Storage      | Validation                                                                | API Exposure                                             | Tests                                  | Rationale                                                       |
| ------------------ | --------------------------------------- | ------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| ID                 | Scoped source identity                  | EXISTING CORE       | Exact positive integer lexeme; scoped uniship-parcel-v1 identity          | uniship-parcel-v1 unchanged                              | mapping-v2 / partial-mapping / real PG | Current read need; Source key per provider/account              |
| TransactionCode    | Tracking text                           | EXISTING CORE       | Required nonempty Domain-bounded text; no silent trimming                 | trackingCode                                             | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| Status             | Original status and physical stage      | EXISTING CORE       | Exact numeric status; known stage mapping, safe UNKNOWN warning           | providerStatus/logisticsStage                            | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| OldStatus          | Claim context                           | EXISTING CORE       | Optional numeric claim context; known1–5, else locked prior stage/UNKNOWN | Same status/claim behavior                               | mapping-v2 / partial-mapping / real PG | Current read need; Provider mapping only                        |
| Weight             | Reported kg                             | EXISTING CORE       | DecimalValue(10,3), nonnegative, raw numeric lexeme                       | weightKg                                                 | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| NumberOfPack       | Package count                           | EXISTING CORE       | Exact integer0..2147483647, no rounding                                   | packageCount                                             | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| RealNumberOfPack   | Actual package count                    | NEW CORE            | Exact integer0..2147483647, no rounding                                   | actualPackageCount summary/detail                        | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| PriceAmount        | Source freight unit price/currency/unit | PROVIDER ATTRIBUTES | DecimalValue(18,2), nonnegative; VND (PriceAmount per kg); zero retained  | typed freightUnitPrice summary/detail                    | mapping-v2 / partial-mapping / real PG | Current read need; Current reported source pricing basis        |
| FeeWeightAmount    | Weight freight charge                   | CHILD TABLE         | DecimalValue(18,2), nonnegative; VND (PriceAmount per kg); zero retained  | WEIGHT_FREIGHT VND                                       | mapping-v2 / partial-mapping / real PG | Current read need; Shared charge vocabulary                     |
| TotalAmount        | Reported total                          | EXISTING CORE       | DecimalValue(18,2), nonnegative; VND (PriceAmount per kg); zero retained  | totalAmount/totalCurrency VND                            | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| TotalPaidAmount    | Provider-reported paid amount           | NEW CORE            | DecimalValue(18,2), nonnegative; VND (PriceAmount per kg); zero retained  | providerPaidAmount                                       | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| TotalRemainAmount  | Provider-reported remaining amount      | NEW CORE            | DecimalValue(18,2), nonnegative; VND (PriceAmount per kg); zero retained  | providerRemainingAmount                                  | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| PaymentDate        | Provider payment timestamp              | NEW CORE            | Calendar-valid UTC+7 → UTC, null preserves                                | providerPaidAt                                           | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| ExchangeRate       | Reported rate                           | EXISTING CORE       | DecimalValue(18,6), nonnegative; no conversion/effective time             | exchangeRate; exchangeRateAt null without effective time | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| CreatedDate        | Source-created reference time           | PROVIDER ATTRIBUTES | Calendar-valid UTC+7 → UTC, null preserves                                | typed providerCreatedAt detail                           | mapping-v2 / partial-mapping / real PG | Current read need; Reference fact, not Nexora createdAt         |
| ModifiedDate       | Provider update time                    | EXISTING CORE       | Calendar-valid UTC+7 → UTC, null preserves                                | providerUpdatedAt, never stage time/watermark            | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| ChinaStoreID       | Source warehouse identifier             | PROVIDER ATTRIBUTES | Exact provider ID as bounded string, trusted namespace; no Nexora FK      | typed originWarehouseProviderId detail                   | mapping-v2 / partial-mapping / real PG | Current read need; Opaque provider key, not global warehouse FK |
| chinaStores.Name   | Origin name                             | EXISTING CORE       | Matching ID/StoreType1, valid nonempty name; missing lookup warns         | originWarehouse                                          | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| ReceivePlaceName   | Destination warehouse name              | NEW CORE            | Nullable text <=256; omission preserves                                   | destinationWarehouse                                     | mapping-v2 / partial-mapping / real PG | Current read need; Shared singleton                             |
| ShippingMethod     | Source-reported delivery method text    | PROVIDER ATTRIBUTES | Nullable text <=128 in closed attributes schema                           | typed lastMileMethod detail                              | mapping-v2 / partial-mapping / real PG | Current read need; Not a verified cross-carrier method taxonomy |
| GuaranteeAmountVND | Insurance fee                           | CHILD TABLE         | DecimalValue(18,2), nonnegative; VND (PriceAmount per kg); zero retained  | INSURANCE VND,0 retained                                 | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| FragileFeeVND      | Wood packing fee                        | CHILD TABLE         | DecimalValue(18,2), nonnegative; VND (PriceAmount per kg); zero retained  | WOOD_PACKING VND,0 retained                              | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| FoamFeeVND         | Bubble wrap fee                         | CHILD TABLE         | DecimalValue(18,2), nonnegative; VND (PriceAmount per kg); zero retained  | BUBBLE_WRAP VND,0 retained                               | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreCNImportDate  | Origin receipt                          | CHILD TABLE         | Calendar-valid UTC+7 → UTC, null preserves                                | ORIGIN_RECEIVED                                          | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreCNExportDate  | Origin dispatch                         | CHILD TABLE         | Calendar-valid UTC+7 → UTC, null preserves                                | ORIGIN_DISPATCHED                                        | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreVNImportDate  | Destination receipt                     | CHILD TABLE         | Calendar-valid UTC+7 → UTC, null preserves                                | DEST_RECEIVED, supplied destination location             | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |
| StoreVNExportDate  | Destination dispatch                    | CHILD TABLE         | Calendar-valid UTC+7 → UTC, null preserves                                | DEST_DISPATCHED, not delivered time                      | mapping-v2 / partial-mapping / real PG | Current read need; Shared                                       |

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

1. **Đủ yêu cầu chưa?**27/27 correspondences đã được triển khai; không dùng tỷ lệ này
   thay cho nghiệm thu live. Unit, PostgreSQL và quality đã PASS; hosted73d984b đã PASS. Browser local đã PASS sau khi runner tạm có đủ prerequisite focus như harness chính;
   các lần FAIL trước giữ ở mụcF.
2. **Blocker?** Không còn blocker mapping/release đã biết sau review và CI73d984b; owner vẫn cần review. Production bị hard-close bởi NEXORA-058, độc lập với mapping.
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

FeeShip/FeeShipVN/CheckFeeVND, unsuffixed fee aliases, ProductAmount/quantity-value,
all four Is\* flags, raw private fields and other unselected fields remain omitted.
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

READY FOR OWNER REVIEW — implementation73d984b has local quality, genuine PostgreSQL,
Chromium and all hosted gates PASS. Evidence-only final commit is bound to its own
exact HEAD/run IDs in PR59 description before handoff. This report is a captured
verification record, not production authorization or permission to merge.

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
