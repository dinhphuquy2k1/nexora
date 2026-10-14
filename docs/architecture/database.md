# Database

Only `packages/database` owns Prisma/schema/migrations. Only API infrastructure imports it. Persistent application tables include `stored_files` (real source-file catalog), `users` (identity, explicit role/status), `user_credentials` (optional one-to-one Nexora Scrypt credential), `external_identities` (provider subject binding for uniship operators), and `sessions` (SHA-256 session token hashes with cascade deletion and expiry timestamps). Shipment domain schema is PLANNED; there are no fake smoke tables or business seeds.
`20261006000000_storage_catalog`, `20261012000000_local_authentication`, `20261012010000_unified_identity` and `20261012020000_external_identities` define migrations deployed by `prisma migrate deploy`, gated on PostgreSQL healthy. Repeated deployment preserves existing rows. No reset, db push, migrate dev or demo seed runs at startup.
Integration tests register/read/delete only their own UUID and do not truncate shared data. Persistence smoke runs on disposable projects; see task evidence.

Prisma 7.10.0 uses the PostgreSQL driver adapter; createDatabase stays within the database package. prisma.config.ts reads the server DATABASE_URL for migration, while client generation requires no connection or fabricated database credential.

Database migrations deploy forward-only via `prisma migrate deploy`, preserving existing data across upgrades. Persistent PostgreSQL named volumes retain all data across container restarts and `docker compose down` / `up` cycles. Custom Backup/Restore tooling has been removed per scope reduction ADR-006.

## Unified identity foundation

IMPLEMENTED, verification tracked in NEXORA-011: User maps users; UserCredential maps user_credentials with user_id UUID primary key, foreign key ON DELETE/UPDATE CASCADE and password_hash VARCHAR(255). Users may have zero or one credential; provider-only fixtures need no fake password. Role VARCHAR(16) has NOT NULL, no default and raw SQL users_role_check allowing ADMIN/OPERATOR. Status VARCHAR(16) has NOT NULL, ACTIVE default and users_status_check allowing ACTIVE/DISABLED. Prisma does not express these CHECK constraints; committed SQL owns them. No database/Prisma/TypeScript enums.

The forward-only transaction renames local_users and its primary-key/username index, maps supported trusted legacy accounts to ADMIN, preserves is_active as ACTIVE/DISABLED, copies exact hashes/IDs to credentials and checks snapshots before dropping old columns. Existing sessions and their FK/indexes/token algorithm remain unchanged. Normal upgrade preserves sessions. See [decision](../decisions/unified-identity.md) and [migration/test evidence](../tasks/completed/NEXORA-011-unified-identity-migration.md).

## External identity foundation (Baseline — Scheduled for PR 2 removal)

IMPLEMENTED in PR #10, verification tracked in NEXORA-012; SUPERSEDED by [ADR-007](../decisions/multi-carrier-architecture.md): `ExternalIdentity` maps `external_identities` with `id` UUID primary key, foreign key `user_id` referencing `users(id)` ON DELETE CASCADE, `provider` VARCHAR(32) NOT NULL, `provider_subject` VARCHAR(128) NOT NULL, and timestamps.

- **Constraints**:
  - `chk_external_identities_provider`: raw SQL CHECK constraint restricting `provider` to `'uniship'`.
  - `chk_external_identities_subject_format`: raw SQL CHECK constraint enforcing trimmed, non-empty `provider_subject` (`LENGTH(TRIM(provider_subject)) > 0 AND provider_subject = TRIM(provider_subject)`).
  - Unique constraint `(provider, provider_subject)` enforcing 1:1 binding at the database level.
  - Unique constraint `(user_id, provider)` preventing multiple identities for the same user per provider.
- **PR 2 Forward-Only Drop**:
  Because Nexora has zero real production users, PR 2 drops `external_identities` via a forward-only migration. A separate one-time cleanup script purges test operators.

## Multi-Carrier & MFA Database Schemas (Target Architecture — ADR-007)

Under [ADR-007](../decisions/multi-carrier-architecture.md), the database schema introduces multi-carrier connections, encrypted credentials, operator onboarding tokens, and MFA primitives:

### 1. `operator_setup_tokens` (PR 2)

Supports secure, one-time remote onboarding for OPERATOR users:

```sql
CREATE TABLE operator_setup_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   VARCHAR(64) NOT NULL UNIQUE,
    issued_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at   TIMESTAMPTZ NOT NULL,
    consumed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_operator_setup_tokens_user ON operator_setup_tokens(user_id);
```

- **High-Entropy Token Hash**: Random token is generated via CSPRNG (≥128 bits entropy). Only its SHA-256 hash is persisted in the database; raw tokens are never saved or logged.
- **Short TTL & Single-Use**: Default TTL is 24 hours. Token consumption follows the strict unified lock order (**user row lock → token update**):
  1. Input validation, rate limiting, and SHA-256 token hash computation.
  2. Scrypt password hashing executes strictly **outside** the database transaction to prevent holding DB locks during CPU/memory-intensive work.
  3. Non-locking lookup: `SELECT user_id FROM operator_setup_tokens WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now();` locates candidate `user_id`. If not found, aborts with 400.
  4. Open short database transaction:
     - Lock target user first: `SELECT id, role, status FROM users WHERE id = $user_id FOR UPDATE;`
     - Verify `role = 'OPERATOR'` and `status = 'ACTIVE'` (aborts/rollbacks if violated).
     - Conditional atomic token consumption:
       ```sql
       UPDATE operator_setup_tokens
       SET consumed_at = now()
       WHERE token_hash = $1
         AND user_id = $2
         AND consumed_at IS NULL
         AND expires_at > now()
       RETURNING id;
       ```
       If zero rows returned (token was consumed, invalidated, or expired concurrently), abort and rollback with `400 INVALID_OR_EXPIRED_SETUP_TOKEN`.
     - Verify no existing credential: `SELECT user_id FROM user_credentials WHERE user_id = $user_id;`. If exists, abort with `400 OPERATOR_ALREADY_CONFIGURED`.
     - Insert Scrypt hash into `user_credentials`.
     - Commit transaction.
- **Unified Lock Ordering Invariant**: Every operation modifying setup tokens (`consume`, `reissue`, `disable`) MUST lock the target user row (`users FOR UPDATE`) before modifying `operator_setup_tokens`. Consistent lock ordering prevents PostgreSQL cross-transaction deadlocks.
- **Reissue Invalidation**: Reissuing an onboarding link via `POST /api/admin/operators/:id/setup-link` locks `users` FOR UPDATE, validates `ACTIVE` OPERATOR without credentials, and atomically invalidates all prior unconsumed tokens for that `user_id` (`UPDATE operator_setup_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL;`). Only OPERATOR accounts in `ACTIVE` status without existing credentials in `user_credentials` may have links reissued.
- **Credential Non-Overwrite Constraint**: `POST /api/auth/setup-password` atomically validates under user lock that the user is `ACTIVE` and has NO existing record in `user_credentials`. If credentials already exist, consumption fails (`400 OPERATOR_ALREADY_CONFIGURED`). Setup tokens cannot be used as password resets and cannot overwrite established passwords.
- **Revocation on User Disablement**: Disabling an OPERATOR account atomically marks all unconsumed `operator_setup_tokens` for that user as consumed/invalidated. Account reactivation does NOT resurrect old tokens; a fresh token must be explicitly generated via reissue.
- **Credential Isolation**: ADMIN cannot view or choose the operator's password. Password hash is inserted directly into `user_credentials` when the operator consumes the setup link.

### 2. `carrier_connections` (PR 3)

Tracks carrier connection metadata owned by an individual Nexora user:

```sql
CREATE TABLE carrier_connections (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider            VARCHAR(32) NOT NULL,
    external_account_id VARCHAR(128) NOT NULL,
    login_identifier    VARCHAR(128),
    display_name        VARCHAR(100) NOT NULL,
    status              VARCHAR(32) NOT NULL,
    last_verified_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_carrier_connections_provider CHECK (provider IN ('uniship')),
    CONSTRAINT chk_carrier_connections_status CHECK (status IN ('CONNECTED', 'REAUTH_REQUIRED', 'ERROR')),
    CONSTRAINT uq_carrier_connections_provider_account UNIQUE (provider, external_account_id)
);
CREATE INDEX idx_carrier_connections_user_provider ON carrier_connections(user_id, provider);
```

- **Global Uniqueness**: `UNIQUE (provider, external_account_id)` strictly prohibits binding the same physical carrier account to multiple Nexora users. Attempted duplicate linkage returns a generic error (`400 CANNOT_CONNECT_CARRIER_ACCOUNT`) without leaking cross-user linkages.
- **Ownership**: `user_id` is foreign-keyed to `users.id` with `ON DELETE CASCADE`.
- **Domain Vocabulary & SQL CHECK**: `provider` is persisted domain vocabulary protected by raw SQL CHECK constraint `chk_carrier_connections_provider`. Adding future providers is executed via forward-only migrations modifying this constraint. Prisma enums, PostgreSQL ENUM types, and TypeScript enums are strictly forbidden.
- **Conditional Login Identifier**: `login_identifier` (e.g. username/email) is conditional per adapter and nullable at the schema level to support providers that authenticate via OAuth, bearer tokens, or API keys without login usernames.

### 3. `carrier_connection_secrets` (PR 3)

Separates encrypted credentials (tokens, passwords) from metadata:

```sql
CREATE TABLE carrier_connection_secrets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id       UUID NOT NULL REFERENCES carrier_connections(id) ON DELETE CASCADE,
    secret_type         VARCHAR(32) NOT NULL,
    ciphertext          TEXT NOT NULL,
    nonce               VARCHAR(64) NOT NULL,
    auth_tag            VARCHAR(64) NOT NULL,
    key_version         INTEGER NOT NULL,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_carrier_secrets_type CHECK (secret_type IN ('ACCESS_TOKEN', 'REFRESH_TOKEN', 'PASSWORD')),
    CONSTRAINT uq_carrier_secrets_connection_type UNIQUE (connection_id, secret_type)
);
```

- **Encryption**: AES-256-GCM. AAD binds `connection_id:user_id:provider:secret_type`.
- **Default Password Persistence**: Carrier passwords are encrypted and stored by default upon connection. Disconnection cascades deletion of all secret rows.

### 4. Session Assurance & MFA Tables (PR 6)

- **`sessions.auth_level` (Deferred to PR 6)**: The physical database column `sessions.auth_level` is introduced exclusively in Logical PR 6 (`ALTER TABLE sessions ADD COLUMN auth_level VARCHAR(16) NOT NULL DEFAULT 'PASSWORD'`, with `CONSTRAINT chk_sessions_auth_level CHECK (auth_level IN ('PASSWORD', 'MFA'))`).
  - **PR 2 → Prior to PR 6**: The database table `sessions` does NOT possess an `auth_level` column. Schema migrations in PR 2..5 do not read, write, or require this column. In this interim milestone, administrative authorization on loopback/local relies strictly on opaque session lookup, validity, and the linked user's `role === 'ADMIN'`. "PASSWORD" in PR 2..5 is strictly a logical assurance classification, NOT a database field.
  - **PR 6 Onward**: Session migration assigns `PASSWORD` to all existing active sessions without downtime. Administrative endpoints then enforce `role === 'ADMIN'` AND `auth_level === 'MFA'`. Password-only administrative sessions are rejected or revoked.
  - **PR 7**: Public HTTPS profile verifies at application boot that MFA enforcement is active; zero admin endpoints bypass MFA.
- **`user_mfa`**: Stores TOTP configuration for ADMIN users:
  ```sql
  CREATE TABLE user_mfa (
      user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      totp_secret_ciphertext  TEXT NOT NULL,
      nonce                   VARCHAR(64) NOT NULL,
      auth_tag                VARCHAR(64) NOT NULL,
      key_version             INTEGER NOT NULL,
      enabled_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_step          BIGINT NOT NULL
  );
  ```
  `last_used_step` is initialized during CLI enrollment to the exact TOTP time-step of the confirmation code, preventing initial replay.
- **`mfa_challenges`**: Ephemeral pending MFA challenges:
  ```sql
  CREATE TABLE mfa_challenges (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash   VARCHAR(64) NOT NULL UNIQUE,
      expires_at   TIMESTAMPTZ NOT NULL,
      consumed_at  TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```
- **`mfa_recovery_codes`**: Single-use backup codes:
  ```sql
  CREATE TABLE mfa_recovery_codes (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash   VARCHAR(64) NOT NULL,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_mfa_recovery_codes_user ON mfa_recovery_codes(user_id);
  ```

### 5. Concurrency & Transactional Invariants

- **Last Active Admin Invariant & Advisory Lock Protocol**: Row-level locking alone (`SELECT ... ORDER BY id ASC FOR UPDATE`) is vulnerable to deadlocks if another transaction previously locked a target user row. Therefore, any operation reducing active administrators (account disablement, role demotion, self-disablement) must adhere to a strict cluster-wide protocol:
  1. Acquire a dedicated transaction-level PostgreSQL advisory lock:
     ```sql
     SELECT pg_advisory_xact_lock(hashtext('nexora_active_admin_invariant'));
     ```
  2. Inside the same transaction, count active administrators:
     ```sql
     SELECT count(*) FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE';
     ```
  3. If count is `<= 1` and the target user is an active admin, abort with `400 CANNOT_DISABLE_LAST_ADMIN` (or `CANNOT_DEMOTE_LAST_ADMIN`).
  4. Lock the target user row (`SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE;`) and execute the status/role mutation.
  - The transaction-level advisory lock acquired before user-row locks serializes administrative operations that reduce active administrators adhering to this protocol, preventing lock-ordering deadlocks and race conditions specifically between those administrative mutations while strictly guaranteeing that the active administrator count never falls to zero.
  - _Strict Rule_: Transactions holding advisory locks or row locks are never held across HTTP requests or slow I/O.
- **CLI TOTP Enrollment Protocol (No Locks During Interactive Input)**:
  1. CLI prompts for password via hidden terminal prompt; Scrypt hash verification executes outside the transaction.
  2. Candidate TOTP secret and recovery codes generated; confirmation code prompted and verified against secret outside the transaction.
  3. After confirmation code verification, open a short database transaction:
     - `SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE;`
     - Verify `status = 'ACTIVE'`, `role = 'ADMIN'`, and that `user_credentials.password_hash` exactly equals the verified hash.
     - Insert `user_mfa` (with `last_used_step` set to the confirmed code step), insert recovery code hashes, and atomically delete all sessions and MFA challenges for that user.
     - Commit transaction.
  4. Print recovery codes to the terminal once only after successful transaction commit.
  - _Strict Rule_: Never hold a database transaction or row lock while awaiting CLI user interaction.
- **Password-Hash Recheck in Session/Challenge Issuance**: Scrypt password verification runs outside the database transaction. Subsequently, inside a short transaction:
  ```sql
  SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE;
  ```
  The transaction verifies `status = 'ACTIVE'`, expected role, and re-checks that `user_credentials.password_hash` exactly equals the verified hash before inserting into `sessions` or `mfa_challenges`.
- **Atomic Challenge & Session Revocation**: Any password update, role change, MFA reset, or account disablement atomically revokes all sessions and all pending challenges:
  ```sql
  DELETE FROM sessions WHERE user_id = $1;
  DELETE FROM mfa_challenges WHERE user_id = $1;
  ```
- **Stage-Aware Progressive User Disablement Transaction**: User disablement responsibilities expand incrementally across milestones. Each PR only queries tables physically existing in its schema stage; using `catch` blocks or raw SQL `IF EXISTS` to mask unmigrated tables is strictly prohibited.
  - **Logical PR 2**:
    1. Acquire advisory lock if disabling an ADMIN (`SELECT pg_advisory_xact_lock(...)`).
    2. Lock target user row: `SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE;`
    3. Update `users.status = 'DISABLED'`.
    4. Revoke active sessions: `DELETE FROM sessions WHERE user_id = $1;`
    5. Invalidate unconsumed setup tokens: `UPDATE operator_setup_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL;`
    6. Commit transaction. (Zero queries or deletions against carrier secrets or MFA challenge tables).
  - **Logical PR 3 (Carrier Extension)**:
    Extends the PR 2 transaction to clean up carrier connection credentials: 7. Delete all carrier connection secrets: `DELETE FROM carrier_connection_secrets WHERE connection_id IN (SELECT id FROM carrier_connections WHERE user_id = $1);` 8. Update carrier connections status: `UPDATE carrier_connections SET status = 'REAUTH_REQUIRED' WHERE user_id = $1;`
  - **Logical PR 6 (MFA Extension)**:
    Extends the PR 3 transaction to revoke MFA challenges: 9. Delete all pending MFA challenges: `DELETE FROM mfa_challenges WHERE user_id = $1;`
  - _Note_: Reactivation of a user does NOT restore invalidated setup tokens or deleted carrier secrets. A new setup link must be explicitly issued via `POST /api/admin/operators/:id/setup-link`.
- **Pre-Commit Write Validation**: Before persisting renewed tokens or secrets, transactions lock the user row to ensure the account remains `ACTIVE`. In-flight responses arriving after disablement are safely discarded.
