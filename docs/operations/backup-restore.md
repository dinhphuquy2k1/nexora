# Backup and restore

Run from checkout using POSIX shell (Windows: WSL/Git Bash). Backups contain operator identities, salted password hashes, session hashes and recoverable data. Keep them outside source control, restrict access to the operator, and encrypt them using the operating environment. Backup uses a private creation umask and a private manifest; the format itself is not encrypted. Never publish dumps or their contents in CI logs.

```sh
sh scripts/backup.sh backups/2026-10-12
WEB_PORT=127.0.0.1:3101 sh scripts/restore.sh backups/2026-10-12 --to-new-project nexora-restored
```

## Backup contract

Backup records currently running API/Web writers, stops them, pg_dumps PostgreSQL in custom format, archives original source files and writes a format-1/foundation-0.1.0 SHA-256 manifest. A trap restarts only previously running writers. A new destination directory is required; a partial backup without a valid manifest is unusable. Dependency cache and credential volumes are excluded. Do not run external CLI writers during backup; single-instance maintenance is assumed.

Current backups preserve `local_users`, including their password hashes, and may contain `sessions`. A backup must be protected even though raw session tokens are not stored. Restoring an older dump must never resurrect a session revoked after that backup.

## Isolated restore order and failure behavior

Restore verifies format/version, checksums, opaque UUID archive paths and absence of symlinks/hardlinks before creating volumes. It refuses any existing target project containers/volumes and refuses default `nexora`; no overwrite switch exists. The new project receives an independent local DB credential. Source project data and sessions remain untouched.

1. Start only the fresh target PostgreSQL, with no API/Web writers.
2. Restore the dump into the empty target using `pg_restore --exit-on-error --no-owner --no-acl`.
3. Run the existing target `migrate` service with `prisma migrate deploy` and committed migrations. The dump's genuine `_prisma_migrations` history determines which migrations are missing.
4. Delete all rows from target `public.sessions`, after the authentication migration has ensured the table exists. Zero rows is success; database errors fail the restore.
5. Restore uploaded originals and repair only upload-volume ownership.
6. Use a non-root, non-listening API runtime command to verify every cataloged original's bytes/size/SHA-256 and an empty session set.
7. Report success only after all preceding stages succeed. Operators must log in again.

Migration, invalidation or integrity failure returns nonzero, emits a sanitized stage marker and never launches the restored application. Restore is not atomic: a partial isolated target may remain for operator diagnosis. The command continues refusing to overwrite it; do not reset source volumes or manufacture migration records to retry.

Keep the same chosen `WEB_PORT` and any `NEXORA_COMPOSE_OVERRIDE` when starting the verified target:

```sh
WEB_PORT=127.0.0.1:3101 docker compose -p nexora-restored up -d --wait --wait-timeout 180
```

A different supported loopback port permits source and restored projects to run independently. Login/Logout Origin must match that browser address; session GET needs only its cookie. Host/Origin guards are never disabled. Both scripts accept the existing cloud Compose override; API/PostgreSQL remain internal-only.

## Current and historical backups

- **Current authentication backup:** operator IDs and password hashes survive; all restored sessions are deleted before use. Existing credentials create fresh sessions. An old token must return exact `401 UNAUTHORIZED` at `/api/auth/session`, not an unrelated 403/404/500 or network error.
- **Pre-authentication foundation backup:** contains stored-file data and genuine storage-migration metadata, but no accounts/session tables. Restore first replays that dump, then deploys the committed authentication migration and clears the newly created empty session table. It never creates a default account. Provision the first operator using the existing compiled CLI through the approved API entrypoint; see [Setup](setup.md).
- Missing or inconsistent historical migration metadata is not silently repaired with fake rows or checksums. A migration failure is a recovery blocker and must be diagnosed.

The committed legacy smoke fixture copies the exact schema/migration/lock from pre-authentication commit `7cfb01a5756c6787d00cbb940bd406a0157bf5b7`; its metadata is created by the real Prisma migration runner against disposable PostgreSQL. It is not a current schema with empty auth tables. The backup manifest format and committed migration checksums remain unchanged.

## Verification

`sh scripts/data-smoke.sh` retains catalog/source persistence across restart/down-up, SHA-256/corruption rejection and no-overwrite protection. It adds current-backup session resurrection prevention, account recovery, source-session isolation, and genuine pre-authentication schema backup/upgrade/first-account CLI recovery. Tests use independently named disposable projects and clean only those projects.

Current executed evidence and gaps are recorded in NEXORA-009. Unit orchestration checks do not substitute for real PostgreSQL restore/API evidence, and a successful historical CI SHA is not evidence for later changes.

## Planned unified identity upgrade safeguards

The unified migration is PLANNED and awaits Phase 0 merge and NEXORA-011 migration prerequisites; PR #7 is already merged. These requirements describe the future upgrade procedure; they are not evidence of tested rollback or a shipped upgrade command.

**Take and verify a backup before upgrading an existing Nexora installation to a version containing the unified identity migration.** Reserve a maintenance/downtime window for backup, migration and acceptance probes. Stop external CLI writers; notify operators and retain source data/volumes. From the existing release checkout and the correct source Compose project, create a new protected destination:

```sh
COMPOSE_PROJECT_NAME=nexora sh scripts/backup.sh backups/pre-unified-identity
```

Retain the manifest, database dump and uploads archive securely outside Git. Verify format/version, both SHA-256 checksums and archive safety with that release's canonical manifest verifier; inspect the actual merged script interface before running it. Backup verification must also include a successful restore rehearsal into a separate disposable project using the intended new release: IDs/hashes/Login, catalog/original bytes, migration history and target-session invalidation. A checksum-valid backup alone is not a tested rollback plan.

After backup completes, its writer restart trap may have resumed API/Web. Stop them again for the upgrade maintenance window; keep PostgreSQL/data volumes. Select the reviewed release, run its existing migrate service with committed migrations while application writers stay stopped, and start API/Web only after migration success and release readiness probes. Exact commands must be finalized against the merged runtime topology in Phase 1; do not execute an unimplemented migration or reuse a moving PR image.

On migration failure, keep application writers stopped, preserve source data and capture sanitized diagnostics. Explicit SQL transaction rollback is separate from Prisma failed-attempt metadata; diagnose both before any supported recovery. Never alter checksums, fabricate migration history, reset source volumes or start incompatible binaries against uncertain schema. Restore the verified pre-upgrade backup only to a fresh separately named project/volumes and port, using a compatible reviewed release; verify data and authentication before choosing recovery/cutover. Keep source intact. Restore invalidates target sessions and requires fresh Login; normal identity migration preserves compatible existing sessions. Recovery/cutover and any rollback require their own verified procedure.

Phase 1 must independently test actual merged PR #7-schema backup upgrade, current unified backup and historical pre-authentication backup. The complete test/transaction plan is in [NEXORA-011](../tasks/active/NEXORA-011-unified-identity-migration.md).
