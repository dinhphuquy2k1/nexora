# Task: NEXORA-013 — Remove Custom Backup/Restore Infrastructure & Simplify Testing

- **Task ID**: `NEXORA-013`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`

_Lifecycle note_: All implementation and verification requirements have been executed and verified. PR #13 CI run `38407659362` (job `115334994119`) passed all stages in 9m 26s. Task remains in `VERIFICATION PENDING` status awaiting final owner review and manual merge into main (do not merge automatically).

---

## 1. Provenance & Starting Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `b1ec046` (PR #10 merged)
- **Working Branch**: `chore/remove-custom-backup-restore`
- **Task Classification**: `SIGNIFICANT`

---

## 2. Objective & Scope

Consolidate PR #11 (`feat/expose-postgres-port`), PR #12 (`chore/remove-start-stop-scripts`), and PR #13 (`chore/remove-custom-backup-restore`) into one unified PR targeting `main`, and address review findings:

1. **Remove Custom Backup/Restore Subsystem (PR #13)**:
   - Scripts removed: `scripts/backup.sh`, `scripts/restore.sh`, `scripts/backup-manifest.mjs`
   - Tests & fixtures removed: `scripts/auth-restore-smoke.mjs`, `scripts/pr7-restore-smoke.mjs`, `scripts/restore.test.mjs`, `scripts/fixtures/pre-authentication/`
   - Preserved `scripts/fixtures/local-authentication/` for migration rollback test `packages/database/test/migration.mjs`.
   - Refactored `scripts/data-smoke.sh` into independent restart and down/up volume persistence test.
   - Deleted `docs/operations/backup-restore.md`, recorded ADR-006 (`docs/decisions/scope-reduction-backup-restore.md`).
2. **Remove Redundant Start/Stop Wrapper Scripts (PR #12)**:
   - Removed `Start.cmd`, `Stop.cmd`, `start.sh`, `stop.sh`.
   - Documented direct Docker Compose commands (`docker compose up --build -d --wait`, `docker compose down`) as canonical interface.
3. **Development-Only PostgreSQL Loopback Access (PR #11 Review Alignment)**:
   - Configured loopback port mapping `127.0.0.1:${POSTGRES_PORT:-5432}:5432` in `compose.dev.yml` for local database tools (DBeaver, pgAdmin) during development.
   - Pinned host binding permanently to `127.0.0.1` so `POSTGRES_PORT` can only alter the numeric port, preventing accidental or intentional binding to `0.0.0.0`.
   - Maintained strict network isolation for standard release mode (`compose.yml` has no published PostgreSQL port).
   - Documented numeric `POSTGRES_PORT` in `.env.example`, updated `docs/operations/configuration.md`, and added secure credential retrieval guidance (clipboard usage, warnings against printing in recorded/shared sessions) in `docs/operations/setup.md`.
4. **Synchronize Root README Introduction**:
   - Accurately distinguished implemented capabilities (ADMIN local auth, unified identity storage, mock OPERATOR foundation, sessions, UI shell) from roadmap items (full shipment domain workflows, staff management UI, live Uniship integration).

---

## 3. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Removed custom Backup/Restore subsystem scripts, tests, and documentation under ADR-006.
- Removed Start.cmd, Stop.cmd, start.sh, and stop.sh wrappers in favor of direct Docker Compose.
- Added development-only loopback PostgreSQL port publishing in `compose.dev.yml` for development tools.
- Pinned PostgreSQL host binding strictly to `127.0.0.1` and restricted `POSTGRES_PORT` to numeric port configuration.
- Enhanced database client connection guidance with secret exposure warnings and non-printing clipboard retrieval commands.
- Updated root `README.md` intro to accurately reflect implemented identity and authentication capabilities.
- Refactored `scripts/data-smoke.sh` to focus strictly on database and file persistence verification across Docker service restarts and `docker compose down` / `up` cycles.
- Preserved PostgreSQL and upload named volume persistence, Prisma migrations, and database migration tests (`packages/database/test/migration.mjs`).

### Canonical owners

- `README.md`
- `docs/README.md`
- `docs/ai/DOCUMENT_ROUTER.md`
- `docs/operations/setup.md`
- `docs/operations/configuration.md`
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

| Claim                                           | Evidence                                                                                                                                                              | Date       | Result |
| :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Backup/restore scripts and fixtures deleted     | `git status` confirms deletion of 6 scripts + fixture + doc                                                                                                           | 2026-10-13 | PASS   |
| Documentation integrity and relative links pass | `pnpm docs:check` exit code 0                                                                                                                                         | 2026-10-13 | PASS   |
| Architecture boundary rules pass                | `node scripts/boundaries.mjs`                                                                                                                                         | 2026-10-13 | PASS   |
| Operations tests pass without restore tests     | `pnpm test:operations`                                                                                                                                                | 2026-10-13 | PASS   |
| SDK OpenAPI contracts check passes              | `pnpm contracts:check`                                                                                                                                                | 2026-10-13 | PASS   |
| Standard release compose port isolation         | `docker compose config` shows no published port for postgres                                                                                                          | 2026-10-13 | PASS   |
| Dev compose default port loopback binding       | `docker compose -f compose.yml -f compose.dev.yml config` published: 5432                                                                                             | 2026-10-13 | PASS   |
| Dev compose custom numeric port binding         | `POSTGRES_PORT=5433` publishes 5433 on 127.0.0.1                                                                                                                      | 2026-10-13 | PASS   |
| Dev compose rejects invalid 0.0.0.0 override    | `POSTGRES_PORT=0.0.0.0:5432` fails safely with `invalid IP address`                                                                                                   | 2026-10-13 | PASS   |
| Persistence across restart/down-up (data-smoke) | `scripts/data-smoke.sh` in CI run `38410261458` (job `115340397718`): confirmed DB record & uploaded file persistence across service restart and `down` / `up` cycles | 2026-10-13 | PASS   |
| Consolidated PR #13 CI run (commit 330e398)     | Run `38403928744` (ID 115318429013) all stages passed in 9m 23s                                                                                                       | 2026-10-13 | PASS   |
| Hardened PR #13 CI run (commit 1d30747)         | Run `38407659362` (ID 115334994119) all stages passed in 9m 26s                                                                                                       | 2026-10-13 | PASS   |
| Final remediation CI run (commit 6996126)       | Run `38410261458` (ID 115340397718) all stages passed in 9m 16s                                                                                                       | 2026-10-13 | PASS   |
