---
name: pre-implementation-review
description: Conducts mandatory pre-code design reviews, read-only repository inspections, reuse audits, and verifies a recorded implementation plan before code modification.
---

# Pre-Implementation Review & Reuse Audit Skill

## Purpose & Scope

This skill enforces Nexora's pre-code design governance mandated by [ADR-009](../../../docs/decisions/mandatory-pre-code-design-review.md) and [Implementation Workflow](../../../docs/ai/IMPLEMENTATION_WORKFLOW.md). It triggers before writing any implementation code, test-code modifications, database schema changes, scaffolding, or dependency additions.

## Workflow Instructions

### 1. Classification & Review Depth

Determine the task classification:

- **`BOUNDED`**: Localized, low-risk changes with established interfaces. Produce a concise review.
- **`SIGNIFICANT`**: Architectural, cross-cutting, security-sensitive, DB migration, or domain additions. Produce a comprehensive review covering all 12 sections of the template.
- **`SPIKE`**: Bounded investigation with an explicit hypothesis and evidence method. Never disguise production code as a SPIKE.

### 2. Read-Only Repository Inspection

Before proposing changes:

- Search existing code for related symbols, classes, and patterns. Consult [Reusable Components Registry](../../../docs/architecture/reusable-components.md).
- Inspect layer boundaries and current test fixtures.
- Record any architectural contradiction as a concrete `PLAN ISSUE` rather than overriding repository rules.

### 3. Mandatory Reuse & Design Audit

Evaluate candidate components against the structured 8-field matrix:

1. Component proposed
2. Existing implementations & exact file paths
3. Domain owner (common neutral vs business domain)
4. Reuse alternatives (reuse existing, extract to `common/`, keep independent)
5. Selected approach
6. Rationale (correctness, maintainability, simplicity, performance)
7. Risks (compatibility, concurrency, security, dependencies)
8. Verification plan

A claim of "no reusable code found" is invalid without describing the search scope and queries.

### 4. Tactical DDD Ownership Preflight

For new business domains or SIGNIFICANT domain features, verify [ADR-008](../../../docs/decisions/tactical-ddd.md):

- Ubiquitous language and domain boundaries.
- Aggregate Root and encapsulated child entities.
- Value Objects owning validation invariants.
- Strict commands and use-case ports.
- Transactional hydration and minimal scoped persistence.

### 5. Review Artifact Generation

Generate the review document using the template at [pre-implementation-review.md](../../../docs/ai/templates/pre-implementation-review.md) and attach it to the active task record.

### 6. Approval Check — Mandatory Stop

- Verify that explicit **Design Approval** from the project owner (or authorized independent reviewer) is documented.
- **STOP BEFORE MODIFYING CODE**: If approval is missing or pending, the agent MUST NOT begin editing code or tests.
- When a scoped design is already recorded (as in NEXORA-027), implement the plan without restarting architectural discovery.
