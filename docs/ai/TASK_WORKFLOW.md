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

### 1.6 Plan & Design Review Record

Each implementation task records `## Design Review & Reuse Decision` with Task ID, classification, plan revision, reviewed baseline, reuse audit, impact and verification. SIGNIFICANT plans retain versioned Design Snapshot and Design SHA-256 and bind these to PR metadata. Snapshot bytes and declared SHA-256 must match. Material revisions need an updated plan/snapshot, not owner approval.

The former **Approval authority/status/evidence** fields are optional **historical provenance only**. They are not required for new tasks; `PENDING_REVIEW` or missing owner approval cannot block implementation, CI or merge readiness. Never change historical approval claims to pretend a new revision was approved. No new task lifecycle statuses are introduced.

PR CI validates exact Task ID, Task Reference, Plan revision, snapshot/digest binding and safe paths, along with normal quality/security gates. It does **not** require an authenticated GitHub comment or `APPROVED` review to implement code. Local and PR modes both enforce structural plan integrity.

### 1.7 Closing a task after merge

A merged task is closed in a dedicated documentation-only PR (or in the task's
final commit when every gate already passed before merge):

1. Set Status to `COMPLETED` and move the file to `docs/tasks/completed/` with `git mv`.
2. Add an Evidence row recording the merge SHA, PR and merge date.
3. Gates that were still pending only because hosted CI had not run on the
   merged code may be satisfied by a later hosted run whose checkout includes
   that merge commit. Cite the run ID, job ID, checkout merge SHA and the steps
   that passed.
4. Any acceptance criterion that cannot be verified by CI (production
   environment, manual visual acceptance, external authorization) is moved to a
   named follow-up task in `PLANNED` status. The closed task links to it. Never
   mark such a criterion as PASS.
5. Open PLAN ISSUEs are either linked to a follow-up task or to the canonical
   document that tracks them as a prerequisite.
6. A task whose deliverable was taken over by another task is closed as
   `COMPLETED` with a "Superseded by <Task ID>" note (precedent: NEXORA-021).
7. Never edit historical Evidence rows, FAIL rows or immutable design snapshots.

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

### Evidence provenance and availability

For new or updated verification checkpoints, retain a compact text summary in Git:
actual test name/command or workflow, exact HEAD, merge SHA when CI checks a merge
ref, execution timestamp, PASS/FAIL, run URL and assertion summary. Include artifact
ID/hash when integrity was checked. Put these details in the Evidence cell or an
adjacent provenance block; the four-column schema remains unchanged. Preserve
historical failures and unavailable original timestamp/source details honestly.

Generated images/video/detailed logs/browser manifests belong in ignored output or
14-day CI artifacts, not the task Git tree. Source hashes and necessary geometry
metadata may remain. Approved long-term source-design references require the
[Project Rules](PROJECT_RULES.md#evidence-storage-and-retention) exception review;
the task records reason, alternative-source assessment, bytes and privacy review.

State separately: assertions executed, screenshots captured, files retained and
images manually reviewed. Existence of artifacts does not prove PASS. Expired or
unavailable artifacts must not be described as still viewable; historical executed
verification remains historical, while re-verification requires available source
bytes/environment and a new run. A ZIP digest alone cannot recreate its contents.
Storage cleanup never changes immutable snapshots or established test outcomes.

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

Completed historical tasks are exempt from retroactive ADR-009 design review enforcement. For active tasks, any new implementation scope or material design change must comply with the current pre-code design review policy and record a versioned design plan and reuse review for the applicable revision, without an owner approval requirement, regardless of historical task numbering.
