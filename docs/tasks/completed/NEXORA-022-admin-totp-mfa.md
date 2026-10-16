# NEXORA-022 — Mandatory ADMIN TOTP MFA

- **Task ID**: `NEXORA-022`
- **Status**: `COMPLETED`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`
- **Classification**: SIGNIFICANT
- **Branch**: `feat/admin-totp-mfa`
- **Baseline**: `42c862e6b486aa0718984f76d521e03e8d00cb67`

## Preflight

Fetched main at the exact requested merged baseline; PR18 is closed/merged. Clean initial worktree. Task022 unused. Only open PR14 concerns parcel UI; no MFA overlap. Active Task015 is the accepted architecture roadmap; this task implements its PR6 milestone without closing unrelated milestones. Preserve historical task evidence and all eight migrations. No public hosting, Carrier admin endpoints or live provider changes.

## Plan and interfaces

1. Test-first RFC6238 vectors, ±1 window, leading zeros, replay/session policy, challenge/recovery validation. Extend real PG/Nest/runtime role and CLI/browser harnesses with deterministic races. Run baseline RED before implementation.
2. Identity owns user_mfa (one row per user, encrypted secret, versioned metadata, last_used_step), mfa_challenges (unique SHA256,5min, consumed_at), recovery codes (10 independent >=80bit secrets, hashes only, used_at) and sessions.auth_level. New forward migration preserves all baseline rows; existing sessions default PASSWORD and admin capability is denied. Explicit least privilege grants, no historical edits/default grants/audit changes.
3. Login result discriminates OPERATOR session from ADMIN pending challenge. POST /auth/login returns either {user} or {mfaRequired:true}; raw challenge cookie only. Correct-password unenrolled ADMIN gets403 MFA_ENROLLMENT_REQUIRED with trusted CLI guidance, no session; wrong passwords retain generic401. Strict MFA verify body is exactly {type:'totp'|'recovery',code:string}, no unknown fields; six ASCII digits or normalized recovery code. Success {user}, failure generic401 MFA_VERIFICATION_FAILED; expired/consumed indistinguishable. Origin mandatory, no-store. Add POST /auth/mfa/cancel with same Origin/cookie path to revoke and clear pending challenge safely; no enrollment/reset HTTP API.
4. Lock user before MFA/challenge/code children. Challenge creation rechecks exact password hash and expected role under user lock. MFA verify looks up owner then user-locks, rechecks ACTIVE ADMIN, validity and exact encrypted enrollment evidence, atomically consumes challenge and monotonic step or owned recovery code then inserts MFA session; rollback all on failure. Cryptography outside transaction; expiry and accepted step rechecked with current server time after lock wait. Enrollment password/TOTP outside locks, recheck role/status/hash and absent enrollment under user lock, insert then revoke sessions/challenges; codes print only after commit.
5. AuthService retains Scrypt/admission; MFA adds bounded account-key admission independent from password success so new challenges cannot reset MFA failure budgets. Session identity keeps assurance internal; public DTOs select id/username only. Global SessionGuard enforces admin route metadata policy before Public bypass; AdminGuard reads current role plus DB-backed assurance. Cover future admin controllers via controller metadata rather than URL substring alone. Disable adds challenge deletion to existing atomic Carrier/user revocation; advisory-before-sorted-users unchanged.
6. CLI mfa-enroll interactive trusted TTY only; no secret/code argv or piped production secrets, cancellation and cleanup use existing terminal reader. Setup key displayed only trusted terminal;10 recovery codes only after commit. No overwrite/reset path.
7. Login UI two-step, sanitized return, TOTP/recovery mode, focus/labels/loading, generic invalid/expiry guidance, rate feedback, cancel revocation. Generate OpenAPI/SDK; existing proxy/CSS tokens/shell unchanged.
8. Canonical docs and explicit stop-writers/migrate/grants/enroll/start rollout. Frozen install and all canonical checks plus all four Docker scripts, authenticated hosted CI on final exact HEAD if genuine host Prisma blocked. Push new branch/create PR against main, no force/merge.

## PLAN ISSUES

IDENTITY_KEY_CUSTODY approved explicitly by owner in chat on2026-10-16: IDENTITY_KEYRING_JSON and IDENTITY_ACTIVE_KEY_VERSION, independent32byte canonical-base64 keys; AES256GCM fresh12byte nonce/tag16; HKDFSHA256 namespace NEXORA_IDENTITY_V1/purpose IDENTITY_TOTP; user/purpose/format-bound AAD; ciphertext/nonce/tag/keyVersion storage. No default/generated/fallback key; API/CLI only. Missing config fails enrollment/TOTP closed, OPERATOR unaffected. Restart loads activation; old versions retained, no automatic re-encryption/retirement. Approval authorizes the described independent Identity secret implementation. No further custody decision pending.

## Acceptance criteria

ADMIN password alone never issues an ADMIN session; all admin routes require database MFA assurance. OPERATOR unchanged. CLI confirmation step non-replayable;10 recovery codes hash-only and print-after-commit. Challenges hashed5min/single-use, cookie-only; atomic single session/recovery/step consumption. Disable/re-enable, role/hash races, rollback and restarts fail closed. Migration fresh/eight-stage/repeat/drift and Carrier/file/audit preservation verified; runtime grants remain restricted. Real HTTP/browser/CLI and complete canonical final-head CI PASS; contracts/docs synchronized; no live/public scope.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Mandatory ADMIN MFA, encrypted independent Identity custody, schema/session assurance, CLI enrollment, two-step cookie API/UI, atomic revocation and rollout.

### Canonical owners

- docs/decisions/multi-carrier-architecture.md
- docs/decisions/authentication.md
- docs/architecture/backend.md
- docs/architecture/database.md
- docs/architecture/api-contract.md
- docs/architecture/frontend.md
- docs/architecture/runtime.md
- docs/operations/configuration.md
- docs/operations/setup.md
- docs/operations/deployment.md
- docs/operations/testing.md

### Documentation verification

pnpm docs:check, format:check, contracts:check and executed CLI/HTTP/browser/migration/CI evidence.

## Evidence

| Claim               | Evidence                                                                                                                                          | Date       | Result |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| TOTP test-first RED | node --test apps/api/test/mfa-totp.test.cjs against baseline fails missing implementation                                                         | 2026-10-16 | FAIL   |
| Pure TOTP GREEN     | Same command after emitted-JS compile:3 PASS (six RFC vectors,window/leading zeros,input types,CSPRNG/code hashes); not full build or DB evidence | 2026-10-16 | PASS   |
| Host API build      | pnpm --filter @nexora/api build fails absent genuine generated Prisma types; emitted JS targeted tests only                                       | 2026-10-16 | FAIL   |
| Preflight           | git fetch origin main =>42c862e; clean worktree, PR18 merged, no active022/MFA PR overlap                                                         | 2026-10-16 | PASS   |

## Implementation progress and verification gates

Owner approved custody in chat; shared crypto now supports explicit Identity namespace/purpose without changing Carrier ciphertext protocol. Ninth migration/column-scoped MFA grants, CLI-only enrollment, atomic challenge/proof/session adapter, global admin assurance, frontend and generated contracts implemented. RFC/crypto/auth/Web test-first baseline failures reproduced before corresponding edits. Local pure/API tests are emitted-JS evidence only; full genuine build remains blocked by absent generated Prisma types pending engine availability. Full PG/HTTP/CLI/browser/migration/Docker verification remains required before completion. No public/live/reset change.

## Local verification snapshot

2026-10-16: pinned pnpm10.34.6 frozen installation PASS;127 API units PASS (including9 new MFA tests);42 Web tests PASS;Web typecheck PASS;50 guard tests PASS;6 docs tests and3 operations tests PASS;lint/boundaries/docs/format PASS; contracts generation reproducible, but contracts:check refuses uncommitted generated artifacts until commit. Genuine prisma generate FAIL HTTP403 fetching schema-engine checksum from binaries.prisma.sh; no override/fake engine used. API full build/typecheck and PostgreSQL/migration/Docker results remain pending authentic hosted CI. CLI/browser harness presence is not runtime PASS.

## First hosted verification and correction

[Run38896546354](https://github.com/dinhphuquy2k1/nexora/actions/runs/38896546354), source086d2d17133a27bd191e4fbf21ab9ede3eee3804, FAIL: full genuine quality/build/typecheck/contracts and127 API/42 Web/50 guard tests passed; all17 new MFA PostgreSQL/Nest tests passed, but three prior integration suites failed owned-database cleanup with55006 (open connections). Root cause was test helper returning its verify Promise before finally disconnected the adapter, allowing later async queries to reopen the pool. Await verification completion before disconnect; do not force-drop databases or weaken assertions. Migration/runtime/browser/data/dev steps beyond that failure were NOT RUN. Follow-up strengthens actual PostgreSQL lock-wait observation, avoids enrollment-step fixture boundary drift, and adds real API restart plus network-paused loading assertions to browser MFA. Updated full CI remains required.

## Admission namespace review

Additional threat review reproduced a logical-key collision: a legal username mfa:<user UUID> shared an MFA counter, letting successful password login clear failed-proof state. New functional regression RED: sixth bad MFA returned401 instead of429 after intervening password success. Explicit login:/mfa:/setup: namespaces fix the collision without changing thresholds or public APIs. Targeted10 admission/MFA tests GREEN. Full updated-source verification remains pending.

## Dev smoke fixture correction

Runs38897378086(source4ce17db) and38897703414(sourceb2d29e3) passed genuine quality/migrations/integration, compiled CLI TTY/browser/restart and data persistence. Both FAIL at dev-smoke: its old fixture was ADMIN but expected password-only login. Preserve every HMR/frozen-drift/data assertion, first assert unenrolled ADMIN403/no-cookie, then convert only the owned disposable fixture to OPERATOR for one-step HMR. Do not weaken MFA guards or add a test bypass. Updated source also explicitly asserts MFA secret privacy in browser URLs/Referer/SSR/storage/location/server logs. Complete updated-source and final-head CI still pending.

## Verified result — 2026-10-16

Full canonical [run38899221991](https://github.com/dinhphuquy2k1/nexora/actions/runs/38899221991), attempt1 at366eec21ced74b1c6db2bcc6a4a2215fcd75fcde, SUCCESS. All new and prior assertions passed with actual Prisma/PostgreSQL/runtime role and real HTTP/CLI/browser. Earlier failures above remain recorded as executed failures, not relabeled as success. No workflow rerun or weakened guard/assertion was used; corrective commits fixed the actual fixture/namespace issues.

| Claim                      | Evidence                                                                                                                                                                                                                                                                                       | Date       | Result |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Full quality               | Same source/run: pinned frozen install,format/lint/boundaries/test:lint50/typecheck/tests/docs/contracts/build PASS;128 API,42 Web,2 DB,1 UI,6 docs and3 operations tests PASS                                                                                                                 | 2026-10-16 | PASS   |
| Genuine PostgreSQL         | pnpm test:integration:58 PASS, including17 new MFA/Nest/runtime-role tests; one winner under20 requests, TOTP/recovery/challenge replay, rollback, status/role/hash races, actual observed lock wait, duplicate enrollment, future Public admin policy, cookie/Origin and legacy assurances    | 2026-10-16 | PASS   |
| Migration/custody          | Genuine fresh/staged eight-to-nine Prisma deploy, baseline snapshot preservation, CHECK,repeat/drift PASS; actual restricted runtime credentials, column-scoped MFA grants and negative secret/audit/DDL/SET ROLE probes PASS                                                                  | 2026-10-16 | PASS   |
| Compiled enrollment        | runtime-smoke real non-root MFA CLI pseudo-TTY: hidden password,backspace,Enter,Ctrl+C/Ctrl+D,cleanup,trigger rollback,no codes on failure,10 codes only after commit,duplicate refusal PASS                                                                                                   | 2026-10-16 | PASS   |
| Browser/HTTP               | Real generated-SDK ADMIN two-step,no session/navigation before MFA,wrong/expired proof,cancel/retry,network-paused loading,recovery input,TOTP success,pending and issued-session API restarts; no secret in URL/Referer/SSR/storage/location/server logs; original setup/OPERATOR/logout PASS | 2026-10-16 | PASS   |
| Persistence                | data-smoke user_mfa/challenges/recovery-code and all earlier Identity/Carrier/audit/file rows plus both credential hashes preserved across restart/down-up PASS                                                                                                                                | 2026-10-16 | PASS   |
| Development                | Dev unenrolled ADMIN403/no cookie,OPERATOR HMR/shared propagation,real frozen-lock drift blocking and data preservation PASS                                                                                                                                                                   | 2026-10-16 | PASS   |
| Complete canonical scripts | quality-docker.sh,runtime-smoke.sh,data-smoke.sh,dev-smoke.sh all SUCCESS in source run38899221991                                                                                                                                                                                             | 2026-10-16 | PASS   |

Identity key custody is the explicitly owner-approved independent environment contract, not a default/key-service addition. All8 historical migrations and completed task evidence, Carrier production code/protocol/live gate, DB admin secret isolation and audit append-only contract remain intact. No plaintext secret persists in database/API/SDK/logs or global caches. ADMIN password never issues a new session; old PASSWORD ADMIN rows are preserved by migration but globally denied administrative capability. OPERATOR behavior remains. CLI enrollment/disablement revoke sessions/challenges atomically; no reset/reenrollment overwrite or public ingress is implemented.

No unresolved implementation PLAN ISSUE. Host genuine Prisma checksum download remains HTTP403-blocked; hosted evidence supplies actual generation/build/migrations and cannot be replaced by local emitted JS. Live Uniship authorization, PR7/public HTTPS, MFA reset/key retirement and Carrier admin APIs remain separate reviewed scope. No user-volume reset,fake engine/client/history,checksum bypass,force-push or automatic merge. The final documentation-only commit receives the full canonical workflow again; PR19 records its exact SHA/conclusion/link and remains draft until it passes.
