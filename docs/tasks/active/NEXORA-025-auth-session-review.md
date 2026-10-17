# NEXORA-025 — Authentication and session review remediation

- **Task ID**: `NEXORA-025`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`
- **Classification**: SIGNIFICANT
- **Branch**: `fix/auth-session-review`
- **Baseline**: `ea0fce64f0de5201301d05cfe35fde9f4265e80d`

## Plan and interface preflight

Fetched main and confirmed clean worktree; Task025 is unused. New branch from current main. No production activation, schema/grant change, live Carrier call, key/MFA mutation or user volume deletion.

1. Reproduce malformed stored Scrypt hash acceptance, control-character return URL escape, stalled SSR session verification and delayed account-menu interaction before repairs.
2. Accept only evidenced Scrypt serialization: fixed N16384/r8/p1, 16-byte hex salt and 64-byte hex derived key. Invalid serialization returns false before crypto; no cost/migration change. Inspect historical formats before restricting.
3. Sanitize server and password/MFA redirects with trusted fixed URL origin, reject controls/backslashes/authority, return normalized internal path/query/fragment or `/`. Browser percent-encoded regression must never visit an external site.
4. Bound SSR session fetch including body to five seconds; timeout is unavailable, never unauthenticated. Real stalled-header/body HTTP regressions prove abort and cleanup.
5. Reproduce LOCAL harness race using a committed delayed-handler fixture. Wait for observable menu expansion/logout readiness before one logout; retain HTTP, cookie, revoked-session, Origin and failure assertions without auth retries/deadline inflation.
6. Add explicit restricted-credential maintenance CLI, bounded session-only batches using DB time; no scheduler/service/grant change. Genuine PostgreSQL boundary/idempotence/preservation tests.
7. Inspect six API adapter clients/pools. Share a lazy runtime-owned client through infrastructure DI if redundant; sole shutdown owner, separate CLI/admin clients. Preserve transaction/Carrier/MFA/readiness invariants.
8. Pass only minimal presentation strings from server for actual LOCAL/PUBLIC_HTTPS labels; no environment/secret serialization. Synchronize changed canonical facts and retain ADR/evidence history.
9. Targeted RED/GREEN then genuine full Foundation on final PR head; purposeful commits, new Draft PR until required checks pass. No approval/merge.

## Acceptance criteria

All seven finding groups have reproducible regression evidence and reviewed fixes or explicit justified deferral. Correct/wrong/random-salt password behavior, malformed format matrix, internal URL query/fragment normalization, real browser redirect/logout and stalled HTTP aborts covered. Restricted PostgreSQL cleanup preserves active sessions and related rows, repeats safely, uses bounded transactions. Shared client closes once and remains lazy. Full quality, real integration/migrations, LOCAL/public HTTPS/persistence/dev smoke execute successfully on final head before Ready. Public production gates from NEXORA-024 remain NOT VERIFIED.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Strict stored hash parser, internal redirect policy, finite SSR deadline, bounded session maintenance, runtime pool lifecycle, profile-aware UI and repeatable browser harness regression.

### Canonical owners

- docs/decisions/authentication.md
- docs/architecture/backend.md
- docs/architecture/frontend.md
- docs/architecture/database.md
- docs/operations/configuration.md
- docs/operations/testing.md
- docs/operations/setup.md

### Documentation verification

pnpm docs:check; pnpm test:docs; pnpm format:check; final diff review.

## Evidence

| Claim                      | Evidence                                                                                                                                                                  | Date       | Result |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| Baseline failure confirmed | GitHub run39033874709/job117399679421 actually checks out main ea0fce6; quality PASS, LOCAL FAIL at OPERATOR_ACCOUNT_MENU_LOGOUT ASSERTION_FAILED; HTTPS/data/dev skipped | 2026-10-17 | FAIL   |

## Executed test-first findings and implementation

| Claim                            | Evidence                                                                                                                                                                                                                      | Date       | Result |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Malformed hash RED               | New password regression before parser change returns true for arbitrary wrong password against empty decoded key; Node24 actual source                                                                                        | 2026-10-17 | FAIL   |
| Return URL RED                   | New control-character regression before sanitizer change returns slash-tab-slash attacker path instead of fallback                                                                                                            | 2026-10-17 | FAIL   |
| Header/body deadline RED         | Real HTTP listeners accept requests but withhold headers or body completion; original helper exceeds6s and fails unavailable assertion, sockets closed by fixture                                                             | 2026-10-17 | FAIL   |
| Password GREEN                   | node --test packages/database/test/password.test.mjs:3 PASS including malformed matrix, correct/wrong password and random salts                                                                                               | 2026-10-17 | PASS   |
| Web GREEN                        | pnpm --filter @nexora/web test:48 PASS including actual stalled-header/body abort and URL/presentation; Web typecheck PASS                                                                                                    | 2026-10-17 | PASS   |
| Browser race reproduction/GREEN  | node scripts/browser-account-ready.test.mjs: actual Chromium against committed delayed-handler/menu fixture proves old DOM-only click lacks logout, then shared helper observes expansion and ready control before one logout | 2026-10-17 | PASS   |
| Local genuine Prisma unavailable | pnpm --filter @nexora/database generate fails checksum HTTP403; API build and runtime-pool unit loading cannot complete without generated client. No fake Prisma, bypass or historical CI substitution                        | 2026-10-17 | FAIL   |

The browser finding is a harness synchronization defect reproduced independently; existing product logout handlers are unchanged. Actual application HTTP/logout/replay, PostgreSQL cleanup/client lifecycle/concurrency and all five canonical scripts still require new-head Foundation evidence. Six independently constructed Prisma/pg pools were confirmed in AppModule; a shared lazy infrastructure provider replaces them, with standalone construction retained for CLI/testing and no admin credential sharing. Historical password implementation (9700749) and migration fixtures evidence only the original generated serialization; no other legacy format is claimed supported.

Production domain/DNS, trusted certificate issuance/renewal/timer/safe reload, firewall/NAT/IPv6, actual host NTP, real ACTIVE ADMIN enrollment/all key-version custody, encrypted off-host backup/isolated restore/rollback rehearsal remain NOT VERIFIED under NEXORA-024. This task does not activate production or change that ledger's lifecycle.
