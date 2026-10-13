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
   - A restored instance preserves recoverable data and operator identities/password hashes, but never retains an authentication session issued before restoration.
   - Target dump restoration precedes committed migration deployment; only then are all target sessions deleted, before application availability. Source sessions are not touched.
   - Historical foundation backups have no account assumptions; migration plus explicit CLI provisioning provides recovery. See [Backup and restore](../operations/backup-restore.md) for isolation, ordering and failure behavior.

ADR-005 continues to define the implemented local authentication and session runtime. The [Unified identity decision](unified-identity.md) extends its future architecture without changing current production behavior. PR #7 is merged; unified storage and local ADMIN credentials are implemented under the unified foundation.

Phase 1 extends storage to users/user_credentials without changing these session/cookie/API policies. Local password Login requires ACTIVE ADMIN with credential. Generic sessions require an ACTIVE user only, irrespective of role and local credentials. See [unified identity](unified-identity.md) and NEXORA-011 for migration verification.

Phase 2 adds `ProviderAuthenticationPort`, `UnishipAuthAdapter`, and `POST /api/auth/provider/login` for employee authentication, alongside frontend mode routing (`/login` for employee, `/login?mode=admin` for local admin). Sessions issued to verified active operators reuse the identical opaque PostgreSQL session tokens, cookie policy, and `SessionGuard` verification without schema alteration. The owner confirmed Uniship API integration authorization on 2026-10-13. Local HTTP mock-provider tests passed under NEXORA-012; real Uniship authentication is not technically verified. `UNISHIP_LIVE_AUTHORIZED` remains a deployment switch, default `false`, which the administrator may explicitly enable under the approved authorization and deployment procedure. It is not a statement that permission is missing. The operator selects the correct `UNISHIP_API_URL`; existing production HTTPS, timeout, redirect rejection, payload validation and token non-persistence remain unchanged.
