# Database

Only `packages/database` owns Prisma/schema/migrations. Only API infrastructure imports it. Persistent application tables include `stored_files` (real source-file catalog), `local_users` (local operator identities and Scrypt password hashes), and `sessions` (SHA-256 session token hashes with cascade deletion and expiry timestamps). Shipment domain schema is PLANNED; there are no fake smoke tables or business seeds.
`20261006000000_storage_catalog` and `20261012000000_local_authentication` define migrations deployed by `prisma migrate deploy`, gated on PostgreSQL healthy. Repeated deployment preserves existing rows. No reset, db push, migrate dev or demo seed runs at startup.
Integration tests register/read/delete only their own UUID and do not truncate shared data. Persistence/backup smoke runs on disposable projects; see task evidence.

Prisma 7.10.0 uses the PostgreSQL driver adapter; createDatabase stays within the database package. prisma.config.ts reads the server DATABASE_URL for migration, while client generation requires no connection or fabricated database credential.
