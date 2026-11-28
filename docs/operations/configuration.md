# Configuration

Compose supplies defaults and three idempotently generated database credentials (administrator, API and Worker), stored in separate dedicated volumes. Never print their contents or commit them. These credentials authenticate only to private PostgreSQL; PUBLIC_HTTPS exposes ingress, never PostgreSQL. Upgrades retain all files and passwords.

| Variable                | Owner / contract                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL            | Server only; API entrypoint always injects nexora_app from runtime secret; migration entrypoint injects nexora from admin secret; never supply admin URL to API                                                                                                                                                                                                                                             |
| STORAGE_ROOT            | API only; canonical absolute root, default /data/uploads in runtime, precreated writable volume                                                                                                                                                                                                                                                                                                             |
| PORT                    | API, 1..65535, default 4000                                                                                                                                                                                                                                                                                                                                                                                 |
| WEB_PORT                | Compose Web binding, default 127.0.0.1:3001; also passed to API for Origin resolution. Supported derived values: bare port or loopback host:port.                                                                                                                                                                                                                                                           |
| POSTGRES_PORT           | Docker Compose development only (`compose.dev.yml`); optional numeric host port for PostgreSQL loopback publishing; default 5432; strictly bound to `127.0.0.1`. Never published in standard release mode (`compose.yml`).                                                                                                                                                                                  |
| NODE_ENV                | development/test/production, runtime production                                                                                                                                                                                                                                                                                                                                                             |
| API_DOCS_ENABLED        | API, explicit true/false, defaults false                                                                                                                                                                                                                                                                                                                                                                    |
| API_INTERNAL_URL        | Next.js server (`lib/api/config.ts`); required origin URL without path/query/fragment; supplied explicitly by Compose (`http://api:4000`) and `.env.example`; no application-level fallback; never NEXT_PUBLIC                                                                                                                                                                                              |
| ALLOWED_HOSTS           | LOCAL Web ingress middleware: optional comma-separated host allowlist (defaults: localhost, 127.0.0.1, 0.0.0.0); forwarded by base/release Compose and inherited by development; absent/empty preserves parser defaults                                                                                                                                                                                     |
| ALLOWED_ORIGINS         | LOCAL API: optional comma-separated exact HTTP(S) origins. Replaces defaults; invalid values fail startup. Without it, trusted HTTP localhost/127.0.0.1 origins derive from WEB_PORT.                                                                                                                                                                                                                       |
| UNISHIP_API_URL         | API and Sync Worker; optional base URL for shared Carrier HTTP client (not wired to authentication) (local mock provider in tests; application default remains unconfigured; `.env.example` actively supplies `https://kh.uniship.vn`). Never exposed to client. Forwarded by Compose (`"${UNISHIP_API_URL:-}"`). Empty string normalizes to `undefined` so omitted configuration never breaks API startup. |
| UNISHIP_LIVE_AUTHORIZED | API and Sync Worker; explicit boolean flag (`true`/`false`, default `false`). External live is hard-closed in PR4 even when true; future reviewed verified authorization evidence plus runtime opt-in is required. Forwarded by Compose (`"${UNISHIP_LIVE_AUTHORIZED:-false}"`).                                                                                                                            |

Swagger is not exposed by default. Config errors fail startup with safe JSON diagnostics. Missing or invalid `API_INTERNAL_URL` fails explicitly at build and startup time with an actionable error. Reference `.env.example` documents environment variables for local inspection. When `UNISHIP_API_URL` is omitted or empty, the API starts normally and ADMIN local login remains fully functional, and both roles use local credentials; the removed provider Login returns 404. Historical 2026-10-13 owner statements are superseded for live readiness by the 2026-10-16 amendment: observed cURL/200 is contract-shape evidence only; official integration/credential-retention/automated-login/quota permission remains UNVERIFIED. `UNISHIP_LIVE_AUTHORIZED` remains an operational enablement switch, default `false`; the flag alone cannot enable external traffic until official evidence is verified in a reviewed change. The operator is responsible for configuring the correct `UNISHIP_API_URL`; existing environment-driven URL behavior remains unchanged, with the existing exact external origin allowlist https://kh.uniship.vn; non-production loopback mocks remain test-only. Production HTTPS, timeout, redirect rejection, payload validation, safe errors and encrypted provider credential persistence still apply. Local mock-provider PASS does not prove real Uniship authentication; live verification remains deferred. Testing against local mock providers uses isolated test endpoints without granting live authorization. Carrier encryption foundation now uses the independent server keyring below; the separate PR4 backend lifecycle uses the keyring; no refresh workflow exists. Identity custody is implemented separately below for mandatory ADMIN MFA.

Browser mutation origins compare scheme, normalized hostname and effective port. Missing/null/multiple origins, credentials, whitespace, paths (including a trailing slash), queries and fragments are rejected. Configuration entries may be comma-separated with surrounding whitespace, but each entry must be an origin. In LOCAL, changing `WEB_PORT=127.0.0.1:3101` automatically trusts only the two loopback HTTP origins on port 3101; container-internal port 3000 is never implicitly trusted as a browser-facing origin. An explicit `ALLOWED_ORIGINS` replaces both defaults, so operators must include every intended browser-facing origin. API startup snapshots this policy; restart after configuration changes. LOCAL Docker and host Web use canonical user-facing port3001; PUBLIC_HTTPS publishes only approved TLS ingress. Docker API remains private.

The default LOCAL deployment is loopback HTTP. Session and clearing cookies use `Secure=false`, `HttpOnly`, `SameSite=Lax`, and `Path=/`; raw forwarded headers and `req.secure` cannot select transport policy. PUBLIC_HTTPS now follows the owner-approved dated profile contract below; actual host release gates remain required.

`.env.example` provides `UNISHIP_API_URL=https://kh.uniship.vn` as an active API **base URL**, not the `/client/api-token-auth/` endpoint path. Copying it to `.env` configures that example destination for Compose while keeping `UNISHIP_LIVE_AUTHORIZED=false`; it does not enable live requests. The deployment administrator must select the correct base URL and may override it via the environment. No provider credential/token belongs in the example. Omitting or emptying the URL has no effect on Nexora local login or sessions.

The Web package's `pnpm dev` and `pnpm start` share `scripts/lib/launch-next.mjs`: HOST defaults to `0.0.0.0`, and PORT defaults to 3001 only when absent. An explicitly empty PORT is invalid. Ports must be decimal integers 1–65535; suffixes, signs, fractions and whitespace are rejected. This PORT is the actual Next.js listener, distinct from Compose's WEB_PORT binding: Docker development explicitly supplies internal PORT 3000 while the published loopback port defaults to 3001. Docker release retains its existing direct Next.js CLI invocation and internal listener configuration.

In Docker development mode (`compose.dev.yml`), PostgreSQL automatically publishes host port `127.0.0.1:5432` for local database inspection tools (e.g. DBeaver, pgAdmin). The host address is permanently fixed to `127.0.0.1` in Compose configuration and cannot be bound to external network interfaces. `POSTGRES_PORT` modifies only the numeric host port (e.g. `5433`). In standard release mode (`compose.yml`), PostgreSQL has no published host port, and database traffic remains strictly internal to Docker bridge networking.

## Carrier key custody — owner-approved PR3 contract

- CARRIER_KEYRING_JSON: API/Sync-Worker server-only JSON object mapping canonical positive integer versions (1..2147483647) to canonical padded base64 encoding of exactly 32 random bytes each. Example SHAPE only: `{"1":"<canonical-base64-of-32-random-bytes>"}`; this placeholder is deliberately invalid and must never be used as a key.
- CARRIER_ACTIVE_KEY_VERSION: canonical positive integer selecting an existing keyring entry. No default, auto-generation or fallback key exists.

Provide dedicated Carrier keys through the deployment environment using secure operator tooling; never place raw keys in committed files, shell command arguments/history, browser variables, SDK, logs or API responses. Identity keys must be independently generated and separately managed. `.env.example` has commented placeholders only. Docker API and Sync Worker receive the same Carrier variables at runtime; Web/build/migrate do not. EnvironmentKeyring snapshots them and validates only when encryption/decryption is requested: missing/invalid config, unavailable version or corrupt encrypted data fails closed with a generic error. Local Login, user administration and metadata APIs stay available. No connection status or ciphertext is changed by a crypto error.

For non-destructive version activation: securely add the new independent 32-byte key at a previously unused version, KEEP all existing entries unchanged, change active version, drain and restart API and Worker together. New writes use active version; old records use stored key_version. Never reuse a version for different bytes. Inventory references with authorized SQL `SELECT key_version,count(*) FROM carrier_connection_secrets GROUP BY key_version;` before any custody change. PR3 offers no deletion or re-encryption command and never automatically removes referenced old keys. Keep old keys securely retained; missing keys make old data unreadable. Full re-encryption and retirement require a separately reviewed follow-up; PR4 adds audited lazy password re-login. No external secret-management service is added.

### PR4 mock-only live gate — NEXORA-018

The owner-observed verify request/response does not establish official Uniship API, credential-retention or automated re-login permission. External transport is therefore hard-closed in PR4, including when UNISHIP_LIVE_AUTHORIZED=true. The default remains false. Loopback mocks are permitted only with the existing production HTTPS requirement. A future reviewed authorization-evidence change is required before runtime opt-in can enable live traffic; the flag alone currently cannot do so. Invalid URL credentials/query/fragment, redirects, timeout and responses exceeding 64 KiB fail closed; token length is bounded to 16 KiB. These limits are Nexora safety bounds.

PR4 requires all eight migrations before API start; stop API/Web/provisioning writers during deployment. Existing credentials retain their key versions. Audit storage is PostgreSQL with approved append-only triggers, not an optional environment sink; there is no audit-disabled or noop mode. Provider timeout defaults 5s, response ceiling 64 KiB and token ceiling 16 KiB. Nexora safety limits are user 5/minute with 1024 bounded identities, provider 2 concurrent acquisitions, recovery 128 flights, backoff 1s doubling to 60s, Retry-After capped 5min. These are per-instance safeguards, not provider quotas or distributed locking. Unknown token expiry remains null; expiry/rejection recovery is lazy, with one re-login/retry at most and no background timer. These knobs are fixed internal policy in this milestone, not new configuration variables.

## Database credential custody — NEXORA-019

Existing credentials:/config/postgres_password is the admin secret and is never regenerated on upgrade. New runtime_credentials:/runtime-config/postgres_app_password is generated once by trusted init, 32 CSPRNG bytes encoded as64 hex characters, mode0600. API receives only the latter read-only; Web receives neither, and no database password is in Compose environment, build arguments, source or command-line arguments. The two entrypoints read their respective file and construct DATABASE_URL only in process memory. Missing/invalid runtime configuration stops API; no admin fallback exists.

Only trusted init and db-runtime receive both volumes. Migration receives admin only. The profile-gated quality runner is test-only and may receive both for disposable database fixtures. Role provisioning suppresses PostgreSQL session SQL/error-statement logging before password DDL and emits fixed sanitized diagnostics. Existing secrets are preserved across restarts/down-up; manual replacement requires coordinated administrator custody work, not deleting volumes. Carrier encryption keys remain independent and unchanged.

## Identity key custody — owner-approved PR6 contract (2026-10-16)

IDENTITY_KEYRING_JSON is a server-only JSON map of canonical positive versions1..2147483647 to canonical padded base64 of exactly32 independently generated random bytes; IDENTITY_ACTIVE_KEY_VERSION selects an existing version. Operators supply both securely for API and its trusted CLI. Never reuse Carrier keys, assign a different key to an old version, commit values, put them in argv/history, build arguments, NEXT_PUBLIC variables, Web, logs or SDK. There is no default/automatic substitute. Commented .env.example placeholders are intentionally invalid. Keep secure custody outside the container and retain the same keys across restarts/rebuilds.

The shared EnvironmentKeyring snapshots configuration under the explicit IDENTITY namespace; encryption/decryption validates lazily. TOTP uses AES256GCM/HKDFSHA256, salt NEXORA_IDENTITY_V1, purpose IDENTITY_TOTP, exact AAD v1:<user UUID>:IDENTITY_TOTP; nonce12bytes/tag16bytes and canonical base64 metadata plus key_version are persisted. Missing/wrong keys fail enrollment/TOTP closed without modifying ciphertext or issuing a session. OPERATOR login remains independent. Recovery codes are an explicit alternative factor verified by their hashes, not a silent fallback after crypto failure.

Rotation is staged custody only: securely add a fresh version, retain all previous entries unchanged, select the new active version and restart API/CLI. New enrollment uses active version, reads use stored version. Inventory with authorized SQL SELECT key_version,count(\*) FROM user_mfa GROUP BY key_version. No automatic re-encryption, key deletion, MFA reset or re-enrollment overwrite is approved. Lost keys require custody restoration; a working recovery code is single-use authentication, not permission to reset MFA. Any future reset/retirement procedure needs separate review. Never broaden runtime DB privileges to repair custody.

## Public HTTPS profile — NEXORA-024, 2026-10-17

The owner approved a Linux Docker Compose host with Nginx TLS/rate limiting and separate Certbot HTTP-01 issuance/renewal. No actual domain or deployment host has been supplied. Application/CI HTTPS verification is distinct from production DNS, certificate, firewall and host NTP readiness.

| Variable                  | Contract                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEXORA_DEPLOYMENT_PROFILE | LOCAL default or PUBLIC_HTTPS only; not selected by NODE_ENV. Invalid/empty values fail closed.                                                                                                                                                                                                                                        |
| PUBLIC_ORIGIN             | PUBLIC_HTTPS requires one canonical HTTPS origin, no path/trailing slash/credentials/query/fragment, using an explicit DNS FQDN. No local/IP shortcut. Used for redirects and absolute setup URLs.                                                                                                                                     |
| ALLOWED_HOSTS             | PUBLIC_HTTPS requires comma-separated exact FQDN authorities with allowed ports. No wildcard, loopback, malformed/ambiguous authority or implicit local hosts. Default443 normalizes; nonstandard ports remain explicit. LOCAL retains approved loopback/default/custom hostname behavior with stricter malformed-authority rejection. |
| ALLOWED_ORIGINS           | PUBLIC_HTTPS requires explicit exact HTTPS origins, including PUBLIC_ORIGIN; their authorities must be in ALLOWED_HOSTS. No HTTP/local default fallback. Existing strict OriginGuard remains mandatory.                                                                                                                                |
| TRUSTED_PROXY_CIDRS       | API PUBLIC_HTTPS requires explicit IPv4/IPv6 CIDRs, prefix24..32 or64..128; empty, malformed, zero/broad prefixes rejected. Approved Compose supplies the Web backend and ingress addresses as /32. LOCAL retains existing loopback/linklocal/uniquelocal trust.                                                                       |
| PUBLIC_FQDN               | Approved ingress/certificate DNS name, consistent with PUBLIC_ORIGIN authority; no untrusted request value.                                                                                                                                                                                                                            |
| PUBLIC_INGRESS_SUBNET     | Docker ingress network; default172.30.10.0/24. Operator must verify no host/VPN/network overlap.                                                                                                                                                                                                                                       |
| PUBLIC_BACKEND_SUBNET     | Internal Docker backend; default172.30.11.0/24; must not overlap ingress/host/VPN networks.                                                                                                                                                                                                                                            |
| PUBLIC_INGRESS_IPV4       | Nginx address on ingress network; default172.30.10.2.                                                                                                                                                                                                                                                                                  |
| PUBLIC_WEB_FRONTEND_IPV4  | Web ingress-side address; default172.30.10.3.                                                                                                                                                                                                                                                                                          |
| PUBLIC_WEB_BACKEND_IPV4   | Web backend/API-proxy address; default172.30.11.3.                                                                                                                                                                                                                                                                                     |
| PUBLIC_API_IPV4           | API backend address; default172.30.11.4.                                                                                                                                                                                                                                                                                               |

Profile policy is a pure shared module because both API and Web consume the same authority/origin normalization. No secrets are shared with Web. Public Swagger is rejected; certificates/TLS are enforced by Nginx rather than a fake environment flag. Public API refuses to listen if actual registered global guards, assurance checks, restricted runtime role, nonempty ACTIVE ADMIN population, local credentials, enrollment or authenticated Identity ciphertext/key custody cannot be checked. Active key configuration is validated even if only old key versions are stored. LOCAL keeps lazy key validation and OPERATOR independence.

Cookie policy selects Secure solely from the validated deployment profile. Every set/clear operation uses the same HttpOnly/Path/SameSite identification: session Lax / and pending Strict /api/auth/mfa. No forwarding header, Host or req.secure can downgrade it. TTL and separate cancel/logout semantics remain unchanged. PUBLIC_HTTPS is never silently downgraded to LOCAL.

Nginx uses actual socket client addresses for instance-local rate limiting, overwrites X-Forwarded-For/Proto/Host/Port/Real-IP and drops Forwarded. Counters are10MiB bounded shared memory,6 requests/second per source with20 immediate burst for sensitive POST auth and POST/PATCH/DELETE admin routes. Health/unrelated routes are exempt. Shared NATs still share a budget; generous burst supplements existing independent account/global application admission, not a distributed guarantee. Ingress429 uses a safe code/message/requestId envelope and no-store; no request bodies/cookies/URI access logs. Do not add a CDN/load balancer without re-reviewing real-IP attribution and proxy/firewall trust.

The supplied Nginx profile serves one canonical PUBLIC_FQDN/certificate authority. Additional app allowlist aliases are not automatically exposed by ingress; adding DNS/certificate/server aliases requires an explicit matching reviewed ingress configuration.

Public TLS1.2 permits only ECDHE AEAD AES-GCM/ChaCha20 suites (no static RSA exchange or CBC); TLS1.3 uses the current library suites. Disposable certificate replacement/reload verification is separate from actual Certbot renewal on a production host.

Nginx normalizes operator FQDN/origin case and removes explicit default443 before rendering its canonical authority and redirect. Both bare canonical Host and explicit :443 are accepted for the default TLS port; alternate configured ports remain exact. The portable entrypoint policy rejects mismatched FQDN, non-HTTPS origin and malformed/ambiguous/zero/out-of-range ports before template substitution.

## Sync V1 flags and custody — NEXORA-034

SYNC_ENABLED is the sole Sync feature switch, defaults false and accepts exactly
true/false. Availability requires this global switch and a compatible registered
provider/type capability, shared by API and worker. Per-type environment feature
switches are retired; no list of enabled types is built from ENV. A stored enabled
schedule is not provider authorization or executable capability registration. SYNC_LEASE_SECONDS(default60,max300), SYNC_POLL_MS
(default1000,max60000), SYNC_MAX_ATTEMPTS(default5,max20) are positive bounded
integers. Optional SYNC_RESOLVED_RETENTION_DAYS has no default and accepts1..36500;
without an approved configured retention duration no payload cleanup runs.
Unresolved review/retry payloads are not automatically removed. Jobs/identity/
provenance have no automatic deletion policy in V1.

Trusted init creates sync_credentials:/sync-config/postgres_sync_password once
with32 random bytes as64 hex, mode0600, never rotating existing secrets. Only init,
db-runtime and sync-worker mount it; worker constructs nexora_sync DATABASE_URL
in memory and has no administrator fallback. API retains its independent runtime
file and no worker password. Worker receives the Carrier keyring for the controlled shared runtime, never Identity
keys. Production fetch remains blocked by the immutable live gate.

## Carrier onboarding schedules — NEXORA-056

A newly created Uniship connection receives one enabled SHIPMENT schedule at60
minutes, first due exactly its database created_at+60minutes. Connection, encrypted
secrets, schedule and success audit commit together. No job is created on connect;
no legacy backfill occurs. Reconnect preserves schedules and watermark history.
Unknown providers receive no Uniship default. GET sync-configs returns persisted
intent independently of runtime available; runtime capability availability follows controlled activation, independent of persisted intent.

AUTO scheduling requires enabled/due configuration, ACTIVE/CONNECTED ownership,
global Sync enabled and exact capability, with no active lane. Missed intervals
coalesce into one job and existing completion-based scheduling remains. MANUAL
admission does not require enabled/due schedule. Existing PATCH intervals
15/30/60/120/240 remain unchanged; default60 is not a new global minimum. Future
provider-specific activation limits require their own reviewed verification.
Technical tuning and all credential mounts/privileges above remain unchanged.

## Controlled activation configuration — NEXORA-058

UNISHIP_ACTIVATION_POLICY_JSON is blank/absent-OFF, maximum4096 characters, with exactly
ownerUserId (UUID), externalAccountId (positive decimal string), loginIdentifier
(nonempty, already trimmed), mode MANUAL_ONLY or AUTOMATIC, optional connectionId
(UUID). Unknown keys/malformed values fail startup with fixed sanitized errors; never
put passwords/tokens here, and never hardcode real account values into source, fixtures,
`.env.example`, or public docs. Account-scoped activation remains canonical (no refactor
to provider-level activation); initial `MANUAL_ONLY` deployment omits `connectionId` until
the owner creates the connection via the Carrier UI. It gates scope independently of
persisted schedule intent. No account ID or automatic production activation is shipped.

UNISHIP_RECONCILIATION_POLICY_JSON is optional, exact integer keys maxNewlyMissing
(0..2147483647), maxMissingRatioBps and maxObservedDropRatioBps (0..10000). Blank means
no hide/restore; nonempty invalid JSON is a startup error, never silent fallback.
Owner supplies thresholds only after separate gates. API and Worker use the same
parsers and require homogeneous values/Carrier key versions before restart.

Compose/release Worker receives UNISHIP_API_URL, UNISHIP_LIVE_AUTHORIZED, Carrier
keyring/version and both JSON settings, but no Identity keys/storage/admin mount.
The immutable live contract gate remains false. Neither JSON nor live-authorized ENV
can bypass it, and pre-live environments should retain `UNISHIP_LIVE_AUTHORIZED=false`
until external prerequisites close. NEXORA-067 resolves the earlier066 empty-policy
PLAN ISSUE: shared API/Worker construction derives internal activationConfigured
only from successfully parsed activation policy. It defaultsfalse on direct HTTP
client construction and joins live opt-in and the hard contract gate inside the
same target() used by availability and actual POST/GET dispatch. No new ENV/parser
or URL classifier exists. This proves policy presence only; existing outbound
context still checks owner/login/optional connection/stored account, and verified
candidate account is checked before encryption/persistence. Reconnect checks before
claim. Interactive Carrier permission is independent of SYNC_ENABLED; SyncOFF does
not authorize external requests or disable an otherwise permitted Carrier flow.

The hard gate remains false in067 because remaining canonical live-contract,
exposure-invalidation and explicit gate-opening evidence is not established. After
those are satisfied in a reviewed change, first connection config uses the private
MANUAL_ONLY account scope (no predeclared connectionId), SYNC_ENABLED=false and no
reconciliation policy; runtime opt-in remains defaultfalse in templates. No current
external connectivity/live verification is claimed.
Completion-spaced HTTP permits are shared in PostgreSQL; the existing
acquisition slots remain separate safeguards, not an official provider quota.

## Strict development environment and shared runtime settings — NEXORA-058 v3

API and Worker share all five Sync variables and the six Carrier/Uniship variables
in standard, development and release templates. Compose anchors preserve exact
nonempty values (including invalid values for fail-closed parser rejection). Its
`:-` semantics resolve absent/empty SYNC_ENABLED=false, SYNC_LEASE_SECONDS=60,
SYNC_POLL_MS=1000, SYNC_MAX_ATTEMPTS=5; retention remains empty with no cleanup.
Host-native parser semantics remain stricter: explicit empty enabled/tuning is invalid,
while absent tuning defaults and absent/empty retention disables cleanup.

Turbo remains in strict environment mode. NEXORA-065 extends @nexora/api#dev to
exactly17 task-scoped pass-through names: IDENTITY_KEYRING_JSON,
IDENTITY_ACTIVE_KEY_VERSION, CARRIER_KEYRING_JSON, CARRIER_ACTIVE_KEY_VERSION,
UNISHIP_API_URL, UNISHIP_LIVE_AUTHORIZED, UNISHIP_ACTIVATION_POLICY_JSON,
UNISHIP_RECONCILIATION_POLICY_JSON, SYNC_ENABLED, SYNC_LEASE_SECONDS, SYNC_POLL_MS,
SYNC_MAX_ATTEMPTS, SYNC_RESOLVED_RETENTION_DAYS, WEB_PORT, ALLOWED_ORIGINS,
TSC_WATCHFILE and TSC_WATCHDIRECTORY. Identity and Origin settings must reach the
actual HTTP server child, not merely its container or direct CLI. Shared/database
dev receive only the two watch settings. Keys are not globalEnv, build/cache inputs,
Web or SDK environment. Identity custody remains API/authorized CLI only; Worker
retains only the unchanged Carrier/Uniship/Sync settings, never Identity keys.

Base/release Web forwards ALLOWED_HOSTS and development inherits it; absent/empty
resolves to an empty ENV value and the existing LOCAL parser defaults, not an empty
allowlist. Explicit custom hostname lists replace defaults, so include intended
loopback hosts for health/client access. API WEB_PORT/ALLOWED_ORIGINS forwarding is
unchanged in Compose, now retained through strict Turbo. Blank ALLOWED_ORIGINS
uses derived loopback browser origins at WEB_PORT; an explicit list replaces those
defaults. Internal Web3000 is never inferred as a browser Origin. PUBLIC_HTTPS still
requires explicit approved Host/Origin settings; LOCAL defaults cannot replace them.

For host-native Turbo, supply values securely in its parent environment; Turbo does
not load .env. Restart development processes after Turbo/config changes; recreate
Compose containers for changed environment. A container restart cannot import new
parent ENV. Preserve DB/key material and MFA enrollment; this fix never requires
rotation, reset or re-enrollment.

## Owner authorization and existing custody

[Project policy](../ai/PROJECT_RULES.md#explicit-owner-authorization-for-backup-and-restore) prohibits copying/archiving ENV, credentials or keyrings without a specific owner request. Existing custody, retained key versions, restricted secret mounts and non-rotation requirements remain mandatory; they do not authorize backup copies. Missing backups are not configuration/deployment blockers.
