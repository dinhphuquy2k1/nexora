# NEXORA-020 — Non-destructive Manual Reconnect

- **Task ID**: `NEXORA-020`
- **Status**: `COMPLETED`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`
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

## Outcome and source inventory

Manual reconnect attempts to replace credentials; a failed candidate is not evidence that stored credentials are invalid. Recovery instead uses stored password after an unusable token, retaining its original fail-closed policy. Candidate login/verify contradiction has the new internal CANDIDATE_IDENTITY_MISMATCH; coherent verified userid vs stored account remains IDENTITY_MISMATCH. Both retain existing safe public/auth/generic-connect responses and existing audit reason. No persisted vocabulary or contract artifact changes.

| Case                                                 | Previous manual policy | Approved policy                       |
| :--------------------------------------------------- | :--------------------- | :------------------------------------ |
| CONNECTED + wrong password/rejected candidate        | REAUTH_REQUIRED        | CONNECTED; preserve old secrets       |
| CONNECTED + timeout/5xx/429                          | ERROR                  | CONNECTED; backoff retained           |
| CONNECTED + login/verify inconsistency               | REAUTH_REQUIRED        | CONNECTED; reject candidate           |
| ERROR + wrong new password                           | REAUTH_REQUIRED        | ERROR                                 |
| REAUTH_REQUIRED + failed candidate                   | REAUTH_REQUIRED        | REAUTH_REQUIRED                       |
| Coherent verified userid differs from stored account | REAUTH_REQUIRED        | REAUTH_REQUIRED; preserve old secrets |

Claim still increments lifecycleVersion (and internal updatedAt) before HTTP. Rolling it back would permit stale work to pass CAS; credential replacement success is independent from version invalidation. All status writes retain existing user-generation/version predicates. Secret ciphertext, nonce/tag/key version/expiry/row identity, lastVerifiedAt, ownership and externalAccountId are preserved on failure. Late verified mismatch cannot alter the newer winner's complete row or secrets. Failure audit remains metadata-only. Recovery invalid password/identity remains REAUTH_REQUIRED; timeout/5xx/429 remains ERROR/backoff; crypto and durable audit-before-decrypt gates remain intact.

Production files under apps/api/src/carrier: application/carrier-connection-lifecycle.service.ts, domain/lifecycle.ts, infrastructure/uniship/uniship-adapter.ts, presentation/carrier-lifecycle.controller.ts. Regression files under apps/api/test: carrier-lifecycle.test.cjs, carrier-budget.test.cjs, carrier-lifecycle-integration.test.cjs. Four canonical owners above are synchronized via dated clarification. Historical Task018/019, schema/migrations, runtime roles, audit sink, crypto/keyring/AAD, Identity/RBAC, endpoint paths, UI/MFA/shipments and live gate are unchanged.

## Evidence

| Claim                                            | Evidence                                                                                                                                                                                                                                                                                                                              | Date       | Result |
| :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| Baseline and scope                               | git fetch/status; PR18 head cf0f512 matches branch, open/unmerged; required source/docs read                                                                                                                                                                                                                                          | 2026-10-16 | PASS   |
| Test-first RED                                   | node --test apps/api/test/carrier-lifecycle.test.cjs against baseline emitted JS:27 tests,16 failures reproduce destructive candidate status policy and missing distinct mismatch semantics                                                                                                                                           | 2026-10-16 | FAIL   |
| Targeted GREEN                                   | node --test carrier-lifecycle.test.cjs carrier-budget.test.cjs carrier-vault.test.cjs:32 PASS; no full build claim from emitted JS                                                                                                                                                                                                    | 2026-10-16 | PASS   |
| Production diff static boundary                  | pnpm lint: workspace boundaries and canonical vocabulary guard PASS                                                                                                                                                                                                                                                                   | 2026-10-16 | PASS   |
| Full API units                                   | pnpm --filter @nexora/api test:105 PASS against emitted JavaScript; separate from genuine full build                                                                                                                                                                                                                                  | 2026-10-16 | PASS   |
| Guard and contract                               | pnpm test:lint50 PASS; pnpm contracts:check reproducible and clean                                                                                                                                                                                                                                                                    | 2026-10-16 | PASS   |
| Frozen installation                              | pnpm10.34.6 install --frozen-lockfile all7 workspaces                                                                                                                                                                                                                                                                                 | 2026-10-16 | PASS   |
| Host genuine engine/build                        | prisma generate checksum HTTP403 at binaries.prisma.sh; host API build fails missing generated Prisma types; no bypass/fake client/history                                                                                                                                                                                            | 2026-10-16 | FAIL   |
| First source canonical attempt                   | run38863519346 attempt1:105 API units,33 real PG/Nest integration and genuine migrations PASS; stopped at BROWSER_LAUNCH before form interaction because Chromium DevToolsActivePort was absent; unchanged-source rerun, no assertion weakening                                                                                       | 2026-10-16 | FAIL   |
| Genuine full source quality                      | [run38863519346 attempt2](https://github.com/dinhphuquy2k1/nexora/actions/runs/38863519346/attempts/2) at0f4ebb0b960a3311960310562a8847da655955c0: pinned frozen install, pnpm lint/test:lint50/typecheck/test/docs:check/contracts:check/build,105 API/41 Web/2 database/1 UI/6 docs/3 operations tests all PASS                     | 2026-10-16 | PASS   |
| Real runtime-credential behavior and concurrency | Same run: pnpm test:integration33 PASS, complete secret/metadata preservation and old-token reuse after manual failure, HTTP401/503/generic400, both mismatch sources, recovery error matrix, late failed verified mismatch preserves newer winner full row/secrets; existing audit/crypto/stale/disable/recovery regressions PASS    | 2026-10-16 | PASS   |
| Canonical Docker verification                    | Same source/run attempt2: quality-docker.sh, runtime-smoke.sh (actual credential mounts/privileges, CLI/TTY/session and real browser), data-smoke.sh (rows/files/both secrets across restart/down-up), dev-smoke.sh (HMR/shared propagation/frozen drift/preservation) all SUCCESS; genuine Prisma staged migration/repeat/drift PASS | 2026-10-16 | PASS   |

## Verification limits and final HEAD

Host genuine engine remains HTTP403-blocked; successful genuine Prisma CI provides required full build/typecheck/migration/integration evidence. Emitted-JS local tests are not substituted for it. The source browser-launch failure and unchanged-source successful rerun are preserved above. All four canonical scripts passed on the implemented source. This closing record is documentation-only and receives a fresh full canonical workflow; final HEAD SHA/status/link are recorded on PR18, avoiding self-referential SHA evidence. No merge, new PR, force-push, user-volume reset, live call or unapproved schema/runtime change occurred. READY TO REVIEW for this owner-approved mock-only follow-up after final-head CI succeeds; live authorization remains OPEN outside scope.
