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
      repo = new SyncRepository(url.toString(), cfg, provider, processor);
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
          await scan(rows(10, 5));
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
