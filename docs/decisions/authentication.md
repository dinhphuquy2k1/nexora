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
   - Transported via `nexora_session` HTTP-only cookie (`HttpOnly: true`, `SameSite: Lax`, `Path: /`, `Secure: false` on local HTTP loopback, `true` when HTTPS).
   - Expired-session cleanup is executed as an isolated best-effort operation preventing unhandled Promise rejections from interrupting backend service stability.
   - State-changing authentication requests (`/api/auth/login`, `/api/auth/logout`) enforce same-origin verification (`OriginGuard`), rejecting missing, malformed, or untrusted browser origins with `403 FORBIDDEN`.
   - Host header allowlist enforcement is executed at the Web ingress boundary (`apps/web/middleware.ts`) across all routes including `/api/*`.

4. **First Account Provisioning**:
   - Local installations provision the first operator account via trusted CLI tooling (`pnpm user:create` / `node scripts/user-create.mjs`) requiring database configuration and prompting for username and password without echoing secrets, or via explicit `--password-stdin` in non-interactive environments.
   - No hardcoded fallback database URLs, no default credentials, no automatic user creation at startup, and no unauthenticated HTTP bootstrap endpoints.

5. **Access Control & Routing**:
   - Backend enforces default-deny authentication: `SessionGuard` is registered globally as `APP_GUARD`. Only routes explicitly decorated with `@Public()` (`GET /api/health/live`, `GET /api/health/ready`, `POST /api/auth/login`, `POST /api/auth/logout`) bypass session verification.
   - Protected endpoints require a valid session; unauthenticated access yields `401 UNAUTHORIZED`.
   - Stale/malformed session cookie tokens are safely handled as unauthenticated without generating internal server errors.
   - Protected web routes: Next.js workspace routes (`/`, `/system`, `/settings`) redirect unauthenticated requests to `/login?from=<returnUrl>`.
   - Genuine authentication verification is evaluated in the `/login` Server Component before redirecting to prevent redirect loops on invalid cookies.
   - AccountMenu verifies successful server-side revocation prior to client-side navigation.
   - Login rate-limiting: in-memory sliding-window rate limiting (max 5 consecutive failures per 5 minutes per IP/user) returning `429 TOO_MANY_REQUESTS` with generic failure messages. Express `trust proxy` is restricted to trusted local network boundaries (`loopback, linklocal, uniquelocal`). Dummy Scrypt hash verification is evaluated on non-existent usernames to mitigate timing discrepancies.
