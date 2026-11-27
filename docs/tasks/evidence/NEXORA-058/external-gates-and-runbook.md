# NEXORA-058 — external evidence and controlled activation runbook

Date: 2026-11-24 (Asia/Ho_Chi_Minh). This is technical preparation. No live call,
production activation, password rotation or production reconciliation threshold was
performed by the agent. Owner-reported observations retain their existing confidence;
mock HTTP and synthetic PostgreSQL tests do not upgrade them to live VERIFIED.
Canonical field evidence remains in [the integration contract](../../../integrations/uniship-portal-api.md).

## Evidence matrix

| Contract                    | Existing evidence                                                                                  | Confidence                                         | Remaining gate                                                                                       | Verification method                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Authorization/account       | ADR-007 owner approval for own account and four read/auth routes2026-11-15                         | Owner confirmed scope                              | Current scoped account, rotation of historically exposed tokens/cookies, separate go-live permission | Owner supplies redacted authorization/rotation record; never send credentials in evidence    |
| Auth/verify                 | Existing Carrier contract and redacted captures; real mock HTTP tests                              | Fixture-backed technical                           | Current live schema/verified identity for the approved account                                       | Owner-controlled manual auth/verify under separate authorization                             |
| Token rejection/expiry      | Existing single recovery, audit-before-decrypt, expired/midpage401 mock tests                      | Technical only                                     | Observe safe live rejection/expiry naturally; no manufactured live outage                            | Record sanitized counts/outcome and lifecycle/job IDs                                        |
| Provider ID stability       | Canonical uniship-parcel-v1 and immutable raw-ID derivatives                                       | Technical identity invariant                       | Same real parcel ID stable across repeat FULL/account pages                                          | Compare owner-redacted IDs over repeated authorized FULLs                                    |
| Cross-page consistency      | FULL100/filter/fingerprint and reconciliation v3 tests                                             | Technical consistency, no snapshot-isolation claim | Live ID uniqueness/count consistency during page traversal                                           | Owner observes first FULL and later repeat; keep anomalies, do not auto-repair               |
| Claim lifecycle             | Selected status13/OldStatus mappings and derived fixtures                                          | Limited owner capture                              | Opening/update/ending capture still absent                                                           | Natural redacted lifecycle observations, no provider-side test edits                         |
| OldStatus                   | Known fallback/status handling in current mapping                                                  | Partially confirmed                                | Actual business meaning across claim cases                                                           | Owner supplies corresponding UI/API observations                                             |
| Monetary units              | Owner-confirmed ProductAmount1000→UI¥1,000 and VND suffix fees; prior samples                      | Owner confirmed listed fields                      | Alternative non-VND/null-only fee meanings remain unknown                                            | Collect naturally populated redacted alternatives before extending mapping                   |
| Service null/false          | Four service flags/labels confirmed2026-11-20; numeric1/0/null mappings                            | Owner confirmed labels; technical tri-state        | Live complete/partial service snapshot semantics                                                     | Compare repeated real payload/UI; do not infer flags from fees                               |
| Complete/partial snapshots  | Existing authoritative supplied-array semantics and no-policy ingestion                            | Technical contract selection                       | External omission/deletion semantics                                                                 | Owner observes real resyncs; keep hide disabled until approved                               |
| Counts/child maxima         | NumberOfPack declared count owner decision; itemCount23 confirmed; bounded child tests             | Confirmed selected fields; technical bounds        | UI main-count source and actual child maxima unknown                                                 | Redacted weighed/delivered samples; task separately if limits differ                         |
| Timestamp/export precedence | UTC+7 policy retained by owner2026-11-20; explicit export preferred; conflicting MD59639 preserved | Owner decision with unresolved observation         | Mandatory comparison of three real parcels before AUTO                                               | Compare same milestones in Nexora/Uniship UI after first manual FULL; stop if7h mismatch     |
| Rate/stop/drift             | Nexora<=1request/s completion-based safeguard, >=60min AUTO, hard-close                            | Technical local policy, no provider quota claim    | Host/TLS/NTP/backup/custody readiness and provider stop channel                                      | Owner readiness checklist and fixed-code monitoring/stop drill                               |
| Reconciliation              | Existing v3 synthetic baseline/hide/restore and no-policy skip                                     | Technical only                                     | Owner approves all three thresholds and ID/query/source gates                                        | Homogeneous deployment; qualified first FULL establishes baseline; natural observations only |

## Stage 0 — safe deployment

Deploy a reviewed source revision. Back up and run forward migrations before role
re-provisioning and runtime start. Never reset volumes or rotate shared credentials
to make verification pass. Confirm API nexora_app versus Worker nexora_sync, private
function ACLs, Carrier key versions, restricted mounts and identical frozen settings.
Check host, storage, TLS, time/NTP, backups and chosen deployment profile. Keep
SYNC_ENABLED=false, blank activation and the immutable external live hard-close.
No ENV combination can open the current hard-coded contract gate.

## Stage 1 — separately authorized manual activation

Owner closes remaining pre-live gates, confirms approved account/login/connection,
rotates exposed historical tokens/cookies if required, and authorizes a separately
reviewed gate-opening change for the approved HTTPS origin. This PR does not do that.
Then set the exact activation scope to MANUAL_ONLY and deploy API/Worker together.
Do not configure reconciliation thresholds before auto-hide acceptance. Existing
onboarding enabled60 schedules are preserved; manual-only blocks their AUTO execution.

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
