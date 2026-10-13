# ADR-006 · Removal of custom Backup/Restore subsystem & test simplification

Accepted 2026-10-13. Supersedes the custom backup/restore orchestration in ADR-001 Section 2 item 33 and storage topic `docs/decisions/storage.md`.

## 1. Context & problem statement

In Nexora's initial foundation (NEXORA-001) inherited from Lyra, a custom backup and restore subsystem was implemented via POSIX shell scripts (`scripts/backup.sh`, `scripts/restore.sh`, `scripts/backup-manifest.mjs`). This subsystem managed:

- Single-instance writer pausing and PostgreSQL `pg_dump` orchestration.
- Upload archive packaging and SHA-256 manifest generation/verification.
- Isolated project restore targeting, historical schema replay, target session invalidation, and integrity verification.
- Extensive test suites (`scripts/auth-restore-smoke.mjs`, `scripts/pr7-restore-smoke.mjs`, `scripts/restore.test.mjs`) and historical schema fixtures (`scripts/fixtures/pre-authentication`).

As Nexora's operational focus is an independent single-instance shipment management application, maintaining a custom database backup, restore, and snapshot-manifest framework introduced unnecessary complexity and operational friction without providing equivalent value.

The project owner decided to deliberately reduce product scope by removing the custom Backup/Restore subsystem while preserving Docker named volume persistence, Prisma migrations, and database schema integrity.

## 2. Decision: Remove custom Backup/Restore and simplify persistence testing

1. **Subsystem retirement**:
   - Delete `scripts/backup.sh`, `scripts/restore.sh`, and `scripts/backup-manifest.mjs`.
   - Remove custom backup manifest generation, SHA-256 verification, and restore-specific session deletion orchestration.
   - Remove restore-only smoke tests (`scripts/auth-restore-smoke.mjs`, `scripts/pr7-restore-smoke.mjs`, `scripts/restore.test.mjs`).
   - Remove historical test fixtures (`scripts/fixtures/pre-authentication`) that were used exclusively by restore tests.
   - Delete `docs/operations/backup-restore.md` and remove its navigation references.

2. **Persistence and migration preservation**:
   - Retain standard Docker named volumes (`nexora_postgres`, `nexora_uploads`, `nexora_credentials`) as the canonical persistence mechanism across container restarts and `docker compose down` / `up` cycles.
   - Retain all committed Prisma migrations (`packages/database/prisma/migrations/`) and the forward-only migration deploy workflow (`prisma migrate deploy`).
   - Retain database migration regression tests (`packages/database/test/migration.mjs`), preserving `scripts/fixtures/local-authentication` which is actively required to verify the unified identity migration and rollback guarantees.
   - Refactor `scripts/data-smoke.sh` into an independent data persistence smoke test that creates application records and stored files, restarts services, performs `docker compose down` and `up`, and verifies data integrity without any backup/restore scripts.

3. **KISS & YAGNI alignment**:
   - Do not replace custom backup scripts with another backup framework, cron job, or cloud integration.
   - Standard host/environment database management practices apply for backups where required in operations.

## 3. Consequences

- **Positive**: Removed ~1,000 lines of complex shell/Node restore orchestration, historical archive fixtures, and mock restore tests. Faster CI execution and simplified developer workflows.
- **Preserved guarantees**: Database and upload persistence across container restarts remain fully verified by `data-smoke.sh`. Migration deploy safety remains fully verified by `test:migrations`.
