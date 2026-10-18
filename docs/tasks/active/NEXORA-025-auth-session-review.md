# NEXORA-025 — Authentication and session review remediation

- **Task ID**: `NEXORA-025`
- **Status**: `VERIFICATION PENDING`
- **Implementation**: `IMPLEMENTED`
- **Verification**: `PARTIALLY VERIFIED`
- **Classification**: SIGNIFICANT
- **Branch**: `fix/auth-session-review`
- **Baseline**: `ea0fce64f0de5201301d05cfe35fde9f4265e80d`

## Plan and interface preflight

Fetched main and confirmed clean worktree; Task025 is unused. New branch from current main. No production activation, schema/grant change, live Carrier call, key/MFA mutation or user volume deletion.

1. Reproduce malformed stored Scrypt hash acceptance, control-character return URL escape, stalled SSR session verification and delayed account-menu interaction before repairs.
2. Accept only evidenced Scrypt serialization: fixed N16384/r8/p1, 16-byte hex salt and 64-byte hex derived key. Invalid serialization returns false before crypto; no cost/migration change. Inspect historical formats before restricting.
3. Sanitize server and password/MFA redirects with trusted fixed URL origin, reject controls/backslashes/authority, return normalized internal path/query/fragment or `/`. Browser percent-encoded regression must never visit an external site.
4. Bound SSR session fetch including body to five seconds; timeout is unavailable, never unauthenticated. Real stalled-header/body HTTP regressions prove abort and cleanup.
5. Reproduce LOCAL harness race using a committed delayed-handler fixture. Wait for observable menu expansion/logout readiness before one logout; retain HTTP, cookie, revoked-session, Origin and failure assertions without auth retries/deadline inflation.
6. Add explicit restricted-credential maintenance CLI, bounded session-only batches using DB time; no scheduler/service/grant change. Genuine PostgreSQL boundary/idempotence/preservation tests.
7. Inspect six API adapter clients/pools. Share a lazy runtime-owned client through infrastructure DI if redundant; sole shutdown owner, separate CLI/admin clients. Preserve transaction/Carrier/MFA/readiness invariants.
8. Pass only minimal presentation strings from server for actual LOCAL/PUBLIC_HTTPS labels; no environment/secret serialization. Synchronize changed canonical facts and retain ADR/evidence history.
9. Targeted RED/GREEN then genuine full Foundation on final PR head; purposeful commits, new Draft PR until required checks pass. No approval/merge.

## Acceptance criteria

All seven finding groups have reproducible regression evidence and reviewed fixes or explicit justified deferral. Correct/wrong/random-salt password behavior, malformed format matrix, internal URL query/fragment normalization, real browser redirect/logout and stalled HTTP aborts covered. Restricted PostgreSQL cleanup preserves active sessions and related rows, repeats safely, uses bounded transactions. Shared client closes once and remains lazy. Full quality, real integration/migrations, LOCAL/public HTTPS/persistence/dev smoke execute successfully on final head before Ready. Public production gates from NEXORA-024 remain NOT VERIFIED.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Strict stored hash parser, internal redirect policy, finite SSR deadline, bounded session maintenance, runtime pool lifecycle, profile-aware UI and repeatable browser harness regression.

### Canonical owners

- docs/decisions/authentication.md
- docs/architecture/backend.md
- docs/architecture/frontend.md
- docs/architecture/database.md
- docs/operations/configuration.md
- docs/operations/testing.md
- docs/operations/setup.md

### Documentation verification

pnpm docs:check; pnpm test:docs; pnpm format:check; final diff review.

## Evidence

| Claim                      | Evidence                                                                                                                                                                         | Date       | Result |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Baseline failure confirmed | GitHub run39033874709/job117399679421 actually checks out main ea0fce6; quality PASS, LOCAL FAIL at OPERATOR_ACCOUNT_MENU_LOGOUT ASSERTION_FAILED; HTTPS/data/dev skipped        | 2026-10-17 | FAIL   |
| Targeted regression GREEN  | Actual Node password3, Web49 (including two real stalled-HTTP aborts), committed Chromium fixture, lint/boundaries/rule50 and operations5 PASS; executed commands detailed below | 2026-10-17 | PASS   |

## Executed test-first findings and implementation

| Claim                            | Evidence                                                                                                                                                                                                                      | Date       | Result |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Malformed hash RED               | New password regression before parser change returns true for arbitrary wrong password against empty decoded key; Node24 actual source                                                                                        | 2026-10-17 | FAIL   |
| Return URL RED                   | New control-character regression before sanitizer change returns slash-tab-slash attacker path instead of fallback                                                                                                            | 2026-10-17 | FAIL   |
| Header/body deadline RED         | Real HTTP listeners accept requests but withhold headers or body completion; original helper exceeds6s and fails unavailable assertion, sockets closed by fixture                                                             | 2026-10-17 | FAIL   |
| Password GREEN                   | node --test packages/database/test/password.test.mjs:3 PASS including malformed matrix, correct/wrong password and random salts                                                                                               | 2026-10-17 | PASS   |
| Web GREEN                        | pnpm --filter @nexora/web test:49 PASS including actual stalled-header/body abort and URL/presentation; Web typecheck PASS                                                                                                    | 2026-10-17 | PASS   |
| Browser race reproduction/GREEN  | node scripts/browser-account-ready.test.mjs: actual Chromium against committed delayed-handler/menu fixture proves old DOM-only click lacks logout, then shared helper observes expansion and ready control before one logout | 2026-10-17 | PASS   |
| Local genuine Prisma unavailable | pnpm --filter @nexora/database generate fails checksum HTTP403; API build and runtime-pool unit loading cannot complete without generated client. No fake Prisma, bypass or historical CI substitution                        | 2026-10-17 | FAIL   |

The browser finding is a harness synchronization defect reproduced independently; existing product logout handlers are unchanged. Actual application HTTP/logout/replay, PostgreSQL cleanup/client lifecycle/concurrency and all five canonical scripts still require new-head Foundation evidence. Six independently constructed Prisma/pg pools were confirmed in AppModule; a shared lazy infrastructure provider replaces them, with standalone construction retained for CLI/testing and no admin credential sharing. Historical password implementation (9700749) and migration fixtures evidence only the original generated serialization; no other legacy format is claimed supported.

Production domain/DNS, trusted certificate issuance/renewal/timer/safe reload, firewall/NAT/IPv6, actual host NTP, real ACTIVE ADMIN enrollment/all key-version custody, encrypted off-host backup/isolated restore/rollback rehearsal remain NOT VERIFIED under NEXORA-024. This task does not activate production or change that ledger's lifecycle.

## Finding disposition and verification blocker

- Password verifier: FIXED, RED/GREEN actual source; valid hashes/costs unchanged.
- Return URL: FIXED, RED/GREEN controls and invalid transport shapes; server/password/MFA call sites all use shared sanitizer. Full application browser assertions are committed but NOT RUN on this head.
- LOCAL account menu: FIXED in harness, old DOM-only sequence reproduced and interactive sequence GREEN in committed Chromium fixture. Product logout implementation unchanged; real HTTP/cookie/replay assertions committed, full runtime NOT RUN.
- SSR deadline: FIXED, two actual HTTP servers prove no-header and unfinished-body abort/closure after5s; timeout remains unavailable.
- Session cleanup: FIXED implementation, explicit bounded restricted CLI and real PostgreSQL batch/boundary/cap/idempotence/preservation tests committed; genuine adapter/CLI execution NOT RUN because client generation and hosted runner are blocked.
- API pool: FIXED implementation after six-pool inspection; lazy singleton/exact-close and real Nest adapter identity/peer shutdown/concurrency tests committed; genuine runtime verification NOT RUN.
- Profile UI/docs: FIXED, pure profile presentation test and Web typecheck PASS; actual LOCAL/public rendering remains in unexecuted full runtime checks.

No finding is intentionally deferred for later implementation. Verification of DB-backed changes remains open in this task; this is not a claim that all review findings are verified resolved.

### Hosted runner and local tooling evidence

| Claim                                       | Evidence                                                                                                                                                                                                              | Date       | Result |
| :------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Source head hosted attempt blocked          | Foundation136 run39036662742 at7fe91cd, attempt1 job117407796459: runner_id0, steps empty, failed before checkout; log endpoint404 BlobNotFound                                                                       | 2026-10-17 | FAIL   |
| Single infrastructure retry blocked         | Same run attempt2 job117408057888: runner_id0, steps empty, failure again; no auth/assertion reruns or test weakening. Actual checkout SHA NOT AVAILABLE; every canonical script NOT RUN                              | 2026-10-17 | FAIL   |
| Documentation lifecycle regression detected | First pnpm quality fails docs:check because the first Evidence table had no PASS row despite targeted GREEN recorded in later section; fixed by recording actually executed targeted PASS in canonical Evidence table | 2026-10-17 | FAIL   |
| Invalid transport RED/GREEN                 | New sanitizer array/object/number regression first throws TypeError; runtime string guard makes all49 Web tests PASS                                                                                                  | 2026-10-17 | PASS   |

Environment skill/status confirms restricted enforced networking, no binaries.prisma.sh allowlist; genuine Prisma download HTTP403. Local Docker28.4 daemon is available, but no matching generated API/build images exist (only PostgreSQL image cached); Docker cannot bypass the same network policy. No proxy/TLS/checksum bypass or additional grants were attempted. Full quality/integration/migrations and all five Docker runtime scripts require a working genuine dependency build and hosted runner. PR21 remains Draft; final exact-head/run state is maintained in its description to avoid a self-referential SHA commit loop. An empty step list is a launch failure, not a code/test FAIL or PASS; underlying runner rejection reason is not exposed by the available connector response.

Self-review checked complete task diff, exact parser bounds, origin normalization at all callers, timer lifetime/body abort, session-only DB time predicate and transaction caps, sole shared-client ownership, retained standalone CLI lifecycle, no secrets in diagnostics, and no migration/grant/Carrier crypto/live/public activation changes. Testing's obsolete API-as-privileged-quality example was corrected to the canonical quality script and includes HTTPS smoke.

## Final local verification before blocker handoff

| Claim                              | Evidence                                                                                                                                                                                                                                                                                                                                                                   | Date       | Result |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Corrected canonical Evidence table | pnpm docs:check PASS after the executed targeted PASS was placed in the same uninterrupted canonical table; pnpm test:docs6 PASS                                                                                                                                                                                                                                           | 2026-10-17 | PASS   |
| Final static/source checks         | Web typecheck; pnpm lint/boundaries; test:lint50; operations5; format:check; node --check browser harness/fixture; git diff --check PASS                                                                                                                                                                                                                                   | 2026-10-17 | PASS   |
| Full host quality remains blocked  | pnpm quality first exposes required API_INTERNAL_URL; correctly configured API_INTERNAL_URL=http://api:4000 NODE_ENV=production pnpm quality passes format/lint/rule50/docs, then genuine database build cannot fetch schema-engine checksum (EAI_AGAIN binaries.prisma.sh). Earlier direct generate returned HTTP403. No full typecheck/test/contracts/build PASS claimed | 2026-10-17 | FAIL   |

Genuine PostgreSQL integration/migrations, runtime-pool unit loading and all five canonical Docker scripts remain NOT RUN for this source. Tests are committed and required before approval/Ready; no test skips/assertions/grants/deadlines were weakened. The actual executed workflow checkout remains NOT AVAILABLE until a runner starts. Final head and any launch-only run are recorded in PR21; a failure before checkout must never be described as testing the merge/head tree.

## PR21 verification follow-up — 2026-10-18

Existing branch/head4b691e4 and main ea0fce6 match fetched remotes; clean worktree. GitHub preflight returned draft=false despite the prior description; explicitly converted PR21 back to Draft while mandatory verification is blocked. No replacement task/PR. Documentation Impact remains REQUIRED; existing SIGNIFICANT security scope/invariants unchanged.

Plan: restore a positive ADMIN MFA return to /settings with query/fragment in the existing successful flow; retain OPERATOR negative client navigation and add a positive OPERATOR return using the already-required coexistence login. Add one explicit ADMIN negative MFA navigation using an unused recovery code, with successful session logout before the existing pending-cookie test. Verify actual authenticated server 307 destinations separately for valid normalized paths/query/fragment and tab/LF/CR negatives. Native password/MFA/logout actions submit once; retain deadlines, disclosure/login interactivity helpers, Origin/failure/revocation checks and dummy-domain block. No production logic change is planned.

Recheck genuine frozen dependencies/generate and current runner/attempt metadata. No infrastructure retry without evidence of changed launch conditions. A script assertion added but not executed stays NOT RUN. Full PostgreSQL/runtime requirements and NEXORA-024 production gates remain open until actual execution. Final SHA/run/actual-checkout evidence belongs in the PR description after push.

### Follow-up executed evidence and remaining actions

| Claim                            | Evidence                                                                                                                                                                                                                        | Date       | Result |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| Frozen dependency graph          | Pinned pnpm10.34.6 install --frozen-lockfile --offline: all7 workspace projects already up to date, no lockfile/dependency version change                                                                                       | 2026-10-18 | PASS   |
| Genuine generation still blocked | pnpm --filter @nexora/database generate: actual schema-engine.gz.sha256 download HTTP403; current environment observations_current=true, restricted network enforced, binaries.prisma.sh absent from effective allowed hosts    | 2026-10-18 | FAIL   |
| Hosted launch rechecked          | Run39037043274 attempt1/job117408870261 still FAILURE, runner_id0, steps empty, no actual checkout; check has one annotation with null summary, annotation endpoint rejected by connector URL allowlist. No new rerun requested | 2026-10-18 | FAIL   |
| Targeted existing behavior       | Password3, Web49 (real stalled headers/body aborts), committed Chromium delayed-handler fixture, Web typecheck, lint/boundaries, docs unit6 and operations5 actually PASS                                                       | 2026-10-18 | PASS   |
| Canonical host quality blocked   | API_INTERNAL_URL=http://api:4000 NODE_ENV=production pnpm quality: format/lint/rule50/docs PASS, then genuine database build engine checksum DNS EAI_AGAIN; no completed full build/Prisma/typecheck/integration/runtime claim  | 2026-10-18 | FAIL   |

Added browser assertions are NOT RUN: positive ADMIN MFA normalized /settings query/fragment, OPERATOR negative LF plus positive password return via existing coexistence login, explicit ADMIN negative tab via one unused recovery code, actual server307 valid/invalid matrix and browser server-redirect navigation. One additional ADMIN password/MFA login is needed to preserve both positive and negative client coverage; the OPERATOR positive case reuses an existing login. No auth/logout submission is retried, no existing readiness deadline or fixed sleep increased. Existing cookie, Origin, logout response/replay, cancellation and fake-domain/privacy protections remain.

Added PostgreSQL assertions are NOT RUN: independent restricted standalone client closure preserving the API client; actual restricted CLI observed waiting for an owned expired-row lock, self-terminating with sanitized error without test kill, unchanged row/related tables, and successful subsequent cleanup. Existing shared-client/exact-shutdown, cap/repeat/preservation, transaction/concurrency/MFA/Carrier/readiness assertions remain required. This fixture uses admin only to hold its own disposable database row, never to run the maintenance CLI. No new grants/migration/scheduler or production source change.

Administrator action for local verification: use the supported environment configuration/review workflow to permit binaries.prisma.sh HTTPS egress and working DNS/proxy access to its real checksum/engine endpoints with the existing trusted CA; keep the pinned frozen graph. Then rerun genuine generate/database/API build and canonical suites. Do not substitute an unapproved mirror, fake client, disabled checksum or TLS bypass.

Administrator action for hosted verification: inspect the run/job annotation in GitHub UI (the available connector cannot read this endpoint), identify and correct the actual launch rejection without assuming billing/quota/permissions. Preserve the existing ubuntu24.04 runner selection, triggers, permissions and assertions. Retry only once there is evidence launch conditions are restored. No test code executed in the runner_id0 jobs. All five Docker canonical scripts, genuine PostgreSQL integration/migrations and real positive/negative application browser assertions remain BLOCKED/NOT RUN for this follow-up.

PR21 remains Draft with task VERIFICATION PENDING / IMPLEMENTED / PARTIALLY VERIFIED. NEXORA-024 production verification is independent and unchanged. Final follow-up SHA, base, run/attempt and actual checkout (or NOT AVAILABLE before launch) are recorded in the PR description after push. No Ready/merge claim while these blockers remain.

## Owner-approved full local verification path — 2026-10-18

Owner confirms hosted Actions quota/budget is exhausted and explicitly selects full Docker local execution as an alternative for this PR. This is owner confirmation, not a newly inferred annotation cause. The dated canonical Project Rules/Implementation Workflow/Testing/Setup/Runtime amendment supersedes earlier hosted-only acceptance language prospectively; historical FAIL/NOT RUN remains unchanged. All original quality/integration/migration/browser/security/persistence/dev criteria remain mandatory. Full LOCAL verification PASS is distinct from Actions SUCCESS and production release readiness; no budget purchase is required for this path.

### Plan and interfaces

- Continue exact PR21 branch/head981b01d and base ea0fce6, initially clean. No replacement PR/task or production logic change.
- Add one shell entrypoint and standard-library Python runner invoking the existing five scripts in Foundation order, with development shutdown between quality and runtime. No copied test implementation, new CI service, dependency or workflow change.
- Require clean exact commit and pinned tools; clone locally into a new private evidence directory with detached exact SHA, excluding ignored production environment files. Pass only transport/tool/registry settings; never application DB/Identity/Carrier keys/config or arbitrary Compose overrides.
- Preflight real tool versions, local Linux Docker/Compose overlays/Buildx/browser, test ports/subnets and registry/package/real pinned engine checksum access. Do not install tools/change host settings or bypass policy/checksum/TLS.
- Shared namespace guard checks containers/all named volumes/networks before smoke cleanup traps. Wrapper supplies random run-specific suffixes, records ownership claims only after namespace-empty checks, and final cleanup targets exact owned project labels. Existing standalone cleanup fixture already removes only after successful UUID container creation.
- Record original/input branch, actual detached checkout SHA, lockfile checksum, before/after cleanliness, OS/tool versions, UTC timestamps/durations, original step exit codes, explicit NOT_RUN, safe logs and artifact checksums. Never retain raw output/env/config/credentials. Checksums provide integrity, not independent execution attestation.
- Targeted harness tests exercise actual child exit7 through filtering, secret suppression, environment allowlist, collision/duplicate claim rejection and owned-label cleanup failure. These unit tests mock Docker queries only and cannot be called real Docker/Prisma verification.
- Commit all necessary changes before final wrapper execution; update final-head outcomes in PR description afterward. Keep Draft unless full accepted-path canonical verification succeeds; preserve NEXORA-024 gates.

### Read-only GitHub merge-gate checks

Branch main protection GET returned403 Resource not accessible by integration. Rulesets GET returned403 feature unavailable for the current repository plan. These do not establish which required checks apply. No rule/check was changed or bypassed and no runner was registered. Owner/admin must inspect actual protection in GitHub UI if local code verification later passes but GitHub merge stays blocked. Code verification and GitHub merge permission are separate.

### Implementation status before final execution

Documentation Impact remains REQUIRED. scripts/verify-local.sh + verify-local.py provide isolated local orchestration/preflight/evidence; smoke-project.py guards namespace ownership in quality (under wrapper) and each standalone smoke. No application feature/schema/grant/custody/live/public change. Canonical Project Rules, Implementation Workflow, Testing, Setup and Runtime updated with Linux/WSL2 guidance; WSL2 itself NOT VERIFIED. Eight harness unit tests PASS on the agent host; sh -n on wrapper/all five scripts PASS. Full final-head execution is still pending until changes are committed; its exact SHA/result/artifact location belongs in PR21 description.

| Claim                   | Evidence                                                                                                                                                                                                  | Date       | Result |
| :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Harness exception RED   | New real-clean-Git-fixture unit simulates a missing executable after successful preflight; initial orchestrator incorrectly returns0 despite launch exception                                             | 2026-10-18 | FAIL   |
| Harness exception GREEN | Exception handling now forces nonzero; python3 scripts/verify-local.test.py runs8 unit tests PASS, including exit7 preservation/filtering, secret/env exclusion and ownership/cleanup failure regressions | 2026-10-18 | PASS   |

These are orchestration unit tests only. No Docker/Prisma/PostgreSQL/browser-suite PASS is inferred. Final exact-commit local run and artifacts will be recorded on PR21 after committing scripts/docs; if network preflight blocks it, every canonical suite step remains NOT_RUN.

### First committed local execution and IPAM parser correction

| Claim                                | Evidence                                                                                                                                                                                                                                                                                   | Date       | Result |
| :----------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Exact clean local invocation blocked | verify-local.sh --sha61769cb5375e17512ead7cb521b91c278b713aa8 on clean source and matching detached clone; harness8 PASS, exit2 BLOCKED before canonical scripts; Docker network IPAM.Config=null caused TypeError. Private artifacts retained outside checkout; no test namespace created | 2026-10-18 | FAIL   |
| IPAM RED                             | Added fixture using real observed Docker schema (null host/none network ranges): unit parser raises TypeError                                                                                                                                                                              | 2026-10-18 | FAIL   |
| IPAM GREEN                           | Treat absent/null ranges as empty without ignoring real subnet overlaps; all9 harness unit tests PASS. Unexpected exception class is now recorded as a fixed safe category, never raw exception text                                                                                       | 2026-10-18 | PASS   |

The first local attempt is not a suite PASS and not a Prisma/network result: all five scripts were NOT_RUN. Final execution must use the new committed parser fix; final SHA/artifacts/outcome are recorded in PR description. Existing network restriction remains independent; no network/TLS/checksum bypass or runtime assertion change.
