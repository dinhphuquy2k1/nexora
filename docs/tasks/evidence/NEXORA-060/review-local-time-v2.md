# NEXORA-060 — latest retained-local-time v2 decision

Owner request received2026-11-21; policy decision dated2026-11-20.
Baseline52988c26ab9373f411c5049838a2e326e7042d48, PR59,
feature/uniship-mapping-extension. Snapshot local-time-v2 formatted before SHA:
b5fe0fbc490ed807532df7e02904f5fd73b30102bdd23ba5ad45f64e351e29a7.
Both previous frozen snapshots and captured fixtures/digests remain unchanged.

## Current governing decision and unresolved evidence

Owner decision 2026-11-20: Vietnam local time (UTC+7). Conflicting observation kept
for review: order MD59639 API CreatedDate 2026-11-20T03:03:16 while the Uniship UI
showed 20-11-2026 10:03:16.

The latest retained-policy request supersedes the immediately preceding UTC-only
request as current behavior. Original parseUnishipLocalTimestamp body is restored
verbatim from074298d; no calendar/format/millisecond/offset/early-year check changes.
All callers use it; raw timestamp strings are untouched. Previous UTC-only green
runs remain executed history, not proof of the actual provider timezone.

All35 mappings, numeric services, ProductAmount CNY, ProductNumber, single ProductName
item, COUNTING VND0.0, deferred aliases and both count sources stay unchanged.
Web formatDate already specifies Asia/Ho_Chi_Minh; production rendering is unchanged.
New regression explicitly proves time-of-day/day rollover under three host zones.

## Mandatory live follow-up — NOT RUN here

NEXORA-058 must, after first controlled real manual sync and before automatic
schedules, compare warehouse import/export times of three parcels in Nexora versus
Uniship UI. If seven hours off, stop/keep schedules disabled, implement a separate
UTC-interpretation correction task, then sync fresh observations again to overwrite
provider-owned times under existing fences. Do not infer/fabricate stage history.
No actual live sync, schedule enablement or provider semantic certainty is claimed.

## Executed checks

| Check                                                                                 | Result     | Evidence                                                                                                                 |
| ------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| Changed policy tests on prior UTC-only build                                          | FAIL (RED) | 13/17 PASS,4 FAIL; missing local parser export and wrong source-clock expectations                                       |
| Related API units/privacy/Retail model                                                | PASS       | 72/72:48 Shipment/Uniship +17 privacy/provenance +7 Retail model                                                         |
| All Retail tests                                                                      | PASS       | 143/143, including explicit Asia/Ho_Chi_Minh time and rollover across UTC/NewYork/Tokyo host zones                       |
| Genuine PostgreSQL Shipment integration                                               | PASS       | 22/22; retained UTC+7→UTC storage expectations; existing services/items/counting/idempotence/rollback behavior preserved |
| Genuine PostgreSQL Uniship integration                                                | PASS       | 12/12; all source/version/fence/complete snapshot regressions preserved                                                  |
| npx --yes pnpm@10.34.6 format:check                                                   | PASS       | Frozen snapshot bytes/digest unchanged                                                                                   |
| npx --yes pnpm@10.34.6 lint                                                           | PASS       | Boundaries and ESLint                                                                                                    |
| API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 typecheck | PASS       | 10 tasks                                                                                                                 |
| npx --yes pnpm@10.34.6 contracts:check                                                | PASS       | Reproducible; no API/SDK diff                                                                                            |
| npx --yes pnpm@10.34.6 docs:check                                                     | PASS       | Canonical policy/058 gate/task/snapshot                                                                                  |
| npx --yes pnpm@10.34.6 preflight:check                                                | PASS       | Local governance; exact PR binding checked before push                                                                   |
| npx --yes pnpm@10.34.6 test:docs                                                      | PASS       | 10/10                                                                                                                    |
| npx --yes pnpm@10.34.6 test:preflight                                                 | PASS       | 24/24                                                                                                                    |
| New exact-HEAD Preflight/Sync/Foundation                                              | NOT RUN    | Pending push at capture; new run/head/merge/attempt results recorded after execution                                     |
| Actual058 three-parcel comparison                                                     | NOT RUN    | Requires future owner-controlled first real sync; blocks automatic scheduling                                            |

PostgreSQL17.11 used only a signed task-owned Docker container with tmpfs/private
credentials. No user volume reset or live request. Raw long logs/credentials/IP/MAC
are not committed. No schema/migration/grant/API/SDK/identity/FULL/fence change.

## Independent review and readiness

Independent reviewer ran55/55 API/Retail model tests and17/17 privacy checks,
verified original helper byte-equivalence, both old snapshots/captured fixtures
unchanged, new SHA match and diff --check PASS. No open P1/P2/P3 in reviewed diff.
This is code/policy implementation review, not external timezone proof or CI approval.

VERIFICATION INCOMPLETE until new exact-HEAD gates complete. Rules A/B retained;
no unrelated test fix, Foundation step/order/namespace/retry/timeout/assertion change,
no action rerun for green and no merge or activation.
