# Configuration

Compose supplies defaults and an idempotently generated local database credential, stored in a dedicated volume. Never print its contents or commit it. This credential is for isolated local PostgreSQL, not public deployment.

| Variable         | Owner / contract                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL     | API/migration server only; required PostgreSQL URL; entrypoint reads credential file and injects URL                                                                                                           |
| STORAGE_ROOT     | API only; canonical absolute root, default /data/uploads in runtime, precreated writable volume                                                                                                                |
| PORT             | API, 1..65535, default 4000                                                                                                                                                                                    |
| WEB_PORT         | Compose host web port, default 127.0.0.1:3001                                                                                                                                                                  |
| NODE_ENV         | development/test/production, runtime production                                                                                                                                                                |
| API_DOCS_ENABLED | API, explicit true/false, defaults false                                                                                                                                                                       |
| API_INTERNAL_URL | Next.js server (`lib/api/config.ts`); required origin URL without path/query/fragment; supplied explicitly by Compose (`http://api:4000`) and `.env.example`; no application-level fallback; never NEXT_PUBLIC |
| ALLOWED_HOSTS    | Web ingress middleware only; optional comma-separated host allowlist (defaults: localhost, 127.0.0.1, 0.0.0.0)                                                                                                 |
| ALLOWED_ORIGINS  | API OriginGuard only; optional comma-separated origin allowlist (defaults: localhost, 127.0.0.1)                                                                                                               |

Swagger is not exposed by default. Config errors fail startup with safe JSON diagnostics. Missing or invalid `API_INTERNAL_URL` fails explicitly at build and startup time with an actionable error. Reference `.env.example` documents environment variables for local inspection. No external carrier key is currently used. Future carrier provider keys remain server-side, encrypted when persisted; key management and public identity are separate milestones.
