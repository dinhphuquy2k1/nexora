# NEXORA-061 — FULL Sync Observation & Validation

## 1. Task metadata and classification

Task ID: NEXORA-061
Classification: SIGNIFICANT
Plan revision: rev-2026-11-22-observation-v2
Reviewed baseline: 4708721661b00781d0581840cca548a11e971ad5
Branch: feature/full-sync-observation-validation
Documentation Impact: REQUIRED

PR1 adds technical observation/validation only. PR59 merged at the reviewed baseline
on2026-11-22; close060 in the first commit, retain immutable history and058 live gates.
This snapshot contains design, not future verification claims. Format before hashing.

## 2. Requirements and explicit boundaries

Observe every valid identity returned by the actual Uniship FULL Shipment capability,
including unchanged, rejected and SoftDeleted-marked sources. Page/checkpoint/identity
writes and final scan assessment share the existing transaction/fence. Preserve valid
ingestion when identities repeat across pages: job SUCCEEDED may pair with UNTRUSTED.
No reconciliation, missing detection update, deletion/restore/visibility field, Shipment
state policy, UI/public API/SDK, mapping/timezone/processor upgrade, auth recovery,
new worker/queue/cache, live HTTP or production registry change. Integrity VALIDATED
is neither snapshot isolation nor evidence of upstream deletion semantics.

## 3. Canonical owners and inspection

Read AGENTS→AI README/context/rules/task/workflow/router, ADR007/008/009/010/011,
Database/Backend/Sync extension/Shipment/Uniship/Testing docs and active058/060.
Source inspection: SyncRepository.page/apply/fence/claim/wait/cleanup, sourceKey/
canonicalPayload, capability registry/resolver, worker loop, presenter allowlist,
Uniship provider/normalizer and real duplicate-page integration, Prisma models,
provision-runtime grants, migration harness, signed cluster launcher/role fixtures,
Sync targeted workflow. Searches include page, source identity, reported_total,
cleanup, retentionDays, lifecycle, lease, processor, sourceKey and runtime grants.

## 4. Mandatory reuse and design audit

| Field                    | Page observation                                                                            | Integrity assessment                                                 | Lifecycle / security                                                                  | Tests and delivery                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Component                | Durable seen-page                                                                           | Scope/count/continuity summary                                       | Terminal cleanup and grants                                                           | Migration/PG/CI                                                                                 |
| Existing implementations | sync-job.repository.ts page/fence/source UPSERT; SyncPage port; Uniship normalizer/provider | sourceKey/canonicalPayload/payloadHash; exact-pair registry          | Repository apply/wait/cleanup, worker loop, provision-runtime.mjs                     | migration.mjs, Sync/Uniship/Shipment integration, status-contract.cjs, approved signed launcher |
| Domain owner             | Sync technical infrastructure; provider owns source/filter semantics                        | Sync technical state, not Shipment Aggregate                         | Sync worker and existing role provisioner                                             | Owning packages and existing runners                                                            |
| Reuse alternatives       | Extend page transaction vs parallel ingestion                                               | Set-based SQL vs full-ID JS hydration / Shipment hydration           | Existing lifecycle vs new cleanup worker                                              | Extend current scripts vs new framework                                                         |
| Selected approach        | Two extra set-based statements (resolve all IDs, INSERT), no overwrite                      | One aggregate SQL query and a small deterministic decision function  | Existing success finalization and bounded terminal cleanup; SELECT/INSERT/DELETE only | Existing discovery and focused workflow; real PG/roles and compact benchmark                    |
| Rationale                | Includes identities absent from job_items and unchanged UPSERT RETURNING                    | Counts unique identities and rechecks scope without Domain hydration | Durable summary precedes cleanup, no active age-based deletion                        | No fake production handler, no duplicated engine                                                |
| Risks                    | Scope mix, failed page atomicity, replay                                                    | Duplicate/total drift mistaken for job failure                       | Lease expiry, cancellation and missing metadata                                       | Role password isolation, drift/parity and resource limits                                       |
| Verification             | Failure injection, unchanged/rejected/empty pages                                           | Full205/duplicates/count/gap/scope/terminal cases                    | Independent repos, stale/takeover, real credentials and races                         | Fresh/staged/repeat/drift; quality and exact final-HEAD CI                                      |

## 5. Alternatives and chosen storage

A UUID array per page stores at most500 internal UUIDs (actual Uniship100), one PK
entry/checkpoint page and no raw payload/provider IDs. A row per identity permits a
physical identity FK and efficient per-ID lookup, but multiplies rows/index maintenance
by100 for this write/read-by-job/cleanup workload. Select arrays as owner requested:
array references need explicit scoped resolution and a validation recheck, since an
array cannot carry element FKs. No GIN or additional index; PK(job_id,page_no) serves
job reads and FK cascade. Benchmark1k/10k/100k before any performance claim.

Add SyncJobSeenPage mapped sync_job_seen_pages: jobId UUID FK CASCADE/NO ACTION,
pageNo INTEGER>=1, sourceIdentityIds UUID[] NOT NULL, reportedTotal INTEGER>=0,
createdAt TIMESTAMPTZ(3) default now. PK(job_id,page_no). CHECK a one-dimensional,
one-based array (empty allowed), cardinality<=500 and no NULL elements. Uniship
normalizer continues rejecting within-page duplicates; repository also rejects them
for observation-enabled capabilities. Validator rejects duplicate IDs in stored data.

Add nullable scalar fields to sync_jobs, using camelCase Prisma @map fields:
scanIntegrityStatus VARCHAR16, scanIntegrityReason VARCHAR32, scanObservedCount INTEGER,
scanReportedTotal INTEGER, scanScopeFingerprint VARCHAR64. No backfill/default invented.
CHECK exact statuses/reasons, nonnegative counts, lowercase SHA-256 and coherent summary:
VALIDATED requires null reason, nonnull scope/total and observed=reported. Unassessed
summary is null; scope fingerprint may exist from admission. Terminal incomplete
summaries may have unknown reported total/scope. VARCHAR/CHECK, no enums.

## 6. Metadata and capability contract

Extend existing ports, not a new framework: optional readonly fullScan contract on
SyncProvider/SyncCapability has sourceKeyScheme, pageSize, scope. Registry validates,
copies and freezes it for the registered Uniship/SHIPMENT/FULL pair only. Providers
without opt-in keep existing behavior and null summaries. Actual Uniship provider
always opts in: scheme uniship-parcel-v1, pageSize100, scope UNISHIP_ECOMMERCE_V1
(documented as ecommerce=true, IsEcommerce=1, q empty; routes/order unchanged).

SyncPage adds optional scan metadata {pageNumber,pageSize,reportedTotal,scope,
sourceKeyScheme}; existing done is the terminal signal. Uniship parser emits the
validated envelope facts, including empty scan0. Repository requires exact metadata
shape for opted-in capability, checks integer bounds (total fits PostgreSQL INTEGER),
current page/size/scheme/scope, expected length and done/nextPage/no cursor/watermark.
Wrong/missing metadata uses existing SOURCE_INVALID, before any checkpoint write.
Scope fingerprint hashes canonical trusted owner/provider/account/type/FULL plus
frozen scheme/pageSize/scope; it is a consistency token, never an authorization secret.
Persist at admission; compare on every page. Old null metadata is never synthesized
from historical jobs; a preexisting active scan cannot become complete without page1.
No raw URL/filter secrets, payload, tracking code or user data enter diagnostics.

## 7. Transaction, ownership and DDD

This is an infrastructure supporting capability: explicit omission of a business
Aggregate; no Shipment command/hydration or ownership change. Existing actor→epoch→
connection→job→source lock order remains. HTTP/crypto remains outside locks.
Before SQL validate source keys with canonical sourceKey and scan metadata. Under
fence/checkpoint checks, retain identity UPSERT, resolve every page identity by full
owner/provider/account/type/scheme/hash/key, verify exact UUID cardinality/uniqueness,
INSERT seen-page then retain staging/items. Plain INSERT/ON CONFLICT DO NOTHING plus
checked RETURNING rejects a conflicting PK; never UPDATE a committed page. Existing
checkpoint/lease protocol rejects committed replay and stale workers. Retry after
rollback inserts the uncommitted page; takeover resumes the committed next_page.

On final page, aggregate all seen-pages under the job lock, then save summary in the
same transaction as existing checkpoint/phase update. Failed resolve/insert/summary/
checkpoint/final lease rolls back the entire page. No secondary transaction.

## 8. Assessment and canonical vocabulary

Backend-only Sync constants own statuses VALIDATED, INCOMPLETE, UNTRUSTED and reasons
MISSING_SCAN_METADATA, SCOPE_MISMATCH, TOTAL_MISMATCH, DUPLICATE_IDENTITY, PAGE_GAP,
MISSING_TERMINAL_PAGE, COUNT_MISMATCH. No shared/browser contract is invented.

One set-based aggregate reads pages and unnested UUIDs, counts pages/min/max, distinct
reported totals, distinct identities, observations and scope mismatches via a scoped
LEFT JOIN. A pure decision function uses fixed precedence: missing metadata; scope;
total drift; duplicate identity; page gap; missing terminal; count mismatch; VALIDATED.
Scope/total/duplicate/count inconsistency is UNTRUSTED; missing metadata/pages/terminal
is INCOMPLETE. Empty page1/total0 can VALIDATE. Only explicit final-page transaction
may validate a scan; cleanup never reconstructs VALIDATED from phase/checkpoint alone.
These are scan outcomes, not new Sync job errors. Existing accepted cross-page
ingestion remains SUCCEEDED, idempotent and has one Shipment per source.

## 9. Summary lifetime and cleanup

Final FETCHING summary persists while APPLYING. Future PR2 must require final job
SUCCEEDED AND scan VALIDATED, never integrity alone. FAILED/CANCELLED after completed
fetch may retain its technical assessment but are not reconciliation-eligible.
Success finalization ensures a durable assessment, marks SUCCEEDED, then deletes its
seen-pages in the existing transaction. No destructive missing/restore policy occurs.

Existing cleanup first handles terminal observations independently of retentionDays:
lock at most20 terminal jobs (job-only locks, SKIP LOCKED, no later authorization
locks); if summary absent, persist conservative incomplete assessment; delete at
most500 seen-pages per call. Preserve summary across partial/idempotent cleanup.
Process stamped terminal jobs without pages too. QUEUED/RUNNING/WAITING never age out.
Then retain current bounded provider payload-retention behavior. Return total rows
removed. Existing cancellation writers need no new table privilege; worker cleanup
handles detached/cancelled jobs. Job deletion cascades. No new cleanup worker/index.
PR2 uses new jobs after reconciliation is implemented, not retrospective deleted arrays.

## 10. Security, migration and compatibility

Forward migration only; preserve all historical rows and old migrations. Worker gets
SELECT/INSERT/DELETE on seen-pages, no UPDATE/TRUNCATE/DDL; API gets none. Existing
job grants and explicit public presenter remain; no public metadata field is added.
Verify real nexora_sync/nexora_app credentials, role denials, PK/FK/CHECK/catalog
status parity with conkey/convalidated and mutation sensitivity. Add staged upgrade
from exact060 schema, null historical metadata, preservation/repeat/drift coverage.
Generic max500 and non-observation providers are unchanged; Uniship max100 and all
Mapping V2/UTC+7/processor1/identity/token/fences remain. Production registry empty.

## 11. Test and performance plan

RED direct metadata/assessment tests before helpers exist; RED genuine seen-table
checks before migration. Functional real PostgreSQL:100,205,last1,empty,unchanged,
new/rejected/SoftDeleted identity presence; no job_items dependency; duplicate/total/
count/gap/scope/terminal checks; ingestion SUCCEEDED with untrusted duplicates.
Inject identity/seen/summary/checkpoint failures and verify whole-transaction rollback.
Independent repos exercise stale lease, expiry, takeover, page2 retry, committed replay,
concurrent page, disable/delete/generation/lifecycle; terminal/active cleanup races,
old active data retained, retention-off cleanup, cascade/idempotency. Preserve existing
Sync/Shipment/Uniship/generic security regressions, changing only new metadata assertions.

New dedicated observation integration runs through existing API discovery. Extend
Sync Targeted path filters and its existing signed Uniship fixture step to include
this suite (same private password/cluster signature); retain all prior commands.
Approved signed launcher suites remain canonical for native role scripts; never
call them outside launcher protocol. New role assertions run on real credentials.
Measure1k/10k/100k source IDs/10/100/1000 pages: actual observation helper incremental
SQL latency/statement count, aggregate validation, EXPLAIN job read, scoped logical
bytes, cleanup. No latency gate/index invented; distinguish SQL microbenchmark from
end-to-end provider/engine throughput. Keep only curated results, not logs/media.

Run relevant units/integration/migrations/contracts/docs/preflight/quality and canonical
quality-docker where safely available. Current host has only PostgreSQL image and
about1.4GiB free; assess owned project/build resources, no user-volume cleanup or
unrelated image deletion. Hosted Foundation runs canonical Docker plus signed role
suites and runtime checks. Missing local capability is NOT RUN, never PASS. Independent
review after implementation must cover scope, locks, grants, atomicity, retention,
privacy and compatibility. Exact final HEAD/merge checkout/run/attempt evidence required.

## 12. Readiness and PLAN ISSUES

Design ready2026-11-22. No owner approval gate; no unresolved product decision.
Resolved issues: opt-in metadata preserves synthetic providers; actual Uniship cannot
silently opt out; ingestion success and integrity are independent; API presenter
prevents new wire exposure; payload retention cannot gate observation cleanup;
array element scope requires explicit resolution/assessment; legacy summaries stay null.
Resource availability is a verification limitation, not permission to weaken tests.
A material design change requires a new frozen revision before implementation.

## Revision v2 — bounded metadata fingerprint clarification

Independent implementation review found P2: v1's blanket outside-lock crypto sentence
conflicted with application SHA-256 of the small trusted scope tuple under admission/
page locks. This is a plan-contract clarification, not a claimed owner attestation.
Keep v1 immutable and retain its historical execution. This v2 is frozen before
implementing the bounded preimage guard and regression.

Selected exception: a single synchronous deterministic SHA-256 over at most2048
UTF-8 bytes of trusted owner/provider/account/type/FULL and frozen scope/scheme/size
metadata may execute under the existing Sync locks. Enforce the byte bound before
hashing and use only the existing canonical payload/hash implementation. No network,
random input acquisition, file IO, secret/ciphertext input, Scrypt/KDF, credential
encryption/decryption or provider response/payload hashing is allowed by this exception.
Credential crypto and bulk/untrusted payload hashing remain outside locks. A too-large
preimage fails SOURCE_INVALID and cannot publish observation/checkpoint state.

Rationale: hash the actual locked immutable scope facts without adding an unrelated
pre-read/recheck query or splitting admission across transactions. Bounded technical
metadata work does not alter lock order, authorization or lease protocol. Canonical
ADR010 and Sync extension docs record this narrowly scoped dated engineering decision.
No schema, metadata shape, scope contents, public contract, lifecycle or ingestion
behavior changes. Add a unit regression for the byte bound, rebuild/targeted real PG,
rerun affected quality/docs/preflight and require exact-new-HEAD hosted gates.
All v1 requirements and non-goals remain. P2 closes only after guard/docs/review proof.
