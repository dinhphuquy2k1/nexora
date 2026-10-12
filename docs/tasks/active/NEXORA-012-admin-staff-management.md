# Task: NEXORA-012 — Admin Staff Management & Uniship Identity Preregistration

- **Task ID**: `NEXORA-012`
- **Status**: `PLANNED`
- **Implementation**: `PLANNED`
- **Verification**: `NOT VERIFIED`
- **Classification**: SIGNIFICANT

## Predecessor baseline and verification preflight

Baseline commit: `f0f54f58c7578dd9dd86fecbd6534e26a4c044cb` (merged PR #9 on main).
PR #9 final head commit `1e434d63093bfee366570c3c6e342062e2f22179` passed hosted GitHub Actions workflow run `38232652011` (12m25s) across all foundation jobs (quality, migration, integration, runtime smoke, PR #7/current/pre-auth backup/restore smoke, dev smoke).
Merge commit `f0f54f58c7578dd9dd86fecbd6534e26a4c044cb` push workflow run `38242823228` passed on main (16m38s).
NEXORA-011 was formally closed as `COMPLETED` / `VERIFIED` and moved to `docs/tasks/completed/NEXORA-011-unified-identity-migration.md` in commit `3752aa8` on main.
Worktree branch: `feat/admin-staff-management`.

## Section 5 Hard Gate: Confirmed Uniship Identity Contract Audit

The Unified Identity ADR ([unified-identity.md](../../decisions/unified-identity.md)) and project rules mandate that employee preregistration must use a confirmed Uniship permanent subject identifier, and explicitly forbid speculative schema or username/email bindings.

An exhaustive preflight audit of repository documentation and specifications was conducted against the 8 mandatory gate questions:

1. **Is Uniship `userid` stable?**
   - **Audit Evaluation**: UNCONFIRMED.
   - **Evidence**: `docs/decisions/unified-identity.md` line 35 records open question 2: _"Is userid stable and non-reassignable?"_ `docs/decisions/product-scope.md` line 63 confirms _"Provider authorization, userid semantics and retention rights remain open prerequisites."_
2. **Is it globally unique within the relevant provider identity namespace?**
   - **Audit Evaluation**: UNCONFIRMED.
   - **Evidence**: No official provider contract or namespace definition exists in repository records.
3. **Can it be reassigned to another person?**
   - **Audit Evaluation**: UNCONFIRMED.
   - **Evidence**: Explicitly listed as an open question in ADR records.
4. **Is the identifier case-sensitive, numeric or textual?**
   - **Audit Evaluation**: UNCONFIRMED.
   - **Evidence**: Sample observation notes `userid` in login JSON and `data.ID` in profile JSON, but ADR line 30 states: _"These observations do not establish official API permission, stable identity, token lifetime or data rights."_ Exact format, typing, length, and casing rules are undocumented.
5. **What is the permitted canonical representation?**
   - **Audit Evaluation**: UNCONFIRMED.
   - **Evidence**: No canonical normalization or regex representation is defined by owner-approved contracts.
6. **Can ADMIN legitimately obtain it for employee preregistration?**
   - **Audit Evaluation**: UNCONFIRMED.
   - **Evidence**: `docs/decisions/unified-identity.md` line 36 records open question 3: _"How may Admin legitimately obtain employee userids?"_ No admin acquisition channel or provider admin directory endpoint is documented.
7. **Does the identifier refer to an employee, customer account or corporate subaccount?**
   - **Audit Evaluation**: UNCONFIRMED.
   - **Evidence**: Observed sample endpoint is `https://kh.uniship.vn/client/api/customers/{userid}` (customer portal path), while target users are Nexora logistics staff / employees. ADR line 37 records open question 4: _"Are identities independent customer accounts or corporate subaccounts?"_
8. **Are the identifiers exposed in authentication and profile results guaranteed to represent the same identity?**
   - **Audit Evaluation**: UNCONFIRMED.
   - **Evidence**: Discrepancy between auth field `userid` and profile field `data.ID` remains unverified by provider contracts.

### Hard Gate Decision & PLAN ISSUE

> [!WARNING]
> **PLAN ISSUE: Uniship identity contract and legitimate acquisition source unconfirmed.**
> In accordance with Section 5 of the Phase 2 specification and [Project Rules](../../ai/PROJECT_RULES.md#3-domain--business-invariants):
>
> - External identity schema (`external_identities`) must NOT be created based on speculative assumptions.
> - Employees must NOT be registered against temporary usernames or emails.
> - No fake provider verification mechanism or fabricated user IDs may be introduced.
> - The task remains `PLANNED` for external identity preregistration until owner decisions resolve the gate.
> - Phase 2 cannot be claimed `IMPLEMENTED`.

### Required Owner / Provider Decisions to Unblock Full Phase 2

1. **Provider Contract Specification**: Official documentation confirming whether Uniship `userid` (or `data.ID`) is permanent, immutable, and non-reassignable across user lifecycles.
2. **Canonical Identifier Syntax**: Definition of data type (integer string vs alphanumeric UUID), maximum length, and canonical casing rules for the provider subject key.
3. **Legitimate Acquisition Workflow**: Specification of how a Nexora ADMIN legitimately obtains the employee's Uniship subject ID (e.g. from an official Uniship corporate portal, CSV export, or verified employee profile).

---

## Target Architecture Specification (Phase 2)

Following resolution of the Uniship contract gate, Phase 2 implements the following safe architectural layers:

### 1. Database Layer (`packages/database`)

- Preserve existing tables: `users`, `user_credentials`, `sessions`.
- Future `external_identities` table (only after gate passes):
  - Primary key `id` UUID.
  - Foreign key `user_id` referencing `users.id` ON DELETE CASCADE.
  - `provider` VARCHAR(32) NOT NULL (e.g. `uniship`).
  - `provider_subject` VARCHAR(128) NOT NULL (the confirmed Uniship permanent subject identifier).
  - Explicit PostgreSQL unique constraint `(provider, provider_subject)` enforcing 1:1 binding at the database level.
  - Unique constraint `(user_id, provider)` preventing multiple identities for the same user per provider.
  - Timestamps `created_at`, `updated_at`.
- Strict migration rules: Committed forward-only Prisma migration deployed via `prisma migrate deploy`, preserving existing rows, sessions, and credentials.

### 2. Backend Authorization (`apps/api`)

- Keep generic `SessionGuard` authentication-method agnostic (validates opaque session token in PostgreSQL and checks user status `ACTIVE`).
- Implement dedicated `AdminGuard` (or `@Roles('ADMIN')` guard) applied specifically to `/api/admin/*` routes.
- Access policy:
  - Anonymous requests return HTTP 401 UNAUTHORIZED.
  - Authenticated `OPERATOR` requests to `/api/admin/*` return HTTP 403 FORBIDDEN.
  - Authenticated `ACTIVE` `ADMIN` requests succeed.
  - `DISABLED` accounts return HTTP 401 (rejected by `SessionGuard`).
  - No authorization decisions based on user-supplied headers, query parameters, or request body roles.

### 3. Admin Staff Management API (`apps/api`)

- `GET /api/admin/users`:
  - Returns paginated list of accounts (`items: Array<{ id, username, role, status, createdAt, externalIdentity: { provider, subject } | null }>`, `total`, `page`, `limit`).
  - Strictly omits password hashes, session hashes, cookies, and tokens.
- `POST /api/admin/users/preregister` (gated on provider contract):
  - Accepts `{ username, providerSubject }`.
  - Atomically creates `User` (role: `OPERATOR`, status: `ACTIVE`) and `ExternalIdentity`.
  - Creates NO entry in `user_credentials`.
  - Rejects duplicates with HTTP 409 CONFLICT.
- `PATCH /api/admin/users/:id/disable`:
  - Atomically sets target `status = DISABLED`.
  - Revokes all active sessions belonging to the target user (`DELETE FROM sessions WHERE user_id = :id`).
  - Enforces **Final ACTIVE ADMIN Invariant** transactionally: if target is role `ADMIN`, ensures `count(ACTIVE ADMIN) > 1` within a serializable transaction with appropriate row locking (`SELECT FOR UPDATE`), preventing concurrent mutual disablement.
- `PATCH /api/admin/users/:id/reactivate`:
  - Sets target `status = ACTIVE`.
  - Does NOT restore previously revoked sessions.
  - Generates no credentials or automatic sessions.

### 4. Frontend Admin Management UI (`apps/web`)

- Admin route: `/admin/users` (or tab in `/settings`).
- Server-side route authorization: Server Component or middleware verifies session and `role === ADMIN`; redirects non-admin users or unauthenticated callers.
- UI sections:
  - Account list with role badges (`ADMIN`, `OPERATOR`) and status badges (`ACTIVE`, `DISABLED`).
  - Bounded pagination and filtering.
  - "Preregister Operator" form (enabled only after gate passes).
  - Disable / Reactivate actions with confirmation dialogs explaining session revocation.
  - Clear loading, error, empty, and forbidden states.

---

## Acceptance Criteria

1. **Preflight Hard Gate**: Uniship identity semantics, casing, stability, and acquisition source are officially confirmed and documented prior to database schema creation.
2. **Database Integrity**: `external_identities` enforces unique provider subject bindings; migrations apply cleanly without altering Phase 1 data or existing sessions.
3. **ADMIN Route Authorization**: Only authenticated `ACTIVE` `ADMIN` users can access `/api/admin/*` routes; `OPERATOR` users receive 403; unauthenticated users receive 401.
4. **Staff Management Operations**: ADMIN can list accounts, disable accounts, and reactivate accounts.
5. **Session Revocation**: Disabling an account immediately revokes all of its active sessions across all devices.
6. **Final ACTIVE ADMIN Invariant**: The system transactionally prevents disabling the last active ADMIN, including under concurrent execution.
7. **Zero Credentials for Operators**: Preregistered OPERATOR accounts never have rows in `user_credentials`.
8. **Regression Safety**: Existing local ADMIN password Login, session handling, CLI user creation, and operational smoke tests continue to pass.

---

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Established task NEXORA-012 for Phase 2 Admin Staff Management & Uniship Identity Preregistration.
- Executed Section 5 Hard Gate preflight audit: confirmed Uniship identity contract and acquisition source are unconfirmed; recorded PLAN ISSUE.
- Documented safe target architecture for database, backend guards, management APIs, concurrency invariants, and frontend components.

### Canonical owners

- `docs/tasks/active/NEXORA-012-admin-staff-management.md`
- `docs/decisions/unified-identity.md`

### Documentation verification

- `node scripts/docs-check.mjs`

---

## Evidence

| Claim                                                    | Evidence                                                                                                                                               | Date       | Result |
| :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Predecessor PR #9 merge and CI verified on main baseline | GitHub Actions run 38242823228 on merge commit f0f54f58c7578dd9dd86fecbd6534e26a4c044cb (docker-foundation: quality, migration, runtime, backup smoke) | 2026-10-12 | PASS   |
| Predecessor task NEXORA-011 verified and closed          | Task moved to `docs/tasks/completed/NEXORA-011-unified-identity-migration.md` with status COMPLETED / VERIFIED in commit 3752aa8                       | 2026-10-12 | PASS   |
| Hard Gate Audit detects unconfirmed Uniship contract     | Preflight audit against `docs/decisions/unified-identity.md` lines 23-45 & `docs/decisions/product-scope.md` line 63 identifies open prerequisites     | 2026-10-12 | PASS   |
| Documentation governance and entry points valid          | `node scripts/docs-check.mjs`                                                                                                                          | 2026-10-12 | PASS   |
