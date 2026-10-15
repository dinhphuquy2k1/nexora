# Unified identity foundation decision

## Implemented Logical PR 2 — NEXORA-016

Both ACTIVE ADMIN and OPERATOR authenticate using Nexora local credentials. Uniship is independent of Nexora identity. Carrier Connections, MFA, `sessions.auth_level`, public HTTPS and shipment sync remain PLANNED; none is required by this implementation. Administration is supported only on loopback/local deployments before MFA.

NEXORA-016 implements local login for both roles, user-first transactional issuance/onboarding and atomic disablement. Legacy provider-login material below describes historical milestones, not a supported login path. `external_identities` is removed by a new migration. Current contracts and the owner-approved user administration amendment are maintained in [API contract](../architecture/api-contract.md).

Setup secrets use trusted-origin `/setup#token=<secret>`; the browser clears the fragment, keeps it in memory and posts it only in the setup body. The setup page has no-store/no-referrer, no third-party assets and no automatic session issuance. Scrypt parameters remain unchanged.

**Status**: Superseded in part (Local unified `users`/`user_credentials` and local authentication remain accepted; external identity mapping and provider login are superseded by [ADR-007](multi-carrier-architecture.md) and removed in Logical PR 2).

Accepted direction: 2026-10-12. Historical Phase 1 storage is preserved; the experimental Phase 2 provider-login/SQL-registration/mode-split implementation is superseded and removed by Logical PR 2. NEXORA-011/NEXORA-012 retain historical evidence. Current ADMIN and OPERATOR use independent local credentials; approved user-list/status/onboarding APIs are implemented. Staff management UI and live Uniship verification remain deferred. ADR-007 owns future Carrier/MFA architecture.

## Current identity and access

`users` owns ADMIN/OPERATOR role and ACTIVE/DISABLED status; `user_credentials` stores an optional local Scrypt credential. Both configured ACTIVE roles use `/login` and `POST /api/auth/login`. Trusted CLI provisions ADMIN; approved ADMIN endpoints create credentialless OPERATORs and issue single-use setup links. The backend owns authorization and protects the last ACTIVE ADMIN. Public summaries and management summaries follow the explicit API contract.

External identity bindings, raw-userid authentication, provider authentication ports and the Employee/Admin mode split are removed. Carrier responses never create Nexora sessions. Session tokens remain opaque SHA-256-hashed values, independent per login; logout revokes the current token, disable revokes all account sessions/tokens atomically. Historical provider-registration and login evidence belongs to NEXORA-012, not current setup instructions. See ADR-007 for the planned Carrier boundary.

## Future deployment boundary

Employee Internet access requires a separate HTTPS deployment milestone covering TLS ingress, Secure cookies, trusted Host/Origin configuration, API exposure, administrative restrictions and remote multi-device security. Current supported loopback HTTP and internal-only API/PostgreSQL remain unchanged.

Proposed policy: public employee ingress must not automatically expose local Admin Login. A separately trusted private channel must protect Admin authentication, APIs and already issued Admin sessions. Spoofable headers cannot prove local access. Preserve local recovery independently of Uniship. Exact ingress configuration awaits the deployment ADR and owner hosting/access decisions; this document implements no network restriction or exposure.

## Confirmed authorization and observed provider examples

Owner-supplied observations only:

- Login: `POST https://kh.uniship.vn/client/api-token-auth/`, body containing employee username/password and `FirebaseToken: null`; response has a provider token and user fields userid, username, email and is_verified.
- Profile: `GET https://kh.uniship.vn/client/api/customers/{userid}`, with `Authorization: Bearer <provider-token>`; response includes data.ID, data.Username and customer metadata.

No real credential/token is included. The owner confirmed permission for Uniship API integration on 2026-10-13 and approved storing `userid` as the preregistered identity binding. This confirmation supersedes earlier missing-permission assumptions. The original Identity adapter was verified only against local HTTP mocks and has been removed. Its independent Carrier HTTP client and safety tests are retained. Live verification remains deferred; configuration of that future client cannot enable Provider Login.

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

## Historical provider-login policy (superseded)

The removed Identity provider flow had generic authentication failures and bounded admission. Its implementation/evidence is preserved in NEXORA-012. Current local login and deferred Carrier errors are owned by [API contract](../architecture/api-contract.md) and ADR-007; no provider authentication method remains in AuthService.

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

| Component             | Ownership                                                                                                             |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| users                 | Application identity, role (ADMIN/OPERATOR), status (ACTIVE/DISABLED) and metadata                                    |
| user_credentials      | Nexora-managed local Scrypt hashes; optional one-to-one UserCredential, user_id primary key/FK with ON DELETE CASCADE |
| sessions              | Existing opaque session-token hashes, user association and expiry; multiple independent sessions                      |
| operator_setup_tokens | Hashed 24h single-use OPERATOR setup links with target/issuer references                                              |
| provider_credentials  | Future permitted encrypted provider tokens in a later phase                                                           |

Never place carrier passwords or bearer tokens in user_credentials. Generic validation still checks an unrevoked/unexpired opaque session and ACTIVE user. Local Login independently requires an ACTIVE ADMIN or OPERATOR with a verified local credential. Provider Identity authentication no longer exists. Upgrade revocation is explicit in the approved cutover below, rather than a broad SessionGuard policy change.

## Multi-Carrier Architecture Amendment — 2026-10-14

Per [ADR-007](multi-carrier-architecture.md), the owner decided that Nexora has zero real users and that logistics provider accounts must not be coupled to operator authentication. The experimental provider-login subsystem is eliminated in implemented Logical PR 2:

- `external_identities` table is dropped via a forward-only migration.
- `POST /api/auth/provider/login` and `ProviderAuthenticationPort` are removed.
- OPERATOR and ADMIN accounts both use local Scrypt credentials in `user_credentials`.
- Carrier account connections are deferred to PR 3/4 in independent `carrier_connections` and `carrier_connection_secrets` tables, owned by individual Nexora users.
- The Uniship HTTP client is relocated to `apps/api/src/carrier/infrastructure/uniship/`.

## Legacy session upgrade boundary

The owner-approved cutover in [ADR-007](../decisions/multi-carrier-architecture.md) is implemented by a new migration. Every OPERATOR session without a local credential is deleted at upgrade, including expired/DISABLED-user sessions. ADMIN and configured OPERATOR sessions are retained. SessionGuard is unchanged; removed tokens cannot regain validity after setup. No auth-source metadata exists to distinguish sessions of configured operators.
