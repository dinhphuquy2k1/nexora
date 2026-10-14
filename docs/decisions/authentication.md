# ADR-005 · Local Authentication & Session Architecture

**Status**: Accepted (Supersedes initial "Defer authentication" baseline, 2026-10-11)

## Context & Problem Statement

The initial v0.1.0 foundation deferred authentication while establishing runtime container topology and management UI shell. With core layout and contracts stabilized, Nexora requires a secure local authentication mechanism to prevent unauthorized access to management pages and internal APIs, while preserving single-instance, local-first operational characteristics without premature multi-tenancy or external OAuth complexity.

## Decision

1. **Local Identity Scope**:
   - Authentication is strictly local to the single Nexora instance.
   - Credentials represent internal Nexora operator users, never customer IDs, tracking numbers, or external logistics provider API tokens.
   - Initial target is single-user / local operator usage. No public registration, social login, password recovery emails, or MFA in this milestone.

2. **Password Security**:
   - Passwords hashed using Node.js native cryptographic Scrypt (`node:crypto.scrypt`) with per-user cryptographically random 16-byte salt (`crypto.randomBytes(16)`), cost parameters `N=16384`, `r=8`, `p=1`, `maxmem=32MB`, and key length 64 bytes.
   - Formatted and persisted as `$scrypt$N=16384,r=8,p=1$<salt-hex>$<derived-hex>`.
   - Verification uses timing-safe equality (`crypto.timingSafeEqual`).
   - Plaintext passwords and hashes are never logged, echoed, or included in error responses.

3. **Session & Cookie Transport**:
   - Server-side opaque sessions stored in PostgreSQL `sessions` table.
   - The server generates 32-byte cryptographically secure random session tokens (`crypto.randomBytes(32).toString("hex")`).
   - Only the SHA-256 hash (`crypto.createHash("sha256").update(token).digest("hex")`) is stored in PostgreSQL. Compromise of the database does not yield valid session tokens.
   - Sessions carry an explicit expiration timestamp (default: 7 days) and are revocable upon logout.
   - Transported via `nexora_session` HTTP-only cookie (`HttpOnly: true`, `SameSite: Lax`, `Path: /`, `Secure: false` under the supported local HTTP loopback deployment; forwarded headers do not alter the policy. HTTPS hosting is a separate deployment decision).
   - Expired-session cleanup is executed as an isolated best-effort operation preventing unhandled Promise rejections from interrupting backend service stability.
   - State-changing authentication requests (`/api/auth/login`, `/api/auth/logout`) enforce exact trusted Origin verification (`OriginGuard`), using the policy owned by [Configuration](../operations/configuration.md), rejecting missing, malformed, or untrusted browser origins with `403 FORBIDDEN`.
   - Host header allowlist enforcement is executed at the Web ingress boundary (`apps/web/middleware.ts`) across all routes including `/api/*`.

4. **First Account Provisioning**:
   - Local installations provision the first operator account via trusted CLI tooling (compiled `dist/cli/user-create.js`; `pnpm user:create` remains a host wrapper) requiring database configuration and prompting for username and password without echoing secrets, or via explicit `--password-stdin` in non-interactive environments.
   - No hardcoded fallback database URLs, no default credentials, no automatic user creation at startup, and no unauthenticated HTTP bootstrap endpoints.

5. **Access Control & Routing**:
   - Backend enforces default-deny authentication: `SessionGuard` is registered globally as `APP_GUARD`. Only routes explicitly decorated with `@Public()` (`GET /api/health/live`, `GET /api/health/ready`, `POST /api/auth/login`, `POST /api/auth/logout`) bypass session verification.
   - Protected endpoints require a valid session; unauthenticated access yields `401 UNAUTHORIZED`.
   - Stale/malformed session cookie tokens are safely handled as unauthenticated without generating internal server errors.
   - Protected web routes: Next.js workspace routes (`/`, `/system`, `/settings`) redirect unauthenticated requests to `/login?from=<returnUrl>`.
   - Genuine authentication verification is evaluated in the `/login` Server Component before redirecting to prevent redirect loops on invalid cookies.
   - AccountMenu verifies successful server-side revocation prior to client-side navigation.
   - Login rate-limiting: bounded per-account failures (five per five minutes, 128 entries), combined with a process-wide burst of 10, one admission per second refill and four concurrent admissions, returning `429 TOO_MANY_REQUESTS`. See [Backend](../architecture/backend.md) for capacity and saturation policy. Express `trust proxy` is restricted to trusted local network boundaries (`loopback, linklocal, uniquelocal`). Dummy Scrypt hash verification is evaluated on non-existent usernames to mitigate timing discrepancies.

6. **Failure semantics and provisioning boundary**:
   - Runtime credential type/length validation precedes admission and database work. Usernames remain case-sensitive; no identity migration or account merging is introduced.
   - Successful logout means database revocation completed; deletion failures propagate and do not clear cookies. Cleanup of already-expired sessions remains best effort.
   - Server-side session verification accepts only `authenticated: true` with nonempty string user ID/username; malformed HTTP 200 payloads represent unavailable service, never an authenticated fallback identity.
   - The compiled CLI uses one raw terminal reader with hidden password/confirmation, backspace and cancellation/EOF cleanup. Explicit `--password-stdin` is the only piped mode; password arguments are forbidden. Its runtime acceptance is demonstrated only by fresh-install and pseudo-TTY tests, never source inspection alone.

7. **Recovery session boundary**:
   - Application data and operator identities/password hashes persist in PostgreSQL named volumes across container restarts. Custom Backup/Restore subsystem has been retired per ADR-006.
   - Session validation evaluates active database sessions directly; historical restore session invalidation is retired alongside the custom restore subsystem.

ADR-005 continues to define the implemented local authentication and session runtime. The [Unified identity decision](unified-identity.md) extends its future architecture without changing current production behavior. PR #7 is merged; unified storage and local ADMIN credentials are implemented under the unified foundation.

Phase 1 extends storage to users/user_credentials without changing these session/cookie/API policies. Local password Login requires ACTIVE ADMIN with credential. Generic sessions require an ACTIVE user only, irrespective of role and local credentials. See [unified identity](unified-identity.md) and NEXORA-011 for migration verification.

Phase 2 adds `ProviderAuthenticationPort`, `UnishipAuthAdapter`, and `POST /api/auth/provider/login` for employee authentication, alongside frontend mode routing (`/login` for employee, `/login?mode=admin` for local admin). Sessions issued to verified active operators reuse the identical opaque PostgreSQL session tokens, cookie policy, and `SessionGuard` verification without schema alteration. The owner confirmed Uniship API integration authorization on 2026-10-13. Local HTTP mock-provider tests passed under NEXORA-012; real Uniship authentication is not technically verified. `UNISHIP_LIVE_AUTHORIZED` remains a deployment switch, default `false`, which the administrator may explicitly enable under the approved authorization and deployment procedure. It is not a statement that permission is missing. The operator selects the correct `UNISHIP_API_URL`; existing production HTTPS, timeout, redirect rejection, payload validation and token non-persistence remain unchanged.

## Multi-Carrier & MFA Amendment — 2026-10-14

Per [ADR-007](multi-carrier-architecture.md), the authentication and session model is extended as follows:

1. **Unified Local Login & Operator Onboarding (PR 2)**:
   - Provider login (`POST /api/auth/provider/login`) is eliminated in PR 2. Both `ADMIN` and `OPERATOR` use local credentials (`POST /api/auth/login`).
   - Operator onboarding uses single-use setup links: `POST /api/admin/operators` creates the operator account without a password and generates a high-entropy CSPRNG token hash (24h TTL) stored in `operator_setup_tokens`. `POST /api/admin/operators/:id/setup-link` allows ADMIN to reissue an onboarding link for an ACTIVE OPERATOR without credentials, atomically marking all previous unconsumed setup tokens for that user as consumed.
   - The operator consumes the link via `POST /api/auth/setup-password` (`@Public()`, `OriginGuard`) which atomically validates the token, verifies that the user is `ACTIVE` and has NO existing credentials in `user_credentials`, and sets the Scrypt password. If credentials already exist, consumption fails (`400 OPERATOR_ALREADY_CONFIGURED`). Admins cannot view or set operator passwords.
   - Disabling an OPERATOR atomically invalidates all unconsumed setup tokens for that user in the same transaction; reactivation does not restore them.
   - Operations reducing active admins are serialized by a transaction-level PostgreSQL advisory lock (`pg_advisory_xact_lock(hashtext('nexora_active_admin_invariant'))`) acquired before user-row locks, serializing administrative mutations adhering to this protocol and preventing lock-ordering deadlocks and race conditions that could eliminate active administrators.
2. **ADMIN Mandatory TOTP MFA (PR 6)**:
   - All `ADMIN` logins require RFC 6238 TOTP (SHA-1, 6 digits, 30s step).
   - MFA enrollment occurs strictly through interactive server CLI (`pnpm mfa:enroll`); no HTTP enrollment endpoints exist. Password verification, secret generation, and confirmation code entry occur outside database transactions (no row locks held during TTY input). After verification, a short transaction locks the user row, verifies status/role/hash equality, initializes `user_mfa.last_used_step` to the confirmation step (preventing replay), saves recovery code hashes, revokes sessions/challenges, and commits. Recovery codes are displayed once only after commit.
   - Successful password verification produces a short-lived pending MFA challenge (cookie `SameSite: Strict`, `HttpOnly`, 5m TTL).
   - `POST /api/auth/mfa/verify` is explicitly decorated with `@Public()` to bypass global `SessionGuard`, but strictly enforced by `OriginGuard`, valid challenge cookie, account rate limiting, and replay prevention.
   - **Password-Hash Recheck**: Scrypt password verification runs outside the transaction; inside a short transaction, the server locks `users` (`FOR UPDATE`), verifies role/status, and re-checks `user_credentials.password_hash` against the verified hash.
   - **Atomic Challenge Revocation**: Password update, role modification, account disablement, and MFA reset atomically delete all active sessions and pending MFA challenges in the same database transaction.
   - `POST /api/auth/mfa/verify` consumes the challenge atomically and issues a session with `auth_level = 'MFA'`.
   - Single-use recovery codes (≥80-bit CSPRNG, hashed with SHA-256) provide backup access.
   - Database table `sessions` includes `auth_level` (`VARCHAR(16) NOT NULL DEFAULT 'PASSWORD'`).
   - **Milestone Administrative Authorization Policy**:
     - **PR 2 → prior to PR 6**: Local `ADMIN` users with password sessions (`auth_level = 'PASSWORD'`) can access administrative onboarding endpoints (`POST /api/admin/operators`, `POST /api/admin/operators/:id/setup-link`). The backend strictly validates `role === 'ADMIN'` and active session. This interim policy is supported exclusively on local loopback environments; administrative endpoints and login are never exposed to the public Internet without MFA. Does not depend on unreleased MFA components.
     - **From PR 6 onward**: Every administrative endpoint strictly requires `role === 'ADMIN'` AND `auth_level === 'MFA'`. Password-only admin sessions are revoked or rejected. No permanent MFA bypass is retained.
     - **PR 7**: The public HTTPS profile verifies during boot that MFA enforcement is strictly enabled; any attempt to run public administrative endpoints without MFA fails closed. Zero administrative endpoints bypass MFA.
3. **Public HTTPS Release Gate (PR 7)**:
   - ADMIN Internet access is permitted over public HTTPS subject to mandatory TOTP enforcement.
   - The API runtime refuses to boot in public profile if MFA enforcement is disabled.
   - Host clock must be synchronized via NTP (`chrony` or `systemd-timesyncd`), verified by runbook.
