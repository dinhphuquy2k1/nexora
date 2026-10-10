# Task: NEXORA-003 — Align Engineering Workflow with Seiza

- **Task ID**: `NEXORA-003`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `VERIFIED`

---

## 1. Provenance & Starting Baseline

- **Repository**: `https://github.com/dinhphuquy2k1/nexora`
- **Starting Main SHA**: `f8d6f37e1e3b8251f87ef4aa187dc47ea7c51d18`
- **PR #1 (NEXORA-002)**: Merged into `main` (`f8d6f37`) prior to task execution.
- **Reference Repository**: `https://github.com/dinhphuquy2k1/seiza`
- **Pinned Reference SHA**: `909ecc81aac006abe3e35828369679b1e67c62f3`
- **Working Branch**: `refactor/engineering-workflow-alignment`

---

## 2. Objective & Scope

Establish robust, deterministic engineering governance in Nexora by adopting verified contributor conventions, task lifecycle management, canonical documentation ownership, and automated documentation validation from Seiza, while preserving Nexora's technical foundation, multi-stage Docker build, and database architecture.

### Scope restrictions

- **In scope**:
  - Reference architecture policy ADR (`docs/decisions/reference-architecture-policy.md`).
  - Human documentation index and canonical ownership map (`docs/README.md`).
  - AI contributor entry point and reading sequence (`docs/ai/README.md`).
  - Governance specification documents adopting Option B (`PROJECT_CONTEXT.md`, `PROJECT_RULES.md`, `TASK_WORKFLOW.md`, `IMPLEMENTATION_WORKFLOW.md`, `DOCUMENT_ROUTER.md`).
  - Task lifecycle organization (`docs/tasks/active/` and `docs/tasks/completed/`).
  - Lightweight documentation validator (`scripts/docs-check.mjs`, `scripts/docs-check-lib.mjs`) and test suite (`scripts/docs-check.test.mjs`).
  - Task evidence and verification recording.
- **Out of scope**:
  - Application runtime code (`apps/api`, `apps/web`).
  - Root `Dockerfile` and Docker Compose files (`compose.yml`, `compose.dev.yml`, `compose.release.yml`).
  - Dependency upgrades or package version deviations.
  - Database schema or migrations.
  - Business features (shipment tracking, customer management).

---

## 3. Gap Analysis

| Area                         | Current Nexora Behavior                                                                         | Reference Seiza Behavior                                                                                               | Actual Problem                                                      | Classification          | Required Migration                                                     |
| :--------------------------- | :---------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :---------------------- | :--------------------------------------------------------------------- |
| **Contributor entrypoint**   | `docs/ai/README.md` listed rules → workflow → router without explicit sequence.                 | Strict numbered reading sequence: context → rules → task → workflow → router.                                          | Contributors jump into code without reading core constraints.       | **CHANGE REQUIRED**     | Rewrite `docs/ai/README.md` with numbered reading order.               |
| **Workflow**                 | Single 6-line paragraph in `docs/ai/workflow.md` collapsing planning, TDD, and cloud worktrees. | Structured workflow: BOUNDED / SIGNIFICANT / SPIKE classification, pre-flight, TDD, report.                            | Inconsistent planning depth across simple vs complex changes.       | **CHANGE REQUIRED**     | Adopt `docs/ai/IMPLEMENTATION_WORKFLOW.md`.                            |
| **Task lifecycle**           | Flat `docs/tasks/` folder; no formalized active/completed states.                               | Strict 4-stage lifecycle: `PLANNED → IN PROGRESS → VERIFICATION PENDING → COMPLETED` under `active/` and `completed/`. | Ambiguity over when a task is completed vs in-flight.               | **CHANGE REQUIRED**     | Adopt `docs/ai/TASK_WORKFLOW.md` and `docs/tasks/{active,completed}/`. |
| **Evidence schema**          | Free-form Markdown tables with varied headers.                                                  | Canonical 4-column schema (`Claim`, `Evidence`, `Date`, `Result`) with valid YYYY-MM-DD and PASS/FAIL.                 | Claims lack executable timestamps and uniform machine checkability. | **CHANGE REQUIRED**     | Adopt canonical Evidence table; support historical task compatibility. |
| **Documentation ownership**  | Principle stated in rules, but no human-oriented index or centralized map existed.              | `docs/README.md` human index with authoritative Canonical Ownership Map.                                               | No single authoritative lookup for document responsibilities.       | **CHANGE REQUIRED**     | Create `docs/README.md`.                                               |
| **Documentation validation** | No automated validator.                                                                         | `scripts/docs-check.mjs` validating links, entrypoints, and task metadata.                                             | Link rot and invalid task statuses go undetected.                   | **CHANGE REQUIRED**     | Implement `scripts/docs-check.mjs` and `scripts/docs-check.test.mjs`.  |
| **Docker organization**      | Shared root multi-stage `Dockerfile`.                                                           | Separate per-application Dockerfiles (`apps/api/Dockerfile`, `apps/web/Dockerfile`).                                   | None demonstrated; shared build works cleanly and efficiently.      | **JUSTIFIED DEVIATION** | Retain Nexora multi-stage build. Documented in ADR-003.                |
| **Application boundaries**   | `scripts/boundaries.mjs` linting workspace imports and layer rules.                             | Boundary linting with app-to-app and web-to-db restrictions.                                                           | Existing boundary checks are fully functional.                      | **ALIGNED**             | Preserve existing boundary script and assertions.                      |

---

## 4. Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Established ADR-003 defining the two-tier reference architecture policy and justified deviations.
- Created human documentation index `docs/README.md` with canonical ownership map.
- Adopted Option B AI governance naming under `docs/ai/` (`PROJECT_CONTEXT.md`, `PROJECT_RULES.md`, `TASK_WORKFLOW.md`, `IMPLEMENTATION_WORKFLOW.md`, `DOCUMENT_ROUTER.md`, `README.md`).
- Formalized 4-stage task lifecycle (`PLANNED → IN PROGRESS → VERIFICATION PENDING → COMPLETED`) with `docs/tasks/active/` and `docs/tasks/completed/`.
- Created lightweight documentation checker `pnpm docs:check` and negative test suite.
- Relocated historical task evidence (`NEXORA-001`, `NEXORA-002`) to `docs/tasks/completed/`.

### Canonical owners

- `docs/README.md`
- `docs/ai/README.md`
- `docs/ai/PROJECT_RULES.md`
- `docs/ai/TASK_WORKFLOW.md`
- `docs/ai/IMPLEMENTATION_WORKFLOW.md`
- `docs/ai/DOCUMENT_ROUTER.md`
- `docs/decisions/reference-architecture-policy.md`
- `docs/decisions/README.md`
- `AGENTS.md`
- `README.md`

### Documentation verification

- `pnpm docs:check` (validating links, entrypoints, and task governance).
- `node scripts/docs-check.test.mjs` (validating positive and negative validator paths).

---

## 5. Acceptance Criteria

- [x] PR #1 merge prerequisite verified (`f8d6f37`).
- [x] Starting SHA recorded (`f8d6f37e1e3b8251f87ef4aa187dc47ea7c51d18`).
- [x] Nexora and Seiza reference documentation inspected.
- [x] Reference architecture policy ADR accepted (`docs/decisions/reference-architecture-policy.md`).
- [x] Concrete workflow problems and gap analysis documented.
- [x] Contributor entry point and reading sequence established (`docs/ai/README.md`).
- [x] Task lifecycle model documented (`docs/ai/TASK_WORKFLOW.md`).
- [x] Active and completed task directory structure created (`docs/tasks/{active,completed}/`).
- [x] Historical evidence preserved and accommodated (`NEXORA-001`, `NEXORA-002`).
- [x] Central canonical ownership map established (`docs/README.md`).
- [x] Universal Documentation Impact rules defined.
- [x] Option B file naming policy implemented without broken links.
- [x] Minimal documentation validation implemented (`scripts/docs-check.mjs`, `scripts/docs-check-lib.mjs`).
- [x] Documentation checker negative tests pass (`scripts/docs-check.test.mjs`).
- [x] `pnpm docs:check` passes on the repository.
- [x] Quality suite (`sh scripts/quality-docker.sh` and `pnpm quality`) passes.
- [x] Dockerfiles, runtime behavior, and dependencies remain unchanged.

---

## 6. Evidence

| Claim                              | Evidence                                                                                             | Date       | Result |
| :--------------------------------- | :--------------------------------------------------------------------------------------------------- | :--------- | :----- |
| PR #1 merged into main             | `gh pr view 1 --json state,mergedAt` (mergedAt: 2026-10-10T03:56:13Z)                                | 2026-10-10 | PASS   |
| Starting main commit verified      | `git rev-parse HEAD` (`f8d6f37e1e3b8251f87ef4aa187dc47ea7c51d18`)                                    | 2026-10-10 | PASS   |
| Seiza reference commit verified    | `git -C ..\seiza rev-parse 909ecc81` (`909ecc81aac006abe3e35828369679b1e67c62f3`)                    | 2026-10-10 | PASS   |
| Documentation validation passes    | `pnpm docs:check` (entry points, task governance, links valid)                                       | 2026-10-10 | PASS   |
| Documentation test suite passes    | `pnpm test:docs` (6/6 tests passed in `scripts/docs-check.test.mjs`)                                 | 2026-10-10 | PASS   |
| Containerized quality suite passes | `sh scripts/quality-docker.sh` (format, lint, docs, typecheck, tests, contracts, build, integration) | 2026-10-10 | PASS   |
| Prettier formatting passes         | `pnpm format:check` (all matched files use Prettier code style)                                      | 2026-10-10 | PASS   |
