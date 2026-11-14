require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { resolve, join } = require("node:path");
const { readFile, mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { setImmediate } = require("node:timers");
const { createDatabase, hashPassword } = require("@nexora/database");
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
  ShipmentSyncProcessor,
} = require("../dist/shipment/application/shipment-sync.processor");
const {
  createShipmentSyncBinding,
} = require("../dist/shipment/infrastructure/shipment-sync-domain.binding");
const { LogisticsStage: S } = require("@nexora/shared/shipment");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { configure } = require("../dist/http");
const {
  IdentityDatabaseAdapter,
} = require("../dist/identity/infrastructure/identity.adapter");
const { loginWithMfa } = require("../test/helpers/mfa-fixture.cjs");
test(
  "Shipment genuine PostgreSQL fenced fees/history and authenticated owner reads",
  { timeout: 180000 },
  async (t) => {
    assert.ok(process.env.DATABASE_URL, "genuine PostgreSQL required");
    const saved = { ...process.env };
    const admin = createDatabase(process.env.DATABASE_URL);
    const name = "nexora_shipment_" + randomUUID().replaceAll("-", "");
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    let owned = false,
      db,
      app,
      identity;
    const repos = [];
    const storage = await mkdtemp(join(tmpdir(), "nexora-shipment-"));
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
      await t.test(
        "physical schema, exact vocabulary/keys and decimal storage",
        () =>
          require("./fixtures/shipment-schema.cjs").verifyShipmentSchema(db),
      );
      const hash = await hashPassword("ShipmentFixturePass123!");
      const owner = await db.user.create({
        data: {
          username: "shipment-" + randomUUID(),
          role: "OPERATOR",
          credential: { create: { passwordHash: hash } },
        },
      });
      const other = await db.user.create({
        data: {
          username: "other-" + randomUUID(),
          role: "OPERATOR",
          credential: { create: { passwordHash: hash } },
        },
      });
      const adminActor = await db.user.create({
        data: {
          username: "ship-ad-" + randomUUID(),
          role: "ADMIN",
          credential: { create: { passwordHash: hash } },
        },
      });
      const connection = await db.carrierConnection.create({
        data: {
          userId: owner.id,
          provider: "uniship",
          externalAccountId: "fixture-" + randomUUID(),
          displayName: "Synthetic Shipment only",
          status: "CONNECTED",
        },
      });
      const cfg = loadSyncConfig({
        SYNC_ENABLED: "true",
        SYNC_SHIPMENT_ENABLED: "true",
      });
      const provider = {
        strategy: () => "FULL",
        fetch: async () => {
          throw Error("no network in fixtures");
        },
      };
      let workerUrl = url.toString();
      const { provisionRuntime, runtimeUrl } = await import(
        "../../../packages/database/scripts/provision-runtime.mjs"
      );
      const runtimePassword = (
        await readFile(
          process.env.SHIPMENT_TEST_RUNTIME_PASSWORD_FILE ??
            "/runtime-config/postgres_app_password",
          "utf8",
        )
      ).trim();
      if (process.env.DISPOSABLE_CLUSTER_TOKEN) {
        assert.equal(
          process.env.DATABASE_URL,
          process.env.DISPOSABLE_CLUSTER_ADMIN_URL,
          "worker role provisioning requires signed launcher URL",
        );
        const signature = await admin.$queryRawUnsafe(
          "SELECT description FROM pg_shdescription JOIN pg_database ON objoid=pg_database.oid WHERE datname=current_database()",
        );
        assert.equal(
          signature[0]?.description,
          process.env.DISPOSABLE_CLUSTER_TOKEN,
        );
        await provisionRuntime(url.toString(), runtimePassword, {
          role: "nexora_sync",
        });
        workerUrl = runtimeUrl(url.toString(), runtimePassword, "nexora_sync");
        const worker = createDatabase(workerUrl);
        try {
          assert.equal(
            (await worker.$queryRawUnsafe("SELECT current_user"))[0]
              .current_user,
            "nexora_sync",
          );
        } finally {
          await worker.$disconnect();
        }
      }
      const makeRepo = (processor) => {
        const r = new SyncRepository(
          workerUrl,
          cfg,
          new SyncCapabilityRegistry([
            {
              providerName: "uniship",
              type: "SHIPMENT",
              provider,
              domain: createShipmentSyncBinding(processor),
            },
          ]),
          "shared",
        );
        repos.push(r);
        return r;
      };
      let processor = new ShipmentSyncProcessor(
          1,
          { at: S.AT_ORIGIN_WAREHOUSE, done: S.DELIVERED },
          () => {},
        ),
        repo = makeRepo(processor);
      const line = (amount = "15.01", code = "DOMESTIC_SHIPPING") => ({
        chargeCode: code,
        amount,
        currency: "CNY",
        providerLabel: "test-owned label",
      });
      const payload = (extra) => ({
        trackingCode: "OVERLAP",
        providerStatus: "at",
        totalAmount: "500.00",
        totalCurrency: "CNY",
        ...extra,
      });
      const record = (key, p) => ({
        identity: sourceKey("shipment-fixture-v1", [key]),
        payload: p,
      });
      const prepare = async (records, r = repo) => {
        const j = await r.admit(owner.id, connection.id, "SHIPMENT", "MANUAL");
        const fetching = await r.claim(randomUUID());
        assert.equal(fetching.id, j.id);
        await r.page(
          fetching,
          { records, done: true },
          r.capabilities.resolve("uniship", "SHIPMENT").processor.version,
        );
        return j;
      };
      const finish = async (j, r = repo) => {
        for (let n = 0; n < 10; n++) {
          const state = await r.job(owner.id, connection.id, j.id);
          if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(state.status))
            return state;
          const work = await r.claim(randomUUID());
          assert.ok(work);
          await r.apply(work);
        }
        throw Error("fixture job did not settle");
      };
      const run = async (p, key = "one", r = repo) =>
        finish(await prepare([record(key, p)], r), r);
      const getRoot = () =>
        db.shipment.findFirstOrThrow({
          where: { ownerUserId: owner.id, ...(root ? { id: root.id } : {}) },
          include: {
            charges: { orderBy: { lineNo: "asc" } },
            milestones: { orderBy: { milestoneCode: "asc" } },
            items: { orderBy: { lineNo: "asc" } },
            history: { orderBy: { observedAt: "asc" } },
          },
        });
      let root;
      await t.test(
        "complete fees preserve order/repeated codes and do not calculate provider totals",
        async () => {
          const result = await run(
            payload({
              charges: {
                complete: true,
                lines: [
                  line(),
                  line("8.00"),
                  line("2.02", "OTHER"),
                  line("3.03", "OTHER"),
                ],
              },
            }),
          );
          assert.equal(result.status, "SUCCEEDED");
          root = await getRoot();
          assert.equal(root.customerId, null);
          assert.equal(root.totalAmount.toFixed(2), "500.00");
          assert.deepEqual(
            root.charges.map((x) => [
              x.lineNo,
              x.chargeCode,
              x.amount.toFixed(2),
            ]),
            [
              [1, "DOMESTIC_SHIPPING", "15.01"],
              [2, "DOMESTIC_SHIPPING", "8.00"],
              [3, "OTHER", "2.02"],
              [4, "OTHER", "3.03"],
            ],
          );
          assert.equal(root.history.length, 1);
          assert.equal(root.history[0].providerChangedAt, null);
        },
      );
      await t.test(
        "same payload/processor writes nothing, reordered/changed positions retain identity",
        async () => {
          const same = payload({
            charges: {
              complete: true,
              lines: [
                line(),
                line("8.00"),
                line("2.02", "OTHER"),
                line("3.03", "OTHER"),
              ],
            },
          });
          await run(same);
          const noWrite = await getRoot();
          assert.equal(+noWrite.updatedAt, +root.updatedAt);
          assert.deepEqual(
            noWrite.charges.map((x) => x.id),
            root.charges.map((x) => x.id),
          );
          const customer = await db.customer.create({
            data: {
              ownerUserId: owner.id,
              createdByUserId: owner.id,
              name: "Shipment linked fixture",
              phone: "+84912345678",
            },
          });
          await db.shipment.update({
            where: { id: root.id },
            data: {
              internalNote: "Nexora-owned",
              customerId: customer.id,
              assigneeUserId: owner.id,
              updatedByUserId: owner.id,
            },
          });
          await run(
            payload({
              charges: {
                complete: true,
                lines: [line("8.00"), line(), line("2.02", "OTHER")],
              },
            }),
          );
          const changed = await getRoot();
          assert.deepEqual(
            changed.charges.map((x) => x.id),
            root.charges.slice(0, 3).map((x) => x.id),
          );
          assert.equal(changed.internalNote, "Nexora-owned");
          assert.equal(changed.customerId, customer.id);
          assert.equal(changed.assigneeUserId, owner.id);
          assert.equal(changed.updatedByUserId, owner.id);
        },
      );
      await t.test(
        "missing preserves; invalid/partial rejects entire proposal; empty clears",
        async () => {
          await run(payload({ trackingCode: "missing" }));
          const before = await getRoot();
          assert.equal(before.charges.length, 3);
          for (const charges of [
            { complete: false, lines: [] },
            { complete: true, lines: [line("1.001")] },
            { complete: true, lines: [line("1.11"), line("1.001")] },
            null,
          ]) {
            const j = await run(
              payload({ trackingCode: "must-not-write", charges }),
            );
            assert.equal(j.rejected_count, 1);
            const after = await getRoot();
            assert.equal(after.trackingCode, "missing");
            assert.deepEqual(after.charges, before.charges);
          }
          await run(payload({ charges: { complete: true, lines: [] } }));
          assert.equal((await getRoot()).charges.length, 0);
        },
      );
      await t.test(
        "new processor remaps UNKNOWN on same source; same stage does not append",
        async () => {
          const unknown = payload({ providerStatus: "new-synthetic" });
          await run(unknown);
          const before = await getRoot();
          const sv = before.history.at(-1).sourceVersion;
          assert.equal(before.logisticsStage, S.UNKNOWN);
          processor = new ShipmentSyncProcessor(
            2,
            { "new-synthetic": S.DELIVERED },
            () => {},
          );
          repo = makeRepo(processor);
          await run(unknown);
          const after = await getRoot();
          assert.equal(after.history.at(-1).sourceVersion, sv);
          assert.equal(after.history.at(-1).processorVersion, 2);
          assert.equal(after.history.at(-1).fromStage, S.UNKNOWN);
          assert.equal(after.history.at(-1).toStage, S.DELIVERED);
          repo = makeRepo(
            new ShipmentSyncProcessor(
              3,
              { "new-synthetic": S.DELIVERED },
              () => {},
            ),
          );
          await run(unknown);
          assert.equal((await getRoot()).history.length, after.history.length);
        },
      );
      await t.test(
        "overlapping tracking identities remain separate, concurrent apply cannot duplicate",
        async () => {
          const j = await prepare([
            record("one", payload({ providerStatus: "new-synthetic" })),
            record("two", payload({ providerStatus: "new-synthetic" })),
          ]);
          const work = await repo.claim(randomUUID());
          const results = await Promise.allSettled([
            repo.apply(work),
            repo.apply(work),
          ]);
          assert.ok(results.some((x) => x.status === "fulfilled"));
          await finish(j);
          assert.equal(
            await db.shipment.count({ where: { ownerUserId: owner.id } }),
            2,
          );
        },
      );
      await t.test(
        "fee/history SQL failure and expired final lease roll back root and Sync outcome",
        async () => {
          const before = await getRoot();
          for (const table of ["shipment_charges", "shipment_stage_history"]) {
            await db.$executeRawUnsafe(
              `CREATE FUNCTION shipment_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic shipment rollback'; END $$`,
            );
            await db.$executeRawUnsafe(
              `CREATE TRIGGER shipment_test_failure BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW ${table === "shipment_charges" ? "WHEN (NEW.line_no=2)" : ""} EXECUTE FUNCTION shipment_test_failure()`,
            );
            const r = makeRepo(
              new ShipmentSyncProcessor(
                4,
                { at: S.AT_ORIGIN_WAREHOUSE },
                () => {},
              ),
            );
            const j = await prepare(
              [
                record(
                  "one",
                  payload({
                    trackingCode: "rollback",
                    charges: { complete: true, lines: [line(), line("8.08")] },
                  }),
                ),
              ],
              r,
            );
            const work = await r.claim(randomUUID());
            await assert.rejects(r.apply(work));
            const after = await getRoot();
            assert.equal(after.trackingCode, before.trackingCode);
            assert.deepEqual(after.charges, before.charges);
            assert.equal(after.history.length, before.history.length);
            const item = await db.syncJobItem.findFirst({
              where: { job_id: j.id },
            });
            assert.equal(item.processing_outcome, "PENDING");
            await db.$executeRawUnsafe(
              `DROP TRIGGER shipment_test_failure ON ${table}`,
            );
            await db.$executeRawUnsafe("DROP FUNCTION shipment_test_failure()");
            await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
          }
          let retained;
          const slow = {
            version: 5,
            supports: (t) => t === "SHIPMENT",
            apply: async (source, session) => {
              retained = session;
              await session.propose(source.payload, S.UNKNOWN);
              await new Promise((r) => setTimeout(r, 1200));
              return { outcome: "APPLIED" };
            },
          };
          const r = makeRepo(slow);
          const j = await prepare(
            [
              record(
                "one",
                payload({
                  trackingCode: "expired",
                  charges: { complete: true, lines: [line("9.99")] },
                }),
              ),
            ],
            r,
          );
          const work = await r.claim(randomUUID());
          await db.$executeRaw`UPDATE sync_jobs SET lease_expires_at=clock_timestamp()+interval '800 milliseconds' WHERE id=${j.id}::uuid`;
          await assert.rejects(r.apply(work), (e) => e.code === "SYNC_STALE");
          const after = await getRoot();
          assert.equal(after.trackingCode, before.trackingCode);
          assert.deepEqual(after.charges, before.charges);
          assert.equal(after.history.length, before.history.length);
          await assert.rejects(
            retained.propose({}, S.UNKNOWN),
            (e) => e.code === "SYNC_STALE",
          );
          await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
        },
      );
      await t.test(
        "APPLIED without proposal cannot mark source APPLIED",
        async () => {
          const r = makeRepo({
            version: 6,
            supports: () => true,
            apply: async () => ({ outcome: "APPLIED" }),
          });
          const j = await prepare(
            [record("one", payload({ trackingCode: "no-proposal" }))],
            r,
          );
          const work = await r.claim(randomUUID());
          await assert.rejects(
            r.apply(work),
            (e) => e.code === "PROCESSOR_UNAVAILABLE",
          );
          assert.notEqual((await getRoot()).trackingCode, "no-proposal");
          await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
        },
      );
      await t.test(
        "reconnect preserves current charges/history and internal metadata",
        async () => {
          const before = await getRoot();
          await db.$disconnect();
          db = createDatabase(url.toString());
          assert.deepEqual(await getRoot(), before);
        },
      );
      repo = makeRepo(
        new ShipmentSyncProcessor(
          7,
          { "new-synthetic": S.DELIVERED },
          () => {},
        ),
      );
      await run(
        payload({
          providerStatus: "new-synthetic",
          charges: {
            complete: true,
            lines: [line("2.02", "OTHER"), line("3.03", "OTHER")],
          },
        }),
      );
      await t.test(
        "captured provider proposal and trusted scope cannot be mutated",
        async () => {
          const p = {
            version: 8,
            supports: (type) => type === "SHIPMENT",
            apply: async (source, session) => {
              assert.equal(Object.isFrozen(session.scope), true);
              assert.equal(session.scope.ownerId, owner.id);
              const proposed = globalThis.structuredClone(source.payload);
              await session.propose(proposed, S.DELIVERED);
              proposed.trackingCode = "mutated-after-proposal";
              proposed.charges.lines[0].amount = "0.00";
              await assert.rejects(
                session.propose({}, S.UNKNOWN),
                (e) => e.code === "SOURCE_CONFLICT",
              );
              return { outcome: "APPLIED" };
            },
          };
          repo = makeRepo(p);
          await run(
            payload({
              trackingCode: "proposal-kept",
              charges: { complete: true, lines: [line("8.88")] },
            }),
          );
          const stored = await getRoot();
          assert.equal(stored.trackingCode, "proposal-kept");
          assert.equal(stored.charges[0].amount.toFixed(2), "8.88");
          assert.ok(stored.customerId);
        },
      );
      await t.test(
        "provider stage time is explicit and never derived from root update or observation",
        async () => {
          repo = makeRepo(
            new ShipmentSyncProcessor(
              9,
              { "new-synthetic": S.DELIVERED },
              () => {},
            ),
          );
          await run(
            payload({
              providerStatus: "clock-synthetic",
              providerUpdatedAt: "2026-11-13T10:00:00.000Z",
              providerChangedAt: "2026-11-12T09:00:00.000Z",
            }),
          );
          const first = await getRoot();
          assert.equal(
            first.history.at(-1).providerChangedAt.toISOString(),
            "2026-11-12T09:00:00.000Z",
          );
          assert.equal(
            first.providerUpdatedAt.toISOString(),
            "2026-11-13T10:00:00.000Z",
          );
          await run(payload({ providerStatus: "new-synthetic" }));
          const second = await getRoot();
          assert.equal(second.history.at(-1).providerChangedAt, null);
          assert.equal(
            second.providerUpdatedAt.toISOString(),
            "2026-11-13T10:00:00.000Z",
          );
        },
      );
      await t.test(
        "stale source version and changed owner generation cannot replace Shipment state",
        async () => {
          const before = await getRoot();
          repo = makeRepo(
            new ShipmentSyncProcessor(
              10,
              { "new-synthetic": S.DELIVERED },
              () => {},
            ),
          );
          let j = await prepare([
            record("one", payload({ trackingCode: "stale-version" })),
          ]);
          let work = await repo.claim(randomUUID());
          const item = await db.syncJobItem.findFirstOrThrow({
            where: { job_id: j.id },
          });
          await db.providerSourceRecord.update({
            where: { source_identity_id: item.source_identity_id },
            data: { source_version: { increment: 1 } },
          });
          await assert.rejects(
            repo.apply(work),
            (e) => e.code === "SOURCE_CONFLICT",
          );
          assert.equal((await getRoot()).trackingCode, before.trackingCode);
          await db.providerSourceRecord.update({
            where: { source_identity_id: item.source_identity_id },
            data: { source_version: item.source_version },
          });
          await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
          j = await prepare([
            record("one", payload({ trackingCode: "stale-generation" })),
          ]);
          work = await repo.claim(randomUUID());
          await db.carrierUserState.upsert({
            where: { userId: owner.id },
            create: { userId: owner.id, generation: 1 },
            update: { generation: { increment: 1 } },
          });
          await assert.rejects(
            repo.apply(work),
            (e) => e.code === "SYNC_STALE",
          );
          assert.equal((await getRoot()).trackingCode, before.trackingCode);
          assert.deepEqual((await getRoot()).charges, before.charges);
          await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE id=${j.id}::uuid`;
        },
      );
      repo = makeRepo(
        new ShipmentSyncProcessor(
          11,
          { "new-synthetic": S.DELIVERED },
          () => {},
        ),
      );
      await run(
        payload({
          providerStatus: "new-synthetic",
          charges: {
            complete: true,
            lines: [line("2.02", "OTHER"), line("3.03", "OTHER")],
          },
        }),
      );
      await run(payload({ providerStatus: "unknown-for-counts" }), "two");
      // Same runtime password used by the existing Customer fixture; no worker role rotation.
      await provisionRuntime(url.toString(), runtimePassword);
      const appUrl = runtimeUrl(url.toString(), runtimePassword);
      identity = new IdentityDatabaseAdapter(appUrl);
      const tokens = [];
      for (const user of [owner, other, adminActor])
        tokens.push(
          (
            await loginWithMfa(
              identity,
              user.username,
              "ShipmentFixturePass123!",
            )
          ).token,
        );
      process.env.DATABASE_URL = appUrl;
      process.env.STORAGE_ROOT = storage;
      app = await NestFactory.create(AppModule, {
        logger: false,
        abortOnError: false,
      });
      configure(app);
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl();
      const req = async (path, token = tokens[0]) => {
        const response = await fetch(base + "/api/shipments" + path, {
          headers: token ? { cookie: "nexora_session=" + token } : {},
        });
        return { response, body: await response.json() };
      };
      await t.test(
        "real HTTP authentication, errors and cross-owner isolation",
        async () => {
          for (const [path, token, status] of [
            ["", null, 401],
            ["", "invalid", 401],
            ["/bad", tokens[0], 400],
            ["?page=0", tokens[0], 400],
            ["?pageSize=101", tokens[0], 400],
            ["?stage=INVALID", tokens[0], 400],
            ["?claim=open", tokens[0], 422],
            ["/" + root.id, tokens[1], 404],
            ["/" + root.id, tokens[2], 404],
            ["/" + root.id + "/history", tokens[1], 404],
            ["/" + randomUUID(), tokens[0], 404],
          ]) {
            const { response, body } = await req(path, token);
            assert.equal(response.status, status, JSON.stringify(body));
            assert.equal(typeof body.code, "string");
            assert.equal(typeof body.requestId, "string");
            assert.equal(body.requestId, response.headers.get("x-request-id"));
            assert.match(response.headers.get("cache-control"), /no-store/);
          }
        },
      );
      await t.test(
        "real HTTP stable list/search/counts, exact strings and bounded history",
        async () => {
          const page = await req("?pageSize=1");
          assert.equal(page.response.status, 200);
          assert.equal(page.body.pagination.total, 2);
          assert.equal(page.body.shipments.length, 1);
          assert.match(page.body.shipments[0].code, /^SHP\d{6,}$/);
          const nextPage = await req("?pageSize=1&page=2");
          assert.notEqual(
            nextPage.body.shipments[0].id,
            page.body.shipments[0].id,
          );
          const repeated = await req("?pageSize=1");
          assert.equal(
            repeated.body.shipments[0].id,
            page.body.shipments[0].id,
          );
          assert.equal(page.body.stats.total, 2);
          assert.equal(page.body.stats.claims, null);
          assert.equal(page.body.claimFilterAvailable, false);
          const foreign = await req("", tokens[1]);
          assert.equal(foreign.body.pagination.total, 0);
          const adminList = await req("", tokens[2]);
          assert.equal(adminList.body.pagination.total, 0);
          const literal = await req("?q=%25");
          assert.equal(literal.body.pagination.total, 0);
          const stage = await req("?stage=DELIVERED");
          assert.equal(stage.body.pagination.total, 1);
          assert.equal(stage.body.stats.total, 2);
          assert.equal(stage.body.stats.byStage.UNKNOWN, 1);
          assert.equal(stage.body.stats.byStage.DELIVERED, 1);
          const detail = await req("/" + root.id);
          assert.equal(detail.body.shipment.code, root.code);
          assert.match(detail.body.shipment.code, /^SHP\d{6,}$/);
          const listed = await req("?pageSize=100");
          assert.equal(
            listed.body.shipments.find((shipment) => shipment.id === root.id)
              .code,
            detail.body.shipment.code,
          );
          assert.equal(detail.body.shipment.totalAmount, "500.00");
          assert.equal(detail.body.shipment.internalNote, "Nexora-owned");
          assert.ok(detail.body.shipment.customerId);
          assert.deepEqual(
            detail.body.shipment.charges.map((x) => [x.lineNo, x.amount]),
            [
              [1, "2.02"],
              [2, "3.03"],
            ],
          );
          assert.ok(!Object.hasOwn(detail.body.shipment, "ownerUserId"));
          const history = await req("/" + root.id + "/history?pageSize=1");
          assert.equal(history.body.history.length, 1);
          assert.ok(history.body.pagination.total >= 3);
          assert.equal(history.body.history[0].providerChangedAt, null);
          assert.ok(history.body.history[0].observedAt);
        },
      );
      await t.test(
        "milestones and item values reconcile by key without rewriting unchanged rows",
        async () => {
          // Reuse the file's real owner/connection and fenced repository setup, with independent identities.
          const childOwner = await db.user.create({
            data: {
              username: "children-" + randomUUID(),
              role: "OPERATOR",
              credential: { create: { passwordHash: hash } },
            },
          });
          const childConnection = await db.carrierConnection.create({
            data: {
              userId: childOwner.id,
              provider: "uniship",
              externalAccountId: "children-" + randomUUID(),
              displayName: "Independent children fixture",
              status: "CONNECTED",
            },
          });
          const childRepo = makeRepo(
            new ShipmentSyncProcessor(
              1,
              { at: S.AT_ORIGIN_WAREHOUSE, done: S.DELIVERED },
              () => {},
            ),
          );
          const childKey = "children-" + randomUUID();
          const run = async (
            p,
            r = childRepo,
            beforeApply = async () => {},
          ) => {
            const j = await r.admit(
              childOwner.id,
              childConnection.id,
              "SHIPMENT",
              "MANUAL",
            );
            const fetching = await r.claim(randomUUID());
            await r.page(
              fetching,
              { records: [record(childKey, p)], done: true },
              r.capabilities.resolve("uniship", "SHIPMENT").processor.version,
            );
            for (let n = 0; n < 10; n++) {
              const state = await r.job(
                childOwner.id,
                childConnection.id,
                j.id,
              );
              if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(state.status))
                return state;
              const work = await r.claim(randomUUID());
              await beforeApply(work);
              await r.apply(work);
            }
            throw Error("independent children job did not settle");
          };
          const getRoot = () =>
            db.shipment.findFirstOrThrow({
              where: { ownerUserId: childOwner.id },
              include: {
                charges: { orderBy: { lineNo: "asc" } },
                milestones: { orderBy: { milestoneCode: "asc" } },
                items: { orderBy: { lineNo: "asc" } },
              },
            });
          let root;
          const patch = (value = "1234567890123456.78") =>
            payload({
              milestones: {
                complete: true,
                entries: [
                  {
                    milestoneCode: "DEST_RECEIVED",
                    occurredAt: "2026-11-14T00:00:00.000Z",
                    locationName: "Destination",
                  },
                ],
              },
              items: {
                complete: true,
                lines: [
                  {
                    name: "Product",
                    quantity: 2,
                    unitValue: value,
                    currency: value === null ? null : "CNY",
                  },
                  { name: "Second" },
                ],
              },
            });
          assert.equal((await run(patch())).status, "SUCCEEDED");
          const first = await getRoot();
          root = first;
          assert.equal(first.milestones.length, 1);
          assert.equal(first.items.length, 2);
          assert.equal(
            first.items[0].unitValue.toFixed(2),
            "1234567890123456.78",
          );
          const childToken = (
            await loginWithMfa(
              identity,
              childOwner.username,
              "ShipmentFixturePass123!",
            )
          ).token;
          const detail = await req("/" + first.id, childToken);
          assert.equal(detail.response.status, 200);
          assert.equal(
            detail.body.shipment.items[0].unitValue,
            "1234567890123456.78",
          );
          assert.equal(detail.body.shipment.items[1].unitValue, null);
          assert.equal(
            detail.body.shipment.milestoneSummary.destWarehouse,
            "Destination",
          );
          assert.deepEqual(detail.body.shipment.itemSummary, {
            firstName: "Product",
            lineCount: 2,
          });
          const page = await req("", childToken);
          assert.equal(page.body.shipments[0].id, first.id);
          assert.equal(
            page.body.shipments[0].milestoneSummary.destReceivedAt,
            "2026-11-14T00:00:00.000Z",
          );
          assert.equal(
            page.body.shipments[0].chargeSummary.unitPrice.state,
            "NONE",
          );
          assert.equal(
            Object.hasOwn(page.body.shipments[0].itemSummary, "unitValue"),
            false,
          );
          await run({
            ...patch(),
            originWarehouse: "Origin",
            weightKg: "1.234",
            packageCount: 0,
            itemCount: 7,
            declaredValue: "456.78",
            declaredCurrency: "USD",
            charges: {
              complete: true,
              lines: [
                line("1.11", "UNIT_PRICE"),
                { ...line("2.22", "UNIT_PRICE"), currency: "USD" },
                line("3.33"),
                ...["INSURANCE", "COUNTING", "WOOD_PACKING", "BUBBLE_WRAP"].map(
                  (code) => line("0.00", code),
                ),
              ],
            },
          });
          const multiple = (await req("", childToken)).body.shipments[0];
          assert.deepEqual(multiple.chargeSummary.unitPrice, {
            state: "MULTIPLE",
            amount: null,
            currency: null,
          });
          assert.deepEqual(multiple.chargeSummary.domesticShipping, {
            state: "SINGLE",
            amount: "3.33",
            currency: "CNY",
          });
          for (const flag of [
            "hasInsurance",
            "hasCounting",
            "hasWoodPacking",
            "hasBubbleWrap",
          ])
            assert.equal(multiple.chargeSummary[flag], true);
          assert.equal(multiple.weightKg, "1.234");
          assert.equal(multiple.declaredValue, "456.78");
          assert.equal(multiple.originWarehouse, "Origin");
          assert.equal(multiple.itemCount, 7);
          const versions = async () =>
            db.$queryRawUnsafe(
              `SELECT id,xmin::text AS version FROM shipment_items WHERE shipment_id=$1::uuid ORDER BY line_no`,
              root.id,
            );
          const before = await versions();
          await run({ ...patch(), trackingCode: "CHANGED-ROOT" });
          assert.deepEqual(await versions(), before);
          await run(patch("1.25"));
          const changed = await getRoot();
          assert.equal(changed.items[0].id, first.items[0].id);
          assert.equal(changed.milestones[0].id, first.milestones[0].id);
          assert.equal(changed.items[0].unitValue.toFixed(2), "1.25");
          await run(patch(null));
          const cleared = await getRoot();
          assert.equal(cleared.items[0].unitValue, null);
          assert.equal(cleared.items[0].currency, null);
          await run(payload({ trackingCode: "OMITTED" }));
          assert.deepEqual((await getRoot()).items, cleared.items);
          await run(
            payload({
              milestones: { complete: true, entries: [] },
              items: { complete: true, lines: [] },
            }),
          );
          assert.equal((await getRoot()).items.length, 0);
          assert.equal((await getRoot()).milestones.length, 0);
          const empty = await getRoot();
          await db.$executeRawUnsafe(
            "CREATE FUNCTION shipment_child_rollback() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic child rollback'; END $$",
          );
          await db.$executeRawUnsafe(
            "CREATE TRIGGER shipment_child_rollback BEFORE INSERT ON shipment_items FOR EACH ROW WHEN (NEW.line_no=2) EXECUTE FUNCTION shipment_child_rollback()",
          );
          try {
            await assert.rejects(
              run({
                ...patch(),
                trackingCode: "must-rollback",
                charges: { complete: true, lines: [line("9.99")] },
              }),
              (e) =>
                /Code: `P0001`/.test(e.message) &&
                /synthetic child rollback/.test(e.message),
            );
            const job = await db.syncJob.findFirstOrThrow({
              where: { owner_user_id: childOwner.id },
              orderBy: { created_at: "desc" },
            });
            const item = await db.syncJobItem.findFirstOrThrow({
              where: { job_id: job.id },
            });
            assert.equal(item.processing_outcome, "PENDING");
            assert.deepEqual(await getRoot(), empty);
          } finally {
            await db.$executeRawUnsafe(
              "DROP TRIGGER shipment_child_rollback ON shipment_items",
            );
            await db.$executeRawUnsafe(
              "DROP FUNCTION shipment_child_rollback()",
            );
          }

          await db.$executeRaw`UPDATE sync_jobs SET status='CANCELLED',worker_id=NULL,lease_expires_at=NULL WHERE owner_user_id=${childOwner.id}::uuid AND status='RUNNING'`;
          const slowRepo = makeRepo({
            version: 2,
            supports: (type) => type === "SHIPMENT",
            apply: async (source, session) => {
              await session.propose(source.payload, S.UNKNOWN);
              await new Promise((resolve) => setTimeout(resolve, 1200));
              return { outcome: "APPLIED" };
            },
          });
          await assert.rejects(
            run(
              {
                ...patch(),
                charges: { complete: true, lines: [line("7.77")] },
              },
              slowRepo,
              async (work) => {
                await db.$executeRaw`UPDATE sync_jobs SET lease_expires_at=clock_timestamp()+interval '800 milliseconds' WHERE id=${work.id}::uuid`;
              },
            ),
            (e) => e.code === "SYNC_STALE",
          );
          assert.deepEqual(await getRoot(), empty);
          const staleJob = await db.syncJob.findFirstOrThrow({
            where: { owner_user_id: childOwner.id },
            orderBy: { created_at: "desc" },
          });
          assert.equal(
            (
              await db.syncJobItem.findFirstOrThrow({
                where: { job_id: staleJob.id },
              })
            ).processing_outcome,
            "PENDING",
          );
        },
      );
      await t.test(
        "real API transaction preserves worker exclusion, concurrent workers and bounded batch query count",
        async () => {
          const {
            ShipmentAdapter,
          } = require("../dist/shipment/infrastructure/shipment.adapter");
          const { Prisma } = require("@nexora/database");
          const actor = await db.user.create({
            data: { username: "locks-" + randomUUID(), role: "OPERATOR" },
          });
          await db.shipment.createMany({
            data: [
              { ownerUserId: actor.id, trackingCode: "lock-one" },
              { ownerUserId: actor.id, trackingCode: "lock-two" },
            ],
          });
          const reader = new ShipmentAdapter(appUrl),
            worker1 = createDatabase(workerUrl),
            worker2 = createDatabase(workerUrl);
          const client = reader.client,
            original = client.$transaction.bind(client);
          const gate = () => {
            let resolve;
            const promise = new Promise((r) => {
              resolve = r;
            });
            return { promise, resolve };
          };
          let readStarted = gate(),
            readHold = null,
            calls = [];
          reader.instance = {
            $transaction: (fn) =>
              original(
                async (tx) => {
                  const pid = (
                    await tx.$queryRaw`SELECT pg_backend_pid() AS pid`
                  )[0].pid;
                  readStarted.resolve(pid);
                  const proxy = new Proxy(tx, {
                    get(target, key) {
                      if (key === "$queryRaw")
                        return (first, ...values) => {
                          const sql =
                            Array.isArray(first) && Object.hasOwn(first, "raw")
                              ? Prisma.sql(first, ...values)
                              : first;
                          calls.push(sql.sql);
                          return target.$queryRaw(sql);
                        };
                      return Reflect.get(target, key);
                    },
                  });
                  const result = await fn(proxy);
                  if (readHold) {
                    readHold.ready.resolve();
                    await readHold.release.promise;
                  }
                  return result;
                },
                { timeout: 10000 },
              ),
            $disconnect: () => client.$disconnect(),
          };
          const pending = [],
            releases = [];
          const holdWorker = (worker) => {
            const ready = gate(),
              release = gate();
            releases.push(release);
            const done = worker.$transaction(
              async (tx) => {
                const pid = (
                  await tx.$queryRaw`SELECT pg_backend_pid() AS pid`
                )[0].pid;
                await tx.$queryRaw`SELECT status FROM public.sync_lock_user(${actor.id}::uuid)`;
                ready.resolve(pid);
                await release.promise;
              },
              { timeout: 10000 },
            );
            pending.push(done);
            return { ready, release, done };
          };
          const blocked = async (waiter, holder) => {
            const deadline = Date.now() + 3000;
            while (Date.now() < deadline) {
              const rows =
                await db.$queryRaw`SELECT ${holder}::int=ANY(pg_blocking_pids(${waiter}::int)) AS blocked`;
              if (rows[0].blocked) return;
              await new Promise(setImmediate);
            }
            assert.fail("expected bounded PostgreSQL lock wait");
          };
          try {
            const held = holdWorker(worker1);
            const workerPid = await held.ready.promise;
            const reading = reader.list(actor.id, { page: 1, pageSize: 1 });
            pending.push(reading);
            const readPid = await readStarted.promise;
            assert.notEqual(readPid, workerPid);
            await blocked(readPid, workerPid);
            held.release.resolve();
            await held.done;
            await reading;
            calls = [];
            readStarted = gate();
            readHold = { ready: gate(), release: gate() };
            releases.push(readHold.release);
            const reading2 = reader.list(actor.id, { page: 1, pageSize: 2 });
            pending.push(reading2);
            await readHold.ready.promise;
            const readPid2 = await readStarted.promise;
            const workerStarted = gate();
            const waiting = worker1.$transaction(
              async (tx) => {
                workerStarted.resolve(
                  (await tx.$queryRaw`SELECT pg_backend_pid() AS pid`)[0].pid,
                );
                await tx.$queryRaw`SELECT status FROM public.sync_lock_user(${actor.id}::uuid)`;
              },
              { timeout: 10000 },
            );
            pending.push(waiting);
            await blocked(await workerStarted.promise, readPid2);
            readHold.release.resolve();
            await reading2;
            await waiting;
            readHold = null;
            assert.equal(calls.length, 6);
            assert.equal(calls.filter((sql) => sql.includes("ANY(")).length, 3);
            calls = [];
            await reader.list(actor.id, { page: 1, pageSize: 1 });
            assert.equal(calls.length, 6);
            calls = [];
            await reader.list(actor.id, { page: 99, pageSize: 20 });
            assert.equal(calls.length, 3);
            const shared = holdWorker(worker1);
            await shared.ready.promise;
            const parallel = worker2.$transaction(async (tx) => {
              await tx.$executeRaw`SET LOCAL statement_timeout='3000ms'`;
              return tx.$queryRaw`SELECT status FROM public.sync_lock_user(${actor.id}::uuid)`;
            });
            pending.push(parallel);
            assert.equal((await parallel)[0].status, "ACTIVE");
            shared.release.resolve();
            await shared.done;
            await db.user.update({
              where: { id: actor.id },
              data: { status: "DISABLED" },
            });
            await assert.rejects(
              reader.list(actor.id, { page: 1, pageSize: 20 }),
              (e) => e.code === "UNAUTHORIZED",
            );
          } finally {
            for (const release of releases) release.resolve();
            await Promise.allSettled(pending);
            await reader.close();
            await worker1.$disconnect();
            await worker2.$disconnect();
          }
        },
      );
    } finally {
      await app?.close();
      await identity?.client.$disconnect();
      for (const r of repos) await r.close();
      await db?.$disconnect();
      if (owned)
        await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
      await admin.$disconnect();
      await rm(storage, { recursive: true, force: true });
      for (const k of Object.keys(process.env))
        if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  },
);
