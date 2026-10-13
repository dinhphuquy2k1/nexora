# Unified identity foundation decision

Accepted direction: 2026-10-12. Phase 1 storage/local-authentication implementation: IMPLEMENTED; verification tracked in NEXORA-011. Phase 2 external identity database schema, manual SQL operator registration, provider authentication port/adapter, employee login API orchestration, mock-provider HTTP integration tests, and frontend login mode split: IMPLEMENTED under NEXORA-012; admin staff management UI and live Uniship verification: DEFERRED. Future phases: PLANNED. This decision defines Phase 0 and the gated Phase 1–2 target; it describes the implemented storage and authentication boundary with Uniship API integration authorization confirmed by the owner on 2026-10-13. Existing runtime decisions remain authoritative until their implementation milestones pass. ADR-005 remains authoritative for implemented Scrypt local credentials, opaque PostgreSQL sessions, operational Login/Logout/Session APIs and loopback HTTP. This decision extends future direction without superseding that runtime. PR #7 is merged at ad01e74; unified users/user_credentials storage is implemented; external_identities schema, manual SQL registration, and testable provider authentication flow are implemented in PR #10; live Uniship authentication remains technically unverified; permission is confirmed and operational enablement is separate. See [NEXORA-010](../tasks/completed/NEXORA-010-unified-identity-foundation.md) for Phase 0, [NEXORA-011](../tasks/completed/NEXORA-011-unified-identity-migration.md) for Phase 1, and [NEXORA-012](../tasks/active/NEXORA-012-admin-staff-management.md) for Phase 2.

## Identity and access

The target is one `users` table with feature-local `as const` vocabulary: role ADMIN/OPERATOR, status ACTIVE/DISABLED and provider `IdentityProvider.UNISHIP` (`uniship`, owned by `identity/domain/provider-policy.ts`), stored as VARCHAR with SQL CHECK constraints, never Prisma/PostgreSQL/TypeScript enums. Role has no final database default; all creation paths specify it explicitly. Local passwords belong in `user_credentials`, not the unified user row. External identities map into `external_identities` with a unique `(provider, provider_subject)` and `(user_id, provider)` constraint; provider credentials and device/audit/approval tables are deferred.

Trusted local provisioning creates ADMIN explicitly, never exposes role selection through HTTP and never creates local-password Operators. Legacy trusted accounts may become ADMIN only after the merged production creation paths and history establish provenance. A provenance gap stops migration; active and disabled state must survive.

Employee Login uses `/login` (calling `POST /api/auth/provider/login`); independent local Admin Login uses `/login?mode=admin` (calling `POST /api/auth/login`). Both methods issue Nexora opaque PostgreSQL sessions; provider tokens never become application session tokens. IP and User-Agent are not authoritative session bindings. Each Login creates an independent session; Logout revokes only the current session. No unique user_id session constraint or device management is introduced. Future disable revokes all account sessions and session validation rejects disabled users.

Uniship is the only planned provider. Provider username/email are not permanent identity keys. The owner confirms that Uniship `userid` is treated as a permanent identity identifier for this application integration plan; admin will manually obtain and enter the `userid` via authorized SQL. Employee registration initially uses an atomic SQL script (`scripts/sql/register-uniship-operator.sql`), not a browser interface or HTTP endpoint. Questions about future userid reassignment are not blockers for this initial implementation. Fast, testable Login foundation is the immediate priority. Treat these as owner-approved application requirements, with API integration authorization separately confirmed by the owner; this does not establish every technical or data-retention term. Unknown identities do not automatically create accounts, PENDING requests or public registrations. Only an explicitly registered ACTIVE OPERATOR may eventually access Nexora after verified provider authentication.

Server-side authentication boundary: A manually inserted `external_identities` record is authorization data, not proof of authentication. Nexora sessions are NEVER issued based solely on a client-submitted `userid`, username form, or matching database row. No public HTTP endpoint accepts unauthenticated raw `userid`. A verified provider identity must come from a trusted server-side authentication adapter conforming to `ProviderAuthenticationPort` (`AuthService.loginWithProvider` and `AuthService.authenticateExternalIdentity`), verified via automated local mock-provider tests. Production provider integration fails closed without explicit operational authorization (`UNISHIP_LIVE_AUTHORIZED=true`).

Phase 2 staff management UI (account list, preregistration form, disable/reactivate buttons) and HTTP management APIs are deferred to a subsequent milestone to prioritize the database foundation and testable authentication flow. The final ACTIVE ADMIN invariant belongs to the deferred Admin mutation API and UI implementation.

## Future deployment boundary

Employee Internet access requires a separate HTTPS deployment milestone covering TLS ingress, Secure cookies, trusted Host/Origin configuration, API exposure, administrative restrictions and remote multi-device security. Current supported loopback HTTP and internal-only API/PostgreSQL remain unchanged.

Proposed policy: public employee ingress must not automatically expose local Admin Login. A separately trusted private channel must protect Admin authentication, APIs and already issued Admin sessions. Spoofable headers cannot prove local access. Preserve local recovery independently of Uniship. Exact ingress configuration awaits the deployment ADR and owner hosting/access decisions; this document implements no network restriction or exposure.

## Confirmed authorization and observed provider examples

Owner-supplied observations only:

- Login: `POST https://kh.uniship.vn/client/api-token-auth/`, body containing employee username/password and `FirebaseToken: null`; response has a provider token and user fields userid, username, email and is_verified.
- Profile: `GET https://kh.uniship.vn/client/api/customers/{userid}`, with `Authorization: Bearer <provider-token>`; response includes data.ID, data.Username and customer metadata.

No real credential/token is included. The owner confirmed permission for Uniship API integration on 2026-10-13 and approved storing `userid` as the preregistered identity binding. This confirmation supersedes earlier missing-permission assumptions. The server-side adapter is implemented and verified against a local HTTP mock; no real Uniship authentication request was executed for this fix. Mock PASS does not establish live PASS. The administrator may explicitly enable `UNISHIP_LIVE_AUTHORIZED` (default `false`) under the approved authorization and deployment procedure, and is responsible for the correct `UNISHIP_API_URL`. No new destination allowlist or hardcoded endpoint is required.

API permission and approved userid mapping do not establish unrestricted rights to retain provider tokens, customer profiles or shipment data. Exact retention terms, token lifecycle and rate limits are not available in repository evidence; broader storage remains deferred. No authorization-document metadata is inferred from the owner confirmation.

Recorded decisions and remaining technical/data-handling questions:

1. Server-to-server API integration permission: confirmed by the owner on 2026-10-13; no reconfirmation required.
2. Is userid stable and non-reassignable? (Owner confirmed permanent for application planning; formal provider contract pending)
3. How may Admin legitimately obtain employee userids? (Owner confirmed: Admin manually obtains and enters userid via SQL)
4. Are identities independent customer accounts or corporate subaccounts?
5. What source-IP rate limits apply?
6. Is server-IP allowlisting supported?
7. Does a new Login invalidate previous tokens?
8. Can multiple tokens coexist?
9. What expiry, refresh and revocation rules apply?
10. Is durable encrypted token storage permitted?
11. What retrieval and retention rights apply?

## Planned provider failure policy

Invalid credentials, a valid unregistered identity, a non-operator user and a disabled Operator must share HTTP 401, code `AUTHENTICATION_FAILED`, message `Thông tin đăng nhập không hợp lệ hoặc tài khoản chưa được cấp quyền truy cập.` Public errors must not disclose registration status. This policy is implemented in `AuthService.authenticateExternalIdentity` and does not replace current local Login codes.

Successful provider authentication may require an additional profile request, leaving observable timing differences despite identical failures. Future implementation must apply username admission, a global outbound budget and concurrency limits before provider calls, respect source-IP limits, avoid unnecessary timing padding and never log credentials/tokens. API integration authorization is confirmed. Any future profile retrieval or token persistence must establish its own technical and data-handling terms; this does not block the approved userid-binding and mock-login scope.

## Separate future phases

| Phase | Dependency                                                                             | Scope                                                                                                                                   |
| :---- | :------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Phase 0 merged, merged schema/applicable migration CI verified, provenance established | Unified users/local credentials and preserved local authentication (IMPLEMENTED)                                                        |
| 2     | Phase 1 merged/verified; owner confirms permanent userid semantics & manual SQL flow   | External identity schema, manual SQL operator registration, fake-provider login foundation (IMPLEMENTED); Admin UI/CRUD APIs (DEFERRED) |
| 3     | Hosting inputs and administrative access policy approved                               | HTTPS ingress, cookies, Host/Origin, public/private separation, remote sessions                                                         |
| 4     | Authorization confirmed; live technical evidence and applicable data terms             | Live Uniship verification; separately approved token persistence and oracle controls                                                    |
| 5     | All dependency/security gates verified                                                 | Public HTTPS employee activation and remote multi-device readiness; local UI modes already implemented                                  |

Phases 3–5 require separate prompts and PRs. No JWT, Redis, generic RBAC framework, shipment integration or automatic deployment/merge follows from this decision.

## Approved Phase 1 & 2 amendment — 2026-10-12

The owner selects `users` plus `user_credentials` plus `external_identities` plus existing `sessions`.

| Component            | Ownership                                                                                                             |
| :------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| users                | Application identity, role (ADMIN/OPERATOR), status (ACTIVE/DISABLED) and metadata                                    |
| user_credentials     | Nexora-managed local Scrypt hashes; optional one-to-one UserCredential, user_id primary key/FK with ON DELETE CASCADE |
| sessions             | Existing opaque session-token hashes, user association and expiry; multiple independent sessions                      |
| external_identities  | Confirmed Uniship userid mapping in Phase 2; unique (provider, provider_subject) and (user_id, provider)              |
| provider_credentials | Future permitted encrypted provider tokens in a later phase                                                           |

Never place provider passwords or bearer tokens in user_credentials. Session validation is authentication-method agnostic: structurally valid token, matching unrevoked/unexpired session and existing ACTIVE user only. It must not require ADMIN, a credential/hash, a provider identity or IP/User-Agent equality. Local password Login separately requires ADMIN, ACTIVE and a matching credential; missing credentials, disallowed roles and disabled accounts use valid dummy Scrypt after existing admission, with unchanged public failures. External identity authentication strictly requires server-side verified identity, matching registered ACTIVE OPERATOR, and issues standard opaque Nexora sessions.
