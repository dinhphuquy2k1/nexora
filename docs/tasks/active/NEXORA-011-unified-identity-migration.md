# Task: NEXORA-011 — Phase 1 Unified Identity Migration

- **Task ID**: `NEXORA-011`
- **Status**: `PLANNED`
- **Implementation**: `PLANNED`
- **Verification**: `NOT VERIFIED`
- **Classification**: SIGNIFICANT

## Scope and dependencies

Own the future migration and local-authentication adaptation, separately from Phase 0 PR #8. No Phase 1 code is implemented here. Start only after Phase 0 decisions are merged and refreshed main schema, applicable migration CI, account provenance and real disposable test preparation are verified. PR #7 is merged at `ad01e74ae681ebf57787dc77188cf93b1e1c7f8e`; its actual local_users/sessions schema is the baseline. Run 38203709446 passed on parent PR head a95d5abc, but no merged-main run was returned during this inspection; do not attribute that run to the merge revision.

Production creation audit must inspect git history, compiled provisioning CLI/infrastructure, HTTP routes, seeds, migrations and scripts on the final baseline before SQL is written. Distinguish disposable integration/smoke accounts. Stop with PLAN ISSUE if legacy ADMIN assignment cannot be justified; Git-history checks do not belong inside migration SQL.

[Unified identity decision](../../decisions/unified-identity.md) owns future policy; this task owns the single detailed migration/test plan. No external identities, provider credentials, Operator local-password registration, Admin mutation, provider Login, UI changes or Internet deployment.

## Phase 1 migration plan — NOT IMPLEMENTED

1. Verify creation-path provenance and baseline semantics before any SQL. Stop with PLAN ISSUE if trusted legacy role assignment cannot be justified.
2. Inspect real Prisma PostgreSQL runner transaction behavior; do not assume automatic wrapping. Use explicit BEGIN/COMMIT around every schema/data/check mutation; no transaction-incompatible operation.
3. Rename local_users to users, not replacement. Rename primary-key constraint to users_pkey and unique index to users_username_key, or choose explicit retained-name Prisma mappings; verify all indexes/FKs against catalog and drift tooling.
4. After preflight provenance is established outside SQL: add role VARCHAR nullable with no default; backfill verified legacy rows as ADMIN; assert no NULL roles remain; apply NOT NULL, then CHECK role IN ('ADMIN','OPERATOR'); verify final role has no database default. Every new creation consumer supplies role explicitly. All steps share the explicit transaction.
5. Add status nullable, map true is_active to ACTIVE and false to DISABLED; assert complete mapping before applying NOT NULL, ACTIVE default and CHECK status IN ('ACTIVE','DISABLED'), then remove is_active. Preserve disabled rows; all steps are transactional.
6. Create local_credentials: user_id UUID PRIMARY KEY referencing users.id, password_hash VARCHAR(255) NOT NULL. Copy exact ID/hash; assert counts, exactly one credential per legacy user and byte-for-byte mapping inside transaction before removing old password_hash. Select/document FK deletion mapping consistently with Prisma; never rehash or invent external-only passwords.
7. Preserve IDs, usernames, timestamps, existing session rows/token algorithm/user associations and genuine migration history. No sessions truncation for normal upgrade. Restoration separately invalidates all target sessions.
8. Adapt real local auth/provisioning consumers with explicit ADMIN/ACTIVE values; no HTTP role input, local Operator registration, provider routes or Admin services.
9. Document raw SQL CHECK constraints in database architecture, which Prisma alone does not express. Verify no unexpected drift and safe repeated deploy.

## Verification-first plan

Use real disposable PostgreSQL, independently named projects and real committed Prisma deploy; never operator volumes. No fabricated \_prisma_migrations/checksums or db push/reset recovery.

| Scenario                       | Required assertions                                                                                                                                                                                                                                                                                    |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy migration               | Active/disabled users, exact UUID/username/hash/timestamps and session relationships preserved; verified ADMIN mapping; no role default; omitted/invalid roles rejected; invalid status rejected, omitted status ACTIVE; correct indexes/FKs; repeat deploy and drift                                  |
| Controlled transaction failure | Baseline real schema/data; inject failure after credential copy and before destructive completion; application schema/data rollback with no partial credentials; separately report legitimate Prisma failure bookkeeping; normal deploy tested in a clean supported disposable recovery path           |
| Local authentication           | Original credentials succeed, wrong/disabled fail, valid/expired/malformed sessions, current-session-only Logout, multiple sessions, Origin/Host unchanged, CLI explicitly ADMIN, no bootstrap endpoint                                                                                                |
| PR #7-schema backup upgrade    | Pin actual merged schema/runtime, real CLI account and source session, canonical backup with real migration metadata; new release restores/migrates in isolated target; exact UUID/hash, original password Login, expected tables/CHECK/defaults, old session exact 401, source data/session unchanged |
| Other recovery                 | Current unified backup and independently preserved genuine pre-authentication fixture; all target sessions invalidated; accounts/credentials recovered as applicable, catalog/original bytes unaffected, source isolation/corruption/no-overwrite preserved                                            |

Capture migration baseline catalog/data privately, compare hashes without printing credential material. Run failure injection in a distinct disposable DB. Prisma may record a failed attempt outside the SQL transaction: do not claim its metadata is unchanged. Diagnose, use a fresh disposable test DB or documented migration recovery, never edit deployed checksums/history.

Required Phase 1 commands: targeted migration/integration/auth/CLI tests, real Prisma deploy/drift check, node scripts/boundaries.mjs, pnpm docs:check, contracts:check, quality and canonical Docker quality/runtime/data smoke. Each result needs exact revision/environment; old CI or mocks cannot prove new migrations. Phases 2–5 remain separate prompts/PRs.

## Acceptance criteria

- Provenance verified before SQL; explicit ADMIN creation and ACTIVE-only local authentication.
- All role/status/credential preservation, transaction failure, drift and authentication cases above pass on real disposable PostgreSQL.
- Normal migration preserves sessions; restore invalidates target sessions only, with PR #7/current/pre-auth recovery independently verified.
- Canonical docs synchronized and quality/runtime/data checks pass on the implementation revision.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Future users/local_credentials, SQL CHECK constraints and identity/upgrade behavior will require synchronized canonical owners when implemented.

### Canonical owners

- `docs/architecture/database.md`
- `docs/architecture/backend.md`
- `docs/decisions/authentication.md`
- `docs/operations/setup.md`
- `docs/operations/backup-restore.md`
- `docs/operations/testing.md`

### Documentation verification

- Future implementation runs docs:check, format:check and relevant quality/runtime checks.

## Evidence

| Claim                                                     | Evidence                                                                                                                          | Date       | Result |
| :-------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Planned baseline exists, not migration execution evidence | `git show origin/main:packages/database/prisma/schema.prisma` and auth migration at ad01e74; LocalUser/session baseline inspected | 2026-10-12 | PASS   |

No Phase 1 executable verification has run. NOT RUN: migrations, failure injection, backup upgrades, adapted auth/CLI, schema drift and Phase 1 Docker suite. No historical Phase 0/PR #7 success proves this planned implementation.
