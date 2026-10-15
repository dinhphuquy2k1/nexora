# NEXORA-017 — Carrier Connections & Encrypted Secrets Foundation

- **Task ID**: `NEXORA-017`
- **Status**: `COMPLETED`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`
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
