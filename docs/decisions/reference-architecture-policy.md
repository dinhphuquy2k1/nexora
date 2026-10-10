# ADR-003 · Reference architecture & engineering governance policy

Accepted 2026-10-10.

## 1. Context & problem statement

During foundation bootstrapping (NEXORA-001) and initial development compose refactoring (NEXORA-002), Nexora successfully established its independent application runtime, Docker environment, and data storage. However, the repository's contributor governance revealed several operational gaps:

1. **Condensed workflow documentation**: The initial AI workflow was compressed into a 6-line paragraph in `docs/ai/workflow.md`, collapsing task planning, TDD execution, cloud worktree guidelines, and task status into a single narrative.
2. **Ambiguous task lifecycle**: Task states lacked formal definition (`PLANNED → IN PROGRESS → VERIFICATION PENDING → COMPLETED`). There was no structured separation between active and completed tasks, creating ambiguity over whether a task is complete upon PR merge or only after verification evidence is recorded.
3. **Weak documentation traceability**: While `docs/ai/rules.md` stated "One owner for each documented fact" and required Documentation Impact for foundation changes, there was no central human-oriented documentation map or mechanism to prevent link rot, unresolved relative paths, or stale metadata.
4. **Uncertain reference provenance**: Nexora's technical foundation was bootstrapped from Lyra (`77a5d45`), while repository engineering workflows and AI contributor governance draw inspiration from Seiza (`909ecc81`). Without an explicit policy, contributors risk conflating runtime architecture with workflow conventions or copying unexamined conventions.

## 2. Decision: Two-tier reference architecture model

Nexora establishes an explicit distinction between its **technical foundation baseline** and its **engineering workflow reference**.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Nexora Architectural Alignment                       │
├──────────────────────────────────┬─────────────────────────────────────┤
│   Technical Foundation           │   Engineering Governance            │
│   Primary: Lyra (commit 77a5d45) │   Primary: Seiza (commit 909ecc81)  │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • Node 24 / pnpm 10 / Turbo 2.11 │ • AI contributor instructions       │
│ • NestJS 11 Modular Monolith     │ • 4-stage task lifecycle model      │
│ • Next.js 16 (App Router)        │ • Step-by-step implementation flow  │
│ • PostgreSQL 17.11 & Prisma 7.10 │ • Canonical documentation ownership │
│ • Local file storage & catalog   │ • Mandatory Documentation Impact    │
│ • Shared multi-stage Dockerfile  │ • Canonical Evidence tables         │
│ • Deterministic OpenAPI / SDK    │ • Lightweight documentation checks  │
└──────────────────────────────────┴─────────────────────────────────────┘
```

### 2.1 Technical foundation provenance

Nexora's implemented runtime baseline originates from Lyra at commit `77a5d45f713e05001e45f09ce3687c4a3869698b`. Existing technology choices—including Node.js 24, pnpm 10, TypeScript 5.9, NestJS 11, Next.js 16, React 19, Prisma 7, PostgreSQL 17.11, and same-origin `/api/*` transport—remain authoritative as defined in [ADR-001](technology-baseline.md).

### 2.2 Engineering workflow reference

Seiza (pinned reference commit `909ecc81aac006abe3e35828369679b1e67c62f3`) is the authoritative reference for:

- AI contributor instructions and entrypoint sequence.
- 4-stage task lifecycle (`PLANNED → IN PROGRESS → VERIFICATION PENDING → COMPLETED`).
- Implementation workflow stages (`BOUNDED`, `SIGNIFICANT`, `SPIKE`).
- Documentation ownership model with a central canonical map in `docs/README.md`.
- Universal Documentation Impact declaration (`REQUIRED` vs `NONE`).
- Canonical Evidence schema (`Claim`, `Evidence`, `Date`, `Result`).
- Lightweight automated documentation validation (`pnpm docs:check`).

### 2.3 Justified architectural deviations

Nexora retains several justified architectural differences from Seiza. These differences are intentional engineering decisions and must **never** be treated as defects or deviations requiring remediation:

1. **Per-application Dockerfiles with shared dependency foundation (superseding root Dockerfile)**: As implemented in NEXORA-004, Nexora adopted Seiza-inspired per-application Dockerfiles (`apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker/Dockerfile.tools`). Unlike Seiza's duplicated dependency installs, Nexora combines per-application Dockerfile ownership with a single authoritative shared builder (`docker/Dockerfile.tools` -> `deps`) linked via BuildKit named contexts (`additional_contexts: { base: "service:builder" }`), ensuring deterministic dependency resolution, no manifest drift, and optimal layer sharing.
2. **Dedicated migration service**: Nexora executes migrations via a dedicated `migrate` container target in Docker Compose, ensuring database migrations run to completion before the compiled non-root API container starts.
3. **Local credential generation**: Local release initializes secure, uncommitted database credentials in a dedicated named volume via a one-shot `init` container.
4. **Prisma 7 & database architecture**: Nexora uses Prisma 7.10 with PostgreSQL 17.11-bookworm, preserving Lyra's proven database configuration.
5. **Independent volume isolation & backup**: Nexora maintains dedicated volumes (`nexora_credentials`, `nexora_postgres`, `nexora_uploads`) and automated backup/restore scripts with SHA-256 manifests.
6. **Project & port isolation**: Nexora runs on Compose project `nexora` with default published web port `127.0.0.1:3001` (avoiding collisions with Lyra on `3000` and Seiza on `3100`/`4100`).
7. **Local-first execution**: Nexora is configured as a local single-instance application; multi-tenant production hosting is out of scope.

### 2.4 File naming policy: Option B adopted

To align engineering governance with Seiza, Nexora adopts **Option B** (Seiza's file naming convention for AI contributor documentation under `docs/ai/`):

- `docs/ai/PROJECT_RULES.md` (supersedes `docs/ai/rules.md`)
- `docs/ai/TASK_WORKFLOW.md` (new dedicated task lifecycle specification)
- `docs/ai/IMPLEMENTATION_WORKFLOW.md` (supersedes `docs/ai/workflow.md`)
- `docs/ai/DOCUMENT_ROUTER.md` (supersedes `docs/ai/router.md`)
- `docs/ai/PROJECT_CONTEXT.md` (new concise project identity summary)

**Rationale**:

- Separates task lifecycle state management (`TASK_WORKFLOW.md`) from developer execution steps (`IMPLEMENTATION_WORKFLOW.md`), eliminating the ambiguity of the historical 6-line workflow document.
- Provides a dedicated router (`DOCUMENT_ROUTER.md`) focused strictly on task-oriented reading paths, leaving documentation ownership exclusively to `docs/README.md`.
- Visually distinguishes core governance contracts (uppercase) from domain and architecture documents (lowercase).
- All Nexora-specific invariants, shipment domain ownership, and boundary constraints are fully preserved during migration.

## 3. Policy boundaries & governance rules

1. **No runtime dependency**: Seiza is a reference repository, not a runtime dependency or package dependency. Nexora remains 100% standalone.
2. **Selective adaptation, not blind copying**: Conventions from Seiza are adapted only when they solve genuine maintenance or governance problems. Seiza's product-specific logic (e.g., Japanese learning rules, exam engines) is strictly excluded.
3. **Evidence-based change**: Technical differences between Nexora and Seiza require analysis of real maintenance impact. Documentation preferences never override proven runtime decisions.
4. **ADR supremacy**: Any modification to architectural boundaries, runtime topologies, or documentation ownership requires a new or superseding ADR.
5. **Scope isolation**: This policy applies exclusively to Nexora and does not modify Lyra's or Seiza's governance.

## 4. Consequences

### Positive

- AI coding assistants follow a clear, deterministic reading order and implementation workflow.
- Task status transitions are auditable and strictly gated by executable verification evidence.
- Broken links and invalid task statuses are detected automatically before code is merged.
- Technical boundaries between Nexora, Lyra, and Seiza are documented with zero ambiguity.

### Negative / Trade-offs

- Contributors must adhere to formal Documentation Impact and Evidence schemas for every task.
- Running `pnpm quality` includes documentation validation overhead (sub-second execution).
