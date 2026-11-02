// Real migrated PostgreSQL. No live provider, shared cluster role changes or user volumes.
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");
const { createDatabase } = require("@nexora/database");
const {
  SyncRepository,
} = require("../dist/sync/infrastructure/sync-job.repository");
const {
  TransactionSyncDisablement,
} = require("../dist/sync/infrastructure/sync-disablement.participant");
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
        supports: () => true,
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
              supports: () => true,
              fetch: async () => {
                throw new SyncError("PROVIDER_RETRY", 2000);
              },
            },
            processor,
          );
          await exec.execute(await claim(), new AbortController().signal);
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
