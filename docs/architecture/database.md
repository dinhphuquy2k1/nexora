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

Under [ADR-007](../decisions/multi-carrier-architecture.md), the database schema introduces multi-carrier connections, encrypted credentials, and MFA primitives:

### 1. `carrier_connections` (PR 3)

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
    CONSTRAINT chk_carrier_connections_status CHECK (status IN ('CONNECTED', 'REAUTH_REQUIRED', 'ERROR')),
    CONSTRAINT uq_carrier_connections_provider_account UNIQUE (provider, external_account_id)
);
CREATE INDEX idx_carrier_connections_user_provider ON carrier_connections(user_id, provider);
```

- **Global Uniqueness**: `UNIQUE (provider, external_account_id)` strictly prohibits binding the same physical carrier account to multiple Nexora users.
- **Ownership**: `user_id` is foreign-keyed to `users.id` with `ON DELETE CASCADE`.
- **Conditional Login Identifier**: `login_identifier` (e.g. username/email) is conditional per adapter and nullable at the schema level to support providers that authenticate via OAuth, bearer tokens, or API keys without login usernames.

### 2. `carrier_connection_secrets` (PR 3)

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

### 3. Session Assurance & MFA Tables (PR 6)

- **`sessions.auth_level`**: Added in PR 6 with `DEFAULT 'PASSWORD'`, `NOT NULL`, and `CHECK (auth_level IN ('PASSWORD', 'MFA'))`. Session migration assigns `PASSWORD` to all existing sessions without downtime.
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

### 4. Concurrency & Transactional Invariants

- **Last Active Admin Invariant & Deterministic Lock Ordering**: Any mutation decreasing active administrators executes inside a short transaction that locks all active admin rows using deterministic lock ordering to prevent deadlocks:
  ```sql
  SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' ORDER BY id ASC FOR UPDATE;
  ```
  This prevents concurrent disablement/demotion from reducing active administrators to zero and eliminates deadlock hazards between concurrent transactions.
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
- **User Disablement**: Executed in a single atomic transaction:
  1. `SELECT id FROM users WHERE id = $1 FOR UPDATE;`
  2. Update `users.status = 'DISABLED'`.
  3. Delete all sessions (`DELETE FROM sessions WHERE user_id = $1;`).
  4. Delete all pending challenges (`DELETE FROM mfa_challenges WHERE user_id = $1;`).
  5. Delete all carrier connection secrets (`DELETE FROM carrier_connection_secrets WHERE connection_id IN (SELECT id FROM carrier_connections WHERE user_id = $1);`).
  6. Update carrier connections status to `'REAUTH_REQUIRED'`.
- **Pre-Commit Write Validation**: Before persisting renewed tokens or secrets, transactions lock the user row to ensure the account remains `ACTIVE`. In-flight responses arriving after disablement are safely discarded.
