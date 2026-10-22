# GitHub Copilot Instructions

When assisting in this repository:

- Follow the canonical AI instructions starting at [`docs/ai/README.md`](../docs/ai/README.md).
- Before generating or modifying code, verify that the task has completed a pre-code review and reuse audit per [`docs/ai/IMPLEMENTATION_WORKFLOW.md`](../docs/ai/IMPLEMENTATION_WORKFLOW.md) and [ADR-009](../docs/decisions/mandatory-pre-code-design-review.md).
- Use canonical reusable primitives in `apps/api/src/common/` (e.g. `isUuid`, `isLowercaseHex64`, `PhoneNumber`, `CountryCode`, `GENERIC_ERROR_MESSAGE`). Do not reinvent validation regexes or phone/country parsing. Consult [`docs/architecture/reusable-components.md`](../docs/architecture/reusable-components.md).
- Preserve architectural layer boundaries: Presentation → Application → Domain; only API infrastructure accesses `@nexora/database` and Prisma. Apps never import apps.
- Follow test-first development and execute commands to verify changes.
