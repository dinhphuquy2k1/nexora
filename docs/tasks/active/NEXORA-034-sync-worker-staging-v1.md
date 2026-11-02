# NEXORA-034 — Sync Worker and Staging V1

Status: IN PROGRESS
Capability: PLANNED
Verification: NOT VERIFIED

## Scope

Implement the owner-supplied PostgreSQL Sync V1 architecture in one PR from main.
Baseline: 156a32414dfefdc235804367307b5f052d9dcb47.
Branch: feat/sync-worker-staging-v1. No merge/deployment authorized.

## Design Review & Reuse Decision

Task ID: NEXORA-034
Classification: SIGNIFICANT
Plan revision: rev-2026-11-02-sync-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-034-rev-2026-11-02-sync-v1.md
Design SHA-256: d6bcf89e94380e4a81386e3e54e86efc47142455258e8e0498a4ca86021ba20b
Reviewed baseline: 156a32414dfefdc235804367307b5f052d9dcb47

Read-only inventory, eight-field reuse matrix, domain ownership, alternatives,
contracts, security/locking, migration/test plan and bounded provider/domain
blockers are recorded in the snapshot. Pre-implementation-review skill applied.
Independent pre-code review confirms user→epoch→connection→job order and separate
claim transaction. No owner approval gate under current ADR-009.

| Component               | Existing implementations                                                                      | Domain owner              | Reuse alternatives                 | Selected approach                                                                                                 | Rationale                             | Risks                               | Verification                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| Authorization/lifecycle | identity/infrastructure/user-management.adapter.ts; carrier/infrastructure/carrier.adapter.ts | Identity/Carrier          | Rewrite vs integrate               | Minimal transaction-local Sync cancellation participant                                                           | Preserve status/delete contracts      | Lock inversion, late writes         | Real PG barriers disable/delete/claim                |
| Queue/staging           | packages/database client; existing explicit migrations                                        | Sync technical capability | Memory vs PG                       | Dedicated parameterized adapters, partial unique lane, SKIP LOCKED                                                | Durable atomic checkpoint             | Expiry, crashes, duplicate versions | 20-way admission, restart, rollback, 10000 records   |
| Provider custody/budget | carrier credential vault, uniship/provider-budget.ts                                          | Carrier                   | New transport vs existing boundary | Preserve vault/live gate; shared PG acquisition budget binding in composition                                     | No cross-process quota illusion       | Slot expiry, cooldown               | Concurrent independent API/worker budget clients     |
| Validation/errors       | common/validation/{uuid,hex}.ts; common/http/error-messages.ts; Customer error mapper         | Common/Sync               | Duplicate vs reuse                 | Reuse predicates and safe message, local exhaustive map                                                           | No duplicate regex/framework          | Mass assignment, secret leakage     | Strict inputs, envelope/Origin/owner tests           |
| Domain processing       | Customer aggregate/application port; no Shipment schema                                       | Customer/Shipment         | Invent vs bounded port             | Sync processing port with transaction-local domain adapter capability, no production handler until valid contract | Preserve existing business invariants | False success, mapping loss         | Mock processor explicitly test-only; FK/owner checks |
| UI                      | CarrierDataSyncDrawer, CarrierSyncPanels, Inspection, Select/TabBar                           | Web Carrier               | New page vs reuse                  | Generated SDK reads/actions, abort/generation guards, existing layout                                             | Keep approved presentation            | Stale results, fake data            | Component/real CDP and regressions                   |
| Runtime/tests           | apps/api image/context, init/grant scripts, Node discovery, owned PG launcher                 | Runtime                   | Third app vs entrypoint            | Nest application context, dedicated restricted credentials, no HTTP                                               | API independence                      | Startup, shutdown, privilege        | Actual Docker/process/PG and canonical CI            |

## Milestones

- [ ] M1: additive worker ADR, application context, Docker/custody/grants/flags.
- [ ] M2: durable queue/admission/scheduler/lease and disable/delete integration.
- [ ] M3: source identities, conditional staging, retention/provenance.
- [ ] M4: processing manifest, versions/outcomes and atomic completion.
- [ ] M5: provider ports, API/SDK, existing Drawer, monitoring, full verification.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

PostgreSQL queue/worker, independent source identity and current staging, API/UI
transport, restricted runtime custody, execution/retention/operational contracts.

### Canonical owners

Architecture overview/backend/database/runtime/api-contract/frontend; operations
configuration/testing/deployment; new additive Sync ADR and this task.

### Documentation verification

Run pnpm docs:check, pnpm preflight:check and pnpm format:check.

## Evidence

| Claim                   | Evidence                                                                                   | Date       | Result |
| ----------------------- | ------------------------------------------------------------------------------------------ | ---------- | ------ |
| Initial plan governance | preflight/docs found metadata formatting errors before code; corrected to canonical format | 2026-11-02 | FAIL   |

## Blockers and limitations

No authorized Uniship fetch/payload/retention contract or Shipment schema/handler.
No approved Customer sync mapping/actor command. Ports/mock verification must not
be called live integration. No default retention period or destructive cleanup.
Host disk25MiB free; RAM worktree preserves existing work. Final CI required.

## Implementation checkpoint

M1–M5 code is being integrated; no milestone is claimed fully verified.
Initial source policy tests RED (missing module), then2/2 PASS. Local boundaries,
docs and preflight PASS. Host genuine Prisma generation FAIL with binaries.prisma.sh
403; API typecheck is NOT PASS without generated client. OpenAPI generation and
SDK generation executed. First Web typecheck found an interval union mismatch;
fix underway. Docker build-cache cleanup recovered4GiB, no user volumes removed.
Snapshot received formatting-only normalization before initial publication; raw
digest above is pinned, architecture unchanged.

Independent Round1 identified cross-page manifest version deadlock, rejected
retention reprocessing and missing record retry decisions. Implemented coalescing,
resolved identity metadata and typed retry/backoff; real PG regression execution
required before closure. Provider/domain/production gates remain unavailable.
