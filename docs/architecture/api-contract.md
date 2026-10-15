# API contract

## Implemented Logical PR 2 — NEXORA-016

Both ACTIVE ADMIN and OPERATOR authenticate using Nexora local credentials. Uniship is independent of Nexora identity. Carrier connect/reconnect, MFA, `sessions.auth_level`, public HTTPS and shipment sync remain PLANNED; none is required by this implementation. Administration is supported only on loopback/local deployments before MFA.

Generated OpenAPI/SDK describe the implemented routes below. Error responses use `{code,message,requestId}`. Every administrative route requires an ACTIVE ADMIN database-backed session; all mutations require a trusted Origin. Missing/revoked/disabled sessions return 401 `UNAUTHORIZED`; OPERATOR callers return 403 `FORBIDDEN`. Origin failures retain 403 `FORBIDDEN`, and shared admission rejection retains 429 `TOO_MANY_REQUESTS` for compatibility.

| Method/path                                | Input                                            | Success                                       | Additional errors                                                                               |
| :----------------------------------------- | :----------------------------------------------- | :-------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| POST `/api/auth/login`                     | `{username,password}`                            | 200 `{user:{id,username}}`, session cookie    | 400 `VALIDATION_ERROR`, 401 `AUTHENTICATION_FAILED`, 403, 429                                   |
| GET `/api/auth/session`                    | session cookie                                   | 200 `{authenticated:true,user:{id,username}}` | 401                                                                                             |
| POST `/api/auth/logout`                    | cookie, trusted Origin                           | 200 `{success:true}`, revoke and clear cookie | 403, 500                                                                                        |
| POST `/api/admin/operators`                | `{username}` only                                | 201 `{user:{id,username},setupUrl,expiresAt}` | 400, 409 `USERNAME_EXISTS`                                                                      |
| POST `/api/admin/operators/:id/setup-link` | no body                                          | 200 `{setupUrl,expiresAt}`                    | 400 `OPERATOR_ALREADY_CONFIGURED`/`VALIDATION_ERROR`, 404                                       |
| POST `/api/auth/setup-password`            | `{token,password}` only; public, Origin required | 200 `{success:true}`, no session              | 400 `INVALID_OR_EXPIRED_SETUP_TOKEN`/`OPERATOR_ALREADY_CONFIGURED`/`VALIDATION_ERROR`, 403, 429 |
| GET `/api/admin/users`                     | none                                             | 200 `{users:ManagedUser[]}`                   | 401, 403                                                                                        |
| PATCH `/api/admin/users/:id/status`        | `{status:"ACTIVE"\|"DISABLED"}` only             | 200 `{user:ManagedUser}`                      | 400, 404 `NOT_FOUND`, 409 `LAST_ACTIVE_ADMIN`                                                   |

`ManagedUser` has exactly `id,username,role,status,hasPassword,createdAt,updatedAt`; hashes and tokens are excluded. The owner approved the status/list contract on 2026-10-15 (`USER_STATUS_ADMIN_CONTRACT`, NEXORA-016). ADMIN may change an OPERATOR, another ADMIN or itself, preserving the last ACTIVE ADMIN. Disable revokes all sessions and pending setup tokens atomically; reactivation restores neither. Self-disable revokes its own sessions. Role changes are unsupported.

Setup passwords require 8–1024 characters before Scrypt. Links contain 256-bit CSPRNG secrets as `/setup#token=<secret>` on the request's configured trusted origin; only SHA-256 is stored, TTL is 24 hours. Reissue invalidates all old unconsumed links and rejects configured users. Setup never resets an existing credential or automatically logs in. Link responses use `Cache-Control: no-store`.

`POST /api/auth/provider/login` is removed, always returns 404 regardless of Uniship configuration, and is absent from generated contracts. The owner-approved upgrade migration revokes all sessions of credentialless OPERATOR users; ADMIN/configured OPERATOR sessions remain. Deleted tokens cannot regain validity after setup. HTTP contracts and SessionGuard are unchanged.

## Deferred milestones — not implemented

| Milestone | Scope                                                               |
| :-------- | :------------------------------------------------------------------ |
| PR 4      | Uniship Carrier Adapter and connect/reconnect credentials lifecycle |
| PR 6      | ADMIN TOTP MFA and sessions.auth_level                              |
| PR 7      | Public HTTPS release gates                                          |

### ADMIN TOTP MFA — PR 6

The future ADMIN login flow returns `{mfaRequired:true}` plus a pending challenge cookie, followed by `POST /api/auth/mfa/verify` with `{code}` and atomic challenge/TOTP replay protection. These are deferred changes, not the current password-session login contract. PR 2 has no MFA tables or `sessions.auth_level`; its ACTIVE ADMIN password sessions authorize local administration. Public exposure requires the separately planned PR 6/7 gates.

## Carrier Connections Management — implemented PR 3 / planned PR 4

Endpoints strictly enforce ownership from the authenticated session (`user_id`). Users cannot access, mutate, or inspect other users' carrier connections. All protected carrier endpoints enforce `401 UNAUTHORIZED` if the caller's session is missing or expired.

| Method   | Endpoint                                 | Target PR | Access        | Payload                                                 | Response                                      | Failure Codes                                                                                                                          |
| :------- | :--------------------------------------- | :-------- | :------------ | :------------------------------------------------------ | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/carriers`                          | PR 3      | Authenticated | None                                                    | 200 `{ carriers: CarrierProviderSummary[] }`  | 401 `UNAUTHORIZED`                                                                                                                     |
| `GET`    | `/api/carrier-connections`               | PR 3      | Authenticated | None                                                    | 200 `{ connections: CarrierConnectionDto[] }` | 401 `UNAUTHORIZED`                                                                                                                     |
| `POST`   | `/api/carrier-connections`               | PR 4      | Authenticated | `{ provider, loginIdentifier?, password, displayName }` | 201 `{ connection: CarrierConnectionDto }`    | 400 `VALIDATION_ERROR`, 400 `CANNOT_CONNECT_CARRIER_ACCOUNT`, 401 `UNAUTHORIZED`, 429 `RATE_LIMITED`, 503 `SERVICE_UNAVAILABLE`        |
| `PATCH`  | `/api/carrier-connections/:id`           | PR 3      | Owner only    | `{ displayName }`                                       | 200 `{ connection: CarrierConnectionDto }`    | 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 404 `NOT_FOUND`                                                                            |
| `POST`   | `/api/carrier-connections/:id/reconnect` | PR 4      | Owner only    | `{ password }`                                          | 200 `{ connection: CarrierConnectionDto }`    | 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 401 `PROVIDER_AUTH_FAILED`, 404 `NOT_FOUND`, 429 `RATE_LIMITED`, 503 `SERVICE_UNAVAILABLE` |
| `DELETE` | `/api/carrier-connections/:id`           | PR 3      | Owner only    | None                                                    | 200 `{ success: true }`                       | 401 `UNAUTHORIZED`, 404 `NOT_FOUND`                                                                                                    |

PR3 GET/PATCH/DELETE are IMPLEMENTED; POST/create and reconnect are PLANNED PR4 and return 404 today. Provider summaries have exactly `provider,displayName`; the single `uniship` entry advertises metadata vocabulary, not live readiness. Connection summaries have exactly the eight fields listed below. GET ignores query ownership selectors: the database predicate always uses the authenticated user ID. PATCH accepts only displayName (1–100 characters, trimmed nonblank); invalid UUID/body returns 400 VALIDATION_ERROR. DELETE also validates UUID (400). Both mutations enforce OriginGuard (403 FORBIDDEN), and return 404 NOT_FOUND for absent/foreign connections, including ADMIN callers. DELETE hard-deletes with secret cascade and returns `{success:true}`. All metadata responses use no-store.

- **Payload Safety**: Connection DTOs expose only metadata (`id, provider, externalAccountId, loginIdentifier, displayName, status, lastVerifiedAt, createdAt`). Plaintext passwords, tokens, nonces, and ciphertexts are never returned.
- **Unified Generic Error Policy (`CANNOT_CONNECT_CARRIER_ACCOUNT`)**: On `POST /api/carrier-connections`, Nexora returns the identical generic error `400 CANNOT_CONNECT_CARRIER_ACCOUNT` ("Không thể kết nối tài khoản này") for BOTH invalid provider credentials and duplicate account linkage (`UNIQUE(provider, external_account_id)`). This completely obscures whether the carrier credentials were valid, whether the carrier account was already linked to another user, or who the existing owner is. Detailed causes (`PROVIDER_AUTH_FAILED` vs `DUPLICATE_EXTERNAL_ACCOUNT`) are recorded strictly in the server-side security audit log.
- **Protected Carrier Endpoints & 401 UNAUTHORIZED**: Every carrier management endpoint requires a valid active Nexora session. Missing, expired, or revoked sessions return `401 UNAUTHORIZED`.
- **Conditional Login Identifier**: `loginIdentifier` is conditional per adapter and nullable at the schema level; providers without username/email credentials (e.g. OAuth/API key) do not require it.
- **Rate Limiting**: `POST /api/carrier-connections` and `reconnect` enforce per-user burst and window limits to prevent credential stuffing attacks against carrier infrastructure.

### Administrative Carrier Management (Deferred Post-PR 6)

| Method   | Endpoint                             | Target PR           | Access      | Functionality                                        | Failure Codes                                        |
| :------- | :----------------------------------- | :------------------ | :---------- | :--------------------------------------------------- | :--------------------------------------------------- |
| `GET`    | `/api/admin/carrier-connections`     | Post-PR 6 Follow-up | ADMIN + MFA | List metadata of all carrier connections in system   | 401 `UNAUTHORIZED`, 403 `FORBIDDEN`                  |
| `DELETE` | `/api/admin/carrier-connections/:id` | Post-PR 6 Follow-up | ADMIN + MFA | Hard-delete connection across users (audit recorded) | 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND` |

- **MFA Precondition & Decoupling**: These administrative carrier endpoints require both `role === 'ADMIN'` AND `auth_level === 'MFA'`. Because MFA is introduced in PR 6, these endpoints are explicitly deferred to a post-PR 6 follow-up task. PR 6 does NOT depend on PR 3 or PR 4, and Public HTTPS (PR 7) does not wait for administrative carrier endpoints.
- **Interim Maintenance Runbook**: Before these endpoints are implemented, the administrative Carrier CLI (`dist/cli/carrier-admin.js`) is deferred until after PR 6. Authorized database administrators use reviewed direct SQL maintenance procedures during development.
- **Security Boundary**: Administrators cannot decrypt credentials, reconnect, or invoke carrier APIs on behalf of another user.

### Public HTTPS — PR 7

Deferred deployment work includes TLS ingress, Secure cookie policy, Host/Origin configuration and mandatory ADMIN MFA. Current supported deployment is loopback HTTP; no public profile is implemented by NEXORA-016.

## Contract Generation & Verification

All responses carry server-generated `x-request-id`; HTTP errors contain code/message/requestId and do not expose stack, SQL or credentials. Unknown paths return 404 NOT_FOUND. Swagger is off by default, explicitly enabled via API_DOCS_ENABLED=true.
`contracts:generate` compiles a documentation-only Nest module with the SAME health controller/decorators, never listens and never requires a DB/storage connection, writes OpenAPI then runs openapi-typescript. `packages/sdk` uses openapi-fetch over generated paths; both types and client behavior follow OpenAPI rather than importing API code.
`contracts:check` compares content and the complete generated file set before/after regeneration, then checks Git status including untracked paths when Git/HEAD are available. Both OpenAPI and SDK generators clean only their owned output directories; file-set comparison works without Git in minimal Docker images, and an unexpected new generated file triggers drift. Outputs are committed. Build does not silently regenerate them.
Breaking contract changes require consumer/tests/docs together. Monetary JSON fields in later endpoints are decimal strings.

Login runtime input accepts a JSON object with string `username` and `password`. Username is trimmed, case-sensitive, 3–50 characters; password is nonempty and at most 1024 characters. Null, arrays, invalid types and length violations return `400 VALIDATION_ERROR` before lookup/Scrypt. Origin enforcement and cookie policy are owned by [Configuration](../operations/configuration.md). Successful logout clears the cookie only after revocation; unexpected database failure uses the existing safe `500 INTERNAL_ERROR` envelope. No DTO or generated schema changes are required by these boundary checks.

Published authentication failures reference the existing `ApiErrorDto` JSON schema (`code`, `message`, `requestId`): Login 400/401/403/429, session 401, and Logout 403/500. Generated SDK consumers can inspect these response bodies without escaping generated types. This schema correction changes no runtime statuses, error codes, messages or request ID behavior.
