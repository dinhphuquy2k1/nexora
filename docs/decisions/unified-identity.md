# Unified identity foundation decision

## Implemented Logical PR 2 — NEXORA-016

Both ACTIVE ADMIN and OPERATOR authenticate using Nexora local credentials. Uniship is independent of Nexora identity. Carrier connect/reconnect, MFA, `sessions.auth_level`, public HTTPS and shipment sync remain PLANNED; none is required by this implementation. Administration is supported only on loopback/local deployments before MFA.

NEXORA-016 implements local login for both roles, user-first transactional issuance/onboarding and atomic disablement. Legacy provider-login material below describes historical milestones, not a supported login path. `external_identities` is removed by a new migration. Current contracts and the owner-approved user administration amendment are maintained in [API contract](../architecture/api-contract.md).

Setup secrets use trusted-origin `/setup#token=<secret>`; the browser clears the fragment, keeps it in memory and posts it only in the setup body. The setup page has no-store/no-referrer, no third-party assets and no automatic session issuance. Scrypt parameters remain unchanged.

**Status**: Superseded in part (Local unified `users`/`user_credentials` and local authentication remain accepted; external identity mapping and provider login are superseded by [ADR-007](multi-carrier-architecture.md) and removed in Logical PR 2).

Accepted direction: 2026-10-12. Historical Phase 1 storage is preserved; the experimental Phase 2 provider-login/SQL-registration/mode-split implementation is superseded and removed by Logical PR 2. NEXORA-011/NEXORA-012 retain historical evidence. Current ADMIN and OPERATOR use independent local credentials; approved user-list/status/onboarding APIs are implemented. Staff management UI and live Uniship verification remain deferred. ADR-007 owns future Carrier/MFA architecture.

## Current identity and access

`users` owns ADMIN/OPERATOR role and ACTIVE/DISABLED status; `user_credentials` stores an optional local Scrypt credential. Both configured ACTIVE roles use `/login` and `POST /api/auth/login`. Trusted CLI provisions ADMIN; approved ADMIN endpoints create credentialless OPERATORs and issue single-use setup links. The backend owns authorization and protects the last ACTIVE ADMIN. Public summaries and management summaries follow the explicit API contract.

External identity bindings, raw-userid authentication, provider authentication ports and the Employee/Admin mode split are removed. Carrier responses never create Nexora sessions. Session tokens remain opaque SHA-256-hashed values, independent per login; logout revokes the current token, disable revokes all account sessions/tokens atomically. Historical provider-registration and login evidence belongs to NEXORA-012, not current setup instructions. See ADR-007 and the API/database canonical docs for the implemented PR3 Carrier foundation and deferred PR4 workflows.

## Future deployment boundary

Employee Internet access requires a separate HTTPS deployment milestone covering TLS ingress, Secure cookies, trusted Host/Origin configuration, API exposure, administrative restrictions and remote multi-device security. Current supported loopback HTTP and internal-only API/PostgreSQL remain unchanged.

Proposed policy: public employee ingress must not automatically expose local Admin Login. A separately trusted private channel must protect Admin authentication, APIs and already issued Admin sessions. Spoofable headers cannot prove local access. Preserve local recovery independently of Uniship. Exact ingress configuration awaits the deployment ADR and owner hosting/access decisions; this document implements no network restriction or exposure.

## Confirmed authorization and observed provider examples

Owner-supplied observations only:

- Login: `POST https://kh.uniship.vn/client/api-token-auth/`, body containing employee username/password and `FirebaseToken: null`; response has a provider token and user fields userid, username, email and is_verified.
- Profile: `GET https://kh.uniship.vn/client/api/customers/{userid}`, with `Authorization: Bearer <provider-token>`; response includes data.ID, data.Username and customer metadata.

No real credential/token is included. The owner confirmed permission for Uniship API integration on 2026-10-13 and approved storing `userid` as the preregistered identity binding. This confirmation supersedes earlier missing-permission assumptions. The original Identity adapter was verified only against local HTTP mocks and has been removed. Its independent Carrier HTTP client and safety tests are retained. Live verification remains deferred; configuration of that future client cannot enable Provider Login.

API permission and approved userid mapping do not establish unrestricted rights to retain provider tokens, customer profiles or shipment data. Exact retention terms, token lifecycle and rate limits are not available in repository evidence; broader storage remains deferred. No authorization-document metadata is inferred from the owner confirmation.

Historical provider observations and remaining Carrier technical/data-handling questions:

1. Server-to-server API integration permission: confirmed by the owner on 2026-10-13; no reconfirmation required.
2. Is userid stable and non-reassignable? (Owner confirmed permanent for application planning; formal provider contract pending)
3. Historical preregistration used owner-confirmed manual userid entry; that SQL workflow is removed. Future Carrier linkage follows ADR-007.
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

## Historical phases superseded by ADR-007

Original Phase 1/2 storage and experimental provider-login delivery are historical milestones recorded in NEXORA-011/NEXORA-012. Their old future-phase plan is superseded by ADR-007. Current Logical PR 2 implements local identity, onboarding and ADMIN status/list APIs. Carrier Connections foundation (PR3) is implemented. Uniship Carrier Adapter (PR4), ADMIN MFA (PR6) and Public HTTPS (PR7) remain deferred; staff management UI is also deferred. No old login-mode or SQL-registration workflow remains supported.

## Current storage ownership — Logical PR 2

This supersedes the Phase 1/2 external-binding selection while preserving accepted local identity ownership.

| Component             | Ownership                                                                               |
| :-------------------- | :-------------------------------------------------------------------------------------- |
| users                 | Nexora identity, ADMIN/OPERATOR role, ACTIVE/DISABLED status and metadata               |
| user_credentials      | Optional one-to-one local Scrypt hash, user_id primary key/FK with cascade deletion     |
| sessions              | Opaque SHA-256 session-token hashes, user association and expiry; independent per login |
| operator_setup_tokens | Hashed 24h single-use OPERATOR setup links with target/issuer references                |

PR2 introduced no provider credential table. PR3 adds carrier_connection_secrets under independent Carrier ownership; connect/reconnect remains PR4.

Never place carrier passwords or bearer tokens in user_credentials. Generic validation still checks an unrevoked/unexpired opaque session and ACTIVE user. Local Login independently requires an ACTIVE ADMIN or OPERATOR with a verified local credential. Provider Identity authentication no longer exists. Upgrade revocation is explicit in the approved cutover below, rather than a broad SessionGuard policy change.

## Multi-Carrier Architecture Amendment — 2026-10-14

Per [ADR-007](multi-carrier-architecture.md), the owner decided that Nexora has zero real users and that logistics provider accounts must not be coupled to operator authentication. The experimental provider-login subsystem is eliminated in implemented Logical PR 2:

- `external_identities` table is dropped via a forward-only migration.
- `POST /api/auth/provider/login` and `ProviderAuthenticationPort` are removed.
- OPERATOR and ADMIN accounts both use local Scrypt credentials in `user_credentials`.
- PR3 implements Carrier metadata and encrypted storage; PR4 connect/reconnect remains deferred. Independent `carrier_connections` and `carrier_connection_secrets` tables, owned by individual Nexora users.
- The Uniship HTTP client is relocated to `apps/api/src/carrier/infrastructure/uniship/`.

## Legacy session upgrade boundary

The owner-approved cutover in [ADR-007](../decisions/multi-carrier-architecture.md) is implemented by a new migration. Every OPERATOR session without a local credential is deleted at upgrade, including expired/DISABLED-user sessions. ADMIN and configured OPERATOR sessions are retained. SessionGuard is unchanged; removed tokens cannot regain validity after setup. No auth-source metadata exists to distinguish sessions of configured operators.
