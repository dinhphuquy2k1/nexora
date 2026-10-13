# Task: NEXORA-013 — Remove Custom Backup/Restore Infrastructure & Simplify Testing

- **Task ID**: `NEXORA-013`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`

---

## 1. Provenance & Starting Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `b1ec046` (PR #10 merged)
- **Working Branch**: `chore/remove-custom-backup-restore`
- **Task Classification**: `SIGNIFICANT`

---

## 2. Objective & Scope

Consolidate PR #11 (`feat/expose-postgres-port`), PR #12 (`chore/remove-start-stop-scripts`), and PR #13 (`chore/remove-custom-backup-restore`) into one unified PR targeting `main`:

1. **Remove Custom Backup/Restore Subsystem (PR #13)**:
   - Scripts removed: `scripts/backup.sh`, `scripts/restore.sh`, `scripts/backup-manifest.mjs`
   - Tests & fixtures removed: `scripts/auth-restore-smoke.mjs`, `scripts/pr7-restore-smoke.mjs`, `scripts/restore.test.mjs`, `scripts/fixtures/pre-authentication/`
   - Preserved `scripts/fixtures/local-authentication/` for migration rollback test `packages/database/test/migration.mjs`.
   - Refactored `scripts/data-smoke.sh` into independent restart and down/up volume persistence test.
   - Deleted `docs/operations/backup-restore.md`, recorded ADR-006 (`docs/decisions/scope-reduction-backup-restore.md`).
2. **Remove Redundant Start/Stop Wrapper Scripts (PR #12)**:
   - Removed `Start.cmd`, `Stop.cmd`, `start.sh`, `stop.sh`.
   - Documented direct Docker Compose commands (`docker compose up --build -d --wait`, `docker compose down`) as canonical interface.
3. **Opt-in PostgreSQL Development Loopback Access (PR #11)**:
   - Added loopback port mapping `${POSTGRES_PORT:-127.0.0.1:5432}:5432` to `compose.dev.yml` for local database clients (DBeaver, pgAdmin) during development.
   - Retained canonical release isolation in `compose.yml` (port 5432 is not published by default, preserving `runtime-smoke.sh` least-privilege boundary).
   - Documented `POSTGRES_PORT` in `.env.example` and added client connection instructions to `docs/operations/setup.md`.

---

## 3. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Removed custom Backup/Restore subsystem scripts, tests, and documentation under ADR-006.
- Removed Start.cmd, Stop.cmd, start.sh, and stop.sh wrappers in favor of direct Docker Compose.
- Added opt-in loopback PostgreSQL port publishing in `compose.dev.yml` for development clients.
- Refactored `scripts/data-smoke.sh` to focus strictly on database and file persistence verification across Docker service restarts and `docker compose down` / `up` cycles.
- Preserved PostgreSQL and upload named volume persistence, Prisma migrations, and database migration tests (`packages/database/test/migration.mjs`).

### Canonical owners

- `README.md`
- `docs/README.md`
- `docs/ai/DOCUMENT_ROUTER.md`
- `docs/operations/setup.md`
- `docs/operations/testing.md`
- `docs/architecture/database.md`
- `docs/architecture/runtime.md`
- `docs/decisions/storage.md`
- `docs/decisions/authentication.md`
- `docs/decisions/scope-reduction-backup-restore.md`

### Documentation verification

- `pnpm docs:check`
- `pnpm format:check`

---

## 4. Evidence

| Claim                                           | Evidence                                                    | Date       | Result |
| :---------------------------------------------- | :---------------------------------------------------------- | :--------- | :----- |
| Backup/restore scripts and fixtures deleted     | `git status` confirms deletion of 6 scripts + fixture + doc | 2026-10-13 | PASS   |
| Documentation integrity and relative links pass | `pnpm docs:check` exit code 0                               | 2026-10-13 | PASS   |
| Architecture boundary rules pass                | `node scripts/boundaries.mjs`                               | 2026-10-13 | PASS   |
| Operations tests pass without restore tests     | `pnpm test:operations`                                      | 2026-10-13 | PASS   |
| Documentation tests pass                        | `pnpm test:docs`                                            | 2026-10-13 | PASS   |
| SDK OpenAPI contracts check passes              | `pnpm contracts:check`                                      | 2026-10-13 | PASS   |
| Docker compose configurations valid             | `docker compose config` & `compose.dev.yml config`          | 2026-10-13 | PASS   |
