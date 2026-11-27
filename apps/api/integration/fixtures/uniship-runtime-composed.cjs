const { performance } = globalThis;
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const { createServer } = require("node:http");
const { mkdtemp, rm, readFile } = require("node:fs/promises");
const { join, resolve } = require("node:path");
const { hashPassword } = require("@nexora/database");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../../dist/app.module");
const { SyncWorkerModule } = require("../../dist/worker/sync-worker.module");
const { SyncPort } = require("../../dist/sync/application/sync.port");
const { configure } = require("../../dist/http");
const { loadConfig } = require("../../dist/config");
const { loadSyncConfig } = require("../../dist/sync/domain/sync-policy");
const { setTimeout: delay } = require("node:timers/promises");
const {
  LocalStorage,
} = require("../../dist/storage/infrastructure/local-storage");
module.exports = async function verifyComposedRuntime(
  t,
  { db, apiUrl, workerUrl },
) {
  await t.test(
    "actual Nest API and Worker compose the same scoped capability without live activation",
    async () => {
      const owner = await db.user.create({
        data: {
          username: "runtime-" + randomUUID(),
          role: "OPERATOR",
          credential: {
            create: {
              passwordHash: await hashPassword("RuntimeSyntheticPassword!23"),
            },
          },
        },
      });
      const account = BigInt(
          "0x" + randomUUID().replaceAll("-", ""),
        ).toString(),
        events = [];
      const captured = JSON.parse(
        await readFile(
          resolve("test/fixtures/uniship/transition-page.json"),
          "utf8",
        ),
      );
      const warehouses = JSON.parse(
        await readFile(
          resolve("test/fixtures/uniship/china-stores.json"),
          "utf8",
        ),
      );
      // Explicit synthetic derivatives; immutable captured fixtures remain unchanged.
      const sample = captured.data[0];
      let records = [0, 1].map((i) => ({
          ...sample,
          ID: 900000 + i,
          TransactionCode: "synthetic-controlled-" + i,
        })),
        rejectPage = 0,
        authCount = 0,
        wrongAccount = false;

      const mock = createServer(async (req, res) => {
        const url = new URL(req.url, "http://mock");
        events.push({ path: url.pathname, at: performance.now() });
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const body = raw ? JSON.parse(raw) : {};
        res.setHeader("content-type", "application/json");
        if (url.pathname === "/client/api-token-auth/") {
          authCount++;
          res.end(
            JSON.stringify({
              token: "synthetic.token." + authCount,
              user: {
                userid: wrongAccount
                  ? "999999999999999999999999999999999999999999999999"
                  : account,
              },
            }),
          );
        } else if (url.pathname === "/client/api-token-verify/")
          res.end(
            JSON.stringify({
              token: body.token,
              user: {
                userid: wrongAccount
                  ? "999999999999999999999999999999999999999999999999"
                  : account,
              },
            }),
          );
        else if (url.pathname === "/client/api/chinaStores/") {
          assert.equal(
            req.headers.authorization,
            "Bearer synthetic.token." + authCount,
          );
          res.end(JSON.stringify(warehouses));
        } else if (url.pathname === "/client/api/transition/") {
          assert.equal(
            req.headers.authorization,
            "Bearer synthetic.token." + authCount,
          );
          assert.equal(url.searchParams.get("ecommerce"), "true");
          assert.equal(url.searchParams.get("q"), "");
          assert.deepEqual(
            JSON.parse(
              Buffer.from(url.searchParams.get("filter"), "base64").toString(),
            ),
            {
              filter: [{ column: "IsEcommerce", value: 1, condition: "equal" }],
            },
          );
          const page = Number(url.searchParams.get("page"));
          assert.equal(url.searchParams.get("rowsPerPage"), "100");
          if (rejectPage === page) {
            rejectPage = 0;
            res.statusCode = 401;
            res.end("{}");
            return;
          }
          const offset = (page - 1) * 100;
          res.end(
            JSON.stringify({
              ...captured,
              data: records.slice(offset, offset + 100),
              offset,
              rowsPerPage: 100,
              total: records.length,
            }),
          );
        } else {
          res.statusCode = 404;
          res.end("{}");
        }
      });
      await new Promise((r) => mock.listen(0, "127.0.0.1", r));
      const storage = await mkdtemp(
        join(process.env.STORAGE_ROOT, "composed-"),
      );
      const settings = {
        NODE_ENV: "test",
        DATABASE_URL: apiUrl,
        STORAGE_ROOT: storage,
        SYNC_ENABLED: "true",
        SYNC_POLL_MS: "10",
        UNISHIP_API_URL: "http://127.0.0.1:" + mock.address().port,
        UNISHIP_LIVE_AUTHORIZED: "false",
        UNISHIP_ACTIVATION_POLICY_JSON: JSON.stringify({
          ownerUserId: owner.id,
          externalAccountId: account,
          loginIdentifier: "synthetic-login",
          mode: "MANUAL_ONLY",
        }),
        UNISHIP_RECONCILIATION_POLICY_JSON: "",
        ALLOWED_ORIGINS: "http://localhost:3001",
        CARRIER_KEYRING_JSON: JSON.stringify({
          1: randomBytes(32).toString("base64"),
        }),
        CARRIER_ACTIVE_KEY_VERSION: "1",
      };
      const saved = Object.fromEntries(
        Object.keys(settings).map((key) => [key, process.env[key]]),
      );
      let api, worker;
      try {
        Object.assign(process.env, settings);
        const config = loadConfig(process.env);
        loadSyncConfig(process.env);
        assert.equal(
          await new LocalStorage(config.STORAGE_ROOT).isReady(),
          true,
        );
        assert.equal(config.UNISHIP_LIVE_AUTHORIZED, "false");
        api = await NestFactory.create(AppModule, {
          logger: false,
          abortOnError: false,
        });
        configure(api);
        await api.listen(0, "127.0.0.1");
        assert.equal(api.get(SyncPort).available("uniship", "SHIPMENT"), true);
        let cookie = "";
        async function request(path, method = "GET", body) {
          const response = await fetch((await api.getUrl()) + "/api" + path, {
            method,
            headers: {
              origin: "http://localhost:3001",
              ...(cookie ? { cookie } : {}),
              ...(body ? { "content-type": "application/json" } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          const result = await response.json();
          return { response, result };
        }
        const login = await request("/auth/login", "POST", {
          username: owner.username,
          password: "RuntimeSyntheticPassword!23",
        });
        assert.equal(login.response.status, 200);
        cookie = login.response.headers.get("set-cookie").split(";")[0];
        const beforeForeign = events.length;
        assert.equal(
          (
            await request("/carrier-connections", "POST", {
              provider: "uniship",
              loginIdentifier: "wrong-login",
              password: "synthetic-password",
              displayName: "Wrong login",
            })
          ).response.status,
          503,
        );
        assert.equal(events.length, beforeForeign);
        wrongAccount = true;
        assert.equal(
          (
            await request("/carrier-connections", "POST", {
              provider: "uniship",
              loginIdentifier: "synthetic-login",
              password: "synthetic-password",
              displayName: "Wrong account",
            })
          ).response.status,
          400,
        );
        assert.equal(
          await db.carrierConnection.count({ where: { userId: owner.id } }),
          0,
        );
        wrongAccount = false;
        const connected = await request("/carrier-connections", "POST", {
          provider: "uniship",
          loginIdentifier: "synthetic-login",
          password: "synthetic-password",
          displayName: "Controlled mock",
        });
        assert.equal(
          connected.response.status,
          201,
          JSON.stringify(connected.result),
        );
        const id = connected.result.connection.id,
          initialAuth = authCount;

        const schedule = await db.syncConfig.findFirst({
          where: { carrier_connection_id: id, sync_type: "SHIPMENT" },
        });
        assert.equal(schedule.enabled, true);
        assert.equal(schedule.interval_minutes, 60);
        await db.syncConfig.update({
          where: { id: schedule.id },
          data: { next_run_at: new Date(0) },
        });
        async function startWorker() {
          process.env.DATABASE_URL = workerUrl;
          worker = await NestFactory.createApplicationContext(
            SyncWorkerModule,
            { logger: false, abortOnError: false },
          );
          const {
            SyncRepository,
          } = require("../../dist/sync/infrastructure/sync-job.repository");
          assert.equal(
            worker.get(SyncRepository).available("uniship", "SHIPMENT"),
            true,
          );
        }
        async function stopWorker() {
          await worker?.close();
          worker = undefined;
        }
        async function complete(jobId) {
          for (let n = 0; n < 500; n++) {
            const job = await db.syncJob.findUnique({ where: { id: jobId } });
            if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(job.status))
              return job;
            await delay(20);
          }
          assert.fail("controlled mock job did not terminate");
        }
        async function manual() {
          const admitted = await request(
            "/carrier-connections/" + id + "/sync-jobs",
            "POST",
            { syncType: "SHIPMENT" },
          );
          assert.equal(
            admitted.response.status,
            201,
            JSON.stringify(admitted.result),
          );
          return complete(admitted.result.job.id);
        }
        await startWorker();
        await delay(100);
        assert.equal(
          await db.syncJob.count({
            where: { carrier_connection_id: id, trigger_source: "AUTO" },
          }),
          0,
        );
        const first = await manual();
        assert.equal(first.status, "SUCCEEDED");
        assert.equal(first.reconciliationReason, "POLICY_NOT_CONFIGURED");
        assert.equal(authCount, initialAuth);
        let page = await request("/shipments");
        assert.equal(page.response.status, 200);
        assert.equal(page.result.shipments.length, 2);
        const originals = await db.shipment.findMany({
          where: { carrierConnectionId: id },
          orderBy: { trackingCode: "asc" },
        });
        assert.equal(originals.length, 2);
        // Homogeneous frozen configuration changes require draining both processes.
        await stopWorker();
        await api.close();
        api = undefined;
        process.env.UNISHIP_RECONCILIATION_POLICY_JSON = JSON.stringify({
          maxNewlyMissing: 10,
          maxMissingRatioBps: 10000,
          maxObservedDropRatioBps: 10000,
        });
        process.env.DATABASE_URL = apiUrl;
        api = await NestFactory.create(AppModule, {
          logger: false,
          abortOnError: false,
        });
        configure(api);
        await api.listen(0, "127.0.0.1");
        // Request helper reads the current listener after each restart.
        await startWorker();
        const baseline = await manual();
        assert.equal(baseline.status, "SUCCEEDED");
        assert.equal(baseline.reconciliationStatus, "BASELINE_ESTABLISHED");
        records = records.slice(0, 1);
        const hidden = await manual();
        assert.equal(hidden.status, "SUCCEEDED");
        assert.equal(hidden.reconciliationNewlyHiddenCount, 1);
        assert.equal((await request("/shipments")).result.shipments.length, 1);
        assert.equal(
          (await request("/shipments/" + originals[1].id)).response.status,
          404,
        );
        records = [0, 1].map((i) => ({
          ...sample,
          ID: 900000 + i,
          TransactionCode: "synthetic-controlled-" + i,
        }));
        const restored = await manual();
        assert.equal(restored.reconciliationRestoredCount, 1);
        assert.equal(
          (await request("/shipments/" + originals[1].id)).response.status,
          200,
        );
        assert.deepEqual(
          (
            await db.shipment.findMany({
              where: { carrierConnectionId: id },
              orderBy: { trackingCode: "asc" },
            })
          ).map((x) => x.id),
          originals.map((x) => x.id),
        );
        // A real mid-page 401 invokes Worker recovery; the immutable old job cannot continue.
        records = Array.from({ length: 101 }, (_, i) => ({
          ...sample,
          ID: 900000 + i,
          TransactionCode: "synthetic-controlled-" + i,
        }));
        rejectPage = 2;
        const oldVersion = (
          await db.carrierConnection.findUnique({ where: { id } })
        ).lifecycleVersion;
        const stale = await manual();
        assert.equal(stale.status, "CANCELLED");
        assert.equal(stale.lifecycle_version, oldVersion);
        assert.equal(stale.next_page, 2);
        assert.equal(stale.reconciliationStatus, null);
        assert.equal(authCount, initialAuth + 1);
        assert.equal(
          (await db.carrierConnection.findUnique({ where: { id } }))
            .lifecycleVersion,
          oldVersion + 2,
        );
        const replacement = await manual();
        assert.equal(replacement.status, "SUCCEEDED");
        assert.equal(replacement.lifecycle_version, oldVersion + 2);
        assert.equal(authCount, initialAuth + 1);
        assert.equal(
          await db.shipment.count({ where: { carrierConnectionId: id } }),
          101,
        );
        // Expiry before the first page also recovers once and cancels before page ingestion.
        await db.carrierConnectionSecret.updateMany({
          where: { connectionId: id, secretType: "ACCESS_TOKEN" },
          data: { expiresAt: new Date(0) },
        });
        const expired = await manual();
        assert.equal(expired.status, "CANCELLED");
        assert.equal(expired.fetched_count, 0);
        assert.equal(authCount, initialAuth + 2);
        assert.equal((await manual()).status, "SUCCEEDED");
        assert.equal(authCount, initialAuth + 2);
        await stopWorker();
        await api.close();
        api = undefined;
        const policy = JSON.parse(process.env.UNISHIP_ACTIVATION_POLICY_JSON);
        process.env.UNISHIP_ACTIVATION_POLICY_JSON = JSON.stringify({
          ...policy,
          connectionId: id,
          mode: "AUTOMATIC",
        });
        await db.syncConfig.update({
          where: { id: schedule.id },
          data: {
            enabled: true,
            interval_minutes: 60,
            next_run_at: new Date(0),
          },
        });
        const prior = await db.syncJob.count({
          where: { carrier_connection_id: id },
        });
        await startWorker();
        let auto;
        for (let n = 0; n < 500; n++) {
          auto = await db.syncJob.findFirst({
            where: { carrier_connection_id: id, trigger_source: "AUTO" },
            orderBy: { created_at: "desc" },
          });
          if (auto) break;
          await delay(20);
        }
        assert.ok(auto);
        const done = await complete(auto.id);
        assert.equal(done.status, "SUCCEEDED");
        assert.equal(
          await db.syncJob.count({ where: { carrier_connection_id: id } }),
          prior + 1,
        );
        const next = await db.syncConfig.findUnique({
          where: { id: schedule.id },
        });
        assert.ok(
          next.next_run_at.getTime() >=
            done.finished_at.getTime() + 60 * 60000 - 1000,
        );
        await stopWorker();
        const after = events.length;
        await delay(50);
        assert.equal(events.length, after);
      } finally {
        await worker?.close();
        await api?.close();
        for (const [key, value] of Object.entries(saved)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
        await new Promise((r) => mock.close(r));
        await rm(storage, { recursive: true, force: true });
      }
    },
  );
};
