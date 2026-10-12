# Pre-authentication restore fixture

Schema, migration SQL and migration lock copied verbatim from Nexora commit `7cfb01a5756c6787d00cbb940bd406a0157bf5b7` (pre-NEXORA-009 main). `provenance.json` records source SHA-256 checksums.

Data smoke mounts this Prisma directory read-only into the existing migration runner and executes genuine `prisma migrate deploy` against a new disposable PostgreSQL project. The runner creates real migration metadata; no manual migration rows or authentication tables are synthesized. The resulting database contains only historical stored-file schema and its deployed migration. It is backed up using the real backup script, then restored and upgraded using the current committed migrations.
