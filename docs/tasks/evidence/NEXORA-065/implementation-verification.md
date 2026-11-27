# NEXORA-065 — runtime environment and development MFA verification

## Provenance and boundaries

Reviewed baseline A:1cd46d191ab5373703b4245baad33d03a0b33112, exact fetched main.
PR64 merged2026-11-27T15:07:40Z from49dc3d2a0f3474a5ee5aeea1328d0abda38239e2.
First commitad46e4c closes058/transfers external gates to PLANNED066 and freezes065
before source/tests. v1 raw digest:
4c6697f98ab450841a869f214bf2de193fb2f39316dbeaf02f2dbe295d574121.
Task registry maximum064 was inspected before assigning065/066. No overlapping
open PR or newer main commit was present.

Committed harness037986e; candidate configuration5bb2e255ee6320dbc0b3e27ec19d84ac027799c7.
Local runs occurred on the corresponding working-tree bytes before these commits;
final harness fingerprints below bind the content. Candidate documentation-only
receipt commit follows this implementation. No application source, public API/SDK,
database/migration/grant, production auth/crypto/Origin/Host or058 Sync/Carrier code
changed. Existing anchors are actually x-sync-runtime/x-carrier-runtime on this
baseline and are preserved exactly, despite differently named examples in prompt.

Environment: Linux cloud workspace, host Node24.22.1 (not pinned canonical24.19.0),
pnpm10.34.6, Turbo2.11.7, PostgreSQL17.11 in a nonce/label-owned container, random
loopback port and signed ownership marker. CLI/API use actual nexora_app credentials;
owned fixture administrator is only migration/provisioning/read-only evidence and
existing test rollback-trigger setup, never an enrollment/session/replay bypass.
All application keys/credentials are synthetic; live flagfalse and constantfalse.
No real Uniship call, production activation/thresholds, user volume or merge.

## Baseline A versus candidate B

Same committed HTTP/TOTP/proc assertions and equivalent fresh fixtures. Baseline
runtime production/configuration bytes equal exact1cd46d1; only plan/test harness
was added before the fixes. Real compiled user-create and mfa-enroll CLI created
separate synthetic ADMIN fixtures, never SQL inserts into identity/MFA/session.

Host-native A/B used actual Turbo HTTP server plus actual Next Web proxy and
resolved Compose Web ENV. The existing Python successful-enrollment exercise was
imported under its new main guard; a temporary transport adapter bound only that
known Compose CLI invocation to the same compiled host CLI/owned restricted ENV.
Real PTY/password/backspace/enrollment/commit checks and independent code generation
were unchanged; readonly enrollment-count/last-step SQL used the owned PG container.
This is supported host-native process proof, not canonical Docker dev acceptance.
Full fixed-path standard/development PTY operations remain in canonical smoke.
No HTTP/auth/MFA operation was mocked.

Temporary commands: `node /tmp/nexora065-host-ab.mjs A`, then same command with B.
That driver creates fresh owned databases, deploys unchanged21 migrations/provisions
roles, provisions users through compiled CLI, starts pinned Turbo/API and real Web,
imports committed verifyDevelopmentMfa/verifyDevelopmentOriginHost/proc helpers,
and removes owned processes/databases/private fixtures on completion. It is not a
new maintained runner. Canonical reproduction remains sh scripts/dev-smoke.sh.

MFA A/B deliberately uses the valid baseline Origin http://127.0.0.1:3001 with
WEB_PORT configured identically for that phase. Custom-port and explicit-Origin
phases restart with separately configured ENV; their failures cannot masquerade
as missing-keyring MFA proof. Private key bytes remain unchanged within each
fixture/restart; A and B have independent fresh fixture keyrings.

| Claim                                     | Expected and actual behavior / command                                                                                                                                                                                                                                                          | Date       | Result |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline static/resolved Turbo RED        | Pinned-PATH node --test scripts/runtime-environment.test.mjs before configuration fix:2/2 fail because API13 lacks IDENTITY_KEYRING_JSON, IDENTITY_ACTIVE_KEY_VERSION, WEB_PORT, ALLOWED_ORIGINS; final causal RED follows correction of irrelevant resolved-global ordering in initial harness | 2026-11-27 | FAIL   |
| Baseline Compose Host RED                 | Host verifyRuntimeComposeEnvironment CLI against unchanged base: Web ALLOWED_HOSTS undefined instead of required forwarded empty/custom value; API container already has Identity/Origin, distinguishing container from child                                                                   | 2026-11-27 | FAIL   |
| Baseline actual child ENV RED             | Same proc/inode probe finds actual Turbo HTTP server but reports exactly four missing names above; CLI Identity configured/enrollment committed, no raw ENV emitted                                                                                                                             | 2026-11-27 | FAIL   |
| Baseline MFA causal RED                   | Actual successful compiled CLI/PTY enrollment, valid current pending challenge, later independent TOTP, baseline-valid Origin; HTTP verify500 INTERNAL_ERROR, no session cookie and zero stored sessions                                                                                        | 2026-11-27 | FAIL   |
| Baseline Origin causal RED                | Separate custom WEB_PORT derived and explicit ALLOWED_ORIGINS phases: intended custom Origin rejected FORBIDDEN while unintended default3001 still reaches MFA_ENROLLMENT_REQUIRED; no MFA claim inferred from these403s                                                                        | 2026-11-27 | FAIL   |
| Baseline Host runtime RED                 | Real Web started with baseline resolved Compose ENV: custom raw Host returns400                                                                                                                                                                                                                 | 2026-11-27 | FAIL   |
| Candidate static/resolved/config GREEN    | Same final tests2/2; expanded standard/dev/release/public Compose cases pass, no raw dry/config output                                                                                                                                                                                          | 2026-11-27 | PASS   |
| Candidate actual API ENV GREEN            | Exact17 fields equal expected, Identity present and nexora_app role; same PID/socket/owner/watch-supervisor selection                                                                                                                                                                           | 2026-11-27 | PASS   |
| Candidate actual MFA/replay/restart GREEN | Same verifyDevelopmentMfa: CLI enrollment, no password-only session, valid TOTP, ADMIN+MFA, consumed challenge, fresh-valid-challenge replay401/no new session/unchanged lastUsedStep; existing session and fresh current-step TOTP/assurance after API restart pass                            | 2026-11-27 | PASS   |
| Candidate Origin/Host GREEN               | Both loopbacks accepted at configured custom port when derived; explicit list replaces defaults, wrong/missing/null/path/internal/old-port Origin denied; configured raw Host200/unknown Host400                                                                                                | 2026-11-27 | PASS   |

The captured baseline log explicitly reports `CryptoFailure observed=false`.
There is no captured CryptoFailure stack/class claim. Causal ENV→MFA failure is
supported by actual key presence/absence, CLI commit, valid challenge/step/Origin,
configuration-only intervention and successful B. Source inspection identifies
EnvironmentKeyring/SecretCipher as the existing decryption path; auth code is not
changed to force a different outcome.

## Verification executed locally

All commands use pinned pnpm10.34.6; quality uses owned fixture readiness variables
and existing genuine generated/build graph. No package/dependency version changed.
Run URL/job/attempt are not applicable to local commands; hosted receipts below are
separate. Root suffix discovery automatically includes renamed environment test,
new TOTP tests and retained smoke tests; no package filename list or runner changed.

| Claim                         | Exact command and actual result                                                                                                                                                               | Date       | Result |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Expanded Turbo                | node --test scripts/runtime-environment.test.mjs:2/2 PASS (static exact17/global/tasks/custody plus real strict dry JSON)                                                                     | 2026-11-27 | PASS   |
| Resolved Compose              | node --input-type=module importing/calling verifyRuntimeComposeEnvironment():48 profile/Sync/LOCAL-origin cases plus3 missing-public-field negatives; PASS                                    | 2026-11-27 | PASS   |
| Independent TOTP and raw Host | node --test scripts/helpers/totp.test.mjs scripts/smoke-checks.test.mjs: RFC/offset and actual raw authority/privacy assertions PASS                                                          | 2026-11-27 | PASS   |
| Native MFA PostgreSQL         | node --test integration/mfa-integration.test.cjs from apps/api, signed owned fixture with actual nexora_app:22/22,0skip,10.569s                                                               | 2026-11-27 | PASS   |
| Quality                       | pnpm quality: format:check, lint/boundaries, preflight:check, docs:check, typecheck, test, contracts:check and build all exit0;932 tests (201 root,298 API,388 Web,37 UI,6 database,2 shared) | 2026-11-27 | PASS   |
| Lint rule regressions         | pnpm test:lint exit0; run after ordinary lint to avoid intentional negative probe collision                                                                                                   | 2026-11-27 | PASS   |
| Docs regressions              | pnpm test:docs10/10; pnpm docs:check exit0                                                                                                                                                    | 2026-11-27 | PASS   |
| Preflight regressions         | pnpm test:preflight24/24; pnpm preflight:check exit0 including new task/digest and closure                                                                                                    | 2026-11-27 | PASS   |
| Syntax and scope              | Python compile(read_text, ..., exec), sh -n scripts/dev-smoke.sh, git diff --check PASS; diff of application/database/shared/SDK/workflows/public/dev Compose against main empty              | 2026-11-27 | PASS   |
| Independent read-only review  | Reviewed full worktree/v1 and actual A/B/native logs; no P1/P2/P3; explicitly distinguishes no captured CryptoFailure and host versus canonical acceptance; hosted gates still pending        | 2026-11-27 | PASS   |

### Fingerprints and UTC receipt times

Final source assertion fingerprints identify retained source, not secret fixtures.
Formatting-only changes after A/B preserve behavior; the added exact dev-command
assertion checks the identical existing startup command on both sides. No assertion
was weakened between A/B. Temporary orchestration transport is described above;
these digests alone are not a replacement for retained source/runtime prerequisites.

| Retained harness                          | SHA-256                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| scripts/runtime-environment.test.mjs      | 02974e46ac0a000328ac2c91158943f558e9da205cd1637f709ddd7ffb537141 |
| scripts/runtime-compose-contract.mjs      | 396582b2e79a40791118f673eed3ae0587553a0f5f3b1a647a77e0372a549591 |
| scripts/dev-mfa-http-smoke.mjs            | 8df4fbea3e769f2d4544b2d7b2a72f496308316f54223b34da4c198138d0e904 |
| scripts/dev-runtime-environment-probe.mjs | 21ce2f0bc158d4220d8cc1956b396af79f15b0eef1970f19452295a34e15f18b |
| scripts/mfa-enrollment-tty-smoke.py       | ed2addb4f7735a635aebfa665dc6231c80a0b534466819612fee1d58fbf7eddf |
| scripts/helpers/totp.mjs                  | a4c1df210769296a35a6843404c40c7f142596b1a87bcd0d5fcfccd289a15806 |

| Private sanitized receipt       | Recorded UTC completion          | SHA-256                                                          |
| ------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| nexora065-host-a-final.log      | 2026-11-27T15:52:11.925133+00:00 | ab62e8d792e4b944367260b6f6059de2e224df6b4025a3d3de5156ba4d501fa3 |
| nexora065-host-b.log            | 2026-11-27T15:55:13.650101+00:00 | 7245bd3fd01fd239f6d07116f5b3449dfb5e1e729e0bef83606b198f2a90096f |
| mapping-065-mfa-integration.log | 2026-11-27T15:58:10.074326+00:00 | 66a5fa4acaa84be53628e0a01d9ee17ce9e366da0240ed679c0d2146ae31ea15 |
| mapping-065-quality.log         | 2026-11-27T16:02:02.112854+00:00 | 7ed93b12b4ac8c69978356736b5c9a52c06d1be4c14edd6069678b03f915038b |
| mapping-065-testlint.log        | 2026-11-27T15:58:16.454781+00:00 | 641718b31cbf022331f73a4edca535d3db8632570aa01996dbd4d0c8362793e6 |
| mapping-065-testdocs.log        | 2026-11-27T15:57:57.832980+00:00 | 0b4e806036c564320127421329e337ac165256df2c87ce436867aa6360f0c62c |
| mapping-065-testpreflight.log   | 2026-11-27T15:57:59.420122+00:00 | 9622790117175c6916495728df1b002fb9e99f3bb4ae762d8006531f13b2d40b |

## Limitations and remaining gates

Local canonical quality-docker/dev-smoke/runtime-smoke/public-https-smoke: NOT RUN
locally because API/Web/tooling images are absent and only about1GiB free, versus
canonical20GiB prerequisite. Host-native A/B is not represented as those Docker
gates. No release images were built/pulled/published; release evidence is resolved
template only. Existing ordinary and signed suite discovery/topology/180000ms
budgets and workflow files are unchanged. Hosted Foundation must execute the full
new dev PTY/MFA/restart/Origin/Host flow and old security/HMR/drift/persistence gates.

Sync Targeted is NOT RUN for this diff's unchanged path filter: no changed path
matches its workflow. Do not touch unrelated code or change workflow just to force
it; no old-source Sync run is new-source proof. Foundation retains original signed
Shipment/Observation/separate Uniship runtime entries. Optional stress selection-only
success is not executed stress evidence. Preflight/Foundation exact final source,
actual merge checkout, run/job/attempt and safe assertions will be pinned in the
new PR description after completion.

External Uniship acceptance remains PLANNED066, linked to original058 matrix and
046 production hosting. No external authorization or live verification PASS is
claimed. Task065 stays VERIFICATION PENDING until required gates/merge/closure under
repository workflow. No auto-merge.
