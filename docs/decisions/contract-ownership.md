# ADR-004 · Contract ownership

Accepted: Nest controller DTO/decorators generate OpenAPI; openapi-typescript generates committed SDK types; openapi-fetch provides the generated-path client. Web never imports API or silently generates on build. Documentation-only Nest module imports actual transport controllers but does not bind infrastructure or listen, allowing deterministic contract generation without credentials.
Both generators replace their owned output directories. Snapshot/file-set comparison detects content changes and unexpected new artifacts even without Git tooling; when Git/HEAD are available, status also guards uncommitted tracked/untracked artifacts. Same-origin Next rewrite carries transport only. No CORS wildcard or untrusted forwarded-IP chain is needed.
