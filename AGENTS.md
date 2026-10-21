# Nexora contributor instructions

Before working in this repository, read the mandatory AI entry point at [`docs/ai/README.md`](docs/ai/README.md) and follow its routed reading order.

- Inspect the repository before proposing or making changes. Preserve unrelated work.
- Use Docker as the canonical runtime and services environment; host Node.js tooling is supported for fast local workflows.
- Pin exact dependency versions; use frozen installs (`pnpm install --frozen-lockfile`).
- Do not claim completion without executed command or runtime evidence.
- Every task must assess Documentation Impact (`REQUIRED` or `NONE`) following [Project rules](docs/ai/PROJECT_RULES.md#4-documentation-synchronization).
- Apps cannot import apps. Web cannot access database code. Only API infrastructure imports `@nexora/database`; controllers delegate to application services.
- Nexora owns the Shipment domain. Logistics provider integration requires official API authorization review; never invent shipment data or implement provider integrations prematurely.
- Mandatory Pre-Code Design Review: Complete read-only inspection, reuse audit, and obtain explicit design approval before modifying code or tests ([Implementation workflow](docs/ai/IMPLEMENTATION_WORKFLOW.md), [ADR-009](docs/decisions/mandatory-pre-code-design-review.md)).
- Follow the 4-stage task lifecycle (`PLANNED → IN PROGRESS → VERIFICATION PENDING → COMPLETED`) defined in [Task workflow](docs/ai/TASK_WORKFLOW.md). Never reset user volumes for tests.
