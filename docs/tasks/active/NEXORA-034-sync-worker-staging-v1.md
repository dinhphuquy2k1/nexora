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
Plan revision: rev-2026-11-02-sync-v1
Design Snapshot: docs/tasks/design-reviews/NEXORA-034-rev-2026-11-02-sync-v1.md
Design SHA-256: d6bcf89e94380e4a81386e3e54e86efc47142455258e8e0498a4ca86021ba20b
Reviewed baseline: 156a32414dfefdc235804367307b5f052d9dcb47

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

| Claim                                                      | Evidence                                                                                                                                                                                                                     | Date       | Result |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Initial plan governance                                    | preflight/docs found metadata formatting errors before code; corrected to canonical format                                                                                                                                   | 2026-11-02 | FAIL   |
| Genuine PostgreSQL queue/staging/application/HTTP behavior | Owned tmpfs PostgreSQL17.11 launcher; integration/sync-integration.test.cjs18/18, including20-way admission,10000→10005/30items, retries, page restart, heartbeat, disable/delete fences, real Nest guards and generated SDK | 2026-11-03 | PASS   |
| Cross-process acquisition budget                           | Same PG suite: actual child worker process plus separate API client, two slots/third denied                                                                                                                                  | 2026-11-03 | PASS   |
| Restricted worker privileges/cluster cleanup               | node scripts/provision-cluster-smoke.mjs --suite=provision; actual signed disposable cluster, concurrent roles, lock permissions and forbidden secret/session/DDL access                                                     | 2026-11-03 | PASS   |
| Existing Carrier visual/accessibility regressions          | Actual compiled TSX/CSS and Chromium CDP; six-viewport matrix, menus, keyboard, cleanup, date/history/status regressions                                                                                                     | 2026-11-03 | PASS   |
| Round3 denial and partial-schedule regressions             | node --test apps/web/test/carrier-sync-lifecycle.test.mjs; actual component closures,401 fences late200 and further actions; partial readback rebases Cancel while preserving draft                                          | 2026-11-03 | PASS   |
| Local canonical quality attempt before commit              | pnpm quality: format/lint/preflight/docs/typecheck/tests executed; contracts regeneration reproducible but gate rejects uncommitted generated files; rerun required after commit                                             | 2026-11-03 | FAIL   |
| Old remote head Foundation                                 | Run41470963835 at4e08bc1: lint failed; later runtime steps skipped. Findings fixed locally, not evidence for a new head                                                                                                      | 2026-11-03 | FAIL   |
| Old remote targeted PostgreSQL                             | Run41470963851 at4e08bc1: actual generated build,2policy tests and11PG tests passed; final head must be checked separately                                                                                                   | 2026-11-03 | PASS   |
| Full local quality after committed contracts               | API_INTERNAL_URL=http://127.0.0.1:4000 NEXT_TELEMETRY_DISABLED=1 pnpm quality at5a3cc013; format/lint/governance/docs/typecheck,129root/178API/217Web/32UI/6database tests, reproducible contracts and build                 | 2026-11-03 | PASS   |
| Live Sync component browser behavior                       | Disposable compiled actual TSX/CSS/SDK with isolated synthetic HTTP server and Chromium CDP: partial schedule readback/Cancel, mutation401 denial,360/768/1440 viewport overflow checks; not real Provider integration       | 2026-11-03 | PASS   |
| Legacy upgrade harness before adding Sync step             | Owned PG test/migration.mjs failed REPEAT_AND_DRIFT because staged fixture omitted new migration; fresh full deploy/diff already passed                                                                                      | 2026-11-03 | FAIL   |
| Additive legacy migration preservation and drift           | Genuine Prisma deploy/diff plus packages/database/test/migration.mjs in owned PostgreSQL; old rows preserved, empty Sync tables, partial unique lane, repeated deploy and final drift                                        | 2026-11-03 | PASS   |
| Current implementation hosted targeted verification        | Run41542685993 bound to5a3cc013, checkout57f2ae2 merge with baseline156a324; genuine generated build,6unit/18PG PASS with0skip                                                                                               | 2026-11-03 | PASS   |
| Hosted full gate before Customer fixture ordering fix      | Foundation41543570656 at82b4000: quality/99integration/legacy drift/provision PASS, customer-sql42P01; later runtime/HTTPS/data/dev skipped                                                                                  | 2026-11-03 | FAIL   |
| Customer SQL upgrade order and security assertions         | node scripts/provision-cluster-smoke.mjs --suite=customer-sql after ordered pre/post migration phases; actual owned PostgreSQL1/1 plus verified cleanup, all old assertions preserved                                        | 2026-11-03 | PASS   |

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
