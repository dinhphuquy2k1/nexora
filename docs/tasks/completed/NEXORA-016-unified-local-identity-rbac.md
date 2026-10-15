# NEXORA-016 — Unified Local Identity, RBAC & Legacy Provider Removal

- **Task ID**: `NEXORA-016`
- **Status**: `COMPLETED`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`
- **Classification**: SIGNIFICANT

## Baseline and scope

Baseline main `cc43981b697673d6d1a488f76d9ef545b094b533`, merged ADR-007 PR #15. Branch `feat/unified-local-identity-rbac`. Open PR #14 is unrelated and excluded. Implement Logical PR 2, not Carrier Connections/MFA/HTTPS/sync. No historical migration edits or user-volume reset.

## Plan and interface preflight

1. Test-first unified local login and atomic session issuance after password verification outside the transaction; lock user, recheck role/status/exact verified hash, insert opaque session.
2. Database-backed ADMIN authorization; approved operator creation/reissue/setup-password endpoints and short user-first token transactions. Hashing outside transactions, 24h single-use token hashes, no credential overwrite or automatic login.
3. Application status use case: advisory lock before row locks for admin reductions; atomic disable/session revocation/setup-token invalidation. No future Carrier/MFA tables touched.
4. Forward migration adds operator_setup_tokens and drops external_identities preserving users/credentials/sessions and stored files. Remove legacy identity provider API/ports/UI/scripts; retain Uniship transport/parser tests under Carrier with independent types.
5. Single local Login and fragment-only /setup UI: consume fragment client-side, clear history, no-store/no-referrer, no third-party assets. Regenerate OpenAPI/SDK.
6. Genuine isolated PostgreSQL tests for migration/preservation, session hash/status races, consume/consume, consume/reissue, consume/disable and concurrent last-admin reductions; canonical quality/runtime/data/dev CI at final head.

## PLAN ISSUE — USER_STATUS_ADMIN_CONTRACT

RESOLVED — owner explicitly approved the complete proposed contract in chat on 2026-10-15. Routes may now be implemented and generated.

- `GET /api/admin/users`: ACTIVE ADMIN session; 200 `{users:[{id,username,role,status,hasPassword,createdAt,updatedAt}]}`; no hashes/tokens. 401 no session, 403 OPERATOR. Local deployment only.
- `PATCH /api/admin/users/:id/status`: ACTIVE ADMIN plus OriginGuard; body `{status:'ACTIVE'|'DISABLED'}` only, role cannot be supplied. 200 `{user:{id,username,role,status,hasPassword,createdAt,updatedAt}}`; 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 403 FORBIDDEN/invalid Origin, 404 NOT_FOUND, 409 LAST_ACTIVE_ADMIN.
- ADMIN may change OPERATOR, another ADMIN or itself subject to last ACTIVE ADMIN protection. Self-disable is allowed only while another ACTIVE ADMIN remains and revokes its own sessions as part of the transaction.
- Reactivation creates/restores no sessions or setup tokens; an unconfigured ACTIVE OPERATOR needs explicit setup-link reissue.
- Tests: unauthenticated/OPERATOR denial, malformed body and Origin rejection, disabled actor denial, self/other ADMIN reduction, concurrent final-two-admin invariant, atomic revocation/invalidation and no resurrection.
- Decision: implement the approved routes together with the tested application use cases. No open status-contract blocker remains.

## Acceptance criteria

- Both eligible local roles log in; disabled/unconfigured/wrong-password users receive no session; transactional hash/status recheck defeats concurrent changes.
- Database-backed RBAC, ADMIN mutations require trusted Origin; no raw body role trusted.
- Approved onboarding endpoints enforce user-first locks, replay/expiration/non-overwrite, reissue and disable invalidation with real concurrency evidence.
- Last ACTIVE ADMIN cannot be disabled to zero concurrently.
- Legacy provider login returns 404 and disappears from contracts; Uniship client safety coverage retained in Carrier without session issuance.
- New migration preserves valid ADMIN/application data; cleanup is guarded, dry-run, explicit, never automatic.
- Single Login and /setup preserve cookie/redirect behavior; fragment token is absent from request URLs, Referer, server HTML and persistent browser storage.
- Canonical docs/contracts/tests updated; final CI matches HEAD. An unresolved status HTTP contract prevents whole-task completion.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Independent local authentication, RBAC and short issuance/disable/setup transactions.
- Operator setup-token storage/fragment transport; legacy identity removal and independent Carrier client.
- Implemented versus proposed HTTP contracts and staged local-only administration.

### Canonical owners

- `docs/decisions/authentication.md`
- `docs/decisions/unified-identity.md`
- `docs/decisions/multi-carrier-architecture.md`
- `docs/architecture/backend.md`
- `docs/architecture/database.md`
- `docs/architecture/api-contract.md`
- `docs/architecture/frontend.md`
- `docs/architecture/runtime.md`
- `docs/operations/configuration.md`
- `docs/operations/setup.md`
- `docs/operations/testing.md`
- `docs/operations/deployment.md`

### Documentation verification

- `pnpm docs:check`, `pnpm format:check`, `pnpm contracts:check` and final diff review.

## Evidence

| Claim                                                                             | Evidence                                                                                                                                                                                                                                                                          | Date       | Result |
| :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Main baseline and PR #15 merged status inspected                                  | `git log`; GitHub PR #15 merged at `cc43981b697673d6d1a488f76d9ef545b094b533`; clean checkout; unrelated PR #14 identified                                                                                                                                                        | 2026-10-15 | PASS   |
| API isolated unit suite                                                           | pinned pnpm API test, 59/59 using emitted JS; full build is not established by this result                                                                                                                                                                                        | 2026-10-15 | PASS   |
| Web helper and launcher suite                                                     | pinned pnpm Web test, 41/41                                                                                                                                                                                                                                                       | 2026-10-15 | PASS   |
| OpenAPI/SDK generation                                                            | pinned pnpm contracts:generate; provider login absent and management routes generated                                                                                                                                                                                             | 2026-10-15 | PASS   |
| Native Prisma build                                                               | engine download blocked by environment network policy (HTTP 403); no fabricated client/history or network bypass                                                                                                                                                                  | 2026-10-15 | FAIL   |
| Cleanup safety on disposable PostgreSQL                                           | actual psql cleanup harness: default dry-run, environment/database/prefix/confirmation guards and configured-user/ADMIN preservation                                                                                                                                              | 2026-10-15 | PASS   |
| Contracts drift                                                                   | pinned pnpm contracts:check after remote/local tree reconciliation                                                                                                                                                                                                                | 2026-10-15 | PASS   |
| Static documentation and formatting                                               | pinned pnpm lint, format:check, docs:check; docs tests 6/6; operations tests 3/3                                                                                                                                                                                                  | 2026-10-15 | PASS   |
| Hosted Docker quality, real migrated integration and migration preservation/drift | [run 38706660063](https://github.com/dinhphuquy2k1/nexora/actions/runs/38706660063), Docker quality and migrated integration step success at `cc8fdc7ec755f37d1cb68690caac6b3b309e9e5b`; includes genuine PostgreSQL concurrency and rollback suite                               | 2026-10-15 | PASS   |
| Hosted runtime and browser at updated head                                        | [run 38707261196](https://github.com/dinhphuquy2k1/nexora/actions/runs/38707261196), runtime/provisioning/TTY/browser step success at `688442b8a0cf681066ad4e7e5f10320447f369e2`; includes fragment setup, no auto-login and OPERATOR local login                                 | 2026-10-15 | PASS   |
| Native Web production build and typecheck                                         | API_INTERNAL_URL configured, pinned pnpm Web build and typecheck, including /setup                                                                                                                                                                                                | 2026-10-15 | PASS   |
| Full canonical pipeline with server-log privacy assertion                         | [run 38708069129](https://github.com/dinhphuquy2k1/nexora/actions/runs/38708069129), all steps successful at `abbae80fc8463bd14a06337ed5df4b57ab3090f7`: quality, real migration/integration, cleanup psql, runtime/browser/log privacy, persistence and dev HMR/dependency drift | 2026-10-15 | PASS   |
| Initial runtime migration-count check                                             | [run 38706660063](https://github.com/dinhphuquy2k1/nexora/actions/runs/38706660063) expected four migrations after a fifth was added; corrected to five in `688442b8a0cf681066ad4e7e5f10320447f369e2`, subsequent complete runs pass                                              | 2026-10-15 | FAIL   |
| Frozen dependency installation                                                    | pinned pnpm 10.34.6 install --frozen-lockfile, no lockfile changes                                                                                                                                                                                                                | 2026-10-15 | PASS   |
| Test-first local identity regression                                              | local-identity.test.cjs failed 3/3 against the baseline before implementation (old issuance API and configured OPERATOR rejection); subsequent API unit and genuine PostgreSQL suites pass                                                                                        | 2026-10-15 | PASS   |

## Original implementation verification scope (historical)

All implementation acceptance criteria passed in the full canonical pipeline at `abbae80fc8463bd14a06337ed5df4b57ab3090f7`. That run executes `sh scripts/quality-docker.sh` (format, boundaries/lint, docs, typecheck, unit, docs/operations tests, contracts drift, build, migrated integration, real Prisma migration and actual psql cleanup), `sh scripts/runtime-smoke.sh`, `sh scripts/data-smoke.sh` and `sh scripts/dev-smoke.sh`. Native Web build/typecheck and `git diff --check` also passed. Final completion-record CI is tracked on [PR #16](https://github.com/dinhphuquy2k1/nexora/pull/16); this record adds no runtime behavior.

Native full build/typecheck/integration cannot establish a PASS while the genuine Prisma engine download is blocked (HTTP 403/network DNS errors). Hosted Docker CI generated the genuine client, deployed real Prisma history and passed those checks; no fabricated client/history, schema push, checksum skip or network-policy bypass was used. Uniship live integration is NOT RUN and outside scope. No user volumes were reset; cleanup tests delete only their own disposable fixture data.

`USER_STATUS_ADMIN_CONTRACT` is resolved by explicit owner approval. There are no open PLAN ISSUES. MFA, sessions.auth_level, Carrier Connections, public HTTPS and shipment sync remain deferred. The first runtime failure was a stale harness migration count, corrected without weakening any check. The optional cleanup script is never applied automatically to an installation; CI explicitly tests it only against owned fixtures.

Documentation Impact remains REQUIRED. Authentication/unified identity/ADR-007, backend/database/API/frontend/runtime, configuration/setup/testing/deployment and generated OpenAPI/SDK are synchronized. Final report must cite the exact PR HEAD and its CI result separately from the verified implementation head above. No force-push, rebase or merge was performed.

## PR #16 review follow-up — 2026-10-15

Reviewed/reopened baseline `016ef52e4a1ac3446732191b6cb4dfe25b2b132b`; remote HEAD matches, worktree clean, existing CI 38709323395 passed only the prior head. Classification SIGNIFICANT; Documentation Impact REQUIRED remains applicable. Earlier completion evidence is historical and does not establish these review findings are resolved.

### Plan and acceptance criteria

1. I1: reproduce genuine pre-PR2 provider-session persistence through actual Prisma migrations on a fresh PostgreSQL database; cover ACTIVE credentialless provider OPERATOR, configured OPERATOR, local ADMIN, DISABLED user, expired sessions and stored files. Record the architecture conflict and obtain explicit owner decision before adding cutover SQL. Keep SessionGuard unchanged.
2. M1: remove obsolete operational provider-login 503 and two-mode guidance; describe current local login and independent future Carrier transport, preserving NEXORA-012 evidence as historical only. Reply to and resolve the existing setup P2 review thread only after the pushed fix addresses it.
3. M2: add the complete approved user-list/status matrix through real Nest HTTP and isolated PostgreSQL, checking statuses, error envelopes/codes, exact metadata and atomic revocation/no resurrection; keep existing transaction races and add concurrent self-disable HTTP requests.
4. m1: separate implemented PR2 routes from deferred Carrier/MFA/HTTPS contracts without changing DTOs/runtime contracts.
5. Execute fresh pinned/frozen/static/unit/contracts and canonical Docker quality/integration/migration/runtime/data/dev checks; report exact new HEAD CI, no historical PASS substitution. No migration edits, volume resets, new carrier/MFA features, force pushes or merge.

### PLAN ISSUE — LEGACY_PROVIDER_SESSION_CUTOVER

RESOLVED — owner explicitly approved the proposed minimum cutover policy in chat on 2026-10-15. Approved policy: a new forward-only migration deletes every session (valid or expired) whose user is OPERATOR and has no local credential at cutover; preserves ADMIN sessions, configured OPERATOR sessions, users/credentials/files and other session rows. The schema contains no authentication-source marker, so provider-origin sessions of an already-configured OPERATOR cannot be distinguished. Deleted hashes never return when the operator sets a password. This intentionally narrows the earlier blanket session-preservation statement. Implement it as new migration `20261015010000_legacy_provider_session_cutover`; historical migration files remain unchanged. Policy approval is resolved; the fresh review verification below closes this follow-up.

Canonical owners for this follow-up: ADR-007, authentication/unified identity, backend/database/API contract, setup/testing/deployment, and this task. Verify docs:check, format:check, contract drift and complete diff review.

### Review implementation and executed evidence

I1 tests were written before the new migration. The owned PostgreSQL SQL probe reproduced the baseline, then failed its desired revocation postcondition (RED). After the new migration, that same probe passed, preserving all four users, two credentials, two eligible sessions and the stored-file row (GREEN). This raw-DDL probe is not genuine Prisma history evidence; the staged Prisma/Nest tests provide that separately in canonical CI. No SessionGuard or authentication-source field was changed. Stop API/Web/provisioning writers for upgrade as documented.

M2 adds a separate real HTTP matrix in `apps/api/test/user-status-http.test.cjs`; adapter races remain untouched. M1/m1 update current setup/testing and remove PR2 routes from deferred contracts. NEXORA-012 historical task evidence is preserved. Native frozen install passed on 2026-10-15; fresh new-head results are recorded below.

### Fresh review verification (prior-head evidence is not reused)

| Claim                                                   | Evidence                                                                                                                                                   | Date       | Result |
| :------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Frozen dependencies                                     | pnpm 10.34.6 install --frozen-lockfile, current review changes                                                                                             | 2026-10-15 | PASS   |
| I1 baseline reproduction and desired negative assertion | owned unpublished PostgreSQL 17.11, original five migration DDL files; provider session still eligible; revocation assertion failed before new SQL         | 2026-10-15 | FAIL   |
| I1 minimum approved cutover SQL                         | same fresh-database probe after sixth migration: only credentialless OPERATOR sessions removed, ADMIN/configured sessions/users/credentials/file preserved | 2026-10-15 | PASS   |
| Review lint and documentation                           | pnpm lint (including boundaries), pnpm docs:check on review changes                                                                                        | 2026-10-15 | PASS   |

Fresh genuine Prisma/Nest integration, migration drift and full Docker runtime/data/dev subsequently passed at the review implementation head (see below). The raw DDL probe is not reported as Prisma deployment evidence. M1/M2/m1 implementation is in place; I1 policy is approved and SQL implemented, verified by the fresh full pipeline recorded below.

### Fresh review evidence at implementation head

| Claim                                                    | Evidence                                                                                                                                                                                                                                                                                      | Date       | Result |
| :------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Real Prisma/Nest review integration and migration checks | [CI 38715955191](https://github.com/dinhphuquy2k1/nexora/actions/runs/38715955191), Docker quality and migrated integration step success at `7e3d87aefb7d7c7de4ceeaa89d29e7fcd4018b55`; includes I1 staged reproduction/cutover/setup/no-resurrection, full M2 HTTP matrix and existing races | 2026-10-15 | PASS   |
| Current contracts unchanged                              | pnpm contracts:check at `7e3d87aefb7d7c7de4ceeaa89d29e7fcd4018b55`, Contracts reproducible PASS                                                                                                                                                                                               | 2026-10-15 | PASS   |
| Review documentation/operations unit suites              | pnpm test:docs 6/6, pnpm test:operations 3/3, format:check and docs:check                                                                                                                                                                                                                     | 2026-10-15 | PASS   |
| Native full typecheck                                    | configured API_INTERNAL_URL with pnpm typecheck; genuine Prisma engine download fails under environment network restrictions; no client/history substitution                                                                                                                                  | 2026-10-15 | FAIL   |
| Setup P2 review finding addressed                        | [reply 4281509261](https://github.com/dinhphuquy2k1/nexora/pull/16#discussion_r4281509261), points to fixed setup.md:44 in pushed `7e3d87a`; thread PRRT_kwDOVCLk786ss15H resolved after actual doc correction                                                                                | 2026-10-15 | PASS   |

Runtime/browser, persistence and dev subsequently passed on the same review head in attempt 2; historical implementation CI is not used in their place. Decision index `docs/decisions/README.md` also reflects implemented provider-login removal.

| Claim                                 | Evidence                                                                                                                                                                                                                                                                                    | Date       | Result |
| :------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| First fresh review CI runtime attempt | CI 38715955191 attempt 1: quality/integration/migrations and proxy/auth runtime passed; Chromium did not create DevToolsActivePort within the existing launch wait, failing BROWSER_LAUNCH before form checks. Failed job rerun on the identical head; no assertion was skipped or weakened | 2026-10-15 | FAIL   |

### Review completion — I1 / M1 / M2 / m1

| Claim                                       | Evidence                                                                                                                                                                                                                                                                                                                           | Date       | Result |
| :------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Complete fresh review CI                    | [38715955191 attempt 2](https://github.com/dinhphuquy2k1/nexora/actions/runs/38715955191/attempts/2), full success at `7e3d87aefb7d7c7de4ceeaa89d29e7fcd4018b55`; no source change between failed browser-launch attempt and successful retry                                                                                      | 2026-10-15 | PASS   |
| I1 genuine staged migration/session cutover | Same fresh CI: pre-PR2 provider identity/session -> original PR2 reproduces acceptance -> approved sixth migration revokes credentialless OPERATOR sessions; ADMIN/configured sessions, users/credentials/files preserved; password setup cannot resurrect the old token, fresh local login succeeds, repeated deploy preserves it | 2026-10-15 | PASS   |
| M2 full HTTP matrix and retained races      | pnpm test:integration, 13/13 including seven HTTP subtests, real Nest and isolated PostgreSQL; statuses/codes/envelopes/seven-field summaries, auth/Origin/validation/not-found, revocation/reactivation, self/other ADMIN and concurrent 200/409; existing transaction races unchanged                                            | 2026-10-15 | PASS   |
| Migration constraints/preservation/drift    | pnpm --filter @nexora/database test:migrations: authentic Prisma history, selective cutover, old schema rollback/recovery, repeat and drift; no historical SQL changes                                                                                                                                                             | 2026-10-15 | PASS   |
| M1 and m1 canonical synchronization         | setup.md:44 always-404/local credentials/independent future Carrier; testing.md actual suites; API contract implemented/deferred separation; ADR/authentication/backend/database/setup/deployment and decision index synchronized; final Unified Identity historical phase table clarified                                         | 2026-10-15 | PASS   |
| Required fresh canonical commands           | quality-docker.sh executes frozen build context, format/boundaries/lint/docs/typecheck/test/test:docs/test:operations/contracts:check/build, test:integration and test:migrations; runtime-smoke.sh, data-smoke.sh and dev-smoke.sh all pass on review implementation head                                                         | 2026-10-15 | PASS   |

All four review findings are resolved. `LEGACY_PROVIDER_SESSION_CUTOVER` and `USER_STATUS_ADMIN_CONTRACT` are owner-approved; no PLAN ISSUE remains open. Generic SessionGuard and HTTP/SDK contracts are unchanged. Minimum-policy limitation is explicit: old schema cannot distinguish provider-origin sessions of configured OPERATORs, whose sessions are retained by the approved decision.

NEXORA-016 returns to COMPLETED / VERIFIED. Final documentation-record CI is tracked on PR #16 and must be reported against its exact final HEAD. Native engine-download failure and first-attempt Chromium startup failure remain visible above; neither is represented as a test PASS. No live Uniship, volume reset, historical migration rewrite, force-push, rebase or merge occurred. Documentation Impact: REQUIRED remains satisfied by the updated canonical owners and validation.
