# Task: NEXORA-010 — Unified Identity Foundation

- **Task ID**: `NEXORA-010`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `PLANNED`
- **Verification**: `PARTIALLY VERIFIED`
- **Classification**: SIGNIFICANT
- **Working branch**: `docs/unified-identity-phase-0`
- **Starting main SHA**: `7cfb01a5756c6787d00cbb940bd406a0157bf5b7`

Phase 0 decision/planning is authored; Phase 1 implementation has not started. Phase-specific status must not imply the unified schema or Uniship integration is implemented.

## Dependency gate

**PLAN ISSUE: PR #7 prerequisite not satisfied.** GitHub inspected 2026-10-12 (Asia/Saigon): PR #7 OPEN/unmerged, head `a95d5abc292379cf04dc88179cb63c54c3d484f0`; fetched main remains `7cfb01a5756c6787d00cbb940bd406a0157bf5b7`. Hosted run 38203709446 succeeds on that PR head, but does not establish merged-main migration verification. Main contains storage only; LocalUser/session migration is still on PR #7.

Only documentation is prepared from main, separately from PR #7. Do not create a stacked implementation PR, edit Prisma/schema/migrations, merge #7 or begin Phase 1. After #7 is merged, refresh main, inspect final migration/history and relevant merged-revision CI, then start a new implementation branch from that revision. Reconcile these docs with the merged canonical auth/runtime documents before implementing.

## Phase 0 scope and interface pre-flight

[Unified identity decision](../../decisions/unified-identity.md) owns approved direction, future access/session policy, provider questions/error policy and phase boundaries. [Database](../../architecture/database.md) owns the planned database summary; [Backup and restore](../../operations/backup-restore.md) owns upgrade safeguards. Existing runtime/API/SDK/UI stay unchanged.

Inspection of PR-head code/history found: LocalUser maps local_users; UUID ID, unique case-sensitive username, password_hash VARCHAR(255), is_active default true, preserved timestamps; Session references LocalUser with cascade and non-unique user index. Named objects include local_users_pkey, local_users_username_key and sessions_user_id_fkey. The trusted compiled CLI delegates to infrastructure user-provisioner, the only production localUser.create found; integration tests create isolated accounts, smoke invokes the real CLI, and historical pre-auth fixture has no identities. No production seed/public registration was found. This is candidate provenance at a moving PR SHA, not final authorization to grant ADMIN; repeat the audit on merged main and document any installation-specific unsupported direct writes.

Only infrastructure may consume database code. Existing application service/guards retain validation, bounded admission, dummy Scrypt, Origin/Host policy, opaque session issuance/revocation and safe failure envelopes. Phase 1 adapts infrastructure records and trusted provisioning; local Login requires ADMIN, ACTIVE and a local credential. Sessions reject DISABLED users. Preserve compatible public user summaries and generated contracts unless a demonstrated interface change requires deliberate regeneration.

## Phase 1 migration plan — NOT IMPLEMENTED

1. Verify creation-path provenance and baseline semantics before any SQL. Stop with PLAN ISSUE if trusted legacy role assignment cannot be justified.
2. Inspect real Prisma PostgreSQL runner transaction behavior; do not assume automatic wrapping. Use explicit BEGIN/COMMIT around every schema/data/check mutation; no transaction-incompatible operation.
3. Rename local_users to users, not replacement. Rename primary-key constraint to users_pkey and unique index to users_username_key, or choose explicit retained-name Prisma mappings; verify all indexes/FKs against catalog and drift tooling.
4. Add role VARCHAR NOT NULL with no default, assign ADMIN explicitly only for verified legacy accounts, CHECK role IN ('ADMIN','OPERATOR'). Every creation consumer must provide role explicitly.
5. Add status VARCHAR NOT NULL, permitted ACTIVE default and CHECK status IN ('ACTIVE','DISABLED'); map true is_active to ACTIVE and false to DISABLED before removing is_active.
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

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Accepted future unified identity direction, authorization questions, strict phase gates and planned migration/upgrade verification; no implemented runtime/schema fact changes.

### Canonical owners

- `docs/decisions/unified-identity.md`
- `docs/decisions/authentication.md` (link to future direction only)
- `docs/decisions/product-scope.md` (future identity boundary)
- `docs/decisions/README.md`
- `docs/architecture/database.md` (PLANNED summary)
- `docs/operations/backup-restore.md` (future upgrade safeguards)
- `docs/operations/setup.md` (link to upgrade safeguards)

### Documentation verification

- `pnpm docs:check`, `pnpm format:check`, `node scripts/boundaries.mjs`, diff scope audit.

## Evidence

| Claim                                         | Evidence                                                                                                                                                      | Date       | Result |
| :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| Main/branch baseline inspected                | git fetch origin; git status --short; git rev-parse HEAD origin/main; separate documentation worktree from 7cfb01a                                            | 2026-10-12 | PASS   |
| Phase 1 merge prerequisite fails              | GitHub get_pr_info: #7 OPEN, merged=false, head a95d5abc292379cf04dc88179cb63c54c3d484f0; main 7cfb01a                                                        | 2026-10-12 | FAIL   |
| PR-head CI succeeds, not merged-main evidence | [Run 38203709446](https://github.com/dinhphuquy2k1/nexora/actions/runs/38203709446), connector completed/success for a95d5abc292379cf04dc88179cb63c54c3d484f0 | 2026-10-12 | PASS   |

| Phase 0 documentation governance and relative links | `pnpm docs:check` on documentation worktree | 2026-10-12 | PASS |
| Documentation-only repository formatting | `/workspace/work/nexora/node_modules/.bin/prettier --check .` using existing pinned host tooling | 2026-10-12 | PASS |
| Architecture boundaries | `node scripts/boundaries.mjs` with temporary TypeScript tooling link, removed after check | 2026-10-12 | PASS |
| Diff scope and whitespace | `git diff --check`; only canonical docs and Phase 0 task, no schema/runtime artifacts | 2026-10-12 | PASS |

| Initial worktree tooling checks unavailable | `node scripts/boundaries.mjs` missing TypeScript; `pnpm format:check` missing Prettier; corrected with explicit existing pinned tools, no dependency changes | 2026-10-12 | FAIL |

## Remaining work and readiness

NOT RUN: Phase 1 schema changes, migrations, real rollback injection, PR #7-schema backup upgrade, auth/CLI regression against unified schema, database drift and Phase 1 Docker suite. Blocked by merge gate; source inspection and prior authentication CI are not evidence for unified identity.

Phase 0 documentation is reviewable. Phase 1 is BLOCKED. Owner/provider questions are listed in the ADR; hosting/TLS/private Admin channel and deployment inputs remain unresolved. Next permitted implementation task is Phase 1 only after merged-main prerequisite and provenance refresh. No live Uniship request, provider persistence, account-management UI/API, Internet exposure, merge or deployment occurs here.
