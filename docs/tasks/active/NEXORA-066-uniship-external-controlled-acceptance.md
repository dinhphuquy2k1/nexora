# NEXORA-066 — Uniship external controlled acceptance

Status: PLANNED
Capability: PLANNED
Verification: NOT VERIFIED

## Origin and scope

Transferred external/production acceptance from completed NEXORA-058 by NEXORA-065.
No implementation or live execution is authorized here. Use the existing
[canonical external matrix and staged runbook](../evidence/NEXORA-058/external-gates-and-runbook.md),
[Uniship contract](../../integrations/uniship-portal-api.md), ADR007 and
[actual host HTTPS acceptance046](NEXORA-046-production-https-acceptance.md).
Do not create another conflicting runbook or infer live readiness from technical CI.

## Acceptance transferred — all unverified

- Current scoped Uniship authorization, account identity and exposed-token/cookie
  rotation/custody evidence; live auth/verify contract under separate go-live permission.
- Actual production host/TLS/NTP/firewall/backup/restore and independent credential custody.
- First separately authorized MANUAL_ONLY FULL, stable parcel identity and live
  cross-page consistency; complete/partial snapshot and service null/false observations.
- Mandatory three-parcel milestone/timezone comparison after first real manual sync,
  before AUTO. Preserve owner UTC+7 decision/conflicting observation; stop on7h mismatch,
  use a separate correction task and provider-owned resync, never direct SQL repair.
- Natural claim/OldStatus lifecycle, monetary alternatives/units, main-count source
  and child maxima/partial snapshot observations still missing from canonical ledger.
- Explicit owner approval of all reconciliation thresholds, qualified baseline and
  natural visibility acceptance before any hide/restore production configuration.
- Separate owner decision for AUTOMATIC activation only after all preceding gates;
  approved >=60minute interval, stop/drift and rollback readiness.

UNISHIP_LIVE_CONTRACT_VERIFIED remains false. No live call, production policy,
threshold or MANUAL/AUTO activation is performed or granted by this planning record.
Future execution requires a scoped plan/reuse/design review under current workflow.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Named owner of058's transferred external acceptance; no acceptance has passed.

### Canonical owners

This planning task; existing058 matrix/runbook, integration contract and046 host
acceptance remain their canonical authorities.

### Documentation verification

pnpm docs:check; no live verification.

## Evidence

| Claim                                    | Evidence                                                                                                              | Date       | Result |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| External gates transferred, not executed | NEXORA-065 first-commit closure of merged058; canonical matrix/runbook retained; all acceptance above remains NOT RUN | 2026-11-27 | PASS   |
