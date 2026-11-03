// Real migrated PostgreSQL. No live provider, shared cluster role changes or user volumes.
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { execFileSync, spawn } = require("node:child_process");
const { resolve } = require("node:path");
const { clearTimeout } = require("node:timers");
const { createDatabase } = require("@nexora/database");
const {
  SyncRepository,
} = require("../dist/sync/infrastructure/sync-job.repository");
const {
  CarrierAdapter,
} = require("../dist/carrier/infrastructure/carrier.adapter");
const {
  sourceKey,
  loadSyncConfig,
  SyncError,
} = require("../dist/sync/domain/sync-policy");
const {
  SyncJobExecutor,
} = require("../dist/sync/application/sync-job-executor.service");
const {
  PostgresProviderBudget,
} = require("../dist/carrier/infrastructure/uniship/postgres-provider-budget");
const {
  LifecycleFailure,
  LifecycleCode,
} = require("../dist/carrier/domain/lifecycle");
const {
  UserManagementAdapter,
} = require("../dist/identity/infrastructure/user-management.adapter");
test(
  "Sync genuine PostgreSQL queue, staging, outcomes, fences, lifecycle and retention",
  { timeout: 240000 },
  async (t) => {
    assert.ok(process.env.DATABASE_URL, "genuine PostgreSQL required");
    const admin = createDatabase(process.env.DATABASE_URL),
      name = "nexora_sync_" + randomUUID().replaceAll("-", "");
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    let owned = false,
      db,
      repo,
      carrier,
      identity,
      b1,
      b2;
    const cfg = loadSyncConfig({
        SYNC_ENABLED: "true",
        SYNC_SHIPMENT_ENABLED: "true",
        SYNC_CUSTOMER_ENABLED: "true",
        SYNC_RESOLVED_RETENTION_DAYS: "1",
      }),
      provider = {
        strategy: () => "FULL",
        fetch: async () => {
          throw Error("only injected test providers");
        },
      },
      processor = {
        version: 1,
        supports: () => true,
        apply: async () => ({ outcome: "NEEDS_REVIEW" }),
      };
    const record = (key, n = 1) => ({
      identity: sourceKey("fixture-v1", [String(key)]),
      payload: { value: n },
    });
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
      repo = new SyncRepository(
        url.toString(),
        cfg,
        provider,
        processor,
        "shared",
      );
      carrier = new CarrierAdapter(url.toString());
      identity = new UserManagementAdapter(url.toString());
      const owner = await db.user.create({
          data: { username: "sync-" + randomUUID(), role: "OPERATOR" },
        }),
        other = await db.user.create({
          data: { username: "other-" + randomUUID(), role: "OPERATOR" },
        }),
        adminUser = await db.user.create({
          data: { username: "admin-" + randomUUID(), role: "ADMIN" },
        });
      let seq = 0;
      const connection = () =>
        db.carrierConnection.create({
          data: {
            userId: owner.id,
            provider: "uniship",
            externalAccountId: "sync-" + seq++,
            displayName: "Synthetic Sync",
            status: "CONNECTED",
          },
        });
      const c = await connection();
      const claim = async () => {
        const j = await repo.claim(randomUUID());
        assert.ok(j);
        return j;
      };
      const finish = async (j, p = processor) => {
        let state = await repo.job(owner.id, c.id, j.id);
        while (!["SUCCEEDED", "FAILED", "CANCELLED"].includes(state.status)) {
          const work = await claim();
          await repo.apply(work, p);
          state = await repo.job(owner.id, c.id, j.id);
        }
        return state;
      };
      await t.test(
        "20 concurrent admissions return one active lane",
        async () => {
          const jobs = await Promise.all(
            Array.from({ length: 20 }, () =>
              repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL"),
            ),
          );
          assert.equal(new Set(jobs.map((j) => j.id)).size, 1);
          await assert.rejects(
            repo.admit(other.id, c.id, "SHIPMENT", "MANUAL"),
            (e) => e.code === "NOT_FOUND",
          );
        },
      );
      await t.test(
        "10000 sources and second full scan create exactly30 changed/new items",
        async () => {
          const jobs = await repo.jobs(owner.id, c.id, 1, 20),
            first = jobs.jobs[0];
          for (let page = 1; page <= 20; page++)
            await repo.page(
              await claim(),
              {
                records: Array.from({ length: 500 }, (_, i) =>
                  record((page - 1) * 500 + i),
                ),
                done: page === 20,
                nextPage: page + 1,
              },
              1,
            );
          assert.equal((await finish(first)).needs_review_count, 10000);
          const second = await repo.admit(owner.id, c.id, "SHIPMENT", "AUTO");
          for (let page = 1; page <= 21; page++) {
            const start = (page - 1) * 500,
              length = Math.min(500, 10005 - start);
            await repo.page(
              await claim(),
              {
                records: Array.from({ length }, (_, i) =>
                  record(start + i, start + i < 25 ? 2 : 1),
                ),
                done: page === 21,
                nextPage: page + 1,
              },
              1,
            );
          }
          const counts =
            await db.$queryRaw`SELECT (SELECT count(*) FROM sync_source_identities)::int AS identities,(SELECT count(*) FROM provider_source_records)::int AS records,(SELECT count(*) FROM sync_job_items WHERE job_id=${second.id}::uuid)::int AS items`;
          assert.deepEqual(counts[0], {
            identities: 10005,
            records: 10005,
            items: 30,
          });
          const done = await finish(second);
          assert.equal(done.new_count, 5);
          assert.equal(done.changed_count, 25);
          assert.equal(done.unchanged_count, 9975);
        },
      );
      await t.test(
        "F1 conditional identities preserve unchanged tuples and ordering without version drift",
        async () => {
          const rows = (order, changed = 0) =>
            Array.from({ length: 100 }, (_, i) => ({
              ...record("conditional-" + i, i < changed ? 2 : 1),
              ...(order === null ? {} : { sourceOrder: order }),
            }));
          const scan = async (records) => {
            const job = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
            await repo.page(await claim(), { records, done: true }, 1);
            await finish(job);
            return repo.job(owner.id, c.id, job.id);
          };
          const snapshot = () =>
            db.$queryRaw`SELECT s.source_key,s.updated_at,s.observed_source_version,s.last_source_order,s.last_observed_hash,s.xmin::text AS identity_tuple,p.xmin::text AS payload_tuple,p.updated_at AS payload_updated_at,p.normalized_payload FROM sync_source_identities s JOIN provider_source_records p ON p.source_identity_id=s.id WHERE s.source_key LIKE '%conditional-%' ORDER BY s.source_key`;
          await scan(rows(10));
          const first = await snapshot();
          const unchanged = await scan(rows(10));
          assert.deepEqual(
            [
              unchanged.new_count,
              unchanged.changed_count,
              unchanged.unchanged_count,
            ],
            [0, 0, 100],
          );
          assert.deepEqual(
            await snapshot(),
            first,
            "unchanged fetch must not UPDATE either physical tuple",
          );
          await scan(
            rows(10, 5).map((r, i) => ({ ...r, sourceOrder: i < 5 ? 11 : 10 })),
          );
          const changed = await snapshot();
          assert.equal(
            changed.filter((r) => r.observed_source_version === 2).length,
            5,
          );
          assert.equal(
            changed.filter(
              (r, i) => r.identity_tuple !== first[i].identity_tuple,
            ).length,
            5,
          );
          await scan(rows(20, 5));
          const advanced = await snapshot();
          for (let i = 0; i < 100; i++) {
            assert.equal(advanced[i].last_source_order, 20n);
            assert.equal(
              advanced[i].observed_source_version,
              changed[i].observed_source_version,
            );
            assert.equal(advanced[i].payload_tuple, changed[i].payload_tuple);
          }
          await scan(rows(null, 5));
          assert.deepEqual(
            await snapshot(),
            advanced,
            "null order cannot clear trusted ordering or write unchanged rows",
          );
          await scan(rows(15).map((r) => ({ ...r, payload: { value: 999 } })));
          assert.deepEqual(
            await snapshot(),
            advanced,
            "stale source response cannot overwrite ordering/hash/payload",
          );
        },
      );
      await t.test(
        "F7 ambiguous ordering rolls back before every bulk write and preserves unordered scans",
        async (ordering) => {
          const lane = await connection();
          const source = (key, value, order) => ({
            ...record("ordering-" + key, value),
            ...(order === undefined ? {} : { sourceOrder: order }),
          });
          const state = () =>
            db.$queryRaw`SELECT s.*,s.xmin::text AS identity_tuple,p.xmin::text AS payload_tuple,p.normalized_payload,p.payload_hash,p.source_version,p.processor_version,p.updated_at AS payload_updated_at FROM sync_source_identities s LEFT JOIN provider_source_records p ON p.source_identity_id=s.id WHERE s.owner_user_id=${owner.id}::uuid AND s.external_account_id=${lane.externalAccountId} ORDER BY s.source_key`;
          const start = () =>
            repo.admit(owner.id, lane.id, "SHIPMENT", "MANUAL");
          const applyAll = async (id) => {
            while (
              (await repo.job(owner.id, lane.id, id)).status !== "SUCCEEDED"
            )
              await repo.apply(await claim(), processor);
          };
          const scan = async (records) => {
            const j = await start();
            await repo.page(
              await claim(),
              { records, done: true, watermark: "confirmed" },
              1,
            );
            await applyAll(j.id);
            return j;
          };
          const conflict = async (records) => {
            const j = await start(),
              work = await claim();
            const before = await state(),
              checkpoint =
                await db.$queryRaw`SELECT * FROM sync_jobs WHERE id=${j.id}::uuid`,
              watermark =
                await db.$queryRaw`SELECT * FROM sync_configs WHERE carrier_connection_id=${lane.id}::uuid`;
            try {
              await assert.rejects(
                repo.page(
                  work,
                  {
                    records,
                    done: true,
                    nextPage: 9,
                    watermark: "unconfirmed",
                  },
                  1,
                ),
                (e) => e instanceof SyncError && e.code === "SOURCE_CONFLICT",
              );
              assert.deepEqual(
                await state(),
                before,
                "no identity or staging tuple may change",
              );
              assert.deepEqual(
                await db.$queryRaw`SELECT * FROM sync_jobs WHERE id=${j.id}::uuid`,
                checkpoint,
                "no checkpoint, counters or target watermark may advance",
              );
              assert.deepEqual(
                await db.$queryRaw`SELECT * FROM sync_configs WHERE carrier_connection_id=${lane.id}::uuid`,
                watermark,
                "completed watermark remains confirmed",
              );
              assert.equal(
                await db.syncJobItem.count({ where: { job_id: j.id } }),
                0,
              );
            } finally {
              await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL,finished_at=clock_timestamp() WHERE id=${j.id}::uuid`;
            }
          };
          try {
            await repo.configure(owner.id, lane.id, "SHIPMENT", false, 60);
            await scan([source("trusted", 1, 20), source("unordered", 1)]);
            await ordering.test(
              "missing order with changed hash conflicts atomically",
              () => conflict([source("trusted", 2)]),
            );
            await ordering.test(
              "equal order with changed hash cannot choose an ambiguous revision",
              () => conflict([source("trusted", 2, 20)]),
            );
            await ordering.test(
              "one ambiguous row rejects preceding new and changed rows in the same batch",
              () =>
                conflict([
                  source("new", 1),
                  source("unordered", 2),
                  source("trusted", 2),
                ]),
            );
            await ordering.test(
              "equal/missing order and identical payload leave physical tuples unchanged",
              async () => {
                const before = await state();
                await scan([source("trusted", 1, 20)]);
                assert.deepEqual(await state(), before);
                await scan([source("trusted", 1)]);
                assert.deepEqual(await state(), before);
              },
            );
            await ordering.test(
              "older changed response is ignored without creating a processing item",
              async () => {
                const before = await state(),
                  j = await scan([source("trusted", 999, 15)]);
                assert.deepEqual(await state(), before);
                assert.equal(
                  await db.syncJobItem.count({ where: { job_id: j.id } }),
                  0,
                );
              },
            );
            await ordering.test(
              "newer order and changed hash advance exactly one payload version/item",
              async () => {
                const j = await scan([source("trusted", 2, 21)]),
                  row = (await state()).find(
                    (r) => r.last_source_order === 21n,
                  );
                assert.equal(row.observed_source_version, 2);
                assert.equal(row.source_version, 2);
                assert.deepEqual(row.normalized_payload, { value: 2 });
                const items = await db.syncJobItem.findMany({
                  where: { job_id: j.id },
                });
                assert.equal(items.length, 1);
                assert.equal(items[0].source_version, 2);
              },
            );
            await ordering.test(
              "unordered changed payload preserves full-fetch hash comparison",
              async () => {
                await scan([source("unordered", 2)]);
                const row = (await state()).find(
                  (r) => r.last_source_order === null,
                );
                assert.equal(row.observed_source_version, 2);
                assert.deepEqual(row.normalized_payload, { value: 2 });
              },
            );
            await ordering.test(
              "identical-hash duplicates retain greatest order regardless of input order",
              async () => {
                await scan([
                  source("duplicate-a", 1, 20),
                  source("duplicate-a", 1),
                  source("duplicate-a", 1, 15),
                  source("duplicate-b", 1),
                  source("duplicate-b", 1, 20),
                ]);
                for (const row of (await state()).filter((r) =>
                  r.source_key.includes("duplicate-"),
                )) {
                  assert.equal(row.last_source_order, 20n);
                  assert.equal(row.observed_source_version, 1);
                }
                await conflict([source("duplicate-a", 2)]);
              },
            );
          } finally {
            await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL,finished_at=clock_timestamp() WHERE carrier_connection_id=${lane.id}::uuid AND status IN ('QUEUED','RUNNING','WAITING')`;
          }
        },
      );

      await t.test(
        "F2 new versions clear retry deadlines and future PENDING/RETRYABLE items do not hot-loop",
        async () => {
          const jobs = [];
          const start = async (value, version = 1) => {
            const j = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
            jobs.push(j.id);
            await repo.page(
              await claim(),
              { records: [record("retry-version", value)], done: true },
              version,
            );
            return j;
          };
          const retry = {
            ...processor,
            apply: async () => ({
              outcome: "RETRYABLE_ERROR",
              retryAfterMs: 60000,
            }),
          };
          try {
            const old = await start(1);
            await repo.apply(await claim(), retry);
            const originalDeadline = (
              await db.$queryRaw`SELECT p.next_retry_at FROM provider_source_records p JOIN sync_source_identities s ON s.id=p.source_identity_id WHERE s.source_key=${sourceKey("fixture-v1", ["retry-version"]).key}`
            )[0].next_retry_at;
            assert.ok(
              (await repo.job(owner.id, c.id, old.id)).available_at >
                new Date(),
            );
            for (let i = 0; i < 5; i++)
              assert.equal(await repo.claim(randomUUID()), null);
            await db.$executeRaw`UPDATE sync_jobs SET status='FAILED',finished_at=clock_timestamp() WHERE id=${old.id}::uuid`;
            const same = await start(1);
            const unchangedRetry = (
              await db.$queryRaw`SELECT p.next_retry_at,p.attempt_count FROM provider_source_records p JOIN sync_source_identities s ON s.id=p.source_identity_id WHERE s.source_key=${sourceKey("fixture-v1", ["retry-version"]).key}`
            )[0];
            assert.equal(
              unchangedRetry.next_retry_at.getTime(),
              originalDeadline.getTime(),
            );
            assert.equal(unchangedRetry.attempt_count, 1);
            await repo.apply(await claim(), processor);
            assert.ok(
              (await repo.job(owner.id, c.id, same.id)).available_at >
                new Date(),
            );
            assert.equal(await repo.claim(randomUUID()), null);
            await db.$executeRaw`UPDATE sync_jobs SET status='FAILED',finished_at=clock_timestamp() WHERE id=${same.id}::uuid`;
            const fresh = await start(2);
            let source = (
              await db.$queryRaw`SELECT p.* FROM provider_source_records p JOIN sync_source_identities s ON s.id=p.source_identity_id WHERE s.source_key=${sourceKey("fixture-v1", ["retry-version"]).key}`
            )[0];
            assert.equal(source.next_retry_at, null);
            assert.equal(source.processing_status, "PENDING");
            assert.equal(source.attempt_count, 0);
            await finish(fresh);
            const upgraded = await start(2, 2);
            // Legacy PENDING with a future deadline must wait, not claim/release repeatedly.
            await db.$executeRaw`UPDATE provider_source_records SET next_retry_at=clock_timestamp()+interval '1 minute' WHERE source_identity_id=${source.source_identity_id}::uuid`;
            await repo.apply(await claim(), { ...processor, version: 2 });
            const waiting = await repo.job(owner.id, c.id, upgraded.id);
            assert.equal(waiting.status, "WAITING");
            assert.ok(waiting.available_at > new Date());
            for (let i = 0; i < 5; i++)
              assert.equal(await repo.claim(randomUUID()), null);
            assert.equal(
              (await repo.job(owner.id, c.id, upgraded.id)).lease_version,
              waiting.lease_version,
            );
            await db.$executeRaw`UPDATE provider_source_records SET processing_status='RETRYABLE_ERROR',attempt_count=1 WHERE source_identity_id=${source.source_identity_id}::uuid`;
            await db.$executeRaw`UPDATE sync_job_items SET processing_outcome='RETRYABLE_ERROR',attempt_count=1 WHERE job_id=${upgraded.id}::uuid`;
            await db.$executeRaw`UPDATE sync_jobs SET status='FAILED',finished_at=clock_timestamp() WHERE id=${upgraded.id}::uuid`;
            const processorUpgrade = await start(2, 3);
            source = (
              await db.$queryRaw`SELECT * FROM provider_source_records WHERE source_identity_id=${source.source_identity_id}::uuid`
            )[0];
            assert.equal(source.next_retry_at, null);
            assert.equal(source.source_version, 2);
            assert.equal(source.processor_version, 3);
            await finish(processorUpgrade, { ...processor, version: 3 });
          } finally {
            await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL,finished_at=clock_timestamp() WHERE id=ANY(${jobs}::uuid[]) AND status IN ('QUEUED','RUNNING','WAITING')`;
          }
        },
      );
      await t.test(
        "F3 scheduler admits the101st due lane and preserves manual/concurrent/WAITING lane uniqueness",
        async () => {
          const schedulerOwner = await db.user.create({
            data: { username: "scheduler-" + randomUUID(), role: "OPERATOR" },
          });
          const connections = [];
          try {
            for (let i = 0; i < 101; i++) {
              const lane = await db.carrierConnection.create({
                data: {
                  userId: schedulerOwner.id,
                  provider: "uniship",
                  externalAccountId: "scheduler-" + randomUUID(),
                  displayName: "Synthetic",
                  status: "CONNECTED",
                },
              });
              connections.push(lane);
              await repo.configure(
                schedulerOwner.id,
                lane.id,
                "SHIPMENT",
                true,
                60,
              );
            }
            await db.$executeRaw`UPDATE sync_configs SET next_run_at=clock_timestamp()-interval '1 minute' WHERE carrier_connection_id=ANY(${connections.map((r) => r.id)}::uuid[])`;
            await repo.schedule();
            assert.equal(
              (
                await db.$queryRaw`SELECT count(*)::int AS n FROM sync_jobs WHERE owner_user_id=${schedulerOwner.id}::uuid`
              )[0].n,
              100,
            );
            await repo.schedule();
            assert.equal(
              (
                await db.$queryRaw`SELECT count(*)::int AS n FROM sync_jobs WHERE owner_user_id=${schedulerOwner.id}::uuid`
              )[0].n,
              101,
            );
            const first = await repo.admit(
              schedulerOwner.id,
              connections[0].id,
              "SHIPMENT",
              "MANUAL",
            );
            await db.$executeRaw`UPDATE sync_jobs SET status='WAITING' WHERE id=${first.id}::uuid`;
            await db.$executeRaw`UPDATE sync_jobs SET status=CASE WHEN carrier_connection_id=${connections[1].id}::uuid THEN 'FAILED' ELSE 'SUCCEEDED' END,finished_at=clock_timestamp() WHERE carrier_connection_id=ANY(${connections.slice(1, 3).map((r) => r.id)}::uuid[])`;
            const [manual] = await Promise.all([
              repo.admit(
                schedulerOwner.id,
                connections[1].id,
                "SHIPMENT",
                "MANUAL",
              ),
              repo.schedule(),
              repo.schedule(),
            ]);
            assert.equal(
              (
                await repo.admit(
                  schedulerOwner.id,
                  connections[1].id,
                  "SHIPMENT",
                  "AUTO",
                )
              ).id,
              manual.id,
            );
            assert.equal(
              (
                await repo.admit(
                  schedulerOwner.id,
                  connections[0].id,
                  "SHIPMENT",
                  "AUTO",
                )
              ).id,
              first.id,
            );
            const active =
              await db.$queryRaw`SELECT carrier_connection_id,count(*)::int AS n FROM sync_jobs WHERE owner_user_id=${schedulerOwner.id}::uuid AND status IN ('QUEUED','RUNNING','WAITING') GROUP BY carrier_connection_id`;
            assert.equal(active.length, 101);
            assert.ok(active.every((r) => r.n === 1));
          } finally {
            await db.$executeRaw`UPDATE sync_configs SET enabled=false WHERE carrier_connection_id=ANY(${connections.map((r) => r.id)}::uuid[])`;
            await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL,finished_at=clock_timestamp() WHERE owner_user_id=${schedulerOwner.id}::uuid AND status IN ('QUEUED','RUNNING','WAITING')`;
          }
        },
      );
      await t.test(
        "cross-page current version replaces pending manifest; rejected retention stays resolved",
        async () => {
          const j = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
          await repo.page(
            await claim(),
            { records: [record("between-pages", 1)], done: false, nextPage: 2 },
            1,
          );
          await repo.page(
            await claim(),
            { records: [record("between-pages", 2)], done: true },
            1,
          );
          const items =
            await db.$queryRaw`SELECT source_version FROM sync_job_items WHERE job_id=${j.id}::uuid`;
          assert.deepEqual(items, [{ source_version: 2 }]);
          const rejected = {
            ...processor,
            apply: async () => ({
              outcome: "REJECTED_SOURCE",
              code: "SOURCE_INVALID",
            }),
          };
          await finish(j, rejected);
          await db.$executeRaw`UPDATE provider_source_records SET processed_at=clock_timestamp()-interval '2 days' WHERE processing_status='REJECTED_SOURCE'`;
          await repo.cleanup();
          const next = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
          await repo.page(
            await claim(),
            { records: [record("between-pages", 2)], done: true },
            1,
          );
          assert.equal(
            (
              await db.$queryRaw`SELECT count(*)::int AS n FROM sync_job_items WHERE job_id=${next.id}::uuid`
            )[0].n,
            0,
          );
          await finish(next);
        },
      );
      await t.test(
        "99 linked existing real Customers +1 review, no fabricated domain create; retention and processor version",
        async () => {
          const customers = [];
          for (let i = 0; i < 99; i++)
            customers.push(
              await db.customer.create({
                data: {
                  ownerUserId: owner.id,
                  createdByUserId: owner.id,
                  name: "Synthetic",
                  phone: "+849" + String(i).padStart(8, "0"),
                  addresses: {
                    create: {
                      recipientName: "Synthetic",
                      recipientPhone: "+849" + String(i).padStart(8, "0"),
                      addressText: "Synthetic address",
                      isDefault: true,
                    },
                  },
                },
              }),
            );
          const p = {
            version: 1,
            supports: () => true,
            apply: async (source, session) => {
              const n = source.payload.value;
              if (n === 99) return { outcome: "NEEDS_REVIEW" };
              await session.linkExistingCustomer(customers[n].id);
              return { outcome: "APPLIED" };
            },
          };
          const j = await repo.admit(owner.id, c.id, "CUSTOMER", "MANUAL");
          await repo.page(
            await claim(),
            {
              records: Array.from({ length: 100 }, (_, i) =>
                record("customer-" + i, i),
              ),
              done: true,
            },
            1,
          );
          const work = await claim();
          await repo.apply(work, p);
          const done = await repo.job(owner.id, c.id, j.id);
          assert.equal(done.status, "SUCCEEDED");
          assert.equal(done.applied_count, 99);
          assert.equal(done.needs_review_count, 1);
          await db.$executeRaw`UPDATE provider_source_records SET processed_at=clock_timestamp()-interval '2 days' WHERE processing_status='APPLIED'`;
          assert.equal(await repo.cleanup(), 99);
          const next = await repo.admit(owner.id, c.id, "CUSTOMER", "MANUAL");
          await repo.page(
            await claim(),
            { records: [record("customer-0", 0)], done: true },
            1,
          );
          assert.equal(
            (
              await db.$queryRaw`SELECT count(*)::int AS n FROM sync_job_items WHERE job_id=${next.id}::uuid`
            )[0].n,
            0,
          );
          await repo.apply(await claim(), p);
          const upgraded = await repo.admit(
            owner.id,
            c.id,
            "CUSTOMER",
            "MANUAL",
          );
          await repo.page(
            await claim(),
            { records: [record("customer-0", 0)], done: true },
            2,
          );
          const source =
            await db.$queryRaw`SELECT source_version,processor_version FROM provider_source_records p JOIN sync_source_identities s ON s.id=p.source_identity_id WHERE s.source_key=${sourceKey("fixture-v1", ["customer-0"]).key}`;
          assert.deepEqual(source, [
            { source_version: 1, processor_version: 2 },
          ]);
          await repo.apply(await claim(), { ...p, version: 2 });
          assert.equal(
            (await repo.job(owner.id, c.id, upgraded.id)).status,
            "SUCCEEDED",
          );
        },
      );
      await t.test(
        "non-APPLIED decisions never persist proposed mappings; existing mappings cannot switch owner-scoped targets",
        async () => {
          const customer = await db.customer.findFirst({
              where: { ownerUserId: owner.id },
            }),
            another = await db.customer.findFirst({
              where: { ownerUserId: owner.id, id: { not: customer.id } },
            });
          let j;
          try {
            j = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
            await repo.page(
              await claim(),
              {
                records: [
                  record("defer-review", 0),
                  record("defer-reject", 1),
                  record("defer-retry", 2),
                ],
                done: true,
              },
              1,
            );
            await repo.apply(await claim(), {
              ...processor,
              apply: async (source, session) => {
                await session.linkExistingCustomer(customer.id);
                return {
                  outcome: [
                    "NEEDS_REVIEW",
                    "REJECTED_SOURCE",
                    "RETRYABLE_ERROR",
                  ][source.payload.value],
                };
              },
            });
            const mapped =
              await db.$queryRaw`SELECT count(*)::int AS n FROM sync_source_identities s JOIN sync_job_items i ON i.source_identity_id=s.id WHERE i.job_id=${j.id}::uuid AND s.customer_id IS NOT NULL`;
            assert.equal(mapped[0].n, 0);
          } finally {
            if (j)
              await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
          }
          const original = (
            await db.$queryRaw`SELECT customer_id FROM sync_source_identities WHERE source_key=${sourceKey("fixture-v1", ["customer-0"]).key}`
          )[0].customer_id;
          const wrong = original === customer.id ? another.id : customer.id;
          try {
            j = await repo.admit(owner.id, c.id, "CUSTOMER", "MANUAL");
            await repo.page(
              await claim(),
              { records: [record("customer-0", 0)], done: true },
              3,
            );
            await assert.rejects(
              repo.apply(await claim(), {
                ...processor,
                version: 3,
                apply: async (source, session) => {
                  await session.linkExistingCustomer(wrong);
                  return { outcome: "APPLIED" };
                },
              }),
              (e) => e.code === "SOURCE_CONFLICT",
            );
            assert.equal(
              (
                await db.$queryRaw`SELECT customer_id FROM sync_source_identities WHERE source_key=${sourceKey("fixture-v1", ["customer-0"]).key}`
              )[0].customer_id,
              original,
            );
          } finally {
            if (j)
              await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
          }
        },
      );
      await t.test(
        "exhausted poison record does not block valid records beyond the first100 batch",
        async () => {
          const poisonRepo = new SyncRepository(
            url.toString(),
            { ...cfg, maxAttempts: 1 },
            provider,
            processor,
          );
          let j;
          try {
            j = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
            await repo.page(
              await claim(),
              {
                records: Array.from({ length: 201 }, (_, i) =>
                  record("poison-" + i, i),
                ),
                done: true,
              },
              1,
            );
            await db.$executeRaw`UPDATE sync_job_items i SET id='00000000-0000-0000-0000-000000000001'::uuid FROM provider_source_records p WHERE i.source_identity_id=p.source_identity_id AND i.job_id=${j.id}::uuid AND p.normalized_payload->>'value'='0'`;
            const p = {
              ...processor,
              apply: async (source) => ({
                outcome:
                  source.payload.value === 0
                    ? "RETRYABLE_ERROR"
                    : "NEEDS_REVIEW",
              }),
            };
            await poisonRepo.apply(await claim(), p);
            assert.equal(
              (await repo.job(owner.id, c.id, j.id)).status,
              "WAITING",
            );
            let state = await repo.job(owner.id, c.id, j.id);
            while (state.status === "WAITING") {
              await poisonRepo.apply(await claim(), p);
              state = await repo.job(owner.id, c.id, j.id);
            }
            assert.equal(state.status, "FAILED");
            assert.equal(state.needs_review_count, 200);
          } finally {
            await poisonRepo.close();
            if (j)
              await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
          }
        },
      );
      await t.test(
        "persisted unsupported oldest job does not starve supported lanes after deployment",
        async () => {
          let a, b;
          const changed = new SyncRepository(
            url.toString(),
            cfg,
            {
              ...provider,
              strategy: (_provider, type) =>
                type === "CUSTOMER" ? "FULL" : null,
            },
            processor,
          );
          try {
            a = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
            b = await repo.admit(owner.id, c.id, "CUSTOMER", "MANUAL");
            const next = await changed.claim(randomUUID());
            assert.equal(next?.id, b.id);
            assert.equal(
              (await repo.job(owner.id, c.id, a.id)).status,
              "QUEUED",
            );
          } finally {
            await changed.close();
            for (const j of [a, b])
              if (j)
                await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
          }
        },
      );
      await t.test(
        "FULL executor resumes committed pages and manual INCREMENTAL resumes last successful watermark without config",
        async () => {
          const live = await connection(),
            seen = [];
          const full = {
            strategy: () => "FULL",
            supports: () => true,
            fetch: async (job) => {
              seen.push(job.next_page);
              return {
                records: [record("full-" + job.next_page)],
                done: job.next_page === 3,
                nextPage: job.next_page + 1,
                watermark: job.next_page === 3 ? "wm-1" : undefined,
              };
            },
          };
          let q = new SyncRepository(url.toString(), cfg, full, processor);
          try {
            const j = await q.admit(owner.id, live.id, "SHIPMENT", "MANUAL");
            assert.equal(j.fetch_strategy, "FULL");
            let work = await q.claim(randomUUID());
            await new SyncJobExecutor(q, full, processor).execute(
              work,
              new globalThis.AbortController().signal,
            );
            await q.close();
            q = new SyncRepository(url.toString(), cfg, full, processor);
            const executor = new SyncJobExecutor(q, full, processor);
            for (
              let i = 0;
              i < 10 &&
              (await q.job(owner.id, live.id, j.id)).status !== "SUCCEEDED";
              i++
            ) {
              work = await q.claim(randomUUID());
              assert.ok(work);
              await executor.execute(
                work,
                new globalThis.AbortController().signal,
              );
            }
            assert.deepEqual(seen, [1, 2, 3]);
            assert.equal(
              (await q.job(owner.id, live.id, j.id)).status,
              "SUCCEEDED",
            );
            assert.equal(
              (await q.job(owner.id, live.id, j.id)).fetched_count,
              3,
            );
          } finally {
            await q.close();
          }
          const incremental = {
            ...full,
            strategy: () => "INCREMENTAL",
            fetch: async (job) => {
              assert.equal(job.target_watermark, "wm-1");
              return { records: [], done: true, watermark: "wm-2" };
            },
          };
          const inc = new SyncRepository(
            url.toString(),
            cfg,
            incremental,
            processor,
          );
          try {
            const j = await inc.admit(owner.id, live.id, "SHIPMENT", "MANUAL");
            assert.equal(j.fetch_strategy, "INCREMENTAL");
            const executor = new SyncJobExecutor(inc, incremental, processor);
            for (
              let i = 0;
              i < 4 &&
              (await inc.job(owner.id, live.id, j.id)).status !== "SUCCEEDED";
              i++
            ) {
              const work = await inc.claim(randomUUID());
              assert.ok(work);
              await executor.execute(
                work,
                new globalThis.AbortController().signal,
              );
            }
            assert.equal(
              (await inc.job(owner.id, live.id, j.id)).status,
              "SUCCEEDED",
            );
            assert.equal(
              (await inc.job(owner.id, live.id, j.id)).target_watermark,
              "wm-2",
            );
          } finally {
            await inc.close();
          }
        },
      );
      await t.test(
        "executor renews the lease while a real delayed provider page is outside the transaction",
        async () => {
          const con = await connection(),
            slow = {
              strategy: () => "FULL",
              fetch: async () => {
                await new Promise((r) => setTimeout(r, 2300));
                return { records: [record("heartbeat")], done: true };
              },
            },
            q = new SyncRepository(
              url.toString(),
              { ...cfg, leaseSeconds: 2 },
              slow,
              processor,
            );
          let j;
          try {
            j = await q.admit(owner.id, con.id, "SHIPMENT", "MANUAL");
            const work = await q.claim(randomUUID());
            await new SyncJobExecutor(q, slow, processor).execute(
              work,
              new globalThis.AbortController().signal,
            );
            const state = await q.job(owner.id, con.id, j.id);
            assert.equal(state.status, "WAITING");
            assert.equal(state.fetched_count, 1);
          } finally {
            await q.close();
            if (j)
              await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
          }
        },
      );
      await t.test(
        "expired lease cannot commit staging/checkpoint; renewed worker continues",
        async () => {
          const j = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL"),
            a = await claim();
          await db.$executeRaw`UPDATE sync_jobs SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${j.id}::uuid`;
          const b = await claim();
          assert.ok(b.lease_version > a.lease_version);
          await assert.rejects(
            repo.page(a, { records: [record("stale")], done: true }, 1),
            (e) => e.code === "SYNC_STALE",
          );
          await repo.page(b, { records: [], done: true }, 1);
          await finish(j);
        },
      );
      await t.test(
        "crash rollback leaves checkpoint and payload atomic; retry no duplication",
        async () => {
          const j = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL"),
            a = await claim();
          await db.$executeRawUnsafe(
            "CREATE FUNCTION reject_checkpoint() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$",
          );
          await db.$executeRawUnsafe(
            "CREATE TRIGGER reject_checkpoint BEFORE UPDATE ON sync_jobs FOR EACH ROW EXECUTE FUNCTION reject_checkpoint()",
          );
          await assert.rejects(
            repo.page(a, { records: [record("rollback-page")], done: true }, 1),
          );
          await db.$executeRawUnsafe(
            "DROP TRIGGER reject_checkpoint ON sync_jobs",
          );
          assert.equal(
            (
              await db.$queryRaw`SELECT count(*)::int AS n FROM sync_source_identities WHERE source_key=${sourceKey("fixture-v1", ["rollback-page"]).key}`
            )[0].n,
            0,
          );
          await repo.page(
            a,
            { records: [record("rollback-page")], done: true },
            1,
          );
          await finish(j);
        },
      );
      await t.test(
        "record retry persists while other records resolve, 429 waits and releases worker",
        async () => {
          const j = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
          await repo.page(
            await claim(),
            {
              records: [record("retry-record"), record("not-blocked", 2)],
              done: true,
            },
            1,
          );
          await repo.apply(await claim(), {
            ...processor,
            apply: async (source) => ({
              outcome:
                source.payload.value === 1 && source.id
                  ? "RETRYABLE_ERROR"
                  : "NEEDS_REVIEW",
            }),
          });
          const items =
            await db.$queryRaw`SELECT processing_outcome FROM sync_job_items WHERE job_id=${j.id}::uuid`;
          assert.equal(items.length, 2);
          assert.equal(
            items.filter((i) => i.processing_outcome === "NEEDS_REVIEW").length,
            1,
          );
          await db.$executeRaw`UPDATE provider_source_records SET next_retry_at=NULL WHERE processing_status='RETRYABLE_ERROR'`;
          await db.$executeRaw`UPDATE sync_jobs SET available_at=clock_timestamp() WHERE id=${j.id}::uuid`;
          await finish(j);
          const retry = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
          const exec = new SyncJobExecutor(
            repo,
            {
              strategy: () => "FULL",
              fetch: async () => {
                throw new SyncError("PROVIDER_RETRY", 2000);
              },
            },
            processor,
          );
          await exec.execute(
            await claim(),
            new globalThis.AbortController().signal,
          );
          const state = await repo.job(owner.id, c.id, retry.id);
          assert.equal(state.status, "WAITING");
          assert.equal(state.worker_id, null);
          await db.$executeRaw`UPDATE sync_jobs SET available_at=clock_timestamp() WHERE id=${retry.id}::uuid`;
          await repo.page(await claim(), { records: [], done: true }, 1);
          await finish(retry);
        },
      );
      await t.test(
        "APPLYING commit serializes before disable with real transaction barrier",
        async () => {
          const pending = await repo.admit(
            owner.id,
            c.id,
            "SHIPMENT",
            "MANUAL",
          );
          await repo.page(
            await claim(),
            { records: [record("barrier-apply")], done: true },
            1,
          );
          const a = await claim();
          let entered, release;
          const started = new Promise((r) => (entered = r)),
            barrier = new Promise((r) => (release = r));
          let disabled = false;
          const applying = repo.apply(a, {
            ...processor,
            apply: async () => {
              entered();
              await barrier;
              return { outcome: "NEEDS_REVIEW" };
            },
          });
          await started;
          const disabling = identity
            .setStatus(adminUser.id, owner.id, "DISABLED")
            .then(() => (disabled = true));
          await new Promise((r) => setTimeout(r, 25));
          assert.equal(disabled, false);
          release();
          await applying;
          await disabling;
          assert.equal(
            (
              await db.$queryRaw`SELECT status FROM sync_jobs WHERE id=${pending.id}::uuid`
            )[0].status,
            "SUCCEEDED",
          );
          await assert.rejects(
            repo.page(a, { records: [record("late")], done: true }, 1),
          );
          await identity.setStatus(adminUser.id, owner.id, "ACTIVE");
          await db.carrierConnection.update({
            where: { id: c.id },
            data: { status: "CONNECTED" },
          });
        },
      );
      await t.test(
        "disable-before-apply and hard delete invalidate active jobs without domain/mapping cascade",
        async () => {
          const j = await repo.admit(owner.id, c.id, "SHIPMENT", "MANUAL");
          await repo.page(
            await claim(),
            { records: [record("disabled")], done: true },
            1,
          );
          const a = await claim();
          await identity.setStatus(adminUser.id, owner.id, "DISABLED");
          await assert.rejects(repo.apply(a, processor));
          assert.equal(
            (
              await db.$queryRaw`SELECT status FROM sync_jobs WHERE id=${j.id}::uuid`
            )[0].status,
            "CANCELLED",
          );
          await identity.setStatus(adminUser.id, owner.id, "ACTIVE");
          assert.equal(
            (
              await db.$queryRaw`SELECT status FROM sync_jobs WHERE id=${j.id}::uuid`
            )[0].status,
            "CANCELLED",
          );
          const d = await connection();
          const job = await repo.admit(owner.id, d.id, "SHIPMENT", "MANUAL");
          await carrier.remove(owner.id, d.id);
          const gone = (
            await db.$queryRaw`SELECT status,carrier_connection_id FROM sync_jobs WHERE id=${job.id}::uuid`
          )[0];
          assert.equal(gone.status, "CANCELLED");
          assert.equal(gone.carrier_connection_id, null);
          assert.equal(await db.customer.count(), 99);
        },
      );
      await t.test(
        "two process-like budget clients coordinate concurrency and cooldown",
        async () => {
          b1 = new PostgresProviderBudget(url.toString());
          b2 = new PostgresProviderBudget(url.toString());
          let unblock;
          const barrier = new Promise((r) => (unblock = r));
          let entered = 0;
          let ready;
          const both = new Promise((r) => (ready = r));
          const op = async () => {
            if (++entered === 2) ready();
            await barrier;
          };
          const first = b1.run(op),
            second = b2.run(op);
          await both;
          await assert.rejects(
            b1.run(async () => {}),
            (e) => e.code === LifecycleCode.RATE_LIMITED,
          );
          unblock();
          await Promise.all([first, second]);
          await assert.rejects(
            b2.run(async () => {
              throw new LifecycleFailure(LifecycleCode.RATE_LIMITED, 2000);
            }),
          );
          await assert.rejects(
            b1.run(async () => {}),
            (e) => e.code === LifecycleCode.RATE_LIMITED,
          );
        },
      );
      await t.test(
        "F4 >30-second operations renew reservations and keep both slots exclusively owned",
        async () => {
          const name = "renew-" + randomUUID().slice(0, 8);
          const one = new PostgresProviderBudget(url.toString(), name),
            two = new PostgresProviderBudget(url.toString(), name);
          const startA = Promise.withResolvers(),
            startB = Promise.withResolvers(),
            endA = Promise.withResolvers(),
            endB = Promise.withResolvers();
          const a = one.run(async () => {
            startA.resolve();
            await endA.promise;
            return "a";
          });
          const b = two.run(async () => {
            startB.resolve();
            await endB.promise;
            return "b";
          });
          try {
            await Promise.all([startA.promise, startB.promise]);
            const initial =
              await db.$queryRaw`SELECT slot,lease_token FROM sync_provider_budget WHERE provider=${name} ORDER BY slot`;
            await new Promise((resolve) => setTimeout(resolve, 31050));
            const retained =
              await db.$queryRaw`SELECT slot,lease_token,lease_expires_at>clock_timestamp() AS valid FROM sync_provider_budget WHERE provider=${name} ORDER BY slot`;
            assert.ok(retained.every((r) => r.valid));
            assert.deepEqual(
              retained.map((r) => r.lease_token),
              initial.map((r) => r.lease_token),
            );
            await assert.rejects(
              one.run(async () => "third"),
              (e) => e.code === "RATE_LIMITED",
            );
          } finally {
            endA.resolve();
            endB.resolve();
            await Promise.allSettled([a, b]);
            await one.onApplicationShutdown();
            await two.onApplicationShutdown();
          }
          assert.deepEqual(await Promise.all([a, b]), ["a", "b"]);
        },
      );
      await t.test(
        "F4 lost token cancels, fences late success/failure bookkeeping and cannot release its successor",
        async () => {
          for (const lateFailure of [false, true]) {
            const name = "lost-" + randomUUID().slice(0, 8);
            const one = new PostgresProviderBudget(url.toString(), name),
              two = new PostgresProviderBudget(url.toString(), name);
            const started = Promise.withResolvers(),
              finish = Promise.withResolvers(),
              replacementStarted = Promise.withResolvers(),
              replacementFinish = Promise.withResolvers();
            let signal;
            const old = one.run(async (s) => {
              signal = s;
              started.resolve();
              await finish.promise;
              if (lateFailure)
                throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
              return "invalid-late-success";
            });
            const result = old.then(
              (value) => ({ value }),
              (error) => ({ error }),
            );
            let replacement;
            try {
              await started.promise;
              await db.$executeRaw`UPDATE sync_provider_budget SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE provider=${name} AND lease_token IS NOT NULL`;
              replacement = two.run(async () => {
                replacementStarted.resolve();
                await replacementFinish.promise;
                return "replacement";
              });
              await replacementStarted.promise;
              const held = (
                await db.$queryRaw`SELECT id,lease_token FROM sync_provider_budget WHERE provider=${name} AND lease_token IS NOT NULL`
              )[0];
              await db.$executeRaw`UPDATE sync_provider_budget SET failures=7 WHERE provider=${name}`;
              assert.ok(
                signal,
                "budget must supply transport cancellation signal",
              );
              if (!signal.aborted)
                await new Promise((resolve, reject) => {
                  const timer = setTimeout(
                    () => reject(Error("LEASE_LOSS_NOT_CANCELLED")),
                    12000,
                  );
                  signal.addEventListener(
                    "abort",
                    () => {
                      clearTimeout(timer);
                      resolve();
                    },
                    { once: true },
                  );
                });
              finish.resolve();
              assert.equal((await result).error?.code, "SERVICE_UNAVAILABLE");
              const after = (
                await db.$queryRaw`SELECT lease_token,failures,blocked_until FROM sync_provider_budget WHERE id=${held.id}::uuid`
              )[0];
              assert.equal(
                after.lease_token,
                held.lease_token,
                "old finally cannot release successor",
              );
              assert.equal(
                after.failures,
                7,
                "lost owner cannot reset/increment successor failure counters",
              );
              assert.equal(
                after.blocked_until,
                null,
                "lost owner cannot impose late cooldown",
              );
            } finally {
              finish.resolve();
              replacementFinish.resolve();
              await result;
              if (replacement) await replacement;
              await one.onApplicationShutdown();
              await two.onApplicationShutdown();
            }
          }
        },
      );
      await t.test(
        "F4 terminal ownership check rejects expired fast operations before heartbeat and leaves counters untouched",
        async () => {
          for (const fail of [false, true]) {
            const name = "terminal-" + randomUUID().slice(0, 8);
            const budget = new PostgresProviderBudget(url.toString(), name);
            const entered = Promise.withResolvers(),
              finish = Promise.withResolvers();
            let signal;
            const result = budget
              .run(async (s) => {
                signal = s;
                entered.resolve();
                await finish.promise;
                if (fail)
                  throw new LifecycleFailure(LifecycleCode.RATE_LIMITED, 60000);
                return "late";
              })
              .then(
                (value) => ({ value }),
                (error) => ({ error }),
              );
            try {
              await entered.promise;
              await db.$executeRaw`UPDATE sync_provider_budget SET lease_expires_at=clock_timestamp()-interval '1 second',failures=7 WHERE provider=${name}`;
              assert.equal(
                signal.aborted,
                false,
                "exercise terminal CAS before periodic renewal",
              );
              finish.resolve();
              assert.equal((await result).error?.code, "SERVICE_UNAVAILABLE");
              const slots =
                await db.$queryRaw`SELECT failures,blocked_until,lease_token FROM sync_provider_budget WHERE provider=${name}`;
              assert.ok(
                slots.every(
                  (s) =>
                    s.failures === 7 &&
                    s.blocked_until === null &&
                    s.lease_token === null,
                ),
              );
            } finally {
              finish.resolve();
              await result;
              await budget.onApplicationShutdown();
            }
          }
        },
      );
      await t.test(
        "I1 scheduler filters invalid/capability lanes and scans bounded failures without moving due dates",
        async () => {
          const u = await db.user.create({
            data: { username: "fair-" + randomUUID(), role: "OPERATOR" },
          });
          const q = new SyncRepository(
            url.toString(),
            cfg,
            provider,
            { ...processor, supports: (type) => type === "SHIPMENT" },
            "shared",
          );
          const seed = async (n, type = "SHIPMENT", status = "CONNECTED") => {
            const lanes = Array.from({ length: n }, () => ({
              id: randomUUID(),
              userId: u.id,
              provider: "uniship",
              externalAccountId: randomUUID(),
              displayName: "Synthetic",
              status,
            }));
            await db.carrierConnection.createMany({ data: lanes });
            const configs = lanes.map((c) => ({
              id: randomUUID(),
              carrier_connection_id: c.id,
              sync_type: type,
              enabled: true,
              interval_minutes: 60,
              next_run_at: new Date("2000-01-01T00:00:00Z"),
            }));
            await db.syncConfig.createMany({ data: configs });
            return configs.sort((a, b) => a.id.localeCompare(b.id));
          };
          const disable = () =>
            db.$executeRaw`UPDATE sync_configs SET enabled=false WHERE carrier_connection_id IN (SELECT id FROM carrier_connections WHERE user_id=${u.id}::uuid)`;
          try {
            const invalid = await seed(100, "SHIPMENT", "REAUTH_REQUIRED");
            await seed(100, "CUSTOMER");
            const [good] = await seed(1);
            await db.$executeRaw`UPDATE sync_configs SET next_run_at='2000-01-02' WHERE id=${good.id}::uuid`;
            await q.schedule();
            assert.equal(
              await db.syncJob.count({ where: { owner_user_id: u.id } }),
              1,
            );
            assert.equal(
              (await db.syncJob.findFirst({ where: { owner_user_id: u.id } }))
                .carrier_connection_id,
              good.carrier_connection_id,
            );
            assert.equal(
              (
                await db.syncConfig.findUnique({ where: { id: invalid[0].id } })
              ).next_run_at.toISOString(),
              "2000-01-01T00:00:00.000Z",
            );
            await disable();
            // Actual PostgreSQL admission failures, not mocked infrastructure.
            const failures = await seed(201),
              rejected = failures
                .slice(0, 200)
                .map((c) => c.carrier_connection_id);
            await db.$executeRawUnsafe(
              `CREATE FUNCTION sync_test_admission_failure() RETURNS trigger LANGUAGE plpgsql AS $sync_test$ BEGIN RAISE EXCEPTION 'Synthetic admission lock' USING ERRCODE='55P03'; END $sync_test$; CREATE TRIGGER sync_test_admission_failure BEFORE INSERT ON sync_jobs FOR EACH ROW WHEN (NEW.carrier_connection_id=ANY('{${rejected.join(",")}}'::uuid[])) EXECUTE FUNCTION sync_test_admission_failure()`,
            );
            // Millisecond boundaries and UUID ties preserve the database cursor.
            for (let offset = 0; offset < failures.length; offset += 50)
              await db.$executeRaw`UPDATE sync_configs SET next_run_at=${new Date(Date.UTC(2000, 0, 1, 0, 0, 0, 123 + offset / 50))} WHERE id=ANY(${failures.slice(offset, offset + 50).map((c) => c.id)}::uuid[])`;
            const before =
              await db.$queryRaw`SELECT id,next_run_at FROM sync_configs WHERE id=ANY(${failures.map((c) => c.id)}::uuid[]) ORDER BY id`;
            await q.schedule();
            assert.equal(
              await db.syncJob.count({
                where: {
                  carrier_connection_id: {
                    in: failures.map((c) => c.carrier_connection_id),
                  },
                },
              }),
              0,
              "one bounded cycle must not fabricate success",
            );
            await q.schedule();
            const admitted = await db.syncJob.findMany({
              where: {
                carrier_connection_id: {
                  in: failures.map((c) => c.carrier_connection_id),
                },
              },
            });
            assert.equal(admitted.length, 1);
            assert.equal(
              admitted[0].carrier_connection_id,
              failures[200].carrier_connection_id,
              "continuation reaches healthy lane beyond200 failures",
            );
            assert.deepEqual(
              await db.$queryRaw`SELECT id,next_run_at FROM sync_configs WHERE id=ANY(${failures.map((c) => c.id)}::uuid[]) ORDER BY id`,
              before,
              "admission never advances due dates",
            );
            await db.$executeRawUnsafe(
              "DROP TRIGGER sync_test_admission_failure ON sync_jobs; DROP FUNCTION sync_test_admission_failure()",
            );
            //100 actual admission failures still allow the101st candidate in this call.
            await db.$executeRaw`UPDATE sync_configs SET enabled=false WHERE id=ANY(${failures.slice(101, 200).map((c) => c.id)}::uuid[])`;
            await db.$executeRawUnsafe(
              `CREATE FUNCTION sync_test_admission_failure() RETURNS trigger LANGUAGE plpgsql AS $sync_test$ BEGIN RAISE EXCEPTION 'Synthetic admission lock' USING ERRCODE='55P03'; END $sync_test$; CREATE TRIGGER sync_test_admission_failure BEFORE INSERT ON sync_jobs FOR EACH ROW WHEN (NEW.carrier_connection_id=ANY('{${rejected.slice(0, 100).join(",")}}'::uuid[])) EXECUTE FUNCTION sync_test_admission_failure()`,
            );
            await q.schedule();
            assert.equal(
              await db.syncJob.count({
                where: {
                  carrier_connection_id: failures[100].carrier_connection_id,
                },
              }),
              1,
            );
            await db.$executeRawUnsafe(
              "DROP TRIGGER sync_test_admission_failure ON sync_jobs; DROP FUNCTION sync_test_admission_failure()",
            );
            const otherScheduler = new SyncRepository(
              url.toString(),
              cfg,
              provider,
              processor,
              "shared",
            );
            try {
              await Promise.all([q.schedule(), otherScheduler.schedule()]);
            } finally {
              await otherScheduler.close();
            }
            const duplicate =
              await db.$queryRaw`SELECT carrier_connection_id,count(*) FROM sync_jobs WHERE owner_user_id=${u.id}::uuid AND status IN ('QUEUED','RUNNING','WAITING') GROUP BY carrier_connection_id,sync_type HAVING count(*)>1`;
            assert.equal(duplicate.length, 0);
          } finally {
            await db.$executeRawUnsafe(
              "DROP TRIGGER IF EXISTS sync_test_admission_failure ON sync_jobs; DROP FUNCTION IF EXISTS sync_test_admission_failure()",
            );
            await disable();
            await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE owner_user_id=${u.id}::uuid AND status IN ('QUEUED','RUNNING','WAITING')`;
            await q.close();
          }
        },
      );
      await t.test(
        "M2 expired reclaim counts crashes, terminalizes atomically and preserves checkpoint/watermarks",
        async () => {
          const lane = await connection(),
            q = new SyncRepository(
              url.toString(),
              cfg,
              provider,
              processor,
              "shared",
            );
          let j;
          try {
            await q.configure(owner.id, lane.id, "SHIPMENT", true, 60);
            j = await q.admit(owner.id, lane.id, "SHIPMENT", "MANUAL");
            const first = await q.claim(randomUUID());
            assert.equal(first.attempt_count, 0);
            await q.page(
              first,
              {
                records: [record("crash-checkpoint")],
                done: false,
                nextPage: 8,
                nextCursor: "committed-7",
                watermark: "unconfirmed",
              },
              1,
            );
            const waiting = await q.claim(randomUUID());
            assert.equal(waiting.attempt_count, 0);
            await db.$executeRaw`UPDATE sync_jobs SET attempt_count=2,lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${j.id}::uuid`;
            const recovered = await q.claim(randomUUID());
            assert.equal(recovered.attempt_count, 3);
            assert.equal(recovered.next_page, 8);
            assert.equal(recovered.next_cursor, "committed-7");
            await assert.rejects(
              q.page(waiting, { records: [record("zombie")], done: true }, 1),
              (e) => e.code === "SYNC_STALE",
            );
            await db.$executeRaw`UPDATE sync_jobs SET attempt_count=4,lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${j.id}::uuid`;
            const before = await q.job(owner.id, lane.id, j.id);
            await db.$executeRawUnsafe(
              `CREATE FUNCTION sync_test_completion_failure() RETURNS trigger LANGUAGE plpgsql AS $sync_test$ BEGIN RAISE EXCEPTION 'Synthetic completion rollback'; END $sync_test$; CREATE TRIGGER sync_test_completion_failure BEFORE UPDATE ON sync_configs FOR EACH ROW WHEN (NEW.carrier_connection_id='${lane.id}'::uuid) EXECUTE FUNCTION sync_test_completion_failure()`,
            );
            await assert.rejects(q.claim(randomUUID()));
            assert.deepEqual(
              await q.job(owner.id, lane.id, j.id),
              before,
              "terminal attempt/version/status must rollback with config failure",
            );
            await db.$executeRawUnsafe(
              "DROP TRIGGER sync_test_completion_failure ON sync_configs; DROP FUNCTION sync_test_completion_failure()",
            );
            const contender = new SyncRepository(
              url.toString(),
              cfg,
              provider,
              processor,
              "shared",
            );
            try {
              assert.deepEqual(
                await Promise.all([
                  q.claim(randomUUID()),
                  contender.claim(randomUUID()),
                ]),
                [null, null],
              );
            } finally {
              await contender.close();
            }
            const failed = await q.job(owner.id, lane.id, j.id);
            assert.equal(failed.status, "FAILED");
            assert.equal(failed.attempt_count, 5);
            assert.equal(failed.last_error_code, "INTERNAL_ERROR");
            assert.equal(failed.lease_version, recovered.lease_version + 1);
            assert.equal(failed.worker_id, null);
            assert.equal(failed.lease_expires_at, null);
            assert.equal(failed.next_page, 8);
            assert.equal(failed.next_cursor, "committed-7");
            assert.equal(failed.target_watermark, "unconfirmed");
            await assert.rejects(
              q.page(
                recovered,
                { records: [record("late-after-failed")], done: true },
                1,
              ),
              (e) => e.code === "SYNC_STALE",
            );
            const config = (await q.configs(owner.id, lane.id)).find(
              (c) => c.sync_type === "SHIPMENT",
            );
            assert.equal(config.last_success_at, null);
            assert.equal(config.last_completed_watermark, null);
            assert.equal(
              config.next_run_at.getTime() - failed.finished_at.getTime(),
              3600000,
            );
            await db.$executeRaw`UPDATE sync_configs SET next_run_at=clock_timestamp()-interval '1 second' WHERE carrier_connection_id=${lane.id}::uuid`;
            await q.schedule();
            const fresh = await q.admit(
              owner.id,
              lane.id,
              "SHIPMENT",
              "MANUAL",
            );
            assert.notEqual(fresh.id, j.id);
            assert.equal(fresh.trigger_source, "AUTO");
            assert.equal(
              await db.syncJob.count({
                where: {
                  carrier_connection_id: lane.id,
                  status: { in: ["QUEUED", "RUNNING", "WAITING"] },
                },
              }),
              1,
            );
            const pageSeven = await q.claim(randomUUID());
            await q.page(
              pageSeven,
              {
                records: [],
                done: false,
                nextPage: 8,
                nextCursor: "page-7-committed",
              },
              1,
            );
            const beforeCrash = await q.claim(randomUUID());
            await db.$executeRaw`UPDATE sync_jobs SET attempt_count=2,lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${fresh.id}::uuid`;
            const resume = await q.claim(randomUUID()),
              fetched = [];
            await new SyncJobExecutor(
              q,
              {
                ...provider,
                fetch: async (work) => {
                  fetched.push(work.next_page);
                  return { records: [], done: true, nextPage: 9 };
                },
              },
              processor,
            ).execute(resume, new globalThis.AbortController().signal);
            assert.deepEqual(
              fetched,
              [8],
              "executor resumes after committed page7, not an earlier page",
            );
            const advanced = await q.job(owner.id, lane.id, fresh.id);
            assert.equal(advanced.next_page, 9);
            assert.equal(
              advanced.attempt_count,
              0,
              "successful page retains its existing attempt reset",
            );
            await assert.rejects(
              q.heartbeat(beforeCrash),
              (e) => e.code === "SYNC_STALE",
            );
          } finally {
            await db.$executeRawUnsafe(
              "DROP TRIGGER IF EXISTS sync_test_completion_failure ON sync_configs; DROP FUNCTION IF EXISTS sync_test_completion_failure()",
            );
            await db.$executeRaw`UPDATE sync_configs SET enabled=false WHERE carrier_connection_id=${lane.id}::uuid`;
            await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE carrier_connection_id=${lane.id}::uuid AND status IN ('QUEUED','RUNNING','WAITING')`;
            await q.close();
          }
        },
      );
      await t.test(
        "M3 technical retry exhaustion stays FAILED while valid business review and new versions recover",
        async () => {
          const lane = await connection(),
            q = new SyncRepository(
              url.toString(),
              { ...cfg, maxAttempts: 2 },
              provider,
              processor,
              "shared",
            );
          try {
            await q.configure(owner.id, lane.id, "SHIPMENT", true, 60);
            const j = await q.admit(owner.id, lane.id, "SHIPMENT", "MANUAL");
            await q.page(
              await q.claim(randomUUID()),
              {
                records: [record("technical-exhaustion", 1)],
                done: true,
                watermark: "must-not-succeed",
              },
              1,
            );
            for (let i = 0; i < 2; i++) {
              await q.apply(await q.claim(randomUUID()), {
                ...processor,
                apply: async () => ({ outcome: "RETRYABLE_ERROR" }),
              });
              if (i === 0) {
                await db.$executeRaw`UPDATE sync_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE id=${j.id}::uuid`;
                await db.$executeRaw`UPDATE provider_source_records SET next_retry_at=clock_timestamp()-interval '1 second' WHERE source_identity_id IN (SELECT source_identity_id FROM sync_job_items WHERE job_id=${j.id}::uuid)`;
              }
            }
            const failed = await q.job(owner.id, lane.id, j.id),
              issues = await q.issues(owner.id, lane.id, j.id, 1, 10);
            assert.equal(failed.status, "FAILED");
            assert.equal(failed.applied_count, 0);
            assert.equal(failed.needs_review_count, 0);
            assert.equal(
              issues.issues[0].processing_outcome,
              "RETRYABLE_ERROR",
            );
            assert.equal(issues.issues[0].last_error_code, "INTERNAL_ERROR");
            let config = (await q.configs(owner.id, lane.id)).find(
              (c) => c.sync_type === "SHIPMENT",
            );
            assert.equal(config.last_success_at, null);
            assert.equal(config.last_completed_watermark, null);
            const next = await q.admit(owner.id, lane.id, "SHIPMENT", "MANUAL");
            await q.page(
              await q.claim(randomUUID()),
              {
                records: [record("technical-exhaustion", 2)],
                done: true,
                watermark: "confirmed-new-version",
              },
              1,
            );
            const source = (
              await db.$queryRaw`SELECT p.* FROM provider_source_records p JOIN sync_job_items i ON i.source_identity_id=p.source_identity_id WHERE i.job_id=${next.id}::uuid`
            )[0];
            assert.equal(source.source_version, 2);
            assert.equal(source.next_retry_at, null);
            assert.equal(source.attempt_count, 0);
            await q.apply(await q.claim(randomUUID()), processor);
            const reviewed = await q.job(owner.id, lane.id, next.id);
            assert.equal(reviewed.status, "SUCCEEDED");
            assert.equal(reviewed.needs_review_count, 1);
            config = (await q.configs(owner.id, lane.id)).find(
              (c) => c.sync_type === "SHIPMENT",
            );
            assert.ok(config.last_success_at);
            assert.ok(
              config.next_run_at.getTime() - reviewed.finished_at.getTime() >=
                3600000 &&
                config.next_run_at.getTime() - reviewed.finished_at.getTime() <
                  3601000,
            );
            assert.equal(
              config.last_completed_watermark,
              "confirmed-new-version",
            );
            assert.equal(
              (await q.issues(owner.id, lane.id, j.id, 1, 10)).issues[0]
                .processing_outcome,
              "RETRYABLE_ERROR",
            );
          } finally {
            await db.$executeRaw`UPDATE sync_configs SET enabled=false WHERE carrier_connection_id=${lane.id}::uuid`;
            await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE carrier_connection_id=${lane.id}::uuid AND status IN ('QUEUED','RUNNING','WAITING')`;
            await q.close();
          }
        },
      );
      await t.test(
        "M1 API shared reads overlap while mutations, disable and delete retain lifecycle barriers",
        async () => {
          const u = await db.user.create({
            data: { username: "read-" + randomUUID(), role: "OPERATOR" },
          });
          const lane = await db.carrierConnection.create({
            data: {
              userId: u.id,
              provider: "uniship",
              externalAccountId: randomUUID(),
              displayName: "Synthetic",
              status: "CONNECTED",
            },
          });
          const read = new SyncRepository(
              url.toString(),
              cfg,
              provider,
              processor,
            ),
            second = new SyncRepository(
              url.toString(),
              cfg,
              provider,
              processor,
            );
          let release, held;
          const original = read.client.$transaction.bind(read.client);
          const hold = () => {
            const ready = new Promise((r) => (held = r)),
              gate = new Promise((r) => (release = r));
            read.client.$transaction = (callback) =>
              original(async (tx) => {
                const result = await callback(tx);
                held();
                await gate;
                return result;
              });
            return ready;
          };
          const settles = async (p) => {
            let done = false;
            p.then(
              () => (done = true),
              () => (done = true),
            );
            for (let i = 0; i < 20 && !done; i++)
              await new Promise((r) => setTimeout(r, 50));
            return done;
          };
          try {
            const j = await second.admit(u.id, lane.id, "SHIPMENT", "MANUAL");
            await db.$executeRaw`UPDATE sync_jobs SET status='SUCCEEDED',finished_at=clock_timestamp() WHERE id=${j.id}::uuid`;
            const metadata =
              await db.$queryRaw`SELECT updated_at FROM users WHERE id=${u.id}::uuid`;
            let ready = hold(),
              first = read.jobs(u.id, lane.id, 1, 10);
            await ready;
            const otherReads = Promise.all([
              second.jobs(u.id, lane.id, 1, 10),
              second.job(u.id, lane.id, j.id),
              second.issues(u.id, lane.id, j.id, 1, 10),
              second.configs(u.id, lane.id),
            ]);
            const overlap = await settles(otherReads);
            release();
            await first;
            await otherReads;
            assert.equal(
              overlap,
              true,
              "API reads must coexist with another read's held authorization locks",
            );
            assert.deepEqual(
              await db.$queryRaw`SELECT updated_at FROM users WHERE id=${u.id}::uuid`,
              metadata,
            );
            ready = hold();
            first = read.configs(u.id, lane.id);
            await ready;
            let changed = false;
            const write = second
              .configure(u.id, lane.id, "SHIPMENT", false, 60)
              .then(() => (changed = true));
            await new Promise((r) => setTimeout(r, 100));
            assert.equal(
              changed,
              false,
              "mutation still waits behind shared read",
            );
            release();
            await first;
            await write;
            ready = hold();
            first = read.configs(u.id, lane.id);
            await ready;
            let disabled = false;
            const disabling = identity
              .setStatus(adminUser.id, u.id, "DISABLED")
              .then(() => (disabled = true));
            await new Promise((r) => setTimeout(r, 100));
            assert.equal(disabled, false);
            release();
            await first;
            await disabling;
            await assert.rejects(
              second.configs(u.id, lane.id),
              (e) => e.code === "UNAUTHORIZED",
            );
            await identity.setStatus(adminUser.id, u.id, "ACTIVE");
            ready = hold();
            first = read.jobs(u.id, lane.id, 1, 10);
            await ready;
            let deleted = false;
            const deleting = carrier
              .remove(u.id, lane.id)
              .then(() => (deleted = true));
            await new Promise((r) => setTimeout(r, 100));
            assert.equal(deleted, false);
            release();
            await first;
            await deleting;
            await assert.rejects(
              second.configs(u.id, lane.id),
              (e) => e.code === "NOT_FOUND",
            );
            await assert.rejects(
              second.jobs(other.id, lane.id, 1, 10),
              (e) => e.code === "NOT_FOUND",
            );
          } finally {
            release?.();
            await read.close();
            await second.close();
          }
        },
      );
      await t.test(
        "m1 required FK/due indexes have exact columns/predicates without duplicate names",
        async () => {
          const indexes =
            await db.$queryRaw`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname=ANY(${["idx_sync_jobs_connection", "idx_sync_source_identities_customer", "idx_sync_job_items_source", "idx_sync_configs_due"]}::text[])`;
          assert.equal(indexes.length, 4);
          for (const [name, column, partial] of [
            ["idx_sync_jobs_connection", "carrier_connection_id", false],
            ["idx_sync_source_identities_customer", "customer_id", true],
            ["idx_sync_job_items_source", "source_identity_id", false],
            ["idx_sync_configs_due", "next_run_at", true],
          ]) {
            const row = indexes.find((r) => r.indexname === name);
            assert.ok(row.indexdef.includes("(" + column + ")"));
            assert.equal(row.indexdef.includes("WHERE"), partial);
          }
        },
      );

      await t.test(
        "real API and worker processes share the same provider reservation budget",
        async () => {
          await db.$executeRaw`UPDATE sync_provider_budget SET blocked_until=NULL,failures=0,lease_token=NULL,lease_expires_at=NULL`;
          const modulePath = require.resolve(
            "../dist/carrier/infrastructure/uniship/postgres-provider-budget",
          );
          const code = `const {PostgresProviderBudget}=require(${JSON.stringify(modulePath)});const b=new PostgresProviderBudget(process.env.SYNC_CHILD_DATABASE_URL);(async()=>{try{await b.run(async()=>{process.stdout.write('HELD\\n');await new Promise(r=>process.stdin.once('data',r));});}catch{process.stderr.write('WORKER_BUDGET_FAILED');process.exitCode=1;}finally{await b.onApplicationShutdown();}})();`;
          const child = spawn(process.execPath, ["-e", code], {
            env: { ...process.env, SYNC_CHILD_DATABASE_URL: url.toString() },
            stdio: ["pipe", "pipe", "pipe"],
          });
          let output = "";
          const exited = new Promise((resolve, reject) => {
            child.once("exit", resolve);
            child.once("error", () =>
              reject(Error("Worker process spawn failed")),
            );
          });
          try {
            await new Promise((resolve, reject) => {
              child.stdout.on("data", (chunk) => {
                output += chunk.toString();
                if (output.includes("HELD")) resolve();
              });
              child.once("exit", () =>
                reject(Error("Worker exited before reservation")),
              );
            });
            let entered, release;
            const ready = new Promise((r) => (entered = r)),
              barrier = new Promise((r) => (release = r));
            const apiHold = b1.run(async () => {
              entered();
              await barrier;
            });
            await ready;
            try {
              await assert.rejects(
                b2.run(async () => {}),
                (e) => e.code === LifecycleCode.RATE_LIMITED,
              );
            } finally {
              release();
              child.stdin.end("release");
            }
            await apiHold;
            assert.equal(await exited, 0);
          } finally {
            if (child.exitCode === null) {
              child.kill("SIGTERM");
              await exited;
            }
          }
        },
      );
      await t.test(
        "real Nest guards, strict Sync HTTP contracts, scoped pagination/issues and generated SDK",
        async () => {
          const saved = { ...process.env },
            { mkdtemp, rm } = require("node:fs/promises"),
            { tmpdir } = require("node:os"),
            { join } = require("node:path");
          const root = await mkdtemp(join(tmpdir(), "nexora-sync-http-"));
          let app;
          try {
            const connectionRow = await connection(),
              j = await repo.admit(
                owner.id,
                connectionRow.id,
                "SHIPMENT",
                "MANUAL",
              );
            await repo.page(
              await claim(),
              { records: [record("http-1"), record("http-2")], done: true },
              1,
            );
            await repo.apply(await claim(), processor);
            process.env.DATABASE_URL = url.toString();
            process.env.STORAGE_ROOT = root;
            process.env.ALLOWED_ORIGINS = "http://localhost:3001";
            process.env.NEXORA_DEPLOYMENT_PROFILE = "LOCAL";
            process.env.SYNC_ENABLED = "false";
            process.env.SYNC_SHIPMENT_ENABLED = "false";
            process.env.SYNC_CUSTOMER_ENABLED = "false";
            const { NestFactory } = require("@nestjs/core"),
              { AppModule } = require("../dist/app.module"),
              { configure } = require("../dist/http");
            app = await NestFactory.create(AppModule, {
              logger: false,
              abortOnError: false,
            });
            configure(app);
            await app.listen(0, "127.0.0.1");
            const base =
              "http://127.0.0.1:" + app.getHttpServer().address().port;
            const session = async (userId) => {
              const token = randomBytes(32).toString("hex");
              await db.session.create({
                data: {
                  userId,
                  tokenHash: createHash("sha256").update(token).digest("hex"),
                  expiresAt: new Date(Date.now() + 60000),
                },
              });
              return "nexora_session=" + token;
            };
            const own = await session(owner.id),
              foreign = await session(other.id),
              adminCookie = await session(adminUser.id),
              path = "/api/carrier-connections/" + connectionRow.id;
            const request = async (
              method,
              suffix,
              cookie = own,
              body,
              origin = "http://localhost:3001",
            ) =>
              globalThis.fetch(base + path + suffix, {
                method,
                headers: {
                  ...(cookie ? { cookie } : {}),
                  ...(origin ? { origin } : {}),
                  "content-type": "application/json",
                },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
              });
            assert.equal(
              (await request("GET", "/sync-configs", null)).status,
              401,
            );
            for (const cookie of [foreign, adminCookie])
              assert.equal(
                (await request("GET", "/sync-configs", cookie)).status,
                404,
              );
            assert.equal(
              (
                await request(
                  "POST",
                  "/sync-jobs",
                  own,
                  { syncType: "SHIPMENT" },
                  null,
                )
              ).status,
              403,
            );
            assert.equal(
              (
                await request("POST", "/sync-jobs", own, {
                  syncType: "SHIPMENT",
                  leaseVersion: 5,
                })
              ).status,
              400,
            );
            assert.equal(
              (
                await request("POST", "/sync-jobs", own, {
                  syncType: "SHIPMENT",
                })
              ).status,
              503,
            );
            const configResponse = await request("GET", "/sync-configs");
            assert.equal(configResponse.status, 200);
            const configs = (await configResponse.json()).configs;
            assert.equal(configs.length, 2);
            assert.equal(
              configs.find((c) => c.syncType === "SHIPMENT").latestJob.id,
              j.id,
            );
            assert.ok(configs.every((c) => c.available === false));
            assert.equal(
              (
                await request("PATCH", "/sync-configs/SHIPMENT", own, {
                  enabled: false,
                  intervalMinutes: 60,
                })
              ).status,
              200,
            );
            assert.equal(
              (
                await request("PATCH", "/sync-configs/SHIPMENT", own, {
                  enabled: true,
                  intervalMinutes: 60,
                })
              ).status,
              503,
            );
            assert.equal(
              (
                await request("PATCH", "/sync-configs/SHIPMENT", own, {
                  enabled: false,
                  intervalMinutes: 60,
                  ownerUserId: owner.id,
                })
              ).status,
              400,
            );
            const page = await (
              await request("GET", "/sync-jobs?page=2&pageSize=1")
            ).json();
            assert.equal(page.jobs.length, 0);
            assert.equal(page.total, 1);
            assert.equal(page.summary.total, 1);
            assert.equal(page.summary.completed, 1);
            assert.equal(
              (await request("GET", "/sync-jobs?ownerUserId=" + other.id))
                .status,
              400,
            );
            assert.equal(
              (await request("GET", "/sync-jobs?from=2026-02-30T00:00:00Z"))
                .status,
              400,
            );
            assert.equal(
              (await request("GET", "/sync-jobs?status=UNKNOWN")).status,
              400,
            );
            const detail = await (
              await request("GET", "/sync-jobs/" + j.id + "?page=2&pageSize=1")
            ).json();
            assert.equal(detail.issues.length, 1);
            assert.equal(detail.issueTotal, 2);
            assert.deepEqual(Object.keys(detail.issues[0]).sort(), [
              "errorCode",
              "id",
              "outcome",
              "processorVersion",
              "sourceId",
              "sourceVersion",
            ]);
            assert.equal(
              (await request("GET", "/sync-jobs/" + randomUUID())).status,
              404,
            );
            assert.doesNotMatch(
              JSON.stringify(detail),
              /normalized_payload|ciphertext|owner_user_id|external_account_id|lease_version/,
            );
            const { createNexoraClient } = await import(
                "../../../packages/sdk/src/index.ts"
              ),
              sdk = createNexoraClient(base);
            const result = await sdk.GET(
              "/api/carrier-connections/{id}/sync-configs",
              {
                params: { path: { id: connectionRow.id } },
                headers: { cookie: own },
              },
            );
            assert.equal(result.response.status, 200);
            assert.equal(result.data.configs.length, 2);
          } finally {
            await app?.close();
            for (const key of Object.keys(process.env))
              if (!(key in saved)) delete process.env[key];
            Object.assign(process.env, saved);
            await rm(root, { recursive: true, force: true });
          }
        },
      );
    } finally {
      await Promise.allSettled([
        repo?.close(),
        carrier?.onApplicationShutdown(),
        identity?.onApplicationShutdown(),
        b1?.onApplicationShutdown(),
        b2?.onApplicationShutdown(),
        db?.$disconnect(),
      ]);
      if (owned)
        await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
      await admin.$disconnect();
    }
  },
);
