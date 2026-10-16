# NEXORA-023 — PR19 pending MFA cancellation and canonical contract

- **Task ID**: `NEXORA-023`
- **Status**: `COMPLETED`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`
- **Classification**: BOUNDED
- **Branch**: `feat/admin-totp-mfa`
- **Baseline**: `753a242b350a4c23e1cff2c2907ea2ca42475311`

## Preflight and decision

Clean worktree and fetched existing PR19 head match reviewed baseline. Completed NEXORA-022 is historical evidence and remains unchanged; active NEXORA-015 owns the architecture roadmap, not this follow-up verification. Task023 is unused.

M1 does not demonstrate an existing-contract violation: pending cancellation and session logout have distinct accepted contracts. Unified termination would be new hardening. Preserve scoped cookie and separate operations (Option A); existing pending UI invokes cancel and AccountMenu invokes session logout. No new UI orchestration or stronger unified guarantee is necessary for this scope. Cookie Path=/api/auth/mfa excludes /api/auth/logout. No owner approval is needed for unchanged contracts. Option B would add an MFA-scoped endpoint seeing both cookies and could make both revocations transactional, but would require API/client review. Option C would broaden cookie exposure and require owner-approved ADR amendment. Two separate requests are not atomic; session logout cannot promise pending revocation. A surviving pending challenge still requires a valid second factor and expires after five minutes.

Inspection: cancellation hashes only the cookie token, looks up its owner, locks that user before targeted deletion, awaits commit before cookie clearing; verify uses the same user lock. UI awaits cancel and keeps error/retry state. No source behavior change currently justified.

## Plan and interfaces

1. Add genuine PostgreSQL cancellation/retention/idempotence/failure tests; deterministic user-lock barriers demonstrate both verify/cancel serial orders without sleeps or fake adapters. Preserve up-to-five pending policy and other users' challenges; prove proof state unaffected by cancellation.
2. Real Nest HTTP: cancellation commit before cookie clearing, safe500 rollback/retry, Origin, old-token401, session logout/replay for both roles.
3. Chromium: native cookie Path selection, actual logout request excludes pending cookie, cancel includes it; network and actual DB cancellation failures keep MFA UI and permit retry. Existing ADMIN/OPERATOR workspace logout remains.
4. Reconcile API contract implemented/deferred inventory and exact verify request examples; document separate termination, multi-tab shared cookie and retention semantics. No production/DTO/schema/migration/ADR changes anticipated; behavioral defect would require test-first reclassification.
5. Targeted checks then full canonical hosted CI (host genuine Prisma unavailable); push existing branch without force/merge. Record actual evidence and wait final exact HEAD.

## Acceptance criteria

Cancelled challenge cannot issue session; recovery/TOTP state unchanged; DB failure no cookie clear/no navigation; serial race outcomes valid; unrelated challenges preserved; native browser scoped transport proven; session logout both roles remains; canonical docs accurate; complete final HEAD CI passes.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Correct stale PR6 deferred inventory/examples and clarify existing distinct pending/session termination and regression coverage.

### Canonical owners

- docs/architecture/api-contract.md
- docs/operations/testing.md

### Documentation verification

pnpm docs:check; pnpm test:docs; pnpm format:check; full canonical CI.

## Evidence

| Claim    | Evidence                                                                           | Date       | Result |
| :------- | :--------------------------------------------------------------------------------- | :--------- | :----- |
| Baseline | git fetch origin feat/admin-totp-mfa; clean worktree; HEAD matches reviewed753a242 | 2026-10-16 | PASS   |

## Local verification and scope

No production behavior or DTO/schema changed, so behavioral RED/implementation/GREEN is inapplicable; added regressions exercise existing security contracts. Syntax checks PASS for both test harnesses; pinned pnpm10.34.6 frozen install PASS;10 existing emitted-JS MFA units PASS (not genuine build/DB evidence);50 lint-rule tests PASS;6 docs and3 operations tests PASS; docs validator PASS. Initial lint caught test-only selector escapes/unused binding, corrected before push. Full genuine PostgreSQL/Chromium/canonical CI is still required. No claim of host Prisma/build completion; prior genuine engine403 limitation is not bypassed.

## Verified source result — 2026-10-16

Full canonical [Foundation run38923645691](https://github.com/dinhphuquy2k1/nexora/actions/runs/38923645691), attempt1, job117049569372, sourcebc48167e4d10682c5d09648e350686ab137e7aea, SUCCESS. No behavior defect was reproduced; preserve approved separate termination. This follow-up adds regression evidence and documentation corrections only. No production source/DTO/generated contract/schema/migration/ADR/Carrier/key custody changes. Historical NEXORA-022 remains byte-for-byte unchanged.

| Claim                   | Evidence                                                                                                                                                                                                                                                                                                                     | Date       | Result |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Targeted PostgreSQL     | Same run pnpm test:integration:62 PASS (four new cancellation regressions); native restricted runtime-role adapters, targeted/idempotent cancellation, six-to-five retention, unrelated same/cross-user challenges preserved; cancelled token rejects both valid recovery and TOTP; no session/proof consumption             | 2026-10-16 | PASS   |
| Deterministic races     | Observed actual pg_stat_activity user-row lock waiters: verify queued first commits one session/one recovery consumption; cancel queued first prevents verification/session/proof consumption; challenge removed and TOTP unchanged in both cases                                                                            | 2026-10-16 | PASS   |
| Real HTTP failures      | PostgreSQL BEFORE DELETE trigger: cancellation500 INTERNAL_ERROR, no Set-Cookie, challenge retained, safe envelope and successful retry; Origin403, cancellation200 scoped clearing, old token401. ADMIN and OPERATOR logout trigger500 retains valid session/no cookie clear, retry200 revokes session and old cookie401    | 2026-10-16 | PASS   |
| Real Chromium           | runtime-smoke: actual cancel request network failure and PostgreSQL trigger500 retain MFA form/error/retry/cookie; successful retry returns password form/clears cookie; invalid/expired proof stays unauthenticated. Actual AccountMenu ADMIN and OPERATOR logout; no authenticated UI before MFA                           | 2026-10-16 | PASS   |
| Native cookie transport | Chromium same-origin ADMIN password then OPERATOR password creates both cookies; real Network.requestWillBeSentExtraInfo confirms logout sends session but no pending, cancel sends pending after logout with no session. Pending remains after session logout and is cleared by cancel; no fabricated browser Cookie header | 2026-10-16 | PASS   |
| Canonical quality       | Same run pnpm install --frozen-lockfile, format:check, lint/boundaries, test:lint50, docs:check, typecheck, test (128 API/42 Web/2 DB/1 UI), test:docs6, test:operations3, contracts:check and build PASS; genuine Prisma generation, staged/repeat/drift migrations PASS                                                    | 2026-10-16 | PASS   |
| Canonical Docker        | quality-docker.sh, runtime-smoke.sh, data-smoke.sh, dev-smoke.sh all PASS; CLI TTY, runtime privilege isolation, restart/down-up database/files/credential custody, HMR/frozen-drift and unenrolled ADMIN denial retained                                                                                                    | 2026-10-16 | PASS   |
| Local checks            | Pinned frozen install,10 emitted-JS MFA units,50 lint-rule tests,9 docs/operations tests, lint/boundaries, docs:check, contracts:check, format:check, JS syntax and git diff --check PASS after correcting test-only lint findings; emitted-JS tests are not full build evidence                                             | 2026-10-16 | PASS   |

## Final review and limitations

M1 is a request to clarify/test existing semantics, not a demonstrated existing-contract violation. Stronger unified logout is new hardening outside this task; no approval was required because the owner-approved cookie scope and endpoint contracts are unchanged. Source behavior before/after is identical. Cancellation targets only the presented challenge and does not revoke an already-issued session; logout cannot identify the browser's pending cookie. Both cookies may coexist across overlapping flows; tabs share cookies, and older challenges retain the existing five-row/expiry policy. Browser coverage reproduces the shared-cookie overlap using actual same-origin logins; it does not claim two separately controlled tabs.

m1 fixed in canonical API contract: implemented PR4 mock-only backend and PR6 MFA/session assurance separated from deferred public HTTPS/UI/admin Carrier/live/sync/reset/key retirement; password-only PR2 explicitly historical; login response table and exact type+code examples current; public deployment gates no longer describe mandatory MFA itself as unimplemented. Testing owner records added coverage. No changes to backend/frontend runtime facts, so their owners and accepted ADRs remain unchanged.

No fake Prisma/client/history, skipped security assertions, secret logging, user-volume reset, force-push, new PR or automatic merge. Source full hosted evidence supplies genuine build/migration/runtime coverage; host engine limitation is not bypassed. Final documentation-only commit must receive the same complete canonical workflow; exact final SHA and run are recorded on PR19 to avoid a self-referential commit hash in this file.
