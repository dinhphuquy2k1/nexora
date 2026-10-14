# API contract

## Implemented baseline contracts

| Endpoint                      | Success                                                 | Failure                                                                                                                            | Notes                                                            |
| ----------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| GET /api/health/live          | 200 `{status:"ok"}`                                     | Process unreachable if down                                                                                                        | `@Public()`, infrastructure                                      |
| GET /api/health/ready         | 200 `{status:"ok",checks:{database:true,storage:true}}` | 503 with checks plus `code:"NOT_READY"`, safe message, requestId                                                                   | `@Public()`, infrastructure                                      |
| POST /api/auth/login          | 200 `{user:{id,username}}` + `Set-Cookie` session       | 400 validation error, 401 invalid credentials, 403 invalid origin, 429 rate limit                                                  | `@Public()`, local ADMIN login at baseline                       |
| POST /api/auth/provider/login | 200 `{user:{id,username}}` + `Set-Cookie` session       | 400 validation error, 401 invalid/unregistered/disabled/non-operator, 403 invalid origin, 429 rate limit, 503 provider unavailable | **Scheduled for complete removal in PR 2** (returns 404 in PR 2) |
| GET /api/auth/session         | 200 `{authenticated:true,user:{id,username}}`           | 401 unauthorized if missing or expired session                                                                                     | Session verification                                             |
| POST /api/auth/logout         | 200 `{success:true}` + clears session cookie            | 403 invalid origin, 500 failed database revocation, 200 idempotent logout                                                          | Idempotent revocation                                            |

## Multi-Carrier & MFA Target Contracts (ADR-007)

Under [ADR-007](../decisions/multi-carrier-architecture.md), the API surface is extended across the planned PR milestones. The generated OpenAPI spec and SDK will be updated during each implementation task.

### 1. Authentication & MFA Lifecycle (PR 2 & PR 6)

| Method | Endpoint                   | Target PR | Access                                      | Payload / Request                                              | Success Response                                          | Failure Codes                                                                                            |
| :----- | :------------------------- | :-------- | :------------------------------------------ | :------------------------------------------------------------- | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/auth/login`          | PR 2      | `@Public()`                                 | `{ username, password }`                                       | **OPERATOR**: 200 `{ user }` + `nexora_session` cookie    | 400 `VALIDATION_ERROR`, 401 `AUTHENTICATION_FAILED`, 403 `FORBIDDEN_ORIGIN`, 429 `RATE_LIMITED`          |
|        |                            | PR 6      | `@Public()`                                 | `{ username, password }`                                       | **ADMIN**: 200 `{ mfaRequired: true }` + challenge cookie | 400 `VALIDATION_ERROR`, 401 `AUTHENTICATION_FAILED`, 403 `FORBIDDEN_ORIGIN`, 429 `RATE_LIMITED`          |
| `POST` | `/api/auth/mfa/verify`     | PR 6      | `@Public()` (OriginGuard + Challenge Token) | `{ code }` (TOTP or recovery code) + `nexora_mfa_token` cookie | 200 `{ user }` + `nexora_session` (`auth_level = 'MFA'`)  | 400 `VALIDATION_ERROR`, 401 `INVALID_MFA_CODE`, 403 `FORBIDDEN_ORIGIN`, 429 `RATE_LIMITED`               |
| `POST` | `/api/admin/operators`     | PR 2      | ADMIN only                                  | `{ username }`                                                 | 201 `{ user, setupUrl, expiresAt }`                       | 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 409 `USERNAME_EXISTS`                       |
| `POST` | `/api/auth/setup-password` | PR 2      | `@Public()` (OriginGuard)                   | `{ token, password }`                                          | 200 `{ success: true }`                                   | 400 `VALIDATION_ERROR`, 400 `INVALID_OR_EXPIRED_SETUP_TOKEN`, 403 `FORBIDDEN_ORIGIN`, 429 `RATE_LIMITED` |

- **@Public() & Ingress Defense**: `POST /api/auth/mfa/verify` is explicitly decorated with `@Public()` to bypass the global `SessionGuard`, as unauthenticated callers do not yet possess an active session. It strictly enforces `OriginGuard`, presence and validity of the ephemeral MFA challenge token (`nexora_mfa_token` cookie, `HttpOnly`, `SameSite: Strict`, path `/api/auth/mfa`, TTL 5 minutes), account-level rate limits, and atomic replay protection.
- **Session Assurance**: ADMIN users obtain sessions strictly via `mfa/verify`.
- **Operator Onboarding Lifecycle (PR 2 & PR 7)**:
  - `POST /api/admin/operators`: ADMIN provisions a new OPERATOR user without password. The system generates a high-entropy CSPRNG setup token (≥128 bits entropy) with a 24-hour TTL and stores its SHA-256 hash in `operator_setup_tokens`. Any previous unconsumed setup token for that user is atomically invalidated. Returns the user summary, single-use `setupUrl`, and expiration timestamp. ADMIN cannot view or set operator passwords.
  - `POST /api/auth/setup-password`: Unauthenticated operator presents the token and sets their password (8–1024 characters). Token is consumed atomically (`consumed_at = now()`), user row is locked and verified `ACTIVE`, and password Scrypt hash is persisted to `user_credentials`. Replay attempts fail with `400 INVALID_OR_EXPIRED_SETUP_TOKEN`. Tokens are never logged or echoed in error payloads.

### 2. Carrier Connections Management (PR 3 & PR 4)

Endpoints strictly enforce ownership from the authenticated session (`user_id`). Users cannot access, mutate, or inspect other users' carrier connections. All protected carrier endpoints enforce `401 UNAUTHORIZED` if the caller's session is missing or expired.

| Method   | Endpoint                                 | Target PR | Access        | Payload                                                 | Response                                      | Failure Codes                                                                                                                          |
| :------- | :--------------------------------------- | :-------- | :------------ | :------------------------------------------------------ | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/carriers`                          | PR 3      | Authenticated | None                                                    | 200 `{ carriers: CarrierProviderSummary[] }`  | 401 `UNAUTHORIZED`                                                                                                                     |
| `GET`    | `/api/carrier-connections`               | PR 3      | Authenticated | None                                                    | 200 `{ connections: CarrierConnectionDto[] }` | 401 `UNAUTHORIZED`                                                                                                                     |
| `POST`   | `/api/carrier-connections`               | PR 4      | Authenticated | `{ provider, loginIdentifier?, password, displayName }` | 201 `{ connection: CarrierConnectionDto }`    | 400 `VALIDATION_ERROR`, 400 `CANNOT_CONNECT_CARRIER_ACCOUNT`, 401 `UNAUTHORIZED`, 429 `RATE_LIMITED`, 503 `SERVICE_UNAVAILABLE`        |
| `PATCH`  | `/api/carrier-connections/:id`           | PR 3      | Owner only    | `{ displayName }`                                       | 200 `{ connection: CarrierConnectionDto }`    | 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 404 `NOT_FOUND`                                                                            |
| `POST`   | `/api/carrier-connections/:id/reconnect` | PR 4      | Owner only    | `{ password }`                                          | 200 `{ connection: CarrierConnectionDto }`    | 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`, 401 `PROVIDER_AUTH_FAILED`, 404 `NOT_FOUND`, 429 `RATE_LIMITED`, 503 `SERVICE_UNAVAILABLE` |
| `DELETE` | `/api/carrier-connections/:id`           | PR 3      | Owner only    | None                                                    | 200 `{ success: true }`                       | 401 `UNAUTHORIZED`, 404 `NOT_FOUND`                                                                                                    |

- **Payload Safety**: Connection DTOs expose only metadata (`id, provider, externalAccountId, loginIdentifier, displayName, status, lastVerifiedAt, createdAt`). Plaintext passwords, tokens, nonces, and ciphertexts are never returned.
- **Unified Generic Error Policy (`CANNOT_CONNECT_CARRIER_ACCOUNT`)**: On `POST /api/carrier-connections`, Nexora returns the identical generic error `400 CANNOT_CONNECT_CARRIER_ACCOUNT` ("Không thể kết nối tài khoản này") for BOTH invalid provider credentials and duplicate account linkage (`UNIQUE(provider, external_account_id)`). This completely obscures whether the carrier credentials were valid, whether the carrier account was already linked to another user, or who the existing owner is. Detailed causes (`PROVIDER_AUTH_FAILED` vs `DUPLICATE_EXTERNAL_ACCOUNT`) are recorded strictly in the server-side security audit log.
- **Protected Carrier Endpoints & 401 UNAUTHORIZED**: Every carrier management endpoint requires a valid active Nexora session. Missing, expired, or revoked sessions return `401 UNAUTHORIZED`.
- **Conditional Login Identifier**: `loginIdentifier` is conditional per adapter and nullable at the schema level; providers without username/email credentials (e.g. OAuth/API key) do not require it.
- **Rate Limiting**: `POST /api/carrier-connections` and `reconnect` enforce per-user burst and window limits to prevent credential stuffing attacks against carrier infrastructure.

### 3. Administrative Carrier Management (Deferred Post-PR 6)

| Method   | Endpoint                             | Target PR           | Access      | Functionality                                        | Failure Codes                                        |
| :------- | :----------------------------------- | :------------------ | :---------- | :--------------------------------------------------- | :--------------------------------------------------- |
| `GET`    | `/api/admin/carrier-connections`     | Post-PR 6 Follow-up | ADMIN + MFA | List metadata of all carrier connections in system   | 401 `UNAUTHORIZED`, 403 `FORBIDDEN`                  |
| `DELETE` | `/api/admin/carrier-connections/:id` | Post-PR 6 Follow-up | ADMIN + MFA | Hard-delete connection across users (audit recorded) | 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND` |

- **MFA Precondition & Decoupling**: These administrative carrier endpoints require both `role === 'ADMIN'` AND `auth_level === 'MFA'`. Because MFA is introduced in PR 6, these endpoints are explicitly deferred to a post-PR 6 follow-up task. PR 6 does NOT depend on PR 3 or PR 4, and Public HTTPS (PR 7) does not wait for administrative carrier endpoints.
- **Interim Maintenance Runbook**: Before these endpoints are implemented, cross-user inspection and emergency disconnection are executed via an authorized server-side CLI runbook (`dist/cli/carrier-admin.js`) run directly by system administrators with database credentials.
- **Security Boundary**: Administrators cannot decrypt credentials, reconnect, or invoke carrier APIs on behalf of another user.

## Contract Generation & Verification

All responses carry server-generated `x-request-id`; HTTP errors contain code/message/requestId and do not expose stack, SQL or credentials. Unknown paths return 404 NOT_FOUND. Swagger is off by default, explicitly enabled via API_DOCS_ENABLED=true.
`contracts:generate` compiles a documentation-only Nest module with the SAME health controller/decorators, never listens and never requires a DB/storage connection, writes OpenAPI then runs openapi-typescript. `packages/sdk` uses openapi-fetch over generated paths; both types and client behavior follow OpenAPI rather than importing API code.
`contracts:check` compares content and the complete generated file set before/after regeneration, then checks Git status including untracked paths when Git/HEAD are available. Both OpenAPI and SDK generators clean only their owned output directories; file-set comparison works without Git in minimal Docker images, and an unexpected new generated file triggers drift. Outputs are committed. Build does not silently regenerate them.
Breaking contract changes require consumer/tests/docs together. Monetary JSON fields in later endpoints are decimal strings.

Login runtime input accepts a JSON object with string `username` and `password`. Username is trimmed, case-sensitive, 3–50 characters; password is nonempty and at most 1024 characters. Null, arrays, invalid types and length violations return `400 VALIDATION_ERROR` before lookup/Scrypt. Origin enforcement and cookie policy are owned by [Configuration](../operations/configuration.md). Successful logout clears the cookie only after revocation; unexpected database failure uses the existing safe `500 INTERNAL_ERROR` envelope. No DTO or generated schema changes are required by these boundary checks.

Published authentication failures reference the existing `ApiErrorDto` JSON schema (`code`, `message`, `requestId`): Login 400/401/403/429, session 401, and Logout 403/500. Generated SDK consumers can inspect these response bodies without escaping generated types. This schema correction changes no runtime statuses, error codes, messages or request ID behavior.
