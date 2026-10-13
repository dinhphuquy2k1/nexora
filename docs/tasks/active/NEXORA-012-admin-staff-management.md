# Task: NEXORA-012 — SQL-Based Uniship Identity & Login Foundation

- **Task ID**: `NEXORA-012`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`
- **Classification**: SIGNIFICANT

## Predecessor baseline and verification preflight

Baseline commit: `f0f54f58c7578dd9dd86fecbd6534e26a4c044cb` (merged PR #9 on main).
PR #9 final head commit `1e434d63093bfee366570c3c6e342062e2f22179` passed hosted GitHub Actions workflow run `38232652011` (12m25s) across all foundation jobs (quality, migration, integration, runtime smoke, PR #7/current/pre-auth backup/restore smoke, dev smoke).
Merge commit `f0f54f58c7578dd9dd86fecbd6534e26a4c044cb` push workflow run `38242823228` passed on main (16m38s).
NEXORA-011 was formally closed as `COMPLETED` / `VERIFIED` and moved to `docs/tasks/completed/NEXORA-011-unified-identity-migration.md` in commit `3752aa8` on main.
Worktree branch: `feat/admin-staff-management`.
Target PR: [#10](https://github.com/dinhphuquy2k1/nexora/pull/10).

## Owner-Approved Implementation Sequence

Following initial investigation into Uniship identity semantics, the repository owner adjusted the delivery sequence for NEXORA-012:

- **Uniship `userid`**: Treated as a permanent identity identifier for this application integration plan.
- **Acquisition**: Admin will manually obtain and enter the `userid`.
- **Registration**: Initially executed via SQL script, not a browser interface or HTTP endpoint.
- **Reassignment**: Questions regarding future `userid` reassignment are not blockers for this initial milestone.
- **Priority**: Fast, testable Login foundation is the immediate priority.
- **Authorization (2026-10-13)**: The owner confirms Uniship API integration permission exists and approves `userid` identity binding. Missing permission is no longer a blocker. This does not establish unrecorded token/profile/shipment retention terms.
- **Operational Enablement**: The administrator selects the correct `UNISHIP_API_URL` and may explicitly enable `UNISHIP_LIVE_AUTHORIZED` under the approved authorization and deployment procedure; default `false` remains. No destination allowlist or hardcoded production URL is required.
- **Verification Distinction**: Local HTTP mock-provider evidence proves the tested foundation, not successful authentication against the real Uniship service.

### Immediate Scope (Implemented in this Milestone)

1. **External Identity Schema**: `ExternalIdentity` model in `packages/database/prisma/schema.prisma` mapping to `external_identities` table.
2. **Committed Migration**: `20261012020000_external_identities` adding foreign key cascade to `users(id)`, compound unique constraints, provider check constraint (`uniship`), and subject format check constraint.
3. **Manual SQL Operator Registration**: `scripts/sql/register-uniship-operator.sql` executing an atomic transaction with input validation, `gen_random_uuid()` generation, and creation of `users` (`role = 'OPERATOR'`, `status = 'ACTIVE'`) plus `external_identities` with zero rows in `user_credentials`.
4. **Unique Provider Binding**: PostgreSQL compound unique constraint `(provider, provider_subject)` preventing duplicate bindings across users, and `(user_id, provider)` preventing multiple provider identities per user.
5. **Provider Authentication Port**: `ProviderAuthenticationPort` in `apps/api/src/identity/application/provider-auth.port.ts` specifying server-side provider identity verification.
6. **Provider Infrastructure Adapter**: `UnishipAuthAdapter` in `apps/api/src/identity/infrastructure/uniship-auth.adapter.ts` sending credentials only to configured `UNISHIP_API_URL`, with explicit 5-second timeout, redirect rejection (`redirect: "error"`), production HTTPS enforcement, error sanitization, and operational gating (`UNISHIP_LIVE_AUTHORIZED`).
7. **Employee Login Application Service**: `AuthService.loginWithProvider(username, password)` applying admission rate limiting (keyed by `provider:${username}` to isolate from local admin lockouts), calling provider authentication, and delegating to `AuthService.authenticateExternalIdentity()`.
8. **Employee Login HTTP Endpoint**: `POST /api/auth/provider/login` in `AuthController` with `OriginGuard`, `ProviderLoginRequestDto`, uniform 401 `AUTHENTICATION_FAILED` on invalid/unregistered/disabled/non-operator identities, and safe `nexora_session` cookie issuance.
9. **Frontend Login Mode Split**:
   - `/login`: Default employee login mode calling `/api/auth/provider/login`.
   - `/login?mode=admin`: Local admin login mode calling `/api/auth/login`.
   - Accessible toggle link between modes with return URL preservation (`sanitizeReturnUrl`).
10. **OpenAPI & SDK Synchronization**: Regenerated OpenAPI specification and `@nexora/sdk` TypeScript client via `pnpm contracts:generate`.
11. **Local HTTP Mock-Provider Integration Tests**: Automated tests against isolated local mock provider and real disposable PostgreSQL verifying valid operator login, session cookie attributes, protected session access, logout revocation, invalid credentials, unregistered userid, disabled operator, redirect rejection, timeouts, and admin password isolation.
12. **Browser End-to-End Smoke Tests**: `scripts/browser-login-smoke.mjs` extended to verify employee mode rendering, provider route target, safe failure display, mode switch, and independent admin login.

### Explicitly Deferred & Gated Scope

- **Live Uniship Technical Verification**: DEFERRED until executable real-provider evidence exists. API integration permission is confirmed; the operational switch defaults to `UNISHIP_LIVE_AUTHORIZED=false` and is not enabled by tests.
- **Admin Staff Management UI** (`/admin/users`) & Staff CRUD APIs: DEFERRED per owner instructions.
- **Real Provider Token Persistence**: DEFERRED.
- **Internet Ingress / HTTPS Production Hosting**: DEFERRED to Phase 3.

---

## Database Architecture & Migration

### Schema Model

```prisma
model ExternalIdentity {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  provider        String   @db.VarChar(32)
  providerSubject String   @map("provider_subject") @db.VarChar(128)
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerSubject])
  @@unique([userId, provider])
  @@index([userId])
  @@map("external_identities")
}
```

### Migration: `20261012020000_external_identities`

- Forward-only committed SQL migration.
- Preserves all existing `users`, `user_credentials`, and `sessions` data.
- Includes SQL constraints:
  - `chk_external_identities_provider`: `CHECK (provider IN ('uniship'))`
  - `chk_external_identities_subject_format`: `CHECK (LENGTH(TRIM(provider_subject)) > 0 AND provider_subject = TRIM(provider_subject))`
  - Foreign key `fk_external_identities_user_id` referencing `users(id)` ON DELETE CASCADE.
  - Unique index `external_identities_provider_provider_subject_key`.
  - Unique index `external_identities_user_id_provider_key`.

---

## Manual SQL Operator Registration Instructions

Authorized database administrators execute manual operator registration using `scripts/sql/register-uniship-operator.sql`:

```sh
# Example registration command via psql
psql -X -v ON_ERROR_STOP=1 -v username="operator_nam" -v uniship_userid="10482" -f scripts/sql/register-uniship-operator.sql "$DATABASE_URL"
```

### Operational Behavior:

1. **Transaction Atomicity**: Enclosed in a single transaction block (`BEGIN ... COMMIT`).
2. **Preflight Validation**:
   - Rejects empty, whitespace-only, or untrimmed usernames.
   - Enforces username length between 3 and 50 characters.
   - Rejects empty, whitespace-only, or untrimmed `uniship_userid`.
   - Enforces `uniship_userid` length between 1 and 128 characters.
   - Checks if `username` is already taken in `users`.
   - Checks if `uniship_userid` is already bound to another user for provider `'uniship'`.
3. **Execution**:
   - Generates a UUID via PostgreSQL `gen_random_uuid()`.
   - Inserts row into `users` (`role = 'OPERATOR'`, `status = 'ACTIVE'`).
   - Inserts row into `external_identities` (`provider = 'uniship'`, `provider_subject = uniship_userid`).
   - Inserts **zero** rows into `user_credentials`.
4. **Concurrency Safety**: Database unique constraints (`users_username_key` and `external_identities_provider_provider_subject_key`) serve as the authoritative final defense against concurrent duplicate registrations.
5. **Inspection & Verification**:
   ```sql
   SELECT u.id, u.username, u.role, u.status, e.provider, e.provider_subject
   FROM users u
   JOIN external_identities e ON e.user_id = u.id
   WHERE u.username = 'operator_nam';
   ```

---

## Server-Side Authentication Boundary

The authentication architecture maintains strict separation between external provider identity claims and Nexora session issuance:

```
[Implemented Server-Side Provider Adapter]
       │
       ▼ (Server-side verified identity payload)
{ provider: 'uniship', providerSubject: '10482' }
       │
       ▼
AuthService.authenticateExternalIdentity(verified)
       │
       ├─► Check provider === 'uniship' & valid trimmed providerSubject
       ├─► Port: findExternalIdentity(provider, providerSubject)
       ├─► Assert linked user exists
       ├─► Assert user.role === 'OPERATOR' (ADMINs cannot authenticate via operator provider flow)
       ├─► Assert user.status === 'ACTIVE'
       ▼
Issue Opaque Nexora Session (32 random bytes -> SHA-256 hash in PostgreSQL -> 7-day TTL)
       ▼
SessionGuard / validateSession validates opaque session
```

### Critical Security Boundaries

- **No Unauthenticated Provider Endpoint**: No public endpoint accepts raw `userid` without an authentic server-side provider verification adapter.
- **Uniform Failure Policy**: Missing identities, disabled users, admin accounts, or malformed payloads all return HTTP 401 `AUTHENTICATION_FAILED` with the exact Vietnamese message: `"Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập."`
- **Zero Operator Credentials**: Operators never possess passwords or entries in `user_credentials`, preventing local password login.
- **Admin Password Isolation**: Local password login requires `ADMIN` role, `ACTIVE` status, and valid Scrypt password hash. Operators attempting local password login fail with 401.

---

## Acceptance Criteria

1. **Database Schema & Migration**: `external_identities` exists via a committed forward-only Prisma migration without altering Phase 1 tables or data.
2. **Atomic SQL Registration**: Manual SQL script atomically creates an `ACTIVE` `OPERATOR` user and Uniship binding with 0 credentials.
3. **Constraint Enforcement**: PostgreSQL uniqueness prevents duplicate `(provider, provider_subject)` and duplicate `(user_id, provider)`.
4. **Server-Side Session Issuance**: Sessions are issued only to server-verified external identities linked to active operators.
5. **Uniform Failure Policy**: Disallowed, unknown, disabled, or malformed provider authentication requests receive uniform 401 `AUTHENTICATION_FAILED`.
6. **Local ADMIN Isolation**: Local password login remains restricted to `ACTIVE` `ADMIN` users with Scrypt credentials. Operators cannot use password login.
7. **SessionGuard Interoperability**: Generic `SessionGuard` validates sessions issued to operators identically to admin sessions.
8. **Backup / Restore Continuity**: External identities survive database restarts and backup/restore procedures.
9. **No Unauthorized Scope**: No Admin UI, staff CRUD APIs, or live calls to `kh.uniship.vn` are introduced.

---

## Documentation Impact

Documentation Impact: REQUIRED

### Changed Facts

- Added `external_identities` model to database architecture and Prisma schema.
- Added migration `20261012020000_external_identities`.
- Provided manual SQL operator registration script `scripts/sql/register-uniship-operator.sql`.
- Specified `AuthService.authenticateExternalIdentity` port and service.
- Recorded owner confirmation of Uniship `userid` stability for application integration and deferred Admin UI / live provider technical verification; API integration authorization is now owner-confirmed.
- Resolved frontend port inconsistency: browser-facing port is canonical `http://localhost:3001` (or `http://127.0.0.1:3001`); internal container listener legitimately remains port 3000.
- Added `apps/web/scripts/dev.mjs` preflight enforcing canonical port 3001 on host dev and refusing port collisions (`EADDRINUSE`) with code 1 instead of silently switching to port 3002.
- Decoupled Next.js layouts using Route Groups: `apps/web/app/layout.tsx` owns HTML/styles/metadata without `AppShell`; `apps/web/app/login/layout.tsx` is standalone without `AppShell`; `apps/web/app/(workspace)/layout.tsx` enforces server-side session verification via `getCachedServerSession(cookie)`.
- Enforced protected workspace access: missing/invalid/expired/revoked cookies redirect to `/login?from=...`; upstream backend outages fail closed with service unavailable card without redirect loops; workspace Server Components (`page.tsx`, `settings/page.tsx`, `system/page.tsx`) guard rendering with `getCachedServerSession` and never evaluate or render protected content before session authentication completes.
- Wired Uniship provider configuration environment variables (`UNISHIP_API_URL`, `UNISHIP_LIVE_AUTHORIZED`) into `compose.yml` and `compose.release.yml` under `api.environment`.
- Documented provider variables in `.env.example`.
- Refined `apps/api/src/config.ts` with `z.preprocess` to normalize empty strings/omitted provider URLs to `undefined`, preventing API startup failures when unconfigured while keeping invalid URLs/protocols strictly rejected.
- Added comprehensive unit tests in `apps/api/test/unit.test.cjs` validating configuration parser normalization, protocol restriction (HTTP/HTTPS only), and authorization flag handling.
- Corrected Uniship provider response parsing in `UnishipAuthAdapter`: handles observed nested runtime response `{ token: string, user: { username: string, userid: number | string, is_verified: boolean } }`, extracting `user.userid` instead of obsolete root-level `userid`.
- Enforced strict validation: requires non-empty string `token`, non-null/non-array `user` object with non-empty `username`, rejects `is_verified === false` with 401 `AUTHENTICATION_FAILED`, requires safe positive integer or positive decimal string `userid` (1-128 chars), and returns only `{ provider: 'uniship', providerSubject: normalizedUserid }` without persisting, logging, or exposing provider bearer tokens.
- Restored operational security gate: `!isLoopback && !this.liveAuthorized` strictly blocks operationally disabled live network requests to `kh.uniship.vn` with 503 `SERVICE_UNAVAILABLE`.
- Removed all temporary sensitive debug logging statements (`console.log("response", ...)`, `console.log("uniship_response_structure", ...)`, and fetch error cause dumps) that could expose tokens or request payloads.
- Expanded mock-provider unit test suite in `apps/api/test/provider-auth.test.cjs` covering nested numeric/string `userid`, rejection of root-level-only legacy format, missing/null/empty/float/array `userid`, missing/empty `token`, missing/empty `username`, `is_verified: false` rejection, malformed JSON, 400/401, 500, timeout, redirect rejection, and asserting no tokens or passwords appear in console output.
- Updated end-to-end integration tests in `apps/api/test/integration.test.cjs` to use nested observed mock provider format, added checks for invalid provider payload (503), provider outage (503), asserted absence of provider token in database sessions or HTTP responses, and verified local ADMIN login isolation.

### Canonical Owners

- `docs/tasks/active/NEXORA-012-admin-staff-management.md`
- `docs/decisions/unified-identity.md`
- `docs/architecture/database.md`
- `docs/architecture/backend.md`
- `docs/architecture/frontend.md`
- `docs/operations/setup.md`
- `docs/operations/configuration.md`
- `docs/operations/testing.md`
- `docs/operations/backup-restore.md`

### Documentation verification

- `node scripts/docs-check.mjs`

---

## Final SQL repair verification scope — 2026-10-13

This follow-up is BOUNDED: executable SQL, regression harness/quality hook and canonical documentation only; the parent implementation retains its SIGNIFICANT classification. No migrations, schema, adapter URL policy, auth contracts or Login UI are changed.

The approved acceptance scope is the external identity database foundation, manual SQL preregistration, provider port/adapter and Login orchestration, local HTTP mocks, employee/admin UI modes and OpenAPI/SDK synchronization. Live technical verification, Admin CRUD/UI, public HTTPS hosting and token persistence are explicitly excluded future work. Authorization to store the userid mapping does not establish broader data-retention rights.

Task state remains `VERIFICATION PENDING` / `PARTIALLY VERIFIED` while exact-final-HEAD hosted quality/runtime/data/dev checks and final review are pending. Historical PASS rows below remain historical evidence, not proof of this repair. The final matching SHA/run and closure decision belong in the PR report after execution; no evidence-only commit is required to chase a moving HEAD. Live-provider verification is excluded from the approved acceptance criteria and cannot be inferred from mock PASS.

The SQL harness executes the actual file through psql, transports quoted literals through a transaction-local temporary input row, and checks duplicate/validation/injection/concurrency/second-insert rollback against real PostgreSQL. Existing username policy has no character allowlist; the stored subject contract is nonempty/trimmed/max-128, while the HTTP adapter separately validates positive decimal provider userid. The test adds no stricter registration policy.

## Evidence

| Claim                                                                                    | Evidence                                                                                                                                                                                                          | Date       | Result |
| :--------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Workspace architectural boundaries respected                                             | `node scripts/boundaries.mjs`                                                                                                                                                                                     | 2026-10-13 | PASS   |
| OpenAPI contract drift and SDK generation                                                | `node scripts/contracts-check.mjs`                                                                                                                                                                                | 2026-10-13 | PASS   |
| Documentation governance, links and task state                                           | `node scripts/docs-check.mjs`                                                                                                                                                                                     | 2026-10-13 | PASS   |
| Unit tests pass (AuthService, SessionGuard, IdentityDatabaseAdapter, UnishipAuthAdapter) | `pnpm --filter @nexora/api test` (57 tests)                                                                                                                                                                       | 2026-10-13 | PASS   |
| Web unit tests pass (contracts, tokens, session, dev preflight)                          | `pnpm --filter @nexora/web test` (19 tests)                                                                                                                                                                       | 2026-10-13 | PASS   |
| Migration tests verify external_identities, constraints & drift                          | `node packages/database/test/migration.mjs`                                                                                                                                                                       | 2026-10-13 | PASS   |
| Integration tests verify fake-provider authentication & constraints                      | `apps/api/test/integration.test.cjs` (5 tests)                                                                                                                                                                    | 2026-10-13 | PASS   |
| Docker Compose environment config resolution (dev & release)                             | `docker compose -f compose.yml -f compose.dev.yml config && docker compose -f compose.release.yml config`                                                                                                         | 2026-10-13 | PASS   |
| Canonical Docker quality and test suite                                                  | `sh scripts/quality-docker.sh` (pnpm quality, integration tests, migration tests)                                                                                                                                 | 2026-10-13 | PASS   |
| Hosted PR #10 CI workflow run on predecessor HEAD c47c09b                                | GitHub Actions run 38252985140 on head c47c09b85c1840243405d54a26388426f8d0a294 (docker-foundation: quality, migration, integration, runtime smoke, backup/restore smoke, dev smoke)                              | 2026-10-12 | PASS   |
| Hosted PR #10 CI workflow run on predecessor HEAD a397489                                | GitHub Actions run 38265744945 on head a397489b4f6e432c2f60249c57d7ddbb5b671a53 (docker-foundation: quality, migration, integration, runtime smoke, backup/restore smoke, dev smoke)                              | 2026-10-12 | PASS   |
| Hosted PR #10 CI workflow run on provider login HEAD 94a9a32                             | GitHub Actions run 38275081934 on head 94a9a32746f80a82e4cde899cca6c2c2d00b53ed (docker-foundation: quality, migration, integration, runtime smoke, backup/restore smoke, dev smoke)                              | 2026-10-12 | PASS   |
| Hosted PR #10 CI workflow run on config refinement HEAD b796e8b                          | GitHub Actions run 38278573540 on head b796e8be1dc610a761eb8bf17804ea88746538cb (docker-foundation: quality, migration, integration, runtime smoke, backup/restore smoke, dev smoke)                              | 2026-10-12 | PASS   |
| Hosted PR #10 CI workflow run on parser fix HEAD bf000a8                                 | GitHub Actions run 38326739863 on head bf000a80eec9a79fa4fbb8b2a3d0db9a69a23991 (docker-foundation: quality, migration, integration, runtime smoke, backup/restore smoke, dev smoke)                              | 2026-10-13 | PASS   |
| Original operator-facing SQL execution before repair                                     | `python3 scripts/sql-registration-smoke.py` against original file at `47ca436e7758c262199eeb5096670de7b99823e7`; valid-registration scenario failed through actual psql                                           | 2026-10-13 | FAIL   |
| Actual registration file on disposable PostgreSQL after repair                           | `python3 scripts/sql-registration-smoke.py`: success, duplicates, validation/boundaries, literal safety, forced second-insert rollback, synchronized concurrency, zero credentials and protected-row preservation | 2026-10-13 | PASS   |
