# NEXORA-058 — Uniship controlled activation

Status: PLANNED
Capability: PLANNED
Verification: NOT VERIFIED

## Origin

Future task named by the owner in NEXORA-056. Retains external prerequisites from
[NEXORA-055](../completed/NEXORA-055-shipment-services.md) closure and the canonical
[Uniship contract](../../integrations/uniship-portal-api.md).

## Scope

UNISHIP_LIVE_ACTIVATION and remaining ADR007/live-environment, operational custody, hard-gate and owner-controlled activation prerequisites. Requires verified adapter contracts from NEXORA-057 and explicit activation evidence; no implementation or live request is authorized by this planning stub.

Complete the required SIGNIFICANT pre-code review and versioned plan before starting.
This is a planning stub only; no snapshot or runtime implementation is claimed.

## Documentation Impact

Documentation Impact: NONE

### Reason

Follow-up scope bookkeeping only; assess implementation impact when this task starts.

## Evidence

| Claim              | Evidence                                                                                               | Date       | Result |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| follow-up-recorded | Named prerequisite transferred during NEXORA-055 closure in NEXORA-056; execution remains NOT VERIFIED | 2026-11-16 | PASS   |

## Additional prerequisites transferred from NEXORA-056 closure

PR55 merge a19aa0d2532b41135a90c6e48e3b6876471ad343 on2026-11-16 closes the
implementation under §1.7. Historical HTTPS/MFA runs43838009175 attempts1/2 and
43848285718 remain FAIL; cause UNKNOWN. Later source3f8aef9 Foundation43889980798
PASS4–10 is current execution evidence, not a causal fix. Before relying on live
activation, retain canonical HTTPS/MFA/runtime gates and actual host/key/certificate/
NTP/custody evidence; no production readiness is inferred from fixture CI. Causal
investigation resumes only on recurrence with bounded diagnostics or a separately
planned targeted reproducer with a concrete hypothesis and observable discriminant.
No new workflow retry or live request is authorized by this bookkeeping entry.

| Claim                    | Evidence                                                                                                                                                                                                                                      | Date       | Result |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Follow-up scope retained | Transferred at NEXORA-056 closure by NEXORA-057; [completed056](../completed/NEXORA-056-auto-provision-sync-configuration.md) retains original FAIL/NOT RUN and final source CI provenance; external/causal verification remains NOT VERIFIED | 2026-11-16 | PASS   |
