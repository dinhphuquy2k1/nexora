# NEXORA-066 — Uniship external controlled acceptance

Status: VERIFICATION PENDING
Capability: PLANNED
Verification: PARTIALLY VERIFIED

## Origin and scope

Transferred external/production acceptance from completed NEXORA-058 by NEXORA-065 (`ad46e4c`), following PR #64 (`1cd46d191ab5373703b4245baad33d03a0b33112`) and PR #65 (`a4ccfaf4cd54fd2a848e263e2c9551cad0c893fe`). This phase completes **Pre-live Readiness (Tasks 1–11 through Checkpoint A)** only. No live HTTP request, live gate change (`UNISHIP_LIVE_CONTRACT_VERIFIED` remains `false`), runtime `MANUAL_ONLY`/`AUTOMATIC` activation, reconciliation threshold selection, schema/application code change, volume reset, or PR auto-merge is performed here. Use [canonical external matrix and staged runbook](../evidence/NEXORA-058/external-gates-and-runbook.md), [Uniship contract](../../integrations/uniship-portal-api.md), ADR-007, and [actual host HTTPS acceptance NEXORA-046](NEXORA-046-production-https-acceptance.md) without duplicating runbooks or hardcoding real account identifiers/secrets into Git or public docs.

## Design Review & Reuse Decision

Task ID: NEXORA-066
Classification: SIGNIFICANT
Plan revision: rev-2026-11-28-pre-live-readiness-v3
Reviewed baseline: bce6ad00fc211add5ace2207134c0fc34ec76571
Design Snapshot: docs/tasks/design-reviews/NEXORA-066-rev-2026-11-28-pre-live-readiness-v3.md
Design SHA-256: e32bd3cede3f81ec36a86c120f72a7e0a21ca6e44ce269a16adc44b8931495b2

### v3 operational safety delta

Material documentation-only delta: replace the existing Windows checklist with
independent-cluster restore, private backup/key custody, explicit native failure
checks, R1/R2 comparisons and Standard Runtime acceptance. Reuse audit and twelve-section
plan are frozen in the v3 snapshot before checklist edits. No v2 harness changes.

### Final corrections within v3 — reviewed648b848

Non-material correction: retain v3 scope/reuse/ownership and immutable snapshots.
Replace the unsupported create option with verified --no-build (containers remain
stopped), and enforce the already-designed pre-start boundary using existing step7
read-only checks plus an explicit source-bound operator checkpoint. No new runtime
policy, framework, canonical fact or authorization. Verify CLI help/reference,
focused PowerShell ordering/context statically, documentation gates and exact-source
CI. PowerShell/synthetic resource execution remains unverified when unavailable.

### Reuse Audit

| Component                                    | Existing implementations                                                                                                                                                                                        | Domain owner                   | Reuse alternatives                                                                                                               | Selected approach                                                                                                                                                                                                                                                                                | Rationale                                                                                                                          | Risks                                                                                                           | Verification                                                                                                                                                                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| External matrix & runbook                    | `docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md`, `docs/integrations/uniship-portal-api.md`                                                                                                       | Sync / Uniship operations docs | Copy runbook into `NEXORA-066` vs link canonical runbook directly                                                                | Keep existing Stages 0–6 runbook authoritative; record `NEXORA-066` Checkpoint A readiness table, environment matrix, owner scope verification, and Windows owner checklist in `NEXORA-066`                                                                                                      | Single canonical operational procedure with zero conflicting instructions                                                          | Stale assumptions about Stage 1 empty policy, password rotation, or LOCAL vs `PUBLIC_HTTPS` gates               | `pnpm docs:check`, `pnpm preflight:check`, manual diff audit                                                                                                                                                                                                      |
| Activation policy & `!policy` Stage 1 guard  | `apps/api/src/sync/infrastructure/{uniship-sync.config,uniship-runtime-policy,uniship-sync.runtime}.ts`, `apps/api/src/carrier/infrastructure/uniship/uniship-http.client.ts`                                   | Sync / Carrier infrastructure  | Immediate code patch in PR #66 vs document `PLAN ISSUE` for gate-opening PR and update canonical configuration/runbook docs      | Keep code untouched per Pre-live Readiness freeze; document concrete `PLAN ISSUE` in `NEXORA-066`, `configuration.md`, and `external-gates-and-runbook.md`                                                                                                                                       | Honors scope freeze (`no app code changes`) while blocking unsafe live activation later                                            | Future gate-opening PR overlooking `!policy` on `POST /carrier-connections`                                     | Source inspection (`uniship-sync.runtime.ts:40-61`, `uniship-http.client.ts:266-273,432-445`) + `node --test test/uniship-runtime-config.test.cjs test/uniship-runtime-composition.test.cjs test/sync/*.test.cjs` (`38/38` PASS) + `@nexora/api test` (`298/298`) |
| Dev Compose `--force-recreate` & diagnostics | `scripts/dev-smoke.sh:19-32,53-84` (baseline), `scripts/smoke-checks.mjs`, `compose.dev.yml`                                                                                                                    | CI Runtime & Smoke Tooling     | Alter `compose.dev.yml` depends_on vs `--no-deps` on `dev-smoke.sh` after verifying prerequisites & extending `smoke-checks.mjs` | Verify dependency health cleanly, pass `--no-deps` when recreating `api` for `ALLOWED_ORIGINS`, stop `sync-worker` around `dependencies` rebuild, and emit sanitized `DEV_SMOKE_FAILED` telemetry via `smoke-checks.mjs` helpers                                                                 | Stops `dependencies` from rewriting shared `dist` volumes during live watchers without mutating `compose.yml` or `compose.dev.yml` | Precondition failure if a dependency crashed (desired fail-closed) or Compose JSON field variance               | Baseline A -> Candidate B compose diagnostic unit tests & static script guard in `scripts/smoke-checks.test.mjs` + hosted Foundation CI step 10                                                                                                                   |
| Chromium DevTools startup readiness gate     | `scripts/browser-startup-diagnostics.mjs`, `scripts/browser-teardown.mjs` (`isProcessExited`), `scripts/public-https-browser.mjs`, `scripts/browser-login-smoke.mjs`, `scripts/pager-filter-browser-checks.mjs` | Browser Acceptance Harness     | Patch 3 scripts separately vs centralize bounded readiness inside `browser-startup-diagnostics.mjs`                              | Export `waitForBrowserDevTools` in `scripts/browser-startup-diagnostics.mjs` reusing `isProcessExited` & `browserStartupSummary`; validate integer port `1..65535`, fetch `/json/list` with bounded abort timeout, require `page` WS target, capture capped stderr in `public-https-browser.mjs` | Eliminates 3x duplicate `DevToolsActivePort` empty-break race without weakening TLS/HTTP security checks                           | Chromium variant endpoints (`/json/list` supported uniformly; bounded timeout fails cleanly without hanging)    | Baseline A -> Candidate B 8-case regression suite in `scripts/browser-startup-diagnostics.test.mjs` + hosted Foundation CI steps 4, 7, 8                                                                                                                          |
| Dev runtime `/proc` process probe            | `scripts/dev-runtime-environment-probe.mjs`, `scripts/dev-smoke.sh:60-65`                                                                                                                                       | Development Env Verification   | Blind `sleep` in `dev-smoke.sh` vs split pure snapshot `verifyDevelopmentEnvironment` + bounded `waitForDevelopmentEnvironment`  | Add injectable `fsOps`, post-`/environ` PID/listener consistency recheck, structured sanitized diagnostics, and bounded transient wait (`waitForDevelopmentEnvironment`) while failing IMMEDIATELY (`attempts===1`) on `DEV_ENV_PROPAGATION_MISMATCH` / identity / DB role errors                | Resolves transient `--watch` restart gap after `api` `Healthy` while failing closed on security/env bugs                           | Persistent duplicates must still fail closed (`candidateCount > 1` at deadline) with zero raw cmdline/env leaks | Baseline A -> Candidate B 12-case mock-`/proc` suite in `scripts/dev-runtime-environment-probe.test.mjs` + hosted Foundation CI step 10                                                                                                                           |
| Host runtime, DB & backup readiness          | `compose.yml`, `compose.dev.yml`, `packages/database/scripts/provision-runtime.mjs`, `docs/operations/{configuration,deployment}.md`                                                                            | Runtime / Database operations  | Run `quality-docker.sh` or live mutations locally vs non-destructive read-only inspection + host unit/policy verification        | Non-destructive DB SQL introspection, Docker container/ENV inspection, and host unit/lint/contracts/docs checks without touching user volumes or live endpoints                                                                                                                                  | Preserves real user DB (`3` customers, enrolled ADMIN) and respects local Windows Docker/host constraints                          | Windows host fails OS-specific POSIX/symlink/sh tests (recorded honestly in Evidence)                           | Executed read-only SQL/container JSON probes, host `@nexora/api test` (`298/298`), `lint`, `typecheck`, `contracts:check`, `format:check`, `docs:check`, `preflight:check` + baseline `main` CI `46106872352`                                                     |
| Worker custody, rate & recovery audit        | `carrier-connection-lifecycle.service.ts`, `postgres-http-admission.ts`, `postgres-provider-budget.ts`, `sync-job-executor.service.ts`, `sync-worker.module.ts`                                                 | Carrier & Sync infrastructure  | Re-run destructive local integration DB suite vs cite source inspection + verified unit/Sync/Foundation CI                       | Verify exact source contracts + run host `@nexora/api test` (298/298) + cite PR #64 `46018303745` (`Sync V1 targeted`) and PR #65 `46106872352` (`Foundation`)                                                                                                                                   | Avoids mutating user DB while grounding every safety/limit claim in executed tests and exact source lines                          | Mock/disposable CI never proves real Uniship quotas or production host stability                                | `@nexora/api test` 298/298 PASS + cited CI runs `46018303745` & `46106872352`                                                                                                                                                                                     |

### Tactical DDD and Domain Invariants

All Tactical DDD boundaries (`Presentation -> Application -> Domain`, `Infrastructure -> Domain`), `Shipment` Aggregate reconciliation invariants, `Carrier` lifecycle state machine & purpose-separated credential custody (`EnvironmentKeyring("CARRIER")` independent of `"IDENTITY"`), `Sync` worker lease/epoch fencing, `nexora_app`/`nexora_sync` PostgreSQL privileges, Identity MFA/session/Origin/Host/public-startup (`verifyPublicStartup`) policies, API/OpenAPI/SDK contracts, and `UNISHIP_LIVE_CONTRACT_VERIFIED: boolean = false` remain completely unchanged (`v2` modifies only CI smoke harnesses/tests under `scripts/` and operational/governance documentation).

## Plan

1. Commit 1 (`2e5d638`): Close merged `NEXORA-064` (PR #63) and `NEXORA-065` (PR #65) under `TASK_WORKFLOW.md §1.7`, transferring `NEXORA-064` manual visual acceptance to `PLANNED` `NEXORA-047`.
2. Record immutable `SIGNIFICANT` Design Snapshot `v1` (`04eb3a2`), then record additive Design Snapshot `v2` (`rev-2026-11-28-pre-live-readiness-v2`) and bind its raw UTF-8 SHA-256 (`81ff3baabfea00d9a48f3c92c1a37a7d88014d4486181c428571b0eca0a3f2ec`) before modifying CI smoke scripts or tests.
3. Historical v2: characterize source-confirmed hazards for browser startup/process discovery and mitigate dependency rebuilds; exact original API-unhealthy cause remains unconfirmed. Implement regression tests across `scripts/dev-smoke.sh`, `scripts/smoke-checks.mjs`, `scripts/browser-startup-diagnostics.mjs`, `scripts/public-https-browser.mjs`, `scripts/browser-login-smoke.mjs`, `scripts/pager-filter-browser-checks.mjs`, and `scripts/dev-runtime-environment-probe.mjs` and verify **Candidate B (GREEN)**.
4. Audit & document Checkpoint A readiness (Issues 4–9: Windows-safe Owner Execution Checklist, 4-scope Environment Distinction Matrix, Owner Scope Verification Matrix, ADR-007 `NEXORA-054` & mandatory password rotation status, LOCAL vs `PUBLIC_HTTPS` MFA gates, and `v1` SHA-256 typo correction receipt) plus sync canonical docs (`docs/operations/testing.md`, `docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md`), run host checks & independent 15-item review, and verify Preflight + Foundation CI GREEN on PR #66 without merging or resetting user volumes.

## Pre-live Readiness Assessment (Tasks 1–11 -> Checkpoint A)

- **Checkpoint A Conclusion**: **`BLOCKED — EXTERNAL PREREQUISITES`** (plus local non-upgraded Mode B dev environment prerequisites, unconfirmed target host selection, unconfirmed external Uniship password rotation per ADR-007 `NEXORA-054`, and one concrete **`PLAN ISSUE`** blocking the future Stage 1 gate-opening PR).
- **Owner-Confirmed Business Architecture**: Retain account-scoped `UNISHIP_ACTIVATION_POLICY_JSON` (`ownerUserId`, positive numeric string `externalAccountId`, trimmed `loginIdentifier`, `mode`, optional `connectionId` omitted initially prior to UI connection creation). Real account values remain exclusively in private runtime configuration, never committed in Git or public documentation.
- **Database, Migrations & User State (Observed Local Introspection)**: PostgreSQL `17.11-bookworm` (`9454 kB`, `max_connections=100`) has **19/21 migrations** applied (`20261124000000_uniship_controlled_runtime` and `20261127000000_carrier_credential_purposes` plus their `16` Uniship-controlled `SECURITY DEFINER` functions are **not yet applied** locally, alongside 4 earlier sync read-lock `SECURITY DEFINER` functions from migration 12; `db-runtime` must rerun after matching migration deploy). Business counts: `3` customers, `0` `shipments`, `0` `carrier_connections`, `0` `carrier_connection_secrets`, `0` `sync_configs`, `0` `sync_jobs` (**Case A: clean first-connect state**). Admin inventory: `1` ACTIVE ADMIN enrolled (`key_version=1`, owner-designated account) + **`2` unenrolled ACTIVE ADMIN accounts** (`mfa_enrolled=f`).
- **Keyrings & Runtime ENV Custody (Observed Local Probe)**: Local `.env` and `nexora-api-1` hold a valid `IDENTITY_KEYRING_JSON` v1 (32-byte base64) and `SYNC_ENABLED=false`, **but `CARRIER_KEYRING_JSON` and `CARRIER_ACTIVE_KEY_VERSION` are empty/unset** across `.env`, `nexora-api-1`, and `nexora-sync-worker-1`. Local `.env` and `nexora-api-1` already set `UNISHIP_API_URL=https://kh.uniship.vn` and `UNISHIP_LIVE_AUTHORIZED="true"` (kept inactive by `UNISHIP_LIVE_CONTRACT_VERIFIED=false`, must be reverted to `UNISHIP_LIVE_AUTHORIZED=false` until Stage 1), `UNISHIP_ACTIVATION_POLICY_JSON` is unset, and `nexora-sync-worker-1` lacks all Carrier/Uniship variables because it predates PR #64.
- **Worker Security, Pacing, Recovery & Shutdown Audit**: Verified in source, `298/298` API unit tests, PR #64 `Sync V1 targeted` (`46018303745`), and PR #65 `Foundation` (`46033539071` / `46106872352`): purpose-separated PostgreSQL functions (`sync_carrier_load_token` vs `sync_carrier_load_recovery_password`, legacy `sync_carrier_load` dropped in migration 21), `UserCarrierAdmission` (`5` req/min/user, max `1024` windows), `PostgresProviderBudget` (`2` concurrent slots, `30s` slot lease, `1s–60s–300s` backoff), `PostgresHttpAdmission` (`1s` completion spacing, `15s` permit lease, `250ms` `lock_timeout`, `1000ms` `statement_timeout`), `UnishipHttpClient` (`5000ms` timeout, `redirect: "error"`), `SyncJobExecutor` (`20000ms` page deadline, `leaseSeconds/3` heartbeat), `loadSyncConfig` bounds (`leaseSeconds <= 300`, `pollMs <= 60000`, `maxAttempts <= 20`, `retentionDays <= 36500`), graceful loop drain (`beforeApplicationShutdown`), and volume-preserving rollback.

### Environment Scope Distinction Matrix

| Scope                                                     | Status                                          | Observed / Expected Configuration                                                                                                                                                                                                                                                                                                                                                                         | Security / Upgrade Implications                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Observed Local Environment**                         | OBSERVED (Read-only host probes)                | Mode B dev (`compose.yml + compose.dev.yml`), project `nexora`, Web `127.0.0.1:3001`, `nexora-dev:0.1.0` (`2026-11-26`), stale `nexora-api:0.1.0`/`nexora-web:0.1.0` (`2026-11-12`), PG `17.11`, `19/21` migrations, `3` customers, `0` Uniship connections, `1` enrolled + `2` unenrolled `ACTIVE ADMIN`s, `CARRIER_KEYRING_JSON` unset, `.env` `UNISHIP_LIVE_AUTHORIZED="true"`, Worker predates PR #64 | Cannot run Uniship sync/connect without Mode B -> Mode A upgrade (`20-21` migrations + `db-runtime`), fresh images, `CARRIER_KEYRING_JSON`, and `UNISHIP_LIVE_AUTHORIZED=false` hygiene; **never** run `down -v`                                    |
| **2. Intended Standard Runtime Target (`LOCAL`, Mode A)** | PLANNED (Target post-upgrade baseline)          | `compose.yml` (`DEPLOYMENT_PROFILE=LOCAL`), fresh images built from final reviewed HEAD, `21/21` migrations + `db-runtime` (`16` new `SECURITY DEFINER` routines + `nexora_app`/`nexora_sync` grants), independent `CARRIER_KEYRING_JSON` v1, `SYNC_ENABLED=false`, `UNISHIP_LIVE_AUTHORIZED=false`, blank `UNISHIP_ACTIVATION_POLICY_JSON` until Stage 1                                                 | API startup not blocked by unenrolled idle `ACTIVE ADMIN`s (`verifyPublicStartup` applies to `PUBLIC_HTTPS` only), though admin login remains blocked until server CLI enrollment; all existing `nexora_*` DB/uploads/credentials volumes preserved |
| **3. Actual Confirmed Acceptance Target**                 | NOT VERIFIED                                    | Owner has not yet confirmed whether Stage 1 live acceptance runs on the upgraded local instance (`nexora`) or a separate target host/instance                                                                                                                                                                                                                                                             | Must not extrapolate observed local DB user/connection checks to an unconfirmed separate host; re-run read-only verification if a different target host/DB is chosen                                                                                |
| **4. Production / Public HTTPS Target (`PUBLIC_HTTPS`)**  | NOT VERIFIED (Blocked externally; `NEXORA-046`) | `compose.yml + compose.public.yml` (`DEPLOYMENT_PROFILE=PUBLIC_HTTPS`), real FQDN/DNS, Nginx TLS, Certbot HTTP-01, firewall/NTP (`public-host-preflight.sh`), off-host encrypted backup/restore, explicit `ALLOWED_HOSTS`/`ALLOWED_ORIGINS`                                                                                                                                                               | `verifyPublicStartup` -> `assertPublicReady()` requires **all** `ACTIVE ADMIN`s enrolled + local password + valid Identity ciphertext or refuses API startup (`PUBLIC_SECURITY_NOT_READY`); tracked by `NEXORA-046`                                 |

### Owner Scope Verification Matrix

| Check                                      | Result                           | Scope & Basis                                                                                                                                                                            | Confidentiality / Next Requirement                                                       |
| ------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Owner User Exists (`ownerUserId`)          | `TRUE` (Observed DB)             | Parameterized read-only SQL probe against `nexora-postgres-1` `users` (`1` row matched)                                                                                                  | Exact UUID retained in private runtime config only; never committed to Git/fixtures/docs |
| Owner Active & Carrier-Eligible            | `TRUE` (Observed DB)             | Same read-only SQL probe on `users` + `user_credentials` + `user_mfa`: `role = 'ADMIN'`, `status = 'ACTIVE'`, `has_pw = t`, `mfa_enrolled = t`, `key_version = 1`                        | Eligible for Carrier UI connect & session MFA assurance on observed DB (`nexora`)        |
| Connection Ownership Conflict Absent       | `TRUE` (Observed DB)             | Read-only SQL probe on `carrier_connections`: `0` rows for `provider = 'uniship'` globally and for the owner user or designated external account                                         | Clean first-connect baseline (**Case A**) on observed DB                                 |
| Owner-Confirmed Policy Inputs              | `CONFIRMED` (Architecture Input) | Account-scoped `UNISHIP_ACTIVATION_POLICY_JSON` (`ownerUserId`, positive numeric `externalAccountId`, trimmed `loginIdentifier`, `mode = "MANUAL_ONLY"`, initial `connectionId` omitted) | Retained in private runtime config only (`configuration.md`); never committed in Git     |
| Live Provider Account / Login Verification | `NOT VERIFIED`                   | Live Uniship `POST /client/api-token-auth/`, `POST /client/api-token-verify/`, and account/login acceptance on `https://kh.uniship.vn`                                                   | Blocked on Checkpoint A + Stage 1 gate-opening PR + Uniship password rotation            |
| Separate Target Host Owner Scope           | `NOT VERIFIED`                   | Actual acceptance host identity is unconfirmed if different from local `nexora` DB                                                                                                       | Re-verify identical read-only SQL checks on the actual target DB before Stage 1          |

### ADR-007 (`NEXORA-054`) Authorization, Quotas & Mandatory Password Rotation

- **Scoped Authorization vs Unverified Quotas**: Per ADR-007 (`NEXORA-054`, 2026-11-15), the project owner confirmed automated read/auth permission on the owner's own Uniship account across 4 endpoints only (`POST /client/api-token-auth/`, `POST /client/api-token-verify/`, `GET /client/api/transition/`, `GET /client/api/chinaStores/`), including automatic password login from `carrier_connection_secrets` and excluding `/client/api/customers/{id}` and provider mutations. Internal limits (`PostgresHttpAdmission` `1s` completion spacing, `PostgresProviderBudget` `2` concurrent slots, `>= 60m` `AUTO` interval) are Nexora self-imposed safeguards, **not** provider-published numeric quotas or SLAs (`NOT VERIFIED`).
- **Mandatory External Password Rotation (`UNCONFIRMED / BLOCKER`)**: Per ADR-007 (`NEXORA-054` security custody requirement), any Uniship token or cookie exposed outside Nexora during earlier DevTools captures **must be invalidated by rotating the Uniship account password externally** before Stage 1 live activation. Do not share passwords in prompts or Git; rotation confirmation is currently **`UNCONFIRMED — BLOCKER`** for live connection setup.

### LOCAL Standard Runtime vs `PUBLIC_HTTPS` Readiness Gates

| Gate / Control                                          | `DEPLOYMENT_PROFILE=LOCAL` (Standard Runtime `compose.yml`)                                        | `DEPLOYMENT_PROFILE=PUBLIC_HTTPS` (`compose.public.yml`)                                                                                                         | Reference & Impact on Observed `2` Unenrolled `ACTIVE ADMIN`s                                                                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verifyPublicStartup()` / `MfaPort.assertPublicReady()` | Bypassed at API startup (`apps/api/src/public-startup.ts:17` early return)                         | **HARD STARTUP BLOCKER** (`PUBLIC_SECURITY_NOT_READY` refuses API listener on any `ACTIVE ADMIN` missing password, MFA enrollment, or valid Identity ciphertext) | Observed `2` unenrolled `ACTIVE ADMIN`s do **not** fail LOCAL Mode A startup, **do** block `PUBLIC_HTTPS` startup, and remain blocked from ADMIN login (`403 MFA_ENROLLMENT_REQUIRED`) until enrolled via trusted CLI |
| TLS / Ingress / Host / Origin                           | Loopback HTTP `127.0.0.1:3001`, derived loopback `ALLOWED_ORIGINS`, LOCAL `ALLOWED_HOSTS` defaults | Nginx TLS 1.2/1.3 + Certbot + HSTS/nosniff/DENY + explicit `PUBLIC_FQDN` `ALLOWED_HOSTS`/`ALLOWED_ORIGINS` + trusted proxy (`NEXORA-046`)                        | Canonical `PUBLIC_HTTPS` and `NEXORA-046` gates stay completely unchanged                                                                                                                                             |
| Backups / NTP / Firewall                                | Local pre-upgrade binary `pg_dump` + volume archives + isolated disposable restore                 | Off-host encrypted backups + verified host NTP (`public-host-preflight.sh`) + strict ingress 80/443 firewall                                                     | Both profiles strictly forbid `down -v` / volume deletion on user data                                                                                                                                                |

### Checkpoint A — Readiness Gate Summary

| Gate / Prerequisite                             | Current Status                      | Concrete Evidence / Finding                                                                                                                                  | Required Owner / Pre-Live Action                                                                                                                                                   |
| ----------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code & CI Technical Baseline                    | v2 HOSTED PASS; v3 PENDING          | `a4ccfaf` (`PR #65`), `1cd46d1` (`PR #64`), `46106872352` (Foundation PASS), `46018303745` (Sync PASS); PR #66 fixes CI harness issues 1–3 (`v2`)            | Deploy exact reviewed commit cleanly (do not run stale Nov 12 / Nov 26 images)                                                                                                     |
| Account-Scoped Activation Policy Decision       | READY                               | Confirmed owner architecture (`ownerUserId`, numeric string `externalAccountId`, trimmed `loginIdentifier`, `MANUAL_ONLY`, initial `connectionId` omitted)   | Inject JSON exclusively via private runtime env during Stage 1 after gate-opening fix                                                                                              |
| Confirmed Acceptance Target Selection           | NOT VERIFIED (Owner Input Needed)   | Local `nexora` DB inspected read-only; actual cutover target host/instance not yet explicitly confirmed by owner                                             | Confirm whether acceptance runs on upgraded local `nexora` or a separate server (re-verify target DB if separate)                                                                  |
| Stage 1 Empty-Policy Guard (`PLAN ISSUE`)       | BLOCKED (Stage 1 Prerequisite)      | `uniship-sync.runtime.ts:45` (`if (!policy) return;`) + `uniship-http.client.ts:266-273` allow `!policy` once `UNISHIP_LIVE_CONTRACT_VERIFIED=true`          | Fix `authorize(scope)` / `operationallyAvailable()` in separate reviewed gate-opening PR before setting `UNISHIP_LIVE_CONTRACT_VERIFIED=true`                                      |
| Mandatory Uniship Password Rotation (`ADR-007`) | UNCONFIRMED / BLOCKER               | ADR-007 (`NEXORA-054`) requires password rotation to invalidate historically exposed DevTools tokens/cookies; confirmation not yet recorded                  | Owner rotates Uniship password externally (never share secret) and confirms completion before Stage 1                                                                              |
| Live Contract Constant & Official Authorization | BLOCKED (External)                  | `UNISHIP_LIVE_CONTRACT_VERIFIED = false` (`uniship-http.client.ts:147`); official provider auth & retention/quota terms open                                 | Owner secures official Uniship authorization, reviews stop channel, and approves separate gate-opening PR                                                                          |
| Target Environment Migration & Images           | NOT UPGRADED LOCALLY                | Running Mode B dev (`Up 37–39h`, Nov 26); Mode A images stale (Nov 12); DB has `19/21` migrations (missing 20 & 21 + 16 functions)                           | Follow the corrected Windows Owner Checklist below (stop writers, backup, isolated restore, `CARRIER_KEYRING_JSON`, `migrate` + `db-runtime`, Mode A start)                        |
| Backup & Verified Restore                       | NOT EXECUTED LOCALLY                | PG 17.11 (`9454 kB`), `pg_dump` available in container, CI disposable restore PASS; zero host off-host backup/restore test                                   | Execute Checklist Steps 3–4 (binary-safe `pg_dump -Fc` + volume `tar` + separate disposable restore check)                                                                         |
| Active ADMIN MFA Readiness                      | LOCAL NON-BLOCKING / PUBLIC BLOCKED | `1` ACTIVE ADMIN enrolled (`key_version=1`); `2` ACTIVE ADMINs unenrolled (`mfa_enrolled=f`) — non-blocking on LOCAL startup, hard blocker on `PUBLIC_HTTPS` | Preserve these accounts; LOCAL does not require all enrolled. Separate PUBLIC_HTTPS rollout must meet its canonical all-relevant-ADMIN enrollment gate                             |
| Carrier Keyring & Worker ENV Custody            | MISSING LOCALLY                     | `CARRIER_KEYRING_JSON` & `CARRIER_ACTIVE_KEY_VERSION` empty; `UNISHIP_LIVE_AUTHORIZED="true"` set prematurely in `.env`; Worker lacks Carrier env            | Initialize only after fresh no-ciphertext/no-existing-key confirmation and private custody; set `UNISHIP_LIVE_AUTHORIZED=false` until Stage 1, deploy Mode A API & Worker together |
| Target Connection State                         | CLEAN (Case A)                      | `0` rows in `carrier_connections`, `carrier_connection_secrets`, `sync_configs`, `sync_jobs`, `shipments`                                                    | Owner creates connection via Carrier UI only after Stage 0 + Stage 1 gates close                                                                                                   |
| Public Host / HTTPS / NTP / TLS / Firewall      | BLOCKED (External)                  | Production domain/host/TLS/NTP not configured on this Windows dev host ([NEXORA-046](NEXORA-046-production-https-acceptance.md))                             | Provision host, verify `public-host-preflight.sh` (NTP/TLS/DNS/firewall) and ingress                                                                                               |
| Reconciliation & `AUTOMATIC` Scheduling         | LOCKED OFF (Deferred)               | `UNISHIP_RECONCILIATION_POLICY_JSON` unset; `SYNC_ENABLED=false`                                                                                             | Keep unset/`MANUAL_ONLY` until Stage 2 manual `FULL`, Stage 3 3-parcel timezone check, and Stage 4 threshold approval                                                              |

### Owner Execution Checklist (Windows PowerShell — Stage 0 only)

**Execution: procedure reviewed, Windows execution NOT RUN in this revision.** Agent
must not run these commands against owner data. Owner first confirms target and a
maintenance window. Follow this one checklist; [Deployment](../../operations/deployment.md),
[Configuration](../../operations/configuration.md), [Setup](../../operations/setup.md)
and [activation stages](../evidence/NEXORA-058/external-gates-and-runbook.md) retain
canonical ownership. No live connection, sync or gate-opening operation appears below.
Never use CI data-seeding/negative fixtures on source data.

#### 1. Establish explicit identity and fail-closed command handling

Use a trusted **unrecorded** PowerShell terminal, Docker Linux containers and the
reviewed checkout. Do not enable transcript/verbose/debug output. Commands below
capture output in memory; publish only final booleans/counts. Each native failure
throws before the next operation. `$ErrorActionPreference` alone does not cover
native exit codes on every PowerShell version.

```powershell
$ErrorActionPreference = 'Stop'
function Invoke-Native([string]$Executable, [string[]]$Arguments) {
    $result = @(& $Executable @Arguments 2>&1)
    $nativeExit = $LASTEXITCODE
    if ($nativeExit -ne 0) { throw "Native command failed ($Executable); stop and inspect privately." }
    return ($result -join "`n")
}
function Require([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
$Repo = Read-Host 'Absolute path to confirmed reviewed checkout'
Set-Location -LiteralPath $Repo
$SourceProject = Read-Host 'Confirmed existing source Compose project'
Require ($SourceProject -match '^[a-z0-9][a-z0-9_-]+$') 'Invalid source project'
$SourceEnv = (Resolve-Path -LiteralPath (Read-Host 'Private source env-file path')).Path
# Existing observed source is Mode B; change only after confirming actual topology.
$Source = @('compose','-p',$SourceProject,'--env-file',$SourceEnv,'-f','compose.yml','-f','compose.dev.yml')
$Standard = @('compose','-p',$SourceProject,'--env-file',$SourceEnv,'-f','compose.yml')
$Revision = Invoke-Native git @('rev-parse','HEAD')
$SourceIds = (Invoke-Native docker ($Source + @('ps','-aq'))) -split '\s+' | Where-Object { $_ }
Require ($SourceIds.Count -gt 0) 'Source project missing; do not create a replacement'
$SourceContainers = (Invoke-Native docker (@('inspect') + $SourceIds)) | ConvertFrom-Json
foreach ($c in $SourceContainers) {
    Require ($c.Config.Labels.'com.docker.compose.project' -ceq $SourceProject) 'Source label mismatch'
}
$SourceConfig = (Invoke-Native docker ($Source + @('config','--format','json'))) | ConvertFrom-Json
$SourceVolumes = @{}
foreach ($key in @('postgres','uploads','credentials','runtime_credentials','sync_credentials')) {
    $name = $SourceConfig.volumes.$key.name
    Require (-not [string]::IsNullOrWhiteSpace($name)) 'Missing source volume'
    $v = ((Invoke-Native docker @('volume','inspect',$name)) | ConvertFrom-Json)[0]
    Require ($v.Labels.'com.docker.compose.project' -ceq $SourceProject) 'Unreviewed shared/external source volume'
    Require ($v.Labels.'com.docker.compose.volume' -ceq $key) 'Source volume identity mismatch'
    Require (@($SourceContainers.Mounts | Where-Object { $_.Type -eq 'volume' -and $_.Name -ceq $name }).Count -gt 0) 'Configured volume is not actually mounted'
    $SourceVolumes[$key] = $name
}
$PgId = Invoke-Native docker ($Source + @('ps','-q','postgres'))
Require ($PgId -match '^[a-f0-9]{12,64}$') 'Exactly one running source PostgreSQL required'
$PgVersion = Invoke-Native docker ($Source + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-Atc','SHOW server_version_num'))
Require ($PgVersion -match '^17\d{4}$') 'Review PostgreSQL version compatibility before proceeding'
$DiskReceipt = Invoke-Native docker @('system','df')
# Privately verify actual image IDs/creation/revision, mounts, health, Web binding,
# project labels and disk headroom. Never print $SourceConfig or inspect objects.
```

Stop if project, topology, revision/image provenance, volume ownership or disk is
uncertain. Names such as `nexora_*` are observations, not identity proof. No default
project, fixed container name or public overlay is used. Actual source revision and
image IDs belong in the protected manifest, distinct from the reviewed checkout.

#### 2. Protected OFF configuration and backup custody prerequisites

Owner privately edits the confirmed environment file, preserving **all** existing
settings and Identity/Carrier versions. Require exactly one definition per key, no
conflicts with parent-shell ENV, UTF-8 without BOM and no accidental file truncation.
Set `SYNC_ENABLED=false`, `UNISHIP_LIVE_AUTHORIZED=false`, and blank both policy JSON
values. Existing containers retain old ENV until recreated; this edit alone is not
execution shutdown. Stop/drain writers before relying on OFF. Never apply MANUAL_ONLY.

Select a **new** backup directory outside Git and unapproved shared/cloud-sync paths,
on verified encrypted storage (or an approved encrypted backup destination). ACL is
not encryption. Do not assume BitLocker/EFS/third-party encryption exists: if
protection, private recovery-key custody and a successful decrypt/access drill cannot
be demonstrated, **stop before writing any backup**. Arrange an encrypted off-machine
copy and test its retrieval/decryption before declaring recovery readiness.

```powershell
$BackupRoot = (Resolve-Path -LiteralPath (Read-Host 'Approved encrypted private backup root')).Path
$BackupId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$Backup = Join-Path $BackupRoot $BackupId
Require (-not (Test-Path -LiteralPath $Backup)) 'Backup collision'
$null = New-Item -ItemType Directory -Path $Backup
$OperatorSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$null = Invoke-Native icacls @($Backup,'/inheritance:r','/grant:r',"*${OperatorSid}:(OI)(CI)F",'*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F')
$acl = Get-Acl -LiteralPath $Backup
Require $acl.AreAccessRulesProtected 'Backup inherits access'
# Review every Access entry privately: only this operator, SYSTEM and approved
# administrators; reject Everyone/unapproved grants, reparse points or sharing.
# Explicitly verify the storage encryption/access/decryption prerequisites above.
$PrivateKeys = (Resolve-Path -LiteralPath (Read-Host 'Separate protected complete keyring custody location')).Path
$backupPath = [IO.Path]::GetFullPath($Backup).TrimEnd('\') + '\'
$keyPath = [IO.Path]::GetFullPath($PrivateKeys).TrimEnd('\') + '\'
$repoPath = [IO.Path]::GetFullPath($Repo).TrimEnd('\') + '\'
Require (-not $backupPath.StartsWith($repoPath,[StringComparison]::OrdinalIgnoreCase)) 'Backup is inside repository'
Require (-not $keyPath.StartsWith($repoPath,[StringComparison]::OrdinalIgnoreCase)) 'Key custody is inside repository'
Require (-not $keyPath.StartsWith($backupPath,[StringComparison]::OrdinalIgnoreCase) -and -not $backupPath.StartsWith($keyPath,[StringComparison]::OrdinalIgnoreCase)) 'Key custody must be separate and non-nested'
# Independently verify restrictive ACL/encryption for PrivateKeys, as for Backup.
$Utf8 = New-Object System.Text.UTF8Encoding($false)
```

Back up the compatible runtime config, exact source/image provenance and **every**
Identity/Carrier key version independently of DB/credential archives. Never put raw
keys, key fingerprints or secret hashes in the sanitized manifest/Git/artifacts/chat.
A DB dump cannot recover a keyring. Keep referenced old versions unchanged.
Certificate custody belongs to the chosen profile; if the confirmed target is
PUBLIC_HTTPS, stop here and use NEXORA-046's additional certificate/host acceptance
and archive verified certificate volumes too. This procedure is Mode B→Mode A LOCAL.

#### 3. Coordinated source backup and private fresh inventory

Owner authorizes downtime and stops external provisioning/schema/file writers.
Record fresh data, migration and key-version inventories at backup time; previous
`3 customers / 0 shipments / 19 migrations` are dated observations, never assertions.
Stop API/Web/Worker with the **source Mode B topology**; keep PostgreSQL running.
Do not archive its running data directory. Source must remain quiescent until R1
comparison completes; if resumed, obtain a new coordinated backup/inventory.

```powershell
$null = Invoke-Native docker ($Source + @('stop','api','web','sync-worker'))
$states = (Invoke-Native docker (@('inspect') + $SourceIds)) | ConvertFrom-Json
Require (@($states | Where-Object { $_.Config.Labels.'com.docker.compose.service' -in @('api','web','sync-worker','migrate','db-runtime') -and $_.State.Running }).Count -eq 0) 'Source writers still running'
$ContainerDumpPath = '/tmp/nexora-' + $BackupId + '.dump'
$null = Invoke-Native docker ($Source + @('exec','-T','postgres','test','!','-e',$ContainerDumpPath))
$null = Invoke-Native docker ($Source + @('exec','-T','postgres','pg_dump','-U','nexora','-d','nexora','-Fc','-f',$ContainerDumpPath))
$null = Invoke-Native docker @('cp',"${PgId}:$ContainerDumpPath",(Join-Path $Backup 'database.dump'))
Require ((Get-Item -LiteralPath (Join-Path $Backup 'database.dump')).Length -gt 0) 'Empty dump'
$ArchiveList = Invoke-Native docker ($Source + @('exec','-T','postgres','pg_restore','--list',$ContainerDumpPath))
Require ($ArchiveList.Length -gt 0) 'Invalid custom-format archive'
# Use a LOCAL trusted image ID, not a floating tag/pull. Confirm tar/find/sha256sum
# availability and provenance privately before archiving.
$ArchiveImage = Read-Host 'Verified local trusted archive-capable image sha256 ID'
Require ($ArchiveImage -match '^sha256:[a-f0-9]{64}$') 'Image ID required'
$null = Invoke-Native docker @('image','inspect',$ArchiveImage)
foreach ($key in @('uploads','credentials','runtime_credentials','sync_credentials')) {
    $null = Invoke-Native docker @('run','--rm','--network','none','--read-only','--user','0:0','--entrypoint','tar','--mount',"type=volume,src=$($SourceVolumes[$key]),dst=/data,readonly",'--mount',"type=bind,src=$Backup,dst=/out",$ArchiveImage,'-C','/data','-cf',"/out/$key.tar",'.')
    $null = Invoke-Native docker @('run','--rm','--network','none','--read-only','--entrypoint','tar','--mount',"type=bind,src=$Backup,dst=/in,readonly",$ArchiveImage,'-tf',"/in/$key.tar")
}
# Hashes stay ONLY in this protected location, never displayed or committed.
$Integrity = Get-ChildItem -LiteralPath $Backup -File | Get-FileHash -Algorithm SHA256
[IO.File]::WriteAllText((Join-Path $Backup 'private-integrity.json'),($Integrity | ConvertTo-Json),$Utf8)
```

`docker cp` avoids version-dependent PowerShell binary-redirection behavior; newer
PowerShell may preserve native byte streams, older pipelines may transcode them.
Successful copy, nonzero size and archive listing are necessary, **not restore proof**.
Keep source temporary dump until copied hashes, archive validity and isolated restore
have passed; remove only that unique file afterward. Never overwrite an older backup.

Use this **read-only** SQL in source and restored cluster (via the function below).
It fingerprints every public table, including credentials, MFA/recovery/challenges,
sessions, setup links, customers/addresses, Shipment children/history, Carrier,
Sync/staging and security audit, plus sequence states. No raw data leaves the DB;
hashes/counts stay private too. Empty tables still participate. It applies to the
actual backup schema; no new 20/21 tables are required at R1.

```powershell
$InventorySql = @'
SELECT format('SELECT %L AS table_name, count(*)::text AS rows,
 coalesce(md5(string_agg(md5(row_to_json(t)::text), %L ORDER BY md5(row_to_json(t)::text))),md5(%L)) AS digest
 FROM %I.%I t;', tablename, '', '', schemaname, tablename)
FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
\gexec
SELECT 'sequence', schemaname, sequencename, start_value, min_value,
 max_value, increment_by, cycle, cache_size, last_value
FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename;
SELECT format('SELECT %L, %L, last_value, is_called FROM %I.%I;',
 'sequence-state', sequencename, schemaname, sequencename)
FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename;
\gexec
SELECT 'extension',extname,extversion FROM pg_extension ORDER BY extname;
SELECT 'column',table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;
SELECT 'constraint',c.relname,k.conname,pg_get_constraintdef(k.oid)
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' ORDER BY c.relname,k.conname;
SELECT 'index',tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname;
SELECT 'function',p.proname,pg_get_function_identity_arguments(p.oid),md5(pg_get_functiondef(p.oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY p.proname,pg_get_function_identity_arguments(p.oid);
'@
function Read-Inventory([string[]]$ComposeArgs) {
    $pg = Invoke-Native docker ($ComposeArgs + @('ps','-q','postgres'))
    $sqlFile = Join-Path $Backup 'inventory.sql'
    $remoteSql = '/tmp/nexora-inventory-' + $BackupId + '.sql'
    [IO.File]::WriteAllText($sqlFile,$InventorySql,$Utf8)
    $null = Invoke-Native docker @('cp',$sqlFile,"${pg}:$remoteSql")
    return (Invoke-Native docker ($ComposeArgs + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-v','ON_ERROR_STOP=1','-At','-f',$remoteSql)))
}
$R1Source = Read-Inventory $Source
[IO.File]::WriteAllText((Join-Path $Backup 'private-r1-source.txt'),$R1Source,$Utf8)
$MigrationSql = 'SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY started_at,id;'
$MigrationBefore = Invoke-Native docker ($Source + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-v','ON_ERROR_STOP=1','-Atc',$MigrationSql))
$KeyVersions = Invoke-Native docker ($Source + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-v','ON_ERROR_STOP=1','-Atc','SELECT key_version,count(*) FROM user_mfa GROUP BY key_version; SELECT key_version,count(*) FROM carrier_connection_secrets GROUP BY key_version;'))
# Store migration/key-version metadata privately; review failed/unfinished rows.
```

Create a protected uploads file manifest with relative paths, sizes and SHA256,
using the trusted image with source uploads read-only and `--network none`. Compare
it after extraction, including empty inventory and orphan files. Independently
cross-check `stored_files.id`, quoted `"sizeBytes"`, `sha256` against those exact
UUID filenames (see step 7). Do not seed test uploads on source.

```powershell
$ManifestFile = Join-Path $Backup 'volume-manifest.cjs'
$ManifestCode = @'
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
try {
  const out=[];
  function visit(rel) {
    for(const n of fs.readdirSync(path.join('/data',rel)).sort()) {
      const r=path.join(rel,n), f=path.join('/data',r), s=fs.lstatSync(f);
      if(s.isSymbolicLink()) throw Error();
      if(s.isDirectory()) { out.push([r,'directory']); visit(r); }
      else if(s.isFile()) out.push([r,s.size,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]);
      else throw Error();
    }
  }
  visit(''); console.log(JSON.stringify(out));
} catch { console.error('VOLUME_MANIFEST_FAILED');process.exitCode=1; }
'@
[IO.File]::WriteAllText($ManifestFile,$ManifestCode,$Utf8)
# ArchiveImage must also have verified Node support (use a trusted local tools ID).
function Read-VolumeManifest([string]$Volume) {
    return (Invoke-Native docker @('run','--rm','--network','none','--read-only','--user','0:0','--entrypoint','node','--mount',"type=volume,src=$Volume,dst=/data,readonly",'--mount',"type=bind,src=$Backup,dst=/checks,readonly",$ArchiveImage,'/checks/volume-manifest.cjs'))
}
$SourceUploads = Read-VolumeManifest $SourceVolumes.uploads
[IO.File]::WriteAllText((Join-Path $Backup 'private-uploads.json'),$SourceUploads,$Utf8)
# After restore extraction, before init/start/login:
# $RestoredUploads = Read-VolumeManifest $RestoreVolumes.uploads
# Require ($SourceUploads -ceq $RestoredUploads) 'Uploads bytes/inventory mismatch'
```

#### 4. Independent disposable cluster: R1 fidelity then R2 upgrade

If fresh inventory confirms no Carrier ciphertext and no existing Carrier keyring,
first perform step 5's justified initialization into **separate protected custody only**
before constructing restore.env. This prepares a candidate key for isolated restore;
do not modify source .env/runtime yet. Reuse that exact retained candidate for the
later source upgrade after restore passes. If prerequisites fail, stop; never invent
a key to decrypt existing ciphertext. Thus the R2 Carrier probe has valid candidate
keys even for the historically empty-Carrier source.

Build matching tools/migrate/API/Web images from the reviewed checkout; require
exit success before using them. This builds images, not source containers. Confirm
adequate space first. Do not assume release registry images exist.

```powershell
$null = Invoke-Native docker ($Standard + @('build'))
$RestoreProject = 'nexora-restore-' + [Guid]::NewGuid().ToString('N').Substring(0,12)
Require ($RestoreProject -cne $SourceProject) 'Project collision'
$existing = Invoke-Native docker @('ps','-aq','--filter',"label=com.docker.compose.project=$RestoreProject")
$volExisting = Invoke-Native docker @('volume','ls','-q','--filter',"label=com.docker.compose.project=$RestoreProject")
$netExisting = Invoke-Native docker @('network','ls','-q','--filter',"label=com.docker.compose.project=$RestoreProject")
Require (-not ($existing.Trim() + $volExisting.Trim() + $netExisting.Trim())) 'Restore project already exists'
$RestoreEnv = Join-Path $PrivateKeys ('restore-' + $BackupId + '.env')
Require (-not (Test-Path -LiteralPath $RestoreEnv)) 'Restore env collision'
# Privately create this new UTF-8-no-BOM file from the protected complete key/config
# copy: preserve all key versions, force all four OFF values, LOCAL only, and a
# confirmed unused loopback WEB_PORT different from source (e.g. 127.0.0.1:39101).
# Do not copy source .env blindly; inspect inherited parent ENV too.
Require (Test-Path -LiteralPath $RestoreEnv) 'Create/review protected restore.env first'
$Restore = @('compose','-p',$RestoreProject,'--env-file',$RestoreEnv,'-f','compose.yml')
$rc = (Invoke-Native docker ($Restore + @('config','--format','json'))) | ConvertFrom-Json
Require (@($rc.services.PSObject.Properties.Name | Where-Object { $_ -in @('ingress','acme-bootstrap','certbot') }).Count -eq 0) 'Public services forbidden'
foreach ($service in @('api','sync-worker')) {
    $e = $rc.services.$service.environment
    Require ($e.SYNC_ENABLED -ceq 'false' -and $e.UNISHIP_LIVE_AUTHORIZED -ceq 'false' -and [string]::IsNullOrEmpty($e.UNISHIP_ACTIVATION_POLICY_JSON) -and [string]::IsNullOrEmpty($e.UNISHIP_RECONCILIATION_POLICY_JSON)) 'Restore is not OFF'
}
Require ($null -eq $rc.services.postgres.ports -or @($rc.services.postgres.ports).Count -eq 0) 'Restore PostgreSQL published'
Require ($rc.services.web.ports[0].host_ip -ceq '127.0.0.1') 'Restore Web must be loopback'
Require ($rc.services.web.ports[0].published -ne $SourceConfig.services.web.ports[0].published) 'Restore Web port conflicts with source'
# Also check Get-NetTCPConnection for that selected port before starting Web.
foreach ($v in $rc.volumes.PSObject.Properties) {
    Require (-not $v.Value.external -and $v.Value.name -notin $SourceVolumes.Values) 'Shared restore volume forbidden'
    Require (-not (Invoke-Native docker @('volume','ls','-q','--filter',"name=^$($v.Value.name)$")).Trim()) 'Restore volume name exists'
}
# Create containers/networks/volumes only; DO NOT run init before restoring secrets.
$null = Invoke-Native docker ($Restore + @('create','--no-build','builder','init','postgres','migrate','db-runtime','api','sync-worker','web'))
$RestoreCreatedThisSession = $true
$RestoreIds = (Invoke-Native docker ($Restore + @('ps','-aq'))) -split '\s+' | Where-Object { $_ }
$RestoreContainers = (Invoke-Native docker (@('inspect') + $RestoreIds)) | ConvertFrom-Json
$RestoreVolumes = @{}
foreach ($key in @('postgres','uploads','credentials','runtime_credentials','sync_credentials')) {
    $name = $rc.volumes.$key.name
    $v = ((Invoke-Native docker @('volume','inspect',$name)) | ConvertFrom-Json)[0]
    Require ($v.Labels.'com.docker.compose.project' -ceq $RestoreProject -and $v.Labels.'com.docker.compose.volume' -ceq $key) 'Restore volume label mismatch'
    $RestoreVolumes[$key] = $name
}
foreach ($c in $RestoreContainers) {
    Require ($c.Config.Labels.'com.docker.compose.project' -ceq $RestoreProject) 'Restore container label mismatch'
    foreach ($m in $c.Mounts) {
        Require ($m.Type -eq 'volume' -and $m.Name -in $RestoreVolumes.Values -and $m.Name -notin $SourceVolumes.Values) 'Unexpected/shared/bind restore mount'
    }
    foreach ($n in $c.NetworkSettings.Networks.PSObject.Properties.Name) {
        $net = ((Invoke-Native docker @('network','inspect',$n)) | ConvertFrom-Json)[0]
        Require ($net.Labels.'com.docker.compose.project' -ceq $RestoreProject) 'Shared restore network'
    }
}
foreach ($key in @('uploads','credentials','runtime_credentials','sync_credentials')) {
    $null = Invoke-Native docker @('run','--rm','--network','none','--read-only','--user','0:0','--entrypoint','tar','--mount',"type=volume,src=$($RestoreVolumes[$key]),dst=/data",'--mount',"type=bind,src=$Backup,dst=/in,readonly",$ArchiveImage,'-C','/data','-xf',"/in/$key.tar")
}
$RestoredUploads = Read-VolumeManifest $RestoreVolumes.uploads
Require ($SourceUploads -ceq $RestoredUploads) 'Uploads bytes/inventory mismatch'
# Before init, prove retained ALL THREE credential bytes, not regenerated secrets.
$CredentialBefore = @{}
$secretFiles = @{ credentials='postgres_password'; runtime_credentials='postgres_app_password'; sync_credentials='postgres_sync_password' }
foreach ($key in $secretFiles.Keys) {
    $checks = @()
    foreach ($volume in @($SourceVolumes[$key],$RestoreVolumes[$key])) {
        $checks += Invoke-Native docker @('run','--rm','--network','none','--read-only','--entrypoint','sha256sum','--mount',"type=volume,src=$volume,dst=/data,readonly",$ArchiveImage,("/data/" + $secretFiles[$key]))
    }
    Require ($checks[0] -ceq $checks[1]) 'Retained credential mismatch; stop before init'
    $CredentialBefore[$key] = $checks[0]
}
'All three retained credential byte comparisons: true'
$null = Invoke-Native docker ($Restore + @('up','-d','--wait','postgres'))
$RestoredPgId = Invoke-Native docker ($Restore + @('ps','-q','postgres'))
$RestoredVersion = Invoke-Native docker ($Restore + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-Atc','SHOW server_version_num'))
Require ($RestoredVersion -ceq $PgVersion) 'PostgreSQL restore version mismatch'
$null = Invoke-Native docker @('cp',(Join-Path $Backup 'database.dump'),"${RestoredPgId}:/tmp/nexora-input.dump")
$null = Invoke-Native docker ($Restore + @('exec','-T','postgres','pg_restore','--exit-on-error','--no-owner','--no-acl','-U','nexora','-d','nexora','/tmp/nexora-input.dump'))
$R1Restored = Read-Inventory $Restore
Require ($R1Source -ceq $R1Restored) 'R1 restore fidelity mismatch; stop before migration'
'R1 backup table/sequence equality: true'
# Inspect schema/extension/constraint/index/function inventory against source,
# excluding intentional owner/ACL differences. Retain private comparison receipt.
$null = Invoke-Native docker ($Source + @('exec','-T','postgres','rm',$ContainerDumpPath))
# R2 begins only now: matching migrate + canonical role provisioning.
$null = Invoke-Native docker ($Restore + @('run','--rm','--no-deps','-T','migrate'))
$null = Invoke-Native docker ($Restore + @('run','--rm','--no-deps','-T','db-runtime'))
```

`up postgres` executes existing builder→init→healthy PostgreSQL prerequisites;
retained credentials must already exist before init (which never replaces an existing
file and fails on empty). Restore as trusted DB owner `nexora` with `--no-owner
--no-acl`: pg_dump does not contain cluster roles; deliberately ignore dumped ACL/
ownership references to absent runtime roles. Restored objects are owned by trusted
`nexora`, not runtime roles. Matching migrations and provisioner create restricted
roles/explicit table/column/function ACL; **do not copy source roles or issue manual
GRANTs**. Verify extension/function/schema completeness and effective ACL below.

R1 is the backup's own schema and full migration history, not a fixed count. R2 adds
forward migrations (20/21 at reviewed bce6ad0), then rechecks all original business
row/sequence fingerprints excluding `_prisma_migrations`, which intentionally gains
records. These two migrations add capability tables/functions, not business-row
rewrites. Verify new tables separately and require no unresolved migration failure.
Compare schema inventory to checked-in migrations and canonical ACL, not old R1
function definitions. Do not start API/Worker before R2 completes. Set `$Check = $Restore` explicitly and perform the migration/business/ACL
subsection of step7 on restore first, then:

```powershell
$null = Invoke-Native docker ($Restore + @('up','-d','--wait','api','sync-worker','web'))
```

Complete the running-process/files/MFA subsection of step 7 on restore. In both phases, owner MFA changes sessions/replay/audit, so fingerprint comparisons
must precede that intentional authenticated write. Preserve the pre-login receipt.

Cleanup only after recording R1/R2/runtime acceptance and retaining encrypted backups.
Recheck exact current-session container IDs and all named resources. If Compose
recreated a container, do not loosen this guard: inspect ownership and leave the
project for reviewed cleanup. Never substitute a default project.

```powershell
Require ($RestoreCreatedThisSession -and $RestoreProject -cne $SourceProject -and $RestoreProject.StartsWith('nexora-restore-')) 'Cleanup ownership missing'
$nowIds = @((Invoke-Native docker @('ps','-aq','--filter',"label=com.docker.compose.project=$RestoreProject")) -split '\s+' | Where-Object { $_ })
Require (-not (Compare-Object @($RestoreIds | Sort-Object) @($nowIds | Sort-Object))) 'Restore container inventory changed; keep resources'
$now = (Invoke-Native docker (@('inspect') + $nowIds)) | ConvertFrom-Json
foreach ($c in $now) {
    Require ($c.Config.Labels.'com.docker.compose.project' -ceq $RestoreProject) 'Cleanup label mismatch'
    foreach ($m in $c.Mounts) {
        Require ($m.Type -eq 'volume' -and $m.Name -in $RestoreVolumes.Values -and $m.Name -notin $SourceVolumes.Values) 'Cleanup mount mismatch'
    }
}
$volNames = @((Invoke-Native docker @('volume','ls','-q','--filter',"label=com.docker.compose.project=$RestoreProject")) -split '\s+' | Where-Object { $_ })
Require (-not (Compare-Object @($RestoreVolumes.Values | Sort-Object) @($volNames | Sort-Object))) 'Cleanup volume inventory changed'
foreach ($name in $volNames) {
    $v = ((Invoke-Native docker @('volume','inspect',$name)) | ConvertFrom-Json)[0]
    Require ($v.Labels.'com.docker.compose.project' -ceq $RestoreProject -and $v.Driver -ceq 'local' -and -not $v.Options) 'Unreviewed volume driver/options'
}
$netNames = @((Invoke-Native docker @('network','ls','--format','{{.Name}}','--filter',"label=com.docker.compose.project=$RestoreProject")) -split '\s+' | Where-Object { $_ })
Require ($netNames.Count -eq 1 -and $netNames[0] -ceq ($RestoreProject + '_default')) 'Unexpected restore networks'
$net = ((Invoke-Native docker @('network','inspect',$netNames[0])) | ConvertFrom-Json)[0]
Require (@($net.Containers.PSObject.Properties.Name | Where-Object { $_ -notin $nowIds }).Count -eq 0) 'Unowned network attachment'
$null = Invoke-Native docker ($Restore + @('down','--volumes'))
```

Never substitute `$Source`, default `nexora` or source volume names in cleanup.
No `createdb`/`dropdb` runs on the source cluster. Delete temporary restore config
only after private custody/receipt preservation; retained backup is not cleanup data.

#### 5. Carrier first initialization, only if justified

Prefer retaining existing Carrier material. First initialization requires fresh
read-only `carrier_connection_secrets` key-version inventory showing no ciphertext,
no existing Carrier keyring, owner confirmation and a protected custody destination.
Otherwise stop and recover existing keys. Identity keys remain byte-identical.

Concrete one-time generation, after the four prerequisites above are explicitly
confirmed. Save this non-secret JavaScript to a protected temporary file
`$Backup\initialize-carrier.cjs`, then invoke pinned host Node **24.19.0** on it.
It writes a separate new file and never edits `.env`. Existing Identity ENV must
already be securely loaded in this private session from retained custody, not argv.
The compiled API `dist` must match the reviewed checkout (otherwise stop).

```javascript
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
try {
  const { EnvironmentKeyring } = require(
    path.resolve("apps/api/dist/common/crypto/environment-keyring.js"),
  );
  const identity = new EnvironmentKeyring(process.env, "IDENTITY");
  identity.key(identity.activeVersion());
  if (
    process.env.CARRIER_KEYRING_JSON ||
    process.env.CARRIER_ACTIVE_KEY_VERSION
  )
    throw Error();
  const key = randomBytes(32);
  for (const version of Object.keys(
    JSON.parse(process.env.IDENTITY_KEYRING_JSON),
  ))
    if (identity.key(Number(version)).equals(key)) throw Error();
  const raw = JSON.stringify({ 1: key.toString("base64") });
  const carrier = new EnvironmentKeyring(
    { CARRIER_KEYRING_JSON: raw, CARRIER_ACTIVE_KEY_VERSION: "1" },
    "CARRIER",
  );
  if (carrier.key(carrier.activeVersion()).length !== 32) throw Error();
  const fd = fs.openSync(process.argv[2], "wx", 0o600);
  try {
    fs.writeFileSync(
      fd,
      "CARRIER_KEYRING_JSON='" + raw + "'\nCARRIER_ACTIVE_KEY_VERSION=1\n",
    );
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  console.log(
    "Carrier keyring initialized: true; Active version: 1; Canonical 32-byte key: true; Independent from Identity keyring: true",
  );
} catch {
  console.error("CARRIER_INITIALIZATION_FAILED_KEEP_EXISTING_CUSTODY");
  process.exitCode = 1;
}
```

```powershell
$CarrierFile = Join-Path $PrivateKeys ('carrier-' + $BackupId + '.env')
Require (-not (Test-Path -LiteralPath $CarrierFile)) 'Carrier custody file exists'
Require ((Invoke-Native node @('--version')) -ceq 'v24.19.0') 'Pinned Node required'
$result = Invoke-Native node @((Join-Path $Backup 'initialize-carrier.cjs'),$CarrierFile)
$result # Fixed sanitized confirmation only
# Verify inherited NTFS ACL on new file before using it; never print contents.
# On partial write/failure quarantine file privately; do not retry or treat as valid.
```

Owner uses a private editor/approved secret tool to merge the two Carrier variables
into a **new reviewed config file**, rejecting duplicate/conflicting variables,
retaining all Identity/runtime values. Validate resolved config in memory, then
select it explicitly as `$SourceEnv` and rebuild `$Source`/`$Standard` arrays.
Never `>`/truncate existing `.env`, append duplicate keys, regenerate keys on upgrade,
or copy secret values through chat. Failure leaves the original file untouched.

#### 6. Upgrade source only after isolated restore passes

**6A — Migration and provisioning only.** This block cannot start application writers.

Owner confirms R1/R2, protected off-machine recovery, custody, OFF controls and the
maintenance window. Confirm fresh source inventory still equals backup; otherwise
stop and re-backup. Retain volumes and matching compatible rollback binaries/config;
source02c2d05/combined-loader callers must never run against migration21.

```powershell
$SourcePreStartReceipt = $null # Invalidate any previous startup authorization.
$PreStartChecks = $null
$null = Invoke-Native docker ($Source + @('stop','api','web','sync-worker'))
# Confirm external provisioning/schema writers remain stopped.
$null = Invoke-Native docker ($Source + @('down')) # NO volume removal
$null = Invoke-Native docker ($Standard + @('build'))
$null = Invoke-Native docker ($Standard + @('up','-d','--wait','postgres'))
$null = Invoke-Native docker ($Standard + @('run','--rm','--no-deps','-T','migrate'))
$null = Invoke-Native docker ($Standard + @('run','--rm','--no-deps','-T','db-runtime'))

```

**6B — Mandatory source pre-start checkpoint.** Set the source context explicitly,
then execute only step7's migration/business/sequence/checksum/legacy-loader block
and read-only ACL capture/review, stopping before its running-process probe. Do not
run the restore-context initializer again. All automatic assertions must pass;
privately review the complete ACL against the canonical provisioner, and matching
image IDs/source revision against the accepted R2 images. Any mismatch or missing
review stops here with writers down; do not confirm a check that was not performed.

```powershell
$Check = $Standard
$PreStartChecks = $null
$SourcePreStartReceipt = $null
# Execute step7 PRE-START checks below with this context; return here afterwards.
```

Only after those checks have actually completed, run this separate confirmation
block. It validates source OFF config in memory and requires a distinct manual
attestation for ACL, matching images/revision and configuration review. Changing
project, revision, configuration or backup invalidates the resulting receipt.

```powershell
Require ($null -ne $PreStartChecks -and $PreStartChecks.Project -ceq $SourceProject -and $PreStartChecks.ChecksumCount -eq $ExpectedMigrations.Count) 'Source pre-start checks missing'
Require (($Check -join "`0") -ceq ($Standard -join "`0")) 'Wrong verification context'
$cfg = (Invoke-Native docker ($Standard + @('config','--format','json'))) | ConvertFrom-Json
Require ($cfg.name -ceq $SourceProject) 'Source project mismatch'
foreach ($service in @('api','sync-worker')) {
    $e = $cfg.services.$service.environment
    Require ($e.SYNC_ENABLED -ceq 'false' -and $e.UNISHIP_LIVE_AUTHORIZED -ceq 'false' -and [string]::IsNullOrEmpty($e.UNISHIP_ACTIVATION_POLICY_JSON) -and [string]::IsNullOrEmpty($e.UNISHIP_RECONCILIATION_POLICY_JSON)) 'Source runtime must remain OFF'
}
Require ($PreStartChecks.Config -ceq ($cfg | ConvertTo-Json -Depth 100 -Compress)) 'Configuration changed since checks'
$confirmation = Read-Host ('After successful ACL, matching images/revision and runtime configuration review, type VERIFIED ' + $SourceProject + ' ' + $Revision)
Require ($confirmation -ceq ('VERIFIED ' + $SourceProject + ' ' + $Revision)) 'Manual pre-start review not confirmed'
$SourcePreStartReceipt = @{ Project=$SourceProject; Revision=$Revision; Backup=$BackupId; Config=$PreStartChecks.Config; Confirmation=$confirmation }
```

**6C — Start matching runtime only after 6B.** This standalone block fails closed
for an absent receipt, failed/unexecuted checks, unconfirmed review or changed context.
It consumes the receipt before starting; a failed start does not authorize a retry.

```powershell
Require ($null -ne $SourcePreStartReceipt -and $null -ne $PreStartChecks) 'Pre-start verification NOT RUN or failed'
Require ($SourcePreStartReceipt.Project -ceq $SourceProject -and $SourcePreStartReceipt.Backup -ceq $BackupId -and $SourcePreStartReceipt.Revision -ceq (Invoke-Native git @('rev-parse','HEAD'))) 'Stale source pre-start receipt'
Require ($SourcePreStartReceipt.Confirmation -ceq ('VERIFIED ' + $SourceProject + ' ' + $Revision)) 'Manual review missing'
$currentConfig = (Invoke-Native docker ($Standard + @('config','--format','json'))) | ConvertFrom-Json
Require ($SourcePreStartReceipt.Config -ceq ($currentConfig | ConvertTo-Json -Depth 100 -Compress)) 'Source configuration changed'
$SourcePreStartReceipt = $null
$null = Invoke-Native docker ($Standard + @('up','-d','--wait','api','sync-worker','web'))
```

Now continue step7's post-start health/process/role/key/file/credential/MFA checks.
Never require running-process acceptance before this startup boundary.

`--no-deps` one-offs are safe here only because builder/init, healthy PostgreSQL,
matching images and preceding migration were explicitly verified. Final `up` may
repeat idempotent migrate/provision prerequisites; require successful completion
and recheck preservation before acceptance. Do not bypass a failed dependency,
blind retry, increase timeout or delete volumes. On failure remain OFF, preserve
incident evidence and follow canonical rollback; no destructive down-migration or
old backup overwrite of current user data.

#### 7. R2 and source post-upgrade acceptance (actual, not configured only)

PRE-START: explicitly select `$Check = $Restore` for R2 or keep
`$Check = $Standard` from step6B for source; do not overwrite the selected context.
The first block and ACL review run before application startup. POST-START begins
at the compiled-process probe and includes health/role/key/files/credentials/MFA.
Return to step6B after source pre-start review; run post-start checks only after6C. Capture all private output; do not run
`database-runtime-smoke.mjs` here: it includes mutating negative probes. Reuse its
contracts through these read-only inspections instead.

```powershell
Require ($null -ne $Check -and (($Check -join "`0") -ceq ($Restore -join "`0") -or ($Check -join "`0") -ceq ($Standard -join "`0"))) 'Select explicit restore/source context first'
$PreStartChecks = $null
$cfg = (Invoke-Native docker ($Check + @('config','--format','json'))) | ConvertFrom-Json
$MigrationAfter = Invoke-Native docker ($Check + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-v','ON_ERROR_STOP=1','-Atc','SELECT migration_name,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY started_at;'))
$ExpectedMigrations = Get-ChildItem -LiteralPath 'packages/database/prisma/migrations' -Directory | Sort-Object Name | Select-Object -ExpandProperty Name
# Compare successful names/checksums against reviewed directory, reject unfinished
# failed records unless explicitly resolved. At this revision expect 21, not forever.
$After = Read-Inventory $Check
$businessBefore = @($R1Source -split "`n" | Where-Object { $_ -and -not $_.StartsWith('_prisma_migrations|') -and (($_ -split '\|')[0] -notin @('column','constraint','index','function','extension')) })
$afterLines = @($After -split "`n")
foreach ($line in $businessBefore) { Require ($line -cin $afterLines) 'Business row/sequence preservation failed' }
$MigrationNames = Invoke-Native docker ($Check + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-v','ON_ERROR_STOP=1','-Atc','SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name;'))
Require (-not (Compare-Object @($ExpectedMigrations) @($MigrationNames -split "`n" | Where-Object { $_ }))) 'Migration inventory differs from reviewed directory'
$Unresolved = Invoke-Native docker ($Check + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-v','ON_ERROR_STOP=1','-Atc','SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;'))
Require ($Unresolved -ceq '0') 'Unresolved migration failure'
$MigrationRows = (Invoke-Native docker ($Check + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-v','ON_ERROR_STOP=1','-Atc',"SELECT coalesce(json_agg(json_build_object('name',migration_name,'checksum',checksum) ORDER BY migration_name),'[]'::json) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;"))) | ConvertFrom-Json
Require (@($MigrationRows).Count -eq $ExpectedMigrations.Count) 'Migration checksum inventory mismatch'
foreach ($migration in $MigrationRows) {
    Require ($migration.name -cin $ExpectedMigrations) 'Unexpected migration path'
    $file = Join-Path (Join-Path 'packages/database/prisma/migrations' $migration.name) 'migration.sql'
    Require ($migration.checksum -ieq (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash) 'Migration checksum mismatch'
}
$LegacyAbsent = Invoke-Native docker ($Check + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-v','ON_ERROR_STOP=1','-Atc',"SELECT to_regprocedure('public.sync_carrier_load(uuid,uuid,integer,uuid,integer)') IS NULL;"))
Require ($LegacyAbsent -ceq 't') 'Legacy combined loader still exists'
$PreStartChecks = @{ Project=$cfg.name; ChecksumCount=@($MigrationRows).Count; Config=($cfg | ConvertTo-Json -Depth 100 -Compress) }
# Only automated checks completed here; ACL and image/config review still required.
# Inspect new capability tables/schema/functions against migrations20/21 before start.
```

**Effective runtime ACL, not just role/function counts:** privately query
`pg_roles` flags (superuser/createDB/createRole/replication/bypassRLS all false),
recursive `pg_auth_members`, object owners, `pg_class.relacl`,
`pg_attribute.attacl`, `pg_proc.proacl`/identity arguments/security-definer/search_path,
`pg_namespace.nspacl`, database/sequence/default ACL. Expand NULL ACLs with
`acldefault`, expand grants with `aclexplode`, include PUBLIC and inherited membership.
Use `has_table_privilege`, `has_column_privilege`, `has_function_privilege` for each
runtime role/signature against **all exact** grants/constants and special column
rules in `packages/database/scripts/provision-runtime.mjs`; compare private sorted
receipts with the R2 restored/provisioned catalog and independently the definitions.
No direct Worker credential/MFA/session/private recovery/budget access; exact
capability EXECUTE only; no runtime ownership/elevated membership. Require
`SELECT to_regprocedure('public.sync_carrier_load(uuid,uuid,integer,uuid,integer)')
IS NULL` true. An unexplained ACL/owner/default-PUBLIC difference stops acceptance.
Never invoke capability functions or destructive negatives just to test denial.

Read-only catalog capture (output assigned privately). Use on provisioned R2 and
source, compare normalized records to the canonical provisioner and each other;
this is not authorization to run the provisioner on source before the upgrade step.

```powershell
$AclSql = @'
SELECT 'role',rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls
FROM pg_roles WHERE rolname IN ('nexora_app','nexora_sync') ORDER BY rolname;
WITH RECURSIVE membership(member,roleid) AS (
 SELECT member,roleid FROM pg_auth_members
 UNION SELECT m.member,p.roleid FROM membership m JOIN pg_auth_members p ON p.member=m.roleid
) SELECT 'membership',a.rolname,b.rolname FROM membership m
JOIN pg_roles a ON a.oid=m.member JOIN pg_roles b ON b.oid=m.roleid
WHERE a.rolname IN ('nexora_app','nexora_sync') ORDER BY a.rolname,b.rolname;
SELECT 'relation',c.relname,c.relkind,pg_get_userbyid(c.relowner),coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))::text
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S') ORDER BY c.relname;
SELECT 'column',c.relname,a.attname,a.attacl::text FROM pg_attribute a
JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum;
SELECT 'function',p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(p.proowner),p.prosecdef,p.proconfig::text,coalesce(p.proacl,acldefault('f',p.proowner))::text
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
ORDER BY p.proname,pg_get_function_identity_arguments(p.oid);
SELECT 'schema',nspname,pg_get_userbyid(nspowner),coalesce(nspacl,acldefault('n',nspowner))::text FROM pg_namespace WHERE nspname='public';
SELECT 'database',datname,pg_get_userbyid(datdba),coalesce(datacl,acldefault('d',datdba))::text FROM pg_database WHERE datname=current_database();
SELECT 'default',pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype,d.defaclacl::text
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
ORDER BY pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype;
SELECT 'legacy-loader-absent',to_regprocedure('public.sync_carrier_load(uuid,uuid,integer,uuid,integer)') IS NULL;
'@
# As with inventory.sql, save this NON-secret SQL in protected storage and copy to
# the selected PostgreSQL container; never interpolate database row values into SQL.
$AclFile = Join-Path $Backup 'acl.sql'
[IO.File]::WriteAllText($AclFile,$AclSql,$Utf8)
$checkPg = Invoke-Native docker ($Check + @('ps','-q','postgres'))
$null = Invoke-Native docker @('cp',$AclFile,"${checkPg}:/tmp/nexora-acl-$BackupId.sql")
$Acl = Invoke-Native docker ($Check + @('exec','-T','postgres','psql','-X','-U','nexora','-d','nexora','-v','ON_ERROR_STOP=1','-At','-f',"/tmp/nexora-acl-$BackupId.sql"))
# Trusted operator reviews ALL table/column/function/sequence/schema/database/
# default and effective PUBLIC/inherited ACLs as described above, not a count.
# Store R2/source receipts privately; do not continue until every diff is explained.
```

Concrete read-only Standard Runtime probe below replaces development assumptions.
Save only this non-secret code to `$Backup\standard-probe.cjs` (UTF-8 without BOM),
then copy it into the selected container. It runs with the container's existing
non-root user; **do not add root/ptrace capabilities**. Actual child ENV is compared
in memory to configured exec ENV, and SQL runs through that actual child's URL
inside `BEGIN READ ONLY`. No raw ENV/URL/ciphertext/key/hash is emitted.

```javascript
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const load = createRequire(path.join(process.cwd(), "package.json"));
(async () => {
  let db;
  try {
    const kind = process.argv[2];
    assert.ok(["api", "sync-worker"].includes(kind));
    const entry = kind === "api" ? "dist/main.js" : "dist/worker/main.js";
    const candidates = fs.readdirSync("/proc").filter((pid) => {
      if (!/^\d+$/.test(pid)) return false;
      try {
        const a = fs
          .readFileSync(`/proc/${pid}/cmdline`, "utf8")
          .split("\0")
          .filter(Boolean);
        return (
          path.basename(a[0]) === "node" &&
          a.length === 2 &&
          path.resolve(a[1]) === path.resolve(entry)
        );
      } catch {
        return false;
      }
    });
    assert.equal(candidates.length, 1);
    const pid = candidates[0],
      before = fs.readFileSync(`/proc/${pid}/cmdline`);
    const env = Object.fromEntries(
      fs
        .readFileSync(`/proc/${pid}/environ`, "utf8")
        .split("\0")
        .filter(Boolean)
        .map((s) => {
          const i = s.indexOf("=");
          return [s.slice(0, i), s.slice(i + 1)];
        }),
    );
    assert.ok(before.equals(fs.readFileSync(`/proc/${pid}/cmdline`)));
    const shared = [
      "CARRIER_KEYRING_JSON",
      "CARRIER_ACTIVE_KEY_VERSION",
      "UNISHIP_API_URL",
      "UNISHIP_LIVE_AUTHORIZED",
      "UNISHIP_ACTIVATION_POLICY_JSON",
      "UNISHIP_RECONCILIATION_POLICY_JSON",
      "SYNC_ENABLED",
      "SYNC_LEASE_SECONDS",
      "SYNC_POLL_MS",
      "SYNC_MAX_ATTEMPTS",
      "SYNC_RESOLVED_RETENTION_DAYS",
    ];
    for (const key of shared) assert.equal(env[key], process.env[key]);
    assert.equal(env.SYNC_ENABLED, "false");
    assert.equal(env.UNISHIP_LIVE_AUTHORIZED, "false");
    for (const key of [
      "UNISHIP_ACTIVATION_POLICY_JSON",
      "UNISHIP_RECONCILIATION_POLICY_JSON",
    ])
      assert.equal(env[key], "");
    const identity = ["IDENTITY_KEYRING_JSON", "IDENTITY_ACTIVE_KEY_VERSION"];
    if (kind === "api")
      for (const key of identity) assert.equal(env[key], process.env[key]);
    else for (const key of identity) assert.ok(!Object.hasOwn(env, key));
    assert.ok(!fs.existsSync("/config/postgres_password"));
    if (kind === "sync-worker")
      assert.ok(!fs.existsSync("/runtime-config/postgres_app_password"));
    const role = kind === "api" ? "nexora_app" : "nexora_sync";
    assert.equal(new URL(env.DATABASE_URL).username, role);
    const dbPath = load.resolve("@nexora/database");
    const { Client } = createRequire(dbPath)("pg");
    db = new Client({ connectionString: env.DATABASE_URL });
    await db.connect();
    await db.query("BEGIN READ ONLY");
    const r = (
      await db.query(
        "SELECT current_user,session_user,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    assert.equal(r.current_user, role);
    assert.equal(r.session_user, role);
    for (const key of [
      "rolsuper",
      "rolcreatedb",
      "rolcreaterole",
      "rolreplication",
      "rolbypassrls",
    ])
      assert.equal(r[key], false);
    let fileCount = null;
    if (kind === "api") {
      const { EnvironmentKeyring } = load(
        path.resolve("dist/common/crypto/environment-keyring.js"),
      );
      const id = new EnvironmentKeyring(env, "IDENTITY"),
        carrier = new EnvironmentKeyring(env, "CARRIER");
      id.key(id.activeVersion());
      carrier.key(carrier.activeVersion());
      for (const [table, ring] of [
        ["user_mfa", id],
        ["carrier_connection_secrets", carrier],
      ]) {
        const rows = (
          await db.query(`SELECT DISTINCT key_version FROM ${table}`)
        ).rows;
        for (const row of rows) ring.key(row.key_version);
      }
      for (const i of Object.keys(JSON.parse(env.IDENTITY_KEYRING_JSON)))
        for (const c of Object.keys(JSON.parse(env.CARRIER_KEYRING_JSON)))
          assert.ok(!id.key(Number(i)).equals(carrier.key(Number(c))));
      const { LocalStorage } = load(
        path.resolve("dist/storage/infrastructure/local-storage.js"),
      );
      const storage = new LocalStorage(env.STORAGE_ROOT);
      const root = fs.lstatSync(env.STORAGE_ROOT);
      assert.ok(
        root.isDirectory() &&
          !root.isSymbolicLink() &&
          root.uid === process.getuid(),
      );
      const files = (
        await db.query('SELECT id,sha256,"sizeBytes" FROM stored_files')
      ).rows;
      for (const file of files) {
        const st = fs.lstatSync(path.join(env.STORAGE_ROOT, file.id));
        assert.ok(
          st.isFile() &&
            !st.isSymbolicLink() &&
            st.uid === process.getuid() &&
            (st.mode & 0o077) === 0,
        );
        const bytes = await storage.read(file.id);
        assert.equal(bytes.length, file.sizeBytes);
        assert.equal(
          crypto.createHash("sha256").update(bytes).digest("hex"),
          file.sha256,
        );
      }
      fileCount = files.length;
    }
    await db.query("ROLLBACK");
    console.log(
      JSON.stringify({
        actualCompiledProcess: true,
        environmentMatches: true,
        off: true,
        restrictedRole: role,
        keyCoverage: kind === "api" ? true : null,
        namespaceIndependence: kind === "api" ? true : null,
        fileCatalogMatches: kind === "api" ? true : null,
        fileCount,
      }),
    );
  } catch {
    console.error("STANDARD_READ_ONLY_ACCEPTANCE_FAILED");
    process.exitCode = 1;
  } finally {
    if (db) await db.end();
  }
})();
```

```powershell
$ProbeFile = Join-Path $Backup 'standard-probe.cjs' # Save the exact block above first.
Require (Test-Path -LiteralPath $ProbeFile) 'Probe file missing'
$actual = @{}
foreach ($service in @('api','sync-worker','web')) {
    $cid = Invoke-Native docker ($Check + @('ps','-q',$service))
    $actual[$service] = ((Invoke-Native docker @('inspect',$cid)) | ConvertFrom-Json)[0]
    Require ($actual[$service].Config.Labels.'com.docker.compose.project' -ceq $cfg.name) 'Runtime project mismatch'
}
function Env-Map($container) {
    $map = @{}; foreach ($entry in $container.Config.Env) {
        $i = $entry.IndexOf('='); $map[$entry.Substring(0,$i)] = $entry.Substring($i+1)
    }; return $map
}
$apiEnv = Env-Map $actual.api
$workerEnv = Env-Map $actual.'sync-worker'
$webEnv = Env-Map $actual.web
foreach ($key in @('CARRIER_KEYRING_JSON','CARRIER_ACTIVE_KEY_VERSION','UNISHIP_API_URL','UNISHIP_LIVE_AUTHORIZED','UNISHIP_ACTIVATION_POLICY_JSON','UNISHIP_RECONCILIATION_POLICY_JSON','SYNC_ENABLED','SYNC_LEASE_SECONDS','SYNC_POLL_MS','SYNC_MAX_ATTEMPTS','SYNC_RESOLVED_RETENTION_DAYS')) {
    Require ($apiEnv.ContainsKey($key) -and $workerEnv.ContainsKey($key) -and $apiEnv[$key] -ceq $workerEnv[$key]) 'Shared runtime mismatch'
    Require ($apiEnv[$key] -ceq [string]$cfg.services.api.environment.$key) 'Runtime/config mismatch'
}
Require (@($webEnv.Keys | Where-Object { $_ -match '^(IDENTITY|CARRIER)_(KEYRING_JSON|ACTIVE_KEY_VERSION)$' }).Count -eq 0) 'Web key exposure'
foreach ($service in @('api','sync-worker')) {
    $cid = Invoke-Native docker ($Check + @('ps','-q',$service))
    $null = Invoke-Native docker @('cp',$ProbeFile,"${cid}:/tmp/nexora-standard-probe.cjs")
    $result = Invoke-Native docker ($Check + @('exec','-T',$service,'node','/tmp/nexora-standard-probe.cjs',$service))
    $receipt = $result | ConvertFrom-Json
    Require ($receipt.actualCompiledProcess -and $receipt.environmentMatches -and $receipt.off) 'Process assertion failed'
    $receipt # Safe booleans/counts/role only
    $null = Invoke-Native docker ($Check + @('exec','-T',$service,'rm','/tmp/nexora-standard-probe.cjs'))
}
Remove-Variable apiEnv,workerEnv,webEnv,actual
```

**Key coverage vs decryption:** use existing compiled `EnvironmentKeyring` with the
actual API process ENV, validate canonical32-byte format/active version and coverage
of every stored `user_mfa`/`carrier_connection_secrets.key_version`. Compare Identity
and Carrier bytes independently, API/Worker Carrier equality; never bulk decrypt.
Ciphertext equality, key coverage, actual decryption and successful MFA are distinct
claims. Owner logs in via Web using the existing ADMIN password+current authenticator,
confirms authenticated user and a read-only ADMIN endpoint requiring persisted MFA
assurance (`GET /api/admin/operators`). No SQL session, MFA reset/re-enrollment or
replay-state edit. This authenticates that enrollment's decrypt path, not every key.
If Carrier ciphertext inventory is empty: NOT APPLICABLE (empty, dated inventory).
If populated without an approved non-live audited verification path: NOT VERIFIED;
never call Uniship to test decryption. Keep the two unenrolled observed ADMINs;
LOCAL startup does not require all ADMINs enrolled. PUBLIC_HTTPS still requires its
separate all-relevant-ACTIVE-ADMIN startup gate; do not disable/delete users to pass.

**Uploads and local health:** before user activity, compare the extracted full file
manifest (relative path/size/SHA256) with source backup. In API as its actual non-root
user, use readonly DB `stored_files` rows and existing
`dist/storage/infrastructure/local-storage` `LocalStorage.read(id)` to compare each
file length with `sizeBytes` and SHA256 with `sha256`. Inspect directory/file UID/mode
and reject symlinks/unsafe root. Empty catalog/files are recorded explicitly; orphan
files are preserved and reviewed, not deleted. `LocalStorage.isReady()`/HTTP ready
performs its normal temporary storage probe, separate from byte-equality evidence.
Do not run the CI persistence fixture: it relies on synthetic manifest/seed records.

```powershell
foreach ($service in @('postgres','api','sync-worker','web','builder','init','migrate','db-runtime')) {
    $id = Invoke-Native docker ($Check + @('ps','-aq',$service))
    Require ($id -match '^[a-f0-9]{12,64}$') 'Missing or ambiguous runtime service'
    $state = ((Invoke-Native docker @('inspect',$id)) | ConvertFrom-Json)[0].State
    if ($service -in @('postgres','api','sync-worker','web')) {
        Require ($state.Running -and $state.Health.Status -ceq 'healthy') 'Runtime health failed'
    } else { Require ($state.Status -ceq 'exited' -and $state.ExitCode -eq 0) 'Prerequisite did not complete successfully' }
}
foreach ($key in $secretFiles.Keys) {
    $volume = $cfg.volumes.$key.name
    $digest = Invoke-Native docker @('run','--rm','--network','none','--read-only','--entrypoint','sha256sum','--mount',"type=volume,src=$volume,dst=/data,readonly",$ArchiveImage,("/data/" + $secretFiles[$key]))
    Require ($digest -ceq $CredentialBefore[$key]) 'Post-init/upgrade credential changed'
}
'All three post-init/upgrade credential comparisons: true'
$cfg = (Invoke-Native docker ($Check + @('config','--format','json'))) | ConvertFrom-Json
$port = $cfg.services.web.ports[0].published
foreach ($path in @('/api/health/live','/api/health/ready')) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:" + $port + $path)
    Require ($response.StatusCode -eq 200) 'Web proxy health failed'
}
# Owner performs the MFA/admin UI check above; never paste cookies/TOTP/password.
```

Create a **sanitized** receipt: backup ID, confirmed source revision/project,
server version, migration inventory, timestamp, file sizes/integrity status,
key-version coverage, separate R1/R2/data/files/three-credential equality/ACL/runtime/
MFA outcomes and off-machine decrypt retrieval status. Store sensitive inventory,
credential hashes, raw config and diagnostic detail only in protected operator
storage; publish only booleans/counts and limitations. Hash PASS is not restore PASS.

#### 8. Stop at Checkpoint A

Keep hard gate false, both runtime flags false and both policies blank. No Carrier
connection, reconciliation or AUTO is authorized. Missing target, password-rotation
confirmation, external authorization review, executed backup/restore, actual upgrade,
owner MFA or separate Stage1 decision keeps operational readiness **BLOCKED —
EXTERNAL PREREQUISITES**. Documentation/CI can make this PR merge-ready without
claiming those operations passed. Account identifiers remain private and unchanged.

### Open PLAN ISSUE (Stage 1 Gate-Opening Blocker)

In `apps/api/src/sync/infrastructure/uniship-sync.runtime.ts` (lines 40–61, line 45 `if (!policy) return;`) paired with `apps/api/src/carrier/infrastructure/uniship/uniship-http.client.ts` (`operationallyAvailable`, lines 266–273), missing `UNISHIP_ACTIVATION_POLICY_JSON` skips owner/account/login validation inside `authorize(scope)`. While `UNISHIP_LIVE_CONTRACT_VERIFIED: boolean = false` (`uniship-http.client.ts:147`), `target()` (lines 433–444) still rejects every non-loopback request with `503 SERVICE_UNAVAILABLE`. **However**, once a future Stage 1 gate-opening PR sets `UNISHIP_LIVE_CONTRACT_VERIFIED = true`, deploying with `UNISHIP_API_URL=https://kh.uniship.vn` and `UNISHIP_LIVE_AUTHORIZED=true` while `UNISHIP_ACTIVATION_POLICY_JSON` is blank would allow `POST /api/carrier-connections` and `POST /api/carrier-connections/:id/reconnect` to send live Uniship HTTP requests for any user without account-scoped policy even when `SYNC_ENABLED=false`. That Stage 1 PR must update `authorize(scope)` / `operationallyAvailable()` to fail closed on non-loopback targets when `!policy`, without breaking loopback unit/integration fixtures.

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

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- Confirmed owner business architecture retains account-scoped `UNISHIP_ACTIVATION_POLICY_JSON` (`ownerUserId`, numeric-string `externalAccountId`, trimmed `loginIdentifier`, `mode`, initial `connectionId` omitted until UI connection creation), stored only in private runtime config.
- Documented Stage 1 empty-policy fail-closed prerequisite (`PLAN ISSUE` in `UnishipSyncRuntime.authorize` / `UnishipHttpClient.operationallyAvailable`) before enabling `UNISHIP_LIVE_CONTRACT_VERIFIED=true` in the future gate-opening PR, plus `UNISHIP_LIVE_AUTHORIZED=false` pre-live hygiene and mandatory external Uniship password rotation (`UNCONFIRMED / BLOCKER`).
- Clarified `LOCAL` Standard Runtime vs `PUBLIC_HTTPS` readiness gates (`verifyPublicStartup` / `assertPublicReady`), separated 4 environment scopes & owner-scope DB checks from unverified external checks, added a binary-safe Windows PowerShell Owner Execution Checklist, corrected historical `v1` digest typo via appended row, and documented Foundation CI harness fixes (`v2`).

### Canonical owners

- `docs/operations/configuration.md`
- `docs/operations/testing.md`
- `docs/tasks/evidence/NEXORA-058/external-gates-and-runbook.md`
- `docs/tasks/active/NEXORA-066-uniship-external-controlled-acceptance.md`
- `docs/tasks/design-reviews/NEXORA-066-rev-2026-11-28-pre-live-readiness-v1.md` (immutable) & `docs/tasks/design-reviews/NEXORA-066-rev-2026-11-28-pre-live-readiness-v2.md`
- `docs/tasks/completed/NEXORA-064-design-system-refinement.md`, `docs/tasks/completed/NEXORA-065-runtime-environment-consistency.md`, and `docs/tasks/active/NEXORA-047-frontend-reference-acceptance.md` (closure/follow-up)

### Documentation verification

- `pnpm format:check`
- `pnpm docs:check`
- `pnpm preflight:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm contracts:check`
- `node --test "scripts/**/*.test.mjs"`
- `pnpm --filter @nexora/api test`

## Evidence

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

### Execution Limitations & Non-Claimed Gates

- **Windows Host vs Canonical Linux CI**: On Windows host (Node `v24.16.0`), `node --test "scripts/**/*.test.mjs"` hit 8 pre-existing OS-specific POSIX failures (`dev-cleanup-smoke.test.mjs` signal exit `1/3`, `docs-check.test.mjs` `.git` `EPERM` `9/10`, `preflight-policy-check.test.mjs` symlink `EPERM` `22/24`, `provision-cluster-smoke.test.mjs` signal exit `3/5`, `public-authority.test.mjs` `sh` missing `1/2`, `runtime-environment.test.mjs` `spawnSync("pnpm")` `1/2`) and `verifyRuntimeComposeEnvironment` failed (`docker.exe` minimal env lacks Windows `%USERPROFILE%`/`%SystemRoot%`). Notice also `carrier-uniship.test.cjs` failed 1/298 under parallel CPU load during `eslint` contention (`timeoutMs: 300`), then passed `2/2` solo and `298/298` (`51` suites) sequentially. Attempt 1's CI-only `102s` container startup slowdown on `dev-smoke.sh` is mitigated by removing gratuitous `--force-recreate` dependency rebuilds (`--no-deps`), adding bounded runtime watch-settle wait (`waitForDevelopmentEnvironment`), and emitting sanitized `DEV_SMOKE_DIAGNOSTIC` JSON telemetry; v2 hosted Foundation subsequently passed on bce6ad0; this does not prove the original startup cause or an observed transient process retry. v3 hosted verification is separate.
- **Unexecuted External / Destructive Gates**: Live Uniship HTTP calls, external Uniship password rotation confirmation, confirmed acceptance target host selection, real server deployment/upgrade (`migrate` 20–21 + `db-runtime`), off-host backup/restore exercise, Mode A production/public HTTPS bring-up, `quality-docker.sh`, Stage 1 live-gate flip (`UNISHIP_LIVE_CONTRACT_VERIFIED`), Stage 2–5 sync/reconciliation/AUTO acceptance, and pre-merge external human review approval were **NOT RUN** in this readiness checkpoint.

## v3 review corrections and verification provenance

Reviewed source bce6ad00fc211add5ace2207134c0fc34ec76571; base
a4ccfaf4cd54fd2a848e263e2c9551cad0c893fe. Documentation-only v3 replaces the
checklist rather than appending a second operational sequence. v1/v2 raw bytes
remain unchanged. No actual owner environment or user data is touched.

Historical v2 CI, API verified 2026-11-28: Preflight46118431184 PASS;
Foundation46118431221/job140897351056 attempt1 PASS, source bce6ad0,
merge checkout5ea3398ce383312d0b75f064deb8a0089443c5b1 (Tech Lead raw-log
receipt supplied in the owner prompt), started2026-11-28T06:50:06Z,
completed by2026-11-28T07:11:24Z. It executed Docker quality/migrated integration,
Pager/Filter, Standard Runtime, public HTTPS, persistence, development actual API/
Worker ENV, compiled CLI MFA/TOTP/replay/restart/Origin/Host/HMR/drift.
Optional46118431289: selector PASS; https-stress and foundation-e3 SKIPPED.
No executed optional stress PASS is claimed. These are v2 receipts, not v3 proof.

Root-cause confidence correction (historical FAIL rows remain verbatim): empty
DevToolsActivePort and process discovery are source-confirmed hazards with
deterministic regression coverage; they are not independently captured full
causal traces of each historical incident. API unhealthy has dependency-rebuild
mitigation and a successful hosted candidate; exact original cause is NOT fully
confirmed. Successful v2 actual-process probes all used attempts=1; that run did
not directly re-observe a transient race.

| Claim                               | Evidence                                                                                                                                                                                   | Date       | Result |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| v2 exact-source hosted verification | gh api actions/runs/46118431221: source bce6ad0, attempt1 success, job140897351056; owner Tech Lead raw-log merge checkout5ea3398; Preflight46118431184; optional selector46118431289 only | 2026-11-28 | PASS   |

### v3 limitations and delivery gate

Windows PowerShell command execution, real backup/encryption/decryption, isolated
restore of owner data, actual upgrade/runtime/MFA acceptance are NOT RUN by agent.
Source observations are dated prior-session records, not fresh target inventory.
No suitable confirmed target is assumed; no live authorization is inferred.
Final v3 candidate CI receipt will be recorded in PR66 description after push,
without committing an endless self-referential CI receipt. PR merge readiness and
Uniship operational readiness are separate; operational conclusion remains
BLOCKED — EXTERNAL PREREQUISITES until owner operations and Stage1 blockers close.

### v3 local verification and independent review corrections

On reviewed source bce6ad0 plus this documentation-only candidate, executed with
`npx --yes --package=node@24.19.0 --package=pnpm@10.34.6 sh -c` and pinned
Node24.19.0/pnpm10.34.6: `pnpm format:check`, `pnpm docs:check`,
`pnpm preflight:check`, `pnpm test:docs` (10/10), `pnpm test:preflight`
(24/24). `git diff --check` and `node --check` for both embedded JavaScript
blocks also passed. Final post-review execution receipts are retained in PR66;
these checks validate documentation/syntax, not Windows or actual operations.

A temporary SQL syntax experiment attempted to create an owned synthetic
PostgreSQL17.11 container with no network; Docker failed before creation with
`no space left on device`. No owned container remained. Inventory/ACL SQL execution
and full PowerShell execution are NOT RUN. No source container/database/volume was
touched; no synthetic failure was substituted with a test on owner data. Only
download cache was reclaimed; no runtime images or user volumes were deleted.

Independent read-only review found and corrected three P2 draft defects: first
Carrier initialization ordering (candidate private key before isolated restore,
source untouched until acceptance); absent PostgreSQL ports represented as null in
PowerShell; restore.env located in separate protected key custody rather than DB/
credential backup directory. Final independent disposition belongs to PR receipt.

| Claim                                | Evidence                                                                                                                                   | Date       | Result |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| v3 documentation and syntax checks   | Pinned local format/docs/preflight plus test:docs10/10 and test:preflight24/24; node --check both embedded snippets; diff whitespace check | 2026-11-28 | PASS   |
| Synthetic SQL execution prerequisite | docker run PostgreSQL17.11 failed before container creation: no space left on device; no SQL executed, no remaining owned container        | 2026-11-28 | FAIL   |

### Final two corrections within v3 — 2026-11-28

Reviewed source648b848264e3917f51ceb236ec5a9589dd6d9e43. Historical v3 hosted
receipt remains PASS: Preflight46122957689; Foundation46122957678,
job140911232021, attempt1; actual checkout135e392ba3b5548f4b269eb4d0401024a4e9417a.
That receipt is not verification of this later candidate. No snapshot or design
scope changed: these corrections enforce the original create-only/bootstrap and
pre-start verification ordering; v1/v2/v3 bytes remain immutable.

Executed `docker compose create --help` on Compose2.40.3 and fetched the official
[create CLI reference](https://docs.docker.com/reference/cli/docker/compose/create/):
--no-build supported, --no-deps absent. Focused static checks verify no application
startup in6A, explicit source context in6B, fail-closed/consumed receipt in6C.
Pinned Node24.19.0/pnpm10.34.6 format/docs/preflight and test:docs10/10,
test:preflight24/24 PASS; git diff --check PASS.
PowerShell parsing/execution and PASS/FAIL/NOT RUN guard execution NOT RUN because
pwsh is unavailable. Synthetic Compose resource creation NOT RUN: matching runtime
images unavailable and approximately75MiB free disk. CLI reference/static checks
do not prove resources were actually created/stopped. No owner environment touched.
Final-source hosted receipt is recorded in PR66 after push, without another commit.

| Claim                                       | Evidence                                                                                                                                                             | Date       | Result |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Two final documentation corrections checked | Compose2.40.3 help plus official reference; focused static option/order/context/guard checks; pinned format/docs/preflight, docs10/10, preflight24/24 and diff check | 2026-11-28 | PASS   |
