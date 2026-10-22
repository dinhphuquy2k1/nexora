# Architecture overview

IMPLEMENTED: pnpm/Turbo monorepo, NestJS modular monolith, Next.js UI and same-origin HTTP transport, PostgreSQL storage catalog, local file adapter, generated OpenAPI SDK, local Scrypt identities, PostgreSQL-backed opaque sessions and owner-scoped Customer Backend V1 (verification pending).
PLANNED: Customer frontend, shipment tracking & status history, weights/estimated fees, XLSX import, conditional provider integration/synchronization.

| Workspace         | Actual responsibility                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| apps/api          | Config, HTTP errors/logs, health, storage/catalog adapters, local identity, compiled provisioning CLI and Customer/Address APIs |
| apps/web          | Vietnamese shell, Login/AccountMenu, protected workspace, system/settings                                                       |
| packages/database | Prisma client/schema/explicit migrations; infrastructure only                                                                   |
| packages/sdk      | OpenAPI-generated types and typed fetch client                                                                                  |
| packages/ui       | Panel and status badge used by web                                                                                              |
| packages/shared   | Product/version, pure deployment policy and approved Customer status codes/labels for API/Web                                   |

Business domains follow [ADR-008](../decisions/tactical-ddd.md): Modular Monolith + Clean Architecture + Tactical DDD + Ports & Adapters. Customer is the code reference; existing Identity/Carrier modules are grandfathered.

No application imports another application. Future capabilities get domain/application/infrastructure/presentation separation only when actual code exists. No Redis, queues, MinIO, Kubernetes or additional backend in Next.

Architectural lint reads TypeScript import/export, require and dynamic-import literals, including relative workspace paths. Only API infrastructure consumes database code. Frontend never imports database code. SDK never imports backend runtime code.
