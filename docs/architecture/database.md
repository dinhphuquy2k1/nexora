# Database

Only `packages/database` owns Prisma/schema/migrations. Only API infrastructure imports it. The sole application table `stored_files` is a real source-file catalog: opaque UUID, SHA-256, byte size and creation time. Shipment domain schema is PLANNED; there are no fake smoke tables or business seeds.
`20261006000000_storage_catalog` explicitly creates the catalog with a nonnegative size constraint. Migrate service runs `prisma migrate deploy`, gated on PostgreSQL healthy; API is gated on successful migration. Repeated deployment must preserve existing rows. No reset, db push, migrate dev or seed runs at startup.
Integration tests register/read/delete only their own UUID and do not truncate shared data. Persistence/backup smoke runs on disposable projects; see task evidence.

Prisma 7.10.0 uses the PostgreSQL driver adapter; createDatabase stays within the database package. prisma.config.ts reads the server DATABASE_URL for migration, while client generation requires no connection or fabricated database credential.
