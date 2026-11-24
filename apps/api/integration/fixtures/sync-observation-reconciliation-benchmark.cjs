const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const { randomUUID } = require("node:crypto");
const { availableParallelism, cpus } = require("node:os");
const { Prisma } = require("@nexora/database");
const {
  shipmentReconciliationQueries,
} = require("../../dist/shipment/infrastructure/shipment-reconciliation");
const {
  ShipmentAdapter,
} = require("../../dist/shipment/infrastructure/shipment.adapter");
const policy = {
  maxNewlyMissing: 2147483647,
  maxMissingRatioBps: 10000,
  maxObservedDropRatioBps: 10000,
};
const rollback = Symbol("owned EXPLAIN rollback");
function plan(document) {
  const result = [];
  function walk(n) {
    result.push({
      node: n["Node Type"],
      index: n["Index Name"] ?? null,
      estimatedRows: n["Plan Rows"],
      rows: n["Actual Rows"],
      loops: n["Actual Loops"],
      totalMs: n["Actual Total Time"],
      hits: n["Shared Hit Blocks"] ?? 0,
      reads: n["Shared Read Blocks"] ?? 0,
      removed: n["Rows Removed by Filter"] ?? 0,
    });
    for (const c of n.Plans ?? []) walk(c);
  }
  walk(document.Plan);
  return {
    executionMs: document["Execution Time"],
    planningMs: document["Planning Time"],
    nodes: result,
  };
}
module.exports.benchmarkReconciliation = async ({
  t,
  db,
  makeRepo,
  lane,
  contract,
  readUrl,
  readContext,
}) => {
  await t.test(
    "062 1k/10k/100k atomic finalization plans, zero-update invariant, rollback and concurrent API lock",
    async () => {
      const [pg] =
        await db.$queryRaw`SELECT current_setting('server_version') AS version`;
      for (const size of [1000, 10000, 100000]) {
        const c = await lane(),
          repo = makeRepo(true, contract, policy);
        await db.$executeRaw`INSERT INTO sync_source_identities(owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key,source_key_hash)
     SELECT ${c.owner.id}::uuid,'uniship',${c.connection.externalAccountId},'SHIPMENT',${contract.sourceKeyScheme},jsonb_build_array(g::text)::text,
     encode(sha256(convert_to(jsonb_build_array(g::text)::text,'UTF8')),'hex') FROM generate_series(1,${size}) g`;
        await db.$executeRaw`INSERT INTO shipments(owner_user_id,source_identity_id,carrier_connection_id,provider,tracking_code)
     SELECT ${c.owner.id}::uuid,s.id,${c.connection.id}::uuid,'uniship',s.source_key FROM sync_source_identities s WHERE s.owner_user_id=${c.owner.id}::uuid`;
        await db.$executeRawUnsafe("ANALYZE sync_source_identities");
        await db.$executeRawUnsafe("ANALYZE shipments");
        async function prepare(r = repo, missing = 0) {
          const job = await r.admit(
            c.owner.id,
            c.connection.id,
            "SHIPMENT",
            "MANUAL",
          );
          const work = await r.claim(randomUUID());
          assert.equal(work.id, job.id);
          await db.$executeRaw`INSERT INTO sync_job_seen_pages(job_id,page_no,source_identity_ids,reported_total)
     SELECT ${job.id}::uuid,((n-1)/100+1)::int,array_agg(id ORDER BY n),${size - missing} FROM (
       SELECT id,row_number() OVER(ORDER BY id) n FROM sync_source_identities
       WHERE owner_user_id=${c.owner.id}::uuid AND provider='uniship' AND external_account_id=${c.connection.externalAccountId}
       AND source_key_scheme=${contract.sourceKeyScheme} AND (CASE WHEN owner_user_id=${c.owner.id}::uuid AND external_account_id=${c.connection.externalAccountId} AND source_key_scheme=${contract.sourceKeyScheme} THEN (source_key::jsonb->>0)::int END)>${missing}
     ) x GROUP BY ((n-1)/100+1)::int`;
          await db.$executeRaw`UPDATE sync_jobs SET processing_phase='APPLYING',scan_integrity_status='VALIDATED',scan_observed_count=${size - missing},scan_reported_total=${size - missing},next_page=${Math.ceil((size - missing) / 100)} WHERE id=${job.id}::uuid`;
          return r.job(c.owner.id, c.connection.id, job.id);
        }
        // Actual baseline finalization warms the same tables and establishes admitted provenance.
        const baseline = await prepare();
        await repo.apply(baseline);
        assert.equal(
          (await db.syncJob.findUnique({ where: { id: baseline.id } }))
            .reconciliationStatus,
          "BASELINE_ESTABLISHED",
        );
        const cases = [
          "none",
          "one",
          "one-percent",
          "still-missing",
          "restore-many",
          "mass-blocked",
          ...(size === 100000 ? ["near-total-missing", "restore-all"] : []),
          "mixed-scope",
          "crash-retry",
          "concurrent-api",
        ];
        for (const scenario of cases) {
          await db.$executeRaw`UPDATE shipments SET sync_hidden_at=NULL,missing_streak=0 WHERE owner_user_id=${c.owner.id}::uuid AND sync_hidden_at IS NOT NULL`;
          const percent = Math.max(1, size / 100),
            restores = scenario === "restore-all" ? size : size / 10;
          let missing = 0;
          if (["one", "crash-retry", "concurrent-api"].includes(scenario))
            missing = 1;
          if (
            ["one-percent", "still-missing", "mass-blocked"].includes(scenario)
          )
            missing = percent;
          if (scenario === "near-total-missing") missing = size - 1;
          if (scenario === "still-missing")
            await db.$executeRaw`UPDATE shipments p SET sync_hidden_at=clock_timestamp(),missing_streak=1 FROM sync_source_identities s WHERE p.source_identity_id=s.id AND p.owner_user_id=${c.owner.id}::uuid AND (CASE WHEN s.owner_user_id=${c.owner.id}::uuid AND s.external_account_id=${c.connection.externalAccountId} AND s.source_key_scheme=${contract.sourceKeyScheme} THEN (s.source_key::jsonb->>0)::int END)<=${percent}`;
          if (
            ["restore-many", "restore-all", "mass-blocked"].includes(scenario)
          )
            await db.$executeRaw`UPDATE shipments p SET sync_hidden_at=clock_timestamp(),missing_streak=1 FROM sync_source_identities s WHERE p.source_identity_id=s.id AND p.owner_user_id=${c.owner.id}::uuid AND (CASE WHEN s.owner_user_id=${c.owner.id}::uuid AND s.external_account_id=${c.connection.externalAccountId} AND s.source_key_scheme=${contract.sourceKeyScheme} THEN (s.source_key::jsonb->>0)::int END)>${size - restores}`;
          if (scenario === "mixed-scope") {
            const noise = await lane();
            for (const [owner, account, scheme] of [
              [
                noise.owner.id,
                c.connection.externalAccountId,
                contract.sourceKeyScheme,
              ],
              [
                c.owner.id,
                noise.connection.externalAccountId,
                contract.sourceKeyScheme,
              ],
              [c.owner.id, c.connection.externalAccountId, "incompatible-v1"],
            ]) {
              await db.$executeRaw`INSERT INTO sync_source_identities(owner_user_id,provider,external_account_id,sync_type,source_key_scheme,source_key,source_key_hash)
        SELECT ${owner}::uuid,'uniship',${account},'SHIPMENT',${scheme},jsonb_build_array(g::text)::text,encode(sha256(convert_to(jsonb_build_array(g::text)::text,'UTF8')),'hex') FROM generate_series(1,1000) g`;
              await db.$executeRaw`INSERT INTO shipments(owner_user_id,source_identity_id,provider,tracking_code)
       SELECT ${owner}::uuid,s.id,'uniship','noise' FROM sync_source_identities s WHERE s.owner_user_id=${owner}::uuid AND s.external_account_id=${account} AND s.source_key_scheme=${scheme}`;
            }
          }
          const r =
            scenario === "mass-blocked"
              ? makeRepo(true, contract, { ...policy, maxNewlyMissing: 0 })
              : repo;
          let enter, release;
          const entered = new Promise((resolve) => (enter = resolve)),
            gate = new Promise((resolve) => (release = resolve));
          const measuredRepo =
            scenario === "concurrent-api"
              ? makeRepo(true, contract, policy, async () => {
                  enter();
                  await gate;
                })
              : r;
          const work = await prepare(measuredRepo, missing);
          await db.$executeRawUnsafe("ANALYZE sync_job_seen_pages");
          const sql = shipmentReconciliationQueries(
            work,
            contract.sourceKeyScheme,
          );
          const plans = {};
          await assert.rejects(
            measuredRepo.client.$transaction(
              async (tx) => {
                for (const [name, query] of Object.entries({
                  candidates: sql.facts,
                  antiJoin: sql.missing,
                  restore: sql.restore,
                  update: sql.mutation,
                })) {
                  const result = await tx.$queryRaw(
                    Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
                  );
                  plans[name] = plan(result[0]["QUERY PLAN"][0]);
                }
                throw rollback;
              },
              { timeout: 15000 },
            ),
            (e) => e === rollback,
          );
          const [before] =
            await db.$queryRaw`SELECT count(*)::int AS rows,count(*) FILTER(WHERE sync_hidden_at IS NOT NULL)::int AS hidden FROM shipments WHERE owner_user_id=${c.owner.id}::uuid`;
          const xmin =
            scenario === "none"
              ? await db.$queryRaw`SELECT xmin::text AS xmin,count(*)::int AS count FROM shipments WHERE owner_user_id=${c.owner.id}::uuid GROUP BY xmin ORDER BY xmin::text`
              : null;
          let failedMs = null;
          if (scenario === "crash-retry") {
            await db.$executeRawUnsafe(
              "CREATE FUNCTION benchmark_reconcile_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reconciliation_status IS NOT NULL THEN RAISE EXCEPTION 'owned benchmark failure'; END IF; RETURN NEW; END $$",
            );
            await db.$executeRawUnsafe(
              "CREATE TRIGGER benchmark_reconcile_failure BEFORE UPDATE ON sync_jobs FOR EACH ROW EXECUTE FUNCTION benchmark_reconcile_failure()",
            );
            const begin = performance.now();
            try {
              await assert.rejects(measuredRepo.apply(work));
              failedMs = performance.now() - begin;
            } finally {
              await db.$executeRawUnsafe(
                "DROP TRIGGER benchmark_reconcile_failure ON sync_jobs",
              );
              await db.$executeRawUnsafe(
                "DROP FUNCTION benchmark_reconcile_failure()",
              );
            }
            assert.equal(
              (await db.syncJob.findUnique({ where: { id: work.id } })).status,
              "RUNNING",
            );
            assert.ok(
              await db.syncJobSeenPage.count({ where: { jobId: work.id } }),
            );
            assert.equal(
              await db.shipment.count({
                where: { ownerUserId: c.owner.id, syncHiddenAt: { not: null } },
              }),
              before.hidden,
            );
          }
          let cleanupMs = 0,
            driverStatements = 0;
          const client = measuredRepo.client,
            original = client.$transaction.bind(client);
          client.$transaction = (callback, options) =>
            original(
              (tx) =>
                callback(
                  new Proxy(tx, {
                    get(target, key) {
                      if (key === "$queryRaw" || key === "$executeRaw")
                        return async (...args) => {
                          driverStatements++;
                          const begin = performance.now();
                          const result = await target[key](...args);
                          const text = Array.isArray(args[0])
                            ? args[0].join(" ")
                            : (args[0].sql ?? "");
                          if (text.includes("DELETE FROM sync_job_seen_pages"))
                            cleanupMs += performance.now() - begin;
                          return result;
                        };
                      return target[key];
                    },
                  }),
                ),
              options,
            );
          let apiWaitMs = null,
            apiResult;
          const begin = performance.now();
          try {
            const applied = measuredRepo.apply(work);
            if (scenario === "concurrent-api") {
              await entered;
              const apiName = "owned-reconciliation-" + randomUUID(),
                url = new URL(readUrl);
              url.searchParams.set("application_name", apiName);
              const adapter = new ShipmentAdapter(url.toString());
              const waitStart = performance.now();
              const reading = adapter.list(c.owner.id, {
                page: 1,
                pageSize: 10,
              });
              try {
                let blocked = false;
                for (let i = 0; i < 200; i++) {
                  const [row] =
                    await db.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name=${apiName} AND wait_event_type='Lock' AND state='active'`;
                  if (row.count) {
                    blocked = true;
                    break;
                  }
                  await new Promise((resolve) => setTimeout(resolve, 10));
                }
                assert.equal(
                  blocked,
                  true,
                  "real API actor lock must wait for atomic worker completion",
                );
                release();
                await applied;
                apiResult = await reading;
                apiWaitMs = performance.now() - waitStart;
              } finally {
                release();
                await adapter.close();
              }
            } else await applied;
          } finally {
            client.$transaction = original;
            release();
          }
          const durationMs = performance.now() - begin;
          const result = await db.syncJob.findUniqueOrThrow({
            where: { id: work.id },
          });
          assert.equal(result.status, "SUCCEEDED");
          assert.equal(
            await db.syncJobSeenPage.count({ where: { jobId: work.id } }),
            0,
          );
          assert.equal(
            result.reconciliationStatus,
            scenario === "mass-blocked" ? "SKIPPED" : "APPLIED",
          );
          if (scenario === "mixed-scope")
            assert.equal(
              result.reconciliationNewlyHiddenCount +
                result.reconciliationRestoredCount +
                result.reconciliationStillMissingCount,
              0,
            );
          if (scenario === "none") {
            assert.deepEqual(
              await db.$queryRaw`SELECT xmin::text AS xmin,count(*)::int AS count FROM shipments WHERE owner_user_id=${c.owner.id}::uuid GROUP BY xmin ORDER BY xmin::text`,
              xmin,
            );
            assert.equal(
              result.reconciliationNewlyHiddenCount +
                result.reconciliationRestoredCount +
                result.reconciliationStillMissingCount,
              0,
            );
          }
          if (scenario === "mass-blocked") {
            assert.equal(
              result.reconciliationReason,
              "MASS_HIDE_THRESHOLD_EXCEEDED",
            );
            assert.equal(
              await db.shipment.count({
                where: { ownerUserId: c.owner.id, syncHiddenAt: { not: null } },
              }),
              before.hidden,
            );
          }
          if (scenario === "concurrent-api")
            assert.equal(
              apiResult.stats.total,
              before.rows -
                before.hidden -
                result.reconciliationNewlyHiddenCount +
                result.reconciliationRestoredCount,
            );
          console.log(
            "SHIPMENT_RECONCILIATION_BENCHMARK " +
              JSON.stringify({
                timestamp: new Date().toISOString(),
                size,
                scenario,
                postgres: pg.version,
                node: process.version,
                cpu: cpus()[0]?.model,
                availableCpus: availableParallelism(),
                apiReadContext: readContext,
                method:
                  "synthetic warm data, rollback EXPLAIN before actual fenced finalization; no production SLA",
                plans,
                finalizationMs: durationMs,
                cleanupMs,
                driverStatements,
                failedFinalizationMs: failedMs,
                controlledApiLockWaitMs: apiWaitMs,
                status: result.reconciliationStatus,
                newlyHidden: result.reconciliationNewlyHiddenCount,
                restored: result.reconciliationRestoredCount,
                stillMissing: result.reconciliationStillMissingCount,
                visibilityUpdateRows:
                  result.reconciliationNewlyHiddenCount +
                  result.reconciliationRestoredCount +
                  result.reconciliationStillMissingCount,
              }),
          );
        }
      }
    },
  );
};
