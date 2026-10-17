# ADR-007 · Multi-Carrier Management, Security Architecture & Independent Identity

**Status**: Accepted (Supersedes legacy provider-login direction from [unified identity](unified-identity.md) and private-only ADMIN direction from [ADR-005](authentication.md); 2026-10-14)

## Context & Problem Statement

In PR #10 (tracked in NEXORA-012), Uniship was introduced into the Nexora authentication path: operators authenticated against Uniship's API, the adapter extracted `userid`, and Nexora mapped this to `external_identities` to issue an application session.

This architectural coupling placed an external carrier inside Nexora's primary Identity boundary. In real logistics operations, a single business organization or operator frequently manages multiple carrier accounts across different logistics providers (e.g. Uniship, ViettelPost, GHN), or multiple accounts within the same provider (e.g. multiple branch/client accounts). Tying Nexora operator authentication to a specific carrier account creates severe structural flaws:

1. An operator cannot manage multiple accounts or multiple providers under one unified login.
2. Carrier API outages or credential expirations prevent operator access to Nexora itself.
3. The design does not provide secure, encrypted credential storage for ongoing programmatic API interactions.
4. Administrative governance and role-based access control (RBAC) are fragmented across external systems.

Nexora is actively under development and has **zero real production users or legacy production data**. Therefore, backward compatibility with the experimental provider-login mechanism is unnecessary.

## Decision Summary

1. **Independent Nexora Identity**:
   - Both `ADMIN` and `OPERATOR` authenticate strictly using independent Nexora local credentials (Scrypt password hashes stored in `user_credentials`).
   - Carrier credentials or external tokens never create, extend, or influence Nexora application sessions.
   - Carrier API outages, token expirations, or invalid carrier credentials never invalidate or terminate a Nexora user session.

2. **Complete Removal of Legacy Provider Login (PR 2)**:
   - PR 2 completely removes `POST /api/auth/provider/login`, `AuthService.loginWithProvider()`, `AuthService.authenticateExternalIdentity()`, and the frontend provider login UI mode (`/login?mode=admin` is collapsed into a single local login screen).
   - In PR 2, a forward-only database migration drops the `external_identities` table (`DROP TABLE external_identities;`).
   - Development cleanup is executed via an isolated, one-time script (`scripts/sql/cleanup-dev-operators.sql`) that checks the environment/database name, requires explicit confirmation, revokes active sessions, and purges test operator accounts while preserving valid local `ADMIN` accounts.
   - No data backfill, account cutover, or legacy account conversion mechanism is implemented.

3. **Retention and Relocation of Uniship HTTP Client**:
   - The battle-tested Uniship HTTP client logic from `UnishipAuthAdapter` (timeout enforcement, HTTPS validation, payload parsing, redirect rejection, safe error mapping) is retained.
   - In PR 2, this client is refactored into `apps/api/src/carrier/infrastructure/uniship/`, decoupling its return types from the Identity domain.
   - It will serve as the foundation for the carrier connection adapter in PR 4.

4. **Multi-Carrier Connections Architecture**:
   - A single Nexora user can create and manage multiple carrier connections across multiple providers or multiple accounts of the same provider.
   - Each connection record belongs to exactly one `users.id` (foreign key `user_id` referencing `users(id)`).
   - Connections and decrypted secrets are never shared across users.
   - **Global Uniqueness & Unified Generic Error**: A physical carrier account is strictly bound to at most one Nexora user at any given time. The database enforces a global unique constraint on `(provider, external_account_id)`. Two users cannot link the same carrier account simultaneously. For `POST /api/carrier-connections`, Nexora returns a single unified generic error (`400 CANNOT_CONNECT_CARRIER_ACCOUNT`, "Không thể kết nối tài khoản này") for BOTH invalid provider credentials and duplicate account linkage. This prevents account enumeration and never discloses whether the carrier credentials were valid, whether the account was already linked, or who the existing owner is. Detailed duplicate conflicts and authentication failures are recorded strictly in the server-side security audit log.
   - **Provider Domain Vocabulary & SQL CHECK Constraint**: `carrier_connections.provider` is persisted domain vocabulary. The schema enforces a raw PostgreSQL CHECK constraint: `CONSTRAINT chk_carrier_connections_provider CHECK (provider IN ('uniship'))`. Future carrier providers will be added via forward-only migrations modifying this constraint. Prisma enums, PostgreSQL ENUMs, and TypeScript enums are strictly forbidden.
   - **Conditional Login Identifier**: `login_identifier` (e.g. username/email) is conditional per adapter and nullable at the schema level to accommodate providers that rely solely on OAuth, API keys, or bearer tokens without username/email credentials.
   - **Protected Carrier Endpoints & Status Separation**: All protected carrier endpoints enforce `401 UNAUTHORIZED` if the Nexora session is missing or expired, `429 RATE_LIMITED` on rate limits, and `503 SERVICE_UNAVAILABLE` on carrier outage or network timeout.
   - **Administrative Carrier Endpoints Deferred Post-PR 6**: Administrative carrier endpoints (`GET /api/admin/carrier-connections`, `DELETE /api/admin/carrier-connections/:id`) require both `role === 'ADMIN'` AND `auth_level === 'MFA'`. Because MFA is introduced in Logical PR 6, these administrative carrier endpoints and any future dedicated administrative CLI executable (`dist/cli/carrier-admin.js`) are PLANNED / DEFERRED to a post-PR 6 follow-up milestone. PR 6 does NOT depend on PR 3 or PR 4, and Public HTTPS (PR 7) does not wait for administrative carrier endpoints. During the interim period prior to post-PR 6 implementation, administrative cross-user maintenance or emergency disconnection is executed via authorized SQL maintenance runbooks run directly by database administrators.

5. **Mandatory Encrypted Credential Storage & Key Hierarchy**:
   - Carrier connection credentials (access tokens, refresh tokens, and passwords) are encrypted using **AES-256-GCM** with a cryptographically secure 96-bit random nonce generated per encryption operation.
   - **Authenticated Associated Data (AAD)** binds `connection_id:user_id:provider:secret_type` to prevent ciphertext swapping between connections, users, or secret types.
   - Subkeys are derived using HKDF with strict purpose separation (`CARRIER_TOKEN` vs `CARRIER_PASSWORD`).
   - Shared cryptographic primitives (`AES-256-GCM`, HKDF, nonce generation, and key versioning) reside in `apps/api/src/common/crypto/`. Neither Identity nor Carrier modules import crypto logic from each other.
   - **Separate Master Keys**: The Carrier Master Key is strictly isolated from the Identity Master Key. A corruption or unavailability of the carrier key prevents carrier API calls but never blocks administrative login or system operations.
   - **Default Encrypted Password Storage**: Carrier passwords are encrypted and persisted by default upon connection to enable automated re-login when tokens expire. There is no opt-in checkbox or configuration toggle. The UI explicitly discloses that carrier passwords are stored encrypted for session recovery and are destroyed upon disconnection.
   - **Durable Audit & Fail-Closed Decryption**: Re-login password decryption is restricted to authorized API infrastructure services and requires an immutable security audit log entry via `SecurityAuditPort`. If the audit sink is unavailable or fails to persist the audit record, the operation MUST fail-closed: decryption is aborted and no re-login is attempted.
   - Missing or corrupted master keys result in fail-closed errors; they never overwrite ciphertexts, fabricate mock credentials, or degrade connection status to `REAUTH_REQUIRED`.

6. **Token Verification Protocol & Uniship Live Merge Gate**:
   - For Uniship, access tokens must be cryptographically verified against the provider before use:
     - Upon login / re-login: verify that `user.userid` returned by `POST /client/api-token-auth/` matches the connection's `external_account_id`.
     - Upon token receipt or refresh: invoke `POST /client/api-token-verify/` with the candidate token and confirm that the returned `user.userid` matches `external_account_id`.
   - Token verification is executed strictly upon token acquisition or replacement, not before every operational request.
   - Mismatched identity transitions the connection to `REAUTH_REQUIRED` and permanently suppresses automated re-login until manually reconnected by the owner.
   - Network or server errors during verification transition the connection to `ERROR` with backoff; unverified tokens are never utilized.
   - **Realistic Uniship Live Merge Gate (PR 4)**: Prior to merging live Uniship carrier integration, the following contract and authorization terms must be confirmed through verified API evidence (distinguished from illustrative owner notes):
     1. Exact request body structure for `POST /client/api-token-verify/`.
     2. Proof that response `user.userid` corresponds directly to the verified token and matches `external_account_id`.
     3. Exact error codes and HTTP status for expired or invalid tokens.
     4. Semantics of `is_verified` and any account verification flags.
     5. Token time-to-live (TTL) and confirmation of whether a token refresh endpoint exists (do NOT assume token refresh exists; if absent, automated re-login via encrypted password is used).
     6. Rate limits, concurrency limits, and terms for automated re-login using persisted credentials.
     - _Mock Adapter Rule_: PR 4 development and automated CI tests proceed using a local mock adapter until the live merge gate criteria are fulfilled.

7. **ADMIN TOTP Multi-Factor Authentication (PR 6)**:
   - All `ADMIN` users must complete RFC 6238 TOTP (SHA-1, 6 digits, 30-second step, ±1 step tolerance) before receiving an administrative session.
   - **CLI Enrollment Protocol (No DB Locks During User Interaction)**: MFA secret generation and enrollment are performed exclusively via an interactive server-side CLI (`dist/cli/mfa-enroll.js`). To prevent connection exhaustion and indefinite database row locks during user TTY interaction, the enrollment protocol follows strict phase separation:
     1. Prompt for the admin's Nexora password via hidden terminal prompt; verify password hash outside the database transaction.
     2. Generate candidate TOTP secret and 10 single-use recovery codes in memory; display TOTP setup key/QR in terminal.
     3. Prompt the admin for the initial confirmation TOTP code; verify the code against the candidate secret outside the transaction.
     4. Only after successful confirmation code verification, open a short database transaction:
        - Lock user row: `SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE;`
        - Re-verify `status = 'ACTIVE'`, `role = 'ADMIN'`, and strictly re-check that `user_credentials.password_hash` exactly equals the verified hash (aborts if a concurrent password change or account disablement occurred).
        - Insert `user_mfa` with `last_used_step` initialized to the exact TOTP time-step of the confirmation code (preventing enrollment code replay).
        - Insert SHA-256 hashes of the 10 recovery codes into `mfa_recovery_codes`.
        - Atomically delete all active sessions (`DELETE FROM sessions WHERE user_id = $1`) and pending challenges (`DELETE FROM mfa_challenges WHERE user_id = $1`).
     5. Commit the database transaction.
     6. ONLY after successful commit, print the 10 single-use plaintext recovery codes to the terminal once with a prominent warning to store them securely.
     - _Invariant_: Database transactions and row locks are NEVER held while awaiting CLI user input.
   - **Atomic Two-Step Authentication**:
     1. Password verification issues an ephemeral pending MFA challenge token stored in an `HttpOnly`, `SameSite=Strict` cookie (path `/api/auth/mfa`, TTL 5 minutes) and persists the token's SHA-256 hash in `mfa_challenges`. No session is created.
     2. `POST /api/auth/mfa/verify` is decorated with `@Public()` to bypass the global `SessionGuard`, but strictly enforces `OriginGuard`, presence of a valid pending MFA challenge token cookie, account-level rate limiting, and replay prevention. Inside a single database transaction, the pending challenge is consumed atomically (`UPDATE mfa_challenges SET consumed_at = now() WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING user_id;`), `user_mfa.last_used_step` is updated (`WHERE last_used_step < $2`) to prevent replay attacks, and a session with `auth_level = 'MFA'` is issued.
   - **Password-Hash Recheck in Session/Challenge Issuance**: Scrypt password verification runs outside the database transaction. Subsequently, inside a short transaction, the server locks the user row (`SELECT ... FROM users ... FOR UPDATE`), verifies `status = 'ACTIVE'`, expected role, and strictly re-verifies that `user_credentials.password_hash` exactly matches the hash used for the Scrypt verification. Any mismatch indicates a concurrent password change and immediately aborts issuance.
   - **Atomic Challenge Revocation**: Password changes, role modifications, account disablement, and MFA resets atomically delete all active sessions (`sessions`) AND all pending challenges (`mfa_challenges`) for that user within the same database transaction.
   - **Single-Use Recovery Codes**: Enrollment generates 10 high-entropy recovery codes (≥80 bits CSPRNG). Nexora stores only their SHA-256 hashes. Recovery codes are consumed atomically.
   - **Session Assurance & Milestone-Based Administrative Authorization Policy**:
     - Database table `sessions` includes `auth_level` (`VARCHAR(16) NOT NULL DEFAULT 'PASSWORD'`).
     - **Milestone 1 (PR 2 → Prior to PR 6)**: Active local `ADMIN` users authenticated with a valid Nexora password session (`auth_level = 'PASSWORD'`) are permitted to access administrative endpoints (`POST /api/admin/operators`, `POST /api/admin/operators/:id/setup-link`). The backend strictly enforces `role === 'ADMIN'` and an active session. This authorization policy is strictly supported on the private loopback/local deployment environment; local ADMIN login and administrative APIs are NEVER exposed to the public Internet, and administrative functionality does NOT depend on unreleased MFA.
     - **Milestone 2 (PR 6 and Onward)**: Following the deployment of PR 6, all administrative endpoints (`/api/admin/...`) strictly enforce both `role === 'ADMIN'` AND `auth_level === 'MFA'`. Existing password-only ADMIN sessions are revoked or rejected. No permanent MFA bypass is permitted.
     - **Milestone 3 (PR 7 — Public HTTPS)**: Public HTTPS ingress is opened ONLY when MFA enforcement is active and verified at application startup. Zero ADMIN endpoints may bypass MFA over public ingress.

8. **Operator Onboarding & Public HTTPS Release Gate (PR 2 & PR 7)**:
   - **One-Time Operator Setup Link & Reissue Contract (PR 2)**:
     - **Initial Issuance (`POST /api/admin/operators`)**: ADMIN creates an operator account (`{ username }`), creating `users` with `role = 'OPERATOR'`, `status = 'ACTIVE'`, and no password credential. The API generates a high-entropy CSPRNG setup token (≥128 bits entropy), stores its SHA-256 hash in `operator_setup_tokens`, and returns `{ user, setupUrl, expiresAt }`.
     - **Reissue Endpoint (`POST /api/admin/operators/:id/setup-link`)**: ADMIN can reissue a setup link for an active operator. The transaction locks the target user row (`SELECT ... FOR UPDATE`), verifies that the user is `ACTIVE`, has `role = 'OPERATOR'`, and strictly checks that no credential exists in `user_credentials`. If credentials already exist, it rejects with `400 OPERATOR_ALREADY_CONFIGURED` ("Tài khoản đã thiết lập mật khẩu") because setup links cannot be used as an arbitrary password reset tool. Reissue atomically invalidates all unconsumed setup tokens for that user (`UPDATE operator_setup_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL;`), generates a new CSPRNG token hash (24h TTL), and returns `{ setupUrl, expiresAt }`.
     - **Token Lifecycle & Privacy**: Token has a short TTL (24 hours) and is strictly single-use. Only the SHA-256 hash is persisted. The raw token is returned only once in `setupUrl`, never echoed again, never logged, and never included in error payloads.
     - **Atomic Consumption (`POST /api/auth/setup-password`)**: Decorated with `@Public()` and `OriginGuard`. Follows the strict unified lock order (**user row lock → operator_setup_tokens update**) to eliminate cross-transaction deadlocks:
       1. Validates token/password, enforces rate limiting, and computes SHA-256 token hash.
       2. Computes Scrypt password hash strictly **outside** the database transaction to prevent holding DB locks during CPU/memory-intensive work.
       3. Executes a non-locking query: `SELECT user_id FROM operator_setup_tokens WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now();` to locate `user_id`. If not found, aborts with `400 INVALID_OR_EXPIRED_SETUP_TOKEN`.
       4. Opens a short database transaction:
          - Locks user row FIRST: `SELECT id, role, status FROM users WHERE id = $user_id FOR UPDATE;`
          - Verifies `role = 'OPERATOR'` and `status = 'ACTIVE'` (aborts/rollbacks if violated).
          - Executes conditional atomic token consumption:
            ```sql
            UPDATE operator_setup_tokens
            SET consumed_at = now()
            WHERE token_hash = $1
              AND user_id = $2
              AND consumed_at IS NULL
              AND expires_at > now()
            RETURNING id;
            ```
            If zero rows are returned (token was consumed, invalidated, or expired concurrently), aborts and rollbacks with `400 INVALID_OR_EXPIRED_SETUP_TOKEN`.
          - Strictly verifies that no credential exists in `user_credentials` for this user (preventing password overwrite races).
          - Inserts Scrypt password credential into `user_credentials`.
          - Commits transaction.
     - **Unified Lock Ordering Invariant**: Every operation modifying setup tokens (`consume`, `reissue`, `disable`) MUST lock the target user row (`users FOR UPDATE`) before updating `operator_setup_tokens`. Consistent lock ordering prevents PostgreSQL cross-transaction deadlocks.
     - **Revocation on User Disablement**: Disabling an operator atomically marks all unconsumed `operator_setup_tokens` for that user as consumed/invalidated in the same transaction. Reactivating the user does NOT restore old setup tokens; a new link must be explicitly reissued.
     - **Administrator Boundary**: Administrators CANNOT view or choose operator passwords.
     - **Scope**: PR 2 implements and verifies onboarding in local/test environments. PR 7 verifies remote employee password setup over HTTPS. General email/SMS delivery systems are excluded from this milestone.
   - **Public HTTPS Release Gate (PR 7)**:
     - ADMIN and OPERATOR access over public HTTPS is authorized subject to strict release gates:
       1. **Mandatory Hard Dependency**: Public profile requires PR 6 (ADMIN TOTP MFA). At application boot in the public profile, the API **refuses to start** if MFA enforcement is disabled.
       2. **Ingress Security**: Strict TLS, `Secure` cookie attributes, server-configured Origin and Host allowlists, trusted proxy configuration, and ingress rate limiting.
       3. **Host NTP Clock Synchronization**: The host operating system running Docker containers must run an active NTP daemon (`chrony` or `systemd-timesyncd`). Operators verify clock synchronization via `timedatectl` during deployment runbook execution.

9. **Concurrency & Database Transaction Invariants**:
   - **Last Active Admin Invariant & Advisory Lock Protocol**: To prevent accidental lockout or race conditions that leave zero active administrators, any operation reducing active admins (disablement, role demotion, self-disablement) MUST adhere to the following protocol:
     1. Acquire a dedicated transaction-level PostgreSQL advisory lock before locking any user rows:
        ```sql
        SELECT pg_advisory_xact_lock(hashtext('nexora_active_admin_invariant'));
        ```
     2. Within the same transaction, count active administrators:
        ```sql
        SELECT count(*) FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE';
        ```
     3. If the count is `<= 1` and the target user is an active admin, abort with `400 CANNOT_DISABLE_LAST_ADMIN` (or `CANNOT_DEMOTE_LAST_ADMIN`).
     4. Lock the target user row: `SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE;` and perform the update.
     - The transaction-level advisory lock acquired before user-row locks serializes operations that reduce active administrators under this protocol, preventing lock-ordering deadlocks and race conditions specifically between those administrative mutations.
     - Invariant: Transactions holding advisory locks or row locks are NEVER held across HTTP calls or slow operations.
   - **Stage-Aware Progressive User Disablement Transaction**: Disabling a user expands transaction responsibilities incrementally across milestones. Each PR only queries tables physically existing in its schema stage; using `catch` blocks or raw SQL `IF EXISTS` to mask unmigrated tables is strictly prohibited:
     - **Logical PR 2**: Acquires advisory lock if disabling an ADMIN (`SELECT pg_advisory_xact_lock(...)`), locks target user row (`SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE;`), sets `status = 'DISABLED'`, deletes active sessions (`DELETE FROM sessions WHERE user_id = $1;`), and invalidates all unconsumed setup tokens (`UPDATE operator_setup_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL;`). Zero queries against carrier secrets or MFA challenge tables.
     - **Logical PR 3 (Carrier Extension)**: Extends the PR 2 transaction to delete carrier secrets (`DELETE FROM carrier_connection_secrets WHERE connection_id IN (SELECT id FROM carrier_connections WHERE user_id = $1);`) and update carrier connections status to `REAUTH_REQUIRED`. Late-arriving carrier HTTP responses cannot recreate secrets.
     - **Logical PR 6 (MFA Extension)**: Extends the PR 3 transaction to delete all pending MFA challenges (`DELETE FROM mfa_challenges WHERE user_id = $1;`) and revoke MFA challenges on role/status change.
     - _Invariant_: Reactivation of a user does NOT restore invalidated setup tokens or deleted carrier secrets. A new setup link must be explicitly reissued.
   - **Connection Deletion**: Disconnection is implemented as a hard delete (`DELETE FROM carrier_connections WHERE id = $1`), atomically removing the connection and cascading to all associated secrets.
   - **Singleflight Concurrency**: In-memory singleflight deduplicates simultaneous carrier token refresh requests within a single API instance. Database transactions are never held across external HTTP carrier calls.

10. **Delivery Phases (6 PR Plan)**:
    - **PR 1**: Architecture, Security & API Contracts (Documentation only; current task).
    - **PR 2**: Unified Local Login, RBAC, Operator Onboarding (`operator_setup_tokens`, setup link issuance & reissue `POST /api/admin/operators/:id/setup-link`), Last Active Admin Advisory Lock & Legacy Provider Removal (PR 5 merged here). Drops `external_identities`, relocates Uniship HTTP client to `carrier/infrastructure/uniship/`. Local password ADMIN authentication authorized for admin endpoints prior to PR 6 on loopback.
    - **PR 3**: Carrier Connections Foundation & Encrypted Secrets (`carrier_connections` with SQL CHECK for provider, `carrier_connection_secrets`, `common/crypto/`, master key custody). Admin carrier endpoints and CLI deferred post-PR 6.
    - **PR 4**: Uniship Carrier Adapter & Management UI (Connection workflow, `api-token-verify`, encrypted password persistence, UI under Settings > Carriers). _Live Merge Gate_: Requires verified `api-token-verify` contract, TTL, rate limits, and re-login authorization.
    - **PR 6**: ADMIN TOTP MFA (`user_mfa`, `mfa_challenges`, `mfa_recovery_codes`, `sessions.auth_level`, CLI enrollment without DB locks during prompt). Enforces `auth_level === 'MFA'` across all `/api/admin/...` routes. _Depends solely on PR 2_.
    - **PR 7**: Public HTTPS Profile, Remote Operator Password Setup & Ingress Hardening. _Hard-gated on PR 6_.

11. **Threat Model & Implementation Test Plan Matrix**:

| #   | Threat                                       | Security Mitigation                                                                                                                                                                                | Acceptance Test Specification                                                                                                                                                       | Target Logical PR |
| :-- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| 1   | **Credential Stuffing & Carrier Abuse**      | Per-user rate limiting on connect/reconnect; singleflight request deduplication; carrier outbound budgets; fail-closed on 429.                                                                     | Burst of 20 connect requests is throttled at 429; concurrent requests for same connection share single outbound carrier call.                                                       | PR 4              |
| 2   | **Duplicate Account Enumeration**            | Global unique constraint `(provider, external_account_id)`; identical generic error `400 CANNOT_CONNECT_CARRIER_ACCOUNT` for bad credentials and duplicate linkage; audit log records exact cause. | Connecting already-linked account returns identical status/body as invalid credentials; no username/owner leakage; security audit contains duplicate conflict event.                | PR 3, PR 4        |
| 3   | **Cross-User Carrier Access**                | All carrier connection endpoints enforce `user_id` ownership from session; DB foreign key cascade; admin sessions forbidden from decrypting or invoking carrier APIs on behalf of others.          | User B cannot view, patch, reconnect, or delete User A's connection (returns 404); Admin cannot call carrier APIs on user connections.                                              | PR 3, PR 4        |
| 4   | **Key Failure & AAD Tampering**              | AES-256-GCM authenticated encryption; AAD binds `connection_id:user_id:provider:secret_type`; missing/corrupt keys fail-closed.                                                                    | Swapping ciphertext between secret types or connections fails GCM authentication; corrupted master key aborts without overwriting data or downgrading status.                       | PR 3              |
| 5   | **Password Decryption Without Audit**        | Decrypting saved passwords for re-login requires persisting an audit event via `SecurityAuditPort`; if audit sink fails, decryption immediately aborts.                                            | Mock failing audit sink during automated re-login -> password decryption is aborted, connection transitions to ERROR, no carrier call executed.                                     | PR 4              |
| 6   | **Disable / Connect / Reconnect Races**      | User disablement atomically purges secrets and marks connections `REAUTH_REQUIRED`; pre-commit write validation checks user is `ACTIVE`.                                                           | Trigger carrier reconnect then disable user before HTTP response completes -> late response cannot persist new tokens; secrets remain deleted.                                      | PR 3, PR 4        |
| 7   | **Password Change ↔ Session Issuance Race** | Short transaction re-checks `password_hash` equality against the verified hash under row lock before creating session or MFA challenge.                                                            | Simulate password change between Scrypt verification and session insertion -> transaction detects hash mismatch and aborts issuance.                                                | PR 2, PR 6        |
| 8   | **Last Active Admin Race**                   | Transaction-level advisory lock (`pg_advisory_xact_lock`) acquired before row locks; active admin count verified inside same transaction.                                                          | Two concurrent requests to disable the last two active admins -> advisory lock serializes; exactly one succeeds, one fails; 0 active admins is impossible; no lock-order deadlocks. | PR 2              |
| 9   | **MFA Challenge & Recovery Replay**          | Atomic challenge consumption (`UPDATE ... SET consumed_at = now() WHERE consumed_at IS NULL`); `last_used_step` monotonic check; single-use recovery code hashes.                                  | Replaying consumed challenge token returns 401; replaying TOTP code within same 30s step returns 401; reused recovery code returns 401.                                             | PR 6              |
| 10  | **Public Ingress, CSRF & Proxy Spoofing**    | Strict `OriginGuard` on mutations; `SameSite=Strict` cookies; trusted proxy hop validation; public startup gate requires MFA.                                                                      | Untrusted Origin returns 403; public profile fails boot if MFA enforcement disabled; spoofed X-Forwarded-\* headers rejected by linklocal proxy config.                             | PR 7              |
| 11  | **Token Verification Identity Mismatch**     | Candidate tokens verified against `POST /client/api-token-verify/`; response `user.userid` must match `external_account_id`.                                                                       | Mock token verify returning different `userid` -> connection immediately transitions to `REAUTH_REQUIRED`, automated re-login permanently disabled.                                 | PR 4              |
| 12  | **Setup Token Replay & Concurrency Races**   | Atomic token consumption (`consumed_at = now()`); user row lock checks `ACTIVE` and absence of credentials; invalidation on disable/reissue.                                                       | Disable user then attempt old link -> fails; concurrent consume & reissue -> one succeeds; consume on configured user -> fails (no overwrite).                                      | PR 2              |
| 13  | **Milestone Administrative Access Breach**   | PR 2..5 allows local ADMIN password session for admin routes; PR 6 enforces `auth_level = 'MFA'`; PR 7 boot gate blocks public start without MFA.                                                  | In PR 2, local ADMIN accesses `/api/admin/operators`; in PR 6, password-only ADMIN access to `/api/admin/...` returns 403/401; in PR 7, boot without MFA fails.                     | PR 2, PR 6, PR 7  |

## Implementation Invariants

- **Boundary Isolation**: Domain and application layers remain strictly Prisma-free. Only API infrastructure boundaries consume database models via `@nexora/database`. Web never imports API source or touches the database.
- **Type Vocabulary**: All domain statuses and types use `as const` objects with derived TypeScript unions, stored as scalar `VARCHAR` strings with raw PostgreSQL SQL CHECK constraints. Prisma and PostgreSQL ENUMs are forbidden.
- **Product Scope Boundaries**: This milestone does not introduce `shipments`, `tracking_events`, background job workers, Redis, Kafka, or automated synchronization loops. All carrier API interactions are executed strictly on-demand.

## Approved PR 2 contract amendment — 2026-10-15

Owner decision `USER_STATUS_ADMIN_CONTRACT` is resolved: implement `GET /api/admin/users` and `PATCH /api/admin/users/:id/status` exactly as specified in [API contract](../architecture/api-contract.md). ACTIVE ADMIN may manage operators, other administrators or itself, while preserving the last ACTIVE ADMIN under an advisory transaction lock acquired before row locks. Disablement revokes sessions and unused setup tokens atomically; reactivation restores neither. Safe summaries expose `hasPassword`, never hashes/tokens. All administrative mutations require OriginGuard.

Setup transport is `/setup#token=<256-bit CSPRNG secret>` on a trusted origin. Only SHA-256 is stored. The client clears the fragment immediately after reading it and sends the secret only in the setup-password JSON body. No-store/no-referrer, no persistent browser storage, no SSR token or third-party assets apply. Existing Origin/admission codes `FORBIDDEN`/`TOO_MANY_REQUESTS` are retained in PR 2; planned MFA/Carrier contract codes do not change the existing limiter. PR 2 does not add `sessions.auth_level`, MFA or Carrier Connection persistence.

## Approved legacy provider session cutover — 2026-10-15

Owner decision `LEGACY_PROVIDER_SESSION_CUTOVER` is resolved: new migration `20261015010000_legacy_provider_session_cutover` deletes every session whose user is OPERATOR and has no local credential at upgrade, regardless of ACTIVE/DISABLED status or expiration. It preserves ADMIN sessions and configured OPERATOR sessions, users, credentials and stored files. The old schema has no authentication-source marker, so provider-origin sessions for already-configured operators cannot be distinguished; retaining those is part of the explicitly approved minimum policy.

This amends the earlier blanket session-preservation guarantee and the no-cutover language only for revocation of experimental session rows. It performs no account conversion/backfill or user deletion. Historical migrations are unchanged. API/Web and provisioning writers must be stopped during migration. SessionGuard remains generic; deletion permanently invalidates old hashes, including after password setup. New local authentication issues a fresh independent token. No session-source column, MFA or carrier schema is introduced.

## Approved Carrier key custody interface — 2026-10-15

Owner decision CARRIER_KEY_CUSTODY is resolved by explicit chat approval for Logical PR3. API reads server-only CARRIER_KEYRING_JSON (canonical positive integer version → canonical base64, exactly 32 bytes) and CARRIER_ACTIVE_KEY_VERSION. Keys remain independent of future Identity master keys. Validation is lazy at crypto use, so missing/malformed Carrier key custody never blocks Nexora Login, ADMIN or metadata operations. Ciphertext stores key_version; active version controls new encryption, stored version controls reads. Operators retain old versions; no automatic key generation, removal, destructive rotation or re-encryption is approved in PR3. API restart activates changed configuration. Detailed supported bounds and operations belong to [Configuration](../operations/configuration.md).

PR3 provides generic cryptographic primitives and an internal encrypted writer only. SecurityAuditPort and its durable sink remain an explicit PR4 dependency before production password decryption/re-login; no such workflow is exposed by PR3.

## Approved PR 4 scope and observed contract amendment — 2026-10-16

The owner requests backend-only Logical PR4 (NEXORA-018). Carrier Settings/forms/navigation remain deferred UI work. This dated amendment supersedes prior PR4 UI scope without rewriting the historical decision. Uniship `user.is_verified` is ignored entirely (true, false, absent or malformed); username/email are not authorization or identity evidence. Nested `user.userid` remains mandatory: positive safe integer or normalized decimal string, at most 128 characters.

Owner-observed HTTP 200 evidence establishes the shape of POST `/client/api-token-verify/`: JSON `{token,FirebaseToken:null}` and Authorization Bearer candidate, Accept/Content-Type application/json. A successful result must have a valid nested userid and a nonempty token safely equal to the candidate. Every new login/re-login token must be verified; login and verify identities must agree; reconnect/re-login must also match the existing external account. JWT payload identity is never evidence. Approximate one-year lifetime is owner information, not a fixed TTL. Verified tokens may have nullable JWT-exp scheduling metadata; provider rejection can occur before expiry. There is no approved refresh endpoint. Encrypted password and access-token storage is the default on successful connection, with no opt-in checkbox.

These decisions authorize Nexora's storage/lifecycle implementation, not Uniship private API use, credential retention under provider terms, automated re-login or quota. Those permissions remain UNVERIFIED. NEXORA-018 therefore hard-closes external execution even with runtime opt-in; loopback mock transport remains available for tests. A future reviewed change requires verified provider evidence plus runtime authorization before external execution can open. No live request is needed for this task.

### Approved audit storage amendment — 2026-10-16

The owner explicitly approved CARRIER_SECURITY_AUDIT_SINK in chat: PostgreSQL security_audit_events, server UUID/time, allowlisted event type/outcome/reason, nullable user/connection UUIDs without cascading foreign keys, provider and UUID correlation. No arbitrary payload or secrets. Password-decrypt INSERT must commit independently before decrypt; failure blocks decrypt and provider calls. Statement triggers reject ordinary UPDATE/DELETE/TRUNCATE. DBA/superuser DDL privilege remains outside the append-only guarantee. There is no audit bypass, retention/delete API or noop binding. This resolves the physical sink issue only; live authorization remains OPEN.

PR4 implements backend connect/reconnect and lazy recovery against this approved boundary; mock-only readiness requires executed database/HTTP/concurrency/contract and exact-head CI evidence in NEXORA-018. The version/epoch fence supplements ACTIVE checks: disable/re-enable cannot validate a response that started under a previous user generation. Existing manual REAUTH_REQUIRED is cleared only by successful manual reconnect, never by a failed attempt. No full framework, distributed lock or refresh endpoint is approved.

## 2026-10-16 clarification — PR18 runtime isolation and identifier scope

The approved PostgreSQL audit sink's append-only trigger remains unchanged. NEXORA-019 separates nexora admin/migration ownership from restricted nexora_app runtime credentials and mounts, adding PostgreSQL privilege enforcement against runtime DDL/TRIGGER/mutation. Authorized DBA/superuser/host access remains outside this guarantee; no WORM, retention bypass or cryptographic immutability claim is made. Operational role provisioning follows migrations and precedes API without rewriting schema history.

Generic connect loginIdentifier? is provider-conditional. Current Uniship requires a trimmed nonblank identifier ≤128 characters and its current DTO/OpenAPI/SDK correctly require it. Database nullability remains intentional for a future OAuth/API-key provider's own request schema. No future-provider schema/union framework is implemented in PR18. See canonical API/Database/Runtime documents and Task019 for current execution evidence.

## Owner-approved manual reconnect failure clarification — 2026-10-16 (NEXORA-020)

This new decision supersedes the earlier blanket failure-status wording for manual reconnect only; historical Task018/019 evidence is unchanged. Manual reconnect is a non-destructive attempt to replace credentials. Wrong new password, timeout/5xx,429, rejected/unverifiable candidate token, or inconsistent login/verify userid preserves the previous status (CONNECTED, ERROR or REAUTH_REQUIRED), all secret rows/encryption metadata, lastVerifiedAt, ownership and externalAccountId. Provider budgets/backoff still apply and the existing failure audit is recorded. Old verified tokens remain usable when the preserved status permits it; manual reconnect never decrypts the stored password. Only fully verified matching replacement succeeds atomically and sets CONNECTED.

Distinguish candidate login/verify inconsistency (internal CANDIDATE_IDENTITY_MISMATCH) from a coherent verified token whose userid differs from the stored connection (IDENTITY_MISMATCH). The latter still requires REAUTH_REQUIRED without overwriting old secrets. Both failures keep existing public authentication/generic-connect responses and the existing audit IDENTITY_MISMATCH reason; neither exposes account identity. No persisted status/type or new provider framework is added.

Automatic recovery remains fail-closed under its existing policy: invalid stored password, rejected token or either identity failure requires REAUTH_REQUIRED; timeout/5xx/429 yields ERROR with bounded backoff. Crypto failure preserves ciphertext/status; failed durable audit blocks password decrypt/provider login. Success atomically replaces sealed credentials and sets CONNECTED. Singleflight, one retry, budgets, user-generation and lifecycle-version fences remain intact. claim still increments version before HTTP even for a failed manual attempt; this invalidates stale work and is not rolled back. Conditional status writes for verified stored mismatch cannot overwrite a newer success or revive disabled/deleted state.

## Superseded recovery interpretation clarification — 2026-10-16 (NEXORA-021)

After NEXORA-020, a failed manual reconnect preserves credentials while advancing lifecycleVersion. Version inequality therefore proves supersession only, not successful token replacement. Preserve the fences and never roll versions back. Recovery outcomes must distinguish own commit, supersession and waiting for a shared flight; callers re-evaluate current ACTIVE ownership, status, token presence, expiry and known rejection.

Use an internal opaque sealed-token revision derived in infrastructure after releasing locks from existing ciphertext/nonce/tag/keyVersion. Do not add a schema field or rely on lastVerifiedAt/updatedAt timestamps, retained row IDs, or null expiry as freshness proof. No plaintext token fingerprint, digest or secret is exposed through API/logs/audit. New verified replacement can be reused; unchanged expired/rejected token requires eligible recovery or a bounded failure.

Bounded implementation policy selected for this requested fix: three shared recovery-flight decisions/rechecks per logical operation, at most one password/vault attempt, and one provider-operation retry. Skips before vault entry do not consume password capacity; joined callers share the leader outcome. Vault entry reserves the only attempt conservatively even if a later stale result might have occurred before decrypt; safely return existing STALE instead of guessing and acquiring twice. These are local orchestration bounds, not provider quotas. Keep128-flight singleflight, admission/backoff, durable PASSWORD_DECRYPT commit and authorization revalidation before every actual saved-password decrypt, epoch/version CAS and no network/crypto under DB locks. No worker, distributed lock or new public recovery endpoint. Historical Task018/019/020 evidence and owner-approved failure policies remain unchanged.

Observed-expired token revisions remain unusable across recovery rechecks even if expiry metadata later becomes null or future-dated without changing the sealed artifact. NEXORA-021 pins this evidence alongside known provider rejection; metadata alone cannot establish replacement. A deterministic unit regression and the genuine PostgreSQL single-caller barrier cover the null-expiry supersession case.

## Identity custody and mandatory ADMIN MFA implementation — owner-approved2026-10-16

Logical PR6/NEXORA-022 implements the accepted MFA milestone for local/loopback deployments; full canonical source verification passed in run38899221991, with final exact-head CI recorded on PR19. Owner explicitly approved IDENTITY_KEY_CUSTODY: IDENTITY_KEYRING_JSON and IDENTITY_ACTIVE_KEY_VERSION are supplied independently by operators, API/CLI only, with canonical positive versions and canonical base64 encoding of32byte random keys. No generation/default/Carrier-key fallback is allowed. AES256GCM uses fresh12byte nonce and16byte tag, HKDFSHA256 salt NEXORA_IDENTITY_V1 and purpose IDENTITY_TOTP. Version1 AAD is exactly v1:<user UUID>:IDENTITY_TOTP; stored encrypted payload is canonical base64 of the20byte secret. Ciphertext/nonce/tag/keyVersion bind it to its user/purpose/format. Shared primitives retain the exact Carrier protocol unchanged. Startup snapshots keyring configuration; restart activates new versions while old versions remain readable. Automatic re-encryption, retirement and MFA reset are excluded.

API interface preflight: login succeeds as either {user} (OPERATOR session) or {mfaRequired:true} (ADMIN pending cookie, no session). Correct-password unenrolled ADMIN gets403 MFA_ENROLLMENT_REQUIRED and CLI guidance. Verify accepts exactly {type:totp|recovery,code:string}, returns {user} only after atomic commit; invalid/expired/replayed challenges or proof share401 MFA_VERIFICATION_FAILED. Cancel revokes the presented pending challenge through POST /api/auth/mfa/cancel with Origin and clears the scoped cookie. No plaintext token response, enrollment/reset HTTP endpoint or permanent bypass exists. Recovery verification uses the approved single-use hash as the factor and needs no TOTP decryption; unavailable keys never cause a fallback choice.

Enrollment and verification lock users before children, use current clock/window checks after waits, and roll back consumption if session creation fails. All future admin endpoints inherit the global ADMIN+database-MFA policy even if marked Public. Old ADMIN PASSWORD rows are preserved but denied admin capability; enrollment atomically revokes them. Deployment stops writers, migrates/grants, enrolls via one-off matching-image CLI, then starts only new images. Public ingress/PR7 readiness and live Carrier authorization are unchanged and remain outside scope.

## Approved public ingress implementation clarification — 2026-10-17

For NEXORA-024, the owner approved a single maintained Linux VPS/host with Docker Compose, standard Nginx TLS/rate limiting and separate Certbot HTTP-01 issuance/renewal under host operator control. Only ingress80/443 are public; Web/API/PostgreSQL remain unpublished on separated ingress/internal backend networks. Trust is limited to explicit proxy addresses; ingress overwrites client forwarding metadata. No Docker socket or public dashboard. A different load balancer/CDN/topology requires a fresh trust review. This clarification does not authorize exposing the current workspace or invent a domain.

The owner has no selected domain/DNS or actual deployment host yet. Their DNS/certificate/renewal/firewall/host NTP/backup gates remain NOT VERIFIED. Disposable HTTPS integration is separate evidence, never production activation. Existing LOCAL default remains compatible. Public profile requires canonical HTTPS origin and explicit Host/Origin/proxy configuration, Secure cookies, actual mandatory global ADMIN+MFA enforcement and read-only runtime-role verification that all ACTIVE ADMIN users have local credentials, enrollment and readable Identity ciphertext. No toggle can disable MFA; startup failure does not modify credentials/sessions. Future admin Public handlers remain behind the global boundary. Existing cookie paths, separate logout/cancel and all approved custody contracts remain unchanged. See canonical [Deployment](../operations/deployment.md), [Configuration](../operations/configuration.md) and NEXORA-024 for exact operations/evidence.
