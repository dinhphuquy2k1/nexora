# NEXORA-058 — external evidence and controlled activation runbook

Date: 2026-11-24 (Asia/Ho_Chi_Minh). This is technical preparation. No live call,
production activation, password rotation or production reconciliation threshold was
performed by the agent. Owner-reported observations retain their existing confidence;
mock HTTP and synthetic PostgreSQL tests do not upgrade them to live VERIFIED.
Canonical field evidence remains in [the integration contract](../../../integrations/uniship-portal-api.md).

## Current owner policy — 2026-11-28

[Canonical explicit-owner policy](../../../ai/PROJECT_RULES.md#explicit-owner-authorization-for-backup-and-restore) supersedes all older mandatory backup/restore gates, including historical058 task text. Do not copy/archive/clone/snapshot assets, perform recovery drills or introduce related work without a specific owner request. Missing backups do not block activation review or production acceptance. Preserve current persistence, credential/key access control and security; existing disposable fixtures remain unchanged. The original evidence date/outcomes above remain historical.

## Evidence matrix

| Contract                    | Existing evidence                                                                                                                                                  | Confidence                                                             | Remaining gate                                                                                      | Verification method                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Authorization/account       | ADR-007 owner approval for own account, four read/auth routes (2026-11-15), and `owner risk acceptance` + explicit live-gate opening authorization (2026-11-28)    | Owner confirmed scope & risk acceptance                                | Runtime config on target host (`MANUAL_ONLY`, `UNISHIP_LIVE_AUTHORIZED=true`, `SYNC_ENABLED=false`) | Apply private runtime ENV on target host; never claim historical credentials were invalidated |
| Auth/verify                 | Existing Carrier contract, redacted captures, Postman invalid-token `HTTP 400 Error decoding signature.`, and mock/Postgres tests                                  | Fixture-backed + owner invalid-token observation                       | First real owner UI Connect/Reconnect verification (`NEXORA-068`)                                   | Owner-controlled manual UI Connect/Reconnect under `SYNC_ENABLED=false`                       |
| Token rejection/expiry      | Owner Postman `400 Error decoding signature.` on `/client/api-token-verify/` (`TOKEN_REJECTED`); single recovery + mock expiry tests; expired token `NOT VERIFIED` | Technical + owner invalid-token observed; expiry waived pre-activation | Observe natural expiry post-activation; no manufactured outage                                      | Record sanitized counts/outcome and lifecycle/job IDs                                         |
| Provider ID stability       | Canonical uniship-parcel-v1 and immutable raw-ID derivatives                                                                                                       | Technical identity invariant                                           | Same real parcel ID stable across repeat FULL/account pages                                         | Compare owner-redacted IDs over repeated authorized FULLs                                     |
| Cross-page consistency      | FULL100/filter/fingerprint and reconciliation v3 tests                                                                                                             | Technical consistency, no snapshot-isolation claim                     | Live ID uniqueness/count consistency during page traversal                                          | Owner observes first FULL and later repeat; keep anomalies, do not auto-repair                |
| Claim lifecycle             | Selected status13/OldStatus mappings and derived fixtures                                                                                                          | Limited owner capture                                                  | Opening/update/ending capture still absent                                                          | Natural redacted lifecycle observations, no provider-side test edits                          |
| OldStatus                   | Known fallback/status handling in current mapping                                                                                                                  | Partially confirmed                                                    | Actual business meaning across claim cases                                                          | Owner supplies corresponding UI/API observations                                              |
| Monetary units              | Owner-confirmed ProductAmount1000→UI¥1,000 and VND suffix fees; prior samples                                                                                      | Owner confirmed listed fields                                          | Alternative non-VND/null-only fee meanings remain unknown                                           | Collect naturally populated redacted alternatives before extending mapping                    |
| Service null/false          | Four service flags/labels confirmed2026-11-20; numeric1/0/null mappings                                                                                            | Owner confirmed labels; technical tri-state                            | Live complete/partial service snapshot semantics                                                    | Compare repeated real payload/UI; do not infer flags from fees                                |
| Complete/partial snapshots  | Existing authoritative supplied-array semantics and no-policy ingestion                                                                                            | Technical contract selection                                           | External omission/deletion semantics                                                                | Owner observes real resyncs; keep hide disabled until approved                                |
| Counts/child maxima         | NumberOfPack declared count owner decision; itemCount23 confirmed; bounded child tests                                                                             | Confirmed selected fields; technical bounds                            | UI main-count source and actual child maxima unknown                                                | Redacted weighed/delivered samples; task separately if limits differ                          |
| Timestamp/export precedence | UTC+7 policy retained by owner2026-11-20; explicit export preferred; conflicting MD59639 preserved                                                                 | Owner decision with unresolved observation                             | Mandatory comparison of three real parcels before AUTO                                              | Compare same milestones in Nexora/Uniship UI after first manual FULL; stop if7h mismatch      |
| Rate/stop/drift             | Nexora<=1request/s completion-based safeguard, >=60min AUTO, hard-close                                                                                            | Technical local policy, no provider quota claim                        | Host/TLS/NTP/existing-custody readiness and provider stop channel                                   | Owner readiness checklist and fixed-code monitoring/stop drill                                |
| Reconciliation              | Existing v3 synthetic baseline/hide/restore and no-policy skip                                                                                                     | Technical only                                                         | Owner approves all three thresholds and ID/query/source gates                                       | Homogeneous deployment; qualified first FULL establishes baseline; natural observations only  |

## Stage 0 — safe deployment

Deploy a reviewed source revision. Run forward migrations before role
re-provisioning and runtime start; retain current data/volumes/credentials/keys. No backup/restore prerequisite remains. Never reset volumes or rotate shared credentials
to make verification pass. Confirm API nexora_app versus Worker nexora_sync, private
function ACLs, independent Carrier key versions (`CARRIER_KEYRING_JSON`), restricted
mounts and identical frozen settings. Keep `SYNC_ENABLED=false`, `UNISHIP_LIVE_AUTHORIZED=false`,
blank `UNISHIP_ACTIVATION_POLICY_JSON`, and blank `UNISHIP_RECONCILIATION_POLICY_JSON` on
Stage 0 deployments (even with `UNISHIP_LIVE_CONTRACT_VERIFIED=true` opened in source per
the 2026-11-28 ADR-007 amendment).
Check host, storage, TLS, time/NTP and chosen deployment profile: under
`DEPLOYMENT_PROFILE=PUBLIC_HTTPS`, `verifyPublicStartup` enforces all ACTIVE ADMINs
enrolled as a startup gate, whereas `LOCAL` Mode A startup still requires MFA enrollment
before any interactive ADMIN login/use. Stage 0 hosts fail closed for external Carrier
requests until `UNISHIP_LIVE_AUTHORIZED=true` and parsed `UNISHIP_ACTIVATION_POLICY_JSON`
are configured together.

## Stage 1 — separately authorized manual activation

Under the 2026-11-28 ADR-007 amendment (`NEXORA-067` v2), the owner accepted historical
test-account token/cookie risk (`owner risk acceptance`, waiving mandatory password
rotation before gate opening), waived pre-activation live expired-token verification (`NOT
VERIFIED`; to be observed post-activation), supplied observed `/client/api-token-verify/`
invalid-token evidence (`HTTP 400 Bad Request` `{"non_field_errors":["Error decoding signature."]}`),
confirmed one-year token lifetime (nullable expiry metadata preserved), and explicitly
authorized opening `UNISHIP_LIVE_CONTRACT_VERIFIED = true`. Parsed `UNISHIP_ACTIVATION_POLICY_JSON`
presence (`activationConfigured`) remains required on the same external transport `target()`
alongside `UNISHIP_LIVE_AUTHORIZED=true`, and exact context/verified scope checks stay.

With the source gate opened (`UNISHIP_LIVE_CONTRACT_VERIFIED=true`), Stage 1 operator
rollout deploys API and Worker with private account-scoped `MANUAL_ONLY` JSON (omitting
optional `connectionId` prior to initial UI creation; never commit real account values),
`UNISHIP_LIVE_AUTHORIZED=true`, `SYNC_ENABLED=false` (Carrier only; no manual FULL in
`NEXORA-067`), and blank `UNISHIP_RECONCILIATION_POLICY_JSON`. Source-level gate opening
does not certify target-host Stage 0 runtime readiness (`CARRIER_KEYRING_JSON`, active
USER/MFA, profile host/TLS/origins) or `NEXORA-068` real data acceptance. Existing
onboarding enabled60 schedules are preserved; `MANUAL_ONLY` blocks their AUTO execution.

## Stage 2 — first manual FULL

Use the existing authenticated manual endpoint. Record source/account/job scope,
FULL100 query, fetched versus applied/rejected/visible counts, VALIDATED scan and
identity stability. Check Retail list, stats and detail; no duplicate parcel identity.
Absent policy must record SKIPPED/POLICY_NOT_CONFIGURED and cannot establish a trusted
reconciliation baseline. Do not equate observed count with applied/visible count.

## Stage 3 — mapping and timezone

Select three real parcels with warehouse milestones; compare identical milestones
in Nexora and Uniship UI and retain sanitized evidence. Current source interpretation
stays Vietnam local UTC+7→stored UTC, Web Asia/Ho_Chi_Minh. If7hours off, keep AUTO off,
stop scheduling, create a separate timezone correction task and re-sync through the
existing provider-owned version pipeline. Never patch timestamps directly in SQL.

## Stage 4 — reconciliation

Owner explicitly approves maxNewlyMissing, maxMissingRatioBps and
maxObservedDropRatioBps after external ID/query/source gates. No values here are
production defaults. Drain both processes and deploy identical policy. The first
qualified FULL establishes baseline; SKIPPED/no-policy scans cannot substitute.
Inspect natural hide/restore cases and existing synthetic tests; never delete/edit
live Uniship parcels to manufacture a scenario. Fingerprint changes require explicit
migration/repair policy and never silently replace a trusted baseline.

## Stage 5 — automatic scheduling

Only after mandatory gates and a separate owner decision switch approved scope to
AUTOMATIC. Keep persisted schedule enabled and approved interval>=60minutes.15/30
intent is preserved but blocked, not rewritten. Observe first AUTO, completion-based
next_run_at and no overlapping active lane. Manual admission remains independent of
enabled/due. Disabling a schedule alone does not cancel active work.

## Stage 6 — incidents, shutdown and rollback

For provider stop, repeated429, rejection, invalid envelopes/widespread unknown
statuses, repeated reconciliation skips, wrong visibility, timezone mismatch, DB
contention or policy change: close activation/global capability first, disable
schedules as appropriate, stop/drain Worker and API, and revoke epoch/credentials via
existing owner controls when immediate fencing is required. Preserve sanitized error
codes/job scope and historical failures; do not add request retries or widen timeouts.
Review account-specific cooldowns and contract drift before resuming. A failed recovery
or lifecycle change invalidates the old job; a fresh manual job uses the recovered
credential only after normal admission. Do not revive stale jobs or reapply staging.

On shutdown the Worker stops its existing loop before runtime clients close; runtime
aborts/drains recovery, per-dispatch and acquisition operations. No HTTP or wait holds
DB row locks; Worker credential and runtime audit queries have short lock/statement
bounds. On rollback drain old executions, deploy a compatible homogeneous revision,
retain migrations/data/key history, recheck restricted grants and restart OFF. Do not
roll back security by granting broad secrets access or substituting admin credentials.

## Stage 1 clarification — NEXORA-067 final review & v2 authorization (2026-11-28)

The [focused live-gate ledger](../../../integrations/uniship-portal-api.md#live-gate-review--nexora-067-2026-11-28)
records the 2026-11-28 owner confirmations (`Token lifetime: one year, owner-confirmed`,
Postman invalid-token `HTTP 400 Error decoding signature.` on `/client/api-token-verify/`
mapped to `TOKEN_REJECTED`, waived expired-token pre-gate `NOT VERIFIED`, `owner risk
acceptance` waiving historical test-account password rotation prior to opening, and
explicit authorization for `UNISHIP_LIVE_CONTRACT_VERIFIED = true`). External-positive
transport, runtime composition, `SyncOFF` Connect/Reconnect, HTTP `400` verify, and
isolated `!this.activationConfigured` mutation checks are executed under mocked HTTP
boundaries (`globalThis.fetch`) without live network calls. Target-host Stage 0/Stage 1
runtime readiness and actual live UI/Sync acceptance remain outside `NEXORA-067` under
`NEXORA-068` (and `NEXORA-046` for `PUBLIC_HTTPS`).
