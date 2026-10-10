# Architecture overview

IMPLEMENTED: pnpm/Turbo monorepo, NestJS modular monolith, Next.js UI and same-origin HTTP transport, PostgreSQL storage catalog, local file adapter, and generated OpenAPI SDK.
PLANNED: Customer management, shipment tracking & status history, weights/estimated fees, XLSX import, conditional provider integration/synchronization, local identity.

| Workspace         | Actual responsibility                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| apps/api          | Config, HTTP errors/logs, health orchestration, storage/catalog adapters |
| apps/web          | Vietnamese shell, live system page, informational settings               |
| packages/database | Prisma client/schema/explicit migrations; infrastructure only            |
| packages/sdk      | OpenAPI-generated types and typed fetch client                           |
| packages/ui       | Panel and status badge used by web                                       |
| packages/shared   | Product name and foundation version consumed by web                      |

No application imports another application. Future capabilities get domain/application/infrastructure/presentation separation only when actual code exists. No Redis, queues, MinIO, Kubernetes or additional backend in Next.

Architectural lint reads TypeScript import/export, require and dynamic-import literals, including relative workspace paths. Only API infrastructure consumes database code. Frontend never imports database code. SDK never imports backend runtime code.
