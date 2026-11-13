# NEXORA-044 — Provider length single source

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Origin

[NEXORA-042](../completed/NEXORA-042-sync-extension-architecture.md), PLAN ISSUE PROVIDER_LENGTH_SINGLE_SOURCE.

## Scope

sync-capability.registry.ts checks providerName.length > 32 with a literal; schema.prisma declares provider VarChar(32) in CarrierConnection, SecurityAuditEvent, SyncJob, SyncSourceIdentity, SyncProviderBudget. Introduce one owned constant (expected owner: Carrier domain, apps/api/src/carrier/domain/carrier.ts), use it in the registry and add a DB parity test.

## Design Review & Reuse Decision

Task ID: NEXORA-044
Classification: BOUNDED
Plan revision: rev-2026-11-13-provider-length-v1
Reviewed baseline: f32101e6bda74e1e13dc195fbbad3823974dcdde
Branch: refactor/provider-length-single-source
Design Snapshot: docs/tasks/design-reviews/NEXORA-044-rev-2026-11-13-provider-length-v1.md
Design SHA-256: a1fc997f18d5e3b7e61ce2ca37f4f627d56ba7ef29a954e3a286124ec1b77f19

| Field                    | Decision                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Provider column length limit shared by Carrier, Sync and audit persistence                                                                                                                                                                                                            |
| Existing implementations | literal 32 in apps/api/src/sync/infrastructure/sync-capability.registry.ts; VARCHAR(32) provider columns in carrier_connections, security_audit_events, sync_jobs, sync_source_identities, sync_provider_budget; CarrierProvider vocabulary in apps/api/src/carrier/domain/carrier.ts |
| Domain owner             | Carrier domain (owns carrier provider vocabulary)                                                                                                                                                                                                                                     |
| Reuse alternatives       | keep literal; constant in packages/shared; constant in sync; constant in Carrier domain next to CarrierProvider                                                                                                                                                                       |
| Selected approach        | CARRIER_PROVIDER_MAX_LENGTH in carrier.ts, imported by the Sync registry; DB parity fixture in the existing migrated Sync integration suite                                                                                                                                           |
| Rationale                | one owner for provider vocabulary; Sync already imports carrier/domain (ConnectionStatus); parity test is the only guard that ties the TypeScript constant to actual column lengths                                                                                                   |
| Risks                    | constant and column lengths drift; a new table adds a provider column without the guard                                                                                                                                                                                               |
| Verification             | registry unit test (limit accepted, limit+1 rejected); PostgreSQL parity fixture over the exact provider-column table set; hosted Preflight, Sync Targeted and Foundation                                                                                                             |

## Plan

1. Record and format the versioned snapshot; hash raw bytes before tests.
2. Add registry boundary and migrated PostgreSQL parity tests; execute RED before implementation.
3. Implement the Carrier-owned constant and replace the Sync registry literal.
4. Synchronize database and Sync extension documentation.
5. Run local build, Sync units/integration where available, formatting, lint, documentation, governance, boundaries and quality where resources permit; preserve snapshot digest.
6. Publish a new PR and verify final-head Preflight, Sync Targeted and Foundation; retain all failed attempts and permit only one bounded runtime/HTTPS failed-job rerun when the diff does not affect that code.
7. Close after merge under §1.7 together with NEXORA-043 in a separate documentation PR; link resolution of the completed NEXORA-042 PLAN ISSUE there, not in this PR.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Provider column length has one TypeScript source, CARRIER_PROVIDER_MAX_LENGTH in the Carrier domain, guarded by a DB parity test; the Sync registry uses it.

### Canonical owners

- docs/architecture/database.md
- docs/architecture/sync-extensions.md

### Documentation verification

pnpm docs:check, preflight:check, format:check.

## Evidence

| Claim                                                                             | Evidence                                                                                                                                                                                                                                                                                                                                            | Date       | Result |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Follow-up scope recorded from NEXORA-042 PLAN ISSUE PROVIDER_LENGTH_SINGLE_SOURCE | Created by NEXORA-043 task closure (PR #42)                                                                                                                                                                                                                                                                                                         | 2026-11-12 | PASS   |
| Registry RED before implementation                                                | node --test apps/api/test/sync/capability.test.cjs on 75400be working tree with new tests: 13 PASS / 1 FAIL, exit 1; undefined !== 32 because Carrier constant is not exported yet; prerequisite npx --yes pnpm@10.34.6 --filter @nexora/api... build PASS                                                                                          | 2026-11-13 | FAIL   |
| Genuine PostgreSQL integration RED before implementation                          | node --test integration/sync-integration.test.cjs from apps/api against owned disposable postgres:17.11-bookworm, real migrate deploy; 53 tests, 51 PASS / 2 FAIL (new parity subtest plus enclosing suite), 0 skipped, exit 1; provider columns match CARRIER_PROVIDER_MAX_LENGTH fails undefined !== 32, actual column table set/type checks pass | 2026-11-13 | FAIL   |
| Frozen prerequisites                                                              | npx --yes pnpm@10.34.6 install --frozen-lockfile --offline; all 7 workspaces, 427 packages reused, exit 0                                                                                                                                                                                                                                           | 2026-11-13 | PASS   |
| GREEN prerequisite build                                                          | npx --yes pnpm@10.34.6 --filter @nexora/api... build: genuine Prisma 7.10.0 generation, database/shared/API TypeScript builds, exit 0                                                                                                                                                                                                               | 2026-11-13 | PASS   |
| GREEN Sync units                                                                  | node --test apps/api/test/sync/\*.test.cjs: 26/26 PASS, 0 skipped, exit 0; exact-limit accepted and limit+1 rejected                                                                                                                                                                                                                                | 2026-11-13 | PASS   |
| GREEN genuine PostgreSQL parity and Sync regressions                              | node --test integration/sync-integration.test.cjs from apps/api using owned disposable postgres:17.11-bookworm with authentic Prisma migrations: 53/53 PASS, 0 skipped, exit 0; provider columns match CARRIER_PROVIDER_MAX_LENGTH PASS; exact five provider columns are character varying length 32; owned container cleanup exit 0                | 2026-11-13 | PASS   |
| Formatting                                                                        | npx --yes pnpm@10.34.6 format:check: exit 0                                                                                                                                                                                                                                                                                                         | 2026-11-13 | PASS   |
| Architectural lint                                                                | npx --yes pnpm@10.34.6 lint: boundaries and ESLint PASS, exit 0                                                                                                                                                                                                                                                                                     | 2026-11-13 | PASS   |
| Documentation validation                                                          | npx --yes pnpm@10.34.6 docs:check: exit 0                                                                                                                                                                                                                                                                                                           | 2026-11-13 | PASS   |
| Static preflight                                                                  | npx --yes pnpm@10.34.6 preflight:check: exit 0, local structural mode                                                                                                                                                                                                                                                                               | 2026-11-13 | PASS   |
| Documentation regressions                                                         | npx --yes pnpm@10.34.6 test:docs: 10/10 PASS, 0 skipped, exit 0                                                                                                                                                                                                                                                                                     | 2026-11-13 | PASS   |
| Preflight regressions                                                             | npx --yes pnpm@10.34.6 test:preflight: 24/24 PASS, 0 skipped, exit 0                                                                                                                                                                                                                                                                                | 2026-11-13 | PASS   |
| Boundary guard                                                                    | node scripts/boundaries.mjs: exit 0                                                                                                                                                                                                                                                                                                                 | 2026-11-13 | PASS   |
| Scope and snapshot review                                                         | git diff origin/main --stat contains exactly the nine owner-listed files; no schema/migration/API/SDK/vocabulary/production-registration or other task changes; raw snapshot SHA-256 remains a1fc997f18d5e3b7e61ce2ca37f4f627d56ba7ef29a954e3a286124ec1b77f19; skill-guided BOUNDED self-review finds no confirmed P1/P2 (not independent approval) | 2026-11-13 | PASS   |

Local GREEN commands above ran on test-first HEAD 9113c84 with the reviewed
implementation/documentation working delta, subsequently committed unchanged as
the implementation commit preceding this evidence publication. Host Node24.22.1,
pnpm10.34.6; real owned PostgreSQL17.11. Detailed logs remain execution scratch,
not Git artifacts. Hosted final-head provenance is recorded in the PR after runs.

### Verification not executed locally

`API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`:
NOT RUN locally due to limited execution filesystem capacity (727 MB free during
the migrated integration run on the 7.9 GB workspace). No full host quality PASS
is claimed; final-head hosted Foundation must supply canonical Docker quality,
migrations/integration and runtime/HTTPS/persistence/development verification.
Hosted Preflight, Sync Targeted and Foundation are pending publication. Closure of
NEXORA-043/044 and the completed NEXORA-042 resolution link are deferred until after
merge in the separate documentation PR explicitly requested by the owner.
