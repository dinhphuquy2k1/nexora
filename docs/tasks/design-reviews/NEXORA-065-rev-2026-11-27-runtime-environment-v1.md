# NEXORA-065 — runtime environment consistency and development MFA

## 1. Task metadata and reviewed baseline

Task ID: NEXORA-065
Classification: SIGNIFICANT
Documentation Impact: REQUIRED
Plan revision: rev-2026-11-27-runtime-environment-v1
Branch: fix/runtime-environment-consistency
Reviewed baseline: 1cd46d191ab5373703b4245baad33d03a0b33112
Review date: 2026-11-27

Fetched main is exactly PR64 merge1cd46d1, merged2026-11-27T15:07:40Z from
49dc3d2a0f3474a5ee5aeea1328d0abda38239e2. No newer commits/open overlapping PRs.
Task registry ends at064:065 is this implementation,066 the named PLANNED external
acceptance transfer. First commit closes058 under TASK_WORKFLOW1.7, preserving
historical evidence/snapshots and transferring unverified external acceptance.

## 2. Requirements and explicit exclusions

Add four missing API-dev pass-through variables (Identity pair, WEB_PORT,
ALLOWED_ORIGINS) to existing thirteen; forward LOCAL Web ALLOWED_HOSTS in base and
release. Preserve generic/global/build/test/watch contracts, strict mode, all058
shared settings/anchors and runtime custody. Consolidate existing verifiers and
actual PID probe, reuse real CLI PTY enrollment and independent test TOTP, then
prove actual ADMIN MFA/replay/restart and custom Origin/Host through Web proxy.

No production application/Identity/Carrier/Sync/Host/Origin/ErrorFilter/health logic,
API/DTO/SDK, migrations/schema/grants, key/encryption policy, dependencies/versions,
retry/lease/retention/reconciliation or live integration changes. No new runner,
Chromium harness, broad capabilities, user-volume reset or merge. Live constant
remains false; no production activation/thresholds or external calls.

## 3. Governance and canonical owners

Read AGENTS and docs/ai entry/context/rules/workflow/implementation/router/template,
pre-implementation-review and implementation-code-review skills. Consult runtime,
backend/database/sync-extensions/reuse architecture; configuration/setup/testing/
deployment; authentication/multi-carrier/mandatory-review ADRs;058 task/v3/evidence/
canonical external matrix. Unchanged domain contracts are retained. This is test
and runtime infrastructure, not a new business aggregate or domain model.

## 4. Read-only inspection and causal hypotheses

Search scopes: turbo.json, compose\*.yml, scripts environment/CLI/smoke helpers,
apps/api/src/identity and integration/test, apps/web/lib Host/proxy and SDK DTOs,
docs/tasks registry/canonical docs. Symbols: passThroughEnv, ALLOWED*HOSTS,
WEB_PORT, ALLOWED_ORIGINS, IDENTITY*, totp, lastUsedStep, pendingCookie,
verifyUnishipComposeEnvironment, verifyDevelopmentEnvironment, exercise.

Baseline API dev has exactly13 pass-through names; Identity pair and Origin pair
are absent. Compose already supplies those four to API; Web LOCAL Host forwarding
is absent in base/release. CLI runs directly with container env, whereas actual
HTTP child is filtered by Turbo. Missing Identity causing TOTP decrypt failure is
a hypothesis until baseline actual CLI/challenge/current-step/HTTP proof. Custom
Origin failure must be measured separately, not mistaken for MFA keyring failure.
Current Python PTY defaults to standard layout, browser owns the one independent
JS TOTP implementation; dev smoke has hardcoded3001 and only unenrolled ADMIN/
OPERATOR coverage. Current process probe correctly reuses mapped-owner execution.

## 5. Mandatory eight-field reuse audit

| Component                 | Existing implementations                                                                                                           | Domain owner                                       | Reuse alternatives                                                           | Selected approach                                                                                                                                                                      | Rationale                                                                                     | Risks                                                                           | Verification                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ENV contracts             | turbo.json; scripts/uniship-runtime-environment.test.mjs; scripts/uniship-compose-contract.mjs; scripts/database-runtime-smoke.mjs | Runtime/test infrastructure                        | Duplicate suite, keep provider-only names, purpose rename                    | Rename to scripts/runtime-environment.test.mjs and scripts/runtime-compose-contract.mjs; one test-only scripts/helpers/runtime-environment-contract.mjs independent expected constants | Three existing consumers share requirements without deriving expectations from implementation | Vacuous tasks, secret hashes/config output, stale callers                       | Static JSON and actual strict dry JSON; exact tasks/allowlists/global/build negatives; discovery and caller search             |
| Compose/Host              | compose.yml; compose.release.yml; compose.dev.yml; compose.public.yml; scripts/uniship-compose-contract.mjs                        | Runtime configuration                              | YAML parsing or CLI; duplicate override or inheritance                       | Add Web LOCAL Host once per base/release; extend existing host CLI verifier with separate LOCAL/public fixtures                                                                        | Preserve anchors/settings and explicit required public policy                                 | Public fixture masks LOCAL defaults; keys reach tooling/Web/build               | Resolved standard/dev/release/public; absent/empty/custom; required public failures; all custody assertions                    |
| Actual process            | scripts/dev-runtime-environment-probe.mjs; scripts/dev-entrypoint.sh; scripts/dev-smoke.sh                                         | Test infrastructure                                | Exec env, debug endpoint, existing proc/socket probe                         | Reuse PID/inode/owner mapping; extend API key list to17, keep Worker shared-only and Identity absent                                                                                   | Actual HTTP child proof without production changes                                            | Wrong UID/watch supervisor; secret output                                       | Real Turbo API/Worker; fixed boolean/equality/categories only; canonical dev smoke                                             |
| Enrollment                | scripts/mfa-enrollment-tty-smoke.py; scripts/runtime-smoke.sh                                                                      | Existing CLI test owner; Identity owns behavior    | Duplicate PTY, mock stdin, fixed development option                          | Add --development selecting only two fixed Compose/entrypoint/CLI paths; retain full standard and dev assertions; secure0600-at-create fixture                                         | Real compiled CLI and terminal semantics preserved                                            | Echo/capture leak, rollback, role authority, incompatible callers               | Password/backspace/cancel/EOF/rollback/commit-before-codes/duplicate/restoration; actual enrollment, no SQL enrollment bypass  |
| TOTP and HTTP             | scripts/browser-login-smoke.mjs; scripts/auth-runtime-smoke.mjs; scripts/smoke-checks.mjs                                          | Test infrastructure; production Identity untouched | Copy algorithm, import production TOTP, extract existing pure test generator | Extract scripts/helpers/totp.mjs with compatible totp(key,offset) and explicit-step form; focused scripts/dev-mfa-http-smoke.mjs uses fixture and safe checks                          | Independent algorithm, same Web proxy and existing error/cookie contracts                     | Replay confused with consumed challenge; clock boundary; secrets in diagnostics | RFC vectors, valid fresh challenge replay with persisted step unchanged, fresh step after CLI/restart; session/admin assurance |
| Origin/Host orchestration | scripts/dev-smoke.sh; scripts/auth-runtime-smoke.mjs; scripts/smoke-checks.mjs                                                     | Test/runtime infrastructure                        | Production parser change, extra service, existing bounded flow               | Allocate owned custom WEB_PORT, derive Origin, test derived then recreate API with explicit replacement; raw HTTP Host transport reused                                                | Existing guard/parser policy remains authority                                                | Origin denial masks crypto; stale env after restart; user port collision        | Separate causal MFA A/B with valid baseline Origin; custom-port/explicit/Host negatives; re-probe after recreate               |

## 6. Alternatives and selected trade-offs

Reject loose/global key propagation, direct Node API bypass, production crypto/error
changes, new enrollment endpoint, DB-written MFA/session/replay state, generic
configuration framework or duplicate browser suite. Keep existing thirteen058
variables; API dev adds only four. Shared/database remain watch-only. Renames are
purposeful because verifiers now cover Identity/Origin/Host as well as Uniship;
update current callers/docs, preserve historical names in old evidence/snapshots.
Use full PTY dev coverage unless measured budget requires a recorded revision.

## 7. Selected interfaces and orchestration

Test-only constants independently declare CARRIER_UNISHIP_ENV, SYNC_ENV,
IDENTITY_ENV, API_ORIGIN_ENV, TSC_WATCH_ENV and API_DEV_PASSTHROUGH_ENV. They never
read implementation to derive expected values. Static/resolved tests prohibit
credential/global/wildcard/build/Web expansion while preserving existing globalEnv.
Compose verifier retains host orchestration; no Docker socket in quality.

PTY --development uses base+dev (+existing optional override), mapped-owner
/workspace/scripts/dev-entrypoint.sh and existing API entrypoint, compiled
apps/api/dist/cli/mfa-enroll.js. Standard invocation/layout remains unchanged.
Use os.open(O_CREAT|O_EXCL,0600) before writing private fixture; expose reusable
operations behind a main guard for test-only reuse without adding arbitrary CLI paths.
TOTP extraction contains one independent JS algorithm; optional exact-step helper
supports replay/clock assertions without changing existing offset behavior.

Dev smoke generates independent CSPRNG Identity keys under umask077, keeps all058
settings/livefalse, and preserves dev_smoke_user unenrolled then OPERATOR flow.
Provision separate browser_user ADMIN through compiled CLI and real PTY enrollment.
Read last_used_step, poll boundedly until a later current step, then Web-proxy
password challenge/pending cookie/no session/admin denial → TOTP success → session/
admin assurance/pending consumed. Replay uses a fresh valid challenge and the same
successful code, verifies401 and unchanged last_used_step/no new session. Keep
private session/accepted-step fixture for API restart; re-probe actual env and prove
old-session contract plus fresh current-step login/MFA/admin access. No recovery
substitution, time change, re-enrollment or replay-state write.

Use a free owned nondefault loopback WEB_PORT; keep existing internal listeners.
Derived phase accepts both loopbacks only at configured browser port; explicit
ALLOWED_ORIGINS phase recreates API and accepts only127.0.0.1 origin, then re-probes.
Raw Host test accepts configured synthetic host, rejects unknown Host. Fixed safe
failure categories/statuses and container states replace secret-bearing raw dumps
where necessary. Private fixture cleanup covers success/failure/signals.

## 8. Security, concurrency and performance

All application transactions, TOTP/replay/admission/challenge/session/Origin/Host
policies remain unchanged. Tests use restricted nexora_app for CLI/HTTP; owned
fixture admin is only provisioning/read-only evidence and existing rollback-trigger
setup, never enrollment/session/lastUsedStep bypass. No real DB/keys or other user
resources. No secret in argv, logs, diagnostics or artifacts; fixtures0600 and
stdin/file custody only. API Identity, API/Worker Carrier; no Identity to Worker/
Web/shared/database; no keys in build/cache. Proc probe stays mapped UID without
SYS_PTRACE. Poll clock/health boundedly, never retry auth or widen budgets to mask
failures. Preserve full existing dev/standard/public security assertions.

## 9. Compatibility and closure

No migration or contract generation change; contracts:check must remain zero drift.
Preserve pinned Node24.19.0/pnpm10.34.6/Turbo2.11.7. Current host Node24.22.1 is a
local limitation, never represented as pinned canonical Node; hosted uses24.19.0.
No source/test edits before this snapshot.058 technical closure cites source49dc3d2
and merged-main1cd46d1 hosted evidence; external acceptance moves to PLANNED066,
linking existing046 host acceptance and canonical058 matrix/runbook without copying
or granting live permission. Preserve all historical FAILs and frozen snapshots.

## 10. A/B and verification plan

Exact baseline1cd46d1 before fixes with same regression harness; candidate with same
assertions/equivalent synthetic fixtures. Static baseline RED must identify missing
four API env names and Web Host forwarding. Actual MFA RED must prove real CLI
enrollment, CLI Identity custody, Turbo HTTP child Identity absence, valid pending
challenge, later valid independent TOTP, no session and sanitized actual error.
Use a valid baseline Origin to isolate crypto; Origin and Host causal cases are
separate. No setup/dependency/port/role/storage failure counts as RED.

If canonical Docker cannot run locally (currently only PG image/about1GiB free),
record NOT RUN adjacent to evidence and use supported host-native owned PG/Turbo/
actual Web proxy plus existing CLI/PTY successful operation for causal A/B; adapt
only temporary transport orchestration, not authentication or assertions. Pin
baseline/harness/build/environment and clearly distinguish it from canonical
Docker. Candidate canonical dev smoke/standard/public repeat full PTY and runtime
behavior through unchanged Foundation orchestration. Do not invent canonical PASS.

Targeted static/resolved/helper tests, actual process/MFA/Origin/Host A/B first;
then format/lint/test:lint/docs/test:docs/preflight/test:preflight/typecheck/contracts/
quality, relevant real PG suites and unchanged signed discovery/180000ms budgets,
canonical quality/dev/runtime/public Docker gates, independent read-only review and
exact final source/merge/attempt Preflight/Sync/Foundation. No workflow topology or
timeout change. Bounded three-attempt investigation then evidence and re-plan.

## 11. Plan readiness and evidence governance

Plan recorded before source/tests, no owner approval gate. First commit closes058,
creates065/066 records and frozen snapshot. Result columns PASS/FAIL only; unexecuted
checks adjacent with blockers. Exact source/harness/merge/time/environment/command/
expected/actual/run/job/attempt and safe assertion summary per claim. Preserve old
FAILs, no optional selection-only stress PASS claim. Final task VERIFICATION PENDING
until merge/required gates; no merge or production-readiness claim. Independent
review must distinguish actual evidence from static source and report P1/P2/P3.

## 12. Unresolved plan issues

NONE in selected configuration/harness scope. Local canonical image/disk and
host-version limitations are recorded; no dependency upgrade, environment access
change or approval gate is needed to proceed with independent work and hosted gates.
