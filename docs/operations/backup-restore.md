# Backup and restore

Run from checkout using POSIX shell (Windows: WSL/Git Bash). Keep sensitive backups outside source control and encrypt/protect them using your operating environment.

```sh
sh scripts/backup.sh backups/2026-10-09
sh scripts/restore.sh backups/2026-10-09 --to-new-project nexora-restored
```

Backup records currently running API/web writers, stops them, pg_dumps PostgreSQL with custom format, archives original source files and writes a versioned SHA-256 manifest. A trap restarts only previously running writers. New directory required; a partial backup without valid manifest is unusable. No dependency cache or credential volume is included. Do not run external CLI writers during backup; single-instance maintenance is assumed.
Restore verifies format/foundation version, checksums, opaque UUID archive paths and absence of symlinks/hardlinks BEFORE creating volumes. It refuses any existing target project containers/volumes and refuses default `nexora`; no overwrite switch exists. Restored project gets its own local DB credential. Restore SQL with --no-owner/--no-acl and original files, then correct only upload-volume ownership. Never point smoke at user volumes.
Original project remains untouched. Stop its web before starting restored project (`docker compose -p nexora-restored up -d --wait --wait-timeout 180`) because both default to port 3001. Validate health and catalog/source hashes before choosing a restored project for continued work. After successful validation, remove unwanted projects manually without accidentally deleting the retained data.
Smoke test uses real stored_file metadata/bytes, checks corruption rejection and verifies isolated restored DB/file content. Authentication/key backup is PLANNED because those capabilities do not exist.

## Planned unified identity upgrade safeguards

The unified migration is PLANNED and blocked pending merged/verified PR #7. These requirements describe the future upgrade procedure; they are not evidence of tested rollback or a shipped upgrade command.

**Take and verify a backup before upgrading an existing Nexora installation to a version containing the unified identity migration.** Reserve a maintenance/downtime window for backup, migration and acceptance probes. Stop external CLI writers; notify operators and retain source data/volumes. From the existing release checkout and the correct source Compose project, create a new protected destination:

```sh
COMPOSE_PROJECT_NAME=nexora sh scripts/backup.sh backups/pre-unified-identity
```

Retain the manifest, database dump and uploads archive securely outside Git. Verify format/version, both SHA-256 checksums and archive safety with that release's canonical manifest verifier; inspect the actual merged script interface before running it. Backup verification must also include a successful restore rehearsal into a separate disposable project using the intended new release: IDs/hashes/Login, catalog/original bytes, migration history and target-session invalidation. A checksum-valid backup alone is not a tested rollback plan.

After backup completes, its writer restart trap may have resumed API/Web. Stop them again for the upgrade maintenance window; keep PostgreSQL/data volumes. Select the reviewed release, run its existing migrate service with committed migrations while application writers stay stopped, and start API/Web only after migration success and release readiness probes. Exact commands must be finalized against the merged runtime topology in Phase 1; do not execute an unimplemented migration or reuse a moving PR image.

On migration failure, keep application writers stopped, preserve source data and capture sanitized diagnostics. Explicit SQL transaction rollback is separate from Prisma failed-attempt metadata; diagnose both before any supported recovery. Never alter checksums, fabricate migration history, reset source volumes or start incompatible binaries against uncertain schema. Restore the verified pre-upgrade backup only to a fresh separately named project/volumes and port, using a compatible reviewed release; verify data and authentication before choosing recovery/cutover. Keep source intact. Restore invalidates target sessions and requires fresh Login; normal identity migration preserves compatible existing sessions. Recovery/cutover and any rollback require their own verified procedure.

Phase 1 must independently test actual merged PR #7-schema backup upgrade, current unified backup and historical pre-authentication backup. The complete test/transaction plan is in [NEXORA-010](../tasks/active/NEXORA-010-unified-identity-foundation.md).
