# NEXORA-061 — Query-bound FULL scan scope and resolver evidence

## 1. Task metadata and classification

Task ID: NEXORA-061
Classification: SIGNIFICANT
Plan revision: rev-2026-11-22-observation-v3
Reviewed baseline: 776ea5f221af2a793ba0ef5f5af6b5ddcaaf71cf
Branch: feature/full-sync-observation-validation
Documentation Impact: REQUIRED

Corrective work on PR60. Immutable v1/v2 remain historical; this revision changes
only provider scope representation and performance verification, not business scope.

## 2. Requirements and boundaries

Bind actual Uniship HTTP dataset semantics to the admitted scan fingerprint.
Measure production UUID resolution at1k/10k/100k identities,100 per page. Preserve
HTTP wire contract, Mapping V2, processor1, UTC+7, production registry and scheduling.
No reconciliation, deletion/restore, Shipment API/UI/SDK, schema, grants, retry,
timeout, queue, cache or generic query framework changes. No merge/live activation.
All v2 observation, transaction, cleanup and bounded-hash requirements still apply.

## 3. Canonical owners

Read AGENTS and AI routed context/rules/task/workflow/router, ADR009/010, Database,
Sync extensions, Uniship integration, Testing and active061/v1/v2/evidence. Update
Sync extensions, Uniship integration, Testing, task and curated evidence together.

## 4. Read-only inspection and root causes

Inspection searched fullScan, scope, scanScopeFingerprint, recordScanPage, EXPLAIN,
source_key_scheme, source_key_hash across provider, normalizer, registry, repository,
ports, tests, benchmark and Prisma schema. Current uniship-full-scan.ts has an
independent label; provider constructs HTTP filters separately. P2 is confirmed:
changing the latter need not change the label. P3 is an evidence gap, not yet a
performance defect: benchmark explains seen-page reads, not identity resolution.
The existing six-column scoped unique index is a candidate, not an assumed fix.

## 5. Mandatory reuse audit

| Field                    | Provider scope                                                                                                         | UUID resolution measurement                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Component                | Canonical Uniship FULL definition                                                                                      | Exact resolver SQL benchmark                                                                                        |
| Existing implementations | uniship-full-scan.ts, uniship-shipment.provider.ts, UNISHIP_ROUTES, canonicalPayload/payloadHash, scanScopeFingerprint | sync-scan-observation.ts recordScanPage, sync-observation-benchmark.cjs, source identity scoped unique index        |
| Domain owner             | Uniship infrastructure semantics, Sync technical token                                                                 | Sync infrastructure supporting capability                                                                           |
| Reuse alternatives       | Extend provider-specific helper vs generic framework or manual version bump                                            | Tiny shared parameterized SQL expression vs duplicated benchmark SQL                                                |
| Selected approach        | Copy/freeze canonical definition; derive query and hashed scope; retain three-field FullScanContract                   | Reuse exact resolver expression in production and EXPLAIN; unchanged predicates                                     |
| Rationale                | One source of truth, fixed token size, unchanged wire behavior                                                         | Avoid SQL drift, measure before optimizing, two statements/page                                                     |
| Risks                    | Independent defaults, mutable nested filters, page accidentally hashed, old admitted scans                             | Unrepresentative warm cache, global counts, driver overhead confused with SQL                                       |
| Verification             | Independent literal HTTP expected values, mutation matrix, page invariance, mid-job fail-closed PG                     | Warm-up and30 measured samples, real PG plans/buffers, mixed owner/account/scheme input, indexed scope verification |

## 6. Alternatives and trade-offs

Reject a manual scope version bump: still permits silent semantic drift. Reject a
new generic query-builder or port expansion: one provider needs a small pure helper.
Choose scope = existing payloadHash(canonicalPayload(copied immutable definition)).
The definition includes endpoint, ecommerce, ordered filter clauses, q, pageSize,
sourceKeyScheme, FULL strategy and semantic version. Request(page) uses that same
owned definition. Page is dynamic and excluded. Hash static definition at module
initialization outside locks; scope token is64 hex characters. Filter order remains
significant conservatively. No token, response, time, URL origin or secrets enter it.

## 7. DDD and selected design

Technical supporting capability, explicitly no new Aggregate or Shipment decision.
Keep FullScanContract and exact five-field page metadata unchanged. Registry captures
immutable contract as before. Normalizer uses derived production contract. Provider
uses definition's endpoint/query/pageSize/strategy. Pure factory supports tests with
alternative definitions without mutating production. Generic scanScopeFingerprint
continues binding owner/provider/account/type/FULL/scheme/pageSize/scope and enforcing
2048 UTF-8 bytes before one bounded hash under existing locks. No heavy crypto/IO.

## 8. Security, concurrency and performance

Actor→epoch→connection→job→source lock order, authorization, UPSERT, lease and final
checkpoint fences unchanged. Different scope between admit and page fails SOURCE_INVALID
before writes; do not backfill or silently relabel historical/in-flight scans.
Retain parameterized resolver SQL, full key/hash check and two statements per page.
Benchmark exact query using EXPLAIN ANALYZE BUFFERS JSON, collect estimates/actuals,
loops, filter removals, index and hits/reads without exporting predicates or secrets.
Warm up5, sample30; report helper and driver/transaction timing separately from
server execution time. Measure1k/10k/100k plus mixed scope noise and verify100 results.
No SLA/CI timing threshold. If existing plan is sound, NO CHANGE REQUIRED for query/
index. Any evidence-driven optimization needs before/after and renewed impact review.

## 9. Compatibility

No migration, schema, grant, public API/SDK/shared vocabulary or production capability
changes. Existing admitted fingerprints use old representation and intentionally fail
closed with new contract rather than mix scopes. There is no live opt-in. Preserve
captured fixture bytes/digests, immutable plans and all historical measurements.

## 10. Verification-first plan

1. RED new semantic mutation/page invariance/immutable factory tests before implementation.
2. GREEN same tests plus independent literal HTTP contract, normalizer, UTF-8 guard.
3. Genuine PostgreSQL mid-job scope change rollback, existing fencing/replay/Uniship/
   observation integration and actual restricted-role tests through signed context.
4. Expand benchmark using exact shared resolver SQL and evidence metrics; no guessed index.
5. Migration validation, quality/contracts/full integration, available canonical Docker/
   signed checks; NOT RUN with concrete blocker when unavailable, never reset user data.
6. Independent real reviewer, exact-final-HEAD hosted Preflight/Sync/Foundation evidence,
   PR five-line metadata and no merge. Preserve historical PASS as historical only.

## 11. Readiness

Plan recorded2026-11-22 before corrective code/tests. Material change is derived scope
representation; freeze v3 after formatting and pin raw SHA in task/PR. No owner approval
required. Current v2 implementation verification is historical, not v3 completion.

## 12. PLAN ISSUES

NONE blocking. Local Docker tooling/disk may constrain canonical execution; record
honestly and obtain hosted proof. Benchmark uses disposable synthetic data and warm
cache, never claims production representativeness. No implementation delegation;
independent reviewer is read-only.
