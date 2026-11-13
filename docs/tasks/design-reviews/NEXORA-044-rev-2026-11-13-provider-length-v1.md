# NEXORA-044 — Provider length single source

## 1. Task metadata and classification

Task ID: NEXORA-044
Classification: BOUNDED
Plan revision: rev-2026-11-13-provider-length-v1
Reviewed baseline: f32101e6bda74e1e13dc195fbbad3823974dcdde
Branch: refactor/provider-length-single-source

## 2. Reuse & design audit

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

## 3. Plan

1. Record and format the versioned snapshot; hash raw bytes before tests.
2. Add registry boundary and migrated PostgreSQL parity tests; execute RED before implementation.
3. Implement the Carrier-owned constant and replace the Sync registry literal.
4. Synchronize database and Sync extension documentation.
5. Run local build, Sync units/integration where available, formatting, lint, documentation, governance, boundaries and quality where resources permit; preserve snapshot digest.
6. Publish a new PR and verify final-head Preflight, Sync Targeted and Foundation; retain all failed attempts and permit only one bounded runtime/HTTPS failed-job rerun when the diff does not affect that code.
7. Close after merge under §1.7 together with NEXORA-043 in a separate documentation PR; link resolution of the completed NEXORA-042 PLAN ISSUE there, not in this PR.
