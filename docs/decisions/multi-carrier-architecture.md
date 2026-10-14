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
   - **Global Uniqueness & Generic Error**: A physical carrier account is strictly bound to at most one Nexora user at any given time. The database enforces a global unique constraint on `(provider, external_account_id)`. Two users cannot link the same carrier account simultaneously. Attempted duplicate linkage returns a generic error (`CANNOT_CONNECT_CARRIER_ACCOUNT`) without disclosing whether the carrier account is already linked to another user. Detailed duplicate conflicts are recorded strictly in the server-side security audit log.
   - **Conditional Login Identifier**: `login_identifier` (e.g. username/email) is conditional per adapter and nullable at the schema level to accommodate providers that rely solely on OAuth, API keys, or bearer tokens without username/email credentials.

5. **Mandatory Encrypted Credential Storage & Key Hierarchy**:
   - Carrier connection credentials (access tokens, refresh tokens, and passwords) are encrypted using **AES-256-GCM** with a cryptographically secure 96-bit random nonce generated per encryption operation.
   - **Authenticated Associated Data (AAD)** binds `connection_id:user_id:provider:secret_type` to prevent ciphertext swapping between connections, users, or secret types.
   - Subkeys are derived using HKDF with strict purpose separation (`CARRIER_TOKEN` vs `CARRIER_PASSWORD`).
   - Shared cryptographic primitives (`AES-256-GCM`, HKDF, nonce generation, and key versioning) reside in `apps/api/src/common/crypto/`. Neither Identity nor Carrier modules import crypto logic from each other.
   - **Separate Master Keys**: The Carrier Master Key is strictly isolated from the Identity Master Key. A corruption or unavailability of the carrier key prevents carrier API calls but never blocks administrative login or system operations.
   - **Default Encrypted Password Storage**: Carrier passwords are encrypted and persisted by default upon connection to enable automated re-login when tokens expire. There is no opt-in checkbox or configuration toggle. The UI explicitly discloses that carrier passwords are stored encrypted for session recovery and are destroyed upon disconnection.
   - **Durable Audit & Fail-Closed Decryption**: Re-login password decryption is restricted to authorized API infrastructure services and requires an immutable security audit log entry via `SecurityAuditPort`. If the audit sink is unavailable or fails to persist the audit record, the operation MUST fail-closed: decryption is aborted and no re-login is attempted.
   - Missing or corrupted master keys result in fail-closed errors; they never overwrite ciphertexts, fabricate mock credentials, or degrade connection status to `REAUTH_REQUIRED`.

6. **Token Verification Protocol (`api-token-verify`)**:
   - For Uniship, access tokens must be cryptographically verified against the provider before use:
     - Upon login / re-login: verify that `user.userid` returned by `POST /client/api-token-auth/` matches the connection's `external_account_id`.
     - Upon token receipt or refresh: invoke `POST /client/api-token-verify/` with the candidate token and confirm that the returned `user.userid` matches `external_account_id`.
   - Token verification is executed strictly upon token acquisition or replacement, not before every operational request.
   - Mismatched identity transitions the connection to `REAUTH_REQUIRED` and permanently suppresses automated re-login until manually reconnected by the owner.
   - Network or server errors during verification transition the connection to `ERROR` with backoff; unverified tokens are never utilized.

7. **ADMIN TOTP Multi-Factor Authentication (PR 6)**:
   - All `ADMIN` users must complete RFC 6238 TOTP (SHA-1, 6 digits, 30-second step, ±1 step tolerance) before receiving an administrative session.
   - **CLI Enrollment Only & `last_used_step` Initialization**: MFA secret generation and enrollment are performed exclusively via an interactive server-side CLI (`dist/cli/mfa-enroll.js`). The CLI prompts for the admin's Nexora password, opens a transaction locking the `users` row (`SELECT ... FOR UPDATE`), verifies `status = 'ACTIVE'` and `role = 'ADMIN'`, prompts for an initial confirmation code, verifies it, and initializes `user_mfa.last_used_step` to the exact TOTP time-step of that confirmation code. This guarantees that the enrollment confirmation code cannot be replayed for the initial login. No public or internal HTTP endpoint allows MFA registration or bypass.
   - **Atomic Two-Step Authentication**:
     1. Password verification issues an ephemeral pending MFA challenge token stored in an `HttpOnly`, `SameSite=Strict` cookie (path `/api/auth/mfa`, TTL 5 minutes) and persists the token's SHA-256 hash in `mfa_challenges`. No session is created.
     2. `POST /api/auth/mfa/verify` is decorated with `@Public()` to bypass the global `SessionGuard`, but strictly enforces `OriginGuard`, presence of a valid pending MFA challenge token cookie, account-level rate limiting, and replay prevention. Inside a single database transaction, the pending challenge is consumed atomically (`UPDATE mfa_challenges SET consumed_at = now() WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING user_id;`), `user_mfa.last_used_step` is updated (`WHERE last_used_step < $2`) to prevent replay attacks, and a session with `auth_level = 'MFA'` is issued.
   - **Password-Hash Recheck in Session/Challenge Issuance**: Scrypt password verification runs outside the database transaction. Subsequently, inside a short transaction, the server locks the user row (`SELECT ... FROM users ... FOR UPDATE`), verifies `status = 'ACTIVE'`, expected role, and strictly re-verifies that `user_credentials.password_hash` exactly matches the hash used for the Scrypt verification. Any mismatch indicates a concurrent password change and immediately aborts issuance.
   - **Atomic Challenge Revocation**: Password changes, role modifications, account disablement, and MFA resets atomically delete all active sessions (`sessions`) AND all pending challenges (`mfa_challenges`) for that user within the same database transaction.
   - **Single-Use Recovery Codes**: Enrollment generates 10 high-entropy recovery codes (≥80 bits CSPRNG). Nexora stores only their SHA-256 hashes. Recovery codes are consumed atomically.
   - **Session Assurance**: Database table `sessions` includes `auth_level` (`VARCHAR(16) NOT NULL DEFAULT 'PASSWORD'`). Every administrative route checks both `role === 'ADMIN'` and `auth_level === 'MFA'` per request.

8. **Public HTTPS Release Gate (PR 7)**:
   - ADMIN and OPERATOR access over public HTTPS is authorized subject to strict release gates:
     1. **Mandatory Hard Dependency**: Public profile requires PR 6 (ADMIN TOTP MFA). At application boot in the public profile, the API **refuses to start** if MFA enforcement is disabled.
     2. **Ingress Security**: Strict TLS, `Secure` cookie attributes, server-configured Origin and Host allowlists, trusted proxy configuration, and ingress rate limiting.
     3. **Host NTP Clock Synchronization**: The host operating system running Docker containers must run an active NTP daemon (`chrony` or `systemd-timesyncd`). Operators verify clock synchronization via `timedatectl` during deployment runbook execution.
     4. Remote operator onboarding uses single-use, time-bounded setup links delivered over secure HTTPS.

9. **Concurrency & Database Transaction Invariants**:
   - **Last Active Admin Invariant & Deterministic Lock Ordering**: To prevent accidental lockout or race conditions that leave zero active administrators, and to prevent deadlocks between concurrent operations, any mutation reducing active admins (disablement, role demotion) must acquire row-level locks on all active admin rows in a deterministic order:
     ```sql
     SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' ORDER BY id ASC FOR UPDATE;
     ```
     Using deterministic `ORDER BY id ASC` prevents PostgreSQL deadlocks between concurrent administrative updates.
   - **User Disablement**: Disabling a user atomically sets `status = 'DISABLED'`, revokes all active sessions, deletes all carrier connection secrets, and sets connection statuses to `REAUTH_REQUIRED`. Subsequent late-arriving carrier HTTP responses cannot recreate secrets.
   - **Connection Deletion**: Disconnection is implemented as a hard delete (`DELETE FROM carrier_connections WHERE id = $1`), atomically removing the connection and cascading to all associated secrets.
   - **Singleflight Concurrency**: In-memory singleflight deduplicates simultaneous carrier token refresh requests within a single API instance. Database transactions are never held across external HTTP carrier calls.

10. **Delivery Phases (6 PR Plan)**:
    - **PR 1**: Architecture, Security & API Contracts (Documentation only; current task).
    - **PR 2**: Unified Local Login, RBAC, Operator Onboarding & Legacy Provider Removal (PR 5 merged here). Drops `external_identities`, relocates Uniship HTTP client to `carrier/infrastructure/uniship/`.
    - **PR 3**: Carrier Connections Foundation & Encrypted Secrets (`carrier_connections`, `carrier_connection_secrets`, `common/crypto/`, master key custody).
    - **PR 4**: Uniship Carrier Adapter & Management UI (Connection workflow, `api-token-verify`, encrypted password persistence, UI under Settings > Carriers). _Merge Gate_: Requires confirmed carrier credential storage terms.
    - **PR 6**: ADMIN TOTP MFA (`user_mfa`, `mfa_challenges`, `mfa_recovery_codes`, `sessions.auth_level`, CLI enrollment). _Depends solely on PR 2_.
    - **PR 7**: Public HTTPS Profile & Ingress Hardening. _Hard-gated on PR 6_.

## Implementation Invariants

- **Boundary Isolation**: Domain and application layers remain strictly Prisma-free. Only API infrastructure boundaries consume database models via `@nexora/database`. Web never imports API source or touches the database.
- **Type Vocabulary**: All domain statuses and types use `as const` objects with derived TypeScript unions, stored as scalar `VARCHAR` strings with raw PostgreSQL SQL CHECK constraints. Prisma and PostgreSQL ENUMs are forbidden.
- **Product Scope Boundaries**: This milestone does not introduce `shipments`, `tracking_events`, background job workers, Redis, Kafka, or automated synchronization loops. All carrier API interactions are executed strictly on-demand.
