# NEXORA-042 — Sync Provider & Domain Extension Architecture, Phase A

## 1. Metadata and classification

Task ID: NEXORA-042
Classification: SIGNIFICANT
Documentation Impact: REQUIRED
Plan revision: rev-2026-11-12-sync-extension-v2
Reviewed baseline: 6a52c2ff90a1173a25053caf6fb7061b82f6b8dd (main, merged PR32).
Branch: feat/sync-extension-architecture. New PR to main; no merge/deploy/Live.
Owner approval is not required under current ADR-009. No approval evidence invented.

## 2. Requirements and scope

Implement static provider+SyncType capability resolution, shared API/worker
composition, and a neutral transaction-bound Domain invocation in existing Sync V1.
Reuse queue, scheduler, worker, policies, schema, vocabulary and security contracts.
Keep current two SyncTypes, HTTP/SDK, intervals, source identity, retries, lease,
checkpoint, retention and completion semantics. Production registration stays empty;
flags do not provide authorization/handlers. No Shipment schema/business mapping,
provider HTTP/credential decryption, new framework/service, pool work or UI change.

## 3. Canonical owners and DDD applicability

ADR-008 owns Domain boundaries; ADR-009 owns recorded plan/raw-byte snapshot;
ADR-010 owns Sync invariants. Backend/runtime/database/testing docs own their
contracts. Customer owns existing-link validation/persistence; Sync owns technical
source/version/outcome/transaction orchestration. This is a supporting infrastructure
capability, not a new business domain: no speculative aggregate, VO or Unit of Work.
Source/job consistency remains the existing fenced SQL transaction. Customer
Aggregate semantics and actual future Shipment Domain design remain untouched.

## 4. Read-only inventory and call-site audit

Searched SyncProvider/SyncDomainProcessor/SyncDomainSession/SyncSource,
SyncJobExecutor, available/schedule/claim/apply and unavailable handlers across
apps/api/src, test, integration, shared vocabulary, Prisma and role provisioning.

| Category/component        | Existing implementation                                                            | Owner                         | Reuse/change                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Queue/scheduler/lease     | sync/infrastructure/sync-job.repository.ts schedule/claim/heartbeat/wait/cleanup   | Sync infrastructure           | Preserve algorithms/SQL; route availability through resolver                                                  |
| Normalization/checkpoints | sync/domain/sync-policy.ts; repository.page                                        | Sync/Provider port            | Keep hashing/key/order/page/strategy validation; select processor version from matching capability            |
| Provider execution        | sync/application/sync.port.ts SyncProvider/SyncPage/NormalizedSource; executor     | Sync application port         | Keep interface; resolve exact pair before existing fetch/cancellation flow                                    |
| Domain orchestration      | SyncSource.customerId, SyncDomainSession.linkExistingCustomer and repository.apply | Currently mixed Sync/Customer | Neutral source/session; move Customer locking/link persistence to Customer infrastructure binding             |
| Composition               | app.module.ts, worker/sync-worker.module.ts duplicate unavailable pair             | Runtime roots                 | One explicit production registry factory, no new Nest module/secrets                                          |
| HTTP/contracts            | sync-admission.service.ts/controller/DTO, SDK                                      | Sync transport                | Unchanged endpoints/errors/input/output and intervals                                                         |
| Persistence/security      | five Sync tables, Customer FK/link_origin, provisioning/read-lock functions        | Database/infrastructure       | Unchanged schema/migrations/grants; preserve scoped locks and mapping invariants                              |
| Tests                     | test/sync/application.test.cjs; integration/sync-integration.test.cjs and fixtures | Test-only                     | Adapt direct injection to static capability bindings; preserve all assertions, add real neutral-write fixture |

## 5. Mandatory eight-field reuse audit

| Field                    | Capability resolution                                                                                           | Domain execution boundary                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Static pair registry and shared production composition                                                          | Bound per-source invocation with deferred domain persistence                                                                                          |
| Existing implementations | sync.port.ts Provider/Processor; repository.available; executor; app/worker roots; provider-fetch.adapter.ts    | repository.apply/linkExistingCustomer; Customer infrastructure; isUuid; existing SQL locks and mapping                                                |
| Domain owner             | Sync application contract; infrastructure registration; runtime roots                                           | Sync neutral orchestration; Customer-owned existing-link binding                                                                                      |
| Reuse alternatives       | Composite ports only; small static registry; dynamic plugins                                                    | Keep Customer hardcode; neutral trusted bindings; public Prisma/SQL or boolean receipt                                                                |
| Selected approach        | Pure resolver port plus small infrastructure static map keyed by provider/type; shared empty production factory | Infrastructure-only begin(tx,job,source,lock context) creates decide/commit/close invocation; processor receives narrow immutable scope/session only  |
| Rationale                | One declaration source, explicit dispatch/version, no extra framework/queue                                     | Domain-owned persistence proof, no fake link for other domains; retain real transaction ownership                                                     |
| Risks                    | Duplicate/mismatched registration, mutable versions, unsupported flags, wrong dispatch                          | Forged APPLIED, non-APPLIED writes, stale capability use, owner/link mismatch, rollback                                                               |
| Verification             | Unit key/duplicate/type/version/flag/fallback/composition tests and two-capability PG dispatch/restart          | Real test-owned PG write, Customer regression, no-proposal APPLIED rejection, all outcomes, exceptions/lease rollback and retained-session revocation |

## 6. Alternatives and trade-offs

Reject dynamic plugin discovery, generic workflow/mapping engines and new DI/event
systems. Reject a processor-visible SQL callback/Prisma handle or markApplied()
boolean: neither protects ownership nor proves persistence. Reject a new production
mapping table/Shipment placeholder or speculative grants. A single generic session
type parameter is sufficient for typed Customer extensions, erased at a trusted
static infrastructure binding; no generic domain framework is introduced.
Customer binding may need one scoped mapping projection per source to keep the
neutral engine free of Customer columns. Batch remains bounded100, and no production
handler is enabled. Correctness/ownership precede speculative query optimization.

## 7. Selected interfaces and dispatch

Keep SyncProvider.strategy/fetch, SyncPage and NormalizedSource unchanged.
SyncSource becomes id/sourceVersion/processorVersion/payload only.
SyncDomainSession exposes immutable owner/connection/source/provider/account/type
scope, no database executor. SyncDomainProcessor has an optional typed session
parameter; CustomerSyncSession owns existingCustomerId/linkExistingCustomer.

Application resolver contract returns provider and processor metadata(version,
supports) for an exact pair. Infrastructure registry binds that metadata to a
trusted Domain binding; rejects duplicate/malformed pair/version registrations;
unknown/unsupported pair resolves unavailable. No runtime mutation API or database
handler selection. Snapshot processor version and fail closed on version drift.

Repository gets one registry instead of one provider+processor. available keeps
existing global/type flag checks and uses resolver. Executor reads the same queue
resolver and chooses matching provider/processor version for each job; it no longer
accepts an unrelated processor/provider pair. apply resolves the Domain binding
itself, not a caller-supplied arbitrary processor. Internal test call sites must
use explicitly constructed matching registries, with clients closed after use.

API and worker import the same production registry factory, whose declarations
are empty. Existing unavailableProvider/unavailableProcessor remain fail-closed.
No bootstrap network/crypto, Worker secret in API or API admin secret in worker.

## 8. Domain persistence, authorization and concurrency

Existing transaction locks ACTIVE user→epoch→owned connection→job→items/sources.
Add only the necessary exact captured job/connection provider/account/type/owner
identity checks and scoped source predicates to prevent cross-capability staging
or dispatch; do not reorder locks or alter lifecycle/retry/scheduling algorithms.

After owner/source/version checks, trusted infrastructure binding begins a private
invocation. decide passes only typed session capabilities to its paired processor.
Capability calls validate and stage proposals, never domain writes. For APPLIED,
commit rejects a missing proposal, executes the narrow owner-scoped persistence
operation and verifies its result. Only then may engine update applied bookkeeping.
Every other outcome discards proposals. Exceptions abort the whole transaction;
final existing lease check rolls back Domain writes, mappings, outcome and counters.
close in finally revokes retained capability methods, including after awaited
validation; no post-invocation SQL can be initiated through the session.

Customer binding alone owns Customer projection, UUID/immutable-link checks,
owner lock/function and LINKED_EXISTING update. Preserve existing shared/exclusive
lock mode and FK/link_origin/provenance; do not write Customer business rows.
No Customer-specific branch or required Customer linkage remains in generic apply.

A trusted adapter's commit guarantee is established by its contract tests, not by
an untrusted processor return value. No public success receipt API exists. Synthetic
non-Customer binding performs a checked real transactional write in an owned test
table only. Production Domain writes remain unavailable pending their own reviewed
commands/invariants/grants; tests do not authorize a production implementation.

## 9. Compatibility and migration assessment

No schema/migration/role/grant/public API/SDK change required. Preserve Customer FK,
link_origin and all historical data. Generic applied/resolved hashes/versions and
source/job provenance already represent neutral completion. Existing Customer
mapping writes move to its binding without changing their meaning. All closed
statuses/types/errors and static partial-index predicate remain unchanged.
New SyncType in a later phase requires canonical vocabulary plus deliberate
forward-only CHECK/schema/contract migration; it is not an arbitrary runtime string.
No new field is inferred from Uniship or external API documentation.

## 10. Test-first and verification strategy

Before implementation add RED exact-pair/duplicate/invalid-version/unsupported and
empty-production tests; preserve actual build prerequisites. Add real PG fixture
RED proving neutral APPLIED cannot work under old Customer-only coupling.
Two deterministic capabilities within SHIPMENT/CUSTOMER vocabulary must dispatch
independently through MANUAL/AUTO, fetch FULL/INCREMENTAL/cursor/watermark,
cancellation, staging/source versions and retries/restart. Test unknown providers,
wrong types/versions, disabled flags, invalid pages/source and safe failures.

Real disposable PostgreSQL test-owned table/adapter proves neutral APPLIED without
Customer linkage, no-proposal rejection, non-APPLIED no-write, row-count/owner
checks, source/account/provider isolation, exceptions and lost-lease rollback.
Preserve all existing Sync46PG/12unit/security/migration/role regressions. No tests
on shared DB, no fake migration history, no user volumes reset. Existing targeted
workflow should cover new test fixture/Customer binding paths; no duplicate gate.

Run frozen install, preflight/docs/boundaries/lint/typecheck, focused unit/realPG,
contracts drift and full quality; canonical Docker/runtime and final-head hosted
Preflight/Sync Targeted/Foundation require actual logs/head or merge binding.
Document any dependency/runtime limitation as NOT RUN/FAIL, not historical PASS.
Three independent reviews: correctness/design; architecture/security; final PR/CI.

## 11. Plan readiness and rollout

Read-only audit and independent pre-code security assessment completed2026-11-08.
Historical v1 used NEXORA-035; NEXORA-042 was checked unused on2026-11-12 across origin/main task/snapshot trees and all5 open PR trees/metadata.
Record raw-byte SHA256 in mutable task and new PR. Reviewable commits/new branch
only, new Draft PR to main, no merge/deploy. Task may advance to VERIFICATION
PENDING but cannot complete while mandatory criteria remain unverified. Preserve
all NEXORA-034 snapshots/task/history unchanged.

## 12. PLAN ISSUES and non-goals

PRODUCTION_DOMAIN_WRITE_CONTRACT: no authorized production provider/Shipment or
Customer sync command/grant exists. Keep production registry empty. This blocks
Live/B-C activation, not the requested controlled synthetic Phase A proof; never
invent permissions/business transitions to close it. If safe neutral transactional
proof cannot be implemented, explicitly retain AC7/AC8 BLOCKED instead of relaxing
the guarantee. No owner approval gate is introduced. Issue33 pool consolidation
and all unrelated production/public-release gates remain deferred.

## 13. Delta — collision remediation and merge-main review corrections

Recorded2026-11-12 before tests/code. Rename this Sync task from NEXORA-035
to NEXORA-042 because PR35 already owns NEXORA-035 centralized workspace
authentication. Preserve original v1 bytes/path as historical provenance for this
Sync task. New v2 derives from v1 and supersedes only the deltas below; unchanged
Phase A invariants and empty production registration remain authoritative.
Reviewed branch HEAD13658fb7e0155b0309f9c01ee394fe864923c032; merge target
origin/main3906f8243347fb7c697bf5f6949389c3a784a13d.

Merge main (no rebase) after recording this plan and synchronizing task/PR metadata.
Carrier navigate must combine fresh-document marker, exact location/error checks,
settleLayout and main dialogGate (no open dialog except syncIssues query) within
existing until/deadline. Preserve both Sync Phase A and M5 testing sections and
inspect backend auto-merge for duplicate/lost sections. Never alter assertions,
timeouts, geometry tolerances or unrelated main behavior.

P3 changes (test-first where executable):

- Customer binding commit updates only customer_id/link_origin; generic repository
  retains last_applied_sync_job_id in the APPLIED branch. Verify mapping-only
  SQL via controlled transaction test and provenance after genuine PostgreSQL apply.
- Audit production uses, remove obsolete unavailableProvider/unavailableProcessor
  adapter and only their tests when no consumer remains; empty runtime registry
  and fail-closed resolver tests stay.
- admit resolves once after config/type checks, handles null and uses the same
  resolved strategy without another provider.strategy invocation or nonnull assertion.
  Capture and validate strategy once in registry.resolve and expose it on its
  infrastructure BoundSyncCapability; do not change the public HTTP or application
  resolver port. Test actual admit control flow with counted resolution/strategy,
  flags and null failure; retain available semantics and other repository bodies.
- Search schema/Carrier/common for provider-length ownership. PLAN ISSUE
  PROVIDER_LENGTH_SINGLE_SOURCE: only Prisma/SQL VarChar32 and the existing local
  registry guard exist; no reusable TS limit was found in API/shared at inspection.
  Per user instruction retain existing32 validation rather than inventing another
  constant, changing schema or importing Prisma into application/domain. Record
  this bounded P3 item unresolved; it does not authorize duplicate constants.
- Backend docs explicitly permit only SyncDomainBinding/BoundDomainExecution
  type contracts from sync/infrastructure in business infrastructure bindings,
  because their signatures include Prisma.TransactionClient. Domain/application
  remain Prisma-free; no broad cross-module infrastructure exception.

Reuse original eight-field audit and canonical native Node tests, existing genuine
PostgreSQL fixture and Carrier Chromium fixture. No new dependencies, production
registrations, schema/migration/grant/vocabulary/API/OpenAPI/SDK changes. Bodies of
schedule/claim/heartbeat/wait/cleanup/page stay unchanged.

Run requested Sync units, full migrated PostgreSQL integration with0skip, complete
merged Carrier browser fixture, lint/docs/preflight/format/full quality/boundaries.
After push inspect fresh Preflight, Sync Targeted and Foundation with exact HEAD,
actual merge SHA, timestamps and run URLs. Preserve every historical FAIL including
eea7287. A7 closes only after all final-head hosted gates PASS. Independent review
round3 evaluates final diff versus origin/main and actual evidence. No automatic
merge/deploy; task remains VERIFICATION PENDING pending sufficient evidence.
