# NEXORA-035 — Centralized Workspace Authentication & Carrier Error Contract

Status: COMPLETED
Implementation: IMPLEMENTED
Verification: VERIFIED

## Scope

Centralize workspace session expiration handling at Web Application Boundary and normalize Carrier reconnect provider authentication error to HTTP 400.
Baseline: 6a52c2ff90a1173a25053caf6fb7061b82f6b8dd.
Branch: fix/centralized-workspace-authentication. No auto-merge or deployment authorized.

## Design Review & Reuse Decision

Task ID: NEXORA-035
Classification: SIGNIFICANT
Plan revision: rev-2026-11-08-centralized-auth-carrier-error-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-035-rev-2026-11-08-centralized-auth-carrier-error-v1.md
Design SHA-256: 8d7906b0fdf19ceb2c9a10c1f3818e7371f477517511ad112739768d12acfb4e
Reviewed baseline: 6a52c2ff90a1173a25053caf6fb7061b82f6b8dd

Read-only inventory, eight-field reuse matrix, domain ownership, alternatives,
contracts, security/fencing, and test plan are recorded in the snapshot. Pre-implementation-review skill applied.
No owner approval gate under current ADR-009.

| Component                             | Existing implementations                                                                     | Domain owner                      | Reuse alternatives                       | Selected approach                                                                                   | Rationale                                                                           | Risks                            | Verification                                                      |
| :------------------------------------ | :------------------------------------------------------------------------------------------- | :-------------------------------- | :--------------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- | :------------------------------- | :---------------------------------------------------------------- |
| Workspace Auth Interceptor & Boundary | `createNexoraClient` in `@nexora/sdk`; `ShellClient.tsx` in `apps/web/components/app-shell/` | Web Shell / Workspace Boundary    | Custom fetch vs openapi-fetch middleware | `createWorkspaceApiClient` using `openapi-fetch` middleware + `workspace-auth.ts` coordinator       | Zero extra dependencies, full SDK type safety, single-flight navigation             | Concurrent 401s, stale responses | Targeted unit tests covering 12 cases                             |
| Carrier Reconnect Error Normalization | `carrier-lifecycle.controller.ts:98` maps `auth` to 401                                      | Carrier Presentation / Public API | Separate envelope vs status change       | Change `status = 401` to `status = 400` for provider auth failure; keep code `PROVIDER_AUTH_FAILED` | Unambiguous separation between session failure (401) and provider credentials (400) | SDK/test expectations            | Controller tests, contract checks, integration tests              |
| Safe Return URL & Fencing             | `sanitizeReturnUrl` in `apps/web/lib/auth/sanitize.ts`                                       | Auth Common                       | SessionStorage vs query parameter        | Pure `sanitizeReturnUrl()` with URL-encoded `from` param + session epoch tracking                   | Prevents open redirects, maintains state across query strings                       | Query loss                       | URL sanitization unit tests with unsafe/protocol-relative targets |

Tactical DDD Boundaries:
Presentation-only over existing Identity, Carrier, and Customer contracts.
Customer Aggregate root, consistency boundary, optimistic updates, and reconciliation invariants are strictly preserved.
Backend owns Carrier provider lifecycle and credentials; UI only renders SDK-derived labels and local unsaved drafts.
No business domain Aggregate, Value Objects, or transactional persistence is altered.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Workspace session expiration handling moved to Web Application Boundary via openapi-fetch middleware in createWorkspaceApiClient.
- POST /api/carrier-connections/:id/reconnect returns HTTP 400 with code PROVIDER_AUTH_FAILED instead of HTTP 401.

### Canonical owners

- `docs/architecture/frontend.md`
- `docs/architecture/api-contract.md`
- `docs/architecture/backend.md`
- `docs/decisions/authentication.md`

### Documentation verification

- Documentation links and error contracts verified via `pnpm docs:check` and `pnpm contracts:check`.

## Milestones

### Implementation Plan

- [x] M1: Implement `workspace-auth.ts` coordinator (single-flight redirect, session epoch fencing, safe return URL calculation) and `workspace-client.ts` (`openapi-fetch` middleware detecting `401 UNAUTHORIZED`).
- [x] M2: Attach workspace auth boundary to `ShellClient.tsx` to handle session expiration, mask sensitive workspace content (`role="alert"`), and perform single safe redirect to `/login`.
- [x] M3: Update `POST /api/carrier-connections/:id/reconnect` in `carrier-lifecycle.controller.ts` to return HTTP 400 for `PROVIDER_AUTH_FAILED`; update contract tests and regenerate SDK.
- [x] M4: Refactor Customer and Carrier feature callers (`CustomerListPage.tsx`, `CustomerDrawers.tsx`, `useCustomerRead.ts`, `useCustomerMutation.ts`, `CarrierConnectionsLive.tsx`, `CarrierLiveSyncDrawer.tsx`) to remove duplicate `router.replace` calls while preserving all local denial/cancellation logic.
- [x] M5: Implement comprehensive regression test suite (15 cases) using real disposable HTTP transport server, genuine openapi-fetch pipeline, non-destructive cloning, Strict Mode remount buffering, and epoch fail-closed fencing.
- [x] M6: Resolve early-request boundary ordering race (F1), formalize session generation lifecycle guarantees and documented boundaries (F2), and add genuine in-page session expiration browser smoke test (F3).

## Review Rounds

### Review 1: Correctness & Reuse

- Centralized auth coordinator (`workspace-auth.ts`) reuses existing `sanitizeReturnUrl` from `apps/web/lib/auth/sanitize.ts` and exports pure calculation functions without hardcoded assumptions.
- Client factory (`workspace-client.ts`) attaches non-destructive response observer middleware through `openapi-fetch` client from `@nexora/sdk`, preserving all HTTP response properties, clone streams, and error body types.
- Early request generation ordering resolved: `getCurrentSessionEpoch()` ensures active session generation (epoch >= 1) immediately on demand, while boundary mount binds `userId` without bumping epoch, preventing false stale fencing of child requests.
- Carrier reconnect controller maps provider auth rejections strictly to HTTP 400 `PROVIDER_AUTH_FAILED`, leaving Nexora session 401 `UNAUTHORIZED` untouched.
- Verdict: APPROVED

### Review 2: Security & Concurrency

- Single-flight navigation lock ensures that concurrent 401 responses trigger exactly one redirect to `/login`.
- Monotonic session epochs (`getCurrentSessionEpoch`) fence against stale 401 responses from past sessions logging out active new sessions.
- Return URL is strictly validated via `sanitizeReturnUrl`, preventing open-redirect attacks (`//`, `/\`, `javascript:`).
- Customer aggregate reconciliation invariants (`read.deny()`, `onDenied()`, `power.reject()`, locks) and Carrier credential ciphertext encryption remain completely intact.
- F1/F2/F3 review findings addressed: genuine openapi-fetch pipeline tested via disposable Node HTTP server (20 cases), early requests tracked, Strict Mode remount preserves session epoch, buffered unmount expirations dispatch on remount, and missing/invalid epochs fail closed.
- Real in-page session expiration browser smoke (`IN_PAGE_WORKSPACE_SESSION_EXPIRATION`) added to `scripts/browser-login-smoke.mjs` verifying backend revocation, UI interaction trigger, `role="alert"` masking notice, and safe single-flight navigation to `/login?from=%2Fcustomers%3Fpage%3D2`.
- Verdict: APPROVED

### Review 3: Final Verification & PR Readiness

- All 20 test cases in `apps/web/test/workspace-auth.test.mjs` pass via genuine HTTP requests.
- All 7 carrier sync lifecycle tests in `apps/web/test/carrier-sync-lifecycle.test.mjs` pass.
- All 43 customer UI model and mutation reconciliation tests pass.
- All 40 unit tests in `apps/api/test/carrier-lifecycle.test.cjs` pass.
- All 19 integration tests in `apps/api/integration/carrier-lifecycle-integration.test.cjs` pass in Docker.
- Historical CI checkpoints preserved (Runs 42478180082, 42478180153). Passing hosted CI runs recorded (Runs 42494331975, 42494331836, 42495993554, 42495993621).
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm contracts:check`, `pnpm docs:check`, `pnpm preflight:check` all pass locally.
- Verdict: APPROVED

## Evidence

| Claim                                                  | Evidence                                                                                                                                              | Date       | Result |
| :----------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Pre-code design review recorded and preflight passed   | `pnpm preflight:check; pnpm docs:check`                                                                                                               | 2026-11-08 | PASS   |
| Workspace auth boundary & coordinator suite (20 cases) | `node --test apps/web/test/workspace-auth.test.mjs`                                                                                                   | 2026-11-09 | PASS   |
| Customer UI model & mutation reconciliation regression | `node --test apps/web/test/customer-ui-model.test.mjs apps/web/test/customer-mutation-reconciliation.test.mjs apps/web/test/auth-frontend.test.mjs`   | 2026-11-09 | PASS   |
| Carrier sync lifecycle caller refactoring              | `node --test apps/web/test/carrier-sync-lifecycle.test.mjs`                                                                                           | 2026-11-09 | PASS   |
| Carrier lifecycle unit tests (40 cases)                | `node --test apps/api/test/carrier-lifecycle.test.cjs`                                                                                                | 2026-11-09 | PASS   |
| Carrier lifecycle PostgreSQL integration in Docker     | `docker compose -f compose.yml -f compose.dev.yml run --rm -T quality sh -c "cd apps/api && node integration/carrier-lifecycle-integration.test.cjs"` | 2026-11-09 | PASS   |
| Contracts reproducibility check                        | `pnpm contracts:check`                                                                                                                                | 2026-11-09 | PASS   |
| Documentation policy and task integrity check          | `pnpm docs:check`                                                                                                                                     | 2026-11-09 | PASS   |
| Preflight governance and duplicate guards              | `pnpm preflight:check`                                                                                                                                | 2026-11-09 | PASS   |
| Workspace boundary and linting check                   | `pnpm lint`                                                                                                                                           | 2026-11-09 | PASS   |
| Full monorepo TypeScript verification                  | `pnpm typecheck`                                                                                                                                      | 2026-11-09 | PASS   |
| Hosted CI Preflight Checkpoint (Run 42478180082)       | PR description lacked parser-compliant metadata block. Resolved via PR body update.                                                                   | 2026-11-08 | FAIL   |
| Hosted CI Foundation Checkpoint (Run 42478180153)      | Carrier viewport matrix navigation timing race on second-operator. Resolved via clean-slate modal fence.                                              | 2026-11-08 | FAIL   |
| Hosted CI Preflight Governance (Run 42494331975)       | GitHub Actions PR metadata and preflight deterministic checks verified on commit `ea860db`.                                                           | 2026-11-08 | PASS   |
| Hosted CI Docker Foundation Smoke (Run 42494331836)    | Full Docker quality, integration, TTY, browser matrices (M1, Customer, Retail M3, Account, Carrier 6-viewport), HTTPS, DB persistence, and HMR smoke. | 2026-11-08 | PASS   |
| Hosted CI Preflight Governance (Run 42495993554)       | Verified on PR HEAD commit `6d9a8b2766bd6a0b08f0b8cb0a1cdcfe80d0bb6f`.                                                                                | 2026-11-08 | PASS   |
| Hosted CI Docker Foundation Smoke (Run 42495993621)    | Verified on PR HEAD commit `6d9a8b2766bd6a0b08f0b8cb0a1cdcfe80d0bb6f` in 15m42s.                                                                      | 2026-11-08 | PASS   |
| Hosted CI Preflight Governance (Run 42544342863)       | Verified on final PR HEAD commit `2c9baed` in 10s.                                                                                                    | 2026-11-09 | PASS   |
| Hosted CI Docker Foundation Smoke (Run 42544342722)    | Full Docker quality, integration, and real in-page session expiration browser smoke verified on commit `2c9baed` in 17m26s.                           | 2026-11-09 | PASS   |

## Closure — 2026-11-12

Delivered by PR #35. Already VERIFIED.

| Claim          | Evidence                                                           | Date       | Result |
| -------------- | ------------------------------------------------------------------ | ---------- | ------ |
| Merged to main | PR #35, merge 8a427da2b916fdbb928aa6bd06d22792e23f8dbf, 2026-11-09 | 2026-11-12 | PASS   |
