# NEXORA-020 — Non-destructive Manual Reconnect

- **Task ID**: `NEXORA-020`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `NOT VERIFIED`
- **Classification**: SIGNIFICANT
- **Branch**: `feat/uniship-carrier-integration`
- **Baseline**: `cf0f5129060d5dea9030ee61549b7de6f1e02702`

## Scope and preflight

PR18 open/unmerged, remote/local HEAD match reviewed baseline, clean worktree; Task020 unused. Owner explicitly approves non-destructive manual reconnect failures, with verified stored-identity mismatch the exception. Read mandatory AI sequence, routed backend/API/ADR007 and historical Task018. No schema/migration/runtime-role/audit-sink/crypto/Identity/UI/live-gate change. Documentation Impact: REQUIRED below.

## Plan and interface preflight

1. Test-first manual wrong-password/outage/429/token-rejection/candidate-inconsistency across CONNECTED/ERROR/REAUTH_REQUIRED; preserve old token usability, secret rows and verification time, emit existing failure audit. Keep recovery regression matrix and late-result fencing.
2. Add one internal CANDIDATE_IDENTITY_MISMATCH code for login/verify inconsistency. Retain IDENTITY_MISMATCH for verified userid vs stored connection. Both map to existing safe HTTP authentication errors and existing audit IDENTITY_MISMATCH reason; no new persisted vocabulary or DTO.
3. Manual failure handler writes REAUTH_REQUIRED only for verified stored-identity mismatch, through existing generation/version CAS. All other manual failures preserve prior state/secrets/lastVerifiedAt. Claim increment remains: fencing is independent of successful replacement, never rolled back.
4. Recovery failure handler retains prior classification, including candidate-inconsistency → REAUTH_REQUIRED as before, provider failures → ERROR/backoff and crypto failure → no state write. Durable audit-before-decrypt, rate budgets, singleflight and one retry remain intact.
5. Add real PostgreSQL/Nest HTTP and loopback-provider regressions under actual restricted runtime role, including late failed manual result after newer success and unchanged secret snapshots. No DB locks during HTTP.
6. Append dated owner-approved ADR clarification; update backend/API/current testing semantics without rewriting Task018/019 history. Run targeted RED/GREEN, pinned frozen/static checks and full canonical Docker CI. Commit/push same branch, update existing PR18, no force/new PR/merge. Final HEAD requires full CI.

## PLAN ISSUES

None for this owner-approved behavioral change. UNISHIP_LIVE_AUTHORIZATION remains OPEN and external transport hard-closed.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Manual replacement failure preserves previous connection; distinguish candidate inconsistency from verified stored identity mismatch; recovery policy and version fencing preserved.

### Canonical owners

- docs/decisions/multi-carrier-architecture.md (dated clarification)
- docs/architecture/backend.md
- docs/architecture/api-contract.md
- docs/operations/testing.md

### Documentation verification

pnpm docs:check, format:check, contracts:check and full canonical CI; no historical evidence rewrite.

## Evidence

| Claim              | Evidence                                                                                     | Date       | Result |
| :----------------- | :------------------------------------------------------------------------------------------- | :--------- | :----- |
| Baseline and scope | git fetch/status; PR18 head cf0f512 matches branch, open/unmerged; required source/docs read | 2026-10-16 | PASS   |

| Test-first RED | node --test apps/api/test/carrier-lifecycle.test.cjs against baseline emitted JS:27 tests,16 failures reproduce destructive candidate status policy and missing distinct mismatch semantics | 2026-10-16 | FAIL |
| Targeted GREEN | node --test carrier-lifecycle.test.cjs carrier-budget.test.cjs carrier-vault.test.cjs:32 PASS; no full build claim from emitted JS | 2026-10-16 | PASS |
| Production diff static boundary | pnpm lint: workspace boundaries and canonical vocabulary guard PASS | 2026-10-16 | PASS |

| Full API units | pnpm --filter @nexora/api test:105 PASS against emitted JavaScript; separate from genuine full build | 2026-10-16 | PASS |
| Guard and contract | pnpm test:lint50 PASS; pnpm contracts:check reproducible and clean | 2026-10-16 | PASS |
| Frozen installation | pnpm10.34.6 install --frozen-lockfile all7 workspaces | 2026-10-16 | PASS |
| Host genuine engine/build | prisma generate checksum HTTP403 at binaries.prisma.sh; host API build fails missing generated Prisma types; no bypass/fake client/history | 2026-10-16 | FAIL |

## Pending verification

Host full API build remains blocked by missing genuine generated Prisma types/engine; full typecheck/build/integration are not PASS from emitted JS. Genuine canonical CI must verify all unit/integration, contracts and four Docker scripts on final HEAD. No role/schema/migration/crypto/audit sink or live-gate changes are permitted.
