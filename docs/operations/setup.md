# Setup

## Supported Runtime Modes

Nexora operates under three distinct runtime topologies:

### Mode A: Docker Local Release (Canonical & Recommended)

- **Start**: `docker compose up --build -d --wait` (builds images, starts containers in background, and waits for health checks to pass).
- **Access**: Open `http://127.0.0.1:3001` in the browser (configurable via `WEB_PORT`).
- **Network Topology**: Browser connects to Web on loopback `127.0.0.1:3001`. Next.js proxies `/api/*` requests internally to `http://api:4000`. API and PostgreSQL services are private to Docker bridge networking and intentionally NOT published to the host in standard release mode.
- **Stop**: `docker compose down`. All named volumes (database, credentials, uploads) persist; never use `-v` unless intentionally destroying data.

### Mode B: Docker Development

- **Start**: `docker compose -f compose.yml -f compose.dev.yml up --build`.
- **Characteristics**: Reuses Docker service networking (`http://api:4000`), mounts local source into containers, and runs watchers inside Docker. Containerized Next.js listens internally on port 3000 and publishes user-facing port `http://127.0.0.1:3001`. In development mode, PostgreSQL automatically publishes loopback port `127.0.0.1:5432` to the host by default (numeric port configurable via `POSTGRES_PORT`, always bound to `127.0.0.1`), allowing direct inspection by local database tools like DBeaver or pgAdmin.
- **Stop**: `docker compose -f compose.yml -f compose.dev.yml down`. Always use the same file combination to stop development containers.

### Mode C: Host-run Development (Optional / Constrained)

- **Requirements**: Node .nvmrc (24.19.0), pnpm 10.34.6; `pnpm install --frozen-lockfile`, `pnpm --filter @nexora/database generate`, `pnpm build`.
- **Port Policy & Collision Prevention**: `pnpm --filter @nexora/web dev` runs `scripts/dev.mjs`, which defaults to the canonical browser-facing port 3001 (or `PORT` env var). If port 3001 is already bound (e.g. Docker Web is active), the preflight refuses startup with an explicit `EADDRINUSE` error instead of silently switching to port 3002. Never run host Web and Docker Web simultaneously on port 3001.
- **API Configuration**: Next.js does not provide an implicit fallback for `API_INTERNAL_URL`. If unconfigured, build and startup fail explicitly with an actionable error. Because Docker does not publish the internal API port to the host, pointing host Next.js to `http://api:4000` fails with `getaddrinfo ENOTFOUND api`. Host-run Web requires an independently reachable host API listener and explicit configuration: `API_INTERNAL_URL=http://127.0.0.1:4000 pnpm --filter @nexora/web dev`. For standard local work, Docker Mode A or B is recommended.

## Initial Operator Account Provisioning

Fresh installations contain no default credentials or demo accounts. The authoritative implementation is compiled with API; host tooling remains `pnpm user:create` after building API and securely supplying `DATABASE_URL`.

The compiled runtime invocation below passed fresh-install provisioning and pseudo-TTY checks in hosted run `38202165584` at commit `de73dca550b7a07e0e99697c00bae570634e5df9` (see NEXORA-009). The previous repository-script path is unavailable in that image and must not be used:

```sh
docker compose exec api sh /scripts/api-entrypoint.sh node dist/cli/user-create.js
```

It uses the image's non-root user and the approved entrypoint for database configuration. Interactive username/password/confirmation use a single raw terminal reader, with no password rendering; backspace, Ctrl+C and EOF restore terminal mode. Provisioning enforces case-sensitive, trimmed usernames of 3–50 characters and passwords of 8–1024 characters. Duplicate usernames and failures exit nonzero with sanitized diagnostics.

Automation must explicitly select password stdin; never put a password in command-line arguments or implicitly pipe it:

```sh
printf '%s' "$ADMIN_PASS" | docker compose exec -T api sh /scripts/api-entrypoint.sh node dist/cli/user-create.js --username admin --password-stdin
```

A changed supported `WEB_PORT` is passed into API Origin resolution automatically. An explicit `ALLOWED_ORIGINS` replaces derived defaults; see [Configuration](configuration.md). Docker mode keeps API/PostgreSQL private; browser-facing port 3001 connects to the Web container listener (internal container port 3000). Compose forwards `UNISHIP_API_URL` and `UNISHIP_LIVE_AUTHORIZED` to the API service; leaving them unconfigured leaves API startup unaffected while employee provider login safely returns 503 until the provider URL and operational switch are configured. Uniship API integration permission was confirmed by the owner on 2026-10-13; the administrator selects the correct `UNISHIP_API_URL` and may explicitly enable `UNISHIP_LIVE_AUTHORIZED=true` under the approved authorization and deployment procedure. Leave the switch false during ordinary tests/startup. Local mock-provider verification does not establish live Uniship authentication.

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

For identity upgrades, stop API/Web and external provisioning writers, retain PostgreSQL/credential/upload volumes, and use the reviewed matching release's migrate service before bringing application writers back. Do not start old images against migrated schema.

## Manual Uniship OPERATOR registration

After the committed migrations are deployed, an authorized database administrator obtains the confirmed Uniship userid and runs from the checkout:

```sh
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" \
  -v username='operator_nam' -v uniship_userid='10482' \
  -f scripts/sql/register-uniship-operator.sql
```

Use the correct installation/database connection through the existing administrative channel; Docker PostgreSQL remains private. Supply no password or provider token as registration parameters. The script creates one ACTIVE OPERATOR plus one Uniship binding atomically, without local credentials. Duplicate/invalid inputs or either insert failure exit nonzero and roll back. Username policy is trimmed 3–50 characters without a character allowlist; stored subject policy is nonempty, trimmed and at most 128 characters. Enter the actual provider-issued userid: the authentication adapter independently verifies positive decimal userid payloads. A manually stored mapping is authorization data, not proof of authentication. See [NEXORA-012](../tasks/active/NEXORA-012-admin-staff-management.md) for invariants and deferred Admin CRUD/UI. No broader provider data-retention rights are inferred from userid approval.

## Uniship configuration example and Web launchers

Copy `.env.example` to `.env` when using the provided configuration example. It contains an active Uniship API base URL `https://kh.uniship.vn` and keeps `UNISHIP_LIVE_AUTHORIZED=false`. The administrator is responsible for the correct base URL; supply no login endpoint path, provider password or token. Environment variables can override the example. API integration permission is owner-confirmed; explicitly enabling the deployment switch is separate from real-provider technical verification, which remains deferred. Removing or emptying the URL preserves provider-unavailable behavior and independent local ADMIN Login.

The existing `pnpm --filter @nexora/web dev` / `start` commands delegate to one shared launcher. Dev retains `next dev --webpack`; start retains `next start`. Absent PORT defaults to host-facing 3001; an empty/malformed/out-of-range PORT exits nonzero before spawning Next.js. A collision exits nonzero with instructions and never stops the existing listener or selects another port. Preflight does not eliminate a later binding race: the actual child failure still propagates. SIGINT, SIGTERM and SIGHUP are forwarded to the child; the launcher waits for child closure and returns 128 plus the signal number for signal termination. Normal child exit codes are preserved and spawn errors fail safely. Docker development keeps its explicit internal listener on 3000; Docker release keeps its direct Next.js invocation and existing port mapping.
