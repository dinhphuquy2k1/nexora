# Document Router

This document routes AI contributors to relevant architecture, domain, operations, and ADR documents based on task scope.

The human-oriented documentation categories and canonical ownership map live in [Documentation Index](../README.md#canonical-ownership-map); this router owns only task-oriented reading paths.

## 1. Task reading routes

| Work area                   | Read first                                                           | Then consult                                                                                                                                                         |
| :-------------------------- | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Governance / Workflow**   | [Project rules](PROJECT_RULES.md), [Task workflow](TASK_WORKFLOW.md) | [Reference architecture ADR](../decisions/reference-architecture-policy.md)                                                                                          |
| **Architecture / Monorepo** | [Architecture overview](../architecture/overview.md)                 | [Runtime architecture](../architecture/runtime.md), [Setup](../operations/setup.md)                                                                                  |
| **Docker / CI**             | [Runtime architecture](../architecture/runtime.md)                   | [Setup](../operations/setup.md), [Testing](../operations/testing.md)                                                                                                 |
| **Database & Migrations**   | [Database architecture](../architecture/database.md)                 | [Storage ADR](../decisions/storage.md)                                                                                                                               |
| **API & Backend**           | [Backend architecture](../architecture/backend.md)                   | [API contract](../architecture/api-contract.md), [Contract ownership](../decisions/contract-ownership.md)                                                            |
| **Frontend & UI**           | [Frontend architecture](../architecture/frontend.md)                 | [API contract](../architecture/api-contract.md), [Overview](../architecture/overview.md)                                                                             |
| **Customers Domain**        | [Customers domain](../domains/customers.md)                          | [Backend](../architecture/backend.md), [Database](../architecture/database.md), [API contract](../architecture/api-contract.md), [Testing](../operations/testing.md) |
| **Shipments Domain**        | [Shipments domain](../domains/shipments.md)                          | [Product scope ADR](../decisions/product-scope.md)                                                                                                                   |
| **Security & Secrets**      | [Authentication ADR](../decisions/authentication.md)                 | [Configuration](../operations/configuration.md), [Runtime](../architecture/runtime.md)                                                                               |
| **Testing & Quality**       | [Testing operations](../operations/testing.md)                       | [Implementation workflow](IMPLEMENTATION_WORKFLOW.md)                                                                                                                |

Always inspect the active task specification under [`../tasks/active/`](../tasks/active/) when one exists.

## 2. Documentation Impact review routes

Use this table as a review guide after classifying Documentation Impact:

| Change type                           | Review & update                                                |
| :------------------------------------ | :------------------------------------------------------------- |
| Repository / workspace structure      | `docs/architecture/overview.md`, `README.md`                   |
| Docker / runtime / services / ports   | `docs/architecture/runtime.md`, `docs/operations/setup.md`     |
| Testing / CI commands                 | `docs/operations/testing.md`                                   |
| Environment variables / configuration | `docs/operations/configuration.md`                             |
| API endpoints / SDK contract          | `docs/architecture/api-contract.md`                            |
| Database models / schema              | `docs/architecture/database.md`, relevant domain doc           |
| Frontend / UI components              | `docs/architecture/frontend.md`                                |
| Shipment domain logic                 | `docs/domains/shipments.md`, `docs/decisions/product-scope.md` |
| Architectural decisions               | New or superseding ADR under `docs/decisions/`                 |
| Contributor governance                | `docs/ai/PROJECT_RULES.md`, `docs/ai/TASK_WORKFLOW.md`         |
