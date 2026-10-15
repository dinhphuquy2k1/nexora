# NEXORA-016 — Unified Local Identity, RBAC & Legacy Provider Removal

- **Task ID**: `NEXORA-016`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`
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

| Claim                                            | Evidence                                                                                                                   | Date       | Result |
| :----------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Main baseline and PR #15 merged status inspected | `git log`; GitHub PR #15 merged at `cc43981b697673d6d1a488f76d9ef545b094b533`; clean checkout; unrelated PR #14 identified | 2026-10-15 | PASS   |

| API isolated unit suite | pinned pnpm API test, 59/59 using emitted JS; full build is not established by this result | 2026-10-15 | PASS |
| Web helper and launcher suite | pinned pnpm Web test, 41/41 | 2026-10-15 | PASS |
| OpenAPI/SDK generation | pinned pnpm contracts:generate; provider login absent and management routes generated | 2026-10-15 | PASS |
| Native Prisma build | engine download blocked by environment network policy (HTTP 403); no fabricated client/history or network bypass | 2026-10-15 | FAIL |

## Verification pending

Real Prisma migration, PostgreSQL concurrency and canonical Docker quality/runtime/persistence/dev execution await hosted CI. Native full typecheck/build and integration are not established while genuine client generation is blocked. Uniship live integration is NOT RUN and outside this task. No user volumes were reset.
