const assert = require("node:assert/strict");
const { Prisma } = require("@nexora/database");
const { availableParallelism, cpus } = require("node:os");
const { performance } = require("node:perf_hooks");
const { sourceKey } = require("../../dist/sync/domain/sync-policy");
const {
  recordScanPage,
  scanIdentityResolutionQuery,
  readScanSummary,
  saveScanSummary,
} = require("../../dist/sync/infrastructure/sync-scan-observation");
const {
  UNISHIP_FULL_SCAN: contract,
} = require("../../dist/shipment/infrastructure/uniship/uniship-full-scan");
module.exports.benchmarkObservation = async ({ t, db, repo, lane }) => {
  await t.test(
    "1k/10k/100k SQL observation microbenchmark and bounded terminal cleanup",
    async () => {
      const [environment] =
        await db.$queryRaw`SELECT current_setting('server_version') AS postgres`;
      for (const { size, mixed } of [
        { size: 1000, mixed: false },
        { size: 10000, mixed: false },
        { size: 100000, mixed: false },
        { size: 100000, mixed: true },
      ]) {
        const c = await lane(),
          job = await repo.admit(
            c.owner.id,
            c.connection.id,
            "SHIPMENT",
            "MANUAL",
          );
        await db.$executeRaw`INSERT INTO sync_source_identities(owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key,source_key_hash)
    SELECT ${c.owner.id}::uuid,'uniship',${c.connection.externalAccountId},'SHIPMENT',${contract.sourceKeyScheme},jsonb_build_array('bench-'||g)::text,
    encode(sha256(convert_to(jsonb_build_array('bench-'||g)::text,'UTF8')),'hex') FROM generate_series(1,${size}) g`;
        await db.$executeRaw`INSERT INTO sync_job_seen_pages(job_id,page_no,source_identity_ids,reported_total)
    SELECT ${job.id}::uuid,((n-1)/100+1)::int,array_agg(id ORDER BY n),${size} FROM (
     SELECT id,row_number() OVER(ORDER BY source_key) AS n FROM sync_source_identities WHERE owner_user_id=${c.owner.id}::uuid
    ) s GROUP BY ((n-1)/100+1)::int`;
        if (mixed) {
          const other = await lane();
          // Same keys/hashes in other owners, accounts and schemes: only exact scope may resolve.
          for (const [owner, account, scheme] of [
            [
              other.owner.id,
              c.connection.externalAccountId,
              contract.sourceKeyScheme,
            ],
            [
              c.owner.id,
              other.connection.externalAccountId,
              contract.sourceKeyScheme,
            ],
            [c.owner.id, c.connection.externalAccountId, "bench-other-v1"],
          ]) {
            await db.$executeRaw`INSERT INTO sync_source_identities(owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key,source_key_hash)
              SELECT ${owner}::uuid,'uniship',${account},'SHIPMENT',${scheme},jsonb_build_array('bench-'||g)::text,
              encode(sha256(convert_to(jsonb_build_array('bench-'||g)::text,'UTF8')),'hex') FROM generate_series(1,10000) g`;
          }
        }
        await db.$executeRawUnsafe("ANALYZE sync_job_seen_pages");
        await db.$executeRawUnsafe("ANALYZE sync_source_identities");
        const [population] =
          await db.$queryRaw`SELECT count(*)::int AS total FROM sync_source_identities`;
        const indexes =
          await db.$queryRaw`SELECT ci.relname::text AS name, i.indisunique AS unique,
          array_agg(a.attname::text ORDER BY k.n) AS columns
          FROM pg_index i JOIN pg_class ct ON ct.oid=i.indrelid
          JOIN pg_class ci ON ci.oid=i.indexrelid
          JOIN pg_namespace ns ON ns.oid=ct.relnamespace
          CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,n)
          JOIN pg_attribute a ON a.attrelid=ct.oid AND a.attnum=k.attnum
          WHERE ns.nspname='public' AND ct.relname='sync_source_identities'
          GROUP BY ci.relname,i.indisunique ORDER BY ci.relname`;
        assert.ok(
          indexes.some(
            (i) =>
              i.unique &&
              i.columns.join(",") ===
                "owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key_hash",
          ),
        );
        const samples = [],
          transactions = [],
          resolverDriver = [],
          insertDriver = [],
          statements = [],
          rollback = Symbol("owned microbenchmark rollback");
        const identities = Array.from({ length: 100 }, (_, i) =>
          sourceKey(contract.sourceKeyScheme, ["bench-" + (i + 1)]),
        );
        for (let sample = 0; sample < 35; sample++) {
          const warmup = sample < 5,
            transactionBegin = performance.now();
          await assert.rejects(
            repo.client.$transaction(async (tx) => {
              let queries = 0;
              const times = [];
              const measured = {
                $queryRaw: async (...args) => {
                  queries++;
                  const begin = performance.now();
                  const result = await tx.$queryRaw(...args);
                  times.push(performance.now() - begin);
                  return result;
                },
              };
              const begin = performance.now();
              await recordScanPage(
                measured,
                job,
                size / 100 + 1,
                size,
                identities,
              );
              if (!warmup) {
                samples.push(performance.now() - begin);
                resolverDriver.push(times[0]);
                insertDriver.push(times[1]);
                statements.push(queries);
              }
              throw rollback;
            }),
            (e) => e === rollback,
          );
          if (!warmup) transactions.push(performance.now() - transactionBegin);
        }
        // Identical SQL expression and input builder to recordScanPage, through the worker role.
        const resolutionExplain = await repo.client.$queryRaw(Prisma.sql`
          EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${scanIdentityResolutionQuery(job, identities)}`);
        const resolution = resolutionExplain[0]["QUERY PLAN"][0];
        assert.equal(resolution.Plan["Actual Rows"], 100);
        const resolutionPlan = [];
        function inspect(node) {
          resolutionPlan.push({
            node: node["Node Type"],
            index: node["Index Name"] ?? null,
            estimatedRows: node["Plan Rows"],
            actualRows: node["Actual Rows"],
            loops: node["Actual Loops"],
            totalMs: node["Actual Total Time"],
            sharedHitBlocks: node["Shared Hit Blocks"] ?? 0,
            sharedReadBlocks: node["Shared Read Blocks"] ?? 0,
            rowsRemovedByFilter: node["Rows Removed by Filter"] ?? 0,
            rowsRemovedByJoinFilter: node["Rows Removed by Join Filter"] ?? 0,
          });
          for (const child of node.Plans ?? []) inspect(child);
        }
        inspect(resolution.Plan);
        function latency(values) {
          const sorted = [...values].sort((a, b) => a - b);
          return {
            p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
            p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
            maxMs: sorted.at(-1),
          };
        }
        const begin = performance.now(),
          summary = await repo.client.$transaction((tx) =>
            readScanSummary(tx, job, contract.sourceKeyScheme, size / 100),
          );
        const validationMs = performance.now() - begin;
        assert.equal(summary.status, "VALIDATED");
        assert.equal(summary.observedCount, size);
        assert.ok(statements.every((n) => n === 2));
        const [bytes] =
          await db.$queryRaw`SELECT coalesce(sum(pg_column_size(p)),0)::bigint AS logical_bytes,pg_total_relation_size('sync_job_seen_pages') AS relation_bytes FROM sync_job_seen_pages p WHERE job_id=${job.id}::uuid`;
        const explain =
          await db.$queryRaw`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT source_identity_ids FROM sync_job_seen_pages WHERE job_id=${job.id}::uuid`;
        const plan = [];
        function walk(n) {
          plan.push({
            node: n["Node Type"],
            index: n["Index Name"] ?? null,
            rows: n["Actual Rows"],
            ms: n["Actual Total Time"],
          });
          for (const child of n.Plans ?? []) walk(child);
        }
        walk(explain[0]["QUERY PLAN"][0].Plan);
        await db.$transaction(async (tx) => {
          await saveScanSummary(tx, job.id, summary);
          await tx.$executeRaw`UPDATE sync_jobs SET status='SUCCEEDED',finished_at=clock_timestamp() WHERE id=${job.id}::uuid`;
        });
        const cleanupStart = performance.now();
        let calls = 0;
        while (await db.syncJobSeenPage.count({ where: { jobId: job.id } })) {
          await repo.cleanup();
          assert.ok(++calls <= 10);
        }
        const cleanupMs = performance.now() - cleanupStart;
        console.log(
          "SYNC_OBSERVATION_BENCHMARK " +
            JSON.stringify({
              timestamp: new Date().toISOString(),
              node: process.version,
              platform: process.platform,
              arch: process.arch,
              postgres: environment.postgres,
              cpu: cpus()[0]?.model,
              availableCpus: availableParallelism(),
              measurement:
                "synthetic warm-cache microbenchmark, not production SLA; ANALYZE both tables; helper rollback transactions",
              warmupSamples: 5,
              measuredSamples: 30,
              identities: size,
              mixedScopeNoise: mixed ? 30000 : 0,
              globalIdentityRows: population.total,
              resolverSqlExecutionMs: resolution["Execution Time"],
              resolverSqlPlanningMs: resolution["Planning Time"],
              resolutionPlan,
              sourceIdentityIndexes: indexes,
              helper: latency(samples),
              transaction: latency(transactions),
              resolverDriver: latency(resolverDriver),
              insertDriver: latency(insertDriver),
              transactionMinusHelper: latency(
                transactions.map((v, i) => v - samples[i]),
              ),
              pages: size / 100,
              extraStatementsPerPage: 2,
              validationMs,
              logicalBytes: Number(bytes.logical_bytes),
              relationBytes: Number(bytes.relation_bytes),
              cleanupMs,
              cleanupCalls: calls,
              plan,
            }),
        );
      }
    },
  );
};
