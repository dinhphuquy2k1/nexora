# Nexora Documentation

This is the human-oriented index for Nexora documentation. Each durable fact has exactly one canonical owner; other documents provide only summaries and links.

For AI-assisted development, start at the mandatory entry point [`docs/ai/README.md`](ai/README.md).

## Documentation categories

### Architecture

- [Architecture overview](architecture/overview.md): Monorepo structure, workspace packaging, and boundary rules.
- [Runtime topology](architecture/runtime.md): Release and development container runtime, networking, and security.
- [Backend architecture](architecture/backend.md): NestJS modular monolith, storage adapter, and HTTP contracts.
- [Frontend architecture](architecture/frontend.md): Next.js App Router, layout, UI packages, and transport.
- [Database architecture](architecture/database.md): PostgreSQL 17.11, Prisma 7.10, and explicit migration policies.
- [API contract](architecture/api-contract.md): OpenAPI generation, SDK client synchronization, and contract drift checks.

### Domains

- [Shipments domain](domains/shipments.md): Core shipment entities, parcel attributes, tracking events, and lifecycle invariants.

### Operations

- [Development setup](operations/setup.md): Docker setup, prerequisites, host tooling, and quick start.
- [Testing & verification](operations/testing.md): Quality suite, Docker smoke checks, and regression commands.
- [Configuration](operations/configuration.md): Environment variables, defaults, and secrets handling.
- [Deployment](operations/deployment.md): Local single-instance deployment and release topology.

### Decisions

- [Architecture Decision Records (ADR) index](decisions/README.md): Index of accepted architectural decisions.

### Tasks

- [Active tasks](tasks/active/): Ongoing, planned, or verification-pending work items.
- [Completed tasks](tasks/completed/): Verified, accepted historical task records.

Task records own work scope, progress, acceptance criteria, and verification evidence. They do not replace durable architecture or operations documentation.

### AI contributor documentation

- [AI contributor entry point](ai/README.md): Mandatory reading sequence for automated assistants.
- [Project context](ai/PROJECT_CONTEXT.md): High-level system overview and architectural invariants.
- [Project rules](ai/PROJECT_RULES.md): Non-negotiable engineering and architectural rules.
- [Task workflow](ai/TASK_WORKFLOW.md): Task lifecycle, evidence schema, and Documentation Impact requirements.
- [Implementation workflow](ai/IMPLEMENTATION_WORKFLOW.md): Step-by-step TDD, planning, and reporting procedures.
- [Document router](ai/DOCUMENT_ROUTER.md): Task-oriented reading route guidance.

## Canonical ownership map

| Location               | Canonical responsibility                                                            |
| :--------------------- | :---------------------------------------------------------------------------------- |
| `README.md`            | Repository overview, product description, and minimal quick start                   |
| `docs/README.md`       | Documentation navigation and canonical ownership map                                |
| `docs/architecture/**` | System structure, technical boundaries, runtime topology, and component contracts   |
| `docs/domains/**`      | Domain business invariants, entity relationships, and domain-specific rules         |
| `docs/operations/**`   | Setup, testing, configuration variables, and deployment procedures                  |
| `docs/decisions/ADR-*` | Durable architectural decisions, technology selections, and rationale               |
| `docs/tasks/**`        | Work scope, acceptance state, remaining work, and executed verification evidence    |
| `docs/ai/**`           | AI contributor rules, task lifecycle, implementation workflow, and document routing |

## Status vocabulary

Implementation capability, verification status, and task lifecycle are strictly separated:

- **Task Lifecycle**: `PLANNED → IN PROGRESS → VERIFICATION PENDING → COMPLETED`
- **Implementation Status**: `PLANNED` or `IMPLEMENTED`
- **Verification Status**: `VERIFIED`, `PARTIALLY VERIFIED`, or `NOT VERIFIED`

Full definitions and evidence rules are detailed in [Task Workflow](ai/TASK_WORKFLOW.md).
