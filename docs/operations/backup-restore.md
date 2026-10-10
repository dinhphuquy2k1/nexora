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
