# NEXORA-061 — FULL Sync Observation & Validation

Status: VERIFICATION PENDING
Capability: IMPLEMENTED
Verification: PARTIALLY VERIFIED

## Scope

PR1: durable per-page internal UUID observation, technical full-scan integrity,
summary and safe terminal cleanup for opted-in Uniship/SHIPMENT/FULL. No Missing
Reconciliation, Shipment visibility/state policy, soft delete/restore, API/UI/SDK,
Mapping V2/UTC+7/processor1 change, live traffic, registration or merge.
Integrity VALIDATED does not prove snapshot isolation or provider deletion semantics.

## Design Review & Reuse Decision

Task ID: NEXORA-061
Classification: SIGNIFICANT
Plan revision: rev-2026-11-22-observation-v3
Reviewed baseline: 776ea5f221af2a793ba0ef5f5af6b5ddcaaf71cf
Branch: feature/full-sync-observation-validation
Design Snapshot: docs/tasks/design-reviews/NEXORA-061-rev-2026-11-22-observation-v3.md
Design SHA-256: 8922c838280bad03e2d8c779ab79fcf903ec58a2ace4c9ddf06ea6d5d45bdd5e

| Field                    | Decision                                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component                | Seen-page persistence, technical integrity assessment, summary and terminal cleanup                                                                                                                               |
| Existing implementations | SyncRepository.page/fence/apply/cleanup; SyncPage/provider/capability registry; Uniship parser; sourceKey/canonicalPayload; worker loop; provision-runtime; migration/status/integration/signed launcher fixtures |
| Domain owner             | Sync technical infrastructure/provider semantics; explicit supporting-capability Aggregate omission, no Shipment business decision                                                                                |
| Reuse alternatives       | Extend current transaction/registry/cleanup versus parallel engine; UUID arrays/page versus per-identity rows; scalar job summary versus one-to-one table                                                         |
| Selected approach        | Arrays<=500 (actual Uniship100), PK(job,page), opt-in metadata; two extra set-based page statements and aggregate final assessment; existing job summary/lifecycle                                                |
| Rationale                | Observe unchanged/rejected sources without job_items, preserve exact ingestion/fences, bounded storage and no extra worker/framework                                                                              |
| Risks                    | Scope/account contamination, rollback, replay/lease loss, duplicate/total drift, retention-independent cleanup and grants                                                                                         |
| Verification             | RED/GREEN, genuine PG constraints/roles/migration/failure/races, existing regression,1k/10k/100k benchmark, quality/Docker/final-HEAD CI and independent review                                                   |

## Recorded implementation plan

1. Read-only inspection and frozen plan before tests/code. First commit closes merged060,
   preserves history and058 external gates; baseline matches owner's4708721.
2. RED metadata/decision and genuine PG observation tests; add minimal optional capability/
   page metadata, strict Uniship opt-in, backend-only status/reason vocabulary.
3. Forward migration/Prisma and worker SELECT/INSERT/DELETE grants; no API seen access.
4. Scoped UUID resolution/INSERT within existing page transaction; assess completed scan
   and save summary atomically with checkpoint. Preserve ingestion success on duplicates.
5. Existing success finalization and bounded terminal cleanup independent of retention;
   conservative incomplete summaries, no active age-based deletion, no retrospective PR2.
6. Full regression/failure/independent connection races, genuine role/status parity and
   legacy migration/repeat/drift. SQL microbench1k/10k/100k and query-plan/storage evidence.
7. Canonical docs, independent review, quality/available Docker and exact-HEAD hosted CI;
   open PR with exact five-line metadata, no merge/live activation.

## Contracts and invariants

The frozen snapshot specifies exact fields/vocabulary/precedence and SQL boundaries.
Provider fullScan contract and page scan metadata are optional for legacy providers;
actual Uniship declares them and cannot omit metadata. Scope fingerprint is computed
from trusted job scope and frozen static filter/scheme/pageSize. No source payload,
tracking/token/raw response is stored in seen-pages or diagnostic reasons.

Existing actor→epoch→connection→job→source locks, checkpoint and final lease fences
remain authoritative. INSERT never overwrites a committed page. New complete scan
may VALIDATE only inside explicit last-page transaction; failed/partial scans cannot.
Job status is independent: SUCCEEDED+UNTRUSTED remains valid safe ingestion.
Future reconciliation requires job SUCCEEDED AND scan VALIDATED and new post-PR2 jobs.
Seen UUID arrays are discarded after terminal summary, not historical backfill input.

## Documentation Impact

Documentation Impact: REQUIRED

### Changed facts

- New table/job summary, constraints/grants and temporary lifecycle.
- Capability metadata, technical cross-page assessment and retention-independent cleanup.
- Migration/role/failure/concurrency and performance verification;061 plan and060 closure.

### Canonical owners

- docs/architecture/database.md
- docs/architecture/sync-extensions.md
- docs/decisions/sync-worker-staging.md
- docs/integrations/uniship-portal-api.md
- docs/operations/testing.md
- docs/tasks/active/NEXORA-061-full-sync-observation-validation.md

### Documentation verification

- pnpm docs:check and pnpm preflight:check; frozen SHA/task/PR binding.

## Acceptance

- [x] AC01–03: every valid identity, including unchanged/rejected, atomically observed;
      failed identity/seen/checkpoint/summary rolls back page.
- [x] AC04–07: duplicates/total/count/gaps/terminal correctness; ingestion unaffected.
- [x] AC08–09: source scope and retry/replay/independent-worker fencing.
- [x] AC10–12: durable summary before bounded/idempotent terminal cleanup; active retained.
- [x] AC13–15: no domain visibility/API/UI/mapping/version/token/fence regression.
- [x] AC16: fresh/staged/repeat/drift, physical constraints and actual runtime roles.
- [x] AC17–18: canonical docs/governance, no production/live, independent review and CI.

## Verification plan and environment

Targeted units then API integration/migrations/contracts/preflight/docs/quality;
canonical quality-docker and approved signed launcher suites when safely available,
plus hosted Preflight/Sync Targeted/Foundation on exact HEAD. Test-only owned cluster,
no shared/user volumes or DB reset; native privileged suites never bypass launcher.
Initial host has only postgres17.11 image and about1.4GiB free; assess Docker build
availability honestly and record NOT RUN if resource blocked. No test weakening.

## PLAN ISSUES

NONE blocking. Resolved design conflicts and resource limitation are recorded in
snapshot §12. NEXORA-058 retains all external/live/time checks; NOT RUN here.

## Evidence

| Claim                        | Evidence                                                                                                                                                                                          | Date       | Result |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Baseline and merge confirmed | Original workspace97a6b6d; clean status; git fetch origin main =>4708721661b00781d0581840cca548a11e971ad5. gh API PR59 merged=true at2026-11-22T06:16:31Z. Task061 absent before branch creation. | 2026-11-22 | PASS   |
| Plan-first gate              | Read-only source/reuse/lock/role/test audit; formatted frozen snapshot SHA f776784cc62b8d6e570c27ec560f583a52b388c0a22f92d658aea82e85d7849b before code/tests/migration edits.                    | 2026-11-22 | PASS   |

## Implementation verification

[Executed verification and benchmark](../evidence/NEXORA-061/implementation-verification.md)
records local RED/GREEN/FAIL corrections, genuine207/207 integration,28/28 dedicated
observation cases,869/869 quality tests, role/catalog/migration/rollback/races and
1k/10k/100k measurements. Independent reviewer reports no open P1/P2/P3; canonical
Docker/signed launcher and exact-final-HEAD hosted verification remain pending.
Local Docker/native launcher is NOT RUN (VFS, absent tooling image, about0.5GiB
free); no shared/user data or verification gate was weakened. NEXORA-058 live gates
remain NOT RUN and production stays hard-closed.

| Claim                                                        | Evidence                                                                                                                                                                                                                              | Date       | Result |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Genuine observation integrity/rollback/fencing/cleanup/roles | Dedicated PostgreSQL suite28/28,0 skipped; two manual Uniship fixtures receive required scan metadata without changing business assertions. Full API integration207/207,0 skipped,254657.728082ms. Task working tree based on40aa955. | 2026-11-22 | PASS   |
| Schema preservation and grants                               | Real staged060→061 migration/repeat/drift PASS; physical validated exact code sets and native valid/invalid INSERTs; real nexora_sync/nexora_app credentials/obsolete ACL removal PASS.                                               | 2026-11-22 | PASS   |
| Full host quality                                            | pnpm quality PASS:869/869 tests, typecheck/contracts/build/format/lint/docs/preflight; unchanged public contract.                                                                                                                     | 2026-11-22 | PASS   |
| Independent review                                           | Read-only reviewer compared frozen plan/core/final diff, executed3/3 units and checked raw snapshot SHA/diff; no open P1/P2/P3. Hosted readiness still incomplete.                                                                    | 2026-11-22 | PASS   |

## Review delta v2 — bounded technical fingerprint

Independent review raised P2 after the initial no-finding review: v1 §7's blanket
crypto-outside-lock wording conflicted with bounded scope SHA-256 under locked
admission/page facts. No data/security/lock failure was found. The explicit v2
exception supersedes that blanket clause only for one deterministic fingerprint
of at most2048 UTF-8 bytes of trusted scope metadata, no secrets/KDF/I/O. Credential
crypto and bulk/untrusted payload hashing stay outside. Canonical ADR010/Sync docs
record this engineering clarification, not an invented owner approval.

The v2 snapshot is formatted and pinned before implementing the new byte guard/test.
No storage/port/transaction/authorization/mapping contract changes. Existing v1
CI on f7f0393 remains historical; v2 requires affected checks and new exact-HEAD CI.
P2 remains open until guard, regression, documentation and independent review pass.

### v2 executed review closure

P2 CLOSED by independent reviewer after4/4 units and40/40 actual PostgreSQL targeted
tests. Byte bound RED→GREEN; v2 quality870/870 PASS with unchanged contracts/build.
Canonical metadata exception is narrowly documented in ADR010; no credential crypto
is moved under locks. Earlier no-finding/open-P2 notes preserve review chronology.
Current exact-new-HEAD hosted checks remain pending; no earlier green is substituted.

| Claim                                 | Evidence                                                                                                                                                                                                                                                       | Date       | Result |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| v2 bounded fingerprint and P2 closure | Snapshot4afd3aa9bac8b5f23a9fff2c8431198558773d0d874e4a351292da152d3e3894 pinned before guard/test. Byte-bound unit RED→GREEN4/4; PostgreSQL40/40; quality870/870 including contracts/build. Reviewer independently verified4/4 and CLOSED P2; no open finding. | 2026-11-22 | PASS   |

## Hosted implementation acceptance — v2

V2 code776ea5f221af2a793ba0ef5f5af6b5ddcaaf71cf, actual merge checkout
0f96f0cf699a9e6c91dae33a225310f02a7d9f5b. Attempt1 PASS: Preflight45019834848,
Sync45019834852, Foundation45019834914/job137200056280, steps4–10. Actual
quality-docker and approved signed suites execute in Foundation; local Docker
NOT RUN remains a local environment fact. No live gate is promoted to PASS.

See [hosted code evidence](../evidence/NEXORA-061/implementation-verification.md#hosted-code-verification-and-v2-full-local-integration).
This supersedes earlier implementation-pending notes. Final evidence-only HEAD
and its own exact-HEAD CI are tracked separately in PR60 and are not inferred
from older code commits. Status remains active pending owner merge/§1.7 closure.

| Claim                            | Evidence                                                                                                                                                                                                                                              | Date       | Result |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ |
| Canonical hosted v2 verification | Source776ea5f221af2a793ba0ef5f5af6b5ddcaaf71cf; merge0f96f0cf699a9e6c91dae33a225310f02a7d9f5b. Preflight45019834848, Sync45019834852, Foundation45019834914/job137200056280 attempt1 PASS. Steps4–10 and actual quality-docker/signed suites execute. | 2026-11-22 | PASS   |
| Full local v2 PostgreSQL         | pnpm test:integration on committed776ea5f, signed task-owned PG17.11:207/207 PASS,0 skipped,186741.396384ms; private owned cluster removed afterward.                                                                                                 | 2026-11-22 | PASS   |

## Review delta v3 — query semantics and production resolver evidence

Owner findings on776ea5f: P2 confirmed independent HTTP filter/manual scope label;
P3 lacks EXPLAIN for UUID resolution (old plan measured seen-page read). Frozen v3
records single canonical immutable Uniship definition and derived scope token/query,
unchanged ports/SQL semantics/index/grants, RED/GREEN and mid-job drift regression.
Benchmark exact production resolver with5 warm-ups/30 samples and mixed scope noise;
no optimization without measured need. Documentation Impact REQUIRED. Historical v1/v2
PASS and review closure do not close these new findings. Corrective verification pending.

- [x] P2: same canonical query/scope, unchanged wire contract, semantic mutation/page
      invariance/isolation/UTF-8 and genuine mid-job rollback proof.
- [x] P3: exact1k/10k/100k resolver plans/index/buffers/p50/p95 and decision.
- [ ] v3 quality, independent review and exact-final-HEAD hosted CI.

### v3 local corrective closure

[Review remediation evidence](../evidence/NEXORA-061/review-remediation-v3.md):
P2 CLOSED after independent literal query/semantic mutation/page/Unicode tests and
genuine PG mid-job drift rollback. P3 CLOSED — NO CHANGE REQUIRED for resolver/index;
exact production SQL plans at1k/10k/100k and mixed scope,5 warm-ups/30 samples show
existing composite unique index serves larger cases. No performance SLA inferred.
Quality871/871 and full genuine API integration208/208,0 skipped PASS; migrations,
actual roles and governance regressions PASS. Independent reviewer has no open
P1/P2/P3. Exact corrective-HEAD hosted verification remains pending first push.
