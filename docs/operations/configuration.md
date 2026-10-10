# Configuration

Compose supplies defaults and an idempotently generated local database credential, stored in a dedicated volume. Never print its contents or commit it. This credential is for isolated local PostgreSQL, not public deployment.

| Variable         | Owner / contract                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| DATABASE_URL     | API/migration server only; required PostgreSQL URL; entrypoint reads credential file and injects URL |
| STORAGE_ROOT     | API only; canonical absolute root, default /data/uploads in runtime, precreated writable volume      |
| PORT             | API, 1..65535, default 4000                                                                          |
| WEB_PORT         | Compose host web port, default 127.0.0.1:3001                                                        |
| NODE_ENV         | development/test/production, runtime production                                                      |
| API_DOCS_ENABLED | API, explicit true/false, defaults false                                                             |
| API_INTERNAL_URL | Next server only, http://api:4000 in Compose; never NEXT_PUBLIC                                      |

Swagger is not exposed by default. Config errors fail startup with safe JSON diagnostics. No external carrier key is currently used. Future carrier provider keys remain server-side, encrypted when persisted; key management and public identity are separate milestones.
