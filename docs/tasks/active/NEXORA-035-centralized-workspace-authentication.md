# NEXORA-035 — Centralized Workspace Authentication & Carrier Error Contract

Status: VERIFICATION PENDING
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
- [x] M2: Attach workspace auth boundary to `ShellClient.tsx` to handle session expiration, mask sensitive workspace content, and perform single safe redirect to `/login`.
- [x] M3: Update `POST /api/carrier-connections/:id/reconnect` in `carrier-lifecycle.controller.ts` to return HTTP 400 for `PROVIDER_AUTH_FAILED`; update contract tests and regenerate SDK.
- [x] M4: Refactor Customer and Carrier feature callers (`CustomerListPage.tsx`, `CustomerDrawers.tsx`, `useCustomerRead.ts`, `useCustomerMutation.ts`, `CarrierConnectionsLive.tsx`, `CarrierLiveSyncDrawer.tsx`) to remove duplicate `router.replace` calls while preserving all local denial/cancellation logic.
- [x] M5: Implement comprehensive regression test suite (12 required cases) covering Customer/Carrier session expiration, concurrent 401s, provider auth failure, safe return URL, stale requests, and contract verification.

## Review Rounds

### Review 1: Correctness & Reuse

- Centralized auth coordinator (`workspace-auth.ts`) reuses existing `sanitizeReturnUrl` from `apps/web/lib/auth/sanitize.ts` and exports pure calculation functions without hardcoded assumptions.
- Client factory (`workspace-client.ts`) attaches non-destructive response observer middleware through `openapi-fetch` client from `@nexora/sdk`, preserving all HTTP response properties, clone streams, and error body types.
- Carrier reconnect controller maps provider auth rejections strictly to HTTP 400 `PROVIDER_AUTH_FAILED`, leaving Nexora session 401 `UNAUTHORIZED` untouched.
- Verdict: APPROVED

### Review 2: Security & Concurrency

- Single-flight navigation lock ensures that concurrent 401 responses trigger exactly one redirect to `/login`.
- Monotonic session epochs (`getCurrentSessionEpoch`) fence against stale 401 responses from past sessions logging out active new sessions.
- Return URL is strictly validated via `sanitizeReturnUrl`, preventing open-redirect attacks (`//`, `/\`, `javascript:`).
- Customer aggregate reconciliation invariants (`read.deny()`, `onDenied()`, `power.reject()`, locks) and Carrier credential ciphertext encryption remain completely intact.
- Verdict: APPROVED

### Review 3: Final Verification & PR Readiness

- All 12 test cases in `apps/web/test/workspace-auth.test.mjs` pass.
- All 7 carrier sync lifecycle tests in `apps/web/test/carrier-sync-lifecycle.test.mjs` pass.
- All 40 unit tests in `apps/api/test/carrier-lifecycle.test.cjs` pass.
- All 19 integration tests in `apps/api/integration/carrier-lifecycle-integration.test.cjs` pass in Docker.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm contracts:check`, `pnpm docs:check`, `pnpm preflight:check` all pass.
- Verdict: APPROVED

## Evidence

| Claim                                                  | Evidence                                                                                                                                            | Date       | Result |
| :----------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Pre-code design review recorded and preflight passed   | `pnpm preflight:check; pnpm docs:check`                                                                                                             | 2026-11-08 | PASS   |
| Workspace auth boundary & coordinator suite (12 cases) | `node --test apps/web/test/workspace-auth.test.mjs`                                                                                                 | 2026-11-08 | PASS   |
| Customer UI model & mutation reconciliation regression | `node --test apps/web/test/customer-ui-model.test.mjs apps/web/test/customer-mutation-reconciliation.test.mjs apps/web/test/auth-frontend.test.mjs` | 2026-11-08 | PASS   |
| Carrier sync lifecycle caller refactoring              | `node --test apps/web/test/carrier-sync-lifecycle.test.mjs`                                                                                         | 2026-11-08 | PASS   |
| Carrier lifecycle unit tests (40 cases)                | `node --test apps/api/test/carrier-lifecycle.test.cjs`                                                                                              | 2026-11-08 | PASS   |
| Carrier lifecycle PostgreSQL integration in Docker     | `docker compose run quality cd apps/api && node integration/carrier-lifecycle-integration.test.cjs`                                                 | 2026-11-08 | PASS   |
| Contracts reproducibility check                        | `pnpm contracts:check`                                                                                                                              | 2026-11-08 | PASS   |
| Documentation policy and task integrity check          | `pnpm docs:check`                                                                                                                                   | 2026-11-08 | PASS   |
| Preflight governance and duplicate guards              | `pnpm preflight:check`                                                                                                                              | 2026-11-08 | PASS   |
| Workspace boundary and linting check                   | `pnpm lint`                                                                                                                                         | 2026-11-08 | PASS   |
| Full monorepo TypeScript verification                  | `pnpm typecheck`                                                                                                                                    | 2026-11-08 | PASS   |
