# Setup

## Supported Runtime Modes

Nexora operates under three distinct runtime topologies:

### Mode A: Docker Local Release (Canonical & Recommended)

- **Start**: `docker compose up --build -d` or `./start.sh` / `Start.cmd` (wraps Compose and waits up to 180 seconds for health).
- **Access**: Open `http://127.0.0.1:3001` in the browser (configurable via `WEB_PORT`).
- **Network Topology**: Browser connects to Web on loopback `127.0.0.1:3001`. Next.js proxies `/api/*` requests internally to `http://api:4000`. API and PostgreSQL services are private to Docker bridge networking and intentionally NOT published to the host.
- **Stop**: `docker compose down` or `./stop.sh` / `Stop.cmd`. All volumes (database, credentials, uploads) persist.

### Mode B: Docker Development

- **Start**: `docker compose -f compose.yml -f compose.dev.yml up --build`.
- **Characteristics**: Reuses Docker service networking (`http://api:4000`), mounts local source into containers, and runs watchers inside Docker. Does not require running Web manually on host port 3000. Keep this file pair for stop and quality commands.

### Mode C: Host-run Development (Optional / Constrained)

- **Requirements**: Node .nvmrc (24.19.0), pnpm 10.34.6; `pnpm install --frozen-lockfile`, `pnpm --filter @nexora/database generate`, `pnpm build`.
- **Constraint**: `pnpm --filter @nexora/web dev` runs Next.js on host port 3000. Next.js does not provide an implicit fallback for `API_INTERNAL_URL`. If unconfigured, build and startup fail explicitly with an actionable error. Because Docker does not publish the internal API port to the host, pointing host Next.js to `http://api:4000` fails with `getaddrinfo ENOTFOUND api`. Host-run Web requires an independently reachable host API listener and explicit configuration: `API_INTERNAL_URL=http://127.0.0.1:4000 pnpm --filter @nexora/web dev`. For standard local work, Docker Mode A or B is recommended.

## Initial Operator Account Provisioning

Fresh installations contain no default credentials or demo accounts. Provision the initial administrator:

- **Canonical Docker**: `docker compose exec api node scripts/user-create.mjs`
- **Host tooling**: `pnpm user:create` (requires `DATABASE_URL` injected securely)
- The command securely prompts for username and password without echoing characters. For non-interactive script automation, use the `--password-stdin` flag:
  `printf '%s' "$ADMIN_PASS" | docker compose exec -T api node scripts/user-create.mjs --username admin --password-stdin`

## Windows Developer Experience & Troubleshooting

When developing on Windows, confusing port collisions or DNS resolution errors can occur:

### Investigating Listening Ports

Use safe PowerShell commands to identify which processes own port 3000 (host dev) or 3001 (Docker Web):

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess
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

| Platform                         | Status                     |
| -------------------------------- | -------------------------- |
| Windows Docker Desktop/Start.cmd | See executed task evidence |
| Linux Docker Engine/start.sh     | Supported POSIX scripts    |
| macOS Docker Desktop             | Supported POSIX scripts    |

For offline Docker dependency preparation, an optional named build context `dependency-cache` may contain `pnpm-cache.tar` created from a pnpm store that passed `pnpm store status`. Default scratch context is empty and performs a normal frozen online install.
