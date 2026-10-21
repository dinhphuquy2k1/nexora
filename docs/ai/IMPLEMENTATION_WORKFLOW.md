# Implementation Workflow

This workflow is a mandatory repository rule for AI-assisted development in Nexora.

```text
REQUEST → READ CORE INSTRUCTIONS → ROUTE DOCUMENTS → INSPECT REPOSITORY → CLASSIFY TASK
→ PLAN / INTERFACE PRE-FLIGHT → DOCUMENTATION IMPACT → IMPLEMENT
→ SYNCHRONIZE DOCS → VERIFY → REVIEW DIFF → REPORT
```

## 1. Classify and plan

Before writing code, classify the task into one of three tiers:

- **`BOUNDED`**: Localized, low-risk change with established interfaces (e.g. adding a field to an existing DTO, updating a UI token, small doc fix). Use a concise plan.
- **`SIGNIFICANT`**: Cross-cutting, architectural, security-sensitive, database schema migration, or multi-component change. Record a detailed plan in the active task record with pre-flight interface definitions.
- **`SPIKE`**: Time-boxed investigation intended to evaluate feasibility or resolve technical uncertainty. Must declare an explicit question, test methodology, and expected evidence. Never disguise unverified implementation as a spike.

### Interface pre-flight

Inspect relevant instructions, git status, existing tests, and architecture boundaries. Identify data ownership, runtime assumptions, and transport contracts before modifying files. Record conflicts as a `PLAN ISSUE` rather than silently changing architecture.

### Domain Modeling Preflight

For every new business domain and SIGNIFICANT domain feature, follow [ADR-008](../decisions/tactical-ddd.md) before code. Record domain ownership/responsibility and ubiquitous language; bounded context/module; Aggregate Root/consistency boundary (or reviewed omission rationale); entities and identity/lifecycle; meaningful Value Objects; invariants; commands/use cases; application ports/infrastructure adapters; transport contracts; cross-domain dependencies; transaction/locking/concurrency strategy; and isolated domain plus genuine integration tests. If ownership or aggregate consistency is unresolved, record and resolve PLAN ISSUE before implementing business operations.

Preflight also records vocabulary ownership/cross-package consumers, status VO policy, label/localization ownership, HTTP/SDK contract implications, runtime unknown-field policy and operation-specific hydration/consistency strategy. Distinguish approved shared codes from feature Domain behavior and presentation labels.

Start domain-invariant TDD before persistence adaptation, then verify locked hydration/minimal writes and API compatibility. Pure-query/stateless/infrastructure/supporting exceptions must be explicit and reviewed. Existing modules are not automatically refactor targets. Infrastructure changes still use verification-first; accepted architecture is not evidence of runtime success.

## 2. Assess Documentation Impact

Before implementation, follow [Project Rules](PROJECT_RULES.md#4-documentation-synchronization) and declare:

```text
Documentation Impact: REQUIRED
```

or

```text
Documentation Impact: NONE
```

For `REQUIRED`, identify changed facts, canonical owners, and verification commands. For `NONE`, provide a meaningful reason.

## 3. Implement and synchronize

- **Behavioral changes**: Test-first. Add or adapt an automated unit or integration test, implement the smallest correct change, and verify that the test suite passes.
- **Infrastructure / Docker changes**: Verification-first. Define executable verification commands before editing, compare runtime behavior afterward, and confirm container isolation.
- **Database / schema changes**: Identify canonical entity ownership, generate explicit Prisma migrations (`packages/database`), and verify data persistence across container restarts. Never reset user volumes for tests.
- **API & SDK contracts**: When API endpoints or DTOs change, regenerate OpenAPI artifacts deliberately (`pnpm contracts:generate`) and verify zero contract drift (`pnpm contracts:check`).
- **External provider integrations**: Verify official developer authorization review before implementation. Treat provider data structures as untrusted; normalize external payloads into domain commands at the infrastructure boundary.

When Documentation Impact is `REQUIRED`, update the canonical owner in the same task and PR.

## 4. Debug systematically

1. Reproduce the failure with an isolated command or test case.
2. Form a single testable hypothesis and change only one variable at a time.
3. If an issue remains unresolved after three consecutive attempts, stop editing, summarize gathered evidence, re-evaluate assumptions, and re-plan.

## 5. Verify and review

1. Run targeted checks first, followed by relevant broader test suites (`pnpm quality`, `sh scripts/quality-docker.sh`, or smoke scripts).
2. Inspect the complete Git diff (`git diff`) to verify:
   - Canonical persisted vocabulary references audited across the production diff; `pnpm lint` and `pnpm test:lint` pass (including new vocabulary/context cases).
   - No architectural boundary violations (`node scripts/boundaries.mjs`).
   - No leaked credentials or sensitive headers in logs.
   - No untracked files or leftover scratch artifacts.
   - Canonical documentation is synchronized and passes validation (`pnpm docs:check`).

## 6. Report with evidence

Every final task report must include:

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
