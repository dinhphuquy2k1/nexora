# NEXORA-034 — Sync Worker and Staging V1

Status: COMPLETED
Capability: IMPLEMENTED
Verification: VERIFIED

## Scope

Implement the owner-supplied PostgreSQL Sync V1 architecture in one PR from main.
Baseline: 156a32414dfefdc235804367307b5f052d9dcb47.
Branch: feat/sync-worker-staging-v1. No merge/deployment authorized.

## Design Review & Reuse Decision

Task ID: NEXORA-034
Classification: SIGNIFICANT
Plan revision: rev-2026-11-05-sync-status-contract-v4
Design Snapshot: docs/tasks/design-reviews/NEXORA-034-rev-2026-11-05-sync-status-contract-v4.md
Design SHA-256: 144543b508b9a730433a2942382a4cff421536ff8ad666c3cd1321f69a393994
Reviewed baseline: 8d451e092e114c09cd50b3a5a9e3fceff82402c3

Read-only inventory, eight-field reuse matrix, domain ownership, alternatives,
contracts, security/locking, migration/test plan and bounded provider/domain
blockers are recorded in the snapshot. Pre-implementation-review skill applied.
Independent pre-code review confirms user→epoch→connection→job order and separate
claim transaction. No owner approval gate under current ADR-009.

| Component               | Existing implementations                                                                      | Domain owner              | Reuse alternatives                 | Selected approach                                                                                                 | Rationale                             | Risks                               | Verification                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| Authorization/lifecycle | identity/infrastructure/user-management.adapter.ts; carrier/infrastructure/carrier.adapter.ts | Identity/Carrier          | Rewrite vs integrate               | Minimal transaction-local Sync cancellation participant                                                           | Preserve status/delete contracts      | Lock inversion, late writes         | Real PG barriers disable/delete/claim                |
| Queue/staging           | packages/database client; existing explicit migrations                                        | Sync technical capability | Memory vs PG                       | Dedicated parameterized adapters, partial unique lane, SKIP LOCKED                                                | Durable atomic checkpoint             | Expiry, crashes, duplicate versions | 20-way admission, restart, rollback, 10000 records   |
| Provider custody/budget | carrier credential vault, uniship/provider-budget.ts                                          | Carrier                   | New transport vs existing boundary | Preserve vault/live gate; shared PG acquisition budget binding in composition                                     | No cross-process quota illusion       | Slot expiry, cooldown               | Concurrent independent API/worker budget clients     |
| Validation/errors       | common/validation/{uuid,hex}.ts; common/http/error-messages.ts; Customer error mapper         | Common/Sync               | Duplicate vs reuse                 | Reuse predicates and safe message, local exhaustive map                                                           | No duplicate regex/framework          | Mass assignment, secret leakage     | Strict inputs, envelope/Origin/owner tests           |
| Domain processing       | Customer aggregate/application port; no Shipment schema                                       | Customer/Shipment         | Invent vs bounded port             | Sync processing port with transaction-local domain adapter capability, no production handler until valid contract | Preserve existing business invariants | False success, mapping loss         | Mock processor explicitly test-only; FK/owner checks |
| UI                      | CarrierDataSyncDrawer, CarrierSyncPanels, Inspection, Select/TabBar                           | Web Carrier               | New page vs reuse                  | Generated SDK reads/actions, abort/generation guards, existing layout                                             | Keep approved presentation            | Stale results, fake data            | Component/real CDP and regressions                   |
| Runtime/tests           | apps/api image/context, init/grant scripts, Node discovery, owned PG launcher                 | Runtime                   | Third app vs entrypoint            | Nest application context, dedicated restricted credentials, no HTTP                                               | API independence                      | Startup, shutdown, privilege        | Actual Docker/process/PG and canonical CI            |

## Milestones

### Infrastructure implementation

- [x] M1: additive worker ADR, application context, Docker/custody/grants/flags.
- [x] M2: durable queue/admission/scheduler/lease and disable/delete integration.
- [x] M3: source identities, conditional staging, retention/provenance.
- [x] M4: processing manifest, versions/outcomes and atomic completion.
- [x] M5 implementation: fail-closed Provider/Processor ports, API/SDK and existing Drawer/Inspection metadata. Live handlers and realtime log streaming are not implemented.

These implementation boxes describe source availability, not full milestone
acceptance. M4 here is the original processing milestone, distinct from the
deferred connection-pool review finding M4 tracked by issue33.

### Verification and acceptance checkpoint

- [x] Baseline99241c0 infrastructure: Preflight24/24, targeted12unit/46PG and Foundation127integration/migration/roles/LOCAL runtime PASS; see the dated evidence and PR32.
      Verified checkpoint54075570d41108e9991d08cced48d9a0867ec1a3 (2026-11-08),
      not automatic certification of later edits:

- [x] Full quality:587 tests,0fail/0skip; formatting/lint/typecheck/contracts/build PASS.
- [x] Focused Carrier regressions:17/17 PASS; real Sync PostgreSQL46/46 PASS.
- [x] Hosted Preflight42441313560:24/24 PASS.
- [x] Hosted Sync Targeted42441313602:12unit/46PG PASS.
- [x] Foundation42441313561 Docker quality and127/127integration/migration/roles/cluster PASS.
- [x] Foundation42441313561 LOCAL runtime/provisioning/TTY/MFA/browser PASS.
- [x] Foundation42441313561 five artifact uploads and owned-resource cleanup PASS.
- [ ] Public HTTPS end-to-end: Foundation42441313561 FAILED at ADMIN_BROWSER_INTERACTIVE_LOGIN/REQUEST_TIMEOUT before observed auth dispatch; F1 OPEN, root cause not verified.
- [ ] Persistence smoke: SKIPPED after HTTPS failure, not PASS.
- [ ] Development smoke: SKIPPED after HTTPS failure, not PASS.
- [ ] M5 full Foundation acceptance: requires all mandatory gates on the final follow-up HEAD; exact-head results are reconciled in PR32 after execution, including any FAIL/SKIPPED. Baseline42008705394 attempt2 also FAILED HTTPS; that history is unchanged.
- [ ] Owner Infrastructure acceptance. Task remains VERIFICATION PENDING/PARTIALLY VERIFIED; no source-only completion or Live Sync readiness claim.

Actual final-head workflow reconciliation is recorded in PR32 metadata after
execution; historical checkpoints below retain their original FAIL/PASS/SKIPPED
results. Production Provider/Domain conformance and approved connection capacity
remain separate pre-Live conditions, not capabilities invented for this PR.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

PostgreSQL queue/worker, independent source identity and current staging, API/UI
transport, restricted runtime custody, execution/retention/operational contracts.

### Canonical owners

Architecture overview/backend/database/runtime/api-contract/frontend; operations
configuration/testing/deployment; new additive Sync ADR and this task.

### Documentation verification

Run pnpm docs:check, pnpm preflight:check and pnpm format:check.

## Evidence

| Claim                                                         | Evidence                                                                                                                                                                                                                                                                                      | Date       | Result |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Checkpoint5407557 quality and focused regressions             | pnpm quality587/587 and focused Carrier17/17 plus real SyncPG46/46; exact head54075570d41108e9991d08cced48d9a0867ec1a3,2026-11-08                                                                                                                                                             | 2026-11-08 | PASS   |
| Checkpoint5407557 hosted infrastructure gates                 | [Preflight42441313560](https://github.com/dinhphuquy2k1/nexora/actions/runs/42441313560)24/24; [targeted42441313602](https://github.com/dinhphuquy2k1/nexora/actions/runs/42441313602)12unit/46PG; merge3480877d28672a4557343819997c8742418de226 into156a32414dfefdc235804367307b5f052d9dcb47 | 2026-11-08 | PASS   |
| Checkpoint5407557 Foundation partial execution                | [Foundation42441313561](https://github.com/dinhphuquy2k1/nexora/actions/runs/42441313561) quality587 and127integration/migration/roles/LOCAL/TTY/browser, uploads and cleanup PASS; same head/merge as above,03:06–03:20UTC                                                                   | 2026-11-08 | PASS   |
| Checkpoint5407557 full Foundation acceptance                  | Same run at03:20:28UTC FAILED HTTPS interactive Login/REQUEST_TIMEOUT; no auth dispatch. Persistence/development SKIPPED, not PASS; root cause UNVERIFIED                                                                                                                                     | 2026-11-08 | FAIL   |
| Initial plan governance                                       | preflight/docs found metadata formatting errors before code; corrected to canonical format                                                                                                                                                                                                    | 2026-11-02 | FAIL   |
| Genuine PostgreSQL queue/staging/application/HTTP behavior    | Owned tmpfs PostgreSQL17.11 launcher; integration/sync-integration.test.cjs18/18, including20-way admission,10000→10005/30items, retries, page restart, heartbeat, disable/delete fences, real Nest guards and generated SDK                                                                  | 2026-11-03 | PASS   |
| Cross-process acquisition budget                              | Same PG suite: actual child worker process plus separate API client, two slots/third denied                                                                                                                                                                                                   | 2026-11-03 | PASS   |
| Restricted worker privileges/cluster cleanup                  | node scripts/provision-cluster-smoke.mjs --suite=provision; actual signed disposable cluster, concurrent roles, lock permissions and forbidden secret/session/DDL access                                                                                                                      | 2026-11-03 | PASS   |
| Existing Carrier visual/accessibility regressions             | Actual compiled TSX/CSS and Chromium CDP; six-viewport matrix, menus, keyboard, cleanup, date/history/status regressions                                                                                                                                                                      | 2026-11-03 | PASS   |
| Round3 denial and partial-schedule regressions                | node --test apps/web/test/carrier-sync-lifecycle.test.mjs; actual component closures,401 fences late200 and further actions; partial readback rebases Cancel while preserving draft                                                                                                           | 2026-11-03 | PASS   |
| Local canonical quality attempt before commit                 | pnpm quality: format/lint/preflight/docs/typecheck/tests executed; contracts regeneration reproducible but gate rejects uncommitted generated files; rerun required after commit                                                                                                              | 2026-11-03 | FAIL   |
| Old remote head Foundation                                    | Run41470963835 at4e08bc1: lint failed; later runtime steps skipped. Findings fixed locally, not evidence for a new head                                                                                                                                                                       | 2026-11-03 | FAIL   |
| Old remote targeted PostgreSQL                                | Run41470963851 at4e08bc1: actual generated build,2policy tests and11PG tests passed; final head must be checked separately                                                                                                                                                                    | 2026-11-03 | PASS   |
| Full local quality after committed contracts                  | API_INTERNAL_URL=http://127.0.0.1:4000 NEXT_TELEMETRY_DISABLED=1 pnpm quality at5a3cc013; format/lint/governance/docs/typecheck,129root/178API/217Web/32UI/6database tests, reproducible contracts and build                                                                                  | 2026-11-03 | PASS   |
| Live Sync component browser behavior                          | Disposable compiled actual TSX/CSS/SDK with isolated synthetic HTTP server and Chromium CDP: partial schedule readback/Cancel, mutation401 denial,360/768/1440 viewport overflow checks; not real Provider integration                                                                        | 2026-11-03 | PASS   |
| Legacy upgrade harness before adding Sync step                | Owned PG test/migration.mjs failed REPEAT_AND_DRIFT because staged fixture omitted new migration; fresh full deploy/diff already passed                                                                                                                                                       | 2026-11-03 | FAIL   |
| Additive legacy migration preservation and drift              | Genuine Prisma deploy/diff plus packages/database/test/migration.mjs in owned PostgreSQL; old rows preserved, empty Sync tables, partial unique lane, repeated deploy and final drift                                                                                                         | 2026-11-03 | PASS   |
| Current implementation hosted targeted verification           | Run41542685993 bound to5a3cc013, checkout57f2ae2 merge with baseline156a324; genuine generated build,6unit/18PG PASS with0skip                                                                                                                                                                | 2026-11-03 | PASS   |
| Hosted full gate before Customer fixture ordering fix         | Foundation41543570656 at82b4000: quality/99integration/legacy drift/provision PASS, customer-sql42P01; later runtime/HTTPS/data/dev skipped                                                                                                                                                   | 2026-11-03 | FAIL   |
| Customer SQL upgrade order and security assertions            | node scripts/provision-cluster-smoke.mjs --suite=customer-sql after ordered pre/post migration phases; actual owned PostgreSQL1/1 plus verified cleanup, all old assertions preserved                                                                                                         | 2026-11-03 | PASS   |
| Hosted cold loopback timing failure                           | Foundation41544905459 ata5723652: existing Uniship verify happy path exceeded100ms; later gates skipped, not PASS                                                                                                                                                                             | 2026-11-03 | FAIL   |
| Functional HTTP checks separated from deliberate100ms timeout | node --test apps/api/test/uniship-verify.test.cjs3/3; real loopback, all header/auth/status/body/error assertions retained, distinct never-responding deadline case, no production changes                                                                                                    | 2026-11-03 | PASS   |
| Review F1–F4 queue/staging/scheduler/budget regressions       | node --test apps/api/integration/sync-integration.test.cjs against owned PostgreSQL17.11:24/24,0skip; RED cases retained; long reservation >31s and lost/terminal fences included                                                                                                             | 2026-11-03 | PASS   |
| Review F5 engine capability before fix                        | Signed owned-cluster SELECT-only FOR SHARE fails42501, demonstrating direct SHARE still needs UPDATE; no substitute column grant accepted                                                                                                                                                     | 2026-11-03 | FAIL   |
| Review F5 least-privilege locking                             | node scripts/provision-cluster-smoke.mjs --suite=provision; exact worker function execution/shared lock blocking/direct metadata UPDATE denial and verified cleanup                                                                                                                           | 2026-11-03 | PASS   |
| Review function migration preservation                        | Genuine Prisma deploy/diff and packages/database/test/migration.mjs:12forward migrations, four fixed functions, old rows preserved, no model drift                                                                                                                                            | 2026-11-03 | PASS   |
| Review transport cancellation                                 | node --test apps/api/test/uniship-budget-cancellation.test.cjs apps/api/test/uniship-verify.test.cjs:5/5 actual loopback HTTP; both auth/verify cancelled before transport timeout                                                                                                            | 2026-11-03 | PASS   |
| Review F6 SDK/Inspection/Drawer lifecycle                     | node --test apps/web/test/carrier-sync-api.test.mjs apps/web/test/carrier-sync-issues.test.mjs apps/web/test/carrier-sync-lifecycle.test.mjs:13/13 including parent401/late Detail200                                                                                                         | 2026-11-03 | PASS   |
| Review F6 browser/privacy/parent state                        | Existing compiled Carrier fixture+Chromium CDP: six-viewport baseline and new issues SDK paging/empty/denial/abort/filter/draft/focus PASS; two synthetic screenshots manually reviewed                                                                                                       | 2026-11-03 | PASS   |

## Blockers and limitations

No authorized Uniship fetch/payload/retention contract or Shipment schema/handler.
No approved Customer sync mapping/actor command. Ports/mock verification must not
be called live integration. No default retention period or destructive cleanup.
Initial host disk25MiB recovered through unused build-cache cleanup; RAM worktree preserves existing work. Final CI required.

## Implementation checkpoint

Historical initial integration checkpoint; current milestone state is above.

M1–M5 code is being integrated; no milestone is claimed fully verified.
Initial source policy tests RED (missing module), then2/2 PASS. Local boundaries,
docs and preflight PASS. Host genuine Prisma generation FAIL with binaries.prisma.sh
403; API typecheck is NOT PASS without generated client. OpenAPI generation and
SDK generation executed. First Web typecheck found an interval union mismatch;
fix underway. Docker build-cache cleanup recovered4GiB, no user volumes removed.
Snapshot received formatting-only normalization before initial publication; raw
digest above is pinned, architecture unchanged.

Independent Round1 identified cross-page manifest version deadlock, rejected
retention reprocessing and missing record retry decisions. Implemented coalescing,
resolved identity metadata and typed retry/backoff; real PG regression execution
required before closure. Provider/domain/production gates remain unavailable.

### Additive transport clarification before final UI verification

Job history now pages/filters in PostgreSQL with distinct actual types, scoped
summary and per-config latest job, rather than treating one returned page as the
whole history/status population. Existing GET job detail returns paginated safe
issue metadata, no payload. QUEUED has no actual start: the frontend history model
keeps required nullable startedAt plus actual createdAt as a separate date-filter
anchor, displays Chưa bắt đầu and never pretends creation was execution. Existing
fully timestamped source fixtures remain valid; missing both timestamps is invalid.
This implements the supplied queued/start/end semantics without changing backend
business behavior, schema ownership or the selected architecture.

### Round2 review and execution

Independent review found immediate mapping persistence before non-APPLIED decisions,
possible target switching, poison-record exhaustion before later batches, and an
unsupported oldest queue row starving supported work. New genuine PG regressions
first FAIL (RED), then14/14 PASS after deferred/immutable mapping, pending-batch
completion and capability-filtered claim. Claimed target/version corruption is a
terminal safe job failure, distinct from a stale lease; a deployment dropping an
old processor version must not spin indefinitely or advance watermark. Next job
can target the new processor without inventing a source-version change.

Local public engine artifact13153864517 from run41470963851 downloaded and archive
SHA256 e72c47d8c854ff5d8f57d820481870988c7e5d1ac1461471758ac4000948e00a checked;
engine internal SHA verified. Genuine Prisma generate/API build now execute using
the approved public engine, in an isolated local client directory. Initial binary
403 remains historical FAIL, not rewritten as PASS. Owned Docker tmpfs PG14 tests
PASS with container-label verification/cleanup. Existing signed disposable-cluster
launcher provision suite PASS, including worker role/authorization row locks and
denial of credentials/sessions/role escalation/domain creation authority.

### Fetch strategy and restart clarification

Implement the specified FULL/INCREMENTAL distinction explicitly in the provider
port and persist the selected strategy per job. An unavailable adapter returns no
strategy, never an invented production FULL contract. Manual-only jobs recover the
last successful watermark even without a sync_configs row. A deployment changing
strategy/processor compatibility fails the old job safely, without watermark
advance; a subsequent job targets the new contract/version. This adds technical
restart metadata within sync_jobs, no new table or business policy. Add genuine
executor happy-path/restart tests for multi-page FULL and manual INCREMENTAL.

### Shared vocabulary ownership clarification

Sync job status/phase/type/trigger now have real API/Web runtime consumers. Per
Project Rules, place those unchanged codes in one browser-safe shared leaf and
re-export from Sync Domain; response types remain generated SDK-owned. Processor
outcomes/strategy/provenance stay backend-local. Extend only the existing Domain
pure-leaf allowlist, without changing other domain boundaries or business values.

### Heartbeat and bounded page execution

Wire the existing queue heartbeat into the executor while a page/batch is active;
its timer is cleaned and pending renewal awaited on every exit. A bounded20-second
page timeout is Nexora resource policy (below the shared30-second acquisition
lease), not an invented provider quota. Forward shutdown/timeout cancellation to
the Provider Port; no checkpoint from an aborted response. Add genuine PG delayed
page/lease-renewal coverage and an application cancellation test before code.

### Verification checkpoint — infrastructure, not live integration

The queue/staging/executor/API/SDK/existing Drawer infrastructure is implemented.
Production Provider and Domain handlers remain explicitly unavailable: no authorized
Uniship data contract, Shipment schema or Customer sync command was invented.
The 99 APPLIED fixture records link existing owned Customers; they do not prove
99 newly created domain records. No production rollout or live traffic occurred.

Round3 independent review identified401 reconciliation after denial and stale Cancel
baseline following a partial schedule save. Denial now aborts/increments generation,
clears data and latches all future reads/writes until unmount; every accepted server
read rebases the schedule baseline while preserving unsaved edits. Full confirmed
save resets the draft through the existing schedule revision. Focused regressions
execute the real component closures; browser evidence remains separately required.
Sync retry honors valid finite Retry-After without shortening a provider deadline;
non-finite metadata falls back to bounded exponential retry. Existing Carrier auth
client/local budget policy is unchanged. Runtime schema assertion now expects all11
migrations, including this additive Sync migration; no assertion was removed.

### Forward migration verification clarification

Owned PostgreSQL fresh deploy and schema diff PASS, but the existing staged legacy
upgrade harness FAIL at REPEAT_AND_DRIFT: its explicit migration-copy sequence ends
at Customers, so its final database omits Sync while comparing the current schema.
Extend that sequence with this migration, preserving every existing assertion, and
assert old rows unchanged plus empty Sync tables/partial lane uniqueness. This is
verification maintenance for the additive migration, not rewriting history.

### Customer SQL fixture ordering follow-up

Final-head Foundation41543570656 at82b4000 passed quality,99 integration tests,
legacy migration/drift and provision-role suite, then FAIL customer-sql with42P01.
The SQL-only Customer upgrade fixture applies every migration except Customer before
its preservation snapshot, so additive Sync FK creation now precedes Customers.
Restrict the pre-upgrade phase to earlier migrations; apply later migrations after
the existing Customer preservation assertions and before current runtime grants.
Keep all constraint/security assertions and the signed owned-cluster requirement.
Later LOCAL/TTY/HTTPS/data/dev steps were skipped, not PASS.

### Production browser readiness clarification

The existing production Carrier browser assertion still expected the old unknown
placeholder/unknown count. The production wrapper now reads actual owner-scoped
metadata, including a genuine empty list. Require settlement at the real0-account
count,0–0 range and existing known-empty copy; preserve guest redirect, zero rows,
no dialogs, network-write denial, geometry and the separate unknown fixture tests.
This strengthens settled-response verification instead of racing the loading state.

### Hosted cold HTTP deadline isolation

Foundation41544905459 ata5723652 failed the existing Uniship verify happy-path
loopback test: its100ms deadline expired on a loaded cold runner (test135ms).
Earlier hosted/local runs passed; no production Sync/Carrier assertion failed here.
Keep the exact100ms nonresponsive-server timeout assertion on its own client; use
normal production-default timeout for functional response/auth/header/error cases.
Do not change production timeout, skip any case, introduce test retries or suppress
failure. Add an outer finite test deadline so a broken abort still fails the gate.
All later integration/runtime/HTTPS/data/dev gates in this run were skipped.

### Authoritative config write gate

Final acceptance inspection reproduced another UI gap: while config data is absent
(initial/failed/filter-triggered read), retained draft state can leave Save enabled;
its operation would iterate no config items and could falsely confirm a no-op.
A focused actual-component test is RED (blocked=false during unresolved first read).
Require actual data both in the synchronous mutation guard and the Drawer blocked
prop; keep GET-only retry available. No API/business/layout contract changes.

### Development process isolation follow-up

Foundation41548422898 atd6f867c failed DATABASE_RUNTIME_SMOKE before quality tests.
Diagnostics show API's development process-tree termination throws spawn ps ENOENT;
shared compiler output also restarts the dev worker while independence is probed.
The generic failure did not identify its phase. Add closed phase diagnostics without
raw Docker output/secrets, install procps only in the existing dev stage (concurrently
uses ps for tree shutdown), and exec the worker watcher directly through its custody
entrypoint. Make the heartbeat assertion await actual progress within a bounded
window across file replacement instead of assuming a single2.2-second read cannot
race a restart. Preserve real API readiness, privilege/custody and independence
assertions; do not add retries/skips to the Foundation job or change production logic.

## Six-finding correction checkpoint —2026-11-03

Owner request targets reviewed HEAD6f0292604261b4a7dccc775da611a048842ed019 on
existing PR32/branch. Clean status, fetch and ff-only pull confirmed same HEAD.
Original design revision rev-2026-11-02-sync-v1 and raw digest
d6bcf89e94380e4a81386e3e54e86efc47142455258e8e0498a4ca86021ba20b remain immutable
historical scope. The current scoped review-fix revision above records the six
corrections, reuse/security alternatives and test-first plan; it does not reopen
architecture or require owner approval. Documentation Impact remains REQUIRED.

Read-only inspection confirms F1–F6 locations. F5 platform uncertainty is explicit:
prove SELECT-only FOR SHARE permissions in the signed owned cluster; do not silently
retain/substitute UPDATE grants. A narrow fixed read-lock function alternative is
preplanned only if PostgreSQL requires it, with no tables/roles/business writes.
No production/tests changed before this scoped plan/reuse review.

| Finding             | Root cause                                                     | Files / selected fix                                         | Regression / status                                                        |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| F1 UPSERT           | Identity conflict branch writes unchanged rows                 | SyncRepository.page conditional hash/order predicate         | Real PG timestamps/tuple versions; TARGETED PASS                           |
| F2 Retry            | New version retains next_retry_at; readiness predicates differ | page/apply reset and matched readiness/deadline selection    | Real PG source/processor/future retry; TARGETED PASS                       |
| F3 Scheduler        | Active lanes consume LIMIT100                                  | schedule NOT EXISTS active lanes before LIMIT                | 101lanes/manual/concurrent schedulers; TARGETED PASS                       |
| F4 Provider budget  | 30s token expires during operation                             | Token renewal/abort ownership and Uniship signal plumbing    | Real PG long/lost/successor and real HTTP cancel; TARGETED PASS            |
| F5 Worker authority | UPDATE metadata grants used for row locks                      | Shared authorization locks/least privilege with engine proof | Signed cluster positive/denied updates/disable races; TARGETED PASS        |
| F6 Issues           | Existing detail endpoint not consumed                          | SDK method/current Inspection read lifecycle/page rendering  | SDK/native/Chromium empty/review/paging/errors/abort/switch; TARGETED PASS |

### Six-finding actual execution checkpoint

F1/F2/F3 genuine PG regressions were RED (unchanged xmin/timestamps changed, new
version deadline retained,101st lane not admitted), then GREEN. F4 tests were RED
for expired long reservations/missing cancellation, then GREEN with token renewal
and ownership-fenced terminal effects. The current expanded real PostgreSQL suite
passed24/24 with0skip, including >31second concurrent reservations, lost-owner late
success/failure and fast-expiry-before-heartbeat. The real loopback auth/verify
cancellation plus preserved verify tests passed5/5. Native SDK/Inspection/Drawer
regressions passed12/12; the actual Chromium Carrier six-viewport matrix plus new
issues/parent-state/error/abort/paging checks PASS. Desktop1440x900 and mobile375x812
synthetic issue captures were manually reviewed: fields wrap, controls remain
inside the existing overlay, no raw payload/token renders. Images/logs are ignored.

F5 SELECT-only direct FOR SHARE failed42501 in the signed owned-cluster probe,
confirming the platform issue. The preplanned fixed read-only function alternative
was implemented, with API exclusive path unchanged. Provision/worker-lock suite
PASS, including direct UPDATE denial and real shared-lock/status-writer blocking.
Two fixture-only setup errors (42P08 UUID/text inference and42703 normalized-phone
column name) were corrected against the actual migrations, not by weakening ACL or
locking assertions. Fresh deploy/drift plus full staged legacy migration/row
preservation PASS with the function-only forward migration. No tables/roles added.

Round1 independent correctness review found no confirmed P1/P2 in F1–F3. Round2
independent security/concurrency review found no confirmed P1/P2 in F4/F5 and read
actual24/24PG/privilege logs. Round3/full canonical/final-head hosted gates were pending at this checkpoint. Local full lint initially found missing explicit JS globals imports in new
tests; these were corrected. No final-head PASS claim from the historical6f029260
Foundation is made; final run/head/merge evidence will be reconciled in PR metadata.

### Round3 denial regression closure

Independent Round3 found parent GET401 did not fence an already-open detail read.
The new actual-component regression was RED, then13/13 native tests PASS after a
sticky parent denial signal, pre/post detail guards and immediate Inspection
unmount/abort. No further SDK reads can start after denial. Normal Inspection
close/switch owns its own signal, preserving StrictMode lifecycle behavior and
non-denied parent drafts. Independent reviewer reran13/13,0skip and closed the P2;
no remaining confirmed P1/P2 in F1–F6. Final canonical/hosted checks still required.

Provenance: these local targeted results execute task-owned working-tree fixes based
on6f0292604261b4a7dccc775da611a048842ed019, not a claim about that old commit's code.
New scoped snapshot is b436333a4b319afb802e6253ecf5e1b46a179fd8d092fc1d078788762f9dfc63.
Final commit/merge/run lineage will be recorded in PR metadata after CI completion.

### Grouped correction verification and review handoff

Reviewable commits:039e0ca scoped plan;98940c1 F1–F3;3b8ebee F4;39442fe F5;
337bb92 F6. The final evidence commit also normalizes the test-only TSX fixture
formatting. Initial full quality stopped at format:check on that fixture; its
formatting was corrected and the complete command rerun, without skipping gates.

Current-source Chromium rerun PASS: existing Carrier six-viewport regression matrix
and Job Detail SDK/loading/empty/pagination/403/404/401/abort/switch/draft-state checks.
The isolated signed-cluster Customer SQL suite also PASS with verified owned-resource
cleanup. Native detail/lifecycle total is13/13 after the independently reviewed
parent-denial fix. All three independent rounds are closed for their scoped code
findings; canonical full quality and final-head hosted evidence are recorded below
when available. The PR remains Draft and Live Provider/Domain remains unavailable.

Complete local canonical `pnpm quality` rerun PASS on the committed six-fix code
plus the formatting correction: format:check, lint/boundaries, preflight:check,
docs:check, typecheck,129root/180API/224Web/32UI/6database tests (0fail/0skip),
contracts:check (reproducible, no generated-contract diff) and build. Turbo reused
valid prerequisite caches; this is host-toolchain quality evidence, not Docker or
final-head hosted evidence. Owned PG24/24, transport5/5, signed provision and
Customer SQL, fresh/staged migration/drift and current-source Chromium are separate
actual runs above. Final-head Preflight/targeted/Foundation must still execute;
their exact head/merge/run results will be appended to PR metadata after completion
so evidence does not require a self-referential documentation commit.

### First correction-head hosted Foundation failure

At1ad8c0b, Preflight41595568207 and targeted41595568256 SUCCESS (6unit/24PG,
0fail/0skip). Foundation41595568309 passed Docker quality,105integrations,
legacy migration/provision/Customer SQL and actual provisioning/MFA PTY harnesses,
but FAIL in new SYNC_ISSUES_EXISTING_INSPECTION_SDK_AND_DRAWER_STATE browser phase.
HTTPS/persistence/development downstream steps were skipped. Account artifact was
absent because that later browser sequence had not run; do not weaken its assertion.

The generic failure exposed only the broad phase, not a specific assertion.
Focused current TSX/SDK Chromium checks PASS in UTC, including6x CPU throttling;
this does not erase the hosted FAIL or establish a production defect. Strengthen
only the new F6 CDP observations: wait for schedule state, exact selected Job header
and completed Inspection close before the next action. Retain all assertions and
add closed named subphases/count-only fixture diagnostics to identify any repeat.
No production/Auth/UI behavior, timeout or workflow assertion changed. A fresh
final-head Foundation run is still required; no rerun-only success claim.

## Final review F7–F9 checkpoint — 2026-11-03

Restored the missing RAM worktree from the existing Git index after environment
restart; no staged/unrelated edits existed. Fetch/ff-only pull and GitHub confirm
cf1353a276b1d45f94b6788f559488b715dd4022. Scoped plan/reuse audit above is recorded
before code/tests, retaining previous snapshots unchanged. Implement F7 then F8/F9
with RED/GREEN evidence, three independent rounds and new-head canonical CI. No
new migration or architectural/Provider/Domain work. Documentation Impact REQUIRED.

### F7 execution checkpoint

Existing cached public Prisma toolchain archive SHA-256
e72c47d8c854ff5d8f57d820481870988c7e5d1ac1461471758ac4000948e00a was recovered;
engine reports pinned0edf323efd1d98336f3f0a68684b56f689b900d3. Genuine generation/API
build PASS, after initial binaries.prisma.sh403 FAIL. Frozen offline install lacked
a tarball; normal frozen install PASS, no lock/dependency change. First temporary
owned PG launcher mistakenly observed temporary Unix startup; TCP readiness fixed.
The subsequent actual RED run reproduced missing/equal ordering writes and duplicate
order loss. First GREEN attempt exposed new test-only Prisma field typos; corrected
to existing snake_case model fields without changing assertions.

At the final working-tree F7 correction,2026-11-03T13:04:43.525Z, full genuine Sync PG suite
PASS33/33,0fail/0skip (90.7s), including eight F7 cases and F1–F6 regressions. Owned
random loopback/tmpfs container cleanup verified, no user volumes touched. F7 adds
pre-write order ambiguity validation and same-hash duplicate max-order preservation
in sync-job.repository.ts. Mixed batches prove complete identity/staging/job/config
rollback and no item creation. Independent Round1 found no confirmed P1/P2. F8/F9
native RED tests reproduce absent Next Run and canonical icon/label mismatch;
implementation and final-head hosted checks remain pending.

### F8/F9 execution and local verification

F8 root cause: Schedule Panel ignored the already-mapped Backend nextRunAt.
CarrierSyncPanels now uses existing displayTime only for enabled saved settings
matching that row's draft; invalid/missing/off or changed row draft never invents a
schedule. F9 root cause: history compared title-case preview values rather than
canonical Backend SyncType. A feature-local icon/label pair handles canonical
SHIPMENT/CUSTOMER and presentation-only legacy aliases; raw filters/page data stay
unchanged. No CSS/token/layout/SDK/schema/queue/domain contract changed.

Native panel and actual Drawer/live-closure tests were RED, then requested three
Web suites plus new panel suite PASS41/41,0skip; independently rerun by Round2.
They cover timezone, missing/invalid/off schedules, enabled/interval drafts,
PATCH→confirmed readback, Cancel/tab/unrelated draft preservation, canonical/legacy/
unknown icons/labels, raw filter callbacks and server page navigation. Independent
Round2 found no confirmed P1/P2.

Initial full local quality FAIL at database build because Turbo filtered the
explicit engine-path environment and attempted blocked Prisma download. Linking
the verified official pinned engine into its normal package cache resolved this
without repo/env-policy/TLS/checksum changes; normal database build and complete
quality rerun PASS. Local browser first FAIL at the old accessible-name assertion
requiring Shipment. Its expected label now matches requested Kiện hàng while role,
status, timestamp and keyboard assertions remain intact; no assertion was removed.

| Claim                                              | Evidence                                                                                                                                                                       | Date       | Result |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| F7 rejects ambiguous order before any bulk writes  | Genuine owned PostgreSQL full Sync33/33,0skip; eight F7 cases and F1–F6; cleanup verified                                                                                      | 2026-11-03 | PASS   |
| F8/F9 source behavior was reproduced before fixes  | Native Next Run/label/icon tests RED on prior code                                                                                                                             | 2026-11-03 | FAIL   |
| F8/F9 confirmed saved/draft and raw-code behavior  | Requested Web suites plus panel41/41,0skip, independently rerun                                                                                                                | 2026-11-03 | PASS   |
| Canonical host quality after engine-cache recovery | pnpm quality: format/lint/preflight/docs/typecheck,129root/180API/232Web/32UI/6database tests,0skip, contracts reproducible and build                                          | 2026-11-03 | PASS   |
| Browser old accessible-name expectation            | Existing Carrier CDP expected old Shipment text after requested Vietnamese label correction                                                                                    | 2026-11-03 | FAIL   |
| Actual current-source browser and F6 regression    | Existing compiled TSX/CSS/SDK Carrier six-viewport CDP, persisted Next Run/draft reset, canonical history icon/label/raw select, issue paging/privacy/abort/denial/draft state | 2026-11-03 | PASS   |

Browser images remain ignored and the current mobile issue capture was manually
reviewed. This is synthetic owned GET-only fixture evidence, not Live Provider.
Final-head hosted Preflight/targeted/Foundation and independent Round3 runtime
closure remain required. Final SHA/merge/run evidence will be recorded in PR
metadata after completion, avoiding self-referential evidence-only commits.

Local provenance: full quality log completed 2026-11-03T13:10:49.997Z; actual browser rerun completed 2026-11-03T13:11:00.597Z. These runs tested the task-owned fixes based on cf1353a; hosted evidence must bind the final pushed HEAD.

## Runtime review I1/M1–M5/m1–m3 — 2026-11-03

Clean fetch/ff-only pull confirms 2ff53fb. Scoped v3 plan/reuse/security audit
recorded before code/tests. Existing snapshots remain immutable. M4 DEFERRED: no
LazyPrisma/sharedClient/DatabaseModule in branch or origin/main; no pool manager
will be introduced. M3 production apply already preserves technical FAILED; add
regressions only. m3 WITHDRAWN/NOT APPLICABLE: Unicode sourceKey stays untouched.
Documentation Impact REQUIRED; implementation and actual verification pending.

### Runtime correction implementation and targeted evidence

| Finding | Root cause                                                           | Solution / files changed                                                                                                                                                      | Regression / actual result                                                                                                              | Status                     |
| ------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| I1      | Ineligible and repeatedly rejected lanes consumed LIMIT100           | SyncRepository.schedule filters ACTIVE/CONNECTED/capability and active lanes before LIMIT; bounded200-candidate/100-admission timestamp/UUID continuation, no due-date writes | Actual PG100invalid+healthy,100/200 SQL-trigger failures/continuation, UUID/millisecond ties and concurrent admission PASS              | FIXED, targeted VERIFIED   |
| M1      | API reads used exclusive authorization locks                         | Internal read/write lock mode in connection; four reads use SHARE, mutations exclusive, F5 worker branch unchanged                                                            | Actual read overlap, detail/issues/config reads, mutation/disable/delete barriers, metadata and ownership PASS                          | FIXED, targeted VERIFIED   |
| M2      | Expired RUNNING claims did not consume attempts                      | Count reclaims; exhausted candidate rechecks after canonical locks then atomic FAILED/version/owner/config completion                                                         | PG2→3 and4→5, terminal rollback, concurrent claim, stale fences, real executor page8/reset and exact completion schedule PASS           | FIXED, targeted VERIFIED   |
| M3      | Proposed patch would convert technical exhaustion to business review | Production apply semantics retained; test-only additions                                                                                                                      | PG FAILED/RETRYABLE_ERROR/no success-watermark, next admission/source-version reset and genuine NEEDS_REVIEW warning PASS               | Existing behavior VERIFIED |
| M4      | Independent lazy clients create separate pools                       | No canonical LazyPrisma/sharedClient/DatabaseModule in branch/main app.module or adapters; no new manager                                                                     | Read-only search confirms conditional case B; no shared-pool/shutdown PASS claimed                                                      | DEFERRED                   |
| M5      | Generic startup/cycle logs lacked safe diagnostic types              | Infrastructure-local allowlisted projection, typed configuration failure, both worker call sites; no arbitrary throwable serialization                                        | 12/12 Sync units including actual startup/cycle, secrets/spoofed/unknown and hostile changing getters PASS; independent logging6/6 PASS | FIXED, targeted VERIFIED   |
| m1      | No leading FK/due access indexes                                     | New20261104000000_sync_fk_indexes; two Prisma ordinary/two SQL partial indexes; legacy/runtime migration harness updated to13                                                 | Fresh/staged/repeat deploy, populated Sync/legacy preservation, catalog and drift PASS                                                  | FIXED, targeted VERIFIED   |
| m2      | API retained unnecessary staging DELETE ACL                          | Remove only RUNTIME_GRANTS.provider_source_records DELETE; keep SYNC_GRANTS                                                                                                   | Actual signed-role SELECT/INSERT/UPDATE, DELETE42501, legacy ACL revocation and worker retention DELETE PASS                            | FIXED, targeted VERIFIED   |
| m3      | Unicode proposal withdrawn by owner                                  | sourceKey body and composed/decomposed regression unchanged                                                                                                                   | Existing source policy unit PASS                                                                                                        | WITHDRAWN / NOT APPLICABLE |

Initial real PG RED reproduced I1 starvation, M1 exclusive-read contention, M2
uncounted reclaim and missing indexes. M3 already PASS without production changes.
New DDL trigger fixtures initially lost dollar delimiters during text insertion
(42601); tagged delimiters fixed the test setup. A role fixture parameter needed
explicit UUID casts (42P08). Canonical local cluster launch first failed53100;
all signed assertions then ran unchanged using the same launcher with only a512MiB
owned tmpfs storage option, not user volumes. Initial staging DELETE-denial assertion
was RED; final actual roles/legacy-ACL/worker cleanup PASS. Final canonical hosted
Foundation must additionally verify the unmodified launcher in its environment.

An added test fragment was initially inserted after the suite; formatter/syntax
validation rejected it and it was corrected before any PASS claim. Full quality
attempts also caught missing explicit timer/global imports in the new tests;
these are fixed without disabling lint. No failed run is relabeled PASS.

Independent Round1 closed I1/M2/M3 without confirmed P1/P2. Round2 found a genuine
P2 in new logging: a changing getter could return an allowlisted code then a secret
on a second read. New actual-class regressions were RED; snapshot-once validation
and projection are GREEN,12/12 Sync units. Reviewer independently reran6/6 logging
cases, including real processes, and closed P2. No remaining confirmed P1/P2 in
those reviewed scopes; M4 remains the explicit owner-directed deferral.

| Claim                                              | Evidence                                                                                                                                | Date       | Result |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Scheduler/read/reclaim/index defects reproduced    | Actual owned PostgreSQL new tests RED before implementation; technical exhaustion already correct                                       | 2026-11-03 | FAIL   |
| Current complete Sync PG and F1–F9 regressions     | 38/38PASS,0fail/0skip; fresh migrated owned UUID DB, real triggers/concurrency/executor and verified tmpfs cleanup                      | 2026-11-03 | PASS   |
| Four index migration and preservation              | Genuine fresh deploy/diff, staged legacy+populatedSync snapshot preservation, repeat deploy/final drift                                 | 2026-11-03 | PASS   |
| API/worker staging privilege separation            | Signed cluster actual role CRUD/DELETEdenial, repeat legacy ACL revocation and worker retention; same assertions/tmpfs launcher variant | 2026-11-03 | PASS   |
| Safe diagnostics changing-getter attack reproduced | Actual Prisma/Sync code getters returned allowed then secret; new native tests RED                                                      | 2026-11-03 | FAIL   |
| Final safe diagnostics and unchanged source policy | 12/12Sync units,0skip; independent logging6/6 including compiled startup/cycle and one-read getters                                     | 2026-11-03 | PASS   |

No Carrier UI, API/SDK contract, domain handler/outcome, default retry/quota or
SourceKey Unicode changes. Full canonical quality, Round3 and final-head hosted
Preflight/targeted/Foundation remain pending at this checkpoint; exact final
SHA/merge/run evidence is reconciled in PR metadata after execution to avoid a
self-referential documentation commit loop. Task remains active/pending for the
unavailable Live Provider/Domain scope; no merge or deployment.

### Final local runtime-correction quality checkpoint

Complete pnpm quality PASS at 2026-11-03T15:06:18.272Z: format/lint/boundaries/preflight/docs/typecheck,129root/186API/232Web/32UI/6database tests (0fail/0skip), contracts reproducible and build. Core/DB/logging commits are f85e859/ff8fb78/50e133a; v3 plan b00680a. Actual sourceKey function bytes equal reviewed2ff53fb; no UI/SDK/business handler changes. Extra millisecond-keyset/executor-page8/legacy-grant assertions are included in final38/38PG and final signed-role PASS. Independent Round2 changing-getter P2 is closed after6/6 logging rerun; M4 remains DEFERRED. Round3/full final-head hosted gates remain pending, with exact head/merge/run reconciliation in PR metadata after execution.

## Final review closure — 2026-11-03

### Bounded pre-code plan

Closure revision: closure-2026-11-03-outcome-contract-v1. Reviewed clean baseline:
cd22af296afc25a76883be008a4e1c719b6e7ddc. This BOUNDED documentation/interface-comment
clarification retains the v3 architectural snapshot and its digest unchanged; no
signature, outcome, transaction, scheduler, pool, schema, SDK or runtime change.

| Component                  | Existing implementations                                                                                                                                          | Domain owner                                                    | Reuse alternatives                                        | Selected approach                                                                 | Rationale                                                         | Risks                                                             | Verification                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Processor outcome contract | sync/application/sync.port.ts SyncDecision/SyncDomainProcessor; sync/infrastructure/sync-job.repository.ts apply; sync/domain/sync.constants.ts outcomes; ADR-010 | Sync application port; business policies stay in owning domains | Clarify existing contract vs new processor/test framework | JSDoc plus concise ADR and testing requirements; retain existing PG outcome tests | No production processor exists to certify; avoid fake conformance | Ambiguous technical/business classification or false verification | Inspect unchanged signatures/runtime; quality/contracts/docs/preflight; final-head targeted/Foundation |

Search scope: SyncDomainProcessor/SyncDecision/outcome/RETRYABLE_ERROR across Sync
ports, repository, tests, ADR/testing docs; createDatabase/LazyPrisma/sharedClient
in API composition/database/Sync. Reuse existing tests and commands, no speculative
helper. First real processor must register domain-specific contract fixtures in
the ordinary discovered suite. Plan: clarify S1, record M4 issue and m4 benchmark
criteria, run checks, review three rounds, commit/push and reconcile final-head
hosted evidence in PR metadata. Documentation Impact: REQUIRED.

### Deferred findings

- M4: DEFERRED. Tracking Issue: [#33](https://github.com/dinhphuquy2k1/nexora/issues/33).
  Implementation PR: NOT CREATED. Required before Live Sync activation: YES —
  implement or explicitly evaluate and approve measured resource limits first.
  Issue search found no duplicate; separate implementation starts from latest
  main only after PR32 merges. No pool manager is added here.
- m4: DEFERRED. Impact: Scheduler polling overhead. Current evidence: no
  representative production-scale benchmark. Merge blocker: NO. Reopen only with
  an authorized representative PostgreSQL dataset (approximately5000 configs,
  many ineligible connections), EXPLAIN (ANALYZE, BUFFERS), worker queries/minute,
  database CPU/query latency, healthy-lane admission time and material operational
  impact. No cadence/cache/poll/next_run_at change or selected optimization now;
  if justified later, consider separate schedule/claim cadence before caching.

Historical cd22af2 CI is VERIFIED: Preflight41661889820 (24policy), targeted41661889815
(12unit/38PG) and Foundation41661889919 (119integration/full Docker/runtime/TTY/MFA/
browser/HTTPS/persistence/development/cleanup) PASS,0test skips. Checkout was merge
4c83bc1396fffdcffbe235851111c66a1b3a46b0 into base156a324. These results do not certify
the new closure commit; its final-head runs and review closure belong in PR32 metadata.

### S1 implementation and verification boundary

S1: FIXED (contract documentation). SyncDomainProcessor JSDoc and ADR-010 define
APPLIED, deterministic identified-source REJECTED_SOURCE, valid business ambiguity
NEEDS_REVIEW and transient technical RETRYABLE_ERROR. Exhaustion remains FAILED;
missing identity must follow safe ingestion failure, and fenced-session/no-network
constraints remain. Testing operations requires actual first-processor fixtures for
missing field, wrong type, empty string, ambiguity, transient failure and success,
plus real persistence/retry/watermark checks. S1 production conformance: PENDING —
no production processor exists; no placeholder test/helper or false PASS added.

Files: sync/application/sync.port.ts (JSDoc only), ADR-010, testing operations and
this task. TypeScript signature and comment-stripped transpilation compare equal
to cd22af2 (PASS). No runtime, Job completion, M3 outcome, flag, API/SDK, schema,
migration, pool, scheduler, Provider, Domain handler or UI changes. Required local
quality and final-head hosted evidence are recorded after actual execution.

Local closure verification: pnpm quality PASS on 2026-11-03 (format/lint/boundaries,
preflight/docs/typecheck,129root/186API/232Web/32UI/6database tests,0fail/0skip,
reproducible contracts and4/4 builds; three prerequisite build cache hits retained).
No new runtime test is claimed: unchanged existing outcomes are exercised by the
required final-head targeted PostgreSQL and Foundation workflows after push.
Final hosted results and the three scoped review rounds are reconciled in PR32
metadata without an evidence-only self-referential commit loop. Task remains
VERIFICATION PENDING/PARTIALLY VERIFIED for the unavailable live capability.

### Bounded verification amendment — completion timestamp anchor

Closure revision: closure-2026-11-03-outcome-contract-v2 (verification maintenance
only). Foundation41669989298 attempt1 at2aee248 failed unchanged Carrier browser
matrix/CHECK_FAILED; partial capture ends details390x844, exact condition/root
cause unavailable. Account upload then failed; later smokes skipped. Existing local
actual Chromium matrix reran unchanged and PASS; this does not establish cause or
replace hosted verification. One unchanged hosted retry was attempted, not a loop.

Attempt2 failed M3 integration line1832 (117/119 tests PASS; failing child plus
parent,0skips): next_run_at was compared with later job.finished_at. Read-only
inspection and independent review confirm unchanged apply() first writes config
completion/schedule, then writes Job completion in a separate statement. The
assertion incorrectly requires the two clocks to coincide. No runtime correction
is authorized or needed by this evidence.

Plan before test editing: use real owned PG with a controlled config-update delay
to reproduce the wrong anchor; replace only that assertion with the persisted
config.last_completed_at interval contract, retaining all technical FAILED,
RETRYABLE_ERROR, version-reset, valid business review and watermark assertions.
Keep the delay as a regression so the earlier assertion is deterministically RED.
Bound the exact configured interval by database-clock observations immediately
before/after apply, and verify config/Job completion lie within that same window.
Separate clock_timestamp expressions need not coincide even within one statement;
do not replace one false equality with another. Only the millisecond timestamp
representation receives1ms boundary rounding allowance. Also assert the injected
delay separates config completion from the later Job completion.
No change to production SQL, completion policy, signatures, flags, locks or schema.
Rerun genuine PG/quality and final-head hosted gates after the test-only fix; retain
both failed attempts. Existing immutable v3 snapshot remains unchanged.

Owned real PostgreSQL diagnostic RED on unchanged M3 assertion: after a controlled
25ms AFTER-config-update trigger, schedule minus Job completion was3599972ms,
schedule minus config completion3600000ms, and Job followed config by28ms. The
same FAILED/retry/watermark assertions passed; the wrong lower bound alone failed.
Owned tmpfs cleanup verified, no user volumes. This proves the assertion defect;
it does not attribute the separate Carrier browser failure.

Corrected M3 regression GREEN: genuine owned PostgreSQL38/38PASS,0fail/0skip,
including the controlled completion delay and every existing Sync regression;
owned tmpfs cleanup verified. Initial test-edit syntax typo was rejected by
formatter and corrected before verification. Full pnpm quality rerun PASS:
129root/186API/232Web/32UI/6database tests,0skip, format/lint/boundaries/preflight/
docs/typecheck/contracts and4/4builds. Independent review confirms the test-only
correction preserves all outcome/watermark assertions and production policy.
Final new-head hosted gates still required; exact SHA/run/failure history is
reconciled in PR metadata after execution. No further unchanged rerun loop.

## Sync status/database contract correction — 2026-11-05

Scoped v4 plan recorded before code/tests at reviewed8d451e0. Runtime SQL audit,
reuse/boundaries and verification strategy are in the immutable snapshot. Existing
SQL migration matches Domain status sets; no migration/schema/status change.
Full real-PG contract tests belong to the existing API integration suite so database
never imports application policy. Documentation Impact: REQUIRED. Implementation,
three review rounds and final-head hosted evidence pending.

Verification clarification before test correction: Prisma7 runtime DMMF exposes
only name/kind/type and omits defaults; the initial metadata test therefore FAILed
on undefined, while actual PG catalog/behavior and negative DDL controls passed.
Use the exact SyncJob.status field in schema.prisma plus actual generated-client
INSERT without status and native INSERT/catalog default checks. No new dependency
or internal Prisma parser is needed; this preserves all default assertions without
pretending runtime DMMF contains unavailable metadata. New v4 artifact formatting
was normalized before first publication; final raw digest is pinned above.

New draft snapshot metadata initially failed structural preflight (missing Task ID
and revision punctuation); normalized canonical fields before first publication,
repinned exact raw digest and reran checks. Historical snapshots remain untouched.

### Status contract implementation and local execution

Runtime ordinary predicates now bind existing constants in disable/remove,
admission fallback, issue count/page, claim candidate/selection, staging manifest
and retention. Processing filters use SyncProcessingStatus, not Job status. The
only preserved static status predicate is admit ON CONFLICT, required for partial
unique-index inference and documented at the query. No status definitions changed.

Eight API-local contract cases execute through the existing integration entrypoint:
Prisma schema/generated/native default; validated CHECK and exact active-index
catalog; valid/invalid status behavior; every active pair/23505 exact index;
different types/terminal history; named prepared inference/repository existing ID;
all-status disable and owner/connection-specific remove with lease invalidation.
Six real DDL mutations rollback and prove drift fails catalog assertions (wrong
default, missing/extra CHECK status, CHECK bypass, missing/extra active predicate).
Migration tests replace the loose index regex with actual unique/valid/ready/key
catalog assertions; no database→API dependency or new package/framework/workflow.

| Claim                                | Actual execution                                                                                                                                    | Result                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Initial test prerequisite assumption | Prisma7 runtime DMMF omits default; native catalog/behavior otherwise passed                                                                        | FAIL, corrected verification method |
| Draft plan metadata                  | Preflight rejected missing Task ID/revision punctuation before publication                                                                          | FAIL, corrected metadata and digest |
| Current Sync integration             | Actual owned migrated PostgreSQL46/46,0fail/0skip; eight new cases plus all prior regressions; cleanup verified                                     | PASS                                |
| Fresh/staged/repeat/drift migration  | Genuine Prisma13 migrations, legacy/Sync preservation, structural index assertion, no difference; cleanup verified                                  | PASS                                |
| Current local full quality           | pnpm quality: format/lint/boundaries/preflight/docs/typecheck,129root/186API/232Web/32UI/6database,0fail/0skip; reproducible contracts and4/4builds | PASS                                |
| Schema/migration immutability        | git diff --exit-code8d451e0 -- packages/database/prisma                                                                                             | PASS                                |

Actual local logs remain outside Git. No production/SDK/UI/business policy,
lock order, retry/outcome/checkpoint/watermark, retention set, pool or timestamp
change. Runtime grants are unchanged; final canonical hosted Foundation must still
execute real role/cluster/runtime/TTY/MFA/browser/HTTPS/data/dev checks. Three scoped
review rounds and final-head hosted Preflight/targeted/Foundation evidence are
reconciled in PR metadata after execution, avoiding a SHA-only commit loop.

Existing targeted workflow path filters also include the new contract fixture and
canonical shared sync-status leaf, so future fixture-only/shared-vocabulary edits
trigger that same real PG gate. Foundation already runs for every PR. No duplicate
workflow, test command, dependency or build prerequisite is introduced.

## Bounded final findings correction — 2026-11-08

Correction revision: correction-2026-11-08-review-v1. Reviewed clean HEAD:
99241c005fbb7a0ef524359d075bde621edf08c9. Existing PR32/branch only. This is a
bounded correction within the SIGNIFICANT task; v4 architecture/snapshot binding
and every historical snapshot remain unchanged. Documentation Impact: REQUIRED.

Read-only evidence: actual Foundation42008705394 attempt1 failed Carrier browser
matrix, attempt2 passed127integration/LOCAL runtime then failed HTTPS
ADMIN_BROWSER_INTERACTIVE_LOGIN/REQUEST_TIMEOUT before any auth request. Cause
UNVERIFIED; historical NEXORA-031 runner-latency attribution is not proof for this
failure. Current waitForInteractiveLogin mutates a harmless visibility control
inside polling; investigate event/hydration/navigation ordering, chunk failures
and exceptions before proposing a fix. No timeout increase, fixed delay, fake
hydration/authentication or production change without a demonstrated defect.

| Field                    | Browser readiness                                                                                            | OpenAPI metadata                                                                                               | Inspection/milestones                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Component                | Existing login probe and HTTPS CDP harness                                                                   | Sync controller/DTO enums                                                                                      | CarrierSyncInspection and task checklists                                                                               |
| Existing implementations | scripts/browser-login-ready.mjs, public-https-browser.mjs, browser-login-smoke.mjs; actual LoginForm.tsx     | SyncType/SyncProcessingStatus in existing Domain/shared leaf; two type arrays and issue subset in presentation | sync-response supplies Job counters/phase/errors but no logs; preview SyncItem.logs optional; all M1–M5 boxes unchecked |
| Domain owner             | Test infrastructure; Identity behavior preserved                                                             | Sync Presentation consumes canonical Domain vocabulary                                                         | Carrier Web presentation; task workflow                                                                                 |
| Reuse alternatives       | Existing probe/CDP vs new framework or speculative Login fix                                                 | Existing constants vs new registry                                                                             | Conditional existing block vs invented realtime backend; separate implementation/verification                           |
| Selected approach        | Bounded actual Chromium/HTTPS experiments and closed diagnostics; confirmed defect only, otherwise BLOCKED   | Bind existing constants preserving exact enum values/order                                                     | Hide unsupported live logs, preserve populated preview; truthful checklists                                             |
| Rationale                | Evidence before causality; keep actual interaction/security assertions                                       | No public contract drift                                                                                       | No false capability or verification claim                                                                               |
| Risks                    | Mutation/poll race, SSR without handlers, resource failures; sensitive diagnostics                           | Enum order or outcome expansion                                                                                | Preview parity, stale props, misleading checked verification                                                            |
| Verification             | Real Chromium with actual React controls; disposable HTTPS; no auth submit retry; full final-head Foundation | Generate/check OpenAPI/SDK and require no semantic/generated churn                                             | RED/GREEN live/preview component tests, full Carrier regressions, docs/preflight                                        |

Plan before code/tests: prioritize bounded F1 investigation (up to three distinct
focused experiment cycles, no blind CI rerun); capture only fixed categories and
safe booleans/counts, never credentials, tokens, bodies or raw browser errors.
A reproduced harness defect gets a regression and smallest fix; production
Login/MFA stays unchanged unless direct cause is proved. Then F2 constants and
contract comparison, F3 unsupported-log conditional and focused tests, F4 honest
milestone reconciliation. Independent reviews cover correctness/scope,
architecture/regression and actual final-head CI. Complete quality and mandatory
Preflight/targeted/Foundation including previously skipped data/dev gates.
If diagnosis or verification remains unresolved, retain Draft/BLOCKED. No Live
Provider/Processor, pool consolidation, migration, retry/fencing/watermark change,
new dependency/framework, UI theme/control-size change, merge or deploy.

### Correction implementation and bounded diagnosis

F2 replaces both SyncType metadata arrays with Object.values(SyncType), and the
three supported issue outcomes with explicit SyncProcessingStatus members in the
original order. contracts:generate and contracts:check PASS; generated OpenAPI and
SDK have zero diff. No schema, business outcome or canonical definition changes.

F3 hides the log heading/block whenever the Inspection has the existing Live
jobDetail reader, even if stale preview lines are accidentally supplied. Populated
reference preview logs still render; Live job state/counters/phase/error and
existing ownership, pagination, abort and denial behavior remain unchanged.
The real component-harness regression first FAILED (5/6 PASS), then PASSED after
the conditional rendering correction. No CSS, transport, backend or polling change.

F1 remains UNVERIFIED/BLOCKED, not a demonstrated Login or runner defect. Actual
freshly built Next Login and unmodified waitForInteractiveLogin were driven by
Chromium/CDP in an owned local TLS diagnostic fixture, without entering any
credentials or submitting auth. Three bounded scenarios passed the harmless
show/hide interaction: normal; real JS delivery delayed180ms with CPU16x;
CPU32x. Each observed one show click, one hide click, final password input, zero
runtime exceptions, zero script failures/HTTP errors and zero auth requests.
Owned Web/TLS/Chromium profiles were cleaned up. These observations did not
reproduce the historical timeout or prove that repeated polling cannot race.

The initial named-FQDN diagnostic navigation instead produced an error document
and ERR_ABORTED, with no Login inputs; that setup failure differs from the CI
symptom (inputs present). Loopback navigation delivered the actual Login200.
This diagnostic rewrote the upstream Host to the test PUBLIC_HTTPS authority and
used only the disposable leaf SPKI exception. It is a pre-auth helper experiment,
not canonical FQDN/Origin/MFA/remote-onboarding verification. Therefore no browser
harness or production Auth change, timeout increase, fixed readiness delay,
auth retry, assertion removal or claim that the original failure was repaired.
Historical attempt1/2 failures remain open evidence; a later green run alone
cannot establish their root cause.

### Correction execution evidence — 2026-11-08

Source under test: bounded correction on baseline99241c0; implementation commits
51e5a59 (F2) and7ed69b7 (F3). Exact final documentation HEAD and hosted checkout
binding/results are reconciled in PR32 metadata after pushing, avoiding a
self-referential SHA-only documentation loop. Full local logs and browser data
remain outside Git.

| Command / review                                                                                                                             | Actual result                                                                 | Limit                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| pnpm install --frozen-lockfile                                                                                                               | PASS                                                                          | Pinned Node24.19.0/pnpm10.34.6; no lock change                              |
| pnpm contracts:generate; pnpm contracts:check                                                                                                | PASS; reproducible output                                                     | Generated OpenAPI/SDK unchanged                                             |
| node --test apps/web/test/carrier-sync-issues.test.mjs before fix                                                                            | FAIL:5PASS/1FAIL/0skip                                                        | New unsupported Live-log assertion exposed defect                           |
| node --test apps/web/test/carrier-sync-api.test.mjs apps/web/test/carrier-sync-issues.test.mjs apps/web/test/carrier-sync-lifecycle.test.mjs | PASS17/17,0skip                                                               | Component/transport/lifecycle regression, not live Provider verification    |
| pnpm quality                                                                                                                                 | PASS:129root/186API/234Web/32UI/6database,0fail/0skip; contracts and4/4builds | Host quality; does not certify Docker runtime or hosted final HEAD          |
| node --test integration/sync-integration.test.cjs against owned Docker PostgreSQL17.11                                                       | PASS46/46,0skip; migrated database and container cleanup PASS                 | Actual queue/staging/lifecycle/status-contract regression; no live Provider |
| Actual built Login CDP pre-auth experiment                                                                                                   | Three scenarios PASS; cleanup PASS                                            | Original F1 not reproduced; canonical HTTPS/authentication still required   |
| Independent Round1 correctness/scope                                                                                                         | No confirmed new P1/P2;6/6 focused Inspection tests PASS                      | F1 explicitly remains BLOCKED                                               |
| Independent Round2 architecture/regression                                                                                                   | No confirmed new P1/P2/P3;17/17 focused tests and diff check PASS             | No independent approval of unexecuted hosted gates                          |

Canonical Docker/PostgreSQL execution and final-head Preflight, targeted and
Foundation results must be read from their actual execution, including skipped
steps, and reconciled in PR32. Current lifecycle remains VERIFICATION PENDING;
capability IMPLEMENTED; verification PARTIALLY VERIFIED. S1 production conformance
and issue33 pool work stay deferred. No Live activation, merge, deployment or
Draft transition is authorized by this correction.

## Remaining HTTPS readiness investigation — 2026-11-08

Bounded correction revision: correction-2026-11-08-https-readiness-v2.
Reviewed baseline54075570d41108e9991d08cced48d9a0867ec1a3; clean existing
branch/PR32. Immutable v4 snapshot and its binding remain unchanged.
Documentation Impact: REQUIRED (task checklist/evidence and testing diagnostics).
No new approval gate or architecture revision is needed for this bounded work.

Read-only inspection reconfirmed the hosted failure before authentication dispatch;
DOM presence does not establish hydration. Nginx forwards the approved Host/port;
CSP has no script-src restriction. Repeated visibility clicks and swallowed CDP
evaluation errors are hypotheses, not proven causes. Existing loopback experiments
cannot certify named-FQDN ingress. F2/F3 code is retained for regression only.

| Field                    | Investigation / documentation correction                                                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Pre-auth HTTPS/CDP observation and task verification checkpoint                                                                                                                                                       |
| Existing implementations | scripts/public-https-browser.mjs, browser-login-ready.mjs, browser-startup-diagnostics.mjs, browser-teardown.mjs; existing LoginForm, Docker Nginx and Foundation                                                     |
| Domain owner             | Test infrastructure; no Identity/Sync business change                                                                                                                                                                 |
| Alternatives             | Blind retry/timeout change, new browser framework, production logging, or bounded existing-harness diagnostics                                                                                                        |
| Selected approach        | Reuse current Chromium/CDP, TLS fixture and cleanup. Add only closed/count diagnostics while investigating; fix behavior only after a demonstrated defect. Split verified checkpoint rows from failed/skipped gates.  |
| Rationale                | Expose missing resource/context/interaction evidence without pretending DOM is hydration or altering security assertions                                                                                              |
| Risks                    | Raw CDP exceptions/URLs can leak secrets; cap observations, retain no payload/headers/URLs/messages and stop pre-auth observation before credential entry                                                             |
| Verification             | Privacy/closed-shape unit regressions first; actual production Login/Chromium on named host and Nginx where available; canonical hosted Foundation, F2 contracts/F3 tests, quality and independent three-round review |

Plan before code/tests: (1) verify actual baseline logs and bounded named-host
fixture prerequisites; (2) test-first add narrowly scoped, bounded pre-auth
resource/navigation/runtime/evaluation and harmless toggle observation to the
existing HTTPS harness; no auth retry, timeout increase, fixed readiness delay or
DOM/React-internal readiness mutation; (3) use new actual observations to choose
a minimal regression/fix, or retain ROOT CAUSE NOT VERIFIED/BLOCKED; (4) correct
F4 checklist with exact checkpoint provenance and preserve every historical
FAIL/SKIPPED; (5) run focused regressions/full quality, normal push and exact-head
Preflight/targeted/Foundation with actual logs. No speculative production fix,
new dependency, API/schema/Sync lifecycle/pool/Live/UI change. After three failed
experiments stop edits, summarize and re-plan under Implementation Workflow.

### Targeted investigation observations

| Hypothesis                                      | Evidence                                                     | Experiment                                                                                | Result                                                                            | Conclusion                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| DOM presence proves hydration                   | Baseline hosted inputs/toggle exist but no auth dispatch     | Existing actual visibility helper retained                                                | Hosted readiness FAIL                                                             | Presence alone insufficient; root cause UNVERIFIED                          |
| Repeated clicks invert delayed state            | Prior three bounded real Login probes observed one show/hide | No helper behavior change; add bounded native event/type sequence                         | No local reproduction                                                             | Hypothesis, not a demonstrated defect                                       |
| Missing scripts/runtime/context failure         | Old HTTPS harness had no Runtime/loading failure observation | Enable existing CDP events; record bounded counts only                                    | New diagnostic unit/privacy tests PASS3/3                                         | Requires actual named-host hosted trace before attribution                  |
| Named TLS fixture matches hosted symptom        | Owned production Web + Nginx1.30.6 + test CA/FQDN            | Strict Node CA/name Login200, then real Chromium navigation                               | Browser ERR_ABORTED/error document/no inputs                                      | Local diagnostic setup failure, distinct from hosted inputs-present failure |
| Diagnostic observer alters Login or spans Setup | Actual built Login/Setup and native Chromium                 | Observe real show/hide, stop, full-document Setup, real return link, fresh Login observer | PASS; one show/one hide, three type transitions; zero auth dispatch; cleanup PASS | Observer lifecycle verified, not F1/HTTPS acceptance                        |

Round1 independent review found that automatic new-document registration could
recreate observation on Setup. Corrected by removing that registration after
ADMIN readiness, guarding Login path, installing fresh observation explicitly
before remote Login readiness and stopping before credential input. Three unit
cases include Setup/client-navigation/explicit-install/stop behavior; actual
Chromium Login/Setup lifecycle also PASS. Round1 recheck CLOSED; independent
Round2 found no new P1/P2. No claim that either review closes F1.

Executed correction verification before push: diagnostics+Carrier focused
20/20PASS,0skip; full pnpm quality132root/186API/234Web/32UI/6database =590tests,
0fail/0skip, reproducible contracts and4/4builds PASS. Existing F2 presentation,
OpenAPI/SDK, F3 implementation, schema/snapshots and browser readiness helper
have zero diff from5407557. Full local logs and fixture material stay outside Git.
The diagnostic host and Nginx projects used owned resources only and were removed.
Initial internal-network fixture readiness failed before Chromium; corrected local
network setup did not reproduce the hosted Login symptom. No failed setup or
loopback result is represented as canonical public HTTPS PASS.

New code changes test diagnostics only, not a readiness fix: ROOT CAUSE NOT
VERIFIED until actual hosted evidence establishes one. Final follow-up HEAD,
run links, tested merge and each completed/failed/skipped gate are reconciled in
PR32 metadata after execution; prior5407557 results above do not certify this new
code. If any mandatory gate fails or root cause remains unresolved, keep F1 OPEN,
Draft and full acceptance BLOCKED without blind retries. Documentation Impact
remains REQUIRED; task lifecycle/verification status and immutable v4 unchanged.

## Closure — 2026-11-12

Delivered by PR #32. HTTPS, persistence and development gates that failed or were skipped earlier pass in a descendant hosted run. Connection-pool capacity remains tracked by GitHub issue #33; owner infrastructure acceptance was concluded by merging PR #32.

| Claim                  | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Date       | Result |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Merged to main         | PR #32, merge 6a52c2ff90a1173a25053caf6fb7061b82f6b8dd, 2026-11-08                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-11-12 | PASS   |
| Descendant hosted gate | Foundation run [43246873727](https://github.com/dinhphuquy2k1/nexora/actions/runs/43246873727), job 131281781892, checkout merge 4682dd9f47d81a55a515be44ebca19a1afb8828d (main 3906f8243347fb7c697bf5f6949389c3a784a13d + c4caffe33768b14445863ba31d153e441633c8f8), which includes this task's merge: steps 4–10 PASS (Docker quality 640 ordinary + 133 PostgreSQL integration, M5, runtime/TTY/browser incl. Carrier six-viewport matrix, HTTPS/ingress/onboarding/restore, persistence, development) | 2026-11-12 | PASS   |

Connection-pool prerequisite: [GitHub issue #33](https://github.com/dinhphuquy2k1/nexora/issues/33).
