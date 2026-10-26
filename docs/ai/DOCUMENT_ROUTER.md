# Document Router

This document routes AI contributors to relevant architecture, domain, operations, and ADR documents based on task scope.

The human-oriented documentation categories and canonical ownership map live in [Documentation Index](../README.md#canonical-ownership-map); this router owns only task-oriented reading paths.

## 1. Task reading routes

| Work area                   | Read first                                                                                                                                    | Then consult                                                                                                                                                                                                                        |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Governance / Workflow**   | [Project rules](PROJECT_RULES.md), [Task workflow](TASK_WORKFLOW.md), [Pre-code review ADR](../decisions/mandatory-pre-code-design-review.md) | [Reference architecture ADR](../decisions/reference-architecture-policy.md), [Pre-Implementation Review Template](templates/pre-implementation-review.md), [Reusable Components](../architecture/reusable-components.md)            |
| **Architecture / Monorepo** | [Architecture overview](../architecture/overview.md)                                                                                          | [Runtime architecture](../architecture/runtime.md), [Setup](../operations/setup.md), [Reusable Components](../architecture/reusable-components.md)                                                                                  |
| **Docker / CI**             | [Runtime architecture](../architecture/runtime.md)                                                                                            | [Setup](../operations/setup.md), [Testing](../operations/testing.md)                                                                                                                                                                |
| **Database & Migrations**   | [Database architecture](../architecture/database.md)                                                                                          | [Storage ADR](../decisions/storage.md)                                                                                                                                                                                              |
| **API & Backend**           | [Backend architecture](../architecture/backend.md)                                                                                            | [API contract](../architecture/api-contract.md), [Contract ownership](../decisions/contract-ownership.md), [Reusable Components](../architecture/reusable-components.md)                                                            |
| **Frontend & UI**           | [Design System](../architecture/design-system.md), [Frontend architecture](../architecture/frontend.md)                                       | [API contract](../architecture/api-contract.md), [Overview](../architecture/overview.md)                                                                                                                                            |
| **Customers Domain**        | [Customers domain](../domains/customers.md)                                                                                                   | [Backend](../architecture/backend.md), [Database](../architecture/database.md), [API contract](../architecture/api-contract.md), [Testing](../operations/testing.md), [Reusable Components](../architecture/reusable-components.md) |
| **Shipments Domain**        | [Shipments domain](../domains/shipments.md)                                                                                                   | [Product scope ADR](../decisions/product-scope.md), [Reusable Components](../architecture/reusable-components.md)                                                                                                                   |
| **Security & Secrets**      | [Authentication ADR](../decisions/authentication.md)                                                                                          | [Configuration](../operations/configuration.md), [Runtime](../architecture/runtime.md)                                                                                                                                              |
| **Testing & Quality**       | [Testing operations](../operations/testing.md)                                                                                                | [Implementation workflow](IMPLEMENTATION_WORKFLOW.md), [Pre-Implementation Review Template](templates/pre-implementation-review.md)                                                                                                 |

Always inspect the active task specification under [`../tasks/active/`](../tasks/active/) when one exists.

## Pre-Code Design Review & Reusable Components Reading Route

Before proposing or modifying code for any new task:

1. Follow the **Pre-Implementation Review Skill** (`.github/skills/pre-implementation-review/SKILL.md`) and use the **Pre-Implementation Review Template** (`docs/ai/templates/pre-implementation-review.md`).
2. Consult the **Reusable Components Registry** (`docs/architecture/reusable-components.md`) to identify existing canonical primitives (`isUuid`, `isLowercaseHex64`, `PhoneNumber`, `CountryCode`, `GENERIC_ERROR_MESSAGE`, `CustomerStatus`).
3. Read [ADR-009](../decisions/mandatory-pre-code-design-review.md) for pre-code gate requirements, reuse audit guidelines, and scaled review depths (`BOUNDED`, `SIGNIFICANT`, `SPIKE`).
4. After implementation, run the **Implementation Code Review Skill** (`.github/skills/implementation-code-review/SKILL.md`) to verify alignment with the approved design and detect unwanted duplication.

## Tactical DDD reading route

For a new business domain or significant domain expansion, read [mandatory DDD ADR](../decisions/tactical-ddd.md), [Backend architecture](../architecture/backend.md), the relevant domain document, [Customer reference model](../domains/customers.md) and [Testing](../operations/testing.md). Inspect Customer domain/application/adapter code for concrete locked-hydration and transition mapping; do not copy Customer business rules into other domains. Project Rules own enforcement; ADR owns rationale; domain docs own business semantics. Canonical document ownership remains defined in docs/README.md.

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

For shared vocabulary/status changes, inspect packages/shared exports and canonical code/label leaves, then read [API/SDK contract](../architecture/api-contract.md), [Backend Domain boundaries](../architecture/backend.md), [Frontend presentation](../architecture/frontend.md) and the dated [ADR-008 amendment](../decisions/tactical-ddd.md). Verify both runtime consumers and generated SDK agreement; do not move Domain models into shared.

For digest-bound approval hardening, read ADR-009, Task Workflow and scripts/preflight-policy-check.mjs; immutable artifacts are under docs/tasks/design-reviews/, while active task/PR retain execution evidence.
