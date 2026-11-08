# NEXORA-035 — Sync Provider & Domain Extension Architecture

Status: PLANNED
Capability: PLANNED
Verification: NOT VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-035
Classification: SIGNIFICANT
Plan revision: rev-2026-11-08-sync-extension-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-035-rev-2026-11-08-sync-extension-v1.md
Design SHA-256: fd6b4419022e7c5cbdc82344883ceef54dc8f85652495c692b0fdb8a2747f29d
Reviewed baseline: 6a52c2ff90a1173a25053caf6fb7061b82f6b8dd
Branch: feat/sync-extension-architecture

PR32 merged as baseline above; GitHub merged=true, fresh origin/main ancestry and clean working tree verified2026-11-08. No prior branch reused. No NEXORA-035 task/reference found before creation. Selected interfaces, full eight-field reuse audit, scope/alternatives/security/compatibility and test-first plan are in the versioned snapshot. ADR-009 does not require owner approval.

### Reuse audit summary

| Field                    | Selected Phase A implementation                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Component                | Exact-pair resolver and fenced Domain invocation                                                                        |
| Existing implementations | SyncProvider/SyncDomainProcessor ports; SyncRepository; SyncJobExecutor; existing Customer link and lock capabilities   |
| Domain owner             | Sync technical orchestration, Customer-owned link persistence, runtime composition roots                                |
| Reuse alternatives       | Existing composite ports, static registry, dynamic plugins or public transaction callback                               |
| Selected approach        | Small static registry, shared empty production factory, trusted deferred domain binding; preserve queue/policies/schema |
| Rationale                | Explicit dispatch/version consistency and neutral APPLIED without invented business writes                              |
| Risks                    | Wrong pair/version, fake APPLIED, scope leakage, rollback and retained-session lifetime                                 |
| Verification             | Unit RED/GREEN, genuine two-capability PostgreSQL persistence/fencing, all existing regressions and final-head CI       |

## Milestones

- [ ] A1 audit, scoped plan, snapshot and preflight.
- [ ] A2 static exact-pair capability resolution and shared composition.
- [ ] A3 provider contract regressions.
- [ ] A4 neutral Domain invocation and Customer-owned link boundary.
- [ ] A5 API/Worker wiring, empty production capabilities.
- [ ] A6 compatibility and developer extension guide.
- [ ] A7 real multi-capability PostgreSQL/quality/runtime/hosted verification.
- [ ] Three independent review rounds and final-head evidence.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Static capability composition, neutral fenced Domain invocation and extension procedure.

### Canonical owners

- docs/architecture/backend.md
- docs/architecture/runtime.md
- docs/architecture/database.md (unchanged schema/grants, Domain mapping ownership)
- docs/operations/testing.md
- docs/decisions/sync-worker-staging.md (additive Phase A clarification)
- New developer guide under docs/architecture/ linked from canonical backend.

### Documentation verification

pnpm docs:check, pnpm preflight:check, pnpm format:check.

## Evidence

| Claim                                | Evidence                                                                                                                                    | Date       | Result |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Fresh merged baseline and new branch | PR32 merged=true; origin/main6a52c2ff90a1173a25053caf6fb7061b82f6b8dd; merge-base ancestry PASS; clean new feat/sync-extension-architecture | 2026-11-08 | PASS   |
| Frozen prerequisites                 | pnpm10.34.6 install --frozen-lockfile on Node24.19.0; 427 locked dependencies, no lockfile change                                           | 2026-11-08 | PASS   |

## PLAN ISSUES

PRODUCTION_DOMAIN_WRITE_CONTRACT remains a pre-Live B/C gate: no authorized production write/provider/grant is invented. Controlled test-owned transactional persistence must prove the Phase A boundary. If it cannot, retain AC7/AC8 BLOCKED and do not weaken invariants. Issue33 remains deferred.
