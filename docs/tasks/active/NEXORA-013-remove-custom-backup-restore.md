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

Reduce product scope by removing the custom Backup/Restore subsystem while preserving PostgreSQL persistence, Prisma migrations, and database schema regression testing:

1. **Remove Custom Backup/Restore Scripts**:
   - `scripts/backup.sh`, `scripts/restore.sh`, `scripts/backup-manifest.mjs`
2. **Remove Restore-Only Tests & Historical Fixtures**:
   - `scripts/auth-restore-smoke.mjs`, `scripts/pr7-restore-smoke.mjs`, `scripts/restore.test.mjs`
   - `scripts/fixtures/pre-authentication/`
   - Retain `scripts/fixtures/local-authentication/` which is actively required by database migration regression tests (`packages/database/test/migration.mjs`).
3. **Refactor Data Persistence Smoke**:
   - Simplify `scripts/data-smoke.sh` into an independent database and stored file persistence smoke test verifying restart and down/up cycles without backup/restore dependencies.
4. **Update Packaging, CI & Tooling**:
   - Remove `scripts/backup-manifest.mjs` from `docker/Dockerfile.tools` COPY instruction.
   - Update `package.json` `test:operations` to remove `restore.test.mjs`.
   - Update `.github/workflows/foundation.yml` step description.
5. **Canonical Documentation Synchronization**:
   - Record architectural decision in `docs/decisions/scope-reduction-backup-restore.md` (ADR-006).
   - Delete `docs/operations/backup-restore.md` and clean up all navigation and document links.
   - Update `README.md`, `docs/README.md`, `docs/operations/setup.md`, `docs/operations/testing.md`, `docs/architecture/database.md`, `docs/architecture/runtime.md`, `docs/decisions/storage.md`, and `docs/decisions/authentication.md`.

---

## 3. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Removed custom Backup/Restore subsystem scripts (`scripts/backup.sh`, `scripts/restore.sh`, `scripts/backup-manifest.mjs`).
- Removed restore-only tests (`scripts/auth-restore-smoke.mjs`, `scripts/pr7-restore-smoke.mjs`, `scripts/restore.test.mjs`) and pre-authentication fixture (`scripts/fixtures/pre-authentication/`).
- Refactored `scripts/data-smoke.sh` to focus strictly on database and file persistence verification across Docker service restarts and `docker compose down` / `up` cycles.
- Removed `docs/operations/backup-restore.md` and removed all navigation references across repository documentation.
- Adopted ADR-006 (`docs/decisions/scope-reduction-backup-restore.md`) formalizing the product scope reduction.
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
