# NEXORA-023 — PR19 pending MFA cancellation and canonical contract

- **Task ID**: `NEXORA-023`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `NOT VERIFIED`
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
