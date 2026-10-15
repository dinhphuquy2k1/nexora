# NEXORA-017 — Carrier Connections & Encrypted Secrets Foundation

- **Task ID**: `NEXORA-017`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`
- **Classification**: SIGNIFICANT
- **Baseline**: `dd7d975cfbce960cfe37387a3d3c6e3ce1e638a3`
- **Branch**: `feat/carrier-connections-foundation`

## Preflight

PR #16 is merged; origin/main matches the requested baseline. Worktree was clean. Only unrelated PR #14 remains open and is excluded. Task IDs inspected: 017 is next unused. Read repository governance, ADR-005/007, canonical backend/database/API/runtime/configuration/testing and NEXORA-015/016.

## Implementation plan

1. Write failing crypto/HTTP/transaction tests; define genuine PostgreSQL staged migration verification.
2. Add forward-only Carrier schema, named CHECK/unique/FK/index constraints; preserve all existing tables.
3. Implement shared AES-256-GCM/HKDF primitive and versioned key provider. Keep key errors isolated from application startup.
4. Add metadata-only Carrier port/service/adapter/controllers and generated contracts.
5. Extend disablement atomically; all Carrier writers lock ACTIVE user before connection/secret rows.
6. Verify migrations, ownership, crypto, races, regressions and canonical Docker suite; synchronize docs; inspect full diff, commit/push/open PR; verify exact HEAD CI. Never merge.

## Interface preflight

Carrier metadata DTO: id, provider, externalAccountId, nullable loginIdentifier, displayName, status, nullable lastVerifiedAt, createdAt. GET carriers/connections, PATCH displayName only, DELETE success only; session owner only, mutations require Origin. No create/reconnect/admin Carrier endpoint. Common crypto accepts purpose and AAD bytes, returns ciphertext/nonce/authTag/keyVersion; no Carrier/Identity imports. Carrier internal secret writer encrypts outside transaction then locks ACTIVE owner, verifies connection ownership and upserts inside transaction. No production password reader until durable SecurityAuditPort is approved.

## Security invariants

Global provider/account uniqueness; no secret metadata serialization. User lock precedes connection/secret writes; existing admin advisory lock precedes sorted user locks. Disable clears secrets and marks REAUTH_REQUIRED with sessions/setup revocation in one transaction. Reactivation restores nothing. Missing/wrong keys fail closed without connection changes or Identity coupling. No network/crypto work under DB locks; no MFA tables or session assurance column.

## PLAN ISSUES

CARRIER_KEY_CUSTODY resolved by explicit owner approval in chat (2026-10-15): server-only CARRIER_KEYRING_JSON positive version-to-canonical-base64 32-byte keys and CARRIER_ACTIVE_KEY_VERSION. Versioned decryption retains old keys; no automatic generation/removal/re-encryption. ADR-007 amended only for this approved interface. SecurityAuditPort/durable sink remains PR4 dependency; no production password-decryption path exists in PR3.

## Acceptance criteria

Schema/constraints, AES-GCM/HKDF/AAD/version tests, ownership HTTP tests, atomic disable/rollback/no late writes, real PostgreSQL fresh/PR16 upgrade/repeat/drift/preservation, existing PR2 tests, contracts/docs and fresh exact-HEAD CI must pass before COMPLETED/VERIFIED. PR4 remains planned.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Carrier persistence, metadata APIs, shared crypto and key custody, stage-aware disablement and verification commands.

### Canonical owners

- docs/architecture/backend.md
- docs/architecture/database.md
- docs/architecture/api-contract.md
- docs/architecture/runtime.md
- docs/operations/configuration.md
- docs/operations/testing.md
- docs/ai/PROJECT_RULES.md
- docs/ai/IMPLEMENTATION_WORKFLOW.md
- docs/decisions/authentication.md
- docs/decisions/unified-identity.md
- docs/decisions/multi-carrier-architecture.md (owner-approved key custody amendment only)

### Documentation verification

pnpm docs:check; pnpm format:check; pnpm contracts:check; complete diff review.

## Evidence

| Claim                       | Evidence                                                                                                | Date       | Result |
| :-------------------------- | :------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| Crypto test-first RED       | carrier-crypto.test.cjs before primitive implementation: module absent, test failed                     | 2026-10-15 | FAIL   |
| Crypto unit security matrix | node --test apps/api/test/carrier-crypto.test.cjs, 4/4                                                  | 2026-10-15 | PASS   |
| Frozen dependencies         | pnpm 10.34.6 install --frozen-lockfile                                                                  | 2026-10-15 | PASS   |
| Layer lint                  | pnpm lint, boundaries and ESLint                                                                        | 2026-10-15 | PASS   |
| Native database generation  | pnpm --filter @nexora/database build, genuine engine checksum download HTTP 403 from binaries.prisma.sh | 2026-10-15 | FAIL   |

Genuine PostgreSQL/Nest/migration and complete canonical runtime evidence passed in the fresh pipelines below. Native API build/typecheck cannot pass without genuine generated Prisma client; no checksum bypass/fabricated history or client used. No prior PR evidence is reused as a PASS for this task.

## Verification follow-up

Initial hosted [CI 38744581704](https://github.com/dinhphuquy2k1/nexora/actions/runs/38744581704) at 9035ae4 failed during API compilation: Pick<ProcessEnv,...> incorrectly required named environment properties. Changed the constructor to a readonly environment string map, preserving lazy validation. Also strengthened the real PostgreSQL race gate: query pg_stat_activity and require four concurrent lock waiters before release; no sleeps establish success. Synchronized current identity decision summaries with implemented PR3 foundation; historical task evidence remains untouched. Fresh exact-head pipeline is required after these corrections.

The final security assertion explicitly targets the retained connection for a post-disable secret write and requires UNAUTHORIZED, rather than accepting NOT_FOUND from the connection participating in the delete race. This closes a possible false-positive in that one assertion without changing production behavior or weakening any test. Fresh CI must verify this final test head before task completion.

## Fresh canonical verification and completion

| Claim                                          | Evidence                                                                                                                                                                                                                            | Date       | Result |
| :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| First hosted compilation                       | [CI 38744581704](https://github.com/dinhphuquy2k1/nexora/actions/runs/38744581704) at 9035ae4: required Pick environment keys caused TypeScript failure; fixed, no test skipped                                                     | 2026-10-15 | FAIL   |
| Full foundation pipeline                       | [CI 38744886508](https://github.com/dinhphuquy2k1/nexora/actions/runs/38744886508) at 59a898d: complete quality/migration/runtime/browser/persistence/dev success                                                                   | 2026-10-15 | PASS   |
| Final security assertion and complete pipeline | [CI 38746106188](https://github.com/dinhphuquy2k1/nexora/actions/runs/38746106188) at bea8b7ee6f666362b56574e40daf16f05570313c, all steps success                                                                                   | 2026-10-15 | PASS   |
| Real migrated HTTP and concurrency             | Same fresh CI: 21/21 integration tests including Carrier matrix, four observed independent PostgreSQL lock waiters, rollback snapshots and retained-connection late write requires UNAUTHORIZED; all PR2 suites preserved           | 2026-10-15 | PASS   |
| Crypto and existing unit regressions           | Same fresh CI: API 69/69 (crypto 4), Web 41/41, database 2/2, UI 1/1, docs 6/6, operations 3/3                                                                                                                                      | 2026-10-15 | PASS   |
| Genuine migrations and preservation            | Same fresh CI: fresh seven-migration deployment; real six-migration baseline -> Carrier upgrade; exact users/credentials/sessions/setup-tokens/files preserved; constraints/FK/cascades/global uniqueness/indexes/repeat/drift pass | 2026-10-15 | PASS   |
| Required quality commands                      | Same fresh CI quality-docker.sh: frozen dependencies, format:check, lint, docs:check, typecheck, test, test:integration, test:docs, test:operations, contracts:check, boundaries, build and database test:migrations                | 2026-10-15 | PASS   |
| Canonical runtime and persistence              | Same fresh CI runtime-smoke.sh (including actual Login/setup browser and provisioning), data-smoke.sh, dev-smoke.sh all pass; only disposable CI-owned volumes removed                                                              | 2026-10-15 | PASS   |
| Native contracts and diff                      | pnpm contracts:generate then contracts:check; git diff --check; complete task-owned diff reviewed, historical migrations unchanged                                                                                                  | 2026-10-15 | PASS   |

All acceptance criteria are satisfied at the verified implementation/test head above. CARRIER_KEY_CUSTODY is resolved by explicit owner approval; no acceptance-blocking PLAN ISSUE remains. Final completion-record HEAD must still receive fresh CI and the final report must link that exact run. Native engine-download/typecheck failures and the first CI compile failure remain visible; no historical PR PASS is substituted for this work. No volume reset, db push, fake migration history, live provider call, force-push, rebase or merge occurred.

Implemented paths: GET /api/carriers; GET /api/carrier-connections; PATCH /api/carrier-connections/:id (displayName only); DELETE /api/carrier-connections/:id. Main code owners: carrier/domain/application/infrastructure/presentation; common/crypto; identity/infrastructure/user-management.adapter.ts; database schema/new migration; generated OpenAPI/SDK. New Carrier vocabulary exports use as const and derived union types; no enums.

PR4 remains PLANNED: provider contract/live merge gate, create/reconnect, verification, automatic refresh/re-login, durable SecurityAuditPort/sink and Carrier UI. Production password decryption is unavailable until durable audit is confirmed; PR3 provides generic primitive tests and encrypted writes only. ADMIN cross-user Carrier endpoints/CLI remain post-PR6. MFA/auth_level, public HTTPS, shipments/dashboard/workers are excluded. PR14 is untouched.

Documentation Impact: REQUIRED is satisfied by synchronized canonical owners and executed validation. NEXORA-017 follows PLANNED -> IN PROGRESS -> VERIFICATION PENDING -> COMPLETED. PR17 is ready for review after exact final-head CI success, never automatically merged.

## Canonical vocabulary enforcement follow-up — 2026-10-15

Classification: SIGNIFICANT. Documentation Impact remains REQUIRED. Reopened from COMPLETED for the owner-requested PR17 follow-up; all previous evidence above is historical and preserved. Reviewed remote/local HEAD f438f19e19f47fc8b7529eb08cec6f118230880f, clean worktree, PR17 open/unmerged; no new PR or unrelated work.

### Plan and interface preflight

1. Test-first local AST ESLint rule using actual RuleTester/ESLint plus CLI failure/success probes. First demonstrate that violations are accepted without the rule (RED), then enable it before production changes to reproduce the four violations with nonzero lint exit.
2. Rule scope: production apps/api/src/identity and carrier TypeScript; no blanket application/infrastructure exclusion. Recognize status/role/provider/secretType fields in object writes, nested Prisma filters, comparisons and assignments, including TypeScript wrappers. Ambiguous ERROR requires connection context. Never classify string value alone. Tests/generated/declarations/messages/routes are excluded. Canonical declaration keys are accepted without blanket file exemptions; arbitrary as-const objects with persisted fields are still checked.
3. Reuse identity/domain/user-policy.ts UserStatus/UserRole and carrier/domain/carrier.ts ConnectionStatus/CarrierProvider/SecretType. Both leaf files have no imports: direct cross-feature imports introduce no cycle; do not move/duplicate constants. Fix three statuses and provider metadata after RED. Keep transactions/locking, HTTP/crypto/schema semantics identical.
4. Add test:lint and run it in pnpm quality, while pnpm lint retains boundaries and enables the AST rule at error severity. Execute rule tests with real TypeScript AST and actual config, prove CLI exit nonzero then zero, and retain existing lint rules.
5. Synchronize PROJECT_RULES, testing and implementation checklist plus this task. No new ADR decision. Run pinned frozen/static/unit/contracts and genuine canonical Docker CI at new HEAD, inspect entire diff, commit/push to existing branch, no rebase/force-push/merge.

### Confirmed audit at reviewed HEAD

- carrier/infrastructure/carrier.adapter.ts:28 — UserStatus ACTIVE comparison.
- carrier/infrastructure/carrier-secret-writer.ts:38 — UserStatus ACTIVE comparison.
- identity/infrastructure/user-management.adapter.ts:161 — ConnectionStatus REAUTH_REQUIRED update.
- carrier/application/carrier.service.ts:8 — CarrierProvider uniship metadata return.

Other matching values are canonical declarations, type vocabulary, unrelated messages/labels or SQL fixtures; no mechanical string replacement is permitted. Scope and deliberate context limitations must be documented and tested. Acceptance: all four fixed, real AST guard and positive/negative/config/CLI tests pass, no added cycles/boundary violations, contracts/crypto/migrations/behavior unchanged, canonical docs synchronized, commit pushed to PR17, fresh full exact-HEAD CI passes. Follow-up verification has not yet executed.

### Executed RED -> GREEN evidence

| Claim                               | Evidence                                                                                                                                            | Date       | Result |
| :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Regression RED before guard         | node --test scripts/eslint-rules/no-domain-vocabulary-literals.test.mjs with no-op rule: first invalid ACTIVE comparison expected 1 error, actual 0 | 2026-10-15 | FAIL   |
| Production RED after enabling guard | pnpm lint exited 1 with exactly four nexora/no-domain-vocabulary-literals errors at the audited locations, before production refactor               | 2026-10-15 | FAIL   |
| Production GREEN after refactor     | pnpm lint: boundary checker and all existing/new ESLint rules pass after canonical leaf imports; no suppressions                                    | 2026-10-15 | PASS   |

The rule implementation uses AST nodes rather than source regex. Ambiguous ERROR handling and contextual scope are deliberate; unknown aliases/dynamic properties/raw SQL remain manual review responsibilities. No architecture PLAN ISSUE: domain leaves are dependency-free. Fresh native/static/regression and full exact-head Docker CI evidence pending; previous pipeline PASS above is not reused for this follow-up.

| Claim                       | Evidence                                                                                                                                                            | Date       | Result |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| Guard GREEN                 | pnpm test:lint, 42/42: RuleTester TS AST, actual config exclusions/severity, CLI exit 1 -> 0, all owning declarations covered                                       | 2026-10-15 | PASS   |
| Acyclic imports             | node /workspace/work/vocab-cycles.mjs: TypeScript static import/re-export graph over all 42 API source files, zero cycles; domain leaf imports have no dependencies | 2026-10-15 | PASS   |
| Native regression           | pnpm --filter @nexora/api test: 69/69 using emitted unchanged-behavior JS; this alone does not establish genuine Prisma build                                       | 2026-10-15 | PASS   |
| Native frozen/static checks | pnpm 10.34.6 install --frozen-lockfile; lint/boundaries; docs:check; format:check; git diff --check                                                                 | 2026-10-15 | PASS   |
| Native full typecheck       | API_INTERNAL_URL configured, pnpm typecheck fails genuine Prisma schema-engine download with EAI_AGAIN to binaries.prisma.sh; no fake client/checksum bypass        | 2026-10-15 | FAIL   |
| Contract regression         | pnpm contracts:check: reproducible PASS, generated OpenAPI/SDK unchanged                                                                                            | 2026-10-15 | PASS   |

Native PostgreSQL integration and Docker smoke are NOT RUN on the restricted host; canonical hosted CI must execute the actual scripts and genuine migration history at the new pushed HEAD. ADR007, schema/migrations, DTOs/OpenAPI, crypto and transaction lock ordering are unchanged by this follow-up.
