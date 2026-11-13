# NEXORA-044 — Provider length single source

Status: PLANNED
Capability: PLANNED
Verification: NOT VERIFIED

## Origin

[NEXORA-042](../completed/NEXORA-042-sync-extension-architecture.md), PLAN ISSUE PROVIDER_LENGTH_SINGLE_SOURCE.

## Scope

sync-capability.registry.ts checks providerName.length > 32 with a literal; schema.prisma declares provider VarChar(32) in CarrierConnection, SyncJob, SyncSourceIdentity, SyncJobItem, SyncProviderBudget. Introduce one owned constant (expected owner: Carrier domain, apps/api/src/carrier/domain/carrier.ts), use it in the registry and add a DB parity test.

## Documentation Impact

Documentation Impact: NONE

### Reason

Planning stub; impact is assessed when the task starts.

## Evidence

| Claim                                                                             | Evidence                                    | Date       | Result |
| --------------------------------------------------------------------------------- | ------------------------------------------- | ---------- | ------ |
| Follow-up scope recorded from NEXORA-042 PLAN ISSUE PROVIDER_LENGTH_SINGLE_SOURCE | Created by NEXORA-043 task closure (PR #42) | 2026-11-12 | PASS   |
