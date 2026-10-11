# Setup

Default: `docker compose up --build -d`; `./start.sh` / `Start.cmd` wrap this and wait for health for 180 seconds after build. Stop with `docker compose down`, `./stop.sh` / `Stop.cmd`, preserving volumes. Docker Engine 24+ with Compose v2.22.0+ (BuildKit enabled) and Linux containers is required for BuildKit named contexts (`service:<name>`); first install requires Internet. No host Node/pnpm/DB or manual .env is required. Default web port is published on `127.0.0.1:3001` (configurable via `WEB_PORT`).
Development: `docker compose -f compose.yml -f compose.dev.yml up --build`. Keep this file pair for stop and quality commands. Do not mix running dev/release projects on the same published port.
Estimated minimum: 4 CPU, 8 GB RAM, 20 GB free disk for build + images/caches. Prune only owned build caches when needed.
Optional host tooling: Node .nvmrc (24.19.0), pnpm 10.34.6; `pnpm install --frozen-lockfile`, `pnpm --filter @nexora/database generate`, `pnpm build`. Inject DATABASE_URL/STORAGE_ROOT securely and provision a writable canonical root before API start. Web dev server (`pnpm --filter @nexora/web dev`) proxies to `http://127.0.0.1:4000` by default when `API_INTERNAL_URL` is omitted. No credentials should be pasted into shell history.
Initial operator account provisioning: Fresh installations have no default credentials. Create the initial administrator via `pnpm user:create` (or `docker compose exec api node scripts/user-create.mjs` in running containers), which securely prompts for username and password without echoing characters, or accepts `--password-stdin` for non-interactive automation.
Cloud proxy installations may require the platform CA as optional BuildKit `build_ca` secret and proxy build args. This retains TLS/checksum validation; never set strict-ssl=false or PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING. Proxy addresses/CA are environment configuration, never committed into images or source.

| Platform                         | Status                     |
| -------------------------------- | -------------------------- |
| Windows Docker Desktop/Start.cmd | See executed task evidence |
| Linux Docker Engine/start.sh     | Supported POSIX scripts    |
| macOS Docker Desktop             | Supported POSIX scripts    |

For offline Docker dependency preparation, an optional named build context `dependency-cache` may contain `pnpm-cache.tar` created from a pnpm store that passed `pnpm store status`. Default scratch context is empty and performs a normal frozen online install. Cached artifacts retain pnpm integrity checks.
