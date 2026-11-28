# NEXORA-066 — Uniship external controlled acceptance

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

## Origin and current scope

Pre-live runtime readiness only; no live request, owner runtime mutation or merge.
Owner2026-11-28 establishes the project-wide
[explicit owner authorization policy](../../ai/PROJECT_RULES.md#explicit-owner-authorization-for-backup-and-restore).
It supersedes every older mandatory backup/restore prerequisite, including earlier
066 checklists and the backup portions of snapshotsv1–v3. Those design records and
executed historical outcomes stay immutable; they are not current instructions.
Missing backups do not block this task, merge, deployment or production acceptance.
No backup/restore work, substitute export/clone/snapshot, DR drill or follow-up is
created. Existing CI fixes and fixture tests remain unchanged by owner instruction.

## Design Review & Reuse Decision

Task ID: NEXORA-066
Classification: SIGNIFICANT
Plan revision: rev-2026-11-28-pre-live-readiness-v4
Reviewed baseline: 0f39dc821143a5c2ffdd33dc5a01ba75962ceaa4
Design Snapshot: docs/tasks/design-reviews/NEXORA-066-rev-2026-11-28-pre-live-readiness-v4.md
Design SHA-256: 21e94d713f8e4be0e3c155aba786080ae0bef3012b6d0caba90c1b28fa2676c0

Material owner-policy revision. Reuse the canonical operations documents and058
activation stages; no new runbook, application policy, framework or task.

| Field                    | Decision                                                                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Global no-backup policy; reduced runtime readiness checklist                                                                                                                                                                                                                           |
| Existing implementations | docs/ai/PROJECT_RULES.md; AGENTS.md; docs/operations/deployment.md; docs/operations/setup.md; docs/operations/configuration.md; docs/operations/testing.md; docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md; compose.yml; packages/database/scripts/provision-runtime.mjs |
| Domain owner             | Governance/operations; unchanged Identity, Carrier, Sync and Shipment contracts                                                                                                                                                                                                        |
| Reuse alternatives       | Per-task exception, substitute export/clone, global explicit-owner policy                                                                                                                                                                                                              |
| Selected approach        | Canonical mandatory policy, dated ADR amendments, remove active backup requirements and backup checklist; preserve existing runtime safety operations                                                                                                                                  |
| Rationale                | Owner scope controls work; no implied backup authorization or duplicate subsystem                                                                                                                                                                                                      |
| Risks                    | Stale gates; historical evidence rewritten; custody/persistence confused with copying assets; unrelated business recovery changed                                                                                                                                                      |
| Verification             | Global active-doc search; immutable snapshot/evidence comparison; pinned docs gates; independent read-only review; final-head hosted CI                                                                                                                                                |

No new Aggregate Root, port, DB operation or public contract. Persistence, existing
credentials/key versions, forward migrations, runtime-role isolation, MFA, exact
account-scoped activation, FULL100/query/mapping/timezone and pacing stay unchanged.
Shipment hide/restore, token/Worker recovery and MFA recovery codes are unrelated
to data backup and retain their contracts.

## Plan

1. Freeze formatted v4 and bind raw digest before documentation implementation.
2. Add canonical owner policy and route it from AGENTS; synchronize active ops/ADRs,
   runtime documentation,046 and058 stages. No new backup-related acceptance.
3. Replace066 backup checklist with runtime-only steps below. Preserve all historical
   Evidence rows and snapshots; explicitly supersede obsolete instructions.
4. Audit active requirements, run pinned docs checks, independent read-only review,
   commit/push and inspect final-head CI. Do not alter harnesses or rerun failed CI.

## Current readiness and limitations

Conclusion: **BLOCKED — EXTERNAL PREREQUISITES**. Remaining gates are confirmed
acceptance target, historical exposure invalidation by owner, remaining external
contract review, actual matching runtime upgrade/grants/key/MFA verification,
Stage1 empty-policy correction and separate live activation decision. Backup is
not a gate and must not be added again without a specific owner request.

Prior Windows observations (not fresh target inventory): ModeB,19/21 migrations,
three customers, no Shipment/Carrier/Sync records; one enrolled and two unenrolled
ACTIVE ADMINs; Carrier keyring absent; premature liveAuthorized=true while hard
gate remained false. Do not treat these dated counts as invariants. No target is
assumed from this workspace, and no actual upgrade/owner MFA has been executed here.

Owner account-scoped architecture and privately supplied identifiers remain unchanged;
do not publish them or request them again. Initial policy omits connectionId until
normal UI creation/verified existing connection. Account identity does not prove
exposure handling, external prerequisites or permission to open the live gate.
ADR007's owner authorization is not provider-published evidence. Preserve four exact
approved endpoints/origin; no customer endpoint, scraping, provider writes or live CI.

## Owner Execution Checklist — runtime only, no backup/restore

Use [Setup](../../operations/setup.md), [Configuration](../../operations/configuration.md)
and [Deployment](../../operations/deployment.md). These are owner instructions, NOT
operations performed by the agent. Confirm target/project and maintenance permission
before changing user containers. Never reset user volumes/data, replace credentials
or keys, or run disposable seeding/negative fixtures against the actual database.

1. **Identify actual target read-only.** In the reviewed checkout, use explicit
   project, private env-file and actual topology for every command. Inspect container
   labels, actual mounted named volumes, current source/image IDs, Web binding and
   disk. Standard uses compose.yml; current development uses compose.yml+compose.dev.yml.
   Do not assume default nexora or a fixed container name. Capture only sanitized
   observations, not asset copies, raw inspect/ENV output or provider payloads.
2. **Retain and configure OFF.** Privately edit the existing operator config without
   copying/archiving it or truncating/duplicating variables. Retain original Identity/
   Carrier material and all existing versions. API/Worker receive identical eleven
   Carrier/Sync settings; Worker has no Identity keys, Web no application keys and
   neither runtime has administrator DB custody. Keep SYNC_ENABLED=false,
   UNISHIP_LIVE_AUTHORIZED=false and both policy JSON values blank. Restart alone
   does not import new ENV; recreate after verified prerequisites.
3. **Carrier initialization only if necessary.** Authorized read-only key-version
   inventory must show no Carrier ciphertext needing an old key; verify no existing
   Carrier keyring and owner confirms first initialization. Otherwise preserve current
   custody; do not generate replacement keys. Use pinned Node randomBytes(32), validate
   with existing EnvironmentKeyring, ensure independence from Identity, and write
   directly to approved restricted existing operator configuration/secret custody
   without stdout, argv/history, duplicate variables or overwriting unrelated config.
   This is required first initialization, not a backup/copy/rotation mechanism. Never
   reset/re-enroll MFA or replace existing Identity material to make checks pass.
4. **Migrate/provision before application startup.** Confirm correct target and
   maintenance scope; drain/stop API/Web/Worker and external provisioning/schema/file
   writers using their actual topology. Preserve named volumes and current data.
   Build matching Standard images; run the existing init→healthy PostgreSQL→migrate→
   db-runtime chain. No old combined-loader binaries against migration21. Stop on
   any native failure; no blind retries/timeouts/grant changes. No backup prerequisite.

   PowerShell local helper and explicit source context (no raw error/config output):

   ```powershell
   $ErrorActionPreference = 'Stop'
   function Invoke-Native([string]$Executable, [string[]]$Arguments) {
       $result = @(& $Executable @Arguments 2>&1)
       if ($LASTEXITCODE -ne 0) { throw "Native command failed; stop and inspect privately." }
       return ($result -join "`n")
   }
   $SourceProject = Read-Host 'Confirmed source project'
   $SourceEnv = (Resolve-Path -LiteralPath (Read-Host 'Existing private env-file')).Path
   $Source = @('compose','-p',$SourceProject,'--env-file',$SourceEnv,'-f','compose.yml','-f','compose.dev.yml')
   $Standard = @('compose','-p',$SourceProject,'--env-file',$SourceEnv,'-f','compose.yml')
   # Execute only after target/topology/maintenance checks above have passed.
   $null = Invoke-Native docker ($Source + @('stop','api','web','sync-worker'))
   $null = Invoke-Native docker ($Source + @('down')) # Retain all volumes.
   $null = Invoke-Native docker ($Standard + @('build'))
   $null = Invoke-Native docker ($Standard + @('up','-d','--wait','postgres'))
   $null = Invoke-Native docker ($Standard + @('run','--rm','--no-deps','-T','migrate'))
   $null = Invoke-Native docker ($Standard + @('run','--rm','--no-deps','-T','db-runtime'))
   ```

   These one-offs use --no-deps only after matching images, init and healthy PG are
   verified. This block deliberately has no API/Worker/Web startup.

5. **Mandatory source pre-start review.** Set Check=Standard, never restore context.
   Read-only migration names/checksums must match reviewed migration files, with no
   unresolved failure. Validate actual table/column/function/PUBLIC/inherited ACL
   against canonical provision-runtime.mjs, not a role name/function count. Check
   legacy sync_carrier_load removed, runtime roles not elevated, matching image IDs,
   current data retained and resolved OFF configuration in memory. Stop on any
   missing/failed check; do not run database-runtime-smoke on owner data (it mutates
   disposable fixtures). No backup inventory, exported data or clone is required.

   Only after these checks were actually completed, use a separate confirmation
   before startup; do not type confirmation for NOT RUN/FAIL:

   ```powershell
   $confirmation = Read-Host ('After successful source migration/checksum/ACL/image/data-retention/OFF review, type VERIFIED ' + $SourceProject)
   if ($confirmation -cne ('VERIFIED ' + $SourceProject)) { throw 'Pre-start review incomplete' }
   $cfg = (Invoke-Native docker ($Standard + @('config','--format','json'))) | ConvertFrom-Json
   if ($cfg.name -cne $SourceProject) { throw 'Wrong source context' }
   foreach ($service in @('api','sync-worker')) {
       $e = $cfg.services.$service.environment
       if ($e.SYNC_ENABLED -cne 'false' -or $e.UNISHIP_LIVE_AUTHORIZED -cne 'false' -or -not [string]::IsNullOrEmpty($e.UNISHIP_ACTIVATION_POLICY_JSON) -or -not [string]::IsNullOrEmpty($e.UNISHIP_RECONCILIATION_POLICY_JSON)) { throw 'Source must remain OFF' }
   }
   $confirmation = $null # Consume before startup; failure does not authorize retry.
   $null = Invoke-Native docker ($Standard + @('up','-d','--wait','api','sync-worker','web'))
   ```

   Final up may repeat idempotent migration/provision dependencies; require success.

6. **Post-start health and actual custody.** Require PostgreSQL/API/Web health and
   Worker heartbeat, successful migration/provision exits, HTTP live/ready200 through
   Web proxy. Inspect actual compiled Node PID/ENV in memory (not the dev watcher
   probe), restricted actual DB connections nexora_app/nexora_sync, shared settings,
   secret mounts and Worker/Web key exclusions. Validate stored key-version coverage;
   it does not prove every ciphertext was decrypted. Owner uses existing ADMIN
   password+authenticator and confirms persisted administrative MFA assurance via
   the supported UI/API, without SQL sessions, resets or recovery-code substitution.
   LOCAL does not require all ACTIVE ADMINs enrolled; preserve the observed idle
   accounts. PUBLIC_HTTPS retains its all-relevant-ACTIVE-ADMIN startup gate.
   Populated Carrier ciphertext without an approved non-live verification path stays
   NOT VERIFIED; empty Carrier inventory is NOT APPLICABLE, never a live probe.
7. **Stop at Checkpoint A.** Keep hard gate false and runtime OFF; no connection,
   MANUAL_ONLY, live request, reconciliation or AUTO here. Preserve data/current
   keys/credentials; on failure stop/drain and retain sanitized incident diagnostics.
   Rollback means compatible binaries/config only, no automatic data restore or
   destructive down-migration. Missing backup is not a stop condition.

## Open PLAN ISSUE — unchanged Stage1 gate

uniship-sync.runtime.ts:40–61 returns on absent activation policy. Hard gatefalse
currently prevents external traffic; once opened later, empty policy with live flag
could allow Carrier authentication outside account scope even if Sync is disabled.
Separate gate-opening review must fail closed for external targets, retain loopback
fixtures and post-verify identity checks. This policy revision does not fix/open it.

## External acceptance retained, not performed

- Owner scoped authorization/exposure invalidation, live auth/verify under separate permission.
- Actual chosen host/profile, TLS/DNS/firewall/NTP and existing secret access control.
- First separately authorized MANUAL_ONLY FULL, stable IDs/cross-page consistency,
  selected field/service/claim semantics and repeat scan observations.
- Three-parcel milestone comparison before AUTO; retain UTC+7 until separate owner
  correction task if7h mismatch. No direct SQL timestamp repair.
- Explicit reconciliation thresholds and qualified baseline/natural hide/restore;
  separate AUTOMATIC decision with approved >=60minute interval and existing fences.

No backup/restore acceptance or deferred task survives this revision.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Project-wide explicit-owner-only backup/restore policy; obsolete active requirements
removed;066 checklist reduced to runtime readiness. Historical evidence preserved.

### Canonical owners

- docs/ai/PROJECT_RULES.md; AGENTS.md
- docs/operations/deployment.md, setup.md, configuration.md, testing.md
- docs/architecture/runtime.md; related ADRs and README
- active046/066; canonical058 activation runbook

### Documentation verification

Pinned format/docs/preflight/test:docs/test:preflight, active-doc consistency search,
unchanged snapshots/evidence checks, independent review and exact-source hosted CI.

## Evidence

Historical rows below are preserved verbatim. They record executed results only;
older backup-related scope/instructions are superseded, not current prerequisites.

| Claim                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Date       | Result |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| External gates transferred, not executed              | NEXORA-065 first-commit closure of merged058; canonical matrix/runbook retained; all acceptance above remains NOT RUN                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 2026-11-27 | PASS   |
| Baseline sync/runtime CI receipts verified            | PR #65 merge `a4ccfaf4cd54fd2a848e263e2c9551cad0c893fe` (`2026-11-28T04:17:48Z`), Preflight `46106872377` & Foundation `46106872352` (`140861483473`, steps 4–16 & 19 `SUCCESS`), PR #64 Sync V1 targeted `46018303745` (`140571044096`) `SUCCESS`; `NEXORA-064` & `NEXORA-065` closed cleanly in `2e5d638`                                                                                                                                                                                                                                                             | 2026-11-28 | PASS   |
| Read-only local runtime, DB, ENV & ADMIN inspection   | SQL/container probes on `nexora-postgres-1` (`PostgreSQL 17.11`, `9454 kB`, `19/21` migrations, `Case A` `0` Uniship rows, `1` enrolled owner-designated `ACTIVE ADMIN` (`key_version=1`) + `2` unenrolled `ACTIVE ADMIN`s) & `nexora-api-1`/`nexora-sync-worker-1` JSON key-length/env inspection (`CARRIER_KEYRING_JSON` unset, `UNISHIP_LIVE_AUTHORIZED="true"` in `.env`, `nexora-sync-worker-1` pre-PR #64)                                                                                                                                                        | 2026-11-28 | PASS   |
| Baseline host API unit, lint & contract checks        | On `a4ccfaf`: `pnpm --filter @nexora/api test` (`298/298`, `51` suites, `0` FAIL after host build), `pnpm lint` (`boundaries` + `eslint` exit `0`), `pnpm contracts:check` (`Contracts reproducible PASS`), `pnpm format:check`, `pnpm docs:check`, `pnpm preflight:check` PASS                                                                                                                                                                                                                                                                                         | 2026-11-28 | PASS   |
| Design snapshot integrity                             | Raw UTF-8 SHA-256 of `docs/tasks/design-reviews/NEXORA-066-rev-2026-11-28-pre-live-readiness-v1.md` verified LF-only (`30c175287ccaa48757224a0923388b0a228308b463958e2dce66f407d1ca1e53`) and bound via `validatePrTaskBinding` (`0` failures)                                                                                                                                                                                                                                                                                                                          | 2026-11-28 | PASS   |
| Design snapshot v1 digest correction                  | Corrected transcription typo in historical `v1` row above: verified LF raw UTF-8 digest of immutable `NEXORA-066-rev-2026-11-28-pre-live-readiness-v1.md` is `30c175287ccaa48757224a0923388b0a22e799086cb5745a0c6f0eae50c34d68` (matching `v1` PR metadata; `...228308b46...` was a transcription typo only)                                                                                                                                                                                                                                                            | 2026-11-28 | PASS   |
| Design snapshot v2 binding                            | Raw UTF-8 LF SHA-256 of `docs/tasks/design-reviews/NEXORA-066-rev-2026-11-28-pre-live-readiness-v2.md` verified (`81ff3baabfea00d9a48f3c92c1a37a7d88014d4486181c428571b0eca0a3f2ec`), `v1` snapshot byte-identical, bound under ADR-009 prior to script edits                                                                                                                                                                                                                                                                                                           | 2026-11-28 | PASS   |
| PR #66 initial Foundation CI (`04eb3a2` attempts 1–3) | `46110429506` failed across 3 distinct pre-existing harness bugs on `04eb3a2` (docs-only commit): Attempt 1 (`140872509193`: baseline `dev-smoke.sh:82` `api` unhealthy 102s after `--force-recreate`), Attempt 2 (`140878205177`: `public-https-browser.mjs:393` 118ms empty `DevToolsActivePort` race), Attempt 3 (`140882948905`: `dev-runtime-environment-probe.mjs:65` `DEV_ENV_ACTUAL_PROCESS_NOT_UNIQUE` 300ms after `api` `Healthy`)                                                                                                                            | 2026-11-28 | FAIL   |
| Baseline A RED characterization (CI harness v2)       | Unpatched harness verification (`node --test scripts/browser-startup-diagnostics.test.mjs scripts/dev-runtime-environment-probe.test.mjs scripts/smoke-checks.test.mjs` `3/3` fail + inline probe confirming empty `DevToolsActivePort` break, missing `--no-deps` on `dev-smoke.sh:82`, and absent `waitForDevelopmentEnvironment`)                                                                                                                                                                                                                                    | 2026-11-28 | FAIL   |
| Candidate B GREEN regression suites (`v2`)            | After fixing `dev-smoke.sh`, `smoke-checks.mjs`, `browser-startup-diagnostics.mjs`, `public-https-browser.mjs`, `browser-login-smoke.mjs`, `pager-filter-browser-checks.mjs`, and `dev-runtime-environment-probe.mjs`: `browser-startup-diagnostics.test.mjs` (`10/10`) + `dev-runtime-environment-probe.test.mjs` (`12/12`) + `smoke-checks.test.mjs` (`12/12`) = `34/34` PASS (`266ms`); `@nexora/shared` `2/2`, `@nexora/ui` `37/37`, `@nexora/api` `298/298` (`51` suites sequential), `lint`, `typecheck`, `contracts:check`, `docs:check`, `preflight:check` PASS | 2026-11-28 | PASS   |
| Windows host POSIX-dependent checks (limitation)      | On Windows host (Node `v24.16.0`), `node --test "scripts/**/*.test.mjs"` ran `218/226` PASS (`8` pre-existing OS-specific POSIX/signal/symlink/sh failures: `dev-cleanup-smoke.test.mjs` `1`, `docs-check.test.mjs` `1`, `preflight-policy-check.test.mjs` `2`, `provision-cluster-smoke.test.mjs` `2`, `public-authority.test.mjs` `1`, `runtime-environment.test.mjs` `1`), and `verifyRuntimeComposeEnvironment` failed (`docker.exe` minimal env)                                                                                                                   | 2026-11-28 | FAIL   |

| Claim                               | Evidence                                                                                                                                                                                   | Date       | Result |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| v2 exact-source hosted verification | gh api actions/runs/46118431221: source bce6ad0, attempt1 success, job140897351056; owner Tech Lead raw-log merge checkout5ea3398; Preflight46118431184; optional selector46118431289 only | 2026-11-28 | PASS   |

| Claim                                | Evidence                                                                                                                                   | Date       | Result |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| v3 documentation and syntax checks   | Pinned local format/docs/preflight plus test:docs10/10 and test:preflight24/24; node --check both embedded snippets; diff whitespace check | 2026-11-28 | PASS   |
| Synthetic SQL execution prerequisite | docker run PostgreSQL17.11 failed before container creation: no space left on device; no SQL executed, no remaining owned container        | 2026-11-28 | FAIL   |

| Claim                                       | Evidence                                                                                                                                                             | Date       | Result |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Two final documentation corrections checked | Compose2.40.3 help plus official reference; focused static option/order/context/guard checks; pinned format/docs/preflight, docs10/10, preflight24/24 and diff check | 2026-11-28 | PASS   |

### Historical CI and confidence (not current-candidate proof)

v2 bce6ad0: Preflight46118431184 and Foundation46118431221/job140897351056
attempt1 PASS, checkout5ea3398ce383312d0b75f064deb8a0089443c5b1.
v3 648b848: Preflight46122957689 and Foundation46122957678/job140911232021
attempt1 PASS, checkout135e392ba3b5548f4b269eb4d0401024a4e9417a.
Latest reviewed0f39dc8: Preflight46129928944 PASS; Foundation46129928984/
job140932637358 attempt1 FAIL step10, checkout2d09db9b026b7e4298243a0ae236289b4ad2cdaf.
Steps4–9 PASS; RECREATE_API_WITH_EXPLICIT_ORIGIN API unhealthy after106s,
apiListenerPresent=false but live/ready200. Root cause UNKNOWN; no rerun or harness
change. Raw sanitized diagnostic remains in PR66. This policy does not claim a fix.

DevTools/process-discovery hazards have deterministic regression coverage; original
API-unhealthy cause was not fully reproduced. Successful earlier process receipts
used attempts=1. Optional selector successes never mean stress jobs executed.
Prior Windows POSIX-dependent failures and all FAIL rows remain historical.

### Execution limitations

No actual owner target, password handling, upgrade, MFA, live call or activation is
performed. No backup/restore/export/clone is authorized or run. No such absence is
a blocker. PowerShell execution NOT RUN (unavailable). Disposable fixture tests
remain exactly as owner directed. Final candidate docs/CI/review receipts belong in
PR66; do not create a source commit solely to record its own CI result.

## v4 documentation verification

Reviewed0f39dc8 plus the current documentation-only policy revision. Active-document
search covers AGENTS/README, project rules, operations, runtime architecture, ADRs,
046/066 and canonical058 stages. Remaining occurrences are the prohibition itself,
explicitly superseded history/retired tooling, retained fixture descriptions or
unrelated business/security recovery; none creates an operational backup gate.
Existing15 evidence rows and snapshotsv1–v3 verified byte-identical. New v4 raw
SHA256 is bound above. No asset copy, backup, restore or owner-runtime action ran.

Pinned Node24.19.0/pnpm10.34.6 format/docs/preflight and docs10/preflight24 checks
passed locally; final post-review checks and hosted receipts are recorded in PR66.
Independent read-only review found no P1/P2/P3. This proves documentation consistency,
not actual owner deployment/MFA or a fix for the prior unknown dev-smoke failure.

| Claim                                 | Evidence                                                                                                                                                        | Date       | Result |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Policy and scope consistency reviewed | Global active-doc search; existing15 evidence rows and v1–v3 bytes unchanged; no app/DB/scripts/Compose/workflow diff; independent read-only review no P1/P2/P3 | 2026-11-28 | PASS   |

## Closure by NEXORA-067 — 2026-11-28

PR66 merged37981a142de23a443ae14f4f7ac677bffbc22757 as
f06db70e9dae50d95d724ce03f03a593315876fa at2026-11-28T10:27:57Z.
Pre-live documentation/CI-harness deliverable is complete, not live activation.
All prior statements/checklists/results above are historical. Existing external
owner/runtime/data acceptance transfers to PLANNED
[068](../active/NEXORA-068-uniship-owner-runtime-and-data-acceptance.md);
public host prerequisites stay[046](../active/NEXORA-046-production-https-acceptance.md).
The existing empty-policy issue belongs to [067](NEXORA-067-controlled-uniship-live-activation.md).
No external acceptance is marked PASS. No backup requirement or task is transferred.
No old FAIL row or immutable snapshot is changed.

| Claim                                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Date       | Result |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Merged pre-live readiness and policy deliverable | PR66 mergef06db70 on2026-11-28T10:27:57Z; exact source37981a1; Preflight46133226944/job140942794014 attempt1 PASS; Foundation46133226931/job140942793943 attempt1 PASS2026-11-28T10:02:05Z–10:22:54Z, actual checkout451ea696ff1642d46aa1ff16f91eb7d5a5bce160, steps4–10 and cleanup PASS. Raw checkout/MFA/replay/restart/Origin/Host/HMR receipt in PR66; independent review no P1/P2/P3. Optional46133226907 selector only, stress/E3 SKIPPED. MainPreflight46135305493 PASS; mainFoundation46135305465 not yet complete at closure inspection, no main PASS inferred | 2026-11-28 | PASS   |
