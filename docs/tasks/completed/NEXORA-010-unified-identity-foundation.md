# Task: NEXORA-010 — Phase 0 Architecture & Decisions

- **Task ID**: `NEXORA-010`
- **Status**: `COMPLETED`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`
- **Classification**: BOUNDED (Phase 0 reconciliation; original foundation architecture scope SIGNIFICANT)
- **Working branch**: `docs/unified-identity-phase-0`
- **Starting main SHA**: `7cfb01a5756c6787d00cbb940bd406a0157bf5b7`

Phase 0 architecture/documentation acceptance is verified at 0f0b0ab. Implementation IMPLEMENTED refers only to documentation; no unified identity runtime is implemented. The lifecycle/link transition receives its own final-head PR checks, reported externally without an evidence-only commit loop.

## Updated dependency baseline

PR #7 is merged at `ad01e74ae681ebf57787dc77188cf93b1e1c7f8e`, confirmed directly through GitHub and fetched main on 2026-10-12 (Asia/Saigon). The merged baseline includes LocalUser/local_users, Scrypt credentials and PostgreSQL sessions. The former open-PR blocker is historical, not current.

Run 38203709446 passed on final PR #7 head `a95d5abc292379cf04dc88179cb63c54c3d484f0`; no workflow run was returned for merge SHA ad01e74 during preflight. Future Phase 1 must confirm applicable baseline migration verification, provenance, real disposable migration tests and verified pre-upgrade backup/restore preparation. Phase 0 can proceed without implementing Phase 1.

PR #8 began at 4d3733a; origin/main was merged normally, without rebase/force-push. Conflicting ADR-005/database/setup/backup documents preserve main's implemented facts and add only planned direction. Initial fetch of a deleted auth branch failed; explicit main/Phase 0 fetch succeeded.

## Phase 0 scope and interface pre-flight

[Unified identity decision](../../decisions/unified-identity.md) owns approved direction, future access/session policy, provider questions/error policy and phase boundaries. [Database](../../architecture/database.md) owns the planned database summary; [Backup and restore](../../operations/backup-restore.md) owns upgrade safeguards. Existing runtime/API/SDK/UI stay unchanged.

Inspection of merged-main code/history found: LocalUser maps local_users; UUID ID, unique case-sensitive username, password_hash VARCHAR(255), is_active default true, preserved timestamps; Session references LocalUser with cascade and non-unique user index. Named objects include local_users_pkey, local_users_username_key and sessions_user_id_fkey. The trusted compiled CLI delegates to infrastructure user-provisioner, the only production localUser.create found; integration tests create isolated accounts, smoke invokes the real CLI, and historical pre-auth fixture has no identities. No production seed/public registration was found. Merged-main inspection confirms these production paths; this planning audit does not authorize migration yet. NEXORA-011 repeats provenance preflight on its implementation baseline and accounts for unsupported direct writes.

Only infrastructure may consume database code. Existing application service/guards retain validation, bounded admission, dummy Scrypt, Origin/Host policy, opaque session issuance/revocation and safe failure envelopes. Phase 1 adapts infrastructure records and trusted provisioning; local Login requires ADMIN, ACTIVE and a local credential. Sessions reject DISABLED users. Preserve compatible public user summaries and generated contracts unless a demonstrated interface change requires deliberate regeneration.

## Phase ownership

NEXORA-010 owns only the documentation, architecture/access decisions, provider questions, upgrade planning and reconciliation delivered by PR #8. Implementation IMPLEMENTED means the documentation changes exist; the unified identity runtime remains PLANNED. [NEXORA-011](NEXORA-011-unified-identity-migration.md) exclusively owns the detailed Phase 1 migration/test plan and future acceptance criteria.

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

| Claim                                               | Evidence                                                                                                                                                                                      | Date       | Result |
| :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Main/branch baseline inspected                      | git fetch origin; git status --short; git rev-parse HEAD origin/main; separate documentation worktree from 7cfb01a                                                                            | 2026-10-12 | PASS   |
| Historical pre-merge prerequisite failed            | GitHub get_pr_info: #7 OPEN, merged=false, head a95d5abc292379cf04dc88179cb63c54c3d484f0; main 7cfb01a                                                                                        | 2026-10-12 | FAIL   |
| PR-head CI succeeds, not merged-main evidence       | [Run 38203709446](https://github.com/dinhphuquy2k1/nexora/actions/runs/38203709446), connector completed/success for a95d5abc292379cf04dc88179cb63c54c3d484f0                                 | 2026-10-12 | PASS   |
| Phase 0 documentation governance and relative links | `pnpm docs:check` on documentation worktree                                                                                                                                                   | 2026-10-12 | PASS   |
| Documentation-only repository formatting            | `/workspace/work/nexora/node_modules/.bin/prettier --check .` using existing pinned host tooling                                                                                              | 2026-10-12 | PASS   |
| Architecture boundaries                             | `node scripts/boundaries.mjs` with temporary TypeScript tooling link, removed after check                                                                                                     | 2026-10-12 | PASS   |
| Diff scope and whitespace                           | `git diff --check`; only canonical docs and Phase 0 task, no schema/runtime artifacts                                                                                                         | 2026-10-12 | PASS   |
| Initial worktree tooling checks unavailable         | `node scripts/boundaries.mjs` missing TypeScript; `pnpm format:check` missing Prettier; corrected with explicit existing pinned tools, no dependency changes                                  | 2026-10-12 | FAIL   |
| PR #7 merge baseline confirmed                      | GitHub #7 merged=true at ad01e74ae681ebf57787dc77188cf93b1e1c7f8e; explicit origin/main fetch and merged schema inspection                                                                    | 2026-10-12 | PASS   |
| Reconciled documentation checks                     | `pnpm docs:check`, `pnpm format:check`, `node scripts/boundaries.mjs`, pinned shared tooling on PR #8 merged working tree                                                                     | 2026-10-12 | PASS   |
| Canonical baseline and evidence structure           | Python asserts four conflicting owner bodies retain origin/main text verbatim; one uninterrupted Evidence table; final net diff documentation only                                            | 2026-10-12 | PASS   |
| Intermediate Phase 1 task record validator failure  | Initial planned task omitted required canonical Evidence table; corrected with executed baseline-inspection evidence, not implementation verification                                         | 2026-10-12 | FAIL   |
| Phase 0 hosted verification and review disposition  | [Run 38218448234](https://github.com/dinhphuquy2k1/nexora/actions/runs/38218448234) completed SUCCESS on 0f0b0ab4474407f8e06f477532322ddb90c73ee8; GitHub confirmed three P2 threads resolved | 2026-10-12 | PASS   |

## Phase 0 acceptance and completion

Phase 0 requires all future identity/access/provider/oracle/session/deployment/last-Admin policies, safe migration/upgrade specification, preserved ADR-005/runtime facts, contiguous evidence and consistent task ownership. Local documentation/format/boundary/net-diff checks and final-head CI are required; review findings must have verified disposition. These Phase 0 gates passed on 0f0b0ab and all three technical threads are resolved, so this documentation task is COMPLETED/VERIFIED and moved to completed. Phase 1 verification belongs solely to NEXORA-011. No phase is automatically merged or deployed.
