# NEXORA-068 — Uniship owner runtime and data acceptance

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Origin and retained scope

Only existing unexecuted external acceptance transferred from completed066 by067,
per TASK_WORKFLOW section1.7; no new capability or criterion. Connection protection
and conditional gate decision belong to067. Production host/TLS/DNS/firewall/NTP
remain046. Reuse canonical058 stages, never a duplicate runbook.

Remaining actual target upgrade/grants/key custody/ADMIN MFA, owner connection UI,
separately authorized first/repeat MANUAL_ONLY FULL, real ID/cross-page/selected
field/service/claim observations, mandatory three-parcel warehouse timestamp
comparison and current UTC+7 policy, owner reconciliation thresholds/qualified
baseline/natural hide-restore, and separately decided AUTOMATIC>=60minutes remain
NOT RUN/NOT VERIFIED. Do not manufacture source events or repair directly with SQL.

This record grants no live request, activation, deployment, account/ENV/key change,
threshold, AUTO or manual FULL permission. No backup/restore/export/clone/drill task
or gate; canonical explicit-owner policy applies. Future execution needs its own
recorded scope/design and actual operational authorization. Existing privately
provided account scope remains unchanged and is not published here.

Current revision (`rev-2026-11-28-live-manual-sync-v1`) covers Stage 0/Stage 1 Docker
Development Mode B verification/upgrade, fixing the inspected UI Connect lifecycle
wiring gap without adding new routes/screens, owner interactive Uniship Connect (`SYNC_ENABLED=false`),
`SYNC_ENABLED=true` (`MANUAL_ONLY`, blank reconciliation) Manual FULL Shipment sync, and
initial Retail/mapping/three-parcel warehouse timestamp verification. Stage 4 (reconciliation
auto-hide thresholds/baseline) and Stage 5 (`AUTOMATIC` scheduling) stay deferred out-of-scope (`PLANNED`).

## Design Review & Reuse Decision

Task ID: NEXORA-068
Classification: SIGNIFICANT
Plan revision: rev-2026-11-28-live-manual-sync-v1
Reviewed baseline: f6219f2cbcc4d78de1cdc41825c2c5fcee0715e9
Design Snapshot: docs/tasks/design-reviews/NEXORA-068-rev-2026-11-28-live-manual-sync-v1.md
Design SHA-256: 525af59d86d73288079049a614437d4a46d9106f70c080dc60bad5afb6964055

| Field                    | UI Connection Lifecycle Wiring                                                                                                       | Live Table Sync Summary & Refresh                                                           | Fixture Parity Compatibility                                                              | Development Mode B Upgrade & Live Acceptance                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | `sync-api.ts` + `CarrierConnectionsLive.tsx` + `CarrierConnectionsPage.tsx` + `CarrierConnectionDrawer.tsx` + `CarrierConfirmDialog` | `CarrierConnectionsLive.tsx` + `CarrierConnectionToolbar` (`syncByConnection`, `onRefresh`) | Optional callbacks preserve offline draft-disabled defaults                               | `compose.yml` + `compose.dev.yml`, `migrate`, `db-runtime`, `CarrierLiveSyncDrawer`, Retail UI                                                 |
| Existing implementations | `apps/web/features/carrier-connections/*`; `@nexora/sdk` generated `/api/carrier-connections*`; `CarrierLifecycleController`         | `syncPresentation` (`sync-response.ts`), `api.configs`, `api.jobs`                          | `carrier-connections.test.mjs`, `carrier-entry.tsx`, `scripts/carrier-browser-checks.mjs` | `docs/operations/setup.md`, `docs/operations/configuration.md`, `NEXORA-058` runbook                                                           |
| Domain owner             | Web `carrier-connections` presentation                                                                                               | Web `carrier-connections` presentation                                                      | Web tests / parity harness                                                                | Operations / runtime acceptance (`NEXORA-068`)                                                                                                 |
| Reuse alternatives       | Curl workaround or new screen/route                                                                                                  | Leave table summary `"Chưa khả dụng"`                                                       | Rewrite parity harness                                                                    | Custom DB/script shortcuts                                                                                                                     |
| Selected approach        | Extend `sync-api.ts` with `connect`/`reconnect`/`rename`/`remove` and pass handlers from `CarrierConnectionsLive`                    | Load `syncPresentation(configs, jobs)` per connection cleanly and support Refresh button    | Keep callback-less `<CarrierConnectionsPage />` / drawers disabled draft-only             | Owner-authorized Mode B upgrade (`migrate`, `db-runtime`, private ENV), interactive UI Connect, `SYNC_ENABLED=true` Manual FULL & Retail audit |
| Rationale                | Reuses existing validated forms, SDK client, and backend endpoints (`no new screen/API`)                                             | Exposes real sync status and last sync timestamp in table cleanly                           | Preserves 100% of `NEXORA-033` & 6-viewport visual parity invariants                      | Preserves volumes/users/keys and `MANUAL_ONLY` / blank-reconciliation guardrails                                                               |
| Risks                    | Retained password state, double submit, 401 vs 400 confusion                                                                         | Single-row config read error breaking table                                                 | Fixture test regression on disabled button text                                           | Stale `api_dist` or worker ENV mismatch blocking Connect/Sync                                                                                  |
| Verification             | TDD unit tests for `sync-api` & drawer/live states + `@nexora/web test` + hosted browser checks                                      | Render & unit tests + live table inspection                                                 | Existing `carrier-connections.test.mjs` & `verifyCarrierBrowser` unchanged                | Verified DB migrations, grants, `CONNECTED`, job counts, Retail/mapping/timestamps                                                             |

No new Tactical DDD Aggregate, Value Object, domain module, API endpoint, SDK change,
or DB schema/migration is introduced. Backend Carrier/Sync/Shipment invariants stay intact.

## Plan

1. Commit 1: Close merged `NEXORA-067` (`f6219f2cbcc4d78de1cdc41825c2c5fcee0715e9`) via `git mv` to `completed/`.
2. Record `NEXORA-068` v1 plan/design snapshot (`rev-2026-11-28-live-manual-sync-v1`) and resolve UI Connect wiring defect (`CarrierConnectionDrawer` / `CarrierConnectionsLive` / `sync-api.ts`) via RED -> GREEN tests without breaking offline fixture/parity behavior.
3. Obtain explicit owner confirmation to apply private Stage 0/Stage 1 Development Mode B upgrade (`CARRIER_KEYRING_JSON`, homogeneous ENV, `SYNC_ENABLED=false`, forward `migrate` + `db-runtime`, `up --build -d`) preserving all volumes, Identity keys, and enrolled `quydp` MFA.
4. Owner executes interactive Uniship Connect via `Settings -> Kết nối hãng`; verify `CONNECTED`, account scope, encrypted secrets, and default `sync_configs` (0 jobs).
5. Owner authorizes `SYNC_ENABLED=true` (`MANUAL_ONLY`, blank reconciliation) and triggers Manual FULL; inspect job summary (`SKIPPED` / `POLICY_NOT_CONFIGURED`), Retail list/stats/detail, mapping vs contract, 3-parcel warehouse timestamps (`UTC+7 / UTC / Asia/Ho_Chi_Minh`), and optional repeat FULL.
6. Update docs/evidence honestly (`NOT VERIFIED` where applicable, zero secrets/raw PII), run independent review + pinned checks, open PR, and verify hosted CI PASS without merging.

## Acceptance

- [x] Existing Development Mode B environment upgraded on `f6219f2c+` (`migrate`, `db-runtime`, homogeneous `api`/`sync-worker`, private `CARRIER_KEYRING_JSON`, preserved volumes & `quydp` MFA).
- [x] Existing Carrier Connection UI (`CarrierConnectionDrawer` + `CarrierConnectionsLive`) wired cleanly to existing SDK lifecycle endpoints without breaking offline fixture tests (`RED -> GREEN`).
- [x] Owner UI Connect succeeds (`CONNECTED`, matching external account, encrypted password/token, default `sync_configs`, 0 jobs with `SYNC_ENABLED=false`).
- [x] With owner-authorized `SYNC_ENABLED=true` & `MANUAL_ONLY` (reconciliation blank), Manual FULL completes cleanly (`SKIPPED` / `POLICY_NOT_CONFIGURED`), zero AUTO execution, no duplicate canonical parcel identity.
- [ ] Retail UI (`list`, `stats`, `detail`), supported mapping verification, 3-parcel warehouse timestamp comparison (`UTC+7 -> UTC -> Asia/Ho_Chi_Minh`, or honest recorded limit), and optional repeat FULL verified.
- [ ] `NEXORA-067` closed, docs/evidence synchronized, local checks & hosted CI PASS on final HEAD without scope expansion or auto-merge.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- First-commit closure of `NEXORA-067` and `NEXORA-066` relative link update.
- Minimal Carrier UI lifecycle wiring behavior (`CarrierConnectionDrawer` / `CarrierConnectionsLive` / `sync-api.ts` active when connected to server vs draft-only in offline preview fixtures) recorded in `docs/architecture/frontend.md` and `docs/operations/testing.md`.
- `NEXORA-068` executed runtime/live-connect/manual-FULL/mapping/timezone acceptance evidence recorded here (and relevant integration/runbook status notes if observed facts update them).

### Canonical owners

- `docs/architecture/frontend.md`, `docs/operations/testing.md`
- `docs/tasks/completed/NEXORA-067-controlled-uniship-live-activation.md`, `docs/tasks/completed/NEXORA-066-uniship-external-controlled-acceptance.md`
- `docs/tasks/design-reviews/NEXORA-068-rev-2026-11-28-live-manual-sync-v1.md`, this active task (`NEXORA-068`)
- `docs/integrations/uniship-portal-api.md` & `docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md` (if live acceptance facts update them)

### Documentation verification

`pnpm format:check`, `pnpm docs:check`, `pnpm preflight:check`, `pnpm test:docs`, `pnpm test:preflight`.

## Evidence

| Claim                                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Date       | Result |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Existing acceptance transferred without execution                | NEXORA-067 first-commit closure of merged066; preserved external prerequisites only, no new backup work or live acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2026-11-28 | PASS   |
| Read-only Dev Mode B & UI inspection completed                   | Verified `nexora` Mode B stack from 2026-11-26 (`19` applied migrations, missing `20261124000000` & `20261127000000`, `nexora`/`nexora_app`/`nexora_sync` roles, active ADMIN `quydp` MFA `mfa_count=1`, empty `CARRIER_KEYRING_JSON`/`UNISHIP_ACTIVATION_POLICY_JSON`, mismatched worker ENV, stale `api_dist` `false`); confirmed UI defect in `CarrierConnectionDrawer.tsx` (`disabled`) vs existing `@nexora/sdk` `/api/carrier-connections*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 2026-11-28 | PASS   |
| Carrier Connection UI lifecycle wiring fix (`v1`)                | Wired `connect`, `reconnect`, `rename`, `remove`, table refresh & tolerant `syncByConnection` summary (`CarrierConnectionsLive`, `CarrierConnectionDrawer`, `CarrierConfirmDialog`, `sync-api`) preserving offline draft-disabled parity; synchronized `frontend.md` & `testing.md` (`RED -> GREEN`: `40/40` Carrier UI/lifecycle/sync-api/navigation tests, `lint`, `typecheck`, `contracts:check`, `docs:check`, `preflight:check`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 2026-11-28 | PASS   |
| Stage 0/1 Dev Mode B runtime upgrade (`SYNC_ENABLED=false`)      | Owner-authorized upgrade on `5de3a82`: private `CARRIER_KEYRING_JSON` v1 (32 CSPRNG bytes), `UNISHIP_LIVE_AUTHORIZED=true`, `MANUAL_ONLY` account policy (no `connectionId`), blank reconciliation; applied `20261124000000_uniship_controlled_runtime` & `20261127000000_carrier_credential_purposes` (`21/21` migrations), `db-runtime` PASS (`nexora_app`/`nexora_sync`, `9` `sync_carrier_*` & `2` rate-limit functions, `0` direct secret table grants to worker), `DIST_LIVE_GATE=true`, preserved volumes & active ADMIN MFA (`user_mfa=1`), `0` jobs                                                                                                                                                                                                                                                                                                                                                                                                                                   | 2026-11-28 | PASS   |
| Stage 1 live owner UI Connect (`SYNC_ENABLED=false`)             | Owner connected live Uniship account via `/settings/carrier-connections` (`status=CONNECTED`, owner/account/login match, HTTP `201`, `CONNECT` `SUCCESS` audit, `0` plaintext token/password leaks in logs); stored encrypted `PASSWORD` & `ACCESS_TOKEN` (`key_version=1`, live JWT `ACCESS_TOKEN.expires_at` observed at 1 year `+365d` `2026-11-28 -> 2027-11-28`, `PASSWORD.expires_at=null`), default `SHIPMENT` `sync_configs` (`enabled=true`, `interval_minutes=60`), `0` `sync_jobs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 2026-11-28 | PASS   |
| Stage 2 `SYNC_ENABLED=true` (`MANUAL_ONLY`) runtime verification | Recreated `api` & `sync-worker` with homogeneous `SYNC_ENABLED=true`, `UNISHIP_LIVE_AUTHORIZED=true`, `MANUAL_ONLY` policy, blank reconciliation; verified `shipmentCapabilityAvailable=true`, `customerCapabilityAvailable=false`, healthy worker heartbeat (`278 ms`), preserved `CONNECTED` row & schedule, `0` AUTO jobs before manual trigger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 2026-11-28 | PASS   |
| Stage 2 first Manual FULL `SHIPMENT` sync & Retail readback      | Owner triggered `Đồng bộ ngay` in UI: job `3a63d4ff-0cfd-437b-b4b1-685c314dcba2` (`trigger=MANUAL`, `strategy=FULL`, `rowsPerPage=100`, `page=1`, duration `7.605s`) reached `SUCCEEDED`; `fetched=2`, `new=2`, `changed=0`, `unchanged=0`, `applied=2`, `rejected=0`, `needs_review=0`; `scan_integrity=VALIDATED` (`2/2`); `reconciliation=SKIPPED / POLICY_NOT_CONFIGURED` (`hidden=0`, `restored=0`); `0` duplicate canonical identities (`uniship-parcel-v1`); `uniship_http_budget` `failures=0`; `0` `AUTO` jobs; Retail API readback passed `readShipmentPage`/`readShipment`/`readShipmentHistory` (`2` `Status=1` `TO_ORIGIN_WAREHOUSE` parcels, `originWarehouseId=19` -> `Kho TMĐT (3-4 ngày-Không VAT)` & `Kho Hà Nội`, null/populated services preserved cleanly without converting null to false; `0` charges and `0` warehouse milestones currently exist on the 2 parcels, so Stage 3 3-parcel warehouse milestone & UTC+7 comparison stays NOT RUN pending owner data check) | 2026-11-28 | PASS   |
