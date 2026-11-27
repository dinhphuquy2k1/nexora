# NEXORA-065 — Runtime environment consistency and development MFA

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Scope

Complete four missing API-dev ENV variables and LOCAL Web Host forwarding after
merged058. Reuse existing strict Turbo/Compose/proc verifiers and CLI PTY/TOTP/HTTP
helpers. Prove actual development ADMIN MFA/replay/restart, custom Origin/Host and
preserved058 guarantees. No application/auth/crypto/DB/Sync/live behavior changes.
Branch: fix/runtime-environment-consistency. New PR, never PR64 branch.

## Design Review & Reuse Decision

Task ID: NEXORA-065
Classification: SIGNIFICANT
Plan revision: rev-2026-11-27-runtime-environment-v1
Reviewed baseline: 1cd46d191ab5373703b4245baad33d03a0b33112
Design Snapshot: docs/tasks/design-reviews/NEXORA-065-rev-2026-11-27-runtime-environment-v1.md
Design SHA-256: 4c6697f98ab450841a869f214bf2de193fb2f39316dbeaf02f2dbe295d574121

| Component                 | Existing implementations                                                                                                           | Domain owner                                       | Reuse alternatives                                                           | Selected approach                                                                                                                                                                      | Rationale                                                                                     | Risks                                                                           | Verification                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ENV contracts             | turbo.json; scripts/uniship-runtime-environment.test.mjs; scripts/uniship-compose-contract.mjs; scripts/database-runtime-smoke.mjs | Runtime/test infrastructure                        | Duplicate suite, keep provider-only names, purpose rename                    | Rename to scripts/runtime-environment.test.mjs and scripts/runtime-compose-contract.mjs; one test-only scripts/helpers/runtime-environment-contract.mjs independent expected constants | Three existing consumers share requirements without deriving expectations from implementation | Vacuous tasks, secret hashes/config output, stale callers                       | Static JSON and actual strict dry JSON; exact tasks/allowlists/global/build negatives; discovery and caller search             |
| Compose/Host              | compose.yml; compose.release.yml; compose.dev.yml; compose.public.yml; scripts/uniship-compose-contract.mjs                        | Runtime configuration                              | YAML parsing or CLI; duplicate override or inheritance                       | Add Web LOCAL Host once per base/release; extend existing host CLI verifier with separate LOCAL/public fixtures                                                                        | Preserve anchors/settings and explicit required public policy                                 | Public fixture masks LOCAL defaults; keys reach tooling/Web/build               | Resolved standard/dev/release/public; absent/empty/custom; required public failures; all custody assertions                    |
| Actual process            | scripts/dev-runtime-environment-probe.mjs; scripts/dev-entrypoint.sh; scripts/dev-smoke.sh                                         | Test infrastructure                                | Exec env, debug endpoint, existing proc/socket probe                         | Reuse PID/inode/owner mapping; extend API key list to17, keep Worker shared-only and Identity absent                                                                                   | Actual HTTP child proof without production changes                                            | Wrong UID/watch supervisor; secret output                                       | Real Turbo API/Worker; fixed boolean/equality/categories only; canonical dev smoke                                             |
| Enrollment                | scripts/mfa-enrollment-tty-smoke.py; scripts/runtime-smoke.sh                                                                      | Existing CLI test owner; Identity owns behavior    | Duplicate PTY, mock stdin, fixed development option                          | Add --development selecting only two fixed Compose/entrypoint/CLI paths; retain full standard and dev assertions; secure0600-at-create fixture                                         | Real compiled CLI and terminal semantics preserved                                            | Echo/capture leak, rollback, role authority, incompatible callers               | Password/backspace/cancel/EOF/rollback/commit-before-codes/duplicate/restoration; actual enrollment, no SQL enrollment bypass  |
| TOTP and HTTP             | scripts/browser-login-smoke.mjs; scripts/auth-runtime-smoke.mjs; scripts/smoke-checks.mjs                                          | Test infrastructure; production Identity untouched | Copy algorithm, import production TOTP, extract existing pure test generator | Extract scripts/helpers/totp.mjs with compatible totp(key,offset) and explicit-step form; focused scripts/dev-mfa-http-smoke.mjs uses fixture and safe checks                          | Independent algorithm, same Web proxy and existing error/cookie contracts                     | Replay confused with consumed challenge; clock boundary; secrets in diagnostics | RFC vectors, valid fresh challenge replay with persisted step unchanged, fresh step after CLI/restart; session/admin assurance |
| Origin/Host orchestration | scripts/dev-smoke.sh; scripts/auth-runtime-smoke.mjs; scripts/smoke-checks.mjs                                                     | Test/runtime infrastructure                        | Production parser change, extra service, existing bounded flow               | Allocate owned custom WEB_PORT, derive Origin, test derived then recreate API with explicit replacement; raw HTTP Host transport reused                                                | Existing guard/parser policy remains authority                                                | Origin denial masks crypto; stale env after restart; user port collision        | Separate causal MFA A/B with valid baseline Origin; custom-port/explicit/Host negatives; re-probe after recreate               |

### Tactical DDD and domain invariants

This is runtime/test infrastructure, not a new aggregate. Identity retains all
credential, MFA, challenge, replay and session invariants; Carrier/Sync/Shipment
retain existing ownership, transactions and policies. No production layer import,
application port, database/schema/grant or API/SDK change. Test-only helpers share
only technical fixture/config/TOTP transport behavior, never business authorization.

## Plan

1. First commit: close merged058 with source/merge/CI evidence and transfer external
   gates to PLANNED066; record this plan/snapshot before code/tests.
2. Same-harness causal baseline static/resolved/process/MFA/Origin/Host RED, with
   readiness, restricted roles, real CLI enrollment and valid baseline Origin.
3. Extend API dev13→17; Web LOCAL Host forwarding only; preserve all058 settings.
4. Consolidate existing verifiers/shared test-only contracts and mapped proc probe.
5. Parameterize fixed development PTY path, extract independent test TOTP, add
   focused secure-fixture HTTP MFA/replay/restart and Host/Origin phases to dev smoke.
6. Canonical docs, targeted/quality/PG/Docker gates, independent read-only review;
   push new branch/PR and wait exact-final-HEAD hosted evidence. No merge/live.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Full strict API dev ENV/custody, Web Host forwarding, actual MFA/Origin/Host dev
regression and merged058 closure/external066 transfer.

### Canonical owners

- docs/architecture/runtime.md
- docs/operations/configuration.md, setup.md, testing.md, deployment.md as needed
- This task, frozen snapshot/evidence; completed058 and active066

### Documentation verification

pnpm docs:check, test:docs, preflight:check, test:preflight; raw SHA binding.

## Evidence

| Claim                               | Evidence                                                                                                                                                                                                                       | Date       | Result |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| Exact baseline and scope inspection | Fetched main1cd46d191ab5373703b4245baad33d03a0b33112; PR64 merged source49dc3d2; no newer main commits or open overlapping PRs; registry max064; current13 API variables/four missing and absent Web Host forwarding inspected | 2026-11-27 | PASS   |

Implementation and local verification are recorded below. Baseline/main merge closure evidence belongs
in completed058; external authorization belongs in066, never inferred from CI.
Local Docker application gates NOT RUN initially: missing application/tooling images
and about1GiB disk, versus documented20GiB prerequisite. Local Node24.22.1 differs
from pinned canonical24.19.0; preserve exact labels and hosted verification.

## Implementation verification

[Detailed A/B, source/hash/timestamp and limitation record](../evidence/NEXORA-065/implementation-verification.md).
The observed baseline MFA error is500 INTERNAL_ERROR; no CryptoFailure stack was
captured. Candidate configuration-only change fixes the actual proxy/TOTP flow.
Root/task-specific helpers consolidate existing058 implementations; all production
application/DB/SDK/Sync/Carrier/security algorithms and workflow topology stay unchanged.

| Claim                    | Evidence                                                                                                                                                                                      | Date       | Result |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Causal baseline defects  | Exact1cd46d1 runtime/config with same harness: four child ENV missing, actual CLI enrollment then valid-Origin TOTP500/no session, custom Host400 and incorrect custom/explicit Origin policy | 2026-11-27 | FAIL   |
| Candidate runtime/config | Turbo2/2, resolved Compose expanded PASS; actual host Turbo API/proxy MFA/replay/restart/assurance and custom/explicit Origin/Host PASS; canonical Docker separately pending                  | 2026-11-27 | PASS   |
| Quality and genuine MFA  | pnpm quality932 tests/typecheck/contracts/build PASS; native signed-owned PostgreSQL MFA22/22; test:lint, docs10, preflight24 PASS                                                            | 2026-11-27 | PASS   |
| Independent review       | Full source/plan/A-B review: no P1/P2/P3; confirms evidence limits and unchanged production scope                                                                                             | 2026-11-27 | PASS   |

Remaining verification: final-source hosted Preflight/Foundation. Sync Targeted is
NOT RUN under unchanged path filter; its product paths are unchanged and signed
suites remain in Foundation. Local canonical Docker NOT RUN for missing images/
disk; host evidence is not a substitute. Final CI receipts are in the new PR
description. No live traffic/production activation or merge; external gates stay066.
