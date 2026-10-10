# Project Context

This document provides high-level architectural context for AI-assisted work in Nexora.

## 1. System mission & identity

Nexora is an independent, single-instance shipment management application. It owns the **Shipment** domain:

- Tracking numbers, carrier metadata, and parcel lifecycle status history.
- Parcel weights, dimensions, and estimated freight fee computations.
- Shipment search, filtering, and pagination.
- Manual shipment data entry and authorized Excel file imports.
- Operational logistics analytics and delivery metrics.
- Conditional future integration with external logistics providers under strict authorization review.

Nexora is **not** Lyra's carrier invoice freight reconciliation system and **not** Seiza's Japanese language learning platform.

## 2. Architecture & technology baseline

Nexora is structured as a pnpm workspace and Turborepo modular monolith:

| Component           | Technology                        | Responsibility                                                                |
| :------------------ | :-------------------------------- | :---------------------------------------------------------------------------- |
| `apps/api`          | NestJS 11, Node.js 24             | Backend API, HTTP exception filter, storage adapter, configuration validation |
| `apps/web`          | Next.js 16, React 19, Vanilla CSS | Frontend UI, App Router, same-origin `/api/*` transport                       |
| `packages/database` | Prisma 7.10, PostgreSQL 17.11     | Database client, schema, explicit migrations (infrastructure-only)            |
| `packages/sdk`      | TypeScript, OpenAPI fetch         | Deterministic committed SDK client generated from Swagger contract            |
| `packages/ui`       | TypeScript, Vanilla CSS           | Shared presentation tokens and components for Web                             |
| `packages/shared`   | TypeScript                        | Minimal cross-package constants (product name, version)                       |

## 3. Provenance & references

- **Technical baseline**: Inherited from Lyra at commit `77a5d45f713e05001e45f09ce3687c4a3869698b` as accepted in [ADR-001](../decisions/technology-baseline.md).
- **Engineering governance**: Aligned with Seiza at commit `909ecc81aac006abe3e35828369679b1e67c62f3` as accepted in [ADR-003](../decisions/reference-architecture-policy.md).
- **Independence**: Nexora is a standalone repository with its own Git identity, Docker images (`nexora-*`), Compose project (`nexora`), persistent volumes (`nexora_*`), and default published web port (`127.0.0.1:3001`).

## 4. Key non-negotiable invariants

1. **Strict layer boundaries**: Application layers (`domain`, `application`, `presentation`) are Prisma-free. Only infrastructure boundary adapters consume `@nexora/database`. Controllers delegate to application services.
2. **Workspace isolation**: Applications cannot import applications (`apps/web` never imports `apps/api`). Web never imports `@nexora/database`.
3. **Provider authorization**: Never implement external carrier integration without official API documentation and contract authorization review. Never scrape web portals or reverse-engineer mobile apps.
4. **Local security & persistence**: Secrets are generated in container volumes (`/config/postgres_password`), never stored in Git or shell history. Database and storage survive restart.
