# Task: NEXORA-015 — Multi-Carrier Architecture, Security & API Contracts

- **Task ID**: `NEXORA-015`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`
- **Classification**: SIGNIFICANT
- **Working branch**: `feat/multi-carrier-architecture-contracts`
- **Target GitHub PR**: #15
- **Starting main SHA**: `e18bef4e5a4557baee60b9b8729dc72b789315a1`

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

| Logical PR         | Scope Summary                                          | Key Acceptance Criteria                                                                                                                                                                                                                                                                                                                                                    | Dependencies                 |
| :----------------- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| **PR 1** (Current) | **ADR / Security / Contracts**                         | ADR-007 accepted, canonical architecture documents updated, API contracts specified, test plan and threat model documented. `Documentation Impact: REQUIRED`. Delivered in GitHub PR #15.                                                                                                                                                                                  | None                         |
| **PR 2**           | **Unified Local Login / RBAC / Legacy Removal**        | Both OPERATOR and ADMIN login locally; backend RBAC; one-time setup links for operators; last active ADMIN invariant. Complete removal of provider login (`/api/auth/provider/login` returns 404); forward-only migration drops `external_identities`; separate one-time script purges dev operators. Uniship HTTP client refactored to `carrier/infrastructure/uniship/`. | PR 1                         |
| **PR 3**           | **Carrier Connections & Encrypted Secrets Foundation** | Database schemas for `carrier_connections` and `carrier_connection_secrets`; shared cryptographic module `apps/api/src/common/crypto/` (AES-256-GCM, HKDF); key versioning; global unique constraint enforcement; user disablement race control.                                                                                                                           | PR 1                         |
| **PR 4**           | **Uniship Carrier Adapter & UI**                       | Integration adapter calling `api-token-verify`; connect / reconnect / re-login orchestration; default encrypted password persistence; Carrier Settings UI. _Merge Gate_: Requires confirmed carrier credential storage terms.                                                                                                                                              | PR 2 + PR 3                  |
| ~~PR 5~~           | **Consolidated into PR 2**                             | Merged into PR 2 to maintain logical PR sequencing (PR 1, 2, 3, 4, 6, 7).                                                                                                                                                                                                                                                                                                  | —                            |
| **PR 6**           | **ADMIN TOTP MFA**                                     | `user_mfa`, `mfa_challenges`, `mfa_recovery_codes`, `sessions.auth_level`; two-step login flow; CLI-only enrollment (`pnpm mfa:enroll`); atomic challenge consumption; dedicated Identity master key.                                                                                                                                                                      | PR 2 (Independent of PR 3/4) |
| **PR 7**           | **Public HTTPS Profile & Ingress Gates**               | HTTPS profile; `Secure` cookie enforcement; Host/Origin validation; ingress rate limits; startup gate refusing boot if MFA disabled; host NTP sync verification.                                                                                                                                                                                                           | PR 2 + PR 6 (Hard Gate)      |

## 3. Acceptance Criteria

- [x] **ADR-007 Created & Accepted**: Documents 15 owner-approved decisions, independent identity, global unique carrier accounts, encrypted credentials, Uniship token verification, ADMIN TOTP MFA, and public HTTPS release gates.
- [x] **Canonical Documentation Synchronized**:
  - `docs/decisions/README.md` updated with ADR-007.
  - `docs/decisions/unified-identity.md` updated to document supersession of provider login and PR 2 legacy removal.
  - `docs/decisions/authentication.md` updated to document ADMIN TOTP MFA, session `auth_level`, and public HTTPS profile.
  - `docs/decisions/product-scope.md` updated to affirm carrier connection boundaries and non-goals.
  - `docs/architecture/backend.md` updated with carrier modular monolith layout, `common/crypto/`, and RBAC enforcement.
  - `docs/architecture/database.md` updated with target schemas for `carrier_connections`, `carrier_connection_secrets`, `sessions.auth_level`, `user_mfa`, and transaction locking invariants.
  - `docs/architecture/api-contract.md` updated with carrier connection and MFA endpoints, plus PR 2 provider login deprecation.
  - `docs/architecture/runtime.md` and `docs/operations/deployment.md` updated with public HTTPS release gates and host NTP verification.
  - `docs/domains/shipments.md` updated to clarify that carrier connections do not implement shipment tables or background workers.
- [x] **Findings 1–6 Addressed**:
  - `POST /api/auth/mfa/verify` specified with `@Public()`, bypassing global `SessionGuard`, but protected by `OriginGuard`, ephemeral challenge cookie, rate limits, and replay prevention.
  - Duplicate carrier account conflict returns generic error `400 CANNOT_CONNECT_CARRIER_ACCOUNT` without leaking cross-user linkages; detailed conflict logged to server-side audit.
  - Security invariants synchronized: password-hash recheck in session/challenge transaction, initial `last_used_step` in enrollment, atomic challenge revocation on credential/status changes, CLI password verification, and durable audit fail-closed during carrier password decryption.
  - `login_identifier` specified as conditional per adapter and nullable at schema level.
  - Outdated "no login/session" baseline description corrected in `docs/operations/deployment.md`.
  - Deterministic lock ordering (`ORDER BY id ASC`) defined for last active admin invariant to prevent deadlocks.
- [x] **Documentation Verification Checks PASS**: `pnpm docs:check`, `pnpm format:check`, `node scripts/boundaries.mjs`, and `pnpm contracts:check` pass without errors.
- [x] **Documentation-Only Boundary Respected**: No runtime code deleted, no Prisma migrations executed, no OpenAPI/SDK artifacts regenerated, and no live carrier calls executed.

## 4. Open Technical Items & Carrier Verifications (Plan Issues)

1. **Carrier Inquiries (Uniship)**:
   - Written confirmation of long-term encrypted password / token storage rights and automated re-login terms.
   - Exact request body and error response schema for `POST /client/api-token-verify/`.
   - Token time-to-live (TTL) and whether token refresh endpoints exist.
   - Provider-side rate limits, IP allowlisting, and concurrent session rules.
2. **Security Audit Log Sink**:
   - Defining the durable `SecurityAuditPort` storage sink and fail-closed policy when audit persistence fails during password decryption for re-login.
3. **Operator Onboarding Transport**:
   - Production delivery mechanism for single-use setup links (e.g. secure out-of-band messaging vs internal admin console generation).
4. **Admin Connection Ownership Transfer**:
   - Initial runbook uses hard-delete of the old connection followed by connection by the new owner. Seamless transfer with credential re-encryption remains deferred.

## 5. Deferred Beyond Milestone

- Database Backup/Restore subsystem (retired per ADR-006; disaster recovery invariants documented in ADR-007).
- Passkey / WebAuthn for ADMIN.
- MFA for OPERATOR accounts.
- Automated shipment tracking synchronization, webhooks, background queues, and analytics dashboards.

## 6. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Established ADR-007 formalizing Multi-Carrier Management, Security Architecture & Independent Identity.
- Superseded experimental external identity and provider-login direction; scheduled complete removal for PR 2 without legacy backfilling.
- Formalized global unique constraint `(provider, external_account_id)`.
- Specified encrypted credential storage using AES-256-GCM + HKDF with AAD binding and isolated master keys.
- Defined token verification protocol using `POST /client/api-token-verify/`.
- Defined ADMIN mandatory TOTP MFA (RFC 6238), CLI enrollment, atomic challenge consumption, and session `auth_level`.
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

## 7. Evidence

| Claim                                        | Evidence                                                                           | Date       | Result |
| :------------------------------------------- | :--------------------------------------------------------------------------------- | :--------- | :----- |
| Branch and baseline inspected                | `git status`; `git log -n 5 --oneline` on commit `e18bef4`                         | 2026-10-14 | PASS   |
| ADR-007 created with 15 owner decisions      | `docs/decisions/multi-carrier-architecture.md` created                             | 2026-10-14 | PASS   |
| Canonical decisions synchronized             | `docs/decisions/{README,unified-identity,authentication,product-scope}.md` updated | 2026-10-14 | PASS   |
| Canonical architecture synchronized          | `docs/architecture/{backend,database,api-contract,runtime}.md` updated             | 2026-10-14 | PASS   |
| Operations and domain synchronized           | `docs/operations/deployment.md` and `docs/domains/shipments.md` updated            | 2026-10-14 | PASS   |
| Documentation governance & links verified    | `pnpm docs:check` executed with zero errors                                        | 2026-10-14 | PASS   |
| Code and documentation formatting verified   | `pnpm format:check` executed with zero formatting drift                            | 2026-10-14 | PASS   |
| Architectural workspace boundaries verified  | `node scripts/boundaries.mjs` executed with PASS                                   | 2026-10-14 | PASS   |
| API contracts reproducibility verified       | `pnpm contracts:check` executed with Contracts reproducible PASS                   | 2026-10-14 | PASS   |
| Git whitespace and diff cleanliness verified | `git diff --check` executed with zero whitespace violations                        | 2026-10-14 | PASS   |
