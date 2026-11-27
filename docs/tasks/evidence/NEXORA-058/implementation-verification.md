# NEXORA-058 — technical readiness implementation evidence

Date2026-11-24 Asia/Ho_Chi_Minh. Baseline main5edbcfe1609562f9eb5b6c156cf5cec68b5b71fa;
PR61 merged09:48:23Z with reviewed source fefb596 and CI merge35926ac. Initial
working tree clean; branch feature/uniship-controlled-activation. First commit
e2e03e9 closes062 and freezes formatted058v1 rawSHA185ac494aab2afc766d19b26bfa33913388db64869f86408a00256882a8652af
before source/tests. Results below use working tree based on e2e03e9, not an already
published/final verified HEAD. No hosted runs for058 yet. No live requests/activation.

## Incremental executed RED/GREEN

| Claim                             | Evidence                                                                                                                                                                                                                                                                                                                          | Date       | Result |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Recorded plan gate correction     | Initial static Preflight rejected missing Tactical DDD section in active058 despite snapshot detail; added explicit owning boundaries/invariants to task before source; subsequent static Preflight PASS                                                                                                                          | 2026-11-24 | PASS   |
| Runtime config RED                | New Node unit module missing; node --test apps/api/test/uniship-runtime-config.test.cjs exit1 before implementation                                                                                                                                                                                                               | 2026-11-24 | FAIL   |
| Runtime config GREEN              | Built actual API;3tests PASS for shared Carrier subset, strict absent-OFF scoped policy/manual-AUTO>=60 and existing reconciliation int32/BPS parser/no defaults. Own URL refinement initially threw raw Invalid URL for malformed value; safe try/catch fixed and3/3 PASS                                                        | 2026-11-24 | PASS   |
| Scoped SQL RED                    | New genuine owned signed PostgreSQL fixture on baseline19: missing sync_carrier_snapshot function42883 and NULL to_regprocedure; expected failures before migration/grants                                                                                                                                                        | 2026-11-24 | FAIL   |
| Scoped SQL initial GREEN          | New forward migration installed; real nexora_sync has fixed EXECUTE but no broad secret SELECT/users UPDATE/audit UPDATE or DELETE; initial fixture3tests PASS                                                                                                                                                                    | 2026-11-24 | PASS   |
| Worker store RED/correction       | Missing WorkerCarrierStore module; then own portable inferred-client type build error corrected with PrismaClient annotation. Genuine store fail initially returned PostgreSQL void unsupported by Prisma raw deserializer; cast fixed void result to text, preserving function behavior                                          | 2026-11-24 | FAIL   |
| Independent early SQL P2 RED      | Separate read-only delivery_review agent identified nullable expected-version comparison and NULL permit on idle rate row. Native restricted-role tests reproduce both. Own nested test used parent context and produced pending-promise cancellation; corrected nesting, no timeout/assertion weakening                          | 2026-11-24 | FAIL   |
| Independent early SQL P2 GREEN    | Fixed IS DISTINCT FROM expected-version guards and explicit missing/null token/expiry rejection. Actual signed owned PG suite6/6 PASS,0skip,1730.013562ms; wrong owner/connection, old snapshot, immutable job lifecycle during claim and no post-failure credentials also tested                                                 | 2026-11-24 | PASS   |
| HTTP boundary RED/GREEN           | New real-loopback HTTP test initially showed no admission call/missing-context dispatch. GET/POST wrappers now share admission; abort and no production missing-context fallback. Config+HTTP unit4/4 PASS,0skip                                                                                                                  | 2026-11-24 | PASS   |
| Actual shared HTTP arrival pacing | Real API and Worker role instances and loopback mock HTTP: same connection cross-instance arrival spacing>=1000ms; auth/verify stable owner pending bucket; aborted waiter makes no new request;429 cooldown prevents subsequent dispatch. Signed integration11/11 PASS,0skip,5949.466136ms                                       | 2026-11-24 | PASS   |
| Cancellation RED/GREEN            | Three new actual lifecycle-service regressions RED before signal propagation; after shared-flight waiter accounting, one cancelled waiter preserves the other and all cancelled waiters prevent late candidate commit. Existing Carrier lifecycle plus config/HTTP unit47/47 PASS,0skip,430.898328ms                              | 2026-11-24 | PASS   |
| Stale executor RED/GREEN          | New Sync application regression RED: executor never requested owned stale cancellation. Reused existing cancellation UPDATE and added strictly owned/version-invalidated method, optional queue hook. Sync application + Carrier lifecycle47/47 PASS,0skip,316.615548ms. Genuine recovery/lease cancellation matrix still pending | 2026-11-24 | PASS   |

## Environment and limitations at this checkpoint

Existing task-owned signed PostgreSQL launcher reused with new058 nonce/labels,
private runtime passwords, randomized loopback port, tmpfs PGDATA and base-database
ownership marker. Disposable per-test UUID databases use actual migrate deploy and
runtime role provisioning. STORAGE_ROOT is task-owned canonical private directory;
no Nest runtime verification claimed yet (actual API/Sync/storage/key readiness
will be explicitly checked before composed runtime/integration acceptance). Node24,
pnpm10.34.6, PostgreSQL17.11 image;1.4GiB free before container,about486MiB during;
no shared/user database or volume reset, credentials not printed. Raw logs remain
private ignored local output; Git retains only curated results. Temporary own nested
fixture runner stopped while correcting that task-added test; no unrelated test rerun.

Early review is not final approval. Remaining implementation/security/race/config/
shutdown/composition/activation/runbook/real runtime coverage and full quality/CI
are pending; no overall capability/technical readiness PASS claimed. External gates
remain open. Production thresholds are not configured and fixed live gate remains false.

## Additional executed implementation evidence

All entries are local worktree results, not final hosted HEAD claims.

| Check                      | Result and limitation                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker security/activation | 22/22 then26/26 PASS; recovery/audit/key/mismatch/reconnect/epoch/delete/takeover, manual/AUTO scope and scoped availability. Scope availability assertion first RED then fixed                                                                                                                                                                                |
| Actual Nest wiring         | RED capability unavailable before DI wiring; GREEN after shared runtime. Real HTTP then exposed own API shared-lock permission42501; restored original exclusive mode, no grant widening                                                                                                                                                                       |
| Mock fixture corrections   | Own fixture initially used COMPLETED instead of existing SUCCEEDED, size instead of rowsPerPage and baseline reason instead of status; corrected fixture to existing contracts                                                                                                                                                                                 |
| Actual runtime             | 27/27 then31/31 PASS. Final targeted33/33 PASS,0skip,40031.615149ms includes real login/connect/manual route, Worker loop, no-policy ingestion, synthetic baseline/hide/restore, midpage401/fresh101-record FULL, first-page expiry and synthetic AUTO scheduling; approved query/Bearer, wrong login/account and real dispatch shutdown also asserted         |
| Failed recovery lane       | Read-only reviewer identified the path; implementing agent reproduced ERROR/version2 with old job RUNNING (RED); wait now invokes strictly proved owned cancellation on unavailable/stale; GREEN, no successor cancellation                                                                                                                                    |
| SQL bounds/ACL             | Held user-row/table locks prove55P03 and waits<1s for scoped calls/runtime audit;250ms lock,1s statement and2s transaction limits are configured safeguards, not three separately exercised timeout paths. Native CHECKs,12fixed functionACLs and re-provision overgrant revocation included                                                                   |
| Shutdown regression        | Initial test wrongly waited for deadline rejection before checking drain, so its15s PASS is not RED evidence. Corrected immediate assertion plus temporary generated-build-only removal of drain reproduced RED. Normal compiler restored source and HTTP tests2/2 GREEN. Earlier own shutdownP2028 fixed by draining Worker loop in beforeApplicationShutdown |
| Migration                  | Actual signed owned PG19→20 preserves rows, empty new state, private fixed functions/PUBLIC deny, repeat deploy and Prisma schema diff PASS; historical migrations unchanged                                                                                                                                                                                   |
| Initial lint               | Own new globals/unsafe-finally errors corrected through explicit imports and release sequencing, no disabled rules                                                                                                                                                                                                                                             |

Every listener above is loopback synthetic. External hard-close remains false.

## Local gate execution notes (still before final source commit)

- Targeted current restricted-role/mock Nest runtime36/36 PASS,0skip,
  46678.102584ms. Additional genuine cases: acquisition-budget abort/drain/release,
  different connection progress while another permit is held,5xx cooldown, stale
  permit release denial and actual admitted HTTP shutdown. Cross-process measured
  API/Worker arrival spacing1087.972832ms in this run.
- Independent read-only final review found no source P1/P2 after the regression
  fixes. Its two P3 evidence wording corrections are incorporated; review did not
  execute tests or CI and is not final hosted acceptance.
- Quality attempt1 stopped at own new clearTimeout import error; fixed import.
  Attempt2 collided with test:lint's intentional temporary lint probe because agent
  ran both concurrently; probe cleanup completed, no rule/assertion was weakened.
  Attempt3 passed format/lint/static preflight/docs, then prerequisite Web build
  failed because API_INTERNAL_URL was absent. Attempt4 sets the documented local
  upstream explicitly and is pending; previous failures remain recorded.
- test:docs10/10, test:preflight and test:lint PASS. Native migration deploy/repeat/
  drift PASS. Existing19 SQL migrations unchanged byte-for-byte; snapshot v1 raw
  SHA remains185ac494aab2afc766d19b26bfa33913388db64869f86408a00256882a8652af.
- Compose development/release parse and shared Worker/API setting parity/custody
  checks PASS. Runtime smoke's historical blanket Carrier-key prohibition is
  replaced with explicit shared Carrier/config parity while retaining Identity
  key prohibition, no ports/admin/uploads and actual SQL negative rights checks.
- Local canonical quality-docker runtime NOT RUN: only PostgreSQL17.11 image exists;
  about482MiB disk free during task-owned PG, insufficient for the required API/Web/
  tooling images. No existing volumes/images are removed to create space. Compose
  parsing and genuine host Nest/PG tests are not Docker runtime acceptance. Hosted
  Foundation must provide canonical runtime/browser/public/persistence evidence.
- actionlint NOT RUN: binary unavailable. Workflow change is discovery/configuration
  for new tests only; existing checks/timeouts/assertions retained. Hosted validation
  remains required.

## Broader gates and related fixture updates

Full signed pnpm test:integration first attempt:263tests,261pass,2fail (one assertion
and its parent),0skip,437528.595179ms. The sole failing assertion is the existing
provider-column exact table inventory: new uniship_http_budget was absent from its
expected list. Added the table as required by its own assertion message, retaining
exact inventory, varchar32 and shared length checks. All other integration cases
passed, including Carrier, Mapping V2, reconciliation v3 and the new runtime suite.
This is task-related schema fixture maintenance, not an unrelated failure bypass.

Quality attempt4 passed through typecheck into units, then two task-related fixtures
failed: direct module factory invocation lacked the newly injected runtime; Worker
logging child used user rather than the now-required nexora_sync username and stopped
at startup. Updated only fixture construction to actual DI factories/restricted role;
kept assertions/timeouts.20/20 targeted units GREEN. Web tests were interrupted when
Turbo stopped on API failure, not independently established Web regressions. No
retry/assertion weakening. Full quality/integration final verification is pending.

Compose parity check initially assumed development had no tooling mounts; corrected
that verification script to retain its existing development source/build mounts and
assert absence of admin/runtime/uploads mounts plus readonly sync custody. Actual
configuration parity/custody checks then PASS for development and release.

## Local quality final result

Pinned pnpm quality PASS with API_INTERNAL_URL=http://127.0.0.1:4000, task-owned
STORAGE_ROOT and signed disposable PG prerequisites. All component commands passed:
format:check, lint, preflight:check, docs:check, typecheck, pnpm test, contracts:check,
build. Unit/script totals903/903 (root182,shared2,ui37,database6,API290,Web386),0fail.
Standalone test:docs10/10, test:preflight24/24, test:lint56/56 also PASS. No generated
contract/SDK drift. Subsequent documentation-only updates receive static format/docs/
preflight checks; full integration current result remains pending below until recorded.

## Final local integration result

Executed on2026-11-24; result recovered and reviewed2026-11-27 after session handoff.
Full signed pnpm test:integration PASS263/263,0fail,0skip,391792.266706ms after the
related exact provider-table fixture update. No unrelated failure was suppressed.
This supersedes the pending execution status above, without replacing its historical
failure. Quality remains PASS903/903. Hosted checks and canonical Docker acceptance
remain pending until published source CI completes; no live acceptance is claimed.

## Main integration checkpoint — 2026-11-27

PR64 source0eb92927710cf9b4e931c2611ccec43fcaa560db initially had no Actions runs:
GitHub mergeStateStatus DIRTY after main advanced to
2b31e7e6ba5891fb148e54b9cec5c1d0ae54c4be (NEXORA-063 and PR63). Main's own
Foundation45928559468 and Preflight45928559470 PASS are baseline evidence only.
Frozen v2 plan committed7baeec6 before source merge; v1 remains unchanged.

Resolved four conflicts retaining both062 closure records, both canonical-doc
amendments, main pure query builders and058 scope/fencing. New fixed Unsafe calls
became parameterized tagged SET LOCAL; new long/reused builders accept only exact
scalar/Prisma.Sql parameters. Merged build and current raw SQL lint PASS. Independent
read-only review found no P1/P2; confirmed filters before LIMIT1/100 and original16
complete-recovery parameters. Reviewer ran no tests or CI.

Fresh verified task-owned PostgreSQL replaces only its previous exited container;
no user volumes/images touched. Merged scoped runtime36/36 PASS,0skip,
40052.406333ms. Migration19→20 preservation/repeat/drift PASS. Merged pnpm quality
PASS919/919 (root196,shared2,ui37,database6,API290,Web388), including format/lint/
preflight/docs/typecheck/contracts/build. Full merged integration is pending until
its separate result is recorded. Previous903/263 metrics describe the old baseline.

Merged full signed integration PASS263/263,0fail,0skip,374063.186516ms on2026-11-27.
Merged quality919/919, scoped runtime36/36 and migration repeat/drift all PASS. No
Web/SDK delta versus current main, historical migration edit or foreign frozen-plan
edit. Final hosted source/merge/run/job/attempt/step evidence will be recorded in
[PR64 description](https://github.com/dinhphuquy2k1/nexora/pull/64) after checks complete;
this committed local checkpoint intentionally predates hosted results and never
claims pending CI as PASS. Local canonical Docker remains NOT RUN for disk/images.

Final readability correction: two new policy fragments were split into one condition
per line as required by main's SQL convention. Whole source with whitespace removed
is identical before/after; no SQL token, interpolation or binding-order change.
Preflight45960468119 PASS on f13057d/merge21f4a7c, attempt1. Its still-running
Foundation is superseded by this format-only source update, never claimed PASS.
Exact final-HEAD CI receipt is maintained in PR64 description as linked above.

## First final-source Foundation result

Source91ef3d5d2dd674cd840486d00b89bce5ee1fd0b3; actual merge checkout
241eabc76bf6a81a13f163e8dee2be28a2b356e4. Attempt1 Preflight45961050439
job140378687491 PASS; Sync45961050466 job140378687699 PASS (35/19/61/59/36 tests,
all PASS,0skip). Foundation45961050403 job140378687838 FAIL step4:
PROVISION_CLUSTER_SMOKE_FAILED step=EXECUTE_SUITE_SHIPMENT-WORKER err=DOCKER_COMMAND_TIMEOUT
No individual failed assertion/subtest is identified by that bounded diagnostic.
The launcher uses180000ms;058 had appended runtime integration to the preexisting
two-file suite. Split only058's added invocation into a separate signed launcher entry
with the same bound; retain original sequence/coverage/timeouts. This is a task-added
fixture/discovery correction. Local Docker remains unavailable. No existing failed
run is rerun or rewritten as PASS; new source needs fresh complete CI.

Discovery correction executed evidence: selector fixture RED expected5/actual4 before
registration; complete launcher fixture8/8 GREEN, then selector/mount/argument-specific
case GREEN. Actual host signed wrapper default PASS118.056s (original Shipment and
FULL observation only); runtime-only PASS49.957s,36/36,0skip. Both include real builds,
signed PostgreSQL and restricted roles, run sequentially, each below unchanged180s.
This does not establish exact failed-CI subtest timing. Independent read-only review
found no P1/P2 or timeout/assertion/concurrency/coverage weakening. Hosted canonical
verification remains required on the corrected source; failed91ef3d5 run is retained.

Post-correction pinned pnpm quality PASS919/919, including format/lint/static
preflight/docs/typecheck/contracts/build. Signed default entries23/23 and47/47 PASS;
new runtime-only36/36 PASS. Source discovery changes do not alter application/SQL
runtime or existing budgets. Fresh exact corrected-source hosted checks remain pending
in PR64 receipt; no failed workflow attempt is rerun or reclassified.
