# NEXORA-068 — Pre-Implementation Review & Reuse Audit (`rev-2026-11-28-live-manual-sync-v1`)

## 1. Task Metadata & Classification

- **Task ID**: `NEXORA-068`
- **Task Title**: `Controlled live Uniship connection and first manual shipment sync`
- **Classification**: `SIGNIFICANT`
- **Documentation Impact**: `REQUIRED`
- **Target Branch & PR**: `feat/uniship-live-manual-sync-acceptance`
- **Plan revision**: `rev-2026-11-28-live-manual-sync-v1`
- **Design Snapshot**: `docs/tasks/design-reviews/NEXORA-068-rev-2026-11-28-live-manual-sync-v1.md`
- **Reviewed Baseline HEAD**: `f6219f2cbcc4d78de1cdc41825c2c5fcee0715e9` (`main` after PR #67 merge)

---

## 2. Requirements & Boundary Scope

- **User Story / Business Need**: Upgrade and configure the owner's Docker Development Mode B environment (`compose.yml` + `compose.dev.yml`) to latest `main`, enable owner-executed real Uniship Carrier UI connection (`Settings -> Kết nối hãng`) under `SYNC_ENABLED=false` and account-scoped `MANUAL_ONLY`, then enable `SYNC_ENABLED=true` (`MANUAL_ONLY`, blank reconciliation policy) to perform controlled Manual FULL Shipment sync and verify real synced Retail list/detail/statistics, field mappings, and three-parcel warehouse timestamps (`UTC+7 -> UTC -> Asia/Ho_Chi_Minh`).
- **In-Scope Items**:
  - First-commit closure of merged `NEXORA-067` (`git mv` to `docs/tasks/completed/`, PR #67 merge & CI provenance).
  - Read-only verification and owner-authorized Stage 0 / Stage 1 Development Mode B upgrade (`migrate`, `db-runtime`, private `CARRIER_KEYRING_JSON`, homogeneous `api`/`sync-worker` runtime ENV).
  - Minimal frontend UI defect fix in `apps/web/features/carrier-connections/` so existing `CarrierConnectionDrawer` (Create / Edit-Reconnect), `CarrierConfirmDialog` (Disconnect), and `CarrierConnectionsLive` (list refresh & sync summary) connect to existing `@nexora/sdk` endpoints (`POST /api/carrier-connections`, `POST /api/carrier-connections/{id}/reconnect`, `PATCH /api/carrier-connections/{id}`, `DELETE /api/carrier-connections/{id}`).
  - Controlled live UI Connect (`SYNC_ENABLED=false`), Sync enablement (`SYNC_ENABLED=true`, `MANUAL_ONLY`), Manual FULL job execution, sanitized diagnostics, Retail UI/API/read-only DB mapping & three-parcel timezone comparison, and optional repeat FULL verification.
- **Explicit Non-Goals & Out-of-Scope Items**:
  - Any backup, restore, DB export, volume clone, snapshot, or recovery drill; resetting Docker volumes/DB or rotating Identity keys / `quydp` MFA.
  - Standard Mode migration, `PUBLIC_HTTPS` (`NEXORA-046`), new UI pages/routes, new API endpoints, OpenAPI/SDK changes, DB schema/migration/grant changes, Sync/Carrier/provider-wide refactors, new unapproved Shipment mappings, reconciliation threshold configuration / auto-hide (`Stage 4`), or `AUTOMATIC` sync scheduling (`Stage 5`).
  - Storing real account identifiers, passwords, tokens, cookies, keys, or raw provider PII in Git, fixtures, logs, or CI.

---

## 3. Relevant Documentation & Canonical Owners

- **Governing ADRs**: `docs/decisions/multi-carrier-architecture.md` (ADR-007 including 2026-11-28 amendment), `docs/decisions/tactical-ddd.md` (ADR-008), `docs/decisions/mandatory-pre-code-design-review.md` (ADR-009), `docs/decisions/authentication.md` (ADR-005).
- **Architecture Docs**: `docs/architecture/backend.md`, `docs/architecture/frontend.md`, `docs/architecture/sync-extensions.md`, `docs/architecture/reusable-components.md`.
- **Integration & Runbooks**: `docs/integrations/uniship-portal-api.md`, `docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md`, `docs/tasks/completed/NEXORA-067-controlled-uniship-live-activation.md`, `docs/tasks/active/NEXORA-068-uniship-owner-runtime-and-data-acceptance.md`.
- **Operations Docs**: `docs/operations/setup.md`, `docs/operations/configuration.md`, `docs/operations/deployment.md`, `docs/operations/testing.md`.

---

## 4. Existing Code References & Search Scope

- **Searched Directories & Symbols**:
  - `apps/web/features/carrier-connections/` (`sync-api.ts`, `CarrierConnectionsLive.tsx`, `CarrierConnectionsPage.tsx`, `CarrierConnectionList.tsx`, `CarrierConnectionDrawer.tsx`, `CarrierRowActions.tsx`, `CarrierLiveSyncDrawer.tsx`, `presentation.ts`, `sync-response.ts`, `carrier-connections.module.css`)
  - `apps/web/features/retail-packages/` (`RetailPackageListPage.tsx`, `api.ts`, `response.ts`)
  - `apps/web/test/` (`carrier-connections.test.mjs`, `carrier-sync-api.test.mjs`, `carrier-sync-lifecycle.test.mjs`, `fixtures/carrier-entry.tsx`) and `scripts/carrier-browser-checks.mjs`
  - `packages/sdk/src/generated/api.ts` (`/api/carrier-connections`, `/api/carrier-connections/{id}`, `/api/carrier-connections/{id}/reconnect`)
  - `apps/api/src/carrier/presentation/{carrier,carrier-lifecycle}.controller.ts`, `apps/api/src/sync/presentation/sync.controller.ts`, `apps/api/src/sync/infrastructure/uniship-sync.runtime.ts`, `apps/api/src/shipment/infrastructure/uniship/uniship-shipment.provider.ts`
  - `packages/database/prisma/migrations/` and `packages/database/scripts/provision-runtime.mjs`
- **Inspected Defect (`UI`) & Runtime Observations**:
  - Backend lifecycle controllers and `@nexora/sdk` already implement `GET/POST /api/carrier-connections`, `PATCH/DELETE /api/carrier-connections/{id}`, and `POST /api/carrier-connections/{id}/reconnect`.
  - In `apps/web/features/carrier-connections/CarrierConnectionDrawer.tsx` (`lines 118-120, 268-281`), submit buttons (`"Kích hoạt kết nối"` / `"Lưu thay đổi"`) are hardcoded `disabled title={UNAVAILABLE}` with `<form onSubmit>` setting `touched` only; `CarrierConfirmDialog` (`lines 389-391`) is similarly `disabled`; `sync-api.ts` lacks lifecycle wrappers (`connect`, `reconnect`, `rename`, `remove`); and `CarrierConnectionsLive.tsx` passes `liveSync` (only activating `CarrierLiveSyncDrawer`) without lifecycle callbacks, list refresh, or row `syncByConnection` hydration.
  - Observed owner Development Mode B stack (`nexora` project, containers from 2026-11-26) is behind `main`: missing forward migrations `20261124000000_uniship_controlled_runtime` and `20261127000000_carrier_credential_purposes`, runtime grants via `db-runtime`, `api_dist` rebuild (`UNISHIP_LIVE_CONTRACT_VERIFIED` still `false` in container dist), homogeneous `sync-worker` ENV, private `CARRIER_KEYRING_JSON`, and `UNISHIP_ACTIVATION_POLICY_JSON`. Owner target ADMIN user already has active TOTP MFA enrollment (`mfa_count = 1`), and DB has 0 Carrier/Sync/Shipment rows.

---

## 5. Mandatory Reuse & Design Audit Matrix

| Field                        | UI Carrier Connection Lifecycle Wiring                                                                                                                                                                               | Live Table Sync & Refresh Hydration                                                                                                                          | Offline Fixture & Parity Preservation                                                                                                                   | Development Mode B Upgrade & Live Acceptance                                                                                                                                                                             |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Component**                | Extend `sync-api.ts`, `CarrierConnectionsLive.tsx`, `CarrierConnectionsPage.tsx`, `CarrierConnectionDrawer.tsx`, `CarrierConfirmDialog`                                                                              | Hydrate `syncByConnection` and `onRefresh` in `CarrierConnectionsLive.tsx` / `CarrierConnectionToolbar`                                                      | Preserve default `liveSync=false` / callback-less preview rendering in `CarrierConnectionsPage` & drawers                                               | Reuse existing `migrate`, `db-runtime`, `compose.yml` + `compose.dev.yml`, `CarrierLiveSyncDrawer`, Retail UI                                                                                                            |
| **Existing implementations** | `sync-api.ts`, `CarrierConnectionsLive.tsx`, `CarrierConnectionDrawer.tsx`, `packages/sdk/src/generated/api.ts`, `apps/web/features/customers/errors.ts`                                                             | `syncPresentation()` in `sync-response.ts`, `api.configs()` + `api.jobs()` in `sync-api.ts`                                                                  | `apps/web/test/carrier-connections.test.mjs`, `apps/web/test/fixtures/carrier-entry.tsx`, `scripts/carrier-browser-checks.mjs`                          | `docs/operations/setup.md`, `docs/operations/configuration.md`, `docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md`                                                                                           |
| **Domain owner**             | Web feature `carrier-connections` presentation (`apps/api` Carrier lifecycle owns API/crypto/DB)                                                                                                                     | Web feature `carrier-connections` presentation                                                                                                               | Web test/parity harness & UI feature                                                                                                                    | Operations/runtime & `NEXORA-068` acceptance                                                                                                                                                                             |
| **Reuse alternatives**       | Curl workaround or new screen vs wiring existing `CarrierConnectionDrawer` to `@nexora/sdk` via `sync-api.ts`                                                                                                        | Leave table column `"Chưa khả dụng"` vs reuse existing `api.configs`/`api.jobs` + `syncPresentation` on refresh                                              | Rewrite 14 parity screenshots/tests vs keeping callback-less renders draft-only                                                                         | Create custom setup scripts vs canonical Compose upgrade chain + existing UI flows                                                                                                                                       |
| **Selected approach**        | Add `connect`/`reconnect`/`rename`/`remove` to `sync-api.ts` over `createWorkspaceApiClient()`; wire optional handlers from `CarrierConnectionsLive` -> `CarrierConnectionsPage` -> drawers; map error codes cleanly | Load `connections` + per-connection `syncPresentation(configs, jobs)` in `CarrierConnectionsLive` and expose `onRefresh` on toolbar/header + after mutations | Default `CarrierConnectionDrawer`, `CarrierConfirmDialog`, and `CarrierConnectionsPage` stay disabled draft previews when lifecycle handlers are absent | With owner authorization: configure private ENV (initially `SYNC_ENABLED=false`), migrate + `db-runtime` + `up --build -d`, owner connects via UI, then flip `SYNC_ENABLED=true` for Manual FULL + Retail/timezone check |
| **Rationale**                | Reuses exact validated UI layout, tokens, dialogs, and OpenAPI SDK without new endpoints or screens                                                                                                                  | Owner can immediately see Sync status & last sync timestamp in table after Manual FULL without opening drawer                                                | Zero breakage to `NEXORA-033` unit contracts or 6-viewport browser parity harness (`carrier-browser-checks.mjs`)                                        | Preserves all volumes, users, keys, and `MANUAL_ONLY` / no-reconciliation invariants                                                                                                                                     |
| **Risks**                    | Password retained after submit/close; double submit; leaking raw provider errors; 401 confusion vs carrier auth 400                                                                                                  | Partial per-row `configs`/`jobs` fetch error failing entire connection table                                                                                 | Unintended DOM changes breaking fixture unit/browser assertions                                                                                         | Stale container ENV/dist, missing worker env parity, unapplied grants                                                                                                                                                    |
| **Verification**             | Unit tests for `sync-api` lifecycle calls & errors, `CarrierConnectionDrawer` live submit vs draft-disabled, double-submit guard                                                                                     | Unit/render tests for refresh & sync summary graceful degradation when `configs`/`jobs` fails                                                                | Run full `@nexora/web test`, `carrier-connections.test.mjs`, `pnpm typecheck`, `pnpm lint`, and CI browser foundation                                   | Inspect Postgres `_prisma_migrations`, roles, runtime ENV flags, real Connect row, SyncJob metrics, Retail UI, and 3-parcel timestamps                                                                                   |

---

## 6. Alternative Designs & Trade-offs

- **Alternative 1 (Skip UI fix, instruct manual API/cURL connect)**: Rejected because Section 6 explicitly requires connecting via existing Carrier UI (`Settings -> Kết nối hãng`), and `CarrierConnectionDrawer` currently blocks that workflow with hardcoded `disabled` buttons.
- **Alternative 2 (Enable submit unconditionally in `CarrierConnectionDrawer` without optional callbacks)**: Rejected because existing `NEXORA-033` unit specs (`carrier-connections.test.mjs`) and the isolated fixture browser harness (`carrier-browser-checks.mjs`) assert that standalone/fixture `<CarrierConnectionsPage />` and `<CarrierConnectionDrawer />` show draft-only unavailable state when no server integration is passed.
- **Alternative 3 (Create new Carrier API endpoints or new UI page)**: Rejected cleanly per scope rules (`Không xây dựng màn hình mới. Không tạo API endpoint mới.`).

---

## 7. Selected Design & Tactical DDD Alignment

- Pure presentation/SDK wiring in `apps/web/features/carrier-connections/` (`sync-api.ts`, `CarrierConnectionsLive.tsx`, `CarrierConnectionsPage.tsx`, `CarrierConnectionList.tsx`, `CarrierConnectionDrawer.tsx`).
- No backend Domain Aggregate, Value Object, application port, Prisma model, migration, grant, OpenAPI spec, or Worker custody changes (unless live testing uncovers an actual backend/mapping defect, which would follow Section 10 test-first diagnosis).

---

## 8. Security, Concurrency & Performance Analysis

- **Authentication & Origin**: All writes reuse `createWorkspaceApiClient()` (`apps/web/lib/api/workspace-client.ts`) through Next.js same-origin `/api/*`, automatically inheriting session cookies, browser `Origin`, and epoch-fenced `401 UNAUTHORIZED` handling. Note `400 CANNOT_CONNECT_CARRIER_ACCOUNT` / `PROVIDER_AUTH_FAILED` is displayed safely as a carrier credential/connection error without logging out the Nexora session.
- **Credential Hygiene**: Password input clears when resetting/closing, is never cached in `localStorage`/`sessionStorage`/URL/error messages, and HTTP errors map strictly to safe Vietnamese status messages (`400`, `403`, `404`, `429`, `503`) without echoing raw upstream JSON.
- **Concurrency & Cancel Safety**: In-flight flag blocks concurrent form submissions and disables dialog closing/double-click during `connect`/`reconnect`/`rename`/`remove`; read effects abort cleanly with `AbortController` and generation counters on refresh/unmount (preserving the explicit invariant that ONLY `CarrierLiveSyncDrawer.tsx` owns `setTimeout` polling).

---

## 9. Compatibility Matrix

- **API & OpenAPI Contract**: Unchanged (`pnpm contracts:check` remains clean; uses already-generated `ConnectCarrierDto`, `ReconnectCarrierDto`, `RenameConnectionDto`, `ConnectionDto`, `ConnectionDeletedDto`).
- **Database Schema & Migrations**: No new migrations authored; existing forward migrations `20261124000000_uniship_controlled_runtime` and `20261127000000_carrier_credential_purposes` applied cleanly onto existing Dev Postgres via canonical `migrate` + `db-runtime`.
- **Cross-Package Contracts**: Zero changes to `@nexora/shared`, `@nexora/sdk`, or `@nexora/ui`.

---

## 10. Test Plan (Test-First / Verification-First)

1. **Unit / Component Tests (RED -> GREEN)**:
   - Extend `apps/web/test/carrier-sync-api.test.mjs`: test `connect`, `reconnect`, `rename`, `remove` SDK path/body invocation + safe Vietnamese error mapping (`400`, `403`, `429`, `503`, and non-leaky `401` -> session handling).
   - Extend `apps/web/test/carrier-connections.test.mjs` / `carrier-sync-lifecycle.test.mjs`: verify default callback-less `CarrierConnectionDrawer` & `CarrierConnectionsPage` preserve offline draft behavior, while live handlers enable create/reconnect/rename/disconnect submissions, block duplicate submits, clear passwords, and reload connection list + sync summary.
2. **Static, Contract & Documentation Gates**:
   - `git diff --check`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm contracts:check`, `pnpm docs:check`, `pnpm preflight:check`, `pnpm --filter @nexora/web test`, plus POSIX doc/preflight tests (noting host environment limits honestly if Windows `EPERM` applies).
3. **Runtime & Live Verification (Verification-First with Owner Authorization)**:
   - Read-only Postgres/Compose/ENV audit -> owner-authorized upgrade (`migrate`, `db-runtime`, private `CARRIER_KEYRING_JSON`, `SYNC_ENABLED=false` runtime start) -> owner executes live Uniship UI Connect -> read-only verification (`CONNECTED`, external account match, encrypted secrets, default `sync_configs`, zero `sync_jobs`) -> owner-authorized `SYNC_ENABLED=true` (`MANUAL_ONLY`, blank reconciliation) -> Manual FULL sync -> sanitized job stats (`SKIPPED` / `POLICY_NOT_CONFIGURED`), Retail list/stats/detail, mapping spot-check, three-parcel warehouse timestamp check (`UTC+7 / UTC / Asia/Ho_Chi_Minh`), and optional repeat FULL.
4. **Hosted CI Gates**:
   - Exact final-HEAD `Preflight Policy & Design Governance` and `Nexora foundation` (including `Verify Carrier UI` browser harness) + `Sync V1 targeted PostgreSQL verification` if matching paths change.

---

## 11. Plan Readiness & Governance

- **Reviewed Baseline**: `f6219f2cbcc4d78de1cdc41825c2c5fcee0715e9`
- **Review Completed**: `2026-11-28`
- **Material Design Changes**: Initial `v1` plan recording the `CarrierConnectionDrawer` UI wiring defect (`PLAN ISSUE`) alongside Stage 0/Stage 1/Manual FULL runtime acceptance.
- **Owner Approval**: Code/test plan proceeds per ADR-009 without PR comment gating; actual owner-environment mutations (`.env`, migrations, live Connect, `SYNC_ENABLED=true`, Manual FULL) are gated explicitly on owner authorization and owner credential entry.

---

## 12. Unresolved PLAN ISSUES

- **PLAN ISSUE — Carrier Connection UI lifecycle wiring (`UI` defect, resolved in this plan)**: Existing `CarrierConnectionDrawer.tsx` & `CarrierConnectionsLive.tsx` have disabled draft-only Connect/Reconnect/Disconnect controls even though `@nexora/sdk` and `CarrierLifecycleController` already provide all required endpoints. Fixed minimally inside `apps/web/features/carrier-connections/` before owner live UI Connect.
- **Stage 4 & Stage 5 deferred**: Auto-hide reconciliation policies/thresholds (`Stage 4`) and `AUTOMATIC` sync scheduling (`Stage 5`) remain explicitly out of scope and `PLANNED` inside `NEXORA-068`.
