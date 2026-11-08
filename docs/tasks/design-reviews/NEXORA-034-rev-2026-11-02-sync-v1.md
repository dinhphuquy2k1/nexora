# NEXORA-034 — Sync V1 implementation design

## 1. Metadata

Task ID: NEXORA-034
Classification: SIGNIFICANT
Plan revision: rev-2026-11-02-sync-v1
Reviewed baseline: 156a32414dfefdc235804367307b5f052d9dcb47
Branch: feat/sync-worker-staging-v1. Documentation Impact: REQUIRED.
This records the owner's supplied Sync V1 implementation architecture; no separate
owner approval is required under current ADR-009.

## 2. Requirements and scope

Implement M1 foundation, M2 durable queue, M3 source persistence, M4 processing,
M5 API/SDK/existing Drawer integration in one PR. Exactly five main tables:
sync_configs, sync_jobs, sync_source_identities, provider_source_records,
sync_job_items. A small provider budget coordination table is technical only and
necessary to share existing acquisition concurrency/cooldown across API/worker.
Do not invent Uniship endpoints, data rights, domain schema or successful live sync.
No Shipment CRUD, System User, auth changes, soft-delete, queue broker, redesign,
generic repository/Unit of Work, rollback domain or new dependencies.

## 3. Canonical documentation

ADR-002/007 historical on-demand scope needs a new additive worker ADR, not edited
history. ADR-008/009 own boundaries and pre-code governance. Update overview,
backend/database/runtime/API/frontend, configuration/testing/deployment and task.
Read existing design-system/reusable controls before UI edits; preserve defaults.

## 4. Read-only inventory

Searched apps/api/src/{identity,carrier,customer,common}, packages/database,
compose overlays and Carrier Drawer consumers for sync, disable, generation,
lifecycleVersion, ProviderBudget, transactions, FK and ports. No Sync module or
Shipment table exists. Identity setStatus locks sorted users after admin advisory,
then Carrier epoch/children. CarrierAdapter.remove hard-deletes after ACTIVE user
lock. Carrier lifecycle uses user→epoch→connection; network/crypto outside locks.
UnishipHttpClient has only auth/verify, live contract explicitly unverified.
Customer creation requires ACTIVE actor and mandatory valid address; phone-only
matching is not identity. Existing UI is presentation-only and must be reused.

## 5. Reuse audit

| Component               | Existing implementations                                                                      | Domain owner              | Reuse alternatives                 | Selected approach                                                                                                 | Rationale                             | Risks                               | Verification                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| Authorization/lifecycle | identity/infrastructure/user-management.adapter.ts; carrier/infrastructure/carrier.adapter.ts | Identity/Carrier          | Rewrite vs integrate               | Minimal transaction-local Sync cancellation participant                                                           | Preserve status/delete contracts      | Lock inversion, late writes         | Real PG barriers disable/delete/claim                |
| Queue/staging           | packages/database client; existing explicit migrations                                        | Sync technical capability | Memory vs PG                       | Dedicated parameterized adapters, partial unique lane, SKIP LOCKED                                                | Durable atomic checkpoint             | Expiry, crashes, duplicate versions | 20-way admission, restart, rollback, 10000 records   |
| Provider custody/budget | carrier credential vault, uniship/provider-budget.ts                                          | Carrier                   | New transport vs existing boundary | Preserve vault/live gate; shared PG acquisition budget binding in composition                                     | No cross-process quota illusion       | Slot expiry, cooldown               | Concurrent independent API/worker budget clients     |
| Validation/errors       | common/validation/{uuid,hex}.ts; common/http/error-messages.ts; Customer error mapper         | Common/Sync               | Duplicate vs reuse                 | Reuse predicates and safe message, local exhaustive map                                                           | No duplicate regex/framework          | Mass assignment, secret leakage     | Strict inputs, envelope/Origin/owner tests           |
| Domain processing       | Customer aggregate/application port; no Shipment schema                                       | Customer/Shipment         | Invent vs bounded port             | Sync processing port with transaction-local domain adapter capability, no production handler until valid contract | Preserve existing business invariants | False success, mapping loss         | Mock processor explicitly test-only; FK/owner checks |
| UI                      | CarrierDataSyncDrawer, CarrierSyncPanels, Inspection, Select/TabBar                           | Web Carrier               | New page vs reuse                  | Generated SDK reads/actions, abort/generation guards, existing layout                                             | Keep approved presentation            | Stale results, fake data            | Component/real CDP and regressions                   |
| Runtime/tests           | apps/api image/context, init/grant scripts, Node discovery, owned PG launcher                 | Runtime                   | Third app vs entrypoint            | Nest application context, dedicated restricted credentials, no HTTP                                               | API independence                      | Startup, shutdown, privilege        | Actual Docker/process/PG and canonical CI            |

## 6. Alternatives and trade-offs

Owner selected PostgreSQL queue, one worker replica/bounded single executor and
completion-based scheduling. Redis/cron/event bus and continuous in-memory queue
are rejected. Retain source identity independently from payload; job items contain
references/versions only, not snapshots. No partial full-scan skipping. Query
projections do not hydrate aggregates. No speculative generic frameworks.

## 7. Modeling and ownership

Sync is a supporting technical capability, not Shipment aggregate. Pure policies
own closed statuses, valid source key/canonical JSON, versions/outcomes/retries;
the transaction boundary is job batch plus source/item/domain mapping. An extra
aggregate wrapper would not replace SQL consistency and is intentionally omitted.
Application ports own admission/config/query, provider page strategy and processor
orchestration. Infrastructure alone imports Prisma. Provider normalization owns
source field canonicalization; generic serialization must not trim/NFC identifiers.
Keys have scheme and character/UTF-8 bounds; hash indexes verify full key equality.
No Shipment UUID string without a real FK: defer shipment_id until actual Shipment
schema exists. Customer UUID FK is nullable and owner-verified; no Customer handler
is enabled without a valid provider-to-domain command contract.

## 8. Security/concurrency/performance

All writes lock ACTIVE user→epoch→owned connection→job, then sources/items/domain.
Claim-only SKIP LOCKED transaction ends before these locks. Each batch captures and
checks generation/lifecycle, lease version/expiry, connected status and execution
authorization before and immediately before commit. No network/crypto under locks.
Disable/delete invalidate jobs in their existing transaction; reactivate never
restores jobs. Delete sets nullable job connection FK null after cancellation;
source identity scope remains owner/provider/account/type/scheme/key, no transfer.
Atomic source/staging/item/checkpoint; bulk reads/upserts, no SELECT per source.
APPLYING checks exact source/processor version, resolves terminal item outcomes;
RETRYABLE_ERROR never advances watermark. NEEDS_REVIEW persists but does not block
completion after durable outcome. Unknown programming/database failures fail/retry
job, never reject source. Feature flags and supported-handler capability checked
before admission and execution. Logs/errors contain closed codes, never payloads.

## 9. Compatibility/schema

Additive five endpoints under existing session/Origin, strict DTOs, no-store and
owner predicates; bounded history/issues. SDK regenerated by canonical tooling.
Five main tables plus minimal technical shared budget; SQL CHECK/UNIQUE/FKs, no
enums. Historical migrations and rows unchanged. Payload retention is explicit,
disabled without configured policy; unresolved items never automatically removed.
Mapping/provenance do not cascade to domain or disappear with staging cleanup.
Worker uses separate least-privilege role, no credentials/admin volume, no public
port; API remains available with worker stopped. Public overlay stays private.

## 10. Verification-first/test-first

RED pure source keys/version/outcomes/strict-input tests before implementation.
Real PG: 20 admission requests→one job, composite keys, 10000→10005 records/30
items,99 APPLIED/1 review, checkpoint pre/post crash, expired lease, both disable
orders with barriers, hard delete, retention and processor upgrade. Mock provider
and domain evidence explicitly distinct from live integration. Runtime tests
verify independent process, non-root/no port, shutdown and restricted role; extend
existing owned cluster launcher, never shared clusters/volume resets. Run focused
then canonical format/lint/typecheck/unit/integration/contracts/docs/preflight/build,
Docker quality/runtime/data/dev/HTTPS and exact-head hosted workflows. Three
independent review rounds assess architecture, concurrency, API/UI/runtime.

## 11. Readiness

Pre-code inspection and independent read-only concurrency review completed
2026-11-02. Owner-selected architecture unchanged. No approval gate. Implementation
proceeds after this raw-byte snapshot is pinned in mutable task metadata.

## 12. PLAN ISSUES / bounded blockers

PROVIDER_CONTRACT: no authorized fetch schema/pagination/quota/retention contract in
repo. Finish ports/mock pipeline/API/UI, keep live capability unavailable and state
limitation; do not stop infrastructure or invent external calls.
DOMAIN_CONTRACT: no Shipment schema and no approved Customer sync mapping/actor
command. Finish transactional processing boundary/tests, no fake production domain
handler or System User. Do not declare Live Sync complete.
RETENTION_POLICY: no approved duration; cleanup only explicitly configured resolved
payloads, retaining unresolved records and independent identity metadata.
RESOURCE_CAPACITY: host filesystem nearly full; use owned RAM worktree/output and
genuine disposable PG where feasible; hosted Foundation remains mandatory evidence.
