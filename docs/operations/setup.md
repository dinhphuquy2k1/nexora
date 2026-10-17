# Setup

## Supported Runtime Modes

Nexora operates under three distinct runtime topologies:

### Mode A: Docker Local Release (Canonical & Recommended)

- **Start**: `docker compose up --build -d --wait` (builds images, starts containers in background, and waits for health checks to pass).
- **Access**: Open `http://127.0.0.1:3001` in the browser (configurable via `WEB_PORT`).
- **Network Topology**: Browser connects to Web on loopback `127.0.0.1:3001`. Next.js proxies `/api/*` requests internally to `http://api:4000`. API and PostgreSQL services are private to Docker bridge networking and intentionally NOT published to the host in standard release mode.
- **Stop**: `docker compose down`. All named volumes (database, credentials, runtime_credentials, uploads) persist; never use `-v` unless intentionally destroying data.

### Mode B: Docker Development

- **Start**: `docker compose -f compose.yml -f compose.dev.yml up --build`.
- **Characteristics**: Reuses Docker service networking (`http://api:4000`), mounts local source into containers, and runs watchers inside Docker. Containerized Next.js listens internally on port 3000 and publishes user-facing port `http://127.0.0.1:3001`. In development mode, PostgreSQL automatically publishes loopback port `127.0.0.1:5432` to the host by default (numeric port configurable via `POSTGRES_PORT`, always bound to `127.0.0.1`), allowing direct inspection by local database tools like DBeaver or pgAdmin.
- **Stop**: `docker compose -f compose.yml -f compose.dev.yml down`. Always use the same file combination to stop development containers.

### Mode C: Host-run Development (Optional / Constrained)

- **Requirements**: Node .nvmrc (24.19.0), pnpm 10.34.6; `pnpm install --frozen-lockfile`, `pnpm --filter @nexora/database generate`, `pnpm build`.
- **Port Policy & Collision Prevention**: `pnpm --filter @nexora/web dev` runs `scripts/dev.mjs`, which defaults to the canonical browser-facing port 3001 (or `PORT` env var). If port 3001 is already bound (e.g. Docker Web is active), the preflight refuses startup with an explicit `EADDRINUSE` error instead of silently switching to port 3002. Never run host Web and Docker Web simultaneously on port 3001.
- **API Configuration**: Next.js does not provide an implicit fallback for `API_INTERNAL_URL`. If unconfigured, build and startup fail explicitly with an actionable error. Because Docker does not publish the internal API port to the host, pointing host Next.js to `http://api:4000` fails with `getaddrinfo ENOTFOUND api`. Host-run Web requires an independently reachable host API listener and explicit configuration: `API_INTERNAL_URL=http://127.0.0.1:4000 pnpm --filter @nexora/web dev`. For standard local work, Docker Mode A or B is recommended.

## Initial ADMIN Account Provisioning

Fresh installations contain no default credentials or demo accounts. The trusted user-create command provisions ADMIN; from PR6 this account must complete CLI MFA enrollment before its first HTTP login (see the mandatory MFA rollout below). OPERATOR accounts use the existing administrative setup-link flow. The authoritative implementation is compiled with API; host tooling remains `pnpm user:create` after building API and securely supplying `DATABASE_URL`.

The compiled runtime invocation below passed fresh-install provisioning and pseudo-TTY checks in hosted run `38202165584` at commit `de73dca550b7a07e0e99697c00bae570634e5df9` (see NEXORA-009). The previous repository-script path is unavailable in that image and must not be used:

```sh
docker compose exec api sh /scripts/api-entrypoint.sh node dist/cli/user-create.js
```

It uses the image's non-root user and the approved entrypoint for database configuration. Interactive username/password/confirmation use a single raw terminal reader, with no password rendering; backspace, Ctrl+C and EOF restore terminal mode. Provisioning enforces case-sensitive, trimmed usernames of 3–50 characters and passwords of 8–1024 characters. Duplicate usernames and failures exit nonzero with sanitized diagnostics.

Automation must explicitly select password stdin; never put a password in command-line arguments or implicitly pipe it:

```sh
printf '%s' "$ADMIN_PASS" | docker compose exec -T api sh /scripts/api-entrypoint.sh node dist/cli/user-create.js --username admin --password-stdin
```

A changed supported `WEB_PORT` is passed into API Origin resolution automatically. An explicit `ALLOWED_ORIGINS` replaces derived defaults; see [Configuration](configuration.md). Docker mode keeps API/PostgreSQL private; browser-facing port 3001 connects to the Web container listener (internal container port 3000). ADMIN and OPERATOR authenticate using local Nexora credentials through `POST /api/auth/login`. The removed `/api/auth/provider/login` route always returns 404, independently of Uniship configuration. Compose retains `UNISHIP_API_URL` and `UNISHIP_LIVE_AUTHORIZED` only for the independent Carrier HTTP client and later Carrier milestones; no provider client is wired into authentication. Leave live authorization false during ordinary startup/tests. Local mock transport tests do not establish live Uniship verification.

## Windows Developer Experience & Troubleshooting

When developing on Windows, confusing port collisions or DNS resolution errors can occur:

### Investigating Listening Ports

Use safe PowerShell commands to identify which processes own port 3001 (canonical browser endpoint / Docker Web) or internal container ports:

```powershell
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess
```

Inspect the process before stopping it; do not force-kill based on port alone:

```powershell
Get-Process -Id <OwningProcess>
```

### Refreshing Stale Docker Containers

If Docker containers run an older revision or migrations were not yet applied, rebuild and restart without destroying data volumes:

```powershell
docker compose up --build -d
```

Never run `docker compose down -v`, `docker volume rm`, or reset database volumes to resolve runtime errors.

### Cloud Proxy & Build Requirements

Docker Engine 24+ with Compose v2.22.0+ (BuildKit enabled) and Linux containers is required for BuildKit named contexts (`service:<name>`). First install requires Internet. Estimated minimum: 4 CPU, 8 GB RAM, 20 GB free disk. Cloud proxy installations may supply platform CA as BuildKit secret `build_ca`.

| Platform               | Status                       |
| ---------------------- | ---------------------------- |
| Windows Docker Desktop | Supported via Docker Compose |
| Linux Docker Engine    | Supported via Docker Compose |
| macOS Docker Desktop   | Supported via Docker Compose |

For offline Docker dependency preparation, an optional named build context `dependency-cache` may contain `pnpm-cache.tar` created from a pnpm store that passed `pnpm store status`. Default scratch context is empty and performs a normal frozen online install.

## Connecting Local Database Clients (DBeaver / pgAdmin)

For local development inspections, schema reviews, and manual SQL queries:

1. **Start development mode**:

   ```sh
   docker compose -f compose.yml -f compose.dev.yml up --build -d
   ```

   In Mode B (Docker Development), PostgreSQL automatically publishes port `127.0.0.1:5432` to the host. The host binding is permanently pinned to loopback (`127.0.0.1`) in `compose.dev.yml` and cannot be exposed to external network interfaces. The port number can be customized via numeric `POSTGRES_PORT` (e.g. `POSTGRES_PORT=5433` in `.env`). In standard release mode (`compose.yml`), PostgreSQL remains private and unpublished.

2. **Retrieve the generated database password securely**:
   Passwords are generated once per environment during container initialization and stored in the isolated credentials volume (`credentials:/config/postgres_password`).

   > [!WARNING]
   > **Secret Exposure & Clipboard Security**: Retrieving credentials reveals a real database secret. Never execute commands that print passwords in shared terminals, recorded sessions, video presentations, or CI logs.
   > The clipboard temporarily stores this plaintext secret. When using clipboard copy:
   >
   > - Avoid clipboard history features and cross-device clipboard synchronization if enabled.
   > - Never paste the secret into chat messages, issue comments, screenshots, or code comments.
   > - Clear your clipboard immediately after entering the password into your database client (e.g. Windows PowerShell: `Clear-Clipboard`, macOS: `pbcopy < /dev/null`, Linux: `xclip -selection clipboard /dev/null`).
   > - Use your database client's native secure password storage (e.g. OS keychain) if persisting the connection locally.

   To avoid exposing the password in terminal history, copy it directly to your system clipboard:
   - **Windows (PowerShell)**:
     ```powershell
     docker compose exec -T postgres cat /config/postgres_password | Set-Clipboard
     ```
   - **macOS**:
     ```sh
     docker compose exec -T postgres cat /config/postgres_password | pbcopy
     ```
   - **Linux (xclip)**:
     ```sh
     docker compose exec -T postgres cat /config/postgres_password | xclip -selection clipboard
     ```
     If clipboard tools are unavailable, print it strictly in a private terminal:

   ```sh
   docker compose exec postgres cat /config/postgres_password
   ```

3. **Configure the client**:
   - **Host**: `127.0.0.1` (or `localhost`)
   - **Port**: `5432` (or configured numeric `POSTGRES_PORT`)
   - **Database**: `nexora`
   - **Username**: `nexora`
   - **Password**: _(retrieved from step 2)_

4. **Persistence & Data Safety**:
   PostgreSQL data is stored in the Docker named volume `postgres` (`nexora_postgres`). Running `docker compose down` retains all database state. Never use `-v` unless you intend to permanently delete local data. Custom backup/restore scripts have been retired under ADR-006 in favor of native volume persistence.

## Unified identity upgrade

Unified identity storage and local ADMIN provisioning are implemented; follow NEXORA-011 verification evidence before upgrading. The verified baseline, migration prerequisites and execution evidence are tracked in [NEXORA-011](../tasks/completed/NEXORA-011-unified-identity-migration.md).

For identity upgrades, stop API/Web and external provisioning writers, retain PostgreSQL/credential/upload volumes, and use the reviewed matching release's migrate service then the matching db-runtime provisioning job before bringing application writers back. Do not start old images against migrated schema.

## Uniship configuration example and Web launchers

Copy `.env.example` to `.env` when using the provided configuration example. It contains an active Uniship API base URL `https://kh.uniship.vn` and keeps `UNISHIP_LIVE_AUTHORIZED=false`. The administrator is responsible for the correct base URL; supply no login endpoint path, provider password or token. Environment variables can override the example. API integration permission is owner-confirmed; explicitly enabling the deployment switch is separate from real-provider technical verification, which remains deferred. Removing or emptying the URL has no effect on Nexora Login for either role. The retained Carrier client is not connected to identity.

The existing `pnpm --filter @nexora/web dev` / `start` commands delegate to one shared launcher. Dev retains `next dev --webpack`; start retains `next start`. Absent PORT defaults to host-facing 3001; an empty/malformed/out-of-range PORT exits nonzero before spawning Next.js. A collision exits nonzero with instructions and never stops the existing listener or selects another port. Preflight does not eliminate a later binding race: the actual child failure still propagates. SIGINT, SIGTERM and SIGHUP are forwarded to the child; the launcher waits for child closure and returns 128 plus the signal number for signal termination. Normal child exit codes are preserved and spawn errors fail safely. Docker development keeps its explicit internal listener on 3000; Docker release keeps its direct Next.js invocation and existing port mapping.

## Local OPERATOR onboarding and optional cleanup

Use the trusted local ADMIN CLI to provision an administrator, then log in through the single Nexora form. ADMIN creates an OPERATOR via `POST /api/admin/operators` and delivers its one-time fragment setup link privately. Never choose or request the operator password. Reissue only for ACTIVE, unconfigured operators. Do not enable live Uniship calls for login; there is no provider login route. Earlier provider registration instructions are historical and no longer supported.

`scripts/sql/cleanup-dev-operators.sql` is optional and never applied automatically to an installation. CI exercises the actual file only in a disposable fixture database. Inspect with `psql -X -v ON_ERROR_STOP=1 -v deployment_env=development -v expected_database=nexora_dev_example -v username_prefix=test_example -f scripts/sql/cleanup-dev-operators.sql`. Default is dry-run. It checks the current database name, development/test naming and explicit test prefix; it excludes ADMIN and users with credentials. Actual deletion additionally requires `-v dry_run=false -v confirmation=DELETE_TEST_OPERATORS`. Use only an explicitly owned disposable development database; never reset volumes. Existing credentialless operators may instead be retained and onboarded.

## Required PR 2 session cutover upgrade

Stop API/Web and external provisioning writers, retain PostgreSQL/credentials/uploads volumes, then run the matching release migrate service before starting new writers. New migration `20261015010000_legacy_provider_session_cutover` deletes all sessions of OPERATOR users without local credentials, including expired and DISABLED-user rows. ADMIN and configured OPERATOR sessions remain. Users/credentials/files remain. Do not edit historical migrations or reset volumes. Retained unconfigured operators need a setup link; their deleted cookies never become valid again after setup. Existing sessions have no auth-source field, so configured operators retain their sessions under the owner-approved minimum policy.

## Required PR18 runtime-role upgrade — NEXORA-019

Stop API/Web and external provisioning writers; retain postgres, credentials and uploads, including the existing admin password. Rebuild matching images and run docker compose up --build -d --wait: init adds only the new runtime_credentials secret, migrate applies authentic history, db-runtime provisions nexora_app, and only then API/Web start. Do not reset volumes, edit old migrations or start stale images. The same dependency chain handles fresh install. Repeated provisioning/restart/down-up preserves all users, credentials, sessions, Carrier ciphertext, audit and files. Standard CLI account creation still runs inside API via api-entrypoint, now with runtime privileges.

If provisioning fails, API stays blocked. An authorized administrator must inspect role flags/membership/object ownership and credential-file custody; never resolve a conflict by granting API superuser, mounting admin credentials into API, deleting roles/data/volumes or silently rotating a secret. Restore the original admin secret from secure custody if damaged. Missing/corrupt retained files require deliberate custody recovery; there is no automatic password fallback. Development admin database-client instructions above are administrative access, not application credentials. Web has no DB credential access.

## Mandatory ADMIN MFA rollout — Logical PR6/NEXORA-022

For LOCAL use the trusted loopback deployment. PUBLIC_HTTPS additionally requires the dated public runbook and its release gates below. Preserve PostgreSQL, credentials, runtime_credentials and uploads. Before upgrade inventory ADMIN accounts with authorized database tooling and arrange access to each account's Nexora password and authenticator; do not ask administrators to share passwords. Verify host time synchronization and secure, independent Identity key custody (Configuration). A missing enrollment never permits password-only administrative login.

1. Stop API/Web and external provisioning writers: docker compose stop api web. Keep existing volumes and all historical migrations.
2. Supply IDENTITY_KEYRING_JSON/IDENTITY_ACTIVE_KEY_VERSION securely in the deployment environment, independently of Carrier keys, and retain them outside containers. Build matching images: docker compose build. Do not expose keys in commands/logs or start old application images against new schema.
3. Start prerequisites and apply the ninth forward migration/grants: docker compose up -d --wait postgres, then docker compose run --rm migrate and docker compose run --rm db-runtime. Do not skip the runtime grants or grant API admin privileges. Initialization of fresh installations follows the standard init dependency chain; existing DB secrets are not regenerated.
4. Enroll each configured ACTIVE ADMIN with the matching one-off API image: docker compose run --rm --no-deps api node dist/cli/mfa-enroll.js. This uses the supported runtime entrypoint and nexora_app credentials while normal API/Web remain stopped. For a fresh install first run the existing user-create CLI in the same one-off image, then enroll. Host alternative after building API and securely supplying runtime DATABASE_URL/Identity environment: pnpm mfa:enroll.
5. In a trusted unrecorded terminal enter username and hidden Nexora password, add the displayed setup key to an authenticator with issuer Nexora, SHA1/six digits/30seconds, and enter the initial six-digit confirmation. No DB locks exist during interaction. Only a successful short commit prints10 recovery codes once; store them securely offline and clear terminal scrollback. Do not capture or paste setup keys/codes into chat/logs/tickets. Initial confirmation step is already consumed; use the next TOTP step or a recovery code for login. Failed/cancelled enrollment does not overwrite existing enrollment or print recovery codes. Repeat enrollment is refused.
6. Start new API/Web: docker compose up -d --wait api web. Login each ADMIN with password then MFA; verify no session before MFA and approved admin access after. Existing PASSWORD ADMIN cookies cannot access admin APIs; enrollment revokes all of that ADMIN's sessions/challenges. Verify OPERATOR login and Carrier ownership/metadata operations still work.
7. Run real HTTP/browser/CLI and persistence smoke on a separate disposable project, not by resetting this installation's volumes. Retain valid Identity old-version keys across API restarts. Public Internet exposure remains prohibited pending PR7.

Password-correct unenrolled ADMIN receives403 MFA_ENROLLMENT_REQUIRED and CLI guidance; this is an explicit enrollment requirement, not an undocumented HTTP bootstrap. Missing keys need custody restoration; no password bypass, default key or unreviewed MFA reset exists. Lost authenticator recovery codes authenticate once each but do not reset enrollment. Lost keys/codes or a reset/re-enrollment request requires a separately reviewed operational recovery procedure; direct production secret mutation is not supplied by this task.

## Public HTTPS setup — NEXORA-024

Keep the default LOCAL setup above for loopback development/release. Owner-approved Nginx/Certbot public deployment uses compose.yml + compose.public.yml and untracked mode0600 .env.public populated from .env.public.example; do not combine with compose.dev.yml or assume registry publication. Public settings and independent retained Identity keys are mandatory; no automatic key/default account exists. Private CLI provisioning/enrollment precede public API startup. All relevant ACTIVE ADMIN users must be enrolled with readable ciphertext; startup checks runtime guards and restricted-role readiness before listen and never repairs users/sessions.

Follow [Public HTTPS deployment runbook](deployment.md#public-https-runbook--owner-approved-topology-2026-10-17) for actual host/DNS/TLS/firewall/NTP preflight, certificate bootstrap/renewal, network exposure, remote OPERATOR setup, upgrade/backups and rollback. Preserve existing volumes, DB credentials and all key versions. Domain/host are not yet supplied, so real production gates remain NOT VERIFIED. CI's disposable CA/project and successful application checks cannot establish public production readiness.
