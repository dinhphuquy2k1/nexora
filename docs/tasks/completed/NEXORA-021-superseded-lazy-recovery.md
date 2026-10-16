# NEXORA-021 — Superseded Lazy Recovery

- **Task ID**: `NEXORA-021`
- **Status**: `COMPLETED`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`
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

## Outcome and invariants

Precise failure: withToken reads expired/rejected token at version10; failed manual claim advances to11 without changing credentials; old performRecovery returns void on version mismatch; caller sets recovered=true and uses the same bad token. Corrected orchestration never infers refresh from version or Promise completion. It always re-reads authorized current state and evaluates sealed revision alongside presence/expiry/known rejection.

| Internal result/state                              | Password budget         | Next action                                                               |
| :------------------------------------------------- | :---------------------- | :------------------------------------------------------------------------ |
| COMMITTED                                          | Consumed                | Re-read; use only eligible current token                                  |
| SUPERSEDED before vault/claim CAS loss             | Not consumed            | Re-read; reuse changed eligible token or spend bounded remaining recovery |
| JOINED                                             | Leader's consumption    | Re-read; same eligibility and shared logical-operation limits             |
| SUPERSEDED after vault entry                       | Conservatively consumed | Reuse eligible newer token, otherwise existing STALE                      |
| Same expired/rejected sealed token                 | Recovery still required | One eligible actual attempt, never false success                          |
| Three decisions exhausted / state cannot stabilize | No further work         | Existing STALE, no callback with unusable token                           |

The shared budget spans both initial-expiry and post-rejection phases. At most one vault/password attempt and one operation retry, with three recovery-flight decisions; bounded128 singleflight carries only outcome metadata and cleans up on success/failure. Unknown expiry is not validity evidence. Millisecond timestamps and upsert-stable IDs are unsuitable rotation markers; tokenRevision hashes only sealed ciphertext/nonce/tag/keyVersion after releasing DB locks. It is never persisted or exposed as API/log/audit data. No plaintext fingerprint/cache or extra schema field.

Manual NEXORA-020 policy is unchanged. ACTIVE user/ownership, generation/version CAS, user-before-connection locks, stale/delete/disable protection, durable audit then authorization revalidation before password decrypt, crypto failure preservation, provider limits/backoff and failure status classification remain intact. A newer committed manual winner is reused only after revalidation; its rows/secrets are never overwritten by stale recovery. Conservative vault-entry reservation can return safe bounded STALE even if contention happened before actual decrypt, rather than risk acquiring twice.

## Files and documentation

Production: carrier/application/carrier-connection-lifecycle.service.ts, carrier/application/carrier-lifecycle.port.ts, carrier/infrastructure/carrier-lifecycle.adapter.ts. Tests: carrier-lifecycle.test.cjs and carrier-lifecycle-integration.test.cjs. Canonical backend/ADR007/testing/API owners above record the dated clarification and existing503 behavior. Historical Task018/019/020 evidence, schema/migrations, DTO/OpenAPI/SDK, runtime roles/audit sink, vault/crypto formats/keyring/AAD, Identity/UI/shipment/MFA/live gates are unchanged.

## Evidence

| Claim                                         | Evidence                                                                                                                                                                                                                                                                                                                         | Date       | Result |
| :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Preflight                                     | git fetch/status and PR18 metadata:69158ee reviewed branch, clean, open/unmerged; Task021 unused                                                                                                                                                                                                                                 | 2026-10-16 | PASS   |
| Test-first RED                                | node --test apps/api/test/carrier-lifecycle.test.cjs against baseline:37 tests,4 FAIL reproduce expired/unknown-rejected token reuse and missing bound                                                                                                                                                                           | 2026-10-16 | FAIL   |
| Lifecycle GREEN                               | Same command after fix plus CAS/vault-entry regressions:39 PASS; local emitted JS only                                                                                                                                                                                                                                           | 2026-10-16 | PASS   |
| Full API units                                | pnpm --filter @nexora/api test:117 PASS                                                                                                                                                                                                                                                                                          | 2026-10-16 | PASS   |
| Static/contract                               | pnpm lint boundaries/canonical vocabulary and pnpm contracts:check reproducible, no DTO/OpenAPI/SDK drift                                                                                                                                                                                                                        | 2026-10-16 | PASS   |
| Frozen installation                           | pnpm10.34.6 install --frozen-lockfile all7 workspaces                                                                                                                                                                                                                                                                            | 2026-10-16 | PASS   |
| Guard regressions                             | pnpm test:lint50 tests executed                                                                                                                                                                                                                                                                                                  | 2026-10-16 | PASS   |
| Host genuine Prisma                           | prisma generate checksum HTTP403 at binaries.prisma.sh; no bypass/fake generated client; host full build still fails missing generated types                                                                                                                                                                                     | 2026-10-16 | FAIL   |
| Genuine full source quality                   | [run38871853296 attempt1](https://github.com/dinhphuquy2k1/nexora/actions/runs/38871853296) at ef7aac331a8c6192fdbc96d63c4dfe2ddd60ce7f: pinned frozen install, format/lint/test:lint50/typecheck/test/docs/contracts/build;117 API/41 Web/2 database/1 UI/6 docs/3 operations tests PASS                                        | 2026-10-16 | PASS   |
| Real Nest/runtime-role race tests             | Same run:41 genuine PostgreSQL integration tests PASS; expired failed claim for1 and20 callers, unknown-expiry rejection, successful manual reuse with zero password audit, repeated churn bounded to3 decisions, disable/delete/foreign owner and stale completion reuse; real DB rows/revisions/audit/provider counts asserted | 2026-10-16 | PASS   |
| Complete canonical Docker source verification | Same source/run attempt1: quality-docker.sh, runtime-smoke.sh including actual browser/CLI/TTY and authority checks, data-smoke.sh full row/file/both-secret persistence, dev-smoke.sh HMR/shared/frozen drift all SUCCESS; genuine Prisma staged migration/repeat/drift PASS                                                    | 2026-10-16 | PASS   |

## Final HEAD and limitations

Host genuine Prisma download remains HTTP403-blocked; executed genuine hosted CI supplies full build/typecheck/migration/integration evidence. Local emitted JS is not substituted for persistence evidence. No source CI retry was needed. The closing record is documentation-only and receives another full canonical workflow; final HEAD SHA/status/link are recorded on PR18, avoiding self-referential SHA evidence. No user-volume reset, fake client/history, checksum bypass, external provider call, new PR, force-push or merge occurred. No unresolved implementation PLAN ISSUE; UNISHIP_LIVE_AUTHORIZATION remains OPEN outside this mock-only scope. READY TO REVIEW only after final-head canonical CI passes.

## Nullable-expiry follow-up

The initial source workflow above passed its executed coverage. Additional test-first review found an observed-expired sealed revision could appear eligible after metadata-only expiry changed to null during supersession. Regression RED:40 tests,1 FAIL, callback received expired instead of fresh. Pin the initially unusable revision across all rechecks, as already done for provider rejection; only changed eligible sealed credentials can replace that evidence. Local emitted-JS GREEN:40 lifecycle tests. The real PostgreSQL single-caller barrier now also changes only expiry to null through the administrative fixture, proves sealed revision unchanged, and requires one audited recovery. No production metadata writer or privilege change. Updated source ba4da52f562520e06f15a945db01e0a0d7cfd790 passed [full canonical run38873882638](https://github.com/dinhphuquy2k1/nexora/actions/runs/38873882638), attempt1:118 API units,41 genuine PostgreSQL integration tests,50 guard tests and all other workspace/docs/operations tests; frozen installation, format/lint/typecheck/contracts/build and all four quality/runtime/data/dev Docker scripts SUCCESS. The single-caller PG barrier explicitly verifies unchanged sealed revision after administrative fixture expiry=null, then one committed PASSWORD_DECRYPT and one successful recovery with a new usable token;20 callers still share one acquisition. No CI retry required. Final documentation-only HEAD receives the same complete workflow; its SHA/result is recorded on PR18. No outstanding implementation PLAN ISSUE.
