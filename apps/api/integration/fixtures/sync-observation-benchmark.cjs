const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { sourceKey } = require("../../dist/sync/domain/sync-policy");
const {
  recordScanPage,
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
      for (const size of [1000, 10000, 100000]) {
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
        await db.$executeRawUnsafe("ANALYZE sync_job_seen_pages");
        const samples = [],
          statements = [],
          rollback = Symbol("owned microbenchmark rollback");
        for (let sample = 0; sample < 5; sample++) {
          await assert.rejects(
            repo.client.$transaction(async (tx) => {
              let queries = 0;
              const measured = {
                $queryRaw: (...args) => {
                  queries++;
                  return tx.$queryRaw(...args);
                },
              };
              const identities = Array.from({ length: 100 }, (_, i) =>
                sourceKey(contract.sourceKeyScheme, ["bench-" + (i + 1)]),
              );
              const begin = performance.now();
              await recordScanPage(
                measured,
                job,
                size / 100 + 1,
                size,
                identities,
              );
              samples.push(performance.now() - begin);
              statements.push(queries);
              throw rollback;
            }),
            (e) => e === rollback,
          );
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
        samples.sort((a, b) => a - b);
        console.log(
          "SYNC_OBSERVATION_BENCHMARK " +
            JSON.stringify({
              timestamp: new Date().toISOString(),
              node: process.version,
              platform: process.platform,
              arch: process.arch,
              identities: size,
              pages: size / 100,
              extraStatementsPerPage: 2,
              recordPageP50Ms: samples[2],
              recordPageMaxMs: samples.at(-1),
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
