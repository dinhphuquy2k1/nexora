# NEXORA-046 — Production HTTPS acceptance

Status: PLANNED
Capability: PLANNED
Verification: NOT VERIFIED

## Origin

[NEXORA-024](../completed/NEXORA-024-public-https-ingress.md) production gates that CI cannot verify.

## Scope

dated evidence from the actual approved environment: domain/DNS ownership and A/AAAA; trusted TLS issuance, renewal timer and safe reload; container bindings, private bypass and firewall. Starts only when a production environment exists.

Owner2026-11-28 [project policy](../../ai/PROJECT_RULES.md#explicit-owner-authorization-for-backup-and-restore) removes all historical backup/restore production prerequisites. Do not add backup-related acceptance or follow-up; absence is not a blocker. Existing host/TLS/NTP/security requirements remain.

## Documentation Impact

Documentation Impact: NONE

### Reason

Planning stub; impact is assessed when the task starts.

## Evidence

| Claim                                                     | Evidence                                    | Date       | Result |
| --------------------------------------------------------- | ------------------------------------------- | ---------- | ------ |
| Follow-up scope recorded from NEXORA-024 production gates | Created by NEXORA-043 task closure (PR #42) | 2026-11-12 | PASS   |
