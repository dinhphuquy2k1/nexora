# Database

Only `packages/database` owns Prisma/schema/migrations. Only API infrastructure imports it. Persistent application tables include `stored_files` (real source-file catalog), `users` (identity, explicit role/status), `user_credentials` (optional one-to-one Nexora Scrypt credential), `external_identities` (provider subject binding for uniship operators), and `sessions` (SHA-256 session token hashes with cascade deletion and expiry timestamps). Shipment domain schema is PLANNED; there are no fake smoke tables or business seeds.
`20261006000000_storage_catalog`, `20261012000000_local_authentication`, `20261012010000_unified_identity` and `20261012020000_external_identities` define migrations deployed by `prisma migrate deploy`, gated on PostgreSQL healthy. Repeated deployment preserves existing rows. No reset, db push, migrate dev or demo seed runs at startup.
Integration tests register/read/delete only their own UUID and do not truncate shared data. Persistence smoke runs on disposable projects; see task evidence.

Prisma 7.10.0 uses the PostgreSQL driver adapter; createDatabase stays within the database package. prisma.config.ts reads the server DATABASE_URL for migration, while client generation requires no connection or fabricated database credential.

Database migrations deploy forward-only via `prisma migrate deploy`, preserving existing data across upgrades. Persistent PostgreSQL named volumes retain all data across container restarts and `docker compose down` / `up` cycles. Custom Backup/Restore tooling has been removed per scope reduction ADR-006.

## Unified identity foundation

IMPLEMENTED, verification tracked in NEXORA-011: User maps users; UserCredential maps user_credentials with user_id UUID primary key, foreign key ON DELETE/UPDATE CASCADE and password_hash VARCHAR(255). Users may have zero or one credential; provider-only fixtures need no fake password. Role VARCHAR(16) has NOT NULL, no default and raw SQL users_role_check allowing ADMIN/OPERATOR. Status VARCHAR(16) has NOT NULL, ACTIVE default and users_status_check allowing ACTIVE/DISABLED. Prisma does not express these CHECK constraints; committed SQL owns them. No database/Prisma/TypeScript enums.

The forward-only transaction renames local_users and its primary-key/username index, maps supported trusted legacy accounts to ADMIN, preserves is_active as ACTIVE/DISABLED, copies exact hashes/IDs to credentials and checks snapshots before dropping old columns. Existing sessions and their FK/indexes/token algorithm remain unchanged. Normal upgrade preserves sessions. See [decision](../decisions/unified-identity.md) and [migration/test evidence](../tasks/completed/NEXORA-011-unified-identity-migration.md).

## External identity foundation

IMPLEMENTED in PR #10, verification tracked in NEXORA-012: `ExternalIdentity` maps `external_identities` with `id` UUID primary key, foreign key `user_id` referencing `users(id)` ON DELETE CASCADE, `provider` VARCHAR(32) NOT NULL, `provider_subject` VARCHAR(128) NOT NULL, and timestamps.

- **Constraints**:
  - `chk_external_identities_provider`: raw SQL CHECK constraint restricting `provider` to `'uniship'`.
  - `chk_external_identities_subject_format`: raw SQL CHECK constraint enforcing trimmed, non-empty `provider_subject` (`LENGTH(TRIM(provider_subject)) > 0 AND provider_subject = TRIM(provider_subject)`).
  - Unique constraint `(provider, provider_subject)` enforcing 1:1 binding at the database level.
  - Unique constraint `(user_id, provider)` preventing multiple identities for the same user per provider.
- **Manual SQL Registration**:
  Authorized database administrators preregister operators using `scripts/sql/register-uniship-operator.sql` via `psql -v username="<name>" -v uniship_userid="<id>"`. The script runs in a single transaction, validates inputs, generates a UUID via `gen_random_uuid()`, and atomically inserts one row into `users` (`role = 'OPERATOR'`, `status = 'ACTIVE'`) and one row into `external_identities` (`provider = 'uniship'`), with zero rows in `user_credentials`.
