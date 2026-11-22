# NEXORA-061 — implementation, verification and independent review

Date2026-11-22 (Asia/Ho_Chi_Minh). Reviewed baseline/main4708721661b00781d0581840cca548a11e971ad5;
initial workspace HEAD97a6b6d6f7928431f0b5fabdf78fc8c39ef976af was clean. New branch
feature/full-sync-observation-validation starts at4708721. First commit40aa955
closes merged060 and records the plan before tests/code. Local results below execute
the task working tree on40aa955, not the unchanged baseline alone. Implementation
commit and exact hosted source/merge/run/attempt evidence are recorded at delivery.

Snapshot rev-2026-11-22-observation-v1 raw SHA-256:
f776784cc62b8d6e570c27ec560f583a52b388c0a22f92d658aea82e85d7849b.
The initial implementation used v1. Later independent review required the bounded-fingerprint contract clarification in v2 below. Old snapshots/migrations/captures remain.

## Implemented boundaries and data integrity

- Optional frozen capability fullScan and required actual Uniship page metadata;
  old providers keep max500/null summaries, actual Uniship100/page. Fingerprint is
  scoped metadata, never an authorization/snapshot/deletion guarantee.
- One UUID-array page row (PK job/page, FK cascade, bounds/no-null/dimension checks),
  five nullable job scalar fields, no historical backfill. No extra index beyond PK.
- Two set-based observation statements after identity UPSERT: full-key/scope UUID
  resolution, INSERT without overwrite. No use of job_items to infer seen identities.
  Final assessment is one aggregate query; summary piggybacks the existing checkpoint
  UPDATE. Identity/seen/staging/summary/checkpoint/final lease remain one transaction.
- All identities are observed, including unchanged/rejected/SoftDeleted-marked rows.
  Cross-page duplicate/total drift are integrity anomalies, not ingestion failures.
  Existing actual Uniship duplicate scenario stays SUCCEEDED with one Shipment/source.
- Summary lasts beyond terminal cleanup. Success removes its arrays in the same
  finalization transaction; existing cleanup handles at most20 terminal jobs/500
  pages independently of payload retention, never active data by age. Partial cleanup
  preserves summary. FAILED/CANCELLED are not successful scans for future PR2,
  including when a completed FETCHING phase already assessed VALIDATED.
- Worker gets only SELECT/INSERT/DELETE on seen; API none. Existing job permissions/
  explicit public presenter remain. Native actual credentials, obsolete ACL removal,
  grants/denials, catalog status membership/mutations and real invalid writes execute.
- Existing Sync/Shipment engine, lock order, Mapping V2, UTC+7, processor1, token
  lifecycle, public API/SDK/UI, source-key/attribute schema and production gates stay.

## Executed local commands

Pinned package manager10.34.6, Node24.22.1, Linux x64,2 available CPUs
(AMD EPYC9V74); owned PostgreSQL17.11-bookworm. Private loopback random-port cluster
is task-labelled/signed and uses tmpfs data. Credentials stay in private files;
only its own UUID databases/roles/rows are created. No shared database/volume reset.

| Command / verification                                                                                          | Result | Executed evidence                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New observation unit before implementation                                                                      | RED    | Module absent; test exit1 before helper/code existed                                                                                                                  |
| Real PostgreSQL seen-table requirement before migration                                                         | RED    | to_regclass cast to text returned NULL; assertion exit1                                                                                                               |
| pnpm --filter @nexora/database build; pnpm --filter @nexora/api build                                           | PASS   | Real Prisma generation and TypeScript compilation                                                                                                                     |
| node --test apps/api/test/sync/\*_/_.test.cjs apps/api/test/uniship/\*.test.cjs                                 | PASS   | 52/52 before the additional registry unit; final quality includes all3 new units                                                                                      |
| node --test apps/api/test/sync/full-scan-observation.test.cjs                                                   | PASS   | 3/3 metadata/assessment/actual opt-in/registry freeze/legacy compatibility                                                                                            |
| node --test integration/sync-observation-integration.test.cjs                                                   | PASS   | 28/28, zero skips, includes roles/schema/failure/lease/resolution/benchmark                                                                                           |
| node --test integration/sync-observation-integration.test.cjs integration/uniship-shipment-integration.test.cjs | PASS   | 39/39 at prior27-observation revision; protected existing business assertions                                                                                         |
| pnpm test:integration                                                                                           | PASS   | 207/207, zero skips,254657.728082ms; all final observation/Sync/Shipment/Uniship/Identity/Carrier cases                                                               |
| pnpm --filter @nexora/database test:migrations                                                                  | PASS   | Exact060 staged upgrade, preserved original rows, NULL old scan fields, empty seen table, repeat deploy and schema drift                                              |
| pnpm quality                                                                                                    | PASS   | format/lint/preflight/docs/typecheck/test/contracts/build;869/869 root tests (scripts182/API274/Web368/shared2/UI37/database6), zero failures; contracts reproducible |
| pnpm test:docs; pnpm test:preflight; pnpm test:lint                                                             | PASS   | 10/10,24/24 and56/56 respectively; canonical docs/preflight/format rechecked after task/evidence metadata changes                                                     |
| Independent reviewer focused execution                                                                          | PASS   | 3/3 current observation units; diff--check and frozen SHA match                                                                                                       |

Exact timed benchmark output below was emitted2026-11-22T11:28:17–11:28:23Z.
Other local gates execute during the same task session; source is the reviewed
working tree and final hosted verification must bind committed bytes.

## Historical failures and corrections

- First DB probe used unsupported native regclass type; cast to text before the
  intended absent-table RED. First new catalog test similarly needed char→text;
  the full functional/race/role path had already passed. No production behavior fix.
- Initial lint found unused test imports and a missing globalThis qualifier; fixed.
- Initial full integration203 tests had199 PASS/4 FAIL (two actual leaf failures
  and their enclosing tests): two existing Uniship fixtures manually built pages
  without the new required metadata. Add scan metadata only, retaining all original
  child/rollback assertions and strict production validation. Re-run207/207 PASS.
- New repeat-ACL test initially omitted its private admin URL; fixture fixed, actual
  role credentials/repeat provisioning subsequently PASS. No privilege widening.
- Runtime migration-count oracle17→18 is required by the new migration; its
  stored_files=0 assertion remains. Existing timeouts/security assertions stay.

## Performance — real SQL microbenchmark

The benchmark bulk-prepares only owned synthetic identities/seen-pages. It measures
actual production observation helper statements inside rollback transactions, the
actual aggregate validator, actual job-read EXPLAIN ANALYZE, size and actual bounded
cleanup. Five helper samples/dataset; no HTTP, full ingestion throughput or SLA claim.
The host also ran quality/integration work concurrently, so timings are not isolated
production capacity measurements. No threshold or new index was inferred.

| Identities / pages | Extra statements/page | Helper p50 / max ms | Validation ms | Scoped logical bytes | Physical relation bytes | Cleanup ms / calls | Job read plan / ms |
| ------------------ | --------------------- | ------------------- | ------------- | -------------------- | ----------------------- | ------------------ | ------------------ |
| 1,000 /10          | 2                     | 10.284 /34.214      | 5.906         | 16,800               | 155,648                 | 6.621 /1           | Seq Scan /0.006    |
| 10,000 /100        | 2                     | 10.651 /19.425      | 21.493        | 168,000              | 368,640                 | 6.625 /1           | Seq Scan /0.029    |
| 100,000 /1,000     | 2                     | 92.218 /175.929     | 352.939       | 1,680,000            | 2,514,944               | 17.165 /2          | Seq Scan /0.141    |

Each isolated benchmark job covers nearly the whole currently populated seen table,
so the planner chose sequential scan; no forced plan or GIN is justified. PK(job,page)
remains the only index. Logical bytes are scoped rows; physical relation includes
prior/dead tuples/index storage and is not attributed solely to live rows.

## Local environment limits and canonical hosted requirement

Local `sh scripts/quality-docker.sh` and native approved launcher execution: NOT RUN.
The Docker engine uses VFS, only postgres image is installed, nexora-dev is absent,
and free workspace capacity fell from1.4GiB to about0.5GiB after host builds. Building
all canonical tooling/runtime layers here cannot be treated as safely available.
No user images/volumes are removed to make room, and no alternate native script is
called to bypass signed launcher rules. This limitation is not a local Docker PASS.

The existing Foundation workflow must execute the real quality-docker command,
approved signed launcher suites and runtime steps on committed HEAD. The existing
shipment-worker launcher now executes Shipment then observation suites sequentially,
protecting the original timed Shipment capacity test from benchmark contention.
Sync Targeted runs the signed observation and Uniship suites with its existing
private password/signature fixture. Unsigned ordinary contexts explicitly report
restricted-role verification NOT RUN; signed executions provide actual role proof.

## Independent implementation review

Existing independent reviewer read the diff against40aa955/frozen plan and core
queries, locks, constraints/grants, metadata, cleanup, compatibility, tests and docs;
independently executed3/3 units and checked snapshot/diff integrity. It read executed
migration,207-integration and successful quality output. No open P1/P2/P3 finding.
It explicitly withholds final readiness until canonical Docker/signed and exact-HEAD
hosted evidence exists; self-review is not represented as independent approval.

## PR2 boundary

Future reconciliation requires a new reviewed capability and final job SUCCEEDED
AND scan VALIDATED. Old temporary UUID arrays are deleted; PR2 starts with new FULL
jobs and may assess compatible permitted durable summaries, never reconstruct
historical seen sets. No missing streak, hidden/deleted field, soft delete, auto
restore, Shipment anti-join update, UI/endpoint, production registration or live
Uniship traffic has been implemented or activated by PR1.

## Review v2 — bounded metadata fingerprint

Current plan revision: rev-2026-11-22-observation-v2. Frozen snapshot
NEXORA-061-rev-2026-11-22-observation-v2.md SHA-256
4afd3aa9bac8b5f23a9fff2c8431198558773d0d874e4a351292da152d3e3894.
It was formatted/pinned with updated Task metadata/docs/preflight before changing
the guard or test. v1 remains immutable with its original SHA and execution history.

A later independent pass raised P2 after the initial no-finding pass: the blanket
crypto-outside-lock sentence conflicted with SHA-256 of the small trusted scope
tuple under locks. No data/security/lock problem was found. Selected clarification
allows only a synchronous deterministic fingerprint of <=2048 UTF-8 bytes of
trusted metadata; excludes secret/ciphertext inputs, KDF/Scrypt, credential crypto,
provider payload hashing and IO. ADR010 and Sync docs explicitly record this scoped
engineering decision, not an invented owner attestation. No pre-read/query/lock order,
schema or port change was needed. The v2 addendum supersedes v1's blanket clause.

New byte-bound regression was RED (missing expected exception), then GREEN4/4.
The helper checks Buffer.byteLength before canonical payloadHash; multibyte overflow
rejects SOURCE_INVALID, while valid Unicode metadata remains accepted. Actual
Observation+Uniship PostgreSQL v2 PASS40/40; full v2 quality PASS870/870
(API275, scripts182, Web368, shared2, UI37, database6), contracts/build included.
Full207 integration and staged/repeat/drift above verify the unchanged storage/engine
implementation; exact v2 hosted suites additionally bind the committed guard.

Independent reviewer rechecked docs/guard/test alignment and both raw snapshot SHAs,
executed4/4 units, read40/40 PostgreSQL output, and explicitly CLOSED P2. No finding
remains open. Final hosted verification is still required; v1 CI is not substituted.
