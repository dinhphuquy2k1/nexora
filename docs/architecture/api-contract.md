# API contract

| Endpoint              | Success                                                 | Failure                                                          |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| GET /api/health/live  | 200 `{status:"ok"}`                                     | Process unreachable if down                                      |
| GET /api/health/ready | 200 `{status:"ok",checks:{database:true,storage:true}}` | 503 with checks plus `code:"NOT_READY"`, safe message, requestId |

All responses carry server-generated `x-request-id`; HTTP errors contain code/message/requestId and do not expose stack, SQL or credentials. Unknown paths return 404 NOT_FOUND. Swagger is off by default, explicitly enabled via API_DOCS_ENABLED=true.
`contracts:generate` compiles a documentation-only Nest module with the SAME health controller/decorators, never listens and never requires a DB/storage connection, writes OpenAPI then runs openapi-typescript. `packages/sdk` uses openapi-fetch over generated paths; both types and client behavior follow OpenAPI rather than importing API code.
`contracts:check` compares content and the complete generated file set before/after regeneration, then checks Git status including untracked paths when Git/HEAD are available. Both OpenAPI and SDK generators clean only their owned output directories; file-set comparison works without Git in minimal Docker images, and an unexpected new generated file triggers drift. Outputs are committed. Build does not silently regenerate them.
Breaking contract changes require consumer/tests/docs together. Monetary JSON fields in later endpoints are decimal strings.
