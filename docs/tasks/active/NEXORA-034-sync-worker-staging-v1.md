# NEXORA-034 — Sync Worker and Staging V1

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Scope

Implement the owner-supplied PostgreSQL Sync V1 architecture in one PR from main.
Baseline: 156a32414dfefdc235804367307b5f052d9dcb47.
Branch: feat/sync-worker-staging-v1. No merge/deployment authorized.

## Design Review & Reuse Decision

Task ID: NEXORA-034
Classification: SIGNIFICANT
Plan revision: rev-2026-11-03-sync-final-review-v2
Design Snapshot: docs/tasks/design-reviews/NEXORA-034-rev-2026-11-03-sync-final-review-v2.md
Design SHA-256: cbac9a184e51ce25cfba7fdf97c624f62ee417b3feb0a75194f2f56cef1efc42
Reviewed baseline: cf1353a276b1d45f94b6788f559488b715dd4022

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

- [ ] M1: additive worker ADR, application context, Docker/custody/grants/flags.
- [ ] M2: durable queue/admission/scheduler/lease and disable/delete integration.
- [ ] M3: source identities, conditional staging, retention/provenance.
- [ ] M4: processing manifest, versions/outcomes and atomic completion.
- [ ] M5: provider ports, API/SDK, existing Drawer, monitoring, full verification.

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

| Claim                                                         | Evidence                                                                                                                                                                                                                     | Date       | Result |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Initial plan governance                                       | preflight/docs found metadata formatting errors before code; corrected to canonical format                                                                                                                                   | 2026-11-02 | FAIL   |
| Genuine PostgreSQL queue/staging/application/HTTP behavior    | Owned tmpfs PostgreSQL17.11 launcher; integration/sync-integration.test.cjs18/18, including20-way admission,10000→10005/30items, retries, page restart, heartbeat, disable/delete fences, real Nest guards and generated SDK | 2026-11-03 | PASS   |
| Cross-process acquisition budget                              | Same PG suite: actual child worker process plus separate API client, two slots/third denied                                                                                                                                  | 2026-11-03 | PASS   |
| Restricted worker privileges/cluster cleanup                  | node scripts/provision-cluster-smoke.mjs --suite=provision; actual signed disposable cluster, concurrent roles, lock permissions and forbidden secret/session/DDL access                                                     | 2026-11-03 | PASS   |
| Existing Carrier visual/accessibility regressions             | Actual compiled TSX/CSS and Chromium CDP; six-viewport matrix, menus, keyboard, cleanup, date/history/status regressions                                                                                                     | 2026-11-03 | PASS   |
| Round3 denial and partial-schedule regressions                | node --test apps/web/test/carrier-sync-lifecycle.test.mjs; actual component closures,401 fences late200 and further actions; partial readback rebases Cancel while preserving draft                                          | 2026-11-03 | PASS   |
| Local canonical quality attempt before commit                 | pnpm quality: format/lint/preflight/docs/typecheck/tests executed; contracts regeneration reproducible but gate rejects uncommitted generated files; rerun required after commit                                             | 2026-11-03 | FAIL   |
| Old remote head Foundation                                    | Run41470963835 at4e08bc1: lint failed; later runtime steps skipped. Findings fixed locally, not evidence for a new head                                                                                                      | 2026-11-03 | FAIL   |
| Old remote targeted PostgreSQL                                | Run41470963851 at4e08bc1: actual generated build,2policy tests and11PG tests passed; final head must be checked separately                                                                                                   | 2026-11-03 | PASS   |
| Full local quality after committed contracts                  | API_INTERNAL_URL=http://127.0.0.1:4000 NEXT_TELEMETRY_DISABLED=1 pnpm quality at5a3cc013; format/lint/governance/docs/typecheck,129root/178API/217Web/32UI/6database tests, reproducible contracts and build                 | 2026-11-03 | PASS   |
| Live Sync component browser behavior                          | Disposable compiled actual TSX/CSS/SDK with isolated synthetic HTTP server and Chromium CDP: partial schedule readback/Cancel, mutation401 denial,360/768/1440 viewport overflow checks; not real Provider integration       | 2026-11-03 | PASS   |
| Legacy upgrade harness before adding Sync step                | Owned PG test/migration.mjs failed REPEAT_AND_DRIFT because staged fixture omitted new migration; fresh full deploy/diff already passed                                                                                      | 2026-11-03 | FAIL   |
| Additive legacy migration preservation and drift              | Genuine Prisma deploy/diff plus packages/database/test/migration.mjs in owned PostgreSQL; old rows preserved, empty Sync tables, partial unique lane, repeated deploy and final drift                                        | 2026-11-03 | PASS   |
| Current implementation hosted targeted verification           | Run41542685993 bound to5a3cc013, checkout57f2ae2 merge with baseline156a324; genuine generated build,6unit/18PG PASS with0skip                                                                                               | 2026-11-03 | PASS   |
| Hosted full gate before Customer fixture ordering fix         | Foundation41543570656 at82b4000: quality/99integration/legacy drift/provision PASS, customer-sql42P01; later runtime/HTTPS/data/dev skipped                                                                                  | 2026-11-03 | FAIL   |
| Customer SQL upgrade order and security assertions            | node scripts/provision-cluster-smoke.mjs --suite=customer-sql after ordered pre/post migration phases; actual owned PostgreSQL1/1 plus verified cleanup, all old assertions preserved                                        | 2026-11-03 | PASS   |
| Hosted cold loopback timing failure                           | Foundation41544905459 ata5723652: existing Uniship verify happy path exceeded100ms; later gates skipped, not PASS                                                                                                            | 2026-11-03 | FAIL   |
| Functional HTTP checks separated from deliberate100ms timeout | node --test apps/api/test/uniship-verify.test.cjs3/3; real loopback, all header/auth/status/body/error assertions retained, distinct never-responding deadline case, no production changes                                   | 2026-11-03 | PASS   |
| Review F1–F4 queue/staging/scheduler/budget regressions       | node --test apps/api/integration/sync-integration.test.cjs against owned PostgreSQL17.11:24/24,0skip; RED cases retained; long reservation >31s and lost/terminal fences included                                            | 2026-11-03 | PASS   |
| Review F5 engine capability before fix                        | Signed owned-cluster SELECT-only FOR SHARE fails42501, demonstrating direct SHARE still needs UPDATE; no substitute column grant accepted                                                                                    | 2026-11-03 | FAIL   |
| Review F5 least-privilege locking                             | node scripts/provision-cluster-smoke.mjs --suite=provision; exact worker function execution/shared lock blocking/direct metadata UPDATE denial and verified cleanup                                                          | 2026-11-03 | PASS   |
| Review function migration preservation                        | Genuine Prisma deploy/diff and packages/database/test/migration.mjs:12forward migrations, four fixed functions, old rows preserved, no model drift                                                                           | 2026-11-03 | PASS   |
| Review transport cancellation                                 | node --test apps/api/test/uniship-budget-cancellation.test.cjs apps/api/test/uniship-verify.test.cjs:5/5 actual loopback HTTP; both auth/verify cancelled before transport timeout                                           | 2026-11-03 | PASS   |
| Review F6 SDK/Inspection/Drawer lifecycle                     | node --test apps/web/test/carrier-sync-api.test.mjs apps/web/test/carrier-sync-issues.test.mjs apps/web/test/carrier-sync-lifecycle.test.mjs:13/13 including parent401/late Detail200                                        | 2026-11-03 | PASS   |
| Review F6 browser/privacy/parent state                        | Existing compiled Carrier fixture+Chromium CDP: six-viewport baseline and new issues SDK paging/empty/denial/abort/filter/draft/focus PASS; two synthetic screenshots manually reviewed                                      | 2026-11-03 | PASS   |

## Blockers and limitations

No authorized Uniship fetch/payload/retention contract or Shipment schema/handler.
No approved Customer sync mapping/actor command. Ports/mock verification must not
be called live integration. No default retention period or destructive cleanup.
Initial host disk25MiB recovered through unused build-cache cleanup; RAM worktree preserves existing work. Final CI required.

## Implementation checkpoint

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
