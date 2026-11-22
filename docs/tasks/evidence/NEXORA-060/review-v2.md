# NEXORA-060 — owner review remediation v2

Owner evidence date2026-11-20; implementation date2026-11-21 (Asia/Ho_Chi_Minh).
Baseline074298d5ba866de79988d793c997e2767fad7025, branch feature/uniship-mapping-extension,
PR59. Snapshotv2 was formatted before SHA5093a9822ad64c028cc3de8c4917aa51837c80fc7416e05a7337375a2029ca0e.
Snapshotv1/captured fixtures/digests/historical PASS/FAIL rows remain untouched.

## Decisions and changed behavior

Prior UTC+7 confirmation is superseded: UTC (owner evidence2026-11-20:
API03:03:16 ↔ UI10:03:16). MD59639's browser session03:02:35UTC and343558
ModifiedDate03:19:58 before capture03:20:50UTC corroborate same-instant UTC.
parseUnishipUtcTimestamp retains calendar/format/millisecond validation, adds UTC
suffix and never subtracts7hours. Day19 at18:30 stays day19.

Four numeric1/0 service flags map independent true/false facts. Null creates no
entry (unknown); existing complete snapshot of supplied numeric flags remains,
all-null omits services. Other types/numbers fail validation via safe record rejection.
ProductAmount exact nonnegative → declaredValue CNY; ProductNumber exact integer →
itemCount; nonblank ProductName → one complete item, no inferred quantity/unit value;
null/blank omits items. CheckFeeVND → existing COUNTING VND scoped fee, zero retained.
FeeShip/FeeShipVN/FeeOther/unsuffixed aliases remain omitted. Count mapping unchanged;
Uniship SỐ KIỆN(CHÍNH) source unknown and may differ from NumberOfPack.

No schema/migration/grant/API/SDK change. COUNTING already exists; only the internal
partial-charge whitelist extends. Preserve source identity/FULL/fences and prior
warehouse ID/name consistency/reported-total UI fixes. Processor2 stays within this
unmerged PR; no automatic historical timestamp correction/backfill/live activation.

## Executed evidence

Services/items use actual PostgreSQL17.11 in a task-owned Docker container with
signed disposable-cluster identity, tmpfs data and private credentials. No user
volume reset. Host Node24 tooling is supported; full Compose runtime is verified
separately by hosted Foundation, not inferred from these tests.

| Check                                                                                 | Result     | Detail                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Baseline build, new/updated mapping tests                                             | FAIL (RED) | 3/10 PASS,7 FAIL: wrong clock shift, missing UTC export, newly verified services/products/counting absent                                                                                              |
| node --test mapping-v2.test.cjs review-v2.test.cjs                                    | PASS       | 10/10 after implementation; UTC examples, strict1/0/null, scalar/zero/invalid/omission cases                                                                                                           |
| Shipment and Uniship unit directories                                                 | PASS       | 48/48; independently repeated by reviewer                                                                                                                                                              |
| fixture privacy/provenance test                                                       | PASS       | New discussion/synthetic fixtures satisfy existing scanner; captured digests unchanged                                                                                                                 |
| shipment-integration.test.cjs                                                         | PASS       | 22/22; actual UTC milestones/payment/updated/created storage;343558 services/items/CNY/count; stable child IDs/xmin on repeat, null/blank preservation, mixed services unknown, delivered COUNTING0.00 |
| uniship-shipment-integration.test.cjs                                                 | PASS       | 12/12; task-owned omission fixtures updated to omit newly mapped fields; existing complete snapshots/isolation/fencing assertions retained                                                             |
| npx --yes pnpm@10.34.6 format:check                                                   | PASS       | Task files formatted, frozen snapshot untouched                                                                                                                                                        |
| npx --yes pnpm@10.34.6 lint                                                           | PASS       | Boundaries and ESLint                                                                                                                                                                                  |
| API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 typecheck | PASS       | 10 tasks; source/schema/DTO/SDK consistent                                                                                                                                                             |
| npx --yes pnpm@10.34.6 contracts:check                                                | PASS       | Generated contracts reproducible; no public contract drift                                                                                                                                             |
| npx --yes pnpm@10.34.6 docs:check                                                     | PASS       | Canonical docs, links and task/snapshot binding                                                                                                                                                        |
| npx --yes pnpm@10.34.6 preflight:check                                                | PASS       | Local governance; exact PR metadata checked separately before push                                                                                                                                     |
| npx --yes pnpm@10.34.6 test:docs                                                      | PASS       | 10/10                                                                                                                                                                                                  |
| npx --yes pnpm@10.34.6 test:preflight                                                 | PASS       | 24/24                                                                                                                                                                                                  |
| Exact new-HEAD Preflight/Sync/Foundation                                              | NOT RUN    | Pending push at capture; final source SHA, merge checkout, run/attempt/job IDs and outcomes go in PR description after execution                                                                       |

Initial resumed dist was stale (45251f4), so baseline074298d was rebuilt before RED;
no old failure is misattributed to remediation. Snapshot v2 carries original v1
inspection inventory; current task notes clarify the inherited no-task060 sentence.
Reviewer reported no code P1/P2; report table/render/current-vs-historical wording
issues were corrected. Independent review is not CI approval.

## Readiness and controls

VERIFICATION INCOMPLETE until exact-new-HEAD checks finish. Earlier73d984b green
is historical, not proof for remediationv2. Rules A/B retained: task-owned defects,
format and missing environment are corrected with evidence; unrelated existing test
failure, Preflight CI failure or out-of-scope harness/timeout/retry/assertion changes
require stopping. No action rerun for green, merge, issue closure or production enablement.

## Executed hosted code-head verification

All attempt1, source8b24f69482b6275b298f091d0db6b913a251b7b7,
base5e96199d8e83b058d6871942ca8becb2fbb30ac2. Actual checkout
413b2a8f9b77c472ac533865c5441845bb244185 matches GitHub PR merge SHA and
checkout git-log output fetched from Foundation job. Date2026-11-21.

| Workflow      | Run / job                 | Result |
| ------------- | ------------------------- | ------ |
| Preflight     | 44908003499               | PASS   |
| Sync Targeted | 44908003491               | PASS   |
| Foundation    | 44908003476 /136857611753 | PASS   |

Foundation Docker quality/migrated integration, Pager/filter browser acceptance,
runtime/provisioning/TTY/browser, public HTTPS/onboarding, DB/storage persistence
and HMR/dependency drift all PASS (steps4–10). Retail artifact14708719717,
retail-m3-browser-evidence,10745197bytes. Raw job logs were read locally; no raw
logs, IP/MAC, URLs with credentials, cookies or tokens are committed. No action
rerun, merge, timeout/assertion weakening or production activation.

V2 code is READY FOR OWNER REVIEW. This evidence-only finalization commit is
verified separately on its exact HEAD; its SHA/run IDs are recorded in PR59
description via gh api after completion, avoiding a self-referential SHA claim.
The pre-push NOT RUN row and previous-snapshot results above remain historical.

Foundation job clock: started2026-11-21T13:16:12Z, completed2026-11-21T13:33:44Z.
Run: https://github.com/dinhphuquy2k1/nexora/actions/runs/44908003476
Job: https://github.com/dinhphuquy2k1/nexora/actions/runs/44908003476/job/136857611753
