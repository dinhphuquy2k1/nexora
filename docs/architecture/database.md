# Database

Only `packages/database` owns Prisma/schema/migrations. Only API infrastructure imports it. Persistent application tables include `stored_files` (real source-file catalog), `local_users` (local operator identities and Scrypt password hashes), and `sessions` (SHA-256 session token hashes with cascade deletion and expiry timestamps). Shipment domain schema is PLANNED; there are no fake smoke tables or business seeds.
`20261006000000_storage_catalog` and `20261012000000_local_authentication` define migrations deployed by `prisma migrate deploy`, gated on PostgreSQL healthy. Repeated deployment preserves existing rows. No reset, db push, migrate dev or demo seed runs at startup.
Integration tests register/read/delete only their own UUID and do not truncate shared data. Persistence/backup smoke runs on disposable projects; see task evidence.

Prisma 7.10.0 uses the PostgreSQL driver adapter; createDatabase stays within the database package. prisma.config.ts reads the server DATABASE_URL for migration, while client generation requires no connection or fabricated database credential.

Recovery uses the dump's actual migration history: restore the database first, then deploy missing committed migrations through the existing migration runner, then invalidate all target sessions before API/Web use. Current backups preserve operator IDs/password hashes; pre-authentication backups gain the auth schema without default accounts. No migration/checksum or schema reset is introduced. The procedure and compatibility/failure contract are owned by [Backup and restore](../operations/backup-restore.md).

## Planned unified identity foundation

PLANNED, not present in this schema: rename legacy local_users to users, add explicit role without a database default and status preserving legacy activity, and extract exact Scrypt hashes into one-to-one user_credentials. Role ADMIN/OPERATOR and status ACTIVE/DISABLED use VARCHAR plus raw SQL CHECK constraints; no enums. The existing sessions table and relationships survive normal migration. No external/provider tables are planned for Phase 1. See [decision](../decisions/unified-identity.md) and [migration/test plan](../tasks/active/NEXORA-011-unified-identity-migration.md). PR #7 is merged at ad01e74; Phase 1 still requires applicable migration CI evidence, refreshed provenance and real disposable verification under NEXORA-011.
