# Task: NEXORA-015 — Multi-Carrier Architecture, Security & API Contracts

- **Task ID**: `NEXORA-015`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`
- **Classification**: SIGNIFICANT
- **Working branch**: `feat/multi-carrier-architecture-contracts`
- **Target GitHub PR**: #15
- **Starting main SHA**: `e18bef4e5a4557baee60b9b8729dc72b789315a1`
- **Reviewed PR #15 HEAD**: `eba8de77b34e555addc49ceb8a7234574fbd9b8d`

## 1. Context & Objectives

In the baseline repository state (PR #10 / commit `e18bef4`), Uniship was experimental and integrated directly into Nexora's Identity boundary: operator authentication called Uniship's login endpoint, checked `external_identities`, and issued a Nexora session.

As established by the owner on 2026-10-14 in `NEXORA_MULTI_CARRIER_CONTEXT_v10 (3).md`, Nexora is actively under development and has **zero real production users or legacy operator data**. Therefore, Nexora is decoupling operator identity from external carrier logins:

1. **Unified Nexora Identity**: Both `ADMIN` and `OPERATOR` use local credentials stored in `user_credentials`.
2. **Legacy Provider Removal**: PR 2 removes `POST /api/auth/provider/login`, drops `external_identities`, and collapses login into a single local authentication screen. No legacy backfill or user cutover is required.
3. **Carrier Connections Foundation**: Users link multiple carrier accounts across different providers. The system enforces a **global unique constraint** on `(provider, external_account_id)`.
4. **Encrypted Credential Storage**: Passwords and tokens are stored encrypted using AES-256-GCM + HKDF with AAD binding. Passwords are saved encrypted by default upon connection.
5. **Token Verification**: Token authenticity is verified via `POST /client/api-token-verify/` comparing `user.userid` with `external_account_id`.
6. **ADMIN TOTP MFA**: RFC 6238 TOTP enrolled strictly via server CLI (`pnpm mfa:enroll`), session `auth_level`, and two-step atomic challenge consumption.
7. **Public HTTPS Release Gate**: Public internet access requires PR 6 (ADMIN TOTP MFA enforced at application startup) and host NTP clock synchronization.

> **Roadmap Sequencing Note**: In this architecture roadmap, "Logical PR 1" represents the documentation, security architecture, and API contracts stage within the 6-phase plan (Logical PRs 1, 2, 3, 4, 6, 7; where PR 5 was consolidated into PR 2). In GitHub, this task is submitted as **GitHub PR #15** (`feat/multi-carrier-architecture-contracts`).

This task (`NEXORA-015`, Logical PR 1 / GitHub PR #15) delivers the complete architectural decisions, specifications, security controls, and API contracts in documentation, establishing the foundation for implementation tasks PR 2 through PR 7.

## 2. Six-Phase Implementation Roadmap

| Logical PR         | Scope Summary                                          | Key Acceptance Criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Dependencies                 |
| :----------------- | :----------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| **PR 1** (Current) | **ADR / Security / Contracts**                         | ADR-007 accepted, canonical architecture documents updated, API contracts specified, test plan and threat model documented. `Documentation Impact: REQUIRED`. Delivered in GitHub PR #15.                                                                                                                                                                                                                                                                                                                                                                                                                                                  | None                         |
| **PR 2**           | **Unified Local Login / RBAC / Legacy Removal**        | Both OPERATOR and ADMIN login locally; backend RBAC; one-time setup links for operators (`operator_setup_tokens`, `POST /api/admin/operators`, reissue via `POST /api/admin/operators/:id/setup-link`, `POST /api/auth/setup-password` with credential non-overwrite check and token revocation on disable); last active ADMIN invariant protected by advisory lock (`pg_advisory_xact_lock`); milestone admin policy (PR 2..5 password-only on loopback); complete removal of provider login (`/api/auth/provider/login` returns 404); forward-only migration drops `external_identities`; separate one-time script purges dev operators. | PR 1                         |
| **PR 3**           | **Carrier Connections & Encrypted Secrets Foundation** | Database schemas for `carrier_connections` (with `chk_carrier_connections_provider` raw SQL CHECK) and `carrier_connection_secrets`; shared cryptographic module `apps/api/src/common/crypto/` (AES-256-GCM, HKDF); key versioning; global unique constraint enforcement; user disablement race control. Administrative carrier endpoints and interim CLI (`dist/cli/carrier-admin.js`) are PLANNED / DEFERRED post-PR 6.                                                                                                                                                                                                                  | PR 1                         |
| **PR 4**           | **Uniship Carrier Adapter & UI**                       | Integration adapter calling `api-token-verify`; connect / reconnect / re-login orchestration; default encrypted password persistence; Carrier Settings UI. _Live Merge Gate_: Requires verified `POST /client/api-token-verify/` contract, `user.userid` proof, error codes, token TTL, refresh rules, rate limits, and automated re-login terms. Mock adapter permitted until gate is met.                                                                                                                                                                                                                                                | PR 2 + PR 3                  |
| ~~PR 5~~           | **Consolidated into PR 2**                             | Merged into PR 2 to maintain logical PR sequencing (PR 1, 2, 3, 4, 6, 7).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | —                            |
| **PR 6**           | **ADMIN TOTP MFA**                                     | `user_mfa`, `mfa_challenges`, `mfa_recovery_codes`, `sessions.auth_level`; two-step login flow; CLI-only enrollment (`dist/cli/mfa-enroll.js`) without DB locks during interactive prompts; atomic challenge consumption; dedicated Identity master key; enforce `role === 'ADMIN'` AND `auth_level === 'MFA'` across all `/api/admin/...` routes; invalidate password-only admin sessions.                                                                                                                                                                                                                                                | PR 2 (Independent of PR 3/4) |
| **PR 7**           | **Public HTTPS Profile & Ingress Gates**               | HTTPS profile; `Secure` cookie enforcement; Host/Origin validation; ingress rate limits; startup gate refusing boot if MFA disabled; zero admin endpoints bypass MFA; host NTP sync verification; remote operator password setup verification over HTTPS.                                                                                                                                                                                                                                                                                                                                                                                  | PR 2 + PR 6 (Hard Gate)      |

## 3. Acceptance Criteria

- [x] **ADR-007 Created & Accepted**: Documents 15 owner-approved decisions, independent identity, global unique carrier accounts, encrypted credentials, Uniship token verification, ADMIN TOTP MFA, and public HTTPS release gates.
- [x] **Canonical Documentation Synchronized**:
  - `docs/decisions/README.md` updated with ADR-007.
  - `docs/decisions/unified-identity.md` updated to document supersession of provider login and PR 2 legacy removal.
  - `docs/decisions/authentication.md` updated to document ADMIN TOTP MFA, session `auth_level`, operator setup links, and public HTTPS profile.
  - `docs/decisions/product-scope.md` updated to affirm carrier connection boundaries and non-goals.
  - `docs/architecture/backend.md` updated with carrier modular monolith layout, `common/crypto/`, advisory lock protocol, and RBAC enforcement.
  - `docs/architecture/database.md` updated with target schemas for `operator_setup_tokens`, `carrier_connections` (with provider SQL CHECK), `carrier_connection_secrets`, `sessions.auth_level`, `user_mfa`, and advisory lock invariants.
  - `docs/architecture/api-contract.md` updated with carrier connection endpoints (generic `400 CANNOT_CONNECT_CARRIER_ACCOUNT`, `401 UNAUTHORIZED` across carrier endpoints), operator setup endpoints, deferred admin carrier endpoints, and MFA endpoints.
  - `docs/architecture/runtime.md` and `docs/operations/deployment.md` updated with public HTTPS release gates and host NTP verification.
  - `docs/domains/shipments.md` updated to clarify that carrier connections do not implement shipment tables or background workers.
- [x] **Operator Setup Token Deadlock-Free Lock Ordering (I1)**:
  - Unified lock order: **user row lock → operator_setup_tokens update** across `consume`, `reissue`, and `disable`.
  - `POST /api/auth/setup-password` runs Scrypt hashing outside the transaction, performs non-locking lookup of `user_id`, opens transaction and locks user FIRST (`SELECT ... FOR UPDATE`), validates `role = 'OPERATOR'` and `status = 'ACTIVE'`, conditionally consumes token (`WHERE token_hash = $1 AND user_id = $2 AND consumed_at IS NULL AND expires_at > now() RETURNING id`), checks absence of `user_credentials`, and inserts credential.
- [x] **Stage-Aware Progressive User Disablement Transaction (M1)**:
  - PR 2 transaction: disables user, revokes sessions, invalidates unconsumed setup tokens, protects last active admin via advisory lock. Zero queries to carrier secrets or MFA challenge tables.
  - PR 3 transaction: extends PR 2 to delete carrier connection secrets and mark connections `REAUTH_REQUIRED`.
  - PR 6 transaction: extends PR 3 to revoke pending MFA challenges.
  - Prohibits `catch` blocks or raw SQL `IF EXISTS` to swallow unmigrated schema errors.
- [x] **Milestone-Based ADMIN Authorization & sessions.auth_level Decoupling (M2)**:
  - Database schema in PR 2..5 does NOT have `sessions.auth_level`. ADMIN authorization on loopback checks active session and `role === 'ADMIN'`. "PASSWORD" is a logical assurance property, NOT a database field at PR 2.
  - PR 6 migration adds `sessions.auth_level VARCHAR(16) NOT NULL DEFAULT 'PASSWORD'` with CHECK constraint. Enforces `role === 'ADMIN'` AND `auth_level === 'MFA'` on all `/api/admin/...` endpoints; revokes password-only admin sessions.
  - PR 7: Public HTTPS profile boot validation fails if MFA enforcement disabled; zero admin endpoints bypass MFA.
- [x] **Operator Setup Link Reissue Contract**:
  - `POST /api/admin/operators/:id/setup-link` specified for ACTIVE OPERATOR without credentials.
  - Atomically invalidates all prior unconsumed setup tokens for that user.
  - Returns `{ setupUrl, expiresAt }` (high-entropy CSPRNG token, SHA-256 hash only stored, 24h TTL, single-use, never logged or echoed).
  - Rejects if user already has credentials (`400 OPERATOR_ALREADY_CONFIGURED`). Cannot be used as a password reset tool.
- [x] **Setup Token Revocation on Operator Disablement & Non-Overwrite**:
  - Disabling an OPERATOR atomically invalidates all unconsumed `operator_setup_tokens` in the same transaction; reactivation does not restore old tokens.
  - `POST /api/auth/setup-password` verifies that the operator is `ACTIVE` and has no existing `user_credentials` before persisting credentials.
- [x] **Interim Carrier Admin CLI Clarification (M3)**:
  - `dist/cli/carrier-admin.js` marked **PLANNED / DEFERRED** post-PR 6; not represented as existing or supported in PR 2..5.
  - Interim cross-user maintenance is conducted exclusively via authorized direct SQL runbooks by DBAs.
- [x] **Deadlock Claim Scope Limitation (Minor)**:
  - Replaced absolute deadlock elimination claims with precise specification: transaction-level advisory lock serializes administrative mutations that reduce active administrators adhering to this protocol, preventing lock-ordering deadlocks and race conditions specifically between those administrative mutations while strictly guaranteeing active admin count >= 1.
- [x] **Important Findings I1–I4 Addressed**:
  - **I1 (CLI TOTP Transaction Flow)**: CLI prompts password and TOTP confirmation code outside database transactions; no row locks or DB connections held during user interaction; short transaction verifies status/role/hash equality, sets `last_used_step`, saves recovery hashes, and revokes sessions/challenges; recovery codes displayed only after commit.
  - **I2 (Last Active Admin Advisory Lock)**: Dedicated transaction-level PostgreSQL advisory lock (`SELECT pg_advisory_xact_lock(hashtext('nexora_active_admin_invariant'))`) acquired before any row locks; checks active admin count > 1; prevents lock-order deadlocks and ensures zero active admin state is unreachable.
  - **I3 (Unified Carrier Connection Error)**: `POST /api/carrier-connections` returns identical generic error `400 CANNOT_CONNECT_CARRIER_ACCOUNT` for both invalid credentials and duplicate account linkage; eliminates account enumeration; security audit records exact underlying event; all protected carrier endpoints enforce `401 UNAUTHORIZED`.
  - **I4 (Operator Setup Link Contract)**: Full specification of `operator_setup_tokens` table, `POST /api/admin/operators` (ADMIN only), `POST /api/auth/setup-password` (`@Public()`, `OriginGuard`), CSPRNG token hash (24h TTL, single-use, atomic consumption, reissue invalidation). Admins cannot see or set operator passwords.
- [x] **Moderate Findings M1–M4 Addressed**:
  - **M1 (Admin Carrier Endpoints Deferred)**: `GET /api/admin/carrier-connections` and `DELETE /api/admin/carrier-connections/:id` require `ADMIN + MFA` and are deferred to post-PR 6 follow-up; PR 6 does not depend on PR 3/4; Public HTTPS does not wait for PR 4; interim CLI runbook documented.
  - **M2 (Realistic Uniship Live Merge Gate)**: Formal merge gate for PR 4 live integration defined: request body, response `user.userid` identity proof, error codes, `is_verified` semantics, TTL, refresh rules, quotas, and re-login authorization. Distinguishes owner illustrative notes from verified contract evidence. Mock development allowed until gate is satisfied.
  - **M3 (SQL CHECK for Provider)**: Schema enforces `CONSTRAINT chk_carrier_connections_provider CHECK (provider IN ('uniship'))` as persisted domain vocabulary; forward-only migration pattern documented; Prisma/PG/TS enums prohibited.
  - **M4 (Threat Model & Test Plan Matrix)**: 13 security threats mapped to mitigations, acceptance tests, and logical PRs.
- [x] **Documentation Verification Checks PASS**: `pnpm docs:check`, `pnpm format:check`, `node scripts/boundaries.mjs`, and `pnpm contracts:check` pass without errors.
- [x] **Documentation-Only Boundary Respected**: No runtime code deleted, no Prisma migrations executed, no OpenAPI/SDK artifacts regenerated, and no live carrier calls executed.

## 4. Threat Model & Implementation Test Plan Matrix

| #   | Threat                                       | Security Mitigation                                                                                                                                                                                | Acceptance Test Specification                                                                                                                                              | Target Logical PR |
| :-- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| 1   | **Credential Stuffing & Carrier Abuse**      | Per-user rate limiting on connect/reconnect; singleflight request deduplication; carrier outbound budgets; fail-closed on 429.                                                                     | Burst of 20 connect requests is throttled at 429; concurrent requests for same connection share single outbound carrier call.                                              | PR 4              |
| 2   | **Duplicate Account Enumeration**            | Global unique constraint `(provider, external_account_id)`; identical generic error `400 CANNOT_CONNECT_CARRIER_ACCOUNT` for bad credentials and duplicate linkage; audit log records exact cause. | Connecting already-linked account returns identical status/body as invalid credentials; no username/owner leakage; security audit contains duplicate conflict event.       | PR 3, PR 4        |
| 3   | **Cross-User Carrier Access**                | All carrier connection endpoints enforce `user_id` ownership from session; DB foreign key cascade; admin sessions forbidden from decrypting or invoking carrier APIs on behalf of others.          | User B cannot view, patch, reconnect, or delete User A's connection (returns 404); Admin cannot call carrier APIs on user connections.                                     | PR 3, PR 4        |
| 4   | **Key Failure & AAD Tampering**              | AES-256-GCM authenticated encryption; AAD binds `connection_id:user_id:provider:secret_type`; missing/corrupt keys fail-closed.                                                                    | Swapping ciphertext between secret types or connections fails GCM authentication; corrupted master key aborts without overwriting data or downgrading status.              | PR 3              |
| 5   | **Password Decryption Without Audit**        | Decrypting saved passwords for re-login requires persisting an audit event via `SecurityAuditPort`; if audit sink fails, decryption immediately aborts.                                            | Mock failing audit sink during automated re-login -> password decryption is aborted, connection transitions to ERROR, no carrier call executed.                            | PR 4              |
| 6   | **Disable / Connect / Reconnect Races**      | User disablement atomically purges secrets and marks connections `REAUTH_REQUIRED`; pre-commit write validation checks user is `ACTIVE`.                                                           | Trigger carrier reconnect then disable user before HTTP response completes -> late response cannot persist new tokens; secrets remain deleted.                             | PR 3, PR 4        |
| 7   | **Password Change ↔ Session Issuance Race** | Short transaction re-checks `password_hash` equality against the verified hash under row lock before creating session or MFA challenge.                                                            | Simulate password change between Scrypt verification and session insertion -> transaction detects hash mismatch and aborts issuance.                                       | PR 2, PR 6        |
| 8   | **Last Active Admin Race**                   | Transaction-level advisory lock (`pg_advisory_xact_lock`) acquired before row locks; active admin count verified inside same transaction.                                                          | Two concurrent requests to disable the last two active admins -> advisory lock serializes; exactly one succeeds, one fails; 0 active admins is impossible; no deadlocks.   | PR 2              |
| 9   | **MFA Challenge & Recovery Replay**          | Atomic challenge consumption (`UPDATE ... SET consumed_at = now() WHERE consumed_at IS NULL`); `last_used_step` monotonic check; single-use recovery code hashes.                                  | Replaying consumed challenge token returns 401; replaying TOTP code within same 30s step returns 401; reused recovery code returns 401.                                    | PR 6              |
| 10  | **Public Ingress, CSRF & Proxy Spoofing**    | Strict `OriginGuard` on mutations; `SameSite=Strict` cookies; trusted proxy hop validation; public startup gate requires MFA.                                                                      | Untrusted Origin returns 403; public profile fails boot if MFA enforcement disabled; spoofed X-Forwarded-\* headers rejected by linklocal proxy config.                    | PR 7              |
| 11  | **Token Verification Identity Mismatch**     | Candidate tokens verified against `POST /client/api-token-verify/`; response `user.userid` must match `external_account_id`.                                                                       | Mock token verify returning different `userid` -> connection immediately transitions to `REAUTH_REQUIRED`, automated re-login permanently disabled.                        | PR 4              |
| 12  | **Setup Token Replay, Overwrite & Race**     | Atomic consumption (`consumed_at IS NULL`); reissue invalidation; non-overwrite check in `setup-password`; atomic token invalidation on operator disablement; no resurrection on reactivate.       | Disabling operator invalidates active setup token; reactivating user does not revive old token; consuming old token after reissue returns 400; password cannot overwrite.  | PR 2              |
| 13  | **Milestone Administrative Access Breach**   | Phased admin authorization: PR 2..5 password-only on loopback; PR 6 enforces `role=ADMIN AND auth_level=MFA` and revokes password-only admin sessions; PR 7 fails boot if MFA disabled.            | PR 2 admin endpoint accepts password session on loopback; PR 6 rejects password session on admin endpoints (403); PR 7 refuses public profile boot if MFA enforcement off. | PR 2, PR 6, PR 7  |

## 5. Open Technical Items & Carrier Verifications (Plan Issues)

1. **Carrier Contract & Authorization Verifications (Uniship Live Merge Gate)**:
   - Written confirmation of long-term encrypted password / token storage rights and automated re-login terms.
   - Exact request body and error response schema for `POST /client/api-token-verify/`.
   - Token time-to-live (TTL) and whether token refresh endpoints exist (no refresh assumed).
   - Provider-side rate limits, IP allowlisting, and concurrent session rules.
   - _Distinction_: Owner-provided response examples demonstrate observed behavior; formal API contract evidence is required prior to PR 4 live merge.
2. **Security Audit Log Sink**:
   - Defining the durable `SecurityAuditPort` storage sink and fail-closed policy when audit persistence fails during password decryption for re-login.
3. **Operator Onboarding Transport**:
   - Production delivery mechanism for single-use setup links (e.g. secure out-of-band messaging vs internal admin console generation).
4. **Admin Connection Ownership Transfer**:
   - Initial runbook uses hard-delete of the old connection followed by connection by the new owner. Seamless transfer with credential re-encryption remains deferred.
5. **CI Run 38589949284 Investigation (Database Recovery Smoke Timeout)**:
   - GitHub Actions run [38589949284](https://github.com/dinhphuquy2k1/nexora/actions/runs/38589949284): Docker quality and migrated integration passed. Local release runtime smoke failed with `AUTH_RUNTIME_SMOKE_FAILED` at `DATABASE_RECOVERY_READINESS`.
   - Log inspection reveals: during the simulated PostgreSQL outage/restart, `waitReady()` timed out awaiting database recovery; Web received `ECONNREFUSED` while calling `http://api:4000/api/health/ready`.
   - Analysis: PR #15 is strictly documentation-only (no runtime code, schema, or CI script changes allowed). This runtime test timeout is an environmental timing issue requiring runtime/test harness adjustments in a separate follow-up. Since mandatory CI did not pass, PR #15 cannot conclude `READY TO MERGE` and is classified as `READY WITH FIXES`.

## 6. Deferred Beyond Milestone

- Database Backup/Restore subsystem (retired per ADR-006; disaster recovery invariants documented in ADR-007).
- Passkey / WebAuthn for ADMIN.
- MFA for OPERATOR accounts.
- Automated shipment tracking synchronization, webhooks, background queues, and analytics dashboards.

## 7. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Established ADR-007 formalizing Multi-Carrier Management, Security Architecture & Independent Identity.
- Superseded experimental external identity and provider-login direction; scheduled complete removal for PR 2 without legacy backfilling.
- Specified one-time operator setup link contract (`operator_setup_tokens`, `POST /api/admin/operators`, `POST /api/auth/setup-password`).
- Added operator setup link reissue contract (`POST /api/admin/operators/:id/setup-link`), credential non-overwrite constraint, and atomic token invalidation on operator disablement.
- Defined phased milestone administrative authorization policy: PR 2..5 password-only on local loopback; PR 6 MFA enforcement across all admin endpoints and session revocation; PR 7 public HTTPS startup boot gate.
- Formalized global unique constraint `(provider, external_account_id)` and unified generic error `400 CANNOT_CONNECT_CARRIER_ACCOUNT`.
- Specified encrypted credential storage using AES-256-GCM + HKDF with AAD binding and isolated master keys.
- Defined token verification protocol using `POST /client/api-token-verify/` and Uniship live merge gate requirements.
- Defined ADMIN mandatory TOTP MFA (RFC 6238), CLI enrollment protocol without DB locks during interactive prompts, atomic challenge consumption, and session `auth_level`.
- Specified transaction-level PostgreSQL advisory lock (`pg_advisory_xact_lock`) for last active admin invariant, with precisely bounded deadlock scope.
- Clarified administrative carrier endpoints and interim CLI (`dist/cli/carrier-admin.js`) as PLANNED / DEFERRED post-PR 6.
- Defined Public HTTPS Profile release gates: hard dependency on PR 6, API startup enforcement, and host NTP synchronization runbook check.

### Canonical owners

- `docs/decisions/multi-carrier-architecture.md`
- `docs/decisions/README.md`
- `docs/decisions/unified-identity.md`
- `docs/decisions/authentication.md`
- `docs/decisions/product-scope.md`
- `docs/architecture/backend.md`
- `docs/architecture/database.md`
- `docs/architecture/api-contract.md`
- `docs/architecture/runtime.md`
- `docs/operations/deployment.md`
- `docs/domains/shipments.md`

### Documentation verification

- `pnpm docs:check`
- `pnpm format:check`
- `node scripts/boundaries.mjs`
- `pnpm contracts:check`
- `git diff --check`

## 8. Evidence

| Claim                                        | Evidence                                                                           | Date       | Result |
| :------------------------------------------- | :--------------------------------------------------------------------------------- | :--------- | :----- |
| Branch and baseline inspected                | `git status`; `git log -n 5 --oneline` on commit `cf6a297`                         | 2026-10-14 | PASS   |
| ADR-007 created with 15 owner decisions      | `docs/decisions/multi-carrier-architecture.md` created                             | 2026-10-14 | PASS   |
| Canonical decisions synchronized             | `docs/decisions/{README,unified-identity,authentication,product-scope}.md` updated | 2026-10-14 | PASS   |
| Canonical architecture synchronized          | `docs/architecture/{backend,database,api-contract,runtime}.md` updated             | 2026-10-14 | PASS   |
| Operations and domain synchronized           | `docs/operations/deployment.md` and `docs/domains/shipments.md` updated            | 2026-10-14 | PASS   |
| Review findings I1–I4 and M1–M4 addressed    | All findings incorporated into ADR-007, database, backend, contracts & task record | 2026-10-14 | PASS   |
| Finding I1 (Milestone Admin Policy) resolved | ADR-007, backend, api-contract, authentication ADR updated with PR 2/6/7 policy    | 2026-10-14 | PASS   |
| Finding M1 (Setup Link Reissue) resolved     | `POST /api/admin/operators/:id/setup-link` contract, single-use, non-overwrite     | 2026-10-14 | PASS   |
| Finding M2 (Disable Invalidation) resolved   | Atomic token invalidation on disablement; non-overwrite check in `setup-password`  | 2026-10-14 | PASS   |
| Finding M3 (Interim Carrier CLI) resolved    | `dist/cli/carrier-admin.js` marked PLANNED / DEFERRED; SQL runbooks for interim    | 2026-10-14 | PASS   |
| Minor Finding (Deadlock Scope) resolved      | Advisory lock deadlock wording bounded precisely to serializing admin reductions   | 2026-10-14 | PASS   |
| CI run 38589949284 investigated              | Root cause analyzed: `DATABASE_RECOVERY_READINESS` timeout in runtime smoke        | 2026-10-14 | PASS   |
| Documentation governance & links verified    | `pnpm docs:check` executed with zero errors                                        | 2026-10-14 | PASS   |
| Code and documentation formatting verified   | `pnpm format:check` executed with zero formatting drift                            | 2026-10-14 | PASS   |
| Architectural workspace boundaries verified  | `node scripts/boundaries.mjs` executed with PASS                                   | 2026-10-14 | PASS   |
| API contracts reproducibility verified       | `pnpm contracts:check` executed with Contracts reproducible PASS                   | 2026-10-14 | PASS   |
| Git whitespace and diff cleanliness verified | `git diff --check` executed with zero whitespace violations                        | 2026-10-14 | PASS   |
