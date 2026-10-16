# NEXORA-021 — Superseded Lazy Recovery

- **Task ID**: `NEXORA-021`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `NOT VERIFIED`
- **Classification**: SIGNIFICANT
- **Branch**: `feat/uniship-carrier-integration`
- **Baseline**: `69158ee9d39ab83bc58a038120c6db0ec5ddec9f`

## Scope and preflight

PR18 remote/local HEAD matches review; open/unmerged, clean worktree, Task021 unused and no active task covering this race. Read mandatory AI sequence, relevant backend/API/database/testing/ADR007 and historical Task018/020, lifecycle service/ports/adapter/vault/budget/tests. Manual failure increments version without credential replacement; Promise<void> wrongly implies recovery. No schema, DTO, role/audit-sink/crypto-format/Identity/UI/live change. Existing authorization/fences and owner-approved manual policy remain intact.

## Plan and internal interface preflight

1. Test-first deterministic expired and unknown-expiry rejection races; successful concurrent replacement;20-call singleflight, repeated supersession bounds, revocation and existing failure classifications. Reproduce RED before production edits.
2. Existing lastVerifiedAt/secret updatedAt have millisecond resolution; row IDs survive upsert. Neither reliably identifies committed token replacement. Add required internal tokenRevision to LifecycleSnapshot: SHA256 of existing sealed token artifact (ciphertext, nonce, tag, key version). Stable under claim; changes after encrypted token replacement. Hash sealed data only, never plaintext; no persisted column, public DTO, log or audit field. Compute in infrastructure; application remains Prisma/crypto-free.
3. Small private recovery outcome COMMITTED/SUPERSEDED/JOINED plus attempted flag. Version/generation supersession or claim CAS loss before vault entry consumes no password attempt. Joining preserves leader attempt consumption. Vault entry conservatively reserves the operation's only attempt even if a later STALE happens before decrypt, since stale completion may instead follow provider acquisition. Safe bounded STALE is preferable to guessing/repeating password use.
4. Shared per-logical-operation budget: at most3 recovery-flight decisions/rechecks, at most1 vault/password recovery attempt and1 operation retry. Every skipped/joined outcome requires fresh owner-scoped read, status/hasToken/expiry/rejected sealed revision re-evaluation. expiresAt null alone proves nothing. Successful replacement reuses changed eligible token; unchanged expired/rejected token may recover if budget permits; repeated churn returns existing STALE (public503).
5. Keep128-entry per-connection singleflight, provider budgets, audit-before-decrypt/revalidation, locks/CAS, failure policies and no HTTP under transactions. No plaintext in shared flight state. Extend real migrated PostgreSQL/Nest/runtime-role loopback tests with barriers and exact DB/audit assertions.
6. Dated ADR clarification plus backend/testing and API semantics only where needed; preserve Task018/019/020 history. Pinned frozen/static/targeted and full canonical Docker checks; existing branch/PR only, no force/merge. Final exact HEAD full CI required.

## PLAN ISSUES

No unresolved interface decision. Conservative vault-entry reservation may return bounded STALE after pre-decrypt contention even when no password was used, preserving the strict acquisition bound. Live authorization remains OPEN and hard-closed outside scope.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Explicit recovery outcomes, sealed-token revision evidence and bounded rechecks/retry budgets; version-only claims are not credential refresh.

### Canonical owners

- docs/architecture/backend.md
- docs/decisions/multi-carrier-architecture.md
- docs/operations/testing.md
- docs/architecture/api-contract.md (existing503 bounded stale semantics only; no DTO changes)

### Documentation verification

pnpm docs:check/format:check/contracts:check; genuine PostgreSQL and exact-head full canonical CI; no historical evidence rewrite.

## Evidence

| Claim     | Evidence                                                                                         | Date       | Result |
| :-------- | :----------------------------------------------------------------------------------------------- | :--------- | :----- |
| Preflight | git fetch/status and PR18 metadata:69158ee reviewed branch, clean, open/unmerged; Task021 unused | 2026-10-16 | PASS   |

| Test-first RED | node --test apps/api/test/carrier-lifecycle.test.cjs against baseline:37 tests,4 FAIL reproduce expired/unknown-rejected token reuse and missing bound | 2026-10-16 | FAIL |
| Lifecycle GREEN | Same command after fix plus CAS/vault-entry regressions:39 PASS; local emitted JS only | 2026-10-16 | PASS |
| Full API units | pnpm --filter @nexora/api test:117 PASS | 2026-10-16 | PASS |
| Static/contract | pnpm lint boundaries/canonical vocabulary and pnpm contracts:check reproducible, no DTO/OpenAPI/SDK drift | 2026-10-16 | PASS |

| Frozen installation | pnpm10.34.6 install --frozen-lockfile all7 workspaces | 2026-10-16 | PASS |
| Guard regressions | pnpm test:lint50 tests executed | 2026-10-16 | PASS |
| Host genuine Prisma | prisma generate checksum HTTP403 at binaries.prisma.sh; no bypass/fake generated client; host full build still fails missing generated types | 2026-10-16 | FAIL |

## Pending verification

Local genuine Prisma engine acquisition remains blocked by network policy; full generated-client build/integration is not inferred from emitted JS. Exact new-head hosted canonical CI must execute genuine migration, real race tests and all four Docker scripts. No completion claim before that evidence. Revision hashing occurs after transaction release; no provider, crypto or retry work is moved under locks.
