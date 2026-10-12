# Database

Only `packages/database` owns Prisma/schema/migrations. Only API infrastructure imports it. Persistent application tables include `stored_files` (real source-file catalog), `users` (identity, explicit role/status), `user_credentials` (optional one-to-one Nexora Scrypt credential), and `sessions` (SHA-256 session token hashes with cascade deletion and expiry timestamps). Shipment domain schema is PLANNED; there are no fake smoke tables or business seeds.
`20261006000000_storage_catalog`, `20261012000000_local_authentication` and `20261012010000_unified_identity` define migrations deployed by `prisma migrate deploy`, gated on PostgreSQL healthy. Repeated deployment preserves existing rows. No reset, db push, migrate dev or demo seed runs at startup.
Integration tests register/read/delete only their own UUID and do not truncate shared data. Persistence/backup smoke runs on disposable projects; see task evidence.

Prisma 7.10.0 uses the PostgreSQL driver adapter; createDatabase stays within the database package. prisma.config.ts reads the server DATABASE_URL for migration, while client generation requires no connection or fabricated database credential.

Recovery uses the dump's actual migration history: restore the database first, then deploy missing committed migrations through the existing migration runner, then invalidate all target sessions before API/Web use. Current backups preserve operator IDs/password hashes; pre-authentication backups gain the auth schema without default accounts. No migration/checksum or schema reset is introduced. The procedure and compatibility/failure contract are owned by [Backup and restore](../operations/backup-restore.md).

## Unified identity foundation

IMPLEMENTED, verification tracked in NEXORA-011: User maps users; UserCredential maps user_credentials with user_id UUID primary key, foreign key ON DELETE/UPDATE CASCADE and password_hash VARCHAR(255). Users may have zero or one credential; provider-only fixtures need no fake password. Role VARCHAR(16) has NOT NULL, no default and raw SQL users_role_check allowing ADMIN/OPERATOR. Status VARCHAR(16) has NOT NULL, ACTIVE default and users_status_check allowing ACTIVE/DISABLED. Prisma does not express these CHECK constraints; committed SQL owns them. No database/Prisma/TypeScript enums.

The forward-only transaction renames local_users and its primary-key/username index, maps supported trusted legacy accounts to ADMIN, preserves is_active as ACTIVE/DISABLED, copies exact hashes/IDs to credentials and checks snapshots before dropping old columns. Existing sessions and their FK/indexes/token algorithm remain unchanged. Normal upgrade preserves sessions; isolated restore deletes target sessions. No external/provider table exists. See [decision](../decisions/unified-identity.md) and [migration/test evidence](../tasks/completed/NEXORA-011-unified-identity-migration.md).
