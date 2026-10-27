# Pre-Implementation Review & Reuse Audit Template

Use this template to document the pre-code design review for all implementation tasks before editing code or tests, per [ADR-009](../../decisions/mandatory-pre-code-design-review.md) and [Implementation Workflow](../IMPLEMENTATION_WORKFLOW.md).

---

## 1. Task Metadata & Classification

- **Task ID**: `<e.g. NEXORA-028>`
- **Task Title**: `<Brief descriptive title>`
- **Classification**: `<BOUNDED | SIGNIFICANT | SPIKE>`
- **Documentation Impact**: `<REQUIRED | NONE>`
- **Target Branch & PR**: `<e.g. feat/shipment-management / PR #24>`
- **Plan revision**: `<versioned-revision>`
- **Design Snapshot**: `docs/tasks/design-reviews/<Task-ID>-<revision>.md`
- **Design SHA-256**: `<computed64-lowercase-hex>`
- **Reviewed Baseline HEAD**: `<git commit SHA>`

---

## 2. Requirements & Boundary Scope

- **User Story / Business Need**: `<Clear description of what needs to be achieved>`
- **In-Scope Items**:
  - `<Specific capability 1>`
  - `<Specific capability 2>`
- **Explicit Non-Goals & Out-of-Scope Items**:
  - `<What must NOT be touched or implemented in this task>`

---

## 3. Relevant Documentation & Canonical Owners

- **Governing ADRs**: `<e.g. ADR-003, ADR-008, ADR-009>`
- **Architecture Docs**: `<e.g. docs/architecture/backend.md, docs/architecture/api-contract.md>`
- **Domain Docs**: `<e.g. docs/domains/customers.md>`
- **Operations Docs**: `<e.g. docs/operations/testing.md>`

---

## 4. Existing Code References & Search Scope

- **Searched Directories**: `<e.g. apps/api/src/common/, apps/api/src/customer/>`
- **Search Queries / Symbols**: `<e.g. isUuid, PhoneNumber, status, lock, transaction>`
- **Relevant Existing Files**:
  - `path/to/file1.ts`: `<Relevant behavior and current responsibility>`
  - `path/to/file2.ts`: `<Relevant behavior and current responsibility>`

---

## 5. Mandatory Reuse & Design Audit Matrix

| Field                        | Component 1                                                | Component 2 |
| :--------------------------- | :--------------------------------------------------------- | :---------- |
| **Component**                | `<Name of function, VO, policy, or class>`                 |             |
| **Existing implementations** | `<Exact file paths and behavior>`                          |             |
| **Domain owner**             | `<Technical/common or specific business domain>`           |             |
| **Reuse alternatives**       | `<Reuse existing, extract to common, or keep independent>` |             |
| **Selected approach**        | `<One specific, unambiguous decision>`                     |             |
| **Rationale**                | `<Correctness, maintainability, simplicity, performance>`  |             |
| **Risks**                    | `<Compatibility, concurrency, security, dependencies>`     |             |
| **Verification**             | `<Targeted unit/integration tests or AST inspections>`     |             |

---

## 6. Alternative Designs & Trade-offs

- **Alternative 1**: `<Description>`
  - _Trade-off / Why Rejected_: `<Reason>`
- **Alternative 2**: `<Description>`
  - _Trade-off / Why Rejected_: `<Reason>`

---

## 7. Selected Design & Tactical DDD Alignment

- **Ubiquitous Language & Domain Responsibility**: `<Terms and bounded context>`
- **Aggregate Root & Consistency Boundary**: `<Root entity and encapsulated children>`
- **Value Objects & Invariants**: `<Immutable value objects and validation rules>`
- **Commands & Application Ports**: `<Strict command shapes and port contracts>`
- **Infrastructure & Persistence Mapping**: `<Adapter hydration and minimal scoped writes>`

---

## 8. Security, Concurrency & Performance Analysis

- **Authorization & Authentication**: `<How trusted actors are verified>`
- **Lock Ordering & Concurrency**: `<PostgreSQL transaction boundaries, row/advisory locks>`
- **Query & Hydration Efficiency**: `<Avoiding N+1 queries, scoped projections for GETs>`

---

## 9. Compatibility Matrix

- **API & OpenAPI Contract Impact**: `<Zero drift or documented additive fields>`
- **Database Schema & Migrations**: `<Migration required or existing schema retained>`
- **Historical Data Hydration**: `<How legacy records are preserved or repaired>`
- **Cross-Package Contracts**: `<Impact on @nexora/shared or SDK generation>`

---

## 10. Test Plan (Test-First / Verification-First)

1. **Unit / Characterization Tests (RED)**: `<Specific failing test cases before implementation>`
2. **Domain Aggregate / VO Tests**: `<Encapsulation, invariance, equality, normalization>`
3. **Application Port / Orchestration Tests**: `<Input parsing, error mapping, actor trust>`
4. **Integration / Concurrency Tests**: `<Real PostgreSQL transaction, lock, and race tests>`
5. **Quality & Boundary Verification**: `<pnpm format:check, pnpm lint, scripts/boundaries.mjs, pnpm docs:check>`

---

## 11. Plan Readiness & Governance

- **Plan Revision**: `<versioned design revision>`
- **Reviewed Baseline**: `<commit SHA>`
- **Review Completed**: `<YYYY-MM-DD>`
- **Material Design Changes**: `<none or links to documented amended plan>`
- **Owner Approval**: Not required. No PR comment/review attestation gate.

## 12. Unresolved PLAN ISSUES

- `<List any concrete architectural conflicts or unresolved questions. If none, state NONE.>`

## Snapshot pinning and plan integrity

Before implementation, record the selected design (identity/revision, baseline, objectives, scope/reuse/ownership/alternatives, non-goals, security/compatibility, risks and acceptance/test strategy) in the versioned snapshot. Exclude mutable execution/test/CI/review logs. Compute raw UTF-8 SHA-256 with Node crypto or `computeDesignDigest` from `scripts/preflight-policy-check.mjs`. Record matching path/digest in task and PR metadata and run the structural binding check.

**Do not request, invent or wait for owner approval or a GitHub comment.** A material change requires updating the plan/snapshot and verifying integrity, without a new approval. Preserve previously approved snapshots and historical evidence as immutable records.
