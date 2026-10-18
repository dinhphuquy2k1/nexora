# Task Workflow

This document defines the lifecycle, status vocabulary, evidence schema, and Documentation Impact requirements for tasks in Nexora.

## 1. Status model

### 1.1 Task lifecycle

Tasks strictly follow this 4-stage lifecycle:

```text
PLANNED → IN PROGRESS → VERIFICATION PENDING → COMPLETED
```

1. **`PLANNED`**: Task scope, plan, and acceptance criteria are written, but implementation has not started.
2. **`IN PROGRESS`**: Active development, code changes, or testing are underway.
3. **`VERIFICATION PENDING`**: Implementation changes are in place, but mandatory verification checks or acceptance criteria remain open, unverified, or failing. Merging code does **not** bypass this state.
4. **`COMPLETED`**: Every mandatory acceptance criterion is satisfied, required verification evidence is recorded, and canonical documentation is synchronized.

### 1.2 Task locations

- Non-completed tasks live in `docs/tasks/active/`.
- Completed tasks live in `docs/tasks/completed/`.

### 1.3 Task IDs & naming convention

Task filenames follow `<TYPE>-<NUMBER>-<slug>.md`, where the deterministic Task ID is the leading pattern matching `^([A-Z]+-\d+)-`. Examples:

- `NEXORA-001-foundation.md` → `NEXORA-001`
- `NEXORA-002-foundation-improvements.md` → `NEXORA-002`
- `NEXORA-003-engineering-workflow.md` → `NEXORA-003`

### 1.4 Capability status

Use exactly:

- **`PLANNED`**: Capability is specified but not yet implemented.
- **`IMPLEMENTED`**: Capability exists in code.

### 1.5 Verification status

Use exactly:

- **`VERIFIED`**: Executed verification demonstrates that all invariants hold. Requires at least one `PASS` evidence row.
- **`PARTIALLY VERIFIED`**: Some checks passed, but specific non-blocking assertions failed or were deferred.
- **`NOT VERIFIED`**: Verification has not yet executed or is unavailable.

Values like `Done`, `Finished`, `Partial`, or `PASS` are invalid task-level verification values.

### 1.6 Owner-approved local execution alternative — 2026-10-18

When hosted runners are unavailable, full canonical Docker suite verification on a local Linux host is an accepted execution alternative under [Project rules](PROJECT_RULES.md#owner-approved-local-execution-alternative--2026-10-18). This alters the execution venue, not the acceptance criteria:

- **Review commit & clean worktree**: Executed against the exact review commit with a clean worktree before and after, using pinned frozen dependencies.
- **Authentic runtime**: Genuine Prisma client generation, PostgreSQL, and real browser execution; skipping steps, omitting assertions, or substituting mocks is prohibited.
- **Traceability**: Requires structured evidence capturing command exit codes, execution duration, environment details, UTC timestamps, and the exact Git SHA.
- **Resource isolation**: Tests execute exclusively in disposable, owned test namespaces without altering user data or production configuration.
- **Status distinction**: Distinguish `LOCAL verification PASS` from `GitHub Actions SUCCESS`; hosted check status must never be fabricated. Local verification does not attest that public production release gates are satisfied.
- **Historical integrity**: Historical `FAIL` and `NOT RUN` entries are preserved. The owner's decision and date are recorded without rewriting previous execution history to `PASS`.

## 2. Canonical evidence schema

Normal task records document executable verification in an `## Evidence` section:

```markdown
## Evidence

| Claim                | Evidence                             | Date         | Result |
| :------------------- | :----------------------------------- | :----------- | :----- |
| <specific assertion> | <executed command or test reference> | <YYYY-MM-DD> | PASS   |
```

### Table requirements

1. **Four exact headers**: `Claim`, `Evidence`, `Date`, `Result`.
2. **Non-empty values**: All four cells must contain non-empty text.
3. **Valid date**: Date must be a real calendar date in `YYYY-MM-DD` format.
4. **Binary result**: Result must be strictly `PASS` or `FAIL`.
5. **PASS requirement**: Tasks claiming `VERIFIED` or `PARTIALLY VERIFIED` must contain at least one `PASS` row.

## 3. Documentation Impact

Every task record must contain exactly one `## Documentation Impact` section declaring one of:

### Option A: Required impact

```markdown
## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- <summary of facts added, changed, or removed>

### Canonical owners

- <canonical document paths updated, e.g. docs/architecture/runtime.md>

### Documentation verification

- <command or check validating documentation, e.g. pnpm docs:check>
```

### Option B: No impact

```markdown
## Documentation Impact

Documentation Impact: NONE

### Reason

- <explicit explanation why no canonical fact was changed>
```

## 4. Historical task compatibility

Tasks completed before NEXORA-003 (`NEXORA-001`, `NEXORA-002`) retain their historical record format in `docs/tasks/completed/`. They are recognized as historical task records; their original commands, dates, and claims are preserved without retroactive rewrites.
