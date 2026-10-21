# Implementation Workflow

This workflow is a mandatory repository rule for AI-assisted development in Nexora.

```text
REQUEST → READ DOCS → READ-ONLY REPOSITORY INSPECTION → REUSE & DESIGN AUDIT
→ ARCHITECTURE REVIEW → APPROVAL → TEST-FIRST IMPLEMENTATION → VERIFICATION
→ INDEPENDENT CODE REVIEW → REPORT
```

## 1. Classify task and scope

Before modifying files, classify the task into one of three tiers:

- **`BOUNDED`**: Localized, low-risk change with established interfaces (e.g. adding a field to an existing DTO, updating a UI token, small doc fix). Use a concise plan and review.
- **`SIGNIFICANT`**: Cross-cutting, architectural, security-sensitive, database schema migration, multi-component change, or new domain feature. Record a detailed review artifact in the active task record with pre-flight interface definitions.
- **`SPIKE`**: Time-boxed investigation intended to evaluate feasibility or resolve technical uncertainty. Must declare an explicit question, test methodology, and expected evidence. Never disguise unverified implementation as a spike.

## 2. Read-Only Repository Inspection

Inspect relevant repository instructions, git status, existing tests, and architecture boundaries before proposing or writing code:

- Search by behavior, imports, signatures, and usage across relevant modules.
- Audit existing implementations, data ownership, runtime assumptions, and transport contracts.
- Document any concrete conflict as a `PLAN ISSUE` rather than silently overriding repository architecture.

## 3. Mandatory Reuse & Design Audit

Before writing code or tests, the agent must inspect relevant existing implementations and present this structured matrix:

| Field                        | Required evidence                                                    |
| :--------------------------- | :------------------------------------------------------------------- |
| **Component**                | Function, class, Value Object, or policy proposed                    |
| **Existing implementations** | Exact file paths and relevant current behavior                       |
| **Domain owner**             | Technical/common (`apps/api/src/common/`) or business domain         |
| **Reuse alternatives**       | Reuse, extract to common, or keep independent                        |
| **Selected approach**        | One specific decision                                                |
| **Rationale**                | Correctness, maintainability, extensibility, simplicity, performance |
| **Risks**                    | Compatibility, security, concurrency, dependencies                   |
| **Verification**             | Tests or inspections needed                                          |

A statement such as "no reusable code found" is invalid without describing the search scope and queried symbols. The design must explain not only what to reuse, but also what must remain separate.

### Domain Modeling Preflight (for new domains or SIGNIFICANT domain features)

For every new business domain and SIGNIFICANT domain feature, follow [ADR-008](../decisions/tactical-ddd.md) before code. Record domain ownership/responsibility and ubiquitous language; bounded context/module; Aggregate Root/consistency boundary (or reviewed omission rationale); entities and identity/lifecycle; meaningful Value Objects; invariants; commands/use cases; application ports/infrastructure adapters; transport contracts; cross-domain dependencies; transaction/locking/concurrency strategy; and isolated domain plus genuine integration tests. If ownership or aggregate consistency is unresolved, record and resolve PLAN ISSUE before implementing business operations.

## 4. Pre-Code Architecture Review & Approval Gate

No agent or contributor may begin writing implementation code, test-code modifications, database schema changes, scaffolding, dependency additions, or CI workflow changes for any new implementation task until:

1. The Pre-Implementation Review artifact (using `docs/ai/templates/pre-implementation-review.md`) has been completed.
2. The required **Design Approval** has been obtained and recorded.

Approval semantics:

- Design approval is strictly separate from Task Lifecycle, Code Review, Test PASS, and Merge Readiness.
- A coding agent must never approve its own design on behalf of the owner.
- Approval must reference an identifiable plan revision or decision.
- A material design amendment requires renewed review of the delta.
- For existing approved designs (such as PR #23 / NEXORA-027), the agent implements the approved architecture directive directly without restarting discovery, while authenticated GitHub attestation is tracked independently.

## 5. Assess Documentation Impact

Before implementation, follow [Project Rules](PROJECT_RULES.md#4-documentation-synchronization) and declare:

```text
Documentation Impact: REQUIRED
```

or

```text
Documentation Impact: NONE
```

For `REQUIRED`, identify changed facts, canonical owners, and verification commands. For `NONE`, provide a meaningful reason.

## 6. Test-First Implementation & Synchronization

- **Behavioral changes**: Test-first. Add or adapt an automated unit or integration test (RED), implement the smallest correct change, and verify that the test suite passes (GREEN).
- **Infrastructure / Docker changes**: Verification-first. Define executable verification commands before editing, compare runtime behavior afterward, and confirm container isolation.
- **Database / schema changes**: Identify canonical entity ownership, generate explicit Prisma migrations (`packages/database`), and verify data persistence across container restarts. Never reset user volumes for tests.
- **API & SDK contracts**: When API endpoints or DTOs change, regenerate OpenAPI artifacts deliberately (`pnpm contracts:generate`) and verify zero contract drift (`pnpm contracts:check`).
- **External provider integrations**: Verify official developer authorization review before implementation. Treat provider data structures as untrusted; normalize external payloads into domain commands at the infrastructure boundary.

When Documentation Impact is `REQUIRED`, update the canonical owner in the same task and PR.

## 7. Verify and Debug Systematically

1. Run targeted checks first, followed by relevant broader test suites (`pnpm quality`, `sh scripts/quality-docker.sh`, or smoke scripts).
2. If an issue remains unresolved after three consecutive attempts, stop editing, summarize gathered evidence, re-evaluate assumptions, and re-plan.
3. Inspect the complete Git diff (`git diff`) to verify:
   - Canonical persisted vocabulary references audited across the production diff; `pnpm lint` and `pnpm test:lint` pass.
   - No architectural boundary violations (`node scripts/boundaries.mjs`).
   - No leaked credentials or sensitive headers in logs.
   - No untracked files or leftover scratch artifacts.
   - Canonical documentation is synchronized and passes validation (`pnpm docs:check`).

## 8. Independent Code Review

Future SIGNIFICANT tasks require an independent code review evaluating:

- Compliance against the approved design.
- Detection of newly introduced duplicate implementations.
- API / schema / SDK contract drift.
- Transaction and concurrency regressions.
- Dependency direction and layer purity.
- Structured P1/P2/P3 findings with exact paths and concrete impact.
- Merge readiness recommendation based on verified runtime evidence.

When an independent agent or reviewer is unavailable, document that limitation and require owner review. Self-review must never be represented as independent approval.

## 9. Report with Evidence

Every final task report must include:

- Actual HEAD commit before and after.
- Confirmation of branch and PR.
- Exact commands executed and their outcomes (`PASS`, `FAIL`, `NOT RUN`).
- Confirmation of unchanged runtime/infrastructure guarantees where applicable.
- The standard Documentation Impact report:

```markdown
### Documentation Impact: REQUIRED

- **Changed facts**: <summary of facts added, changed, or removed>
- **Canonical docs updated**: <paths to updated documents>
- **Documentation verification**: <verification command, e.g. pnpm docs:check>
```

or

```markdown
### Documentation Impact: NONE

- **Reason**: <explanation why no canonical fact was changed>
```
