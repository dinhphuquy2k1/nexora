# NEXORA-058 hardening v3 verification

Date: 2026-11-27 (Asia/Ho_Chi_Minh). Technical synthetic verification only; no live
provider, production activation, thresholds or merge. Task remains VERIFICATION PENDING.

## Source and harness provenance

Reviewed baseline A: `02c2d05a5695ff292cdc2be5a7235170bac39580`.
Reviewed main: `2b31e7e6ba5891fb148e54b9cec5c1d0ae54c4be`.
Plan-first commit: `9125e54`, before source/tests, frozen v3 digest
`728eb7babf573b133ecf3da6a10be6279b401c40307ec132e3e6ba6086dcf2d0`.
v2 digest remains `376b96033b44a4cbe59ab0f723620f755afd828564045c2e5959ede5918d09a9`;
no historical migration or frozen snapshot changed.

Candidate production implementation: `48b640cd3a38f8d1ae7e21f0d681111b6f478d1e`;
subsequent test strengthening `1a57963`/`e1d66a4` requires exactly three resolved
Turbo tasks and rejects invalid recovery proof even with ordinary job lifecycle
equality. No production changes in those two commits. Signed runtime verification
below must include the strengthened proof harness, not merely the earlier64 tests.

Execution environment: Linux cloud workspace, Node24.22.1, pinned pnpm10.34.6,
Turbo2.11.7, PostgreSQL17.11-bookworm in a task-owned tmpfs container with random
loopback port and signed database marker. API/Worker use provisioned nexora_app/
nexora_sync roles; admin authority is confined to owned fixture provisioning and
negative/race setup. Writable task-owned STORAGE_ROOT and synthetic keys/settings
were supplied. No credentials, artifact ciphertext, raw ENV/config or provider URL
payload is retained in this record. Local command receipts have no CI run/job/attempt;
those fields are not applicable until the hosted section below.

## Causal baseline A and candidate B

Same behavioral assertions, not missing-symbol failures. Tests provide both legacy
and purpose-specific reader methods; baseline calls its existing combined reader.
The native Worker assertion selects existing legacy load only on baseline, so a
missing new SQL function cannot count as RED. Exact baseline worktree was built with
existing dependencies and signed migrated PostgreSQL before native/process probes.

| Claim                                     | Exact command / expected and actual behavior                                                                                                                                                                                                                                                                                                                                                                                     | Result |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Baseline Vault/reconnect RED              | `node --test --test-name-pattern='token operation\|recovery authorizes\|audit failure\|post-audit authorization\|activation-denied' apps/api/test/carrier-credential-separation.test.cjs` in baseline worktree with candidate harness:5/5 causal failures. Token path recorded combined-password-read; recovery read ciphertext before audit; stale-after-audit hook was bypassed; denied reconnect claimed once instead of zero | FAIL   |
| Candidate credential and lifecycle units  | Pinned-PATH `node --test apps/api/test/carrier-credential-separation.test.cjs apps/api/test/carrier-vault.test.cjs apps/api/test/carrier-lifecycle.test.cjs scripts/uniship-runtime-environment.test.mjs`:54/54. Includes cancellation after authorization/audit/password read, audit unavailable, post-audit stale and zero-claim denial                                                                                        | PASS   |
| Baseline native restricted capability RED | Signed `node --test integration/uniship-runtime-integration.test.cjs` from apps/api, source02c2d05 build with same behavioral sections: token result contained password; pre-claim password read succeeded instead of rejecting. Both assertions executed as separate subtests                                                                                                                                                   | FAIL   |
| Candidate native runtime                  | Same signed native command, candidate48b640c harness:64/64,0skip,44.581s overall; original runtime and new proof/ACL/audit/CAS/manual reconnect/Prisma projection assertions passed. Strengthened final signed wrapper receipt is recorded separately below                                                                                                                                                                      | PASS   |
| Native API projection A/B                 | Actual API-role adapter query instrumentation against same owned PostgreSQL: baseline metadata projection selected secrets:true (RED); candidate metadata had no secrets relation and read only ACCESS_TOKEN (GREEN). Assertions inspect projection/type only; never log returned artifacts                                                                                                                                      | PASS   |
| Native denied reconnect A/B               | Actual baseline/candidate UnishipSyncRuntime with mismatching synthetic login policy: both return SERVICE_UNAVAILABLE, zero HTTP and unchanged credential digest; baseline lifecycle delta1 (RED), candidate delta0 (GREEN). Candidate regression additionally compares generation and immutable job scope for owner/login/account/optional connection/operational-gate denials                                                  | PASS   |
| Baseline strict Turbo RED                 | Same pinned `pnpm exec turbo run dev --filter=@nexora/api --filter=@nexora/shared --filter=@nexora/database --dry=json` assertion: API task passThroughEnv empty instead of required keys; JSON kept in memory                                                                                                                                                                                                                   | FAIL   |
| Candidate strict Turbo                    | Same resolved CLI and exact task/allowlist assertions: API-only runtime values, shared/database watch-only, strict mode/cachefalse/persistenttrue                                                                                                                                                                                                                                                                                | PASS   |
| Baseline resolved Compose RED             | Same isolated host verifier `verifyUnishipComposeEnvironment()` from scripts/uniship-compose-contract.mjs, baseline cwd: API SYNC_LEASE_SECONDS absent                                                                                                                                                                                                                                                                           | FAIL   |
| Candidate resolved Compose                | Same verifier, candidate cwd: standard/dev/release/public × absent/empty/nondefault/invalid forwarding; all API/Worker settings match, Worker Identity and Web Carrier keys absent                                                                                                                                                                                                                                               | PASS   |
| Actual host development process A/B       | Existing pinned Turbo dev command starts actual HTTP server; /proc socket-inode/entrypoint probe sees baseline propagation mismatch (RED), candidate API equality (GREEN). Actual direct-watch Worker main has shared settings and nexora_sync URL, no Identity in A/B. No provider requests; live flagfalse. This is host-native proof, not canonical Docker dev proof                                                          | PASS   |

Unit harness byte SHA-256 at initial A/B:
`4f6a65421181634d113fab8aef139336208ed2b3cb25e77026c2a7a5864cbb51`.
Initial resolved Turbo harness:
`3f9180faae4fa9c5a7c688825f325246c2a0a27cc1e2ffc317dfa0c31291d42d`;
latest exact-task strengthening is pinned by1a57963 and final CI checkout.
Native/process comparison orchestration was temporary, not a second committed test
runner: native SHA`c65fec7e17b5b7c5ca30ed86b08b3170283650d7729454b67615c42f7df787db`,
process SHA`92dfd3f56058888c362f285ecf54e37a1fa667ffbac0ab4793bed0f477903015`.
Canonical committed regression owners are the files/commands named above and
scripts/dev-smoke.sh, which repeats actual-process verification in Docker.

## Local gates executed

Commands use pinned pnpm10.34.6, owned signed database/readiness environment and
closed live gate. Candidate48b640c plus final test strengthening where stated.

| Claim                                         | Exact command and actual result                                                                                                                                                                              | Result |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Migration upgrade, preservation, repeat/drift | `node test/migration.mjs` from packages/database: original staged19→20 preserved;20→21 unchanged data;16 exact capability functions, legacy removed, PUBLIC revoked; repeat deploy and schema diff exit0     | PASS   |
| Quality                                       | `pnpm quality`: format:check, lint/boundaries, preflight:check, docs:check, typecheck, test, contracts:check and build all exit0.928 script/package tests:197 root,298 API,388 Web,37 UI,6 database,2 shared | PASS   |
| Lint rule regressions                         | `pnpm test:lint` exit0                                                                                                                                                                                       | PASS   |
| Documentation regressions                     | `pnpm test:docs`:10/10                                                                                                                                                                                       | PASS   |
| Preflight regressions                         | `pnpm test:preflight`:24/24                                                                                                                                                                                  | PASS   |
| Separate docs/preflight                       | `pnpm docs:check` and `pnpm preflight:check` exit0; final structural binding also checked after task matrix synchronization                                                                                  | PASS   |
| Shell and process helper syntax               | `sh -n scripts/dev-smoke.sh`; `node --check scripts/dev-runtime-environment-probe.mjs` exit0                                                                                                                 | PASS   |

### Task-owned failed iterations retained

- Initial new native assertions exposed the expected combined-password and no-proof
  defects; these are causal RED, distinct from fixture failures below.
- First candidate native run retained the old12-function assertion; updated to16
  with exact new names, legacy absence and unchanged SECURITY DEFINER/PUBLIC checks.
- New negative proof fixtures initially left expired/stale RUNNING jobs visible to
  later queue selection; the existing claim assertion received null. This was new
  fixture interference, not a production capacity change. Cleanup now removes only
  that test owner's jobs before its owner, respecting restrictive sync_jobs FK.
  An intermediate cleanup attempt hit that FK and was corrected; no production
  scheduler/retry/lease or assertion was changed. Candidate64/64 then passed.
- First quality attempt failed only new-test lint: unused request chunk and missing
  AbortController global declaration. Both fixed; next quality exit0.
- One ad hoc targeted invocation inherited pnpm11.25.0 fallback and failed Turbo
  launch. It is not causal RED or candidate failure evidence; the corrected pinned
  invocation passed54/54. No dependencies/config were loosened to accommodate it.

## Independent review and local limitations

Independent read-only review requested under implementation-code-review skill.
First reviewer was unavailable due usage limit. A second independent reviewer
completed read-only review through e1d66a4: no concrete P1/P2/P3 found. It inspected
purpose readers, audit/recheck, metadata projection, manual reconnect CAS, SQL21
proof/legacy removal/ACLs, task-specific ENV/Compose/proc probe and strengthened
tests. It verified diff whitespace and snapshot/task binding, and explicitly left
final signed/hosted gates pending. This is not merge approval or runtime execution
evidence; self-review is not represented as independent approval.

Local canonical `sh scripts/quality-docker.sh`, `sh scripts/dev-smoke.sh`,
`sh scripts/runtime-smoke.sh`, `sh scripts/public-https-smoke.sh`: NOT RUN locally.
Only PostgreSQL image exists; missing API/Web/tooling images and under0.4GiB free
prevent a valid build/run. No Docker socket was mounted into quality and no release
image was built/pulled/published to disguise template proof as runtime acceptance.
Hosted Foundation must execute those canonical gates at the new source/merge SHA.
Release template config is verified only, images remain unpublished.

External live/production authorization, account custody/host acceptance and the
three-parcel timezone comparison remain NOT RUN, outside this implementation.
No production thresholds, automatic schedule or live integration was enabled.

## Final local signed receipts

| Claim                                      | Exact command / source / actual behavior                                                                                                                                                                                                                                                                      | Result |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Full integration                           | `pnpm test:integration`, implementation48b640c:291/291,0skip,334.884s total. Existing observation remains its own file; this whole CLI duration is not the per-entry signed budget                                                                                                                            | PASS   |
| Original signed Shipment/Observation entry | `node packages/database/test/shipment-worker.mjs`, sourcee1d66a4: original two files unchanged, Shipment23/23 in17.573s and Observation47/47 in97.509s,0skip. Includes genuine package builds/signed role fixture; discovery and180000ms per-entry budget untouched                                           | PASS   |
| Separate signed Uniship runtime entry      | `node packages/database/test/shipment-worker.mjs --uniship-runtime`, sourcee1d66a4:64/64,0skip,44.318s test time. Includes strengthened proof negatives after setting ordinary job lifecycle equal to claimed version. Legacy combined function absent; audit/projection/reconnect/status/race tests all pass | PASS   |
| Final Turbo harness                        | Pinned-PATH `node --test scripts/uniship-runtime-environment.test.mjs`: exact three tasks and strict allowlists PASS; same final file against exact baseline worktree fails API allowlist causally                                                                                                            | PASS   |

### Command receipt timestamps and hashes

UTC completion timestamps below come from the private sanitized local command
receipts. Receipt hashes identify captured output without committing raw logs.
Execution is the Linux owned-fixture environment described above; CI run/job/attempt
are not applicable. Transient A/B probes additionally emit only the fixed safe
boolean/delta assertions described in the A/B table.

| Receipt / command | Completed UTC                    | SHA-256                                                          |
| ----------------- | -------------------------------- | ---------------------------------------------------------------- |
| migration         | 2026-11-27T10:16:28.219362+00:00 | d31e48f4e3f4a58b28d92959883a31236cae361efc5bbd9a02d3ca29d3a318a0 |
| quality-v2        | 2026-11-27T13:52:50.743441+00:00 | 8ea011378c9c4bf400bd830971168f2c6388668275cbd4bec6c1899a2e829dd5 |
| testlint          | 2026-11-27T10:16:47.143748+00:00 | 67184744a6c7277675d5adf209981135b25095728af80dbf7f41dfebafd639c4 |
| testdocs          | 2026-11-27T10:16:42.238101+00:00 | 610a08578f9ab4825ca70d2098f522a07370f9ed1c935d97a72f9b0d152619e3 |
| testpreflight     | 2026-11-27T10:16:44.505841+00:00 | 1f08b213683d9b06121c538ff5bb9a9644ec127b5cd8a829b9933b3bd83970fe |
| full-integration  | 2026-11-27T14:05:38.060739+00:00 | f6136480369cd7c43ca90475ade456b8abc7305cfa47897ab02e3a90422096df |
| signed-shipment   | 2026-11-27T14:07:43.344367+00:00 | a9b6f113cdb70ab447b1e5c18ad940d2eb4ca7c3c4e23847353bbe5b7ae7c339 |
| signed-runtime    | 2026-11-27T14:08:38.383801+00:00 | eb46f8192f0cda23bd8df7b7e66e31b4f27d0a4717c02a9cc2336ad64eedf87f |

Final evidence commit changes Markdown only relative to e1d66a4. Final hosted
receipts must pin their actual source and merge checkout, not borrow source02c2d05
checks. Canonical Docker results remain pending until that hosted execution.
