# Pre-Implementation Review & Reuse Audit — NEXORA-035

## 1. Task metadata and classification

Task ID: NEXORA-035
Classification: SIGNIFICANT
Plan revision: rev-2026-11-08-centralized-auth-carrier-error-v1
Reviewed baseline: 6a52c2ff90a1173a25053caf6fb7061b82f6b8dd
Branch: fix/centralized-workspace-authentication
Documentation Impact: REQUIRED

## 2. Requirements and boundary scope

### User Story / Problem Statement

- **Task A (Centralized Workspace Auth)**:
  Multiple workspace feature pages and custom hooks (`CustomerListPage.tsx`, `CustomerDrawers.tsx`, `useCustomerRead.ts`, `useCustomerMutation.ts`, `CarrierConnectionsLive.tsx`, `CarrierLiveSyncDrawer.tsx`) currently duplicate logic to catch `401 UNAUTHORIZED`, compute `from = sanitizeReturnUrl(...)`, and call `router.replace("/login?from=...")`.
  This duplication introduces maintenance risks, potential redirect races/loops, and forces every new workspace screen to re-implement session expiration navigation.
  _Goal_: Move session expiration handling to the Web Application Boundary (`ShellClient` / Workspace layout boundary) and observe authenticated requests via an `openapi-fetch` response middleware in a dedicated workspace API client factory (`createWorkspaceApiClient`). Features only handle local state cancellation and business domain errors.
- **Task B (Normalize Carrier Provider Authentication Error)**:
  `POST /api/carrier-connections/:id/reconnect` currently maps provider credential rejections to `HTTP 401 PROVIDER_AUTH_FAILED`. This collides with Nexora's session authentication contract (`HTTP 401 UNAUTHORIZED`).
  _Goal_: Normalize `PROVIDER_AUTH_FAILED` on reconnect to `HTTP 400 Bad Request` while preserving the exact error envelope `{ code: "PROVIDER_AUTH_FAILED", message, requestId }`, existing connection lifecycle, credential ciphertext, and security audit logging.

### In-Scope Items

1. Workspace API Client Factory (`apps/web/lib/api/workspace-client.ts`) utilizing `openapi-fetch` middleware to inspect 401 responses.
2. Workspace Auth Boundary listener & single-flight redirect coordinator (`apps/web/lib/api/workspace-auth.ts`) integrated with `ShellClient.tsx`.
3. Safe return URL derivation (`sanitizeReturnUrl()`) preserving valid query parameters without open redirects.
4. Session generation/epoch tracking to discard stale 401 responses across session transitions.
5. Removal of duplicate `router.replace("/login")` calls from Customer and Carrier feature components and hooks while strictly preserving local denial states, mutation locks, and reconciliation state machines.
6. Carrier controller mapper update in `apps/api/src/carrier/presentation/carrier-lifecycle.controller.ts` returning `HTTP 400` for provider auth failures during reconnect.
7. Synchronization of OpenAPI schemas, generated SDK (`@nexora/sdk`), contract tests, integration tests, and documentation.

### Explicit Non-Goals & Out-of-Scope Items

1. Do NOT rewrite `SessionGuard` or backend session validation.
2. Do NOT migrate sessions to `localStorage` or introduce JWTs/refresh-tokens.
3. Do NOT add automatic background session polling or silent re-authentication.
4. Do NOT redirect on `403 FORBIDDEN`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR`, or `503 SERVICE_UNAVAILABLE`.
5. Do NOT redirect on `400 PROVIDER_AUTH_FAILED` or `400 CANNOT_CONNECT_CARRIER_ACCOUNT`.
6. Do NOT attach workspace interceptors to unauthenticated flows (`LoginForm`, `SetupForm`, `public` routes).
7. Do NOT import Next.js navigation (`useRouter`) into `@nexora/sdk`. SDK remains transport-neutral.
8. Do NOT add Axios or any new HTTP libraries.
9. Do NOT modify database schemas or reset user volumes.
10. Do NOT enable Uniship Live API.

## 3. Relevant documentation and canonical owners

- **Governing ADRs**:
  - `docs/decisions/authentication.md` (ADR-004: Local authentication, session cookies, CSRF protection, SessionGuard invariants).
  - `docs/decisions/contract-ownership.md` (ADR-007: API contract ownership, OpenAPI schemas).
  - `docs/decisions/mandatory-pre-code-design-review.md` (ADR-009: Pre-code gate, reuse matrix).
- **Architecture Documentation**:
  - `docs/architecture/frontend.md`: Web application structure, App Router boundary, client/server components.
  - `docs/architecture/api-contract.md`: Endpoint inventory, error envelopes, status codes.
  - `docs/architecture/backend.md`: NestJS controllers, lifecycle mappers, guards.
- **Operations & Tasks**:
  - `docs/operations/testing.md`: Test conventions and execution standards.

## 4. Existing code references and search scope

- **Searched Directories**:
  - `apps/web/lib/api/` (Session and client utilities).
  - `apps/web/lib/auth/` (`sanitize.ts`, `host.ts`).
  - `apps/web/components/app-shell/` (`AppShell.tsx`, `ShellClient.tsx`).
  - `apps/web/features/customers/` (`api.ts`, `errors.ts`, `CustomerListPage.tsx`, `CustomerDrawers.tsx`, `useCustomerRead.ts`, `useCustomerMutation.ts`).
  - `apps/web/features/carrier-connections/` (`sync-api.ts`, `CarrierConnectionsLive.tsx`, `CarrierLiveSyncDrawer.tsx`).
  - `apps/api/src/carrier/presentation/` (`carrier-lifecycle.controller.ts`).
  - `apps/api/integration/` (`carrier-lifecycle-integration.test.cjs`).
  - `packages/sdk/src/` (`index.ts`).

- **Identified Duplicate Redirect Implementations**:
  1. `apps/web/features/customers/CustomerListPage.tsx:138` and `296`
  2. `apps/web/features/customers/CustomerDrawers.tsx:211`
  3. `apps/web/features/customers/useCustomerRead.ts:96`
  4. `apps/web/features/customers/useCustomerMutation.ts:169`
  5. `apps/web/features/carrier-connections/CarrierConnectionsLive.tsx:34`
  6. `apps/web/features/carrier-connections/CarrierLiveSyncDrawer.tsx:53`

## 5. Mandatory reuse and design audit matrix

| Field                        | Component 1: Workspace Auth Interceptor & Boundary                                                                                                 | Component 2: Carrier Reconnect Error Normalization                                                                              | Component 3: Safe Return URL & Fencing                                                                  |
| :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| **Component proposed**       | `createWorkspaceApiClient` + `workspace-auth.ts` coordinator                                                                                       | HTTP 400 mapper in `CarrierLifecycleController`                                                                                 | `computeSafeLoginRedirect` with session epoch fencing                                                   |
| **Existing implementations** | `createNexoraClient` in `@nexora/sdk`; `ShellClient.tsx` in `apps/web/components/app-shell/`                                                       | `carrier-lifecycle.controller.ts:98` maps `auth` to 401                                                                         | `sanitizeReturnUrl` in `apps/web/lib/auth/sanitize.ts`                                                  |
| **Domain owner**             | Web Application Shell / Workspace boundary                                                                                                         | Carrier Presentation / Public API Contract                                                                                      | Shared Auth Primitives                                                                                  |
| **Reuse alternatives**       | 1. Custom fetch wrapper.<br>2. React Query error boundary.<br>3. `openapi-fetch` native middleware + module coordinator.                           | 1. Separate error envelope.<br>2. Keep 401 and add query flag.<br>3. Change status 401->400 in existing mapper.                 | 1. Store return URL in sessionStorage.<br>2. Reuse `sanitizeReturnUrl` + location query.                |
| **Selected approach**        | `openapi-fetch` middleware attached to `createWorkspaceApiClient()`, notifying a lightweight singleton coordinator registered in `ShellClient`.    | Change `status = 401` to `status = 400` for `auth` failures during reconnect; keep code `PROVIDER_AUTH_FAILED`.                 | Reuse existing `sanitizeReturnUrl`, append URL-encoded `from` param, track session epoch.               |
| **Rationale**                | Reuses built-in `client.use()` middleware in `openapi-fetch` (v0.17.0). Zero extra libraries, preserves all TypeScript typings and test injection. | Aligns carrier provider error with client error classification (Bad Request credentials). Unblocks clean 401 session semantics. | Established, tested sanitization prevents open redirects without introducing client-side storage state. |
| **Risks**                    | Concurrent 401s triggering repeated router calls; stale responses from prior sessions causing false logouts.                                       | Existing tests expecting 401 failing until updated; SDK consumers affected.                                                     | Overly aggressive sanitization losing legitimate query parameters (e.g. `?page=2`).                     |
| **Verification plan**        | Unit tests in `workspace-auth.test.mjs` verifying single redirect, epoch filtering, concurrent 401 handling, and return URL.                       | Integration test in `carrier-lifecycle-integration.test.cjs` asserting HTTP 400 and `PROVIDER_AUTH_FAILED`.                     | Regression tests validating query strings (`/customers?page=2`) and open redirect rejections.           |

## 6. Alternative designs and trade-offs

- **Alternative 1: Axios / Custom Fetch Wrapper**:
  - _Trade-off / Rejected_: Would discard `@nexora/sdk` and `openapi-fetch` type safety, violate repository dependency rules, and duplicate request serialization.
- **Alternative 2: React Context Provider for Every API Call**:
  - _Trade-off / Rejected_: Feature API modules (`customerApi`, `syncApi`) are exported singletons or factory-created utilities outside the React component tree. A context-only client would require rewiring all callers through hooks (`useCustomerApi()`), adding unnecessary React churn without architectural benefit.
- **Alternative 3: Global Window Event (`window.dispatchEvent`)**:
  - _Trade-off / Rejected_: Untyped, difficult to test in isolated Node/harness environments, and prone to memory leaks. A dedicated typed coordinator with explicit registration/cleanup is much cleaner.

## 7. Selected design and Tactical DDD alignment

### Architectural Layers & Boundaries

1. **API Client Layer (`apps/web/lib/api/workspace-client.ts`)**:
   - Creates authenticated client via `createNexoraClient()`.
   - Attaches `openapi-fetch` middleware:
     - `onRequest`: tags request with current session epoch.
     - `onResponse`: on `status === 401`, clones response, checks `json.code === "UNAUTHORIZED"`, and if matched, invokes `notifySessionExpired(requestEpoch)`.
2. **Workspace Auth Coordinator (`apps/web/lib/api/workspace-auth.ts`)**:
   - Manages active session epoch (incremented on registration/remount).
   - Manages single-flight redirect state (`isRedirecting = true`).
   - Discards stale requests where `requestEpoch !== currentEpoch`.
   - Dispatches safe navigation target to registered boundary handler.
3. **Workspace Boundary (`apps/web/components/app-shell/ShellClient.tsx`)**:
   - Registers callback on mount; cleans up on unmount.
   - On expiration event: sets `isSessionExpired = true` (masks workspace, prevents protected clicks) and invokes `router.replace(target)`.
4. **Feature Layer Refactoring**:
   - Feature API modules (`apps/web/features/customers/api.ts`, `apps/web/features/carrier-connections/sync-api.ts`) default to `createWorkspaceApiClient()`.
   - Duplicate `router.replace` calls removed from feature components and hooks.
   - Local state invariants (e.g. `read.deny()`, `power.current.reject()`, `recoveryLock`, `writeUnresolvedScope`, `onDenied`) are strictly preserved.
5. **Backend Carrier Lifecycle (`apps/api/src/carrier/presentation/carrier-lifecycle.controller.ts`)**:
   - Reconnect mapping: `if (auth) { status = 400; code = "PROVIDER_AUTH_FAILED"; }`.
   - Reconnect unauthorized session: `if (error.code === LifecycleCode.UNAUTHORIZED) { status = 401; code = "UNAUTHORIZED"; }`.

Tactical DDD Boundaries & Invariants:

- Preserves Identity and Carrier domain aggregate boundaries.
- Preserves Customer Aggregate consistency boundary, optimistic updates, and reconciliation invariants.
- No business logic or entity state is modified; changes are strictly confined to presentation mappers and client transport boundaries.

## 8. Security, concurrency and performance analysis

- **Authorization Invariant**:
  - `SessionGuard` continues to protect all backend endpoints and returns `401 UNAUTHORIZED`.
  - OriginGuard continues to enforce CSRF protection on mutation endpoints.
- **Open Redirect Prevention**:
  - All return URLs pass through `sanitizeReturnUrl()`. Unsafe targets (`https://evil.com`, `//evil.com`, `/\\evil.com`) resolve strictly to `/login`.
- **Concurrency & Idempotence**:
  - Multiple concurrent requests returning 401 (e.g. parallel Customer + Carrier + Sync calls) trigger `notifySessionExpired()` simultaneously. The single-flight latch ensures only one `router.replace` is executed.
- **Session Lifecycle Fencing**:
  - In-flight requests belonging to an old session epoch cannot trigger logout after a user transition.
- **Non-Destructive Body Inspection**:
  - Middleware clones the response (`response.clone()`) before reading JSON so that downstream caller error parsing receives an unconsumed body.

## 9. Compatibility matrix

- **API & OpenAPI Contract**:
  - Reconnect endpoint `POST /api/carrier-connections/{id}/reconnect` returns `400` with `PROVIDER_AUTH_FAILED`.
  - OpenAPI spec (`apps/api/openapi/openapi.json`) and SDK schemas regenerated cleanly.
- **Database Schema**: Zero schema migrations; runtime database remains untouched.
- **Backward Compatibility**:
  - Custom API clients and base URLs remain injectable in tests (`createCustomerApi(mockClient)`).

## 10. Mitigation strategies

| Risk                                            | Mitigation                                                                 |
| :---------------------------------------------- | :------------------------------------------------------------------------- |
| Non-JSON 401 response breaking parser           | `response.clone().json().catch(() => null)` fails safely without throwing. |
| Stale request after logout logging out new user | Session epoch fencing discards responses where `epoch !== currentEpoch`.   |
| Concurrent 401s triggering navigation race      | Single-flight latch (`isRedirecting`) guarantees at most one redirect.     |
| Feature losing error message details            | Feature local catch blocks retain error objects and error classification.  |

## 11. Test-first implementation and verification plan

### Test Inventory

1. **Case 1: Customer session expired (401 UNAUTHORIZED)**: Global boundary triggers redirect to `/login?from=%2Fcustomers`, no local redirect logic in page.
2. **Case 2: Carrier session expired (401 UNAUTHORIZED)**: Global boundary triggers redirect to `/login?from=%2Fsettings%2Fcarrier-connections`.
3. **Case 3: Concurrent 401**: 3 simultaneous 401 UNAUTHORIZED responses cause exactly one `router.replace` call.
4. **Case 4: Provider auth failure (400 PROVIDER_AUTH_FAILED)**: Reconnect failure does NOT trigger session expiration; Carrier UI displays local error.
5. **Case 5: MFA/Login errors (401 AUTHENTICATION_FAILED / MFA_VERIFICATION_FAILED)**: Does not trigger workspace session expired handler.
6. **Case 6: 403 FORBIDDEN**: Does not trigger redirect.
7. **Case 7: 503 / Network Failure**: Does not trigger redirect.
8. **Case 8: Malformed error body**: Non-JSON 401 or missing code does not infer session expiration.
9. **Case 9: Safe return URL**: Verifies `/customers`, `/customers?page=2`, unsafe external URLs, protocol-relative paths.
10. **Case 10: Stale requests**: Old request returning 401 after session transition is discarded.
11. **Case 11: Customer mutation reconciliation**: Validates that denial states, optimistic updates, and write locks remain intact.
12. **Case 12: Existing SDK clients**: Confirms test client injection in `createCustomerApi` and `createSyncApi`.
13. **Carrier HTTP integration test**: Validates that reconnect with invalid credentials returns `400 Bad Request` and `PROVIDER_AUTH_FAILED`.

## 12. Plan reference and pre-code gate attestation

This document constitutes the pre-code design review and reuse audit mandated by ADR-009 for task `NEXORA-035`.
Inspection is complete, boundaries are verified, and implementation proceeds strictly according to this plan.
