# NEXORA-056 — Auto Provision Sync Configuration & Simplify Sync Runtime Flags

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Design Review & Reuse Decision

Task ID: NEXORA-056
Classification: SIGNIFICANT
Plan revision: rev-2026-11-16-auto-provision-sync-v1
Reviewed baseline: 58223828a733f706d4ef058fac64b193556bde70
Branch: feat/auto-provision-sync-configuration
Design Snapshot: docs/tasks/design-reviews/NEXORA-056-rev-2026-11-16-auto-provision-sync-v1.md
Design SHA-256: fe0f4f6089d34805ba893cebca1d4bfae152e660c322bd41ef018e41ecd07908

## 1. Requirements and scope

New Uniship connection atomically stores its encrypted credentials, one enabled
SHIPMENT configuration at60 minutes with first due exactly DB-created connection
created_at+60minutes, and success audit. No job is created. Remove per-type runtime
flags and runtime config.types. Keep global SYNC_ENABLED=false default and strict
boolean validation, technical tuning bounds, static exact-pair capability resolution
and all scheduler/worker/fencing/locks/retry/performance contracts. Production
registry and Uniship external-request hard gates stay byte-identical.

## 2. Read-only inspection and canonical documents

Read AGENTS/AI entry routes, project/context/rules/task/implementation workflows,
ADR007/008/009/010, backend/database/sync-extensions/reuse/configuration/testing,
Uniship contract and both repo review skills/template. Searched get defaults,
CarrierLifecycleAdapter.create/complete/secrets/active, SyncConfig/SyncType,
loadSyncConfig/config.types, available/admissible/admit/claim/schedule/fence,
configs/configure, type flags across source/Compose/tests/docs and real PG fixtures.
Current create hardcodes the already Uniship-only connection provider and stores
secrets/audit under actor/generation transaction; no defaults exist. Metadata
select includes DB createdAt. SyncConfig has TIMESTAMPTZ(3), unique connection/type
and cascade. Registry already resolves exact supported strategy/domain version.
claim/schedule already select eligible DB provider/type pairs; remove only redundant
environment-type filtering. Generic PATCH accepts15/30/60/120/240; keep it unchanged.

PR54 merge58223828 was verified through GitHub and origin/main; first commit01f5513
closes055, retains failures and transfers non-CI prerequisites to PLANNED047/057/058.
No schema, grant or historical migration change is needed.

## Reuse audit

| Field                    | Defaults/provisioning                                                                                                                                                                                                               | Runtime eligibility                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Component                | Pure provider default policy plus create transaction                                                                                                                                                                                | Existing loadSyncConfig and SyncRepository                                                                                  |
| Existing implementations | carrier/domain/carrier.ts; CarrierLifecycleAdapter.create/secrets; shared SyncType; Prisma SyncConfig                                                                                                                               | sync-policy.ts; sync-capability.registry.ts; sync-job.repository.ts; same runtime factories                                 |
| Domain owner             | Carrier owns connection onboarding default policy; Sync owns schedule execution                                                                                                                                                     | Sync owns global control and exact-pair dispatch                                                                            |
| Reuse alternatives       | Reuse immutable provider constants and existing child insert; reject generic framework, post-commit service/event, activation state and request defaults                                                                            | Reuse registry and existing eligible pair filters; reject ENV/DB handler discovery or replacement flags                     |
| Selected approach        | carrier/domain/default-sync-policy.ts imports only Carrier codes and Shared sync-status; immutable readonly defaults, unknown provider empty; adapter calls resolver with connection.provider and creates child in same transaction | Remove types from config; global enabled plus registry only; keep eligible pair SQL/row-lock/fence checks                   |
| Rationale                | No Carrier/Sync cycle, app/domain Prisma or duplicate scheduler/policy                                                                                                                                                              | One available/admissible rule shared by API and worker                                                                      |
| Risks                    | Partial commit, clock skew, resets on reconnect, accidental customer defaults                                                                                                                                                       | Unsupported claim, manual schedule coupling, stale config tests, changing tuning/bounds                                     |
| Verification             | Unit immutability/unknown/no duplicates, genuine PG exact timestamp/rollback/reconnect/delete/independent owners and GET                                                                                                            | Global/registry unit RED/GREEN, supported/unsupported PG claim/scheduling, existing lease/cancellation/capacity regressions |

## 4. Selected defaults and time contract

getDefaultSyncPolicies(provider:string):readonly DefaultSyncPolicy[] where each
entry is readonly {syncType:SyncType,enabled:boolean,intervalMinutes:number}.
A string boundary matches persisted connection.provider and supports unknown future
providers returning an empty frozen list. The Uniship entry is deeply frozen with
canonical SyncType.SHIPMENT, enabled=true,60minutes. No CUSTOMER default, dependency
or provider-specific branch in the generic provisioning call.

Use the database-returned connection.createdAt Date (TIMESTAMPTZ(3)), adding exactly
intervalMinutes\*60000 UTC milliseconds for next_run_at. Both source and destination
retain millisecond precision; tests compare with PostgreSQL interval arithmetic.
No application now(), frontend time, timezone conversion, HTTP or crypto under locks.
Nullable history/watermark fields remain SQL NULL defaults. Use INSERT, not upsert:
a duplicate policy is an error and must roll back, not hide a partial write.

## 5. Tactical DDD and consistency boundary

This is a scoped adoption assessment for grandfathered Carrier lifecycle, not a
Carrier aggregate rewrite. A pure onboarding policy owns the business default;
existing application services authenticate/seal outside locks and command the
existing port. Infrastructure retains actor->epoch/generation->connection/children
transaction, global account uniqueness, encryption persistence and success audit.
The new child config participates in that consistency boundary. Stateless policy
needs no entity/VO/generic repository. Sync schedule records stay Sync-owned;
Carrier infrastructure may create them without importing Sync application or
infrastructure. Shared SyncType is the existing approved code-only contract.

## 6. Runtime control and scheduler behavior

SyncConfig retains enabled/leaseSeconds/pollMs/maxAttempts/retentionDays only.
admissible requires global enabled and registry.resolve(provider,type). claim()
still obtains DB distinct pairs, filters by registry, then selects eligible pairs
with SKIP LOCKED; remove only sync_type ANY(config.types) and early types.length.
schedule() keeps existing ACTIVE/CONNECTED/due/enabled/no-active query, keyset
continuation and completion-based updates. No new scheduler, job-per-missed-hour,
queue ordering, retry/lock/final-fence/lease or processor-version change.

MANUAL keeps its existing admission contract without requiring an enabled/due
schedule. AUTO remains the existing scheduler's enabled/due selection and atomic
admission/idempotency path; do not redesign direct internal AUTO admission semantics.
Global false blocks admission, claim and scheduling. Empty/unsupported production
registry makes enabled persisted configs unavailable and unable to execute.

## 7. Compatibility and limits

POST connection and GET/PATCH Sync config wire shapes stay unchanged; GET observes
the new persisted row even when runtime available=false. Reconnect never invokes
the provisioning resolver or resets schedules/watermarks; hard delete uses FK
cascade. No backfill for existing connections, schema/migration/grant changes,
SDK/Shared vocabulary additions or frontend changes. Existing Uniship-only creation
provider assignment is not generalized by this task; resolver consumes actual
created connection.provider rather than a hardcoded Uniship argument.

Default60 is not a new global minimum. Keep PATCH's existing interval allowlist;
provider-specific activation/rate constraints belong to057/058 after verification.
No live Uniship access, worker credential decryption, production registration,
Customer Sync, activation field, new table or unrelated ENV changes.

## 8. Security, concurrency and performance

Existing ACTIVE actor and generation checks, unique provider/account, lifecycle
version, durable audit and safe errors remain. All defaults insert before success
audit under the same transaction; forced config failure leaves no connection,
secret, config or success audit. An independent late audit failure must also roll
back the config. API/worker globals use same resolver; eligible pair predicates
remain before worker selection. Keep worker role/grants and all source/lease/fence
rollback contracts, LIMIT100,15000ms transaction and7500ms capacity bounds.
Provisioning adds only a bounded insert per provider policy (one today).

## 9. Test-first plan

1. Commit this SIGNIFICANT plan/snapshot and digest before implementation/tests.
2. Unit RED default policy, global-only runtime config, capability admission with
   no type list and empty registry; update old type-disabled tests to exact-pair
   unavailable cases without removing assertions.
3. Genuine PG Carrier RED: create config/time/nulls/no job/GET availability;
   config-trigger rollback; late audit rollback; duplicate, reconnect snapshots,
   independent connections/owners and cascade. Use existing local mock transport.
4. Genuine PG Sync RED with global-only config: future/due/disabled/unsupported/
   overdue scheduling, single active lane, manual without enabled schedule,
   unsupported provider/type excluded before claim. Retain all existing regressions.
5. Implement policy, transactional insert and remove type flags/config types from
   source, tests, Compose/env/scripts. Keep historical tasks/snapshots unchanged.
6. GREEN targeted builds/unit/Carrier/Sync/Shipment tests, lint/test:lint, typecheck,
   contracts/docs/preflight, full tests/integration/quality; canonical Docker attempt
   and final-head Preflight/Sync Targeted/Foundation. Isolate PG/projects/volumes.
7. Apply implementation-code-review checklist, fix scoped P1/P2, record whether
   independent reviewer unavailable rather than invent approval; owner review stays.
8. Commit/push new branch and create PR bound to056/revision/snapshot/digest. Inspect
   exact final HEAD/actual CI checkout/attempt/run URLs. No merge or auto-approval.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

Onboarding transaction creates provider defaults; schedules and global switch plus
static capability registry own execution; type environment flags are retired.

### Canonical owners

- docs/architecture/backend.md
- docs/architecture/database.md
- docs/architecture/sync-extensions.md
- docs/decisions/sync-worker-staging.md (dated amendment, preserve history)
- docs/operations/configuration.md
- docs/operations/testing.md

### Documentation verification

Pinned format/lint/test:lint/typecheck/docs/preflight/contracts, tests/integration/
quality and canonical Docker/runtime/exact-head hosted checks; command provenance
and failures in task/PR. No unexecuted assertion is PASS.

## 11. Acceptance

- [x] Exactly one enabled SHIPMENT/60 config on new Uniship connection, first due
      DB created_at+60minutes, all history NULL; no job and no request fields added.
- [x] Resolver uses actual provider, unknown provider empty, immutable/unique defaults.
- [x] Config/secrets/connection/success audit atomic, real rollback tests PASS.
- [x] Duplicate/owner/generation/audit boundaries preserved; reconnect unchanged;
      hard-delete cascade and independent schedules verified.
- [x] Type flags/types removed from current source/config/tests; technical tuning
      unchanged; global false and exact-pair capability fail closed in both processes.
- [x] Due scheduling/no catch-up duplication and unsupported claim verified; manual
      remains independent of schedule; original fences/leases/capacity preserved.
- [x] No migration/backfill/grant/contract/frontend/live-gate/production-registry drift.
- [ ] Documentation, meaningful regressions and full quality passed locally; exact-head CI/owner review remain pending in PR metadata.

## 12. Plan issues and governance

NONE unresolved. Policy placement avoids Sync->Carrier->Sync imports. Defaults are
not runtime capability declarations. API interval behavior is deliberately retained,
not silently tightened to a new provider minimum. Historical snapshots remain
immutable. Owner approval is not a pre-code gate; no live activation is authorized.

## Evidence

| Claim                       | Evidence                                                                                                                                                                        | Date       | Result |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| baseline-and-reconnaissance | GitHub PR54 merged=true, merge58223828a733f706d4ef058fac64b193556bde70 on2026-11-15; origin/main confirmed; clean new worktree and scoped inspection recorded before code/tests | 2026-11-16 | PASS   |
| frozen-install              | npx --yes pnpm@10.34.6 install --frozen-lockfile; exit0, unchanged dependency graph                                                                                             | 2026-11-16 | PASS   |

### Test-environment delta before PostgreSQL regressions

The host has no sudo and /runtime-config is absent; the canonical Carrier/MFA/
Customer integration suites hardcode that Docker mount. Reuse Shipment's existing
env-file fallback pattern for these test-only password reads via
API_TEST_RUNTIME_PASSWORD_FILE, preserving the canonical /runtime-config default
and every assertion. This enables genuine host-driven isolated Docker PostgreSQL
verification without privileged host writes or a new launcher framework. No
production credential/configuration policy or frozen design decision changes.

### PostgreSQL fixture reassessment

After three setup/fixture checkpoints, paused further test edits and inspected the
actual schema and failure traces. Carrier provider CHECK permits only uniship,
while persisted Sync jobs can retain unsupported providers after detachment.
Keep the Carrier constraint intact: use a valid Uniship/CUSTOMER due configuration
for unsupported-type scheduling and a detached historical unsupported-provider job
for claim eligibility. Unit coverage separately verifies unknown provider policy/
registry rejection. This replaces an impossible fixture, not an execution assertion
or migration. Initial fixture errors (overlong username, omitted status) and an
accidentally removed same-line loadSyncConfig argument are retained as failed
verification history; none is represented as behavioral RED or a production defect.

## Verification checkpoint — 2026-11-16

Host Node24.22.1/pnpm10.34.6; actual starting implementation HEAD cc5b071 plus
working delta, main baseline58223828. Main execution window UTC06:29–07:02.
Final committed HEAD, PR binding, CI checkout SHA/attempt/run URLs go in PR metadata
without an evidence-only SHA loop. No full local Docker build PASS is claimed.

| Claim                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                        | Date       | Result |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| plan-docs-initial          | Initial docs:check rejected missing exact Documentation verification subsection; corrected the task heading before plan commitcc5b071. Snapshot bytes/digest subsequently unchanged                                                                                                                                                                                                             | 2026-11-16 | FAIL   |
| pre-code-plan              | cc5b071 committed significant plan/snapshot after read-only inspection, reuse/DDD/security/compatibility review and docs/preflight PASS; snapshot SHAfe0f4f6089d34805ba893cebca1d4bfae152e660c322bd41ef018e41ecd07908                                                                                                                                                                           | 2026-11-16 | PASS   |
| unit-RED                   | node --test apps/api/test/carrier-default-sync.test.cjs apps/api/test/sync/policy.test.cjs apps/api/test/sync/capability.test.cjs;21 tests15 PASS/6 FAIL before implementation:3 missing new-policy module, runtime types still present, global-only availability/admission denied                                                                                                              | 2026-11-16 | FAIL   |
| carrier-RED                | Genuine PostgreSQL Carrier test before implementation: config-insert trigger still returned201 instead of established safe503 because no config was inserted. First companion scenario was blocked by overlong fixture username; initial500 expectation corrected to existing503 SERVICE_UNAVAILABLE before implementation. Not all initial failures are behavioral RED                         | 2026-11-16 | FAIL   |
| initial-PG-fixtures        | Initial Sync regression failed missing required connection status, not the intended runtime behavior. First combined targeted run101 tests88 PASS/13 FAIL: overlong username/missing status plus inadvertently deleted same-line loadSyncConfig constructor argument during flag cleanup. Restored global-only argument; no assertion removed or grants changed                                 | 2026-11-16 | FAIL   |
| fixture-reassessment       | Second combined run101 tests99 PASS/2 FAIL: impossible unsupported Carrier provider violated existing CHECK. Paused/reviewed schema; replaced with valid unsupported-type config and detached historical provider job. Following Sync run56 PASS/2 FAIL used nonexistent fixture queue.cancel; replaced only fixture terminal cleanup with existing scoped SQL pattern, not a production method | 2026-11-16 | FAIL   |
| unit-GREEN                 | Same targeted unit command21/21 PASS; broader node --test apps/api/test/carrier-default-sync.test.cjs apps/api/test/sync/\*.test.cjs30/30 PASS, including actual compiled worker startup/cycle diagnostics and API/worker capability factories                                                                                                                                                  | 2026-11-16 | PASS   |
| Carrier-and-Shipment-GREEN | Genuine isolated Docker PostgreSQL17.11 targeted suites: Carrier22/22 and Shipment21/21 PASS, exact SQL created_at+60minute equality, persisted GET/foreign404, no job, config/late-audit rollback, duplicate/reconnect/cascade and original worker/owner/fence/capacity assertions                                                                                                             | 2026-11-16 | PASS   |
| Sync-GREEN                 | node --test --test-reporter=tap integration/sync-integration.test.cjs from apps/api;58/58 PASS, including global-only due/future/disabled/unavailable/concurrent scheduling and older unsupported job exclusion/manual disabled-schedule admission; original sources/retries/fences/cancellation retained                                                                                       | 2026-11-16 | PASS   |
| full-integration-initial   | First npx --yes pnpm@10.34.6 test:integration on private cluster:163 tests159 PASS/4 FAIL because launcher omitted root DB migrations and STORAGE_ROOT for original suites. Fixed private launcher prerequisites, not application assertions/schema                                                                                                                                             | 2026-11-16 | FAIL   |
| full-integration-GREEN     | Private root DB authentic migrate:deploy plus owned storage/runtime-secret fixture, then npx --yes pnpm@10.34.6 test:integration from apps/api;163/163 PASS across all10 discovered integration files,0 skipped. All provider transports local mocks; no live Uniship                                                                                                                           | 2026-11-16 | PASS   |
| quality-initial            | First production-env pinned quality stopped at lint: unused loadSyncConfig exposed the accidentally removed same-line fixture argument; argument restored as SYNC_ENABLED-only. No production behavior/assertion workaround                                                                                                                                                                     | 2026-11-16 | FAIL   |
| full-quality-GREEN         | API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality;exit0. format/lint/boundaries/preflight/docs/typecheck/test/contracts/build PASS;792 tests:tooling142/API243/Web364/UI37/database6                                                                                                                                                                          | 2026-11-16 | PASS   |
| explicit-checks            | Pinned test:lint56/56, test:docs10/10, test:preflight24/24 PASS; final lint/docs:check/preflight:check PASS; API unit discovery39 suites includes new ordinary default-policy suite without filename-list edits                                                                                                                                                                                 | 2026-11-16 | PASS   |
| capacity                   | Full integration100 shipments x50charges/500items/4milestones/4services; first2273.977/2209.126ms, changed3074.705/2864.943ms, identical5.695/8.301ms;800/800/0 writes. Docker PG17.11 Debian x64,3 visible AMD EPYC9V74 CPUs;7500ms bound/15000ms transaction/LIMIT100 unchanged                                                                                                               | 2026-11-16 | PASS   |
| runtime-configuration      | docker compose -f compose.yml -f compose.dev.yml config --quiet exit0. Current source/Compose/env/tests/canonical operations/architecture contain no retired type-variable names or config.types dependency; historical completed tasks/frozen snapshots remain unchanged                                                                                                                       | 2026-11-16 | PASS   |
| scope-and-hard-gates       | git diff --name-only versus58223828 empty for packages/database, SDK/OpenAPI, Web, sync-runtime-capabilities.ts and uniship-http.client.ts. No schema/backfill/grant/front-end/production registration/network-gate change; policy call uses actual connection.provider                                                                                                                         | 2026-11-16 | PASS   |

### Local Docker availability and retained limitations

Docker29.9.2/rootless VFS is available and genuine owned PostgreSQL17.11 executed
above. Full local sh scripts/quality-docker.sh and local runtime/HTTPS/HMR smokes:
NOT RUN in this task. Available overlay was769–777MB out of7.9GB after builds;
the prior055 canonical build had already demonstrated VFS ENOSPC with more free
space. No repeated disk-filling build, storage-driver change or broad cleanup was
attempted. Docker Compose syntax/PG success is not canonical runtime acceptance;
exact-final-head hosted Foundation must execute those gates. Images/screenshots
were not captured or manually reviewed locally. No old-head CI is proof for056.

### Final code-review checkpoint

Read-only implementation-code-review against the recorded plan and full diff:
no confirmed P1/P2 or new duplicate policy, circular import, application/domain
Prisma, network-in-transaction, API/schema/grant drift or unlocked post-commit
provisioning. Current Carrier still permits only Uniship; resolver fallback is
unit-tested without inventing another production provider. Claim retains registry
eligible-pair filtering before SKIP LOCKED and fence/processor checks; no new manual
schedule requirement. Defaults are persisted intent, never runtime authorization.
Existing technical tuning, generic PATCH intervals and all hard gates are preserved.

This is self-review, not independent approval. An independent reviewer was not
invoked in this session; owner review remains an explicit readiness limitation.
No additional architectural scope was implemented. Test-only password-file fallback
is documented; canonical Docker default reads and assertions are unchanged. All
setup/fixture failures above remain history, not hidden by rerunning CI. New exact-
head hosted results and final recommendation remain pending until actual execution.

### Review delta — static provider policy registry (2026-11-16)

BOUNDED refactor within plan v1; baseline
`b94645076fc61ac2aef6fed70df9b93942375e76`. No new snapshot or task.
Pre-code inspection: searched `getDefaultSyncPolicies` across apps/api, inspected
CarrierProvider, existing default tests, lifecycle create transaction and reusable
components registry (`registry|policy`). The sole production caller is
carrier/infrastructure/carrier-lifecycle.adapter.ts.

| Field                    | Decision / evidence                                                                                                                                               |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Default onboarding policy lookup                                                                                                                                  |
| Existing implementations | apps/api/src/carrier/domain/default-sync-policy.ts; apps/api/test/carrier-default-sync.test.cjs; apps/api/src/carrier/infrastructure/carrier-lifecycle.adapter.ts |
| Domain owner             | Carrier domain; persisted onboarding intent only                                                                                                                  |
| Reuse alternatives       | Keep conditional; use static object; extract common registry/framework                                                                                            |
| Selected approach        | Reuse interface/caller; one frozen object keyed by canonical CarrierProvider, satisfies readonly partial Record; own-property guarded lookup                      |
| Rationale                | Data-only extension without provider conditions or speculative abstraction                                                                                        |
| Risks                    | Prototype keys and shared mutation; guard before controlled keyof assertion and freeze registry, arrays, entries and fallback                                     |
| Verification             | Expand characterization tests before implementation; build and targeted unit/Sync tests, real Carrier PostgreSQL regression, full quality, exact-head hosted CI   |

Documentation Impact for this delta: REQUIRED; update backend registry description
and testing coverage in existing canonical owners. Transaction, timing, reconnect,
audit, capability registry, global switch, HTTP gates, contracts and schema are
out of scope. Plan: tests first, static lookup refactor, execute checks, review
complete delta and publish same PR without merging. Existing behavior already
handles prototype names; pre-refactor GREEN is characterization, not a fabricated
behavioral RED. Snapshot bytes/digest stay unchanged.

#### Registry delta verification

Executed 2026-11-16 (UTC), baseline b946450 with the five-file registry delta:

| Claim                                 | Evidence                                                                                                                                                                                                                    | Date       | Result |
| :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Pre-refactor characterization         | `node --test apps/api/test/carrier-default-sync.test.cjs`: 3/3 with expanded prototype-key/freeze assertions, before policy implementation changed                                                                          | 2026-11-16 | PASS   |
| Registry behavior and Sync invariants | `pnpm --filter @nexora/api... build` then `node --test apps/api/test/carrier-default-sync.test.cjs apps/api/test/sync/*.test.cjs`: 30/30                                                                                    | 2026-11-16 | PASS   |
| Auto-provision regression             | Owned disposable Docker PostgreSQL17.11; `node --test integration/carrier-lifecycle-integration.test.cjs`: 22/22, including defaults/timing/reconnect/atomic rollback; container, volume and test secrets removed afterward | 2026-11-16 | PASS   |
| Vocabulary lint regression            | `pnpm test:lint`: 56/56                                                                                                                                                                                                     | 2026-11-16 | PASS   |

Additional executed verification at 07:41 UTC: full
`API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`
PASS (format, lint/boundaries, preflight, docs, typecheck, 792 tests, contract drift
check and production build). `pnpm test:docs` 10/10 and `pnpm test:preflight` 24/24
PASS. Tooling uses pinned pnpm10.34.6. Final hosted results will be appended to
PR metadata against the committed source HEAD, without rewriting prior evidence.

Review of complete delta found no confirmed P1/P2: only resolver/tests and canonical
backend/testing/task docs changed. The keyof assertion is guarded by Object.hasOwn
on a frozen private registry. No framework, fake provider, runtime capability,
transaction or contract changes. Interface and defaults unchanged. This is
self-review, not independent approval. Existing independent-review limitation
remains. Frozen v1 snapshot SHA-256 still
fe0f4f6089d34805ba893cebca1d4bfae152e660c322bd41ef018e41ecd07908.
Local full Docker quality/runtime is NOT RUN for this delta due to the existing
small-disk constraint; hosted Foundation must supply final-head canonical evidence.
No screenshots were captured or manually reviewed for this backend-only delta.

### Review delta — SyncRepository SQL readability (2026-11-16)

BOUNDED behavior-preserving amendment within v1, baseline
3fee4b36e1162a7159a1097f199bf1eab1b1900c; PR55 open and worktree clean.
No new task/snapshot. Read-only audit inspected repository instructions, both
review skills, backend/database/Sync extension architecture, ADR-009/010, testing
guide, SyncRepository call sites and genuine PostgreSQL suite. Search scope:
`claim|schedule|SKIP LOCKED|lease|fenc` in repository, integration suite and docs;
reusable-components registry has no replacement for this Sync-owned locking SQL.

| Field                    | Decision / evidence                                                                                                                                                    |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | SyncRepository SQL readability                                                                                                                                         |
| Existing implementations | apps/api/src/sync/infrastructure/sync-job.repository.ts; apps/api/integration/sync-integration.test.cjs; apps/api/integration/fixtures/sync-status-contract.cjs        |
| Domain owner             | Sync infrastructure, existing Prisma/PostgreSQL transactions                                                                                                           |
| Reuse alternatives       | Format in place; private query helpers; tuple-pair predicate                                                                                                           |
| Selected approach        | Format existing SQL in claim/schedule/admit/configure and closely related authorization/lease/retry paths; no new helper or abstraction                                |
| Rationale                | Exposes lock/predicate/time boundaries directly; retains existing query tokens and parameter order                                                                     |
| Risks                    | Accidental precedence, placeholder, literal or transaction drift; compare SQL/TS tokens to baseline and run real PostgreSQL regressions                                |
| Verification             | Add explicit due/future/live/expired/concurrent/SKIP LOCKED tests before refactor; baseline and final Sync PG, unit tests, full integration and quality; exact-head CI |

Tuple comparison evaluated and deferred: existing registry filters exact actual
DB provider/type pairs before parameterized ANY lookup; replacing representation
is unnecessary for readability and would require additional equivalence/query-plan
work. No dynamic SQL, ORM change, status/flag change or fake capability is planned.
Keep literal partial-index predicate, clock_timestamp calls, parameter sequence,
statement/lock order and transaction boundaries byte-equivalent apart from SQL
whitespace. No helpers: SQL remains beside its owning transaction.

Documentation Impact for this delta: REQUIRED for regression coverage in
docs/operations/testing.md and this task evidence. No architecture/business
contract changes. Plan: characterization tests and baseline PG first, format small
method groups with targeted checks after each, final PG/full integration/quality,
diff/implementation review, push same branch and inspect final-head CI.

#### SQL refactor baseline and equivalence evidence

| Claim                                                | Evidence                                                                                                                                                                                                           | Date       | Result |
| :--------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :----- |
| Disposable PG bootstrap first attempt                | Scratch launcher accepted temporary init socket readiness; COMMENT failed because init server was shutting down. No baseline test executed; corrected launcher readiness to TCP without repository runtime changes | 2026-11-16 | FAIL   |
| Pre-refactor baseline with new regression assertions | Owned isolated migrated PostgreSQL17.11; `node --test integration/sync-integration.test.cjs` 61/61, including explicit deadlines, concurrent workers and held-row SKIP LOCKED                                      | 2026-11-16 | PASS   |
| Incremental build/units                              | After each of three method groups: pinned pnpm API dependency build then `node --test apps/api/test/sync/*.test.cjs`, 27/27 each                                                                                   | 2026-11-16 | PASS   |
| Source equivalence against 3fee4b3                   | TypeScript AST inspection of all59 tagged templates: identical SQL lexical tokens and string literals, parameter expressions/order; all non-whitespace source characters identical                                 | 2026-11-16 | PASS   |

SQL predicate structure did not change; tuple optimization/query-plan alteration
was deliberately omitted. No new helper, status set, SQL abstraction or dependency
was needed. Existing raw Prisma SQL retains SKIP LOCKED, row locks, conditional
updates, RETURNING and partial-index inference in place. Unselected read/staging/
application/retention SQL is outside this bounded readability delta.

Post-refactor targeted PostgreSQL execution: `node --test
integration/sync-integration.test.cjs` PASS61/61 (151.3s, 2026-11-16 UTC).
This includes real concurrent workers, held-row SKIP LOCKED, due/future timestamps,
live/expired leases, global/unsupported pair rejection, retry exhaustion and
scheduler keyset, bounded transient failures, no catch-up and active-lane exclusion.
Existing multiple-provider/type extension regressions remain green. This is a
behavior-preserving refactor: baseline and final assertions both GREEN.

Implementation-code-review of the entire four-file delta: no confirmed P1/P2.
No SQL token or TS logic change, unsafe interpolation, added round trip, lock/
transaction reordering, ORM/schema/API/SDK/grant change, retired type flag, runtime
capability or live provider request. Static ON CONFLICT inference and SQL clock
functions are unchanged. Snapshot digest remains unchanged. This is self-review,
not independent approval; independent review remains unavailable in this session.
Local full Docker quality/runtime NOT RUN: approximately755MB free on the small
workspace overlay after builds/PG; prior canonical image build exhausted disk even
with more capacity. Do not repeat a disk-filling attempt or clear unrelated data;
final-head hosted Foundation is the canonical gate. No screenshots captured or
manually reviewed locally for this backend-only refactor.

Final local SQL-delta verification (2026-11-16 UTC):

| Claim                            | Evidence                                                                                                                                                                              | Date       | Result |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :----- |
| Full quality                     | `API_INTERNAL_URL=http://api:4000 NODE_ENV=production npx --yes pnpm@10.34.6 quality`: format/lint/boundaries/preflight/docs/typecheck,792tests, contracts:check and production build | 2026-11-16 | PASS   |
| Entire genuine PostgreSQL matrix | Owned disposable PG17.11, root migration deploy then pinned `pnpm test:integration`: 166/166 across10files,180.4s; no skipped tests                                                   | 2026-11-16 | PASS   |
| Governance regressions           | Pinned `pnpm test:lint`56/56, `pnpm test:docs`10/10, `pnpm test:preflight`24/24                                                                                                       | 2026-11-16 | PASS   |

Test-owned container/volume, runtime password file and storage removed after the
full run. No user volumes modified. Final exact-head hosted outcomes will be
appended to PR55 metadata; earlier green heads remain historical. Task status
remains VERIFICATION PENDING; no merge or independent-review claim.

### Review delta — integration runtime password override (2026-11-16)

BOUNDED naming-only follow-up within PR55/v1; baseline
b3562d4953b80bc0a6d107723b6caaf5bab22ef8, clean worktree and latest PR head verified.
Read repository governance/review skills, testing guide, existing task/snapshot and
five integration readers. Repository-wide search found one active legacy reader
(Shipment), one active setter (packages/database/test/shipment-worker.mjs), two
current testing-guide references and one immutable completed055 historical FAIL.
The four other integration readers already use the canonical name and stay intact.

| Field                    | Decision / evidence                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Test-only runtime-password-file override                                                                                                                                           |
| Existing implementations | Five apps/api/integration readers; packages/database/test/shipment-worker.mjs launcher; docs/operations/testing.md                                                                 |
| Domain owner             | Integration-test tooling only; no application/domain credential policy                                                                                                             |
| Reuse alternatives       | Reuse existing canonical override; legacy alias or helper unnecessary                                                                                                              |
| Selected approach        | Rename Shipment reader and tracked launcher setter to API_TEST_RUNTIME_PASSWORD_FILE; retain exact Docker fallback/read/validation/assertions                                      |
| Rationale                | Consistent five-suite configuration and a working existing launcher with minimal diff                                                                                              |
| Risks                    | Launcher/reader mismatch or accidental runtime-secret change; audit every tracked reference and preserve historical evidence                                                       |
| Verification             | Full reference search; format/docs/preflight/quality; genuine isolated PG with canonical override; unset Docker fallback via exact-new-head Foundation; all mandatory hosted gates |

No documented external compatibility consumer was found. The in-repository
launcher is migrated together; no second alias, new helper/dependency, production
Compose/.env setting, migration, grant or credential-management change is needed.
Documentation Impact: REQUIRED for current override guidance in testing.md and this
change note/evidence. Preserve all historical evidence and v1 snapshot/digest.
Plan: migrate the two active references and guide, execute defined checks, inspect
the complete delta, commit/push this existing branch, record new exact-head hosted
evidence in PR55 and keep it open/unmerged. This is verification-first test tooling;
no new test or changed assertion is needed for a variable-name replacement.

#### Password override delta — executed verification

Host verification uses pinned Node24.19.0/pnpm10.34.6 and genuine PostgreSQL17.11
in a fresh task-owned native cluster (SCRAM/TCP, ownership marker, random private
credentials); it is not Docker evidence. The override file is mode0600, the legacy
variable is unset, and no /runtime-config mount exists on this host. Therefore
passing suites actually exercise the supplied override. Default/unset Docker-path
execution locally: NOT RUN; exact-new-head Foundation must execute the canonical
five-suite integration matrix with no test-only variable added to Compose/env.

The first local matrix failed because bootstrap used postgres without the
canonical administrator role nexora: existing privilege assertions expect42501
for SET ROLE nexora, not undefined-role. Only this owned cluster's bootstrap was
corrected to the canonical administrator; no test/assertion or provisioning source
changed. A subsequent invocation used repository root instead of apps/api and
failed file discovery before execution; corrected only the command cwd. Both
failures remain below. The corrected unchanged five-suite command PASSed92/92,
0 skipped. Canonical Docker fallback/read/validation and all fixtures remain exact.

| Claim                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                              | Date       | Result |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| install                             | `npx --yes pnpm@10.34.6 install --frozen-lockfile`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:01:26.960329+00:00; exit 0                                                                                                                                                                                                                                            | 2026-11-16 | PASS   |
| native-pg                           | `python3 /tmp/nexora056-password-pg.py`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:01:58.863374+00:00; exit 0                                                                                                                                                                                                                                                       | 2026-11-16 | PASS   |
| api-build                           | `npx --yes pnpm@10.34.6 --filter @nexora/api... build`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:02:01.423346+00:00; exit 0                                                                                                                                                                                                                                        | 2026-11-16 | PASS   |
| five-suite-override                 | `python3 /tmp/nexora056-password-env.py node --test --test-concurrency=1 integration/carrier-foundation.test.cjs integration/carrier-lifecycle-integration.test.cjs integration/customer-integration.test.cjs integration/mfa-integration.test.cjs integration/shipment-integration.test.cjs`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:02:51.494227+00:00; exit 1 | 2026-11-16 | FAIL   |
| canonical-admin                     | `node /tmp/nexora056-password-canonical-admin.cjs`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:04:36.938410+00:00; exit 0                                                                                                                                                                                                                                            | 2026-11-16 | PASS   |
| five-suite-override-canonical-admin | `python3 /tmp/nexora056-password-env.py node --test --test-concurrency=1 integration/carrier-foundation.test.cjs integration/carrier-lifecycle-integration.test.cjs integration/customer-integration.test.cjs integration/mfa-integration.test.cjs integration/shipment-integration.test.cjs`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:04:37.226782+00:00; exit 1 | 2026-11-16 | FAIL   |
| five-suite-override-green           | `python3 /tmp/nexora056-password-env.py node --test --test-concurrency=1 integration/carrier-foundation.test.cjs integration/carrier-lifecycle-integration.test.cjs integration/customer-integration.test.cjs integration/mfa-integration.test.cjs integration/shipment-integration.test.cjs`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:04:48.165541+00:00; exit 0 | 2026-11-16 | PASS   |

| Claim           | Evidence                                                                                                                                                                                                                                                           | Date       | Result |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------ |
| format-check    | `npx --yes pnpm@10.34.6 format:check`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:06:11.240885+00:00; exit 0                                                                                                                      | 2026-11-16 | PASS   |
| docs-check      | `npx --yes pnpm@10.34.6 docs:check`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:07:03.359917+00:00; exit 0                                                                                                                        | 2026-11-16 | PASS   |
| preflight-check | `npx --yes pnpm@10.34.6 preflight:check`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:07:06.833838+00:00; exit 0                                                                                                                   | 2026-11-16 | PASS   |
| launcher-green  | `python3 /tmp/nexora056-password-env.py env -u API_TEST_RUNTIME_PASSWORD_FILE npx --yes pnpm@10.34.6 exec node packages/database/test/shipment-worker.mjs`; working tree on b3562d4953b80bc0a6d107723b6caaf5bab22ef8; UTC 2026-11-16T09:06:09.728275+00:00; exit 0 | 2026-11-16 | PASS   |

Launcher verification PASS21/21 with parent API_TEST_RUNTIME_PASSWORD_FILE removed:
its existing private-file setup must supply the canonical child variable itself.
No default mount exists on this host. Full matrix PASS92/92 and launcher PASS21/21
retain original assertions/fixtures. Repository search: six executable canonical
references (five readers, one setter), zero executable legacy references; one
completed055 historical FAIL retains the legacy name. Exact diff inspection found
only two token replacements in executable code; four pre-existing canonical
readers, all production config/Compose/env, provisioning, migrations, application
services and frozen v1 digest are unchanged. Self-review found no scoped P1/P2;
this does not claim independent approval of the earlier SIGNIFICANT task.

Commit/final quality/hosted evidence will be recorded on PR55 without an
additional evidence-only commit. Until exact-head Foundation completes, the unset
Docker fallback is NOT VERIFIED for this delta. Status stays VERIFICATION PENDING;
no merge, new task/PR or snapshot revision. Logs are temporary runtime files, not
Git artifacts; no screenshots captured or manually reviewed for this naming delta.
