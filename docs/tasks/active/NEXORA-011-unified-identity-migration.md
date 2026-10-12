# Task: NEXORA-011 — Phase 1 Unified Identity Migration

- **Task ID**: `NEXORA-011`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`
- **Classification**: SIGNIFICANT

## Revised implementation pre-flight

Baseline: `25317672df5572ce63e13e0a5ce991c6689f2d04`, merged PR #8; implementation branch `feat/unified-identity-phase-1`. PR #7 merged at ad01e74, PR #8 merged at 25317672, verified directly on 2026-10-12 (Asia/Saigon). Phase 0 run 38219576668 attempt 2 passed on 409d258, including Docker migrated integration/runtime/recovery; it is historical baseline evidence only. No run was returned for merge revision 25317672, and no Phase 1 result is attributed to that parent run.

Production provenance: merged source search finds the only supported production account creation in apps/api/src/identity/infrastructure/user-provisioner.ts, reached by the compiled trusted CLI (root wrapper delegates); history from 9700749 through 043090b preserves trusted provisioning. AuthController has Login/Session/Logout only, with no HTTP bootstrap/registration. Migration creates no default accounts; no production seed exists. Direct integration account creation is disposable test data, runtime/data smoke use real CLI, pre-auth fixture has no accounts. Supported legacy locally provisioned identities are approved for explicit ADMIN mapping; unsupported direct database writes must be investigated rather than silently elevated. This provenance review is outside SQL.

**Historical preflight blocker (superseded stop gate): Prisma migration-runner unavailable locally.** Enforced restricted network policy does not allow binaries.prisma.sh; a fresh checksum request returns proxy HTTP 403. No usable migration/runtime image or cached native schema engine is available. Required real Prisma deployment/catalog inspection, temporary-config failure injection, supported failed-migration recovery and drift verification cannot yet be established locally. The previous request stopped before SQL; the latest owner instruction explicitly authorizes safe source implementation and hosted Prisma verification despite this local environment limitation. Current implementation is present; native local Prisma verification remains unavailable.

## Scope and dependencies

Own the implemented migration and local-authentication adaptation, separately from Phase 0 PR #8. Required exact-head CI and real migration/recovery evidence remain gates. Phase 0 is merged; remaining gate is executable Prisma/disposable migration verification readiness and applicable baseline CI confirmation. PR #7 is merged at `ad01e74ae681ebf57787dc77188cf93b1e1c7f8e`; its actual local_users/sessions schema is the baseline. Run 38203709446 passed on parent PR head a95d5abc, but no merged-main run was returned during this inspection; do not attribute that run to the merge revision.

Production creation audit must inspect git history, compiled provisioning CLI/infrastructure, HTTP routes, seeds, migrations and scripts on the final baseline before SQL is written. Distinguish disposable integration/smoke accounts. Stop with PLAN ISSUE if legacy ADMIN assignment cannot be justified; Git-history checks do not belong inside migration SQL.

[Unified identity decision](../../decisions/unified-identity.md) owns future policy; this task owns the single detailed migration/test plan. No external identities, provider credentials, Operator local-password registration, Admin mutation, provider Login, UI changes or Internet deployment.

## Phase 1 migration plan and implemented sequence

1. Verify creation-path provenance and baseline semantics before any SQL. Stop with PLAN ISSUE if trusted legacy role assignment cannot be justified.
2. Inspect real Prisma PostgreSQL runner transaction behavior; do not assume automatic wrapping. Use explicit BEGIN/COMMIT around every schema/data/check mutation; no transaction-incompatible operation.
3. Rename local_users to users, not replacement. Rename primary-key constraint to users_pkey and unique index to users_username_key, or choose explicit retained-name Prisma mappings; verify all indexes/FKs against catalog and drift tooling.
4. After preflight provenance is established outside SQL: add role VARCHAR nullable with no default; backfill verified legacy rows as ADMIN; assert no NULL roles remain; apply NOT NULL, then CHECK role IN ('ADMIN','OPERATOR'); verify final role has no database default. Every new creation consumer supplies role explicitly. All steps share the explicit transaction.
5. Add status nullable, map true is_active to ACTIVE and false to DISABLED; assert complete mapping before applying NOT NULL, ACTIVE default and CHECK status IN ('ACTIVE','DISABLED'), then remove is_active. Preserve disabled rows; all steps are transactional.
6. Create user_credentials: user_id UUID PRIMARY KEY referencing users.id, password_hash VARCHAR(255) NOT NULL. Copy exact ID/hash; assert counts, exactly one credential per legacy user and byte-for-byte mapping inside transaction before removing old password_hash. Select/document FK deletion mapping consistently with Prisma; never rehash or invent external-only passwords.
7. Preserve IDs, usernames, timestamps, existing session rows/token algorithm/user associations and genuine migration history. No sessions truncation for normal upgrade. Restoration separately invalidates all target sessions.
8. Adapt local password Login with ADMIN/ACTIVE/credential requirements and atomic CLI nested user/credential creation. Generic session lookup is role/credential agnostic and checks only ACTIVE user plus valid session; no HTTP role input, local Operator registration, provider routes or Admin services.
9. Document raw SQL CHECK constraints in database architecture, which Prisma alone does not express. Verify no unexpected drift and safe repeated deploy.

## Required forward-compatibility fixtures

Real disposable database fixtures must include ACTIVE ADMIN with credential, ACTIVE OPERATOR without credential, DISABLED OPERATOR without credential and ACTIVE ADMIN without credential. Verify generic SessionGuard accepts nonexpired ACTIVE Operator sessions without credentials, rejects disabled/expired/revoked sessions regardless of role, and local password Login rejects Operators and credentialless Admins while normal Admin passwords work. No public fixture-creation or Operator Login endpoint is added.

## Verification-first plan

Use real disposable PostgreSQL, independently named projects and real committed Prisma deploy; never operator volumes. No fabricated \_prisma_migrations/checksums or db push/reset recovery.

| Scenario                       | Required assertions                                                                                                                                                                                                                                                                                    |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy migration               | Active/disabled users, exact UUID/username/hash/timestamps and session relationships preserved; verified ADMIN mapping; no role default; omitted/invalid roles rejected; invalid status rejected, omitted status ACTIVE; correct indexes/FKs; repeat deploy and drift                                  |
| Controlled transaction failure | Baseline real schema/data; inject failure after credential copy and before destructive completion; application schema/data rollback with no partial credentials; separately report legitimate Prisma failure bookkeeping; normal deploy tested in a clean supported disposable recovery path           |
| Local authentication           | Original credentials succeed, wrong/disabled fail, valid/expired/malformed sessions, current-session-only Logout, multiple sessions, Origin/Host unchanged, CLI explicitly ADMIN, no bootstrap endpoint                                                                                                |
| PR #7-schema backup upgrade    | Pin actual merged schema/runtime, real CLI account and source session, canonical backup with real migration metadata; new release restores/migrates in isolated target; exact UUID/hash, original password Login, expected tables/CHECK/defaults, old session exact 401, source data/session unchanged |
| Other recovery                 | Current unified backup and independently preserved genuine pre-authentication fixture; all target sessions invalidated; accounts/credentials recovered as applicable, catalog/original bytes unaffected, source isolation/corruption/no-overwrite preserved                                            |

Use temporary copies of authentic migration files and Prisma config migrations.path selection; inject only the temporary new migration after credential copying, before dropping the old hash. Deploy through actual Prisma, compare schema/data rollback and separate failed-migration bookkeeping. Verify supported migrate resolve --rolled-back and original checksum deployment; if unverified, use a fresh disposable DB and report recovery limitation. Never alter committed SQL/checksums. Capture migration baseline catalog/data privately, compare hashes without printing credential material. Run failure injection in a distinct disposable DB. Prisma may record a failed attempt outside the SQL transaction: do not claim its metadata is unchanged. Diagnose, use a fresh disposable test DB or documented migration recovery, never edit deployed checksums/history.

Required Phase 1 commands: targeted migration/integration/auth/CLI tests, real Prisma deploy/drift check, node scripts/boundaries.mjs, pnpm docs:check, contracts:check, quality and canonical Docker quality/runtime/data smoke. Each result needs exact revision/environment; old CI or mocks cannot prove new migrations. Phases 2–5 remain separate prompts/PRs.

## Upgrade policy to verify and synchronize

The successful schema migration is incompatible with old application images expecting local_users/password_hash/is_active. Code rollback alone is unsafe. Stop writers, protect/verify pre-upgrade backup and use matching release migrations. On failure keep incompatible writers stopped and inspect SQL rollback versus Prisma bookkeeping separately. Post-upgrade rollback is a verified pre-upgrade backup restored into a fresh isolated project with a compatible previous release, preserving source volumes; no in-place downgrade SQL or claimed reversible migration.

## Acceptance criteria

- Provenance verified before SQL; explicit ADMIN creation and ACTIVE ADMIN credential Login, independently from ACTIVE-user generic sessions.
- All role/status/credential preservation, transaction failure, drift and authentication cases above pass on real disposable PostgreSQL.
- Normal migration preserves sessions; restore invalidates target sessions only, with PR #7/current/pre-auth recovery independently verified.
- Canonical docs synchronized and quality/runtime/data checks pass on the implementation revision.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Implemented users/user_credentials, SQL CHECK constraints, local ADMIN credential Login versus method-agnostic ACTIVE sessions, atomic provisioning and backward-incompatible upgrade policy; owners synchronized in this PR.

### Canonical owners

- `docs/decisions/unified-identity.md`
- `docs/architecture/database.md`
- `docs/architecture/backend.md`
- `docs/decisions/authentication.md`
- `docs/operations/setup.md`
- `docs/operations/backup-restore.md`
- `docs/operations/testing.md`

### Documentation verification

- Future implementation runs docs:check, format:check and relevant quality/runtime checks.

## Evidence

| Claim                                                     | Evidence                                                                                                                                                                                                           | Date       | Result |
| :-------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Planned baseline exists, not migration execution evidence | `git show origin/main:packages/database/prisma/schema.prisma` and auth migration at ad01e74; LocalUser/session baseline inspected                                                                                  | 2026-10-12 | PASS   |
| Merged Phase 0 prerequisite verified                      | GitHub #8 merged=true at 25317672df5572ce63e13e0a5ce991c6689f2d04; git fetch origin main and clean implementation worktree                                                                                         | 2026-10-12 | PASS   |
| Production provenance audit                               | Source/history search finds supported trusted CLI creation only; fixtures and public auth routes inspected on merged baseline                                                                                      | 2026-10-12 | PASS   |
| Required engine host denied                               | `curl --head --max-time 15` for binaries.prisma.sh schema-engine checksum: proxy CONNECT HTTP 403 under enforced policy                                                                                            | 2026-10-12 | FAIL   |
| Actual pinned Prisma runner cannot initialize             | `npm exec --yes --package=pnpm@10.34.6 -- pnpm --filter @nexora/database exec prisma --version`: schema-engine checksum HTTP 403                                                                                   | 2026-10-12 | FAIL   |
| Approved plan and documentation links valid               | `node scripts/docs-check.mjs` after naming/session-responsibility amendment                                                                                                                                        | 2026-10-12 | PASS   |
| Safe implementation unit verification                     | `pnpm --filter @nexora/api test` 51/51, baseline fe8643c working tree; real Scrypt/mock DB boundary only                                                                                                           | 2026-10-12 | PASS   |
| API source build and unchanged contract                   | `pnpm --filter @nexora/api build`, `pnpm contracts:check`; local generated native engine still unavailable                                                                                                         | 2026-10-12 | PASS   |
| Operation regression                                      | `pnpm test:operations` 12/12                                                                                                                                                                                       | 2026-10-12 | PASS   |
| Boundaries/lint/documentation/format                      | `pnpm lint`, `pnpm docs:check`, `pnpm format:check`, working tree based on fe8643c                                                                                                                                 | 2026-10-12 | PASS   |
| Real isolated PostgreSQL SQL rollback and preservation    | Python docker-exec harness with authentic legacy SQL and committed new SQL: injected rollback, IDs/hash/status/session/no-default/CHECK, PostgreSQL 17.11 network-none temporary container; not Prisma bookkeeping | 2026-10-12 | PASS   |
| Local native generation unavailable                       | `pnpm --filter @nexora/database generate`: Prisma engine checksum HTTP 403                                                                                                                                         | 2026-10-12 | FAIL   |
| Canonical Docker quality attempted                        | Disposable nexora-phase1-quality with cloud CA override: migration-image build blocked by Prisma engine HTTP 403 before integration                                                                                | 2026-10-12 | FAIL   |

Local native Prisma remains blocked; hosted execution must establish actual Prisma deploy/recovery/drift and all three backup upgrades. Direct isolated PostgreSQL SQL verification and unit tests are evidence only for their explicitly exercised boundaries. No historical PR #7/#8 success proves Phase 1.

## Continued implementation authorization and plan

2026-10-12: owner explicitly authorizes implementation on existing PR #9 despite local engine denial; prior stop-before-SQL gate is superseded. Classification SIGNIFICANT; Documentation Impact REQUIRED. Provenance and merged baseline remain established. Plan: test-first local Login eligibility, then explicit transaction/schema/adapters/atomic CLI, real migration/failure/drift integration in existing Docker CI, three isolated recovery scenarios, canonical docs, targeted checks, push same branch and verify final-head hosted CI. No environment bypass and no live database SQL.

Interface: local Login consumes joined role/status/optional hash; generic session port returns public summary for any ACTIVE user independent of role/credentials. Existing public DTOs unchanged. Migration fixture pins authentic baseline schema and existing migrations; temporary config selects migration path and only temporary new SQL gets failure injection.

## Implementation results and final gate

Baseline fe8643c / merged main 25317672; 2026-10-12 (Asia/Saigon). User/UserCredential models, transaction SQL 20261012010000_unified_identity, feature-local const role/status values, joined local Login adapter and nested atomic CLI creation are implemented. Generic SessionGuard is unchanged; its adapter checks ACTIVE only. Public DTO/OpenAPI/SDK are unchanged. Existing migration/fixture bytes are preserved; new PR #7 fixture is provenance-pinned.

Quality Docker now executes actual Prisma migration.mjs with temporary config/migration directory, authentic baseline deploy, controlled rollback, genuine failed-attempt metadata and supported resolve/original redeploy, constraints/repeat/drift. Real API integration covers credentialless Operator/disabled users and current-session-only Logout. Data smoke covers unified/current, genuine pre-auth and actual pinned PR #7 runtime/CLI canonical backup upgrade. No provider calls/tables, public role input, new services/dependencies or user-volume reset.

Local evidence before implementation commit: 51 API tests PASS, 12 operation tests PASS, API build PASS, contracts:check PASS (unchanged generated artifacts), lint PASS, docs:check PASS. Frozen ignore-scripts install PASS. Direct isolated PostgreSQL 17.11 SQL migration/exception rollback/status/hash/session/no-role-default/CHECK probes PASS; this is not Prisma metadata/drift or full recovery evidence. Prisma generate FAIL with engine checksum 403; canonical local Docker quality attempted with cloud CA override, native engine download remains a required external prerequisite.

Keep VERIFICATION PENDING/PARTIALLY VERIFIED until exact-head hosted migration/integration/runtime/recovery/dev checks and final review are satisfied. Record the final CI externally, not through an evidence-only commit loop. Do not merge automatically.
