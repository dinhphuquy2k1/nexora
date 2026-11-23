require("reflect-metadata");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const { createRequire } = require("node:module");
const { createDatabase } = require("@nexora/database");
const { Client } = createRequire(require.resolve("@nexora/database"))("pg");
const {
  SyncRepository,
} = require("../dist/sync/infrastructure/sync-job.repository");
const {
  SyncCapabilityRegistry,
} = require("../dist/sync/infrastructure/sync-capability.registry");
const {
  loadSyncConfig,
  sourceKey,
} = require("../dist/sync/domain/sync-policy");
const {
  createShipmentSyncBinding,
} = require("../dist/shipment/infrastructure/shipment-sync-domain.binding");
const {
  UnishipShipmentProcessor,
} = require("../dist/shipment/infrastructure/uniship/uniship-shipment.processor");
const {
  UNISHIP_FULL_SCAN: contract,
} = require("../dist/shipment/infrastructure/uniship/uniship-full-scan");
const {
  readScanSummary,
} = require("../dist/sync/infrastructure/sync-scan-observation");
const {
  TransactionSyncDisablement,
} = require("../dist/sync/infrastructure/sync-disablement.participant");
const source = (id, invalid = false) => ({
  identity: sourceKey(contract.sourceKeyScheme, [String(id)]),
  payload: invalid
    ? { invalid: true }
    : {
        shipment: {
          trackingCode: "synthetic-" + id,
          providerStatus: "1",
          providerClaimStatus: null,
        },
        oldStatus: null,
      },
});
const entries = (start, count) =>
  Array.from({ length: count }, (_, i) => source(start + i));
const page = (n, total, records) => {
  const done = (n - 1) * 100 + records.length === total;
  return {
    records,
    done,
    scan: { ...contract, pageNumber: n, reportedTotal: total },
    ...(!done ? { nextPage: n + 1 } : {}),
  };
};
test(
  "FULL scan observation genuine PostgreSQL atomicity, integrity, fencing, lifecycle and roles",
  { timeout: 180000 },
  async (t) => {
    assert.ok(process.env.DATABASE_URL, "genuine PostgreSQL required");
    const admin = createDatabase(process.env.DATABASE_URL),
      name = "nexora_observation_" + randomUUID().replaceAll("-", "");
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    const repos = [];
    let owned = false,
      db,
      workerUrl = url.toString(),
      apiUrl;
    try {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      owned = true;
      execFileSync(
        process.execPath,
        [
          resolve("../../packages/database/node_modules/prisma/build/cli.js"),
          "migrate",
          "deploy",
          "--config",
          resolve("../../packages/database/prisma.config.ts"),
        ],
        {
          env: { ...process.env, DATABASE_URL: url.toString() },
          stdio: "pipe",
          timeout: 60000,
        },
      );
      db = createDatabase(url.toString());
      if (process.env.DISPOSABLE_CLUSTER_TOKEN) {
        assert.equal(
          process.env.DATABASE_URL,
          process.env.DISPOSABLE_CLUSTER_ADMIN_URL,
        );
        const [stamp] = await admin.$queryRawUnsafe(
          "SELECT description FROM pg_shdescription JOIN pg_database ON objoid=pg_database.oid WHERE datname=current_database()",
        );
        assert.equal(stamp?.description, process.env.DISPOSABLE_CLUSTER_TOKEN);
        const { provisionRuntime, runtimeUrl } = await import(
          "../../../packages/database/scripts/provision-runtime.mjs"
        );
        const password = (
          await readFile(process.env.API_TEST_RUNTIME_PASSWORD_FILE, "utf8")
        ).trim();
        await provisionRuntime(url.toString(), password, {
          role: "nexora_sync",
        });
        await provisionRuntime(url.toString(), password);
        workerUrl = runtimeUrl(url.toString(), password, "nexora_sync");
        apiUrl = runtimeUrl(url.toString(), password);
      } else
        t.diagnostic(
          "Restricted role verification NOT RUN in ordinary unsigned context; required signed targeted/shipment-worker context executes it.",
        );
      const makeRepo = (
        observation = true,
        scanContract = contract,
        reconciliation,
        beforeFinalize,
      ) => {
        const provider = {
          strategy: () => "FULL",
          fetch: async () => {
            throw Error("no network in observation fixtures");
          },
          ...(observation ? { fullScan: scanContract } : {}),
        };
        const repo = new SyncRepository(
          workerUrl,
          loadSyncConfig({ SYNC_ENABLED: "true" }),
          new SyncCapabilityRegistry([
            {
              providerName: "uniship",
              type: "SHIPMENT",
              provider,
              domain: (() => {
                const binding = createShipmentSyncBinding(
                  new UnishipShipmentProcessor(),
                  reconciliation,
                );
                if (!beforeFinalize) return binding;
                return Object.freeze({
                  ...binding,
                  async finalize(tx, job, facts) {
                    await beforeFinalize();
                    return binding.finalize(tx, job, facts);
                  },
                });
              })(),
            },
          ]),
          "shared",
        );
        repos.push(repo);
        return repo;
      };
      const repo = makeRepo();
      async function lane() {
        const owner = await db.user.create({
          data: { username: "observation-" + randomUUID(), role: "OPERATOR" },
        });
        const connection = await db.carrierConnection.create({
          data: {
            userId: owner.id,
            provider: "uniship",
            externalAccountId: randomUUID(),
            displayName: "Owned observation fixture",
            status: "CONNECTED",
          },
        });
        return { owner, connection };
      }
      const state = (id) => db.syncJob.findUniqueOrThrow({ where: { id } });
      const seen = (id) =>
        db.syncJobSeenPage.findMany({
          where: { jobId: id },
          orderBy: { pageNo: "asc" },
        });
      async function start(c, r = repo) {
        const j = await r.admit(
          c.owner.id,
          c.connection.id,
          "SHIPMENT",
          "MANUAL",
        );
        const work = await r.claim(randomUUID());
        assert.equal(work?.id, j.id);
        return { j, work };
      }
      async function finish(id, r = repo) {
        for (let i = 0; i < 10; i++) {
          const s = await state(id);
          if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(s.status)) return s;
          const work = await r.claim(randomUUID());
          assert.equal(work?.id, id);
          await r.apply(work);
        }
        throw Error("fixture did not settle");
      }
      async function scope(name, fn) {
        await t.test(name, async () => {
          const c = await lane();
          try {
            await fn(c);
          } finally {
            await db.syncJob.updateMany({
              where: {
                owner_user_id: c.owner.id,
                status: { in: ["QUEUED", "RUNNING", "WAITING"] },
              },
              data: {
                status: "CANCELLED",
                worker_id: null,
                lease_expires_at: null,
                finished_at: new Date(),
              },
            });
            await repo.cleanup();
          }
        });
      }
      await scope(
        "100/205/101/empty scans observe internal UUIDs, assess complete scans and clean after success",
        async (c) => {
          for (const total of [100, 205, 101, 0]) {
            const { j, work } = await start(c);
            let w = work;
            const all = [];
            const pages = Math.max(1, Math.ceil(total / 100));
            for (let n = 1; n <= pages; n++) {
              const rows = entries(
                total * 1000 + (n - 1) * 100,
                Math.min(100, Math.max(0, total - (n - 1) * 100)),
              );
              all.push(...rows);
              await repo.page(w, page(n, total, rows), 1);
              const observed = await seen(j.id);
              assert.equal(observed.length, n);
              assert.equal(observed.at(-1).pageNo, n);
              assert.equal(
                observed.at(-1).sourceIdentityIds.length,
                rows.length,
              );
              for (const id of observed.at(-1).sourceIdentityIds) {
                assert.match(id, /^[0-9a-f-]{36}$/);
                assert.ok(
                  await db.syncSourceIdentity.findUnique({ where: { id } }),
                );
              }
              if (n < pages) {
                assert.equal((await state(j.id)).scanIntegrityStatus, null);
                w = await repo.claim(randomUUID());
              }
            }
            const assessed = await state(j.id);
            assert.equal(assessed.scanIntegrityStatus, "VALIDATED");
            assert.equal(assessed.scanObservedCount, total);
            assert.equal(assessed.scanReportedTotal, total);
            assert.equal((await finish(j.id)).status, "SUCCEEDED");
            assert.equal((await seen(j.id)).length, 0);
            assert.equal((await state(j.id)).scanObservedCount, total);
            const again = await start(c);
            w = again.work;
            for (let n = 1; n <= pages; n++) {
              await repo.page(
                w,
                page(n, total, all.slice((n - 1) * 100, n * 100)),
                1,
              );
              if (n < pages) w = await repo.claim(randomUUID());
            }
            assert.equal(
              await db.syncJobItem.count({ where: { job_id: again.j.id } }),
              0,
              "unchanged identities must not depend on job items",
            );
            assert.equal((await state(again.j.id)).scanObservedCount, total);
            await finish(again.j.id);
          }
        },
      );
      await scope(
        "SoftDeleted provider field never removes an observed identity or hides a Shipment",
        async (c) => {
          const {
            parseUnishipPage,
            parseUnishipWarehouses,
          } = require("../dist/shipment/infrastructure/uniship/uniship-normalizer");
          const fixture = require("../test/helpers/uniship-fixture.cjs");
          const observed = parseUnishipPage(
            fixture.page([fixture.row({ ID: 910001, SoftDeleted: 1 })]),
            1,
            100,
            parseUnishipWarehouses(fixture.stores),
            () => {},
          );
          const { j, work } = await start(c);
          await repo.page(work, observed, 1);
          assert.equal((await seen(j.id))[0].sourceIdentityIds.length, 1);
          const result = await finish(j.id);
          assert.equal(result.status, "SUCCEEDED");
          assert.equal(result.scanObservedCount, 1);
          assert.equal(
            await db.shipment.count({ where: { ownerUserId: c.owner.id } }),
            1,
          );
        },
      );
      await scope(
        "valid rejected source identity is still seen and does not create Shipment",
        async (c) => {
          const { j, work } = await start(c);
          await repo.page(work, page(1, 1, [source("rejected", true)]), 1);
          assert.equal((await seen(j.id))[0].sourceIdentityIds.length, 1);
          const ended = await finish(j.id);
          assert.equal(ended.status, "SUCCEEDED");
          assert.equal(ended.rejected_count, 1);
          assert.equal(ended.scanObservedCount, 1);
          assert.equal(
            await db.shipment.count({ where: { ownerUserId: c.owner.id } }),
            0,
          );
          const again = await start(c);
          await repo.page(
            again.work,
            page(1, 1, [source("rejected", true)]),
            1,
          );
          assert.equal((await seen(again.j.id))[0].sourceIdentityIds.length, 1);
          assert.equal(
            await db.syncJobItem.count({ where: { job_id: again.j.id } }),
            0,
            "unchanged rejected identity is still observed",
          );
          assert.equal((await finish(again.j.id)).status, "SUCCEEDED");
        },
      );
      await scope(
        "cross-page duplicate is UNTRUSTED while ingestion SUCCEEDED and Shipment identity is unique",
        async (c) => {
          const first = entries(10000, 100),
            { j, work } = await start(c);
          await repo.page(work, page(1, 101, first), 1);
          const next = await repo.claim(randomUUID());
          await repo.page(next, page(2, 101, [first[0]]), 1);
          const s = await finish(j.id);
          assert.equal(s.status, "SUCCEEDED");
          assert.equal(s.scanIntegrityStatus, "UNTRUSTED");
          assert.equal(s.scanIntegrityReason, "DUPLICATE_IDENTITY");
          assert.equal(s.scanObservedCount, 100);
          assert.equal(
            await db.shipment.count({ where: { ownerUserId: c.owner.id } }),
            100,
          );
        },
      );
      await scope(
        "changing reported total is UNTRUSTED without failing safe ingestion",
        async (c) => {
          const { j, work } = await start(c);
          await repo.page(work, page(1, 205, entries(20000, 100)), 1);
          await repo.page(
            await repo.claim(randomUUID()),
            page(2, 203, entries(20100, 100)),
            1,
          );
          await repo.page(
            await repo.claim(randomUUID()),
            page(3, 203, entries(20200, 3)),
            1,
          );
          const s = await finish(j.id);
          assert.equal(s.status, "SUCCEEDED");
          assert.equal(s.scanIntegrityReason, "TOTAL_MISMATCH");
          assert.equal(s.scanIntegrityStatus, "UNTRUSTED");
        },
      );
      await scope(
        "physical gaps/count corruption and foreign owner/account/provider/type/scheme never validate",
        async (c) => {
          const { j, work } = await start(c);
          await repo.page(work, page(1, 101, entries(30000, 100)), 1);
          const base = await repo.job(c.owner.id, c.connection.id, j.id);
          let summary = await db.$transaction((tx) =>
            readScanSummary(tx, base, contract.sourceKeyScheme, null),
          );
          assert.equal(summary.reason, "MISSING_TERMINAL_PAGE");
          await db.$executeRaw`UPDATE sync_job_seen_pages SET page_no=2 WHERE job_id=${j.id}::uuid`;
          summary = await db.$transaction((tx) =>
            readScanSummary(tx, base, contract.sourceKeyScheme, 2),
          );
          assert.equal(summary.reason, "PAGE_GAP");
          await db.$executeRaw`UPDATE sync_job_seen_pages SET page_no=1,reported_total=100,source_identity_ids=source_identity_ids[1:99] WHERE job_id=${j.id}::uuid`;
          summary = await db.$transaction((tx) =>
            readScanSummary(tx, base, contract.sourceKeyScheme, 1),
          );
          assert.equal(summary.reason, "COUNT_MISMATCH");
          const [foreign] =
            await db.$queryRaw`SELECT id FROM sync_source_identities WHERE owner_user_id<>${c.owner.id}::uuid LIMIT 1`;
          assert.ok(foreign);
          await db.$executeRaw`UPDATE sync_job_seen_pages SET source_identity_ids=ARRAY[${foreign.id}::uuid],reported_total=1 WHERE job_id=${j.id}::uuid`;
          summary = await db.$transaction((tx) =>
            readScanSummary(tx, base, contract.sourceKeyScheme, 1),
          );
          assert.equal(summary.reason, "SCOPE_MISMATCH");
          const own = await db.syncSourceIdentity.findFirstOrThrow({
            where: { owner_user_id: c.owner.id },
          });
          await db.$executeRaw`UPDATE sync_job_seen_pages SET source_identity_ids=ARRAY[${own.id}::uuid] WHERE job_id=${j.id}::uuid`;
          for (const changed of [
            { external_account_id: "foreign" },
            { provider: "other" },
            { sync_type: "CUSTOMER" },
          ]) {
            summary = await db.$transaction((tx) =>
              readScanSummary(
                tx,
                { ...base, ...changed },
                contract.sourceKeyScheme,
                1,
              ),
            );
            assert.equal(summary.reason, "SCOPE_MISMATCH");
          }
          summary = await db.$transaction((tx) =>
            readScanSummary(tx, base, "different-scheme", 1),
          );
          assert.equal(summary.reason, "SCOPE_MISMATCH");
        },
      );
      await scope(
        "query semantics changing after admission fail closed with atomic checkpoint and identity preservation",
        async (c) => {
          const {
            defineUnishipFullScan,
            UNISHIP_SCAN_DEFINITION,
          } = require("../dist/shipment/infrastructure/uniship/uniship-full-scan");
          const { j, work } = await start(c);
          await repo.page(work, page(1, 101, entries(910000, 100)), 1);
          const changed = defineUnishipFullScan({
            ...UNISHIP_SCAN_DEFINITION,
            filters: [
              ...UNISHIP_SCAN_DEFINITION.filters,
              { column: "SoftDeleted", value: 0, condition: "equal" },
            ],
          }).contract;
          assert.notEqual(changed.scope, contract.scope);
          const other = makeRepo(true, changed);
          const next = await other.claim(randomUUID());
          assert.equal(next.id, j.id);
          const before = await state(j.id),
            observed = await seen(j.id);
          const identities = await db.syncSourceIdentity.findMany({
            where: { owner_user_id: c.owner.id },
          });
          const incoming = page(2, 101, [source(910100)]);
          incoming.scan = { ...incoming.scan, ...changed };
          await assert.rejects(
            other.page(next, incoming, 1),
            (e) => e.code === "SOURCE_INVALID",
          );
          assert.deepEqual(await state(j.id), before);
          assert.deepEqual(await seen(j.id), observed);
          assert.deepEqual(
            await db.syncSourceIdentity.findMany({
              where: { owner_user_id: c.owner.id },
            }),
            identities,
          );
          assert.equal(
            await db.syncJobItem.count({ where: { job_id: j.id } }),
            100,
          );
          // The original admitted semantics can still commit using the unchanged lease/checkpoint.
          await repo.page(next, page(2, 101, [source(910100)]), 1);
          assert.equal((await state(j.id)).scanIntegrityStatus, "VALIDATED");
          await finish(j.id);
        },
      );
      await scope(
        "missing/malformed metadata, wrong identity scheme and within-page duplicate fail before checkpoint",
        async (c) => {
          const { j, work } = await start(c),
            before = await state(j.id);
          for (const p of [
            { records: [source(1)], done: true },
            {
              ...page(1, 1, [source(1)]),
              scan: { ...page(1, 1, [source(1)]).scan, reportedTotal: "1" },
            },
            page(1, 2, [source(1), source(1)]),
            page(1, 1, [
              { ...source(1), identity: sourceKey("wrong-v1", ["1"]) },
            ]),
          ])
            await assert.rejects(repo.page(work, p, 1), (e) =>
              ["SOURCE_INVALID", "SOURCE_CONFLICT"].includes(e.code),
            );
          assert.deepEqual(await state(j.id), before);
          assert.equal((await seen(j.id)).length, 0);
          assert.equal(
            await db.syncSourceIdentity.count({
              where: { owner_user_id: c.owner.id },
            }),
            0,
          );
        },
      );
      for (const [name, table, event, body] of [
        [
          "identity resolution",
          "sync_source_identities",
          "INSERT",
          "RETURN NULL;",
        ],
        [
          "identity UPSERT",
          "sync_source_identities",
          "INSERT",
          "RAISE EXCEPTION 'owned identity injection';",
        ],
        [
          "seen-page INSERT",
          "sync_job_seen_pages",
          "INSERT",
          "RAISE EXCEPTION 'owned seen injection';",
        ],
        [
          "checkpoint UPDATE",
          "sync_jobs",
          "UPDATE",
          "IF NEW.processing_phase <> OLD.processing_phase THEN RAISE EXCEPTION 'owned checkpoint injection'; END IF;",
        ],
        [
          "summary persistence",
          "sync_jobs",
          "UPDATE",
          "IF NEW.scan_integrity_status IS NOT NULL THEN RAISE EXCEPTION 'owned summary injection'; END IF;",
        ],
      ])
        await scope(
          name +
            " failure rolls back identities, observation, staging and checkpoint",
          async (c) => {
            const { j, work } = await start(c),
              before = await state(j.id);
            try {
              await db.$executeRawUnsafe(
                `CREATE FUNCTION observation_inject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} RETURN NEW; END $$`,
              );
              await db.$executeRawUnsafe(
                `CREATE TRIGGER observation_inject BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION observation_inject()`,
              );
              await assert.rejects(
                repo.page(work, page(1, 1, [source(name)]), 1),
              );
              assert.deepEqual(await state(j.id), before);
              assert.equal((await seen(j.id)).length, 0);
              assert.equal(
                await db.syncSourceIdentity.count({
                  where: { owner_user_id: c.owner.id },
                }),
                0,
              );
              assert.equal(
                await db.syncJobItem.count({ where: { job_id: j.id } }),
                0,
              );
            } finally {
              await db.$executeRawUnsafe(
                `DROP TRIGGER IF EXISTS observation_inject ON ${table}`,
              );
              await db.$executeRawUnsafe(
                "DROP FUNCTION IF EXISTS observation_inject()",
              );
            }
            await repo.page(work, page(1, 1, [source(name)]), 1);
            assert.equal((await seen(j.id)).length, 1);
            assert.equal((await finish(j.id)).status, "SUCCEEDED");
          },
        );
      await scope(
        "lease lost during seen INSERT rolls the entire page back",
        async (c) => {
          const { j, work } = await start(c),
            before = await state(j.id);
          try {
            await db.$executeRawUnsafe(
              "CREATE FUNCTION observation_expire() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE sync_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=NEW.job_id; RETURN NEW; END $$",
            );
            await db.$executeRawUnsafe(
              "CREATE TRIGGER observation_expire BEFORE INSERT ON sync_job_seen_pages FOR EACH ROW EXECUTE FUNCTION observation_expire()",
            );
            await assert.rejects(
              repo.page(work, page(1, 1, [source("late-lease")]), 1),
              (e) => e.code === "SYNC_STALE",
            );
            assert.deepEqual(await state(j.id), before);
            assert.equal((await seen(j.id)).length, 0);
            assert.equal(
              await db.syncSourceIdentity.count({
                where: { owner_user_id: c.owner.id },
              }),
              0,
            );
          } finally {
            await db.$executeRawUnsafe(
              "DROP TRIGGER observation_expire ON sync_job_seen_pages",
            );
            await db.$executeRawUnsafe("DROP FUNCTION observation_expire()");
          }
          await repo.page(work, page(1, 1, [source("late-lease")]), 1);
          await finish(j.id);
        },
      );
      for (const status of ["FAILED", "CANCELLED"])
        await scope(
          status + " after complete FETCHING is never a successful FULL job",
          async (c) => {
            const { j, work } = await start(c);
            await repo.page(work, page(1, 1, [source(status)]), 1);
            assert.equal((await state(j.id)).scanIntegrityStatus, "VALIDATED");
            await db.syncJob.update({
              where: { id: j.id },
              data: { status, finished_at: new Date() },
            });
            await repo.cleanup();
            const result = await state(j.id);
            assert.equal(result.status, status);
            assert.notEqual(result.status, "SUCCEEDED");
            assert.equal(result.scanIntegrityStatus, "VALIDATED");
            assert.equal((await seen(j.id)).length, 0);
          },
        );
      await scope(
        "independent workers reject stale/replay and takeover resumes only committed page2",
        async (c) => {
          const other = makeRepo(),
            { j, work } = await start(c);
          await repo.page(work, page(1, 101, entries(40000, 100)), 1);
          await assert.rejects(
            other.page(work, page(1, 101, entries(50000, 100)), 1),
            (e) => e.code === "SYNC_STALE",
          );
          const w = await other.claim(randomUUID());
          assert.equal(w.next_page, 2);
          await other.wait(w, "PROVIDER_RETRY", 1);
          await db.$executeRaw`UPDATE sync_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE id=${j.id}::uuid`;
          const retry = await repo.claim(randomUUID());
          assert.equal(retry.next_page, 2);
          await db.$executeRaw`UPDATE sync_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${j.id}::uuid`;
          await assert.rejects(
            repo.page(retry, page(2, 101, [source(40100)]), 1),
            (e) => e.code === "SYNC_STALE",
          );
          const takeover = await other.claim(randomUUID());
          assert.equal(takeover.next_page, 2);
          assert.ok(takeover.lease_version > retry.lease_version);
          await assert.rejects(
            repo.page(retry, page(2, 101, [source(40100)]), 1),
            (e) => e.code === "SYNC_STALE",
          );
          await other.page(takeover, page(2, 101, [source(40100)]), 1);
          assert.equal((await seen(j.id)).length, 2);
          await finish(j.id, other);
        },
      );
      await scope(
        "two concurrent page commits cannot overwrite one checkpoint",
        async (c) => {
          const other = makeRepo(),
            { j, work } = await start(c),
            p = page(1, 1, [source("race")]);
          const out = await Promise.allSettled([
            repo.page(work, p, 1),
            other.page(work, p, 1),
          ]);
          assert.equal(out.filter((v) => v.status === "fulfilled").length, 1);
          assert.equal((await seen(j.id)).length, 1);
          assert.equal((await state(j.id)).fetched_count, 1);
          await finish(j.id);
        },
      );
      for (const change of ["disable", "delete", "generation", "lifecycle"])
        await scope(
          change + " fences prevent source/seen/checkpoint writes",
          async (c) => {
            const { j, work } = await start(c);
            if (change === "disable")
              await db.$transaction(async (tx) => {
                await tx.user.update({
                  where: { id: c.owner.id },
                  data: { status: "DISABLED" },
                });
                await new TransactionSyncDisablement(tx).disable(c.owner.id);
              });
            if (change === "delete")
              await db.$transaction(async (tx) => {
                await new TransactionSyncDisablement(tx).removeConnection(
                  c.owner.id,
                  c.connection.id,
                );
                await tx.carrierConnection.delete({
                  where: { id: c.connection.id },
                });
              });
            if (change === "generation")
              await db.carrierUserState.upsert({
                where: { userId: c.owner.id },
                create: { userId: c.owner.id, generation: 1 },
                update: { generation: { increment: 1 } },
              });
            if (change === "lifecycle")
              await db.carrierConnection.update({
                where: { id: c.connection.id },
                data: { lifecycleVersion: { increment: 1 } },
              });
            await assert.rejects(
              repo.page(work, page(1, 1, [source(change)]), 1),
            );
            assert.equal((await seen(j.id)).length, 0);
            assert.equal((await state(j.id)).fetched_count, 0);
          },
        );
      await scope(
        "active old pages survive retention-off cleanup; terminal summary/cleanup are idempotent",
        async (c) => {
          const { j, work } = await start(c);
          await repo.page(work, page(1, 101, entries(60000, 100)), 1);
          await db.$executeRaw`UPDATE sync_job_seen_pages SET created_at=clock_timestamp()-interval '2 days' WHERE job_id=${j.id}::uuid`;
          assert.equal(repo.config.retentionDays, null);
          await repo.cleanup();
          assert.equal((await seen(j.id)).length, 1);
          const w = await repo.claim(randomUUID());
          assert.equal(w.id, j.id);
          await repo.cleanup();
          assert.equal((await seen(j.id)).length, 1);
          await repo.wait(w, "SOURCE_INVALID", 0);
          await repo.cleanup();
          const s = await state(j.id);
          assert.equal(s.status, "FAILED");
          assert.equal(s.scanIntegrityStatus, "INCOMPLETE");
          assert.equal(s.scanIntegrityReason, "MISSING_TERMINAL_PAGE");
          assert.equal(s.scanObservedCount, 100);
          assert.equal((await seen(j.id)).length, 0);
          await repo.cleanup();
          assert.deepEqual(await state(j.id), s);
        },
      );
      await scope(
        "cancelled jobs retain summary; FK job delete cascades; cleanup skips a row locked into active state",
        async (c) => {
          const { j, work } = await start(c);
          await repo.page(work, page(1, 101, entries(70000, 100)), 1);
          await db.syncJob.update({
            where: { id: j.id },
            data: { status: "CANCELLED" },
          });
          const native = new Client({ connectionString: url.toString() });
          await native.connect();
          try {
            await native.query("BEGIN");
            await native.query(
              "UPDATE sync_jobs SET status='RUNNING' WHERE id=$1",
              [j.id],
            );
            await repo.cleanup();
            assert.equal((await seen(j.id)).length, 1);
            await native.query("COMMIT");
            await repo.cleanup();
            assert.equal((await seen(j.id)).length, 1);
          } finally {
            await native.query("ROLLBACK").catch(() => {});
            await native.end();
          }
          await db.syncJob.update({
            where: { id: j.id },
            data: { status: "CANCELLED" },
          });
          await repo.cleanup();
          assert.equal((await state(j.id)).scanIntegrityStatus, "INCOMPLETE");
          assert.equal((await seen(j.id)).length, 0);
          const next = await start(c);
          await repo.page(next.work, page(1, 101, entries(71000, 100)), 1);
          await db.syncJob.delete({ where: { id: next.j.id } });
          assert.equal((await seen(next.j.id)).length, 0);
        },
      );
      await scope(
        "generic non-observation provider preserves max500 and null summary",
        async (c) => {
          const legacy = makeRepo(false),
            { j, work } = await start(c, legacy);
          await legacy.page(
            work,
            { records: entries(80000, 500), done: true },
            1,
          );
          assert.equal((await seen(j.id)).length, 0);
          assert.equal((await state(j.id)).scanIntegrityStatus, null);
          assert.equal((await finish(j.id, legacy)).status, "SUCCEEDED");
        },
      );
      await require("./fixtures/sync-observation-reconciliation.cjs").verifyReconciliation(
        {
          t,
          db,
          makeRepo,
          lane,
          source,
          page,
          start,
          finish,
          state,
          seen,
          scope,
          workerUrl,
          apiUrl,
          contract,
        },
      );
      await require("./fixtures/sync-observation-reconciliation-schema.cjs").verifyReconciliationSchema(
        { t, db, lane, workerUrl, apiUrl, adminUrl: url.toString() },
      );
      await require("./fixtures/sync-observation-schema.cjs").verifyObservationSchema(
        {
          t,
          db,
          workerUrl: apiUrl ? workerUrl : null,
          apiUrl,
          adminUrl: url.toString(),
          lane,
        },
      );
      await require("./fixtures/sync-observation-reconciliation-benchmark.cjs").benchmarkReconciliation(
        {
          t,
          db,
          makeRepo,
          lane,
          contract,
          readUrl: apiUrl ?? url.toString(),
          readContext: apiUrl ? "restricted-api" : "unsigned-privileged",
        },
      );
      await require("./fixtures/sync-observation-benchmark.cjs").benchmarkObservation(
        { t, db, repo, lane },
      );
    } finally {
      for (const r of repos) await r.close();
      await db?.$disconnect();
      if (owned)
        await admin.$executeRawUnsafe(
          `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
        );
      await admin.$disconnect();
    }
  },
);
