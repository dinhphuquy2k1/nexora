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
   - **Administrative Carrier Endpoints Deferred Post-PR 6**: Administrative carrier endpoints (`GET /api/admin/carrier-connections`, `DELETE /api/admin/carrier-connections/:id`) require both `role === 'ADMIN'` AND `auth_level === 'MFA'`. Because MFA is introduced in Logical PR 6, these administrative carrier endpoints are deferred to a post-PR 6 follow-up task. PR 6 does NOT depend on PR 3 or PR 4, and Public HTTPS (PR 7) does not wait for administrative carrier endpoints. Until implemented, administrative cross-user maintenance is executed via an interim CLI runbook (`dist/cli/carrier-admin.js`) run directly by authorized server administrators.

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
   - **Session Assurance**: Database table `sessions` includes `auth_level` (`VARCHAR(16) NOT NULL DEFAULT 'PASSWORD'`). Every administrative route checks both `role === 'ADMIN'` and `auth_level === 'MFA'` per request.

8. **Operator Onboarding & Public HTTPS Release Gate (PR 2 & PR 7)**:
   - **One-Time Operator Setup Link Contract (PR 2)**:
     - ADMIN creates an operator account via `POST /api/admin/operators` (`{ username }`), creating `users` with `role = 'OPERATOR'`, `status = 'ACTIVE'`, and no password credential.
     - The API generates a high-entropy cryptographically secure random token (CSPRNG, ≥128 bits entropy).
     - The database table `operator_setup_tokens` stores `(id, user_id, token_hash, issued_by, expires_at, consumed_at, created_at)`. Only the SHA-256 hash is persisted.
     - Token has a short TTL (24 hours) and is strictly single-use.
     - Reissuing an onboarding link atomically invalidates any prior unconsumed tokens for that `user_id`.
     - The operator consumes the token via `POST /api/auth/setup-password` (`{ token, password }`), decorated with `@Public()` and `OriginGuard`. Inside a short transaction, the token is consumed atomically (`UPDATE operator_setup_tokens SET consumed_at = now() WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING user_id;`), the user row is locked and validated (`status = 'ACTIVE'`), and the Scrypt password hash is persisted to `user_credentials`.
     - Administrators CANNOT read or set operator passwords. Setup tokens are NEVER logged or exposed in error responses.
     - Scope: PR 2 implements and verifies onboarding in local/test environments. PR 7 verifies remote employee password setup over HTTPS. General email/SMS delivery systems are excluded from this milestone.
   - **Public HTTPS Release Gate (PR 7)**:
     - ADMIN and OPERATOR access over public HTTPS is authorized subject to strict release gates:
       1. **Mandatory Hard Dependency**: Public profile requires PR 6 (ADMIN TOTP MFA). At application boot in the public profile, the API **refuses to start** if MFA enforcement is disabled.
       2. **Ingress Security**: Strict TLS, `Secure` cookie attributes, server-configured Origin and Host allowlists, trusted proxy configuration, and ingress rate limiting.
       3. **Host NTP Clock Synchronization**: The host operating system running Docker containers must run an active NTP daemon (`chrony` or `systemd-timesyncd`). Operators verify clock synchronization via `timedatectl` during deployment runbook execution.

9. **Concurrency & Database Transaction Invariants**:
   - **Last Active Admin Invariant & Advisory Lock Protocol**: To prevent accidental lockout or race conditions that leave zero active administrators, and to completely eliminate deadlock hazards between concurrent transactions, any operation reducing active admins (disablement, role demotion, self-disablement) MUST adhere to the following protocol:
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
     - The advisory lock serializes all admin-reduction operations across the entire database cluster, eliminating lock-order deadlocks and ensuring a zero active admin state is unreachable.
     - Invariant: Transactions holding advisory locks or row locks are NEVER held across HTTP calls or slow operations.
   - **User Disablement**: Disabling a user atomically sets `status = 'DISABLED'`, revokes all active sessions, deletes all carrier connection secrets, and sets connection statuses to `REAUTH_REQUIRED`. Subsequent late-arriving carrier HTTP responses cannot recreate secrets.
   - **Connection Deletion**: Disconnection is implemented as a hard delete (`DELETE FROM carrier_connections WHERE id = $1`), atomically removing the connection and cascading to all associated secrets.
   - **Singleflight Concurrency**: In-memory singleflight deduplicates simultaneous carrier token refresh requests within a single API instance. Database transactions are never held across external HTTP carrier calls.

10. **Delivery Phases (6 PR Plan)**:
    - **PR 1**: Architecture, Security & API Contracts (Documentation only; current task).
    - **PR 2**: Unified Local Login, RBAC, Operator Onboarding (`operator_setup_tokens`, setup link flow), Last Active Admin Advisory Lock & Legacy Provider Removal (PR 5 merged here). Drops `external_identities`, relocates Uniship HTTP client to `carrier/infrastructure/uniship/`.
    - **PR 3**: Carrier Connections Foundation & Encrypted Secrets (`carrier_connections` with SQL CHECK for provider, `carrier_connection_secrets`, `common/crypto/`, master key custody). Admin carrier endpoints deferred post-PR 6.
    - **PR 4**: Uniship Carrier Adapter & Management UI (Connection workflow, `api-token-verify`, encrypted password persistence, UI under Settings > Carriers). _Live Merge Gate_: Requires verified `api-token-verify` contract, TTL, rate limits, and re-login authorization.
    - **PR 6**: ADMIN TOTP MFA (`user_mfa`, `mfa_challenges`, `mfa_recovery_codes`, `sessions.auth_level`, CLI enrollment without DB locks during prompt). _Depends solely on PR 2_.
    - **PR 7**: Public HTTPS Profile, Remote Operator Password Setup & Ingress Hardening. _Hard-gated on PR 6_.

11. **Threat Model & Implementation Test Plan Matrix**:

| #   | Threat                                       | Security Mitigation                                                                                                                                                                                | Acceptance Test Specification                                                                                                                                            | Target Logical PR |
| :-- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| 1   | **Credential Stuffing & Carrier Abuse**      | Per-user rate limiting on connect/reconnect; singleflight request deduplication; carrier outbound budgets; fail-closed on 429.                                                                     | Burst of 20 connect requests is throttled at 429; concurrent requests for same connection share single outbound carrier call.                                            | PR 4              |
| 2   | **Duplicate Account Enumeration**            | Global unique constraint `(provider, external_account_id)`; identical generic error `400 CANNOT_CONNECT_CARRIER_ACCOUNT` for bad credentials and duplicate linkage; audit log records exact cause. | Connecting already-linked account returns identical status/body as invalid credentials; no username/owner leakage; security audit contains duplicate conflict event.     | PR 3, PR 4        |
| 3   | **Cross-User Carrier Access**                | All carrier connection endpoints enforce `user_id` ownership from session; DB foreign key cascade; admin sessions forbidden from decrypting or invoking carrier APIs on behalf of others.          | User B cannot view, patch, reconnect, or delete User A's connection (returns 404); Admin cannot call carrier APIs on user connections.                                   | PR 3, PR 4        |
| 4   | **Key Failure & AAD Tampering**              | AES-256-GCM authenticated encryption; AAD binds `connection_id:user_id:provider:secret_type`; missing/corrupt keys fail-closed.                                                                    | Swapping ciphertext between secret types or connections fails GCM authentication; corrupted master key aborts without overwriting data or downgrading status.            | PR 3              |
| 5   | **Password Decryption Without Audit**        | Decrypting saved passwords for re-login requires persisting an audit event via `SecurityAuditPort`; if audit sink fails, decryption immediately aborts.                                            | Mock failing audit sink during automated re-login -> password decryption is aborted, connection transitions to ERROR, no carrier call executed.                          | PR 4              |
| 6   | **Disable / Connect / Reconnect Races**      | User disablement atomically purges secrets and marks connections `REAUTH_REQUIRED`; pre-commit write validation checks user is `ACTIVE`.                                                           | Trigger carrier reconnect then disable user before HTTP response completes -> late response cannot persist new tokens; secrets remain deleted.                           | PR 3, PR 4        |
| 7   | **Password Change ↔ Session Issuance Race** | Short transaction re-checks `password_hash` equality against the verified hash under row lock before creating session or MFA challenge.                                                            | Simulate password change between Scrypt verification and session insertion -> transaction detects hash mismatch and aborts issuance.                                     | PR 2, PR 6        |
| 8   | **Last Active Admin Race**                   | Transaction-level advisory lock (`pg_advisory_xact_lock`) acquired before row locks; active admin count verified inside same transaction.                                                          | Two concurrent requests to disable the last two active admins -> advisory lock serializes; exactly one succeeds, one fails; 0 active admins is impossible; no deadlocks. | PR 2              |
| 9   | **MFA Challenge & Recovery Replay**          | Atomic challenge consumption (`UPDATE ... SET consumed_at = now() WHERE consumed_at IS NULL`); `last_used_step` monotonic check; single-use recovery code hashes.                                  | Replaying consumed challenge token returns 401; replaying TOTP code within same 30s step returns 401; reused recovery code returns 401.                                  | PR 6              |
| 10  | **Public Ingress, CSRF & Proxy Spoofing**    | Strict `OriginGuard` on mutations; `SameSite=Strict` cookies; trusted proxy hop validation; public startup gate requires MFA.                                                                      | Untrusted Origin returns 403; public profile fails boot if MFA enforcement disabled; spoofed X-Forwarded-\* headers rejected by linklocal proxy config.                  | PR 7              |
| 11  | **Token Verification Identity Mismatch**     | Candidate tokens verified against `POST /client/api-token-verify/`; response `user.userid` must match `external_account_id`.                                                                       | Mock token verify returning different `userid` -> connection immediately transitions to `REAUTH_REQUIRED`, automated re-login permanently disabled.                      | PR 4              |

## Implementation Invariants

- **Boundary Isolation**: Domain and application layers remain strictly Prisma-free. Only API infrastructure boundaries consume database models via `@nexora/database`. Web never imports API source or touches the database.
- **Type Vocabulary**: All domain statuses and types use `as const` objects with derived TypeScript unions, stored as scalar `VARCHAR` strings with raw PostgreSQL SQL CHECK constraints. Prisma and PostgreSQL ENUMs are forbidden.
- **Product Scope Boundaries**: This milestone does not introduce `shipments`, `tracking_events`, background job workers, Redis, Kafka, or automated synchronization loops. All carrier API interactions are executed strictly on-demand.
