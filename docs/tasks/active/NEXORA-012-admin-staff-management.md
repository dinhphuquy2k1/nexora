# Task: NEXORA-012 — SQL-Based Uniship Identity & Login Foundation

- **Task ID**: `NEXORA-012`
- **Status**: `IN PROGRESS`
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
- **Gate Distinction**: These decisions represent owner-approved application requirements, not proof of an official Uniship API contract. Live Uniship integration remains gated.

### Immediate Scope (Implemented in this Milestone)

1. **External Identity Schema**: `ExternalIdentity` model in `packages/database/prisma/schema.prisma` mapping to `external_identities` table.
2. **Committed Migration**: `20261012020000_external_identities` adding foreign key cascade to `users(id)`, compound unique constraints, provider check constraint (`uniship`), and subject format check constraint.
3. **Manual SQL Operator Registration**: `scripts/sql/register-uniship-operator.sql` executing an atomic transaction with input validation, `gen_random_uuid()` generation, and creation of `users` (`role = 'OPERATOR'`, `status = 'ACTIVE'`) plus `external_identities` with zero rows in `user_credentials`.
4. **Unique Provider Binding**: PostgreSQL compound unique constraint `(provider, provider_subject)` preventing duplicate bindings across users, and `(user_id, provider)` preventing multiple provider identities per user.
5. **Authentication Application Interfaces**:
   - `IdentityPort.findExternalIdentity(provider, providerSubject)`
   - `IdentityDatabaseAdapter.findExternalIdentity` querying `external_identities` with linked user.
   - `AuthService.authenticateExternalIdentity(verified: VerifiedProviderIdentity)` receiving a verified provider identity from a trusted server-side adapter, enforcing `OPERATOR` and `ACTIVE` user status, and issuing an opaque Nexora session.
6. **Fake-Provider Integration Tests**: Automated tests against disposable PostgreSQL verifying session issuance for active operators, uniform 401 `AUTHENTICATION_FAILED` for invalid/unregistered/disabled/admin identities, SessionGuard compatibility, and logout revocation.
7. **Regression Safety**: Preserves local ADMIN password Login, Scrypt credentials, and generic SessionGuard behavior without regression.
8. **Backup and Restore Extension**: `scripts/auth-restore-smoke.mjs` and `scripts/pr7-restore-smoke.mjs` updated to include `external_identities`.

### Explicitly Deferred Scope (Not Implemented in this Milestone)

- Admin account-management interface (`/admin/users`).
- Browser form for adding staff.
- Staff listing, disable, and reactivate HTTP APIs.
- Live Uniship API calls (`https://kh.uniship.vn`).
- Real provider token persistence.
- Internet hosting / HTTPS deployment.
- Employee-facing UI changes (`/login` redesign or `/login?mode=admin` routing).

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
psql -v username="operator_nam" -v uniship_userid="10482" -f scripts/sql/register-uniship-operator.sql "$DATABASE_URL"
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
[Future Provider Adapter]
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
- Recorded owner confirmation of Uniship `userid` stability for application integration and deferred Admin UI / live provider integration.

### Canonical Owners

- `docs/tasks/active/NEXORA-012-admin-staff-management.md`
- `docs/decisions/unified-identity.md`
- `docs/architecture/database.md`
- `docs/architecture/backend.md`
- `docs/operations/testing.md`
- `docs/operations/backup-restore.md`

### Documentation verification

- `node scripts/docs-check.mjs`

---

## Evidence

| Claim                                                                | Evidence                                    | Date       | Result |
| :------------------------------------------------------------------- | :------------------------------------------ | :--------- | :----- |
| Workspace architectural boundaries respected                         | `node scripts/boundaries.mjs`               | 2026-10-12 | PASS   |
| OpenAPI contract drift and SDK generation                            | `node scripts/contracts-check.mjs`          | 2026-10-12 | PASS   |
| Documentation governance, links and task state                       | `node scripts/docs-check.mjs`               | 2026-10-12 | PASS   |
| Unit tests pass (AuthService, SessionGuard, IdentityDatabaseAdapter) | `pnpm --filter @nexora/api test` (53 tests) | 2026-10-12 | PASS   |
| Migration tests verify external_identities, constraints & drift      | `node packages/database/test/migration.mjs` | 2026-10-12 | PASS   |
| Integration tests verify fake-provider authentication & constraints  | `apps/api/test/integration.test.cjs`        | 2026-10-12 | PASS   |
