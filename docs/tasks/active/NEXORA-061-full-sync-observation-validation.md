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
Plan revision: rev-2026-11-22-observation-v1
Reviewed baseline: 4708721661b00781d0581840cca548a11e971ad5
Branch: feature/full-sync-observation-validation
Design Snapshot: docs/tasks/design-reviews/NEXORA-061-rev-2026-11-22-observation-v1.md
Design SHA-256: f776784cc62b8d6e570c27ec560f583a52b388c0a22f92d658aea82e85d7849b

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
- [ ] AC17–18: canonical docs/governance, no production/live, independent review and CI.

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
