# NEXORA-061 — PR60 review remediation v3

Date2026-11-22 (Asia/Ho_Chi_Minh; measurements2026-11-22T16:14:48–16:14:57Z).
Reviewed source/remote HEAD776ea5f221af2a793ba0ef5f5af6b5ddcaaf71cf; PR60 open,
branch feature/full-sync-observation-validation. Local results below execute the
corrective v3 working tree based on that HEAD, not old code. Hosted committed source/
merge/run/attempt proof is recorded separately. V1/v2 snapshots and evidence retained.

## Plan-first and P2 cause/fix

P2 is confirmed: old scope UNISHIP_ECOMMERCE_V1 and provider's separately hardcoded
query could drift independently. Frozen v3 records the material representation change
before corrective code/tests; formatted raw SHA8922c838280bad03e2d8c779ab79fcf903ec58a2ace4c9ddf06ea6d5d45bdd5e
is pinned in task and PR's five-line metadata via gh api. No new task/PR/approval gate.

One Uniship-specific helper copies/freezes the definition, nested filters and clauses.
Definition includes endpoint/ecommerce/filter column-value-condition/q/pageSize/scheme/
strategy/version. Existing canonicalPayload/payloadHash produces the64-hex scope at
module initialization outside locks. request(page) derives actual wire query from
the same owned definition. The dynamic page is excluded, and returned URLSearchParams
cannot mutate the next request or scope. Generic scoped job hash retains its2048-byte
UTF-8 guard before hashing under the existing locks. No secrets/response/time enter it.

Example with unchanged descriptive version: IsEcommerce1 gives scope
9a5147468d93e8d65315a11e0763633f566adfe7191b71a04ee50e7aa27ab81a;
IsEcommerce0 gives e59207b57c7a522a216cad4d87131d421f08e042acf371cb9a56a10ede6a980f.
Page1/page2 keep the first token. No HTTP contract, schema, migration, grant, port
shape, processor1/Mapping V2/UTC+7, production registry, scheduling or Shipment API/UI
change. Existing admitted old scopes intentionally fail closed, never silently relabel.

## Executed RED/GREEN and failures

- RED: node --test apps/api/test/sync/full-scan-observation.test.cjs:4 PASS/1 FAIL,
  new canonical semantics case fails `defineUnishipFullScan is not a function`.
- GREEN: observation/provider/normalizer16/16 PASS, no skips; independent literal
  HTTP endpoint/query decoding checks exact one filter and five query parameters.
  Semantic matrix covers value/condition/column/additional filter/q/ecommerce/endpoint/
  pageSize/scheme/strategy/version, job owner/provider/account/type isolation,
  page invariance, deep defensive freezing, and ASCII/multibyte UTF-8 limits.
- Genuine PG mid-job drift PASS: commit first100/101, admit a second repository with
  added SoftDeleted0 filter, pass valid changed metadata for page2, receive
  SOURCE_INVALID and identical persisted job/seen/identities plus100 staged items.
  Original contract commits page2 under unchanged lease/checkpoint and VALIDATES.
- First targeted Sync+Uniship+observation run:100/102 PASS. Only new benchmark catalog
  query failed on Prisma's unsupported PostgreSQL name[] deserialization (leaf and
  enclosing case); cast catalog names to text/text[]. All existing business/fencing
  tests and new mid-job test had passed. No production behavior weakened.
- Earlier corrective build caught endpoint type widening; preserve literal route
  through the provider-specific factory's Endpoint generic. Subsequent build PASS.
- Initial quality failed only the new page-query test's unqualified URLSearchParams
  under no-undef; use globalThis.URLSearchParams, retaining both assertions.
- Corrected isolated signed observation run29/29 PASS,0 skipped,24427.929733ms.
  Actual runtime-role/catalog/rollback/cleanup/race assertions execute, not static
  or privileged-only substitutes. Full regression/quality results are tracked below.

## P3 — exact production UUID resolver

Decision: **NO CHANGE REQUIRED — evidence verified** for resolver predicates/algorithm
and indexes. The only production SQL edit extracts the identical parameterized
expression into scanIdentityResolutionQuery, shared by recordScanPage and EXPLAIN.
No new index, per-identity driver call, grant, cache or schema change. Still exactly
two extra SQL statements per page (resolve100 then INSERT one UUID array). Nested
loop's100 index probes are internal to one set-based SQL statement, not N+1 calls.

Environment: owned signed disposable PostgreSQL17.11 (Debian), host Node24.22.1,
Linux x64, AMD EPYC9V74,2 available CPUs. Isolated observation-suite run without
simultaneous quality/other integration suites. Synthetic data only, warm-cache,
ANALYZE both source-identities and seen-pages,5 discarded warm-ups and30 timed
rollback transactions per scenario. All100 identities resolve through real worker
credentials. Existing functional identities remain; global populations below make
that explicit. Mixed case adds30k identical-key/hash rows across other owner,
account and source-key scheme. Historical timings remain unchanged and are not a
controlled before/after: workload, statistics and contention differ. No code speedup
or production SLA is inferred. No cold-cache/production throughput claim.

The shared SQL retains all owner/provider/account/type and scheme/key/hash predicates
and jsonb_to_recordset input shape. EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) runs the
exact expression with the same100-input builder through the worker role. Plans below
are curated: predicates/account values/UUIDs/raw SQL are not exported.

Existing indexes inspected in the genuine catalog:

- sync_source_identities_pkey: unique(id).
- idx_sync_source_identities_customer: nonunique(customer_id).
- sync_source_identities_owner_user_id_provider_external_acco_key:
  unique(owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key_hash).

### Timings and total page cost

Helper contains JSON/SQL construction, both driver statements and UUID validation;
transaction includes BEGIN/ROLLBACK/driver overhead. Transaction-minus-helper is
computed per sample before percentiles, not by subtracting two percentiles. Per-query
driver values include server/transport and are not pure SQL time. Server EXPLAIN
execution/planning is a separate instrumented sample, not a p50/p95 estimate.

| Target / noise | Global rows | SQL execution / planning ms | Helper p50 / p95 ms | Resolve driver p50 / p95 ms | INSERT driver p50 / p95 ms | Transaction p50 / p95 ms | Transaction-minus-helper p50 / p95 ms |
| -------------- | ----------- | --------------------------- | ------------------- | --------------------------- | -------------------------- | ------------------------ | ------------------------------------- |
| 1000 / 0       | 2822        | 0.566 / 0.085               | 1.929 / 2.739       | 1.242 / 1.687               | 0.651 / 0.941              | 2.647 / 6.359            | 0.613 / 1.075                         |
| 10000 / 0      | 12822       | 0.488 / 0.089               | 1.822 / 2.312       | 1.158 / 1.572               | 0.581 / 0.798              | 2.414 / 2.929            | 0.555 / 0.807                         |
| 100000 / 0     | 112822      | 0.614 / 0.088               | 2.028 / 4.026       | 1.289 / 3.014               | 0.621 / 1.218              | 2.646 / 23.323           | 0.588 / 8.575                         |
| 100000 / 30000 | 242822      | 0.565 / 0.089               | 2.243 / 2.813       | 1.446 / 1.722               | 0.695 / 1.144              | 3.072 / 6.525            | 0.780 / 2.269                         |

### Resolver node plans and buffers

Rows/filters are per-loop PostgreSQL figures. Root hits include child work; do not
sum root/child buffer values. All shared reads0 here reflects warm cache, not a
promise about disk workloads. Small1k target uses a fast hash/sequence plan on2822
global rows; larger/mixed targets use the existing composite unique index. The root
estimate1 versus actual100 is an under-estimate, recorded rather than hidden; the
observed100 index probes and sub-millisecond server work do not justify an index or
query rewrite in this scope. Source-key residual filters remove0 in indexed cases.

| Target / noise | Node / index                                   | Estimated / actual rows | Loops | Actual total ms | Shared hits / reads | Removed filter / join filter |
| -------------- | ---------------------------------------------- | ----------------------- | ----- | --------------- | ------------------- | ---------------------------- |
| 1000 / 0       | Hash Join / none                               | 1 / 100                 | 1     | 0.550           | 173 / 0             | 0 / 0                        |
| 1000 / 0       | Seq Scan / none                                | 354 / 1000              | 1     | 0.334           | 173 / 0             | 1822 / 0                     |
| 1000 / 0       | Hash / none                                    | 100 / 100               | 1     | 0.072           | 0 / 0               | 0 / 0                        |
| 1000 / 0       | Function Scan / none                           | 100 / 100               | 1     | 0.054           | 0 / 0               | 0 / 0                        |
| 10000 / 0      | Nested Loop / none                             | 1 / 100                 | 1     | 0.471           | 400 / 0             | 0 / 0                        |
| 10000 / 0      | Function Scan / none                           | 100 / 100               | 1     | 0.038           | 0 / 0               | 0 / 0                        |
| 10000 / 0      | Index Scan / scoped unique (six columns above) | 1 / 1                   | 100   | 0.004           | 400 / 0             | 0 / 0                        |
| 100000 / 0     | Nested Loop / none                             | 1 / 100                 | 1     | 0.598           | 500 / 0             | 0 / 0                        |
| 100000 / 0     | Function Scan / none                           | 100 / 100               | 1     | 0.031           | 0 / 0               | 0 / 0                        |
| 100000 / 0     | Index Scan / scoped unique (six columns above) | 1 / 1                   | 100   | 0.005           | 500 / 0             | 0 / 0                        |
| 100000 / 30000 | Nested Loop / none                             | 1 / 100                 | 1     | 0.549           | 500 / 0             | 0 / 0                        |
| 100000 / 30000 | Function Scan / none                           | 100 / 100               | 1     | 0.031           | 0 / 0               | 0 / 0                        |
| 100000 / 30000 | Index Scan / scoped unique (six columns above) | 1 / 1                   | 100   | 0.005           | 500 / 0             | 0 / 0                        |

Aggregate validation/storage/cleanup remain separate measurements. Physical bytes
are whole-relation allocation, not isolated per-job size. Scoped logical bytes count
this job only; delete/rollback can leave reusable pages/bloat in the disposable run.

| Target / noise | Validation ms | Scoped logical bytes | Whole seen relation bytes | Cleanup ms / calls | Seen read plan / ms |
| -------------- | ------------- | -------------------- | ------------------------- | ------------------ | ------------------- |
| 1000 / 0       | 3.108         | 16800                | 221184                    | 3.924 / 1          | Seq Scan / 0.010    |
| 10000 / 0      | 13.155        | 168000               | 491520                    | 5.682 / 1          | Seq Scan / 0.028    |
| 100000 / 0     | 279.117       | 1680000              | 2695168                   | 14.575 / 2         | Seq Scan / 0.143    |
| 100000 / 30000 | 316.728       | 1680000              | 4849664                   | 22.254 / 2         | Seq Scan / 0.208    |

## Verification and independent review status

Independent read-only reviewer checked source, frozen SHA, actual plans and local
signed output and ran observation/provider units11/11. P2 CLOSED; P3 CLOSED —
NO CHANGE REQUIRED for resolver/index. No open P1/P2/P3 in reviewed scope; hosted
corrective code-HEAD acceptance is recorded below, not inferred from v2.

| Command / verification                                           | Result  | Executed evidence                                                                                                                                                 |
| ---------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API build; targeted observation/provider/normalizer units        | PASS    | 16/16,0 skipped; unchanged actual literal query                                                                                                                   |
| Isolated signed observation integration                          | PASS    | 29/29,0 skipped;24427.929733ms; actual roles and exact resolver benchmark                                                                                         |
| pnpm test:integration                                            | PASS    | 208/208,0 skipped;276252.528158ms; genuine PostgreSQL full API regression, including Sync fencing/replay, Uniship and observation                                 |
| pnpm --filter @nexora/database test:migrations                   | PASS    | Legacy preservation, exact060 staged upgrade, forward/repeat/drift; applied migration/schema/grant bytes unchanged versus776ea5f                                  |
| pnpm quality                                                     | PASS    | format:check, lint/boundaries, preflight:check, docs:check, typecheck, test, contracts:check and build;871 tests: scripts182/API276/Web368/shared2/UI37/database6 |
| pnpm test:docs; test:preflight; test:lint                        | PASS    | 10/10;24/24;56/56                                                                                                                                                 |
| Independent review                                               | PASS    | Real separate reviewer; units11/11, actual PG29/29/plans examined; P2/P3 closed, no new finding                                                                   |
| Local canonical quality-docker / approved native launcher        | NOT RUN | VFS driver; only PG17.11 image; missing tooling image and534MiB available. No user volumes reset/native protocol bypass; hosted Foundation required               |
| Hosted Preflight / Sync Targeted / Foundation on corrective HEAD | PASS    | Source1bdab2c; attempt1 runs45043370063/45043370073/45043370090; full details below                                                                               |

Local commands use pinned pnpm10.34.6. Full host quality ran with API_INTERNAL_URL
and production build environment; genuine full integration used the privately signed
owned cluster and real API/worker passwords. Private logs remain outside Git; curated
facts above contain no URLs, credentials, payloads or real-person data. The task-owned
PostgreSQL is removed after verification. No merge/live activation is performed.

## Hosted corrective code acceptance

Committed source1bdab2c8ff21735795af94a983af6dac88c8a88d. All three checkout logs
confirm actual merge6cf648e19ae99a1c8f2ce2c9293f93090eb5c41d against main4708721.
Each run has head_sha1bdab2c and run_attempt1; API reports completed/success:

| Workflow                                                                                 | Run / job                 | Result | Executed assertions                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| [Preflight Governance](https://github.com/dinhphuquy2k1/nexora/actions/runs/45043370063) | 45043370063 /137272500823 | PASS   | Bound task/snapshot/PR metadata and governance tests                                                                                 |
| [Sync Targeted](https://github.com/dinhphuquy2k1/nexora/actions/runs/45043370073)        | 45043370073 /137272500954 | PASS   | 32 Sync units,11 Uniship units,61 Sync PostgreSQL and41 signed Uniship/observation tests; mid-job semantic drift executes            |
| [Foundation](https://github.com/dinhphuquy2k1/nexora/actions/runs/45043370090)           | 45043370090 /137272500779 | PASS   | Steps4–10 all success; actual canonical Docker, migrated integration, signed native/worker and runtime/browser/persistence/HMR gates |

Foundation step4 actually executes quality871/871, ordinary unsigned API integration
207/207 and staged/repeat/drift migrations. Unsigned context explicitly reports
restricted-role verification NOT RUN; the approved signed launcher then executes
Shipment22/22 followed by Observation29/29 (including real runtime credentials),
plus its other selected native suites, ending with:
`Actual disposable cluster tests PASS (all requested suites and cleanup verified)`.
No duplicate-context count is represented as unique scenarios. Local Docker NOT RUN
remains a local fact; this hosted run supplies the canonical execution proof.
No stress labels, CI reruns, merge or live activation are used.

## Final verification publication and exact byte boundary

The final publication adds CI evidence and strengthens the existing byte-bound case
only; production code stays byte-identical to1bdab2c. Tests now use the actual64-hex
scope and construct preimages of exactly2048 UTF-8 bytes, ASCII and Unicode: accepted
and equal to the expected canonical hash; adding one ASCII byte (2049) fails
SOURCE_INVALID. Intentional compiled-only mutation `>2048`→`>=2048` produces RED;
restoring the original compiled file gives5/5 GREEN. Source implementation is never
mutated for this experiment. Targeted observation/provider/normalizer16/16 and lint
PASS. Independent reviewer separately runs5/5 and finds no new issue; it did not
independently rerun the intentional mutation. No new plan/schema/production change.

The final publication HEAD must have its own Preflight, Sync Targeted and Foundation
checks. Its source/merge/run/attempt outcomes are recorded in PR60's Final green HEAD
and delivery report after execution, not inferred from1bdab2c's success above.
